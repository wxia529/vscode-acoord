import { selectionStore, interactionStore, structureStore } from '../state';
import { renderer } from '../renderer';
import { Vector3, Plane } from 'three';

export interface ContextMenuHandler {
  label?: string;
  action?: () => void;
  submenu?: ContextMenuHandler[];
  divider?: boolean;
  disabled?: boolean;
}

interface ContextMenuOptions {
  x: number;
  y: number;
  items: ContextMenuHandler[];
  onClose?: () => void;
}

let activeMenu: HTMLDivElement | null = null;
let closeCallback: (() => void) | null = null;

const COMMON_ELEMENTS = [
  'C', 'H', 'O', 'N', 'S', 'P',
  'Fe', 'Cu', 'Zn', 'Al', 'Mg', 'Na',
  'Ca', 'Ti', 'Cr', 'Mn', 'Co', 'Ni',
  'Ag', 'Au',
];

const MENU_STYLE = `
  position: fixed;
  background: #1e1e1e;
  border: 1px solid #454545;
  border-radius: 4px;
  padding: 4px 0;
  min-width: 160px;
  z-index: 10000;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
  font-size: 13px;
  color: #cccccc;
`;

const ITEM_STYLE = `
  padding: 6px 24px 6px 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
  user-select: none;
`;

const ITEM_DISABLED_STYLE = `
  opacity: 0.5;
  cursor: default;
`;

const DIVIDER_STYLE = `
  height: 1px;
  background: #454545;
  margin: 4px 8px;
`;

const SUBMENU_ARROW = '▸';

function createMenuElement(options: ContextMenuOptions): HTMLDivElement {
  const menu = document.createElement('div');
  menu.setAttribute('role', 'menu');
  menu.style.cssText = MENU_STYLE;
  menu.style.left = `${options.x}px`;
  menu.style.top = `${options.y}px`;

  for (const item of options.items) {
    if (item.divider) {
      const divider = document.createElement('div');
      divider.style.cssText = DIVIDER_STYLE;
      menu.appendChild(divider);
      continue;
    }

    const menuItem = document.createElement('div');
    menuItem.setAttribute('role', 'menuitem');
    menuItem.textContent = item.label ?? '';
    
    let itemStyle = ITEM_STYLE;
    if (item.disabled) {
      itemStyle += ITEM_DISABLED_STYLE;
    }
    menuItem.style.cssText = itemStyle;

    if (item.submenu) {
      const arrow = document.createElement('span');
      arrow.textContent = SUBMENU_ARROW;
      arrow.style.cssText = 'margin-left: 16px;';
      menuItem.appendChild(arrow);
    }

    if (!item.disabled) {
      menuItem.addEventListener('mouseenter', () => {
        menuItem.style.background = '#094771';
      });
      menuItem.addEventListener('mouseleave', () => {
        menuItem.style.background = 'transparent';
      });

      if (item.action) {
        menuItem.addEventListener('click', (e) => {
          e.stopPropagation();
          closeContextMenu();
          item.action!();
        });
      }

      if (item.submenu) {
        const submenuContainer = document.createElement('div');
        submenuContainer.style.cssText = `
          position: absolute;
          left: 100%;
          top: 0;
          display: none;
        `;
        
        const submenuElement = createMenuElement({
          x: 0,
          y: 0,
          items: item.submenu,
        });
        submenuElement.style.position = 'relative';
        submenuElement.style.left = '0';
        submenuElement.style.top = '0';
        submenuElement.style.boxShadow = 'none';
        submenuContainer.appendChild(submenuElement);
        menuItem.appendChild(submenuContainer);

        menuItem.addEventListener('mouseenter', () => {
          submenuContainer.style.display = 'block';
          const rect = menuItem.getBoundingClientRect();
          const submenuRect = submenuContainer.getBoundingClientRect();
          if (rect.right + submenuRect.width > window.innerWidth) {
            submenuContainer.style.left = 'auto';
            submenuContainer.style.right = '100%';
          }
        });
        menuItem.addEventListener('mouseleave', () => {
          submenuContainer.style.display = 'none';
        });
      }
    }

    menu.appendChild(menuItem);
  }

  return menu;
}

