import { state } from './state';
import { renderer } from './renderer';
import * as configHandler from './configHandler';
import * as appTrajectory from './appTrajectory';
import { setup as setupEdit } from './appEdit';
import { setup as setupLattice, updateLatticeUI, updateAtomSizePanel } from './appLattice';
import { setup as setupView } from './appView';
import { setup as setupTools } from './appTools';
import { init as initInteraction } from './interaction';
import { initVscode as initInteractionConfigVscode, updateConfigSelector } from './interactionConfig';
import type { Atom, Structure, VsCodeApi, AppCallbacks } from './types';

// UI utilities
import {
  setError,
  setStatus,
  updateStatusBar,
  syncStatusSelectionLock,
  statusSelectionLock,
} from './ui/statusBar';
import {
  setupInlineSliderValueEditing,
  updateCounts,
  getImageFileName,
  setupTabs,
} from './ui/common';
import {
  normalizeHexColor,
  updateSelectedInputs,
  updateAtomColorPreview,
  updateAdsorptionUI,
  applySelectedAtomChanges,
} from './ui/inputs';

// Measurement utilities
import { getAtomById, updateMeasurements } from './utils/measurements';

// Atom size utilities
import {
  ATOM_SIZE_MIN,
  ATOM_SIZE_MAX,
  clampAtomSize,
  getBaseAtomId,
  getCurrentStructureAtoms,
  getAvailableElements,
  cleanupAtomSizeOverrides,
  hasAtomSizeOverride,
  hasElementSizeOverride,
  getFallbackRadiusForAtom,
  getAtomSizeForAtomId,
  getAtomSizeForElement,
} from './utils/atomSize';

// Selection management
import {
  getSelectedBondKeys,
  updateBondSelectionUI,
  setSelectedBondSelection,
  handleBondSelect,
  applyBondSelectionFromKeys,
  updateAtomList,
  handleSelect,
  applySelectionFromIds,
} from './state/selectionManager';

// Transformations
import {
  resetRotationBase,
  updateAtomPosition,
  applyBondAngle,
  applyRotation,
  applyAdsorptionDistance,
} from './utils/transformations';

declare function acquireVsCodeApi(): VsCodeApi;

const vscode = acquireVsCodeApi();

// Shared callbacks for UI updates - reused across multiple functions
const uiCallbacks = {
  updateSelectedInputs,
  updateAtomColorPreview,
  updateMeasurements,
  updateAdsorptionUI,
  updateAtomSizePanel,
  updateStatusBar,
};

function rerenderCurrentStructure(): void {
  if (!state.currentStructure) return;
  renderer.renderStructure(state.currentStructure, {
    updateCounts,
    updateAtomList: (atoms, _selectedIds, selectedId) =>
      updateAtomList(atoms, state.selectedAtomIds, selectedId, vscode, uiCallbacks),
  });
}

// Selection handlers
const selectHandlers = {
  handleSelect: (atomId: string, add: boolean, preserve: boolean) =>
    handleSelect(atomId, add, preserve, vscode, uiCallbacks),

  handleBondSelect: (bondKey: string | null, add: boolean) =>
    handleBondSelect(bondKey, add, true, vscode),

  applySelection: (atomIds: string[], mode: string) =>
    applySelectionFromIds(atomIds, mode, vscode, uiCallbacks),

  applyBondSelection: (bondKeys: string[], mode: string) =>
    applyBondSelectionFromKeys(bondKeys, mode, vscode),
};

// Tool callbacks
const toolCallbacks = {
  setSelectedBondSelection: (bondKeys: string[], syncBackend: boolean) =>
    setSelectedBondSelection(bondKeys, syncBackend, vscode),

  applyAdsorptionDistance: (target: number, preview: boolean) =>
    applyAdsorptionDistance(target, preview, vscode),

  applyRotation: (angleDeg: number, preview: boolean) =>
    applyRotation(angleDeg, preview, vscode),

  applySelectedAtomChanges: () => applySelectedAtomChanges(vscode),
};

