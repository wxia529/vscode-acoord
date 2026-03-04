/**
 * Lattice tab module.
 *
 * Wires: Lattice Params panel, Supercell panel, Center at Cell,
 *        Display Scale panel (scale/size sliders, auto-scale), projection selector,
 *        Atom & Bond Size panel (global, per-selected, by-element, bond thickness).
 *
 * setup(callbacks) must be called once during app initialisation.
 */
import { displayStore, structureStore, selectionStore } from './state';
import { getElementById } from './utils/domCache';
import { debounce } from './utils/performance';
import type {
  UnitCellParams,
  Atom,
  VscodeContext,
  ErrorContext,
  RendererContext,
  AtomSizeContext,
} from './types';

/** Combined context for appLattice module */
type AppLatticeContext = VscodeContext & ErrorContext & RendererContext & AtomSizeContext;

let _cb: AppLatticeContext | null = null;

// Module-level debounced rerender for dynamic sliders (element size rows)
const debouncedRerenderFromPanel = debounce((): void => {
  _cb?.rerenderCurrentStructure();
}, 16);

// ── Lattice UI sync ────────────────────────────────────────────────────────────

export function updateLatticeUI(
  unitCellParams: UnitCellParams | null | undefined,
  supercell: [number, number, number] | number[] | null | undefined,
  hasUnitCell: boolean
): void {
  const aInput = getElementById<HTMLInputElement>('lattice-a');
  const bInput = getElementById<HTMLInputElement>('lattice-b');
  const cInput = getElementById<HTMLInputElement>('lattice-c');
  const alphaInput = getElementById<HTMLInputElement>('lattice-alpha');
  const betaInput = getElementById<HTMLInputElement>('lattice-beta');
  const gammaInput = getElementById<HTMLInputElement>('lattice-gamma');
  const scaleToggle = getElementById<HTMLInputElement>('lattice-scale');
  const removeBtn = getElementById<HTMLButtonElement>('btn-lattice-remove');
  const centerBtn = getElementById<HTMLButtonElement>('btn-center-cell');
  const superX = getElementById<HTMLInputElement>('supercell-x');
  const superY = getElementById<HTMLInputElement>('supercell-y');
  const superZ = getElementById<HTMLInputElement>('supercell-z');

  if (unitCellParams) {
    if (aInput) aInput.value = Number(unitCellParams.a).toFixed(4);
    if (bInput) bInput.value = Number(unitCellParams.b).toFixed(4);
    if (cInput) cInput.value = Number(unitCellParams.c).toFixed(4);
    if (alphaInput) alphaInput.value = Number(unitCellParams.alpha).toFixed(2);
    if (betaInput) betaInput.value = Number(unitCellParams.beta).toFixed(2);
    if (gammaInput) gammaInput.value = Number(unitCellParams.gamma).toFixed(2);
  } else if (!displayStore.unitCellEditing) {
    if (aInput) aInput.value = '';
    if (bInput) bInput.value = '';
    if (cInput) cInput.value = '';
    if (alphaInput) alphaInput.value = '';
    if (betaInput) betaInput.value = '';
    if (gammaInput) gammaInput.value = '';
  }

  if (scaleToggle) scaleToggle.checked = !!displayStore.scaleAtomsWithLattice;
  if (removeBtn) removeBtn.disabled = !hasUnitCell;
  if (centerBtn) centerBtn.disabled = !hasUnitCell;

  const sc = Array.isArray(supercell) ? supercell : [1, 1, 1];
  const nx = Math.max(1, Math.floor(sc[0] || 1));
  const ny = Math.max(1, Math.floor(sc[1] || 1));
  const nz = Math.max(1, Math.floor(sc[2] || 1));
  if (superX) { superX.value = String(nx); superX.disabled = !hasUnitCell; }
  if (superY) { superY.value = String(ny); superY.disabled = !hasUnitCell; }
  if (superZ) { superZ.value = String(nz); superZ.disabled = !hasUnitCell; }
}

// ── Atom size panel ────────────────────────────────────────────────────────────