export function showContextMenu(options: ContextMenuOptions): void {
  closeContextMenu();
  
  activeMenu = createMenuElement(options);
  closeCallback = options.onClose || null;
  
  const rect = activeMenu.getBoundingClientRect();
  const adjustedX = options.x + rect.width > window.innerWidth 
    ? window.innerWidth - rect.width - 8 
    : options.x;
  const adjustedY = options.y + rect.height > window.innerHeight 
    ? window.innerHeight - rect.height - 8 
    : options.y;
  
  activeMenu.style.left = `${adjustedX}px`;
  activeMenu.style.top = `${adjustedY}px`;
  
  document.body.appendChild(activeMenu);
  
  const closeOnOutsideClick = (e: MouseEvent) => {
    if (activeMenu && !activeMenu.contains(e.target as Node)) {
      closeContextMenu();
    }
  };
  
  const closeOnEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeContextMenu();
    }
  };
  
  document.addEventListener('mousedown', closeOnOutsideClick);
  document.addEventListener('keydown', closeOnEscape);
  
  activeMenu.dataset.closeOnOutsideClick = 'true';
  activeMenu.dataset.closeOnEscape = 'true';
}

export function closeContextMenu(): void {
  if (activeMenu) {
    if (closeCallback) {
      closeCallback();
      closeCallback = null;
    }
    activeMenu.remove();
    activeMenu = null;
  }
}

export interface ContextMenuHandlers {
  onDeleteAtom?: (atomIds: string[]) => void;
  onDeleteBond?: (bondKeys: string[]) => void;
  onChangeElement?: (atomIds: string[], element: string) => void;
  onCopy?: (atomIds: string[]) => void;
  onPaste?: () => void;
  onSetAtomColor?: (atomIds: string[], color: string) => void;
  onSetAtomRadius?: (atomIds: string[], radius: number) => void;
  onCreateBond?: (atomIds: string[]) => void;
  onSetBondLength?: (bondKeys: string[], length: number) => void;
  onAddAtom?: (element: string, x: number, y: number, z: number) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onSelectAll?: () => void;
  onClearSelection?: () => void;
  onSave?: () => void;
  onExportImage?: () => void;
  onSetStatus?: (message: string) => void;
}

function showColorPickerDialog(atomIds: string[], handler: (color: string) => void): void {
  const existingOverlay = document.getElementById('color-picker-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }

  const overlay = document.createElement('div');
  overlay.id = 'color-picker-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 10001;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  const dialog = document.createElement('div');
  dialog.style.cssText = `
    background: #1e1e1e;
    border: 1px solid #454545;
    border-radius: 6px;
    padding: 16px;
    min-width: 200px;
  `;

  const title = document.createElement('div');
  title.textContent = 'Set Atom Color';
  title.style.cssText = `
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 12px;
    color: #cccccc;
  `;
  dialog.appendChild(title);

  const colorInput = document.createElement('input');
  colorInput.type = 'color';
  colorInput.value = '#ff0000';
  colorInput.style.cssText = `
    width: 100%;
    height: 40px;
    border: 1px solid #454545;
    border-radius: 4px;
    cursor: pointer;
    margin-bottom: 12px;
  `;
  dialog.appendChild(colorInput);

  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = `
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  `;

  const cancelButton = document.createElement('button');
  cancelButton.textContent = 'Cancel';
  cancelButton.style.cssText = `
    background: transparent;
    border: 1px solid #454545;
    border-radius: 4px;
    padding: 6px 12px;
    color: #cccccc;
    cursor: pointer;
  `;
  cancelButton.addEventListener('click', () => overlay.remove());
  buttonContainer.appendChild(cancelButton);

  const okButton = document.createElement('button');
  okButton.textContent = 'OK';
  okButton.style.cssText = `
    background: #0e639c;
    border: 1px solid #0e639c;
    border-radius: 4px;
    padding: 6px 12px;
    color: #ffffff;
    cursor: pointer;
  `;
  okButton.addEventListener('click', () => {
    const color = colorInput.value;
    handler(color);
    overlay.remove();
  });
  buttonContainer.appendChild(okButton);

  dialog.appendChild(buttonContainer);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });
}

