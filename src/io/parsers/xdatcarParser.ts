import { Structure } from '../../models/structure';
import { Atom } from '../../models/atom';
import { UnitCell } from '../../models/unitCell';
import { parseElement } from '../../utils/elementData';
import { StructureParser } from './structureParser';

interface XdatcarHeader {
  label: string;
  latticeVectors: number[][];
  elements: string[];
  counts: number[];
  totalAtoms: number;
  coordinateMode: 'direct' | 'cartesian';
  nextIndex: number;
}

/**
 * XDATCAR trajectory parser (VASP)
 */
export class XDATCARParser implements StructureParser {
  parse(content: string): Structure {
    const frames = this.parseTrajectory(content);
    if (frames.length === 0) {
      throw new Error('Invalid XDATCAR format: no frame found');
    }
    return frames[frames.length - 1];
  }

  parseTrajectory(content: string): Structure[] {
    const lines = content.split(/\r?\n/);
    const frames: Structure[] = [];

    let index = 0;
    let header = this.tryParseHeader(lines, index);
    if (!header) {
      throw new Error('Invalid XDATCAR format: failed to parse header');
    }
    index = header.nextIndex;

    while (index < lines.length) {
      while (index < lines.length && !lines[index].trim()) {
        index++;
      }
      if (index >= lines.length) {
        break;
      }

      const line = lines[index].trim();
      if (/^direct\s+configuration\s*=/i.test(line)) {
        index++;
      } else {
        const maybeHeader = this.tryParseHeader(lines, index);
        if (maybeHeader) {
          header = maybeHeader;
          index = maybeHeader.nextIndex;
          continue;
        }
      }

      const block = this.parseCoordinateBlock(lines, index, header.totalAtoms);
      if (!block || block.rows.length === 0) {
        break;
      }
      index = block.nextIndex;
      frames.push(this.buildFrame(header, block.rows, frames.length + 1));
    }

    if (frames.length === 0) {
      throw new Error('Invalid XDATCAR format: no frame found');
    }

    return frames;
  }

  serialize(structure: Structure): string {
    return this.serializeTrajectory([structure]);
  }

