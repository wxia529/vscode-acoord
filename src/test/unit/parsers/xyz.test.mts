import { expect } from 'chai';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Structure } from '../../../models/structure.js';
import { XYZParser } from '../../../io/parsers/xyzParser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '../../fixtures');

describe('XYZ Parser', () => {
  const parser = new XYZParser();

  const WATER_XYZ = `3
water molecule
O  0.000  0.000  0.000
H  0.757  0.586  0.000
H -0.757  0.586  0.000`;

  it('should parse a simple XYZ file', () => {
    const structure = parser.parse(WATER_XYZ);
    expect(structure.atoms).to.have.lengthOf(3);
    expect(structure.atoms[0].element).to.equal('O');
    expect(structure.atoms[1].element).to.equal('H');
    expect(structure.isCrystal).to.be.false;
  });

  it('should parse atom coordinates correctly', () => {
    const structure = parser.parse(WATER_XYZ);
    expect(structure.atoms[0].x).to.be.closeTo(0, 1e-6);
    expect(structure.atoms[1].x).to.be.closeTo(0.757, 1e-3);
    expect(structure.atoms[2].x).to.be.closeTo(-0.757, 1e-3);
  });

  it('should round-trip parse → serialize → parse', () => {
    const original = parser.parse(WATER_XYZ);
    const serialized = parser.serialize(original);
    const reparsed = parser.parse(serialized);

    expect(reparsed.atoms).to.have.lengthOf(3);
    expect(reparsed.atoms[0].element).to.equal('O');
    expect(reparsed.atoms[0].x).to.be.closeTo(0, 1e-3);
    expect(reparsed.atoms[1].x).to.be.closeTo(0.757, 1e-3);
  });

  it('should parse multi-frame XYZ trajectory', () => {
    const traj = `2\nframe 1\nH 0 0 0\nH 1 0 0\n\n2\nframe 2\nH 0 0 0\nH 2 0 0`;
    const frames = parser.parseTrajectory(traj);
    expect(frames).to.have.lengthOf(2);
    expect(frames[1].atoms[1].x).to.be.closeTo(2, 1e-6);
  });

  describe('fixture file round-trip (water.xyz)', () => {
    const fixtureContent = readFileSync(join(FIXTURES, 'water.xyz'), 'utf-8');

    it('should parse correct atom count and elements', () => {
      const structure = parser.parse(fixtureContent);
      expect(structure.atoms).to.have.lengthOf(3);
      expect(structure.atoms[0].element).to.equal('O');
      expect(structure.atoms[1].element).to.equal('H');
      expect(structure.atoms[2].element).to.equal('H');
    });

    it('should parse positions within tolerance', () => {
      const structure = parser.parse(fixtureContent);
      expect(structure.atoms[0].x).to.be.closeTo(0.0, 1e-6);
      expect(structure.atoms[0].y).to.be.closeTo(0.0, 1e-6);
      expect(structure.atoms[1].x).to.be.closeTo(0.757, 1e-6);
      expect(structure.atoms[2].x).to.be.closeTo(-0.757, 1e-6);
    });

    it('should serialize → re-parse to equivalent structure', () => {
      const original = parser.parse(fixtureContent);
      const serialized = parser.serialize(original);
      const reparsed = parser.parse(serialized);

      expect(reparsed.atoms).to.have.lengthOf(original.atoms.length);
      expect(reparsed.atoms[0].element).to.equal(original.atoms[0].element);
      expect(reparsed.atoms[0].x).to.be.closeTo(original.atoms[0].x, 1e-3);
      expect(reparsed.atoms[1].x).to.be.closeTo(original.atoms[1].x, 1e-3);
      expect(reparsed.atoms[2].x).to.be.closeTo(original.atoms[2].x, 1e-3);
    });
  });
});
