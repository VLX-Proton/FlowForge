"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerKeysRoutes = registerKeysRoutes;
const index_1 = require("./index");
function registerKeysRoutes(app) {
    app.get('/api/keys/:provider', (req, res) => {
        const { provider } = req.params;
        const keys = (0, index_1.getKeys)(provider);
        const rotation = (0, index_1.getRotationState)(provider);
        res.json({ keys, rotation });
    });
    app.post('/api/keys/:provider', (req, res) => {
        const { provider } = req.params;
        const { apiKey } = req.body;
        if (!apiKey || typeof apiKey !== 'string') {
            return res.status(400).json({ error: 'apiKey is required' });
        }
        (0, index_1.addKey)(provider, apiKey.trim());
        res.json({ success: true });
    });
    app.delete('/api/keys/:provider/:index', (req, res) => {
        const { provider, index } = req.params;
        if (!/^[0-9]+$/.test(index)) {
            return res.status(400).json({ error: 'Invalid index' });
        }
        const idx = parseInt(index, 10);
        if (isNaN(idx)) {
            return res.status(400).json({ error: 'Invalid index' });
        }
        (0, index_1.removeKey)(provider, idx);
        res.json({ success: true });
    });
    app.get('/api/keys/:provider/next', (req, res) => {
        const { provider } = req.params;
        const key = (0, index_1.getNextKey)(provider);
        if (!key) {
            return res.status(404).json({ error: 'No keys available for provider' });
        }
        res.json({ apiKey: key });
    });
}
