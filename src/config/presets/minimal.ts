import { DisplayConfig } from '../types';

export const MINIMAL_PRESET: DisplayConfig = {
  id: 'preset-minimal',
  name: 'Minimal',
  description: 'Clean and minimalistic view with minimal distractions',
  isPreset: true,
  isReadOnly: true,
  version: 1,
  schemaVersion: 2,
  createdAt: 0,
  updatedAt: 0,
  settings: {
    showAxes: false,
    backgroundColor: '#1a1a1a',
    unitCellColor: '#666666',
    unitCellThickness: 0.5,
    unitCellLineStyle: 'dashed',
    atomSizeUseDefaultSettings: true,
    atomSizeGlobal: 0.25,
    atomSizeByElement: {},
    atomSizeByAtom: {},
    manualScale: 1,
    autoScaleEnabled: false,
    atomSizeScale: 0.9,
    bondThicknessScale: 0.8,
    viewZoom: 1,
    scaleAtomsWithLattice: false,
    projectionMode: 'orthographic',
    lightingEnabled: false,
    ambientIntensity: 0.8,
    ambientColor: '#ffffff',
    shininess: 30,
    keyLight: {
      intensity: 0.5,
      position: { x: 0, y: 0, z: 10 },
      color: '#ffffff'
    },
    fillLight: {
      intensity: 0,
      position: { x: -10, y: -5, z: 5 },
      color: '#ffffff'
    },
    rimLight: {
      intensity: 0,
      position: { x: 0, y: 5, z: -10 },
      color: '#ffffff'
    }
  }
};
