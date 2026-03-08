import { RenderMessageBuilder } from '../renderers/renderMessageBuilder.js';
import { Atom } from '../models/atom.js';
import { UndoManager } from '../providers/undoManager.js';
import { TrajectoryManager } from '../providers/trajectoryManager.js';
import { parseElement, getDefaultAtomColor, getDefaultAtomRadius } from '../utils/elementData.js';
import { DisplaySettings } from '../config/types.js';

export interface PositionUpdate {
  id: string;
  x: number;
  y: number;
  z: number;
}

export interface CopyOffset {
  x: number;
  y: number;
  z: number;
}

export class AtomEditService {
  private sessionRef?: { displaySettings?: DisplaySettings };

  constructor(
    private renderer: RenderMessageBuilder,
    private trajectoryManager: TrajectoryManager,
    private undoManager: UndoManager
  ) {}

  setSessionRef(ref: { displaySettings?: DisplaySettings }): void {
    this.sessionRef = ref;
  }

  addAtom(element: string, x: number, y: number, z: number): boolean {
    const parsedElement = parseElement(element);
    if (!parsedElement) {
      return false;
    }

    if (!this.trajectoryManager.isEditing) {
      this.trajectoryManager.beginEdit();
    }
    const editStructure = this.trajectoryManager.activeStructure;
    
    const atom = new Atom(parsedElement, x, y, z, undefined, {
      color: getDefaultAtomColor(parsedElement),
      radius: getDefaultAtomRadius(parsedElement),
    });
    this.undoManager.push(editStructure);
    editStructure.addAtom(atom);
    this.renderer.setStructure(editStructure);
    this.trajectoryManager.commitEdit();
    return true;
  }

  deleteAtom(atomId: string): void {
    if (!this.trajectoryManager.isEditing) {
      this.trajectoryManager.beginEdit();
    }
    const editStructure = this.trajectoryManager.activeStructure;
    
    this.undoManager.push(editStructure);
    editStructure.removeAtom(atomId);
    this.renderer.setStructure(editStructure);
    this.trajectoryManager.commitEdit();
  }

  deleteAtoms(atomIds: string[]): void {
    const uniqueIds = Array.from(
      new Set(atomIds.filter((id): id is string => typeof id === 'string' && id.length > 0))
    );
    
    if (uniqueIds.length === 0) {
      return;
    }

    if (!this.trajectoryManager.isEditing) {
      this.trajectoryManager.beginEdit();
    }
    const editStructure = this.trajectoryManager.activeStructure;
    
    this.undoManager.push(editStructure);
    for (const atomId of uniqueIds) {
      editStructure.removeAtom(atomId);
    }
    this.renderer.setStructure(editStructure);
    this.trajectoryManager.commitEdit();
  }

  moveAtom(atomId: string, x: number, y: number, z: number, preview: boolean = false): void {
    if (!this.trajectoryManager.isEditing) {
      this.trajectoryManager.beginEdit();
    }
    const editStructure = this.trajectoryManager.activeStructure;
    
    const atom = editStructure.getAtom(atomId);
    if (atom) {
      atom.setPosition(x, y, z);
      this.renderer.setStructure(editStructure);
      if (!preview) {
        this.trajectoryManager.commitEdit();
      }
    }
  }

  moveGroup(atomIds: string[], dx: number, dy: number, dz: number, preview: boolean = false): void {
    if (atomIds.length === 0) {
      return;
    }

    if (!this.trajectoryManager.isEditing) {
      this.trajectoryManager.beginEdit();
    }
    const editStructure = this.trajectoryManager.activeStructure;
    
    for (const id of atomIds) {
      const atom = editStructure.getAtom(id);
      if (atom) {
        atom.setPosition(atom.x + dx, atom.y + dy, atom.z + dz);
      }
    }
    this.renderer.setStructure(editStructure);
    if (!preview) {
      this.trajectoryManager.commitEdit();
    }
  }

  setAtomPositions(updates: PositionUpdate[], preview: boolean = false): void {
    if (updates.length === 0) {
      return;
    }

    if (!this.trajectoryManager.isEditing) {
      this.trajectoryManager.beginEdit();
    }
    const editStructure = this.trajectoryManager.activeStructure;
    
    for (const update of updates) {
      const atom = editStructure.getAtom(update.id);
      if (atom) {
        atom.setPosition(update.x, update.y, update.z);
      }
    }
    this.renderer.setStructure(editStructure);
    if (!preview) {
      this.trajectoryManager.commitEdit();
    }
  }

