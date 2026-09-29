"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateMetadataCSV = generateMetadataCSV;
// CSV generator simplified — no longer reads from SQLite
function generateMetadataCSV() {
    return '"Filename","Title","Keywords","Category","Releases"';
}
