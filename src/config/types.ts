// Display Configuration Types
// Defines all interfaces for the display configuration system

// Display Settings - Core configuration data
// This is the extension-side runtime type that extends the wire type.
// WireDisplaySettings is the single source of truth; DisplaySettings makes
// all fields required so the extension always works with a complete config.
import type { WireDisplaySettings, WireLightConfig, WireColorScheme } from '../shared/protocol.js';

export type { WireLightConfig };

export type DisplaySettings = Required<WireDisplaySettings>;

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
  colorSchemes?: WireColorScheme[];
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
