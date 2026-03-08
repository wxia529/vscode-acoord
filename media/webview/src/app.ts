import { structureStore, selectionStore, displayStore, adsorptionStore, interactionStore, applyDisplaySettings, type BoxSelectionMode } from './state';
import { renderer } from './renderer';
import * as configHandler from './configHandler';
import * as colorSchemeHandler from './colorSchemeHandler';
import * as appTrajectory from './appTrajectory';
import { setup as setupEdit } from './appEdit';
import { setup as setupLattice, updateLatticeUI, updateSelectedAtomSizePanel } from './appLattice';
import { setup as setupView } from './appView';
import { setup as setupTools } from './appTools';
import * as brushPanel from './brushPanel';
import { init as initInteraction } from './interaction';
import { initVscode as initInteractionConfigVscode, init as initInteractionConfig, updateConfigSelector } from './interactionConfig';
import type { Atom, Structure, VsCodeApi, AppCallbacks } from './types';
import type { ExtensionToWebviewMessage, RenderMessage } from '../../../src/shared/protocol';

// UI utilities
import {
  setError,
  setStatus,
  updateStatusBar,
  syncStatusSelectionLock,
  isStatusSelectionLocked,
} from './ui/statusBar';
import {
  setupInlineSliderValueEditing,
  updateCounts,
  getImageFileName,
  setupTabs,
  setupCollapsiblePanels,
  togglePanel,
} from './ui/common';
import {
  normalizeHexColor,
  updateSelectedInputs,
  updateAtomColorPreview,
  updateAdsorptionUI,
  applySelectedAtomChanges,
  updatePropertiesPanel,
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
  updateSelectedAtomSizePanel,
  updateStatusBar,
  updatePropertiesPanel,
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
  setupCollapsiblePanels();

  const canvas = document.getElementById('canvas') as HTMLCanvasElement;

  const toolbarAddAtom = document.getElementById('toolbar-add-atom') as HTMLSelectElement | null;
  const toolbarDelete = document.getElementById('toolbar-delete') as HTMLButtonElement | null;
  const toolbarBoxMode = document.getElementById('toolbar-box-mode') as HTMLSelectElement | null;
  const btnReset = document.getElementById('btn-reset') as HTMLButtonElement | null;
  const btnUndo = document.getElementById('btn-undo') as HTMLButtonElement | null;
  const btnRedo = document.getElementById('btn-redo') as HTMLButtonElement | null;
  const btnSave = document.getElementById('btn-save') as HTMLButtonElement | null;
  const btnExportImage = document.getElementById('btn-export-image') as HTMLButtonElement | null;

  if (toolbarAddAtom) {
    toolbarAddAtom.addEventListener('change', () => {
      const element = toolbarAddAtom.value;
      if (element) {
        interactionStore.addingAtomElement = element;
        canvas.style.cursor = 'crosshair';
        setStatus(`Adding ${element} atoms - Click to place, Esc to cancel`);
        toolbarAddAtom.value = '';
      }
    });
  }

  if (toolbarDelete) {
    toolbarDelete.addEventListener('click', () => {
      if (selectionStore.selectedAtomIds.length > 0) {
        vscode.postMessage({ command: 'deleteAtoms', atomIds: selectionStore.selectedAtomIds });
      } else if (selectionStore.selectedBondKeys.length > 0) {
        vscode.postMessage({ command: 'deleteBond', bondKey: selectionStore.selectedBondKeys[0] });
      }
    });
  }

  if (toolbarBoxMode) {
    toolbarBoxMode.addEventListener('change', () => {
      interactionStore.boxSelectionMode = toolbarBoxMode.value as BoxSelectionMode;
    });
    toolbarBoxMode.value = interactionStore.boxSelectionMode;
  }

  if (btnReset) btnReset.addEventListener('click', () => renderer.fitCamera());
  if (btnUndo) btnUndo.addEventListener('click', () => vscode.postMessage({ command: 'undo' }));
  if (btnRedo) btnRedo.addEventListener('click', () => vscode.postMessage({ command: 'redo' }));
  if (btnSave) btnSave.addEventListener('click', () => vscode.postMessage({ command: 'saveStructure' }));

  if (btnExportImage) {
    btnExportImage.addEventListener('click', () => {
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
  brushPanel.init(vscode, setStatus);
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

    onDelete: () => {
      if (selectionStore.selectedAtomIds.length > 0) {
        vscode.postMessage({ command: 'deleteAtoms', atomIds: selectionStore.selectedAtomIds });
      } else if (selectionStore.selectedBondKeys.length > 0) {
        vscode.postMessage({ command: 'deleteBond', bondKey: selectionStore.selectedBondKeys[0] });
      }
    },

    onSelectAll: () => {
      if (!structureStore.currentStructure) return;
      const allIds = structureStore.currentStructure.atoms.map((a) => a.id);
      selectHandlers.applySelection(allIds, 'replace');
    },

    onInvertSelection: () => {
      if (!structureStore.currentStructure) return;
      const allIds = new Set(structureStore.currentStructure.atoms.map((a) => a.id));
      const currentIds = new Set(selectionStore.selectedAtomIds);
      const inverted = [...allIds].filter((id) => !currentIds.has(id));
      selectHandlers.applySelection(inverted, 'replace');
    },

    onAddAtom: (element: string, x: number, y: number, z: number) => {
      vscode.postMessage({ command: 'addAtom', element, x, y, z });
    },

    onCopy: (atomIds: string[]) => {
      vscode.postMessage({ command: 'copySelection', atomIds });
    },

    onPaste: () => {
      vscode.postMessage({ command: 'pasteSelection' });
    },

    onUndo: () => vscode.postMessage({ command: 'undo' }),
    onRedo: () => vscode.postMessage({ command: 'redo' }),
    onSave: () => vscode.postMessage({ command: 'saveStructure' }),
    onExportImage: () => {
      if (!renderer.exportHighResolutionImage) return;
      const result = renderer.exportHighResolutionImage({ scale: 4 });
      if (result?.dataUrl) {
        vscode.postMessage({
          command: 'saveRenderedImage',
          dataUrl: result.dataUrl,
          suggestedName: getImageFileName(),
          width: result.width,
          height: result.height,
        });
      }
    },

    onSetAtomColor: (atomIds: string[], color: string) => {
      vscode.postMessage({ command: 'setAtomColor', atomIds, color });
    },

    onSetAtomRadius: (atomIds: string[], radius: number) => {
      vscode.postMessage({ command: 'setAtomRadius', atomIds, radius });
    },

    onChangeElement: (atomIds: string[], element: string) => {
      vscode.postMessage({ command: 'changeAtoms', atomIds, element });
    },

    onCreateBond: (atomIds: string[]) => {
      vscode.postMessage({ command: 'createBond', atomIds });
    },

    onSetBondLength: (bondKeys: string[], length: number) => {
      if (bondKeys.length === 0) return;
      const bondKey = bondKeys[0];
      const [atomId1, atomId2] = bondKey.split('-');
      if (atomId1 && atomId2) {
        vscode.postMessage({ command: 'setBondLength', atomIds: [atomId1, atomId2], length });
      }
    },

    onDeleteAtoms: (atomIds: string[]) => {
      vscode.postMessage({ command: 'deleteAtoms', atomIds });
    },

    onDeleteBonds: (bondKeys: string[]) => {
      if (bondKeys.length > 0) {
        vscode.postMessage({ command: 'deleteBond', bondKey: bondKeys[0] });
      }
    },
  });
}

function start(): void {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;

  configHandler.init(vscode, setStatus, updateConfigSelector, rerenderCurrentStructure);
  colorSchemeHandler.init(vscode, setStatus, updateColorSchemeSelector);
  initInteractionConfigVscode(vscode);
  initInteractionConfig();
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
    if (!isStatusSelectionLocked()) updateStatusBar(true);
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
  brushPanel.update();

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
  updateSelectedAtomSizePanel();
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

(window as unknown as { togglePanel: (panelId: string) => void }).togglePanel = togglePanel;

// Re-export for other modules
export {
  setError,
  setStatus,
  updateStatusBar,
  syncStatusSelectionLock,
  isStatusSelectionLocked,
};
