import { Structure } from '../../models/structure';
import { Atom } from '../../models/atom';
import { UnitCell } from '../../models/unitCell';
import { parseElement } from '../../utils/elementData';
import { StructureParser } from './structureParser';

/**
 * CIF file format parser (basic implementation)
 * Crystallographic Information File
 */
export class CIFParser implements StructureParser {
  parse(content: string): Structure {
    const structure = new Structure('', true);
    const lines = content.split(/\r?\n/);
    this.parseUnitCell(lines, structure);
    this.parseAtomLoops(lines, structure);

    return structure;
  }

  serialize(structure: Structure): string {
    if (!structure.unitCell) {
      throw new Error('CIF export requires lattice parameters (a, b, c, alpha, beta, gamma).');
    }
    const lines: string[] = [];
    lines.push('data_structure');
    lines.push('');

    // Write unit cell
    const uc = structure.unitCell;
    lines.push(`_cell_length_a    ${uc.a.toFixed(6)}`);
    lines.push(`_cell_length_b    ${uc.b.toFixed(6)}`);
    lines.push(`_cell_length_c    ${uc.c.toFixed(6)}`);
    lines.push(`_cell_angle_alpha ${uc.alpha.toFixed(6)}`);
    lines.push(`_cell_angle_beta  ${uc.beta.toFixed(6)}`);
    lines.push(`_cell_angle_gamma ${uc.gamma.toFixed(6)}`);
    lines.push('');
    lines.push('_space_group_name_H-M_alt    "P 1"');
    lines.push('_space_group_IT_number       1');
    lines.push('');
    lines.push('loop_');
    lines.push('  _space_group_symop_operation_xyz');
    lines.push("  'x, y, z'");
    lines.push('');

    // Write atoms
    lines.push('loop_');
    lines.push('_atom_site_label');
    lines.push('_atom_site_type_symbol');
    lines.push('_atom_site_fract_x');
    lines.push('_atom_site_fract_y');
    lines.push('_atom_site_fract_z');

    structure.atoms.forEach((atom, idx) => {
      let fx = atom.x;
      let fy = atom.y;
      let fz = atom.z;
      if (structure.unitCell) {
        const frac = structure.unitCell.cartesianToFractional(atom.x, atom.y, atom.z);
        fx = frac[0];
        fy = frac[1];
        fz = frac[2];
      }
      lines.push(
        `${atom.element}${idx + 1}  ${atom.element}  ${fx.toFixed(10)}  ${fy.toFixed(10)}  ${fz.toFixed(10)}`
      );
    });

    return lines.join('\n');
  }

  private parseUnitCell(lines: string[], structure: Structure) {
    const cellA = this.extractTagNumber(lines, '_cell_length_a');
    const cellB = this.extractTagNumber(lines, '_cell_length_b');
    const cellC = this.extractTagNumber(lines, '_cell_length_c');
    const cellAlpha = this.extractTagNumber(lines, '_cell_angle_alpha');
    const cellBeta = this.extractTagNumber(lines, '_cell_angle_beta');
    const cellGamma = this.extractTagNumber(lines, '_cell_angle_gamma');

    if (cellA !== null && cellB !== null && cellC !== null) {
      structure.unitCell = new UnitCell(
        cellA,
        cellB,
        cellC,
        cellAlpha ?? 90,
        cellBeta ?? 90,
        cellGamma ?? 90
      );
    }
  }

  private parseAtomLoops(lines: string[], structure: Structure) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim().toLowerCase();
      if (line !== 'loop_') {
        continue;
      }

      const headers: string[] = [];
      let j = i + 1;
      while (j < lines.length) {
        const header = lines[j].trim();
        if (!header.startsWith('_')) {
          break;
        }
        headers.push(header.toLowerCase().split(/\s+/, 1)[0]);
        j++;
      }

      if (headers.length === 0) {
        i = j;
        continue;
      }

