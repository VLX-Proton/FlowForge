"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.waitForLiveWorker = waitForLiveWorker;
const axios_1 = __importDefault(require("axios"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const health_1 = require("./health");
const constants_1 = require("../shared/constants");
const GITHUB_TOKEN = (0, constants_1.getGithubToken)();
const APP_DATA_DIR = process.env.APP_DATA_DIR;
const WORKER_FILE = APP_DATA_DIR ? path_1.default.join(APP_DATA_DIR, 'data', 'worker.json') : path_1.default.join(process.cwd(), 'backend', 'data', 'worker.json');
async function waitForLiveWorker(currentUrl, job, jobFilePath) {
    const deadline = Date.now() + constants_1.MAX_RECOVERY_MS;
    console.log('[RECOVERY] Worker unreachable. Polling Gist for new URL…');
    if (job && jobFilePath) {
        job.status = 'paused';
        job.pauseReason = 'Backend offline — waiting for Colab to reconnect';
        job.pausedAt = Date.now();
        fs_1.default.writeFileSync(jobFilePath, JSON.stringify(job, null, 2));
    }
    while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, constants_1.GIST_POLL_MS));
        let freshUrl;
        try {
            const response = await axios_1.default.get(`${constants_1.GIST_API_URL}?t=${Date.now()}`, {
                headers: {
                    Authorization: `Bearer ${GITHUB_TOKEN}`,
                    'User-Agent': 'NodeJS-Gist-App',
                    Accept: 'application/vnd.github+json'
                }
            });
            freshUrl = response.data.files['hypir_url.txt'].content.trim();
        }
        catch {
            console.warn('[RECOVERY] Gist fetch failed, will retry…');
            continue;
        }
        if (!freshUrl || !freshUrl.startsWith('https://'))
            continue;
        const alive = await (0, health_1.isWorkerAlive)(freshUrl);
        if (alive) {
            fs_1.default.writeFileSync(WORKER_FILE, JSON.stringify({ workerUrl: freshUrl }, null, 2));
            console.log('[RECOVERY] New live URL found:', freshUrl);
            if (job && jobFilePath) {
                job.status = 'processing';
                job.pauseReason = undefined;
                job.resumedAt = Date.now();
                fs_1.default.writeFileSync(jobFilePath, JSON.stringify(job, null, 2));
            }
            return { url: freshUrl, recovered: true };
        }
        console.log('[RECOVERY] URL in Gist not yet live, keep waiting…');
    }
    console.error('[RECOVERY] 30-minute timeout reached. Marking job as error.');
    if (job && jobFilePath) {
        job.status = 'error';
        job.error = 'Connection timeout: Colab did not come back online within 30 minutes';
        fs_1.default.writeFileSync(jobFilePath, JSON.stringify(job, null, 2));
    }
    return { url: currentUrl, recovered: false };
}
