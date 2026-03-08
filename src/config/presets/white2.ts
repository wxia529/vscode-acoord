import { DisplayConfig } from '../types.js';

export const WHITE2_PRESET: DisplayConfig = {
  id: 'preset-white2',
  name: 'White 2',
  description: 'Bright background with bright atom colors and black lattice',
  isPreset: true,
  isReadOnly: true,
  version: 1,
  schemaVersion: 4,
  createdAt: 0,
  updatedAt: 0,
  settings: {
    showAxes: true,
    backgroundColor: '#ffffff',
    unitCellColor: '#000000',
    unitCellThickness: 1,
    unitCellLineStyle: 'solid',
    currentRadiusByElement: {},
    manualScale: 1,
    autoScaleEnabled: false,
    currentRadiusScale: 1,
    bondThicknessScale: 3,
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
    currentColorScheme: 'preset-bright',
    currentColorByElement: {}
  }
};
