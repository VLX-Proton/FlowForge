/**
  * Generic runtime data for any file (image, video, text, etc.) that flows
  * through the workflow. Replaces the previous image‑specific runtime.
  */
export interface FileRuntimeData {
  /** Unique identifier */
  id: string
  /** FileSystemFileHandle obtained from folder picker (optional for processed files) */
  handle?: FileSystemFileHandle
  /** Original file name */
  name: string
  /** Size in bytes */
  size: number
  /** MIME type (e.g. "image/png", "video/mp4") */
  type: string
  /** Processing status */
  status: 'pending' | 'saving' | 'success' | 'error'
  /** Optional error message */
  error?: string
  /** Optional output filename after processing */
  outputFilename?: string
  /** Optional output path after saving (backend job ID for upscaled files) */
  outputPath?: string
  /** Optional Blob for processed files */
  blob?: Blob
  /** Original source filename (input file) — used by save executor to delete source after saving */
  sourceName?: string
}

/** Create a FileRuntimeData from a FileSystemFileHandle */
export async function createFileRuntime(
  handle: FileSystemFileHandle,
): Promise<FileRuntimeData> {
  const file = await handle.getFile()
  return {
    id: crypto.randomUUID(),
    handle,
    name: file.name,
    size: file.size,
    type: file.type,
    status: 'pending',
  }
}

/** Update status of a runtime file */
export function updateFileStatus(
  file: FileRuntimeData,
  status: FileRuntimeData['status'],
  outputFilename?: string,
  outputPath?: string,
  error?: string,
): FileRuntimeData {
  return { ...file, status, outputFilename, outputPath, error }
}
