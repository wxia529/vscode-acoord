/**
 * Tools tab module.
 *
 * Wires: Measurements panel (bond length/angle input, apply buttons),
 *        Bond Tools panel (create/delete/recalculate),
 *        Rotate Selection panel (axis buttons, slider, input),
 *        Adjust Distance panel (slider, input).
 *
 * setup(callbacks) must be called once during app initialisation.
 */
import { selectionStore, interactionStore } from './state';
import type { VscodeContext, SelectionContext, TransformContext } from './types';

/** Combined context for appTools module */
type AppToolsContext = VscodeContext & SelectionContext & TransformContext;

export function setup(callbacks: AppToolsContext): void {
  const {
    vscode,
    applyBondAngle,
    applyRotation,
    applyAdsorptionDistance,
    getSelectedBondKeys,
    setSelectedBondSelection,
    updateMeasurements,
    updateAdsorptionUI,
  } = callbacks;

  // ── Measurements ───────────────────────────────────────────────────────────

  const btnApplyBond = document.getElementById('btn-apply-bond') as HTMLButtonElement | null;
  const btnApplyAngle = document.getElementById('btn-apply-angle') as HTMLButtonElement | null;

  if (btnApplyBond) {
    btnApplyBond.onclick = () => {
      const value = parseFloat((document.getElementById('bond-length-input') as HTMLInputElement | null)?.value ?? '');
      if (!Number.isFinite(value)) { return; }
      if (selectionStore.selectedAtomIds.length < 2) { return; }
      vscode.postMessage({
        command: 'setBondLength',
        atomIds: selectionStore.selectedAtomIds.slice(0, 2),
        length: value,
      });
    };
  }

  if (btnApplyAngle) {
    btnApplyAngle.onclick = () => {
      const value = parseFloat((document.getElementById('bond-angle-input') as HTMLInputElement | null)?.value ?? '');
      if (!Number.isFinite(value)) { return; }
      applyBondAngle(value);
    };
  }

  // ── Bond Tools ─────────────────────────────────────────────────────────────

  const btnCreateBond = document.getElementById('btn-create-bond') as HTMLButtonElement | null;
  const btnDeleteBond = document.getElementById('btn-delete-bond') as HTMLButtonElement | null;
  const btnRecalculateBonds = document.getElementById('btn-recalculate-bonds') as HTMLButtonElement | null;

  if (btnCreateBond) {
    btnCreateBond.onclick = () => {
      if (!selectionStore.selectedAtomIds || selectionStore.selectedAtomIds.length < 2) { return; }
      vscode.postMessage({ command: 'createBond', atomIds: selectionStore.selectedAtomIds.slice(-2) });
    };
  }

  if (btnDeleteBond) {
    btnDeleteBond.onclick = () => {
      const selectedBondKeys = getSelectedBondKeys();
      if (selectedBondKeys.length > 0) {
        vscode.postMessage({ command: 'deleteBond', bondKeys: selectedBondKeys });
        return;
      }
      if (selectionStore.selectedAtomIds && selectionStore.selectedAtomIds.length >= 2) {
        vscode.postMessage({ command: 'deleteBond', atomIds: selectionStore.selectedAtomIds.slice(-2) });
      }
    };
  }

  if (btnRecalculateBonds) {
    btnRecalculateBonds.onclick = () => {
      vscode.postMessage({ command: 'recalculateBonds' });
    };
  }

  // ── Rotate Selection ───────────────────────────────────────────────────────

  const rotX = document.getElementById('btn-rot-x') as HTMLButtonElement | null;
  const rotY = document.getElementById('btn-rot-y') as HTMLButtonElement | null;
  const rotZ = document.getElementById('btn-rot-z') as HTMLButtonElement | null;
  const rotSlider = document.getElementById('rotation-slider') as HTMLInputElement | null;
  const rotInput = document.getElementById('rotation-input') as HTMLInputElement | null;

  const setAxis = (axis: string) => {
    interactionStore.rotationAxis = axis;
    rotX?.classList.toggle('selected', axis === 'x');
    rotY?.classList.toggle('selected', axis === 'y');
    rotZ?.classList.toggle('selected', axis === 'z');
    // Reset rotation base so applyRotation starts fresh on next use
    callbacks.resetRotationBase?.();
  };

  if (rotX) rotX.onclick = () => { setAxis('x'); };
  if (rotY) rotY.onclick = () => { setAxis('y'); };
  if (rotZ) rotZ.onclick = () => { setAxis('z'); };
  setAxis(interactionStore.rotationAxis || 'z');

  if (rotSlider) {
    rotSlider.addEventListener('input', (event: Event) => {
      const value = parseFloat((event.target as HTMLInputElement).value);
      if (!Number.isFinite(value)) { return; }
      if (rotInput) rotInput.value = value.toFixed(0);
      applyRotation(value, true);
    });

    rotSlider.addEventListener('change', (event: Event) => {
      const value = parseFloat((event.target as HTMLInputElement).value);
      if (!Number.isFinite(value)) { return; }
      applyRotation(value, false);
      callbacks.resetRotationBase?.();
    });
  }

  if (rotInput) {
    rotInput.addEventListener('change', (event: Event) => {
      let value = parseFloat((event.target as HTMLInputElement).value);
      if (!Number.isFinite(value)) { return; }
      value = Math.max(0, Math.min(360, value));
      rotInput.value = value.toFixed(0);
      if (rotSlider) rotSlider.value = value.toFixed(0);
      applyRotation(value, false);
      callbacks.resetRotationBase?.();
    });
  }

  // ── Adjust Distance ────────────────────────────────────────────────────────

  const adsorptionSlider = document.getElementById('adsorption-slider') as HTMLInputElement | null;
  const adsorptionInput = document.getElementById('adsorption-input') as HTMLInputElement | null;

  if (adsorptionSlider) {
    adsorptionSlider.addEventListener('input', (event: Event) => {
      const value = parseFloat((event.target as HTMLInputElement).value);
      if (!Number.isFinite(value)) { return; }
      applyAdsorptionDistance(value, true);
    });

    adsorptionSlider.addEventListener('change', (event: Event) => {
      const value = parseFloat((event.target as HTMLInputElement).value);
      if (!Number.isFinite(value)) { return; }
      applyAdsorptionDistance(value, false);
    });
  }

  if (adsorptionInput) {
    adsorptionInput.addEventListener('change', (event: Event) => {
      const value = parseFloat((event.target as HTMLInputElement).value);
      if (!Number.isFinite(value)) { return; }
      applyAdsorptionDistance(value, false);
    });
  }
}
