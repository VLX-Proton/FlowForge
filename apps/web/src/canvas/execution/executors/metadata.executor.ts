import type { WorkflowNode } from '../../types/node.types'
import type { WorkflowContext } from '../context'
import type { ExecutionResult } from '../types'
import { updateFileStatus } from '../runtimeFiles'

async function fetchBlobFromOutputs(filename: string): Promise<Blob> {
  const url = `/api/outputs/${encodeURIComponent(filename)}`
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to fetch ${filename}`)
  return response.blob()
}

function isRetryableError(errorMessage: string, statusCode?: number): boolean {
  if (statusCode === 429 || statusCode === 503 || statusCode === 408) return true
  const retryableMessages = ['UNAVAILABLE', 'RATE_LIMIT', 'RESOURCE_EXHAUSTED', 'timeout', 'fetch', 'network']
  return retryableMessages.some(msg => errorMessage.toUpperCase().includes(msg))
}

async function resizeImageClientSide(blob: Blob, maxDimension: number = 2048): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width <= maxDimension && height <= maxDimension) {
        return resolve(blob); // No resize needed
      }
      if (width > height) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      } else {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(blob);
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((resizedBlob) => {
        resolve(resizedBlob || blob);
      }, 'image/jpeg', 0.82);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(blob); // fallback to original if error
    };
    img.src = url;
  });
}

export async function metadataExecutor(
  node: WorkflowNode,
  context: WorkflowContext,
): Promise<ExecutionResult> {
  if (!context.runtime) return { success: false, context, error: 'Runtime not initialized' }

  const logger = context.runtime.executionLogger
  if (!logger) return { success: false, context, error: 'Logger not initialized' }

  let filesToProcess = context.runtime.fileRuntimes?.filter(f => {
    if (f.type.startsWith('image/')) return true
    const ext = f.name.split('.').pop()?.toLowerCase()
    return ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext || '')
  }) || []
  logger.log(`[METADATA] received: ${context.runtime.fileRuntimes?.length}`)
  logger.log(`[METADATA] processing: ${filesToProcess.length}`)
  if (filesToProcess.length === 0) {
    logger.log('[METADATA] No images found to process.')
    return { success: true, context }
  }

  const { provider, max_title, max_keywords, max_images } = node.data
  const modelKey = provider === 'openrouter' ? 'model_openrouter' : provider === 'mistral' ? 'model_mistral' : 'model_gemini'
  const model = node.data[modelKey]

  const limit = parseInt(String(max_images)) || filesToProcess.length
  logger.log(`[METADATA] limit: ${limit}`)
  if (limit > 0 && limit < filesToProcess.length) {
    filesToProcess = filesToProcess.slice(0, limit)
  }

  logger.log(`[METADATA] Starting metadata generation for ${filesToProcess.length} images using ${provider}`)

  const csvRows: string[] = []
  csvRows.push('"Filename","Title","Keywords","Category","Releases"')

  const updateProgress = (stage: string, currentFile?: string, retryAttempt?: number, retryDelay?: number) => {
    context.runtime?.onRuntimeUpdate?.(node, {
      stage,
      currentFile,
      currentIndex: 0,
      totalFiles: filesToProcess.length,
      processedCount: csvRows.length - 1,
      retryAttempt,
      retryDelay
    })
  }

  for (let i = 0; i < filesToProcess.length; i++) {
    const file = filesToProcess[i]
    if (context.runtime.isCancelled) return { success: false, context, error: 'Cancelled' }

    logger.log(`[METADATA] Processing ${i + 1}/${filesToProcess.length}: ${file.name}`)
    context.runtime.fileRuntimes = (context.runtime.fileRuntimes || []).map(f =>
      f.id === file.id ? updateFileStatus(f, 'saving') : f
    )
    updateProgress('Metadata...', file.name)

    let blob: Blob | null = null
    try {
      if (file.blob) {
        blob = file.blob
      } else if (file.handle) {
        const anyHandle = file.handle as any
        if (typeof anyHandle.getFile === 'function') {
          blob = await anyHandle.getFile()
        }
      } else if (file.outputPath) {
        blob = await fetchBlobFromOutputs(file.outputPath)
      }
    } catch (e) {
       logger.error(`[METADATA] Failed to load blob for ${file.name}: ${(e as Error).message}`)
     }

    if (!blob) {
      logger.error(`[METADATA] Failed to load image data for ${file.name}`)
      context.runtime.fileRuntimes = (context.runtime.fileRuntimes || []).map(f =>
        f.id === file.id ? updateFileStatus(f, 'error') : f
      )
      continue
    }

    let metadataResult: any = null
    let attempts = 0
    const maxAttempts = 4
    const retryDelays = [3000, 5000, 8000]

    // Resize image on the client side before uploading to save API credits and bandwidth!
    const resizedBlob = await resizeImageClientSide(blob, 2048)

    while (attempts < maxAttempts) {
      attempts++
      try {
        const formData = new FormData()
        // Send the resized blob instead of the original
        formData.append('file', resizedBlob, file.name)
        formData.append('provider', provider)
        formData.append('model', model || '')
        if (max_title) formData.append('maxTitle', String(max_title))
        if (max_keywords) formData.append('maxKeywords', String(max_keywords))

        const response = await fetch('/api/metadata', {
          method: 'POST',
          body: formData
        })

        if (!response.ok) {
          const errData = await response.json()
          const errMsg = errData.error || `HTTP ${response.status}`
          
          if (attempts <= 3 && isRetryableError(errMsg, response.status)) {
            const delay = retryDelays[attempts - 1]
            logger.log(`[METADATA] Retry ${attempts}/3 for ${file.name} in ${delay}ms: ${errMsg}`)
            updateProgress('Metadata...', file.name, attempts, delay / 1000)
            await new Promise(resolve => setTimeout(resolve, delay))
            continue
          }

          // Non-retryable error — wait before next file to avoid rate limit
          await new Promise(resolve => setTimeout(resolve, 2000))

          throw new Error(errMsg)
        }

        metadataResult = await response.json()
        break
      } catch (err: any) {
        if (attempts >= maxAttempts || !isRetryableError(err.message)) {
          logger.error(`[METADATA] Failed for ${file.name}: ${err.message}`)
          context.runtime.fileRuntimes = (context.runtime.fileRuntimes || []).map(f =>
            f.id === file.id ? updateFileStatus(f, 'error') : f
          )
          break
        }
      }
    }

    if (!metadataResult) {
      continue
    }

    const escapeCsv = (str: string) => `"${String(str).replace(/"/g, '""')}"`
    const title = escapeCsv(metadataResult.title || '')
    const keywords = escapeCsv(Array.isArray(metadataResult.keywords) ? metadataResult.keywords.join(', ') : metadataResult.keywords || '')
    const categoryStr = escapeCsv(String(metadataResult.category ?? ''))
    const filenameStr = escapeCsv(file.name || '')

    csvRows.push(`${filenameStr},${title},${keywords},${categoryStr},""`)

    context.runtime.fileRuntimes = (context.runtime.fileRuntimes || []).map(f =>
      f.id === file.id ? updateFileStatus(f, 'success') : f
    )
    logger.log(`[METADATA] Generated metadata for ${file.name}`)

    if (i < filesToProcess.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }

  if (csvRows.length <= 1) {
    return {
      success: false,
      context,
      error: 'No metadata generated. Check API keys in Settings.'
    }
  }

  context.runtime.fileRuntimes = (context.runtime.fileRuntimes || []).filter(f => f.status === 'success')

  const csvContent = csvRows.join('\n')
  const csvBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })

  context.runtime.fileRuntimes!.push({
    id: crypto.randomUUID(),
    name: 'metadata.csv',
    size: csvBlob.size,
    type: 'text/csv',
    status: 'success',
    blob: csvBlob,
    outputPath: 'metadata.csv'
  })

  logger.log(`[METADATA] Finished. Added metadata.csv to output payload.`)
  logger.log(`[METADATA] csv rows: ${csvRows.length}`)

  return {
    success: true,
    context
  }
}