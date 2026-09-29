"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncWorkerUrl = syncWorkerUrl;
const axios_1 = __importDefault(require("axios"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const constants_1 = require("../shared/constants");
const GITHUB_TOKEN = (0, constants_1.getGithubToken)();
const APP_DATA_DIR = process.env.APP_DATA_DIR;
const WORKER_FILE = APP_DATA_DIR ? path_1.default.join(APP_DATA_DIR, 'data', 'worker.json') : path_1.default.join(process.cwd(), 'backend', 'data', 'worker.json');
async function syncWorkerUrl() {
    try {
        const response = await axios_1.default.get(`${constants_1.GIST_API_URL}?t=${Date.now()}`, {
            headers: {
                Authorization: `Bearer ${GITHUB_TOKEN}`,
                'User-Agent': 'NodeJS-Gist-App',
                Accept: 'application/vnd.github+json'
            }
        });
        const colabUrl = response.data.files['hypir_url.txt'].content.trim();
        let oldUrl = '';
        try {
            if (fs_1.default.existsSync(WORKER_FILE)) {
                oldUrl = JSON.parse(fs_1.default.readFileSync(WORKER_FILE, 'utf8')).workerUrl;
            }
        }
        catch (e) { }
        if (colabUrl && colabUrl.startsWith('https://')) {
            fs_1.default.writeFileSync(WORKER_FILE, JSON.stringify({ workerUrl: colabUrl }, null, 2));
            if (oldUrl !== colabUrl) {
                console.log('[OTOMATIS] URL Worker tersinkronisasi dari API Gist:', colabUrl);
            }
            return colabUrl;
        }
    }
    catch (error) {
        console.error('[ERROR] Gagal mengambil URL dari GitHub API:', error.message);
    }
    const dataLama = JSON.parse(fs_1.default.readFileSync(WORKER_FILE, 'utf8'));
    return dataLama.workerUrl;
}
