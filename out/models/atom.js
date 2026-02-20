"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Atom = void 0;
/**
 * Represents a single atom in a molecular or crystal structure
 */
class Atom {
    id;
    element;
    x;
    y;
    z;
    selected = false;
    fixed = false;
    constructor(element, x, y, z, id) {
        this.element = element;
        this.x = x;
        this.y = y;
        this.z = z;
        this.id = id || `atom_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Get position as array
     */
    getPosition() {
        return [this.x, this.y, this.z];
    }
    /**
     * Set position
     */
    setPosition(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
    /**
     * Calculate distance to another atom
     */
    distanceTo(other) {
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        const dz = this.z - other.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    /**
     * Clone this atom
     */
    clone() {
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
exports.Atom = Atom;
//# sourceMappingURL=atom.js.map