/**
 * Represents a single atom in a molecular or crystal structure.
 * 
 * All atoms have required color and radius properties that define their visual
 * appearance. These are set during creation (by parsers or user actions) and
 * are NOT computed at render time. This ensures consistent display across all
 * frontends (webview, Jupyter, etc.).
 * 
 * Key principle: Extension owns all computation, webview only renders.
 */
export class Atom {
  id: string;
  element: string;
  x: number;
  y: number;
  z: number;
  
  /**
   * Current visual color as CSS hex string (e.g., "#FF0D0D").
   * Always has a value - set by parser or user action.
   * Not computed at render time.
   */
  color: string;
  
  /**
   * Current visual radius in Angstroms.
   * This is the final display radius (covalent radius * visual scale factor).
   * Always has a value - set by parser or user action.
   * Not computed at render time.
   * 
   * Use DisplaySettings.currentRadiusScale to apply additional user-controlled scaling.
   */
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
    this.radius = options?.radius ?? 0.35;
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
