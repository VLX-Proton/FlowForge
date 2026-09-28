import axios from 'axios'
import fs from 'fs'
import path from 'path'
import { syncWorkerUrl } from '../worker/gist-sync'
import { isWorkerAlive } from '../worker/health'
import { waitForLiveWorker } from '../worker/recovery'
import { GIST_API_URL, getGithubToken } from '../shared/constants'

const GITHUB_TOKEN = getGithubToken()
const APP_DATA_DIR = process.env.APP_DATA_DIR
const WORKER_FILE = APP_DATA_DIR
  ? path.join(APP_DATA_DIR, 'data', 'worker.json')
  : path.join(process.cwd(), 'backend', 'data', 'worker.json')

export async function workerRequest(
  method: string,
  endpoint: string,
  options: any,
  job: any,
  jobFilePath: string
): Promise<any> {
  let workerUrl = JSON.parse(fs.readFileSync(WORKER_FILE, 'utf8')).workerUrl

  const attempt = async (url: string) => {
    const fullUrl = `${url}${endpoint}`
    if (method === 'post') {
      return await axios.post(fullUrl, options.data, {
        headers: options.headers,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: options.timeout || 60000,
      })
    } else if (method === 'delete') {
      return await axios.delete(fullUrl, { timeout: options.timeout || 15000 })
    } else {
      return await axios.get(fullUrl, { timeout: options.timeout || 15000 })
    }
  }

  try {
    return await attempt(workerUrl)
  } catch (e: any) {
    console.warn(`[WORKER REQUEST] Failed (${endpoint}): ${e.message} — trying fresh Gist URL…`)
  }

  const freshUrl = await syncWorkerUrl()
  if (freshUrl && freshUrl !== workerUrl) {
    const alive = await isWorkerAlive(freshUrl)
    if (alive) {
      try {
        workerUrl = freshUrl
        return await attempt(workerUrl)
      } catch (e: any) {
        console.warn(`[WORKER REQUEST] Fresh URL also failed: ${e.message}`)
      }
    }
  }

  const { url: recoveredUrl, recovered } = await waitForLiveWorker(workerUrl, job, jobFilePath)
  if (!recovered) {
    throw new Error('Worker connection timeout after 30 minutes')
  }

  workerUrl = recoveredUrl
  return await attempt(workerUrl)
}
