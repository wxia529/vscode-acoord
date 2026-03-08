import { Structure } from '../../models/structure.js';
import { Atom } from '../../models/atom.js';
import { UnitCell } from '../../models/unitCell.js';
import { parseElement, getDefaultAtomRadius } from '../../utils/elementData.js';
import { BRIGHT_SCHEME } from '../../config/presets/color-schemes/index.js';
import { StructureParser } from './structureParser.js';

/**
 * ACoord native file format parser.
 * 
 * .acoord is a JSON-based format that preserves all atom properties including
 * user-specified colors and radii.
 * 
 * Radius semantics:
 * - If file specifies radius, use it directly (user has full control)
 * - If file omits radius, use default visual radius (covalent * 0.35)
 * - This differs from XYZ/POSCAR formats which always use visual defaults
 * 
 * Users can specify physical radii (e.g., 0.76 for carbon covalent radius)
 * and they will be rendered exactly as specified.
 */

interface ACoordAtom {
  id: string;
  element: string;
  x: number;
  y: number;
  z: number;
  color: string;
  radius: number;
  label?: string;
  fixed?: boolean;
  selectiveDynamics?: [boolean, boolean, boolean];
}

interface ACoordUnitCell {
  a: number;
  b: number;
  c: number;
  alpha: number;
  beta: number;
  gamma: number;
}

interface ACoordBond {
  atomId1: string;
  atomId2: string;
}

interface ACoordFile {
  version: string;
  atoms: ACoordAtom[];
  unitCell?: ACoordUnitCell;
  bonds?: ACoordBond[];
}

export class ACoordParser extends StructureParser {
  parse(content: string): Structure {
    let data: ACoordFile;
    try {
      data = JSON.parse(content);
    } catch {
      throw new Error('ACoordParser: invalid JSON format');
    }

    if (data.version !== '1.0') {
      throw new Error(`ACoordParser: unsupported version "${data.version}"`);
    }

    if (!Array.isArray(data.atoms) || data.atoms.length === 0) {
      throw new Error('ACoordParser: no atoms found');
    }

    const structure = new Structure('ACoord Structure');

    for (const atomData of data.atoms) {
      const element = parseElement(atomData.element);
      if (!element) {
        throw new Error(`ACoordParser: invalid element "${atomData.element}"`);
      }

      if (!Number.isFinite(atomData.x) || !Number.isFinite(atomData.y) || !Number.isFinite(atomData.z)) {
        throw new Error(`ACoordParser: invalid position for atom ${atomData.id}`);
      }

      const fileRadius = atomData.radius;
      const radius = (typeof fileRadius === 'number' && Number.isFinite(fileRadius) && fileRadius > 0)
        ? fileRadius
        : getDefaultAtomRadius(element);

      const atom = new Atom(element, atomData.x, atomData.y, atomData.z, atomData.id, {
        color: atomData.color || BRIGHT_SCHEME.colors[element] || '#C0C0C0',
        radius,
        label: atomData.label,
        fixed: atomData.fixed ?? false,
        selectiveDynamics: atomData.selectiveDynamics,
      });

      structure.addAtom(atom);
    }

    if (data.unitCell) {
      const uc = data.unitCell;
      if (!Number.isFinite(uc.a) || !Number.isFinite(uc.b) || !Number.isFinite(uc.c) ||
          !Number.isFinite(uc.alpha) || !Number.isFinite(uc.beta) || !Number.isFinite(uc.gamma)) {
        throw new Error('ACoordParser: invalid unit cell parameters');
      }
      structure.unitCell = new UnitCell(uc.a, uc.b, uc.c, uc.alpha, uc.beta, uc.gamma);
      structure.isCrystal = true;
    }

    if (data.bonds && Array.isArray(data.bonds)) {
      for (const bond of data.bonds) {
        structure.addBond(bond.atomId1, bond.atomId2);
      }
    }

    return structure;
  }

  serialize(structure: Structure): string {
    const atoms: ACoordAtom[] = structure.atoms.map(atom => {
      const atomData: ACoordAtom = {
        id: atom.id,
        element: atom.element,
        x: atom.x,
        y: atom.y,
        z: atom.z,
        color: atom.color,
        radius: atom.radius,
      };
      if (atom.label) {
        atomData.label = atom.label;
      }
      if (atom.fixed) {
        atomData.fixed = true;
      }
      if (atom.selectiveDynamics) {
        atomData.selectiveDynamics = atom.selectiveDynamics;
      }
      return atomData;
    });

    const output: ACoordFile = {
      version: '1.0',
      atoms,
    };

    if (structure.unitCell) {
      output.unitCell = {
        a: structure.unitCell.a,
        b: structure.unitCell.b,
        c: structure.unitCell.c,
        alpha: structure.unitCell.alpha,
        beta: structure.unitCell.beta,
        gamma: structure.unitCell.gamma,
      };
    }

    const bonds = structure.bonds;
    if (bonds.length > 0) {
      output.bonds = bonds.map((bond: [string, string]) => ({
        atomId1: bond[0],
        atomId2: bond[1],
      }));
    }

    return JSON.stringify(output, null, 2);
  }
}
