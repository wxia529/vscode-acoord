import { expect } from 'chai';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Structure } from '../../../models/structure.js';
import { UnitCell } from '../../../models/unitCell.js';
import { POSCARParser } from '../../../io/parsers/poscarParser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '../../fixtures');

describe('POSCAR Parser', () => {
  it('should parse a simple POSCAR file', () => {
    const content = `Simple BCC Iron
1.0
2.866 0.0 0.0
0.0 2.866 0.0
0.0 0.0 2.866
Fe
2
Direct
0.0 0.0 0.0
0.5 0.5 0.5`;

    const parser = new POSCARParser();
    const structure = parser.parse(content);

    expect(structure.name).to.equal('Simple BCC Iron');
    expect(structure.isCrystal).to.be.true;
    expect(structure.atoms).to.have.lengthOf(2);
    expect(structure.unitCell).to.be.instanceOf(UnitCell);
    expect(structure.atoms[0].element).to.equal('Fe');
  });

  it('should parse selective dynamics', () => {
    const content = `Simple BCC Iron
1.0
2.866 0.0 0.0
0.0 2.866 0.0
0.0 0.0 2.866
Fe
2
Selective dynamics
Direct
0.0 0.0 0.0 T T T
0.5 0.5 0.5 T T F`;

    const parser = new POSCARParser();
    const structure = parser.parse(content);

    expect(structure.atoms[0].selectiveDynamics).to.deep.equal([true, true, true]);
    expect(structure.atoms[1].selectiveDynamics).to.deep.equal([true, true, false]);
  });

  it('should round-trip selective dynamics', () => {
    const parser = new POSCARParser();

    const original = `Simple BCC Iron
1.0
2.866 0.0 0.0
0.0 2.866 0.0
0.0 0.0 2.866
Fe
2
Selective dynamics
Direct
0.0 0.0 0.0 T T T
0.5 0.5 0.5 T T F`;

    const structure = parser.parse(original);
    const serialized = parser.serialize(structure);
    const reparsed = parser.parse(serialized);

    expect(reparsed.atoms[0].selectiveDynamics).to.deep.equal([true, true, true]);
    expect(reparsed.atoms[1].selectiveDynamics).to.deep.equal([true, true, false]);
  });

  describe('fixture file round-trip (water.vasp)', () => {
    const parser = new POSCARParser();
    const fixtureContent = readFileSync(join(FIXTURES, 'water.vasp'), 'utf-8');

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
      expect(structure.unitCell!.a).to.be.closeTo(10.0, 1e-3);
    });

    it('should serialize → re-parse to equivalent structure', () => {
      const original = parser.parse(fixtureContent);
      const serialized = parser.serialize(original);
      const reparsed = parser.parse(serialized);

      expect(reparsed.atoms).to.have.lengthOf(original.atoms.length);
      expect(reparsed.atoms[0].element).to.equal(original.atoms[0].element);
      expect(reparsed.unitCell!.a).to.be.closeTo(original.unitCell!.a, 1e-3);
    });
  });

  describe('fixture file round-trip (poscar_selective_dynamics.vasp)', () => {
    const parser = new POSCARParser();
    const fixtureContent = readFileSync(join(FIXTURES, 'poscar_selective_dynamics.vasp'), 'utf-8');

    it('should parse selective dynamics flags', () => {
      const structure = parser.parse(fixtureContent);
      expect(structure.atoms[0].selectiveDynamics).to.deep.equal([true, true, true]);
      expect(structure.atoms[1].selectiveDynamics).to.deep.equal([true, true, false]);
    });

    it('should serialize → re-parse preserving selective dynamics', () => {
      const original = parser.parse(fixtureContent);
      const serialized = parser.serialize(original);
      const reparsed = parser.parse(serialized);

      expect(reparsed.atoms[0].selectiveDynamics).to.deep.equal([true, true, true]);
      expect(reparsed.atoms[1].selectiveDynamics).to.deep.equal([true, true, false]);
    });
  });
});