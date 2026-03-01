import { Structure } from '../../models/structure';
import { Atom } from '../../models/atom';
import { UnitCell } from '../../models/unitCell';
import { parseElement } from '../../utils/elementData';
import { StructureParser } from './structureParser';

/**
 * XYZ file format parser
 * Format:
 * <number_of_atoms>
 * <comment>
 * <element> <x> <y> <z>
 * ...
 */
export class XYZParser implements StructureParser {
  parse(content: string): Structure {
    const frames = this.parseTrajectory(content);
    if (frames.length === 0) {
      throw new Error('Invalid XYZ format: no frame found');
    }
    return frames[0];
  }

  parseTrajectory(content: string): Structure[] {
    const lines = content.split(/\r?\n/);
    const frames: Structure[] = [];
    let i = 0;

    while (i < lines.length) {
      while (i < lines.length && !lines[i].trim()) {
        i++;
      }
      if (i >= lines.length) {
        break;
      }

      const atomCount = parseInt(lines[i].trim(), 10);
      if (!Number.isFinite(atomCount) || atomCount < 0) {
        if (frames.length === 0) {
          throw new Error('Invalid XYZ format: first line must be atom count');
        }
        break;
      }
      if (i + 1 >= lines.length) {
        break;
      }

      const comment = lines[i + 1] || '';
      const structure = new Structure(comment || '');
      const latticeVectors = this.parseLatticeFromComment(comment);
      if (latticeVectors) {
        structure.isCrystal = true;
        structure.unitCell = this.unitCellFromLattice(latticeVectors);
      }

      const properties = this.parsePropertiesFromComment(comment);
      const speciesIndex = properties?.speciesIndex ?? 0;
      const positionIndex = properties?.positionIndex ?? 1;

      const start = i + 2;
      const end = Math.min(lines.length, start + atomCount);
      for (let lineIndex = start; lineIndex < end; lineIndex++) {
        const parts = lines[lineIndex].trim().split(/\s+/);
        if (parts.length < 4) {
          continue;
        }

        const elementToken = parts[speciesIndex];
        const element = parseElement(elementToken);
        if (!element) {
          continue;
        }

        const x = parseFloat(parts[positionIndex]);
        const y = parseFloat(parts[positionIndex + 1]);
        const z = parseFloat(parts[positionIndex + 2]);
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
          continue;
        }
        structure.addAtom(new Atom(element, x, y, z));
      }

      frames.push(structure);
      i = start + atomCount;
    }

    if (frames.length === 0) {
      throw new Error('Invalid XYZ format: no frame found');
    }

    return frames;
  }

  serialize(structure: Structure): string {
    return this.serializeTrajectory([structure]);
  }

  serializeTrajectory(structures: Structure[]): string {
    if (!structures || structures.length === 0) {
      return '';
    }

    const chunks: string[] = [];
    for (const structure of structures) {
      chunks.push(this.serializeSingleFrame(structure));
    }
    return chunks.join('\n');
  }

  private serializeSingleFrame(structure: Structure): string {
    const lines: string[] = [];
    lines.push(structure.atoms.length.toString());
    let comment = structure.name || 'Structure';
    if (structure.unitCell) {
      const vectors = structure.unitCell.getLatticeVectors();
      const lattice = vectors
        .flat()
        .map((value) => value.toFixed(10))
        .join(' ');
      const pbc = 'T T T';
      const properties = 'Properties=species:S:1:pos:R:3';
      comment = `${comment} Lattice="${lattice}" ${properties} pbc="${pbc}"`;
    }
    lines.push(comment);

    for (const atom of structure.atoms) {
      lines.push(
        `${atom.element}  ${atom.x.toFixed(10)}  ${atom.y.toFixed(10)}  ${atom.z.toFixed(10)}`
      );
    }

    return lines.join('\n');
  }

  private parseLatticeFromComment(comment: string): number[][] | null {
    const match = comment.match(/Lattice\s*=\s*"([^"]+)"/i);
    if (!match) {
      return null;
    }
    const values = match[1]
      .trim()
      .split(/\s+/)
      .map((value) => parseFloat(value))
      .filter((value) => Number.isFinite(value));
    if (values.length !== 9) {
      return null;
    }
    return [
      [values[0], values[1], values[2]],
      [values[3], values[4], values[5]],
      [values[6], values[7], values[8]],
    ];
  }

  private unitCellFromLattice(vectors: number[][]): UnitCell {
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

  private parsePropertiesFromComment(comment: string): { speciesIndex: number; positionIndex: number } | null {
    const match = comment.match(/Properties\s*=\s*([^\s]+)/i);
    if (!match) {
      return null;
    }
    const spec = match[1].trim();
    const parts = spec.split(':');
    const fields: Array<{ name: string; count: number }> = [];
    for (let i = 0; i + 2 < parts.length; i += 3) {
      const name = parts[i].toLowerCase();
      const count = parseInt(parts[i + 2], 10);
      if (!Number.isFinite(count)) {
        continue;
      }
      fields.push({ name, count });
    }
    if (fields.length === 0) {
      return null;
    }
    let speciesIndex = -1;
    let positionIndex = -1;
    let cursor = 0;
    for (const field of fields) {
      if (field.name === 'species' || field.name === 'element') {
        speciesIndex = cursor;
      }
      if (field.name === 'pos') {
        positionIndex = cursor;
      }
      cursor += field.count;
    }
    if (speciesIndex < 0 || positionIndex < 0) {
      return null;
    }
    return { speciesIndex, positionIndex };
  }
}
