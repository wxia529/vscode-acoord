import { Structure } from '../../models/structure';
import { Atom } from '../../models/atom';
import { UnitCell } from '../../models/unitCell';
import { parseElement } from '../../utils/elementData';
import { StructureParser } from './structureParser';

type CoordinateMode = 'direct' | 'cartesian';

interface ParsedHeader {
  name: string;
  latticeVectors: number[][];
  elements: string[];
  counts: number[];
  hasSelectiveDynamics: boolean;
  coordinateMode: CoordinateMode;
  atomStartLine: number;
}

/**
 * POSCAR / CONTCAR parser (VASP)
 */
export class POSCARParser implements StructureParser {
  parse(content: string): Structure {
    const lines = content.split(/\r?\n/);
    const header = this.parseHeader(lines);
    const structure = new Structure(header.name, true);
    structure.unitCell = this.unitCellFromVectors(header.latticeVectors);
    structure.isCrystal = true;

    const totalAtoms = header.counts.reduce((sum, count) => sum + count, 0);
    const orderedElements = this.expandElements(header.elements, header.counts);

    let lineIndex = header.atomStartLine;
    let atomIndex = 0;
    while (lineIndex < lines.length && atomIndex < totalAtoms) {
      const raw = lines[lineIndex].trim();
      lineIndex++;
      if (!raw) {
        continue;
      }

      const parts = this.tokenizeDataLine(raw);
      if (parts.length < 3) {
        continue;
      }

      let x = this.parseNumber(parts[0]);
      let y = this.parseNumber(parts[1]);
      let z = this.parseNumber(parts[2]);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        continue;
      }

      if (header.coordinateMode === 'direct') {
        [x, y, z] = this.fractionalToCartesian(x, y, z, header.latticeVectors);
      }

      const element = orderedElements[atomIndex] || 'X';
      const atom = new Atom(element, x, y, z);
      if (header.hasSelectiveDynamics && parts.length >= 6) {
        const flags = parts.slice(3, 6).map((value) => value.toUpperCase());
        atom.fixed = flags.every((flag) => flag.startsWith('F'));
      }
      structure.addAtom(atom);
      atomIndex++;
    }

    if (structure.atoms.length === 0) {
      throw new Error('Invalid POSCAR format: no atoms found');
    }

