"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resubmitJobToWorker = resubmitJobToWorker;
const axios_1 = __importDefault(require("axios"));
const fs_1 = __importDefault(require("fs"));
const form_data_1 = __importDefault(require("form-data"));
/**
 * Layer 3: Re-submit a job to Colab when Colab has lost track of it
 * (i.e., Colab returns "not_found" or "orphaned" for the workerJobId).
 *
 * Uses the original input file and parameters stored in the Backend job record.
 *
 * @returns New workerJobId from Colab, or null if re-submit is not possible.
 */
async function resubmitJobToWorker(jobData, workerUrl) {
    const inputPath = jobData.inputPaths?.[0];
    const originalName = jobData.inputNames?.[0] || 'input.png';
    if (!inputPath) {
        console.warn('[RESUBMIT] No inputPath in jobData — cannot re-submit.');
        return null;
    }
    if (!fs_1.default.existsSync(inputPath)) {
        console.warn(`[RESUBMIT] Input file no longer exists: ${inputPath}`);
        return null;
    }
    console.log(`[RESUBMIT] Layer 3: Re-submitting job ${jobData.jobId} to Colab (file: ${originalName})`);
    const form = new form_data_1.default();
    form.append('images', fs_1.default.createReadStream(inputPath), originalName);
    form.append('scale', String(jobData.scale ?? 2));
    form.append('patch_size', String(jobData.patchSize ?? 512));
    form.append('stride', String(jobData.stride ?? 256));
    form.append('scale_by', jobData.scaleBy ?? 'factor');
    if (jobData.prompt)
        form.append('prompt', jobData.prompt);
    if (jobData.targetLongestSide)
        form.append('target_longest_side', String(jobData.targetLongestSide));
    try {
        const resp = await axios_1.default.post(`${workerUrl}/job`, form, {
            headers: form.getHeaders(),
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            timeout: 60000,
        });
        const newWorkerJobId = resp.data?.job_id;
        if (!newWorkerJobId) {
            console.warn('[RESUBMIT] Colab did not return a job_id in response.');
            return null;
        }
        console.log(`[RESUBMIT] Layer 3: Job re-submitted successfully. New workerJobId: ${newWorkerJobId}`);
        return newWorkerJobId;
    }
    catch (e) {
        console.error(`[RESUBMIT] Layer 3: Failed to re-submit job: ${e.message}`);
        return null;
    }
}
