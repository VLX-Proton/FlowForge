const fs = require('fs');
function readFileAsBase64(filePath) {
    return fs.readFileSync(filePath, { encoding: 'base64' });
}
function cleanupUploadedFile(filePath) {
    if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
}
async function resizeImageForAI(filePath) {
    // Since we removed 'sharp' to reduce app size, we just pass the original image.
    // The AI models (Gemini/OpenRouter/Mistral) will receive the full resolution image.
    return { resizedPath: filePath, needsCleanup: false };
}
module.exports = { readFileAsBase64, cleanupUploadedFile, resizeImageForAI };
