import { Structure } from '../../models/structure.js';
import { Atom } from '../../models/atom.js';
import { parseElement, getDefaultAtomColor, getDefaultAtomRadius } from '../../utils/elementData.js';
import { StructureParser } from './structureParser.js';

/**
 * ORCA input file parser (.inp)
 * Minimal support: * xyz charge mult ... *
 * Lattice data (if any) is ignored.
 */
export class ORCAParser extends StructureParser {
  parse(content: string): Structure {
    // Save complete raw content for format preservation (Strategy 1)
    const rawContent = content;
    
    const lines = content.split(/\r?\n/);
    const startIndex = lines.findIndex((line) =>
      /^\*\s*xyz\b/i.test(line.trim())
    );

    if (startIndex < 0) {
      throw new Error('Invalid ORCA input: missing "* xyz" block');
    }

    const headerLine = lines[startIndex].trim();
    const parts = headerLine.split(/\s+/);
    let charge = 0;
    let multiplicity = 1;

    if (parts.length >= 4) {
      charge = parseInt(parts[parts.length - 2], 10);
      multiplicity = parseInt(parts[parts.length - 1], 10);
    }

    const structure = new Structure('');
    structure.metadata.set('charge', charge);
    structure.metadata.set('multiplicity', multiplicity);
    
    // Store raw content in metadata for serialization
    structure.metadata.set('orcaRawContent', rawContent);

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
      structure.addAtom(new Atom(element, x, y, z, undefined, {
        color: getDefaultAtomColor(element),
        radius: getDefaultAtomRadius(element),
      }));
    }

    return structure;
  }

  serialize(structure: Structure): string {
    // Strategy 1: Use saved raw content and replace coordinate section
    const savedRawContent = structure.metadata.get('orcaRawContent') as string | undefined;
    if (!savedRawContent) {
      // Fallback to default generation if no raw content saved
      return this.generateDefaultORCA(structure);
    }

    // Replace charge/multiplicity and coordinate section
    return this.replaceORCASections(savedRawContent, structure);
  }

  private generateDefaultORCA(structure: Structure): string {
    const lines: string[] = [];
    lines.push('! B3LYP D3 def2-SVP');
    lines.push('%maxcore     8192');
    lines.push('%pal nprocs   8 end');

    const charge = structure.metadata.get('charge') as number ?? 0;
    const multiplicity = structure.metadata.get('multiplicity') as number ?? 1;
    lines.push(`* xyz ${charge} ${multiplicity}`);
    for (const atom of structure.atoms) {
      lines.push(
        `${atom.element}  ${atom.x.toFixed(10)}  ${atom.y.toFixed(10)}  ${atom.z.toFixed(10)}`
      );
    }
    lines.push('*');
    return lines.join('\n');
  }

  private replaceORCASections(rawContent: string, structure: Structure): string {
    const lines = rawContent.split(/\r?\n/);
    const resultLines: string[] = [];
    
    const charge = structure.metadata.get('charge') as number ?? 0;
    const multiplicity = structure.metadata.get('multiplicity') as number ?? 1;

    let i = 0;
    let inCoordinates = false;
    let coordsWritten = false;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      // Find * xyz line
      if (!inCoordinates && /^\*\s*xyz\b/i.test(trimmed)) {
        // Update charge/multiplicity in the line
        const parts = trimmed.split(/\s+/);
        if (parts.length >= 4) {
          const updatedParts = [...parts];
          updatedParts[parts.length - 2] = charge.toString();
          updatedParts[parts.length - 1] = multiplicity.toString();
          resultLines.push(updatedParts.join(' '));
        } else {
          resultLines.push(line);
        }
        i++;
        inCoordinates = true;
        continue;
      }

      // In coordinate section - skip old coordinates until closing *
      if (inCoordinates && !coordsWritten) {
        if (trimmed.startsWith('*') && trimmed !== '* xyz') {
          // Closing * - write coordinates before it
          coordsWritten = true;
          this.writeORCACoordinates(resultLines, structure);
          resultLines.push(line);
          i++;
          continue;
        }
        // Skip old coordinate line
        i++;
        continue;
      }

      // Copy other lines unchanged
      resultLines.push(line);
      i++;
    }

    // If coordinates were not found (missing closing *), append them
    if (!coordsWritten && inCoordinates) {
      this.writeORCACoordinates(resultLines, structure);
      resultLines.push('*');
    }

    return resultLines.join('\n');
  }

  private writeORCACoordinates(lines: string[], structure: Structure): void {
    for (const atom of structure.atoms) {
      lines.push(
        `${atom.element}  ${atom.x.toFixed(10)}  ${atom.y.toFixed(10)}  ${atom.z.toFixed(10)}`
      );
    }
  }
}
