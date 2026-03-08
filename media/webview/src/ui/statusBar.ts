import { structureStore, selectionStore, interactionStore, trajectoryStore } from '../state';
import { getFractionalCoords } from '../utils/measurements';

let statusSelectionLock = false;
let lastStatusSelectedId: string | null = null;

export function isStatusSelectionLocked(): boolean {
  return statusSelectionLock;
}

export function setError(message: string): void {
  const banner = document.getElementById('error-banner') as HTMLElement | null;
  if (!banner) { return; }
  banner.textContent = message || '';
  banner.style.display = message ? 'block' : 'none';
}

export function setStatus(message: string): void {
  const hintEl = document.getElementById('status-hint') as HTMLElement | null;
  if (hintEl) {
    hintEl.textContent = message || 'Move: Shift+Alt+drag | Add: type element';
  }
}

export function updateStatusBar(force?: boolean): void {
  const modeEl = document.getElementById('status-mode') as HTMLElement | null;
  const selectionEl = document.getElementById('status-selection') as HTMLElement | null;
  const hintEl = document.getElementById('status-hint') as HTMLElement | null;
  const frameEl = document.getElementById('status-frame') as HTMLElement | null;
  
  if (!modeEl || !selectionEl) return;
  
  updateModeDisplay(modeEl, hintEl);
  updateSelectionDisplay(selectionEl);
  updateFrameDisplay(frameEl);
  
  const selected = structureStore.currentSelectedAtom;
  const selectedId = selected ? selected.id : null;
  if (!force && statusSelectionLock && selectedId === lastStatusSelectedId) {
    return;
  }
  lastStatusSelectedId = selectedId;
}

function updateModeDisplay(modeEl: HTMLElement, hintEl: HTMLElement | null): void {
  const tool = interactionStore.currentTool;
  const toolNames: Record<string, string> = {
    select: 'Select mode',
    move: 'Move mode',
    box: 'Box Select',
    add: 'Add Atom',
    delete: 'Delete mode',
  };
  modeEl.textContent = toolNames[tool] || 'Select mode';
  
  if (hintEl) {
    if (interactionStore.addingAtomElement) {
      hintEl.textContent = `Adding ${interactionStore.addingAtomElement} atoms - Click to place, Esc to cancel`;
    } else {
      const hints: Record<string, string> = {
        select: 'Click atom to select, drag empty for box select',
        move: 'Click and drag atom to move',
        box: 'Drag to create selection box',
        add: 'Type element symbol, then click to place',
        delete: 'Click atom or bond to delete',
      };
      hintEl.textContent = hints[tool] || 'Move: Shift+Alt+drag | Add: type element';
    }
  }
}

function updateSelectionDisplay(selectionEl: HTMLElement): void {
  const atomCount = selectionStore.selectedAtomIds.length;
  const bondCount = selectionStore.selectedBondKeys.length;
  
  if (atomCount === 0 && bondCount === 0) {
    selectionEl.textContent = 'Selected: 0';
    return;
  }
  
  const parts: string[] = [];
  if (atomCount > 0) {
    const selected = structureStore.currentSelectedAtom;
    if (atomCount === 1 && selected) {
      parts.push(`Selected: ${selected.element}`);
    } else {
      parts.push(`Selected: ${atomCount} atoms`);
    }
  }
  if (bondCount > 0) {
    parts.push(`${bondCount} bonds`);
  }
  selectionEl.textContent = parts.join(' | ');
}

function updateFrameDisplay(frameEl: HTMLElement | null): void {
  if (!frameEl) return;
  const current = trajectoryStore.trajectoryFrameIndex + 1;
  const total = trajectoryStore.trajectoryFrameCount;
  frameEl.textContent = `Frame ${current}/${total}`;
}

export function syncStatusSelectionLock(): void {
  const selection = document.getSelection();
  const statusBar = document.getElementById('status-bar') as HTMLElement | null;
  if (!selection || !statusBar || selection.isCollapsed) {
    statusSelectionLock = false;
    return;
  }
  const anchor = selection.anchorNode;
  const focus = selection.focusNode;
  statusSelectionLock =
    (!!anchor && statusBar.contains(anchor)) ||
    (!!focus && statusBar.contains(focus));
}

export function updateToolButtons(): void {
  const buttons = document.querySelectorAll('.tool-btn');
  buttons.forEach(btn => {
    const tool = btn.getAttribute('data-tool');
    if (tool === interactionStore.currentTool) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}
