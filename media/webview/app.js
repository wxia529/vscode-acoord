(function () {
  const vscode = acquireVsCodeApi();
  const state = window.ACoordState;
  const renderer = window.ACoordRenderer;
  const interaction = window.ACoordInteraction;
  let renderStatus = 'Ready.';
  let statusSelectionLock = false;
  let lastStatusSelectedId = null;

  function setError(message) {
    const banner = document.getElementById('error-banner');
    banner.textContent = message || '';
    banner.style.display = message ? 'block' : 'none';
  }

  function setStatus(message) {
    renderStatus = message || 'Ready.';
    updateStatusBar();
  }

  function updateStatusBar(force) {
    const statusEl = document.getElementById('status-text');
    if (!statusEl) return;
    const selected = state.currentSelectedAtom;
    const selectedId = selected ? selected.id : null;
    if (!force && statusSelectionLock && selectedId === lastStatusSelectedId) {
      return;
    }
    if (!selected) {
      statusEl.textContent = renderStatus;
      lastStatusSelectedId = null;
      return;
    }

    const cart = selected.position || [0, 0, 0];
    const cartText = `Cart: ${cart[0].toFixed(4)}, ${cart[1].toFixed(4)}, ${cart[2].toFixed(4)}`;
    const frac = getFractionalCoords(cart, state.currentStructure && state.currentStructure.unitCellParams);
    const fracText = frac
      ? ` | Frac: ${frac[0].toFixed(4)}, ${frac[1].toFixed(4)}, ${frac[2].toFixed(4)}`
      : '';
    statusEl.textContent = `${renderStatus} | Selected: ${selected.element} | ${cartText}${fracText}`;
    lastStatusSelectedId = selectedId;
  }

  function syncStatusSelectionLock() {
    const selection = document.getSelection();
    const statusBar = document.getElementById('status-bar');
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

  function getFractionalCoords(cart, cell) {
    if (!cell) return null;
    const a = Number(cell.a);
    const b = Number(cell.b);
    const c = Number(cell.c);
    const alpha = Number(cell.alpha) * Math.PI / 180;
    const beta = Number(cell.beta) * Math.PI / 180;
    const gamma = Number(cell.gamma) * Math.PI / 180;
    if (![a, b, c, alpha, beta, gamma].every((value) => Number.isFinite(value))) return null;
    const sinGamma = Math.sin(gamma);
    if (Math.abs(sinGamma) < 1e-8) return null;

    const cosAlpha = Math.cos(alpha);
    const cosBeta = Math.cos(beta);
    const cosGamma = Math.cos(gamma);

    const ax = a, ay = 0, az = 0;
    const bx = b * cosGamma, by = b * sinGamma, bz = 0;
    const cx = c * cosBeta;
    const cy = c * (cosAlpha - cosBeta * cosGamma) / sinGamma;
    const czSquared =
      c * c - cx * cx - cy * cy;
    if (czSquared <= 0) return null;
    const cz = Math.sqrt(czSquared);

    const matrix = [
      [ax, bx, cx],
      [ay, by, cy],
      [az, bz, cz],
    ];
    const inverse = invert3x3(matrix);
    if (!inverse) return null;
    const fx = inverse[0][0] * cart[0] + inverse[0][1] * cart[1] + inverse[0][2] * cart[2];
    const fy = inverse[1][0] * cart[0] + inverse[1][1] * cart[1] + inverse[1][2] * cart[2];
    const fz = inverse[2][0] * cart[0] + inverse[2][1] * cart[1] + inverse[2][2] * cart[2];
    return [fx, fy, fz];
  }

  function invert3x3(m) {
    const a = m[0][0], b = m[0][1], c = m[0][2];
    const d = m[1][0], e = m[1][1], f = m[1][2];
    const g = m[2][0], h = m[2][1], i = m[2][2];
    const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
    if (Math.abs(det) < 1e-12) return null;
    const invDet = 1 / det;
    return [
      [(e * i - f * h) * invDet, (c * h - b * i) * invDet, (b * f - c * e) * invDet],
      [(f * g - d * i) * invDet, (a * i - c * g) * invDet, (c * d - a * f) * invDet],
      [(d * h - e * g) * invDet, (b * g - a * h) * invDet, (a * e - b * d) * invDet],
    ];
  }

  function updateCounts(atomCount, bondCount) {
    document.getElementById('atom-count').textContent = atomCount;
    document.getElementById('bond-count').textContent = bondCount;
  }

  function updateLatticeUI(unitCellParams, supercell, hasUnitCell) {
    const aInput = document.getElementById('lattice-a');
    const bInput = document.getElementById('lattice-b');
    const cInput = document.getElementById('lattice-c');
    const alphaInput = document.getElementById('lattice-alpha');
    const betaInput = document.getElementById('lattice-beta');
    const gammaInput = document.getElementById('lattice-gamma');
    const scaleToggle = document.getElementById('lattice-scale');
    const removeBtn = document.getElementById('btn-lattice-remove');
    const centerBtn = document.getElementById('btn-center-cell');
    const superX = document.getElementById('supercell-x');
    const superY = document.getElementById('supercell-y');
    const superZ = document.getElementById('supercell-z');

    if (unitCellParams) {
      aInput.value = Number(unitCellParams.a).toFixed(4);
      bInput.value = Number(unitCellParams.b).toFixed(4);
      cInput.value = Number(unitCellParams.c).toFixed(4);
      alphaInput.value = Number(unitCellParams.alpha).toFixed(2);
      betaInput.value = Number(unitCellParams.beta).toFixed(2);
      gammaInput.value = Number(unitCellParams.gamma).toFixed(2);
    } else if (!state.unitCellEditing) {
      aInput.value = '';
      bInput.value = '';
      cInput.value = '';
      alphaInput.value = '';
      betaInput.value = '';
      gammaInput.value = '';
    }

    scaleToggle.checked = !!state.scaleAtomsWithLattice;
    removeBtn.disabled = !hasUnitCell;
    centerBtn.disabled = !hasUnitCell;

    const sc = Array.isArray(supercell) ? supercell : [1, 1, 1];
    const nx = Math.max(1, Math.floor(sc[0] || 1));
    const ny = Math.max(1, Math.floor(sc[1] || 1));
    const nz = Math.max(1, Math.floor(sc[2] || 1));
    superX.value = String(nx);
    superY.value = String(ny);
    superZ.value = String(nz);
    superX.disabled = !hasUnitCell;
    superY.disabled = !hasUnitCell;
    superZ.disabled = !hasUnitCell;
  }

  function updateAtomList(atoms, selectedIds, selectedId) {
    const derivedSelectedIds = atoms.filter((atom) => atom.selected).map((atom) => atom.id);
    const fallbackIds = state.selectedAtomIds || [];
    const effectiveSelectedId =
      selectedId ||
      selectedIds[selectedIds.length - 1] ||
      derivedSelectedIds[derivedSelectedIds.length - 1] ||
      fallbackIds[fallbackIds.length - 1] ||
      null;
    const normalizedSelectedIds =
      selectedIds.length > 0
        ? selectedIds
        : derivedSelectedIds.length > 0
          ? derivedSelectedIds
          : fallbackIds.length > 0
            ? fallbackIds
            : effectiveSelectedId
              ? [effectiveSelectedId]
              : [];
    const atomList = document.getElementById('atom-list');
    atomList.innerHTML = '';
    atoms.forEach((atom, index) => {
      const item = document.createElement('div');
      const isSelected = normalizedSelectedIds.includes(atom.id);
      item.className = 'atom-item' + (isSelected ? ' selected' : '');
      item.textContent = atom.element + ' #' + (index + 1);
      item.title = atom.id;
      item.onclick = (event) =>
        handleSelect(atom.id, event.ctrlKey || event.metaKey);
      atomList.appendChild(item);
    });

    const selected = atoms.find((atom) => atom.id === effectiveSelectedId) || null;
    state.currentSelectedAtom = selected;
    state.selectedAtomIds = normalizedSelectedIds;
    if (normalizedSelectedIds.length >= 2) {
      state.adsorptionReferenceId = normalizedSelectedIds[normalizedSelectedIds.length - 1];
      state.adsorptionAdsorbateIds = normalizedSelectedIds.slice(0, -1);
    } else {
      state.adsorptionReferenceId = null;
      state.adsorptionAdsorbateIds = normalizedSelectedIds.slice();
    }
    updateSelectedInputs(selected);
    updateAtomColorPreview();
    updateMeasurements();
    updateAdsorptionUI();
    updateStatusBar();
  }

  function handleSelect(atomId, add, preserve) {
    if (!state.currentStructure || !state.currentStructure.atoms) {
      vscode.postMessage({ command: 'selectAtom', atomId, add: !!add });
      return;
    }
    const atoms = state.currentStructure.atoms;
    let next = add || preserve ? [...state.selectedAtomIds] : [];
    const alreadySelected = next.includes(atomId);
    if (preserve && alreadySelected) {
      // Keep current selection when shift-dragging a selected atom.
    } else if (alreadySelected) {
      next = next.filter((id) => id !== atomId);
    } else {
      next.push(atomId);
    }
    for (const atom of atoms) {
      atom.selected = next.includes(atom.id);
    }
    const selectedId = next.length > 0 ? next[next.length - 1] : null;
    updateAtomList(atoms, next, selectedId);
    setSelectedBond(null, false);
    if (!(preserve && alreadySelected)) {
      vscode.postMessage({ command: 'selectAtom', atomId, add: !!add });
    }
  }

  function applySelectionFromIds(atomIds, mode) {
    if (!state.currentStructure || !state.currentStructure.atoms) {
      return;
    }
    const currentIds = state.selectedAtomIds || [];
    const nextSet = new Set();
    if (mode === 'add') {
      for (const id of currentIds) {
        nextSet.add(id);
      }
      for (const id of atomIds) {
        nextSet.add(id);
      }
    } else if (mode === 'subtract') {
      for (const id of currentIds) {
        nextSet.add(id);
      }
      for (const id of atomIds) {
        nextSet.delete(id);
      }
    } else {
      for (const id of atomIds) {
        nextSet.add(id);
      }
    }

    const atoms = state.currentStructure.atoms;
    const next = [];
    for (const atom of atoms) {
      const selected = nextSet.has(atom.id);
      atom.selected = selected;
      if (selected) {
        next.push(atom.id);
      }
    }
    const selectedId = next.length > 0 ? next[next.length - 1] : null;
    updateAtomList(atoms, next, selectedId);
    setSelectedBond(null, false);
    vscode.postMessage({ command: 'setSelection', atomIds: next });
  }

  function getAtomById(atomId) {
    if (!state.currentStructure || !state.currentStructure.atoms) return null;
    return state.currentStructure.atoms.find((atom) => atom.id === atomId) || null;
  }

  function normalizeHexColor(value) {
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    if (!/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
      return null;
    }
    return trimmed.toUpperCase();
  }

  function parseBondPairFromKey(bondKey) {
    if (!bondKey || typeof bondKey !== 'string') {
      return null;
    }
    const parts = bondKey.split('|');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return null;
    }
    return [parts[0], parts[1]];
  }

  function updateBondSelectionUI() {
    const label = document.getElementById('bond-selected');
    const deleteBtn = document.getElementById('btn-delete-bond');
    if (!label || !deleteBtn) {
      return;
    }
    const pair = parseBondPairFromKey(state.currentSelectedBondKey);
    if (!pair) {
      label.textContent = '--';
    } else {
      const atom1 = getAtomById(pair[0]);
      const atom2 = getAtomById(pair[1]);
      const left = atom1 ? `${atom1.element}(${pair[0].slice(-4)})` : pair[0];
      const right = atom2 ? `${atom2.element}(${pair[1].slice(-4)})` : pair[1];
      label.textContent = `${left} - ${right}`;
    }
    deleteBtn.disabled = !(state.currentSelectedBondKey || (state.selectedAtomIds && state.selectedAtomIds.length >= 2));
  }

  function setSelectedBond(bondKey, syncBackend) {
    state.currentSelectedBondKey = bondKey || null;
    updateBondSelectionUI();
    if (syncBackend) {
      vscode.postMessage({ command: 'selectBond', bondKey: state.currentSelectedBondKey });
    }
  }

  function updateAtomColorPreview() {
    const atomColorPicker = document.getElementById('atom-color-picker');
    const atomColorText = document.getElementById('atom-color-text');
    if (!atomColorPicker || !atomColorText) {
      return;
    }

    let previewColor = null;
    if (state.currentSelectedAtom && state.currentSelectedAtom.color) {
      previewColor = normalizeHexColor(state.currentSelectedAtom.color);
    }
    if (!previewColor && state.selectedAtomIds && state.selectedAtomIds.length > 0) {
      const focusAtomId = state.selectedAtomIds[state.selectedAtomIds.length - 1];
      const atom = getAtomById(focusAtomId);
      if (atom && atom.color) {
        previewColor = normalizeHexColor(atom.color);
      }
    }
    if (!previewColor) {
      return;
    }

    atomColorPicker.value = previewColor;
    atomColorText.value = previewColor;
  }

  function updateAtomPosition(atomId, x, y, z) {
    const atom = getAtomById(atomId);
    if (!atom) return;
    atom.position[0] = x;
    atom.position[1] = y;
    atom.position[2] = z;
    if (state.currentSelectedAtom && state.currentSelectedAtom.id === atomId) {
      updateStatusBar();
    }
  }

  function updateMeasurements() {
    const lengthEl = document.getElementById('bond-length');
    const angleEl = document.getElementById('bond-angle');
    const selected = state.selectedAtomIds;
    if (selected.length < 2) {
      lengthEl.textContent = '--';
      angleEl.textContent = '--';
      return;
    }
    const atomA = getAtomById(selected[0]);
    const atomB = getAtomById(selected[1]);
    if (!atomA || !atomB) {
      lengthEl.textContent = '--';
      angleEl.textContent = '--';
      return;
    }
    const dx = atomB.position[0] - atomA.position[0];
    const dy = atomB.position[1] - atomA.position[1];
    const dz = atomB.position[2] - atomA.position[2];
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
    lengthEl.textContent = length.toFixed(4);

    if (selected.length < 3) {
      angleEl.textContent = '--';
      return;
    }
    const atomC = getAtomById(selected[2]);
    if (!atomC) {
      angleEl.textContent = '--';
      return;
    }
    const v1 = [atomA.position[0] - atomB.position[0], atomA.position[1] - atomB.position[1], atomA.position[2] - atomB.position[2]];
    const v2 = [atomC.position[0] - atomB.position[0], atomC.position[1] - atomB.position[1], atomC.position[2] - atomB.position[2]];
    const dot = v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
    const len1 = Math.sqrt(v1[0] * v1[0] + v1[1] * v1[1] + v1[2] * v1[2]);
    const len2 = Math.sqrt(v2[0] * v2[0] + v2[1] * v2[1] + v2[2] * v2[2]);
    if (len1 > 1e-6 && len2 > 1e-6) {
      const cos = Math.max(-1, Math.min(1, dot / (len1 * len2)));
      const angle = (Math.acos(cos) * 180) / Math.PI;
      angleEl.textContent = angle.toFixed(2);
    } else {
      angleEl.textContent = '--';
    }
  }

  function rotateVectorAroundAxis(vector, axis, angleRad) {
    const [vx, vy, vz] = vector;
    const [ax, ay, az] = axis;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    const dot = vx * ax + vy * ay + vz * az;
    return [
      vx * cos + (ay * vz - az * vy) * sin + ax * dot * (1 - cos),
      vy * cos + (az * vx - ax * vz) * sin + ay * dot * (1 - cos),
      vz * cos + (ax * vy - ay * vx) * sin + az * dot * (1 - cos),
    ];
  }

  function applyBondAngle(targetDeg) {
    const ids = state.selectedAtomIds;
    if (!ids || ids.length < 3) return;
    const atomA = getAtomById(ids[0]);
    const atomB = getAtomById(ids[1]);
    const atomC = getAtomById(ids[2]);
    if (!atomA || !atomB || !atomC) return;

    const ba = [
      atomA.position[0] - atomB.position[0],
      atomA.position[1] - atomB.position[1],
      atomA.position[2] - atomB.position[2],
    ];
    const bc = [
      atomC.position[0] - atomB.position[0],
      atomC.position[1] - atomB.position[1],
      atomC.position[2] - atomB.position[2],
    ];
    const lenBA = Math.sqrt(ba[0] * ba[0] + ba[1] * ba[1] + ba[2] * ba[2]);
    const lenBC = Math.sqrt(bc[0] * bc[0] + bc[1] * bc[1] + bc[2] * bc[2]);
    if (lenBA < 1e-6 || lenBC < 1e-6) return;
    const dot = ba[0] * bc[0] + ba[1] * bc[1] + ba[2] * bc[2];
    const current = Math.acos(Math.max(-1, Math.min(1, dot / (lenBA * lenBC))));
    const target = (targetDeg * Math.PI) / 180;
    const delta = target - current;

    const axis = [
      ba[1] * bc[2] - ba[2] * bc[1],
      ba[2] * bc[0] - ba[0] * bc[2],
      ba[0] * bc[1] - ba[1] * bc[0],
    ];
    const axisLen = Math.sqrt(axis[0] * axis[0] + axis[1] * axis[1] + axis[2] * axis[2]);
    if (axisLen < 1e-6) return;
    const axisUnit = [axis[0] / axisLen, axis[1] / axisLen, axis[2] / axisLen];
    const rotated = rotateVectorAroundAxis(bc, axisUnit, delta);

    const newPos = [
      atomB.position[0] + rotated[0],
      atomB.position[1] + rotated[1],
      atomB.position[2] + rotated[2],
    ];
    updateAtomPosition(atomC.id, newPos[0], newPos[1], newPos[2]);
    updateMeasurements();

    vscode.postMessage({
      command: 'setAtomsPositions',
      atomPositions: [{ id: atomC.id, x: newPos[0], y: newPos[1], z: newPos[2] }],
      preview: false,
    });
  }

  function getAdsorptionReference() {
    if (!state.currentStructure || !state.currentStructure.atoms) return null;
    if (!state.adsorptionReferenceId || state.adsorptionAdsorbateIds.length === 0) return null;
    const atoms = state.currentStructure.atoms;
    const referenceAtom = atoms.find((atom) => atom.id === state.adsorptionReferenceId);
    if (!referenceAtom) return null;
    let anchor = null;
    let nearestDist = Infinity;
    for (const atom of atoms) {
      if (!state.adsorptionAdsorbateIds.includes(atom.id)) {
        continue;
      }
      const dx = atom.position[0] - referenceAtom.position[0];
      const dy = atom.position[1] - referenceAtom.position[1];
      const dz = atom.position[2] - referenceAtom.position[2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < nearestDist) {
        nearestDist = dist;
        anchor = atom;
      }
    }
    if (!anchor || !Number.isFinite(nearestDist)) {
      return null;
    }
    return {
      anchor,
      reference: referenceAtom,
      distance: nearestDist,
    };
  }

  function updateAdsorptionUI() {
    const refEl = document.getElementById('adsorption-ref');
    const distEl = document.getElementById('adsorption-distance');
    const slider = document.getElementById('adsorption-slider');
    const input = document.getElementById('adsorption-input');
    const ref = getAdsorptionReference();
    if (!ref) {
      refEl.textContent = '--';
      distEl.textContent = '--';
      slider.value = '0';
      input.value = '';
      return;
    }
    refEl.textContent = ref.reference.element + ' vs ' + ref.anchor.element;
    distEl.textContent = ref.distance.toFixed(4);
    slider.value = ref.distance.toFixed(2);
    input.value = ref.distance.toFixed(4);
  }

  function applyAdsorptionDistance(target, preview) {
    const ref = getAdsorptionReference();
    if (!ref) return;
    const dx = ref.anchor.position[0] - ref.reference.position[0];
    const dy = ref.anchor.position[1] - ref.reference.position[1];
    const dz = ref.anchor.position[2] - ref.reference.position[2];
    const current = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (current < 1e-6) return;
    const delta = target - current;
    const nx = dx / current;
    const ny = dy / current;
    const nz = dz / current;

    for (const id of state.adsorptionAdsorbateIds) {
      const atom = getAtomById(id);
      if (atom) {
        updateAtomPosition(
          id,
          atom.position[0] + nx * delta,
          atom.position[1] + ny * delta,
          atom.position[2] + nz * delta
        );
      }
    }

    vscode.postMessage({
      command: 'moveGroup',
      atomIds: state.adsorptionAdsorbateIds,
      dx: nx * delta,
      dy: ny * delta,
      dz: nz * delta,
      preview: !!preview,
    });
    if (!preview) {
      vscode.postMessage({ command: 'endDrag' });
    }
    updateAdsorptionUI();
  }

  function updateSelectedInputs(atom) {
    const el = document.getElementById('sel-element');
    const x = document.getElementById('sel-x');
    const y = document.getElementById('sel-y');
    const z = document.getElementById('sel-z');
    const disabled = !atom;
    el.disabled = disabled;
    x.disabled = disabled;
    y.disabled = disabled;
    z.disabled = disabled;
    if (!atom) {
      el.value = '';
      x.value = '';
      y.value = '';
      z.value = '';
      return;
    }
    el.value = atom.element;
    x.value = atom.position[0].toFixed(4);
    y.value = atom.position[1].toFixed(4);
    z.value = atom.position[2].toFixed(4);
  }

  function getSelectedCentroid() {
    if (!state.currentStructure || !state.currentStructure.atoms) return null;
    const ids = state.selectedAtomIds;
    if (!ids || ids.length === 0) return null;
    let cx = 0;
    let cy = 0;
    let cz = 0;
    let count = 0;
    for (const id of ids) {
      const atom = getAtomById(id);
      if (!atom) continue;
      cx += atom.position[0];
      cy += atom.position[1];
      cz += atom.position[2];
      count++;
    }
    if (count === 0) return null;
    return [cx / count, cy / count, cz / count];
  }

  function rotateAroundAxis(point, pivot, axis, angleRad) {
    const px = point[0] - pivot[0];
    const py = point[1] - pivot[1];
    const pz = point[2] - pivot[2];
    let x = px;
    let y = py;
    let z = pz;

    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);

    if (axis === 'x') {
      y = py * cos - pz * sin;
      z = py * sin + pz * cos;
    } else if (axis === 'y') {
      x = px * cos + pz * sin;
      z = -px * sin + pz * cos;
    } else {
      x = px * cos - py * sin;
      y = px * sin + py * cos;
    }

    return [x + pivot[0], y + pivot[1], z + pivot[2]];
  }

  let rotationBase = null;
  let rotationBaseIds = [];

  function captureRotationBase() {
    if (!state.currentStructure || !state.currentStructure.atoms) return null;
    rotationBaseIds = [...state.selectedAtomIds];
    rotationBase = rotationBaseIds.map((id) => {
      const atom = getAtomById(id);
      return atom ? { id, pos: [...atom.position] } : null;
    }).filter(Boolean);
    return rotationBase;
  }

  function applyRotation(angleDeg, preview) {
    if (!state.selectedAtomIds || state.selectedAtomIds.length === 0) return;
    const pivot = getSelectedCentroid();
    if (!pivot) return;
    if (!rotationBase || rotationBaseIds.join(',') !== state.selectedAtomIds.join(',')) {
      captureRotationBase();
    }
    if (!rotationBase) return;

    if (preview && !state.rotationInProgress) {
      state.rotationInProgress = true;
      vscode.postMessage({ command: 'beginDrag', atomId: state.selectedAtomIds[0] });
    }

    const angleRad = (angleDeg * Math.PI) / 180;
    const updated = [];

    for (const entry of rotationBase) {
      if (!entry) continue;
      const rotated = rotateAroundAxis(entry.pos, pivot, state.rotationAxis, angleRad);
      updateAtomPosition(entry.id, rotated[0], rotated[1], rotated[2]);
      updated.push({ id: entry.id, x: rotated[0], y: rotated[1], z: rotated[2] });
    }

    if (preview && state.currentStructure && state.currentStructure.renderAtoms) {
      const baseMap = new Map();
      for (const atom of state.currentStructure.atoms || []) {
        baseMap.set(atom.id, atom.position);
      }
      for (const renderAtom of state.currentStructure.renderAtoms) {
        const baseId = String(renderAtom.id).split('::')[0];
        const basePos = baseMap.get(baseId);
        const offset = state.renderAtomOffsets[renderAtom.id];
        if (basePos && offset) {
          renderAtom.position = [
            basePos[0] + offset[0],
            basePos[1] + offset[1],
            basePos[2] + offset[2],
          ];
        }
      }
    }

    vscode.postMessage({
      command: 'setAtomsPositions',
      atomPositions: updated,
      preview: !!preview,
    });

    if (preview && state.currentStructure) {
      renderer.renderStructure(
        state.currentStructure,
        {
          updateCounts,
        },
        { fitCamera: false }
      );
    }

    if (!preview) {
      state.rotationInProgress = false;
      vscode.postMessage({ command: 'endDrag' });
    }
  }

  function applySelectedAtomChanges() {
    if (!state.currentSelectedAtom) return;
    const el = document.getElementById('sel-element').value.trim();
    const x = parseFloat(document.getElementById('sel-x').value);
    const y = parseFloat(document.getElementById('sel-y').value);
    const z = parseFloat(document.getElementById('sel-z').value);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return;
    vscode.postMessage({
      command: 'updateAtom',
      atomId: state.currentSelectedAtom.id,
      element: el || state.currentSelectedAtom.element,
      x,
      y,
      z,
    });
  }

  function setupTabs() {
    const tabButtons = Array.from(document.querySelectorAll('.tab-button'));
    const tabPanes = Array.from(document.querySelectorAll('.tab-pane'));
    if (tabButtons.length === 0 || tabPanes.length === 0) {
      return;
    }

    const activateTab = (targetId) => {
      tabButtons.forEach((button) => {
        button.classList.toggle('active', button.dataset.tabTarget === targetId);
      });
      tabPanes.forEach((pane) => {
        pane.classList.toggle('active', pane.id === targetId);
      });
    };

    tabButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const targetId = button.dataset.tabTarget;
        if (!targetId) {
          return;
        }
        activateTab(targetId);
      });
    });

    const defaultTarget = tabButtons[0].dataset.tabTarget;
    if (defaultTarget) {
      activateTab(defaultTarget);
    }
  }

  function setupUI() {
    setupTabs();

    document.getElementById('btn-add-atom').onclick = () => {
      document.getElementById('element-input').focus();
    };

    document.getElementById('btn-add-atom-form').onclick = () => {
      const element = document.getElementById('element-input').value.trim();
      const x = parseFloat(document.getElementById('pos-x').value) || 0;
      const y = parseFloat(document.getElementById('pos-y').value) || 0;
      const z = parseFloat(document.getElementById('pos-z').value) || 0;
      if (element) {
        vscode.postMessage({ command: 'addAtom', element, x, y, z });
        document.getElementById('element-input').value = '';
        document.getElementById('pos-x').value = '';
        document.getElementById('pos-y').value = '';
        document.getElementById('pos-z').value = '';
      }
    };

    document.getElementById('btn-delete-atom').onclick = () => {
      if (state.currentStructure && state.currentStructure.selectedAtomId) {
        vscode.postMessage({ command: 'deleteAtom', atomId: state.currentStructure.selectedAtomId });
      }
    };

    document.getElementById('btn-copy-atom').onclick = () => {
      if (!state.selectedAtomIds || state.selectedAtomIds.length === 0) {
        return;
      }
      vscode.postMessage({
        command: 'copyAtoms',
        atomIds: state.selectedAtomIds,
        offset: { x: 0.5, y: 0.5, z: 0.5 },
      });
    };

    document.getElementById('btn-unit-cell').onclick = () => {
      vscode.postMessage({ command: 'toggleUnitCell' });
    };

    document.getElementById('btn-reset').onclick = () => {
      renderer.fitCamera();
    };

    document.getElementById('btn-undo').onclick = () => {
      vscode.postMessage({ command: 'undo' });
    };

    document.getElementById('btn-save').onclick = () => {
      vscode.postMessage({ command: 'saveStructure' });
    };

    document.getElementById('btn-save-as').onclick = () => {
      vscode.postMessage({ command: 'saveStructureAs' });
    };

    document.getElementById('btn-open-source').onclick = () => {
      vscode.postMessage({ command: 'openSource' });
    };

    document.getElementById('btn-reload').onclick = () => {
      vscode.postMessage({ command: 'reloadStructure' });
    };

    document.getElementById('btn-apply-bond').onclick = () => {
      const value = parseFloat(document.getElementById('bond-length-input').value);
      if (!Number.isFinite(value)) return;
      if (state.selectedAtomIds.length < 2) return;
      vscode.postMessage({
        command: 'setBondLength',
        atomIds: state.selectedAtomIds.slice(0, 2),
        length: value,
      });
    };

    document.getElementById('btn-apply-angle').onclick = () => {
      const value = parseFloat(document.getElementById('bond-angle-input').value);
      if (!Number.isFinite(value)) return;
      applyBondAngle(value);
    };

    const rotX = document.getElementById('btn-rot-x');
    const rotY = document.getElementById('btn-rot-y');
    const rotZ = document.getElementById('btn-rot-z');
    const rotSlider = document.getElementById('rotation-slider');
    const rotInput = document.getElementById('rotation-input');

    const setAxis = (axis) => {
      state.rotationAxis = axis;
      rotX.classList.toggle('selected', axis === 'x');
      rotY.classList.toggle('selected', axis === 'y');
      rotZ.classList.toggle('selected', axis === 'z');
      rotationBase = null;
      rotationBaseIds = [];
      state.rotationInProgress = false;
    };

    rotX.onclick = () => setAxis('x');
    rotY.onclick = () => setAxis('y');
    rotZ.onclick = () => setAxis('z');
    setAxis(state.rotationAxis || 'z');

    rotSlider.addEventListener('input', (event) => {
      const value = parseFloat(event.target.value);
      if (!Number.isFinite(value)) return;
      rotInput.value = value.toFixed(0);
      applyRotation(value, true);
    });

    rotSlider.addEventListener('change', (event) => {
      const value = parseFloat(event.target.value);
      if (!Number.isFinite(value)) return;
      applyRotation(value, false);
      rotationBase = null;
      rotationBaseIds = [];
    });

    rotInput.addEventListener('change', (event) => {
      let value = parseFloat(event.target.value);
      if (!Number.isFinite(value)) return;
      value = Math.max(0, Math.min(360, value));
      rotInput.value = value.toFixed(0);
      rotSlider.value = value.toFixed(0);
      applyRotation(value, false);
      rotationBase = null;
      rotationBaseIds = [];
    });

    document.getElementById('btn-change-atom').onclick = () => {
      const element = document.getElementById('change-element').value.trim();
      if (!element || !state.selectedAtomIds || state.selectedAtomIds.length === 0) {
        return;
      }
      vscode.postMessage({
        command: 'changeAtoms',
        atomIds: state.selectedAtomIds,
        element,
      });
    };

    const atomColorPicker = document.getElementById('atom-color-picker');
    const atomColorText = document.getElementById('atom-color-text');
    const btnApplyAtomColor = document.getElementById('btn-apply-atom-color');

    const syncColorInputs = (rawValue) => {
      const normalized = normalizeHexColor(rawValue);
      if (!normalized) {
        return null;
      }
      atomColorPicker.value = normalized;
      atomColorText.value = normalized;
      return normalized;
    };

    atomColorPicker.addEventListener('input', (event) => {
      const target = event.target;
      syncColorInputs(target.value);
    });

    atomColorText.addEventListener('change', (event) => {
      const target = event.target;
      const normalized = syncColorInputs(target.value);
      if (!normalized) {
        target.value = atomColorPicker.value;
      }
    });

    btnApplyAtomColor.onclick = () => {
      const color = syncColorInputs(atomColorText.value || atomColorPicker.value);
      if (!color || !state.selectedAtomIds || state.selectedAtomIds.length === 0) {
        return;
      }
      vscode.postMessage({
        command: 'setAtomColor',
        atomIds: state.selectedAtomIds,
        color,
      });
    };

    const btnCreateBond = document.getElementById('btn-create-bond');
    const btnDeleteBond = document.getElementById('btn-delete-bond');
    const btnRecalculateBonds = document.getElementById('btn-recalculate-bonds');

    btnCreateBond.onclick = () => {
      if (!state.selectedAtomIds || state.selectedAtomIds.length < 2) {
        return;
      }
      vscode.postMessage({ command: 'createBond', atomIds: state.selectedAtomIds.slice(-2) });
    };

    btnDeleteBond.onclick = () => {
      if (state.currentSelectedBondKey) {
        vscode.postMessage({ command: 'deleteBond', bondKey: state.currentSelectedBondKey });
        return;
      }
      if (state.selectedAtomIds && state.selectedAtomIds.length >= 2) {
        vscode.postMessage({ command: 'deleteBond', atomIds: state.selectedAtomIds.slice(-2) });
      }
    };

    btnRecalculateBonds.onclick = () => {
      vscode.postMessage({ command: 'recalculateBonds' });
    };

    document.addEventListener('keydown', (event) => {
      const target = event.target;
      const tagName = target && target.tagName ? target.tagName.toLowerCase() : '';
      const editable = tagName === 'input' || tagName === 'textarea' || (target && target.isContentEditable);
      if (editable) {
        return;
      }
      if (event.key !== 'Delete' && event.key !== 'Backspace') {
        return;
      }
      if (state.currentSelectedBondKey) {
        vscode.postMessage({ command: 'deleteBond', bondKey: state.currentSelectedBondKey });
        event.preventDefault();
        return;
      }
      if (state.currentStructure && state.currentStructure.selectedAtomId) {
        vscode.postMessage({ command: 'deleteAtom', atomId: state.currentStructure.selectedAtomId });
        event.preventDefault();
      }
    });

    const adsorptionSlider = document.getElementById('adsorption-slider');
    const adsorptionInput = document.getElementById('adsorption-input');

    adsorptionSlider.addEventListener('input', (event) => {
      const value = parseFloat(event.target.value);
      if (!Number.isFinite(value)) return;
      applyAdsorptionDistance(value, true);
    });

    adsorptionInput.addEventListener('change', (event) => {
      const value = parseFloat(event.target.value);
      if (!Number.isFinite(value)) return;
      applyAdsorptionDistance(value, false);
    });

    adsorptionSlider.addEventListener('change', (event) => {
      const value = parseFloat(event.target.value);
      if (!Number.isFinite(value)) return;
      applyAdsorptionDistance(value, false);
    });

    document.getElementById('btn-apply-atom').onclick = applySelectedAtomChanges;
    document.getElementById('sel-element').addEventListener('change', applySelectedAtomChanges);
    document.getElementById('sel-x').addEventListener('change', applySelectedAtomChanges);
    document.getElementById('sel-y').addEventListener('change', applySelectedAtomChanges);
    document.getElementById('sel-z').addEventListener('change', applySelectedAtomChanges);

    document.getElementById('scale-slider').addEventListener('input', (event) => {
      state.manualScale = parseFloat(event.target.value);
      document.getElementById('scale-value').textContent = state.manualScale.toFixed(1);
      if (!state.autoScaleEnabled && state.currentStructure) {
        renderer.renderStructure(state.currentStructure, { updateCounts, updateAtomList });
      }
    });

    document.getElementById('size-slider').addEventListener('input', (event) => {
      state.atomSizeScale = parseFloat(event.target.value);
      document.getElementById('size-value').textContent = state.atomSizeScale.toFixed(2);
      if (state.currentStructure) {
        renderer.renderStructure(state.currentStructure, { updateCounts, updateAtomList });
      }
    });

    document.getElementById('bond-size-slider').addEventListener('input', (event) => {
      state.bondThicknessScale = parseFloat(event.target.value);
      document.getElementById('bond-size-value').textContent = state.bondThicknessScale.toFixed(1);
      if (state.currentStructure) {
        renderer.renderStructure(state.currentStructure, { updateCounts, updateAtomList });
      }
    });

    document.getElementById('scale-auto').addEventListener('change', (event) => {
      state.autoScaleEnabled = event.target.checked;
      if (state.currentStructure) {
        renderer.renderStructure(state.currentStructure, { updateCounts, updateAtomList });
      }
    });

    const latticeApply = document.getElementById('btn-lattice-apply');
    const latticeRemove = document.getElementById('btn-lattice-remove');
    const latticeCenter = document.getElementById('btn-center-cell');
    const latticeScale = document.getElementById('lattice-scale');
    const latticeInputs = [
      document.getElementById('lattice-a'),
      document.getElementById('lattice-b'),
      document.getElementById('lattice-c'),
      document.getElementById('lattice-alpha'),
      document.getElementById('lattice-beta'),
      document.getElementById('lattice-gamma'),
    ];

    latticeScale.addEventListener('change', (event) => {
      state.scaleAtomsWithLattice = event.target.checked;
    });

    latticeInputs.forEach((input) => {
      input.addEventListener('input', () => {
        state.unitCellEditing = true;
      });
      input.addEventListener('blur', () => {
        state.unitCellEditing = false;
      });
    });

    latticeApply.onclick = () => {
      const a = parseFloat(document.getElementById('lattice-a').value);
      const b = parseFloat(document.getElementById('lattice-b').value);
      const c = parseFloat(document.getElementById('lattice-c').value);
      const alpha = parseFloat(document.getElementById('lattice-alpha').value);
      const beta = parseFloat(document.getElementById('lattice-beta').value);
      const gamma = parseFloat(document.getElementById('lattice-gamma').value);
      if (![a, b, c, alpha, beta, gamma].every((value) => Number.isFinite(value))) {
        setError('Lattice parameters must be valid numbers.');
        return;
      }
      vscode.postMessage({
        command: 'setUnitCell',
        params: { a, b, c, alpha, beta, gamma },
        scaleAtoms: !!state.scaleAtomsWithLattice,
      });
      setError('');
    };

    latticeRemove.onclick = () => {
      vscode.postMessage({ command: 'clearUnitCell' });
    };
    latticeCenter.onclick = () => {
      vscode.postMessage({ command: 'centerToUnitCell' });
    };

    const supercellApply = document.getElementById('btn-supercell-apply');
    supercellApply.onclick = () => {
      const nx = parseInt(document.getElementById('supercell-x').value, 10);
      const ny = parseInt(document.getElementById('supercell-y').value, 10);
      const nz = parseInt(document.getElementById('supercell-z').value, 10);
      if (![nx, ny, nz].every((value) => Number.isFinite(value) && value >= 1)) {
        setError('Supercell values must be integers >= 1.');
        return;
      }
      vscode.postMessage({ command: 'setSupercell', supercell: [nx, ny, nz] });
      setError('');
    };

    const projSelect = document.getElementById('proj-select');
    const setProjection = (mode) => {
      const next = mode === 'orthographic' ? 'orthographic' : 'perspective';
      state.projectionMode = next;
      if (projSelect) {
        projSelect.value = next;
      }
      renderer.setProjectionMode(next);
      renderer.fitCamera();
    };

    if (projSelect) {
      projSelect.onchange = (event) => {
        const target = event.target;
        setProjection(target.value);
      };
    }
    setProjection(state.projectionMode || 'perspective');
    updateBondSelectionUI();
  }

  function setupInteraction() {
    const canvas = document.getElementById('canvas');
    interaction.init(canvas, {
      onSelectAtom: (atomId, add, preserve) => handleSelect(atomId, add, preserve),
      onSelectBond: (bondKey) => setSelectedBond(bondKey, true),
      onClearSelection: () => applySelectionFromIds([], 'replace'),
      onBoxSelect: (atomIds, mode) => applySelectionFromIds(atomIds, mode),
      onBeginDrag: (atomId) => vscode.postMessage({ command: 'beginDrag', atomId }),
      onDragAtom: (atomId, intersection) => {
        const scale = renderer.getScale();
        const invScale = scale ? 1 / scale : 1;
        const modelX = intersection.x * invScale;
        const modelY = intersection.y * invScale;
        const modelZ = intersection.z * invScale;
        updateAtomPosition(atomId, modelX, modelY, modelZ);
        if (state.currentSelectedAtom && state.currentSelectedAtom.id === atomId) {
          document.getElementById('sel-x').value = modelX.toFixed(4);
          document.getElementById('sel-y').value = modelY.toFixed(4);
          document.getElementById('sel-z').value = modelZ.toFixed(4);
        }
        updateMeasurements();
        vscode.postMessage({
          command: 'moveAtom',
          atomId,
          x: modelX,
          y: modelY,
          z: modelZ,
          preview: true,
        });
      },
      onDragGroup: (deltaWorld) => {
        const scale = renderer.getScale();
        const invScale = scale ? 1 / scale : 1;
        const dx = deltaWorld.x * invScale;
        const dy = deltaWorld.y * invScale;
        const dz = deltaWorld.z * invScale;
        for (const id of state.selectedAtomIds) {
          const atom = getAtomById(id);
          if (atom) {
            updateAtomPosition(id, atom.position[0] + dx, atom.position[1] + dy, atom.position[2] + dz);
          }
        }
        vscode.postMessage({
          command: 'moveGroup',
          atomIds: state.selectedAtomIds,
          dx,
          dy,
          dz,
          preview: true,
        });
        if (state.currentSelectedAtom && state.selectedAtomIds.length > 0) {
          const atom = getAtomById(state.currentSelectedAtom.id);
          if (atom) {
            document.getElementById('sel-x').value = atom.position[0].toFixed(4);
            document.getElementById('sel-y').value = atom.position[1].toFixed(4);
            document.getElementById('sel-z').value = atom.position[2].toFixed(4);
          }
        }
        updateMeasurements();
      },
      onEndDrag: () => vscode.postMessage({ command: 'endDrag' }),
    });
  }

  function start() {
    const canvas = document.getElementById('canvas');
    renderer.init(canvas, { setError, setStatus });
    setupUI();
    setupInteraction();
    vscode.postMessage({ command: 'getState' });
    document.addEventListener('selectionchange', () => {
      syncStatusSelectionLock();
      if (!statusSelectionLock) {
        updateStatusBar(true);
      }
    });
  }

  window.addEventListener('message', (event) => {
    if (event.data.command === 'render') {
      state.currentStructure = event.data.data;
      state.selectedAtomIds = event.data.data.selectedAtomIds || [];
      state.currentSelectedBondKey = event.data.data.selectedBondKey || null;
      state.supercell = event.data.data.supercell || [1, 1, 1];
      if (state.selectedAtomIds.length >= 2) {
        state.adsorptionReferenceId = state.selectedAtomIds[state.selectedAtomIds.length - 1];
        state.adsorptionAdsorbateIds = state.selectedAtomIds.slice(0, -1);
      } else {
        state.adsorptionReferenceId = null;
        state.adsorptionAdsorbateIds = state.selectedAtomIds.slice();
      }
      renderer.renderStructure(
        event.data.data,
        {
          updateCounts,
          updateAtomList: (atoms, selectedId) =>
            updateAtomList(atoms, state.selectedAtomIds, selectedId),
        },
        { fitCamera: state.shouldFitCamera }
      );
      state.shouldFitCamera = false;
      updateStatusBar();

      if (event.data.data.renderAtoms && event.data.data.atoms) {
        const baseMap = new Map();
        for (const atom of event.data.data.atoms) {
          baseMap.set(atom.id, atom.position);
        }
        state.renderAtomOffsets = {};
        for (const renderAtom of event.data.data.renderAtoms) {
          const baseId = String(renderAtom.id).split('::')[0];
          const basePos = baseMap.get(baseId);
          if (basePos) {
            state.renderAtomOffsets[renderAtom.id] = [
              renderAtom.position[0] - basePos[0],
              renderAtom.position[1] - basePos[1],
              renderAtom.position[2] - basePos[2],
            ];
          }
        }
      } else {
        state.renderAtomOffsets = {};
      }

      updateLatticeUI(
        event.data.data.unitCellParams || null,
        event.data.data.supercell || [1, 1, 1],
        !!event.data.data.unitCellParams
      );

      const atoms = event.data.data.atoms || [];
      const selectedId =
        event.data.data.selectedAtomId ||
        state.selectedAtomIds[state.selectedAtomIds.length - 1] ||
        null;
      const selected = atoms.find((atom) => atom.id === selectedId) || null;
      state.currentSelectedAtom = selected;
      updateSelectedInputs(selected);
      updateAtomColorPreview();
      updateAdsorptionUI();
      updateBondSelectionUI();
    }
  });

  if (document.readyState === 'complete') {
    start();
  } else {
    window.addEventListener('load', start);
  }
})();