      const rows = this.parseLoopRows(lines, j, headers.length);
      i = rows.nextIndex - 1;
      if (!headers.some((header) => header.startsWith('_atom_site_'))) {
        continue;
      }
      this.addAtomsFromLoop(headers, rows.rows, structure);
    }
  }

  private parseLoopRows(lines: string[], startIndex: number, nColumns: number): {
    rows: string[][];
    nextIndex: number;
  } {
    const rows: string[][] = [];
    let buffer: string[] = [];
    let i = startIndex;

    for (; i < lines.length; i++) {
      const raw = lines[i].trim();
      const lower = raw.toLowerCase();
      if (
        raw.length === 0 ||
        raw.startsWith('_') ||
        lower.startsWith('loop_') ||
        lower.startsWith('data_')
      ) {
        break;
      }
      if (raw.startsWith('#')) {
        continue;
      }

      const tokens = raw.startsWith(';')
        ? [this.parseMultilineValue(lines, i)]
        : this.tokenize(this.stripInlineComment(raw));
      if (raw.startsWith(';')) {
        while (i + 1 < lines.length && !lines[i + 1].trim().startsWith(';')) {
          i++;
        }
        i++;
      }

      buffer.push(...tokens);
      while (buffer.length >= nColumns) {
        rows.push(buffer.slice(0, nColumns));
        buffer = buffer.slice(nColumns);
      }
    }

    return { rows, nextIndex: i };
  }

  private addAtomsFromLoop(headers: string[], rows: string[][], structure: Structure) {
    const byHeader = new Map<string, number>();
    headers.forEach((header, idx) => {
      if (!byHeader.has(header)) {
        byHeader.set(header, idx);
      }
    });

    const getIdx = (keys: string[]): number => {
      for (const key of keys) {
        const idx = byHeader.get(key);
        if (idx !== undefined) {
          return idx;
        }
      }
      return -1;
    };

    const typeIdx = getIdx(['_atom_site_type_symbol']);
    const labelIdx = getIdx(['_atom_site_label']);
    const fracXIdx = getIdx(['_atom_site_fract_x']);
    const fracYIdx = getIdx(['_atom_site_fract_y']);
    const fracZIdx = getIdx(['_atom_site_fract_z']);
    const cartXIdx = getIdx(['_atom_site_cartn_x']);
    const cartYIdx = getIdx(['_atom_site_cartn_y']);
    const cartZIdx = getIdx(['_atom_site_cartn_z']);
    const hasFrac = fracXIdx >= 0 && fracYIdx >= 0 && fracZIdx >= 0;
    const hasCart = cartXIdx >= 0 && cartYIdx >= 0 && cartZIdx >= 0;

    for (const row of rows) {
      const symbolRaw = this.getRowValue(row, typeIdx) || this.getRowValue(row, labelIdx);
      const symbol = symbolRaw ? this.parseElementFromLabel(symbolRaw) : undefined;
      if (!symbol) {
        continue;
      }

      let x: number;
      let y: number;
      let z: number;

      if (hasFrac) {
        x = this.parseNumeric(this.getRowValue(row, fracXIdx));
        y = this.parseNumeric(this.getRowValue(row, fracYIdx));
        z = this.parseNumeric(this.getRowValue(row, fracZIdx));
        if (structure.unitCell) {
          [x, y, z] = structure.unitCell.fractionalToCartesian(x, y, z);
        }
      } else if (hasCart) {
        x = this.parseNumeric(this.getRowValue(row, cartXIdx));
        y = this.parseNumeric(this.getRowValue(row, cartYIdx));
        z = this.parseNumeric(this.getRowValue(row, cartZIdx));
      } else {
        continue;
      }

      if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
        structure.addAtom(new Atom(symbol, x, y, z));
      }
    }
  }

  private extractTagNumber(lines: string[], key: string): number | null {
    const loweredKey = key.toLowerCase();
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i].trim();
      if (!raw) {
        continue;
      }
      const line = this.stripInlineComment(raw);
      const lowered = line.toLowerCase();
      if (!lowered.startsWith(loweredKey)) {
        continue;
      }

      const tokens = this.tokenize(line);
      if (tokens.length >= 2) {
        const value = this.parseNumeric(tokens[1]);
        return Number.isFinite(value) ? value : null;
      }

      if (i + 1 < lines.length) {
        const next = this.tokenize(this.stripInlineComment(lines[i + 1].trim()));
        if (next.length > 0) {
          const value = this.parseNumeric(next[0]);
          return Number.isFinite(value) ? value : null;
        }
      }
    }
    return null;
  }

  private stripInlineComment(line: string): string {
    const idx = line.indexOf(' #');
    return idx >= 0 ? line.slice(0, idx).trim() : line;
  }

  private tokenize(line: string): string[] {
    if (!line) {
      return [];
    }
    return (line.match(/(?:'[^']*'|"[^"]*"|\S+)/g) || []).map((token) =>
      token.replace(/^['"]|['"]$/g, '')
    );
  }

  private parseMultilineValue(lines: string[], index: number): string {
    const first = lines[index].trim();
    const chunks: string[] = [first.slice(1).trimStart()];
    for (let i = index + 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith(';')) {
        break;
      }
      chunks.push(line.trim());
    }
    return chunks.join('\n').trim();
  }

  private getRowValue(row: string[], idx: number): string {
    if (idx < 0 || idx >= row.length) {
      return '';
    }
    return row[idx];
  }

  private parseNumeric(value: string): number {
    const raw = (value || '').trim();
    if (!raw || raw === '.' || raw === '?') {
      return Number.NaN;
    }
    const cleaned = raw.replace(/^['"]|['"]$/g, '');
    const uncertaintyMatch = cleaned.match(
      /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?\(\d+\)?$/
    );
    if (uncertaintyMatch) {
      const numberPart = cleaned.split('(')[0];
      return Number.parseFloat(numberPart);
    }
    return Number.parseFloat(cleaned);
  }

  private parseElementFromLabel(label: string): string | undefined {
    const match = label.match(/^[A-Za-z]+/);
    return match ? parseElement(match[0]) : undefined;
  }
}
