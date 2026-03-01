import { Structure } from '../../models/structure';
import { Atom } from '../../models/atom';
import { UnitCell } from '../../models/unitCell';
import { parseElement } from '../../utils/elementData';
import { StructureParser } from './structureParser';

/**
 * OUTCAR parser (VASP)
 * Reads ionic frames from `POSITION ... TOTAL-FORCE` blocks.
 */
export class OUTCARParser implements StructureParser {
  parse(content: string): Structure {
    const frames = this.parseTrajectory(content);
    if (frames.length === 0) {
      throw new Error('Invalid OUTCAR format: no frame found');
    }
    return frames[frames.length - 1];
  }

  parseTrajectory(content: string): Structure[] {
    const lines = content.split(/\r?\n/);
    const atomTypes = this.parseAtomTypes(lines);
    const counts = this.parseIonsPerType(lines);
    const expandedSymbols = this.expandSymbols(atomTypes, counts);

    const frames: Structure[] = [];
    let currentLatticeVectors: number[][] | null = null;

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (!trimmed) {
        continue;
      }

      if (/direct lattice vectors/i.test(trimmed)) {
        const lattice = this.parseLatticeVectors(lines, i + 1);
        if (lattice) {
          currentLatticeVectors = lattice.vectors;
          i = lattice.nextIndex - 1;
        }
        continue;
      }

      if (!/position/i.test(trimmed) || !/total-force/i.test(trimmed)) {
        continue;
      }

      const block = this.parsePositionBlock(lines, i + 1);
      if (!block || block.positions.length === 0) {
        continue;
      }
      i = block.nextIndex - 1;
      frames.push(this.buildFrame(
        block.positions,
        expandedSymbols,
        currentLatticeVectors,
        frames.length + 1
      ));
    }

    if (frames.length === 0) {
      throw new Error('Invalid OUTCAR format: no POSITION blocks found');
    }

    return frames;
  }

  serialize(_structure: Structure): string {
    throw new Error('OUTCAR export is not supported');
  }

  private parseAtomTypes(lines: string[]): string[] {
    const collected: string[] = [];
    const seen = new Set<string>();

    for (const line of lines) {
      const vrhfin = line.match(/VRHFIN\s*=\s*([A-Za-z]{1,2})/i);
      if (vrhfin) {
        const symbol = parseElement(vrhfin[1]);
        if (symbol && !seen.has(symbol)) {
          seen.add(symbol);
          collected.push(symbol);
        }
        continue;
      }

      if (/TITEL/i.test(line) || /POTCAR:/i.test(line)) {
        const symbol = this.extractElementFromPotentialLine(line);
        if (symbol && !seen.has(symbol)) {
          seen.add(symbol);
          collected.push(symbol);
        }
      }
    }

    return collected;
  }

  private extractElementFromPotentialLine(line: string): string | null {
    const tokens = line
      .replace(/[:=]/g, ' ')
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 0);
    let candidate: string | null = null;
    for (const token of tokens) {
      const base = token.split('_')[0].split('.')[0];
      const parsed = parseElement(base);
      if (parsed) {
        candidate = parsed;
      }
    }
    return candidate;
  }

  private parseIonsPerType(lines: string[]): number[] {
    for (const line of lines) {
      const match = line.match(/ions\s+per\s+type\s*=\s*(.+)$/i);
      if (!match) {
        continue;
      }
      const counts = match[1]
        .trim()
        .split(/\s+/)
        .map((token) => parseInt(token, 10))
        .filter((value) => Number.isFinite(value) && value >= 0);
      if (counts.length > 0) {
        return counts;
      }
    }
    return [];
  }

  private expandSymbols(symbols: string[], counts: number[]): string[] {
    if (counts.length === 0) {
      return [];
    }
    const expanded: string[] = [];
    for (let i = 0; i < counts.length; i++) {
      const symbol = symbols[i] || 'X';
      for (let n = 0; n < counts[i]; n++) {
        expanded.push(symbol);
      }
    }
    return expanded;
  }

  private parseLatticeVectors(
    lines: string[],
    startIndex: number
  ): { vectors: number[][]; nextIndex: number } | null {
    const vectors: number[][] = [];
    let i = startIndex;
    while (i < lines.length && vectors.length < 3) {
      const tokens = lines[i].trim().split(/\s+/);
      if (tokens.length < 3) {
        break;
      }
      const values = tokens.slice(0, 3).map((token) => this.parseNumber(token));
      if (values.some((value) => !Number.isFinite(value))) {
        break;
      }
      vectors.push(values);
      i++;
    }
    if (vectors.length !== 3) {
      return null;
    }
    return { vectors, nextIndex: i };
  }

  private parsePositionBlock(
    lines: string[],
    startIndex: number
  ): { positions: number[][]; nextIndex: number } | null {
    let i = startIndex;
    while (i < lines.length && !/^[-\s]+$/.test(lines[i])) {
      i++;
    }
    if (i < lines.length && /^[-\s]+$/.test(lines[i])) {
      i++;
    }

    const positions: number[][] = [];
    for (; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (!trimmed) {
        continue;
      }
      if (/^[-\s]+$/.test(trimmed)) {
        i++;
        break;
      }
      const tokens = trimmed.split(/\s+/);
      if (tokens.length < 3) {
        break;
      }
      const x = this.parseNumber(tokens[0]);
      const y = this.parseNumber(tokens[1]);
      const z = this.parseNumber(tokens[2]);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        break;
      }
      positions.push([x, y, z]);
    }

    if (positions.length === 0) {
      return null;
    }
    return { positions, nextIndex: i };
  }

  private buildFrame(
    positions: number[][],
    expandedSymbols: string[],
    latticeVectors: number[][] | null,
    frameIndex: number
  ): Structure {
    const structure = new Structure(`OUTCAR frame ${frameIndex}`, true);
    if (latticeVectors) {
      structure.unitCell = this.unitCellFromVectors(latticeVectors);
      structure.isCrystal = true;
    }

    for (let i = 0; i < positions.length; i++) {
      const element = expandedSymbols[i] || 'X';
      const [x, y, z] = positions[i];
      structure.addAtom(new Atom(element, x, y, z));
    }

    return structure;
  }

  private parseNumber(token: string): number {
    return Number.parseFloat((token || '').replace(/d/gi, 'e'));
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
