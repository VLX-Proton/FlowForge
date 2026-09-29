"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerWorkerRoutes = registerWorkerRoutes;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const gist_sync_1 = require("./gist-sync");
const health_1 = require("./health");
const APP_DATA_DIR = process.env.APP_DATA_DIR;
const WORKER_FILE = APP_DATA_DIR ? path_1.default.join(APP_DATA_DIR, 'data', 'worker.json') : path_1.default.join(process.cwd(), 'backend', 'data', 'worker.json');
function registerWorkerRoutes(app) {
    app.get('/api/worker-ready', async (req, res) => {
        const expectedUrl = req.query.url;
        if (!expectedUrl) {
            return res.status(400).json({ ready: false, reason: 'Missing url param' });
        }
        const latestUrl = await (0, gist_sync_1.syncWorkerUrl)();
        if (latestUrl !== expectedUrl) {
            return res.json({ ready: false, reason: 'URL mismatch — Gist not yet updated' });
        }
        const alive = await (0, health_1.isWorkerAlive)(latestUrl);
        if (!alive) {
            return res.json({ ready: false, reason: 'Worker not reachable yet' });
        }
        res.json({ ready: true, url: latestUrl });
    });
    app.post('/worker/update', (req, res) => {
        const url = req.body.workerUrl;
        if (typeof url !== 'string' || !url.startsWith('https://')) {
            return res.status(400).json({ error: 'Invalid workerUrl' });
        }
        fs_1.default.writeFileSync(WORKER_FILE, JSON.stringify({ workerUrl: req.body.workerUrl }, null, 2));
        console.log('Worker updated:', req.body.workerUrl);
        res.json({ success: true });
    });
    app.get('/worker', async (req, res) => {
        await (0, gist_sync_1.syncWorkerUrl)();
        const data = JSON.parse(fs_1.default.readFileSync(WORKER_FILE, 'utf8'));
        res.json(data);
    });
}
