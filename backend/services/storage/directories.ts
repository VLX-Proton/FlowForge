import fs from 'fs'
import path from 'path'

export function cleanupDirectory(dir: string, maxFiles: number): void {
  try {
    const files = fs.readdirSync(dir)
      .map(f => ({
        name: f,
        path: path.join(dir, f),
        mtime: fs.statSync(path.join(dir, f)).mtimeMs
      }))
      .sort((a, b) => a.mtime - b.mtime)

    while (files.length > maxFiles) {
      const oldest = files.shift()
      if (oldest) {
        fs.unlinkSync(oldest.path)
        console.log(`[CLEANUP] Removed old file: ${oldest.name}`)
      }
    }
  } catch (e) {
    // Directory may be empty or not exist
  }
}

export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || 'png'
}