function setupUI(): void {
  setupTabs();

  // Toolbar buttons
  const buttons = {
    unitCell: document.getElementById('btn-unit-cell') as HTMLButtonElement | null,
    reset: document.getElementById('btn-reset') as HTMLButtonElement | null,
    undo: document.getElementById('btn-undo') as HTMLButtonElement | null,
    save: document.getElementById('btn-save') as HTMLButtonElement | null,
    saveAs: document.getElementById('btn-save-as') as HTMLButtonElement | null,
    exportImage: document.getElementById('btn-export-image') as HTMLButtonElement | null,
    openSource: document.getElementById('btn-open-source') as HTMLButtonElement | null,
    reload: document.getElementById('btn-reload') as HTMLButtonElement | null,
  };

  if (buttons.unitCell) buttons.unitCell.onclick = () => vscode.postMessage({ command: 'toggleUnitCell' });
  if (buttons.reset) buttons.reset.onclick = () => renderer.fitCamera();
  if (buttons.undo) buttons.undo.onclick = () => vscode.postMessage({ command: 'undo' });
  if (buttons.save) buttons.save.onclick = () => vscode.postMessage({ command: 'saveStructure' });
  if (buttons.saveAs) buttons.saveAs.onclick = () => vscode.postMessage({ command: 'saveStructureAs' });
  if (buttons.openSource) buttons.openSource.onclick = () => vscode.postMessage({ command: 'openSource' });
  if (buttons.reload) buttons.reload.onclick = () => vscode.postMessage({ command: 'reloadStructure' });

  if (buttons.exportImage) {
    buttons.exportImage.onclick = () => {
      if (!renderer.exportHighResolutionImage) {
        setError('HD image export is unavailable.');
        return;
      }
      const result = renderer.exportHighResolutionImage({ scale: 4 });
      if (!result?.dataUrl) {
        setError('Failed to export HD image.');
        return;
      }
      vscode.postMessage({
        command: 'saveRenderedImage',
        dataUrl: result.dataUrl,
        suggestedName: getImageFileName(),
        width: result.width,
        height: result.height,
      });
      setError('');
      setStatus(`HD image generated: ${result.width}x${result.height}`);
    };
  }

  // Module setup callbacks
  const callbacks: AppCallbacks = {
    vscode,
    state,
    renderer,
    setError,
    rerenderCurrentStructure,
    updateCounts,
    updateAtomList: (atoms, _selectedIds, selectedId) =>
      updateAtomList(atoms, state.selectedAtomIds, selectedId, vscode, uiCallbacks),
    clampAtomSize,
    getBaseAtomId,
    getCurrentStructureAtoms,
    getAvailableElements,
    hasAtomSizeOverride,
    hasElementSizeOverride,
    getAtomSizeForAtomId,
    getAtomSizeForElement,
    getFallbackRadiusForAtom,
    cleanupAtomSizeOverrides,
    ATOM_SIZE_MIN,
    ATOM_SIZE_MAX,
    getSelectedBondKeys,
    setSelectedBondSelection: toolCallbacks.setSelectedBondSelection,
    normalizeHexColor,
    applySelectedAtomChanges: toolCallbacks.applySelectedAtomChanges,
    applyBondAngle,
    applyRotation: toolCallbacks.applyRotation,
    applyAdsorptionDistance: toolCallbacks.applyAdsorptionDistance,
    updateMeasurements,
    updateAdsorptionUI,
    resetRotationBase,
  };

  appTrajectory.setup(vscode);
  setupEdit(callbacks);
  setupLattice(callbacks);
  setupView(callbacks);
  setupTools(callbacks);
  updateBondSelectionUI();
}

