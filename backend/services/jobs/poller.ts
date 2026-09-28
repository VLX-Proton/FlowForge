import axios from 'axios'
import fs from 'fs'
import path from 'path'
import { isWorkerAlive } from '../worker/health'
import { waitForLiveWorker } from '../worker/recovery'
import { MAX_RECOVERY_MS, GIST_POLL_MS, GIST_API_URL, getGithubToken } from '../shared/constants'
import { robustDownload } from '../upscale/download'
import { saveJob } from './job-store'
import { resubmitJobToWorker } from './resubmit'

const GITHUB_TOKEN = getGithubToken()
const APP_DATA_DIR = process.env.APP_DATA_DIR
const JOB_DIR = APP_DATA_DIR ? path.join(APP_DATA_DIR, 'jobs') : path.join(process.cwd(), 'backend', 'jobs')
const OUTPUT_DIR = APP_DATA_DIR ? path.join(APP_DATA_DIR, 'outputs') : path.join(process.cwd(), 'backend', 'outputs')
const WORKER_FILE = APP_DATA_DIR ? path.join(APP_DATA_DIR, 'data', 'worker.json') : path.join(process.cwd(), 'backend', 'data', 'worker.json')

export async function resumeJobPolling(jobData: any): Promise<void> {
  const { jobId } = jobData
  let workerJobId  = jobData.workerJobId as string
  const jobFilePath = path.join(JOB_DIR, `${jobId}.json`)

  console.log(`[RESUME POLL] Attaching to Colab job ${workerJobId} for backend job ${jobId}`)

  let attempts       = 0
  const maxAttempts  = 7200
  let workerJobInfo: any = null
  let jobResubmitted = false  // Layer 3: allow only one re-submit attempt

  while (attempts < maxAttempts) {
    let currentJobState: any = null
    try { currentJobState = JSON.parse(fs.readFileSync(jobFilePath, 'utf8')) } catch (e) { break }

    if (!currentJobState || currentJobState.status === 'cancelled') {
      console.log(`[RESUME POLL] Job ${jobId} cancelled, stopping.`)
      if (fs.existsSync(jobFilePath)) {
        try { fs.unlinkSync(jobFilePath) } catch (e) {}
      }
      return
    }

    let currentWorkerUrl = JSON.parse(fs.readFileSync(WORKER_FILE, 'utf8')).workerUrl
    try {
      const statusResp = await axios.get(`${currentWorkerUrl}/job/${workerJobId}`, { timeout: 10000 })
      workerJobInfo = statusResp.data

      if (workerJobInfo?.progress !== undefined) {
        currentJobState.currentFileProgress = workerJobInfo.progress
        currentJobState.status = 'processing'
        fs.writeFileSync(jobFilePath, JSON.stringify(currentJobState, null, 2))
      }

      if (workerJobInfo?.status === 'completed' || workerJobInfo?.status === 'done') {
        console.log(`[RESUME POLL] Job ${workerJobId} completed on Colab. Downloading result...`)
        const job = currentJobState
        const outputFilename = (job.inputNames?.[0] || 'output').replace(/\.[^/.]+$/, '') + `_${job.scale}x.${job.format === 'auto' ? 'png' : job.format}`
        const resultPath = path.join(OUTPUT_DIR, outputFilename)
        
        let downloadOk = false
        while (true) {
          job.phase = 'downloading'
          job.downloadAttempt = (job.downloadAttempt || 0) + 1
          saveJob(jobId, job)

          downloadOk = await robustDownload(currentWorkerUrl, workerJobId, resultPath, job, jobFilePath, saveJob)
          if (downloadOk) break

          console.warn(`[RESUME POLL] Download attempt ${job.downloadAttempt} failed. Attempting recovery...`)
          const { recovered, url } = await waitForLiveWorker(currentWorkerUrl, job, jobFilePath)
          if (!recovered) {
            job.status = 'error'
            job.error = 'Worker connection timeout during download'
            saveJob(jobId, job)
            return
          }
          currentWorkerUrl = url
        }
        
        job.status = 'completed'
        job.phase = 'done'
        saveJob(jobId, job)
        return
      }

      if (workerJobInfo?.status === 'error') {
        currentJobState.status = 'error'
        currentJobState.error = workerJobInfo.error || 'Worker error'
        fs.writeFileSync(jobFilePath, JSON.stringify(currentJobState, null, 2))
        return
      }

      // Layer 3: Colab lost the job — re-submit once with original params
      if (workerJobInfo?.status === 'not_found' || workerJobInfo?.status === 'orphaned') {
        if (jobResubmitted) {
          console.error(`[RESUME POLL] Job ${workerJobId} still not found after re-submit. Marking as error.`)
          currentJobState.status = 'error'
          currentJobState.error = 'Worker lost job even after re-submit (Layer 3 exhausted)'
          saveJob(jobId, currentJobState)
          return
        }
        console.warn(`[RESUME POLL] Colab returned '${workerJobInfo.status}' for job ${workerJobId} — triggering Layer 3 re-submit…`)
        const newWorkerJobId = await resubmitJobToWorker(currentJobState, currentWorkerUrl)
        if (!newWorkerJobId) {
          currentJobState.status = 'error'
          currentJobState.error = 'Layer 3 re-submit failed: input file missing or Colab unreachable'
          saveJob(jobId, currentJobState)
          return
        }
        workerJobId = newWorkerJobId
        currentJobState.workerJobId = newWorkerJobId
        saveJob(jobId, currentJobState)
        jobResubmitted = true
        continue
      }
    } catch (e) {
      console.warn(`[RESUME POLL] Poll error: ${(e as Error).message} — entering recovery...`)
      if (currentJobState) {
        const { recovered, url } = await waitForLiveWorker(currentWorkerUrl, currentJobState, jobFilePath)
        if (!recovered) {
          currentJobState.status = 'error'
          currentJobState.error = 'Worker connection timeout after 30 minutes'
          saveJob(jobId, currentJobState)
          return
        }
        continue
      }
      return
    }

    attempts++
    await new Promise(r => setTimeout(r, 1000))
  }
}