  copyAtoms(atomIds: string[], offset: CopyOffset): void {
    if (atomIds.length === 0) {
      return;
    }

    if (!this.trajectoryManager.isEditing) {
      this.trajectoryManager.beginEdit();
    }
    const editStructure = this.trajectoryManager.activeStructure;
    
    this.undoManager.push(editStructure);
    for (const id of atomIds) {
      const atom = editStructure.getAtom(id);
      if (!atom) {continue;}
      
      const copy = new Atom(
        atom.element,
        atom.x + (offset.x || 0),
        atom.y + (offset.y || 0),
        atom.z + (offset.z || 0)
      );
      editStructure.addAtom(copy);
    }
    this.renderer.setStructure(editStructure);
    this.trajectoryManager.commitEdit();
  }

  changeAtoms(atomIds: string[], element: string): boolean {
    if (atomIds.length === 0) {
      return false;
    }

    const parsedElement = parseElement(element);
    if (!parsedElement) {
      throw new Error(`changeAtoms: invalid element symbol "${element}"`);
    }

    if (!this.trajectoryManager.isEditing) {
      this.trajectoryManager.beginEdit();
    }
    const editStructure = this.trajectoryManager.activeStructure;
    
    this.undoManager.push(editStructure);
    for (const id of atomIds) {
      const atom = editStructure.getAtom(id);
      if (atom) {
        atom.element = parsedElement;
        atom.color = getDefaultAtomColor(parsedElement);
        atom.radius = getDefaultAtomRadius(parsedElement);
      }
    }
    this.renderer.setStructure(editStructure);
    this.trajectoryManager.commitEdit();
    return true;
  }

  setAtomColor(atomIds: string[], color: string): boolean {
    if (atomIds.length === 0 || !/^#[0-9a-fA-F]{6}$/.test(color)) {
      return false;
    }

    if (!this.trajectoryManager.isEditing) {
      this.trajectoryManager.beginEdit();
    }
    const editStructure = this.trajectoryManager.activeStructure;
    
    this.undoManager.push(editStructure);
    for (const id of atomIds) {
      const atom = editStructure.getAtom(id);
      if (atom) {
        atom.color = color;
      }
    }
    this.renderer.setStructure(editStructure);
    this.trajectoryManager.commitEdit();
    return true;
  }

  setAtomRadius(atomIds: string[], radius: number): boolean {
    if (atomIds.length === 0 || !Number.isFinite(radius) || radius <= 0) {
      return false;
    }

    if (!this.trajectoryManager.isEditing) {
      this.trajectoryManager.beginEdit();
    }
    const editStructure = this.trajectoryManager.activeStructure;
    
    this.undoManager.push(editStructure);
    for (const id of atomIds) {
      const atom = editStructure.getAtom(id);
      if (atom) {
        atom.radius = radius;
      }
    }
    this.renderer.setStructure(editStructure);
    this.trajectoryManager.commitEdit();
    return true;
  }

  applyDisplaySettings(atomIds: string[]): boolean {
    if (atomIds.length === 0) {
      return false;
    }

    const settings = this.sessionRef?.displaySettings;
    if (!settings) {
      return false;
    }

    if (!this.trajectoryManager.isEditing) {
      this.trajectoryManager.beginEdit();
    }
    const editStructure = this.trajectoryManager.activeStructure;
    
    this.undoManager.push(editStructure);

    for (const id of atomIds) {
      const atom = editStructure.getAtom(id);
      if (atom) {
        if (settings.currentColorByElement?.[atom.element]) {
          atom.color = settings.currentColorByElement[atom.element];
        } else {
          atom.color = getDefaultAtomColor(atom.element);
        }

        if (settings.currentRadiusByElement?.[atom.element]) {
          atom.radius = settings.currentRadiusByElement[atom.element];
        } else {
          const baseRadius = getDefaultAtomRadius(atom.element);
          atom.radius = settings.currentRadiusScale !== undefined 
            ? baseRadius * settings.currentRadiusScale 
            : baseRadius;
        }
      }
    }
    this.renderer.setStructure(editStructure);
    this.trajectoryManager.commitEdit();
    return true;
  }

  updateAtom(
    atomId: string,
    options: { element?: string; x?: number; y?: number; z?: number }
  ): boolean {
    if (!this.trajectoryManager.isEditing) {
      this.trajectoryManager.beginEdit();
    }
    const editStructure = this.trajectoryManager.activeStructure;
    
    const atom = editStructure.getAtom(atomId);
    if (!atom) {
      return false;
    }

    this.undoManager.push(editStructure);
    
    if (options.element) {
      const parsedElement = parseElement(options.element);
      if (parsedElement) {
        atom.element = parsedElement;
      }
    }
    
    if (
      typeof options.x === 'number' &&
      typeof options.y === 'number' &&
      typeof options.z === 'number'
    ) {
      atom.setPosition(options.x, options.y, options.z);
    }
    
    this.renderer.setStructure(editStructure);
    this.trajectoryManager.commitEdit();
    return true;
  }
}
