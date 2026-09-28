import type { WorkflowNode } from '../../types/node.types'
import type { WorkflowContext } from '../context'
import type { ExecutionResult } from '../types'
import type { FileRuntimeData } from '../runtimeFiles'
import { useCanvasStore } from '../../stores/canvas.store'
 
/**
 * Extract extension from filename, preserving case for format inference
 */
function getFileExtension(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  const formatMap: Record<string, string> = {
    jpg: 'jpg',
    jpeg: 'jpg',
    png: 'png',
    webp: 'webp',
    gif: 'gif',
    tiff: 'tiff',
    tif: 'tiff',
    bmp: 'bmp',
  }
  return formatMap[ext] || 'png'
}
 
/**
 * Executor for the "Upscale Image" node.
 *
 * Sends images one by one (sequential) to worker for processing.
 * Each file gets its own job, progress tracked per file.
 *
 * Handles backend pauses (Colab offline) by reflecting the paused
 * status in the node bubble until the backend auto-recovers.
 */
export async function upscaleExecutor(
  node: WorkflowNode,
  context: WorkflowContext,
): Promise<ExecutionResult> {
  const logger = context.runtime?.executionLogger
  if (!logger) {
    return { success: false, context, error: 'Logger not initialized' }
  }
 
  const scale = node.data?.scale as string | undefined
  const format = node.data?.format as string | undefined
  const prompt = node.data?.prompt as string | undefined
  const patchSize = node.data?.patch_size as string | number | undefined
  const stride = node.data?.stride as string | number | undefined
  const scaleBy = node.data?.scale_by as string | undefined
  const targetLongestSide = node.data?.target_longest_side as string | number | undefined
 
  if (!context.runtime) {
    return { success: false, context, error: 'Runtime not initialized' }
  }
 
  const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'bmp', 'tiff', 'tif', 'gif'])

  function isImageFile(file: FileRuntimeData): boolean {
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    if (file.type && file.type.startsWith('image/')) return true
    return IMAGE_EXTENSIONS.has(ext)
  }

