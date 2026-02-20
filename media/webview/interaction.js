(function () {
  const state = window.ACoordState;
  const renderer = window.ACoordRenderer;

  function init(canvas, handlers) {
    const dragLerp = 0.18;
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
          const preserveSelection = event.shiftKey && state.selectedAtomIds && state.selectedAtomIds.includes(atomId);
          handlers.onSelectAtom(atomId, event.ctrlKey || event.metaKey, preserveSelection);
          if (!event.shiftKey) {
            return;
          }
          state.isDragging = true;
          state.dragAtomId = atomId;
          state.lastDragWorld = hit.point.clone();
          renderer.setControlsEnabled(false);
          const normal = camera.getWorldDirection(new THREE.Vector3());
          renderer.getDragPlane().setFromNormalAndCoplanarPoint(normal, hit.point);
          if (handlers.onBeginDrag) {
            handlers.onBeginDrag(atomId);
          }
        }
      }
    });

    canvas.addEventListener('pointermove', (event) => {
      if (!state.isDragging || !state.dragAtomId) return;
      const raycaster = renderer.getRaycaster();
      const mouse = renderer.getMouse();
      const camera = renderer.getCamera();
      if (!raycaster || !mouse || !camera) return;

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

        if (state.selectedAtomIds.length > 1) {
          const last = state.lastDragWorld || nextPosition.clone();
          const delta = nextPosition.clone().sub(last);
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
          mesh.position.copy(nextPosition);
          handlers.onDragAtom(state.dragAtomId, nextPosition);
        }

        state.lastDragWorld = nextPosition.clone();
      }
    });

    const endDrag = () => {
      if (state.isDragging) {
        state.isDragging = false;
        if (handlers.onEndDrag && state.dragAtomId) {
          handlers.onEndDrag(state.dragAtomId);
        }
        state.dragAtomId = null;
        state.lastDragWorld = null;
        renderer.setControlsEnabled(true);
      }
    };

    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointerleave', endDrag);
  }

  window.ACoordInteraction = { init };
})();
