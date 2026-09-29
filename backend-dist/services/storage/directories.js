"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupDirectory = cleanupDirectory;
exports.getFileExtension = getFileExtension;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
function cleanupDirectory(dir, maxFiles) {
    try {
        const files = fs_1.default.readdirSync(dir)
            .map(f => ({
            name: f,
            path: path_1.default.join(dir, f),
            mtime: fs_1.default.statSync(path_1.default.join(dir, f)).mtimeMs
        }))
            .sort((a, b) => a.mtime - b.mtime);
        while (files.length > maxFiles) {
            const oldest = files.shift();
            if (oldest) {
                fs_1.default.unlinkSync(oldest.path);
                console.log(`[CLEANUP] Removed old file: ${oldest.name}`);
            }
        }
    }
    catch (e) {
        // Directory may be empty or not exist
    }
}
function getFileExtension(filename) {
    return filename.split('.').pop()?.toLowerCase() || 'png';
}
