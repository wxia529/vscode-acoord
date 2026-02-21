import { Structure } from '../../models/structure';
import { Atom } from '../../models/atom';
import { UnitCell } from '../../models/unitCell';
import { parseElement } from '../../utils/elementData';
import { StructureParser } from './structureParser';

/**
 * PDB file format parser (basic support for CRYST1 and ATOM/HETATM)
 */
export class PDBParser implements StructureParser {
  parse(content: string): Structure {
    const lines = content.split(/\r?\n/);
    const structure = new Structure('');

    for (const line of lines) {
      if (line.startsWith('CRYST1')) {
        const a = this.parseFloatSafe(line.slice(6, 15));
        const b = this.parseFloatSafe(line.slice(15, 24));
        const c = this.parseFloatSafe(line.slice(24, 33));
        const alpha = this.parseFloatSafe(line.slice(33, 40));
        const beta = this.parseFloatSafe(line.slice(40, 47));
        const gamma = this.parseFloatSafe(line.slice(47, 54));
        if (
          Number.isFinite(a) &&
          Number.isFinite(b) &&
          Number.isFinite(c) &&
          Number.isFinite(alpha) &&
          Number.isFinite(beta) &&
          Number.isFinite(gamma)
        ) {
          structure.isCrystal = true;
          structure.unitCell = new UnitCell(a, b, c, alpha, beta, gamma);
        }
        continue;
      }

      if (line.startsWith('ATOM') || line.startsWith('HETATM')) {
        const x = this.parseFloatSafe(line.slice(30, 38));
        const y = this.parseFloatSafe(line.slice(38, 46));
        const z = this.parseFloatSafe(line.slice(46, 54));
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
          continue;
        }

        const elementToken = this.extractElement(line);
        const element = parseElement(elementToken);
        if (!element) {
          continue;
        }

        structure.addAtom(new Atom(element, x, y, z));
      }
    }

    return structure;
  }

  serialize(structure: Structure): string {
    const lines: string[] = [];

    if (structure.unitCell) {
      const uc = structure.unitCell;
      lines.push(
        `CRYST1${uc.a.toFixed(3).padStart(9)}${uc.b.toFixed(3).padStart(9)}${uc.c.toFixed(3).padStart(9)}` +
          `${uc.alpha.toFixed(2).padStart(7)}${uc.beta.toFixed(2).padStart(7)}${uc.gamma.toFixed(2).padStart(7)} P 1`
      );
    }

    let atomIndex = 1;
    for (const atom of structure.atoms) {
      const name = atom.element.padEnd(2, ' ');
      const element = atom.element.padStart(2, ' ');
      const x = atom.x.toFixed(3).padStart(8, ' ');
      const y = atom.y.toFixed(3).padStart(8, ' ');
      const z = atom.z.toFixed(3).padStart(8, ' ');
      const serial = String(atomIndex).padStart(5, ' ');
      lines.push(
        `ATOM  ${serial}  ${name} MOL     1    ${x}${y}${z}  1.00  0.00          ${element}`
      );
      atomIndex++;
    }

    lines.push('END');
    return lines.join('\n');
  }

  private parseFloatSafe(value: string): number {
    const parsed = parseFloat(value.trim());
    return Number.isFinite(parsed) ? parsed : NaN;
  }

  private extractElement(line: string): string {
    if (line.length >= 78) {
      return line.slice(76, 78).trim();
    }
    const parts = line.trim().split(/\s+/);
    return parts[parts.length - 1] || '';
  }
}
