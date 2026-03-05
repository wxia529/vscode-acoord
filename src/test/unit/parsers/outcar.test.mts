import { expect } from 'chai';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Structure } from '../../../models/structure.js';
import { UnitCell } from '../../../models/unitCell.js';
import { OUTCARParser } from '../../../io/parsers/outcarParser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '../../fixtures');

describe('OUTCAR Parser', () => {
  const parser = new OUTCARParser();

  // Minimal OUTCAR with one ionic step
  const OUTCAR_CONTENT = `
 TITEL  = PAW_PBE Fe 06Sep2000
 VRHFIN =Fe: d6 s2
   ions per type = 2
 POMASS =  55.845
 NIONS  =       2

  direct lattice vectors                 reciprocal lattice vectors
    2.866000000  0.000000000  0.000000000     0.348919  0.000000  0.000000
    0.000000000  2.866000000  0.000000000     0.000000  0.348919  0.000000
    0.000000000  0.000000000  2.866000000     0.000000  0.000000  0.348919

 POSITION                                       TOTAL-FORCE (eV/Angst)
 -----------------------------------------------------------------------------------
      0.00000      0.00000      0.00000         0.000000      0.000000      0.000000
      1.43300      1.43300      1.43300         0.000000      0.000000      0.000000
 -----------------------------------------------------------------------------------
`;

  it('should parse atoms from POSITION block', () => {
    const structure = parser.parse(OUTCAR_CONTENT);
    expect(structure.atoms).to.have.lengthOf(2);
    expect(structure.atoms[0].element).to.equal('Fe');
  });

  it('should parse lattice vectors', () => {
    const structure = parser.parse(OUTCAR_CONTENT);
    expect(structure.isCrystal).to.be.true;
    expect(structure.unitCell).to.be.instanceOf(UnitCell);
    expect(structure.unitCell!.a).to.be.closeTo(2.866, 1e-3);
  });

  it('should throw on serialize (read-only format)', () => {
    const structure = parser.parse(OUTCAR_CONTENT);
    expect(() => parser.serialize(structure)).to.throw(/not supported/i);
  });

  describe('fixture file round-trip (water.outcar)', () => {
    const fixtureContent = readFileSync(join(FIXTURES, 'water.outcar'), 'utf-8');

    it('should parse correct atom count and elements', () => {
      const structure = parser.parse(fixtureContent);
      expect(structure.atoms).to.have.lengthOf(3);
      const elements = structure.atoms.map(a => a.element);
      expect(elements).to.include('O');
      expect(elements).to.include('H');
    });

    it('should parse lattice vectors', () => {
      const structure = parser.parse(fixtureContent);
      expect(structure.isCrystal).to.be.true;
      expect(structure.unitCell).to.be.instanceOf(UnitCell);
      expect(structure.unitCell!.a).to.be.closeTo(10.0, 1e-3);
    });

    it('should parse positions within tolerance', () => {
      const structure = parser.parse(fixtureContent);
      const o = structure.atoms.find(a => a.element === 'O')!;
      expect(o.x).to.be.closeTo(0.0, 1e-3);
      expect(o.y).to.be.closeTo(0.0, 1e-3);
    });
  });
});
