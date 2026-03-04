/**
 * Edit tab module.
 *
 * Wires: Quick Add panel, Selected Atom panel, Change Element panel,
 *        Atom Color panel, and the Delete/Copy toolbar buttons.
 *
 * setup(callbacks) must be called once during app initialisation.
 */
import { selectionStore, structureStore } from './state';
import type { VscodeContext, SelectionContext, EditContext } from './types';

/** Combined context for appEdit module */
type AppEditContext = VscodeContext & SelectionContext & EditContext;

export function setup(callbacks: AppEditContext): void {
  const { vscode, getSelectedBondKeys, normalizeHexColor, applySelectedAtomChanges } = callbacks;

  // ── Quick Add ─────────────────────────────────────────────────────────────────

  const btnAddAtom = document.getElementById('btn-add-atom') as HTMLButtonElement | null;
  const elementInput = document.getElementById('element-input') as HTMLInputElement | null;
  const btnAddAtomForm = document.getElementById('btn-add-atom-form') as HTMLButtonElement | null;

  if (btnAddAtom && elementInput) {
    btnAddAtom.onclick = () => { elementInput.focus(); };
  }

  if (btnAddAtomForm) {
    btnAddAtomForm.onclick = () => {
      const element = (document.getElementById('element-input') as HTMLInputElement | null)?.value.trim() ?? '';
      const x = parseFloat((document.getElementById('pos-x') as HTMLInputElement | null)?.value ?? '') || 0;
      const y = parseFloat((document.getElementById('pos-y') as HTMLInputElement | null)?.value ?? '') || 0;
      const z = parseFloat((document.getElementById('pos-z') as HTMLInputElement | null)?.value ?? '') || 0;
      if (element) {
        vscode.postMessage({ command: 'addAtom', element, x, y, z });
        const elInput = document.getElementById('element-input') as HTMLInputElement | null;
        const pxInput = document.getElementById('pos-x') as HTMLInputElement | null;
        const pyInput = document.getElementById('pos-y') as HTMLInputElement | null;
        const pzInput = document.getElementById('pos-z') as HTMLInputElement | null;
        if (elInput) elInput.value = '';
        if (pxInput) pxInput.value = '';
        if (pyInput) pyInput.value = '';
        if (pzInput) pzInput.value = '';
      }
    };
  }

  // ── Delete / Copy toolbar buttons ──────────────────────────────────────────

  const deleteSelectedAtoms = (): boolean => {
    const selectedAtomIds = Array.isArray(selectionStore.selectedAtomIds)
      ? selectionStore.selectedAtomIds.filter((atomId) => typeof atomId === 'string' && atomId.length > 0)
      : [];
    if (selectedAtomIds.length > 1) {
      vscode.postMessage({ command: 'deleteAtoms', atomIds: selectedAtomIds });
      return true;
    }
    const fallbackId = structureStore.currentStructure && (structureStore.currentStructure as { selectedAtomId?: string }).selectedAtomId;
    const atomId = selectedAtomIds.length === 1 ? selectedAtomIds[0] : fallbackId;
    if (!atomId) { return false; }
    vscode.postMessage({ command: 'deleteAtom', atomId });
    return true;
  };

  // Expose so the keyboard handler can call it.
  callbacks.deleteSelectedAtoms = deleteSelectedAtoms;

  const btnDeleteAtom = document.getElementById('btn-delete-atom') as HTMLButtonElement | null;
  const btnCopyAtom = document.getElementById('btn-copy-atom') as HTMLButtonElement | null;

  if (btnDeleteAtom) {
    btnDeleteAtom.onclick = () => { deleteSelectedAtoms(); };
  }

  if (btnCopyAtom) {
    btnCopyAtom.onclick = () => {
      if (!selectionStore.selectedAtomIds || selectionStore.selectedAtomIds.length === 0) { return; }
      vscode.postMessage({
        command: 'copyAtoms',
        atomIds: selectionStore.selectedAtomIds,
        offset: { x: 0.5, y: 0.5, z: 0.5 },
      });
    };
  }

  // ── Selected Atom panel ────────────────────────────────────────────────────

  const btnApplyAtom = document.getElementById('btn-apply-atom') as HTMLButtonElement | null;
  const selElement = document.getElementById('sel-element') as HTMLInputElement | null;
  const selX = document.getElementById('sel-x') as HTMLInputElement | null;
  const selY = document.getElementById('sel-y') as HTMLInputElement | null;
  const selZ = document.getElementById('sel-z') as HTMLInputElement | null;

  if (btnApplyAtom) btnApplyAtom.onclick = applySelectedAtomChanges;
  if (selElement) selElement.addEventListener('change', applySelectedAtomChanges);
  if (selX) selX.addEventListener('change', applySelectedAtomChanges);
  if (selY) selY.addEventListener('change', applySelectedAtomChanges);
  if (selZ) selZ.addEventListener('change', applySelectedAtomChanges);

  // ── Change Element ─────────────────────────────────────────────────────────

  const btnChangeAtom = document.getElementById('btn-change-atom') as HTMLButtonElement | null;
  if (btnChangeAtom) {
    btnChangeAtom.onclick = () => {
      const element = (document.getElementById('change-element') as HTMLInputElement | null)?.value.trim() ?? '';
      if (!element || !selectionStore.selectedAtomIds || selectionStore.selectedAtomIds.length === 0) { return; }
      vscode.postMessage({ command: 'changeAtoms', atomIds: selectionStore.selectedAtomIds, element });
    };
  }

  // ── Atom Color ─────────────────────────────────────────────────────────────

  const atomColorPicker = document.getElementById('atom-color-picker') as HTMLInputElement | null;
  const atomColorText = document.getElementById('atom-color-text') as HTMLInputElement | null;
  const btnApplyAtomColor = document.getElementById('btn-apply-atom-color') as HTMLButtonElement | null;

  const syncColorInputs = (rawValue: string): string | null => {
    const normalized = normalizeHexColor(rawValue);
    if (!normalized) { return null; }
    if (atomColorPicker) atomColorPicker.value = normalized;
    if (atomColorText) atomColorText.value = normalized;
    return normalized;
  };

  if (atomColorPicker) {
    atomColorPicker.addEventListener('input', (event: Event) => {
      syncColorInputs((event.target as HTMLInputElement).value);
    });
  }

  if (atomColorText) {
    atomColorText.addEventListener('change', (event: Event) => {
      const normalized = syncColorInputs((event.target as HTMLInputElement).value);
      if (!normalized && atomColorPicker) {
        (event.target as HTMLInputElement).value = atomColorPicker.value;
      }
    });
  }

  if (btnApplyAtomColor) {
    btnApplyAtomColor.onclick = () => {
      const color = syncColorInputs(
        (atomColorText?.value ?? '') || (atomColorPicker?.value ?? '')
      );
      if (!color || !selectionStore.selectedAtomIds || selectionStore.selectedAtomIds.length === 0) { return; }
      vscode.postMessage({ command: 'setAtomColor', atomIds: selectionStore.selectedAtomIds, color });
    };
  }

  // ── Keyboard shortcuts (global — delete, undo, save) ──────────────────────

  document.addEventListener('keydown', (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    const tagName = target?.tagName?.toLowerCase() ?? '';
    const editable = tagName === 'input' || tagName === 'textarea' || !!target?.isContentEditable;
    if (editable) { return; }

    const withModifier = event.ctrlKey || event.metaKey;
    if (withModifier && !event.altKey) {
      const key = String(event.key || '').toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        vscode.postMessage({ command: 'undo' });
        event.preventDefault();
        return;
      }
      if (key === 's' && event.shiftKey) {
        vscode.postMessage({ command: 'saveStructureAs' });
        event.preventDefault();
        return;
      }
      if (key === 's') {
        vscode.postMessage({ command: 'saveStructure' });
        event.preventDefault();
        return;
      }
    }

    if (event.key !== 'Delete' && event.key !== 'Backspace') { return; }
    const selectedBondKeys = getSelectedBondKeys();
    if (selectedBondKeys.length > 0) {
      vscode.postMessage({ command: 'deleteBond', bondKeys: selectedBondKeys });
      event.preventDefault();
      return;
    }
    if (deleteSelectedAtoms()) {
      event.preventDefault();
    }
  });
}