    return structure;
  }

  serialize(structure: Structure): string {
    const lines: string[] = [];
    lines.push((structure.name || '').trim() || 'Created by ACoord');
    lines.push('1.0');

    const latticeVectors = structure.unitCell
      ? structure.unitCell.getLatticeVectors()
      : [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    for (const vec of latticeVectors) {
      lines.push(`${vec[0].toFixed(10)}  ${vec[1].toFixed(10)}  ${vec[2].toFixed(10)}`);
    }

    const grouped = new Map<string, Atom[]>();
    for (const atom of structure.atoms) {
      if (!grouped.has(atom.element)) {
        grouped.set(atom.element, []);
      }
      grouped.get(atom.element)!.push(atom);
    }
    const elements = Array.from(grouped.keys());
    const orderedAtoms = elements.flatMap((element) => grouped.get(element)!);
    lines.push(elements.join(' '));
    lines.push(elements.map((element) => grouped.get(element)!.length).join(' '));

    const hasFixed = orderedAtoms.some((atom) => atom.fixed);
    if (hasFixed) {
      lines.push('Selective dynamics');
    }
    lines.push('Direct');

    for (const atom of orderedAtoms) {
      let fx = atom.x;
      let fy = atom.y;
      let fz = atom.z;
      if (structure.unitCell) {
        const frac = structure.unitCell.cartesianToFractional(atom.x, atom.y, atom.z);
        fx = frac[0];
        fy = frac[1];
        fz = frac[2];
      }

      let row = `${fx.toFixed(10)}  ${fy.toFixed(10)}  ${fz.toFixed(10)}`;
      if (hasFixed) {
        row += atom.fixed ? '  F  F  F' : '  T  T  T';
      }
      lines.push(row);
    }

    return lines.join('\n');
  }

  private parseHeader(lines: string[]): ParsedHeader {
    if (lines.length < 8) {
      throw new Error('Invalid POSCAR format');
    }

    const name = (lines[0] || '').trim();
    const scale = this.parseScalingFactors(lines[1] || '');
    const rawA = this.parseVector(lines[2] || '');
    const rawB = this.parseVector(lines[3] || '');
    const rawC = this.parseVector(lines[4] || '');
    const latticeVectors = this.applyScaling([rawA, rawB, rawC], scale);

    let index = 5;
    const firstDataTokens = this.tokenizeDataLine(lines[index] || '');
    if (firstDataTokens.length === 0) {
      throw new Error('Invalid POSCAR format: missing element/count line');
    }

    let elements: string[] = [];
    let counts: number[] = [];
    if (this.tokensAreAllIntegers(firstDataTokens)) {
      counts = firstDataTokens.map((token) => parseInt(token, 10)).filter((v) => Number.isFinite(v) && v >= 0);
      elements = this.parseElementsFromTitle(name, counts.length);
    } else {
      elements = this.parseElementTokens(firstDataTokens);
      index += 1;
      const countTokens = this.tokenizeDataLine(lines[index] || '');
      counts = countTokens.map((token) => parseInt(token, 10)).filter((v) => Number.isFinite(v) && v >= 0);
    }

    if (counts.length === 0) {
      throw new Error('Invalid POSCAR format: missing atom counts');
    }
    if (elements.length < counts.length) {
      const fromTitle = this.parseElementsFromTitle(name, counts.length);
      if (fromTitle.length >= counts.length) {
        elements = fromTitle;
      }
    }
    while (elements.length < counts.length) {
      elements.push('X');
    }
    if (elements.length > counts.length) {
      elements = elements.slice(0, counts.length);
    }

    index += 1;
    let hasSelectiveDynamics = false;
    const lineAtIndex = (lines[index] || '').trim();
    if (lineAtIndex && lineAtIndex[0].toLowerCase() === 's') {
      hasSelectiveDynamics = true;
      index += 1;
    }

    let coordinateMode: CoordinateMode = 'direct';
    const modeTokens = this.tokenizeDataLine(lines[index] || '');
    const firstToken = (modeTokens[0] || '').toLowerCase();
    const looksLikeCoordinate =
      modeTokens.length >= 3 &&
      Number.isFinite(this.parseNumber(modeTokens[0])) &&
      Number.isFinite(this.parseNumber(modeTokens[1])) &&
      Number.isFinite(this.parseNumber(modeTokens[2]));
    if (!looksLikeCoordinate) {
      if (firstToken.startsWith('c') || firstToken.startsWith('k')) {
        coordinateMode = 'cartesian';
      } else {
        coordinateMode = 'direct';
      }
      index += 1;
    }

    return {
      name,
      latticeVectors,
      elements,
      counts,
      hasSelectiveDynamics,
      coordinateMode,
      atomStartLine: index,
    };
  }

  private parseScalingFactors(line: string): number[] {
    const tokens = this.tokenizeDataLine(line);
    if (tokens.length === 0) {
      throw new Error('Invalid POSCAR format: missing scaling factor');
    }
    const values = tokens.slice(0, 3).map((token) => this.parseNumber(token)).filter((value) => Number.isFinite(value));
    if (values.length === 1) {
      if (Math.abs(values[0]) < 1e-12) {
        throw new Error('Invalid POSCAR format: zero scaling factor');
      }
      return values;
    }
    if (values.length === 3) {
      if (values.some((value) => value <= 0)) {
        throw new Error('Invalid POSCAR format: anisotropic scaling must be positive');
      }
      return values;
    }
    throw new Error('Invalid POSCAR format: scaling factor must be 1 or 3 values');
  }

  private applyScaling(vectors: number[][], scale: number[]): number[][] {
    if (scale.length === 1) {
      const factor = scale[0];
      if (factor > 0) {
        return vectors.map((vec) => vec.map((value) => value * factor));
      }
      const volume = Math.abs(this.determinant3x3(vectors));
      if (volume < 1e-12) {
        throw new Error('Invalid POSCAR lattice vectors');
      }
      const isotropic = Math.cbrt((-factor) / volume);
      return vectors.map((vec) => vec.map((value) => value * isotropic));
    }

    const [sx, sy, sz] = scale;
    return vectors.map((vec) => [vec[0] * sx, vec[1] * sy, vec[2] * sz]);
  }

  private determinant3x3(vectors: number[][]): number {
    const [a, b, c] = vectors;
    return (
      a[0] * (b[1] * c[2] - b[2] * c[1]) -
      a[1] * (b[0] * c[2] - b[2] * c[0]) +
      a[2] * (b[0] * c[1] - b[1] * c[0])
    );
  }

  private parseVector(line: string): number[] {
    const values = this.tokenizeDataLine(line).slice(0, 3).map((token) => this.parseNumber(token));
    if (values.length !== 3 || values.some((value) => !Number.isFinite(value))) {
      throw new Error('Invalid POSCAR format: invalid lattice vector');
    }
    return values;
  }

  private tokenizeDataLine(line: string): string[] {
    const cleaned = this.stripComment(line);
    if (!cleaned) {
      return [];
    }
    return cleaned.trim().split(/\s+/).filter((token) => token.length > 0);
  }

  private stripComment(line: string): string {
    const raw = (line || '').trim();
    if (!raw) {
      return '';
    }
    const commentIndex = raw.indexOf('!');
    if (commentIndex >= 0) {
      return raw.slice(0, commentIndex).trim();
    }
    return raw;
  }

  private parseNumber(token: string): number {
    return Number.parseFloat((token || '').trim());
  }

  private tokensAreAllIntegers(tokens: string[]): boolean {
    return tokens.length > 0 && tokens.every((token) => /^[-+]?\d+$/.test(token));
  }

  private parseElementTokens(tokens: string[]): string[] {
    const elements: string[] = [];
    for (const token of tokens) {
      const element = this.parseElementToken(token);
      if (element) {
        elements.push(element);
      }
    }
    return elements;
  }

  private parseElementToken(token: string): string | null {
    const cleaned = (token || '').replace(/^['"]|['"]$/g, '').trim();
    if (!cleaned) {
      return null;
    }

    const symbolMatch = cleaned.match(/[A-Za-z]+/);
    if (!symbolMatch) {
      return null;
    }
    const candidate = symbolMatch[0];
    const parsed = parseElement(candidate);
    return parsed || null;
  }

  private parseElementsFromTitle(title: string, expectedCount: number): string[] {
    const found: string[] = [];
    const matches = (title || '').match(/[A-Z][a-z]?/g) || [];
    for (const candidate of matches) {
      const symbol = parseElement(candidate);
      if (!symbol) {
        continue;
      }
      if (!found.includes(symbol)) {
        found.push(symbol);
      }
      if (found.length >= expectedCount) {
        break;
      }
    }
    return found;
  }

  private expandElements(elements: string[], counts: number[]): string[] {
    const expanded: string[] = [];
    for (let i = 0; i < counts.length; i++) {
      const element = elements[i] || 'X';
      const count = Math.max(0, counts[i] || 0);
      for (let n = 0; n < count; n++) {
        expanded.push(element);
      }
    }
    return expanded;
  }

  private fractionalToCartesian(
    fx: number,
    fy: number,
    fz: number,
    latticeVectors: number[][]
  ): [number, number, number] {
    const [a, b, c] = latticeVectors;
    return [
      fx * a[0] + fy * b[0] + fz * c[0],
      fx * a[1] + fy * b[1] + fz * c[1],
      fx * a[2] + fy * b[2] + fz * c[2],
    ];
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
