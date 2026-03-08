import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';

const MIGRATION_VERSION = 1;
const MIGRATION_KEY = 'acoord.migrationVersion';

export class ConfigMigration {
  constructor(private context: vscode.ExtensionContext) {}

  async run(): Promise<void> {
    const currentVersion = this.context.globalState.get<number>(MIGRATION_KEY, 0);
    
    if (currentVersion >= MIGRATION_VERSION) {
      return;
    }

    await this.migrateV1();
    
    await this.context.globalState.update(MIGRATION_KEY, MIGRATION_VERSION);
  }

  private async migrateV1(): Promise<void> {
    const storagePath = this.context.globalStorageUri.fsPath;
    const oldConfigDir = path.join(storagePath, 'configs');

    try {
      await fs.access(oldConfigDir);
    } catch {
      return;
    }

    await this.removeDirectory(oldConfigDir);
  }

  private async removeDirectory(dirPath: string): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          await this.removeDirectory(fullPath);
        } else {
          await fs.unlink(fullPath);
        }
      }
      
      await fs.rmdir(dirPath);
    } catch (error) {
      console.error(`Failed to remove directory ${dirPath}:`, error);
    }
  }
}
