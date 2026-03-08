import { expect } from 'chai';
import { Structure } from '../../../models/structure.js';
import { Atom } from '../../../models/atom.js';
import { RenderMessageBuilder } from '../../../renderers/renderMessageBuilder.js';
import { TrajectoryManager } from '../../../providers/trajectoryManager.js';
import { UndoManager } from '../../../providers/undoManager.js';
import { SelectionService } from '../../../services/selectionService.js';
import { BondService } from '../../../services/bondService.js';

function makeH2O(): Structure {
  const s = new Structure('H2O');
  s.addAtom(new Atom('O', 0, 0, 0));
  s.addAtom(new Atom('H', 0.757, 0.586, 0));
  s.addAtom(new Atom('H', -0.757, 0.586, 0));
  return s;
}

function makeServices(structure: Structure): {
  renderer: RenderMessageBuilder;
  tm: TrajectoryManager;
  um: UndoManager;
  sel: SelectionService;
  svc: BondService;
} {
  const renderer = new RenderMessageBuilder(structure);
  const tm = new TrajectoryManager([structure], 0);
  const um = new UndoManager();
  const sel = new SelectionService(renderer);
  const svc = new BondService(renderer, tm, um, sel);
  return { renderer, tm, um, sel, svc };
}

describe('BondService', () => {
  describe('createBond', () => {
    it('should create a bond between two atoms', () => {
      const s = makeH2O();
      const { svc, tm } = makeServices(s);
      const [o, h1] = s.atoms;
      svc.createBond(o.id, h1.id);
      const bonds = tm.activeStructure.bonds;
      expect(bonds).to.have.length.greaterThan(0);
      const bondKey = Structure.bondKey(o.id, h1.id);
      expect(bonds.some((b) => Structure.bondKey(b[0], b[1]) === bondKey)).to.be.true;
    });

    it('should push an undo snapshot when creating a bond', () => {
      const s = makeH2O();
      const { svc, um } = makeServices(s);
      const [o, h1] = s.atoms;
      expect(um.isEmpty).to.be.true;
      svc.createBond(o.id, h1.id);
      expect(um.isEmpty).to.be.false;
    });

    it('should not create a self-bond', () => {
      const s = makeH2O();
      const { svc, tm } = makeServices(s);
      const [o] = s.atoms;
      const before = tm.activeStructure.bonds.length;
      svc.createBond(o.id, o.id);
      expect(tm.activeStructure.bonds).to.have.lengthOf(before);
    });

    it('should not create a bond with an invalid atom id', () => {
      const s = makeH2O();
      const { svc, tm } = makeServices(s);
      const [o] = s.atoms;
      const before = tm.activeStructure.bonds.length;
      svc.createBond(o.id, 'nonexistent-id');
      expect(tm.activeStructure.bonds).to.have.lengthOf(before);
    });
  });

  describe('deleteBond', () => {
    it('should delete a bond by bondKey', () => {
      const s = makeH2O();
      const { svc, tm } = makeServices(s);
      const [o, h1] = s.atoms;
      svc.createBond(o.id, h1.id);
      const bondKey = Structure.bondKey(o.id, h1.id);
      svc.deleteBond(bondKey);
      const bonds = tm.activeStructure.bonds;
      expect(bonds.some((b) => Structure.bondKey(b[0], b[1]) === bondKey)).to.be.false;
    });

    it('should delete bonds by bondKeys array', () => {
      const s = makeH2O();
      const { svc, tm } = makeServices(s);
      const [o, h1, h2] = s.atoms;
      svc.createBond(o.id, h1.id);
      svc.createBond(o.id, h2.id);
      const bk1 = Structure.bondKey(o.id, h1.id);
      const bk2 = Structure.bondKey(o.id, h2.id);
      svc.deleteBond(undefined, undefined, [bk1, bk2]);
      expect(tm.activeStructure.bonds).to.have.lengthOf(0);
    });

    it('should not error when given a non-existent bond key', () => {
    });
  });

  describe('calculateBonds', () => {
    it('should calculate bonds based on covalent radii', () => {
      const s = makeH2O();
      const { svc, tm } = makeServices(s);
      expect(tm.activeStructure.bonds.length).to.equal(0);
      svc.calculateBonds('all');
      expect(tm.activeStructure.bonds.length).to.be.greaterThan(0);
    });
  });

  describe('clearBonds', () => {
    it('should clear all bonds', () => {
      const s = makeH2O();
      const { svc, tm } = makeServices(s);
      const [o, h1] = s.atoms;
      svc.createBond(o.id, h1.id);
      expect(tm.activeStructure.bonds.length).to.be.greaterThan(0);
      svc.clearBonds();
      expect(tm.activeStructure.bonds).to.have.lengthOf(0);
    });
  });

  describe('setBondLength', () => {
    it('should adjust atom position to match new bond length', () => {
      const s = makeH2O();
      const { svc, tm } = makeServices(s);
      const [o, h1] = s.atoms;
      const newLength = 2.0;
      svc.setBondLength([o.id, h1.id], newLength);
      const updatedO = tm.activeStructure.getAtom(o.id)!;
      const updatedH1 = tm.activeStructure.getAtom(h1.id)!;
      const dx = updatedH1.x - updatedO.x;
      const dy = updatedH1.y - updatedO.y;
      const dz = updatedH1.z - updatedO.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      expect(dist).to.be.closeTo(newLength, 1e-6);
    });

    it('should do nothing with fewer than 2 atom ids', () => {
      const s = makeH2O();
      const { svc } = makeServices(s);
      expect(() => svc.setBondLength(['atom-1'], 2.0)).to.not.throw();
    });
  });
});
