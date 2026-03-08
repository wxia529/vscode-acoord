import { Structure } from '../../models/structure.js';
import { Atom } from '../../models/atom.js';
import { UnitCell } from '../../models/unitCell.js';
import { parseElement, getDefaultAtomColor, getDefaultAtomRadius } from '../../utils/elementData.js';
import { StructureParser } from './structureParser.js';

/**
 * XYZ file format parser
 * Format:
 * <number_of_atoms>
 * <comment>
 * <element> <x> <y> <z>
 * ...
 */
export class XYZParser extends StructureParser {
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

      // Store raw content in metadata for serialization (Strategy 1)
      // Save the complete frame content
      const frameStart = i;
      const frameEnd = i + 2 + atomCount;
      const frameContent = lines.slice(frameStart, Math.min(frameEnd, lines.length)).join('\n');
      structure.metadata.set('xyzRawContent', frameContent);
      structure.metadata.set('xyzFullContent', content);

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
        structure.addAtom(new Atom(element, x, y, z, undefined, {
          color: getDefaultAtomColor(element),
          radius: getDefaultAtomRadius(element),
        }));
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
    // Strategy 1: Use saved raw content and replace coordinate section
    const savedRawContent = structure.metadata.get('xyzRawContent') as string | undefined;
    if (!savedRawContent) {
      // Fallback to default generation if no raw content saved
      return this.generateDefaultXYZ(structure);
    }

    // Replace comment and coordinate section
    return this.replaceXYZSections(savedRawContent, structure);
  }

  private generateDefaultXYZ(structure: Structure): string {
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

  private replaceXYZSections(rawContent: string, structure: Structure): string {
    const lines = rawContent.split(/\r?\n/);
    const resultLines: string[] = [];
    
    // Line 0: atom count (keep original)
    if (lines.length > 0) {
      resultLines.push(lines[0]);
    }
    
    // Line 1: comment (keep original)
    if (lines.length > 1) {
      resultLines.push(lines[1]);
    }
    
    // Write new coordinates
    for (const atom of structure.atoms) {
      resultLines.push(
        `${atom.element}  ${atom.x.toFixed(10)}  ${atom.y.toFixed(10)}  ${atom.z.toFixed(10)}`
      );
    }

    return resultLines.join('\n');
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
    return UnitCell.fromVectors(vectors);
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
