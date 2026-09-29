"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadJob = loadJob;
exports.saveJob = saveJob;
exports.deleteJob = deleteJob;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const cleanup_1 = require("../startup/cleanup");
const APP_DATA_DIR = process.env.APP_DATA_DIR;
const JOB_DIR = APP_DATA_DIR ? path_1.default.join(APP_DATA_DIR, 'jobs') : path_1.default.join(process.cwd(), 'backend', 'jobs');
function loadJob(jobId) {
    const file = path_1.default.join(JOB_DIR, `${jobId}.json`);
    if (!fs_1.default.existsSync(file))
        return null;
    try {
        return JSON.parse(fs_1.default.readFileSync(file, 'utf8'));
    }
    catch {
        return null;
    }
}
function saveJob(jobId, job) {
    const file = path_1.default.join(JOB_DIR, `${jobId}.json`);
    const isNew = !fs_1.default.existsSync(file);
    fs_1.default.writeFileSync(file, JSON.stringify(job, null, 2));
    if (isNew) {
        (0, cleanup_1.cleanupJobs)();
    }
}
function deleteJob(jobId) {
    const file = path_1.default.join(JOB_DIR, `${jobId}.json`);
    try {
        fs_1.default.unlinkSync(file);
    }
    catch {
        // ignore missing file or delete errors
    }
}
