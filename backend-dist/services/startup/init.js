"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runStartup = runStartup;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const gist_sync_1 = require("../worker/gist-sync");
const health_1 = require("../worker/health");
const poller_1 = require("../jobs/poller");
const cleanup_1 = require("./cleanup");
const APP_DATA_DIR = process.env.APP_DATA_DIR;
const DATA_DIR = APP_DATA_DIR ? path_1.default.join(APP_DATA_DIR, 'data') : path_1.default.join(process.cwd(), 'backend', 'data');
const JOB_DIR = APP_DATA_DIR ? path_1.default.join(APP_DATA_DIR, 'jobs') : path_1.default.join(process.cwd(), 'backend', 'jobs');
const INPUT_DIR = APP_DATA_DIR ? path_1.default.join(APP_DATA_DIR, 'inputs') : path_1.default.join(process.cwd(), 'backend', 'inputs');
const OUTPUT_DIR = APP_DATA_DIR ? path_1.default.join(APP_DATA_DIR, 'outputs') : path_1.default.join(process.cwd(), 'backend', 'outputs');
const WORKER_FILE = path_1.default.join(DATA_DIR, 'worker.json');
function initDirectories() {
    ;
    [DATA_DIR, JOB_DIR, INPUT_DIR, OUTPUT_DIR].forEach(dir => {
        if (!fs_1.default.existsSync(dir))
            fs_1.default.mkdirSync(dir, { recursive: true });
    });
    if (!fs_1.default.existsSync(WORKER_FILE)) {
        fs_1.default.writeFileSync(WORKER_FILE, JSON.stringify({ workerUrl: '' }, null, 2));
    }
}
async function resumeOrphanedJobs() {
    if (!fs_1.default.existsSync(JOB_DIR))
        return;
    const jobFiles = fs_1.default.readdirSync(JOB_DIR);
    for (const jf of jobFiles) {
        if (!jf.endsWith('.json'))
            continue;
        try {
            const jobData = JSON.parse(fs_1.default.readFileSync(path_1.default.join(JOB_DIR, jf), 'utf8'));
            if ((jobData.status === 'processing' || jobData.status === 'paused' || jobData.phase === 'downloading') &&
                jobData.workerJobId) {
                console.log(`[STARTUP] Resuming orphaned job ${jobData.jobId} (workerJobId: ${jobData.workerJobId})`);
                (0, poller_1.resumeJobPolling)(jobData);
            }
        }
        catch (e) {
            console.warn('[STARTUP] Failed to parse job file:', jf, e.message);
        }
    }
}
function startIdleMonitor() {
    setInterval(async () => {
        try {
            if (!fs_1.default.existsSync(WORKER_FILE))
                return;
            const currentUrl = JSON.parse(fs_1.default.readFileSync(WORKER_FILE, 'utf8')).workerUrl;
            if (!currentUrl)
                return;
            const alive = await (0, health_1.isWorkerAlive)(currentUrl);
            if (!alive) {
                const freshUrl = await (0, gist_sync_1.syncWorkerUrl)();
                if (freshUrl && freshUrl !== currentUrl) {
                    const freshAlive = await (0, health_1.isWorkerAlive)(freshUrl);
                    if (freshAlive) {
                        console.log(`[IDLE MONITOR] Colab aktif kembali! URL diperbarui ke: ${freshUrl}`);
                    }
                }
            }
        }
        catch (e) {
            // Silently catch file read errors
        }
    }, 15000);
}
async function runStartup() {
    console.log('[STARTUP] Initializing directories...');
    initDirectories();
    console.log('[STARTUP] Cleaning up old/stale files...');
    (0, cleanup_1.cleanupInputs)();
    (0, cleanup_1.cleanupOutputs)();
    (0, cleanup_1.cleanupJobs)();
    console.log('[STARTUP] Initial URL sync from Gist...');
    try {
        const urlAwal = await (0, gist_sync_1.syncWorkerUrl)();
        if (urlAwal) {
            console.log(`[STARTUP] Sukses! worker.json telah diperbarui ke: ${urlAwal}`);
        }
        else {
            console.log('[STARTUP] Peringatan: Gagal mengambil URL awal. Menggunakan cache data lama.');
        }
    }
    catch (e) {
        console.warn('[STARTUP] Initial sync failed:', e.message);
    }
    console.log('[STARTUP] Scanning for orphaned jobs...');
    await resumeOrphanedJobs();
    console.log('[STARTUP] Starting idle monitor...');
    startIdleMonitor();
}
