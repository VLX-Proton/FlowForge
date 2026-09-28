import type { WorkflowNode } from '../../types/node.types'
import type { WorkflowContext } from '../context'
import type { ExecutionResult } from '../types'
import { updateFileStatus } from '../runtimeFiles'
import {
  buildHandleKey,
  getDirectoryHandlePath,
} from '../../utils/folderPicker'

async function fetchOutputFile(filename: string): Promise<Blob> {
  const url = `/api/outputs/${encodeURIComponent(filename)}`
  const response = await fetch(url, {
    mode: 'cors',
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch output file: ${response.status}`)
  }

  return response.blob()
}

async function ensureDirectoryHandleWritePermission(
  handle: FileSystemDirectoryHandle,
): Promise<boolean> {
  const anyHandle = handle as any

  if (typeof anyHandle.queryPermission !== 'function') {
    console.log(
      '[SAVE] Directory handle does not support permission queries; assuming granted',
    )
    return true
  }

  const status = await anyHandle.queryPermission({
    mode: 'readwrite',
  })

  if (status === 'granted') {
    console.log('[SAVE] Folder permission granted')
    return true
  }

  console.log(
    '[SAVE] Folder permission lost, requesting again...',
  )

  if (typeof anyHandle.requestPermission === 'function') {
    const requestStatus = await anyHandle.requestPermission({
      mode: 'readwrite',
    })

    if (requestStatus === 'granted') {
      console.log('[SAVE] Folder permission granted')
      return true
    }
  }

  console.log(
    '[SAVE] Folder permission denied, falling back to backend save',
  )
  return false
}

async function writeBlobToDirectory(
  handle: FileSystemDirectoryHandle,
  filename: string,
  blob: Blob,
): Promise<void> {
  const fileHandle = await handle.getFileHandle(
    filename,
    { create: true },
  )
  const writable = await fileHandle.createWritable()

  await writable.write(blob)
  await writable.close()
}

function getDirectoryHandleDisplayPath(
  handle: FileSystemDirectoryHandle,
): string {
  return getDirectoryHandlePath(handle) || handle.name || ''
}

export async function saveExecutor(
  node: WorkflowNode,
  context: WorkflowContext,
): Promise<ExecutionResult> {
  if (!context.runtime) {
    return {
      success: false,
      context,
      error: 'Runtime not initialized',
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

  const customFolderHandle =
    context.runtime.directoryHandles?.[
      buildHandleKey(node.id, 'outputFolder')
    ]
  const outputPathCheck = customFolderHandle
    ? getDirectoryHandleDisplayPath(customFolderHandle)
    : node.data.outputFolder || ''

  if (!outputPathCheck && !customFolderHandle) {
    logger.error('No output folder selected. Please select a folder in the Save node settings.')
    return {
      success: false,
      context,
      error: 'No output folder selected',
    }
  }

  logger.log('Saving runtime outputs')

  const filesToSave = context.runtime.fileRuntimes || []

  console.log(`[SAVE] Using runtime file outputs: fileRuntimes (length: ${filesToSave.length})`)
  logger.log(
    `[SAVE] Using fileRuntimes.length=${filesToSave.length}`,
  )
  filesToSave.forEach((file, idx) => {
    logger.log(
      `[SAVE]   [${idx}] id=${file.id} name=${file.name}`,
    )
    console.log(`[SAVE]   [${idx}] Full file object:`, file)
  })

  if (filesToSave.length === 0) {
    logger.error(
      'No file outputs available for save from any previous node.',
    )

    return {
      success: false,
      context,
      error: 'No file outputs available for save',
    }
  }


  let directoryHandle: FileSystemDirectoryHandle | null | undefined = customFolderHandle
  let outputPath = customFolderHandle
    ? getDirectoryHandleDisplayPath(customFolderHandle)
    : node.data.outputFolder || ''
  context.values.outputFolder = outputPath
  logger.log(`[SAVE] Requested target folder: ${outputPath}`)
  console.log('[SAVE] Requested target folder:', outputPath)

const isElectronHandle = !!(directoryHandle as any)?.electronPath
const canSaveLocally =
    !!directoryHandle &&
    (typeof directoryHandle.getFileHandle === 'function' || isElectronHandle)

  if (!outputPath && !canSaveLocally) {
    return {
      success: false,
      context,
      error: 'Output folder is not available',
    }
  }

  if (canSaveLocally) {
    logger.log('[SAVE] Local filesystem save mode enabled')
  } else {
    logger.log('[SAVE] Backend fallback save mode enabled')
  }

  logger.log(
    `Writing ${filesToSave.length} files...`,
  )

  const notifyUpdate = () => {
    context.runtime?.onRuntimeUpdate?.(node, {
      fileRuntimes:
        context.runtime?.fileRuntimes ||
        filesToSave,
      currentImageId: context.runtime?.currentImageId,
      outputPath,
      executionStartedAt: node.execution?.startedAt,
    })
  }

  for (
    let i = 0;
    i < filesToSave.length;
    i++
  ) {
    if (context.runtime.isCancelled) {
      logger.warn('Save cancelled')
      break
    }

    const file = filesToSave[i]
    let outputFilename = file.name

    context.runtime.currentImageId = file.id
    context.runtime.fileRuntimes =
      context.runtime.fileRuntimes?.map(f =>
        f.id === file.id
          ? updateFileStatus(
              f,
              'saving',
              outputFilename,
              `${outputPath}/${outputFilename}`,
            )
          : f,
      ) || []

    logger.log(
      `Writing ${outputFilename}`,
    )
    notifyUpdate()
    await new Promise(resolve =>
      setTimeout(resolve, 50),
    )

    const finalFilename = file.name

    try {
      let sourceBlob: Blob | null = null

      // Check for attached blob first (used by Metadata node for CSV generation)
      if (file.blob) {
        logger.log(`[SAVE] Using attached blob for: ${file.name}`)
        sourceBlob = file.blob
      } else if (file.outputPath) {
        logger.log(
          `[SAVE] Fetching output file from backend: ${file.outputPath}`,
        )
        sourceBlob = await fetchOutputFile(file.outputPath)
        logger.log(
          `[SAVE] Fetched output file, size: ${sourceBlob.size}`,
        )
      } else if (file.handle) {
        logger.log(
          `[SAVE] Reading file from handle`,
        )
        sourceBlob = await file.handle.getFile()
      } else {
        throw new Error(
          'Source file data unavailable for save - no blob, outputPath or handle',
        )
      }

      if (!sourceBlob) {
        throw new Error(
          'Source file data unavailable for save',
        )
      }

      const saveBlob = sourceBlob

      let fullPath = ''
      let attemptedLocalSave = false
      let permissionGranted = false

if (canSaveLocally && directoryHandle) {
        const electronPath = (directoryHandle as any)?.electronPath

        if (electronPath) {
          attemptedLocalSave = true
          permissionGranted = true
          const arrayBuffer = await saveBlob.arrayBuffer()
          const result = await (window as any).electronAPI.writeFile(
            electronPath,
            finalFilename,
            arrayBuffer,
          )
          if (!result.success) {
            throw new Error(result.error || 'Failed to write file via Electron')
          }
          fullPath = `${electronPath}/${finalFilename}`
        } else {
          permissionGranted = await ensureDirectoryHandleWritePermission(
            directoryHandle,
          )

          if (permissionGranted) {
            attemptedLocalSave = true
            await writeBlobToDirectory(
              directoryHandle,
              finalFilename,
              saveBlob,
            )
            const folderLabel = getDirectoryHandleDisplayPath(
              directoryHandle,
            )
            fullPath = folderLabel
              ? `${folderLabel}/${finalFilename}`
              : finalFilename
          }
        }
      }

      if (!attemptedLocalSave) {
        throw new Error(
          'Local save required but permission not granted. Select an output folder.',
        )
      }

      outputFilename = finalFilename
      const savedFile = updateFileStatus(
        file,
        'success',
        outputFilename,
        fullPath,
      )

      filesToSave[i] = savedFile
      context.runtime.fileRuntimes =
        context.runtime.fileRuntimes?.map(f =>
          f.id === file.id
            ? savedFile
            : f,
        ) || []

      logger.log(
        `✓ Saved: ${fullPath}`,
      )
      notifyUpdate()
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error)

      logger.error(
        `Failed to save ${outputFilename}: ${message}`,
      )

      const failedFile = updateFileStatus(
        file,
        'error',
      )
      failedFile.error = message
      filesToSave[i] = failedFile
      context.runtime.fileRuntimes =
        context.runtime.fileRuntimes?.map(f =>
          f.id === file.id
            ? failedFile
            : f,
        ) || []

      notifyUpdate()
    }
  }

  logger.log(
    `Completed: ${filesToSave.length} files written`,
  )

  const savedSourceFiles = filesToSave.filter(f => f.handle && f.status === 'success')
  const inputFolderHandle = context.runtime.inputFolderHandle
  if (savedSourceFiles.length > 0 && inputFolderHandle) {
    logger.log(`[SAVE] Deleting ${savedSourceFiles.length} processed source files from input folder...`)
    const electronPath = (inputFolderHandle as any).electronPath
    
    for (const file of savedSourceFiles) {
      // Use sourceName (original input filename) if available; fallback to file.name
      const nameToDelete = file.sourceName || file.name
      try {
        if (electronPath && (window as any).electronAPI?.deleteFile) {
          const result = await (window as any).electronAPI.deleteFile(electronPath, nameToDelete)
          if (!result.success) throw new Error(result.error)
        } else {
          await inputFolderHandle.removeEntry(nameToDelete)
        }
        logger.log(`[SAVE] Deleted source file: ${nameToDelete}`)
      } catch (err: any) {
        logger.warn(`[SAVE] Could not delete source file ${nameToDelete}: ${err.message}`)
      }
    }
  }

  return {
    success: true,
    context,
  }
}