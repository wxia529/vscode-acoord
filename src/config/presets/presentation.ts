import { DisplayConfig } from '../types';

export const PRESENTATION_PRESET: DisplayConfig = {
  id: 'preset-presentation',
  name: 'Presentation',
  description: 'High contrast and bold styling for presentations and reports',
  isPreset: true,
  isReadOnly: true,
  version: 1,
  schemaVersion: 2,
  createdAt: 0,
  updatedAt: 0,
  settings: {
    showAxes: true,
    backgroundColor: '#f5f5f5',
    unitCellColor: '#cc3300',
    unitCellThickness: 2,
    unitCellLineStyle: 'solid',
    atomSizeUseDefaultSettings: true,
    atomSizeGlobal: 0.4,
    atomSizeByElement: {},
    atomSizeByAtom: {},
    manualScale: 1,
    autoScaleEnabled: false,
    atomSizeScale: 1.2,
    bondThicknessScale: 1.5,
    viewZoom: 1,
    scaleAtomsWithLattice: false,
    projectionMode: 'perspective',
    lightingEnabled: true,
    ambientIntensity: 0.5,
    ambientColor: '#ffffff',
    shininess: 60,
    keyLight: {
      intensity: 1.0,
      position: { x: 5, y: 10, z: 15 },
      color: '#ffffff'
    },
    fillLight: {
      intensity: 0.4,
      position: { x: -15, y: -10, z: 10 },
      color: '#ffffff'
    },
    rimLight: {
      intensity: 0.3,
      position: { x: 0, y: 10, z: -15 },
      color: '#ffffee'
    }
  }
};
