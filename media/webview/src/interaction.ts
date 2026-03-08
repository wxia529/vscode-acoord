import { selectionStore, interactionStore, type ToolType } from './state';
import { renderer } from './renderer';
import { Vector3, Plane } from 'three';
import * as interactionLighting from './interactionLighting';
import { init as initDisplay } from './interactionDisplay';
import { init as initConfig } from './interactionConfig';
import { setupContextMenu, type ContextMenuHandlers } from './components/contextMenu';
import { updateToolButtons, updateStatusBar } from './ui/statusBar';

const SINGLE_LETTER_ELEMENTS = new Set(['H', 'B', 'C', 'N', 'O', 'F', 'P', 'S', 'K', 'V', 'Y', 'I', 'W', 'U']);

const TWO_LETTER_ELEMENTS = new Set([
  'He', 'Li', 'Be', 'Ne', 'Na', 'Mg', 'Al', 'Si', 'Cl', 'Ar', 'Ca', 'Sc', 'Ti', 'Cr', 'Mn', 'Fe',
  'Co', 'Ni', 'Cu', 'Zn', 'Ga', 'Ge', 'As', 'Se', 'Br', 'Kr', 'Rb', 'Sr', 'Zr', 'Nb', 'Mo', 'Tc',
  'Ru', 'Rh', 'Pd', 'Ag', 'Cd', 'In', 'Sn', 'Sb', 'Te', 'Xe', 'Cs', 'Ba', 'La', 'Ce', 'Pr', 'Nd',
  'Pm', 'Sm', 'Eu', 'Gd', 'Tb', 'Dy', 'Ho', 'Er', 'Tm', 'Yb', 'Lu', 'Hf', 'Ta', 'Re', 'Os', 'Ir',
  'Pt', 'Au', 'Hg', 'Tl', 'Pb', 'Bi', 'Po', 'At', 'Rn', 'Fr', 'Ra', 'Ac', 'Th', 'Pa', 'Np', 'Pu',
  'Am', 'Cm', 'Bk', 'Cf', 'Es', 'Fm', 'Md', 'No', 'Lr', 'Rf', 'Db', 'Sg', 'Bh', 'Hs', 'Mt', 'Ds',
  'Rg', 'Cn', 'Nh', 'Fl', 'Mc', 'Lv', 'Ts', 'Og',
]);

const ALL_ELEMENTS = new Set([...SINGLE_LETTER_ELEMENTS, ...TWO_LETTER_ELEMENTS]);

function isValidElement(symbol: string): boolean {
  return ALL_ELEMENTS.has(symbol);
}

function isSingleLetterElement(letter: string): boolean {
  return SINGLE_LETTER_ELEMENTS.has(letter.toUpperCase());
}

export interface InteractionHandlers {
  onSelectAtom: (atomId: string, add: boolean, preserve: boolean) => void;
  onSelectBond: (bondKey: string | null, add: boolean) => void;
  onClearSelection?: () => void;
  onBoxSelect?: (atomIds: string[], mode: string) => void;
  onBoxSelectBonds?: (bondKeys: string[], mode: string) => void;
  onSetStatus: (message: string) => void;
  onBeginDrag?: (atomId: string) => void;
  onDragAtom: (atomId: string, intersection: Vector3) => void;
  onDragGroup?: (delta: Vector3) => void;
  onEndDrag?: () => void;
  onDelete?: () => void;
  onSelectAll?: () => void;
  onInvertSelection?: () => void;
  onAddAtom?: (element: string, x: number, y: number, z: number) => void;
  onCopy?: (atomIds: string[]) => void;
  onPaste?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onSave?: () => void;
  onExportImage?: () => void;
  onSetAtomColor?: (atomIds: string[], color: string) => void;
  onSetAtomRadius?: (atomIds: string[], radius: number) => void;
  onChangeElement?: (atomIds: string[], element: string) => void;
  onCreateBond?: (atomIds: string[]) => void;
  onSetBondLength?: (bondKeys: string[], length: number) => void;
  onDeleteAtoms?: (atomIds: string[]) => void;
  onDeleteBonds?: (bondKeys: string[]) => void;
  onCalculateBonds?: () => void;
  onClearBonds?: () => void;
}

