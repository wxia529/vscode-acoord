import { DisplayConfig } from '../types';

export const DARK_PRESET: DisplayConfig = {
  id: 'preset-dark',
  name: 'Dark Theme',
  description: 'Dark background optimized for low-light environments',
  isPreset: true,
  isReadOnly: true,
  version: 1,
  schemaVersion: 2,
  createdAt: 0,
  updatedAt: 0,
  settings: {
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
    ambientIntensity: 0.4,
    ambientColor: '#444444',
    shininess: 50,
    keyLight: {
      intensity: 0.8,
      position: { x: 0, y: 0, z: 10 },
      color: '#ffffff'
    },
    fillLight: {
      intensity: 0.1,
      position: { x: -10, y: -5, z: 5 },
      color: '#aaaaaa'
    },
    rimLight: {
      intensity: 0.3,
      position: { x: 0, y: 5, z: -10 },
      color: '#ffffff'
    }
  }
};
