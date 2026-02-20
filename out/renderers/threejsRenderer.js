"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThreeJSRenderer = void 0;
const elementData_1 = require("../utils/elementData");
/**
 * Three.js renderer wrapper for webview
 */
class ThreeJSRenderer {
    state;
    constructor(structure) {
        this.state = {
            structure,
            visualizationMode: 'ballAndStick',
            showUnitCell: !!structure.unitCell,
            selectedAtomIds: [],
        };
    }
    /**
     * Get current state
     */
    getState() {
        return this.state;
    }
    /**
     * Update structure
     */
    setStructure(structure) {
        this.state.structure = structure;
    }
    /**
     * Toggle visualization mode
     */
    toggleVisualization() {
        this.state.visualizationMode =
            this.state.visualizationMode === 'ballAndStick'
                ? 'spaceFilling'
                : 'ballAndStick';
    }
    /**
     * Set unit cell visibility
     */
    setShowUnitCell(show) {
        this.state.showUnitCell = show;
    }
    /**
     * Select atom
     */
    selectAtom(atomId) {
        this.setSelection([atomId]);
    }
    /**
     * Set full selection list
     */
    setSelection(atomIds) {
        for (const atom of this.state.structure.atoms) {
            atom.selected = false;
        }
        const validIds = [];
        for (const id of atomIds) {
            const atom = this.state.structure.getAtom(id);
            if (atom) {
                atom.selected = true;
                validIds.push(id);
            }
        }
        this.state.selectedAtomIds = validIds;
        this.state.selectedAtomId = validIds.length > 0 ? validIds[validIds.length - 1] : undefined;
    }
    /**
     * Deselect current atom
     */
    deselectAtom() {
        this.setSelection([]);
    }
    /**
     * Get message for webview to render
     */
    getRenderMessage() {
        return {
            command: 'render',
            data: {
                atoms: this.getAtomGeometry(),
                bonds: this.getBondGeometry(),
                unitCell: this.state.showUnitCell
                    ? this.getUnitCellGeometry()
                    : null,
                mode: this.state.visualizationMode,
                selectedAtomId: this.state.selectedAtomId,
                selectedAtomIds: this.state.selectedAtomIds,
            },
        };
    }
    /**
     * Generate atom geometry data for webview
     */
    getAtomGeometry() {
        return this.state.structure.atoms.map((atom) => {
            const info = elementData_1.ELEMENT_DATA[atom.element];
            const baseRadius = this.state.visualizationMode === 'spaceFilling'
                ? info?.vdwRadius || 1.5
                : info?.covalentRadius || 0.3;
            const radius = Math.max(baseRadius * 0.35, 0.1);
            return {
                id: atom.id,
                element: atom.element,
                position: [atom.x, atom.y, atom.z],
                radius: radius,
                color: info?.color || '#C0C0C0',
                selected: atom.selected,
            };
        });
    }
    /**
     * Generate bond geometry data for webview
     */
    getBondGeometry() {
        const bonds = this.state.structure.getBonds();
        return bonds.map((bond) => {
            const atom1 = this.state.structure.getAtom(bond.atomId1);
            const atom2 = this.state.structure.getAtom(bond.atomId2);
            if (!atom1 || !atom2) {
                return null;
            }
            return {
                atomId1: atom1.id,
                atomId2: atom2.id,
                start: [atom1.x, atom1.y, atom1.z],
                end: [atom2.x, atom2.y, atom2.z],
                radius: 0.04,
                color: '#C0C0C0',
            };
        }).filter((b) => b !== null);
    }
    /**
     * Generate unit cell geometry data for webview
     */
    getUnitCellGeometry() {
        if (!this.state.structure.unitCell) {
            return null;
        }
        const vectors = this.state.structure.unitCell.getLatticeVectors();
        // 8 corners of the unit cell
        const corners = [
            [0, 0, 0],
            vectors[0],
            vectors[1],
            [vectors[0][0] + vectors[1][0], vectors[0][1] + vectors[1][1], vectors[0][2] + vectors[1][2]],
            vectors[2],
            [vectors[0][0] + vectors[2][0], vectors[0][1] + vectors[2][1], vectors[0][2] + vectors[2][2]],
            [vectors[1][0] + vectors[2][0], vectors[1][1] + vectors[2][1], vectors[1][2] + vectors[2][2]],
            [
                vectors[0][0] + vectors[1][0] + vectors[2][0],
                vectors[0][1] + vectors[1][1] + vectors[2][1],
                vectors[0][2] + vectors[1][2] + vectors[2][2],
            ],
        ];
        // 12 edges of the unit cell
        const edges = [
            [0, 1],
            [2, 3],
            [4, 5],
            [6, 7],
            [0, 2],
            [1, 3],
            [4, 6],
            [5, 7],
            [0, 4],
            [1, 5],
            [2, 6],
            [3, 7],
        ];
        return {
            corners,
            edges: edges.map((e) => ({
                start: corners[e[0]],
                end: corners[e[1]],
                radius: 0.08,
                color: '#FF6600',
            })),
        };
    }
}
exports.ThreeJSRenderer = ThreeJSRenderer;
//# sourceMappingURL=threejsRenderer.js.map