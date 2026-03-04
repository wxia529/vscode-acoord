import * as vscode from 'vscode';
import { ConfigManager } from '../config/configManager';
import { DisplaySettings } from '../config/types';

export class DisplayConfigService {
  constructor(private configManager: ConfigManager) {}

  async listConfigs(): Promise<{ presets: any[]; user: any[] }> {
    return await this.configManager.listConfigs();
  }

  async loadConfig(configId: string): Promise<any> {
    return await this.configManager.loadConfig(configId);
  }

  async saveConfig(
    name: string,
    settings: DisplaySettings,
    description?: string,
    existingId?: string
  ): Promise<any> {
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

  async getCurrentDisplaySettings(sessions: Map<string, any>): Promise<DisplaySettings | null> {
    for (const session of sessions.values()) {
      if (session.displaySettings) {
        return session.displaySettings;
      }
    }
    return null;
  }

  updateDisplaySettings(settings: DisplaySettings, session: any): void {
    session.displaySettings = settings;
  }
}
