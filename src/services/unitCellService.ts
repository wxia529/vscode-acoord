import * as vscode from 'vscode';
import { RenderMessageBuilder } from '../renderers/renderMessageBuilder';
import { UnitCell } from '../models/unitCell';
import { UndoManager } from '../providers/undoManager';
import { TrajectoryManager } from '../providers/trajectoryManager';

export interface UnitCellParams {
  a: number;
  b: number;
  c: number;
  alpha: number;
  beta: number;
  gamma: number;
}

export class UnitCellService {
  constructor(
    private renderer: RenderMessageBuilder,
    private trajectoryManager: TrajectoryManager,
    private undoManager: UndoManager
  ) {}

  toggleUnitCell(): void {
    const showUnitCell = !this.renderer.getState().showUnitCell;
    this.renderer.setShowUnitCell(showUnitCell);
  }

  setUnitCell(params: UnitCellParams, scaleAtoms: boolean = false): boolean {
    const { a, b, c, alpha, beta, gamma } = params;
    const isValid =
      [a, b, c, alpha, beta, gamma].every((value) => Number.isFinite(value)) &&
      a > 0 && b > 0 && c > 0 &&
      alpha > 0 && beta > 0 && gamma > 0 &&
      alpha < 180 && beta < 180 && gamma < 180;

    if (!isValid) {
      return false;
    }

    if (!this.trajectoryManager.isEditing) {
      this.trajectoryManager.beginEdit();
    }
    const editStructure = this.trajectoryManager.activeStructure;
    
    this.undoManager.push(editStructure);
    const oldCell = editStructure.unitCell;
    const nextCell = new UnitCell(a, b, c, alpha, beta, gamma);
    
    if (scaleAtoms && oldCell) {
      for (const atom of editStructure.atoms) {
        const frac = oldCell.cartesianToFractional(atom.x, atom.y, atom.z);
        const cart = nextCell.fractionalToCartesian(frac[0], frac[1], frac[2]);
        atom.setPosition(cart[0], cart[1], cart[2]);
      }
    }
    
    editStructure.unitCell = nextCell;
    editStructure.isCrystal = true;
    if (!editStructure.supercell) {
      editStructure.supercell = [1, 1, 1];
    }
    
    this.renderer.setStructure(editStructure);
    this.renderer.setShowUnitCell(true);
    this.trajectoryManager.commitEdit();
    return true;
  }

  clearUnitCell(): void {
    if (!this.trajectoryManager.isEditing) {
      this.trajectoryManager.beginEdit();
    }
    const editStructure = this.trajectoryManager.activeStructure;
    
    this.undoManager.push(editStructure);
    editStructure.unitCell = undefined;
    editStructure.isCrystal = false;
    editStructure.supercell = [1, 1, 1];
    this.renderer.setStructure(editStructure);
    this.renderer.setShowUnitCell(false);
    this.trajectoryManager.commitEdit();
  }

  async centerToUnitCell(): Promise<boolean> {
    const centerStructure = this.trajectoryManager.activeStructure;
    
    if (!centerStructure.unitCell) {
      vscode.window.showErrorMessage('Centering requires a unit cell.');
      return false;
    }
    
    if (centerStructure.atoms.length === 0) {
      return true;
    }

    const confirm = await vscode.window.showWarningMessage(
      'Center all atoms in the unit cell? This will move every atom.',
      { modal: true },
      'Center'
    );
    
    if (confirm !== 'Center') {
      return false;
    }

    if (!this.trajectoryManager.isEditing) {
      this.trajectoryManager.beginEdit();
    }
    const editStructure = this.trajectoryManager.activeStructure;
    
    this.undoManager.push(editStructure);
    
    let cx = 0, cy = 0, cz = 0;
    for (const atom of editStructure.atoms) {
      cx += atom.x;
      cy += atom.y;
      cz += atom.z;
    }
    
    const count = editStructure.atoms.length;
    const geomCenter: [number, number, number] = [cx / count, cy / count, cz / count];
    const vectors = editStructure.unitCell!.getLatticeVectors();
    const cellCenter: [number, number, number] = [
      0.5 * (vectors[0][0] + vectors[1][0] + vectors[2][0]),
      0.5 * (vectors[0][1] + vectors[1][1] + vectors[2][1]),
      0.5 * (vectors[0][2] + vectors[1][2] + vectors[2][2]),
    ];
    
    const dx = cellCenter[0] - geomCenter[0];
    const dy = cellCenter[1] - geomCenter[1];
    const dz = cellCenter[2] - geomCenter[2];
    
    editStructure.translate(dx, dy, dz);
    this.renderer.setStructure(editStructure);
    this.trajectoryManager.commitEdit();
    return true;
  }

  setSupercell(supercell: [number, number, number]): void {
    const nx = Math.max(1, Math.floor(Number(supercell[0]) || 1));
    const ny = Math.max(1, Math.floor(Number(supercell[1]) || 1));
    const nz = Math.max(1, Math.floor(Number(supercell[2]) || 1));
    
    const scStructure = this.trajectoryManager.activeStructure;
    
    if (!scStructure.unitCell) {
      scStructure.supercell = [1, 1, 1];
    } else {
      scStructure.supercell = [nx, ny, nz];
    }
    
    this.renderer.setStructure(scStructure);
  }
}
