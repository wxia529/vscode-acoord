import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { ColorScheme, WireColorScheme } from '../shared/protocol.js';

export interface ColorSchemeManifest {
  version: string;
  schemaVersion: number;
  lastUpdated: string;
  colorSchemes: Array<{
    id: string;
    name: string;
    isPreset: boolean;
  }>;
}

export interface ColorSchemeExportPackage {
  version: string;
  exportedAt: string;
  exportedFrom: string;
  colorSchemes: WireColorScheme[];
}

/**
 * Storage layer for color schemes
 * Manages file I/O for schemes stored in VS Code globalStorage
 */
export class ColorSchemeStorage {
  private readonly storageDir: string;
  private readonly presetsDir: string;
  private readonly userDir: string;
  private readonly manifestFile: string;

  constructor(context: vscode.ExtensionContext) {
    this.storageDir = path.join(context.globalStorageUri.fsPath, 'color-schemes');
    this.presetsDir = path.join(this.storageDir, 'presets');
    this.userDir = path.join(this.storageDir, 'user');
    this.manifestFile = path.join(this.storageDir, 'manifest.json');
  }

  /**
   * Initialize storage directories
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.presetsDir, { recursive: true });
    await fs.mkdir(this.userDir, { recursive: true });

    try {
      await fs.access(this.manifestFile);
    } catch {
      await this.createDefaultManifest();
    }
  }

  private async createDefaultManifest(): Promise<void> {
    const manifest: ColorSchemeManifest = {
      version: '1.0.0',
      schemaVersion: 1,
      lastUpdated: new Date().toISOString(),
      colorSchemes: []
    };
    await this.saveManifest(manifest);
  }

  /**
   * Load manifest file
   */
  async loadManifest(): Promise<ColorSchemeManifest> {
    const content = await fs.readFile(this.manifestFile, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * Save manifest file
   */
  async saveManifest(manifest: ColorSchemeManifest): Promise<void> {
    manifest.lastUpdated = new Date().toISOString();
    await this.writeJsonAtomic(this.manifestFile, manifest);
  }

  /**
   * Load a specific color scheme
   */
  async loadScheme(schemeId: string): Promise<ColorScheme | null> {
    const filePath = this.getSchemePath(schemeId);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * Save a color scheme
   */
  async saveScheme(scheme: ColorScheme): Promise<void> {
    const filePath = this.getSchemePath(scheme.id);
    scheme.updatedAt = Date.now();
    await this.writeJsonAtomic(filePath, scheme);
  }

  /**
   * Save a scheme without touching updatedAt
   */
  async saveSchemeRaw(scheme: ColorScheme): Promise<void> {
    const filePath = this.getSchemePath(scheme.id);
    await this.writeJsonAtomic(filePath, scheme);
  }

  /**
   * Delete a color scheme
   */
  async deleteScheme(schemeId: string): Promise<void> {
    const filePath = this.getSchemePath(schemeId);
    await fs.unlink(filePath);
  }

  async deleteSchemeSafe(schemeId: string): Promise<void> {
    const filePath = this.getSchemePath(schemeId);
    try {
      await fs.unlink(filePath);
    } catch {
      // Ignore delete failures for already removed files.
    }
  }

  /**
   * List all user color scheme IDs
   */
  async listSchemes(): Promise<string[]> {
    const userFiles = await fs.readdir(this.userDir);
    return userFiles
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''));
  }

  private getSchemePath(schemeId: string): string {
    const dir = schemeId.startsWith('preset-') ? this.presetsDir : this.userDir;
    return path.join(dir, `${schemeId}.json`);
  }

  private async writeJsonAtomic(filePath: string, data: unknown): Promise<void> {
    const tempPath = `${filePath}.tmp-${crypto.randomUUID()}`;
    try {
      await fs.writeFile(tempPath, JSON.stringify(data, null, 2));
      await fs.rename(tempPath, filePath);
    } finally {
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore temp cleanup failures.
      }
    }
  }

  /**
   * Export color schemes to a package
   */
  async exportSchemes(schemeIds: string[]): Promise<ColorSchemeExportPackage> {
    const schemes: WireColorScheme[] = [];
    for (const id of schemeIds) {
      const scheme = await this.loadScheme(id);
      if (scheme) {
        const { isPreset, isReadOnly, version, schemaVersion, createdAt, updatedAt, ...wireScheme } = scheme;
        schemes.push(wireScheme);
      }
    }

    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      exportedFrom: vscode.env.machineId,
      colorSchemes: schemes
    };
  }

  /**
   * Import color schemes from a package
   */
  async importSchemes(
    packageData: ColorSchemeExportPackage,
    validate?: (scheme: WireColorScheme) => Promise<{ valid: boolean; errors: string[]; scheme?: WireColorScheme }> | { valid: boolean; errors: string[]; scheme?: WireColorScheme }
  ): Promise<{ imported: WireColorScheme[]; idMapping: Record<string, string> }> {
    const imported: WireColorScheme[] = [];
    const idMapping: Record<string, string> = {};
    
    for (const scheme of packageData.colorSchemes) {
      const newId = `scheme-${crypto.randomUUID()}`;
      idMapping[scheme.id] = newId;
      
      const importedScheme: WireColorScheme = {
        ...scheme,
        id: newId,
        name: `${scheme.name} (imported)`
      };

      let schemeToUse = importedScheme;
      if (validate) {
        const result = await validate(importedScheme);
        if (!result.valid) {
          continue;
        }
        if (result.scheme) {
          schemeToUse = result.scheme;
        }
      }

      imported.push(schemeToUse);
    }

    return { imported, idMapping };
  }

  /**
   * Save a scheme and update manifest atomically
   */
  async saveSchemeAndManifest(scheme: ColorScheme, manifest: ColorSchemeManifest): Promise<void> {
    await this.saveScheme(scheme);
    try {
      await this.saveManifest(manifest);
    } catch (error) {
      await this.deleteSchemeSafe(scheme.id);
      throw error;
    }
  }

  /**
   * Delete a scheme and update manifest atomically
   */
  async deleteSchemeAndUpdateManifest(schemeId: string, manifest: ColorSchemeManifest): Promise<void> {
    const scheme = await this.loadScheme(schemeId);
    await this.deleteSchemeSafe(schemeId);
    try {
      await this.saveManifest(manifest);
    } catch (error) {
      if (scheme) {
        await this.saveSchemeRaw(scheme);
      }
      throw error;
    }
  }
}
