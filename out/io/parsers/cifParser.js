"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CIFParser = void 0;
const structure_1 = require("../../models/structure");
const atom_1 = require("../../models/atom");
const unitCell_1 = require("../../models/unitCell");
const elementData_1 = require("../../utils/elementData");
/**
 * CIF file format parser (basic implementation)
 * Crystallographic Information File
 */
class CIFParser {
    parse(content) {
        const structure = new structure_1.Structure('Imported CIF', true);
        // Parse unit cell parameters
        const cellA = this.extractValue(content, '_cell_length_a');
        const cellB = this.extractValue(content, '_cell_length_b');
        const cellC = this.extractValue(content, '_cell_length_c');
        const cellAlpha = this.extractValue(content, '_cell_angle_alpha');
        const cellBeta = this.extractValue(content, '_cell_angle_beta');
        const cellGamma = this.extractValue(content, '_cell_angle_gamma');
        if (cellA && cellB && cellC) {
            structure.unitCell = new unitCell_1.UnitCell(cellA, cellB, cellC, cellAlpha || 90, cellBeta || 90, cellGamma || 90);
        }
        // Parse atom positions
        const lines = content.split('\n');
        let inAtomLoop = false;
        const atomLineBuffer = [];
        let labelIdx = -1, typeIdx = -1, xIdx = -1, yIdx = -1, zIdx = -1, cartXIdx = -1, cartYIdx = -1, cartZIdx = -1;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.includes('loop_')) {
                inAtomLoop = false;
            }
            if (line.startsWith('_atom_site')) {
                inAtomLoop = true;
                // Reset indices
                labelIdx = typeIdx = xIdx = yIdx = zIdx = -1;
                cartXIdx = cartYIdx = cartZIdx = -1;
                let colIdx = 0;
                // Parse column headers
                while (i + 1 < lines.length) {
                    const header = lines[i].trim();
                    if (!header.startsWith('_atom_site'))
                        break;
                    if (header.includes('_atom_site_label'))
                        labelIdx = colIdx;
                    else if (header.includes('_atom_site_type_symbol'))
                        typeIdx = colIdx;
                    else if (header.includes('_atom_site_fract_x'))
                        xIdx = colIdx;
                    else if (header.includes('_atom_site_fract_y'))
                        yIdx = colIdx;
                    else if (header.includes('_atom_site_fract_z'))
                        zIdx = colIdx;
                    else if (header.includes('_atom_site_cartn_x'))
                        cartXIdx = colIdx;
                    else if (header.includes('_atom_site_cartn_y'))
                        cartYIdx = colIdx;
                    else if (header.includes('_atom_site_cartn_z'))
                        cartZIdx = colIdx;
                    colIdx++;
                    i++;
                }
                i--;
                continue;
            }
            if (inAtomLoop &&
                line &&
                !line.startsWith('#') &&
                !line.startsWith('_')) {
                atomLineBuffer.push(line);
                const parts = line.split(/\s+/);
                const element = typeIdx >= 0 && typeIdx < parts.length
                    ? (0, elementData_1.parseElement)(parts[typeIdx])
                    : this.parseElementFromLabel(labelIdx >= 0 ? parts[labelIdx] : parts[0]);
                if (element) {
                    const hasCart = cartXIdx >= 0 && cartYIdx >= 0 && cartZIdx >= 0;
                    const hasFrac = xIdx >= 0 && yIdx >= 0 && zIdx >= 0;
                    let x = 0;
                    let y = 0;
                    let z = 0;
                    if (hasCart) {
                        x = this.parseNumeric(parts[cartXIdx]);
                        y = this.parseNumeric(parts[cartYIdx]);
                        z = this.parseNumeric(parts[cartZIdx]);
                    }
                    else if (hasFrac) {
                        x = this.parseNumeric(parts[xIdx]);
                        y = this.parseNumeric(parts[yIdx]);
                        z = this.parseNumeric(parts[zIdx]);
                        if (structure.unitCell) {
                            const [aVec, bVec, cVec] = structure.unitCell.getLatticeVectors();
                            const cartX = x * aVec[0] + y * bVec[0] + z * cVec[0];
                            const cartY = x * aVec[1] + y * bVec[1] + z * cVec[1];
                            const cartZ = x * aVec[2] + y * bVec[2] + z * cVec[2];
                            x = cartX;
                            y = cartY;
                            z = cartZ;
                        }
                    }
                    if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
                        structure.addAtom(new atom_1.Atom(element, x, y, z));
                    }
                }
            }
        }
        if (structure.atoms.length === 0 && atomLineBuffer.length > 0) {
            const hasCart = cartXIdx >= 0 && cartYIdx >= 0 && cartZIdx >= 0;
            const useFractional = !hasCart && Boolean(structure.unitCell);
            for (const rawLine of atomLineBuffer) {
                const parts = rawLine.split(/\s+/);
                const element = (0, elementData_1.parseElement)(parts[parts.length - 1]) ||
                    this.parseElementFromLabel(parts[0]);
                if (!element) {
                    continue;
                }
                const numericVals = parts
                    .map((value) => this.parseNumeric(value))
                    .filter((value) => !isNaN(value));
                if (numericVals.length < 3) {
                    continue;
                }
                let x = numericVals[numericVals.length - 3];
                let y = numericVals[numericVals.length - 2];
                let z = numericVals[numericVals.length - 1];
                if (useFractional && structure.unitCell) {
                    const [aVec, bVec, cVec] = structure.unitCell.getLatticeVectors();
                    const cartX = x * aVec[0] + y * bVec[0] + z * cVec[0];
                    const cartY = x * aVec[1] + y * bVec[1] + z * cVec[1];
                    const cartZ = x * aVec[2] + y * bVec[2] + z * cVec[2];
                    x = cartX;
                    y = cartY;
                    z = cartZ;
                }
                structure.addAtom(new atom_1.Atom(element, x, y, z));
            }
        }
        return structure;
    }
    serialize(structure) {
        const lines = [];
        lines.push('data_structure');
        lines.push('');
        // Write unit cell
        if (structure.unitCell) {
            const uc = structure.unitCell;
            lines.push(`_cell_length_a    ${uc.a.toFixed(6)}`);
            lines.push(`_cell_length_b    ${uc.b.toFixed(6)}`);
            lines.push(`_cell_length_c    ${uc.c.toFixed(6)}`);
            lines.push(`_cell_angle_alpha ${uc.alpha.toFixed(6)}`);
            lines.push(`_cell_angle_beta  ${uc.beta.toFixed(6)}`);
            lines.push(`_cell_angle_gamma ${uc.gamma.toFixed(6)}`);
            lines.push('');
        }
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
            lines.push(`${atom.element}${idx + 1}  ${atom.element}  ${fx.toFixed(10)}  ${fy.toFixed(10)}  ${fz.toFixed(10)}`);
        });
        return lines.join('\n');
    }
    extractValue(content, key) {
        const regex = new RegExp(`${key}\\s+([\\d.]+)`, 'i');
        const match = content.match(regex);
        return match ? parseFloat(match[1]) : null;
    }
    parseNumeric(value) {
        const cleaned = value.replace(/[()]/g, '').replace(/\?/, '').trim();
        return parseFloat(cleaned);
    }
    parseElementFromLabel(label) {
        const match = label.match(/^[A-Za-z]+/);
        return match ? (0, elementData_1.parseElement)(match[0]) : undefined;
    }
}
exports.CIFParser = CIFParser;
//# sourceMappingURL=cifParser.js.map