import { Structure } from '../models/structure';
import { ELEMENT_DATA, parseElement } from '../utils/elementData';

/**
 * Interface for webview messages
 */
export interface WebviewMessage {
  command: string;
  data?: any;
}

/**
 * Interface for renderer state
 */
export interface RendererState {
  structure: Structure;
  showUnitCell: boolean;
  selectedAtomId?: string;
  selectedAtomIds: string[];
}

/**
 * Three.js renderer wrapper for webview
 */
export class ThreeJSRenderer {
  private state: RendererState;

  constructor(structure: Structure) {
    this.state = {
      structure,
      showUnitCell: !!structure.unitCell,
      selectedAtomIds: [],
    };
  }

  /**
   * Get current state
   */
  getState(): RendererState {
    return this.state;
  }

  /**
   * Update structure
   */
  setStructure(structure: Structure): void {
    this.state.structure = structure;
  }

  /**
   * Set unit cell visibility
   */
  setShowUnitCell(show: boolean): void {
    this.state.showUnitCell = show;
  }

  /**
   * Select atom
   */
  selectAtom(atomId: string): void {
    this.setSelection([atomId]);
  }

  /**
   * Set full selection list
   */
  setSelection(atomIds: string[]): void {
    for (const atom of this.state.structure.atoms) {
      atom.selected = false;
    }
    const validIds: string[] = [];
    for (const id of atomIds) {
      const atom = this.state.structure.getAtom(id);
      if (atom) {
        atom.selected = true;
        validIds.push(id);
      }
    }
    this.state.selectedAtomIds = validIds;
    this.state.selectedAtomId = validIds.length > 0 ? validIds[validIds.length - 1] : undefined;
  }

  /**
   * Deselect current atom
   */
  deselectAtom(): void {
    this.setSelection([]);
  }

  /**
   * Get message for webview to render
   */
  getRenderMessage(): WebviewMessage {
    const baseAtoms = this.getAtomGeometry();
    const baseBonds = this.getBondGeometry();
    return {
      command: 'render',
      data: {
        atoms: baseAtoms,
        bonds: baseBonds,
        renderAtoms: this.getRenderAtomGeometry(baseAtoms),
        renderBonds: this.getRenderBondGeometry(baseBonds),
        unitCell: this.state.showUnitCell
          ? this.getUnitCellGeometry()
          : null,
        unitCellParams: this.getUnitCellParams(),
        supercell: this.getEffectiveSupercell(),
        selectedAtomId: this.state.selectedAtomId,
        selectedAtomIds: this.state.selectedAtomIds,
      },
    };
  }

  /**
   * Generate atom geometry data for webview
   */
  private getAtomGeometry(): any[] {
    return this.state.structure.atoms.map((atom) => {
      const symbol = parseElement(atom.element) || atom.element;
      const info = ELEMENT_DATA[symbol];
      const baseRadius = info?.covalentRadius || 0.3;
      const radius = Math.max(baseRadius * 0.35, 0.1);

      return {
        id: atom.id,
        element: symbol,
        position: [atom.x, atom.y, atom.z],
        radius: radius,
        color: info?.color || '#C0C0C0',
        selected: atom.selected,
      };
    });
  }

  /**
   * Generate bond geometry data for webview
   */
  private getBondGeometry(): any[] {
    if (this.state.structure.unitCell) {
      return this.getPeriodicBondGeometry();
    }

    const bonds = this.state.structure.getBonds();
    return bonds
      .map((bond) => {
        const atom1 = this.state.structure.getAtom(bond.atomId1);
        const atom2 = this.state.structure.getAtom(bond.atomId2);

        if (!atom1 || !atom2) {
          return null;
        }

        return {
          atomId1: atom1.id,
          atomId2: atom2.id,
          start: [atom1.x, atom1.y, atom1.z],
          end: [atom2.x, atom2.y, atom2.z],
          radius: 0.04,
          color: '#C0C0C0',
        };
      })
      .filter((b) => b !== null);
  }

  private getPeriodicBondGeometry(): any[] {
    const structure = this.state.structure;
    const unitCell = structure.unitCell;
    if (!unitCell) {
      return [];
    }

    const atoms = structure.atoms;
    const vectors = unitCell.getLatticeVectors();
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

    const bonds: any[] = [];
    const tolerance = 1.1;

    for (let i = 0; i < atoms.length; i++) {
      const atomA = atoms[i];
      const symbolA = parseElement(atomA.element) || atomA.element;
      const radiusA = ELEMENT_DATA[symbolA]?.covalentRadius || 1.5;

      for (let j = 0; j < atoms.length; j++) {
        const atomB = atoms[j];
        const symbolB = parseElement(atomB.element) || atomB.element;
        const radiusB = ELEMENT_DATA[symbolB]?.covalentRadius || 1.5;
        const bondLength = (radiusA + radiusB) * tolerance;

        for (const [ox, oy, oz] of offsets) {
          if (ox === 0 && oy === 0 && oz === 0) {
            if (j <= i) {
              continue;
            }
          } else if (!isHalfSpace(ox, oy, oz)) {
            continue;
          }

          const dx =
            atomB.x + ox * vectors[0][0] + oy * vectors[1][0] + oz * vectors[2][0] - atomA.x;
          const dy =
            atomB.y + ox * vectors[0][1] + oy * vectors[1][1] + oz * vectors[2][1] - atomA.y;
          const dz =
            atomB.z + ox * vectors[0][2] + oy * vectors[1][2] + oz * vectors[2][2] - atomA.z;

          const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (distance < bondLength) {
            bonds.push({
              atomId1: atomA.id,
              atomId2: atomB.id,
              start: [atomA.x, atomA.y, atomA.z],
              end: [atomA.x + dx, atomA.y + dy, atomA.z + dz],
              radius: 0.04,
              color: '#C0C0C0',
            });
          }
        }
      }
    }

    return bonds;
  }

