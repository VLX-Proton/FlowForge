"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.robustDownload = robustDownload;
const axios_1 = __importDefault(require("axios"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const worker_request_1 = require("./worker-request");
const cleanup_1 = require("../startup/cleanup");
/**
 * Downloads a result file from Colab robustly.
 * Features:
 * - 5-minute timeout per request to prevent hanging.
 * - Deletes existing partial/corrupt files before downloading.
 * - Validates that the downloaded file is > 0 bytes.
 * - Tracks and reports download progress (0-100%) via job state (throttled to every 500ms).
 * - Runs cleanupOutputs() after a successful download to keep outputs/ at max 50 files.
 */
async function robustDownload(currentWorkerUrl, workerJobId, resultPath, job, jobFilePath, saveJob) {
    try {
        // 1. Delete existing partial file to avoid appending or keeping a corrupt 0-byte file
        if (fs_1.default.existsSync(resultPath)) {
            try {
                fs_1.default.unlinkSync(resultPath);
                console.log(`[BACKEND] Removed existing/partial file: ${resultPath}`);
            }
            catch (err) {
                console.warn(`[BACKEND] Failed to remove partial file ${resultPath}:`, err);
            }
        }
        const resultUrl = `${currentWorkerUrl}/result/${workerJobId}`;
        console.log(`[BACKEND] Starting download from: ${resultUrl}`);
        // 2. Start download with a timeout (5 minutes max per stream connection)
        const response = await axios_1.default.get(`${resultUrl}?index=0`, {
            responseType: 'stream',
            timeout: 300000 // 5 minutes
        });
        // 3. Track download progress via Content-Length header + chunk counting
        const totalBytes = parseInt(String(response.headers['content-length'] ?? '0'), 10);
        let downloadedBytes = 0;
        let lastProgressSave = 0;
        response.data.on('data', (chunk) => {
            downloadedBytes += chunk.length;
            if (totalBytes > 0) {
                const now = Date.now();
                if (now - lastProgressSave >= 500) { // throttle: save at most every 500 ms
                    lastProgressSave = now;
                    job.downloadProgress = Math.round((downloadedBytes / totalBytes) * 100);
                    try {
                        saveJob(job.jobId, job);
                    }
                    catch { }
                }
            }
        });
        const writer = fs_1.default.createWriteStream(resultPath);
        response.data.pipe(writer);
        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
            response.data.on('error', reject);
        });
        // 4. Final progress: set 100% before validation
        job.downloadProgress = 100;
        try {
            saveJob(job.jobId, job);
        }
        catch { }
        // 5. Validation: Check if the file is valid (> 0 bytes)
        const stats = fs_1.default.statSync(resultPath);
        if (stats.size === 0) {
            throw new Error('Downloaded file is 0 bytes');
        }
        // 6. Success: Update job state
        job.outputPaths.push(resultPath);
        job.completedFiles += 1;
        job.currentFileProgress = 100;
        saveJob(job.jobId, job);
        console.log(`[BACKEND] Downloaded result successfully: ${path_1.default.basename(resultPath)} (${stats.size} bytes)`);
        // 7. Cleanup outputs/ to keep at max 50 files
        (0, cleanup_1.cleanupOutputs)();
        // Try to clean up job on Colab
        try {
            await (0, worker_request_1.workerRequest)('delete', `/job/${workerJobId}`, {}, job, jobFilePath);
            console.log(`[BACKEND] Cleaned up job folder ${workerJobId} on Colab`);
        }
        catch (delError) {
            console.warn(`[BACKEND] Failed to clean up job folder ${workerJobId} on Colab`, delError.message);
        }
        return true;
    }
    catch (e) {
        console.error('[BACKEND] Failed to download result (robustDownload):', e.message);
        // Cleanup corrupt file on failure
        if (fs_1.default.existsSync(resultPath)) {
            try {
                fs_1.default.unlinkSync(resultPath);
            }
            catch (err) { }
        }
        return false;
    }
}
