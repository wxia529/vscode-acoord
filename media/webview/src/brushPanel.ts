import { selectionStore, colorSchemeStore, structureStore } from './state';
import * as colorSchemeHandler from './colorSchemeHandler';
import type { VsCodeApi } from './types';

let _vscode: VsCodeApi | null = null;
let _setStatus: (msg: string) => void = () => {};
let _applySelectedBtn: HTMLButtonElement | null = null;
let _schemeNameEl: HTMLElement | null = null;
let _dropdownEl: HTMLElement | null = null;
let _dropdownVisible = false;

export function init(vscode: VsCodeApi, setStatus: (msg: string) => void): void {
  _vscode = vscode;
  _setStatus = setStatus;
  
  _applySelectedBtn = document.getElementById('brush-apply-selected') as HTMLButtonElement | null;
  _schemeNameEl = document.getElementById('brush-scheme-name');
  _dropdownEl = document.getElementById('brush-scheme-dropdown');
  
  _applySelectedBtn?.addEventListener('click', applyToSelected);
  
  if (_schemeNameEl) {
    _schemeNameEl.addEventListener('click', toggleDropdown);
  }
  
  document.addEventListener('click', handleDocumentClick);
  
  update();
}

export function dispose(): void {
  _applySelectedBtn?.removeEventListener('click', applyToSelected);
  _schemeNameEl?.removeEventListener('click', toggleDropdown);
  document.removeEventListener('click', handleDocumentClick);
  _vscode = null;
  _setStatus = () => {};
}

function applyToSelected(): void {
  const count = selectionStore.selectedAtomIds.length;
  if (count === 0) {
    _setStatus('No atoms selected');
    return;
  }
  
  _vscode?.postMessage({
    command: 'applyDisplaySettings',
    atomIds: [...selectionStore.selectedAtomIds]
  });
  _setStatus(`Applied color scheme to ${count} atom${count > 1 ? 's' : ''}`);
}

function toggleDropdown(event: Event): void {
  event.stopPropagation();
  _dropdownVisible = !_dropdownVisible;
  if (_dropdownEl) {
    _dropdownEl.style.display = _dropdownVisible ? 'block' : 'none';
    if (_dropdownVisible) {
      renderDropdown();
    }
  }
}

function handleDocumentClick(event: Event): void {
  if (_dropdownVisible && _dropdownEl && !_dropdownEl.contains(event.target as Node)) {
    _dropdownVisible = false;
    _dropdownEl.style.display = 'none';
  }
}

function renderDropdown(): void {
  if (!_dropdownEl) return;
  
  const selectedId = colorSchemeStore.currentSchemeId || '';
  const presets = colorSchemeStore.availableSchemes.presets || [];
  const user = colorSchemeStore.availableSchemes.user || [];
  
  const html: string[] = [];
  
  if (presets.length > 0) {
    html.push('<div class="brush-scheme-dropdown-group">Presets</div>');
    for (const preset of presets) {
      const active = preset.id === selectedId ? ' active' : '';
      html.push(`<div class="brush-scheme-dropdown-item${active}" data-id="${preset.id}">${preset.name}</div>`);
    }
  }
  
  if (user.length > 0) {
    if (presets.length > 0) {
      html.push('<div class="brush-scheme-dropdown-group">User</div>');
    }
    for (const u of user) {
      const active = u.id === selectedId ? ' active' : '';
      html.push(`<div class="brush-scheme-dropdown-item${active}" data-id="${u.id}">${u.name}</div>`);
    }
  }
  
  if (presets.length === 0 && user.length === 0) {
    html.push('<div class="brush-scheme-dropdown-item" style="opacity:0.5;">No schemes</div>');
  }
  
  _dropdownEl.innerHTML = html.join('');
  
  _dropdownEl.querySelectorAll('.brush-scheme-dropdown-item[data-id]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = (item as HTMLElement).dataset.id;
      if (id) {
        colorSchemeHandler.loadScheme(id);
        _dropdownVisible = false;
        _dropdownEl!.style.display = 'none';
      }
    });
  });
}

export function update(): void {
  if (_schemeNameEl) {
    _schemeNameEl.textContent = colorSchemeStore.currentSchemeName || 'Default';
  }
  
  const countEl = document.getElementById('brush-selected-count');
  if (countEl) {
    countEl.textContent = String(selectionStore.selectedAtomIds.length);
  }
  
  if (_dropdownVisible) {
    renderDropdown();
  }
}
