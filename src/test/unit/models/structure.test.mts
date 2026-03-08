import { expect } from 'chai';
import { Structure } from '../../../models/structure.js';
import { Atom } from '../../../models/atom.js';
import { UnitCell } from '../../../models/unitCell.js';

describe('Structure', () => {
  describe('Basic Structure Creation', () => {
    it('should create an empty structure', () => {
      const structure = new Structure('test');
      expect(structure.name).to.equal('test');
      expect(structure.atoms).to.have.lengthOf(0);
      expect(structure.isCrystal).to.be.false;
    });

    it('should create a crystal structure', () => {
      const structure = new Structure('crystal', true);
      expect(structure.isCrystal).to.be.true;
      expect(structure.unitCell).to.be.instanceOf(UnitCell);
    });
  });

  describe('Atom Management', () => {
    let structure: Structure;

    beforeEach(() => {
      structure = new Structure('test');
    });

    it('should add atoms correctly', () => {
      const atom = new Atom('H', 0, 0, 0);
      structure.addAtom(atom);
      expect(structure.atoms).to.have.lengthOf(1);
      expect(structure.getAtom(atom.id)).to.equal(atom);
    });

    it('should remove atoms correctly', () => {
      const atom = new Atom('H', 0, 0, 0);
      structure.addAtom(atom);
      structure.removeAtom(atom.id);
      expect(structure.atoms).to.have.lengthOf(0);
      expect(structure.getAtom(atom.id)).to.be.undefined;
    });

    it('should maintain atom index after removal', () => {
      const atom1 = new Atom('H', 0, 0, 0);
      const atom2 = new Atom('O', 1, 1, 1);
      structure.addAtom(atom1);
      structure.addAtom(atom2);
      structure.removeAtom(atom1.id);
      expect(structure.getAtom(atom2.id)).to.equal(atom2);
      expect(structure.getAtomIndexSize()).to.equal(1);
    });
  });

  describe('getAtom() Performance', () => {
    it('should use O(1) lookup via atom index', () => {
      const structure = new Structure('test');

      const atom1 = new Atom('H', 0, 0, 0);
      const atom2 = new Atom('O', 1, 1, 1);
      const atom3 = new Atom('C', 2, 2, 2);

      structure.addAtom(atom1);
      structure.addAtom(atom2);
      structure.addAtom(atom3);

      expect(structure.getAtom(atom1.id)).to.equal(atom1);
      expect(structure.getAtom(atom2.id)).to.equal(atom2);
      expect(structure.getAtom(atom3.id)).to.equal(atom3);
      expect(structure.getAtom('nonexistent')).to.be.undefined;
    });

    it('should handle large number of atoms efficiently', () => {
      const structure = new Structure('test');
      const atoms: Atom[] = [];

      for (let i = 0; i < 1000; i++) {
        const atom = new Atom('C', i, i, i);
        atoms.push(atom);
        structure.addAtom(atom);
      }

      expect(structure.atoms).to.have.lengthOf(1000);
      expect(structure.getAtomIndexSize()).to.equal(1000);

      for (const atom of atoms) {
        expect(structure.getAtom(atom.id)).to.equal(atom);
      }
    });
  });

  describe('Bond Detection', () => {
    it('should detect bonds in H2O molecule', () => {
      const structure = new Structure('water');

      const h1 = new Atom('H', -0.75, 0, 0);
      const o = new Atom('O', 0, 0, 0);
      const h2 = new Atom('H', 0.75, 0, 0);

      structure.addAtom(h1);
      structure.addAtom(o);
      structure.addAtom(h2);

      structure.calculateBonds('all');
      const bonds = structure.getBonds();
      expect(bonds).to.have.lengthOf(2);

      const bondPairs = bonds.map((b: { atomId1: string; atomId2: string }) => [b.atomId1, b.atomId2].sort());
      const expectedPairs = [
        [h1.id, o.id].sort(),
        [h2.id, o.id].sort()
      ];

      for (const expected of expectedPairs) {
        expect(bondPairs).to.deep.include(expected);
      }
    });

    it('should detect bonds in methane (CH4)', () => {
      const structure = new Structure('methane');

      const c = new Atom('C', 0, 0, 0);
      const h1 = new Atom('H', 0.63, 0.63, 0.63);
      const h2 = new Atom('H', -0.63, -0.63, 0.63);
      const h3 = new Atom('H', -0.63, 0.63, -0.63);
      const h4 = new Atom('H', 0.63, -0.63, -0.63);

      structure.addAtom(c);
      structure.addAtom(h1);
      structure.addAtom(h2);
      structure.addAtom(h3);
      structure.addAtom(h4);

      structure.calculateBonds('all');
      const bonds = structure.getBonds();
      expect(bonds).to.have.lengthOf(4);

      for (const bond of bonds) {
        expect(bond.atomId1 === c.id || bond.atomId2 === c.id).to.be.true;
      }
    });

    it('should not create bonds between distant atoms', () => {
      const structure = new Structure('test');

      const atom1 = new Atom('H', 0, 0, 0);
      const atom2 = new Atom('H', 100, 100, 100);

      structure.addAtom(atom1);
      structure.addAtom(atom2);

      structure.calculateBonds('all');
      const bonds = structure.getBonds();
      expect(bonds).to.have.lengthOf(0);
    });
  });

  describe('Clone', () => {
    it('should create a deep independent copy', () => {
      const structure = new Structure('test', true);
      const atom = new Atom('H', 0, 0, 0);
      structure.addAtom(atom);

      const cloned = structure.clone();

      expect(cloned.name).to.equal(structure.name);
      expect(cloned.isCrystal).to.equal(structure.isCrystal);
      expect(cloned.atoms).to.have.lengthOf(structure.atoms.length);
      expect(cloned.atoms[0].id).to.equal(atom.id);
      expect(cloned.atoms[0]).to.not.equal(atom);
    });

    it('should clone metadata', () => {
      const structure = new Structure('test');
      structure.metadata.set('testKey', 'testValue');

      const cloned = structure.clone();

      expect(cloned.metadata.get('testKey')).to.equal('testValue');
      expect(cloned.metadata).to.not.equal(structure.metadata);
    });

    it('should clone selective dynamics', () => {
      const structure = new Structure('test');
      const atom = new Atom('H', 0, 0, 0);
      atom.selectiveDynamics = [true, false, true];
      structure.addAtom(atom);

      const cloned = structure.clone();

      expect(cloned.atoms[0].selectiveDynamics).to.deep.equal([true, false, true]);
    });
  });

  describe('Periodic Bonds', () => {
    it('should return bonds with image info for periodic structures', () => {
      const structure = new Structure('periodic', true);
      structure.unitCell = new UnitCell(2, 2, 2, 90, 90, 90);

      const atom1 = new Atom('H', 0, 0, 0);
      const atom2 = new Atom('H', 1.9, 0, 0);

      structure.addAtom(atom1);
      structure.addAtom(atom2);

      structure.calculateBonds('all');
      const bonds = structure.getPeriodicBonds();
      expect(bonds.length).to.be.greaterThan(0);
    });
  });

  describe('Supercell Generation', () => {
    it('should generate 2x2x2 supercell', () => {
      const structure = new Structure('test', true);
      structure.unitCell = new UnitCell(2, 2, 2, 90, 90, 90);

      const atom = new Atom('H', 0.5, 0.5, 0.5);
      structure.addAtom(atom);

      const supercell = structure.generateSupercell(2, 2, 2);

      expect(supercell.atoms).to.have.lengthOf(8);
      expect(supercell.unitCell?.a).to.equal(4);
      expect(supercell.unitCell?.b).to.equal(4);
      expect(supercell.unitCell?.c).to.equal(4);
    });

    it('should throw for non-crystal structures', () => {
      const structure = new Structure('test', false);
      const atom = new Atom('H', 0, 0, 0);
      structure.addAtom(atom);

      expect(() => structure.generateSupercell(2, 2, 2)).to.throw('Supercell generation requires a crystal structure');
    });
  });

  describe('Center of Mass', () => {
    it('should calculate center of mass correctly', () => {
      const structure = new Structure('test');

      const h1 = new Atom('H', -1, 0, 0);
      const h2 = new Atom('H', 1, 0, 0);

      structure.addAtom(h1);
      structure.addAtom(h2);

      const com = structure.getCenterOfMass();
      expect(com[0]).to.be.closeTo(0, 0.01);
      expect(com[1]).to.be.closeTo(0, 0.01);
      expect(com[2]).to.be.closeTo(0, 0.01);
    });

    it('should return [0, 0, 0] for empty structure', () => {
      const structure = new Structure('empty');
      const com = structure.getCenterOfMass();
      expect(com).to.deep.equal([0, 0, 0]);
    });
  });

  describe('Metadata', () => {
    it('should store and retrieve metadata', () => {
      const structure = new Structure('test');

      structure.metadata.set('charge', -1);
      structure.metadata.set('multiplicity', 2);

      expect(structure.metadata.get('charge')).to.equal(-1);
      expect(structure.metadata.get('multiplicity')).to.equal(2);
    });

    it('should serialize metadata to JSON', () => {
      const structure = new Structure('test');
      structure.metadata.set('charge', -1);
      structure.metadata.set('multiplicity', 2);

      const json = structure.toJSON();
      expect(json.metadata).to.be.an('array');
      expect(json.metadata).to.have.lengthOf(2);
    });
  });
});