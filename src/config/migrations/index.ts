import { DisplayConfig, Migration } from '../types.js';

/**
 * Manages configuration migrations between schema versions
 */
export class MigrationManager {
  private currentSchemaVersion = 4;
  private migrations: Migration[] = [];

  constructor() {
    this.registerMigrations();
  }

  private registerMigrations(): void {
    this.migrations.push({
      fromVersion: 1,
      toVersion: 2,
      migrate: async (config) => {
        const settings = config.settings || ({} as DisplayConfig['settings']);
        return {
          ...config,
          schemaVersion: 2,
          settings: {
            ...settings,
            manualScale: typeof settings.manualScale === 'number' ? settings.manualScale : 1,
            autoScaleEnabled:
              typeof settings.autoScaleEnabled === 'boolean' ? settings.autoScaleEnabled : false,
            scaleAtomsWithLattice:
              typeof settings.scaleAtomsWithLattice === 'boolean'
                ? settings.scaleAtomsWithLattice
                : false,
          },
        };
      },
    });

    // v2 → v3: Display Scale panel removed. manualScale and autoScaleEnabled are no
    // longer used by the UI. atomSizeScale (formerly "Atom size" in Display Scale)
    // is preserved as-is since it moved into the Atom & Bond Size panel.
    this.migrations.push({
      fromVersion: 2,
      toVersion: 3,
      migrate: async (config) => {
        const settings = config.settings || ({} as DisplayConfig['settings']);
        // Carry forward atomSizeScale so users keep their previous atom scale value.
        // Drop manualScale and autoScaleEnabled — they are no longer meaningful.
        const { manualScale: _m, autoScaleEnabled: _a, ...rest } = settings as Record<string, unknown>;
        return {
          ...config,
          schemaVersion: 3,
          settings: rest as DisplayConfig['settings'],
        };
      },
    });

    // v3 → v4: Add color scheme support with atomColorSchemeId and atomColorByElement
    this.migrations.push({
      fromVersion: 3,
      toVersion: 4,
      migrate: async (config) => {
        const settings = config.settings || ({} as DisplayConfig['settings']);
        return {
          ...config,
          schemaVersion: 4,
          settings: {
            ...settings,
            atomColorSchemeId: 'preset-jmol-default',
            atomColorByElement: {}
          },
        };
      },
    });
  }

  /**
   * Check if a config needs migration
   */
  needsMigration(config: DisplayConfig): boolean {
    if (typeof config.schemaVersion !== 'number') {
      return true;
    }
    return config.schemaVersion < this.currentSchemaVersion;
  }

  /**
   * Get current schema version
   */
  getCurrentSchemaVersion(): number {
    return this.currentSchemaVersion;
  }

  /**
   * Migrate a config to the current schema version
   */
  async migrate(config: DisplayConfig): Promise<DisplayConfig> {
    let currentConfig = config;
    const startVersion =
      typeof config.schemaVersion === 'number' ? config.schemaVersion : 1;
    if (typeof currentConfig.schemaVersion !== 'number') {
      currentConfig = {
        ...currentConfig,
        schemaVersion: 1,
      };
    }

    // Apply migrations in order
    while (currentConfig.schemaVersion < this.currentSchemaVersion) {
      const migration = this.migrations.find(m => m.fromVersion === currentConfig.schemaVersion);
      if (!migration) {
        throw new Error(
          `Missing migration from version ${currentConfig.schemaVersion}`
        );
      }
      currentConfig = await migration.migrate(currentConfig);
    }

    if (currentConfig.schemaVersion !== this.currentSchemaVersion) {
      throw new Error(
        `Migration failed: could not migrate from version ${startVersion} to ${this.currentSchemaVersion}`
      );
    }

    return currentConfig;
  }
}
