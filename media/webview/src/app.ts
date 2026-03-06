import { structureStore, selectionStore, displayStore, adsorptionStore, interactionStore, applyDisplaySettings } from './state';
import { renderer } from './renderer';
import * as configHandler from './configHandler';
import * as colorSchemeHandler from './colorSchemeHandler';
import * as appTrajectory from './appTrajectory';
import { setup as setupEdit } from './appEdit';
import { setup as setupLattice, updateLatticeUI, updateAtomSizePanel } from './appLattice';
import { setup as setupView } from './appView';
import { setup as setupTools } from './appTools';
import { init as initInteraction } from './interaction';
import { initVscode as initInteractionConfigVscode, updateConfigSelector } from './interactionConfig';
import type { Atom, Structure, VsCodeApi, AppCallbacks } from './types';
import type { ExtensionToWebviewMessage, RenderMessage } from '../../../src/shared/protocol';

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
import { getAtomById, updateMeasurements, rebuildAtomIndex } from './utils/measurements';

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

// DOM cache — avoids repeated getElementById on the hot drag path.
import { getElementById as cachedGetElementById } from './utils/domCache';

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
  if (!structureStore.currentStructure) return;
  renderer.renderStructure(structureStore.currentStructure, {
    updateCounts,
    updateAtomList: (atoms, _selectedIds, selectedId) =>
      updateAtomList(atoms, selectionStore.selectedAtomIds, selectedId, vscode, uiCallbacks),
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
    redo: document.getElementById('btn-redo') as HTMLButtonElement | null,
    save: document.getElementById('btn-save') as HTMLButtonElement | null,
    saveAs: document.getElementById('btn-save-as') as HTMLButtonElement | null,
    exportImage: document.getElementById('btn-export-image') as HTMLButtonElement | null,
    openSource: document.getElementById('btn-open-source') as HTMLButtonElement | null,
    reload: document.getElementById('btn-reload') as HTMLButtonElement | null,
  };

  if (buttons.unitCell) buttons.unitCell.addEventListener('click', () => vscode.postMessage({ command: 'toggleUnitCell' }));
  if (buttons.reset) buttons.reset.addEventListener('click', () => renderer.fitCamera());
  if (buttons.undo) buttons.undo.addEventListener('click', () => vscode.postMessage({ command: 'undo' }));
  if (buttons.redo) buttons.redo.addEventListener('click', () => vscode.postMessage({ command: 'redo' }));
  if (buttons.save) buttons.save.addEventListener('click', () => vscode.postMessage({ command: 'saveStructure' }));
  if (buttons.saveAs) buttons.saveAs.addEventListener('click', () => vscode.postMessage({ command: 'saveStructureAs' }));
  if (buttons.openSource) buttons.openSource.addEventListener('click', () => vscode.postMessage({ command: 'openSource' }));
  if (buttons.reload) buttons.reload.addEventListener('click', () => vscode.postMessage({ command: 'reloadStructure' }));

  if (buttons.exportImage) {
    buttons.exportImage.addEventListener('click', () => {
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
    });
  }

  // Module setup callbacks
  const callbacks: AppCallbacks = {
    vscode,
    renderer,
    setError,
    rerenderCurrentStructure,
    updateCounts,
    updateAtomList: (atoms, _selectedIds, selectedId) =>
      updateAtomList(atoms, selectionStore.selectedAtomIds, selectedId, vscode, uiCallbacks),
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
  setupView();
  setupTools(callbacks);
  updateBondSelectionUI();
}

function setupInteraction(): void {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;

  const updatePositionInputs = (atom: Atom | null) => {
    if (!atom) return;
    const selX = cachedGetElementById<HTMLInputElement>('sel-x');
    const selY = cachedGetElementById<HTMLInputElement>('sel-y');
    const selZ = cachedGetElementById<HTMLInputElement>('sel-z');
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
        if (structureStore.currentSelectedAtom?.id === atomId) updateStatusBar();
      });

      if (structureStore.currentSelectedAtom?.id === atomId) {
        const selX = cachedGetElementById<HTMLInputElement>('sel-x');
        const selY = cachedGetElementById<HTMLInputElement>('sel-y');
        const selZ = cachedGetElementById<HTMLInputElement>('sel-z');
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

      for (const id of selectionStore.selectedAtomIds) {
        const atom = getAtomById(id);
        if (atom) {
          updateAtomPosition(id, atom.position[0] + dx, atom.position[1] + dy, atom.position[2] + dz);
        }
      }

      vscode.postMessage({
        command: 'moveGroup',
        atomIds: selectionStore.selectedAtomIds,
        dx, dy, dz,
        preview: true,
      });

      if (structureStore.currentSelectedAtom && selectionStore.selectedAtomIds.length > 0) {
        updatePositionInputs(getAtomById(structureStore.currentSelectedAtom.id));
      }
      updateMeasurements();
    },

    onEndDrag: () => vscode.postMessage({ command: 'endDrag' }),
  });
}