function setupInteraction(): void {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;

  const updatePositionInputs = (atom: Atom | null) => {
    if (!atom) return;
    const selX = document.getElementById('sel-x') as HTMLInputElement | null;
    const selY = document.getElementById('sel-y') as HTMLInputElement | null;
    const selZ = document.getElementById('sel-z') as HTMLInputElement | null;
    if (selX) selX.value = atom.position[0].toFixed(4);
    if (selY) selY.value = atom.position[1].toFixed(4);
    if (selZ) selZ.value = atom.position[2].toFixed(4);
  };

  initInteraction(canvas, {
    onSelectAtom: selectHandlers.handleSelect,
    onSelectBond: selectHandlers.handleBondSelect,
    onClearSelection: () => selectHandlers.applySelection([], 'replace'),
    onBoxSelect: selectHandlers.applySelection,
    onBoxSelectBonds: selectHandlers.applyBondSelection,
    onSetStatus: setStatus,
    onBeginDrag: (atomId) => vscode.postMessage({ command: 'beginDrag', atomId }),

    onDragAtom: (atomId, intersection) => {
      const scale = renderer.getScale();
      const invScale = scale ? 1 / scale : 1;
      const modelX = intersection.x * invScale;
      const modelY = intersection.y * invScale;
      const modelZ = intersection.z * invScale;

      updateAtomPosition(atomId, modelX, modelY, modelZ, () => {
        if (state.currentSelectedAtom?.id === atomId) updateStatusBar();
      });

      if (state.currentSelectedAtom?.id === atomId) {
        const selX = document.getElementById('sel-x') as HTMLInputElement | null;
        const selY = document.getElementById('sel-y') as HTMLInputElement | null;
        const selZ = document.getElementById('sel-z') as HTMLInputElement | null;
        if (selX) selX.value = modelX.toFixed(4);
        if (selY) selY.value = modelY.toFixed(4);
        if (selZ) selZ.value = modelZ.toFixed(4);
      }
      updateMeasurements();
      vscode.postMessage({ command: 'moveAtom', atomId, x: modelX, y: modelY, z: modelZ, preview: true });
    },

    onDragGroup: (deltaWorld) => {
      const scale = renderer.getScale();
      const invScale = scale ? 1 / scale : 1;
      const dx = deltaWorld.x * invScale;
      const dy = deltaWorld.y * invScale;
      const dz = deltaWorld.z * invScale;

      for (const id of state.selectedAtomIds) {
        const atom = getAtomById(id);
        if (atom) {
          updateAtomPosition(id, atom.position[0] + dx, atom.position[1] + dy, atom.position[2] + dz);
        }
      }

      vscode.postMessage({
        command: 'moveGroup',
        atomIds: state.selectedAtomIds,
        dx, dy, dz,
        preview: true,
      });

      if (state.currentSelectedAtom && state.selectedAtomIds.length > 0) {
        updatePositionInputs(getAtomById(state.currentSelectedAtom.id));
      }
      updateMeasurements();
    },

    onEndDrag: () => vscode.postMessage({ command: 'endDrag' }),
  });
}

function start(): void {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;

  configHandler.init(vscode, setStatus, updateConfigSelector, rerenderCurrentStructure);
  initInteractionConfigVscode(vscode);
  renderer.init(canvas, { setError, setStatus });

  setupUI();
  setupInteraction();
  setupInlineSliderValueEditing();

  configHandler.requestConfigList();
  configHandler.getCurrentSettings();
  vscode.postMessage({ command: 'getState' });

  document.addEventListener('selectionchange', () => {
    syncStatusSelectionLock();
    if (!statusSelectionLock) updateStatusBar(true);
  });
}

