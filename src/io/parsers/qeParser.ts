import { Structure } from '../../models/structure';
import { Atom } from '../../models/atom';
import { UnitCell } from '../../models/unitCell';
import { ELEMENT_DATA, parseElement } from '../../utils/elementData';
import { StructureParser } from './structureParser';

type QEUnit = 'angstrom' | 'bohr' | 'alat' | 'crystal';

interface ParsedAtom {
  element: string;
  position: [number, number, number];
  fixed: boolean;
}

interface ParsedCellBlock {
  vectors: number[][];
  nextIndex: number;
  alatFromHeader: number | null;
}

interface ParsedPositionsBlock {
  atoms: ParsedAtom[];
  nextIndex: number;
}

const BOHR_TO_ANGSTROM = 0.529177210903;

/**
 * Quantum ESPRESSO parser (.in/.pwi input, .out/.pwo log output)
 * - parse: supports pw.x input and output coordinates/cell
 * - serialize: writes pw.x input format
 */
export class QEParser implements StructureParser {
  parse(content: string): Structure {
    const frames = this.parseTrajectory(content);
    if (frames.length === 0) {
      throw new Error('Invalid QE content: no structure found');
    }
    return frames[frames.length - 1];
  }

  parseTrajectory(content: string): Structure[] {
    const lines = content.split(/\r?\n/);
    if (this.looksLikeQeOutput(lines)) {
      return this.parseOutputTrajectory(lines);
    }
    if (this.looksLikeQeInput(lines)) {
      return [this.parseInput(lines)];
    }
    return this.parseOutputTrajectory(lines);
  }

  serialize(structure: Structure): string {
    if (structure.atoms.length === 0) {
      throw new Error('Cannot write QE input: structure has no atoms');
    }

    const lines: string[] = [];
    const prefixRaw = (structure.name || 'structure').trim() || 'structure';
    const prefix = prefixRaw.replace(/\s+/g, '_');

    const speciesOrder: string[] = [];
    for (const atom of structure.atoms) {
      if (!speciesOrder.includes(atom.element)) {
        speciesOrder.push(atom.element);
      }
    }

    const vectors = structure.unitCell
      ? structure.unitCell.getLatticeVectors()
      : [
        [20, 0, 0],
        [0, 20, 0],
        [0, 0, 20],
      ];

    const hasFixedFlags = structure.atoms.some((atom) => atom.fixed);

    lines.push('&CONTROL');
    lines.push(`  calculation = 'scf'`);
    lines.push(`  prefix = '${prefix}'`);
    lines.push('/');
    lines.push('&SYSTEM');
    lines.push('  ibrav = 0');
    lines.push(`  nat = ${structure.atoms.length}`);
    lines.push(`  ntyp = ${speciesOrder.length}`);
    lines.push('  ecutwfc = 50');
    lines.push('/');
    lines.push('&ELECTRONS');
    lines.push('  conv_thr = 1.0d-8');
    lines.push('/');
    lines.push('CELL_PARAMETERS angstrom');
    for (const vec of vectors) {
      lines.push(`${vec[0].toFixed(10)}  ${vec[1].toFixed(10)}  ${vec[2].toFixed(10)}`);
    }
    lines.push('ATOMIC_SPECIES');
    for (const symbol of speciesOrder) {
      const mass = ELEMENT_DATA[symbol]?.atomicMass ?? 1;
      lines.push(`${symbol}  ${mass.toFixed(6)}  ${symbol}.UPF`);
    }
    lines.push('ATOMIC_POSITIONS angstrom');
    for (const atom of structure.atoms) {
      const base = `${atom.element}  ${atom.x.toFixed(10)}  ${atom.y.toFixed(10)}  ${atom.z.toFixed(10)}`;
      if (hasFixedFlags) {
        lines.push(`${base}  ${atom.fixed ? '0 0 0' : '1 1 1'}`);
      } else {
        lines.push(base);
      }
    }
    lines.push('K_POINTS gamma');

    return lines.join('\n');
  }

