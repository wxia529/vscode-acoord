import { expect } from 'chai';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Structure } from '../../../models/structure.js';
import { UnitCell } from '../../../models/unitCell.js';
import { CIFParser } from '../../../io/parsers/cifParser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '../../fixtures');

describe('CIF Parser', () => {
  const parser = new CIFParser();

  const SIMPLE_CIF = `data_NaCl
_cell_length_a   5.6402
_cell_length_b   5.6402
_cell_length_c   5.6402
_cell_angle_alpha  90.0
_cell_angle_beta   90.0
_cell_angle_gamma  90.0

loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
Na1 Na 0.0 0.0 0.0
Cl1 Cl 0.5 0.5 0.5`;

  it('should parse unit cell parameters', () => {
    const structure = parser.parse(SIMPLE_CIF);
    expect(structure.isCrystal).to.be.true;
    expect(structure.unitCell).to.be.instanceOf(UnitCell);
    expect(structure.unitCell!.a).to.be.closeTo(5.6402, 1e-3);
    expect(structure.unitCell!.alpha).to.be.closeTo(90, 1e-3);
  });

  it('should parse atoms from loop_', () => {
    const structure = parser.parse(SIMPLE_CIF);
    expect(structure.atoms.length).to.be.greaterThanOrEqual(2);
    const elements = structure.atoms.map(a => a.element);
    expect(elements).to.include('Na');
    expect(elements).to.include('Cl');
  });

  it('should round-trip parse → serialize → parse', () => {
    const original = parser.parse(SIMPLE_CIF);
    const serialized = parser.serialize(original);
    const reparsed = parser.parse(serialized);

    expect(reparsed.unitCell!.a).to.be.closeTo(original.unitCell!.a, 1e-3);
    expect(reparsed.atoms.length).to.equal(original.atoms.length);
  });

  describe('fixture file round-trip (water.cif)', () => {
    const fixtureContent = readFileSync(join(FIXTURES, 'water.cif'), 'utf-8');

    it('should parse correct atom count and elements', () => {
      const structure = parser.parse(fixtureContent);
      expect(structure.atoms.length).to.be.greaterThanOrEqual(3);
      const elements = structure.atoms.map(a => a.element);
      expect(elements).to.include('O');
      expect(elements).to.include('H');
    });

    it('should parse unit cell parameters', () => {
      const structure = parser.parse(fixtureContent);
      expect(structure.isCrystal).to.be.true;
      expect(structure.unitCell).to.be.instanceOf(UnitCell);
      expect(structure.unitCell!.a).to.be.closeTo(10.0, 1e-3);
      expect(structure.unitCell!.alpha).to.be.closeTo(90.0, 1e-3);
    });

    it('should serialize → re-parse to equivalent structure', () => {
      const original = parser.parse(fixtureContent);
      const serialized = parser.serialize(original);
      const reparsed = parser.parse(serialized);

      expect(reparsed.atoms.length).to.equal(original.atoms.length);
      expect(reparsed.unitCell!.a).to.be.closeTo(original.unitCell!.a, 1e-3);
    });
  });
});
