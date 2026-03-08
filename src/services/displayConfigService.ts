import * as vscode from 'vscode';
import { ConfigManager } from '../config/configManager.js';
import { ColorSchemeManager } from '../config/colorSchemeManager.js';
import { DisplayConfig, DisplaySettings, ConfigMeta } from '../config/types.js';
import type { WireDisplaySettings, ExtensionToWebviewMessage } from '../shared/protocol.js';

export type PostMessageCallback = (message: ExtensionToWebviewMessage) => void;
export type SessionRef = { displaySettings?: DisplaySettings };

export class DisplayConfigService {
  private postMessageCallback?: PostMessageCallback;
  private sessionRef?: SessionRef;

  constructor(private configManager: ConfigManager, private colorSchemeManager: ColorSchemeManager) {}

  setCallbacks(postMessage: PostMessageCallback, session: SessionRef): void {
    this.postMessageCallback = postMessage;
    this.sessionRef = session;
  }

  async listConfigs(): Promise<{ presets: ConfigMeta[]; user: ConfigMeta[] }> {
    return await this.configManager.listConfigs();
  }

  async loadConfig(configId: string): Promise<DisplayConfig> {
    return await this.configManager.loadConfig(configId);
  }

  async saveConfig(
    name: string,
    settings: DisplaySettings,
    description?: string,
    existingId?: string
  ): Promise<DisplayConfig> {
    return await this.configManager.saveUserConfig(name, settings, description, existingId);
  }

  async deleteConfig(configId: string): Promise<void> {
    await this.configManager.deleteConfig(configId);
  }

  async exportConfigs(configIds: string[]): Promise<void> {
    await this.configManager.exportConfigs(configIds);
  }

  async importConfigs(): Promise<void> {
    await this.configManager.importConfigs();
  }

  updateDisplaySettings(settings: WireDisplaySettings): void {
    if (this.sessionRef) {
      this.sessionRef.displaySettings = settings as DisplaySettings;
    }
  }

  getSessionDisplaySettings(): DisplaySettings | undefined {
    return this.sessionRef?.displaySettings;
  }

  // Handler methods for display config commands
  async handleGetDisplayConfigs(): Promise<boolean> {
    if (!this.postMessageCallback) { return false; }
    try {
      const configs = await this.configManager.listConfigs();
      this.postMessageCallback({
        command: 'displayConfigsLoaded',
        presets: configs.presets,
        user: configs.user
      });
      return true;
    } catch (error) {
      this.postMessageCallback({
        command: 'displayConfigError',
        error: String(error)
      });
      return true;
    }
  }

  async handleLoadDisplayConfig(configId: string): Promise<boolean> {
    if (!this.postMessageCallback || !this.sessionRef) { return false; }
    try {
      const config = await this.configManager.loadConfig(configId);
      this.sessionRef.displaySettings = config.settings;
      this.postMessageCallback({
        command: 'displayConfigLoaded',
        config: config
      });
      
      // Load the color scheme specified in the config
      if (config.settings.currentColorScheme) {
        const scheme = await this.colorSchemeManager.getScheme(config.settings.currentColorScheme);
        if (scheme) {
          this.postMessageCallback({
            command: 'colorSchemeLoaded',
            scheme: scheme
          });
        }
      }
      
      return true;
    } catch (error) {
      this.postMessageCallback({
        command: 'displayConfigError',
        error: String(error)
      });
      return true;
    }
  }

  async handleSaveDisplayConfig(
    name: string,
    settings: WireDisplaySettings,
    description?: string,
    existingId?: string
  ): Promise<boolean> {
    if (!this.postMessageCallback) { return false; }
    try {
      const config = await this.configManager.saveUserConfig(name, settings as DisplaySettings, description, existingId);
      this.postMessageCallback({
        command: 'displayConfigSaved',
        config: config
      });
      return true;
    } catch (error) {
      this.postMessageCallback({
        command: 'displayConfigError',
        error: String(error)
      });
      return true;
    }
  }