  private looksLikeQeInput(lines: string[]): boolean {
    const hasNamelist = lines.some((line) =>
      /^\s*&(?:CONTROL|SYSTEM|ELECTRONS|IONS|CELL)\b/i.test(line)
    );
    if (hasNamelist) {
      return true;
    }
    const hasSpecies = lines.some((line) => /^\s*ATOMIC_SPECIES\b/i.test(line));
    const hasPositions = lines.some((line) => /^\s*ATOMIC_POSITIONS\b/i.test(line));
    return hasSpecies && hasPositions;
  }

  private looksLikeQeOutput(lines: string[]): boolean {
    return lines.some((line) =>
      /Program PWSCF/i.test(line) ||
      /number of atoms\/cell/i.test(line) ||
      /crystal axes:/i.test(line) ||
      /End final coordinates/i.test(line)
    );
  }

  private parseInput(lines: string[]): Structure {
    const nat = this.extractNat(lines);
    const alat = this.extractAlat(lines);
    const name = this.extractPrefix(lines) || '';
    const structure = new Structure(name);

    let cellVectors: number[][] | null = null;
    let atoms: ParsedAtom[] = [];

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (!trimmed) {
        continue;
      }
      if (/^CELL_PARAMETERS\b/i.test(trimmed)) {
        const block = this.parseCellBlock(lines, i, alat);
        if (block) {
          cellVectors = block.vectors;
          i = block.nextIndex - 1;
        }
        continue;
      }
      if (/^ATOMIC_POSITIONS\b/i.test(trimmed)) {
        const block = this.parsePositionsBlock(lines, i, cellVectors, alat, nat);
        if (block.atoms.length > 0) {
          atoms = block.atoms;
        }
        i = block.nextIndex - 1;
      }
    }

    if (atoms.length === 0) {
      throw new Error('Invalid QE input: missing ATOMIC_POSITIONS');
    }

    if (cellVectors) {
      structure.unitCell = this.unitCellFromVectors(cellVectors);
      structure.isCrystal = true;
    }

    for (const item of atoms) {
      const atom = new Atom(item.element, item.position[0], item.position[1], item.position[2]);
      atom.fixed = item.fixed;
      structure.addAtom(atom);
    }

