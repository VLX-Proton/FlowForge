const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  openDevTools: () => ipcRenderer.send('devtools-open'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  scanFolder: (path) => ipcRenderer.invoke('scan-folder', path),
  readFile: (path) => ipcRenderer.invoke('read-file', path),
  writeFile: (folderPath, filename, buffer) => ipcRenderer.invoke('write-file', folderPath, filename, buffer),
  deleteFile: (folderPath, filename) => ipcRenderer.invoke('delete-file', folderPath, filename),
  onMaximized: (callback) => ipcRenderer.on('window-maximized', callback),
  onUnmaximized: (callback) => ipcRenderer.on('window-unmaximized', callback),
})