function showRadiusInputDialog(atomIds: string[], handler: (radius: number) => void): void {
  const existingOverlay = document.getElementById('radius-input-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }

  const overlay = document.createElement('div');
  overlay.id = 'radius-input-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 10001;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  const dialog = document.createElement('div');
  dialog.style.cssText = `
    background: #1e1e1e;
    border: 1px solid #454545;
    border-radius: 6px;
    padding: 16px;
    min-width: 240px;
  `;

  const title = document.createElement('div');
  title.textContent = 'Set Atom Radius';
  title.style.cssText = `
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 12px;
    color: #cccccc;
  `;
  dialog.appendChild(title);

  const input = document.createElement('input');
  input.type = 'number';
  input.step = '0.1';
  input.min = '0.1';
  input.max = '5.0';
  input.value = '1.0';
  input.style.cssText = `
    width: 100%;
    padding: 8px;
    border: 1px solid #454545;
    border-radius: 4px;
    background: #2d2d2d;
    color: #cccccc;
    font-size: 13px;
    margin-bottom: 12px;
    box-sizing: border-box;
  `;
  dialog.appendChild(input);

  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = `
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  `;

  const cancelButton = document.createElement('button');
  cancelButton.textContent = 'Cancel';
  cancelButton.style.cssText = `
    background: transparent;
    border: 1px solid #454545;
    border-radius: 4px;
    padding: 6px 12px;
    color: #cccccc;
    cursor: pointer;
  `;
  cancelButton.addEventListener('click', () => overlay.remove());
  buttonContainer.appendChild(cancelButton);

  const okButton = document.createElement('button');
  okButton.textContent = 'OK';
  okButton.style.cssText = `
    background: #0e639c;
    border: 1px solid #0e639c;
    border-radius: 4px;
    padding: 6px 12px;
    color: #ffffff;
    cursor: pointer;
  `;
  okButton.addEventListener('click', () => {
    const radius = parseFloat(input.value);
    if (!isNaN(radius) && radius > 0) {
      handler(radius);
    }
    overlay.remove();
  });
  buttonContainer.appendChild(okButton);

  dialog.appendChild(buttonContainer);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  input.focus();
  input.select();

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const radius = parseFloat(input.value);
      if (!isNaN(radius) && radius > 0) {
        handler(radius);
      }
      overlay.remove();
    } else if (e.key === 'Escape') {
      overlay.remove();
    }
  });
}