let controller: AbortController | null = null;
let elementInputTimeout: ReturnType<typeof setTimeout> | null = null;

function setTool(tool: ToolType, canvas: HTMLCanvasElement, handlers: InteractionHandlers): void {
  interactionStore.currentTool = tool;
  updateToolButtons();
  updateStatusBar(true);
  
  if (tool === 'add') {
    if (!interactionStore.addingAtomElement) {
      interactionStore.addingAtomElement = 'C';
      canvas.style.cursor = 'crosshair';
      handlers.onSetStatus('Adding C atoms - Click to place, Esc to cancel');
    }
  } else if (interactionStore.addingAtomElement) {
    interactionStore.addingAtomElement = null;
    canvas.style.cursor = 'default';
  }
  
  if (tool === 'move') {
    canvas.style.cursor = 'grab';
  } else if (tool === 'delete') {
    canvas.style.cursor = 'not-allowed';
  } else if (tool === 'box') {
    canvas.style.cursor = 'crosshair';
  } else {
    canvas.style.cursor = 'default';
  }
}

function setupLeftToolbar(canvas: HTMLCanvasElement, handlers: InteractionHandlers): void {
  const toolbar = document.getElementById('left-toolbar');
  if (!toolbar) return;
  
  toolbar.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('tool-btn')) {
      const tool = target.getAttribute('data-tool') as ToolType;
      if (tool) {
        setTool(tool, canvas, handlers);
      }
    }
  });
}

