import axios from 'axios'
import fs from 'fs'
import path from 'path'
import { GIST_API_URL, getGithubToken } from '../shared/constants'

const GITHUB_TOKEN = getGithubToken()
const APP_DATA_DIR = process.env.APP_DATA_DIR
const WORKER_FILE = APP_DATA_DIR ? path.join(APP_DATA_DIR, 'data', 'worker.json') : path.join(process.cwd(), 'backend', 'data', 'worker.json')

export async function syncWorkerUrl(): Promise<string> {
  try {
    const response = await axios.get(`${GIST_API_URL}?t=${Date.now()}`, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        'User-Agent': 'NodeJS-Gist-App',
        Accept: 'application/vnd.github+json'
      }
    })
    const colabUrl = response.data.files['hypir_url.txt'].content.trim()

    let oldUrl = ''
    try {
      if (fs.existsSync(WORKER_FILE)) {
        oldUrl = JSON.parse(fs.readFileSync(WORKER_FILE, 'utf8')).workerUrl
      }
    } catch (e) {}

    if (colabUrl && colabUrl.startsWith('https://')) {
      fs.writeFileSync(
        WORKER_FILE,
        JSON.stringify({ workerUrl: colabUrl }, null, 2)
      )
      if (oldUrl !== colabUrl) {
        console.log('[OTOMATIS] URL Worker tersinkronisasi dari API Gist:', colabUrl)
      }
      return colabUrl
    }
  } catch (error) {
    console.error('[ERROR] Gagal mengambil URL dari GitHub API:', error.message)
  }

  const dataLama = JSON.parse(fs.readFileSync(WORKER_FILE, 'utf8'))
  return dataLama.workerUrl
}
