(function () {
  const state = window.ACoordState;
  const renderer = window.ACoordRenderer;

  function init(canvas, handlers) {
    const dragLerp = 0.18;
    const dragThreshold = 4;
    const selectionBox = document.getElementById('selection-box');
    let pendingDrag = null;
    let boxSelect = null;
    canvas.tabIndex = 0;
    canvas.style.outline = 'none';

    canvas.addEventListener('pointerdown', (event) => {
      canvas.focus();
      const raycaster = renderer.getRaycaster();
      const mouse = renderer.getMouse();
      const camera = renderer.getCamera();
      const meshes = Array.from(renderer.getAtomMeshes().values());
      if (!raycaster || !mouse || !camera || meshes.length === 0) return;

      const rect = canvas.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(meshes);
      if (hits.length > 0) {
        const hit = hits[0];
        const atomId = hit.object.userData && hit.object.userData.atomId;
        if (atomId) {
          if (event.shiftKey) {
            const isSelected = state.selectedAtomIds && state.selectedAtomIds.includes(atomId);
            if (isSelected) {
              pendingDrag = {
                atomId,
                hitPoint: hit.point.clone(),
                startX: event.clientX,
                startY: event.clientY,
              };
            } else {
              const rect = canvas.getBoundingClientRect();
              const localX = event.clientX - rect.left;
              const localY = event.clientY - rect.top;
              boxSelect = {
                startX: localX,
                startY: localY,
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
      } else if (event.shiftKey) {
        const rect = canvas.getBoundingClientRect();
        const localX = event.clientX - rect.left;
        const localY = event.clientY - rect.top;
        boxSelect = {
          startX: localX,
          startY: localY,
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
    });

    canvas.addEventListener('pointermove', (event) => {
      const raycaster = renderer.getRaycaster();
      const mouse = renderer.getMouse();
      const camera = renderer.getCamera();
      if (!raycaster || !mouse || !camera) return;

      if (pendingDrag && !state.isDragging) {
        const dx = event.clientX - pendingDrag.startX;
        const dy = event.clientY - pendingDrag.startY;
        if (Math.hypot(dx, dy) > dragThreshold) {
          state.isDragging = true;
          state.dragAtomId = pendingDrag.atomId;
          state.lastDragWorld = pendingDrag.hitPoint.clone();
          renderer.setControlsEnabled(false);
          const normal = camera.getWorldDirection(new THREE.Vector3());
          state.dragPlaneNormal = normal.clone();
          renderer.getDragPlane().setFromNormalAndCoplanarPoint(normal, pendingDrag.hitPoint);
          if (handlers.onBeginDrag) {
            handlers.onBeginDrag(pendingDrag.atomId);
          }
        }
      }

      if (state.isDragging && state.dragAtomId) {
        const rect = canvas.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const intersection = new THREE.Vector3();
        const hit = raycaster.ray.intersectPlane(renderer.getDragPlane(), intersection);
        if (hit) {
          const mesh = renderer.getAtomMeshes().get(state.dragAtomId);
          let nextPosition = intersection;
          if (mesh) {
            nextPosition = mesh.position.clone().lerp(intersection, dragLerp);
          }

          const normal = state.dragPlaneNormal || camera.getWorldDirection(new THREE.Vector3());
          if (state.selectedAtomIds.length > 1) {
            const last = state.lastDragWorld || nextPosition.clone();
            const delta = nextPosition.clone().sub(last);
            const normalDelta = normal.clone().multiplyScalar(delta.dot(normal));
            delta.sub(normalDelta);
            if (delta.length() > 0) {
              for (const id of state.selectedAtomIds) {
                const selectedMesh = renderer.getAtomMeshes().get(id);
                if (selectedMesh) {
                  selectedMesh.position.add(delta);
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
            mesh.position.copy(nextPosition);
            handlers.onDragAtom(state.dragAtomId, nextPosition);
          }

          state.lastDragWorld = nextPosition.clone();
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
    });

    const endDrag = (event) => {
      if (state.isDragging) {
        state.isDragging = false;
        if (handlers.onEndDrag && state.dragAtomId) {
          handlers.onEndDrag(state.dragAtomId);
        }
        state.dragAtomId = null;
        state.lastDragWorld = null;
        state.dragPlaneNormal = null;
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
        if (handlers.onBoxSelect) {
          const ids = [];
          const minW = Math.max(0, left);
          const maxW = Math.max(0, right);
          const minH = Math.max(0, top);
          const maxH = Math.max(0, bottom);
          const camera = renderer.getCamera();
          for (const [id, mesh] of renderer.getAtomMeshes()) {
            const projected = mesh.position.clone().project(camera);
            if (projected.z < -1 || projected.z > 1) {
              continue;
            }
            const screenX = (projected.x * 0.5 + 0.5) * rect.width;
            const screenY = (-projected.y * 0.5 + 0.5) * rect.height;
            if (screenX >= minW && screenX <= maxW && screenY >= minH && screenY <= maxH) {
              ids.push(id);
            }
          }
          const mode = event.altKey ? 'subtract' : event.ctrlKey || event.metaKey ? 'add' : 'replace';
          handlers.onBoxSelect(ids, mode);
        }
        if (selectionBox) {
          selectionBox.style.display = 'none';
        }
        renderer.setControlsEnabled(true);
      }
      pendingDrag = null;
      boxSelect = null;
    };

    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointerleave', endDrag);
  }

  window.ACoordInteraction = { init };
})();
