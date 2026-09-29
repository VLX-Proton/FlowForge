const { app, BrowserWindow, ipcMain } = require('electron')
const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const { dialog } = require('electron')

let backendProcess = null
let mainWindow = null

// Redirect userData to folder next to AppImage (keeps system clean)
if (app.isPackaged) {
  const appImagePath = process.env.APPIMAGE
  const appImageDir = appImagePath ? path.dirname(appImagePath) : path.dirname(app.getPath('exe'))
  app.setPath('userData', path.join(appImageDir, '.config', 'flowforge'))
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    roundedCorners: true,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 16, y: 16 },
    // BARIS IKON INI SAJA YANG DITAMBAHKAN:
    icon: app.isPackaged 
      ? path.join(process.resourcesPath, 'build/icon.png')
      : path.join(__dirname, '../build/icon.png'),   
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true, 
      preload: path.join(__dirname, 'preload.js')
    }
  })

  mainWindow.loadURL('http://localhost:4000')

  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window-maximized')
  })
  
  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window-unmaximized')
  })

  mainWindow.webContents.on('did-finish-load', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.webContents.send('window-maximized')
    }
  })
}

ipcMain.on('window-minimize', () => mainWindow.minimize())
ipcMain.on('window-maximize', () => {
  if (mainWindow.isMaximized()) mainWindow.unmaximize()
  else mainWindow.maximize()
})
ipcMain.on('window-close', () => mainWindow.close())
ipcMain.on('devtools-open', () => mainWindow.webContents.openDevTools())

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  })
  if (result.canceled) return null
  return result.filePaths[0]
})

ipcMain.handle('scan-folder', async (event, folderPath) => {
  function scanDir(dir) {
    const results = []
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        results.push(...scanDir(fullPath))
      } else {
        results.push(fullPath)
      }
    }
    return results
  }
  try {
    return scanDir(folderPath)
  } catch (e) {
    return []
  }
})

ipcMain.handle('read-file', async (event, filePath) => {
  return fs.readFileSync(filePath)
})

ipcMain.handle('write-file', async (event, folderPath, filename, buffer) => {
  try {
    const fullPath = path.join(folderPath, filename)
    fs.writeFileSync(fullPath, Buffer.from(buffer))
    return { success: true, path: fullPath }
  } catch (e) {
    return { success: false, error: e.message }
  }
})

ipcMain.handle('delete-file', async (event, folderPath, filename) => {
  try {
    const fullPath = path.join(folderPath, filename)
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath)
    }
    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
})

async function waitForBackend() {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Backend startup timeout'))
    }, 30000)

    const interval = setInterval(async () => {
      try {
        const response = await fetch('http://localhost:4000/api/health')
        if (response.ok) {
          clearInterval(interval)
          clearTimeout(timeout)
          resolve()
        }
      } catch (e) {
        // Backend not ready yet, continue polling
      }
    }, 500)
  })
}

app.commandLine.appendSwitch('enable-transparent-overlays')

app.whenReady().then(async () => {
  const appRoot = app.isPackaged
    ? process.resourcesPath
    : path.join(__dirname, '..')

  const backendEntry = app.isPackaged
    ? path.join(appRoot, 'backend-dist', 'runtime-server.js')
    : path.join(appRoot, 'backend', 'runtime-server.ts')

  if (app.isPackaged) {
    const nodeBin = path.join(process.resourcesPath, '..', 'runtime', 'node')
    const appImagePath = process.env.APPIMAGE
    const appImageDir = appImagePath ? path.dirname(appImagePath) : appRoot

    // Redirect HuggingFace caches away from ~/.cache/huggingface (Root)
    const modelsDir = path.join(appImageDir, 'data', 'models')

    backendProcess = spawn('node', ['--expose-gc', backendEntry], {
      cwd: appRoot,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        APP_DATA_DIR: appImageDir,
        APP_ROOT: appRoot,
        HF_HOME: modelsDir,
        XDG_CACHE_HOME: modelsDir
      }
    })
  } else {
    backendProcess = spawn('ts-node', ['--project', 'backend/tsconfig.json', 'backend/runtime-server.ts'], {
      shell: true,
      cwd: appRoot,
      env: { ...process.env }
    })
  }

  backendProcess.stdout.on('data', (data) => console.log(`[BACKEND] ${data}`))
  backendProcess.stderr.on('data', (data) => console.error(`[BACKEND ERROR] ${data}`))

  try {
    await waitForBackend()
    createWindow()
  } catch (e) {
    console.error('Failed to start backend:', e.message)
    app.quit()
  }
})

app.on('window-all-closed', () => {
  if (backendProcess) {
    backendProcess.kill()
  }
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
