# ACoord

**Version:** 0.3.10  
**License:** MIT  
**Repository:** https://github.com/wxia529/vscode-acoord

Atomic Coordinate Toolkit (ACoord) is a VS Code extension for **3D visualization and editing of atomic, molecular, and crystal structures**. It combines the convenience of a code editor with powerful molecular visualization, enabling you to view, edit, and convert structure files without leaving VS Code.

![License](https://img.shields.io/badge/License-MIT-yellow.svg)

---

## Features

### Core Capabilities

- **Interactive 3D Viewer** — Real-time rendering with selection, measurement, and editing
- **15 File Format Support** — XYZ, CIF, POSCAR, XDATCAR, OUTCAR, PDB, Gaussian, ORCA, Quantum ESPRESSO, ABACUS STRU, CASTEP, SIESTA, and more
- **Trajectory Visualization** — Frame-by-frame navigation for MD simulations and geometry optimizations
- **Crystal Structure Tools** — Lattice editing, supercell generation, periodic bond display
- **Advanced Display Controls** — Lighting, color schemes, projection modes, atom sizing

### Editing Features

- **Atom Manipulation** — Move, add, delete, copy/paste atoms
- **Bond Management** — Manual bond creation/deletion, automatic bond detection
- **Lattice Editing** — Modify unit cell parameters with optional atom scaling
- **Selection Tools** — Single-click, multi-select, box selection
- **Measurement** — Bond lengths, bond angles, dihedral angles
- **Fixed Atoms** — Mark atoms as fixed for geometry optimization (syncs with selective dynamics)

### Display & Visualization

- **Dual Projection Modes** — Orthographic and perspective camera
- **Lighting System** — Ambient, key, fill, and rim lights with interactive picker
- **Color Schemes** — Built-in presets (Bright, JMol, CPK) and custom schemes
- **Axis Indicator** — Real-time 3D orientation overlay
- **HD Image Export** — High-resolution PNG export from any viewpoint
- **Supercell Display** — Visualize periodic boundaries with proper bond rendering

### Productivity

- **Format Preservation** — Save GJF, XYZ, ORCA, QE, STRU files while preserving headers and keywords
- **Undo/Redo** — Full undo/redo support for all structural edits
- **Keyboard Shortcuts** — Extensive keyboard bindings for efficient editing
- **Right-Click Context Menu** — Quick access to atom and bond operations
- **Element Picker** — Interactive periodic table for element selection
- **Clipboard Operations** — Copy/paste atoms within and across sessions

---

## Supported File Formats

### Full Support (Read + Write)

| Format | Extensions | Notes |
|--------|------------|-------|
| **XYZ / extXYZ** | `.xyz`, `.extxyz` | Trajectory support for multi-frame files |
| **CIF** | `.cif` | Full crystallographic data |
| **POSCAR** | `POSCAR`, `CONTCAR`, `.vasp` | Selective dynamics preserved via fixed flags |
| **PDB** | `.pdb` | Basic CRYST1 + ATOM/HETATM records |
| **Gaussian Input** | `.gjf` | Preserves route section and metadata |
| **ORCA Input** | `.inp` | Preserves ! settings and blocks |
| **Quantum ESPRESSO Input** | `.in`, `.pwi` | Preserves &CONTROL, &SYSTEM, &ELECTRONS sections |
| **ABACUS STRU** | `.STRU` | Fixed atoms as `0 0 0`, free atoms as `1 1 1` |
| **ACoord Native** | `.acoord` | JSON format preserving all atom properties |

### Trajectory Support (Read Only)

| Format | Extensions | Notes |
|--------|------------|-------|
| **XDATCAR** | `XDATCAR`, `.xdatcar` | VASP MD trajectories |
| **OUTCAR** | `OUTCAR`, `.outcar` | VASP output with POSITION blocks |
| **QE Output** | `.out`, `.pwo`, `.log` | Multiple ATOMIC_POSITIONS blocks |
| **CASTEP Output** | `.castep` | Geometry optimization and MD trajectories |

### Partial Support

| Format | Extensions | Notes |
|--------|------------|-------|
| **CASTEP Cell** | `.cell` | LATTICE_CART, POSITIONS_ABS/FRAC, constraints |
| **SIESTA FDF** | `.fdf` | LatticeVectors, AtomicCoordinates, preserves parameters |

---

## Installation

### From VS Code Marketplace

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "ACoord"
4. Click Install

### From Source

```bash
git clone https://github.com/wxia529/vscode-acoord.git
cd vscode-acoord
npm install
npm run compile
# Press F5 to launch Extension Development Host
```

---

## Quick Start

### Opening a Structure File

1. Open any supported structure file in VS Code (e.g., `structure.cif`, `POSCAR`)
2. Click the **preview icon** in the editor title bar, or
3. Run `ACoord: Open Structure Editor` from Command Palette (Ctrl+Shift+P)

### Basic Operations

| Action | Method |
|--------|--------|
| **Rotate view** | Left mouse drag in empty space |
| **Pan view** | Middle mouse drag or right mouse drag |
| **Zoom** | Mouse wheel |
| **Select atom** | Click an atom in the canvas |
| **Multi-select** | Ctrl/Cmd+click to add atoms |
| **Box select** | Shift+drag in empty space |
| **Move atoms** | Shift+drag selected atoms |
| **Delete atoms** | Press Delete/Backspace |
| **Add atom** | Use Add Atom panel or press `A` |

### Measurement

Select 2, 3, or 4 atoms to display:
- **2 atoms** — Bond length (Å)
- **3 atoms** — Bond angle (degrees)
- **4 atoms** — Dihedral angle (degrees)

### Saving and Export

1. Click **Save** (Ctrl+S) to save in current format
2. Click **Save As** (Ctrl+Shift+S) to choose format
3. Click **Export Image** to save high-resolution PNG

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Delete` / `Backspace` | Delete selected atom(s) |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `Ctrl+S` | Save structure |
| `Ctrl+Shift+S` | Save as |
| `Ctrl+C` | Copy selected atoms |
| `Ctrl+V` | Paste atoms |
| `A` | Focus Add Atom form |

---

## Display Controls

### Projection Modes

- **Orthographic** — Parallel projection, no perspective distortion (default)
- **Perspective** — Realistic perspective view

Toggle in the **View** panel or use keyboard shortcuts.

### Lighting

Adjust lighting in the **Lighting** panel:
- **Ambient** — Base illumination
- **Key Light** — Primary light source (drag picker in canvas)
- **Fill Light** — Secondary fill light
- **Rim Light** — Backlighting for depth
- **Shininess** — Surface specular highlight

### Color Schemes

Choose from built-in presets or create custom schemes:
- **Bright** — High-contrast colors (default)
- **JMol** — JMol-compatible colors
- **CPK** — Traditional CPK coloring

Apply to selected atoms using the **Apply** button.

---

## Advanced Features

### Trajectory Navigation

For multi-frame files (XDATCAR, trajectory XYZ, etc.):

1. Open the **Trajectory** panel
2. Use frame navigation buttons or slider
3. Click **Play** for automatic playback
4. Adjust playback speed (1-30 fps)

### Supercell Generation

1. Open the **Lattice** panel
2. Set supercell dimensions (Nx, Ny, Nz)
3. Click **Apply Supercell**
4. Periodic bonds are automatically displayed

### Lattice Editing

1. Open the **Lattice** panel
2. Modify a/b/c parameters or alpha/beta/gamma angles
3. Optionally check **Scale atoms with lattice**
4. Click **Apply Lattice**

### Fixed Atoms

Mark atoms as fixed for geometry optimization:
1. Select atoms
2. Right-click → **Fix atom** (or **Unfix atom**)
3. Fixed atoms display with white 3D cross markers
4. Saved as selective dynamics flags in POSCAR/STRU

---

## Native Format (.acoord)

ACoord includes a native JSON format that preserves all atom properties:

```json
{
  "version": "1.0",
  "atoms": [
    {
      "id": "atom_uuid",
      "element": "C",
      "x": 0.0,
      "y": 0.0,
      "z": 0.0,
      "color": "#333333",
      "radius": 0.77,
      "label": "C1",
      "fixed": false
    }
  ],
  "unitCell": {
    "a": 10.0, "b": 10.0, "c": 10.0,
    "alpha": 90, "beta": 90, "gamma": 90
  }
}
```

**What gets saved:**
- Atom positions, elements, colors, radii, labels
- Fixed flags and selective dynamics
- Unit cell parameters
- Manual bonds

**What is NOT saved:**
- Display settings (lighting, background, etc.) — these are per-session preferences

---

## Troubleshooting

### File Not Opening

- Check file extension is supported
- Verify file is not corrupted
- Check OUTPUT panel (View → Output → ACoord) for errors

### Rendering Issues

- Try toggling projection mode
- Reset camera with **Reset** button
- Check browser console (Help → Toggle Developer Tools → Console)

### Performance Problems

- Large structures (>5000 atoms) may be slow
- Disable supercell display for large structures
- Reduce bond detection complexity

---

## Development

For architecture details and contribution guidelines, see [DEVELOPMENT.md](DEVELOPMENT.md).

### Quick Start for Developers

```bash
# Install dependencies
npm install

# Start watch mode (auto-rebuild on save)
npm run watch

# Run unit tests
npm run test:unit

# Run linting
npm run lint

# Launch Extension Development Host (F5 in VS Code)
```

---

## License

MIT License — see [LICENSE](LICENSE) for details.

## Acknowledgments

- **Three.js** — 3D rendering engine
- **VS Code** — Extension platform
- **Community** — File format specifications and test files

## Contact

- **Issues:** https://github.com/wxia529/vscode-acoord/issues
- **Discussions:** https://github.com/wxia529/vscode-acoord/discussions
