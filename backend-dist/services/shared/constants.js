"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GIST_API_URL = exports.GIST_ID = exports.GIST_POLL_MS = exports.MAX_RECOVERY_MS = exports.MAX_FILES = void 0;
exports.getGithubToken = getGithubToken;
const dotenv_1 = __importDefault(require("dotenv"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const APP_DATA_DIR = process.env.APP_DATA_DIR;
// 1) Lokasi .env di user data (di luar AppImage, bisa diubah user)
const userEnvPath = APP_DATA_DIR
    ? path_1.default.join(APP_DATA_DIR, 'data', '.env')
    : null;
// 2) Lokasi .env bundled di dalam AppImage (resources/data/.env)
//    Backend di Elektron di-spawn dengan cwd = process.resourcesPath,
//    jadi process.cwd() mengarah ke folder yang sama dengan .env yang dibundle.
const bundledEnvPath = path_1.default.join(process.cwd(), 'data', '.env');
// 3) Fallback untuk dev mode
const devEnvPath = userEnvPath || bundledEnvPath;
let envPath = userEnvPath || devEnvPath;
// Jika .env belum ada di user data, copy dari bundled
if (userEnvPath && !fs_1.default.existsSync(userEnvPath) && fs_1.default.existsSync(bundledEnvPath)) {
    try {
        const userDir = path_1.default.dirname(userEnvPath);
        if (!fs_1.default.existsSync(userDir)) {
            fs_1.default.mkdirSync(userDir, { recursive: true });
        }
        fs_1.default.copyFileSync(bundledEnvPath, userEnvPath);
        console.log('[ENV] Copied bundled .env to user data:', userEnvPath);
    }
    catch (err) {
        console.warn('[ENV] Failed to copy bundled .env:', err.message);
        envPath = bundledEnvPath;
    }
}
else if (!fs_1.default.existsSync(envPath) && fs_1.default.existsSync(bundledEnvPath)) {
    envPath = bundledEnvPath;
}
dotenv_1.default.config({ path: envPath });
exports.MAX_FILES = 50;
exports.MAX_RECOVERY_MS = 30 * 60 * 1000;
exports.GIST_POLL_MS = 15 * 1000;
exports.GIST_ID = 'd273998b76b9ccd04d4ae4246d41aa44';
exports.GIST_API_URL = `https://api.github.com/gists/${exports.GIST_ID}`;
function getGithubToken() {
    return process.env.GITHUB_TOKEN || '';
}
