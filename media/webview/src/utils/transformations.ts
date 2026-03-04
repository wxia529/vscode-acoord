import { state } from '../state';
import { renderer } from '../renderer';
import { getAtomById, updateMeasurements } from './measurements';
import type { Atom, VsCodeApi } from '../types';

let rotationBase: { id: string; pos: [number, number, number] }[] | null = null;
let rotationBaseIds: string[] = [];

export function resetRotationBase(): void {
  rotationBase = null;
  rotationBaseIds = [];
  state.rotationInProgress = false;
}

export function captureRotationBase(): { id: string; pos: [number, number, number] }[] | null {
  if (!state.currentStructure || !state.currentStructure.atoms) return null;
  rotationBaseIds = [...state.selectedAtomIds];
  rotationBase = rotationBaseIds.map((id) => {
    const atom = getAtomById(id);
    return atom ? { id, pos: [...atom.position] as [number, number, number] } : null;
  }).filter((entry): entry is { id: string; pos: [number, number, number] } => entry !== null);
  return rotationBase;
}

export function rotateVectorAroundAxis(
  vector: [number, number, number],
  axis: [number, number, number],
  angleRad: number
): [number, number, number] {
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

export function rotateAroundAxis(
  point: [number, number, number],
  pivot: [number, number, number],
  axis: string,
  angleRad: number
): [number, number, number] {
  const px = point[0] - pivot[0];
  const py = point[1] - pivot[1];
  const pz = point[2] - pivot[2];
  let x = px, y = py, z = pz;
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

export function getSelectedCentroid(): [number, number, number] | null {
  if (!state.currentStructure || !state.currentStructure.atoms) return null;
  const ids = state.selectedAtomIds;
  if (!ids || ids.length === 0) return null;
  let cx = 0, cy = 0, cz = 0, count = 0;
  for (const id of ids) {
    const atom = getAtomById(id);
    if (!atom) continue;
    cx += atom.position[0]; cy += atom.position[1]; cz += atom.position[2];
    count++;
  }
  if (count === 0) return null;
  return [cx / count, cy / count, cz / count];
}

export function updateAtomPosition(
  atomId: string,
  x: number,
  y: number,
  z: number,
  onUpdate?: () => void
): void {
  const atom = getAtomById(atomId);
  if (!atom) return;
  atom.position[0] = x;
  atom.position[1] = y;
  atom.position[2] = z;
  if (onUpdate) {
    onUpdate();
  }
}

export function applyBondAngle(targetDeg: number): void {
  const ids = state.selectedAtomIds;
  if (!ids || ids.length < 3) return;
  const atomA = getAtomById(ids[0]);
  const atomB = getAtomById(ids[1]);
  const atomC = getAtomById(ids[2]);
  if (!atomA || !atomB || !atomC) return;

  const ba: [number, number, number] = [
    atomA.position[0] - atomB.position[0],
    atomA.position[1] - atomB.position[1],
    atomA.position[2] - atomB.position[2],
  ];
  const bc: [number, number, number] = [
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

  const axis: [number, number, number] = [
    ba[1] * bc[2] - ba[2] * bc[1],
    ba[2] * bc[0] - ba[0] * bc[2],
    ba[0] * bc[1] - ba[1] * bc[0],
  ];
  const axisLen = Math.sqrt(axis[0] * axis[0] + axis[1] * axis[1] + axis[2] * axis[2]);
  if (axisLen < 1e-6) return;
  const axisUnit: [number, number, number] = [axis[0] / axisLen, axis[1] / axisLen, axis[2] / axisLen];
  const rotated = rotateVectorAroundAxis(bc, axisUnit, delta);

  const newPos: [number, number, number] = [
    atomB.position[0] + rotated[0],
    atomB.position[1] + rotated[1],
    atomB.position[2] + rotated[2],
  ];
  updateAtomPosition(atomC.id, newPos[0], newPos[1], newPos[2]);
  updateMeasurements();
}

export function applyRotation(angleDeg: number, preview: boolean, vscode: VsCodeApi): void {
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
  const updated: { id: string; x: number; y: number; z: number }[] = [];

  for (const entry of rotationBase) {
    if (!entry) continue;
    const rotated = rotateAroundAxis(entry.pos, pivot, state.rotationAxis, angleRad);
    updateAtomPosition(entry.id, rotated[0], rotated[1], rotated[2]);
    updated.push({ id: entry.id, x: rotated[0], y: rotated[1], z: rotated[2] });
  }

  if (preview && state.currentStructure && state.currentStructure.renderAtoms) {
    const baseMap = new Map<string, [number, number, number]>();
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

  vscode.postMessage({ command: 'setAtomsPositions', atomPositions: updated, preview: !!preview });

  if (preview && state.currentStructure) {
    renderer.renderStructure(state.currentStructure, { updateCounts: () => {} }, { fitCamera: false });
  }

  if (!preview) {
    state.rotationInProgress = false;
    vscode.postMessage({ command: 'endDrag' });
  }
}

export function getAdsorptionReference(): { anchor: Atom; reference: Atom; distance: number } | null {
  if (!state.currentStructure || !state.currentStructure.atoms) return null;
  if (!state.adsorptionReferenceId || state.adsorptionAdsorbateIds.length === 0) return null;
  const atoms = state.currentStructure.atoms;
  const referenceAtom = atoms.find((atom) => atom.id === state.adsorptionReferenceId);
  if (!referenceAtom) return null;
  let anchor: Atom | null = null;
  let nearestDist = Infinity;
  for (const atom of atoms) {
    if (!state.adsorptionAdsorbateIds.includes(atom.id)) { continue; }
    const dx = atom.position[0] - referenceAtom.position[0];
    const dy = atom.position[1] - referenceAtom.position[1];
    const dz = atom.position[2] - referenceAtom.position[2];
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < nearestDist) { nearestDist = dist; anchor = atom; }
  }
  if (!anchor || !Number.isFinite(nearestDist)) { return null; }
  return { anchor, reference: referenceAtom, distance: nearestDist };
}

export function applyAdsorptionDistance(target: number, preview: boolean, vscode: VsCodeApi): void {
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
      updateAtomPosition(id, atom.position[0] + nx * delta, atom.position[1] + ny * delta, atom.position[2] + nz * delta);
    }
  }
  vscode.postMessage({
    command: 'moveGroup',
    atomIds: state.adsorptionAdsorbateIds,
    dx: nx * delta, dy: ny * delta, dz: nz * delta,
    preview: !!preview,
  });
  if (!preview) { vscode.postMessage({ command: 'endDrag' }); }
}