import type { FileRuntimeData } from '../execution/runtimeFiles'

export async function scanFolderElectron(folderPath: string): Promise<{ files: FileRuntimeData[]; skipped: number; formats: Set<string>; sampleFilenames: string[] }> {
    const electronAPI = (window as any).electronAPI
    const filePaths: string[] = await electronAPI.scanFolder(folderPath)

    const files: FileRuntimeData[] = []
    let skipped = 0
    const formats = new Set<string>()
    const sampleFilenames: string[] = []

    for (const filePath of filePaths) {
        try {
            const buffer: ArrayBuffer = await electronAPI.readFile(filePath)
            const filename = filePath.split('/').pop() || filePath
            const ext = filename.split('.').pop()?.toLowerCase()
            const mimeMap: Record<string, string> = {
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            png: 'image/png',
            webp: 'image/webp',
            gif: 'image/gif',
            tiff: 'image/tiff',
            tif: 'image/tiff',
            bmp: 'image/bmp',
            }
            const mime = mimeMap[ext || ''] || 'application/octet-stream'
            const blob = new Blob([new Uint8Array(buffer)], { type: mime })
            const file = new File([blob], filename, { type: mime })

            const fakeHandle = {
                getFile: async () => file,
                kind: 'file',
                name: filename,
            } as unknown as FileSystemFileHandle
            ;(fakeHandle as any).electronPath = filePath

            files.push({
                id: crypto.randomUUID(),
                       handle: fakeHandle,
                       name: filename,
                       size: blob.size,
                       type: mime,
                       status: 'pending',
            })

            if (ext) formats.add(ext.toUpperCase())
                if (sampleFilenames.length < 3) sampleFilenames.push(filename)
        } catch {
            skipped++
        }
    }

    return { files, skipped, formats, sampleFilenames }
}
