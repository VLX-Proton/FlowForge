"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isWorkerAlive = isWorkerAlive;
const axios_1 = __importDefault(require("axios"));
async function isWorkerAlive(url) {
    try {
        const resp = await axios_1.default.get(`${url}/health`, { timeout: 8000 });
        return resp.status === 200;
    }
    catch {
        return false;
    }
}
