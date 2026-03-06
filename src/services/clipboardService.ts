import { WireAtom, WireClipboardData } from '../shared/protocol.js';
import { Atom } from '../models/atom.js';
import { Structure } from '../models/structure.js';
import { ELEMENT_DATA } from '../utils/elementData.js';

/**
 * Global clipboard service shared across all editor sessions.
 * Enables cross-window copy/paste operations.
 */
export class ClipboardService {
  private clipboard: WireClipboardData | null = null;
  private readonly MAX_ATOMS = 10000;

  copy(atomIds: string[], structure: Structure, sessionKey: string, documentUri: string): void {
    if (atomIds.length === 0) {
      return;
    }

    const atomsToCopy: WireAtom[] = [];
    for (const id of atomIds) {
      const atom = structure.getAtom(id);
      if (atom) {
        const elementInfo = ELEMENT_DATA[atom.element];
        atomsToCopy.push({
          id: atom.id,
          element: atom.element,
          color: atom.color || elementInfo?.color || '#C0C0C0',
          position: [atom.x, atom.y, atom.z],
          radius: elementInfo?.covalentRadius || 0.7,
        });
      }
    }

    if (atomsToCopy.length === 0) {
      return;
    }

    if (atomsToCopy.length > this.MAX_ATOMS) {
      throw new Error(`Cannot copy more than ${this.MAX_ATOMS} atoms`);
    }

    this.clipboard = {
      sourceSession: sessionKey,
      sourceDocument: documentUri,
      timestamp: Date.now(),
      atoms: atomsToCopy,
      offset: { x: 0.5, y: 0.5, z: 0.5 },
    };
  }

  paste(structure: Structure, offset?: { x: number; y: number; z: number }): string[] {
    if (!this.clipboard || this.clipboard.atoms.length === 0) {
      throw new Error('Clipboard is empty');
    }

    const pasteOffset = offset || this.clipboard.offset;
    const newAtomIds: string[] = [];

    for (const wireAtom of this.clipboard.atoms) {
      const atom = new Atom(
        wireAtom.element,
        wireAtom.position[0] + pasteOffset.x,
        wireAtom.position[1] + pasteOffset.y,
        wireAtom.position[2] + pasteOffset.z
      );
      atom.color = wireAtom.color;
      structure.addAtom(atom);
      newAtomIds.push(atom.id);
    }

    return newAtomIds;
  }

  hasContent(): boolean {
    return this.clipboard !== null && this.clipboard.atoms.length > 0;
  }

  getAtomCount(): number {
    return this.clipboard ? this.clipboard.atoms.length : 0;
  }

  getSourceDocument(): string | null {
    return this.clipboard ? this.clipboard.sourceDocument : null;
  }

  clear(): void {
    this.clipboard = null;
  }
}
