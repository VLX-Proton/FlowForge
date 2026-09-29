"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resumeJobPolling = resumeJobPolling;
const axios_1 = __importDefault(require("axios"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const recovery_1 = require("../worker/recovery");
const constants_1 = require("../shared/constants");
const download_1 = require("../upscale/download");
const job_store_1 = require("./job-store");
const resubmit_1 = require("./resubmit");
const GITHUB_TOKEN = (0, constants_1.getGithubToken)();
const APP_DATA_DIR = process.env.APP_DATA_DIR;
const JOB_DIR = APP_DATA_DIR ? path_1.default.join(APP_DATA_DIR, 'jobs') : path_1.default.join(process.cwd(), 'backend', 'jobs');
const OUTPUT_DIR = APP_DATA_DIR ? path_1.default.join(APP_DATA_DIR, 'outputs') : path_1.default.join(process.cwd(), 'backend', 'outputs');
const WORKER_FILE = APP_DATA_DIR ? path_1.default.join(APP_DATA_DIR, 'data', 'worker.json') : path_1.default.join(process.cwd(), 'backend', 'data', 'worker.json');
async function resumeJobPolling(jobData) {
    const { jobId } = jobData;
    let workerJobId = jobData.workerJobId;
    const jobFilePath = path_1.default.join(JOB_DIR, `${jobId}.json`);
    console.log(`[RESUME POLL] Attaching to Colab job ${workerJobId} for backend job ${jobId}`);
    let attempts = 0;
    const maxAttempts = 7200;
    let workerJobInfo = null;
    let jobResubmitted = false; // Layer 3: allow only one re-submit attempt
    while (attempts < maxAttempts) {
        let currentJobState = null;
        try {
            currentJobState = JSON.parse(fs_1.default.readFileSync(jobFilePath, 'utf8'));
        }
        catch (e) {
            break;
        }
        if (!currentJobState || currentJobState.status === 'cancelled') {
            console.log(`[RESUME POLL] Job ${jobId} cancelled, stopping.`);
            if (fs_1.default.existsSync(jobFilePath)) {
                try {
                    fs_1.default.unlinkSync(jobFilePath);
                }
                catch (e) { }
            }
            return;
        }
        let currentWorkerUrl = JSON.parse(fs_1.default.readFileSync(WORKER_FILE, 'utf8')).workerUrl;
        try {
            const statusResp = await axios_1.default.get(`${currentWorkerUrl}/job/${workerJobId}`, { timeout: 10000 });
            workerJobInfo = statusResp.data;
            if (workerJobInfo?.progress !== undefined) {
                currentJobState.currentFileProgress = workerJobInfo.progress;
                currentJobState.status = 'processing';
                fs_1.default.writeFileSync(jobFilePath, JSON.stringify(currentJobState, null, 2));
            }
            if (workerJobInfo?.status === 'completed' || workerJobInfo?.status === 'done') {
                console.log(`[RESUME POLL] Job ${workerJobId} completed on Colab. Downloading result...`);
                const job = currentJobState;
                const outputFilename = (job.inputNames?.[0] || 'output').replace(/\.[^/.]+$/, '') + `_${job.scale}x.${job.format === 'auto' ? 'png' : job.format}`;
                const resultPath = path_1.default.join(OUTPUT_DIR, outputFilename);
                let downloadOk = false;
                while (true) {
                    job.phase = 'downloading';
                    job.downloadAttempt = (job.downloadAttempt || 0) + 1;
                    (0, job_store_1.saveJob)(jobId, job);
                    downloadOk = await (0, download_1.robustDownload)(currentWorkerUrl, workerJobId, resultPath, job, jobFilePath, job_store_1.saveJob);
                    if (downloadOk)
                        break;
                    console.warn(`[RESUME POLL] Download attempt ${job.downloadAttempt} failed. Attempting recovery...`);
                    const { recovered, url } = await (0, recovery_1.waitForLiveWorker)(currentWorkerUrl, job, jobFilePath);
                    if (!recovered) {
                        job.status = 'error';
                        job.error = 'Worker connection timeout during download';
                        (0, job_store_1.saveJob)(jobId, job);
                        return;
                    }
                    currentWorkerUrl = url;
                }
                job.status = 'completed';
                job.phase = 'done';
                (0, job_store_1.saveJob)(jobId, job);
                return;
            }
            if (workerJobInfo?.status === 'error') {
                currentJobState.status = 'error';
                currentJobState.error = workerJobInfo.error || 'Worker error';
                fs_1.default.writeFileSync(jobFilePath, JSON.stringify(currentJobState, null, 2));
                return;
            }
            // Layer 3: Colab lost the job — re-submit once with original params
            if (workerJobInfo?.status === 'not_found' || workerJobInfo?.status === 'orphaned') {
                if (jobResubmitted) {
                    console.error(`[RESUME POLL] Job ${workerJobId} still not found after re-submit. Marking as error.`);
                    currentJobState.status = 'error';
                    currentJobState.error = 'Worker lost job even after re-submit (Layer 3 exhausted)';
                    (0, job_store_1.saveJob)(jobId, currentJobState);
                    return;
                }
                console.warn(`[RESUME POLL] Colab returned '${workerJobInfo.status}' for job ${workerJobId} — triggering Layer 3 re-submit…`);
                const newWorkerJobId = await (0, resubmit_1.resubmitJobToWorker)(currentJobState, currentWorkerUrl);
                if (!newWorkerJobId) {
                    currentJobState.status = 'error';
                    currentJobState.error = 'Layer 3 re-submit failed: input file missing or Colab unreachable';
                    (0, job_store_1.saveJob)(jobId, currentJobState);
                    return;
                }
                workerJobId = newWorkerJobId;
                currentJobState.workerJobId = newWorkerJobId;
                (0, job_store_1.saveJob)(jobId, currentJobState);
                jobResubmitted = true;
                continue;
            }
        }
        catch (e) {
            console.warn(`[RESUME POLL] Poll error: ${e.message} — entering recovery...`);
            if (currentJobState) {
                const { recovered, url } = await (0, recovery_1.waitForLiveWorker)(currentWorkerUrl, currentJobState, jobFilePath);
                if (!recovered) {
                    currentJobState.status = 'error';
                    currentJobState.error = 'Worker connection timeout after 30 minutes';
                    (0, job_store_1.saveJob)(jobId, currentJobState);
                    return;
                }
                continue;
            }
            return;
        }
        attempts++;
        await new Promise(r => setTimeout(r, 1000));
    }
}
