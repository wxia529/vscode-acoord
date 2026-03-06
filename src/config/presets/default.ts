import { DisplayConfig } from '../types.js';

export const DEFAULT_PRESET: DisplayConfig = {
  id: 'preset-default',
  name: 'Default',
  description: 'Balanced settings for general use',
  isPreset: true,
  isReadOnly: true,
  version: 1,
  schemaVersion: 4,
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
    ambientIntensity: 0.5,
    ambientColor: '#ffffff',
    shininess: 50,
    keyLight: {
      intensity: 0.7,
      color: '#CCCCCC',
      x: 0,
      y: 0,
      z: 10
    },
    fillLight: {
      intensity: 0,
      color: '#ffffff',
      x: -10,
      y: -5,
      z: 5
    },
    rimLight: {
      intensity: 0,
      color: '#ffffff',
      x: 0,
      y: 5,
      z: -10
    },
    atomColorSchemeId: 'preset-jmol-default',
    atomColorByElement: {}
  }
};
