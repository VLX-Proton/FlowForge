import fs from 'fs'
import path from 'path'
import { syncWorkerUrl } from '../worker/gist-sync'
import { isWorkerAlive } from '../worker/health'
import { resumeJobPolling } from '../jobs/poller'
import { cleanupInputs, cleanupOutputs, cleanupJobs } from './cleanup'

const APP_DATA_DIR = process.env.APP_DATA_DIR
const DATA_DIR  = APP_DATA_DIR ? path.join(APP_DATA_DIR, 'data') : path.join(process.cwd(), 'backend', 'data')
const JOB_DIR   = APP_DATA_DIR ? path.join(APP_DATA_DIR, 'jobs') : path.join(process.cwd(), 'backend', 'jobs')
const INPUT_DIR = APP_DATA_DIR ? path.join(APP_DATA_DIR, 'inputs') : path.join(process.cwd(), 'backend', 'inputs')
const OUTPUT_DIR= APP_DATA_DIR ? path.join(APP_DATA_DIR, 'outputs') : path.join(process.cwd(), 'backend', 'outputs')
const WORKER_FILE = path.join(DATA_DIR, 'worker.json')

function initDirectories(): void {
  ;[DATA_DIR, JOB_DIR, INPUT_DIR, OUTPUT_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  })

  if (!fs.existsSync(WORKER_FILE)) {
    fs.writeFileSync(WORKER_FILE, JSON.stringify({ workerUrl: '' }, null, 2))
  }
}

async function resumeOrphanedJobs(): Promise<void> {
  if (!fs.existsSync(JOB_DIR)) return

  const jobFiles = fs.readdirSync(JOB_DIR)
  for (const jf of jobFiles) {
    if (!jf.endsWith('.json')) continue
    try {
      const jobData = JSON.parse(fs.readFileSync(path.join(JOB_DIR, jf), 'utf8'))
      if (
        (jobData.status === 'processing' || jobData.status === 'paused' || jobData.phase === 'downloading') &&
        jobData.workerJobId
      ) {
        console.log(`[STARTUP] Resuming orphaned job ${jobData.jobId} (workerJobId: ${jobData.workerJobId})`)
        resumeJobPolling(jobData)
      }
    } catch (e) {
      console.warn('[STARTUP] Failed to parse job file:', jf, (e as Error).message)
    }
  }
}


function startIdleMonitor(): void {
  setInterval(async () => {
    try {
      if (!fs.existsSync(WORKER_FILE)) return
      const currentUrl = JSON.parse(fs.readFileSync(WORKER_FILE, 'utf8')).workerUrl
      if (!currentUrl) return

      const alive = await isWorkerAlive(currentUrl)
      if (!alive) {
        const freshUrl = await syncWorkerUrl()
        if (freshUrl && freshUrl !== currentUrl) {
          const freshAlive = await isWorkerAlive(freshUrl)
          if (freshAlive) {
            console.log(`[IDLE MONITOR] Colab aktif kembali! URL diperbarui ke: ${freshUrl}`)
          }
        }
      }
    } catch (e) {
      // Silently catch file read errors
    }
  }, 15000)
}

export async function runStartup(): Promise<void> {
  console.log('[STARTUP] Initializing directories...')
  initDirectories()

  console.log('[STARTUP] Cleaning up old/stale files...')
  cleanupInputs()
  cleanupOutputs()
  cleanupJobs()

  console.log('[STARTUP] Initial URL sync from Gist...')
  try {
    const urlAwal = await syncWorkerUrl()
    if (urlAwal) {
      console.log(`[STARTUP] Sukses! worker.json telah diperbarui ke: ${urlAwal}`)
    } else {
      console.log('[STARTUP] Peringatan: Gagal mengambil URL awal. Menggunakan cache data lama.')
    }
  } catch (e) {
    console.warn('[STARTUP] Initial sync failed:', (e as Error).message)
  }

  console.log('[STARTUP] Scanning for orphaned jobs...')
  await resumeOrphanedJobs()

  console.log('[STARTUP] Starting idle monitor...')
  startIdleMonitor()
}
