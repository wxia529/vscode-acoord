"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.XYZParser = void 0;
const structure_1 = require("../../models/structure");
const atom_1 = require("../../models/atom");
const unitCell_1 = require("../../models/unitCell");
const elementData_1 = require("../../utils/elementData");
/**
 * XYZ file format parser
 * Format:
 * <number_of_atoms>
 * <comment>
 * <element> <x> <y> <z>
 * ...
 */
class XYZParser {
    parse(content) {
        const lines = content.trim().split('\n');
        if (lines.length < 3) {
            throw new Error('Invalid XYZ format: insufficient lines');
        }
        const atomCount = parseInt(lines[0].trim());
        if (isNaN(atomCount)) {
            throw new Error('Invalid XYZ format: first line must be atom count');
        }
        const comment = lines[1] || '';
        const structure = new structure_1.Structure(comment || 'Imported XYZ');
        const latticeVectors = this.parseLatticeFromComment(comment);
        if (latticeVectors) {
            structure.isCrystal = true;
            structure.unitCell = this.unitCellFromLattice(latticeVectors);
        }
        const properties = this.parsePropertiesFromComment(comment);
        const speciesIndex = properties?.speciesIndex ?? 0;
        const positionIndex = properties?.positionIndex ?? 1;
        for (let i = 2; i < 2 + atomCount && i < lines.length; i++) {
            const parts = lines[i].trim().split(/\s+/);
            if (parts.length < 4) {
                continue;
            }
            const elementToken = parts[speciesIndex];
            const element = (0, elementData_1.parseElement)(elementToken);
            if (!element) {
                console.warn(`Unknown element: ${elementToken}`);
                continue;
            }
            const x = parseFloat(parts[positionIndex]);
            const y = parseFloat(parts[positionIndex + 1]);
            const z = parseFloat(parts[positionIndex + 2]);
            if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
                structure.addAtom(new atom_1.Atom(element, x, y, z));
            }
        }
        return structure;
    }
    serialize(structure) {
        const lines = [];
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
            lines.push(`${atom.element}  ${atom.x.toFixed(10)}  ${atom.y.toFixed(10)}  ${atom.z.toFixed(10)}`);
        }
        return lines.join('\n');
    }
    parseLatticeFromComment(comment) {
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
    unitCellFromLattice(vectors) {
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
        return new unitCell_1.UnitCell(cellA, cellB, cellC, alpha, beta, gamma);
    }
    parsePropertiesFromComment(comment) {
        const match = comment.match(/Properties\s*=\s*([^\s]+)/i);
        if (!match) {
            return null;
        }
        const spec = match[1].trim();
        const parts = spec.split(':');
        const fields = [];
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
exports.XYZParser = XYZParser;
//# sourceMappingURL=xyzParser.js.map