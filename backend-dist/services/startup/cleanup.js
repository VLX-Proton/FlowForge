"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupInputs = cleanupInputs;
exports.cleanupOutputs = cleanupOutputs;
exports.cleanupJobs = cleanupJobs;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const APP_DATA_DIR = process.env.APP_DATA_DIR;
const INPUT_DIR = APP_DATA_DIR ? path_1.default.join(APP_DATA_DIR, 'inputs') : path_1.default.join(process.cwd(), 'backend', 'inputs');
const OUTPUT_DIR = APP_DATA_DIR ? path_1.default.join(APP_DATA_DIR, 'outputs') : path_1.default.join(process.cwd(), 'backend', 'outputs');
const JOB_DIR = APP_DATA_DIR ? path_1.default.join(APP_DATA_DIR, 'jobs') : path_1.default.join(process.cwd(), 'backend', 'jobs');
const MAX_FILES = 50;
function cleanupDir(dir, label) {
    if (!fs_1.default.existsSync(dir))
        return;
    try {
        const files = fs_1.default.readdirSync(dir)
            .map(f => {
            const fp = path_1.default.join(dir, f);
            try {
                return { path: fp, mtime: fs_1.default.statSync(fp).mtimeMs };
            }
            catch {
                return null;
            }
        })
            .filter((x) => x !== null)
            .sort((a, b) => a.mtime - b.mtime);
        let removed = 0;
        while (files.length > MAX_FILES) {
            const oldest = files.shift();
            if (oldest) {
                try {
                    fs_1.default.unlinkSync(oldest.path);
                    removed++;
                }
                catch { }
            }
        }
        if (removed > 0)
            console.log(`[CLEANUP] ${label}: removed ${removed} old file(s) (kept ${MAX_FILES} newest)`);
    }
    catch { }
}
/** Call after a new input file is saved. Keeps inputs/ at max 50 files. */
function cleanupInputs() { cleanupDir(INPUT_DIR, 'inputs'); }
/** Call after a result file is saved to outputs/. Keeps outputs/ at max 50 files. */
function cleanupOutputs() { cleanupDir(OUTPUT_DIR, 'outputs'); }
/** Call when a new job JSON is created. Keeps jobs/ at max 50 files. */
function cleanupJobs() { cleanupDir(JOB_DIR, 'jobs'); }
