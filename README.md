# ACoord

Atomic Coordinate Toolkit for visualizing and editing atomic structures inside VS Code.

## Features

- 3D viewer (Three.js) with selection, measurement, and basic editing.
- Unit cell visualization for crystal structures.
- Manual and auto scaling for atom size and scene scale.
- Save and Save As from the preview panel.
- Format conversion through Save As.

## Supported Formats

Input and output:

- XYZ
- CIF
- POSCAR / VASP (Selective dynamics preserved via fixed flags).
- PDB (basic CRYST1 + ATOM/HETATM)
- Gaussian input (.gjf)
- ORCA input (.inp)
- ABACUS STRU (.stru)

### Notes

- extxyz: comment line may include `Lattice="..."` and `Properties=species:S:1:pos:R:3`.
- POSCAR: fixed atoms are written as `F F F` in Selective dynamics.
- STRU: fixed atoms are written as `0 0 0` and free atoms `1 1 1`.
- ORCA export uses the default header:
  - `! B3LYP D3 def2-SVP`
  - `%maxcore     8192`
  - `%pal nprocs   8 end`
- GJF export uses:
  - `#P`
  - blank line
  - `Gaussian input`

## Usage

1. Open a supported structure file.
2. Click the preview icon in the editor title (or run `ACoord: Open Structure Editor`).
3. Edit atoms in the 3D view and side panel.
4. Use **Save** or **Save As** from the toolbar.

## Basic Operations

- Select atoms: click an atom in the canvas or the atom list.
- Multi-select: Ctrl or Cmd click to add/remove; Shift drag keeps selection.
- Move atoms: Shift drag selected atoms in the canvas.
- Rotate selection: pick axis (X/Y/Z) and move the angle slider (0-360).
- Change element: use the Change Element panel and Apply to Selected.
- Add or delete atoms: use the Add Atom panel or Delete button.
- Measure: select 2 atoms for bond length, 3 atoms for bond angle.
- Toggle display: use Toggle View or Unit Cell.
- Scale: enable Auto scale or adjust Manual scale and Atom size.


## License

GPL-3.0-only. See [LICENSE](LICENSE).
