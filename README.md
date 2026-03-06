# ACoord

**Version:** 0.2.2  
**License:** GPL-3.0-only

Atomic Coordinate Toolkit (ACoord) is a VS Code extension for 3D visualization and editing of atomic, molecular, and crystal structures. It supports 12 file formats and provides interactive 3D rendering via Three.js inside VS Code's Custom Editor API.

## Features

- 3D viewer (Three.js) with selection, measurement, and basic editing.
- Trajectory support (frame navigation + playback speed control) for XYZ, QE logs, XDATCAR, and OUTCAR.
- Projection toggle (orthographic/perspective).
- Lattice editor (a/b/c + alpha/beta/gamma) with optional atom scaling.
- Supercell display with periodic bonds.
- Unit-cell display tuning (color, thickness, solid/dashed line style).
- Lighting controls (ambient/key/fill/rim) with canvas drag picker for light direction.
- Center atoms to unit cell (with confirmation).
- Manual and auto scaling for atom size and scene scale.
- Format conversion through Save As.
- HD PNG export from the current 3D view (custom file name/location).
- Display settings configuration with import/export, presets, and migrations.
- Atom color schemes with custom color editing and preset/user scheme management.
- Clipboard operations (Ctrl+C/V) for copying and pasting atomic selections across sessions.
- Extended keyboard shortcuts: Delete/Backspace (delete), Ctrl+Z (undo), Ctrl+Y (redo), Ctrl+S (save), Ctrl+Shift+S (save as), Ctrl+C (copy), Ctrl+V (paste), A (focus add atom form).
- Format preservation on save for GJF, XYZ, ORCA, QE input/output, and ABACUS STRU files.

## Supported Formats

Input and output:

- XYZ / extxyz (trajectory support)
- CIF
- POSCAR / VASP / CONTCAR (Selective dynamics preserved via fixed flags)
- XDATCAR trajectory (.xdatcar / XDATCAR)
- OUTCAR trajectory read (.outcar / OUTCAR)
- PDB (basic CRYST1 + ATOM/HETATM)
- Gaussian input (.gjf)
- ORCA input (.inp)
- Quantum ESPRESSO input (.in / .pwi)
- Quantum ESPRESSO output log (.out / .pwo / .log)
- ABACUS STRU (.stru)

### Notes

- extxyz: comment line may include `Lattice="..."` and `Properties=species:S:1:pos:R:3`.
- XYZ trajectory files (multi-frame XYZ/extxyz) can be opened and exported.
- QE output logs with multiple `ATOMIC_POSITIONS` blocks are loaded as trajectories.
- POSCAR: improved parsing for VASP 4/5 styles, scaling factors, and selective dynamics flags.
- XDATCAR trajectories can be opened and exported.
- OUTCAR can be read as trajectory frames from `POSITION ... TOTAL-FORCE` blocks.
- STRU: fixed atoms are written as `0 0 0` and free atoms `1 1 1`.
- ORCA export uses the default header:
  - `! B3LYP D3 def2-SVP`
  - `%maxcore     8192`
  - `%pal nprocs   8 end`
- GJF export uses:
  - `#P`
  - blank line
  - `Gaussian input`
- Format preservation: GJF, XYZ, ORCA, QE, and STRU files preserve original content (headers, keywords, pseudopotentials) with only coordinate data updated on save.

## Usage

1. Open a supported structure file.
2. Click the preview icon in the editor title (or run `ACoord: Open Structure Editor`).
3. Edit atoms in the 3D view and side panel.
4. Use **Save** or **Save As** from the toolbar.

## Basic Operations

- Select atoms: click an atom in the canvas or the atom list.
- Multi-select: Ctrl or Cmd click to add/remove.
- Move atoms: Shift drag selected atoms in the canvas.
- Box select: Shift drag in empty space to select multiple atoms in screen space.
- Rotate selection: pick axis (X/Y/Z) and move the angle slider (0-360).
- Change element: use the Selected Atom panel and click Apply.
- Add or delete atoms: use the Add Atom panel or Delete button.
- Keyboard shortcuts: 
  - Delete/Backspace: delete selected atom(s)
  - Ctrl/Cmd+Z: undo
  - Ctrl/Cmd+Y: redo
  - Ctrl/Cmd+S: save
  - Ctrl/Cmd+Shift+S: save as
  - Ctrl/Cmd+C: copy selected atoms
  - Ctrl/Cmd+V: paste atoms
  - A: focus add atom form
- Measure: select 2 atoms for bond length, 3 atoms for bond angle.
- Adjust Distance: select at least two atoms; the last selected is the reference, and the rest move together along the reference-to-nearest-adsorbate direction to the target distance.
- Scale: enable Auto scale or adjust Manual scale and Atom size.
- Lighting: adjust ambient/key/fill/rim intensity and color, tune surface shininess, or click "Pick in Canvas" under Key/Fill/Rim and drag in viewport to set light direction.
- Slider values: double-click the numeric value label, type a number, and press Enter to apply.
- Color schemes: apply preset or custom color schemes, create custom schemes, import/export schemes.
- Display configs: save custom display configurations, import/export configs, apply presets.


## Development

For architecture details, contribution guidelines, and developer documentation, see [DEVELOPMENT.md](DEVELOPMENT.md).

## License

GPL-3.0-only. See [LICENSE](LICENSE).
