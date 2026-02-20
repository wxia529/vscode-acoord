import { Structure } from '../models/structure';
import {
  XYZParser,
  CIFParser,
  POSCARParser,
  GJFParser,
  ORCAParser,
  PDBParser,
  STRUParser,
  StructureParser,
} from './parsers';

/**
 * File extension to parser mapping
 */
const PARSER_MAP: Record<string, StructureParser> = {
  xyz: new XYZParser(),
  cif: new CIFParser(),
  poscar: new POSCARParser(),
  vasp: new POSCARParser(),
  gjf: new GJFParser(),
  com: new GJFParser(),
  inp: new ORCAParser(),
  pdb: new PDBParser(),
  stru: new STRUParser(),
};

/**
 * Manage structure file I/O
 */
export class FileManager {
  /**
   * Load structure from file content
   */
  static loadStructure(
    filePath: string,
    content: string
  ): Structure {
    const ext = this.getFileExtension(filePath).toLowerCase();
    const parser = PARSER_MAP[ext];

    if (!parser) {
      throw new Error(`Unsupported file format: ${ext}`);
    }

    try {
      return parser.parse(content);
    } catch (error) {
      throw new Error(`Failed to parse ${ext} file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Save structure to file content
   */
  static saveStructure(
    structure: Structure,
    format: string
  ): string {
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
  static getSupportedFormats(): string[] {
    return Object.keys(PARSER_MAP);
  }

  /**
   * Resolve a format string or file path into a supported format
   */
  static resolveFormat(input: string, fallback: string = 'xyz'): string {
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
  private static getFileExtension(filePath: string): string {
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
