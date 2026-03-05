import { expect } from 'chai';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Structure } from '../../../models/structure.js';
import { UnitCell } from '../../../models/unitCell.js';
import { XDATCARParser } from '../../../io/parsers/xdatcarParser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '../../fixtures');

describe('XDATCAR Parser', () => {
  const parser = new XDATCARParser();

  const XDATCAR_CONTENT = `Simple BCC Iron MD
1.0
2.866 0.0 0.0
0.0 2.866 0.0
0.0 0.0 2.866
Fe
2
Direct configuration=     1
0.0 0.0 0.0
0.5 0.5 0.5
Direct configuration=     2
0.01 0.0 0.0
0.51 0.5 0.5`;

  it('should parse the last frame', () => {
    const structure = parser.parse(XDATCAR_CONTENT);
    expect(structure.atoms).to.have.lengthOf(2);
    expect(structure.atoms[0].element).to.equal('Fe');
    expect(structure.isCrystal).to.be.true;
  });

  it('should parse trajectory into multiple frames', () => {
    const frames = parser.parseTrajectory(XDATCAR_CONTENT);
    expect(frames).to.have.lengthOf(2);
  });

  it('should round-trip parse → serialize → parse', () => {
    const original = parser.parse(XDATCAR_CONTENT);
    const serialized = parser.serialize(original);
    const reparsed = parser.parse(serialized);

    expect(reparsed.atoms).to.have.lengthOf(2);
    expect(reparsed.atoms[0].element).to.equal('Fe');
    expect(reparsed.unitCell).to.be.instanceOf(UnitCell);
  });

  describe('fixture file round-trip (water.xdatcar)', () => {
    const fixtureContent = readFileSync(join(FIXTURES, 'water.xdatcar'), 'utf-8');

    it('should parse correct atom count and elements', () => {
      const structure = parser.parse(fixtureContent);
      expect(structure.atoms).to.have.lengthOf(3);
      const elements = structure.atoms.map(a => a.element);
      expect(elements).to.include('O');
      expect(elements).to.include('H');
    });

    it('should parse trajectory frames', () => {
      const frames = parser.parseTrajectory(fixtureContent);
      expect(frames).to.have.lengthOf(2);
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
});
