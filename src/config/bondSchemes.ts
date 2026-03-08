import type { BondSchemeId } from '../shared/protocol.js';

export interface BondScheme {
  id: BondSchemeId;
  name: string;
  description: string;
  excludedAtomicNumbers: Set<number>;
}

export const BOND_SCHEMES: Record<BondSchemeId, BondScheme> = {
  'all': {
    id: 'all',
    name: 'All Bonds',
    description: 'Calculate bonds for all elements based on covalent radii',
    excludedAtomicNumbers: new Set(),
  },
  'no-sf-shell': {
    id: 'no-sf-shell',
    name: 'No s/f-Shell Bonds',
    description: 'Exclude alkali metals, alkaline earth metals, lanthanides, and actinides from bond calculation',
    excludedAtomicNumbers: new Set([
      3, 11, 19, 37, 55, 87,
      4, 12, 20, 38, 56, 88,
      57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71,
      89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103,
    ]),
  },
};

export const DEFAULT_BOND_SCHEME: BondSchemeId = 'all';

export function isAtomExcludedFromBonds(atomicNumber: number, scheme: BondScheme): boolean {
  return scheme.excludedAtomicNumbers.has(atomicNumber);
}