export function updateAtomSizePanel(): void {
  if (!_cb) { return; }
  const {
    clampAtomSize, getBaseAtomId, getAvailableElements,
    hasAtomSizeOverride, hasElementSizeOverride,
    getAtomSizeForAtomId, getAtomSizeForElement,
    cleanupAtomSizeOverrides, rerenderCurrentStructure,
    ATOM_SIZE_MIN, ATOM_SIZE_MAX,
  } = _cb;

  const globalSlider = getElementById<HTMLInputElement>('atom-size-global-slider');
  const globalValue = getElementById<HTMLElement>('atom-size-global-value');
  const useDefaultCheckbox = getElementById<HTMLInputElement>('atom-size-use-default');
  const selectedSection = getElementById<HTMLElement>('atom-size-selected-section');
  const selectedCount = getElementById<HTMLElement>('atom-size-selected-count');
  const selectedSlider = getElementById<HTMLInputElement>('atom-size-selected-slider');
  const selectedValue = getElementById<HTMLElement>('atom-size-selected-value');
  const resetSelectedButton = getElementById<HTMLButtonElement>('btn-atom-size-reset-selected');
  const elementToggle = getElementById<HTMLButtonElement>('atom-size-element-toggle');
  const elementList = getElementById<HTMLElement>('atom-size-element-list');

  if (!globalSlider || !globalValue || !useDefaultCheckbox || !selectedSection || !selectedCount ||
    !selectedSlider || !selectedValue || !resetSelectedButton || !elementToggle || !elementList) {
    return;
  }

  cleanupAtomSizeOverrides();

  const manualEnabled = displayStore.atomSizeUseDefaultSettings === false;
  const selectedIds = Array.isArray(selectionStore.selectedAtomIds) ? selectionStore.selectedAtomIds : [];
  const selectedAtomCount = selectedIds.length;
  const currentSelectedId = selectedAtomCount > 0 ? selectedIds[selectedAtomCount - 1] : '';
  const selectedAtomSize = selectedAtomCount > 0
    ? getAtomSizeForAtomId(currentSelectedId)
    : clampAtomSize(displayStore.atomSizeGlobal, 0.3);
  const selectedHasAtomOverride = selectedIds.some((id) => hasAtomSizeOverride(id));
  const availableElements = getAvailableElements();

  displayStore.atomSizeGlobal = clampAtomSize(displayStore.atomSizeGlobal, 0.3);
  globalSlider.value = displayStore.atomSizeGlobal.toFixed(2);
  globalValue.textContent = `${displayStore.atomSizeGlobal.toFixed(2)} Å`;
  globalSlider.disabled = !manualEnabled;
  useDefaultCheckbox.checked = !manualEnabled;

  selectedSection.style.display = selectedAtomCount > 0 ? '' : 'none';
  selectedCount.textContent = String(selectedAtomCount);
  selectedSlider.value = selectedAtomSize.toFixed(2);
  selectedValue.textContent = `${selectedAtomSize.toFixed(2)} Å`;
  selectedSlider.disabled = !manualEnabled;
  resetSelectedButton.disabled = !manualEnabled || !selectedHasAtomOverride;

  if (availableElements.length === 0) { displayStore.atomSizeElementExpanded = false; }
  elementToggle.disabled = availableElements.length === 0;
  elementToggle.textContent = `By Element ${displayStore.atomSizeElementExpanded ? '▲' : '▼'}`;
  elementList.style.display = displayStore.atomSizeElementExpanded && availableElements.length > 0 ? '' : 'none';
  elementList.innerHTML = '';

  if (displayStore.atomSizeElementExpanded && availableElements.length > 0) {
    for (const element of availableElements) {
      const size = getAtomSizeForElement(element);
      const hasOverride = hasElementSizeOverride(element);

      const row = document.createElement('div');
      row.className = `atom-size-element-row${hasOverride ? ' size-override' : ''}`;

      const header = document.createElement('div');
      header.className = 'atom-size-element-header';

      const title = document.createElement('span');
      title.textContent = `${element}: ${size.toFixed(2)} Å`;

      const resetButton = document.createElement('button');
      resetButton.type = 'button';
      resetButton.className = 'atom-size-element-reset';
      resetButton.textContent = '↺';
      resetButton.disabled = !manualEnabled || !hasOverride;
      resetButton.addEventListener('click', () => {
        delete displayStore.atomSizeByElement[element];
        updateAtomSizePanel();
        rerenderCurrentStructure();
      });

      header.appendChild(title);
      header.appendChild(resetButton);

      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = String(ATOM_SIZE_MIN);
      slider.max = String(ATOM_SIZE_MAX);
      slider.step = '0.01';
      slider.value = size.toFixed(2);
      slider.disabled = !manualEnabled;
      slider.oninput = (event: Event) => {
        const target = event.target as HTMLInputElement;
        const nextSize = clampAtomSize(target.value, size);
        displayStore.atomSizeByElement[element] = nextSize;
        updateAtomSizePanel();
        debouncedRerenderFromPanel();
      };

      row.appendChild(header);
      row.appendChild(slider);
      elementList.appendChild(row);
    }
  }
}

