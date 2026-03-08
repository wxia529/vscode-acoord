import * as vscode from 'vscode';
import { ConfigStorage } from './configStorage.js';
import { MigrationManager } from './migrations/index.js';
import { ConfigValidator } from './configValidator.js';
import { BUILTIN_PRESETS } from './presets/index.js';
import { ColorSchemeManager } from './colorSchemeManager.js';
import {
  DisplayConfig,
  DisplaySettings,
  ConfigMeta,
  ConfigChangeEvent
} from './types.js';

/**
 * Main configuration manager
 * Handles all configuration operations including presets, user configs, import/export
 */
export class ConfigManager {
  private storage: ConfigStorage;
  private migrationManager: MigrationManager;
  private validator: ConfigValidator;
  private colorSchemeManager: ColorSchemeManager;
  private currentConfig: DisplayConfig | null = null;
  private _onConfigChange = new vscode.EventEmitter<ConfigChangeEvent>();
  
  readonly onConfigChange = this._onConfigChange.event;

  constructor(context: vscode.ExtensionContext) {
    this.storage = new ConfigStorage(context);
    this.migrationManager = new MigrationManager();
    this.validator = new ConfigValidator();
    this.colorSchemeManager = new ColorSchemeManager(context);
  }

  /**
   * Initialize the config manager
   */
  async initialize(): Promise<void> {
    await this.storage.initialize();
    await this.colorSchemeManager.initialize();
    await this.initializePresets();
    await this.loadDefaultConfig();
  }

  private async initializePresets(): Promise<void> {
    const manifest = await this.storage.loadManifest();

    const builtinPresetIds = new Set(BUILTIN_PRESETS.map((preset) => preset.id));
    const removedPresetIds = manifest.configs
      .filter((c: ConfigMeta) => c.isPreset && !builtinPresetIds.has(c.id))
      .map((c: ConfigMeta) => c.id);
    manifest.configs = manifest.configs.filter(
      (c: ConfigMeta) => !c.isPreset || builtinPresetIds.has(c.id)
    );
    for (const removedId of removedPresetIds) {
      await this.storage.deleteConfigSafe(removedId);
    }
    
    for (const preset of BUILTIN_PRESETS) {
      await this.storage.saveConfig(preset);
      const existingIndex = manifest.configs.findIndex((c: ConfigMeta) => c.id === preset.id);
      if (existingIndex >= 0) {
        manifest.configs[existingIndex] = this.toMeta(preset);
      } else {
        manifest.configs.push(this.toMeta(preset));
      }
    }

    await this.storage.saveManifest(manifest);
  }

  private async loadDefaultConfig(): Promise<void> {
    await this.loadConfig('preset-default');
  }

