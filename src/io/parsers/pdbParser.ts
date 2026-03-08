import { Structure } from '../../models/structure.js';
import { Atom } from '../../models/atom.js';
import { UnitCell } from '../../models/unitCell.js';
import { parseElement, getDefaultAtomRadius } from '../../utils/elementData.js';
import { BRIGHT_SCHEME } from '../../config/presets/color-schemes/index.js';
import { StructureParser } from './structureParser.js';

/**
 * PDB file format parser (basic support for CRYST1 and ATOM/HETATM)
 */
export class PDBParser extends StructureParser {
  parse(content: string): Structure {
    if (!content.trim()) {
      throw new Error('PDBParser: empty input');
    }
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

        structure.addAtom(new Atom(element, x, y, z, undefined, {
          color: BRIGHT_SCHEME.colors[element] || '#C0C0C0',
          radius: getDefaultAtomRadius(element),
        }));
      }
    }

    if (structure.atoms.length === 0) {
      throw new Error('PDBParser: no ATOM or HETATM records found');
    }

    return structure;
  }

  serialize(structure: Structure): string {
    const lines: string[] = [];

    if (structure.unitCell) {
      const uc = structure.unitCell;
      const aStr = uc.a.toFixed(3).padStart(9);
      const bStr = uc.b.toFixed(3).padStart(9);
      const cStr = uc.c.toFixed(3).padStart(9);
      const alphaStr = uc.alpha.toFixed(2).padStart(7);
      const betaStr = uc.beta.toFixed(2).padStart(7);
      const gammaStr = uc.gamma.toFixed(2).padStart(7);
      lines.push(
        `CRYST1${aStr}${bStr}${cStr}${alphaStr}${betaStr}${gammaStr} P 1`
      );
    }

    let atomIndex = 1;
    for (const atom of structure.atoms) {
      // PDB cols 7-11: serial number (5 chars, right-justified)
      const serial = String(atomIndex).padStart(5, ' ');
      // PDB cols 13-16: atom name (4 chars). 1-char elements: " C  "; 2-char elements: "FE  "
      const rawName = atom.element.length >= 2
        ? atom.element.substring(0, 2).toUpperCase()
        : atom.element.toUpperCase();
      const name = rawName.length === 2
        ? rawName.padEnd(4, ' ')
        : (' ' + rawName).padEnd(4, ' ');
      const resName = 'MOL';
      const chainID = ' ';
      const resSeq = '   1';
      const iCode = ' ';
      const x = atom.x.toFixed(3).padStart(8, ' ');
      const y = atom.y.toFixed(3).padStart(8, ' ');
      const z = atom.z.toFixed(3).padStart(8, ' ');
      const occupancy = '1.00';
      const tempFactor = '0.00';
      const element = atom.element.length === 2
        ? atom.element
        : atom.element.padStart(2, ' ');
      const charge = '  ';

      lines.push(
        `ATOM  ${serial} ${name} ${resName} ${chainID}${resSeq}${iCode}   ${x}${y}${z}${occupancy.padStart(6)}${tempFactor.padStart(6)}          ${element}${charge}`
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