function showBondLengthDialog(bondKeys: string[], handler: (length: number) => void): void {
  const existingOverlay = document.getElementById('bond-length-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }

  const overlay = document.createElement('div');
  overlay.id = 'bond-length-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 10001;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  const dialog = document.createElement('div');
  dialog.style.cssText = `
    background: #1e1e1e;
    border: 1px solid #454545;
    border-radius: 6px;
    padding: 16px;
    min-width: 240px;
  `;

  const title = document.createElement('div');
  title.textContent = 'Set Bond Length (Angstroms)';
  title.style.cssText = `
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 12px;
    color: #cccccc;
  `;
  dialog.appendChild(title);

  const input = document.createElement('input');
  input.type = 'number';
  input.step = '0.01';
  input.min = '0.1';
  input.max = '10.0';
  input.value = '1.5';
  input.style.cssText = `
    width: 100%;
    padding: 8px;
    border: 1px solid #454545;
    border-radius: 4px;
    background: #2d2d2d;
    color: #cccccc;
    font-size: 13px;
    margin-bottom: 12px;
    box-sizing: border-box;
  `;
  dialog.appendChild(input);

  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = `
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  `;

  const cancelButton = document.createElement('button');
  cancelButton.textContent = 'Cancel';
  cancelButton.style.cssText = `
    background: transparent;
    border: 1px solid #454545;
    border-radius: 4px;
    padding: 6px 12px;
    color: #cccccc;
    cursor: pointer;
  `;
  cancelButton.addEventListener('click', () => overlay.remove());
  buttonContainer.appendChild(cancelButton);

  const okButton = document.createElement('button');
  okButton.textContent = 'OK';
  okButton.style.cssText = `
    background: #0e639c;
    border: 1px solid #0e639c;
    border-radius: 4px;
    padding: 6px 12px;
    color: #ffffff;
    cursor: pointer;
  `;
  okButton.addEventListener('click', () => {
    const length = parseFloat(input.value);
    if (!isNaN(length) && length > 0) {
      handler(length);
    }
    overlay.remove();
  });
  buttonContainer.appendChild(okButton);

  dialog.appendChild(buttonContainer);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  input.focus();
  input.select();

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const length = parseFloat(input.value);
      if (!isNaN(length) && length > 0) {
        handler(length);
      }
      overlay.remove();
    } else if (e.key === 'Escape') {
      overlay.remove();
    }
  });
}

export function createAtomContextMenu(
  atomIds: string[],
  handlers: ContextMenuHandlers,
): ContextMenuHandler[] {
  const changeElementSubmenu: ContextMenuHandler[] = COMMON_ELEMENTS.map((element) => ({
    label: element,
    action: () => handlers.onChangeElement?.(atomIds, element),
  }));

  return [
    {
      label: 'Delete atom' + (atomIds.length > 1 ? 's' : ''),
      action: () => handlers.onDeleteAtom?.(atomIds),
    },
    {
      label: 'Change element',
      submenu: changeElementSubmenu,
    },
    { divider: true },
    {
      label: 'Copy',
      action: () => handlers.onCopy?.(atomIds),
    },
    {
      label: 'Paste',
      action: () => handlers.onPaste?.(),
    },
    { divider: true },
    {
      label: 'Set color...',
      action: () => {
        showColorPickerDialog(atomIds, (color) => {
          handlers.onSetAtomColor?.(atomIds, color);
        });
      },
    },
    {
      label: 'Set radius...',
      action: () => {
        showRadiusInputDialog(atomIds, (radius) => {
          handlers.onSetAtomRadius?.(atomIds, radius);
        });
      },
    },
  ];
}

export function createBondContextMenu(
  bondKeys: string[],
  handlers: ContextMenuHandlers,
): ContextMenuHandler[] {
  return [
    {
      label: 'Delete bond' + (bondKeys.length > 1 ? 's' : ''),
      action: () => handlers.onDeleteBond?.(bondKeys),
    },
    {
      label: 'Set bond length...',
      action: () => {
        showBondLengthDialog(bondKeys, (length) => {
          handlers.onSetBondLength?.(bondKeys, length);
        });
      },
    },
    { divider: true },
    {
      label: 'Create new bond...',
      action: () => {
        const selectedAtomIds = selectionStore.selectedAtomIds;
        if (selectedAtomIds.length >= 2) {
          handlers.onCreateBond?.(selectedAtomIds);
        }
      },
      disabled: selectionStore.selectedAtomIds.length < 2,
    },
  ];
}

