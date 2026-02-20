"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Structure = void 0;
const unitCell_1 = require("./unitCell");
const elementData_1 = require("../utils/elementData");
/**
 * Represents a molecular or crystal structure
 */
class Structure {
    id;
    name;
    atoms = [];
    unitCell;
    isCrystal = false;
    supercell = [1, 1, 1];
    constructor(name = 'Untitled', isCrystal = false) {
        this.id = `struct_${Math.random().toString(36).substr(2, 9)}`;
        this.name = name;
        this.isCrystal = isCrystal;
        if (isCrystal) {
            this.unitCell = new unitCell_1.UnitCell();
        }
    }
    /**
     * Add an atom to the structure
     */
    addAtom(atom) {
        this.atoms.push(atom);
    }
    /**
     * Remove an atom by ID
     */
    removeAtom(atomId) {
        this.atoms = this.atoms.filter((a) => a.id !== atomId);
    }
    /**
     * Get atom by ID
     */
    getAtom(atomId) {
        return this.atoms.find((a) => a.id === atomId);
    }
    /**
     * Get list of bonds based on covalent radii
     */
    getBonds() {
        const bonds = [];
        const tolerance = 1.1; // 10% tolerance
        for (let i = 0; i < this.atoms.length; i++) {
            for (let j = i + 1; j < this.atoms.length; j++) {
                const atom1 = this.atoms[i];
                const atom2 = this.atoms[j];
                const distance = atom1.distanceTo(atom2);
                const radius1 = elementData_1.ELEMENT_DATA[atom1.element]?.covalentRadius || 1.5;
                const radius2 = elementData_1.ELEMENT_DATA[atom2.element]?.covalentRadius || 1.5;
                const bondLength = (radius1 + radius2) * tolerance;
                if (distance < bondLength) {
                    bonds.push({
                        atomId1: atom1.id,
                        atomId2: atom2.id,
                        distance: distance,
                    });
                }
            }
        }
        return bonds;
    }
    /**
     * Get center of mass
     */
    getCenterOfMass() {
        if (this.atoms.length === 0) {
            return [0, 0, 0];
        }
        let totalMass = 0;
        let cx = 0, cy = 0, cz = 0;
        for (const atom of this.atoms) {
            const mass = elementData_1.ELEMENT_DATA[atom.element]?.atomicMass || 1;
            cx += atom.x * mass;
            cy += atom.y * mass;
            cz += atom.z * mass;
            totalMass += mass;
        }
        return [cx / totalMass, cy / totalMass, cz / totalMass];
    }
    /**
     * Translate all atoms
     */
    translate(dx, dy, dz) {
        for (const atom of this.atoms) {
            atom.x += dx;
            atom.y += dy;
            atom.z += dz;
        }
    }
    /**
     * Center structure at origin
     */
    centerAtOrigin() {
        const [cx, cy, cz] = this.getCenterOfMass();
        this.translate(-cx, -cy, -cz);
    }
    /**
     * Generate supercell
     */
    generateSupercell(nx, ny, nz) {
        if (!this.isCrystal || !this.unitCell) {
            throw new Error('Supercell generation requires a crystal structure');
        }
        const supercell = new Structure(`${this.name}_supercell`, true);
        supercell.unitCell = new unitCell_1.UnitCell(this.unitCell.a * nx, this.unitCell.b * ny, this.unitCell.c * nz, this.unitCell.alpha, this.unitCell.beta, this.unitCell.gamma);
        const latticeVectors = this.unitCell.getLatticeVectors();
        for (let i = 0; i < nx; i++) {
            for (let j = 0; j < ny; j++) {
                for (let k = 0; k < nz; k++) {
                    const displacement = [
                        i * latticeVectors[0][0] +
                            j * latticeVectors[1][0] +
                            k * latticeVectors[2][0],
                        i * latticeVectors[0][1] +
                            j * latticeVectors[1][1] +
                            k * latticeVectors[2][1],
                        i * latticeVectors[0][2] +
                            j * latticeVectors[1][2] +
                            k * latticeVectors[2][2],
                    ];
                    for (const atom of this.atoms) {
                        const newAtom = atom.clone();
                        newAtom.x += displacement[0];
                        newAtom.y += displacement[1];
                        newAtom.z += displacement[2];
                        supercell.addAtom(newAtom);
                    }
                }
            }
        }
        return supercell;
    }
    /**
     * Clone this structure
     */
    clone() {
        const cloned = new Structure(this.name, this.isCrystal);
        for (const atom of this.atoms) {
            cloned.addAtom(atom.clone());
        }
        if (this.unitCell) {
            cloned.unitCell = this.unitCell.clone();
        }
        cloned.supercell = [...this.supercell];
        return cloned;
    }
    /**
     * Convert to JSON
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            atoms: this.atoms.map((a) => a.toJSON()),
            unitCell: this.unitCell?.toJSON(),
            isCrystal: this.isCrystal,
            supercell: this.supercell,
        };
    }
}
exports.Structure = Structure;
//# sourceMappingURL=structure.js.map