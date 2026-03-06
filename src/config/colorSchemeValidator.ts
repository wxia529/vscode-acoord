import { WireColorScheme } from '../shared/protocol.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validator for color scheme JSON structures
 */
export class ColorSchemeValidator {
  /**
   * Validate a color scheme
   */
  validate(scheme: WireColorScheme): ValidationResult {
    const errors: string[] = [];

    if (!scheme.id || typeof scheme.id !== 'string') {
      errors.push('Missing or invalid "id" field');
    }

    if (!scheme.name || typeof scheme.name !== 'string') {
      errors.push('Missing or invalid "name" field');
    }

    if (!scheme.colors || typeof scheme.colors !== 'object') {
      errors.push('Missing or invalid "colors" field');
    } else {
      const colorErrors = this.validateColors(scheme.colors);
      errors.push(...colorErrors);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate all colors in a colors record
   */
  validateColors(colors: Record<string, string>): string[] {
    const errors: string[] = [];

    for (const [element, color] of Object.entries(colors)) {
      if (!this.isValidElementSymbol(element)) {
        errors.push(`Invalid element symbol: "${element}"`);
      }

      const normalized = this.normalizeColor(color);
      if (!normalized) {
        errors.push(`Invalid color format for element "${element}": "${color}"`);
      }
    }

    return errors;
  }

  /**
   * Normalize a color value to #RRGGBB hex format
   * Returns null if the color is invalid
   */
  normalizeColor(color: string): string | null {
    if (typeof color !== 'string') {
      return null;
    }

    const trimmed = color.trim();

    // Already in #RRGGBB format
    if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) {
      return trimmed.toUpperCase();
    }

    // #RGB shorthand
    if (/^#[0-9A-Fa-f]{3}$/.test(trimmed)) {
      const r = trimmed[1];
      const g = trimmed[2];
      const b = trimmed[3];
      return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
    }

    // rgb(r, g, b) or rgb(r,g,b)
    const rgbMatch = trimmed.match(/^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
    if (rgbMatch) {
      const r = parseInt(rgbMatch[1], 10);
      const g = parseInt(rgbMatch[2], 10);
      const b = parseInt(rgbMatch[3], 10);
      
      if (r >= 0 && r <= 255 && g >= 0 && g <= 255 && b >= 0 && b <= 255) {
        return this.rgbToHex(r, g, b);
      }
      return null;
    }

    return null;
  }

  /**
   * Validate hex color format
   */
  validateHexColor(color: string): boolean {
    return this.normalizeColor(color) !== null;
  }

  /**
   * Parse multiple color formats (hex, rgb)
   */
  parseColor(color: string): string | null {
    return this.normalizeColor(color);
  }

  /**
   * Check if a string is a valid element symbol
   */
  private isValidElementSymbol(symbol: string): boolean {
    if (typeof symbol !== 'string' || symbol.length === 0 || symbol.length > 2) {
      return false;
    }

    // First letter uppercase, second letter (if present) lowercase
    if (!/^[A-Z][a-z]?$/.test(symbol)) {
      return false;
    }

    return true;
  }

  /**
   * Convert RGB values to hex
   */
  private rgbToHex(r: number, g: number, b: number): string {
    const toHex = (n: number) => n.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
  }
}
