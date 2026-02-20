/**
 * Represents a single atom in a molecular or crystal structure
 */
export class Atom {
  id: string;
  element: string;
  x: number;
  y: number;
  z: number;
  selected: boolean = false;
  fixed: boolean = false;

  constructor(
    element: string,
    x: number,
    y: number,
    z: number,
    id?: string
  ) {
    this.element = element;
    this.x = x;
    this.y = y;
    this.z = z;
    this.id = id || `atom_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get position as array
   */
  getPosition(): [number, number, number] {
    return [this.x, this.y, this.z];
  }

  /**
   * Set position
   */
  setPosition(x: number, y: number, z: number): void {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  /**
   * Calculate distance to another atom
   */
  distanceTo(other: Atom): number {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    const dz = this.z - other.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Clone this atom
   */
  clone(): Atom {
    const cloned = new Atom(this.element, this.x, this.y, this.z);
    cloned.selected = this.selected;
    cloned.fixed = this.fixed;
    return cloned;
  }

  /**
   * Convert to JSON
   */
  toJSON() {
    return {
      id: this.id,
      element: this.element,
      x: this.x,
      y: this.y,
      z: this.z,
      fixed: this.fixed,
    };
  }
}
