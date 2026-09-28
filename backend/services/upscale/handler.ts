import type { Request, Response } from 'express'
import axios from 'axios'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { syncWorkerUrl } from '../worker/gist-sync'
import { isWorkerAlive } from '../worker/health'
import { waitForLiveWorker } from '../worker/recovery'
import { workerRequest } from './worker-request'
import { saveJob, loadJob } from '../jobs/job-store'
import { resubmitJobToWorker } from '../jobs/resubmit'
import { getFileExtension } from '../storage/directories'
import type { UpscaleJob, UpscaleResponse} from './types'
import { robustDownload } from './download'
import { cleanupInputs, cleanupJobs } from '../startup/cleanup'


const APP_DATA_DIR = process.env.APP_DATA_DIR
const JOB_DIR = APP_DATA_DIR ? path.join(APP_DATA_DIR, 'jobs') : path.join(process.cwd(), 'backend', 'jobs')
const OUTPUT_DIR = APP_DATA_DIR ? path.join(APP_DATA_DIR, 'outputs') : path.join(process.cwd(), 'backend', 'outputs')
const WORKER_FILE = APP_DATA_DIR ? path.join(APP_DATA_DIR, 'data', 'worker.json') : path.join(process.cwd(), 'backend', 'data', 'worker.json')