export function init(canvas: HTMLCanvasElement, handlers: InteractionHandlers): void {
  const dragLerp = 0.18;
  const dragThreshold = 4;
  const selectionBox = document.getElementById('selection-box') as HTMLElement | null;
  let pendingDrag: { atomId: string; hitPoint: Vector3; startX: number; startY: number } | null = null;
  let boxSelect: { startX: number; startY: number } | null = null;
  let isPointerDownOnEmpty = false;
  const ELEMENT_INPUT_TIMEOUT_MS = 500;

  const _intersection = new Vector3();
  const _normal       = new Vector3();
  const _delta        = new Vector3();
  const _normalDelta  = new Vector3();
  const _newPos       = new Vector3();
  const _projected    = new Vector3();
  
  controller = new AbortController();
  
  canvas.tabIndex = 0;
  (canvas.style as CSSStyleDeclaration).outline = 'none';

  const pickerState = interactionLighting.pickerState;
  
  setupLeftToolbar(canvas, handlers);

  canvas.addEventListener('pointerdown', (event: PointerEvent) => {
    canvas.focus();
    if (pickerState.activeLightPicker) {
      pickerState.lightPickerDragging = true;
      renderer.setControlsEnabled(false);
      interactionLighting.applyFromEvent(event, canvas);
      event.preventDefault();
      return;
    }

    const currentTool = interactionStore.currentTool;

    if (interactionStore.addingAtomElement && handlers.onAddAtom) {
      const raycaster = renderer.getRaycaster();
      const mouse = renderer.getMouse();
      const camera = renderer.getCamera();
      if (!raycaster || !mouse || !camera) { return; }

      const meshes = Array.from(renderer.getAtomMeshes().values());
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = meshes.length > 0 ? raycaster.intersectObjects(meshes) : [];

      if (hits.length > 0) {
        const hit = hits[0];
        const atomId = hit.object.userData && (hit.object.userData as Record<string, unknown>).atomId as string | undefined;
        if (atomId) {
          interactionStore.addingAtomElement = null;
          canvas.style.cursor = 'default';
          handlers.onSetStatus('');
          handlers.onSelectAtom(atomId, event.ctrlKey || event.metaKey, false);
          return;
        }
      }

      const dragPlane = new Plane();
      const planeNormal = new Vector3();
      camera.getWorldDirection(planeNormal);
      dragPlane.setFromNormalAndCoplanarPoint(planeNormal, new Vector3(0, 0, 0));
      const intersection = new Vector3();
      raycaster.ray.intersectPlane(dragPlane, intersection);

      if (intersection) {
        const scale = renderer.getScale();
        const invScale = scale ? 1 / scale : 1;
        const x = intersection.x * invScale;
        const y = intersection.y * invScale;
        const z = intersection.z * invScale;
        handlers.onAddAtom(interactionStore.addingAtomElement, x, y, z);
      }
      return;
    }

    const raycaster = renderer.getRaycaster();
    const mouse = renderer.getMouse();
    const camera = renderer.getCamera();
    const meshes = Array.from(renderer.getAtomMeshes().values());
    const bondMeshes = renderer.getBondMeshes ? renderer.getBondMeshes() : [];
    if (!raycaster || !mouse || !camera) { return; }

    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = meshes.length > 0 ? raycaster.intersectObjects(meshes) : [];
    
    if (hits.length > 0) {
      const hit = hits[0];
      const atomId = hit.object.userData && (hit.object.userData as Record<string, unknown>).atomId as string | undefined;
      if (atomId) {
        if (currentTool === 'delete') {
          if (handlers.onDeleteAtoms) {
            handlers.onDeleteAtoms([atomId]);
          }
          event.preventDefault();
          return;
        }
        
        const canDrag = currentTool === 'move' || (event.shiftKey && event.altKey);
        if (canDrag) {
          const isSelected = selectionStore.selectedAtomIds && selectionStore.selectedAtomIds.includes(atomId);
          if (isSelected) {
            pendingDrag = {
              atomId,
              hitPoint: hit.point.clone(),
              startX: event.clientX,
              startY: event.clientY,
            };
            renderer.setControlsEnabled(false);
          } else {
            handlers.onSelectAtom(atomId, false, false);
            pendingDrag = {
              atomId,
              hitPoint: hit.point.clone(),
              startX: event.clientX,
              startY: event.clientY,
            };
            renderer.setControlsEnabled(false);
          }
          return;
        }
        handlers.onSelectAtom(atomId, event.ctrlKey || event.metaKey, false);
        return;
      }
    }

    if (bondMeshes.length > 0) {
      const bondHits = raycaster.intersectObjects(bondMeshes);
      if (bondHits.length > 0) {
        const hit = bondHits[0];
        const bondKey = hit.object.userData && (hit.object.userData as Record<string, unknown>).bondKey as string | undefined;
        if (bondKey && handlers.onSelectBond) {
          if (currentTool === 'delete') {
            if (handlers.onDeleteBonds) {
              handlers.onDeleteBonds([bondKey]);
            }
            event.preventDefault();
            return;
          }
          handlers.onSelectBond(bondKey, event.ctrlKey || event.metaKey);
          return;
        }
      }
    }

    if (currentTool === 'box' || currentTool === 'select') {
      const localX = event.clientX - rect.left;
      const localY = event.clientY - rect.top;
      boxSelect = {
        startX: localX,
        startY: localY,
      };
      isPointerDownOnEmpty = true;
      renderer.setControlsEnabled(false);
      if (selectionBox) {
        selectionBox.style.display = 'block';
        selectionBox.style.left = localX + 'px';
        selectionBox.style.top = localY + 'px';
        selectionBox.style.width = '0px';
        selectionBox.style.height = '0px';
      }
    }
  }, { signal: controller.signal });

  canvas.addEventListener('pointermove', (event: PointerEvent) => {
    if (pickerState.activeLightPicker && pickerState.lightPickerDragging) {
      interactionLighting.applyFromEvent(event, canvas);
      return;
    }
    const raycaster = renderer.getRaycaster();
    const mouse = renderer.getMouse();
    const camera = renderer.getCamera();
    if (!raycaster || !mouse || !camera) { return; }

    if (pendingDrag && !interactionStore.isDragging) {
      const dx = event.clientX - pendingDrag.startX;
      const dy = event.clientY - pendingDrag.startY;
      if (Math.hypot(dx, dy) > dragThreshold) {
        interactionStore.isDragging = true;
        interactionStore.dragAtomId = pendingDrag.atomId;
        interactionStore.lastDragWorld = pendingDrag.hitPoint.clone();
        renderer.setControlsEnabled(false);
        camera.getWorldDirection(_normal);
        interactionStore.dragPlaneNormal = _normal.clone();
        renderer.getDragPlane().setFromNormalAndCoplanarPoint(_normal, pendingDrag.hitPoint);
        if (handlers.onBeginDrag) {
          handlers.onBeginDrag(pendingDrag.atomId);
        }
      }
    }

    if (interactionStore.isDragging && interactionStore.dragAtomId) {
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hit = raycaster.ray.intersectPlane(renderer.getDragPlane(), _intersection);
      if (hit) {
        const mesh = renderer.getAtomMeshes().get(interactionStore.dragAtomId);
        let nextPosition: Vector3;
        if (mesh) {
          _newPos.copy(mesh.position).lerp(_intersection, dragLerp);
          nextPosition = _newPos;
        } else {
          nextPosition = _intersection;
        }

        const storedNormal = interactionStore.dragPlaneNormal instanceof Vector3
          ? interactionStore.dragPlaneNormal
          : camera.getWorldDirection(_normal);

        if (selectionStore.selectedAtomIds.length > 1 && mesh) {
          const last = interactionStore.lastDragWorld instanceof Vector3 ? interactionStore.lastDragWorld : mesh.position;
          _delta.subVectors(nextPosition, mesh.position);
          _normalDelta.copy(storedNormal).multiplyScalar(_delta.dot(storedNormal));
          _delta.sub(_normalDelta);
          if (_delta.length() > 0) {
            for (const id of selectionStore.selectedAtomIds) {
              const selectedMesh = renderer.getAtomMeshes().get(id);
              if (selectedMesh) {
                _newPos.copy(selectedMesh.position).add(_delta);
                renderer.updateAtomPosition(id, _newPos);
              }
            }
            if (handlers.onDragGroup) {
              handlers.onDragGroup(_delta);
            }
          }
        } else if (mesh) {
          _delta.subVectors(nextPosition, mesh.position);
          _normalDelta.copy(storedNormal).multiplyScalar(_delta.dot(storedNormal));
          nextPosition.sub(_normalDelta);
          renderer.updateAtomPosition(interactionStore.dragAtomId, nextPosition);
          handlers.onDragAtom(interactionStore.dragAtomId, nextPosition);
        }

        interactionStore.lastDragWorld = nextPosition.clone();
      }
      return;
    }

    if (boxSelect && selectionBox) {
      const rect = canvas.getBoundingClientRect();
      const localX = event.clientX - rect.left;
      const localY = event.clientY - rect.top;
      const left = Math.min(boxSelect.startX, localX);
      const top = Math.min(boxSelect.startY, localY);
      const width = Math.abs(localX - boxSelect.startX);
      const height = Math.abs(localY - boxSelect.startY);
      selectionBox.style.left = left + 'px';
      selectionBox.style.top = top + 'px';
      selectionBox.style.width = width + 'px';
      selectionBox.style.height = height + 'px';
    }
  }, { signal: controller.signal });

  const endDrag = (event: PointerEvent) => {
    if (pickerState.lightPickerDragging) {
      pickerState.lightPickerDragging = false;
      renderer.setControlsEnabled(!pickerState.activeLightPicker);
      return;
    }
    if (pendingDrag && !interactionStore.isDragging) {
      renderer.setControlsEnabled(true);
    }
    if (interactionStore.isDragging) {
      interactionStore.isDragging = false;
      if (handlers.onEndDrag && interactionStore.dragAtomId) {
        handlers.onEndDrag();
      }
      interactionStore.dragAtomId = null;
      interactionStore.lastDragWorld = null;
      interactionStore.dragPlaneNormal = null;
      renderer.setControlsEnabled(true);
    }
    if (boxSelect) {
      const rect = canvas.getBoundingClientRect();
      const localX = event.clientX - rect.left;
      const localY = event.clientY - rect.top;
      const left = Math.min(boxSelect.startX, localX);
      const top = Math.min(boxSelect.startY, localY);
      const right = Math.max(boxSelect.startX, localX);
      const bottom = Math.max(boxSelect.startY, localY);
      const minW = Math.max(0, left);
      const maxW = Math.max(0, right);
      const minH = Math.max(0, top);
      const maxH = Math.max(0, bottom);
      const modeForAtoms = event.altKey ? 'subtract' : event.ctrlKey || event.metaKey ? 'add' : 'replace';
      const modeForBonds = event.altKey ? 'subtract' : event.ctrlKey || event.metaKey ? 'add' : 'replace';
      const boxMode = interactionStore.boxSelectionMode;
      const camera = renderer.getCamera();
      if (handlers.onBoxSelect && camera && (boxMode === 'atoms' || boxMode === 'both')) {
        const ids: string[] = [];
        for (const [id, mesh] of renderer.getAtomMeshes()) {
          _projected.copy(mesh.position).project(camera);
          if (_projected.z < -1 || _projected.z > 1) { continue; }
          const screenX = (_projected.x * 0.5 + 0.5) * rect.width;
          const screenY = (-_projected.y * 0.5 + 0.5) * rect.height;
          if (screenX >= minW && screenX <= maxW && screenY >= minH && screenY <= maxH) {
            ids.push(id);
          }
        }
        handlers.onBoxSelect(ids, modeForAtoms);
      }
      if (handlers.onBoxSelectBonds && camera && (boxMode === 'bonds' || boxMode === 'both')) {
        const selectedBondKeys = new Set<string>();
        const bondMeshesArr = renderer.getBondMeshes ? renderer.getBondMeshes() : [];
        for (const mesh of bondMeshesArr) {
          const bondKey = mesh.userData && (mesh.userData as Record<string, unknown>).bondKey as string | undefined;
          if (!bondKey) { continue; }
          _projected.copy(mesh.position).project(camera);
          if (_projected.z < -1 || _projected.z > 1) { continue; }
          const screenX = (_projected.x * 0.5 + 0.5) * rect.width;
          const screenY = (-_projected.y * 0.5 + 0.5) * rect.height;
          if (screenX >= minW && screenX <= maxW && screenY >= minH && screenY <= maxH) {
            selectedBondKeys.add(bondKey);
          }
        }
        handlers.onBoxSelectBonds(Array.from(selectedBondKeys), modeForBonds);
      }
      if (selectionBox) {
        selectionBox.style.display = 'none';
      }
      renderer.setControlsEnabled(true);
    }
    pendingDrag = null;
    boxSelect = null;
    isPointerDownOnEmpty = false;
  };

  canvas.addEventListener('pointerup', endDrag, { signal: controller.signal });
  canvas.addEventListener('pointerleave', endDrag, { signal: controller.signal });
  canvas.addEventListener('pointercancel', endDrag, { signal: controller.signal });

  canvas.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      if (interactionStore.addingAtomElement) {
        interactionStore.addingAtomElement = null;
        canvas.style.cursor = 'default';
        handlers.onSetStatus('');
        setTool('select', canvas, handlers);
        event.preventDefault();
        return;
      }
      if (pickerState.activeLightPicker) {
        interactionLighting.deactivatePicker(canvas, handlers.onSetStatus);
        event.preventDefault();
        return;
      }
      if (boxSelect && selectionBox) {
        selectionBox.style.display = 'none';
        boxSelect = null;
        renderer.setControlsEnabled(true);
        event.preventDefault();
        return;
      }
      if (pendingDrag) {
        pendingDrag = null;
        renderer.setControlsEnabled(true);
        event.preventDefault();
        return;
      }
      setTool('select', canvas, handlers);
      event.preventDefault();
      return;
    }

    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (handlers.onDelete) {
        handlers.onDelete();
        event.preventDefault();
      }
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
      if (handlers.onSelectAll) {
        handlers.onSelectAll();
        event.preventDefault();
      }
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'i') {
      if (handlers.onInvertSelection) {
        handlers.onInvertSelection();
        event.preventDefault();
      }
      return;
    }

    if (event.key.length === 1 && /[a-zA-Z]/.test(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const letter = event.key.toUpperCase();
      
      if (letter === 'V') {
        setTool('select', canvas, handlers);
        event.preventDefault();
        return;
      }
      if (letter === 'M') {
        setTool('move', canvas, handlers);
        event.preventDefault();
        return;
      }
      if (letter === 'B') {
        setTool('box', canvas, handlers);
        event.preventDefault();
        return;
      }
      if (letter === 'A' && !interactionStore.addingAtomElement) {
        setTool('add', canvas, handlers);
        event.preventDefault();
        return;
      }
      if (letter === 'D' && !isSingleLetterElement(letter)) {
        setTool('delete', canvas, handlers);
        event.preventDefault();
        return;
      }

      if (interactionStore.addingAtomElement) {
        if (elementInputTimeout) {
          clearTimeout(elementInputTimeout);
          elementInputTimeout = null;
        }
        const potentialTwoLetter = interactionStore.addingAtomElement + letter;
        if (isValidElement(potentialTwoLetter)) {
          interactionStore.addingAtomElement = potentialTwoLetter;
          canvas.style.cursor = 'crosshair';
          handlers.onSetStatus(`Adding ${potentialTwoLetter} atoms - Click to place, Esc to cancel`);
          event.preventDefault();
          return;
        }
        if (isSingleLetterElement(interactionStore.addingAtomElement)) {
          canvas.style.cursor = 'crosshair';
          handlers.onSetStatus(`Adding ${interactionStore.addingAtomElement} atoms - Click to place, Esc to cancel`);
          event.preventDefault();
          return;
        }
        interactionStore.addingAtomElement = null;
        canvas.style.cursor = 'default';
        handlers.onSetStatus('');
        return;
      }

      const isSingleLetter = isSingleLetterElement(letter);
      const startsTwoLetter = [...TWO_LETTER_ELEMENTS].some(e => e.startsWith(letter));

      if (isSingleLetter && startsTwoLetter) {
        interactionStore.addingAtomElement = letter;
        canvas.style.cursor = 'crosshair';
        handlers.onSetStatus(`Adding ${letter}? atoms - Type second letter or wait, Esc to cancel`);
        elementInputTimeout = setTimeout(() => {
          if (interactionStore.addingAtomElement && interactionStore.addingAtomElement.length === 1) {
            handlers.onSetStatus(`Adding ${interactionStore.addingAtomElement} atoms - Click to place, Esc to cancel`);
          }
          elementInputTimeout = null;
        }, ELEMENT_INPUT_TIMEOUT_MS);
        event.preventDefault();
        return;
      }

      if (isSingleLetter) {
        interactionStore.addingAtomElement = letter;
        canvas.style.cursor = 'crosshair';
        handlers.onSetStatus(`Adding ${letter} atoms - Click to place, Esc to cancel`);
        event.preventDefault();
        return;
      }

      if (startsTwoLetter) {
        interactionStore.addingAtomElement = letter;
        canvas.style.cursor = 'crosshair';
        handlers.onSetStatus(`Adding ${letter}? atoms - Type second letter, Esc to cancel`);
        elementInputTimeout = setTimeout(() => {
          if (interactionStore.addingAtomElement && interactionStore.addingAtomElement.length === 1) {
            interactionStore.addingAtomElement = null;
            canvas.style.cursor = 'default';
            handlers.onSetStatus('');
          }
          elementInputTimeout = null;
        }, ELEMENT_INPUT_TIMEOUT_MS);
        event.preventDefault();
        return;
      }
    }
  }, { signal: controller.signal });

  interactionLighting.init(canvas, handlers.onSetStatus);
  initDisplay();
  initConfig();

  const contextMenuHandlers: ContextMenuHandlers = {
    onDeleteAtom: handlers.onDeleteAtoms,
    onDeleteBond: handlers.onDeleteBonds,
    onChangeElement: handlers.onChangeElement,
    onCopy: handlers.onCopy,
    onPaste: handlers.onPaste,
    onSetAtomColor: handlers.onSetAtomColor,
    onSetAtomRadius: handlers.onSetAtomRadius,
    onCreateBond: handlers.onCreateBond,
    onSetBondLength: handlers.onSetBondLength,
    onCalculateBonds: handlers.onCalculateBonds,
    onClearBonds: handlers.onClearBonds,
    onAddAtom: handlers.onAddAtom,
    onUndo: handlers.onUndo,
    onRedo: handlers.onRedo,
    onSelectAll: handlers.onSelectAll,
    onClearSelection: handlers.onClearSelection,
    onSave: handlers.onSave,
    onExportImage: handlers.onExportImage,
    onSetStatus: handlers.onSetStatus,
  };
  setupContextMenu(canvas, contextMenuHandlers);
}

export function dispose(): void {
  if (elementInputTimeout) {
    clearTimeout(elementInputTimeout);
    elementInputTimeout = null;
  }
  if (controller) {
    controller.abort();
    controller = null;
  }
}
