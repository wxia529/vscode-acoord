import { expect } from 'chai';
import { Structure } from '../../../models/structure.js';
import { Atom } from '../../../models/atom.js';
import { ClipboardService } from '../../../services/clipboardService.js';
import { getDefaultAtomRadius } from '../../../utils/elementData.js';
import { BRIGHT_SCHEME } from '../../../config/presets/color-schemes/index.js';

function makeStructure(): Structure {
  const s = new Structure('test');
  s.addAtom(new Atom('C', 0, 0, 0, undefined, {
    color: BRIGHT_SCHEME.colors['C'] || '#C0C0C0',
    radius: getDefaultAtomRadius('C'),
  }));
  s.addAtom(new Atom('O', 1.5, 0, 0, undefined, {
    color: BRIGHT_SCHEME.colors['O'] || '#C0C0C0',
    radius: getDefaultAtomRadius('O'),
  }));
  s.addAtom(new Atom('H', 0, 1.5, 0, undefined, {
    color: BRIGHT_SCHEME.colors['H'] || '#C0C0C0',
    radius: getDefaultAtomRadius('H'),
  }));
  return s;
}

describe('ClipboardService', () => {
  describe('copy', () => {
    it('should copy selected atoms to clipboard', () => {
      const structure = makeStructure();
      const clipboard = new ClipboardService();
      const atomIds = [structure.atoms[0].id, structure.atoms[1].id];
      
      clipboard.copy(atomIds, structure, 'session_1', '/test/file.xyz');
      
      expect(clipboard.hasContent()).to.be.true;
      expect(clipboard.getAtomCount()).to.equal(2);
      expect(clipboard.getSourceDocument()).to.equal('/test/file.xyz');
    });

    it('should handle empty atomIds array', () => {
      const structure = makeStructure();
      const clipboard = new ClipboardService();
      
      clipboard.copy([], structure, 'session_1', '/test/file.xyz');
      
      expect(clipboard.hasContent()).to.be.false;
    });

    it('should ignore invalid atom IDs', () => {
      const structure = makeStructure();
      const clipboard = new ClipboardService();
      
      clipboard.copy(['invalid_id'], structure, 'session_1', '/test/file.xyz');
      
      expect(clipboard.hasContent()).to.be.false;
    });
  });

  describe('paste', () => {
    it('should paste atoms with default offset', () => {
      const structure = makeStructure();
      const clipboard = new ClipboardService();
      const atomIds = [structure.atoms[0].id];
      
      clipboard.copy(atomIds, structure, 'session_1', '/test/file.xyz');
      
      const newAtomIds = clipboard.paste(structure);
      
      expect(newAtomIds).to.have.lengthOf(1);
      expect(structure.atoms).to.have.lengthOf(4);
      
      const newAtom = structure.getAtom(newAtomIds[0]);
      expect(newAtom!.x).to.closeTo(0.5, 0.0001);
      expect(newAtom!.y).to.closeTo(0.5, 0.0001);
      expect(newAtom!.z).to.closeTo(0.5, 0.0001);
    });

    it('should paste atoms with custom offset', () => {
      const structure = makeStructure();
      const clipboard = new ClipboardService();
      
      clipboard.copy([structure.atoms[0].id], structure, 'session_1', '/test/file.xyz');
      
      const newAtomIds = clipboard.paste(structure, { x: 1.0, y: 2.0, z: 3.0 });
      
      const newAtom = structure.getAtom(newAtomIds[0]);
      expect(newAtom!.x).to.closeTo(1.0, 0.0001);
      expect(newAtom!.y).to.closeTo(2.0, 0.0001);
      expect(newAtom!.z).to.closeTo(3.0, 0.0001);
    });

    it('should throw error when clipboard is empty', () => {
      const structure = makeStructure();
      const clipboard = new ClipboardService();
      
      expect(() => clipboard.paste(structure)).to.throw('Clipboard is empty');
    });

    it('should preserve atom element and color', () => {
      const structure = makeStructure();
      const clipboard = new ClipboardService();
      
      clipboard.copy([structure.atoms[1].id], structure, 'session_1', '/test/file.xyz');
      
      const newAtomIds = clipboard.paste(structure);
      const newAtom = structure.getAtom(newAtomIds[0]);
      
      expect(newAtom!.element).to.equal('O');
      expect(newAtom!.color).to.equal(BRIGHT_SCHEME.colors['O']);
    });
  });

  describe('cross-session clipboard', () => {
    it('should allow paste from different session', () => {
      const structure1 = makeStructure();
      const structure2 = new Structure('test2');
      const clipboard = new ClipboardService();
      
      clipboard.copy([structure1.atoms[0].id], structure1, 'session_1', '/test/file1.xyz');
      
      const newAtomIds = clipboard.paste(structure2);
      
      expect(newAtomIds).to.have.lengthOf(1);
      expect(structure2.atoms).to.have.lengthOf(1);
    });
  });

  describe('clear', () => {
    it('should clear clipboard content', () => {
      const structure = makeStructure();
      const clipboard = new ClipboardService();
      
      clipboard.copy([structure.atoms[0].id], structure, 'session_1', '/test/file.xyz');
      expect(clipboard.hasContent()).to.be.true;
      
      clipboard.clear();
      
      expect(clipboard.hasContent()).to.be.false;
      expect(clipboard.getAtomCount()).to.equal(0);
    });
  });
});
