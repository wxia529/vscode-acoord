"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POSCARParser = exports.CIFParser = exports.XYZParser = void 0;
const structure_1 = require("../models/structure");
const atom_1 = require("../models/atom");
const unitCell_1 = require("../models/unitCell");
const elementData_1 = require("../utils/elementData");
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
        const comment = lines[1];
        const structure = new structure_1.Structure(comment || 'Imported XYZ');
        for (let i = 2; i < 2 + atomCount && i < lines.length; i++) {
            const parts = lines[i].trim().split(/\s+/);
            if (parts.length < 4) {
                continue;
            }
            const element = (0, elementData_1.parseElement)(parts[0]);
            if (!element) {
                console.warn(`Unknown element: ${parts[0]}`);
                continue;
            }
            const x = parseFloat(parts[1]);
            const y = parseFloat(parts[2]);
            const z = parseFloat(parts[3]);
            if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
                structure.addAtom(new atom_1.Atom(element, x, y, z));
            }
        }
        return structure;
    }
    serialize(structure) {
        const lines = [];
        lines.push(structure.atoms.length.toString());
        lines.push(structure.name);
        for (const atom of structure.atoms) {
            lines.push(`${atom.element}  ${atom.x.toFixed(10)}  ${atom.y.toFixed(10)}  ${atom.z.toFixed(10)}`);
        }
        return lines.join('\n');
    }
}
exports.XYZParser = XYZParser;
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
/**
 * POSCAR file format parser (VASP)
 */
class POSCARParser {
    parse(content) {
        const lines = content.trim().split('\n');
        if (lines.length < 9) {
            throw new Error('Invalid POSCAR format');
        }
        const structure = new structure_1.Structure(lines[0].trim(), true);
        // Line 2: scaling factor
        const scaleFactor = parseFloat(lines[1]);
        // Lines 3-5: lattice vectors
        const a = this.parseVector(lines[2]).map((v) => v * scaleFactor);
        const b = this.parseVector(lines[3]).map((v) => v * scaleFactor);
        const c = this.parseVector(lines[4]).map((v) => v * scaleFactor);
        // Compute cell parameters from lattice vectors
        const cellA = Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
        const cellB = Math.sqrt(b[0] * b[0] + b[1] * b[1] + b[2] * b[2]);
        const cellC = Math.sqrt(c[0] * c[0] + c[1] * c[1] + c[2] * c[2]);
        const dotAB = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
        const dotAC = a[0] * c[0] + a[1] * c[1] + a[2] * c[2];
        const dotBC = b[0] * c[0] + b[1] * c[1] + b[2] * c[2];
        const gamma = Math.acos(dotAB / (cellA * cellB)) * (180 / Math.PI);
        const beta = Math.acos(dotAC / (cellA * cellC)) * (180 / Math.PI);
        const alpha = Math.acos(dotBC / (cellB * cellC)) * (180 / Math.PI);
        structure.unitCell = new unitCell_1.UnitCell(cellA, cellB, cellC, alpha, beta, gamma);
        // Line 6: element types
        const elementLine = lines[5].trim().split(/\s+/);
        const elements = [];
        for (const el of elementLine) {
            const parsed = (0, elementData_1.parseElement)(el);
            if (parsed)
                elements.push(parsed);
        }
        // Line 7: number of atoms per type
        const countLine = lines[6].trim().split(/\s+/);
        const counts = countLine.map((c) => parseInt(c));
        // Determine coordinate type
        let coordType = 'Direct';
        if (lines.length > 8) {
            coordType = lines[8].trim().charAt(0).toUpperCase();
        }
        // Parse atoms
        const atomLines = lines.slice(8);
        let atomIdx = 0;
        let currentElementIdx = 0;
        let currentElementCount = 0;
        for (const line of atomLines) {
            if (!line.trim())
                continue;
            const parts = line.trim().split(/\s+/);
            if (parts.length < 3)
                continue;
            let x = parseFloat(parts[0]);
            let y = parseFloat(parts[1]);
            let z = parseFloat(parts[2]);
            if (isNaN(x) || isNaN(y) || isNaN(z))
                continue;
            // Convert to Cartesian if fractional
            if (coordType === 'D' || coordType === 'F') {
                const cartX = x * a[0] + y * b[0] + z * c[0];
                const cartY = x * a[1] + y * b[1] + z * c[1];
                const cartZ = x * a[2] + y * b[2] + z * c[2];
                x = cartX;
                y = cartY;
                z = cartZ;
            }
            if (currentElementIdx < elements.length) {
                const element = elements[currentElementIdx];
                structure.addAtom(new atom_1.Atom(element, x, y, z));
                currentElementCount++;
                if (currentElementIdx < counts.length &&
                    currentElementCount >= counts[currentElementIdx]) {
                    currentElementIdx++;
                    currentElementCount = 0;
                }
            }
        }
        return structure;
    }
    serialize(structure) {
        const lines = [];
        lines.push(structure.name);
        lines.push('1.0'); // scaling factor
        // Write lattice vectors
        if (structure.unitCell) {
            const vectors = structure.unitCell.getLatticeVectors();
            for (const vec of vectors) {
                lines.push(`${vec[0].toFixed(10)}  ${vec[1].toFixed(10)}  ${vec[2].toFixed(10)}`);
            }
        }
        else {
            lines.push('1.0  0.0  0.0');
            lines.push('0.0  1.0  0.0');
            lines.push('0.0  0.0  1.0');
        }
        // Element symbols
        const elementCounts = {};
        for (const atom of structure.atoms) {
            elementCounts[atom.element] = (elementCounts[atom.element] || 0) + 1;
        }
        const elements = Object.keys(elementCounts);
        lines.push(elements.join(' '));
        lines.push(elements.map((e) => elementCounts[e]).join(' '));
        // Coordinate type
        lines.push('Direct');
        // Atoms
        for (const atom of structure.atoms) {
            lines.push(`${atom.x.toFixed(10)}  ${atom.y.toFixed(10)}  ${atom.z.toFixed(10)}`);
        }
        return lines.join('\n');
    }
    parseVector(line) {
        return line.trim().split(/\s+/).map((x) => parseFloat(x));
    }
}
exports.POSCARParser = POSCARParser;
//# sourceMappingURL=parser.js.map