import { expect } from 'chai';
import { Structure } from '../../../models/structure.js';
import { Atom } from '../../../models/atom.js';
import { UnitCell } from '../../../models/unitCell.js';

describe('Periodic Bonds - Out-of-Cell Atoms', () => {
  it('should form bonds with atoms outside the left boundary (close distance)', () => {
    const structure = new Structure('test', true);
    structure.unitCell = new UnitCell(5, 5, 5, 90, 90, 90);

    const atom_out_left = new Atom('H', -0.5, 2.5, 2.5);
    const atom_in = new Atom('H', 4.6, 2.5, 2.5);
    
    structure.addAtom(atom_out_left);
    structure.addAtom(atom_in);

    structure.calculateBonds('all');
    const bonds = structure.getPeriodicBonds();
    
    expect(bonds).to.have.lengthOf(1);
    expect(bonds[0].image?.[0]).to.not.equal(0);
  });

  it('should form bonds with atoms outside the right boundary (close distance)', () => {
    const structure = new Structure('test', true);
    structure.unitCell = new UnitCell(5, 5, 5, 90, 90, 90);

    const atom_in = new Atom('H', 0.4, 2.5, 2.5);
    const atom_out_right = new Atom('H', 5.5, 2.5, 2.5);
    
    structure.addAtom(atom_in);
    structure.addAtom(atom_out_right);

    structure.calculateBonds('all');
    const bonds = structure.getPeriodicBonds();
    
    expect(bonds).to.have.lengthOf(1);
    expect(bonds[0].image?.[0]).to.not.equal(0);
  });

  it('should form bonds across periodic boundary when both atoms are inside', () => {
    const structure = new Structure('test', true);
    structure.unitCell = new UnitCell(5, 5, 5, 90, 90, 90);

    const atom_left = new Atom('H', 0.1, 2.5, 2.5);
    const atom_right = new Atom('H', 4.9, 2.5, 2.5);
    
    structure.addAtom(atom_left);
    structure.addAtom(atom_right);

    structure.calculateBonds('all');
    const bonds = structure.getPeriodicBonds();
    
    expect(bonds).to.have.lengthOf(1);
    expect(bonds[0].image?.[0]).to.not.equal(0);
  });

  it('should NOT form bonds with atoms far outside the cell (too far to bond)', () => {
    const structure = new Structure('test', true);
    structure.unitCell = new UnitCell(5, 5, 5, 90, 90, 90);

    const atom_in = new Atom('H', 2.5, 2.5, 2.5);
    const atom_far_left = new Atom('H', -22.5, 2.5, 2.5);
    
    structure.addAtom(atom_in);
    structure.addAtom(atom_far_left);

    structure.calculateBonds('all');
    const bonds = structure.getPeriodicBonds();
    
    expect(bonds).to.have.lengthOf(0);
  });

  it('should handle atoms exactly on the boundary', () => {
    const structure = new Structure('test', true);
    structure.unitCell = new UnitCell(5, 5, 5, 90, 90, 90);

    const atom_at_origin = new Atom('H', 0, 2.5, 2.5);
    const atom_middle = new Atom('H', 2.5, 2.5, 2.5);
    
    structure.addAtom(atom_at_origin);
    structure.addAtom(atom_middle);

    structure.calculateBonds('all');
    const bonds = structure.getPeriodicBonds();
    
    expect(bonds).to.have.lengthOf(0);
  });
});
