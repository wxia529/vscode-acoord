// Display Configuration Types
// Defines all interfaces for the display configuration system

export interface Position3D {
  x: number;
  y: number;
  z: number;
}

export interface LightConfig {
  intensity: number;
  color: string;
  // Support both nested position and flat format
  position?: Position3D;
  x?: number;
  y?: number;
  z?: number;
}

// Display Settings - Core configuration data
export interface DisplaySettings {
  // Display Options
  showAxes: boolean;
  backgroundColor: string;

  // Unit Cell
  unitCellColor: string;
  unitCellThickness: number;
  unitCellLineStyle: 'solid' | 'dashed';

  // Atom Size
  atomSizeUseDefaultSettings: boolean;
  atomSizeGlobal: number;
  atomSizeByElement: Record<string, number>;
  atomSizeByAtom: Record<string, number>;

  // Scaling
  manualScale: number;
  autoScaleEnabled: boolean;
  atomSizeScale: number;
  bondThicknessScale: number;
  viewZoom: number;
  scaleAtomsWithLattice: boolean;
  projectionMode: 'orthographic' | 'perspective';

  // Lighting
  lightingEnabled: boolean;
  ambientIntensity: number;
  ambientColor: string;
  shininess: number;
  keyLight: LightConfig;
  fillLight: LightConfig;
  rimLight: LightConfig;
}

// Display Configuration Object
export interface DisplayConfig {
  id: string;
  name: string;
  description?: string;
  isPreset: boolean;
  isReadOnly: boolean;
  version: number;
  schemaVersion: number;
  createdAt: number;
  updatedAt: number;
  settings: DisplaySettings;
}

// Configuration Manifest
export interface ConfigManifest {
  version: string;
  schemaVersion: number;
  lastUpdated: string;
  configs: ConfigMeta[];
}

export interface ConfigMeta {
  id: string;
  name: string;
  isPreset: boolean;
  version: number;
  schemaVersion: number;
  updatedAt: number;
}

// Export Package for Import/Export
export interface ConfigExportPackage {
  version: string;
  exportedAt: string;
  exportedFrom: string;
  configs: DisplayConfig[];
}

// Configuration Change Event
export interface ConfigChangeEvent {
  type: 'loaded' | 'saved' | 'deleted' | 'imported' | 'migrated';
  configId: string;
  timestamp: number;
}

// Validation Result
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// Migration Interface
export interface Migration {
  fromVersion: number;
  toVersion: number;
  migrate: (config: DisplayConfig) => Promise<DisplayConfig>;
}
