/**
 * Shared message protocol between extension and webview
 * All messages use discriminated unions with 'command' as the discriminator
 */

import type { DisplaySettings, ConfigEntry, Structure, Atom, Bond, UnitCell, UnitCellParams } from './types';

/**
 * Render data structure sent to webview - extends Structure with trajectory info
 */
export interface RenderData extends Omit<Structure, 'unitCell' | 'unitCellParams'> {
  atoms: Atom[];
  bonds: Bond[];
  renderAtoms: Atom[];
  renderBonds: Bond[];
  unitCell?: UnitCell;
  unitCellParams?: UnitCellParams;
  trajectoryFrameIndex: number;
  trajectoryFrameCount: number;
}

// ============================================================================
// Extension → Webview Messages
// ============================================================================

export interface RenderMessage {
  command: 'render';
  data: RenderData;
  displaySettings?: DisplaySettings;
}

export interface DisplayConfigChangedMessage {
  command: 'displayConfigChanged';
  config: {
    id: string;
    name: string;
    settings: DisplaySettings;
  };
}

export interface DisplayConfigsLoadedMessage {
  command: 'displayConfigsLoaded';
  presets: Array<{ id: string; name: string; description?: string }>;
  user: ConfigEntry[];
}

export interface DisplayConfigLoadedMessage {
  command: 'displayConfigLoaded';
  config: {
    id: string;
    name: string;
    settings: DisplaySettings;
  } | null;
}

export interface DisplayConfigSavedMessage {
  command: 'displayConfigSaved';
  config: {
    name: string;
  } | null;
}

export interface CurrentDisplaySettingsMessage {
  command: 'currentDisplaySettings';
  settings: DisplaySettings;
}

export interface DisplayConfigErrorMessage {
  command: 'displayConfigError';
  error: string;
}

export interface ImageSavedMessage {
  command: 'imageSaved';
  data: {
    fileName: string;
  };
}

export interface ImageSaveFailedMessage {
  command: 'imageSaveFailed';
  data: {
    reason: string;
  };
}

/**
 * All messages sent from extension to webview
 */
export type ExtensionToWebviewMessage =
  | RenderMessage
  | DisplayConfigChangedMessage
  | DisplayConfigsLoadedMessage
  | DisplayConfigLoadedMessage
  | DisplayConfigSavedMessage
  | CurrentDisplaySettingsMessage
  | DisplayConfigErrorMessage
  | ImageSavedMessage
  | ImageSaveFailedMessage;

// ============================================================================
// Webview → Extension Messages
// ============================================================================

export interface GetStateMessage {
  command: 'getState';
}

export interface SetTrajectoryFrameMessage {
  command: 'setTrajectoryFrame';
  frameIndex: number;
}

export interface BeginDragMessage {
  command: 'beginDrag';
  atomId: string;
}

export interface EndDragMessage {
  command: 'endDrag';
}

export interface UndoMessage {
  command: 'undo';
}

export interface SelectAtomMessage {
  command: 'selectAtom';
  atomId: string;
  add?: boolean;
}

export interface SetSelectionMessage {
  command: 'setSelection';
  atomIds: string[];
}

export interface SelectBondMessage {
  command: 'selectBond';
  bondKey?: string;
  add?: boolean;
}

export interface SetBondSelectionMessage {
  command: 'setBondSelection';
  bondKeys: string[];
}

export interface ToggleUnitCellMessage {
  command: 'toggleUnitCell';
}

export interface SetUnitCellMessage {
  command: 'setUnitCell';
  params: {
    a: number;
    b: number;
    c: number;
    alpha: number;
    beta: number;
    gamma: number;
  };
  scaleAtoms?: boolean;
}

export interface ClearUnitCellMessage {
  command: 'clearUnitCell';
}

export interface CenterToUnitCellMessage {
  command: 'centerToUnitCell';
}

export interface SetSupercellMessage {
  command: 'setSupercell';
  supercell: [number, number, number];
}

export interface AddAtomMessage {
  command: 'addAtom';
  element: string;
  x: number;
  y: number;
  z: number;
}

export interface DeleteAtomMessage {
  command: 'deleteAtom';
  atomId: string;
}

export interface DeleteAtomsMessage {
  command: 'deleteAtoms';
  atomIds: string[];
}

export interface MoveAtomMessage {
  command: 'moveAtom';
  atomId: string;
  x: number;
  y: number;
  z: number;
  preview?: boolean;
}

export interface MoveGroupMessage {
  command: 'moveGroup';
  atomIds: string[];
  dx: number;
  dy: number;
  dz: number;
  preview?: boolean;
}

export interface SetAtomsPositionsMessage {
  command: 'setAtomsPositions';
  atomPositions: Array<{
    id: string;
    x: number;
    y: number;
    z: number;
  }>;
  preview?: boolean;
}