function start(): void {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;

  configHandler.init(vscode, setStatus, updateConfigSelector, rerenderCurrentStructure);
  colorSchemeHandler.init(vscode, setStatus, updateColorSchemeSelector);
  initInteractionConfigVscode(vscode);
  renderer.init(canvas, { setError, setStatus });

  setupUI();
  setupInteraction();
  setupInlineSliderValueEditing();

  configHandler.requestConfigList();
  colorSchemeHandler.requestSchemeList();
  configHandler.getCurrentSettings();
  vscode.postMessage({ command: 'getState' });

  document.addEventListener('selectionchange', () => {
    syncStatusSelectionLock();
    if (!statusSelectionLock) updateStatusBar(true);
  });
}

function updateColorSchemeSelector(): void {
  colorSchemeHandler.updateColorSchemeSelector();
}

// Message handlers
function handleRenderMessage(message: RenderMessage): void {
  appTrajectory.clearPending();
  structureStore.currentStructure = message.data;

  selectionStore.selectedAtomIds = message.data.selectedAtomIds;
  selectionStore.selectedBondKeys = Array.isArray(message.data.selectedBondKeys)
    ? message.data.selectedBondKeys
    : message.data.selectedBondKey
      ? [message.data.selectedBondKey]
      : [];
  structureStore.currentSelectedBondKey = selectionStore.selectedBondKeys.at(-1) ?? null;
  displayStore.supercell = message.data.supercell || [1, 1, 1];

  // Apply display settings
  if (message.displaySettings) {
    applyDisplaySettings(message.displaySettings);
    configHandler.updateUI();
  }

  appTrajectory.updateUI(
    message.data.trajectoryFrameIndex,
    message.data.trajectoryFrameCount
  );

  // Update adsorption state
  if (selectionStore.selectedAtomIds.length >= 2) {
    adsorptionStore.adsorptionReferenceId = selectionStore.selectedAtomIds[selectionStore.selectedAtomIds.length - 1];
    adsorptionStore.adsorptionAdsorbateIds = selectionStore.selectedAtomIds.slice(0, -1);
  } else {
    adsorptionStore.adsorptionReferenceId = null;
    adsorptionStore.adsorptionAdsorbateIds = selectionStore.selectedAtomIds.slice();
  }

  renderer.renderStructure(
    message.data,
    {
      updateCounts,
      updateAtomList: (atoms, _selectedIds, selectedId) =>
        updateAtomList(atoms, selectionStore.selectedAtomIds, selectedId, vscode, uiCallbacks),
    },
    { fitCamera: interactionStore.shouldFitCamera }
  );
  // Rebuild O(1) atom lookup index after every structure render.
  rebuildAtomIndex();
  interactionStore.shouldFitCamera = false;
  updateStatusBar();

  // Process render atom offsets
  if (message.data?.renderAtoms && message.data?.atoms) {
    const baseMap = new Map(message.data.atoms.map(a => [a.id, a.position]));
    interactionStore.renderAtomOffsets = {};
    for (const renderAtom of message.data.renderAtoms) {
      const baseId = String(renderAtom.id).split('::')[0];
      const basePos = baseMap.get(baseId);
      if (basePos) {
        interactionStore.renderAtomOffsets[renderAtom.id] = [
          renderAtom.position[0] - basePos[0],
          renderAtom.position[1] - basePos[1],
          renderAtom.position[2] - basePos[2],
        ];
      }
    }
  } else {
    interactionStore.renderAtomOffsets = {};
  }

  updateLatticeUI(
    message.data?.unitCellParams || null,
    message.data?.supercell || [1, 1, 1],
    !!message.data?.unitCellParams
  );

  // Update selection UI
  const atoms = message.data?.atoms || [];
  const selectedId =
    message.data?.selectedAtomId ||
    selectionStore.selectedAtomIds.at(-1) ||
    null;
  const selected = atoms.find((atom) => atom.id === selectedId) || null;

  structureStore.currentSelectedAtom = selected;
  updateSelectedInputs(selected);
  updateAtomColorPreview();
  updateAdsorptionUI();
  updateBondSelectionUI();
  updateAtomSizePanel();
}

window.addEventListener('message', (event: MessageEvent<ExtensionToWebviewMessage>) => {
  const message = event.data;

  switch (message.command) {
    case 'render':
      handleRenderMessage(message);
      break;

    case 'imageSaved': {
      const fileName = message.data.fileName;
      setStatus(`HD image saved: ${fileName}`);
      setError('');
      break;
    }

    case 'imageSaveFailed': {
      const reason = message.data.reason;
      setError(reason);
      break;
    }

    case 'displayConfigsLoaded':
    case 'displayConfigLoaded':
    case 'displayConfigSaved':
    case 'displayConfigChanged':
    case 'currentDisplaySettings':
    case 'displayConfigError':
      configHandler.handleMessage(message);
      break;

    case 'colorSchemesLoaded':
    case 'colorSchemeLoaded':
    case 'colorSchemeSaved':
    case 'colorSchemeError':
      colorSchemeHandler.handleMessage(message);
      break;

    default: {
      const _exhaustive: never = message;
      console.warn('Unhandled message command:', (_exhaustive as { command: string }).command);
    }
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
