import { colorSchemeStore, displayStore } from './state';
import * as brushPanel from './brushPanel';
import type { VsCodeApi } from './types';
import type { ExtensionToWebviewMessage, WireColorScheme } from '../../../src/shared/protocol';

let _vscode: VsCodeApi | null = null;
let _showStatus: ((msg: string) => void) | null = null;
let _updateColorSchemeSelectorFn: (() => void) | null = null;

export function init(
  vscode: VsCodeApi,
  showStatus: (msg: string) => void,
  updateColorSchemeSelectorFn: () => void
): void {
  _vscode = vscode;
  _showStatus = showStatus;
  _updateColorSchemeSelectorFn = updateColorSchemeSelectorFn;
}

function postMessage(message: unknown): void {
  _vscode?.postMessage(message);
}

export function requestSchemeList(): void {
  postMessage({ command: 'getColorSchemes' });
}

export function loadScheme(schemeId: string): void {
  colorSchemeStore.isLoadingScheme = true;
  postMessage({ command: 'loadColorScheme', schemeId });
}

export function saveScheme(name: string, colors: Record<string, string>, description?: string): void {
  postMessage({ command: 'saveColorScheme', name, colors, description });
}

export function deleteScheme(schemeId: string): void {
  postMessage({ command: 'deleteColorScheme', schemeId });
}

export function exportScheme(schemeId: string): void {
  postMessage({ command: 'exportColorScheme', schemeId });
}

export function importScheme(): void {
  postMessage({ command: 'importColorScheme' });
}

function handleSchemesLoaded(presets: unknown, user: unknown): void {
  colorSchemeStore.availableSchemes = {
    presets: Array.isArray(presets) ? presets : [],
    user: Array.isArray(user) ? user : [],
  };
  _updateColorSchemeSelectorFn?.();
}

function handleSchemeLoaded(scheme: WireColorScheme | null): void {
  if (!scheme) {
    console.error('Invalid scheme loaded');
    colorSchemeStore.isLoadingScheme = false;
    return;
  }

  colorSchemeStore.currentSchemeId = scheme.id;
  colorSchemeStore.currentSchemeName = scheme.name;
  colorSchemeStore.currentSchemeColors = scheme.colors || {};
  colorSchemeStore.isLoadingScheme = false;

  // Apply color scheme colors to displayStore for reference
  if (scheme.colors) {
    displayStore.currentColorByElement = { ...scheme.colors };
  }

  updateUI();
  _updateColorSchemeSelectorFn?.();
  brushPanel.update();

  // Note: No need to call _rerenderStructureFn here because the extension
  // will send a new render message with updated atom colors after calling
  // renderer.setOptions({ colorScheme: scheme })
  
  if (_showStatus) {
    _showStatus(`Loaded color scheme: ${scheme.name}`);
  }
}

function handleSchemeSaved(scheme: { id: string; name: string } | null): void {
  if (scheme) {
    requestSchemeList();
    if (_showStatus) {
      _showStatus(`Saved color scheme: ${scheme.name}`);
    }
  }
}

export function handleMessage(message: ExtensionToWebviewMessage): void {
  switch (message.command) {
    case 'colorSchemesLoaded':
      handleSchemesLoaded(message.presets, message.user);
      break;

    case 'colorSchemeLoaded':
      handleSchemeLoaded(message.scheme);
      break;

    case 'colorSchemeSaved':
      handleSchemeSaved(message.scheme);
      break;

    case 'colorSchemeError':
      console.error('Color scheme error:', message.error);
      colorSchemeStore.isLoadingScheme = false;
      break;
  }
}

export function updateUI(): void {
  const schemeInfoEl = document.getElementById('color-scheme-info');
  if (schemeInfoEl) {
    if (colorSchemeStore.currentSchemeId) {
      schemeInfoEl.textContent = `Current: ${colorSchemeStore.currentSchemeName}`;
    } else {
      schemeInfoEl.textContent = '';
    }
  }
}

export function updateColorSchemeSelector(): void {
  const select = document.getElementById('color-scheme-select') as HTMLSelectElement | null;

  const selectedId = colorSchemeStore.currentSchemeId || '';
  const presets = colorSchemeStore.availableSchemes.presets || [];
  const user = colorSchemeStore.availableSchemes.user || [];

  const options: string[] = [];

  if (presets.length > 0) {
    options.push('<optgroup label="Presets">');
    for (const preset of presets) {
      const selected = preset.id === selectedId ? ' selected' : '';
      options.push(`<option value="${preset.id}"${selected}>${preset.name}</option>`);
    }
    options.push('</optgroup>');
  }

  if (user.length > 0) {
    options.push('<optgroup label="User Schemes">');
    for (const u of user) {
      const selected = u.id === selectedId ? ' selected' : '';
      options.push(`<option value="${u.id}"${selected}>${u.name}</option>`);
    }
    options.push('</optgroup>');
  }

  if (options.length === 0) {
    options.push('<option value="">No schemes available</option>');
  }

  if (select) {
    select.innerHTML = options.join('');
  }
}
