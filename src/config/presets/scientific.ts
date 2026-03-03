import { DisplayConfig } from '../types';

export const SCIENTIFIC_PRESET: DisplayConfig = {
  id: 'preset-scientific',
  name: 'Scientific Paper',
  description: 'Optimized for publication-quality figures with white background',
  isPreset: true,
  isReadOnly: true,
  version: 1,
  schemaVersion: 2,
  createdAt: 0,
  updatedAt: 0,
  settings: {
    showAxes: false,
    backgroundColor: '#ffffff',
    unitCellColor: '#333333',
    unitCellThickness: 1.5,
    unitCellLineStyle: 'solid',
    atomSizeUseDefaultSettings: true,
    atomSizeGlobal: 0.35,
    atomSizeByElement: {},
    atomSizeByAtom: {},
    manualScale: 1,
    autoScaleEnabled: false,
    atomSizeScale: 1.1,
    bondThicknessScale: 1.2,
    viewZoom: 1,
    scaleAtomsWithLattice: false,
    projectionMode: 'orthographic',
    lightingEnabled: true,
    ambientIntensity: 0.6,
    ambientColor: '#ffffff',
    shininess: 80,
    keyLight: {
      intensity: 0.8,
      position: { x: 5, y: 5, z: 10 },
      color: '#ffffff'
    },
    fillLight: {
      intensity: 0.3,
      position: { x: -10, y: -5, z: 5 },
      color: '#eeeeee'
    },
    rimLight: {
      intensity: 0.2,
      position: { x: 0, y: 5, z: -10 },
      color: '#ffffff'
    }
  }
};