export async function handleUpscaleRequest(req: any, res: Response): Promise<void> {
  console.log('[BACKEND] POST /api/upscale received')

  const files = req.files
  const { scale, format, prompt, patch_size, stride, scale_by, target_longest_side } = req.body

  const activeWorkerUrl = await syncWorkerUrl()

  if (!files || files.length === 0) {
    res.status(400).json({ success: false, error: 'No files uploaded' } as UpscaleResponse)
    return
  }

  const scaleValue = parseInt(String(req.body.scale || '2').replace(/[^0-9]/g, '')) || 2
  const formatValue = req.body.format || 'auto'
  const promptValue = req.body.prompt || ''
  const patchSizeValue = parseInt(String(req.body.patch_size || '512').replace(/[^0-9]/g, '')) || 512
  const strideValue = parseInt(String(req.body.stride || '256').replace(/[^0-9]/g, '')) || 256
  const scaleByValue = req.body.scale_by || 'factor'
  const targetLongestSideValue = req.body.target_longest_side ? parseInt(req.body.target_longest_side) : null

  const inputNames = files.map((f: any) => f.originalname).sort().join(',')
  let existingJobId: string | null = null

  if (fs.existsSync(JOB_DIR)) {
    const jobFiles = fs.readdirSync(JOB_DIR)
    for (const jf of jobFiles) {
      if (!jf.endsWith('.json')) continue
      try {
        const jData = JSON.parse(fs.readFileSync(path.join(JOB_DIR, jf), 'utf8'))
        if (jData.status !== 'completed' && jData.status !== 'error' && jData.status !== 'cancelled') {
          const jInputNames = (jData.inputNames || []).slice().sort().join(',')
          if (
            jInputNames === inputNames &&
            jData.scale === scaleValue &&
            jData.format === formatValue &&
            jData.prompt === promptValue &&
            jData.patchSize === patchSizeValue &&
            jData.stride === strideValue &&
            jData.scaleBy === scaleByValue &&
            jData.targetLongestSide === targetLongestSideValue
          ) {
            existingJobId = jData.jobId
            break
          }
        }
      } catch (e) {}
    }
  }

  if (existingJobId) {
    console.log(`[BACKEND] Idempotency match found! Returning existing job ${existingJobId}`)
    res.json({ success: true, jobId: existingJobId, outputPaths: [], totalFiles: files.length } as UpscaleResponse)
    return
  }

  const jobId = crypto.randomUUID()

  const job: UpscaleJob = {
    jobId,
    status: 'queued',
    inputPaths: files.map((f: any) => f.path),
    inputNames: files.map((f: any) => f.originalname),
    scale: scaleValue,
    format: formatValue,
    prompt: promptValue,
    patchSize: patchSizeValue,
    stride: strideValue,
    scaleBy: scaleByValue,
    targetLongestSide: targetLongestSideValue,
    createdAt: Date.now(),
    workerUrlUsed: activeWorkerUrl,
    outputPaths: [],
    totalFiles: files.length,
    currentFileIndex: 0,
    currentFileName: '',
    currentFileProgress: 0,
    completedFiles: 0,
    pauseReason: null,
    pausedAt: null,
    resumedAt: null,
    phase: 'uploading',
  }

  const jobFilePath = path.join(JOB_DIR, `${jobId}.json`)
  saveJob(jobId, job)
  console.log('[BACKEND] Local job record created with ID', jobId)
  // Realtime cleanup: keep inputs/ and jobs/ at max 50 files
  cleanupInputs()
  cleanupJobs()


  ;(async () => {
    const outputPaths: string[] = []
    let hasError = false
    let errorMessage = ''

    for (let i = 0; i < files.length; i++) {
      const inputFile = files[i]
      const originalName = inputFile.originalname
      const ext = getFileExtension(originalName)
      const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '')
      const outputFormat = formatValue === 'auto' ? ext : formatValue
      const outputFilename = `${nameWithoutExt}_${scaleValue}x.${outputFormat}`
      const resultPath = path.join(OUTPUT_DIR, outputFilename)

      job.status = 'processing'
      job.currentFileIndex = i + 1
      job.currentFileName = originalName
      job.currentFileProgress = 0
      job.phase = 'queued'
      saveJob(jobId, job)

      console.log(`[BACKEND] Processing file ${i + 1}/${files.length}: ${originalName}`)

      const FormData = require('form-data')
      const workerForm = new FormData()
      workerForm.append('images', fs.createReadStream(inputFile.path), originalName)
      workerForm.append('scale', String(scaleValue))
      workerForm.append('format', formatValue)
      if (promptValue) workerForm.append('prompt', promptValue)
      workerForm.append('patch_size', String(patchSizeValue))
      workerForm.append('stride', String(strideValue))
      workerForm.append('scale_by', scaleByValue)
      if (targetLongestSideValue) workerForm.append('target_longest_side', String(targetLongestSideValue))

      let workerJobId: string | undefined
      try {
        const workerResp = await workerRequest(
          'post',
          '/job',
          { data: workerForm, headers: workerForm.getHeaders() },
          job,
          jobFilePath
        )
        console.log('[WORKER] Create job response:', workerResp.data)
        workerJobId = workerResp.data?.job_id
        console.log('[BACKEND] Worker job id:', workerJobId)
        job.workerJobId = workerJobId
        job.phase = 'processing'
        saveJob(jobId, job)
      } catch (e: any) {
        console.error('[WORKER ERROR]', e.message)
        hasError = true
        errorMessage = e.message
        break
      }

      let attempts       = 0
      const maxAttempts  = 7200
      let workerJobInfo: any  = null
      let jobResubmitted = false  // Layer 3: allow only one re-submit attempt per file

      while (attempts < maxAttempts) {
        const currentWorkerUrl = JSON.parse(fs.readFileSync(WORKER_FILE, 'utf8')).workerUrl
        try {
          const statusResp = await axios.get(`${currentWorkerUrl}/job/${workerJobId}`, { timeout: 10000 })
          workerJobInfo = statusResp.data

          if (workerJobInfo?.progress !== undefined) {
            const existingState = loadJob(jobId)
            if (existingState?.status !== 'cancelled') {
              job.currentFileProgress = workerJobInfo.progress
              saveJob(jobId, job)
            }
          }

          let currentJobState: any = null
          try { currentJobState = JSON.parse(fs.readFileSync(jobFilePath, 'utf8')) } catch (e) {}

          if (currentJobState && currentJobState.status === 'cancelled') {
            console.log(`[BACKEND] Job ${jobId} cancelled by user. Forwarding to Colab...`)
            try { await workerRequest('delete', `/job/${workerJobId}`, {}, currentJobState, jobFilePath) } catch (e) {}
            hasError = true
            errorMessage = 'Cancelled by user'
            break
          }

          if (workerJobInfo?.status === 'completed' || workerJobInfo?.status === 'done') break
          if (workerJobInfo?.status === 'error') {
            hasError = true
            errorMessage = workerJobInfo.error || 'Worker error'
            break
          }

          // Layer 3: Colab lost the job — re-submit once with original params
          if (workerJobInfo?.status === 'not_found' || workerJobInfo?.status === 'orphaned') {
            if (jobResubmitted) {
              console.error(`[BACKEND] Job ${workerJobId} still not found after re-submit. Marking as error.`)
              hasError = true
              errorMessage = 'Worker lost job even after re-submit (Layer 3 exhausted)'
              break
            }
            console.warn(`[BACKEND] Colab returned '${workerJobInfo.status}' for job ${workerJobId} — triggering Layer 3 re-submit…`)
            const currentWorkerUrlForResubmit = JSON.parse(fs.readFileSync(WORKER_FILE, 'utf8')).workerUrl
            const newWorkerJobId = await resubmitJobToWorker(job, currentWorkerUrlForResubmit)
            if (!newWorkerJobId) {
              hasError = true
              errorMessage = 'Layer 3 re-submit failed: input file missing or Colab unreachable'
              break
            }
            workerJobId = newWorkerJobId
            job.workerJobId = newWorkerJobId
            saveJob(jobId, job)
            jobResubmitted = true
            continue
          }
        } catch (e: any) {
          console.warn('[BACKEND] Poll error:', e.message, '— attempting recovery...')
          const { recovered } = await waitForLiveWorker(currentWorkerUrl, job, jobFilePath)
          if (!recovered) {
            hasError = true
            errorMessage = 'Worker connection timeout after 30 minutes'
            break
          }
          continue
        }

        attempts++
        await new Promise(r => setTimeout(r, 1000))
      }

      if (hasError || !workerJobInfo || (workerJobInfo.status !== 'completed' && workerJobInfo.status !== 'done')) {
        if (!hasError) errorMessage = 'Worker timeout'
        console.warn('[BACKEND] Worker job did not complete for file:', originalName)
        break
      }

      let downloadOk = false
      let currentWorkerUrl = JSON.parse(fs.readFileSync(WORKER_FILE, 'utf8')).workerUrl

      while (true) {
        job.phase = 'downloading'
        job.downloadAttempt = (job.downloadAttempt || 0) + 1
        saveJob(jobId, job)

        downloadOk = await robustDownload(currentWorkerUrl, workerJobId, resultPath, job, jobFilePath, saveJob)
        if (downloadOk) break
        
        console.warn(`[BACKEND] Download attempt ${job.downloadAttempt} failed. Attempting recovery...`)
        const { recovered, url } = await waitForLiveWorker(currentWorkerUrl, job, jobFilePath)
        if (!recovered) {
          hasError = true
          errorMessage = 'Worker connection timeout during download'
          break
        }
        currentWorkerUrl = url
      }

      if (!downloadOk && !hasError) {
        hasError = true
        errorMessage = 'Download failed after multiple attempts'
        break
      }
    }

    if (hasError) {
      if (errorMessage === 'Cancelled by user') {
        if (fs.existsSync(jobFilePath)) {
          try { fs.unlinkSync(jobFilePath) } catch (e) {}
          console.log(`[BACKEND] Job ${jobId} file deleted after cancellation`)
        }
      } else {
        job.status = 'error'
        job.error = errorMessage
        saveJob(jobId, job)
        console.log('[BACKEND] Job failed:', errorMessage)
      }
      return
    }

    job.status = 'completed'
    job.currentFileIndex = files.length
    job.currentFileName = ''
    job.currentFileProgress = 100
    job.pauseReason = null
    job.phase = 'done'
    saveJob(jobId, job)
    console.log('[BACKEND] Sequential processing completed, outputs:', job.outputPaths.length)
  })()

  res.json({ success: true, jobId, outputPaths: [], totalFiles: files.length } as UpscaleResponse)
}
