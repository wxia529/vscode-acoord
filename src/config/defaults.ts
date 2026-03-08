import type { DisplaySettings } from './types.js';
import { DEFAULT_BOND_SCHEME } from './bondSchemes.js';

export function getDefaultDisplaySettings(): DisplaySettings {
  return {
    showAxes: true,
    backgroundColor: '#0d1015',
    projectionMode: 'orthographic',
    unitCellColor: '#FF6600',
    unitCellThickness: 1,
    unitCellLineStyle: 'solid',
    scaleAtomsWithLattice: false,
    currentRadiusByElement: {},
    manualScale: 1,
    autoScaleEnabled: false,
    currentRadiusScale: 1,
    bondThicknessScale: 1,
    bondScheme: DEFAULT_BOND_SCHEME,
    viewZoom: 1,
    currentColorScheme: 'preset-bright',
    currentColorByElement: {},
    lightingEnabled: true,
    ambientIntensity: 0.5,
    ambientColor: '#ffffff',
    shininess: 50,
    keyLight: { intensity: 0.7, x: 0, y: 0, z: 10, color: '#CCCCCC' },
    fillLight: { intensity: 0, x: -10, y: -5, z: 5, color: '#ffffff' },
    rimLight: { intensity: 0, x: 0, y: 5, z: -10, color: '#ffffff' },
  };
}
