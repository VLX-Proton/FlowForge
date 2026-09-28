const fs = require('fs')

function readFileAsBase64(filePath: string): string {
  return fs.readFileSync(filePath, { encoding: 'base64' })
}

function cleanupUploadedFile(filePath: string): void {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }
}

interface ResizeResult {
  resizedPath: string
  needsCleanup: boolean
}

async function resizeImageForAI(filePath: string): Promise<ResizeResult> {
  // Since we removed 'sharp' to reduce app size, we just pass the original image.
  // The AI models (Gemini/OpenRouter/Mistral) will receive the full resolution image.
  return { resizedPath: filePath, needsCleanup: false }
}

module.exports = { readFileAsBase64, cleanupUploadedFile, resizeImageForAI }
