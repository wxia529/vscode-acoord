import { Structure } from '../models/structure';

const MAX_ATOMS_FOR_UNDO = 5000;
const MAX_MEMORY_MB = 100;
const ESTIMATED_BYTES_PER_ATOM = 200;

export class UndoManager {
  private readonly undoStack: Structure[] = [];
  private readonly redoStack: Structure[] = [];
  private readonly maxDepth: number;
  private readonly maxAtoms: number;
  private warnedAboutSize = false;

  constructor(maxDepth: number = 100, maxAtoms: number = MAX_ATOMS_FOR_UNDO) {
    this.maxDepth = maxDepth;
    this.maxAtoms = maxAtoms;
  }

  private estimateMemoryUsage(structure: Structure): number {
    return structure.atoms.length * ESTIMATED_BYTES_PER_ATOM;
  }

  private canAffordUndo(structure: Structure): boolean {
    const atomCount = structure.atoms.length;
    if (atomCount > this.maxAtoms) {
      if (!this.warnedAboutSize) {
        console.warn(
          `UndoManager: Structure has ${atomCount} atoms (max: ${this.maxAtoms}). ` +
          `Undo disabled for this edit to prevent memory issues.`
        );
        this.warnedAboutSize = true;
      }
      return false;
    }

    let currentMemory = this.undoStack.reduce(
      (sum, s) => sum + this.estimateMemoryUsage(s),
      0
    );
    const newMemory = this.estimateMemoryUsage(structure);
    const maxMemoryBytes = MAX_MEMORY_MB * 1024 * 1024;

    if (currentMemory + newMemory > maxMemoryBytes) {
      while (
        this.undoStack.length > 0 &&
        currentMemory + newMemory > maxMemoryBytes
      ) {
        const removed = this.undoStack.shift()!;
        const removedMemory = this.estimateMemoryUsage(removed);
        currentMemory -= removedMemory;
      }
    }

    return true;
  }

  push(structure: Structure): void {
    if (!this.canAffordUndo(structure)) {
      return;
    }
    this.undoStack.push(structure.clone());
    if (this.undoStack.length > this.maxDepth) {
      this.undoStack.shift();
    }
    this.redoStack.length = 0;
  }

  pop(): Structure | null {
    return this.undoStack.pop() ?? null;
  }

  redo(): Structure | null {
    return this.redoStack.pop() ?? null;
  }

  pushToRedo(structure: Structure): void {
    if (!this.canAffordUndo(structure)) {
      return;
    }
    this.redoStack.push(structure.clone());
    if (this.redoStack.length > this.maxDepth) {
      this.redoStack.shift();
    }
  }

  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.warnedAboutSize = false;
  }

  get isEmpty(): boolean {
    return this.undoStack.length === 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  get depth(): number {
    return this.undoStack.length;
  }

  get redoDepth(): number {
    return this.redoStack.length;
  }

  get estimatedMemoryMB(): number {
    const undoBytes = this.undoStack.reduce(
      (sum, s) => sum + this.estimateMemoryUsage(s),
      0
    );
    const redoBytes = this.redoStack.reduce(
      (sum, s) => sum + this.estimateMemoryUsage(s),
      0
    );
    return (undoBytes + redoBytes) / (1024 * 1024);
  }
}
