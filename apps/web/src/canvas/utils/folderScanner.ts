import type { FileRuntimeData } from '../execution/runtimeFiles'
import { createFileRuntime } from '../execution/runtimeFiles'

/**
 * Scan a directory (recursively if needed) and return every file as a
 * FileRuntimeData object. This replaces the previous image‑only scanner.
 */
export async function scanFolderForFiles(
  handle: FileSystemDirectoryHandle | null,
  recursive = true,
): Promise<{ files: FileRuntimeData[]; skipped: number; formats: Set<string>; sampleFilenames: string[] }> {
  if ((window as any).electronAPI?.scanFolder) {
    const electronPath = (handle as any)?.electronPath
    if (electronPath) {
      const { scanFolderElectron } = await import('./electronFolderScanner')
      return scanFolderElectron(electronPath)
    }
  }

  if (!handle) {
    return { files: [], skipped: 0, formats: new Set(), sampleFilenames: [] }
  }

  const files: FileRuntimeData[] = []
  let skipped = 0
  const formats = new Set<string>()
  const sampleFilenames: string[] = []

  // Helper to process a single directory
  const processDirectory = async (dir: FileSystemDirectoryHandle) => {
    for await (const entry of (dir as any).entries()) {
      const [name, entryHandle] = entry
      if (entryHandle instanceof FileSystemFileHandle) {
        try {
          const runtime = await createFileRuntime(entryHandle)
          files.push(runtime)
          const ext = name.split('.').pop()?.toLowerCase()
          if (ext) formats.add(ext.toUpperCase())
            if (sampleFilenames.length < 3) sampleFilenames.push(name)
        } catch {
          skipped++
        }
      } else if (
        entryHandle instanceof FileSystemDirectoryHandle &&
        recursive
      ) {
        // Recurse into sub‑folder
        await processDirectory(entryHandle)
      }
    }
  }

  try {
    await processDirectory(handle)
  } catch (e) {
    console.warn('Failed to scan folder:', e)
  }

  return { files, skipped, formats, sampleFilenames }
}
