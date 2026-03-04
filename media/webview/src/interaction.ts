import { selectionStore, interactionStore } from './state';
import { renderer } from './renderer';
import { Vector3 } from 'three';
import * as interactionLighting from './interactionLighting';
import { init as initDisplay } from './interactionDisplay';
import { init as initConfig } from './interactionConfig';

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
}

// Module-level AbortController for cleanup
let controller: AbortController | null = null;

export function init(canvas: HTMLCanvasElement, handlers: InteractionHandlers): void {
  const dragLerp = 0.18;
  const dragThreshold = 4;
  const selectionBox = document.getElementById('selection-box') as HTMLElement | null;
  let pendingDrag: { atomId: string; hitPoint: Vector3; startX: number; startY: number } | null = null;
  let boxSelect: { startX: number; startY: number; bondMode: string } | null = null;
  
  // AbortController for cleaning up all event listeners on dispose
  controller = new AbortController();
  
  canvas.tabIndex = 0;
  (canvas.style as CSSStyleDeclaration).outline = 'none';

  // Shared mutable state owned by the lighting module.
  const pickerState = interactionLighting.pickerState;

  canvas.addEventListener('pointerdown', (event: PointerEvent) => {
    canvas.focus();
    if (pickerState.activeLightPicker) {
      pickerState.lightPickerDragging = true;
      renderer.setControlsEnabled(false);
      interactionLighting.applyFromEvent(event, canvas);
      event.preventDefault();
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
        if (event.shiftKey) {
          const isSelected = selectionStore.selectedAtomIds && selectionStore.selectedAtomIds.includes(atomId);
          if (isSelected) {
            pendingDrag = {
              atomId,
              hitPoint: hit.point.clone(),
              startX: event.clientX,
              startY: event.clientY,
            };
          } else {
            const localX = event.clientX - rect.left;
            const localY = event.clientY - rect.top;
            boxSelect = {
              startX: localX,
              startY: localY,
              bondMode:
                event.altKey
                  ? 'subtract'
                  : event.ctrlKey || event.metaKey || event.shiftKey
                    ? 'add'
                    : 'replace',
            };
            renderer.setControlsEnabled(false);
            if (selectionBox) {
              selectionBox.style.display = 'block';
              selectionBox.style.left = localX + 'px';
              selectionBox.style.top = localY + 'px';
              selectionBox.style.width = '0px';
              selectionBox.style.height = '0px';
            }
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
          handlers.onSelectBond(bondKey, event.ctrlKey || event.metaKey || event.shiftKey);
          return;
        }
      }
    }

    if (event.shiftKey) {
      const localX = event.clientX - rect.left;
      const localY = event.clientY - rect.top;
      boxSelect = {
        startX: localX,
        startY: localY,
        bondMode:
          event.altKey
            ? 'subtract'
            : event.ctrlKey || event.metaKey || event.shiftKey
              ? 'add'
              : 'replace',
      };
      renderer.setControlsEnabled(false);
      if (selectionBox) {
        selectionBox.style.display = 'block';
        selectionBox.style.left = localX + 'px';
        selectionBox.style.top = localY + 'px';
        selectionBox.style.width = '0px';
        selectionBox.style.height = '0px';
      }
    } else if (handlers.onClearSelection) {
      handlers.onClearSelection();
    } else if (handlers.onSelectBond) {
      handlers.onSelectBond(null, false);
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
        const normal = camera.getWorldDirection(new Vector3());
        interactionStore.dragPlaneNormal = normal.clone();
        renderer.getDragPlane().setFromNormalAndCoplanarPoint(normal, pendingDrag.hitPoint);
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
      const intersection = new Vector3();
      const hit = raycaster.ray.intersectPlane(renderer.getDragPlane(), intersection);
      if (hit) {
        const mesh = renderer.getAtomMeshes().get(interactionStore.dragAtomId);
        let nextPosition = intersection;
        if (mesh) {
          nextPosition = mesh.position.clone().lerp(intersection, dragLerp);
        }

        const normal = interactionStore.dragPlaneNormal instanceof Vector3
          ? interactionStore.dragPlaneNormal
          : camera.getWorldDirection(new Vector3());
        if (selectionStore.selectedAtomIds.length > 1) {
          const last = interactionStore.lastDragWorld instanceof Vector3 ? interactionStore.lastDragWorld : nextPosition.clone();
          const delta = nextPosition.clone().sub(last);
          const normalDelta = normal.clone().multiplyScalar(delta.dot(normal));
          delta.sub(normalDelta);
          if (delta.length() > 0) {
            for (const id of selectionStore.selectedAtomIds) {
              const selectedMesh = renderer.getAtomMeshes().get(id);
              if (selectedMesh) {
                const newPos = selectedMesh.position.clone().add(delta);
                renderer.updateAtomPosition(id, newPos);
              }
            }
            if (handlers.onDragGroup) {
              handlers.onDragGroup(delta);
            }
          }
        } else if (mesh) {
          const delta = nextPosition.clone().sub(mesh.position);
          const normalDelta = normal.clone().multiplyScalar(delta.dot(normal));
          nextPosition.sub(normalDelta);
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
      const modeForAtoms = event.altKey ? 'subtract' : event.ctrlKey || event.metaKey ? 'add' : 'replace';
      const modeForBonds =
        boxSelect.bondMode ||
        (event.altKey ? 'subtract' : event.ctrlKey || event.metaKey || event.shiftKey ? 'add' : 'replace');
      const minW = Math.max(0, left);
      const maxW = Math.max(0, right);
      const minH = Math.max(0, top);
      const maxH = Math.max(0, bottom);
      const camera = renderer.getCamera();
      if (handlers.onBoxSelect && camera) {
        const ids: string[] = [];
        for (const [id, mesh] of renderer.getAtomMeshes()) {
          const projected = mesh.position.clone().project(camera);
          if (projected.z < -1 || projected.z > 1) { continue; }
          const screenX = (projected.x * 0.5 + 0.5) * rect.width;
          const screenY = (-projected.y * 0.5 + 0.5) * rect.height;
          if (screenX >= minW && screenX <= maxW && screenY >= minH && screenY <= maxH) {
            ids.push(id);
          }
        }
        handlers.onBoxSelect(ids, modeForAtoms);
      }
      if (handlers.onBoxSelectBonds && camera) {
        const selectedBondKeys = new Set<string>();
        const bondMeshesArr = renderer.getBondMeshes ? renderer.getBondMeshes() : [];
        for (const mesh of bondMeshesArr) {
          const bondKey = mesh.userData && (mesh.userData as Record<string, unknown>).bondKey as string | undefined;
          if (!bondKey) { continue; }
          const projected = mesh.position.clone().project(camera);
          if (projected.z < -1 || projected.z > 1) { continue; }
          const screenX = (projected.x * 0.5 + 0.5) * rect.width;
          const screenY = (-projected.y * 0.5 + 0.5) * rect.height;
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
  };

  canvas.addEventListener('pointerup', endDrag, { signal: controller.signal });
  canvas.addEventListener('pointerleave', endDrag, { signal: controller.signal });
  canvas.addEventListener('pointercancel', endDrag, { signal: controller.signal });
  canvas.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Escape' && pickerState.activeLightPicker) {
      interactionLighting.deactivatePicker(canvas, handlers.onSetStatus);
      event.preventDefault();
    }
  }, { signal: controller.signal });

  // Delegate panel initialisation to focused modules.
  interactionLighting.init(canvas, handlers.onSetStatus);
  initDisplay();
  initConfig();
}

/** Dispose of all event listeners and clean up resources */
export function dispose(): void {
  if (controller) {
    controller.abort();
    controller = null;
  }
}
