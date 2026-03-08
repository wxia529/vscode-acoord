import { structureStore, selectionStore, adsorptionStore } from '../state';
import { getAtomById } from '../utils/measurements';
import { hasAtomSizeOverride } from '../utils/atomSize';
import type { Atom, VsCodeApi } from '../types';

export function parseBondPairFromKey(bondKey: string): [string, string] | null {
  if (!bondKey || typeof bondKey !== 'string') { return null; }
  const parts = bondKey.split('|');
  if (parts.length !== 2 || !parts[0] || !parts[1]) { return null; }
  return [parts[0], parts[1]];
}

export function getSelectedBondKeys(): string[] {
  const keys = Array.isArray(selectionStore.selectedBondKeys) ? selectionStore.selectedBondKeys : [];
  return keys.filter((key: string) => typeof key === 'string' && key.trim().length > 0);
}

export function updateBondSelectionUI(): void {
  const label = document.getElementById('bond-selected') as HTMLElement | null;
  const deleteBtn = document.getElementById('btn-delete-bond') as HTMLButtonElement | null;
  if (!label || !deleteBtn) { return; }
  const selectedBondKeys = getSelectedBondKeys();
  if (selectedBondKeys.length === 0) {
    label.textContent = '--';
  } else if (selectedBondKeys.length === 1) {
    const pair = parseBondPairFromKey(selectedBondKeys[0]);
    if (!pair) {
      label.textContent = selectedBondKeys[0];
    } else {
      const atom1 = getAtomById(pair[0]);
      const atom2 = getAtomById(pair[1]);
      const left = atom1 ? `${atom1.element}(${pair[0].slice(-4)})` : pair[0];
      const right = atom2 ? `${atom2.element}(${pair[1].slice(-4)})` : pair[1];
      label.textContent = `${left} - ${right}`;
    }
  } else {
    label.textContent = `${selectedBondKeys.length} bonds selected`;
  }
  deleteBtn.disabled = !(
    selectedBondKeys.length > 0 ||
    (selectionStore.selectedAtomIds && selectionStore.selectedAtomIds.length >= 2)
  );
}

export function setSelectedBondSelection(bondKeys: string[], syncBackend: boolean, vscode: VsCodeApi): void {
  const normalized = Array.from(
    new Set((Array.isArray(bondKeys) ? bondKeys : [])
      .filter((key) => typeof key === 'string' && key.trim().length > 0))
  );
  selectionStore.selectedBondKeys = normalized;
  structureStore.currentSelectedBondKey = normalized.length > 0 ? normalized[normalized.length - 1] : null;
  updateBondSelectionUI();
  if (syncBackend) {
    vscode.postMessage({ command: 'setBondSelection', bondKeys: normalized });
  }
}

export function handleBondSelect(bondKey: string | null, add: boolean, syncBackend: boolean, vscode: VsCodeApi): void {
  if (!bondKey) {
    setSelectedBondSelection([], syncBackend, vscode);
    return;
  }
  const current = getSelectedBondKeys();
  if (add) {
    const next = current.includes(bondKey)
      ? current.filter((key) => key !== bondKey)
      : [...current, bondKey];
    setSelectedBondSelection(next, syncBackend, vscode);
    return;
  }
  setSelectedBondSelection([bondKey], syncBackend, vscode);
}

export function applyBondSelectionFromKeys(bondKeys: string[], mode: string, vscode: VsCodeApi): void {
  const incoming = Array.isArray(bondKeys) ? bondKeys : [];
  const current = getSelectedBondKeys();
  const nextSet = new Set<string>();
  if (mode === 'add') {
    for (const key of current) nextSet.add(key);
    for (const key of incoming) nextSet.add(key);
  } else if (mode === 'subtract') {
    for (const key of current) nextSet.add(key);
    for (const key of incoming) nextSet.delete(key);
  } else {
    for (const key of incoming) nextSet.add(key);
  }
  setSelectedBondSelection(Array.from(nextSet), true, vscode);
}