  serializeTrajectory(structures: Structure[]): string {
    if (!structures || structures.length === 0) {
      throw new Error('No structure available to write XDATCAR');
    }
    const first = structures[0];
    if (!first.atoms || first.atoms.length === 0) {
      throw new Error('XDATCAR export requires atoms');
    }

    const headerVectors = first.unitCell
      ? first.unitCell.getLatticeVectors()
      : [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    const groupedIndices = new Map<string, number[]>();
    const elementOrder: string[] = [];
    for (let i = 0; i < first.atoms.length; i++) {
      const element = first.atoms[i].element || 'X';
      if (!groupedIndices.has(element)) {
        groupedIndices.set(element, []);
        elementOrder.push(element);
      }
      groupedIndices.get(element)!.push(i);
    }

    const lines: string[] = [];
    const label = (first.name || '').trim() || elementOrder.join(' ');
    lines.push(label);
    lines.push('1.0');
    for (const vec of headerVectors) {
      lines.push(`${vec[0].toFixed(10)}  ${vec[1].toFixed(10)}  ${vec[2].toFixed(10)}`);
    }
    lines.push(elementOrder.join(' '));
    lines.push(elementOrder.map((element) => groupedIndices.get(element)!.length).join(' '));
    lines.push('Direct');

    for (let frameIndex = 0; frameIndex < structures.length; frameIndex++) {
      const frame = structures[frameIndex];
      if (frame.atoms.length !== first.atoms.length) {
        throw new Error('XDATCAR export requires consistent atom counts across frames');
      }
      lines.push(`Direct configuration=${(frameIndex + 1).toString().padStart(6, ' ')}`);
      const frameCell = frame.unitCell || first.unitCell || null;
      for (const element of elementOrder) {
        for (const atomIndex of groupedIndices.get(element)!) {
          const atom = frame.atoms[atomIndex];
          if (atom.element !== element) {
            throw new Error('XDATCAR export requires consistent atom ordering across frames');
          }
          let fx = atom.x;
          let fy = atom.y;
          let fz = atom.z;
          if (frameCell) {
            const frac = frameCell.cartesianToFractional(atom.x, atom.y, atom.z);
            fx = frac[0];
            fy = frac[1];
            fz = frac[2];
          }
          lines.push(`${fx.toFixed(8)}  ${fy.toFixed(8)}  ${fz.toFixed(8)}`);
        }
      }
    }

    return lines.join('\n');
  }

  private tryParseHeader(lines: string[], startIndex: number): XdatcarHeader | null {
    let i = startIndex;
    while (i < lines.length && !lines[i].trim()) {
      i++;
    }
    if (i + 6 >= lines.length) {
      return null;
    }

    const label = (lines[i] || '').trim();
    const scale = this.parseScaling(lines[i + 1] || '');
    if (scale === null) {
      return null;
    }

    const rawVectors: number[][] = [];
    for (let row = 0; row < 3; row++) {
      const vec = this.parseVector(lines[i + 2 + row] || '');
      if (!vec) {
        return null;
      }
      rawVectors.push(vec);
    }
    const latticeVectors = rawVectors.map((vec) => vec.map((value) => value * scale));

    const elements = this.parseElements(lines[i + 5] || '');
    const counts = this.parseCounts(lines[i + 6] || '');
    if (counts.length === 0) {
      return null;
    }
    const normalizedElements = elements.slice(0, counts.length);
    while (normalizedElements.length < counts.length) {
      normalizedElements.push('X');
    }

    let modeIndex = i + 7;
    let coordinateMode: 'direct' | 'cartesian' = 'direct';
    const modeTokens = this.tokenize(lines[modeIndex] || '');
    const isCoordinateLine = this.looksLikeCoordinateLine(modeTokens);
    if (!isCoordinateLine) {
      const token = (modeTokens[0] || '').toLowerCase();
      coordinateMode = token.startsWith('c') || token.startsWith('k') ? 'cartesian' : 'direct';
      modeIndex++;
    }

    const totalAtoms = counts.reduce((sum, count) => sum + count, 0);
    if (totalAtoms <= 0) {
      return null;
    }

    return {
      label,
      latticeVectors,
      elements: normalizedElements,
      counts,
      totalAtoms,
      coordinateMode,
      nextIndex: modeIndex,
    };
  }

  private parseCoordinateBlock(
    lines: string[],
    startIndex: number,
    totalAtoms: number
  ): { rows: number[][]; nextIndex: number } | null {
    const rows: number[][] = [];
    let i = startIndex;
    while (i < lines.length && rows.length < totalAtoms) {
      const raw = lines[i].trim();
      if (!raw) {
        i++;
        continue;
      }
      if (/^direct\s+configuration\s*=/i.test(raw) || /^[-_]+$/.test(raw)) {
        break;
      }
      const tokens = this.tokenize(raw);
      if (!this.looksLikeCoordinateLine(tokens)) {
        break;
      }
      const x = Number.parseFloat(tokens[0]);
      const y = Number.parseFloat(tokens[1]);
      const z = Number.parseFloat(tokens[2]);
      rows.push([x, y, z]);
      i++;
    }

    if (rows.length === 0) {
      return null;
    }

    return { rows, nextIndex: i };
  }

  private buildFrame(header: XdatcarHeader, rows: number[][], frameIndex: number): Structure {
    const structure = new Structure(header.label || `XDATCAR frame ${frameIndex}`, true);
    structure.unitCell = this.unitCellFromVectors(header.latticeVectors);
    structure.isCrystal = true;

    const expandedElements = this.expandElements(header.elements, header.counts);
    const atomCount = Math.min(rows.length, expandedElements.length);
    for (let i = 0; i < atomCount; i++) {
      let [x, y, z] = rows[i];
      if (header.coordinateMode === 'direct') {
        [x, y, z] = this.fractionalToCartesian(x, y, z, header.latticeVectors);
      }
      structure.addAtom(new Atom(expandedElements[i], x, y, z));
    }

    return structure;
  }

  private parseScaling(line: string): number | null {
    const tokens = this.tokenize(line);
    if (tokens.length === 0) {
      return null;
    }
    const value = Number.parseFloat(tokens[0]);
    if (!Number.isFinite(value) || Math.abs(value) < 1e-12) {
      return null;
    }
    return value;
  }

  private parseVector(line: string): number[] | null {
    const tokens = this.tokenize(line);
    if (tokens.length < 3) {
      return null;
    }
    const vec = tokens.slice(0, 3).map((token) => Number.parseFloat(token));
    if (vec.some((value) => !Number.isFinite(value))) {
      return null;
    }
    return vec;
  }

  private parseElements(line: string): string[] {
    const tokens = this.tokenize(line);
    const elements: string[] = [];
    for (const token of tokens) {
      const match = token.match(/[A-Za-z]+/);
      if (!match) {
        continue;
      }
      const parsed = parseElement(match[0]);
      if (parsed) {
        elements.push(parsed);
      }
    }
    return elements;
  }

  private parseCounts(line: string): number[] {
    const tokens = this.tokenize(line);
    if (tokens.some((token) => !/^[+-]?\d+$/.test(token))) {
      return [];
    }
    return tokens
      .map((token) => parseInt(token, 10))
      .filter((value) => Number.isFinite(value) && value >= 0);
  }

  private expandElements(elements: string[], counts: number[]): string[] {
    const expanded: string[] = [];
    for (let i = 0; i < counts.length; i++) {
      const element = elements[i] || 'X';
      for (let n = 0; n < counts[i]; n++) {
        expanded.push(element);
      }
    }
    return expanded;
  }

  private tokenize(line: string): string[] {
    return (line || '').trim().split(/\s+/).filter((token) => token.length > 0);
  }

  private looksLikeCoordinateLine(tokens: string[]): boolean {
    if (tokens.length < 3) {
      return false;
    }
    const x = Number.parseFloat(tokens[0]);
    const y = Number.parseFloat(tokens[1]);
    const z = Number.parseFloat(tokens[2]);
    return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z);
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
