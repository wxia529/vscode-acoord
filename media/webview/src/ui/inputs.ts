import { structureStore, selectionStore } from '../state';
import { getAtomById } from '../utils/measurements';
import { getAdsorptionReference } from '../utils/transformations';
import type { Atom } from '../types';

export function updatePropertiesPanel(): void {
  const noSelection = document.getElementById('properties-no-selection');
  const singleAtom = document.getElementById('properties-single-atom');
  const multiAtom = document.getElementById('properties-multi-atom');
  const singleBond = document.getElementById('properties-single-bond');

  if (!noSelection || !singleAtom || !multiAtom || !singleBond) { return; }

  const selectedAtomIds = selectionStore.selectedAtomIds || [];
  const selectedBondKeys = selectionStore.selectedBondKeys || [];

  noSelection.style.display = 'none';
  singleAtom.style.display = 'none';
  multiAtom.style.display = 'none';
  singleBond.style.display = 'none';

  if (selectedAtomIds.length === 1) {
    singleAtom.style.display = 'block';
  } else if (selectedAtomIds.length > 1) {
    multiAtom.style.display = 'block';
    const countEl = document.getElementById('multi-atom-count');
    const breakdownEl = document.getElementById('multi-atom-breakdown');
    if (countEl) {
      countEl.textContent = String(selectedAtomIds.length);
    }
    if (breakdownEl) {
      const elementCounts = new Map<string, number>();
      for (const atomId of selectedAtomIds) {
        const atom = getAtomById(atomId);
        if (atom) {
          const count = elementCounts.get(atom.element) || 0;
          elementCounts.set(atom.element, count + 1);
        }
      }
      const parts = Array.from(elementCounts.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([element, count]) => `${element}: ${count}`);
      breakdownEl.textContent = parts.join(', ');
    }
  } else if (selectedBondKeys.length === 1) {
    singleBond.style.display = 'block';
  } else {
    noSelection.style.display = 'block';
  }
}

export function normalizeHexColor(value: string): string | null {
  if (typeof value !== 'string') { return null; }
  const trimmed = value.trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(trimmed)) { return null; }
  return trimmed.toUpperCase();
}

export function updateSelectedInputs(atom: Atom | null): void {
  const el = document.getElementById('sel-element') as HTMLInputElement | null;
  const x = document.getElementById('sel-x') as HTMLInputElement | null;
  const y = document.getElementById('sel-y') as HTMLInputElement | null;
  const z = document.getElementById('sel-z') as HTMLInputElement | null;
  const disabled = !atom;
  if (el) el.disabled = disabled;
  if (x) x.disabled = disabled;
  if (y) y.disabled = disabled;
  if (z) z.disabled = disabled;
  if (!atom) {
    if (el) el.value = '';
    if (x) x.value = '';
    if (y) y.value = '';
    if (z) z.value = '';
    return;
  }
  if (el) el.value = atom.element;
  if (x) x.value = atom.position[0].toFixed(4);
  if (y) y.value = atom.position[1].toFixed(4);
  if (z) z.value = atom.position[2].toFixed(4);
}

export function updateAtomColorPreview(): void {
  const atomColorPicker = document.getElementById('atom-color-picker') as HTMLInputElement | null;
  const atomColorText = document.getElementById('atom-color-text') as HTMLInputElement | null;
  const toolbarColorPicker = document.getElementById('toolbar-color-picker') as HTMLInputElement | null;
  if (!atomColorPicker || !atomColorText) { return; }

  let previewColor: string | null = null;
  if (structureStore.currentSelectedAtom && structureStore.currentSelectedAtom.color) {
    previewColor = normalizeHexColor(structureStore.currentSelectedAtom.color);
  }
  if (!previewColor && selectionStore.selectedAtomIds && selectionStore.selectedAtomIds.length > 0) {
    const focusAtomId = selectionStore.selectedAtomIds[selectionStore.selectedAtomIds.length - 1];
    const atom = getAtomById(focusAtomId);
    if (atom && atom.color) {
      previewColor = normalizeHexColor(atom.color);
    }
  }
  if (!previewColor) { return; }
  atomColorPicker.value = previewColor;
  atomColorText.value = previewColor;
  if (toolbarColorPicker) toolbarColorPicker.value = previewColor;
}

export function updateAdsorptionUI(): void {
  const refEl = document.getElementById('adsorption-ref') as HTMLElement | null;
  const distEl = document.getElementById('adsorption-distance') as HTMLElement | null;
  const slider = document.getElementById('adsorption-slider') as HTMLInputElement | null;
  const input = document.getElementById('adsorption-input') as HTMLInputElement | null;
  const ref = getAdsorptionReference();
  if (!ref) {
    if (refEl) refEl.textContent = '--';
    if (distEl) distEl.textContent = '--';
    if (slider) slider.value = '0';
    if (input) input.value = '';
    return;
  }
  if (refEl) refEl.textContent = ref.reference.element + ' vs ' + ref.anchor.element;
  if (distEl) distEl.textContent = ref.distance.toFixed(4);
  if (slider) slider.value = ref.distance.toFixed(2);
  if (input) input.value = ref.distance.toFixed(4);
}

export function applySelectedAtomChanges(vscode: { postMessage: (msg: unknown) => void }): void {
  if (!structureStore.currentSelectedAtom) return;
  const el = (document.getElementById('sel-element') as HTMLInputElement | null)?.value.trim() ?? '';
  const x = parseFloat((document.getElementById('sel-x') as HTMLInputElement | null)?.value ?? '');
  const y = parseFloat((document.getElementById('sel-y') as HTMLInputElement | null)?.value ?? '');
  const z = parseFloat((document.getElementById('sel-z') as HTMLInputElement | null)?.value ?? '');
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return;
  vscode.postMessage({
    command: 'updateAtom',
    atomId: structureStore.currentSelectedAtom.id,
    element: el || structureStore.currentSelectedAtom.element,
    x, y, z,
  });
}