import { RenderMessageBuilder } from '../renderers/renderMessageBuilder';
import { Structure } from '../models/structure';
import { UndoManager } from '../providers/undoManager';
import { TrajectoryManager } from '../providers/trajectoryManager';
import { SelectionService } from './selectionService';

export class BondService {
  constructor(
    private renderer: RenderMessageBuilder,
    private trajectoryManager: TrajectoryManager,
    private undoManager: UndoManager,
    private selectionService: SelectionService
  ) {}

  createBond(atomId1: string, atomId2: string): void {
    if (!this.trajectoryManager.isEditing) {
      this.trajectoryManager.beginEdit();
    }
    const editStructure = this.trajectoryManager.activeStructure;
    
    if (!editStructure.getAtom(atomId1) || !editStructure.getAtom(atomId2) || atomId1 === atomId2) {
      return;
    }

    this.undoManager.push(editStructure);
    editStructure.addManualBond(atomId1, atomId2);
    this.renderer.setStructure(editStructure);
    this.selectionService.selectBond(Structure.bondKey(atomId1, atomId2));
    this.trajectoryManager.commitEdit();
  }

  deleteBond(bondKey?: string, atomIds?: string[], bondKeys?: string[]): void {
    const selectedPairs: Array<[string, string]> = [];

    if (bondKeys && Array.isArray(bondKeys)) {
      for (const bk of bondKeys) {
        if (typeof bk !== 'string') continue;
        const pair = Structure.bondKeyToPair(bk);
        if (pair) {
          selectedPairs.push(pair);
        }
      }
    }

    if (selectedPairs.length === 0) {
      let pair: [string, string] | null = null;
      if (typeof bondKey === 'string') {
        pair = Structure.bondKeyToPair(bondKey);
      }
      if (!pair && atomIds && Array.isArray(atomIds) && atomIds.length >= 2) {
        pair = Structure.normalizeBondPair(atomIds[0], atomIds[1]);
      }
      if (pair) {
        selectedPairs.push(pair);
      }
    }

    if (selectedPairs.length === 0) {
      return;
    }

    if (!this.trajectoryManager.isEditing) {
      this.trajectoryManager.beginEdit();
    }
    const editStructure = this.trajectoryManager.activeStructure;
    
    this.undoManager.push(editStructure);
    for (const pair of selectedPairs) {
      editStructure.removeBond(pair[0], pair[1]);
    }
    this.renderer.setStructure(editStructure);
    this.selectionService.deselectBond();
    this.trajectoryManager.commitEdit();
  }

  recalculateBonds(): void {
    if (!this.trajectoryManager.isEditing) {
      this.trajectoryManager.beginEdit();
    }
    const editStructure = this.trajectoryManager.activeStructure;
    
    this.undoManager.push(editStructure);
    editStructure.manualBonds = [];
    editStructure.suppressedAutoBonds = [];
    this.renderer.setStructure(editStructure);
    this.selectionService.deselectBond();
    this.trajectoryManager.commitEdit();
  }

  setBondLength(atomIds: string[], length: number): void {
    if (atomIds.length < 2 || typeof length !== 'number') {
      return;
    }

    if (!this.trajectoryManager.isEditing) {
      this.trajectoryManager.beginEdit();
    }
    const editStructure = this.trajectoryManager.activeStructure;
    
    const atomA = editStructure.getAtom(atomIds[0]);
    const atomB = editStructure.getAtom(atomIds[1]);
    
    if (!atomA || !atomB) {
      return;
    }

    this.undoManager.push(editStructure);
    const dx = atomB.x - atomA.x;
    const dy = atomB.y - atomA.y;
    const dz = atomB.z - atomA.z;
    const current = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    if (current > 1e-6) {
      const scale = length / current;
      atomB.setPosition(
        atomA.x + dx * scale,
        atomA.y + dy * scale,
        atomA.z + dz * scale
      );
      this.renderer.setStructure(editStructure);
      this.trajectoryManager.commitEdit();
    }
  }
}
