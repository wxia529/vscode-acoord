"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STRUParser = void 0;
const structure_1 = require("../../models/structure");
const atom_1 = require("../../models/atom");
const unitCell_1 = require("../../models/unitCell");
const elementData_1 = require("../../utils/elementData");
const elementData_2 = require("../../utils/elementData");
const BOHR_TO_ANGSTROM = 0.52917721092;
const ANGSTROM_TO_BOHR = 1 / BOHR_TO_ANGSTROM;
/**
 * ABACUS STRU file parser (basic support)
 */
class STRUParser {
    parse(content) {
        const lines = content.split(/\r?\n/);
        const structure = new structure_1.Structure('Imported STRU');
        let latticeConstantBohr = null;
        let latticeVectors = null;
        let i = 0;
        while (i < lines.length) {
            const rawLine = lines[i];
            const line = this.cleanLine(rawLine);
            if (!line) {
                i++;
                continue;
            }
            const upper = line.toUpperCase();
            if (upper === 'LATTICE_CONSTANT') {
                i++;
                while (i < lines.length && !this.cleanLine(lines[i]))
                    i++;
                if (i < lines.length) {
                    const value = parseFloat(this.cleanLine(lines[i]));
                    if (Number.isFinite(value)) {
                        latticeConstantBohr = value;
                    }
                }
                i++;
                continue;
            }
            if (upper === 'LATTICE_VECTORS') {
                const vectors = [];
                i++;
                while (i < lines.length && vectors.length < 3) {
                    const vecLine = this.cleanLine(lines[i]);
                    if (!vecLine) {
                        i++;
                        continue;
                    }
                    const parts = vecLine.split(/\s+/).slice(0, 3);
                    if (parts.length === 3) {
                        const nums = parts.map((value) => parseFloat(value));
                        if (nums.every((value) => Number.isFinite(value))) {
                            vectors.push(nums);
                        }
                    }
                    i++;
                }
                if (vectors.length === 3) {
                    latticeVectors = vectors;
                }
                continue;
            }
            if (upper === 'ATOMIC_POSITIONS') {
                i++;
                while (i < lines.length && !this.cleanLine(lines[i]))
                    i++;
                if (i >= lines.length) {
                    break;
                }
                const coordType = this.cleanLine(lines[i]);
                i++;
                const coordMode = coordType.toLowerCase();
                const hasLattice = latticeVectors && latticeConstantBohr;
                let latticeVectorsAng = null;
                if (hasLattice && latticeVectors && latticeConstantBohr) {
                    latticeVectorsAng = latticeVectors.map((vec) => vec.map((value) => value * latticeConstantBohr * BOHR_TO_ANGSTROM));
                    structure.isCrystal = true;
                    structure.unitCell = this.unitCellFromLattice(latticeVectorsAng);
                }
                while (i < lines.length) {
                    const elementLine = this.cleanLine(lines[i]);
                    if (!elementLine) {
                        i++;
                        continue;
                    }
                    if (this.isSectionHeader(elementLine)) {
                        break;
                    }
                    const element = (0, elementData_2.parseElement)(elementLine.split(/\s+/)[0]);
                    i++;
                    if (!element || i >= lines.length) {
                        continue;
                    }
                    // Magnetism line (ignored)
                    i++;
                    if (i >= lines.length) {
                        break;
                    }
                    const countLine = this.cleanLine(lines[i]);
                    const count = parseInt(countLine, 10);
                    i++;
                    if (!Number.isFinite(count)) {
                        continue;
                    }
                    for (let n = 0; n < count && i < lines.length; n++, i++) {
                        const posLine = this.cleanLine(lines[i]);
                        if (!posLine) {
                            n--;
                            continue;
                        }
                        const parts = posLine.split(/\s+/);
                        if (parts.length < 3) {
                            continue;
                        }
                        let x = parseFloat(parts[0]);
                        let y = parseFloat(parts[1]);
                        let z = parseFloat(parts[2]);
                        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
                            continue;
                        }
                        let fixed = false;
                        const moveFlags = this.parseMoveFlags(parts.slice(3));
                        if (moveFlags) {
                            fixed = moveFlags.every((flag) => flag === 0);
                        }
                        if (coordMode.startsWith('direct')) {
                            if (latticeVectorsAng) {
                                const cart = this.fracToCart(x, y, z, latticeVectorsAng);
                                x = cart[0];
                                y = cart[1];
                                z = cart[2];
                            }
                        }
                        else if (coordMode.startsWith('cartesian_au')) {
                            x *= BOHR_TO_ANGSTROM;
                            y *= BOHR_TO_ANGSTROM;
                            z *= BOHR_TO_ANGSTROM;
                        }
                        else if (coordMode.startsWith('cartesian_angstrom')) {
                            const center = this.getCenterOffset(coordMode, latticeVectorsAng);
                            if (center) {
                                x += center[0];
                                y += center[1];
                                z += center[2];
                            }
                        }
                        else if (coordMode.startsWith('cartesian')) {
                            const scale = latticeConstantBohr ? latticeConstantBohr * BOHR_TO_ANGSTROM : 1;
                            x *= scale;
                            y *= scale;
                            z *= scale;
                        }
                        const atom = new atom_1.Atom(element, x, y, z);
                        atom.fixed = fixed;
                        structure.addAtom(atom);
                    }
                }
                continue;
            }
            i++;
        }
        return structure;
    }
    serialize(structure) {
        const lines = [];
        const elements = this.collectElementGroups(structure);
        lines.push('ATOMIC_SPECIES');
        for (const [element] of elements) {
            const mass = this.getAtomicMass(element);
            lines.push(`${element}  ${mass.toFixed(3)}  ${element}.upf`);
        }
        lines.push('');
        lines.push('LATTICE_CONSTANT');
        const latticeConstantBohr = ANGSTROM_TO_BOHR;
        lines.push(latticeConstantBohr.toFixed(6));
        lines.push('');
        if (structure.unitCell) {
            lines.push('LATTICE_VECTORS');
            const vectors = structure.unitCell.getLatticeVectors();
            for (const vec of vectors) {
                lines.push(`${vec[0].toFixed(12)}  ${vec[1].toFixed(12)}  ${vec[2].toFixed(12)}`);
            }
            lines.push('');
        }
        lines.push('ATOMIC_POSITIONS');
        if (structure.unitCell) {
            lines.push('Direct');
        }
        else {
            lines.push('Cartesian_angstrom');
        }
        for (const [element, atoms] of elements) {
            lines.push('');
            lines.push(element);
            lines.push('0.0');
            lines.push(String(atoms.length));
            for (const atom of atoms) {
                let x = atom.x;
                let y = atom.y;
                let z = atom.z;
                if (structure.unitCell) {
                    const frac = structure.unitCell.cartesianToFractional(atom.x, atom.y, atom.z);
                    x = frac[0];
                    y = frac[1];
                    z = frac[2];
                }
                const flag = atom.fixed ? '0 0 0' : '1 1 1';
                lines.push(`${x.toFixed(12)}  ${y.toFixed(12)}  ${z.toFixed(12)}  ${flag}`);
            }
        }
        return lines.join('\n');
    }
    cleanLine(line) {
        if (!line)
            return '';
        const withoutComment = line.split('//')[0];
        return withoutComment.trim();
    }
    isSectionHeader(value) {
        const upper = value.toUpperCase();
        return [
            'ATOMIC_SPECIES',
            'NUMERICAL_ORBITAL',
            'LATTICE_CONSTANT',
            'LATTICE_VECTORS',
            'LATTICE_PARAMETERS',
            'ATOMIC_POSITIONS',
        ].includes(upper);
    }
    parseMoveFlags(parts) {
        if (parts.length >= 3 && parts[0] !== 'm') {
            const nums = parts.slice(0, 3).map((value) => parseInt(value, 10));
            if (nums.every((value) => value === 0 || value === 1)) {
                return nums;
            }
        }
        const mIndex = parts.findIndex((part) => part.toLowerCase() === 'm');
        if (mIndex >= 0 && parts.length >= mIndex + 4) {
            const nums = parts.slice(mIndex + 1, mIndex + 4).map((value) => parseInt(value, 10));
            if (nums.every((value) => value === 0 || value === 1)) {
                return nums;
            }
        }
        return null;
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
    fracToCart(x, y, z, vectors) {
        const cartX = x * vectors[0][0] + y * vectors[1][0] + z * vectors[2][0];
        const cartY = x * vectors[0][1] + y * vectors[1][1] + z * vectors[2][1];
        const cartZ = x * vectors[0][2] + y * vectors[1][2] + z * vectors[2][2];
        return [cartX, cartY, cartZ];
    }
    getCenterOffset(mode, vectors) {
        if (!vectors)
            return null;
        if (mode.includes('center_xyz')) {
            return this.fracToCart(0.5, 0.5, 0.5, vectors);
        }
        if (mode.includes('center_xy')) {
            return this.fracToCart(0.5, 0.5, 0.0, vectors);
        }
        if (mode.includes('center_xz')) {
            return this.fracToCart(0.5, 0.0, 0.5, vectors);
        }
        if (mode.includes('center_yz')) {
            return this.fracToCart(0.0, 0.5, 0.5, vectors);
        }
        return null;
    }
    collectElementGroups(structure) {
        const groups = new Map();
        for (const atom of structure.atoms) {
            const list = groups.get(atom.element) || [];
            list.push(atom);
            groups.set(atom.element, list);
        }
        return Array.from(groups.entries());
    }
    getAtomicMass(element) {
        const info = elementData_1.ELEMENT_DATA[element];
        return info?.atomicMass ?? 1.0;
    }
}
exports.STRUParser = STRUParser;
//# sourceMappingURL=struParser.js.map