import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

const APP_DATA_DIR = process.env.APP_DATA_DIR

// 1) Lokasi .env di user data (di luar AppImage, bisa diubah user)
const userEnvPath = APP_DATA_DIR
  ? path.join(APP_DATA_DIR, 'data', '.env')
  : null

// 2) Lokasi .env bundled di dalam AppImage (resources/data/.env)
//    Backend di Elektron di-spawn dengan cwd = process.resourcesPath,
//    jadi process.cwd() mengarah ke folder yang sama dengan .env yang dibundle.
const bundledEnvPath = path.join(process.cwd(), 'data', '.env')

// 3) Fallback untuk dev mode
const devEnvPath = userEnvPath || bundledEnvPath

let envPath = userEnvPath || devEnvPath

// Jika .env belum ada di user data, copy dari bundled
if (userEnvPath && !fs.existsSync(userEnvPath) && fs.existsSync(bundledEnvPath)) {
  try {
    const userDir = path.dirname(userEnvPath)
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true })
    }
    fs.copyFileSync(bundledEnvPath, userEnvPath)
    console.log('[ENV] Copied bundled .env to user data:', userEnvPath)
  } catch (err) {
    console.warn('[ENV] Failed to copy bundled .env:', err.message)
    envPath = bundledEnvPath
  }
} else if (!fs.existsSync(envPath) && fs.existsSync(bundledEnvPath)) {
  envPath = bundledEnvPath
}

dotenv.config({ path: envPath })

export const MAX_FILES = 50
export const MAX_RECOVERY_MS = 30 * 60 * 1000
export const GIST_POLL_MS = 15 * 1000
export const GIST_ID = 'd273998b76b9ccd04d4ae4246d41aa44'
export const GIST_API_URL = `https://api.github.com/gists/${GIST_ID}`;

export function getGithubToken(): string {
  return process.env.GITHUB_TOKEN || '';
}
