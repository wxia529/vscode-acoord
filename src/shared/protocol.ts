/**
 * Shared message protocol between extension and webview.
 *
 * This is the single source of truth for all message types exchanged via
 * postMessage.  Both the extension (Node / VS Code API) and the webview
 * (browser / esbuild bundle) import from this file.
 *
 * IMPORTANT: This file must NOT import from any extension-only or
 * webview-only module.  It may only contain plain TypeScript interfaces,
 * types, and constants.
 */

// ============================================================================
// Wire-format data types
// ============================================================================
// These describe the JSON shapes that actually travel over postMessage.

export interface WireAtom {
  id: string;
  element: string;
  color: string;
  position: [number, number, number];
  radius: number;
  selected?: boolean;
  selectable?: boolean;
}

export interface WireBond {
  key: string;
  atomId1: string;
  atomId2: string;
  start: [number, number, number];
  end: [number, number, number];
  radius: number;
  color: string;
  color1?: string;
  color2?: string;
  selected?: boolean;
}

export interface WireUnitCellEdge {
  start: [number, number, number];
  end: [number, number, number];
  radius?: number;
  color?: string;
}

export interface WireUnitCell {
  corners?: [number, number, number][];
  edges: WireUnitCellEdge[];
}

export interface WireUnitCellParams {
  a: number;
  b: number;
  c: number;
  alpha: number;
  beta: number;
  gamma: number;
}

export interface WireLightConfig {
  intensity: number;
  color: string;
  /** Flat position fields (webview format) */
  x: number;
  y: number;
  z: number;
}

/**
 * Display settings as they appear on the wire.
 *
 * All fields are optional so that partial updates can be sent.
 * This interface is the single source of truth for display settings;
 * the extension-side DisplaySettings type is derived from this.
 */
export interface WireDisplaySettings {
  showAxes?: boolean;
  backgroundColor?: string;
  unitCellColor?: string;
  unitCellThickness?: number;
  unitCellLineStyle?: 'solid' | 'dashed';
  atomSizeUseDefaultSettings?: boolean;
  atomSizeGlobal?: number;
  atomSizeByElement?: Record<string, number>;
  atomSizeByAtom?: Record<string, number>;
  manualScale?: number;
  autoScaleEnabled?: boolean;
  atomSizeScale?: number;
  bondThicknessScale?: number;
  viewZoom?: number;
  scaleAtomsWithLattice?: boolean;
  projectionMode?: 'orthographic' | 'perspective';
  lightingEnabled?: boolean;
  ambientIntensity?: number;
  ambientColor?: string;
  shininess?: number;
  keyLight?: WireLightConfig;
  fillLight?: WireLightConfig;
  rimLight?: WireLightConfig;
}

export interface WireConfigEntry {
  id: string;
  name: string;
  description?: string;
  settings?: WireDisplaySettings;
}

/**
 * Full render payload sent from extension to webview.
 */
export interface WireRenderData {
  atoms: WireAtom[];
  bonds: WireBond[];
  renderAtoms: WireAtom[];
  renderBonds: WireBond[];
  unitCell: WireUnitCell | null;
  unitCellParams: WireUnitCellParams | null;
  supercell: [number, number, number];
  selectedAtomId?: string;
  selectedAtomIds: string[];
  selectedBondKey?: string;
  selectedBondKeys: string[];
  trajectoryFrameIndex: number;
  trajectoryFrameCount: number;
}

// ============================================================================
// Extension -> Webview Messages
// ============================================================================

export interface RenderMessage {
  command: 'render';
  data: WireRenderData;
  displaySettings?: WireDisplaySettings;
}

export interface DisplayConfigChangedMessage {
  command: 'displayConfigChanged';
  config: {
    id: string;
    name: string;
    settings: WireDisplaySettings;
  };
}

export interface DisplayConfigsLoadedMessage {
  command: 'displayConfigsLoaded';
  presets: Array<{ id: string; name: string; description?: string }>;
  user: WireConfigEntry[];
}

export interface DisplayConfigLoadedMessage {
  command: 'displayConfigLoaded';
  config: {
    id: string;
    name: string;
    settings: WireDisplaySettings;
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
  settings: WireDisplaySettings;
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
 * All messages sent from extension to webview.
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
// Webview -> Extension Messages
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

export interface RedoMessage {
  command: 'redo';
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
  params: WireUnitCellParams;
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
  settings?: WireDisplaySettings;
}

export interface SaveDisplayConfigMessage {
  command: 'saveDisplayConfig';
  name: string;
  settings: WireDisplaySettings;
  description?: string;
  existingId?: string;
}

export interface GetCurrentDisplaySettingsMessage {
  command: 'getCurrentDisplaySettings';
}

export interface UpdateDisplaySettingsMessage {
  command: 'updateDisplaySettings';
  settings: WireDisplaySettings;
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
 * All messages sent from webview to extension.
 */
export type WebviewToExtensionMessage =
  | GetStateMessage
  | SetTrajectoryFrameMessage
  | BeginDragMessage
  | EndDragMessage
  | UndoMessage
  | RedoMessage
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
 * Extract message type by command.
 * Example: MessageByCommand<'render'> resolves to RenderMessage
 */
export type MessageByCommand<C extends string> = Extract<
  ExtensionToWebviewMessage | WebviewToExtensionMessage,
  { command: C }
>;

/**
 * Get all valid command strings.
 */
export type MessageCommand =
  | ExtensionToWebviewMessage['command']
  | WebviewToExtensionMessage['command'];
