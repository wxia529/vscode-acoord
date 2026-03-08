export function updateCounts(atomCount: number, bondCount: number): void {
  const atomCountEl = document.getElementById('atom-count') as HTMLElement | null;
  const bondCountEl = document.getElementById('bond-count') as HTMLElement | null;
  if (atomCountEl) atomCountEl.textContent = String(atomCount);
  if (bondCountEl) bondCountEl.textContent = String(bondCount);
}

export function getImageFileName(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `structure-hd-${stamp}.png`;
}

export function togglePanel(panelId: string): void {
  const panel = document.getElementById(`panel-${panelId}`);
  const toggle = document.querySelector(`[data-panel="${panelId}"] .panel-toggle`);
  if (panel && toggle) {
    panel.classList.toggle('collapsed');
    const isCollapsed = panel.classList.contains('collapsed');
    toggle.textContent = isCollapsed ? '▶' : '▼';
    savePanelState(panelId, !isCollapsed);
  }
}

function savePanelState(panelId: string, isOpen: boolean): void {
  try {
    const key = `acoord-panel-${panelId}`;
    localStorage.setItem(key, isOpen ? 'open' : 'closed');
  } catch {
    // localStorage may not be available in webview context
  }
}

function loadPanelState(panelId: string): boolean | null {
  try {
    const key = `acoord-panel-${panelId}`;
    const state = localStorage.getItem(key);
    if (state === 'open') return true;
    if (state === 'closed') return false;
    return null;
  } catch {
    return null;
  }
}

export function setupCollapsiblePanels(): void {
  const panels = Array.from(document.querySelectorAll('.collapsible-panel')) as HTMLElement[];
  if (panels.length === 0) { return; }

  panels.forEach((panel) => {
    const panelId = panel.dataset['panel'];
    if (!panelId) { return; }

    const content = document.getElementById(`panel-${panelId}`);
    const toggle = panel.querySelector('.panel-toggle');
    if (!content || !toggle) { return; }

    const savedState = loadPanelState(panelId);
    if (savedState !== null) {
      if (savedState) {
        content.classList.remove('collapsed');
        toggle.textContent = '▼';
      } else {
        content.classList.add('collapsed');
        toggle.textContent = '▶';
      }
    } else {
      const isCollapsed = content.classList.contains('collapsed');
      toggle.textContent = isCollapsed ? '▶' : '▼';
    }
  });
}

export function setupTabs(): void {
  const tabButtons = Array.from(document.querySelectorAll('.tab-button')) as HTMLElement[];
  const tabPanes = Array.from(document.querySelectorAll('.tab-pane')) as HTMLElement[];
  if (tabButtons.length === 0 || tabPanes.length === 0) { return; }

  const activateTab = (targetId: string) => {
    tabButtons.forEach((button) => {
      button.classList.toggle('active', (button as HTMLElement & { dataset: DOMStringMap }).dataset['tabTarget'] === targetId);
    });
    tabPanes.forEach((pane) => {
      pane.classList.toggle('active', pane.id === targetId);
    });
  };

  tabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const targetId = (button as HTMLElement & { dataset: DOMStringMap }).dataset['tabTarget'];
      if (!targetId) { return; }
      activateTab(targetId);
    });
  });

  const firstBtn = tabButtons[0] as HTMLElement & { dataset: DOMStringMap };
  const defaultTarget = firstBtn.dataset['tabTarget'];
  if (defaultTarget) { activateTab(defaultTarget); }
}

export function normalizeSliderValue(
  rawValue: unknown,
  min: number | undefined,
  max: number | undefined,
  step: number | undefined
): number | null {
  let value = Number(rawValue);
  if (!Number.isFinite(value)) { return null; }
  if (Number.isFinite(min)) { value = Math.max(min!, value); }
  if (Number.isFinite(max)) { value = Math.min(max!, value); }
  if (Number.isFinite(step) && step! > 0) {
    const base = Number.isFinite(min) ? min! : 0;
    value = base + Math.round((value - base) / step!) * step!;
    if (Number.isFinite(min)) { value = Math.max(min!, value); }
    if (Number.isFinite(max)) { value = Math.min(max!, value); }
    const stepText = String(step);
    const dot = stepText.indexOf('.');
    if (dot >= 0) {
      const digits = stepText.length - dot - 1;
      value = Number(value.toFixed(Math.min(6, digits)));
    }
  }
  return value;
}

export function startInlineSliderEdit(valueElement: HTMLElement, slider: HTMLInputElement): void {
  if (valueElement.dataset['inlineEditing'] === 'true' || slider.disabled) { return; }
  const originalText = valueElement.textContent || '';
  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'inline-slider-editor';
  input.value = slider.value;
  if (slider.min !== '') input.min = slider.min;
  if (slider.max !== '') input.max = slider.max;
  if (slider.step !== '') input.step = slider.step;

  valueElement.dataset['inlineEditing'] = 'true';
  valueElement.textContent = '';
  valueElement.appendChild(input);
  input.focus();
  input.select();

  const finishEdit = (apply: boolean) => {
    if (valueElement.dataset['inlineEditing'] !== 'true') { return; }
    delete valueElement.dataset['inlineEditing'];
    valueElement.textContent = originalText;
    if (!apply) { return; }
    const minVal = Number.parseFloat(slider.min);
    const maxVal = Number.parseFloat(slider.max);
    const stepVal = Number.parseFloat(slider.step);
    const nextValue = normalizeSliderValue(
      input.value,
      Number.isFinite(minVal) ? minVal : undefined,
      Number.isFinite(maxVal) ? maxVal : undefined,
      Number.isFinite(stepVal) ? stepVal : undefined
    );
    if (!Number.isFinite(nextValue)) { return; }
    slider.value = String(nextValue);
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    slider.dispatchEvent(new Event('change', { bubbles: true }));
  };

  input.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      finishEdit(true);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      finishEdit(false);
    }
  });
  input.addEventListener('blur', () => finishEdit(true));
}

export function setupInlineSliderValueEditing(): void {
  const valueElements = Array.from(document.querySelectorAll('span[id$="-value"]')) as HTMLElement[];
  for (const valueElement of valueElements) {
    if (!valueElement.id || valueElement.dataset['inlineSliderBound'] === 'true') { continue; }
    const sliderId = valueElement.id.replace(/-value$/, '-slider');
    const slider = document.getElementById(sliderId) as HTMLInputElement | null;
    if (!slider || slider.tagName.toLowerCase() !== 'input' || slider.type !== 'range') { continue; }
    valueElement.dataset['inlineSliderBound'] = 'true';
    valueElement.classList.add('inline-slider-value');
    valueElement.addEventListener('dblclick', (event: Event) => {
      event.preventDefault();
      startInlineSliderEdit(valueElement, slider);
    });
  }
}