import { DisplayConfig, DisplaySettings, ValidationResult } from './types.js';
import { parseElement } from '../utils/elementData.js';

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
    currentRadiusByElement: {},
    manualScale: 1,
    autoScaleEnabled: false,
    currentRadiusScale: 1,
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
    currentColorScheme: 'preset-jmol-default',
    currentColorByElement: {}
  };

  private static readonly ranges = {
    unitCellThickness: { min: 0.1, max: 10 },
    manualScale: { min: 0.1, max: 10 },
    currentRadiusScale: { min: 0.1, max: 5 },
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

    if (!config.id) {
      errors.push('Config must have an ID');
    }

    if (!config.name) {
      errors.push('Config must have a name');
    }

    if (typeof config.schemaVersion !== 'number') {
      errors.push('Config must have a schemaVersion');
    }

    const { errors: settingsErrors } = this.normalizeSettings(config.settings);
    errors.push(...settingsErrors);

    return {
      valid: errors.length === 0,
      errors,
      warnings: []
    };
  }

  normalizeConfig(config: DisplayConfig): { config: DisplayConfig; errors: string[]; warnings: string[]; changed: boolean } {
    const { settings, errors, warnings, changed } = this.normalizeSettings(config.settings);
    if (!changed) {
      return { config, errors, warnings, changed };
    }
    return {
      config: {
        ...config,
        settings
      },
      errors,
      warnings,
      changed
    };
  }

  normalizeSettings(settings: DisplaySettings): { settings: DisplaySettings; errors: string[]; warnings: string[]; changed: boolean } {
    const input: Record<string, unknown> = settings && typeof settings === 'object' ? settings as Record<string, unknown> : {};
    const errors: string[] = [];
    const warnings: string[] = [];
    let changed = false;

    const normalizeNumber = (
      value: unknown,
      fallback: number,
      range: { min: number; max: number },
      label: string
    ): number => {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        errors.push(`${label} must be a number`);
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

    const normalizeBoolean = (value: unknown, fallback: boolean, label: string): boolean => {
      if (typeof value !== 'boolean') {
        errors.push(`${label} must be a boolean`);
        changed = true;
        return fallback;
      }
      return value;
    };

    const normalizeColor = (value: unknown, fallback: string, label: string): string => {
      if (typeof value !== 'string' || !ConfigValidator.colorPattern.test(value)) {
        errors.push(`${label} must be a hex color`);
        changed = true;
        return fallback;
      }
      return value;
    };

    const normalizeEnum = <T extends string>(
      value: unknown,
      allowed: T[],
      fallback: T,
      label: string
    ): T => {
      if (!allowed.includes(value as T)) {
        errors.push(`${label} must be one of ${allowed.join(', ')}`);
        changed = true;
        return fallback;
      }
      return value as T;
    };

    const normalizeLight = (value: unknown, fallback: DisplaySettings['keyLight'], label: string) => {
      if (!value || typeof value !== 'object') {
        warnings.push(`${label} must be an object; using default.`);
        changed = true;
        return fallback;
      }

      const v = value as Record<string, unknown>;
      const position = v['position'] && typeof v['position'] === 'object'
        ? v['position'] as Record<string, unknown>
        : { x: v['x'] ?? fallback.x, y: v['y'] ?? fallback.y, z: v['z'] ?? fallback.z };

      return {
        intensity: normalizeNumber(
          v['intensity'],
          fallback.intensity,
          ConfigValidator.ranges.lightIntensity,
          `${label}.intensity`
        ),
        color: normalizeColor(v['color'], fallback.color, `${label}.color`),
        x: normalizeNumber(
          position['x'],
          fallback.x,
          ConfigValidator.ranges.lightPosition,
          `${label}.x`
        ),
        y: normalizeNumber(
          position['y'],
          fallback.y,
          ConfigValidator.ranges.lightPosition,
          `${label}.y`
        ),
        z: normalizeNumber(
          position['z'],
          fallback.z,
          ConfigValidator.ranges.lightPosition,
          `${label}.z`
        )
      };
    };

    const normalizeColorSchemeId = (value: unknown): string => {
      if (typeof value !== 'string' || !value) {
        changed = true;
        return defaults.currentColorScheme;
      }
      return value;
    };

    const normalizeColorByElement = (value: unknown): Record<string, string> => {
      if (!value || typeof value !== 'object') {
        changed = true;
        return {};
      }
      const output: Record<string, string> = {};
      for (const [key, val] of Object.entries(value)) {
        if (typeof val === 'string' && ConfigValidator.colorPattern.test(val)) {
          output[key] = val;
        } else {
          changed = true;
        }
      }
      return output;
    };

    const normalizeRadiusByElement = (value: unknown): Record<string, number> => {
      if (!value || typeof value !== 'object') {
        changed = true;
        return {};
      }
      const output: Record<string, number> = {};
      for (const [key, val] of Object.entries(value)) {
        if (typeof key !== 'string' || !key.trim()) {
          changed = true;
          continue;
        }
        const parsedKey = parseElement(key);
        if (!parsedKey) {
          changed = true;
          continue;
        }
        if (typeof val !== 'number' || !Number.isFinite(val)) {
          changed = true;
          continue;
        }
        const clamped = Math.min(
          ConfigValidator.ranges.atomSizeMap.max,
          Math.max(ConfigValidator.ranges.atomSizeMap.min, val)
        );
        if (clamped !== val) {
          changed = true;
        }
        output[parsedKey] = clamped;
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
      currentRadiusByElement: normalizeRadiusByElement(
        input.currentRadiusByElement
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
      currentRadiusScale: normalizeNumber(
        input.currentRadiusScale,
        defaults.currentRadiusScale,
        ConfigValidator.ranges.currentRadiusScale,
        'settings.currentRadiusScale'
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
      rimLight: normalizeLight(input.rimLight, defaults.rimLight, 'settings.rimLight'),
      currentColorScheme: normalizeColorSchemeId(input.currentColorScheme),
      currentColorByElement: normalizeColorByElement(input.currentColorByElement)
    };

    return { settings: normalized, errors, warnings, changed };
  }
}
