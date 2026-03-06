import * as vscode from 'vscode';
import { ColorSchemeStorage, ColorSchemeExportPackage } from './colorSchemeStorage.js';
import { ColorSchemeValidator } from './colorSchemeValidator.js';
import { BUILTIN_COLOR_SCHEMES } from './presets/color-schemes/index.js';
import { ColorScheme, WireColorScheme } from '../shared/protocol.js';

export interface ColorSchemeMeta {
  id: string;
  name: string;
  isPreset: boolean;
}

/**
 * Manager for color schemes
 * Handles loading, saving, import/export of color schemes
 */
export class ColorSchemeManager {
  private storage: ColorSchemeStorage;
  private validator: ColorSchemeValidator;
  private cache: Map<string, ColorScheme> = new Map();

  constructor(context: vscode.ExtensionContext) {
    this.storage = new ColorSchemeStorage(context);
    this.validator = new ColorSchemeValidator();
  }

  /**
   * Initialize the color scheme manager
   */
  async initialize(): Promise<void> {
    await this.storage.initialize();
    await this.initializePresets();
  }

  private async initializePresets(): Promise<void> {
    const manifest = await this.storage.loadManifest();

    const builtinPresetIds = new Set(BUILTIN_COLOR_SCHEMES.map((preset) => preset.id));
    const removedPresetIds = manifest.colorSchemes
      .filter((c: ColorSchemeMeta) => c.isPreset && !builtinPresetIds.has(c.id))
      .map((c: ColorSchemeMeta) => c.id);
    manifest.colorSchemes = manifest.colorSchemes.filter(
      (c: ColorSchemeMeta) => !c.isPreset || builtinPresetIds.has(c.id)
    );
    for (const removedId of removedPresetIds) {
      await this.storage.deleteSchemeSafe(removedId);
    }
    
    for (const preset of BUILTIN_COLOR_SCHEMES) {
      await this.storage.saveScheme(preset);
      const existingIndex = manifest.colorSchemes.findIndex((c: ColorSchemeMeta) => c.id === preset.id);
      if (existingIndex >= 0) {
        manifest.colorSchemes[existingIndex] = this.toMeta(preset);
      } else {
        manifest.colorSchemes.push(this.toMeta(preset));
      }
      this.cache.set(preset.id, preset);
    }

    await this.storage.saveManifest(manifest);
  }

  /**
   * Load a color scheme by ID
   */
  async loadScheme(schemeId: string): Promise<ColorScheme> {
    const cached = this.cache.get(schemeId);
    if (cached) {
      return cached;
    }

    const loadedScheme = await this.storage.loadScheme(schemeId);
    
    if (!loadedScheme) {
      throw new Error(`ColorScheme ${schemeId} not found`);
    }

    this.cache.set(schemeId, loadedScheme);
    return loadedScheme;
  }

  /**
   * Save a user color scheme
   */
  async saveScheme(
    name: string,
    colors: Record<string, string>,
    description?: string
  ): Promise<ColorScheme> {
    const schemeId = `scheme-${crypto.randomUUID()}`;
    
    const validation = this.validator.validate({
      id: schemeId,
      name,
      colors
    });

    if (!validation.valid) {
      throw new Error(`Invalid color scheme: ${validation.errors.join(', ')}`);
    }

    const now = Date.now();
    const scheme: ColorScheme = {
      id: schemeId,
      name,
      description,
      colors,
      isPreset: false,
      isReadOnly: false,
      version: 1,
      schemaVersion: 1,
      createdAt: now,
      updatedAt: now
    };

    const manifest = await this.storage.loadManifest();
    await this.storage.saveSchemeAndManifest(scheme, manifest);
    this.cache.set(schemeId, scheme);

    return scheme;
  }

  /**
   * Delete a user color scheme
   */
  async deleteScheme(schemeId: string): Promise<void> {
    const scheme = await this.loadScheme(schemeId);
    
    if (scheme.isPreset && scheme.isReadOnly) {
      throw new Error(`Cannot delete read-only preset: ${scheme.name}`);
    }

    const manifest = await this.storage.loadManifest();
    await this.storage.deleteSchemeAndUpdateManifest(schemeId, manifest);
    this.cache.delete(schemeId);
  }

  /**
   * List all available color scheme IDs
   */
  async listSchemes(): Promise<ColorSchemeMeta[]> {
    const manifest = await this.storage.loadManifest();
    return manifest.colorSchemes;
  }

  /**
   * Export color schemes to a package
   */
  async exportSchemes(schemeIds: string[]): Promise<ColorSchemeExportPackage> {
    return await this.storage.exportSchemes(schemeIds);
  }

  /**
   * Import color schemes from a package
   */
  async importSchemes(
    packageData: ColorSchemeExportPackage
  ): Promise<{ imported: WireColorScheme[]; idMapping: Record<string, string> }> {
    const validate = (scheme: WireColorScheme): { valid: boolean; errors: string[]; scheme?: WireColorScheme } => {
      const result = this.validator.validate(scheme);
      if (!result.valid) {
        return { valid: false, errors: result.errors };
      }
      return { valid: true, errors: [], scheme };
    };

    const result = await this.storage.importSchemes(packageData, validate);
    
    for (const scheme of result.imported) {
      const fullScheme: ColorScheme = {
        ...scheme,
        isPreset: false,
        isReadOnly: false,
        version: 1,
        schemaVersion: 1,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await this.storage.saveScheme(fullScheme);
      this.cache.set(fullScheme.id, fullScheme);
    }

    const manifest = await this.storage.loadManifest();
    for (const scheme of result.imported) {
      const newId = result.idMapping[scheme.id];
      const meta: ColorSchemeMeta = {
        id: newId,
        name: scheme.name,
        isPreset: false
      };
      manifest.colorSchemes.push(meta);
    }
    await this.storage.saveManifest(manifest);

    return result;
  }

  /**
   * Check if a color scheme exists
   */
  async schemeExists(schemeId: string): Promise<boolean> {
    try {
      await this.loadScheme(schemeId);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get a color scheme by ID (for renderer use)
   */
  async getScheme(schemeId: string): Promise<ColorScheme | null> {
    try {
      return await this.loadScheme(schemeId);
    } catch {
      return null;
    }
  }

  private toMeta(scheme: ColorScheme): ColorSchemeMeta {
    return {
      id: scheme.id,
      name: scheme.name,
      isPreset: scheme.isPreset
    };
  }

  /**
   * Clear the cache (for testing or disposal)
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.cache.clear();
  }
}
