import { Structure } from '../../models/structure';
import { Atom } from '../../models/atom';
import { parseElement } from '../../utils/elementData';
import { StructureParser } from './structureParser';

/**
 * ORCA input file parser (.inp)
 * Minimal support: * xyz charge mult ... *
 * Lattice data (if any) is ignored.
 */
export class ORCAParser implements StructureParser {
  parse(content: string): Structure {
    const lines = content.split(/\r?\n/);
    const startIndex = lines.findIndex((line) =>
      /^\*\s*xyz\b/i.test(line.trim())
    );

    if (startIndex < 0) {
      throw new Error('Invalid ORCA input: missing "* xyz" block');
    }

    const structure = new Structure('');

    for (let i = startIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        continue;
      }
      if (line.startsWith('*')) {
        break;
      }
      const parts = line.split(/\s+/);
      if (parts.length < 4) {
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

    return structure;
  }

  serialize(structure: Structure): string {
    const lines: string[] = [];
    lines.push('! B3LYP D3 def2-SVP');
    lines.push('%maxcore     8192');
    lines.push('%pal nprocs   8 end');
    lines.push('* xyz 0 1');
    for (const atom of structure.atoms) {
      lines.push(
        `${atom.element}  ${atom.x.toFixed(10)}  ${atom.y.toFixed(10)}  ${atom.z.toFixed(10)}`
      );
    }
    lines.push('*');
    return lines.join('\n');
  }
}
