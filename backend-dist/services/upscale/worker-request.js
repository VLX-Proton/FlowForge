"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.workerRequest = workerRequest;
const axios_1 = __importDefault(require("axios"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const gist_sync_1 = require("../worker/gist-sync");
const health_1 = require("../worker/health");
const recovery_1 = require("../worker/recovery");
const constants_1 = require("../shared/constants");
const GITHUB_TOKEN = (0, constants_1.getGithubToken)();
const APP_DATA_DIR = process.env.APP_DATA_DIR;
const WORKER_FILE = APP_DATA_DIR
    ? path_1.default.join(APP_DATA_DIR, 'data', 'worker.json')
    : path_1.default.join(process.cwd(), 'backend', 'data', 'worker.json');
async function workerRequest(method, endpoint, options, job, jobFilePath) {
    let workerUrl = JSON.parse(fs_1.default.readFileSync(WORKER_FILE, 'utf8')).workerUrl;
    const attempt = async (url) => {
        const fullUrl = `${url}${endpoint}`;
        if (method === 'post') {
            return await axios_1.default.post(fullUrl, options.data, {
                headers: options.headers,
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
                timeout: options.timeout || 60000,
            });
        }
        else if (method === 'delete') {
            return await axios_1.default.delete(fullUrl, { timeout: options.timeout || 15000 });
        }
        else {
            return await axios_1.default.get(fullUrl, { timeout: options.timeout || 15000 });
        }
    };
    try {
        return await attempt(workerUrl);
    }
    catch (e) {
        console.warn(`[WORKER REQUEST] Failed (${endpoint}): ${e.message} — trying fresh Gist URL…`);
    }
    const freshUrl = await (0, gist_sync_1.syncWorkerUrl)();
    if (freshUrl && freshUrl !== workerUrl) {
        const alive = await (0, health_1.isWorkerAlive)(freshUrl);
        if (alive) {
            try {
                workerUrl = freshUrl;
                return await attempt(workerUrl);
            }
            catch (e) {
                console.warn(`[WORKER REQUEST] Fresh URL also failed: ${e.message}`);
            }
        }
    }
    const { url: recoveredUrl, recovered } = await (0, recovery_1.waitForLiveWorker)(workerUrl, job, jobFilePath);
    if (!recovered) {
        throw new Error('Worker connection timeout after 30 minutes');
    }
    workerUrl = recoveredUrl;
    return await attempt(workerUrl);
}
