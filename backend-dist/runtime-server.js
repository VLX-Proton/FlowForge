"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const multer_1 = __importDefault(require("multer"));
const { handleMetadataRequest } = require('./services/metadata');
const { registerUpscaleRoutes } = require('./services/upscale/routes');
const { registerJobRoutes } = require('./services/jobs/routes');
const { registerWorkerRoutes } = require('./services/worker/routes');
const { registerStorageRoutes } = require('./services/storage/routes');
const { registerKeysRoutes } = require('./services/keys/routes');
const { runStartup } = require('./services/startup/init');
const APP_DATA_DIR = process.env.APP_DATA_DIR;
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});
let healthLoggerState = 'unknown';
app.get('/api/health', (_req, res) => {
    if (healthLoggerState !== 'connected') {
        console.log('[HEALTH] Backend connected');
        healthLoggerState = 'connected';
    }
    res.json({ ready: true });
});
app.post('/api/health/log', (req, res) => {
    const { event } = req.body || {};
    if (event === 'disconnected') {
        console.log('[HEALTH] Backend disconnected');
        healthLoggerState = 'unknown';
    }
    else if (event === 'reconnected') {
        console.log('[HEALTH] Backend reconnected');
    }
    res.json({ success: true });
});
const DATA_DIR = APP_DATA_DIR ? path_1.default.join(APP_DATA_DIR, 'data') : path_1.default.join(__dirname, 'data');
const JOB_DIR = APP_DATA_DIR ? path_1.default.join(APP_DATA_DIR, 'jobs') : path_1.default.join(__dirname, 'jobs');
const INPUT_DIR = APP_DATA_DIR ? path_1.default.join(APP_DATA_DIR, 'inputs') : path_1.default.join(__dirname, 'inputs');
const OUTPUT_DIR = APP_DATA_DIR ? path_1.default.join(APP_DATA_DIR, 'outputs') : path_1.default.join(__dirname, 'outputs');
const WORKER_FILE = path_1.default.join(DATA_DIR, 'worker.json');
[DATA_DIR, JOB_DIR, INPUT_DIR, OUTPUT_DIR].forEach((dir) => {
    if (!fs_1.default.existsSync(dir))
        fs_1.default.mkdirSync(dir, { recursive: true });
});
if (!fs_1.default.existsSync(WORKER_FILE)) {
    fs_1.default.writeFileSync(WORKER_FILE, JSON.stringify({ workerUrl: '' }, null, 2));
}
const upload = (0, multer_1.default)({
    limits: { fileSize: 200 * 1024 * 1024 },
    storage: multer_1.default.diskStorage({
        destination: (req, file, cb) => {
            cb(null, INPUT_DIR);
        },
        filename: (req, file, cb) => {
            cb(null, file.originalname);
        }
    })
});
app.use((req, res, next) => {
    const url = req.url;
    if (!url.startsWith('/api/health')) {
        console.log(`[BACKEND] Request: ${req.method} ${req.url}`);
    }
    next();
});
app.post('/api/metadata', upload.single('file'), handleMetadataRequest);
registerUpscaleRoutes(app, upload);
registerJobRoutes(app);
registerWorkerRoutes(app);
registerStorageRoutes(app);
registerKeysRoutes(app);
const webDist = path_1.default.join(__dirname, '../apps/web/dist-web');
const electronDist = path_1.default.join(__dirname, '../apps/web/dist');
const frontendPath = fs_1.default.existsSync(webDist) ? webDist : electronDist;
app.use(express_1.default.static(frontendPath));
app.get('*', (req, res) => {
    if (!req.url.startsWith('/api')) {
        res.sendFile(path_1.default.join(frontendPath, 'index.html'));
    }
});
const PORT = process.env.PORT || 4000;
app.listen(PORT, async () => {
    console.log(`Runtime server running on port ${PORT}`);
    await runStartup();
});
