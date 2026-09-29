"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerUpscaleRoutes = registerUpscaleRoutes;
const handler_1 = require("./handler");
function registerUpscaleRoutes(app, upload) {
    app.post('/api/upscale', upload.array('files'), handler_1.handleUpscaleRequest);
}