// Message handlers
function handleRenderMessage(data: {
  data?: Structure & {
    selectedAtomId?: string;
    selectedAtomIds?: string[];
    selectedBondKeys?: string[];
    selectedBondKey?: string;
    supercell?: [number, number, number];
    trajectoryFrameIndex?: number;
    trajectoryFrameCount?: number;
    renderAtoms?: Atom[];
  };
  displaySettings?: import('./types').DisplaySettings;
}): void {
  appTrajectory.clearPending();
  state.currentStructure = data.data ?? null;
  cleanupAtomSizeOverrides();

  state.selectedAtomIds = data.data?.selectedAtomIds || [];
  state.selectedBondKeys = Array.isArray(data.data?.selectedBondKeys)
    ? data.data!.selectedBondKeys
    : data.data?.selectedBondKey
      ? [data.data.selectedBondKey]
      : [];
  state.currentSelectedBondKey = state.selectedBondKeys.at(-1) ?? null;
  state.supercell = data.data?.supercell || [1, 1, 1];

  // Apply display settings
  if (data.displaySettings) {
    state.applyDisplaySettings(data.displaySettings);
    configHandler.updateUI();
  }

  appTrajectory.updateUI(
    data.data?.trajectoryFrameIndex || 0,
    data.data?.trajectoryFrameCount || 1
  );

  // Update adsorption state
  if (state.selectedAtomIds.length >= 2) {
    state.adsorptionReferenceId = state.selectedAtomIds[state.selectedAtomIds.length - 1];
    state.adsorptionAdsorbateIds = state.selectedAtomIds.slice(0, -1);
  } else {
    state.adsorptionReferenceId = null;
    state.adsorptionAdsorbateIds = state.selectedAtomIds.slice();
  }

  renderer.renderStructure(
    data.data!,
    {
      updateCounts,
      updateAtomList: (atoms, _selectedIds, selectedId) =>
        updateAtomList(atoms, state.selectedAtomIds, selectedId, vscode, uiCallbacks),
    },
    { fitCamera: state.shouldFitCamera }
  );
  state.shouldFitCamera = false;
  updateStatusBar();

  // Process render atom offsets
  if (data.data?.renderAtoms && data.data?.atoms) {
    const baseMap = new Map(data.data.atoms.map(a => [a.id, a.position]));
    state.renderAtomOffsets = {};
    for (const renderAtom of data.data.renderAtoms) {
      const baseId = String(renderAtom.id).split('::')[0];
      const basePos = baseMap.get(baseId);
      if (basePos) {
        state.renderAtomOffsets[renderAtom.id] = [
          renderAtom.position[0] - basePos[0],
          renderAtom.position[1] - basePos[1],
          renderAtom.position[2] - basePos[2],
        ];
      }
    }
  } else {
    state.renderAtomOffsets = {};
  }

  updateLatticeUI(
    data.data?.unitCellParams || null,
    data.data?.supercell || [1, 1, 1],
    !!data.data?.unitCellParams
  );

  // Update selection UI
  const atoms = data.data?.atoms || [];
  const selectedId =
    data.data?.selectedAtomId ||
    state.selectedAtomIds.at(-1) ||
    null;
  const selected = atoms.find((atom) => atom.id === selectedId) || null;

  state.currentSelectedAtom = selected;
  updateSelectedInputs(selected);
  updateAtomColorPreview();
  updateAdsorptionUI();
  updateBondSelectionUI();
  updateAtomSizePanel();
}

window.addEventListener('message', (event: MessageEvent) => {
  const data = event.data as {
    command: string;
    data?: unknown;
    displaySettings?: import('./types').DisplaySettings;
  };

  switch (data.command) {
    case 'render':
      handleRenderMessage(data as Parameters<typeof handleRenderMessage>[0]);
      break;

    case 'imageSaved': {
      const fileName = (data.data as { fileName?: string } | undefined)?.fileName || 'image.png';
      setStatus(`HD image saved: ${fileName}`);
      setError('');
      break;
    }

    case 'imageSaveFailed': {
      const reason = (data.data as { reason?: string } | undefined)?.reason || 'Failed to save image.';
      setError(reason);
      break;
    }

    default:
      configHandler.handleMessage(data as { command: string; [key: string]: unknown });
  }
});

if (document.readyState === 'complete') {
  start();
} else {
  window.addEventListener('load', start);
}

// Re-export for other modules
export {
  setError,
  setStatus,
  updateStatusBar,
  syncStatusSelectionLock,
  statusSelectionLock,
};