  async handlePromptSaveDisplayConfig(settings?: WireDisplaySettings): Promise<boolean> {
    if (!this.postMessageCallback || !this.sessionRef) { return false; }
    
    const displaySettings = settings || this.sessionRef.displaySettings;
    if (!displaySettings) {
      this.postMessageCallback({
        command: 'displayConfigError',
        error: 'No display settings available to save'
      });
      return true;
    }

    const name = await vscode.window.showInputBox({
      prompt: 'Enter configuration name',
      placeHolder: 'My Display Config'
    });
    if (!name) { return true; }

    const description = await vscode.window.showInputBox({
      prompt: 'Enter description (optional)',
      placeHolder: 'Description of this configuration'
    });

    try {
      const config = await this.configManager.saveUserConfig(
        name,
        displaySettings as DisplaySettings,
        description || undefined
      );
      this.postMessageCallback({
        command: 'displayConfigSaved',
        config: config
      });
      // Refresh the list after saving
      await this.handleGetDisplayConfigs();
      return true;
    } catch (error) {
      this.postMessageCallback({
        command: 'displayConfigError',
        error: String(error)
      });
      return true;
    }
  }

  async handleGetCurrentDisplaySettings(): Promise<boolean> {
    if (!this.postMessageCallback || !this.sessionRef) { return false; }
    if (this.sessionRef.displaySettings) {
      this.postMessageCallback({
        command: 'currentDisplaySettings',
        settings: this.sessionRef.displaySettings
      });
    }
    return true;
  }

  async handleExportDisplayConfigs(): Promise<boolean> {
    try {
      const configs = await this.configManager.listConfigs();
      const allConfigs = [...configs.presets, ...configs.user];
      const items = allConfigs.map(c => ({
        label: c.name,
        description: c.isPreset ? 'Preset' : 'User Config',
        picked: false,
        id: c.id
      }));

      const selected = await vscode.window.showQuickPick(items, {
        canPickMany: true,
        placeHolder: 'Select configurations to export'
      });

      if (!selected || selected.length === 0) { return true; }
      await this.configManager.exportConfigs(selected.map(s => s.id!));
      return true;
    } catch (error) {
      if (this.postMessageCallback) {
        this.postMessageCallback({
          command: 'displayConfigError',
          error: String(error)
        });
      }
      return true;
    }
  }

  async handleImportDisplayConfigs(): Promise<boolean> {
    if (!this.postMessageCallback) { return false; }
    try {
      await this.configManager.importConfigs();
      await this.handleGetDisplayConfigs();
      return true;
    } catch (error) {
      this.postMessageCallback({
        command: 'displayConfigError',
        error: String(error)
      });
      return true;
    }
  }

  async handleConfirmDeleteDisplayConfig(configId: string): Promise<boolean> {
    if (!configId || !this.postMessageCallback) { return false; }
    try {
      const configs = await this.configManager.listConfigs();
      const target = configs.user.find((c) => c.id === configId);
      if (!target) {
        vscode.window.showErrorMessage('Only user configurations can be deleted');
        return true;
      }

      const confirm = await vscode.window.showWarningMessage(
        `Are you sure you want to delete "${target.name}"?`,
        { modal: true },
        'Delete'
      );
      if (confirm !== 'Delete') { return true; }

      await this.handleDeleteDisplayConfig(configId);
      return true;
    } catch (error) {
      this.postMessageCallback({
        command: 'displayConfigError',
        error: String(error)
      });
      return true;
    }
  }

  async handleDeleteDisplayConfig(configId: string): Promise<boolean> {
    if (!configId || !this.postMessageCallback) { return false; }
    try {
      await this.configManager.deleteConfig(configId);
      await this.handleGetDisplayConfigs();
      return true;
    } catch (error) {
      this.postMessageCallback({
        command: 'displayConfigError',
        error: String(error)
      });
      return true;
    }
  }

  // Legacy method for backward compatibility
  async getCurrentDisplaySettingsFromSessions(sessions: Map<string, SessionRef>): Promise<DisplaySettings | null> {
    for (const session of sessions.values()) {
      if (session.displaySettings) {
        return session.displaySettings;
      }
    }
    return null;
  }
}