  /**
   * Load a configuration by ID
   */
  async loadConfig(configId: string): Promise<DisplayConfig> {
    const loadedConfig = await this.storage.loadConfig(configId);
    
    if (!loadedConfig) {
      throw new Error(`Config ${configId} not found`);
    }

    let config: DisplayConfig = loadedConfig;

    // Check if migration is needed
    if (this.migrationManager.needsMigration(config)) {
      await this.storage.createBackup(configId);
      try {
        config = await this.migrationManager.migrate(config);
        await this.storage.saveConfig(config);
      } catch (error) {
        const backups = await this.storage.listBackups(configId);
        if (backups.length > 0) {
          const latestBackup = backups.sort().reverse()[0].replace('.json', '');
          await this.storage.restoreBackup(latestBackup);
        }
        throw new Error(`Migration failed, restored from backup: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        await this.storage.cleanOldBackups();
      }
    }

    const normalized = this.validator.normalizeConfig(config);
    if (normalized.changed) {
      config = normalized.config;
      const manifest = await this.storage.loadManifest();
      const index = manifest.configs.findIndex((item) => item.id === config.id);
      if (index >= 0) {
        manifest.configs[index] = this.toMeta(config);
      }
      await this.storage.saveConfigAndManifest(config, manifest);
    }

    const validation = this.validator.validate(config);
    if (!validation.valid) {
      throw new Error(`Invalid config: ${validation.errors.join(', ')}`);
    }

    this.currentConfig = config;
    this._onConfigChange.fire({
      type: 'loaded',
      configId: config.id,
      timestamp: Date.now()
    });

    return config;
  }

  /**
   * Save current settings as a user config
   */
  async saveUserConfig(
    name: string,
    settings: DisplaySettings,
    description?: string,
    existingId?: string
  ): Promise<DisplayConfig> {
    const manifest = await this.storage.loadManifest();
    
    let config: DisplayConfig;
    
    if (existingId) {
      const existing = await this.storage.loadConfig(existingId);
      if (!existing || existing.isPreset) {
        throw new Error('Cannot modify preset or non-existent config');
      }
      
      config = {
        ...existing,
        name,
        description,
        settings,
        version: existing.version + 1,
        updatedAt: Date.now()
      };

      const index = manifest.configs.findIndex((item) => item.id === existingId);
      if (index >= 0) {
        manifest.configs[index] = this.toMeta(config);
      }
    } else {
      config = {
        id: `user-${crypto.randomUUID()}`,
        name,
        description,
        isPreset: false,
        isReadOnly: false,
        version: 1,
        schemaVersion: this.migrationManager.getCurrentSchemaVersion(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        settings
      };
      
      manifest.configs.push(this.toMeta(config));
    }

    await this.storage.saveConfigAndManifest(config, manifest);
    
    this._onConfigChange.fire({
      type: 'saved',
      configId: config.id,
      timestamp: Date.now()
    });

    return config;
  }

  /**
   * Delete a user configuration
   */
  async deleteConfig(configId: string): Promise<void> {
    const config = await this.storage.loadConfig(configId);
    if (!config) {
      return;
    }

    if (config.isReadOnly) {
      throw new Error('Cannot delete preset');
    }

    const manifest = await this.storage.loadManifest();
    manifest.configs = manifest.configs.filter(c => c.id !== configId);
    await this.storage.deleteConfigAndUpdateManifest(configId, manifest);

    this._onConfigChange.fire({
      type: 'deleted',
      configId,
      timestamp: Date.now()
    });
  }

  /**
   * List all available configurations
   */
  async listConfigs(): Promise<{ presets: ConfigMeta[]; user: ConfigMeta[] }> {
    const manifest = await this.storage.loadManifest();
    
    return {
      presets: manifest.configs.filter((c: ConfigMeta) => c.isPreset),
      user: manifest.configs.filter((c: ConfigMeta) => !c.isPreset)
    };
  }

  /**
   * Export configurations to file
   */
  async exportConfigs(configIds: string[], includeColorSchemes: boolean = true): Promise<void> {
    const packageData = await this.storage.exportConfigs(configIds);
    
    if (includeColorSchemes) {
      const schemeIds = new Set<string>();
      for (const configId of configIds) {
        const config = await this.storage.loadConfig(configId);
        if (config?.settings.currentColorScheme) {
          schemeIds.add(config.settings.currentColorScheme);
        }
      }
      
      if (schemeIds.size > 0) {
        const colorSchemePackage = await this.colorSchemeManager.exportSchemes(Array.from(schemeIds));
        packageData.colorSchemes = colorSchemePackage.colorSchemes;
      }
    }
    
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(`acoord-configs-${new Date().toISOString().split('T')[0]}.json`),
      filters: {
        'ACoord Configs': ['json']
      }
    });

    if (uri) {
      await vscode.workspace.fs.writeFile(uri, Buffer.from(JSON.stringify(packageData, null, 2)));
    }
  }

  /**
   * Import configurations from file
   */
  async importConfigs(): Promise<void> {
    const uris = await vscode.window.showOpenDialog({
      canSelectMany: false,
      filters: {
        'ACoord Configs': ['json']
      }
    });

    if (!uris || uris.length === 0) {
      return;
    }

    const content = await vscode.workspace.fs.readFile(uris[0]);
    const packageData = JSON.parse(content.toString());
    
    // First import color schemes if present
    const schemeIdMapping: Record<string, string> = {};
    if (packageData.colorSchemes && Array.isArray(packageData.colorSchemes)) {
      const importResult = await this.colorSchemeManager.importSchemes({
        version: packageData.version,
        exportedAt: packageData.exportedAt,
        exportedFrom: packageData.exportedFrom,
        colorSchemes: packageData.colorSchemes
      });
      
      for (const [oldId, newId] of Object.entries(importResult.idMapping)) {
        schemeIdMapping[oldId] = newId;
      }
    }
    
    const importedResult = await this.storage.importConfigs(packageData, async (config) => {
      let processedConfig = config;
      
      // Update color scheme reference if it was remapped
      if (config.settings.currentColorScheme && schemeIdMapping[config.settings.currentColorScheme]) {
        config.settings.currentColorScheme = schemeIdMapping[config.settings.currentColorScheme];
      }
      
      if (this.migrationManager.needsMigration(config)) {
        try {
          processedConfig = await this.migrationManager.migrate(config);
        } catch {
          return {
            valid: false,
            errors: ['Migration failed for imported config'],
            config: undefined
          };
        }
      }
      
      const normalized = this.validator.normalizeConfig(processedConfig);
      const validation = this.validator.validate(normalized.config);
      return {
        valid: validation.valid,
        errors: validation.errors,
        config: normalized.config
      };
    });

    const manifest = await this.storage.loadManifest();
    for (const config of importedResult.imported) {
      manifest.configs.push(this.toMeta(config));
    }
    try {
      await this.storage.saveManifest(manifest);
    } catch (error) {
      await importedResult.cleanup();
      throw error;
    }

    this._onConfigChange.fire({
      type: 'imported',
      configId: importedResult.imported[0]?.id || '',
      timestamp: Date.now()
    });

    vscode.window.showInformationMessage(`Imported ${importedResult.imported.length} configurations`);
  }

  /**
   * Get currently loaded configuration
   */
  getCurrentConfig(): DisplayConfig | null {
    return this.currentConfig;
  }

  /**
   * Get the color scheme manager
   */
  getColorSchemeManager(): ColorSchemeManager {
    return this.colorSchemeManager;
  }

  /**
   * Reset to default configuration
   */
  async resetToDefault(): Promise<void> {
    await this.loadConfig('preset-default');
  }

  private toMeta(config: DisplayConfig): ConfigMeta {
    return {
      id: config.id,
      name: config.name,
      isPreset: config.isPreset,
      version: config.version,
      schemaVersion: config.schemaVersion,
      updatedAt: config.updatedAt
    };
  }
}
