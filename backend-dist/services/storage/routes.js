"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerStorageRoutes = registerStorageRoutes;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const job_store_1 = require("../jobs/job-store");
const APP_DATA_DIR = process.env.APP_DATA_DIR;
const OUTPUT_DIR = APP_DATA_DIR ? path_1.default.join(APP_DATA_DIR, 'outputs') : path_1.default.join(process.cwd(), 'backend', 'outputs');
function registerStorageRoutes(app) {
    app.get('/api/download/:id', (req, res) => {
        const job = (0, job_store_1.loadJob)(req.params.id);
        if (!job) {
            return res.status(404).end();
        }
        if (job.status !== 'completed') {
            return res.status(400).json({ success: false });
        }
        const index = req.query.index ? parseInt(req.query.index) : 0;
        const resultPath = job.outputPaths?.[index] || job.outputPaths?.[0];
        if (!resultPath) {
            return res.status(404).end();
        }
        res.download(resultPath);
    });
    app.get('/api/outputs/:filename', (req, res) => {
        const filename = path_1.default.basename(req.params.filename);
        const filePath = path_1.default.join(OUTPUT_DIR, filename);
        if (!filePath.startsWith(OUTPUT_DIR)) {
            return res.status(403).end();
        }
        if (!fs_1.default.existsSync(filePath)) {
            return res.status(404).json({ success: false, error: 'File not found' });
        }
        res.sendFile(filePath);
    });
}
