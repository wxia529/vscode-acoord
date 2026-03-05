import { expect } from 'chai';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Structure } from '../../../models/structure.js';
import { GJFParser } from '../../../io/parsers/gjfParser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '../../fixtures');

describe('GJF Parser', () => {
  const parser = new GJFParser();

  const METHANE_GJF = `#P B3LYP/6-31G*

methane

0 1
C  0.000  0.000  0.000
H  0.631  0.631  0.631
H -0.631 -0.631  0.631
H -0.631  0.631 -0.631
H  0.631 -0.631 -0.631

`;

  it('should parse atoms from GJF file', () => {
    const structure = parser.parse(METHANE_GJF);
    expect(structure.atoms).to.have.lengthOf(5);
    expect(structure.atoms[0].element).to.equal('C');
    expect(structure.atoms[1].element).to.equal('H');
    expect(structure.isCrystal).to.be.false;
  });

  it('should parse coordinates correctly', () => {
    const structure = parser.parse(METHANE_GJF);
    expect(structure.atoms[0].x).to.be.closeTo(0, 1e-6);
    expect(structure.atoms[1].x).to.be.closeTo(0.631, 1e-3);
  });

  it('should round-trip parse → serialize → parse', () => {
    const original = parser.parse(METHANE_GJF);
    const serialized = parser.serialize(original);
    const reparsed = parser.parse(serialized);

    expect(reparsed.atoms).to.have.lengthOf(5);
    expect(reparsed.atoms[0].element).to.equal('C');
    expect(reparsed.atoms[0].x).to.be.closeTo(0, 1e-3);
  });

  it('should store charge and multiplicity in metadata', () => {
    const structure = parser.parse(METHANE_GJF);
    expect(structure.metadata.get('charge')).to.equal(0);
    expect(structure.metadata.get('multiplicity')).to.equal(1);
  });

  describe('fixture file round-trip (water.gjf)', () => {
    const fixtureContent = readFileSync(join(FIXTURES, 'water.gjf'), 'utf-8');

    it('should parse correct atom count and elements', () => {
      const structure = parser.parse(fixtureContent);
      expect(structure.atoms).to.have.lengthOf(3);
      const elements = structure.atoms.map(a => a.element);
      expect(elements).to.include('O');
      expect(elements).to.include('H');
    });

    it('should parse charge and multiplicity metadata', () => {
      const structure = parser.parse(fixtureContent);
      expect(structure.metadata.get('charge')).to.equal(0);
      expect(structure.metadata.get('multiplicity')).to.equal(1);
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
