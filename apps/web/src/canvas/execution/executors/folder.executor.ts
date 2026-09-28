import type { WorkflowNode } from '../../types/node.types'
import type { WorkflowContext } from '../context'
import type { ExecutionResult } from '../types'

export async function folderExecutor(
  node: WorkflowNode,
  context: WorkflowContext,
): Promise<ExecutionResult> {
  if (!context.runtime) {
    return {
      success: false,
      context,
      error: 'Runtime context not initialized',
    }
  }

  const logger = context.runtime.executionLogger

  if (!logger) {
    return {
      success: false,
      context,
      error: 'Logger not initialized',
    }
  }

  const notify = (stageLabel: string) => {
    context.runtime?.onRuntimeUpdate?.(node, {
      stage: stageLabel,
      stageDetails: [node.data.path],
      fileRuntimes:
        context.runtime?.fileRuntimes || [],
      executionStartedAt:
        node.execution?.startedAt,
    })
  }

  context.values.folderPath = node.data.path

  // Re-scan the folder from handle to get the latest file list
  let fileRuntimes = context.runtime.fileRuntimes || []

  if (context.runtime.inputFolderHandle) {
    const { scanFolderForFiles } = await import('../../utils/folderScanner')
    const scanResult = await scanFolderForFiles(context.runtime.inputFolderHandle)
    fileRuntimes = scanResult.files
    context.runtime.fileRuntimes = fileRuntimes
  }

  // Fail immediately if the folder has no files — stops the workflow here
  if (fileRuntimes.length === 0) {
    logger.error(
      `No files found in folder: ${node.data.path}`,
    )
    return {
      success: false,
      context,
      error: 'No files found in selected folder',
    }
  }

  // Apply limit: if set and > 0, only keep the first N files
  const limit = parseInt(String(node.data.limit ?? 0), 10)
  if (limit > 0 && fileRuntimes.length > limit) {
    logger.log(`[FOLDER] Limit applied: ${limit} of ${fileRuntimes.length} files`)
    fileRuntimes = fileRuntimes.slice(0, limit)
    context.runtime.fileRuntimes = fileRuntimes
  }

  const stageDelay = async (label: string, ms: number) => {
    notify(label)
    await new Promise(resolve =>
      setTimeout(resolve, ms),
    )
  }

  await stageDelay('Opening folder...', 140)
  await stageDelay('Scanning media...', 180)
  await stageDelay('Reading media metadata...', 120)
  await stageDelay('Detecting formats...', 160)

context.runtime.lastFolderNodeId = node.id
   context.values.fileCount = fileRuntimes.length

   logger.log(`[FOLDER] runtime files: ${fileRuntimes.length}`)

  logger.log(
    `Scanning folder: ${node.data.path}`,
  )

  if (node.data.recursive) {
    logger.log('Recursive scan enabled')
  }

  const detectedLabel =
    fileRuntimes.length === 1
      ? '1 file detected'
      : `${fileRuntimes.length} files detected`

  notify(detectedLabel)

  logger.log(
    `Loaded ${fileRuntimes.length} files`,
  )

  return {
    success: true,
    context,
  }
}
