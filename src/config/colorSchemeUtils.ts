import { Atom } from '../models/atom.js';
import { ColorScheme } from '../shared/protocol.js';
import { DisplaySettings } from './types.js';
import { ELEMENT_DATA } from '../utils/elementData.js';

const DEFAULT_FALLBACK_COLOR = '#C0C0C0';

/**
 * Get color for an element with fallback chain:
 * 1. atom.color (manual per-atom override, but skip default gray)
 * 2. settings.currentColorByElement[element] (user override)
 * 3. colorScheme.colors[element] (ColorScheme definition)
 * 4. ELEMENT_DATA[element].color (Jmol default)
 * 5. '#C0C0C0' (final fallback: gray)
 */
export function getColorForElement(
  atom: Atom,
  symbol: string,
  settings: DisplaySettings,
  colorScheme: ColorScheme | null
): string {
  // Skip default gray color - it's just the Atom constructor default
  if (atom.color && atom.color !== DEFAULT_FALLBACK_COLOR) {
    return atom.color;
  }

  if (settings.currentColorByElement?.[symbol]) {
    return settings.currentColorByElement[symbol];
  }

  if (colorScheme?.colors[symbol]) {
    return colorScheme.colors[symbol];
  }

  const info = ELEMENT_DATA[symbol];
  if (info?.color) {
    return info.color;
  }

  return DEFAULT_FALLBACK_COLOR;
}

/**
 * Validate hex color format
 */
export function validateHexColor(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

/**
 * Parse multiple color formats (hex, rgb)
 * Returns normalized #RRGGBB format or null if invalid
 */
export function parseColor(color: string): string | null {
  if (typeof color !== 'string') {
    return null;
  }

  const trimmed = color.trim();

  if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  if (/^#[0-9A-Fa-f]{3}$/.test(trimmed)) {
    const r = trimmed[1];
    const g = trimmed[2];
    const b = trimmed[3];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }

  const rgbMatch = trimmed.match(/^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10);
    const g = parseInt(rgbMatch[2], 10);
    const b = parseInt(rgbMatch[3], 10);
    
    if (r >= 0 && r <= 255 && g >= 0 && g <= 255 && b >= 0 && b <= 255) {
      const toHex = (n: number) => n.toString(16).padStart(2, '0');
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
    }
  }

  return null;
}
