"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerJobRoutes = registerJobRoutes;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const APP_DATA_DIR = process.env.APP_DATA_DIR;
const JOB_DIR = APP_DATA_DIR ? path_1.default.join(APP_DATA_DIR, 'jobs') : path_1.default.join(process.cwd(), 'backend', 'jobs');
function registerJobRoutes(app) {
    app.get('/api/job/:id', (req, res) => {
        if (!/^[0-9a-f-]{36}$/.test(req.params.id)) {
            return res.status(400).json({ error: 'Invalid job id' });
        }
        const file = path_1.default.join(JOB_DIR, `${req.params.id}.json`);
        if (!fs_1.default.existsSync(file)) {
            return res.status(404).json({ success: false });
        }
        const job = JSON.parse(fs_1.default.readFileSync(file, 'utf8'));
        console.log(`[BACKEND] Serving job ${req.params.id}: progress=${job.currentFileProgress}, status=${job.status}`);
        res.json(job);
    });
    app.delete('/api/job/:id/cancel', (req, res) => {
        if (!/^[0-9a-f-]{36}$/.test(req.params.id)) {
            return res.status(400).json({ error: 'Invalid job id' });
        }
        const file = path_1.default.join(JOB_DIR, `${req.params.id}.json`);
        if (!fs_1.default.existsSync(file)) {
            return res.status(404).json({ success: false, reason: 'Job not found' });
        }
        const job = JSON.parse(fs_1.default.readFileSync(file, 'utf8'));
        job.status = 'cancelled';
        job.error = 'Cancelled by user';
        fs_1.default.writeFileSync(file, JSON.stringify(job, null, 2));
        console.log(`[BACKEND] Marked job ${req.params.id} as cancelled`);
        res.json({ success: true });
    });
}
