import { configStore, displayStore, lightingStore, extractDisplaySettings, applyDisplaySettings } from './state';
import * as colorSchemeHandler from './colorSchemeHandler';
import { renderer } from './renderer';
import type { VsCodeApi, DisplaySettings } from './types';
import type { ExtensionToWebviewMessage, DisplayConfigLoadedMessage, DisplayConfigSavedMessage, DisplayConfigErrorMessage, CurrentDisplaySettingsMessage } from '../../../src/shared/protocol';

let _vscode: VsCodeApi | null = null;
let _showStatus: ((msg: string) => void) | null = null;
let _updateConfigSelectorFn: (() => void) | null = null;
let _rerenderStructureFn: (() => void) | null = null;
let _settingsTimer: ReturnType<typeof setTimeout> | null = null;

export function init(
  vscode: VsCodeApi,
  showStatus: (msg: string) => void,
  updateConfigSelectorFn: () => void,
  rerenderStructureFn?: () => void
): void {
  _vscode = vscode;
  _showStatus = showStatus;
  _updateConfigSelectorFn = updateConfigSelectorFn;
  _rerenderStructureFn = rerenderStructureFn ?? null;
}

function postMessage(message: unknown): void {
  _vscode?.postMessage(message);
}

export function requestConfigList(): void {
  postMessage({ command: 'getDisplayConfigs' });
}

export function loadConfig(configId: string): void {
  configStore.isLoadingConfig = true;
  postMessage({ command: 'loadDisplayConfig', configId });
}

export function saveAsUserConfig(name: string, description?: string): void {
  const settings = extractDisplaySettings();
  postMessage({ command: 'saveDisplayConfig', name, description, settings });
}

export function getCurrentSettings(): void {
  postMessage({ command: 'getCurrentDisplaySettings' });
}

export function updateSettings(): void {
  if (_settingsTimer) {
    clearTimeout(_settingsTimer);
  }
  _settingsTimer = setTimeout(() => {
    _settingsTimer = null;
    const settings = extractDisplaySettings();
    postMessage({ command: 'updateDisplaySettings', settings });
  }, 80);
}

function updateConfigUI(): void {
  _updateConfigSelectorFn?.();
}

function handleConfigsLoaded(presets: unknown, user: unknown): void {
  configStore.availableConfigs = {
    presets: Array.isArray(presets) ? presets : [],
    user: Array.isArray(user) ? user : [],
  };
  updateConfigUI();
}

function handleConfigLoaded(config: { id: string; name: string; settings: DisplaySettings } | null | undefined): void {
  if (!config || !config.settings) {
    console.error('Invalid config loaded');
    configStore.isLoadingConfig = false;
    return;
  }

  applyDisplaySettings(config.settings);
  configStore.currentConfigId = config.id;
  configStore.currentConfigName = config.name;
  configStore.isLoadingConfig = false;

  updateUI();
  renderer.updateDisplaySettings();
  renderer.updateLighting();
  // Rerender the full structure so lattice thickness/line-style changes take effect
  _rerenderStructureFn?.();
  updateConfigUI();

  if (_showStatus) {
    _showStatus(`Loaded configuration: ${config.name}`);
  }
}

function handleConfigSaved(config: { name: string } | null | undefined): void {
  if (config) {
    requestConfigList();
    if (_showStatus) {
      _showStatus(`Saved configuration: ${config.name}`);
    }
  }
}

export function handleMessage(message: ExtensionToWebviewMessage): void {
  switch (message.command) {
    case 'displayConfigsLoaded':
      handleConfigsLoaded(message.presets, message.user);
      break;

    case 'displayConfigLoaded':
      handleConfigLoaded((message as DisplayConfigLoadedMessage).config);
      break;

    case 'displayConfigSaved':
      handleConfigSaved((message as DisplayConfigSavedMessage).config);
      break;

    case 'displayConfigChanged':
      if (message.config) {
        handleConfigLoaded(message.config as { id: string; name: string; settings: DisplaySettings });
      }
      break;

    case 'currentDisplaySettings':
      if (message.settings) {
        applyDisplaySettings(message.settings);
        if (message.settings.currentColorScheme) {
          colorSchemeHandler.loadScheme(message.settings.currentColorScheme);
        }
        updateUI();
      }
      break;

    case 'displayConfigError':
      console.error('Display config error:', message.error);
      configStore.isLoadingConfig = false;
      break;
  }
}

