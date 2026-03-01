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
      const bondMeshes = renderer.getBondMeshes ? renderer.getBondMeshes() : [];
      if (!raycaster || !mouse || !camera) return;

      const rect = canvas.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = meshes.length > 0 ? raycaster.intersectObjects(meshes) : [];
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
          handlers.onSelectAtom(
            atomId,
            event.ctrlKey || event.metaKey,
            false
          );
          return;
        }
      }

      if (bondMeshes.length > 0) {
        const bondHits = raycaster.intersectObjects(bondMeshes);
        if (bondHits.length > 0) {
          const hit = bondHits[0];
          const bondKey = hit.object.userData && hit.object.userData.bondKey;
          if (bondKey && handlers.onSelectBond) {
            handlers.onSelectBond(bondKey, event.ctrlKey || event.metaKey || event.shiftKey);
            return;
          }
        }
      }

      if (event.shiftKey) {
        const rect = canvas.getBoundingClientRect();
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
        const modeForAtoms = event.altKey ? 'subtract' : event.ctrlKey || event.metaKey ? 'add' : 'replace';
        const modeForBonds =
          boxSelect.bondMode ||
          (event.altKey ? 'subtract' : event.ctrlKey || event.metaKey || event.shiftKey ? 'add' : 'replace');
        const minW = Math.max(0, left);
        const maxW = Math.max(0, right);
        const minH = Math.max(0, top);
        const maxH = Math.max(0, bottom);
        const camera = renderer.getCamera();
        if (handlers.onBoxSelect) {
          const ids = [];
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
          handlers.onBoxSelect(ids, modeForAtoms);
        }
        if (handlers.onBoxSelectBonds) {
          const selectedBondKeys = new Set();
          const bondMeshes = renderer.getBondMeshes ? renderer.getBondMeshes() : [];
          for (const mesh of bondMeshes) {
            const bondKey = mesh.userData && mesh.userData.bondKey;
            if (!bondKey) {
              continue;
            }
            const projected = mesh.position.clone().project(camera);
            if (projected.z < -1 || projected.z > 1) {
              continue;
            }
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

    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointerleave', endDrag);

    // Lighting panel event handlers
    function initLightingPanel() {
      // Lighting enabled checkbox
      const lightingEnabled = document.getElementById('lighting-enabled');
      if (lightingEnabled) {
        lightingEnabled.addEventListener('change', () => {
          state.lightingEnabled = lightingEnabled.checked;
          if (window.ACoordRenderer && window.ACoordRenderer.updateLighting) {
            window.ACoordRenderer.updateLighting();
          }
        });
      }

      // Ambient intensity
      const ambientSlider = document.getElementById('ambient-slider');
      const ambientValue = document.getElementById('ambient-value');
      if (ambientSlider) {
        ambientSlider.addEventListener('input', () => {
          state.ambientIntensity = parseFloat(ambientSlider.value);
          if (ambientValue) ambientValue.textContent = state.ambientIntensity.toFixed(1);
          if (window.ACoordRenderer && window.ACoordRenderer.updateLighting) {
            window.ACoordRenderer.updateLighting();
          }
        });
      }

      // Key Light
      setupLightSliders('key', state.keyLight);
      // Fill Light
      setupLightSliders('fill', state.fillLight);
      // Rim Light
      setupLightSliders('rim', state.rimLight);

      // Reset lighting button
      const btnResetLighting = document.getElementById('btn-reset-lighting');
      if (btnResetLighting) {
        btnResetLighting.addEventListener('click', () => {
          state.keyLight = { intensity: 0.8, x: 10, y: 10, z: 10 };
          state.fillLight = { intensity: 0, x: -10, y: -5, z: 5 };
          state.rimLight = { intensity: 0, x: 0, y: 5, z: -10 };
          state.ambientIntensity = 0.5;
          state.lightingEnabled = true;

          // Update UI
          if (lightingEnabled) lightingEnabled.checked = true;
          if (ambientSlider) ambientSlider.value = '0.5';
          if (ambientValue) ambientValue.textContent = '0.5';

          updateLightSliderUI('key', { intensity: 0.8, x: 10, y: 10, z: 10 });
          updateLightSliderUI('fill', { intensity: 0, x: -10, y: -5, z: 5 });
          updateLightSliderUI('rim', { intensity: 0, x: 0, y: 5, z: -10 });

          if (window.ACoordRenderer && window.ACoordRenderer.updateLighting) {
            window.ACoordRenderer.updateLighting();
          }
        });
      }
    }

    function setupLightSliders(prefix, lightObj) {
      const intensitySlider = document.getElementById(`${prefix}-intensity-slider`);
      const intensityValue = document.getElementById(`${prefix}-intensity-value`);
      const xSlider = document.getElementById(`${prefix}-x-slider`);
      const xValue = document.getElementById(`${prefix}-x-value`);
      const ySlider = document.getElementById(`${prefix}-y-slider`);
      const yValue = document.getElementById(`${prefix}-y-value`);
      const zSlider = document.getElementById(`${prefix}-z-slider`);
      const zValue = document.getElementById(`${prefix}-z-value`);

      if (intensitySlider) {
        intensitySlider.addEventListener('input', () => {
          lightObj.intensity = parseFloat(intensitySlider.value);
          if (intensityValue) intensityValue.textContent = lightObj.intensity.toFixed(1);
          if (window.ACoordRenderer && window.ACoordRenderer.updateLighting) {
            window.ACoordRenderer.updateLighting();
          }
        });
      }
      if (xSlider) {
        xSlider.addEventListener('input', () => {
          lightObj.x = parseInt(xSlider.value);
          if (xValue) xValue.textContent = lightObj.x;
          if (window.ACoordRenderer && window.ACoordRenderer.updateLighting) {
            window.ACoordRenderer.updateLighting();
          }
        });
      }
      if (ySlider) {
        ySlider.addEventListener('input', () => {
          lightObj.y = parseInt(ySlider.value);
          if (yValue) yValue.textContent = lightObj.y;
          if (window.ACoordRenderer && window.ACoordRenderer.updateLighting) {
            window.ACoordRenderer.updateLighting();
          }
        });
      }
      if (zSlider) {
        zSlider.addEventListener('input', () => {
          lightObj.z = parseInt(zSlider.value);
          if (zValue) zValue.textContent = lightObj.z;
          if (window.ACoordRenderer && window.ACoordRenderer.updateLighting) {
            window.ACoordRenderer.updateLighting();
          }
        });
      }
    }

    function updateLightSliderUI(prefix, lightObj) {
      const intensitySlider = document.getElementById(`${prefix}-intensity-slider`);
      const intensityValue = document.getElementById(`${prefix}-intensity-value`);
      const xSlider = document.getElementById(`${prefix}-x-slider`);
      const xValue = document.getElementById(`${prefix}-x-value`);
      const ySlider = document.getElementById(`${prefix}-y-slider`);
      const yValue = document.getElementById(`${prefix}-y-value`);
      const zSlider = document.getElementById(`${prefix}-z-slider`);
      const zValue = document.getElementById(`${prefix}-z-value`);

      if (intensitySlider) intensitySlider.value = lightObj.intensity;
      if (intensityValue) intensityValue.textContent = lightObj.intensity.toFixed(1);
      if (xSlider) xSlider.value = lightObj.x;
      if (xValue) xValue.textContent = lightObj.x;
      if (ySlider) ySlider.value = lightObj.y;
      if (yValue) yValue.textContent = lightObj.y;
      if (zSlider) zSlider.value = lightObj.z;
      if (zValue) zValue.textContent = lightObj.z;
    }

    // Initialize lighting panel
    initLightingPanel();

    // Initialize display settings panel
    initDisplaySettingsPanel();
  }

  function initDisplaySettingsPanel() {
    const bgColorPicker = document.getElementById('bg-color-picker');
    const bgColorText = document.getElementById('bg-color-text');
    const latticeColorPicker = document.getElementById('lattice-color-picker');
    const latticeColorText = document.getElementById('lattice-color-text');
    const latticeThicknessSlider = document.getElementById('lattice-thickness-slider');
    const latticeThicknessValue = document.getElementById('lattice-thickness-value');
    const latticeLineStyle = document.getElementById('lattice-line-style');

    const rerenderStructure = () => {
      if (!state.currentStructure || !window.ACoordRenderer || !window.ACoordRenderer.renderStructure) {
        return;
      }
      window.ACoordRenderer.renderStructure(state.currentStructure);
    };

    // Background color
    if (bgColorPicker && bgColorText) {
      bgColorPicker.addEventListener('input', () => {
        state.backgroundColor = bgColorPicker.value;
        bgColorText.value = bgColorPicker.value;
        if (window.ACoordRenderer && window.ACoordRenderer.updateDisplaySettings) {
          window.ACoordRenderer.updateDisplaySettings();
        }
      });

      bgColorText.addEventListener('change', () => {
        const color = bgColorText.value.trim();
        if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
          state.backgroundColor = color;
          bgColorPicker.value = color;
          if (window.ACoordRenderer && window.ACoordRenderer.updateDisplaySettings) {
            window.ACoordRenderer.updateDisplaySettings();
          }
        }
      });
    }

    // Unit cell color
    if (latticeColorPicker && latticeColorText) {
      latticeColorPicker.addEventListener('input', () => {
        state.unitCellColor = latticeColorPicker.value;
        latticeColorText.value = latticeColorPicker.value;
        if (window.ACoordRenderer && window.ACoordRenderer.updateDisplaySettings) {
          window.ACoordRenderer.updateDisplaySettings();
        }
      });

      latticeColorText.addEventListener('change', () => {
        const color = latticeColorText.value.trim();
        if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
          state.unitCellColor = color;
          latticeColorPicker.value = color;
          if (window.ACoordRenderer && window.ACoordRenderer.updateDisplaySettings) {
            window.ACoordRenderer.updateDisplaySettings();
          }
        }
      });
    }

    if (latticeThicknessSlider) {
      const initialThickness = Number.isFinite(state.unitCellThickness)
        ? state.unitCellThickness
        : 1;
      latticeThicknessSlider.value = String(initialThickness);
      if (latticeThicknessValue) {
        latticeThicknessValue.textContent = initialThickness.toFixed(1);
      }
      latticeThicknessSlider.addEventListener('input', () => {
        const nextThickness = Math.max(0.5, Math.min(6, parseFloat(latticeThicknessSlider.value) || 1));
        state.unitCellThickness = nextThickness;
        if (latticeThicknessValue) {
          latticeThicknessValue.textContent = nextThickness.toFixed(1);
        }
        rerenderStructure();
      });
    }

    if (latticeLineStyle) {
      latticeLineStyle.value = state.unitCellLineStyle === 'dashed' ? 'dashed' : 'solid';
      latticeLineStyle.addEventListener('change', () => {
        state.unitCellLineStyle = latticeLineStyle.value === 'dashed' ? 'dashed' : 'solid';
        rerenderStructure();
      });
    }
  }

  window.ACoordInteraction = { init };
})();
