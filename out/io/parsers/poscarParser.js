"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POSCARParser = void 0;
const structure_1 = require("../../models/structure");
const atom_1 = require("../../models/atom");
const unitCell_1 = require("../../models/unitCell");
const elementData_1 = require("../../utils/elementData");
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
        let coordLineIndex = 7;
        let coordType = 'Direct';
        let hasSelectiveDynamics = false;
        if (lines.length > coordLineIndex) {
            const line = lines[coordLineIndex].trim();
            if (line.charAt(0).toUpperCase() === 'S') {
                hasSelectiveDynamics = true;
                coordLineIndex += 1;
            }
        }
        if (lines.length > coordLineIndex) {
            const line = lines[coordLineIndex].trim();
            const firstChar = line.charAt(0).toUpperCase();
            if (firstChar === 'C' || firstChar === 'K') {
                coordType = 'C';
            }
            else if (firstChar === 'D') {
                coordType = 'D';
            }
        }
        // Parse atoms
        const atomLines = lines.slice(coordLineIndex + 1);
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
                const atom = new atom_1.Atom(element, x, y, z);
                if (hasSelectiveDynamics && parts.length >= 6) {
                    const flags = parts.slice(3, 6).map((value) => value.toUpperCase());
                    const isFixed = flags.every((flag) => flag.startsWith('F'));
                    atom.fixed = isFixed;
                }
                structure.addAtom(atom);
                currentElementCount++;
                if (currentElementIdx < counts.length &&
                    currentElementCount >= counts[currentElementIdx]) {
                    currentElementIdx++;
                    currentElementCount = 0;
                }
            }
            atomIdx++;
        }
        return structure;
    }
    serialize(structure) {
        const lines = [];
        lines.push('vasp format');
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
        const hasFixed = structure.atoms.some((atom) => atom.fixed);
        if (hasFixed) {
            lines.push('Selective dynamics');
        }
        // Coordinate type
        lines.push('Direct');
        // Atoms
        for (const atom of structure.atoms) {
            let fx = atom.x;
            let fy = atom.y;
            let fz = atom.z;
            if (structure.unitCell) {
                const frac = structure.unitCell.cartesianToFractional(atom.x, atom.y, atom.z);
                fx = frac[0];
                fy = frac[1];
                fz = frac[2];
            }
            let line = `${fx.toFixed(10)}  ${fy.toFixed(10)}  ${fz.toFixed(10)}`;
            if (hasFixed) {
                line += atom.fixed ? '  F  F  F' : '  T  T  T';
            }
            lines.push(line);
        }
        return lines.join('\n');
    }
    parseVector(line) {
        return line.trim().split(/\s+/).map((x) => parseFloat(x));
    }
}
exports.POSCARParser = POSCARParser;
//# sourceMappingURL=poscarParser.js.map