export function updateUI(): void {
  const getLightValue = (light: { intensity?: number; color?: string; x?: number; y?: number; z?: number } | null | undefined, prop: string): number | string => {
    if (!light) return 0;
    return (light as Record<string, unknown>)[prop] as number | string ?? 0;
  };

  const setInput = (id: string, value: unknown): void => {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (el) (el as HTMLInputElement).value = String(value ?? '');
  };
  const setChecked = (id: string, value: boolean): void => {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (el) el.checked = value;
  };
  const setText = (id: string, value: string): void => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  setChecked('show-axes', displayStore.showAxes);

  setInput('bg-color-picker', displayStore.backgroundColor);
  setInput('bg-color-text', displayStore.backgroundColor);

  setInput('lattice-color-picker', displayStore.unitCellColor);
  setInput('lattice-color-text', displayStore.unitCellColor);

  setInput('lattice-thickness-slider', displayStore.unitCellThickness);
  setText('lattice-thickness-value', displayStore.unitCellThickness.toFixed(1));

  setInput('lattice-line-style', displayStore.unitCellLineStyle);

  setInput('bond-size-slider', displayStore.bondThicknessScale);
  setText('bond-size-value', displayStore.bondThicknessScale.toFixed(1) + 'x');

  setChecked('lighting-enabled', lightingStore.lightingEnabled);

  setInput('ambient-slider', lightingStore.ambientIntensity);
  setText('ambient-value', lightingStore.ambientIntensity.toFixed(1));
  setInput('ambient-color-picker', lightingStore.ambientColor);

  setInput('shininess-slider', displayStore.shininess);
  setText('shininess-value', displayStore.shininess.toString());

  setInput('proj-select', displayStore.projectionMode);
  setChecked('lattice-scale', !!displayStore.scaleAtomsWithLattice);

  // Key light
  setInput('key-intensity-slider', getLightValue(lightingStore.keyLight, 'intensity'));
  setText('key-intensity-value', Number(getLightValue(lightingStore.keyLight, 'intensity')).toFixed(1));
  setInput('key-color-picker', getLightValue(lightingStore.keyLight, 'color'));
  setInput('key-x-slider', getLightValue(lightingStore.keyLight, 'x'));
  setText('key-x-value', String(getLightValue(lightingStore.keyLight, 'x')));
  setInput('key-y-slider', getLightValue(lightingStore.keyLight, 'y'));
  setText('key-y-value', String(getLightValue(lightingStore.keyLight, 'y')));
  setInput('key-z-slider', getLightValue(lightingStore.keyLight, 'z'));
  setText('key-z-value', String(getLightValue(lightingStore.keyLight, 'z')));

  // Fill light
  setInput('fill-intensity-slider', getLightValue(lightingStore.fillLight, 'intensity'));
  setText('fill-intensity-value', Number(getLightValue(lightingStore.fillLight, 'intensity')).toFixed(1));
  setInput('fill-color-picker', getLightValue(lightingStore.fillLight, 'color'));
  setInput('fill-x-slider', getLightValue(lightingStore.fillLight, 'x'));
  setText('fill-x-value', String(getLightValue(lightingStore.fillLight, 'x')));
  setInput('fill-y-slider', getLightValue(lightingStore.fillLight, 'y'));
  setText('fill-y-value', String(getLightValue(lightingStore.fillLight, 'y')));
  setInput('fill-z-slider', getLightValue(lightingStore.fillLight, 'z'));
  setText('fill-z-value', String(getLightValue(lightingStore.fillLight, 'z')));

  // Rim light
  setInput('rim-intensity-slider', getLightValue(lightingStore.rimLight, 'intensity'));
  setText('rim-intensity-value', Number(getLightValue(lightingStore.rimLight, 'intensity')).toFixed(1));
  setInput('rim-color-picker', getLightValue(lightingStore.rimLight, 'color'));
  setInput('rim-x-slider', getLightValue(lightingStore.rimLight, 'x'));
  setText('rim-x-value', String(getLightValue(lightingStore.rimLight, 'x')));
  setInput('rim-y-slider', getLightValue(lightingStore.rimLight, 'y'));
  setText('rim-y-value', String(getLightValue(lightingStore.rimLight, 'y')));
  setInput('rim-z-slider', getLightValue(lightingStore.rimLight, 'z'));
  setText('rim-z-value', String(getLightValue(lightingStore.rimLight, 'z')));
}
