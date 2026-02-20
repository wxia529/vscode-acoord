"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileManager = void 0;
const parsers_1 = require("./parsers");
/**
 * File extension to parser mapping
 */
const PARSER_MAP = {
    xyz: new parsers_1.XYZParser(),
    cif: new parsers_1.CIFParser(),
    poscar: new parsers_1.POSCARParser(),
    vasp: new parsers_1.POSCARParser(),
    gjf: new parsers_1.GJFParser(),
    com: new parsers_1.GJFParser(),
    inp: new parsers_1.ORCAParser(),
    pdb: new parsers_1.PDBParser(),
    stru: new parsers_1.STRUParser(),
};
/**
 * Manage structure file I/O
 */
class FileManager {
    /**
     * Load structure from file content
     */
    static loadStructure(filePath, content) {
        const ext = this.getFileExtension(filePath).toLowerCase();
        const parser = PARSER_MAP[ext];
        if (!parser) {
            throw new Error(`Unsupported file format: ${ext}`);
        }
        try {
            return parser.parse(content);
        }
        catch (error) {
            throw new Error(`Failed to parse ${ext} file: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Save structure to file content
     */
    static saveStructure(structure, format) {
        const ext = this.resolveFormat(format);
        const parser = PARSER_MAP[ext];
        if (!parser) {
            throw new Error(`Unsupported export format: ${ext}`);
        }
        return parser.serialize(structure);
    }
    /**
     * Get supported formats
     */
    static getSupportedFormats() {
        return Object.keys(PARSER_MAP);
    }
    /**
     * Resolve a format string or file path into a supported format
     */
    static resolveFormat(input, fallback = 'xyz') {
        const trimmed = (input || '').trim();
        if (!trimmed) {
            return fallback;
        }
        const ext = this.getFileExtension(trimmed).toLowerCase();
        if (ext) {
            return ext;
        }
        const lowered = trimmed.toLowerCase();
        if (PARSER_MAP[lowered]) {
            return lowered;
        }
        return fallback;
    }
    /**
     * Get file extension
     */
    static getFileExtension(filePath) {
        const parts = filePath.split('.');
        if (parts.length > 1) {
            return parts[parts.length - 1];
        }
        const baseName = filePath.split(/[/\\]/).pop() || '';
        const upper = baseName.toUpperCase();
        if (upper === 'POSCAR' || upper === 'CONTCAR') {
            return 'poscar';
        }
        if (upper === 'STRU') {
            return 'stru';
        }
        return '';
    }
}
exports.FileManager = FileManager;
//# sourceMappingURL=fileManager.js.map