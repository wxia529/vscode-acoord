import { structureStore, selectionStore } from '../state';
import type { Atom, UnitCellParams } from '../types';
import { getElementById } from './domCache';

// O(1) atom lookup index — rebuilt whenever a new structure is rendered.
let _atomIndex: Map<string, Atom> = new Map();

/**
 * Rebuild the atom-id → Atom index from the current structure.
 * Must be called by app.ts after each renderStructure() call so that
 * getAtomById() stays O(1) instead of O(n) Array.find().
 */
export function rebuildAtomIndex(): void {
  _atomIndex = new Map();
  const atoms = structureStore.currentStructure?.atoms;
  if (!atoms) return;
  for (const atom of atoms) {
    _atomIndex.set(atom.id, atom);
  }
}

export function invert3x3(
  m: [[number, number, number], [number, number, number], [number, number, number]]
): [[number, number, number], [number, number, number], [number, number, number]] | null {
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

// Cache for the fractional-coordinate matrix inverse.
// Keyed on a compact string of the 6 cell parameters so we recompute only
// when the unit cell actually changes (not on every pointermove frame).
let _fracCacheKey: string | null = null;
let _fracCacheInverse: [[number, number, number], [number, number, number], [number, number, number]] | null = null;

export function getFractionalCoords(
  cart: [number, number, number],
  cell: UnitCellParams | null | undefined
): [number, number, number] | null {
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

  // Use the cached inverse when the cell is unchanged.
  const cacheKey = `${a},${b},${c},${alpha},${beta},${gamma}`;
  let inverse: [[number, number, number], [number, number, number], [number, number, number]] | null;
  if (cacheKey === _fracCacheKey && _fracCacheInverse !== null) {
    inverse = _fracCacheInverse;
  } else {
    const cosAlpha = Math.cos(alpha);
    const cosBeta = Math.cos(beta);
    const cosGamma = Math.cos(gamma);

    const ax = a, ay = 0, az = 0;
    const bx = b * cosGamma, by = b * sinGamma, bz = 0;
    const cx = c * cosBeta;
    const cy = c * (cosAlpha - cosBeta * cosGamma) / sinGamma;
    const czSquared = c * c - cx * cx - cy * cy;
    if (czSquared <= 0) return null;
    const cz = Math.sqrt(czSquared);

    const matrix: [[number, number, number], [number, number, number], [number, number, number]] = [
      [ax, bx, cx],
      [ay, by, cy],
      [az, bz, cz],
    ];
    inverse = invert3x3(matrix);
    if (!inverse) return null;
    _fracCacheKey = cacheKey;
    _fracCacheInverse = inverse;
  }

  const fx = inverse[0][0] * cart[0] + inverse[0][1] * cart[1] + inverse[0][2] * cart[2];
  const fy = inverse[1][0] * cart[0] + inverse[1][1] * cart[1] + inverse[1][2] * cart[2];
  const fz = inverse[2][0] * cart[0] + inverse[2][1] * cart[1] + inverse[2][2] * cart[2];
  return [fx, fy, fz];
}

export function getAtomById(atomId: string): Atom | null {
  return _atomIndex.get(atomId) ?? null;
}

export function updateMeasurements(): void {
  const lengthEl = getElementById<HTMLElement>('bond-length');
  const lengthDisplayEl = getElementById<HTMLElement>('bond-length-display');
  const angleEl = getElementById<HTMLElement>('bond-angle');
  const selected = selectionStore.selectedAtomIds;
  if (selected.length < 2) {
    if (lengthEl) lengthEl.textContent = '--';
    if (lengthDisplayEl) lengthDisplayEl.textContent = '--';
    if (angleEl) angleEl.textContent = '--';
    return;
  }
  const atomA = getAtomById(selected[0]);
  const atomB = getAtomById(selected[1]);
  if (!atomA || !atomB) {
    if (lengthEl) lengthEl.textContent = '--';
    if (lengthDisplayEl) lengthDisplayEl.textContent = '--';
    if (angleEl) angleEl.textContent = '--';
    return;
  }
  const dx = atomB.position[0] - atomA.position[0];
  const dy = atomB.position[1] - atomA.position[1];
  const dz = atomB.position[2] - atomA.position[2];
  const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (lengthEl) lengthEl.textContent = length.toFixed(4);
  if (lengthDisplayEl) lengthDisplayEl.textContent = length.toFixed(4);

  if (selected.length < 3) {
    if (angleEl) angleEl.textContent = '--';
    return;
  }
  const atomC = getAtomById(selected[2]);
  if (!atomC) {
    if (angleEl) angleEl.textContent = '--';
    return;
  }
  const v1: [number, number, number] = [
    atomA.position[0] - atomB.position[0],
    atomA.position[1] - atomB.position[1],
    atomA.position[2] - atomB.position[2],
  ];
  const v2: [number, number, number] = [
    atomC.position[0] - atomB.position[0],
    atomC.position[1] - atomB.position[1],
    atomC.position[2] - atomB.position[2],
  ];
  const dot = v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
  const len1 = Math.sqrt(v1[0] * v1[0] + v1[1] * v1[1] + v1[2] * v1[2]);
  const len2 = Math.sqrt(v2[0] * v2[0] + v2[1] * v2[1] + v2[2] * v2[2]);
  if (len1 > 1e-6 && len2 > 1e-6) {
    const cos = Math.max(-1, Math.min(1, dot / (len1 * len2)));
    const angle = (Math.acos(cos) * 180) / Math.PI;
    if (angleEl) angleEl.textContent = angle.toFixed(2);
  } else {
    if (angleEl) angleEl.textContent = '--';
  }
}