export function createEmptySpaceContextMenu(
  clickPosition: { x: number; y: number; z: number } | null,
  handlers: ContextMenuHandlers,
): ContextMenuHandler[] {
  const addAtomSubmenu: ContextMenuHandler[] = COMMON_ELEMENTS.map((element) => ({
    label: element,
    action: () => {
      if (clickPosition) {
        handlers.onAddAtom?.(element, clickPosition.x, clickPosition.y, clickPosition.z);
      } else {
        interactionStore.addingAtomElement = element;
        handlers.onSetStatus?.(`Adding ${element} atoms - Click to place, Esc to cancel`);
      }
    },
  }));

  return [
    {
      label: 'Add atom',
      submenu: addAtomSubmenu,
    },
    { divider: true },
    {
      label: 'Undo',
      action: () => handlers.onUndo?.(),
    },
    {
      label: 'Redo',
      action: () => handlers.onRedo?.(),
    },
    { divider: true },
    {
      label: 'Select all',
      action: () => handlers.onSelectAll?.(),
    },
    {
      label: 'Clear selection',
      action: () => handlers.onClearSelection?.(),
      disabled: selectionStore.selectedAtomIds.length === 0 && selectionStore.selectedBondKeys.length === 0,
    },
    { divider: true },
    {
      label: 'Save',
      action: () => handlers.onSave?.(),
    },
    {
      label: 'Export image',
      action: () => handlers.onExportImage?.(),
    },
  ];
}

export function setupContextMenu(
  canvas: HTMLCanvasElement,
  handlers: ContextMenuHandlers,
): void {
  canvas.addEventListener('contextmenu', (event: MouseEvent) => {
    event.preventDefault();

    const raycaster = renderer.getRaycaster();
    const mouse = renderer.getMouse();
    const camera = renderer.getCamera();
    
    if (!raycaster || !mouse || !camera) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const meshes = Array.from(renderer.getAtomMeshes().values());
    const bondMeshes = renderer.getBondMeshes ? renderer.getBondMeshes() : [];

    const atomHits = meshes.length > 0 ? raycaster.intersectObjects(meshes) : [];
    if (atomHits.length > 0) {
      const hit = atomHits[0];
      const atomId = hit.object.userData && (hit.object.userData as Record<string, unknown>).atomId as string | undefined;
      if (atomId) {
        let selectedIds = selectionStore.selectedAtomIds;
        if (!selectedIds.includes(atomId)) {
          selectedIds = [atomId];
        }
        showContextMenu({
          x: event.clientX,
          y: event.clientY,
          items: createAtomContextMenu(selectedIds, handlers),
        });
        return;
      }
    }

    if (bondMeshes.length > 0) {
      const bondHits = raycaster.intersectObjects(bondMeshes);
      if (bondHits.length > 0) {
        const hit = bondHits[0];
        const bondKey = hit.object.userData && (hit.object.userData as Record<string, unknown>).bondKey as string | undefined;
        if (bondKey) {
          let selectedKeys = selectionStore.selectedBondKeys;
          if (!selectedKeys.includes(bondKey)) {
            selectedKeys = [bondKey];
          }
          showContextMenu({
            x: event.clientX,
            y: event.clientY,
            items: createBondContextMenu(selectedKeys, handlers),
          });
          return;
        }
      }
    }

    const dragPlane = new Plane();
    const planeNormal = new Vector3();
    camera.getWorldDirection(planeNormal);
    dragPlane.setFromNormalAndCoplanarPoint(planeNormal, new Vector3(0, 0, 0));
    const intersection = new Vector3();
    raycaster.ray.intersectPlane(dragPlane, intersection);

    let clickPosition: { x: number; y: number; z: number } | null = null;
    if (intersection) {
      const scale = renderer.getScale();
      const invScale = scale ? 1 / scale : 1;
      clickPosition = {
        x: intersection.x * invScale,
        y: intersection.y * invScale,
        z: intersection.z * invScale,
      };
    }

    showContextMenu({
      x: event.clientX,
      y: event.clientY,
      items: createEmptySpaceContextMenu(clickPosition, handlers),
    });
  });
}