    return structure;
  }

  private parseOutput(lines: string[]): Structure {
    const frames = this.parseOutputTrajectory(lines);
    if (frames.length === 0) {
      throw new Error('Invalid QE output log: no atom positions found');
    }
    return frames[frames.length - 1];
  }

  private parseOutputTrajectory(lines: string[]): Structure[] {
    const nat = this.extractNat(lines);
    let alat = this.extractAlat(lines);

    let currentCellVectors: number[][] | null = null;
    let lastCellVectors: number[][] | null = null;
    const frames: Structure[] = [];

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (!trimmed) {
        continue;
      }

      const alatLine = this.parseAlatFromLine(trimmed);
      if (this.isPositiveNumber(alatLine)) {
        alat = alatLine;
      }

      if (/crystal axes:/i.test(trimmed)) {
        const crystalAxes = this.parseCrystalAxesBlock(lines, i, alat);
        if (crystalAxes) {
          currentCellVectors = crystalAxes;
          if (!lastCellVectors) {
            lastCellVectors = crystalAxes;
          }
        }
        continue;
      }

      if (/^CELL_PARAMETERS\b/i.test(trimmed)) {
        const block = this.parseCellBlock(lines, i, alat);
        if (block) {
          currentCellVectors = block.vectors;
          lastCellVectors = block.vectors;
          if (this.isPositiveNumber(block.alatFromHeader)) {
            alat = block.alatFromHeader;
          }
          i = block.nextIndex - 1;
        }
        continue;
      }

      if (/^ATOMIC_POSITIONS\b/i.test(trimmed)) {
        const block = this.parsePositionsBlock(lines, i, currentCellVectors, alat, nat);
        if (block.atoms.length > 0) {
          const frameCell: number[][] | null = currentCellVectors || lastCellVectors;
          frames.push(this.buildStructureFromParsedAtoms(block.atoms, frameCell));
          if (frameCell) {
            lastCellVectors = frameCell;
          }
        }
        i = block.nextIndex - 1;
        continue;
      }

      if (/positions \(alat units\)/i.test(trimmed)) {
        const parsed = this.parseTauPositionsBlock(lines, i, alat, nat);
        if (parsed.length > 0) {
          const frameCell: number[][] | null = currentCellVectors || lastCellVectors;
          frames.push(this.buildStructureFromParsedAtoms(parsed, frameCell));
        }
      }
    }

    if (frames.length === 0) {
      throw new Error('Invalid QE output log: no atom positions found');
    }
    return frames;
  }

  private buildStructureFromParsedAtoms(atoms: ParsedAtom[], cellVectors: number[][] | null): Structure {
    const structure = new Structure('');
    if (cellVectors) {
      structure.unitCell = this.unitCellFromVectors(cellVectors);
      structure.isCrystal = true;
    }
    for (const item of atoms) {
      const atom = new Atom(item.element, item.position[0], item.position[1], item.position[2]);
      atom.fixed = item.fixed;
      structure.addAtom(atom);
    }
    return structure;
  }

  private parseCellBlock(lines: string[], startIndex: number, fallbackAlat: number | null): ParsedCellBlock | null {
    const header = lines[startIndex] || '';
    const unit = this.detectCellUnit(header);
    const alatFromHeader = this.parseAlatFromCellHeader(header);
    const alat = this.isPositiveNumber(alatFromHeader) ? alatFromHeader : fallbackAlat;
    const factor = this.cellUnitToFactor(unit, alat);

    const vectors: number[][] = [];
    let i = startIndex + 1;
    while (i < lines.length && vectors.length < 3) {
      const trimmed = lines[i].trim();
      if (!trimmed) {
        i++;
        continue;
      }
      const values = trimmed.split(/\s+/).slice(0, 3).map((value) => this.parseNumber(value));
      if (values.length < 3 || values.some((value) => !Number.isFinite(value))) {
        break;
      }
      vectors.push([values[0] * factor, values[1] * factor, values[2] * factor]);
      i++;
    }

    if (vectors.length !== 3) {
      return null;
    }

    return {
      vectors,
      nextIndex: i,
      alatFromHeader: this.isPositiveNumber(alatFromHeader) ? alatFromHeader : null,
    };
  }

  private parsePositionsBlock(
    lines: string[],
    startIndex: number,
    cellVectors: number[][] | null,
    alat: number | null,
    nAtoms: number | null
  ): ParsedPositionsBlock {
    const unit = this.detectPositionUnit(lines[startIndex] || '');
    const atoms: ParsedAtom[] = [];
    let i = startIndex + 1;

    while (i < lines.length) {
      const trimmed = lines[i].trim();
      if (!trimmed) {
        if (atoms.length > 0) {
          i++;
          break;
        }
        i++;
        continue;
      }

      const parsed = this.parseAtomicPositionLine(trimmed);
      if (!parsed) {
        if (atoms.length > 0) {
          break;
        }
        i++;
        continue;
      }

      const position = this.toCartesian(parsed.position, unit, cellVectors, alat);
      if (!position) {
        i++;
        continue;
      }

      atoms.push({
        element: parsed.element,
        position,
        fixed: parsed.fixed,
      });

      i++;
      if (nAtoms && atoms.length >= nAtoms) {
        break;
      }
    }

    return { atoms, nextIndex: i };
  }

  private parseAtomicPositionLine(line: string): ParsedAtom | null {
    if (!line || line.startsWith('#') || line.startsWith('!')) {
      return null;
    }
    const parts = line.split(/\s+/);
    if (parts.length < 4) {
      return null;
    }

    const element = this.labelToSymbol(parts[0]);
    if (!element) {
      return null;
    }
    const x = this.parseNumber(parts[1]);
    const y = this.parseNumber(parts[2]);
    const z = this.parseNumber(parts[3]);
    if (![x, y, z].every((value) => Number.isFinite(value))) {
      return null;
    }

    let fixed = false;
    if (parts.length >= 7) {
      const flags = parts.slice(4, 7).map((value) => parseInt(value, 10));
      if (flags.every((value) => value === 0 || value === 1)) {
        fixed = flags[0] === 0 && flags[1] === 0 && flags[2] === 0;
      }
    }

    return {
      element,
      position: [x, y, z],
      fixed,
    };
  }

  private parseTauPositionsBlock(
    lines: string[],
    startIndex: number,
    alat: number | null,
    nAtoms: number | null
  ): ParsedAtom[] {
    if (!this.isPositiveNumber(alat)) {
      return [];
    }
    const atoms: ParsedAtom[] = [];
    const pattern =
      /^\s*\d+\s+(\S+)\s+tau\(\s*\d+\)\s*=\s*\(\s*(\S+)\s+(\S+)\s+(\S+)\s*\)/i;

    for (let i = startIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(pattern);
      if (!match) {
        if (atoms.length > 0) {
          break;
        }
        continue;
      }

      const element = this.labelToSymbol(match[1]);
      if (!element) {
        continue;
      }
      const x = this.parseNumber(match[2]);
      const y = this.parseNumber(match[3]);
      const z = this.parseNumber(match[4]);
      if (![x, y, z].every((value) => Number.isFinite(value))) {
        continue;
      }
      atoms.push({
        element,
        position: [x * alat, y * alat, z * alat],
        fixed: false,
      });
      if (nAtoms && atoms.length >= nAtoms) {
        break;
      }
    }
    return atoms;
  }

  private parseCrystalAxesBlock(lines: string[], startIndex: number, alat: number | null): number[][] | null {
    if (!this.isPositiveNumber(alat)) {
      return null;
    }
    if (startIndex + 3 >= lines.length) {
      return null;
    }
    const vectors: number[][] = [];
    for (let i = 1; i <= 3; i++) {
      const values = (lines[startIndex + i] || '')
        .match(/[+-]?\d*\.?\d+(?:[eEdD][+-]?\d+)?/g)
        ?.map((value) => this.parseNumber(value))
        .filter((value) => Number.isFinite(value)) || [];
      if (values.length < 3) {
        return null;
      }
      const tail = values.slice(values.length - 3);
      vectors.push([tail[0] * alat, tail[1] * alat, tail[2] * alat]);
    }
    return vectors;
  }

  private toCartesian(
    value: [number, number, number],
    unit: QEUnit,
    cellVectors: number[][] | null,
    alat: number | null
  ): [number, number, number] | null {
    if (unit === 'angstrom') {
      return value;
    }
    if (unit === 'bohr') {
      return [
        value[0] * BOHR_TO_ANGSTROM,
        value[1] * BOHR_TO_ANGSTROM,
        value[2] * BOHR_TO_ANGSTROM,
      ];
    }
    if (unit === 'alat') {
      if (!this.isPositiveNumber(alat)) {
        return null;
      }
      return [value[0] * alat, value[1] * alat, value[2] * alat];
    }
    if (!cellVectors) {
      return null;
    }
    return [
      value[0] * cellVectors[0][0] + value[1] * cellVectors[1][0] + value[2] * cellVectors[2][0],
      value[0] * cellVectors[0][1] + value[1] * cellVectors[1][1] + value[2] * cellVectors[2][1],
      value[0] * cellVectors[0][2] + value[1] * cellVectors[1][2] + value[2] * cellVectors[2][2],
    ];
  }

  private detectPositionUnit(header: string): QEUnit {
    const lower = header.toLowerCase();
    if (lower.includes('crystal')) {
      return 'crystal';
    }
    if (lower.includes('bohr')) {
      return 'bohr';
    }
    if (lower.includes('alat')) {
      return 'alat';
    }
    return 'angstrom';
  }

  private detectCellUnit(header: string): QEUnit {
    const lower = header.toLowerCase();
    if (lower.includes('bohr')) {
      return 'bohr';
    }
    if (lower.includes('angstrom')) {
      return 'angstrom';
    }
    if (lower.includes('alat')) {
      return 'alat';
    }
    return 'bohr';
  }

  private cellUnitToFactor(unit: QEUnit, alat: number | null): number {
    if (unit === 'angstrom') {
      return 1;
    }
    if (unit === 'bohr') {
      return BOHR_TO_ANGSTROM;
    }
    if (this.isPositiveNumber(alat)) {
      return alat;
    }
    return BOHR_TO_ANGSTROM;
  }

  private extractNat(lines: string[]): number | null {
    const text = lines.join('\n');
    const fromNamelist = text.match(/\bnat\s*=\s*(\d+)/i);
    if (fromNamelist) {
      return parseInt(fromNamelist[1], 10);
    }
    for (const line of lines) {
      const match = line.match(/number of atoms\/cell\s*=\s*(\d+)/i);
      if (match) {
        return parseInt(match[1], 10);
      }
    }
    return null;
  }

  private extractPrefix(lines: string[]): string | null {
    for (const line of lines) {
      const stripped = line.split('!')[0];
      const match = stripped.match(/\bprefix\s*=\s*['"]?([^'",\s]+)/i);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  }

  private extractAlat(lines: string[]): number | null {
    for (const line of lines) {
      const fromCellHeader = this.parseAlatFromCellHeader(line);
      if (this.isPositiveNumber(fromCellHeader)) {
        return fromCellHeader;
      }
      const fromLine = this.parseAlatFromLine(line);
      if (this.isPositiveNumber(fromLine)) {
        return fromLine;
      }
      const stripped = line.split('!')[0];
      const aMatch = stripped.match(/(^|,)\s*A\s*=\s*([+-]?\d*\.?\d+(?:[eEdD][+-]?\d+)?)/);
      if (aMatch && aMatch[2]) {
        const parsed = this.parseNumber(aMatch[2]);
        if (Number.isFinite(parsed) && parsed > 0) {
          return parsed;
        }
      }
    }
    return null;
  }

  private parseAlatFromLine(line: string): number | null {
    const match = line.match(/celldm\s*\(\s*1\s*\)\s*=\s*([+-]?\d*\.?\d+(?:[eEdD][+-]?\d+)?)/i);
    if (!match || !match[1]) {
      return null;
    }
    const value = this.parseNumber(match[1]);
    if (!Number.isFinite(value)) {
      return null;
    }
    return value * BOHR_TO_ANGSTROM;
  }

  private parseAlatFromCellHeader(line: string): number | null {
    const match = line.match(/alat\s*=\s*([+-]?\d*\.?\d+(?:[eEdD][+-]?\d+)?)/i);
    if (!match || !match[1]) {
      return null;
    }
    const value = this.parseNumber(match[1]);
    if (!Number.isFinite(value)) {
      return null;
    }
    return value * BOHR_TO_ANGSTROM;
  }

  private parseNumber(value: string): number {
    const trimmed = value.trim();
    if (!trimmed) {
      return NaN;
    }
    if (trimmed.includes('/')) {
      const split = trimmed.split('/');
      if (split.length === 2) {
        const left = this.parseNumber(split[0]);
        const right = this.parseNumber(split[1]);
        if (Number.isFinite(left) && Number.isFinite(right) && Math.abs(right) > 1e-12) {
          return left / right;
        }
      }
    }
    return Number(trimmed.replace(/[dD]/g, 'e'));
  }

  private isPositiveNumber(value: number | null | undefined): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
  }

  private labelToSymbol(label: string): string | undefined {
    const match = label.match(/[A-Za-z]+/);
    if (!match) {
      return undefined;
    }
    const letters = match[0];
    const firstTwo = letters.slice(0, 2);
    return parseElement(firstTwo) || parseElement(letters[0]);
  }

  private unitCellFromVectors(vectors: number[][]): UnitCell {
    const [a, b, c] = vectors;
    const cellA = Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
    const cellB = Math.sqrt(b[0] * b[0] + b[1] * b[1] + b[2] * b[2]);
    const cellC = Math.sqrt(c[0] * c[0] + c[1] * c[1] + c[2] * c[2]);

    const dotAB = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const dotAC = a[0] * c[0] + a[1] * c[1] + a[2] * c[2];
    const dotBC = b[0] * c[0] + b[1] * c[1] + b[2] * c[2];

    const gamma = Math.acos(dotAB / (cellA * cellB)) * (180 / Math.PI);
    const beta = Math.acos(dotAC / (cellA * cellC)) * (180 / Math.PI);
    const alpha = Math.acos(dotBC / (cellB * cellC)) * (180 / Math.PI);

    return new UnitCell(cellA, cellB, cellC, alpha, beta, gamma);
  }
}
