(function () {
  const state = window.ACoordState;

  const rendererState = {
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    atomMeshes: new Map(),
    bondMeshes: [],
    bondLines: [],
    unitCellGroup: null,
    raycaster: null,
    mouse: null,
    dragPlane: null,
    lastScale: 1,
    lastSizeScale: 1,
    extraMeshes: [],
    projectionMode: 'perspective',
    orthoSize: 30,
    setError: () => {},
    setStatus: () => {},
    // Lights
    ambientLight: null,
    keyLight: null,
    fillLight: null,
    rimLight: null,
  };

  function getOrthoFrustum(width, height) {
    const aspect = width / height;
    const viewSize = Math.max(1, rendererState.orthoSize || 30);
    const halfHeight = viewSize / 2;
    const halfWidth = halfHeight * aspect;
    return {
      left: -halfWidth,
      right: halfWidth,
      top: halfHeight,
      bottom: -halfHeight,
    };
  }

  function createCamera(mode, width, height) {
    if (mode === 'orthographic') {
      const frustum = getOrthoFrustum(width, height);
      const camera = new THREE.OrthographicCamera(
        frustum.left,
        frustum.right,
        frustum.top,
        frustum.bottom,
        0.1,
        10000
      );
      camera.zoom = state.viewZoom || 1;
      camera.updateProjectionMatrix();
      return camera;
    }

    return new THREE.PerspectiveCamera(75, width / height, 0.1, 10000);
  }

  function applyControls(camera) {
    if (rendererState.controls && rendererState.controls.dispose) {
      rendererState.controls.dispose();
    }
    if (THREE.OrbitControls) {
      rendererState.controls = new THREE.OrbitControls(camera, rendererState.renderer.domElement);
      rendererState.controls.enableDamping = true;
      rendererState.controls.dampingFactor = 0.05;
    } else {
      rendererState.controls = { update: () => {} };
      rendererState.setError('OrbitControls not available. Rendering should still work.');
    }
  }

  function init(canvas, handlers) {
    if (!window.THREE) {
      handlers.setError('Three.js failed to load. Please run npm install and reload the editor.');
      return;
    }

    rendererState.setError = handlers.setError;
    rendererState.setStatus = handlers.setStatus;

    const container = document.getElementById('container');
    const rect = container.getBoundingClientRect();
    const width = Math.max(1, rect.width - 250);
    const height = Math.max(1, rect.height);
    handlers.setStatus('Canvas size: ' + Math.round(width) + 'x' + Math.round(height));

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(state.backgroundColor || '#0d1015');
    rendererState.scene = scene;

    rendererState.projectionMode = state.projectionMode || 'perspective';
    const camera = createCamera(rendererState.projectionMode, width, height);
    camera.position.z = 20;
    rendererState.camera = camera;

    try {
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setClearColor(0x222222, 1);
      rendererState.renderer = renderer;
    } catch (error) {
      handlers.setError('WebGL renderer failed to initialize. Check GPU/WebGL support.');
      return;
    }

    const gl = rendererState.renderer.getContext();
    if (!gl) {
      handlers.setError('WebGL context unavailable. Your system or VS Code may have WebGL disabled.');
      return;
    }

    // Three-point lighting setup
    rendererState.ambientLight = new THREE.AmbientLight(0xffffff, state.ambientIntensity || 0.5);
    scene.add(rendererState.ambientLight);

    // Key light (main light source)
    rendererState.keyLight = new THREE.DirectionalLight(0xffffff, state.keyLight?.intensity || 0.8);
    scene.add(rendererState.keyLight);

    // Fill light (softens shadows)
    rendererState.fillLight = new THREE.DirectionalLight(0xffffff, state.fillLight?.intensity || 0);
    scene.add(rendererState.fillLight);

    // Rim light (creates edge highlight)
    rendererState.rimLight = new THREE.DirectionalLight(0xffffff, state.rimLight?.intensity || 0);
    scene.add(rendererState.rimLight);

    // Initialize light positions using the same function as animation loop
    updateLightsForCamera();

    scene.add(new THREE.AxesHelper(5));

    applyControls(camera);

    camera.lookAt(0, 0, 0);
    rendererState.raycaster = new THREE.Raycaster();
    rendererState.mouse = new THREE.Vector2();
    rendererState.dragPlane = new THREE.Plane();

    window.addEventListener('resize', onResize);
    onResize();
    requestAnimationFrame(() => onResize());
    setTimeout(() => onResize(), 150);
    animate();

    setInterval(() => {
      const calls = rendererState.renderer ? rendererState.renderer.info.render.calls : 0;
      handlers.setStatus('Render OK. Draw calls: ' + calls + ' | Atoms: ' + rendererState.atomMeshes.size);
    }, 1000);
  }

  function animate() {
    requestAnimationFrame(animate);
    if (!rendererState.renderer || !rendererState.controls) return;
    rendererState.controls.update();
    updateLightsForCamera();
    rendererState.renderer.render(rendererState.scene, rendererState.camera);
  }

  function updateLightsForCamera() {
    if (!rendererState.camera || !rendererState.keyLight ||
        !rendererState.fillLight || !rendererState.rimLight) {
      return;
    }

    const camera = rendererState.camera;

    // Get base offset directions from state (these define light directions relative to camera)
    const keyOffset = new THREE.Vector3(state.keyLight?.x || 10, state.keyLight?.y || 10, state.keyLight?.z || 10);
    const fillOffset = new THREE.Vector3(state.fillLight?.x || -10, state.fillLight?.y || -5, state.fillLight?.z || 5);
    const rimOffset = new THREE.Vector3(state.rimLight?.x || 0, state.rimLight?.y || 5, state.rimLight?.z || -10);

    // Apply camera rotation to get world-space directions
    keyOffset.applyQuaternion(camera.quaternion);
    fillOffset.applyQuaternion(camera.quaternion);
    rimOffset.applyQuaternion(camera.quaternion);

    // Set light positions: place lights far away in the direction they should shine FROM
    // DirectionalLight shines toward its target (default is scene origin)
    const distance = 50;
    rendererState.keyLight.position.copy(keyOffset.normalize().multiplyScalar(distance));
    rendererState.fillLight.position.copy(fillOffset.normalize().multiplyScalar(distance));
    rendererState.rimLight.position.copy(rimOffset.normalize().multiplyScalar(distance));
  }

  function onResize() {
    if (!rendererState.renderer || !rendererState.camera) return;
    const container = document.getElementById('container');
    const rect = container.getBoundingClientRect();
    const width = Math.max(1, rect.width - 250);
    const height = Math.max(1, rect.height);
    if (rendererState.camera.isOrthographicCamera) {
      const frustum = getOrthoFrustum(width, height);
      rendererState.camera.left = frustum.left;
      rendererState.camera.right = frustum.right;
      rendererState.camera.top = frustum.top;
      rendererState.camera.bottom = frustum.bottom;
      rendererState.camera.zoom = state.viewZoom || 1;
    } else {
      rendererState.camera.aspect = width / height;
    }
    rendererState.camera.updateProjectionMatrix();
    rendererState.renderer.setSize(width, height);
  }

  function getAutoScales(atoms) {
    if (!atoms || atoms.length === 0) return { scale: 1, sizeScale: 1 };
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (const atom of atoms) {
      const x = atom.position[0];
      const y = atom.position[1];
      const z = atom.position[2];
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      minZ = Math.min(minZ, z);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      maxZ = Math.max(maxZ, z);
    }
    const sizeX = maxX - minX;
    const sizeY = maxY - minY;
    const sizeZ = maxZ - minZ;
    const maxDim = Math.max(sizeX, sizeY, sizeZ);
    if (!Number.isFinite(maxDim) || maxDim <= 0) return { scale: 1, sizeScale: 1 };

    const target = 30;
    const scale = Math.min(Math.max(target / maxDim, 0.05), 5);
    const sizeScale = Math.min(Math.max(10 / Math.sqrt(maxDim), 1.5), 6);

    return { scale, sizeScale };
  }

  function disposeMaterial(material) {
    if (!material) {
      return;
    }
    if (Array.isArray(material)) {
      for (const item of material) {
        if (item && item.dispose) {
          item.dispose();
        }
      }
      return;
    }
    if (material.dispose) {
      material.dispose();
    }
  }

  function disposeObject3D(object) {
    if (!object) {
      return;
    }
    object.traverse((node) => {
      if (node.geometry && node.geometry.dispose) {
        node.geometry.dispose();
      }
      disposeMaterial(node.material);
    });
  }

  function createUnitCellEdgeMesh(start, end, radius, color) {
    const direction = end.clone().sub(start);
    const length = direction.length();
    if (length <= 1e-6) {
      return null;
    }
    const geometry = new THREE.CylinderGeometry(radius, radius, length, 12);
    const material = new THREE.MeshBasicMaterial({ color });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(start).add(end).multiplyScalar(0.5);
    const up = new THREE.Vector3(0, 1, 0);
    mesh.quaternion.setFromUnitVectors(up, direction.clone().normalize());
    return mesh;
  }

  function buildUnitCellGroup(edges, scale) {
    if (!Array.isArray(edges) || edges.length === 0) {
      return null;
    }

    const color = state.unitCellColor || '#FF6600';
    const thickness = Number.isFinite(state.unitCellThickness)
      ? Math.max(0.5, Math.min(6, state.unitCellThickness))
      : 1;
    const style = state.unitCellLineStyle === 'dashed' ? 'dashed' : 'solid';
    const radius = Math.max(0.01, thickness * 0.03);
    const dashLength = 0.45;
    const gapLength = 0.28;
    const group = new THREE.Group();

    for (const edge of edges) {
      const start = new THREE.Vector3(
        edge.start[0] * scale,
        edge.start[1] * scale,
        edge.start[2] * scale
      );
      const end = new THREE.Vector3(
        edge.end[0] * scale,
        edge.end[1] * scale,
        edge.end[2] * scale
      );
      const direction = end.clone().sub(start);
      const edgeLength = direction.length();
      if (edgeLength <= 1e-6) {
        continue;
      }

      if (style === 'solid') {
        const solidMesh = createUnitCellEdgeMesh(start, end, radius, color);
        if (solidMesh) {
          group.add(solidMesh);
        }
        continue;
      }

      const edgeDirection = direction.clone().normalize();
      let cursor = 0;
      while (cursor < edgeLength) {
        const segmentStartDistance = cursor;
        const segmentEndDistance = Math.min(edgeLength, cursor + dashLength);
        if (segmentEndDistance > segmentStartDistance + 1e-4) {
          const segmentStart = start.clone().addScaledVector(edgeDirection, segmentStartDistance);
          const segmentEnd = start.clone().addScaledVector(edgeDirection, segmentEndDistance);
          const dashMesh = createUnitCellEdgeMesh(segmentStart, segmentEnd, radius, color);
          if (dashMesh) {
            group.add(dashMesh);
          }
        }
        cursor += dashLength + gapLength;
      }
    }

    return group.children.length > 0 ? group : null;
  }

  function renderStructure(data, uiHooks, options) {
    state.currentStructure = data;
    let scale = state.manualScale;
    let sizeScale = state.atomSizeScale;
    if (state.autoScaleEnabled) {
      const auto = getAutoScales(data.atoms || []);
      scale = auto.scale;
      sizeScale = auto.sizeScale;
    }
    rendererState.lastScale = scale;
    rendererState.lastSizeScale = sizeScale;

    for (const mesh of rendererState.atomMeshes.values()) {
      rendererState.scene.remove(mesh);
      disposeObject3D(mesh);
    }
    rendererState.atomMeshes.clear();

    for (const mesh of rendererState.extraMeshes) {
      rendererState.scene.remove(mesh);
      disposeObject3D(mesh);
    }
    rendererState.extraMeshes = [];

    for (const line of rendererState.bondLines) {
      rendererState.scene.remove(line);
      disposeObject3D(line);
    }
    rendererState.bondLines = [];
    rendererState.bondMeshes = [];

    if (rendererState.unitCellGroup) {
      rendererState.scene.remove(rendererState.unitCellGroup);
      disposeObject3D(rendererState.unitCellGroup);
      rendererState.unitCellGroup = null;
    }

    const selectedSet = new Set(data.selectedAtomIds || []);
    const renderAtoms = data.renderAtoms || data.atoms;
    const renderBonds = data.renderBonds || data.bonds;

    if (renderAtoms) {
      for (const atom of renderAtoms) {
        if (!Number.isFinite(atom.position[0]) || !Number.isFinite(atom.position[1]) || !Number.isFinite(atom.position[2])) {
          continue;
        }
        const selectable = atom.selectable !== false;
        const isSelected = selectable && (!!atom.selected || selectedSet.has(atom.id));
        const sphereRadius = Math.max(atom.radius * sizeScale, 0.12) * (isSelected ? 1.12 : 1);
        const geometry = new THREE.SphereGeometry(sphereRadius, 32, 32);
        const material = new THREE.MeshPhongMaterial({
          color: new THREE.Color(isSelected ? '#f6d55c' : atom.color),
          specular: new THREE.Color(0x333333),
          shininess: 30,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(
          atom.position[0] * scale,
          atom.position[1] * scale,
          atom.position[2] * scale
        );
        rendererState.scene.add(mesh);
        if (selectable) {
          mesh.userData = { atomId: atom.id };
          rendererState.atomMeshes.set(atom.id, mesh);
        } else {
          rendererState.extraMeshes.push(mesh);
        }
      }
    }

    if (renderBonds) {
      for (const bond of renderBonds) {
        const isSelectedBond = !!bond.selected;
        const highlightBond =
          isSelectedBond ||
          bond.atomId1 &&
          bond.atomId2 &&
          selectedSet.has(bond.atomId1) &&
          selectedSet.has(bond.atomId2);
        const start = new THREE.Vector3(
          bond.start[0] * scale,
          bond.start[1] * scale,
          bond.start[2] * scale
        );
        const end = new THREE.Vector3(
          bond.end[0] * scale,
          bond.end[1] * scale,
          bond.end[2] * scale
        );
        const direction = end.clone().sub(start);
        const length = direction.length();
        const bondThicknessScale = Number.isFinite(state.bondThicknessScale) ? state.bondThicknessScale : 1;
        const bondRadius = Math.max(bond.radius * sizeScale * bondThicknessScale, 0.03) * (highlightBond ? 1.35 : 1);

        // Create half-bonds with two colors
        const midpoint = start.clone().add(end).multiplyScalar(0.5);
        const directionNormalized = direction.clone().normalize();

        // First half (from start to midpoint) - color1
        const halfLength1 = length / 2;
        const geometry1 = new THREE.CylinderGeometry(bondRadius, bondRadius, halfLength1, 8);
        const material1 = new THREE.MeshPhongMaterial({
          color: new THREE.Color(bond.color1 || bond.color),
          specular: new THREE.Color(0x333333),
          emissive: new THREE.Color(isSelectedBond ? '#704214' : '#000000'),
          shininess: 30,
        });
        const cylinder1 = new THREE.Mesh(geometry1, material1);
        const midPoint1 = start.clone().add(midpoint).multiplyScalar(0.5);
        cylinder1.position.copy(midPoint1);
        if (directionNormalized.length() > 0.0001) {
          const axis = new THREE.Vector3(0, 1, 0);
          const rotationAxis = axis.clone().cross(directionNormalized);
          if (rotationAxis.length() > 0.0001) {
            const angle = Math.acos(axis.dot(directionNormalized));
            cylinder1.setRotationFromAxisAngle(rotationAxis.normalize(), angle);
          }
        }
        if (bond.key) {
          cylinder1.userData = { bondKey: bond.key };
          rendererState.bondMeshes.push(cylinder1);
        }
        rendererState.scene.add(cylinder1);
        rendererState.bondLines.push(cylinder1);

        // Second half (from midpoint to end) - color2
        const halfLength2 = length / 2;
        const geometry2 = new THREE.CylinderGeometry(bondRadius, bondRadius, halfLength2, 8);
        const material2 = new THREE.MeshPhongMaterial({
          color: new THREE.Color(bond.color2 || bond.color),
          specular: new THREE.Color(0x333333),
          emissive: new THREE.Color(isSelectedBond ? '#704214' : '#000000'),
          shininess: 30,
        });
        const cylinder2 = new THREE.Mesh(geometry2, material2);
        const midPoint2 = midpoint.clone().add(end).multiplyScalar(0.5);
        cylinder2.position.copy(midPoint2);
        if (directionNormalized.length() > 0.0001) {
          const axis = new THREE.Vector3(0, 1, 0);
          const rotationAxis = axis.clone().cross(directionNormalized);
          if (rotationAxis.length() > 0.0001) {
            const angle = Math.acos(axis.dot(directionNormalized));
            cylinder2.setRotationFromAxisAngle(rotationAxis.normalize(), angle);
          }
        }
        if (bond.key) {
          cylinder2.userData = { bondKey: bond.key };
          rendererState.bondMeshes.push(cylinder2);
        }
        rendererState.scene.add(cylinder2);
        rendererState.bondLines.push(cylinder2);
      }
    }

    if (data.unitCell && data.unitCell.edges && data.unitCell.edges.length > 0) {
      const unitCellGroup = buildUnitCellGroup(data.unitCell.edges, scale);
      if (unitCellGroup) {
        rendererState.scene.add(unitCellGroup);
        rendererState.unitCellGroup = unitCellGroup;
      }
    }

    if (uiHooks) {
      uiHooks.updateCounts(data.atoms.length, data.bonds ? data.bonds.length : 0);
      uiHooks.updateAtomList(data.atoms, data.selectedAtomIds || [], data.selectedAtomId);
    }

    if (options && options.fitCamera) {
      fitCamera();
    }
  }

  function fitCamera() {
    if (rendererState.atomMeshes.size === 0) return;
    const box = new THREE.Box3();
    for (const mesh of rendererState.atomMeshes.values()) {
      box.expandByObject(mesh);
    }
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const center = box.getCenter(new THREE.Vector3());

    if (rendererState.camera.isOrthographicCamera) {
      const targetSize = Math.max(maxDim * 1.2, 1);
      rendererState.orthoSize = targetSize / (state.viewZoom || 1);
      const cameraDistance = Math.max(targetSize * 2, 20);
      rendererState.camera.position.set(center.x, center.y, center.z + cameraDistance);
      rendererState.camera.near = Math.max(0.1, cameraDistance / 100);
      rendererState.camera.far = Math.max(1000, cameraDistance * 10);
      onResize();
    } else {
      const fov = rendererState.camera.fov * (Math.PI / 180);
      const cameraDistance = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 0.6 / state.viewZoom;
      rendererState.camera.position.set(center.x, center.y, center.z + cameraDistance * 1.2);
      rendererState.camera.near = Math.max(0.1, cameraDistance / 100);
      rendererState.camera.far = Math.max(1000, cameraDistance * 10);
      rendererState.camera.updateProjectionMatrix();
    }
    if (rendererState.controls && rendererState.controls.target) {
      rendererState.controls.target.copy(center);
    }
    rendererState.controls.update();
  }

  function setProjectionMode(mode) {
    const nextMode = mode === 'orthographic' ? 'orthographic' : 'perspective';
    if (rendererState.projectionMode === nextMode) return;
    if (!rendererState.renderer || !rendererState.camera) return;

    const container = document.getElementById('container');
    const rect = container.getBoundingClientRect();
    const width = Math.max(1, rect.width - 250);
    const height = Math.max(1, rect.height);

    const oldCamera = rendererState.camera;
    const previousTarget =
      rendererState.controls && rendererState.controls.target
        ? rendererState.controls.target.clone()
        : null;
    const newCamera = createCamera(nextMode, width, height);
    newCamera.position.copy(oldCamera.position);
    newCamera.up.copy(oldCamera.up);
    newCamera.quaternion.copy(oldCamera.quaternion);
    newCamera.near = oldCamera.near;
    newCamera.far = oldCamera.far;

    rendererState.camera = newCamera;
    rendererState.projectionMode = nextMode;
    applyControls(newCamera);
    if (rendererState.controls && rendererState.controls.target && previousTarget) {
      rendererState.controls.target.copy(previousTarget);
      newCamera.lookAt(previousTarget);
    }
    onResize();
  }

  function getRaycaster() {
    return rendererState.raycaster;
  }

  function getMouse() {
    return rendererState.mouse;
  }

  function getCamera() {
    return rendererState.camera;
  }

  function getAtomMeshes() {
    return rendererState.atomMeshes;
  }

  function getBondMeshes() {
    return rendererState.bondMeshes;
  }

  function getDragPlane() {
    return rendererState.dragPlane;
  }

  function setControlsEnabled(enabled) {
    if (rendererState.controls && rendererState.controls.enabled !== undefined) {
      rendererState.controls.enabled = enabled;
    }
  }

  function getScale() {
    return rendererState.lastScale || 1;
  }

  function updateLighting() {
    if (!rendererState.ambientLight || !rendererState.keyLight || 
        !rendererState.fillLight || !rendererState.rimLight || !rendererState.camera) {
      return;
    }

    const enabled = state.lightingEnabled !== false;
    
    rendererState.ambientLight.intensity = enabled ? (state.ambientIntensity || 0.5) : 0;
    rendererState.keyLight.intensity = enabled ? (state.keyLight?.intensity || 0.8) : 0;
    rendererState.fillLight.intensity = enabled ? (state.fillLight?.intensity || 0) : 0;
    rendererState.rimLight.intensity = enabled ? (state.rimLight?.intensity || 0) : 0;

    // Also update positions
    updateLightsForCamera();
  }

  function updateDisplaySettings() {
    // Update background color
    if (rendererState.scene && state.backgroundColor) {
      rendererState.scene.background = new THREE.Color(state.backgroundColor);
    }
    
    // Update unit cell color
    if (rendererState.unitCellGroup && state.unitCellColor) {
      const nextColor = new THREE.Color(state.unitCellColor);
      rendererState.unitCellGroup.traverse((node) => {
        if (!node.material) {
          return;
        }
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        for (const material of materials) {
          if (material && material.color) {
            material.color.set(nextColor);
          }
        }
      });
    }
  }

  function exportHighResolutionImage(options) {
    if (!rendererState.renderer || !rendererState.camera || !rendererState.scene) {
      return null;
    }

    const renderer = rendererState.renderer;
    const camera = rendererState.camera;
    const scene = rendererState.scene;
    const requestedScale =
      options && Number.isFinite(Number(options.scale)) ? Number(options.scale) : 4;
    const scale = Math.max(1, requestedScale);

    const originalSize = renderer.getSize(new THREE.Vector2());
    const originalWidth = Math.max(1, Math.round(originalSize.x));
    const originalHeight = Math.max(1, Math.round(originalSize.y));
    const originalPixelRatio = renderer.getPixelRatio();
    const perspectiveAspect = camera.isPerspectiveCamera ? camera.aspect : null;
    const orthoFrustum = camera.isOrthographicCamera
      ? {
        left: camera.left,
        right: camera.right,
        top: camera.top,
        bottom: camera.bottom,
        zoom: camera.zoom,
      }
      : null;

    const maxTextureSize = renderer.capabilities?.maxTextureSize || 8192;
    const targetWidthRaw = Math.max(1, Math.round(originalWidth * scale));
    const targetHeightRaw = Math.max(1, Math.round(originalHeight * scale));
    const maxTarget = Math.max(targetWidthRaw, targetHeightRaw);
    const limitScale = maxTarget > maxTextureSize ? maxTextureSize / maxTarget : 1;
    const targetWidth = Math.max(1, Math.floor(targetWidthRaw * limitScale));
    const targetHeight = Math.max(1, Math.floor(targetHeightRaw * limitScale));

    try {
      renderer.setPixelRatio(1);
      renderer.setSize(targetWidth, targetHeight, false);
      if (camera.isPerspectiveCamera) {
        camera.aspect = targetWidth / targetHeight;
      } else if (camera.isOrthographicCamera) {
        const frustum = getOrthoFrustum(targetWidth, targetHeight);
        camera.left = frustum.left;
        camera.right = frustum.right;
        camera.top = frustum.top;
        camera.bottom = frustum.bottom;
        camera.zoom = state.viewZoom || 1;
      }
      camera.updateProjectionMatrix();
      updateLightsForCamera();
      renderer.render(scene, camera);

      return {
        dataUrl: renderer.domElement.toDataURL('image/png'),
        width: targetWidth,
        height: targetHeight,
      };
    } finally {
      renderer.setPixelRatio(originalPixelRatio);
      renderer.setSize(originalWidth, originalHeight, false);
      if (camera.isPerspectiveCamera && perspectiveAspect) {
        camera.aspect = perspectiveAspect;
      } else if (camera.isOrthographicCamera && orthoFrustum) {
        camera.left = orthoFrustum.left;
        camera.right = orthoFrustum.right;
        camera.top = orthoFrustum.top;
        camera.bottom = orthoFrustum.bottom;
        camera.zoom = orthoFrustum.zoom;
      }
      camera.updateProjectionMatrix();
      updateLightsForCamera();
      renderer.render(scene, camera);
    }
  }

  window.ACoordRenderer = {
    init,
    renderStructure,
    fitCamera,
    setProjectionMode,
    getScale,
    getRaycaster,
    getMouse,
    getCamera,
    getAtomMeshes,
    getBondMeshes,
    getDragPlane,
    setControlsEnabled,
    updateLighting,
    updateDisplaySettings,
    exportHighResolutionImage,
  };
})();
