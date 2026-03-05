import { expect } from 'chai';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Structure } from '../../../models/structure.js';
import { UnitCell } from '../../../models/unitCell.js';
import { QEParser } from '../../../io/parsers/qeParser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '../../fixtures');

describe('QE Parser', () => {
  const parser = new QEParser();

  const SILICON_QE = `&CONTROL
  calculation = 'scf'
/
&SYSTEM
  ibrav = 0
  nat = 2
  ntyp = 1
/
&ELECTRONS
/
ATOMIC_SPECIES
Si  28.086  Si.pbe-n-kjpaw_psl.1.0.0.UPF

CELL_PARAMETERS angstrom
  2.715  2.715  0.000
  0.000  2.715  2.715
  2.715  0.000  2.715

ATOMIC_POSITIONS crystal
Si  0.00  0.00  0.00
Si  0.25  0.25  0.25
`;

  it('should parse unit cell from CELL_PARAMETERS block', () => {
    const structure = parser.parse(SILICON_QE);
    expect(structure.isCrystal).to.be.true;
    expect(structure.unitCell).to.be.instanceOf(UnitCell);
  });

  it('should parse atoms from ATOMIC_POSITIONS block', () => {
    const structure = parser.parse(SILICON_QE);
    expect(structure.atoms).to.have.lengthOf(2);
    expect(structure.atoms[0].element).to.equal('Si');
    expect(structure.atoms[1].element).to.equal('Si');
  });

  it('should round-trip parse → serialize → parse', () => {
    const original = parser.parse(SILICON_QE);
    const serialized = parser.serialize(original);
    const reparsed = parser.parse(serialized);

    expect(reparsed.atoms).to.have.lengthOf(2);
    expect(reparsed.atoms[0].element).to.equal('Si');
    expect(reparsed.unitCell).to.be.instanceOf(UnitCell);
  });

  describe('fixture file round-trip (water.qe.in)', () => {
    const fixtureContent = readFileSync(join(FIXTURES, 'water.qe.in'), 'utf-8');

    it('should parse correct atom count and elements', () => {
      const structure = parser.parse(fixtureContent);
      expect(structure.atoms).to.have.lengthOf(3);
      const elements = structure.atoms.map(a => a.element);
      expect(elements).to.include('O');
      expect(elements).to.include('H');
    });

    it('should parse unit cell', () => {
      const structure = parser.parse(fixtureContent);
      expect(structure.isCrystal).to.be.true;
      expect(structure.unitCell).to.be.instanceOf(UnitCell);
    });

    it('should parse positions within tolerance', () => {
      const structure = parser.parse(fixtureContent);
      const o = structure.atoms.find(a => a.element === 'O')!;
      expect(o.x).to.be.closeTo(0.0, 1e-6);
      expect(o.y).to.be.closeTo(0.0, 1e-6);
    });

    it('should serialize → re-parse to equivalent structure', () => {
      const original = parser.parse(fixtureContent);
      const serialized = parser.serialize(original);
      const reparsed = parser.parse(serialized);

      expect(reparsed.atoms).to.have.lengthOf(original.atoms.length);
      expect(reparsed.atoms[0].element).to.equal(original.atoms[0].element);
      expect(reparsed.unitCell).to.be.instanceOf(UnitCell);
    });
  });
});
