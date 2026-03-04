import { RenderMessageBuilder } from '../renderers/renderMessageBuilder';

export interface SelectionState {
  selectedAtomIds: string[];
  selectedBondKeys: string[];
}

export class SelectionService {
  constructor(private renderer: RenderMessageBuilder) {}

  getState(): SelectionState {
    const state = this.renderer.getState();
    return {
      selectedAtomIds: state.selectedAtomIds || [],
      selectedBondKeys: state.selectedBondKeys || [],
    };
  }

  selectAtom(atomId: string): void {
    this.renderer.selectAtom(atomId);
  }

  selectBond(bondKey?: string): void {
    this.renderer.selectBond(bondKey);
  }

  deselectAtom(): void {
    this.renderer.deselectAtom();
  }

  deselectBond(): void {
    this.renderer.deselectBond();
  }

  setSelection(atomIds: string[]): void {
    this.renderer.setSelection(atomIds);
  }

  setBondSelection(bondKeys: string[]): void {
    this.renderer.setBondSelection(bondKeys);
  }

  toggleAtomSelection(atomId: string): void {
    const current = this.getState().selectedAtomIds;
    const exists = current.includes(atomId);
    const next = exists
      ? current.filter((id) => id !== atomId)
      : [...current, atomId];
    this.setSelection(next);
  }

  toggleBondSelection(bondKey: string): void {
    const current = this.getState().selectedBondKeys;
    const next = current.includes(bondKey)
      ? current.filter((k) => k !== bondKey)
      : [...current, bondKey];
    this.setBondSelection(next);
  }

  clearSelection(): void {
    this.deselectAtom();
    this.deselectBond();
  }
}