export interface EndDragEditMessage {
  command: 'endDrag';
}

export interface CopyAtomsMessage {
  command: 'copyAtoms';
  atomIds: string[];
  offset: {
    x: number;
    y: number;
    z: number;
  };
}

export interface ChangeAtomsMessage {
  command: 'changeAtoms';
  atomIds: string[];
  element: string;
}

export interface SetAtomColorMessage {
  command: 'setAtomColor';
  atomIds: string[];
  color: string;
}

export interface UpdateAtomMessage {
  command: 'updateAtom';
  atomId: string;
  element?: string;
  x?: number;
  y?: number;
  z?: number;
}

export interface SetBondLengthMessage {
  command: 'setBondLength';
  atomIds: string[];
  length: number;
}

export interface CreateBondMessage {
  command: 'createBond';
  atomIds: string[];
}

export interface DeleteBondMessage {
  command: 'deleteBond';
  bondKey?: string;
  atomIds?: string[];
  bondKeys?: string[];
}

export interface RecalculateBondsMessage {
  command: 'recalculateBonds';
}

export interface SaveStructureMessage {
  command: 'saveStructure';
}

export interface SaveStructureAsMessage {
  command: 'saveStructureAs';
}

export interface SaveRenderedImageMessage {
  command: 'saveRenderedImage';
  dataUrl: string;
  suggestedName?: string;
  width?: number;
  height?: number;
}

export interface OpenSourceMessage {
  command: 'openSource';
}

export interface ReloadStructureMessage {
  command: 'reloadStructure';
}

export interface GetDisplayConfigsMessage {
  command: 'getDisplayConfigs';
}

export interface LoadDisplayConfigMessage {
  command: 'loadDisplayConfig';
  configId: string;
}

export interface PromptSaveDisplayConfigMessage {
  command: 'promptSaveDisplayConfig';
  settings?: DisplaySettings;
}

export interface SaveDisplayConfigMessage {
  command: 'saveDisplayConfig';
  name: string;
  settings: DisplaySettings;
  description?: string;
  existingId?: string;
}

export interface GetCurrentDisplaySettingsMessage {
  command: 'getCurrentDisplaySettings';
}

export interface UpdateDisplaySettingsMessage {
  command: 'updateDisplaySettings';
  settings: DisplaySettings;
}

export interface ExportDisplayConfigsMessage {
  command: 'exportDisplayConfigs';
}

export interface ImportDisplayConfigsMessage {
  command: 'importDisplayConfigs';
}

export interface ConfirmDeleteDisplayConfigMessage {
  command: 'confirmDeleteDisplayConfig';
  configId: string;
}

export interface DeleteDisplayConfigMessage {
  command: 'deleteDisplayConfig';
  configId: string;
}

/**
 * All messages sent from webview to extension
 */
export type WebviewToExtensionMessage =
  | GetStateMessage
  | SetTrajectoryFrameMessage
  | BeginDragMessage
  | EndDragMessage
  | UndoMessage
  | SelectAtomMessage
  | SetSelectionMessage
  | SelectBondMessage
  | SetBondSelectionMessage
  | ToggleUnitCellMessage
  | SetUnitCellMessage
  | ClearUnitCellMessage
  | CenterToUnitCellMessage
  | SetSupercellMessage
  | AddAtomMessage
  | DeleteAtomMessage
  | DeleteAtomsMessage
  | MoveAtomMessage
  | MoveGroupMessage
  | SetAtomsPositionsMessage
  | EndDragEditMessage
  | CopyAtomsMessage
  | ChangeAtomsMessage
  | SetAtomColorMessage
  | UpdateAtomMessage
  | SetBondLengthMessage
  | CreateBondMessage
  | DeleteBondMessage
  | RecalculateBondsMessage
  | SaveStructureMessage
  | SaveStructureAsMessage
  | SaveRenderedImageMessage
  | OpenSourceMessage
  | ReloadStructureMessage
  | GetDisplayConfigsMessage
  | LoadDisplayConfigMessage
  | PromptSaveDisplayConfigMessage
  | SaveDisplayConfigMessage
  | GetCurrentDisplaySettingsMessage
  | UpdateDisplaySettingsMessage
  | ExportDisplayConfigsMessage
  | ImportDisplayConfigsMessage
  | ConfirmDeleteDisplayConfigMessage
  | DeleteDisplayConfigMessage;

// ============================================================================
// Utility types
// ============================================================================

/**
 * Extract message type by command
 * Example: MessageByCommand<'render'> returns RenderMessage
 */
export type MessageByCommand<C extends string> = Extract<
  ExtensionToWebviewMessage | WebviewToExtensionMessage,
  { command: C }
>;

/**
 * Get all valid command strings
 */
export type MessageCommand = ExtensionToWebviewMessage['command'] | WebviewToExtensionMessage['command'];