// ── UI wiring ──────────────────────────────────────────────────────────────────

export function setup(callbacks: AppLatticeContext): void {
  _cb = callbacks;
  const { vscode, renderer, setError, rerenderCurrentStructure, updateCounts, updateAtomList,
    clampAtomSize, getBaseAtomId, ATOM_SIZE_MIN, ATOM_SIZE_MAX } = callbacks;

  // Debounced renders to avoid excessive GPU work during slider drag (16ms = 60fps)
  const debouncedRenderStructure = debounce((): void => {
    if (structureStore.currentStructure) {
      renderer.renderStructure(structureStore.currentStructure, { updateCounts, updateAtomList });
    }
  }, 16);
  const debouncedRerenderCurrentStructure = debounce((): void => {
    rerenderCurrentStructure();
  }, 16);

  // ── Lattice params ────────────────────────────────────────────────────────

  const latticeApply = getElementById<HTMLButtonElement>('btn-lattice-apply');
  const latticeRemove = getElementById<HTMLButtonElement>('btn-lattice-remove');
  const latticeCenter = getElementById<HTMLButtonElement>('btn-center-cell');
  const latticeScale = getElementById<HTMLInputElement>('lattice-scale');
  const latticeInputIds = ['lattice-a', 'lattice-b', 'lattice-c', 'lattice-alpha', 'lattice-beta', 'lattice-gamma'];
  const latticeInputs = latticeInputIds
    .map((id) => getElementById<HTMLInputElement>(id))
    .filter((el): el is HTMLInputElement => el !== null);

  if (latticeScale) {
    latticeScale.addEventListener('change', (event: Event) => {
      displayStore.scaleAtomsWithLattice = (event.target as HTMLInputElement).checked;
    });
  }

  for (const input of latticeInputs) {
    input.addEventListener('input', () => { displayStore.unitCellEditing = true; });
    input.addEventListener('blur', () => { displayStore.unitCellEditing = false; });
  }

  if (latticeApply) {
    latticeApply.addEventListener('click', () => {
      const a = parseFloat(getElementById<HTMLInputElement>('lattice-a')?.value ?? '');
      const b = parseFloat(getElementById<HTMLInputElement>('lattice-b')?.value ?? '');
      const c = parseFloat(getElementById<HTMLInputElement>('lattice-c')?.value ?? '');
      const alpha = parseFloat(getElementById<HTMLInputElement>('lattice-alpha')?.value ?? '');
      const beta = parseFloat(getElementById<HTMLInputElement>('lattice-beta')?.value ?? '');
      const gamma = parseFloat(getElementById<HTMLInputElement>('lattice-gamma')?.value ?? '');
      if (![a, b, c, alpha, beta, gamma].every((value) => Number.isFinite(value))) {
        setError('Lattice parameters must be valid numbers.');
        return;
      }
      vscode.postMessage({
        command: 'setUnitCell',
        params: { a, b, c, alpha, beta, gamma },
        scaleAtoms: !!displayStore.scaleAtomsWithLattice,
      });
      setError('');
    });
  }

  if (latticeRemove) { latticeRemove.addEventListener('click', () => { vscode.postMessage({ command: 'clearUnitCell' }); }); }
  if (latticeCenter) { latticeCenter.addEventListener('click', () => { vscode.postMessage({ command: 'centerToUnitCell' }); }); }

  // ── Supercell ─────────────────────────────────────────────────────────────

  const supercellApply = getElementById<HTMLButtonElement>('btn-supercell-apply');
  if (supercellApply) {
    supercellApply.addEventListener('click', () => {
      const nx = parseInt(getElementById<HTMLInputElement>('supercell-x')?.value ?? '', 10);
      const ny = parseInt(getElementById<HTMLInputElement>('supercell-y')?.value ?? '', 10);
      const nz = parseInt(getElementById<HTMLInputElement>('supercell-z')?.value ?? '', 10);
      if (![nx, ny, nz].every((value) => Number.isFinite(value) && value >= 1)) {
        setError('Supercell values must be integers >= 1.');
        return;
      }
      vscode.postMessage({ command: 'setSupercell', supercell: [nx, ny, nz] });
      setError('');
    });
  }

  // ── Scale / size sliders ───────────────────────────────────────────────────

  const scaleSlider = getElementById<HTMLInputElement>('scale-slider');
  const sizeSlider = getElementById<HTMLInputElement>('size-slider');
  const bondSizeSlider = getElementById<HTMLInputElement>('bond-size-slider');
  const scaleAuto = getElementById<HTMLInputElement>('scale-auto');

  if (scaleSlider) {
    scaleSlider.addEventListener('input', (event: Event) => {
      displayStore.manualScale = parseFloat((event.target as HTMLInputElement).value);
      const scaleValue = getElementById<HTMLElement>('scale-value');
      if (scaleValue) scaleValue.textContent = displayStore.manualScale.toFixed(1);
      if (!displayStore.autoScaleEnabled && structureStore.currentStructure) {
        debouncedRenderStructure();
      }
    });
  }

  if (sizeSlider) {
    sizeSlider.addEventListener('input', (event: Event) => {
      displayStore.atomSizeScale = parseFloat((event.target as HTMLInputElement).value);
      const sizeValue = getElementById<HTMLElement>('size-value');
      if (sizeValue) sizeValue.textContent = displayStore.atomSizeScale.toFixed(2);
      if (structureStore.currentStructure) {
        debouncedRenderStructure();
      }
    });
  }

  if (bondSizeSlider) {
    bondSizeSlider.addEventListener('input', (event: Event) => {
      displayStore.bondThicknessScale = parseFloat((event.target as HTMLInputElement).value);
      const bondSizeValue = getElementById<HTMLElement>('bond-size-value');
      if (bondSizeValue) bondSizeValue.textContent = displayStore.bondThicknessScale.toFixed(1);
      if (structureStore.currentStructure) {
        debouncedRenderStructure();
      }
    });
  }

  if (scaleAuto) {
    scaleAuto.addEventListener('change', (event: Event) => {
      displayStore.autoScaleEnabled = (event.target as HTMLInputElement).checked;
      if (structureStore.currentStructure) {
        renderer.renderStructure(structureStore.currentStructure, { updateCounts, updateAtomList });
      }
    });
  }

  // ── Atom size panel ────────────────────────────────────────────────────────

  const globalSlider = getElementById<HTMLInputElement>('atom-size-global-slider');
  const useDefaultCheckbox = getElementById<HTMLInputElement>('atom-size-use-default');
  const selectedSlider = getElementById<HTMLInputElement>('atom-size-selected-slider');
  const resetSelectedButton = getElementById<HTMLButtonElement>('btn-atom-size-reset-selected');
  const elementToggle = getElementById<HTMLButtonElement>('atom-size-element-toggle');

  if (globalSlider && useDefaultCheckbox && selectedSlider && resetSelectedButton && elementToggle) {
    globalSlider.addEventListener('input', (event: Event) => {
      displayStore.atomSizeGlobal = clampAtomSize((event.target as HTMLInputElement).value, displayStore.atomSizeGlobal || 0.3);
      updateAtomSizePanel();
      debouncedRerenderCurrentStructure();
    });

    useDefaultCheckbox.addEventListener('change', (event: Event) => {
      displayStore.atomSizeUseDefaultSettings = !!(event.target as HTMLInputElement).checked;
      updateAtomSizePanel();
      rerenderCurrentStructure();
    });

    selectedSlider.addEventListener('input', (event: Event) => {
      if (displayStore.atomSizeUseDefaultSettings !== false) {
        updateAtomSizePanel();
        return;
      }
      const nextSize = clampAtomSize((event.target as HTMLInputElement).value, displayStore.atomSizeGlobal || 0.3);
      const selectedIds = Array.isArray(selectionStore.selectedAtomIds) ? selectionStore.selectedAtomIds : [];
      for (const atomId of selectedIds) {
        const baseId = getBaseAtomId(atomId);
        if (baseId) { displayStore.atomSizeByAtom[baseId] = nextSize; }
      }
      updateAtomSizePanel();
      debouncedRerenderCurrentStructure();
    });

    resetSelectedButton.addEventListener('click', () => {
      const selectedIds = Array.isArray(selectionStore.selectedAtomIds) ? selectionStore.selectedAtomIds : [];
      for (const atomId of selectedIds) {
        const baseId = getBaseAtomId(atomId);
        if (baseId) { delete displayStore.atomSizeByAtom[baseId]; }
      }
      updateAtomSizePanel();
      rerenderCurrentStructure();
    });

    elementToggle.addEventListener('click', () => {
      displayStore.atomSizeElementExpanded = !displayStore.atomSizeElementExpanded;
      updateAtomSizePanel();
    });

    updateAtomSizePanel();
  }
}
