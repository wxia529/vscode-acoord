import { Structure } from '../../models/structure';
import { Atom } from '../../models/atom';
import { UnitCell } from '../../models/unitCell';
import { parseElement } from '../../utils/elementData';
import { StructureParser } from './structureParser';

/**
 * Gaussian input file format parser (GJF/COM)
 * Minimal support: title, charge/multiplicity, atom lines, and TV lattice vectors.
 */
export class GJFParser implements StructureParser {
  parse(content: string): Structure {
    const lines = content.split(/\r?\n/);
    let idx = 0;

    // Skip route section and header until first blank line
    while (idx < lines.length && lines[idx].trim() !== '') {
      idx++;
    }
    while (idx < lines.length && lines[idx].trim() === '') {
      idx++;
    }

    // Title section (first non-empty line)
    const title = (lines[idx] || '').trim();
    idx++;

    // Skip blank line after title
    while (idx < lines.length && lines[idx].trim() === '') {
      idx++;
    }

    // Charge and multiplicity line
    let chargeMultiplicityIndex = -1;
    for (let i = idx; i < lines.length; i++) {
      const parts = lines[i].trim().split(/\s+/);
      if (parts.length >= 2 && this.isInteger(parts[0]) && this.isInteger(parts[1])) {
        chargeMultiplicityIndex = i;
        break;
      }
      if (lines[i].trim() === '') {
        break;
      }
    }
    if (chargeMultiplicityIndex < 0) {
      throw new Error('Invalid GJF format: missing charge/multiplicity');
    }

    idx = chargeMultiplicityIndex + 1;

    const structure = new Structure(title || 'Imported GJF');
    const latticeVectors: number[][] = [];

    // Atom and TV lines until blank line or EOF
    for (; idx < lines.length; idx++) {
      const line = lines[idx].trim();
      if (!line) {
        break;
      }
      const parts = line.split(/\s+/);
      if (parts.length < 4) {
        continue;
      }

      if (parts[0].toUpperCase() === 'TV' && parts.length >= 4) {
        const vec = [
          parseFloat(parts[1]),
          parseFloat(parts[2]),
          parseFloat(parts[3]),
        ];
        if (vec.every((v) => Number.isFinite(v))) {
          latticeVectors.push(vec as [number, number, number]);
        }
        continue;
      }

      const element = parseElement(parts[0]);
      if (!element) {
        continue;
      }

      const x = parseFloat(parts[1]);
      const y = parseFloat(parts[2]);
      const z = parseFloat(parts[3]);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        continue;
      }
      structure.addAtom(new Atom(element, x, y, z));
    }

    if (latticeVectors.length === 3) {
      structure.isCrystal = true;
      structure.unitCell = this.unitCellFromLattice(latticeVectors);
    }

    return structure;
  }

  serialize(structure: Structure): string {
    const lines: string[] = [];
    lines.push('#P');
    lines.push('');
    lines.push(structure.name?.trim() ? structure.name : 'Gaussian input');
    lines.push('');
    lines.push('0 1');

    for (const atom of structure.atoms) {
      lines.push(
        `${atom.element}  ${atom.x.toFixed(10)}  ${atom.y.toFixed(10)}  ${atom.z.toFixed(10)}`
      );
    }

    if (structure.unitCell) {
      const vectors = structure.unitCell.getLatticeVectors();
      for (const vec of vectors) {
        lines.push(`TV  ${vec[0].toFixed(10)}  ${vec[1].toFixed(10)}  ${vec[2].toFixed(10)}`);
      }
    }

    return lines.join('\n');
  }

  private isInteger(value: string): boolean {
    return /^-?\d+$/.test(value.trim());
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
}