export function updateAtomList(
  atoms: Atom[],
  selectedIds: string[],
  selectedId: string | null,
  vscode: VsCodeApi,
  callbacks: {
    updateSelectedInputs: (atom: Atom | null) => void;
    updateAtomColorPreview: () => void;
    updateMeasurements: () => void;
    updateAdsorptionUI: () => void;
    updateAtomSizePanel: () => void;
    updateStatusBar: () => void;
    updatePropertiesPanel: () => void;
  }
): void {
  const derivedSelectedIds = atoms.filter((atom) => atom.selected).map((atom) => atom.id);
  const fallbackIds = selectionStore.selectedAtomIds || [];
  const effectiveSelectedId =
    selectedId ||
    selectedIds[selectedIds.length - 1] ||
    derivedSelectedIds[derivedSelectedIds.length - 1] ||
    fallbackIds[fallbackIds.length - 1] ||
    null;
  const normalizedSelectedIds =
    selectedIds.length > 0
      ? selectedIds
      : derivedSelectedIds.length > 0
        ? derivedSelectedIds
        : fallbackIds.length > 0
          ? fallbackIds
          : effectiveSelectedId
            ? [effectiveSelectedId]
            : [];

  const atomList = document.getElementById('atom-list') as HTMLElement | null;
  if (atomList) {
    atomList.innerHTML = '';
    atoms.forEach((atom, index) => {
      const item = document.createElement('div');
      const isSelected = normalizedSelectedIds.includes(atom.id);
      const hasSizeOverride = hasAtomSizeOverride(atom.id);
      item.className = 'atom-item'
        + (isSelected ? ' selected' : '')
        + (hasSizeOverride ? ' size-override' : '');
      item.textContent = atom.element + ' #' + (index + 1);
      item.title = atom.id;
      item.addEventListener('click', (event: MouseEvent) =>
        handleSelect(atom.id, (event.ctrlKey || event.metaKey), false, vscode, callbacks));
      atomList.appendChild(item);
    });
  }

  const selected = atoms.find((atom) => atom.id === effectiveSelectedId) || null;
  structureStore.currentSelectedAtom = selected;
  selectionStore.selectedAtomIds = normalizedSelectedIds;
  if (normalizedSelectedIds.length >= 2) {
    adsorptionStore.adsorptionReferenceId = normalizedSelectedIds[normalizedSelectedIds.length - 1];
    adsorptionStore.adsorptionAdsorbateIds = normalizedSelectedIds.slice(0, -1);
  } else {
    adsorptionStore.adsorptionReferenceId = null;
    adsorptionStore.adsorptionAdsorbateIds = normalizedSelectedIds.slice();
  }
  callbacks.updateSelectedInputs(selected);
  callbacks.updateAtomColorPreview();
  callbacks.updateMeasurements();
  callbacks.updateAdsorptionUI();
  callbacks.updateAtomSizePanel();
  callbacks.updateStatusBar();
  callbacks.updatePropertiesPanel();
}

export function handleSelect(
  atomId: string,
  add: boolean,
  preserve: boolean,
  vscode: VsCodeApi,
  callbacks: {
    updateSelectedInputs: (atom: Atom | null) => void;
    updateAtomColorPreview: () => void;
    updateMeasurements: () => void;
    updateAdsorptionUI: () => void;
    updateAtomSizePanel: () => void;
    updateStatusBar: () => void;
    updatePropertiesPanel: () => void;
  }
): void {
  if (!structureStore.currentStructure || !structureStore.currentStructure.atoms) {
    vscode.postMessage({ command: 'selectAtom', atomId, add: !!add });
    return;
  }
  const atoms = structureStore.currentStructure.atoms;
  let next = add || preserve ? [...selectionStore.selectedAtomIds] : [];
  const alreadySelected = next.includes(atomId);
  if (preserve && alreadySelected) {
    // Keep current selection when shift-dragging a selected atom.
  } else if (alreadySelected) {
    next = next.filter((id) => id !== atomId);
  } else {
    next.push(atomId);
  }
  for (const atom of atoms) {
    atom.selected = next.includes(atom.id);
  }
  const selectedId = next.length > 0 ? next[next.length - 1] : null;
  updateAtomList(atoms, next, selectedId, vscode, callbacks);
  setSelectedBondSelection([], false, vscode);
  if (!(preserve && alreadySelected)) {
    vscode.postMessage({ command: 'selectAtom', atomId, add: !!add });
  }
}

export function applySelectionFromIds(
  atomIds: string[],
  mode: string,
  vscode: VsCodeApi,
  callbacks: {
    updateSelectedInputs: (atom: Atom | null) => void;
    updateAtomColorPreview: () => void;
    updateMeasurements: () => void;
    updateAdsorptionUI: () => void;
    updateAtomSizePanel: () => void;
    updateStatusBar: () => void;
    updatePropertiesPanel: () => void;
  }
): void {
  if (!structureStore.currentStructure || !structureStore.currentStructure.atoms) { return; }
  const currentIds = selectionStore.selectedAtomIds || [];
  const nextSet = new Set<string>();
  if (mode === 'add') {
    for (const id of currentIds) nextSet.add(id);
    for (const id of atomIds) nextSet.add(id);
  } else if (mode === 'subtract') {
    for (const id of currentIds) nextSet.add(id);
    for (const id of atomIds) nextSet.delete(id);
  } else {
    for (const id of atomIds) nextSet.add(id);
  }

  const atoms = structureStore.currentStructure.atoms;
  const next: string[] = [];
  for (const atom of atoms) {
    const selected = nextSet.has(atom.id);
    atom.selected = selected;
    if (selected) { next.push(atom.id); }
  }
  const selectedId = next.length > 0 ? next[next.length - 1] : null;
  updateAtomList(atoms, next, selectedId, vscode, callbacks);
  setSelectedBondSelection([], false, vscode);
  vscode.postMessage({ command: 'setSelection', atomIds: next });
}