import { Structure } from '../models/structure.js';
import {
  XYZParser,
  CIFParser,
  POSCARParser,
  GJFParser,
  ORCAParser,
  QEParser,
  XDATCARParser,
  OUTCARParser,
  PDBParser,
  STRUParser,
  ACoordParser,
  CellParser,
  CastepParser,
  StructureParser,
} from './parsers/index.js';

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
  pwo: new QEParser(),
  xdatcar: new XDATCARParser(),
  outcar: new OUTCARParser(),
  pdb: new PDBParser(),
  stru: new STRUParser(),
  acoord: new ACoordParser(),
  cell: new CellParser(),
  castep: new CastepParser(),
};

const READ_ONLY_FORMATS = new Set(['out', 'pwo', 'log', 'outcar', 'castep']);

/**
 * Manage structure file I/O
 */
export class FileManager {
  private static readonly DEFAULT_NAME = 'Created by ACoord';

  static isReadOnlyFormat(filePath: string): boolean {
    const ext = this.getFileExtension(filePath).toLowerCase();
    return READ_ONLY_FORMATS.has(ext);
  }

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
    const parser = this.selectParser(filePath, content);

    if (!parser) {
      throw new Error(`Unsupported file format: ${ext}`);
    }

    try {
      const structures = parser.parseTrajectory(content);
      for (const structure of structures) {
        this.ensureStructureName(structure, filePath);
      }
      return structures;
    } catch (error) {
      throw new Error(`Failed to parse ${ext} file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private static selectParser(filePath: string, content: string): StructureParser | null {
    const ext = this.getFileExtension(filePath).toLowerCase();

    const directParser = PARSER_MAP[ext];
    if (directParser) {
      return directParser;
    }

    if (ext === 'out' || ext === 'log') {
      const parsersToTry: StructureParser[] = [
        PARSER_MAP['in'],
        PARSER_MAP['inp'],
        PARSER_MAP['gjf'],
      ].filter((parser): parser is StructureParser => parser !== undefined);

      for (const parser of parsersToTry) {
        try {
          const result = parser.parseTrajectory(content);
          if (result && result.length > 0) {
            return parser;
          }
        } catch {
          continue;
        }
      }
    }

    return null;
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

    return parser.serializeTrajectory(structures);
  }

  static ensureStructureName(structure: Structure, _filePath?: string) {
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
    const baseName = filePath.split(/[/\\]/).pop() || '';
    const dotIndex = baseName.lastIndexOf('.');
    
    if (dotIndex > 0 && dotIndex < baseName.length - 1) {
      return baseName.slice(dotIndex + 1).toLowerCase();
    }
    
    const upper = baseName.toUpperCase();
    
    if (upper.includes('STRU')) {
      return 'stru';
    }
    if (upper.includes('OUTCAR')) {
      return 'outcar';
    }
    if (upper.includes('XDATCAR')) {
      return 'xdatcar';
    }
    if (upper.includes('POSCAR') || upper.includes('CONTCAR')) {
      return 'poscar';
    }
    
    return '';
  }
}
