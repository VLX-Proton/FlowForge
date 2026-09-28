import axios from 'axios'
import fs from 'fs'
import FormData from 'form-data'

/**
 * Layer 3: Re-submit a job to Colab when Colab has lost track of it
 * (i.e., Colab returns "not_found" or "orphaned" for the workerJobId).
 *
 * Uses the original input file and parameters stored in the Backend job record.
 *
 * @returns New workerJobId from Colab, or null if re-submit is not possible.
 */
export async function resubmitJobToWorker(jobData: any, workerUrl: string): Promise<string | null> {
  const inputPath   = jobData.inputPaths?.[0]
  const originalName = jobData.inputNames?.[0] || 'input.png'

  if (!inputPath) {
    console.warn('[RESUBMIT] No inputPath in jobData — cannot re-submit.')
    return null
  }

  if (!fs.existsSync(inputPath)) {
    console.warn(`[RESUBMIT] Input file no longer exists: ${inputPath}`)
    return null
  }

  console.log(`[RESUBMIT] Layer 3: Re-submitting job ${jobData.jobId} to Colab (file: ${originalName})`)

  const form = new FormData()
  form.append('images', fs.createReadStream(inputPath), originalName)
  form.append('scale',      String(jobData.scale      ?? 2))
  form.append('patch_size', String(jobData.patchSize  ?? 512))
  form.append('stride',     String(jobData.stride     ?? 256))
  form.append('scale_by',   jobData.scaleBy ?? 'factor')
  if (jobData.prompt)            form.append('prompt',              jobData.prompt)
  if (jobData.targetLongestSide) form.append('target_longest_side', String(jobData.targetLongestSide))

  try {
    const resp = await axios.post(`${workerUrl}/job`, form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength:    Infinity,
      timeout:          60000,
    })

    const newWorkerJobId: string | undefined = resp.data?.job_id
    if (!newWorkerJobId) {
      console.warn('[RESUBMIT] Colab did not return a job_id in response.')
      return null
    }

    console.log(`[RESUBMIT] Layer 3: Job re-submitted successfully. New workerJobId: ${newWorkerJobId}`)
    return newWorkerJobId
  } catch (e: any) {
    console.error(`[RESUBMIT] Layer 3: Failed to re-submit job: ${e.message}`)
    return null
  }
}
