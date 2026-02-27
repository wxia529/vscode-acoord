import { Atom } from './atom';
import { UnitCell } from './unitCell';
import { ELEMENT_DATA, parseElement } from '../utils/elementData';

/**
 * Represents a molecular or crystal structure
 */
export class Structure {
  id: string;
  name: string;
  atoms: Atom[] = [];
  manualBonds: Array<[string, string]> = [];
  suppressedAutoBonds: Array<[string, string]> = [];
  unitCell?: UnitCell;
  isCrystal: boolean = false;
  supercell: [number, number, number] = [1, 1, 1];

  constructor(name: string = 'Untitled', isCrystal: boolean = false) {
    this.id = `struct_${Math.random().toString(36).substr(2, 9)}`;
    this.name = name;
    this.isCrystal = isCrystal;
    if (isCrystal) {
      this.unitCell = new UnitCell();
    }
  }

  /**
   * Add an atom to the structure
   */
  addAtom(atom: Atom): void {
    this.atoms.push(atom);
  }

  /**
   * Remove an atom by ID
   */
  removeAtom(atomId: string): void {
    this.atoms = this.atoms.filter((a) => a.id !== atomId);
    this.manualBonds = this.manualBonds.filter(([a, b]) => a !== atomId && b !== atomId);
    this.suppressedAutoBonds = this.suppressedAutoBonds.filter(([a, b]) => a !== atomId && b !== atomId);
  }

  static normalizeBondPair(atomId1: string, atomId2: string): [string, string] {
    return atomId1 < atomId2 ? [atomId1, atomId2] : [atomId2, atomId1];
  }

  static bondKey(atomId1: string, atomId2: string): string {
    const [a, b] = Structure.normalizeBondPair(atomId1, atomId2);
    return `${a}|${b}`;
  }

  static bondKeyToPair(key: string): [string, string] | null {
    if (!key || typeof key !== 'string') {
      return null;
    }
    const parts = key.split('|');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return null;
    }
    return Structure.normalizeBondPair(parts[0], parts[1]);
  }

  addManualBond(atomId1: string, atomId2: string): void {
    if (!this.getAtom(atomId1) || !this.getAtom(atomId2) || atomId1 === atomId2) {
      return;
    }
    const [a, b] = Structure.normalizeBondPair(atomId1, atomId2);
    this.suppressedAutoBonds = this.suppressedAutoBonds.filter(([x, y]) => !(x === a && y === b));
    const exists = this.manualBonds.some(([x, y]) => x === a && y === b);
    if (!exists) {
      this.manualBonds.push([a, b]);
    }
  }

  removeBond(atomId1: string, atomId2: string): void {
    const [a, b] = Structure.normalizeBondPair(atomId1, atomId2);
    this.manualBonds = this.manualBonds.filter(([x, y]) => !(x === a && y === b));
    const suppressed = this.suppressedAutoBonds.some(([x, y]) => x === a && y === b);
    if (!suppressed) {
      this.suppressedAutoBonds.push([a, b]);
    }
  }

  hasManualBond(atomId1: string, atomId2: string): boolean {
    const [a, b] = Structure.normalizeBondPair(atomId1, atomId2);
    return this.manualBonds.some(([x, y]) => x === a && y === b);
  }

  /**
   * Get atom by ID
   */
  getAtom(atomId: string): Atom | undefined {
    return this.atoms.find((a) => a.id === atomId);
  }

  /**
   * Get list of bonds based on covalent radii
   */
  getBonds(): Array<{ atomId1: string; atomId2: string; distance: number; manual: boolean }> {
    const bonds: Array<{ atomId1: string; atomId2: string; distance: number; manual: boolean }> = [];
    const tolerance = 1.1; // 10% tolerance
    const suppressed = new Set(this.suppressedAutoBonds.map(([a, b]) => Structure.bondKey(a, b)));
    const seen = new Set<string>();

    for (let i = 0; i < this.atoms.length; i++) {
      for (let j = i + 1; j < this.atoms.length; j++) {
        const atom1 = this.atoms[i];
        const atom2 = this.atoms[j];
        const distance = atom1.distanceTo(atom2);

        const symbol1 = parseElement(atom1.element) || atom1.element;
        const symbol2 = parseElement(atom2.element) || atom2.element;
        const radius1 = ELEMENT_DATA[symbol1]?.covalentRadius || 1.5;
        const radius2 = ELEMENT_DATA[symbol2]?.covalentRadius || 1.5;
        const bondLength = (radius1 + radius2) * tolerance;

        if (distance < bondLength) {
          const key = Structure.bondKey(atom1.id, atom2.id);
          if (suppressed.has(key) || seen.has(key)) {
            continue;
          }
          bonds.push({
            atomId1: atom1.id,
            atomId2: atom2.id,
            distance: distance,
            manual: false,
          });
          seen.add(key);
        }
      }
    }

    for (const [a, b] of this.manualBonds) {
      const atom1 = this.getAtom(a);
      const atom2 = this.getAtom(b);
      if (!atom1 || !atom2) {
        continue;
      }
      const key = Structure.bondKey(atom1.id, atom2.id);
      if (seen.has(key)) {
        continue;
      }
      bonds.push({
        atomId1: atom1.id,
        atomId2: atom2.id,
        distance: atom1.distanceTo(atom2),
        manual: true,
      });
      seen.add(key);
    }

    return bonds;
  }

  /**
   * Get center of mass
   */
  getCenterOfMass(): [number, number, number] {
    if (this.atoms.length === 0) {
      return [0, 0, 0];
    }

    let totalMass = 0;
    let cx = 0,
      cy = 0,
      cz = 0;

    for (const atom of this.atoms) {
      const symbol = parseElement(atom.element) || atom.element;
      const mass = ELEMENT_DATA[symbol]?.atomicMass || 1;
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
  translate(dx: number, dy: number, dz: number): void {
    for (const atom of this.atoms) {
      atom.x += dx;
      atom.y += dy;
      atom.z += dz;
    }
  }

  /**
   * Center structure at origin
   */
  centerAtOrigin(): void {
    const [cx, cy, cz] = this.getCenterOfMass();
    this.translate(-cx, -cy, -cz);
  }

  /**
   * Generate supercell
   */
  generateSupercell(nx: number, ny: number, nz: number): Structure {
    if (!this.isCrystal || !this.unitCell) {
      throw new Error('Supercell generation requires a crystal structure');
    }

    const supercell = new Structure(`${this.name}_supercell`, true);
    supercell.unitCell = new UnitCell(
      this.unitCell.a * nx,
      this.unitCell.b * ny,
      this.unitCell.c * nz,
      this.unitCell.alpha,
      this.unitCell.beta,
      this.unitCell.gamma
    );

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
            const newAtom = new Atom(atom.element, atom.x, atom.y, atom.z, undefined, atom.color);
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
  clone(): Structure {
    const cloned = new Structure(this.name, this.isCrystal);
    for (const atom of this.atoms) {
      cloned.addAtom(atom.clone());
    }
    cloned.manualBonds = this.manualBonds.map(([a, b]) => [a, b]);
    cloned.suppressedAutoBonds = this.suppressedAutoBonds.map(([a, b]) => [a, b]);
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
      manualBonds: this.manualBonds,
      suppressedAutoBonds: this.suppressedAutoBonds,
      unitCell: this.unitCell?.toJSON(),
      isCrystal: this.isCrystal,
      supercell: this.supercell,
    };
  }
}
