import axios from 'axios'
import fs from 'fs'
import path from 'path'
import { isWorkerAlive } from './health'
import { MAX_RECOVERY_MS, GIST_POLL_MS, GIST_API_URL, getGithubToken } from '../shared/constants'

const GITHUB_TOKEN = getGithubToken()
const APP_DATA_DIR = process.env.APP_DATA_DIR
const WORKER_FILE = APP_DATA_DIR ? path.join(APP_DATA_DIR, 'data', 'worker.json') : path.join(process.cwd(), 'backend', 'data', 'worker.json')

export async function waitForLiveWorker(
  currentUrl: string,
  job: any,
  jobFilePath: string
): Promise<{ url: string, recovered: boolean }> {
  const deadline = Date.now() + MAX_RECOVERY_MS
  console.log('[RECOVERY] Worker unreachable. Polling Gist for new URL…')

  if (job && jobFilePath) {
    job.status = 'paused'
    job.pauseReason = 'Backend offline — waiting for Colab to reconnect'
    job.pausedAt = Date.now()
    fs.writeFileSync(jobFilePath, JSON.stringify(job, null, 2))
  }

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, GIST_POLL_MS))

    let freshUrl
    try {
      const response = await axios.get(`${GIST_API_URL}?t=${Date.now()}`, {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          'User-Agent': 'NodeJS-Gist-App',
          Accept: 'application/vnd.github+json'
        }
      })
      freshUrl = response.data.files['hypir_url.txt'].content.trim()
    } catch {
      console.warn('[RECOVERY] Gist fetch failed, will retry…')
      continue
    }

    if (!freshUrl || !freshUrl.startsWith('https://')) continue

    const alive = await isWorkerAlive(freshUrl)
    if (alive) {
      fs.writeFileSync(WORKER_FILE, JSON.stringify({ workerUrl: freshUrl }, null, 2))
      console.log('[RECOVERY] New live URL found:', freshUrl)

      if (job && jobFilePath) {
        job.status = 'processing'
        job.pauseReason = undefined
        job.resumedAt = Date.now()
        fs.writeFileSync(jobFilePath, JSON.stringify(job, null, 2))
      }
      return { url: freshUrl, recovered: true }
    }

    console.log('[RECOVERY] URL in Gist not yet live, keep waiting…')
  }

  console.error('[RECOVERY] 30-minute timeout reached. Marking job as error.')
  if (job && jobFilePath) {
    job.status = 'error'
    job.error = 'Connection timeout: Colab did not come back online within 30 minutes'
    fs.writeFileSync(jobFilePath, JSON.stringify(job, null, 2))
  }
  return { url: currentUrl, recovered: false }
}
