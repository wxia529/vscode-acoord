import { structureStore, displayStore } from '../state';
import type { Atom } from '../types';

export const ATOM_SIZE_MIN = 0.1;
export const ATOM_SIZE_MAX = 2.0;

export function clampAtomSize(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) { return fallback; }
  return Math.max(ATOM_SIZE_MIN, Math.min(ATOM_SIZE_MAX, parsed));
}

export function getBaseAtomId(atomId: string): string {
  if (typeof atomId !== 'string') { return ''; }
  return atomId.split('::')[0];
}

export function getCurrentStructureAtoms(): Atom[] {
  if (!structureStore.currentStructure || !Array.isArray(structureStore.currentStructure.atoms)) { return []; }
  return structureStore.currentStructure.atoms;
}

export function getAvailableElements(): string[] {
  const elementSet = new Set<string>();
  for (const atom of getCurrentStructureAtoms()) {
    if (atom && typeof atom.element === 'string' && atom.element.trim().length > 0) {
      elementSet.add(atom.element);
    }
  }
  return Array.from(elementSet).sort((a, b) => a.localeCompare(b));
}

export function cleanupAtomSizeOverrides(): void {
  if (!displayStore.currentRadiusByElement || typeof displayStore.currentRadiusByElement !== 'object') {
    displayStore.currentRadiusByElement = {};
  }
  const elements = new Set(getCurrentStructureAtoms().map((atom) => atom.element));
  for (const element of Object.keys(displayStore.currentRadiusByElement)) {
    if (!elements.has(element)) { delete displayStore.currentRadiusByElement[element]; }
  }
}

export function hasElementSizeOverride(element: string): boolean {
  return Number.isFinite(displayStore.currentRadiusByElement && displayStore.currentRadiusByElement[element]);
}

export function hasAtomSizeOverride(_atomId: string): boolean {
  return false;
}

export function getFallbackRadiusForAtom(atom: Atom | null): number {
  if (atom && Number.isFinite(atom.radius)) { return atom.radius; }
  return 0.3;
}

export function getAtomSizeForAtomId(atomId: string): number {
  const baseId = getBaseAtomId(atomId);
  const atom = getCurrentStructureAtoms().find((candidate) => candidate.id === baseId) || null;
  return getFallbackRadiusForAtom(atom);
}

export function getAtomSizeForElement(element: string): number {
  const atom = getCurrentStructureAtoms().find((candidate) => candidate.element === element) || null;
  return getFallbackRadiusForAtom(atom);
}
