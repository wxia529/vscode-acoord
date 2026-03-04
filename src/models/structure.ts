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
  private atomIndex: Map<string, Atom> = new Map();
  manualBonds: Array<[string, string]> = [];
  suppressedAutoBonds: Array<[string, string]> = [];
  unitCell?: UnitCell;
  isCrystal: boolean = false;
  supercell: [number, number, number] = [1, 1, 1];
  metadata: Map<string, unknown> = new Map();

  constructor(name: string = 'Untitled', isCrystal: boolean = false) {
    this.id = `struct_${crypto.randomUUID()}`;
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
    this.atomIndex.set(atom.id, atom);
  }

  /**
   * Remove an atom by ID
   */
  removeAtom(atomId: string): void {
    this.atoms = this.atoms.filter((a) => a.id !== atomId);
    this.atomIndex.delete(atomId);
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
   * Get atom by ID - O(1) lookup using Map index
   */
  getAtom(atomId: string): Atom | undefined {
    return this.atomIndex.get(atomId);
  }

  /**
   * Get list of bonds based on covalent radii
   * Uses spatial hashing for O(n) performance instead of O(n²)
   */
  private static readonly BOND_TOLERANCE = 1.1; // 10% tolerance for covalent radii comparison
  private static readonly MAX_COVALENT_RADIUS = 2.5; // Maximum covalent radius in Angstroms

  private buildSpatialHash(cellSize: number): Map<string, Atom[]> {
    const grid = new Map<string, Atom[]>();
    for (const atom of this.atoms) {
      const cx = Math.floor(atom.x / cellSize);
      const cy = Math.floor(atom.y / cellSize);
      const cz = Math.floor(atom.z / cellSize);
      const key = `${cx},${cy},${cz}`;
      const cell = grid.get(key);
      if (cell) {
        cell.push(atom);
      } else {
        grid.set(key, [atom]);
      }
    }
    return grid;
  }

  private *getNeighboringAtoms(
    atom: Atom,
    grid: Map<string, Atom[]>,
    cellSize: number,
    maxDistance: number
  ): Generator<Atom> {
    const cx = Math.floor(atom.x / cellSize);
    const cy = Math.floor(atom.y / cellSize);
    const cz = Math.floor(atom.z / cellSize);
    const range = Math.ceil(maxDistance / cellSize);

    for (let dx = -range; dx <= range; dx++) {
      for (let dy = -range; dy <= range; dy++) {
        for (let dz = -range; dz <= range; dz++) {
          const key = `${cx + dx},${cy + dy},${cz + dz}`;
          const cell = grid.get(key);
          if (cell) {
            for (const other of cell) {
              if (other.id !== atom.id) {
                yield other;
              }
            }
          }
        }
      }
    }
  }

  getBonds(): Array<{ atomId1: string; atomId2: string; distance: number; manual: boolean }> {
    const bonds: Array<{ atomId1: string; atomId2: string; distance: number; manual: boolean }> = [];
    const tolerance = Structure.BOND_TOLERANCE;
    const suppressed = new Set(this.suppressedAutoBonds.map(([a, b]) => Structure.bondKey(a, b)));
    const seen = new Set<string>();

    // Pre-compute element symbols and covalent radii to avoid repeated lookups
    const atomData = new Map<string, { symbol: string; radius: number }>();
    let maxBondLength = 0;
    for (const atom of this.atoms) {
      const symbol = parseElement(atom.element) || atom.element;
      const radius = ELEMENT_DATA[symbol]?.covalentRadius || 1.5;
      atomData.set(atom.id, { symbol, radius });
      maxBondLength = Math.max(maxBondLength, radius * 2 * tolerance);
    }
    maxBondLength = Math.max(maxBondLength, Structure.MAX_COVALENT_RADIUS * 2);

    // Build spatial hash with cell size equal to max bond length
    const cellSize = maxBondLength;
    const grid = this.buildSpatialHash(cellSize);

    // Check bonds using spatial hash - only check neighbors in nearby cells
    for (const atom1 of this.atoms) {
      const data1 = atomData.get(atom1.id)!;
      const radius1 = data1.radius;

      for (const atom2 of this.getNeighboringAtoms(atom1, grid, cellSize, maxBondLength)) {
        // Only process each pair once (avoid duplicates and self-pairs)
        if (atom1.id >= atom2.id) {
          continue;
        }

        const data2 = atomData.get(atom2.id)!;
        const radius2 = data2.radius;
        const bondLength = (radius1 + radius2) * tolerance;

        // Quick distance check using squared distance to avoid sqrt
        const dx = atom1.x - atom2.x;
        const dy = atom1.y - atom2.y;
        const dz = atom1.z - atom2.z;
        const distanceSq = dx * dx + dy * dy + dz * dz;

        if (distanceSq < bondLength * bondLength) {
          const key = Structure.bondKey(atom1.id, atom2.id);
          if (suppressed.has(key) || seen.has(key)) {
            continue;
          }
          bonds.push({
            atomId1: atom1.id,
            atomId2: atom2.id,
            distance: Math.sqrt(distanceSq),
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
    cloned.metadata = new Map(this.metadata);
    return cloned;
  }

  /**
   * Rebuild the atom index - called after bulk operations
   */
  rebuildAtomIndex(): void {
    this.atomIndex.clear();
    for (const atom of this.atoms) {
      this.atomIndex.set(atom.id, atom);
    }
  }

  /**
   * Get the number of atoms in the index (for debugging/testing)
   */
  getAtomIndexSize(): number {
    return this.atomIndex.size;
  }

  /**
   * Get periodic bonds using spatial hashing for O(n) performance
   * This is the periodic equivalent of getBonds() for crystal structures
   */
  getPeriodicBonds(): Array<{ atomId1: string; atomId2: string; distance: number; manual: boolean; image?: [number, number, number] }> {
    if (!this.isCrystal || !this.unitCell) {
      return [];
    }

    const bonds: Array<{ atomId1: string; atomId2: string; distance: number; manual: boolean; image?: [number, number, number] }> = [];
    const tolerance = Structure.BOND_TOLERANCE;
    const suppressed = new Set(this.suppressedAutoBonds.map(([a, b]) => Structure.bondKey(a, b)));
    const manualSet = new Set(this.manualBonds.map(([a, b]) => Structure.bondKey(a, b)));
    const seen = new Set<string>();
    const vectors = this.unitCell.getLatticeVectors();

    // Pre-compute element symbols and covalent radii
    const atomData = new Map<string, { symbol: string; radius: number }>();
    let maxBondLength = 0;
    for (const atom of this.atoms) {
      const symbol = parseElement(atom.element) || atom.element;
      const radius = ELEMENT_DATA[symbol]?.covalentRadius || 1.5;
      atomData.set(atom.id, { symbol, radius });
      maxBondLength = Math.max(maxBondLength, radius * 2 * tolerance);
    }
    maxBondLength = Math.max(maxBondLength, Structure.MAX_COVALENT_RADIUS * 2);

    // Build spatial hash for base atoms (unit cell at origin)
    const cellSize = maxBondLength;
    const grid = this.buildSpatialHash(cellSize);

    // Generate periodic images to check (-1, 0, +1 in each direction)
    const offsets: Array<[number, number, number]> = [];
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        for (let oz = -1; oz <= 1; oz++) {
          offsets.push([ox, oy, oz]);
        }
      }
    }

    const isHalfSpace = (ox: number, oy: number, oz: number) =>
      ox > 0 || (ox === 0 && oy > 0) || (ox === 0 && oy === 0 && oz > 0);

    // Check bonds for each atom against neighbors in all periodic images
    for (const atom1 of this.atoms) {
      const data1 = atomData.get(atom1.id)!;
      const radius1 = data1.radius;

      // Check against all periodic images
      for (const [ox, oy, oz] of offsets) {
        // Skip redundant checks using half-space rule
        if (ox === 0 && oy === 0 && oz === 0) {
          // Same cell - only check atoms with higher index to avoid duplicates
          for (const atom2 of this.getNeighboringAtoms(atom1, grid, cellSize, maxBondLength)) {
            if (atom1.id >= atom2.id) {continue;}

            const data2 = atomData.get(atom2.id)!;
            const radius2 = data2.radius;
            const bondLength = (radius1 + radius2) * tolerance;

            const dx = atom1.x - atom2.x;
            const dy = atom1.y - atom2.y;
            const dz = atom1.z - atom2.z;
            const distanceSq = dx * dx + dy * dy + dz * dz;

            if (distanceSq < bondLength * bondLength) {
              const key = Structure.bondKey(atom1.id, atom2.id);
              if (suppressed.has(key) || seen.has(key)) {continue;}
              bonds.push({
                atomId1: atom1.id,
                atomId2: atom2.id,
                distance: Math.sqrt(distanceSq),
                manual: manualSet.has(key),
                image: [0, 0, 0],
              });
              seen.add(key);
            }
          }
        } else if (isHalfSpace(ox, oy, oz)) {
          // Different cell - use spatial hash of image atoms for O(n*k) performance
          const offsetX = ox * vectors[0][0] + oy * vectors[1][0] + oz * vectors[2][0];
          const offsetY = ox * vectors[0][1] + oy * vectors[1][1] + oz * vectors[2][1];
          const offsetZ = ox * vectors[0][2] + oy * vectors[1][2] + oz * vectors[2][2];

          // Build spatial hash for this image (atoms shifted by periodic offset)
          const imageGrid = new Map<string, Atom[]>();
          for (const atom of this.atoms) {
            const ix = Math.floor((atom.x + offsetX) / cellSize);
            const iy = Math.floor((atom.y + offsetY) / cellSize);
            const iz = Math.floor((atom.z + offsetZ) / cellSize);
            const ck = `${ix},${iy},${iz}`;
            const bucket = imageGrid.get(ck);
            if (bucket) { bucket.push(atom); } else { imageGrid.set(ck, [atom]); }
          }

          // Query neighbors of atom1 from image hash
          const cx1 = Math.floor(atom1.x / cellSize);
          const cy1 = Math.floor(atom1.y / cellSize);
          const cz1 = Math.floor(atom1.z / cellSize);
          const range = Math.ceil(maxBondLength / cellSize);
          for (let ddx = -range; ddx <= range; ddx++) {
            for (let ddy = -range; ddy <= range; ddy++) {
              for (let ddz = -range; ddz <= range; ddz++) {
                const bucket = imageGrid.get(`${cx1 + ddx},${cy1 + ddy},${cz1 + ddz}`);
                if (!bucket) {continue;}
                for (const atom2 of bucket) {
                  const data2 = atomData.get(atom2.id)!;
                  const radius2 = data2.radius;
                  const bondLength = (radius1 + radius2) * tolerance;

                  const dx = (atom2.x + offsetX) - atom1.x;
                  const dy = (atom2.y + offsetY) - atom1.y;
                  const dz = (atom2.z + offsetZ) - atom1.z;
                  const distanceSq = dx * dx + dy * dy + dz * dz;

                  if (distanceSq < bondLength * bondLength) {
                    const key = Structure.bondKey(atom1.id, atom2.id);
                    if (suppressed.has(key) || seen.has(key)) {continue;}
                    bonds.push({
                      atomId1: atom1.id,
                      atomId2: atom2.id,
                      distance: Math.sqrt(distanceSq),
                      manual: false,
                      image: [ox, oy, oz],
                    });
                    seen.add(key);
                  }
                }
              }
            }
          }
        }
      }
    }

    return bonds;
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
      metadata: Array.from(this.metadata.entries()),
    };
  }

  /**
   * Reconstruct a Structure from the plain-object representation produced by
   * `toJSON()`.  Used to restore hot-exit backups.
   */
  static fromJSON(data: ReturnType<Structure['toJSON']>): Structure {
    const s = new Structure(data.name, data.isCrystal);
    // Preserve the original id so references (e.g. undo entries) stay valid.
    s.id = data.id;
    for (const a of data.atoms) {
      const atom = new Atom(a.element, a.x, a.y, a.z, a.id, a.color);
      atom.fixed = a.fixed ?? false;
      if (a.selectiveDynamics) {
        atom.selectiveDynamics = a.selectiveDynamics;
      }
      s.addAtom(atom);
    }
    s.manualBonds = data.manualBonds ?? [];
    s.suppressedAutoBonds = data.suppressedAutoBonds ?? [];
    if (data.unitCell) {
      const uc = data.unitCell;
      s.unitCell = new UnitCell(uc.a, uc.b, uc.c, uc.alpha, uc.beta, uc.gamma);
    }
    s.supercell = data.supercell ?? [1, 1, 1];
    s.metadata = new Map(data.metadata ?? []);
    return s;
  }
}
