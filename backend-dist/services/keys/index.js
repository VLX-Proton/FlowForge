"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getKeys = getKeys;
exports.addKey = addKey;
exports.removeKey = removeKey;
exports.getNextKey = getNextKey;
exports.getRotationState = getRotationState;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const APP_DATA_DIR = process.env.APP_DATA_DIR;
const KEYS_FILE = APP_DATA_DIR ? path_1.default.join(APP_DATA_DIR, 'data', 'api-keys.json') : path_1.default.join(process.cwd(), 'backend', 'data', 'api-keys.json');
function readKeysFile() {
    if (!fs_1.default.existsSync(KEYS_FILE)) {
        return { gemini: [], openrouter: [], mistral: [] };
    }
    return JSON.parse(fs_1.default.readFileSync(KEYS_FILE, 'utf8'));
}
function writeKeysFile(data) {
    fs_1.default.writeFileSync(KEYS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}
function getKeys(provider) {
    const data = readKeysFile();
    return data[provider] || [];
}
function addKey(provider, apiKey) {
    const data = readKeysFile();
    if (!data[provider])
        data[provider] = [];
    data[provider].push(apiKey);
    writeKeysFile(data);
}
function removeKey(provider, index) {
    const data = readKeysFile();
    if (!data[provider])
        return;
    data[provider].splice(index, 1);
    writeKeysFile(data);
}
function getNextKey(provider) {
    const keys = getKeys(provider);
    if (keys.length === 0)
        return null;
    const stateFile = APP_DATA_DIR ? path_1.default.join(APP_DATA_DIR, 'data', 'key-rotation-state.json') : path_1.default.join(process.cwd(), 'backend', 'data', 'key-rotation-state.json');
    let state = {};
    if (fs_1.default.existsSync(stateFile)) {
        state = JSON.parse(fs_1.default.readFileSync(stateFile, 'utf8'));
    }
    const currentIndex = state[provider] || 0;
    const nextIndex = currentIndex % keys.length;
    state[provider] = (currentIndex + 1) % keys.length;
    fs_1.default.writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf-8');
    return keys[nextIndex] || null;
}
function getRotationState(provider) {
    const stateFile = APP_DATA_DIR ? path_1.default.join(APP_DATA_DIR, 'data', 'key-rotation-state.json') : path_1.default.join(process.cwd(), 'backend', 'data', 'key-rotation-state.json');
    let state = {};
    if (fs_1.default.existsSync(stateFile)) {
        state = JSON.parse(fs_1.default.readFileSync(stateFile, 'utf8'));
    }
    const keys = getKeys(provider);
    return {
        current: state[provider] || 0,
        total: keys.length,
    };
}
