import { RenderMessageBuilder } from '../renderers/renderMessageBuilder.js';
import { Atom } from '../models/atom.js';
import { UndoManager } from '../providers/undoManager.js';
import { TrajectoryManager } from '../providers/trajectoryManager.js';
import { parseElement, getDefaultAtomRadius, ELEMENT_DATA } from '../utils/elementData.js';
import { BRIGHT_SCHEME } from '../config/presets/color-schemes/index.js';
import { DisplaySettings } from '../config/types.js';
import { ColorScheme } from '../shared/protocol.js';

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

/**
 * Service for atom editing operations (add, delete, move, copy, change element).
 * 
 * Color/radius priority when creating or modifying atoms:
 * 1. DisplaySettings.currentColorByElement / currentRadiusByElement (user overrides)
 * 2. ColorScheme.colors (current color scheme)
 * 3. ELEMENT_DATA defaults (JMol colors, covalent radii with visual scale)
 * 
 * Key principle: All color/radius computation happens here (Extension side).
 * The webview only renders the pre-computed values stored in atom.color/atom.radius.
 */
export class AtomEditService {
  private sessionRef?: { 
    displaySettings?: DisplaySettings;
    getColorScheme?: () => ColorScheme | null;
  };

  constructor(
    private renderer: RenderMessageBuilder,
    private trajectoryManager: TrajectoryManager,
    private undoManager: UndoManager
  ) {}

  setSessionRef(ref: { 
    displaySettings?: DisplaySettings;
    getColorScheme?: () => ColorScheme | null;
  }): void {
    this.sessionRef = ref;
  }

  /**
   * Add a new atom with color/radius from current DisplaySettings.
   * Uses the "current brush" concept - applies active color scheme and radius scale.
   */
  addAtom(element: string, x: number, y: number, z: number): boolean {
    const parsedElement = parseElement(element);
    if (!parsedElement) {
      return false;
    }

    if (!this.trajectoryManager.isEditing) {
      this.trajectoryManager.beginEdit();
    }
    const editStructure = this.trajectoryManager.activeStructure;
    
    const { color, radius } = this.computeAtomProperties(parsedElement);
    
    const atom = new Atom(parsedElement, x, y, z, undefined, {
      color,
      radius,
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
        atom.z + (offset.z || 0),
        undefined,
        {
          color: atom.color,
          radius: atom.radius,
          label: atom.label,
          fixed: atom.fixed,
          selectiveDynamics: atom.selectiveDynamics,
        }
      );
      editStructure.addAtom(copy);
    }
    this.renderer.setStructure(editStructure);
    this.trajectoryManager.commitEdit();
  }

  /**
   * Change the element type of atoms and update their color/radius accordingly.
   */
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
    
    const { color, radius } = this.computeAtomProperties(parsedElement);
    
    for (const id of atomIds) {
      const atom = editStructure.getAtom(id);
      if (atom) {
        atom.element = parsedElement;
        atom.color = color;
        atom.radius = radius;
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

  /**
   * Set radius of selected atoms to their element's covalent radius (unscaled).
   */
  setCovalentRadius(atomIds: string[]): boolean {
    if (atomIds.length === 0) {
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
        const covalentRadius = ELEMENT_DATA[atom.element]?.covalentRadius;
        atom.radius = covalentRadius ?? 0.3;
      }
    }
    this.renderer.setStructure(editStructure);
    this.trajectoryManager.commitEdit();
    return true;
  }

  /**
   * Apply current DisplaySettings to selected atoms ("Apply to Selection" action).
   * Updates atom.color and atom.radius based on current brush settings.
   */
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
        const { color, radius } = this.computeAtomProperties(atom.element);
        atom.color = color;
        atom.radius = radius;
      }
    }
    this.renderer.setStructure(editStructure);
    this.trajectoryManager.commitEdit();
    return true;
  }

  /**
   * Compute color and radius for an element using current DisplaySettings.
   * Priority: user overrides > color scheme > element defaults.
   */
  private computeAtomProperties(element: string): { color: string; radius: number } {
    const settings = this.sessionRef?.displaySettings;
    const colorScheme = this.sessionRef?.getColorScheme?.();
    
    let color: string;
    if (settings?.currentColorByElement?.[element]) {
      color = settings.currentColorByElement[element];
    } else if (colorScheme?.colors[element]) {
      color = colorScheme.colors[element];
    } else {
      color = BRIGHT_SCHEME.colors[element] || '#C0C0C0';
    }
    
    let radius: number;
    if (settings?.currentRadiusByElement?.[element]) {
      radius = settings.currentRadiusByElement[element];
    } else {
      const baseRadius = getDefaultAtomRadius(element);
      radius = settings?.currentRadiusScale !== undefined 
        ? baseRadius * settings.currentRadiusScale 
        : baseRadius;
    }
    
    return { color, radius };
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
