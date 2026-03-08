/**
 * Represents a single atom in a molecular or crystal structure
 */
export class Atom {
  id: string;
  element: string;
  x: number;
  y: number;
  z: number;
  color: string;
  radius: number;
  label?: string;
  selected: boolean = false;
  fixed: boolean = false;
  selectiveDynamics?: [boolean, boolean, boolean];

  constructor(
    element: string,
    x: number,
    y: number,
    z: number,
    id?: string,
    options?: {
      color?: string;
      radius?: number;
      label?: string;
      fixed?: boolean;
      selectiveDynamics?: [boolean, boolean, boolean];
    }
  ) {
    this.element = element;
    this.x = x;
    this.y = y;
    this.z = z;
    this.id = id || `atom_${crypto.randomUUID()}`;
    this.color = options?.color || '#C0C0C0';
    this.radius = options?.radius ?? 1.0;
    this.label = options?.label;
    this.fixed = options?.fixed ?? false;
    this.selectiveDynamics = options?.selectiveDynamics;
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
    const cloned = new Atom(this.element, this.x, this.y, this.z, this.id, {
      color: this.color,
      radius: this.radius,
      label: this.label,
      fixed: this.fixed,
      selectiveDynamics: this.selectiveDynamics ? [...this.selectiveDynamics] as [boolean, boolean, boolean] : undefined,
    });
    cloned.selected = this.selected;
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
      color: this.color,
      radius: this.radius,
      label: this.label,
      fixed: this.fixed,
      selectiveDynamics: this.selectiveDynamics,
    };
  }
}
