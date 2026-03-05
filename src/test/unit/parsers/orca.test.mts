import { expect } from 'chai';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Structure } from '../../../models/structure.js';
import { ORCAParser } from '../../../io/parsers/orcaParser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '../../fixtures');

describe('ORCA Parser', () => {
  const parser = new ORCAParser();

  const WATER_ORCA = `! B3LYP def2-SVP
%maxcore 4096

* xyz 0 1
O   0.000   0.000   0.000
H   0.757   0.586   0.000
H  -0.757   0.586   0.000
*`;

  it('should parse atoms from * xyz block', () => {
    const structure = parser.parse(WATER_ORCA);
    expect(structure.atoms).to.have.lengthOf(3);
    expect(structure.atoms[0].element).to.equal('O');
    expect(structure.atoms[1].element).to.equal('H');
    expect(structure.isCrystal).to.be.false;
  });

  it('should parse charge and multiplicity', () => {
    const structure = parser.parse(WATER_ORCA);
    expect(structure.metadata.get('charge')).to.equal(0);
    expect(structure.metadata.get('multiplicity')).to.equal(1);
  });

  it('should round-trip parse → serialize → parse', () => {
    const original = parser.parse(WATER_ORCA);
    const serialized = parser.serialize(original);
    const reparsed = parser.parse(serialized);

    expect(reparsed.atoms).to.have.lengthOf(3);
    expect(reparsed.atoms[0].element).to.equal('O');
    expect(reparsed.atoms[0].x).to.be.closeTo(0, 1e-3);
    expect(reparsed.atoms[1].x).to.be.closeTo(0.757, 1e-3);
  });

  it('should throw on missing * xyz block', () => {
    expect(() => parser.parse('! just a comment\n')).to.throw(/missing/i);
  });

  describe('fixture file round-trip (water.orca)', () => {
    const fixtureContent = readFileSync(join(FIXTURES, 'water.orca'), 'utf-8');

    it('should parse correct atom count and elements', () => {
      const structure = parser.parse(fixtureContent);
      expect(structure.atoms).to.have.lengthOf(3);
      const elements = structure.atoms.map(a => a.element);
      expect(elements).to.include('O');
      expect(elements).to.include('H');
    });

    it('should parse charge and multiplicity metadata', () => {
      const structure = parser.parse(fixtureContent);
      expect(structure.metadata.get('charge')).to.equal(-1);
      expect(structure.metadata.get('multiplicity')).to.equal(2);
    });

    it('should parse positions within tolerance', () => {
      const structure = parser.parse(fixtureContent);
      const o = structure.atoms.find(a => a.element === 'O')!;
      expect(o).to.not.be.undefined;
      expect(o.x).to.be.closeTo(0.0, 1e-3);
    });

    it('should serialize → re-parse preserving charge and multiplicity', () => {
      const original = parser.parse(fixtureContent);
      const serialized = parser.serialize(original);
      const reparsed = parser.parse(serialized);

      expect(reparsed.atoms).to.have.lengthOf(original.atoms.length);
      expect(reparsed.atoms[0].element).to.equal(original.atoms[0].element);
      expect(reparsed.metadata.get('charge')).to.equal(original.metadata.get('charge'));
      expect(reparsed.metadata.get('multiplicity')).to.equal(original.metadata.get('multiplicity'));
    });
  });
});