const allFiles: FileRuntimeData[] = context.runtime.fileRuntimes || []
   logger.log(`[UPSCALE] received: ${allFiles.length}`)
   const inputFiles: FileRuntimeData[] = allFiles.filter(isImageFile)
   logger.log(`[UPSCALE] input: ${inputFiles.length}`)

  if (allFiles.length === 0) {
    logger.error('Upscale node requires input images but no files were provided')
    return { success: false, context, error: 'No input files' }
  }

  if (inputFiles.length === 0) {
    logger.error('Upscale node requires image files but only non-image files were found')
    return { success: false, context, error: 'No image files found. Only image formats are supported (JPG, PNG, WEBP, BMP, TIFF, GIF)' }
  }

  const totalFiles = inputFiles.length

  const notifyProgress = (
    progressPct: number,
    currentFile?: string,
    currentIndex?: number,
    total?: number,
    status?: string,
    pauseReason?: string,
    pausedAt?: number,
    downloadProgress?: number,
  ) => {
    context.runtime?.onRuntimeUpdate?.(node, {
      progressPct,
      totalFiles: total ?? totalFiles,
      currentFile,
      currentFileIndex: currentIndex,
      stage: 'Upscaling...',
      executionStartedAt: node.execution?.startedAt,
      progress: { current: progressPct },
      // Pass connection status through so nodeIntelligence can surface it
      workerStatus: status,
      pauseReason,
      pausedAt,
      downloadProgress,
    })
  }
 
  // ---------------------------------------------------------------------
  // Process files sequentially - one at a time
  // ---------------------------------------------------------------------
  let startIndex = 0
  let processedFiles: FileRuntimeData[] = []
  const checkpointKey = `checkpoint_upscale_${node.id}`

  try {
    const checkpointStr = window.localStorage.getItem(checkpointKey)
    if (checkpointStr) {
      const cp = JSON.parse(checkpointStr)
      if (cp.totalFiles === inputFiles.length && cp.processedFiles && cp.processedFiles.length > 0) {
        const store = useCanvasStore()
        const choice = await store.showCheckpointPrompt((node.data?.label as string) || 'Upscale', `${cp.processedFiles.length} dari ${cp.totalFiles}`)
        
        if (choice === 'resume') {
          processedFiles = cp.processedFiles
          startIndex = cp.processedFiles.length
          logger.log(`[UPSCALE] Resuming from file ${startIndex + 1}`)
        } else {
          window.localStorage.removeItem(checkpointKey)
        }
      } else {
        window.localStorage.removeItem(checkpointKey)
      }
    }
  } catch (e) {
    window.localStorage.removeItem(checkpointKey)
  }

  const scaleValue = scale ? parseInt(String(scale).replace(/[^0-9]/g, ''), 10) || 2 : 2
  const outputFormat = format || 'auto'
  const patchSizeValue = patchSize ? parseInt(String(patchSize).replace(/[^0-9]/g, ''), 10) : 512
  const strideValue = stride ? parseInt(String(stride).replace(/[^0-9]/g, ''), 10) : 256
  const scaleByValue = scaleBy || 'factor'
  const targetLongestSideValue = targetLongestSide ? parseInt(String(targetLongestSide).replace(/[^0-9]/g, ''), 10) : null
 
  for (let fileIndex = startIndex; fileIndex < inputFiles.length; fileIndex++) {
    const file = inputFiles[fileIndex]
    if (!file.handle) {
      logger.error(`Cannot process ${file.name}: no handle available`)
      continue
    }
 
    const inputFile = await file.handle.getFile()
    const inputFileName = file.name
    const detectedFormat = format === 'auto' ? getFileExtension(inputFileName) : format
    const nameWithoutExt = inputFileName.replace(/\.[^/.]+$/, '')
    const outputFileName = `${nameWithoutExt}_${scaleValue}x.${detectedFormat}`
 
    logger.log(`Processing file ${fileIndex + 1}/${totalFiles}: ${inputFileName}`)
    notifyProgress(0, inputFileName, fileIndex + 1, totalFiles)
 
    // Submit single file to backend
    const formData = new FormData()
    formData.append('files', inputFile, inputFileName)
    formData.append('scale', String(scaleValue))
    formData.append('format', outputFormat)
    if (prompt && prompt.trim()) {
      formData.append('prompt', prompt.trim())
    }
    formData.append('patch_size', String(patchSizeValue))
    formData.append('stride', String(strideValue))
    formData.append('scale_by', scaleByValue)
    if (targetLongestSideValue) {
      formData.append('target_longest_side', String(targetLongestSideValue))
    }
 
    const jobResp = await fetch('/api/upscale', {
      method: 'POST',
      body: formData,
    })
 
    logger.log(`Upscale submit response status: ${jobResp.status}`)
    if (!jobResp.ok) {
      logger.error(`Failed to submit file ${inputFileName}: ${jobResp.status}`)
      return { success: false, context, error: 'Worker submit failed' }
    }
 
    const jobResponse = await jobResp.json()
    logger.log(`Upscale job response: ${JSON.stringify(jobResponse)}`)
    const batchJobId = jobResponse?.jobId
 
    if (!batchJobId) {
      logger.error('Worker did not return jobId')
      return { success: false, context, error: 'Worker error: missing jobId' }
    }
 
    logger.log(`Job created for ${inputFileName}: ${batchJobId}`)
 
    // Poll for this file's completion
    const jobStatusUrl = `/api/job/${batchJobId}`
    logger.log(`Poll URL: ${jobStatusUrl}`)
 
    const poll = async (url: string): Promise<any> => {
      try {
        const res = await fetch(url, { cache: 'no-cache' })
        if (!res.ok) {
          console.error(`[UPSCALE POLL] Non-OK: ${res.status} ${res.statusText}`)
          return {}
        }
        return await res.json()
      } catch (e) {
        console.error(`[UPSCALE POLL] Fetch error:`, e)
        return {}
      }
    }

    logger.log(`Starting poll for job ${batchJobId} at ${jobStatusUrl}`)
    let lastProgress = -1
    let lastStatus = ''

    // maxAttempts: 7200 × 1000 ms = 120 minutes (backend has its own 30-min timeout)
    const maxAttempts = 7200
    let attempts = 0
    let jobInfo: any = null

    let lastDownloadProgress = -1

    while (attempts < maxAttempts) {
      if (context.runtime?.checkCancelled?.()) {
        logger.warn(`Workflow cancelled by user, aborting polling for ${batchJobId}`)
        try {
          await fetch(`/api/job/${batchJobId}/cancel`, { method: 'DELETE' })
        } catch (e) {
          logger.error(`Failed to cancel job ${batchJobId} on backend`)
        }
        return { success: false, context, error: 'Cancelled by user' }
      }

      jobInfo = await poll(jobStatusUrl)

      const currentStatus: string = jobInfo?.status ?? ''
      const currentPhase: string = jobInfo?.phase ?? ''
      const currentProgress: number = jobInfo?.currentFileProgress ?? 0
      const currentDownloadProgress: number = jobInfo?.downloadProgress ?? 0

      // ── Paused state (backend waiting for Colab to come back) ──────────
      if (currentStatus === 'paused') {
        if (lastStatus !== 'paused') {
          logger.warn(`Connection paused for ${inputFileName}: ${jobInfo?.pauseReason || 'Backend offline'}`)
        }
        notifyProgress(
          currentProgress,
          inputFileName,
          fileIndex + 1,
          totalFiles,
          'paused',
          jobInfo?.pauseReason,
          jobInfo?.pausedAt,
          currentDownloadProgress,
        )
        lastStatus = 'paused'
        attempts++
        await new Promise(r => setTimeout(r, 1000))
        continue
      }

      // ── Progress update (upscaling or downloading) ──────────────────────
      if (
        currentProgress !== lastProgress ||
        currentStatus !== lastStatus ||
        (currentPhase === 'downloading' && currentDownloadProgress !== lastDownloadProgress)
      ) {
        lastProgress = currentProgress
        lastStatus = currentStatus
        lastDownloadProgress = currentDownloadProgress
        notifyProgress(
          currentPhase === 'downloading' ? currentDownloadProgress : currentProgress,
          inputFileName,
          fileIndex + 1,
          totalFiles,
          currentPhase === 'downloading' ? 'downloading' : undefined,
          undefined,
          undefined,
          currentDownloadProgress,
        )
      }

      if (jobInfo?.status === 'completed' || jobInfo?.status === 'done') break
      if (jobInfo?.status === 'error') {
        logger.error(`Worker reported error for ${inputFileName}: ${jobInfo.error}`)
        return { success: false, context, error: jobInfo.error || 'Worker error' }
      }

      attempts++
      await new Promise(r => setTimeout(r, 1000))
    }
 
    if (!jobInfo || (jobInfo.status !== 'completed' && jobInfo.status !== 'done')) {
      logger.error(`Job did not complete for ${inputFileName}`)
      return { success: false, context, error: 'Job timeout' }
    }
 
    // Final progress update
    notifyProgress(100, inputFileName, fileIndex + 1, totalFiles)
    logger.log(`File completed: ${inputFileName}`)
 
    const outputPaths = jobInfo.outputPaths || jobInfo.output_paths || []
    const outPath = outputPaths[0]
 
    if (outPath) {
      const outputFilename = outPath.split('/').pop() || outputFileName
 
      processedFiles.push({
        id: crypto.randomUUID(),
        name: outputFilename,
        size: 0,
        type: 'image/png',
        status: 'success',
        outputPath: outputFilename,
        handle: file.handle,       // ← original handle so save executor can delete source
        sourceName: inputFileName, // ← original filename to remove from input folder
      })

      try {
        window.localStorage.setItem(checkpointKey, JSON.stringify({
          totalFiles: inputFiles.length,
          processedFiles
        }))
      } catch (e) {
        logger.warn('Failed to save checkpoint')
      }
    }
  }
 
  window.localStorage.removeItem(checkpointKey)
  context.runtime.fileRuntimes = processedFiles
   logger.log(`[UPSCALE] produced: ${processedFiles.length}`)
   logger.log(`Sequential processing completed. ${processedFiles.length}/${totalFiles} files processed.`)
 
  return { success: true, context }
}
