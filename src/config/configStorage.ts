import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { DisplayConfig, ConfigManifest, ConfigExportPackage, ConfigMeta } from './types';

/**
 * Storage layer for display configurations
 * Manages file I/O for configs stored in VS Code globalStorage
 */
export class ConfigStorage {
  private readonly storageDir: string;
  private readonly presetsDir: string;
  private readonly userDir: string;
  private readonly backupDir: string;
  private readonly manifestFile: string;

  constructor(private context: vscode.ExtensionContext) {
    // VS Code standard globalStorage location
    this.storageDir = path.join(context.globalStorageUri.fsPath, 'configs');
    this.presetsDir = path.join(this.storageDir, 'presets');
    this.userDir = path.join(this.storageDir, 'user');
    this.backupDir = path.join(this.storageDir, 'backups');
    this.manifestFile = path.join(this.storageDir, 'manifest.json');
  }

  /**
   * Initialize storage directories
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.presetsDir, { recursive: true });
    await fs.mkdir(this.userDir, { recursive: true });
    await fs.mkdir(this.backupDir, { recursive: true });

    try {
      await fs.access(this.manifestFile);
    } catch {
      await this.createDefaultManifest();
    }
  }

  private async createDefaultManifest(): Promise<void> {
    const manifest: ConfigManifest = {
      version: '1.0.0',
      schemaVersion: 1,
      lastUpdated: new Date().toISOString(),
      configs: []
    };
    await this.saveManifest(manifest);
  }

  /**
   * Load manifest file
   */
  async loadManifest(): Promise<ConfigManifest> {
    const content = await fs.readFile(this.manifestFile, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * Save manifest file
   */
  async saveManifest(manifest: ConfigManifest): Promise<void> {
    manifest.lastUpdated = new Date().toISOString();
    await this.writeJsonAtomic(this.manifestFile, manifest);
  }

  /**
   * Load a specific config
   */
  async loadConfig(configId: string): Promise<DisplayConfig | null> {
    const filePath = this.getConfigPath(configId);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * Save a config
   */
  async saveConfig(config: DisplayConfig): Promise<void> {
    const filePath = this.getConfigPath(config.id);
    config.updatedAt = Date.now();
    await this.writeJsonAtomic(filePath, config);
  }

  /**
   * Save a config without touching updatedAt
   */
  async saveConfigRaw(config: DisplayConfig): Promise<void> {
    const filePath = this.getConfigPath(config.id);
    await this.writeJsonAtomic(filePath, config);
  }

  /**
   * Delete a config
   */
  async deleteConfig(configId: string): Promise<void> {
    const filePath = this.getConfigPath(configId);
    await fs.unlink(filePath);
  }

  async deleteConfigSafe(configId: string): Promise<void> {
    const filePath = this.getConfigPath(configId);
    try {
      await fs.unlink(filePath);
    } catch {
      // Ignore delete failures for already removed files.
    }
  }

  /**
   * List all user config IDs
   */
  async listConfigs(): Promise<string[]> {
    const userFiles = await fs.readdir(this.userDir);
    return userFiles
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''));
  }

  private getConfigPath(configId: string): string {
    const dir = configId.startsWith('preset-') ? this.presetsDir : this.userDir;
    return path.join(dir, `${configId}.json`);
  }

  private async writeJsonAtomic(filePath: string, data: unknown): Promise<void> {
    const tempPath = `${filePath}.tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
   * Export configs to a package
   */
  async exportConfigs(configIds: string[]): Promise<ConfigExportPackage> {
    const configs: DisplayConfig[] = [];
    for (const id of configIds) {
      const config = await this.loadConfig(id);
      if (config) {
        configs.push(config);
      }
    }

    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      exportedFrom: vscode.env.machineId,
      configs
    };
  }

  /**
   * Import configs from a package
   */
  async importConfigs(
    packageData: ConfigExportPackage,
    validate?: (config: DisplayConfig) => Promise<{ valid: boolean; errors: string[]; config?: DisplayConfig }> | { valid: boolean; errors: string[]; config?: DisplayConfig }
  ): Promise<{ imported: DisplayConfig[]; cleanup: () => Promise<void> }> {
    const imported: DisplayConfig[] = [];
    const savedIds: string[] = [];
    
    for (const config of packageData.configs) {
      const newId = `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const importedConfig: DisplayConfig = {
        ...config,
        id: newId,
        name: `${config.name} (imported)`,
        isPreset: false,
        isReadOnly: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      let configToSave = importedConfig;
      if (validate) {
        const result = await validate(importedConfig);
        if (!result.valid) {
          continue;
        }
        if (result.config) {
          configToSave = result.config;
        }
      }

      await this.saveConfig(configToSave);
      savedIds.push(configToSave.id);
      imported.push(configToSave);
    }

    const cleanup = async () => {
      for (const id of savedIds) {
        await this.deleteConfigSafe(id);
      }
    };

    return { imported, cleanup };
  }

  async saveConfigAndManifest(config: DisplayConfig, manifest: ConfigManifest): Promise<void> {
    await this.saveConfig(config);
    try {
      await this.saveManifest(manifest);
    } catch (error) {
      await this.deleteConfigSafe(config.id);
      throw error;
    }
  }

  async deleteConfigAndUpdateManifest(configId: string, manifest: ConfigManifest): Promise<void> {
    const config = await this.loadConfig(configId);
    await this.deleteConfigSafe(configId);
    try {
      await this.saveManifest(manifest);
    } catch (error) {
      if (config) {
        await this.saveConfigRaw(config);
      }
      throw error;
    }
  }

  /**
   * Create a backup before migration
   */
  async createBackup(configId: string): Promise<string> {
    const config = await this.loadConfig(configId);
    if (!config) {
      throw new Error(`Config ${configId} not found`);
    }

    const backupId = `${configId}-${Date.now()}`;
    const backupPath = path.join(this.backupDir, `${backupId}.json`);
    await fs.writeFile(backupPath, JSON.stringify(config, null, 2));
    
    return backupId;
  }

  /**
   * Restore a config from backup
   */
  async restoreBackup(backupId: string): Promise<DisplayConfig> {
    const backupPath = path.join(this.backupDir, `${backupId}.json`);
    const content = await fs.readFile(backupPath, 'utf-8');
    const config: DisplayConfig = JSON.parse(content);
    
    await this.saveConfig(config);
    return config;
  }

  /**
   * List available backups
   */
  async listBackups(configId?: string): Promise<string[]> {
    const files = await fs.readdir(this.backupDir);
    if (configId) {
      return files.filter(f => f.startsWith(configId));
    }
    return files;
  }

  /**
   * Clean old backups, keep only recent N backups per config
   */
  async cleanOldBackups(keepCount: number = 5): Promise<number> {
    const files = await fs.readdir(this.backupDir);
    const backupMap = new Map<string, string[]>();
    
    for (const file of files) {
      const match = file.match(/^(.+)-\d+\.json$/);
      if (match) {
        const configId = match[1];
        if (!backupMap.has(configId)) {
          backupMap.set(configId, []);
        }
        backupMap.get(configId)!.push(file);
      }
    }
    
    let deleted = 0;
    for (const [configId, backups] of backupMap) {
      backups.sort().reverse();
      const toDelete = backups.slice(keepCount);
      for (const file of toDelete) {
        await fs.unlink(path.join(this.backupDir, file));
        deleted++;
      }
    }
    
    return deleted;
  }
}
