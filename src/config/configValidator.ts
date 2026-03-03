import { DisplayConfig, DisplaySettings, ValidationResult } from './types';
import { parseElement } from '../utils/elementData';

/**
 * Validates display configurations
 */
export class ConfigValidator {
  private static readonly colorPattern = /^#[0-9a-fA-F]{6}$/;
  private static readonly defaults: DisplaySettings = {
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
      position: { x: 0, y: 0, z: 10 }
    },
    fillLight: {
      intensity: 0,
      color: '#ffffff',
      position: { x: -10, y: -5, z: 5 }
    },
    rimLight: {
      intensity: 0,
      color: '#ffffff',
      position: { x: 0, y: 5, z: -10 }
    }
  };

  private static readonly ranges = {
    unitCellThickness: { min: 0.1, max: 10 },
    atomSizeGlobal: { min: 0.05, max: 5 },
    manualScale: { min: 0.1, max: 10 },
    atomSizeScale: { min: 0.1, max: 5 },
    bondThicknessScale: { min: 0.1, max: 10 },
    viewZoom: { min: 0.1, max: 5 },
    ambientIntensity: { min: 0, max: 5 },
    shininess: { min: 0, max: 200 },
    lightIntensity: { min: 0, max: 5 },
    lightPosition: { min: -100, max: 100 },
    atomSizeMap: { min: 0.05, max: 5 }
  };
  /**
   * Validate a display configuration
   */
  validate(config: DisplayConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    if (!config.id) {
      errors.push('Config must have an ID');
    }

    if (!config.name) {
      errors.push('Config must have a name');
    }

    if (!config.settings) {
      errors.push('Config must have settings');
    } else {
      const settingsErrors = this.validateSettings(config.settings);
      errors.push(...settingsErrors);
    }

    // Check version
    if (typeof config.schemaVersion !== 'number') {
      errors.push('Config must have a schemaVersion');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  normalizeConfig(config: DisplayConfig): { config: DisplayConfig; warnings: string[]; changed: boolean } {
    const { settings, warnings, changed } = this.normalizeSettings(config.settings);
    if (!changed) {
      return { config, warnings, changed };
    }
    return {
      config: {
        ...config,
        settings
      },
      warnings,
      changed
    };
  }

  normalizeSettings(settings: DisplaySettings): { settings: DisplaySettings; warnings: string[]; changed: boolean } {
    const input: Record<string, any> = settings && typeof settings === 'object' ? settings : {};
    const warnings: string[] = [];
    let changed = false;

    const normalizeNumber = (
      value: any,
      fallback: number,
      range: { min: number; max: number },
      label: string
    ): number => {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        warnings.push(`${label} must be a number; using default.`);
        changed = true;
        return fallback;
      }
      const clamped = Math.min(range.max, Math.max(range.min, value));
      if (clamped !== value) {
        warnings.push(`${label} out of range; clamped.`);
        changed = true;
      }
      return clamped;
    };

    const normalizeBoolean = (value: any, fallback: boolean, label: string): boolean => {
      if (typeof value !== 'boolean') {
        warnings.push(`${label} must be a boolean; using default.`);
        changed = true;
        return fallback;
      }
      return value;
    };

    const normalizeColor = (value: any, fallback: string, label: string): string => {
      if (typeof value !== 'string' || !ConfigValidator.colorPattern.test(value)) {
        warnings.push(`${label} must be a hex color; using default.`);
        changed = true;
        return fallback;
      }
      return value;
    };

    const normalizeEnum = <T extends string>(
      value: any,
      allowed: T[],
      fallback: T,
      label: string
    ): T => {
      if (!allowed.includes(value)) {
        warnings.push(`${label} must be one of ${allowed.join(', ')}; using default.`);
        changed = true;
        return fallback;
      }
      return value as T;
    };

    const normalizeLight = (value: any, fallback: DisplaySettings['keyLight'], label: string) => {
      if (!value || typeof value !== 'object') {
        warnings.push(`${label} must be an object; using default.`);
        changed = true;
        return fallback;
      }

      const position = value.position && typeof value.position === 'object'
        ? value.position
        : value;

      return {
        intensity: normalizeNumber(
          value.intensity,
          fallback.intensity,
          ConfigValidator.ranges.lightIntensity,
          `${label}.intensity`
        ),
        color: normalizeColor(value.color, fallback.color, `${label}.color`),
        position: {
          x: normalizeNumber(
            position.x,
            fallback.position?.x ?? 0,
            ConfigValidator.ranges.lightPosition,
            `${label}.position.x`
          ),
          y: normalizeNumber(
            position.y,
            fallback.position?.y ?? 0,
            ConfigValidator.ranges.lightPosition,
            `${label}.position.y`
          ),
          z: normalizeNumber(
            position.z,
            fallback.position?.z ?? 0,
            ConfigValidator.ranges.lightPosition,
            `${label}.position.z`
          )
        }
      };
    };

    const normalizeAtomSizeMap = (value: any, label: string, enforceElement: boolean) => {
      if (!value || typeof value !== 'object') {
        warnings.push(`${label} must be an object; using empty map.`);
        changed = true;
        return {} as Record<string, number>;
      }

      const output: Record<string, number> = {};
      for (const [rawKey, rawValue] of Object.entries(value)) {
        if (typeof rawKey !== 'string' || !rawKey.trim()) {
          warnings.push(`${label} contains invalid key; entry removed.`);
          changed = true;
          continue;
        }
        const key = enforceElement ? parseElement(rawKey) : rawKey.trim();
        if (!key) {
          warnings.push(`${label} contains unknown element '${rawKey}'; entry removed.`);
          changed = true;
          continue;
        }
        if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) {
          warnings.push(`${label}.${rawKey} must be a number; entry removed.`);
          changed = true;
          continue;
        }
        const clamped = Math.min(
          ConfigValidator.ranges.atomSizeMap.max,
          Math.max(ConfigValidator.ranges.atomSizeMap.min, rawValue)
        );
        if (clamped !== rawValue) {
          warnings.push(`${label}.${rawKey} out of range; clamped.`);
          changed = true;
        }
        output[key] = clamped;
      }
      return output;
    };

    const defaults = ConfigValidator.defaults;

    const normalized: DisplaySettings = {
      showAxes: normalizeBoolean(input.showAxes, defaults.showAxes, 'settings.showAxes'),
      backgroundColor: normalizeColor(input.backgroundColor, defaults.backgroundColor, 'settings.backgroundColor'),
      unitCellColor: normalizeColor(input.unitCellColor, defaults.unitCellColor, 'settings.unitCellColor'),
      unitCellThickness: normalizeNumber(
        input.unitCellThickness,
        defaults.unitCellThickness,
        ConfigValidator.ranges.unitCellThickness,
        'settings.unitCellThickness'
      ),
      unitCellLineStyle: normalizeEnum(
        input.unitCellLineStyle,
        ['solid', 'dashed'],
        defaults.unitCellLineStyle,
        'settings.unitCellLineStyle'
      ),
      atomSizeUseDefaultSettings: normalizeBoolean(
        input.atomSizeUseDefaultSettings,
        defaults.atomSizeUseDefaultSettings,
        'settings.atomSizeUseDefaultSettings'
      ),
      atomSizeGlobal: normalizeNumber(
        input.atomSizeGlobal,
        defaults.atomSizeGlobal,
        ConfigValidator.ranges.atomSizeGlobal,
        'settings.atomSizeGlobal'
      ),
      atomSizeByElement: normalizeAtomSizeMap(
        input.atomSizeByElement,
        'settings.atomSizeByElement',
        true
      ),
      atomSizeByAtom: normalizeAtomSizeMap(
        input.atomSizeByAtom,
        'settings.atomSizeByAtom',
        false
      ),
      manualScale: normalizeNumber(
        input.manualScale,
        defaults.manualScale,
        ConfigValidator.ranges.manualScale,
        'settings.manualScale'
      ),
      autoScaleEnabled: normalizeBoolean(
        input.autoScaleEnabled,
        defaults.autoScaleEnabled,
        'settings.autoScaleEnabled'
      ),
      atomSizeScale: normalizeNumber(
        input.atomSizeScale,
        defaults.atomSizeScale,
        ConfigValidator.ranges.atomSizeScale,
        'settings.atomSizeScale'
      ),
      bondThicknessScale: normalizeNumber(
        input.bondThicknessScale,
        defaults.bondThicknessScale,
        ConfigValidator.ranges.bondThicknessScale,
        'settings.bondThicknessScale'
      ),
      viewZoom: normalizeNumber(
        input.viewZoom,
        defaults.viewZoom,
        ConfigValidator.ranges.viewZoom,
        'settings.viewZoom'
      ),
      scaleAtomsWithLattice: normalizeBoolean(
        input.scaleAtomsWithLattice,
        defaults.scaleAtomsWithLattice,
        'settings.scaleAtomsWithLattice'
      ),
      projectionMode: normalizeEnum(
        input.projectionMode,
        ['orthographic', 'perspective'],
        defaults.projectionMode,
        'settings.projectionMode'
      ),
      lightingEnabled: normalizeBoolean(
        input.lightingEnabled,
        defaults.lightingEnabled,
        'settings.lightingEnabled'
      ),
      ambientIntensity: normalizeNumber(
        input.ambientIntensity,
        defaults.ambientIntensity,
        ConfigValidator.ranges.ambientIntensity,
        'settings.ambientIntensity'
      ),
      ambientColor: normalizeColor(input.ambientColor, defaults.ambientColor, 'settings.ambientColor'),
      shininess: normalizeNumber(
        input.shininess,
        defaults.shininess,
        ConfigValidator.ranges.shininess,
        'settings.shininess'
      ),
      keyLight: normalizeLight(input.keyLight, defaults.keyLight, 'settings.keyLight'),
      fillLight: normalizeLight(input.fillLight, defaults.fillLight, 'settings.fillLight'),
      rimLight: normalizeLight(input.rimLight, defaults.rimLight, 'settings.rimLight')
    };

    return { settings: normalized, warnings, changed };
  }

  private validateSettings(settings: any): string[] {
    const errors: string[] = [];

    // Check required settings
    if (typeof settings.showAxes !== 'boolean') {
      errors.push('settings.showAxes must be a boolean');
    }

    if (typeof settings.backgroundColor !== 'string') {
      errors.push('settings.backgroundColor must be a string');
    } else if (!ConfigValidator.colorPattern.test(settings.backgroundColor)) {
      errors.push('settings.backgroundColor must be a hex color');
    }

    if (typeof settings.unitCellColor !== 'string') {
      errors.push('settings.unitCellColor must be a string');
    } else if (!ConfigValidator.colorPattern.test(settings.unitCellColor)) {
      errors.push('settings.unitCellColor must be a hex color');
    }

    if (typeof settings.unitCellThickness !== 'number') {
      errors.push('settings.unitCellThickness must be a number');
    } else if (
      settings.unitCellThickness < ConfigValidator.ranges.unitCellThickness.min ||
      settings.unitCellThickness > ConfigValidator.ranges.unitCellThickness.max
    ) {
      errors.push('settings.unitCellThickness out of range');
    }

    if (!['solid', 'dashed'].includes(settings.unitCellLineStyle)) {
      errors.push('settings.unitCellLineStyle must be "solid" or "dashed"');
    }

    if (typeof settings.atomSizeUseDefaultSettings !== 'boolean') {
      errors.push('settings.atomSizeUseDefaultSettings must be a boolean');
    }

    if (typeof settings.atomSizeGlobal !== 'number') {
      errors.push('settings.atomSizeGlobal must be a number');
    } else if (
      settings.atomSizeGlobal < ConfigValidator.ranges.atomSizeGlobal.min ||
      settings.atomSizeGlobal > ConfigValidator.ranges.atomSizeGlobal.max
    ) {
      errors.push('settings.atomSizeGlobal out of range');
    }

    if (typeof settings.manualScale !== 'number') {
      errors.push('settings.manualScale must be a number');
    } else if (
      settings.manualScale < ConfigValidator.ranges.manualScale.min ||
      settings.manualScale > ConfigValidator.ranges.manualScale.max
    ) {
      errors.push('settings.manualScale out of range');
    }

    if (typeof settings.autoScaleEnabled !== 'boolean') {
      errors.push('settings.autoScaleEnabled must be a boolean');
    }

    if (typeof settings.atomSizeScale !== 'number') {
      errors.push('settings.atomSizeScale must be a number');
    } else if (
      settings.atomSizeScale < ConfigValidator.ranges.atomSizeScale.min ||
      settings.atomSizeScale > ConfigValidator.ranges.atomSizeScale.max
    ) {
      errors.push('settings.atomSizeScale out of range');
    }

    if (typeof settings.bondThicknessScale !== 'number') {
      errors.push('settings.bondThicknessScale must be a number');
    } else if (
      settings.bondThicknessScale < ConfigValidator.ranges.bondThicknessScale.min ||
      settings.bondThicknessScale > ConfigValidator.ranges.bondThicknessScale.max
    ) {
      errors.push('settings.bondThicknessScale out of range');
    }

    if (typeof settings.viewZoom !== 'number') {
      errors.push('settings.viewZoom must be a number');
    } else if (
      settings.viewZoom < ConfigValidator.ranges.viewZoom.min ||
      settings.viewZoom > ConfigValidator.ranges.viewZoom.max
    ) {
      errors.push('settings.viewZoom out of range');
    }

    if (typeof settings.scaleAtomsWithLattice !== 'boolean') {
      errors.push('settings.scaleAtomsWithLattice must be a boolean');
    }

    if (!['orthographic', 'perspective'].includes(settings.projectionMode)) {
      errors.push('settings.projectionMode must be "orthographic" or "perspective"');
    }

    if (typeof settings.lightingEnabled !== 'boolean') {
      errors.push('settings.lightingEnabled must be a boolean');
    }

    if (typeof settings.ambientIntensity !== 'number') {
      errors.push('settings.ambientIntensity must be a number');
    } else if (
      settings.ambientIntensity < ConfigValidator.ranges.ambientIntensity.min ||
      settings.ambientIntensity > ConfigValidator.ranges.ambientIntensity.max
    ) {
      errors.push('settings.ambientIntensity out of range');
    }

    if (typeof settings.ambientColor !== 'string') {
      errors.push('settings.ambientColor must be a string');
    } else if (!ConfigValidator.colorPattern.test(settings.ambientColor)) {
      errors.push('settings.ambientColor must be a hex color');
    }

    if (typeof settings.shininess !== 'number') {
      errors.push('settings.shininess must be a number');
    } else if (
      settings.shininess < ConfigValidator.ranges.shininess.min ||
      settings.shininess > ConfigValidator.ranges.shininess.max
    ) {
      errors.push('settings.shininess out of range');
    }

    if (typeof settings.atomSizeByElement !== 'object' || settings.atomSizeByElement === null) {
      errors.push('settings.atomSizeByElement must be an object');
    } else {
      for (const [key, value] of Object.entries(settings.atomSizeByElement)) {
        const symbol = typeof key === 'string' ? parseElement(key) : undefined;
        if (!symbol) {
          errors.push(`settings.atomSizeByElement contains unknown element ${String(key)}`);
          continue;
        }
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          errors.push(`settings.atomSizeByElement.${symbol} must be a number`);
          continue;
        }
        if (
          value < ConfigValidator.ranges.atomSizeMap.min ||
          value > ConfigValidator.ranges.atomSizeMap.max
        ) {
          errors.push(`settings.atomSizeByElement.${symbol} out of range`);
        }
      }
    }

    if (typeof settings.atomSizeByAtom !== 'object' || settings.atomSizeByAtom === null) {
      errors.push('settings.atomSizeByAtom must be an object');
    } else {
      for (const [key, value] of Object.entries(settings.atomSizeByAtom)) {
        if (typeof key !== 'string' || !key.trim()) {
          errors.push('settings.atomSizeByAtom contains invalid atom id');
          continue;
        }
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          errors.push(`settings.atomSizeByAtom.${key} must be a number`);
          continue;
        }
        if (
          value < ConfigValidator.ranges.atomSizeMap.min ||
          value > ConfigValidator.ranges.atomSizeMap.max
        ) {
          errors.push(`settings.atomSizeByAtom.${key} out of range`);
        }
      }
    }

    // Check light configs
    if (!this.validateLightConfig(settings.keyLight)) {
      errors.push('settings.keyLight must be a valid light configuration');
    }

    if (!this.validateLightConfig(settings.fillLight)) {
      errors.push('settings.fillLight must be a valid light configuration');
    }

    if (!this.validateLightConfig(settings.rimLight)) {
      errors.push('settings.rimLight must be a valid light configuration');
    }

    return errors;
  }

  private validateLightConfig(light: any): boolean {
    if (!light || typeof light !== 'object') {
      return false;
    }

    if (typeof light.intensity !== 'number') {
      return false;
    }

    // Support both nested position format and flat format
    let hasPosition = false;
    if (light.position && typeof light.position === 'object') {
      // Nested format: { position: { x, y, z } }
      hasPosition = 
        typeof light.position.x === 'number' &&
        typeof light.position.y === 'number' &&
        typeof light.position.z === 'number';
    } else {
      // Flat format: { x, y, z }
      hasPosition = 
        typeof light.x === 'number' &&
        typeof light.y === 'number' &&
        typeof light.z === 'number';
    }

    if (!hasPosition) {
      return false;
    }

    if (typeof light.color !== 'string') {
      return false;
    }

    return true;
  }
}
