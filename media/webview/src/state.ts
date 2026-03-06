import type { Structure, Atom, LightConfig, DisplaySettings } from './types';

// =============================================================================
// Domain-specific stores (replacing monolithic state)
// =============================================================================

// ─────────────────────────────────────────────────────────────────────────────
// Structure Store - 结构数据
// ─────────────────────────────────────────────────────────────────────────────
export interface StructureState {
  currentStructure: Structure | null;
  currentSelectedAtom: Atom | null;
  currentSelectedBondKey: string | null;
}

export const structureStore: StructureState = {
  currentStructure: null,
  currentSelectedAtom: null,
  currentSelectedBondKey: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// Selection Store - 选择状态
// ─────────────────────────────────────────────────────────────────────────────
export interface SelectionState {
  selectedAtomIds: string[];
  selectedBondKeys: string[];
}

export const selectionStore: SelectionState = {
  selectedAtomIds: [],
  selectedBondKeys: [],
};

// ─────────────────────────────────────────────────────────────────────────────
// Display Store - 显示设置
// ─────────────────────────────────────────────────────────────────────────────
export interface DisplayState {
  showAxes: boolean;
  backgroundColor: string;
  unitCellColor: string;
  unitCellThickness: number;
  unitCellLineStyle: 'solid' | 'dashed';
  atomSizeUseDefaultSettings: boolean;
  atomSizeGlobal: number;
  atomSizeByElement: Record<string, number>;
  atomSizeByAtom: Record<string, number>;
  atomSizeElementExpanded: boolean;
  shininess: number;
  manualScale: number;
  autoScaleEnabled: boolean;
  atomSizeScale: number;
  bondThicknessScale: number;
  viewZoom: number;
  scaleAtomsWithLattice: boolean;
  projectionMode: 'orthographic' | 'perspective';
  supercell: [number, number, number];
  unitCellEditing: boolean;
  atomColorSchemeId: string;
  atomColorByElement: Record<string, string>;
}

export const displayStore: DisplayState = {
  showAxes: true,
  backgroundColor: '#0d1015',
  unitCellColor: '#FF6600',
  unitCellThickness: 1,
  unitCellLineStyle: 'solid',
  atomSizeUseDefaultSettings: true,
  atomSizeGlobal: 0.3,
  atomSizeByElement: {},
  atomSizeByAtom: {},
  atomSizeElementExpanded: false,
  shininess: 50,
  manualScale: 1,
  autoScaleEnabled: false,
  atomSizeScale: 1,
  bondThicknessScale: 1,
  viewZoom: 1,
  scaleAtomsWithLattice: false,
  projectionMode: 'orthographic',
  supercell: [1, 1, 1],
  unitCellEditing: false,
  atomColorSchemeId: '',
  atomColorByElement: {},
};

/** Default display settings used when a loaded config omits a field. */
const DISPLAY_DEFAULTS: Required<DisplaySettings> = {
  showAxes: true,
  backgroundColor: '#0d1015',
  unitCellColor: '#FF6600',
  unitCellThickness: 1,
  unitCellLineStyle: 'solid',
  atomSizeUseDefaultSettings: true,
  atomSizeGlobal: 0.3,
  atomSizeByElement: {},
  atomSizeByAtom: {},
  manualScale: 1,
  autoScaleEnabled: false,
  atomSizeScale: 1,
  bondThicknessScale: 1,
  viewZoom: 1,
  scaleAtomsWithLattice: false,
  projectionMode: 'orthographic',
  lightingEnabled: true,
  ambientIntensity: 0.5,
  ambientColor: '#ffffff',
  shininess: 50,
  keyLight: { intensity: 0.7, x: 0, y: 0, z: 10, color: '#CCCCCC' },
  fillLight: { intensity: 0, x: -10, y: -5, z: 5, color: '#ffffff' },
  rimLight: { intensity: 0, x: 0, y: 5, z: -10, color: '#ffffff' },
  atomColorSchemeId: '',
  atomColorByElement: {},
};

function flattenLight(light: LightConfig | { intensity: number; color: string; position: { x: number; y: number; z: number } }): LightConfig {
  const pos = (light as { position?: { x: number; y: number; z: number } }).position;
  if (pos && typeof pos.x === 'number') {
    return { intensity: light.intensity, color: light.color, x: pos.x, y: pos.y, z: pos.z };
  }
  const flat = light as LightConfig;
  return { intensity: flat.intensity, color: flat.color, x: flat.x ?? 0, y: flat.y ?? 0, z: flat.z ?? 0 };
}

/** Extract display settings from displayStore */
export function extractDisplaySettings(): DisplaySettings {
  const flattenToSettings = (light: LightConfig | undefined): LightConfig => {
    if (!light) return { intensity: 0, color: '#ffffff', x: 0, y: 0, z: 0 };
    return { intensity: light.intensity, color: light.color, x: light.x, y: light.y, z: light.z };
  };

  return {
    showAxes: displayStore.showAxes,
    backgroundColor: displayStore.backgroundColor,
    unitCellColor: displayStore.unitCellColor,
    unitCellThickness: displayStore.unitCellThickness,
    unitCellLineStyle: displayStore.unitCellLineStyle,
    atomSizeUseDefaultSettings: displayStore.atomSizeUseDefaultSettings,
    atomSizeGlobal: displayStore.atomSizeGlobal,
    atomSizeByElement: displayStore.atomSizeByElement,
    atomSizeByAtom: displayStore.atomSizeByAtom,
    manualScale: displayStore.manualScale,
    autoScaleEnabled: displayStore.autoScaleEnabled,
    atomSizeScale: displayStore.atomSizeScale,
    bondThicknessScale: displayStore.bondThicknessScale,
    viewZoom: displayStore.viewZoom,
    scaleAtomsWithLattice: displayStore.scaleAtomsWithLattice,
    projectionMode: displayStore.projectionMode,
    lightingEnabled: lightingStore.lightingEnabled,
    ambientIntensity: lightingStore.ambientIntensity,
    ambientColor: lightingStore.ambientColor,
    shininess: displayStore.shininess,
    keyLight: flattenToSettings(lightingStore.keyLight),
    fillLight: flattenToSettings(lightingStore.fillLight),
    rimLight: flattenToSettings(lightingStore.rimLight),
    atomColorSchemeId: displayStore.atomColorSchemeId,
    atomColorByElement: displayStore.atomColorByElement,
  };
}

/** Apply display settings to displayStore and lightingStore */
export function applyDisplaySettings(settings: DisplaySettings): void {
  if (!settings) return;
  const d = DISPLAY_DEFAULTS;
  
  displayStore.showAxes = settings.showAxes ?? d.showAxes;
  displayStore.backgroundColor = settings.backgroundColor ?? d.backgroundColor;
  displayStore.unitCellColor = settings.unitCellColor ?? d.unitCellColor;
  displayStore.unitCellThickness = settings.unitCellThickness ?? d.unitCellThickness;
  displayStore.unitCellLineStyle = settings.unitCellLineStyle ?? d.unitCellLineStyle;
  displayStore.atomSizeUseDefaultSettings = settings.atomSizeUseDefaultSettings ?? d.atomSizeUseDefaultSettings;
  displayStore.atomSizeGlobal = settings.atomSizeGlobal ?? d.atomSizeGlobal;
  displayStore.atomSizeByElement = settings.atomSizeByElement ?? d.atomSizeByElement;
  displayStore.atomSizeByAtom = settings.atomSizeByAtom ?? d.atomSizeByAtom;
  displayStore.manualScale = settings.manualScale ?? d.manualScale;
  displayStore.autoScaleEnabled = settings.autoScaleEnabled ?? d.autoScaleEnabled;
  displayStore.atomSizeScale = settings.atomSizeScale ?? d.atomSizeScale;
  displayStore.bondThicknessScale = settings.bondThicknessScale ?? d.bondThicknessScale;
  displayStore.viewZoom = settings.viewZoom ?? d.viewZoom;
  displayStore.scaleAtomsWithLattice = settings.scaleAtomsWithLattice ?? d.scaleAtomsWithLattice;
  displayStore.projectionMode = settings.projectionMode ?? d.projectionMode;
  displayStore.shininess = settings.shininess ?? d.shininess;
  displayStore.atomColorSchemeId = settings.atomColorSchemeId ?? d.atomColorSchemeId;
  displayStore.atomColorByElement = settings.atomColorByElement ?? d.atomColorByElement;
  
  lightingStore.lightingEnabled = settings.lightingEnabled ?? d.lightingEnabled;
  lightingStore.ambientIntensity = settings.ambientIntensity ?? d.ambientIntensity;
  lightingStore.ambientColor = settings.ambientColor ?? d.ambientColor;
  lightingStore.keyLight = settings.keyLight ? flattenLight(settings.keyLight) : { ...d.keyLight };
  lightingStore.fillLight = settings.fillLight ? flattenLight(settings.fillLight) : { ...d.fillLight };
  lightingStore.rimLight = settings.rimLight ? flattenLight(settings.rimLight) : { ...d.rimLight };
}

// ─────────────────────────────────────────────────────────────────────────────
// Lighting Store - 光照设置
// ─────────────────────────────────────────────────────────────────────────────
export interface LightingState {
  lightingEnabled: boolean;
  ambientIntensity: number;
  ambientColor: string;
  keyLight: LightConfig;
  fillLight: LightConfig;
  rimLight: LightConfig;
}

export const lightingStore: LightingState = {
  lightingEnabled: true,
  ambientIntensity: 0.5,
  ambientColor: '#ffffff',
  keyLight: { intensity: 0.7, x: 0, y: 0, z: 10, color: '#CCCCCC' },
  fillLight: { intensity: 0, x: -10, y: -5, z: 5, color: '#ffffff' },
  rimLight: { intensity: 0, x: 0, y: 5, z: -10, color: '#ffffff' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Interaction Store - 交互状态
// ─────────────────────────────────────────────────────────────────────────────
export interface InteractionState {
  isDragging: boolean;
  dragAtomId: string | null;
  lastDragWorld: { x: number; y: number; z: number } | null;
  dragPlaneNormal: { x: number; y: number; z: number } | null;
  rotationAxis: string;
  rotationInProgress: boolean;
  groupMoveActive: boolean;
  renderAtomOffsets: Record<string, [number, number, number]>;
  shouldFitCamera: boolean;
}

export const interactionStore: InteractionState = {
  isDragging: false,
  dragAtomId: null,
  lastDragWorld: null,
  dragPlaneNormal: null,
  rotationAxis: 'z',
  rotationInProgress: false,
  groupMoveActive: false,
  renderAtomOffsets: {},
  shouldFitCamera: true,
};

// ─────────────────────────────────────────────────────────────────────────────
// Trajectory Store - 轨迹状态
// ─────────────────────────────────────────────────────────────────────────────
export interface TrajectoryState {
  trajectoryFrameIndex: number;
  trajectoryFrameCount: number;
  trajectoryPlaying: boolean;
  trajectoryPlaybackFps: number;
}

export const trajectoryStore: TrajectoryState = {
  trajectoryFrameIndex: 0,
  trajectoryFrameCount: 1,
  trajectoryPlaying: false,
  trajectoryPlaybackFps: 8,
};

// ─────────────────────────────────────────────────────────────────────────────
// Adsorption Store - 吸附状态
// ─────────────────────────────────────────────────────────────────────────────
export interface AdsorptionState {
  adsorptionReferenceId: string | null;
  adsorptionAdsorbateIds: string[];
}

export const adsorptionStore: AdsorptionState = {
  adsorptionReferenceId: null,
  adsorptionAdsorbateIds: [],
};

// ─────────────────────────────────────────────────────────────────────────────
// Config Store - 配置管理
// ─────────────────────────────────────────────────────────────────────────────
export interface ConfigEntry {
  id: string;
  name: string;
  description?: string;
  settings?: DisplaySettings;
}

export interface AvailableConfigs {
  presets: ConfigEntry[];
  user: ConfigEntry[];
}

export interface ConfigState {
  currentConfigId: string;
  currentConfigName: string;
  availableConfigs: AvailableConfigs;
  isLoadingConfig: boolean;
}

export const configStore: ConfigState = {
  currentConfigId: 'preset-default',
  currentConfigName: 'Default',
  availableConfigs: { presets: [], user: [] },
  isLoadingConfig: false,
};

// ─────────────────────────────────────────────────────────────────────────────
// Color Scheme Store - 颜色方案管理
// ─────────────────────────────────────────────────────────────────────────────
export interface ColorSchemeEntry {
  id: string;
  name: string;
  description?: string;
  colors?: Record<string, string>;
}

export interface AvailableColorSchemes {
  presets: ColorSchemeEntry[];
  user: ColorSchemeEntry[];
}

export interface ColorSchemeState {
  currentSchemeId: string;
  currentSchemeName: string;
  availableSchemes: AvailableColorSchemes;
  isLoadingScheme: boolean;
}

export const colorSchemeStore: ColorSchemeState = {
  currentSchemeId: '',
  currentSchemeName: '',
  availableSchemes: { presets: [], user: [] },
  isLoadingScheme: false,
};

// =============================================================================
// End of state module
// =============================================================================