  private getEffectiveSupercell(): [number, number, number] {
    if (!this.state.structure.unitCell) {
      return [1, 1, 1];
    }
    const raw = this.state.structure.supercell || [1, 1, 1];
    const nx = Math.max(1, Math.floor(raw[0] || 1));
    const ny = Math.max(1, Math.floor(raw[1] || 1));
    const nz = Math.max(1, Math.floor(raw[2] || 1));
    return [nx, ny, nz];
  }

  private getUnitCellParams(): any | null {
    if (!this.state.structure.unitCell) {
      return null;
    }
    const uc = this.state.structure.unitCell;
    return {
      a: uc.a,
      b: uc.b,
      c: uc.c,
      alpha: uc.alpha,
      beta: uc.beta,
      gamma: uc.gamma,
    };
  }

  private getRenderAtomGeometry(baseAtoms: any[]): any[] {
    const unitCell = this.state.structure.unitCell;
    const [nx, ny, nz] = this.getEffectiveSupercell();
    if (!unitCell || (nx === 1 && ny === 1 && nz === 1)) {
      return baseAtoms;
    }

    const vectors = unitCell.getLatticeVectors();
    const result: any[] = [];

    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < ny; j++) {
        for (let k = 0; k < nz; k++) {
          const dx = i * vectors[0][0] + j * vectors[1][0] + k * vectors[2][0];
          const dy = i * vectors[0][1] + j * vectors[1][1] + k * vectors[2][1];
          const dz = i * vectors[0][2] + j * vectors[1][2] + k * vectors[2][2];
          const isBaseCell = i === 0 && j === 0 && k === 0;

          for (const atom of baseAtoms) {
            result.push({
              ...atom,
              id: isBaseCell ? atom.id : `${atom.id}::${i}-${j}-${k}`,
              position: [
                atom.position[0] + dx,
                atom.position[1] + dy,
                atom.position[2] + dz,
              ],
              selectable: isBaseCell,
              selected: isBaseCell ? atom.selected : false,
            });
          }
        }
      }
    }

    return result;
  }

  private getRenderBondGeometry(baseBonds: any[]): any[] {
    const unitCell = this.state.structure.unitCell;
    const [nx, ny, nz] = this.getEffectiveSupercell();
    if (!unitCell || (nx === 1 && ny === 1 && nz === 1)) {
      return baseBonds;
    }

    const vectors = unitCell.getLatticeVectors();
    const result: any[] = [];

    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < ny; j++) {
        for (let k = 0; k < nz; k++) {
          const dx = i * vectors[0][0] + j * vectors[1][0] + k * vectors[2][0];
          const dy = i * vectors[0][1] + j * vectors[1][1] + k * vectors[2][1];
          const dz = i * vectors[0][2] + j * vectors[1][2] + k * vectors[2][2];

          for (const bond of baseBonds) {
            result.push({
              ...bond,
              start: [bond.start[0] + dx, bond.start[1] + dy, bond.start[2] + dz],
              end: [bond.end[0] + dx, bond.end[1] + dy, bond.end[2] + dz],
            });
          }
        }
      }
    }

    return result;
  }

  /**
   * Generate unit cell geometry data for webview
   */
  private getUnitCellGeometry(): any {
    if (!this.state.structure.unitCell) {
      return null;
    }

    const unitCell = this.state.structure.unitCell;
    const [nx, ny, nz] = this.getEffectiveSupercell();
    const vectors = unitCell.getLatticeVectors().map((vec, idx) => {
      const scale = idx === 0 ? nx : idx === 1 ? ny : nz;
      return [vec[0] * scale, vec[1] * scale, vec[2] * scale];
    });

    // 8 corners of the unit cell
    const corners = [
      [0, 0, 0],
      vectors[0],
      vectors[1],
      [vectors[0][0] + vectors[1][0], vectors[0][1] + vectors[1][1], vectors[0][2] + vectors[1][2]],
      vectors[2],
      [vectors[0][0] + vectors[2][0], vectors[0][1] + vectors[2][1], vectors[0][2] + vectors[2][2]],
      [vectors[1][0] + vectors[2][0], vectors[1][1] + vectors[2][1], vectors[1][2] + vectors[2][2]],
      [
        vectors[0][0] + vectors[1][0] + vectors[2][0],
        vectors[0][1] + vectors[1][1] + vectors[2][1],
        vectors[0][2] + vectors[1][2] + vectors[2][2],
      ],
    ];

    // 12 edges of the unit cell
    const edges = [
      [0, 1],
      [2, 3],
      [4, 5],
      [6, 7],
      [0, 2],
      [1, 3],
      [4, 6],
      [5, 7],
      [0, 4],
      [1, 5],
      [2, 6],
      [3, 7],
    ];

    return {
      corners,
      edges: edges.map((e) => ({
        start: corners[e[0]],
        end: corners[e[1]],
        radius: 0.08,
        color: '#FF6600',
      })),
    };
  }
}
