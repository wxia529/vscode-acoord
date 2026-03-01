import { Structure } from '../models/structure';
import {
  XYZParser,
  CIFParser,
  POSCARParser,
  GJFParser,
  ORCAParser,
  QEParser,
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
  in: new QEParser(),
  pwi: new QEParser(),
  out: new QEParser(),
  pwo: new QEParser(),
  log: new QEParser(),
  pdb: new PDBParser(),
  stru: new STRUParser(),
};

const READ_ONLY_FORMATS = new Set(['out', 'pwo', 'log']);

/**
 * Manage structure file I/O
 */
export class FileManager {
  private static readonly DEFAULT_NAME = 'Created by ACoord';

  /**
   * Load structure from file content
   */
  static loadStructure(
    filePath: string,
    content: string
  ): Structure {
    const structures = this.loadStructures(filePath, content);
    if (structures.length === 0) {
      throw new Error('No structure found in file');
    }
    return structures[0];
  }

  static loadStructures(
    filePath: string,
    content: string
  ): Structure[] {
    const ext = this.getFileExtension(filePath).toLowerCase();
    const parser = PARSER_MAP[ext];

    if (!parser) {
      throw new Error(`Unsupported file format: ${ext}`);
    }

    try {
      const structures = parser.parseTrajectory
        ? parser.parseTrajectory(content)
        : [parser.parse(content)];
      for (const structure of structures) {
        this.ensureStructureName(structure, filePath);
      }
      return structures;
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
    return this.saveStructures([structure], format);
  }

  static saveStructures(
    structures: Structure[],
    format: string
  ): string {
    if (!structures || structures.length === 0) {
      throw new Error('No structure available to save');
    }
    const ext = this.resolveFormat(format);
    const parser = PARSER_MAP[ext];

    if (!parser) {
      throw new Error(`Unsupported export format: ${ext}`);
    }
    if (READ_ONLY_FORMATS.has(ext)) {
      throw new Error(`Unsupported export format: ${ext}`);
    }

    if (structures.length > 1 && parser.serializeTrajectory) {
      return parser.serializeTrajectory(structures);
    }

    return parser.serialize(structures[0]);
  }

  static ensureStructureName(structure: Structure, filePath?: string) {
    const current = (structure.name || '').trim();
    if (current) {
      return;
    }

    structure.name = this.DEFAULT_NAME;
  }

  /**
   * Get supported formats
   */
  static getSupportedFormats(): string[] {
    return Object.keys(PARSER_MAP).filter((format) => !READ_ONLY_FORMATS.has(format));
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
