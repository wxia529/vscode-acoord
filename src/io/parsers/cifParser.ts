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
    this.applySymmetryOperations(lines, structure);

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

  private applySymmetryOperations(lines: string[], structure: Structure): void {
    if (!structure.unitCell || structure.atoms.length === 0) {
      return;
    }
    const operations = this.parseSymmetryOperations(lines);
    if (operations.length <= 1) {
      return;
    }

    const sourceAtoms = structure.atoms.slice();
    const expandedAtoms: Atom[] = [];
    const seen = new Set<string>();
    for (const atom of sourceAtoms) {
      const [fx, fy, fz] = structure.unitCell.cartesianToFractional(atom.x, atom.y, atom.z);
      for (const operation of operations) {
        const transformed = this.applySymmetryOperation(operation, fx, fy, fz);
        if (!transformed) {
          continue;
        }
        const nx = this.normalizeFractional(transformed[0]);
        const ny = this.normalizeFractional(transformed[1]);
        const nz = this.normalizeFractional(transformed[2]);
        const key = this.makeSymmetryDedupKey(atom.element, nx, ny, nz);
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        const [x, y, z] = structure.unitCell.fractionalToCartesian(nx, ny, nz);
        expandedAtoms.push(new Atom(atom.element, x, y, z, undefined, atom.color));
      }
    }

    if (expandedAtoms.length > 0) {
      structure.atoms = expandedAtoms;
    }
  }

  private parseSymmetryOperations(lines: string[]): string[] {
    const operations: string[] = [];
    const seen = new Set<string>();
    const addOperation = (raw: string) => {
      const cleaned = raw.trim().replace(/^['"]|['"]$/g, '').replace(/\s+/g, '');
      if (!cleaned || cleaned === '.' || cleaned === '?') {
        return;
      }
      if (seen.has(cleaned)) {
        return;
      }
      seen.add(cleaned);
      operations.push(cleaned);
    };

    const operationHeaders = new Set([
      '_symmetry_equiv_pos_as_xyz',
      '_space_group_symop_operation_xyz',
      '_space_group_symop.operation_xyz',
    ]);

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
      const opIdx = headers.findIndex((header) => operationHeaders.has(header));
      if (opIdx < 0) {
        continue;
      }
      for (const row of rows.rows) {
        const op = this.getRowValue(row, opIdx);
        addOperation(op);
      }
    }

    if (operations.length === 0) {
      operations.push('x,y,z');
    }

    return operations;
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

  private applySymmetryOperation(
    operation: string,
    x: number,
    y: number,
    z: number
  ): [number, number, number] | null {
    const parts = operation.split(',');
    if (parts.length !== 3) {
      return null;
    }
    const nx = this.evaluateSymmetryExpression(parts[0], x, y, z);
    const ny = this.evaluateSymmetryExpression(parts[1], x, y, z);
    const nz = this.evaluateSymmetryExpression(parts[2], x, y, z);
    if (!Number.isFinite(nx) || !Number.isFinite(ny) || !Number.isFinite(nz)) {
      return null;
    }
    return [nx, ny, nz];
  }

  private evaluateSymmetryExpression(expr: string, x: number, y: number, z: number): number {
    const normalized = expr.trim().toLowerCase().replace(/\s+/g, '');
    if (!normalized) {
      return Number.NaN;
    }

    const terms = normalized.match(/[+-]?[^+-]+/g);
    if (!terms || terms.length === 0) {
      return Number.NaN;
    }

    let result = 0;
    for (const rawTerm of terms) {
      if (!rawTerm) {
        continue;
      }
      const sign = rawTerm.startsWith('-') ? -1 : 1;
      const term = rawTerm.startsWith('+') || rawTerm.startsWith('-')
        ? rawTerm.slice(1)
        : rawTerm;
      if (!term) {
        continue;
      }

      const variable = term.endsWith('x')
        ? 'x'
        : term.endsWith('y')
          ? 'y'
          : term.endsWith('z')
            ? 'z'
            : null;

      if (variable) {
        const coeffRaw = term.slice(0, -1);
        const coeff = coeffRaw ? this.parseFraction(coeffRaw) : 1;
        if (!Number.isFinite(coeff)) {
          return Number.NaN;
        }
        const varValue = variable === 'x' ? x : variable === 'y' ? y : z;
        result += sign * coeff * varValue;
      } else {
        const constant = this.parseFraction(term);
        if (!Number.isFinite(constant)) {
          return Number.NaN;
        }
        result += sign * constant;
      }
    }

    return result;
  }

  private parseFraction(raw: string): number {
    const value = raw.trim();
    if (!value) {
      return Number.NaN;
    }
    const parts = value.split('/');
    if (parts.length === 2) {
      const numerator = Number.parseFloat(parts[0]);
      const denominator = Number.parseFloat(parts[1]);
      if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || Math.abs(denominator) < 1e-12) {
        return Number.NaN;
      }
      return numerator / denominator;
    }
    if (parts.length > 2) {
      return Number.NaN;
    }
    return Number.parseFloat(value);
  }

  private normalizeFractional(value: number): number {
    if (!Number.isFinite(value)) {
      return value;
    }
    let wrapped = value - Math.floor(value);
    if (Math.abs(wrapped) < 1e-10 || Math.abs(wrapped - 1) < 1e-10) {
      wrapped = 0;
    }
    return wrapped;
  }

  private makeSymmetryDedupKey(element: string, x: number, y: number, z: number): string {
    const round = (value: number) => Math.round(value * 1e6) / 1e6;
    return `${element}|${round(x)}|${round(y)}|${round(z)}`;
  }

  private parseElementFromLabel(label: string): string | undefined {
    const match = label.match(/^[A-Za-z]+/);
    return match ? parseElement(match[0]) : undefined;
  }
}
