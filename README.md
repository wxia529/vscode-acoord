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

- XYZ / extxyz (reads Lattice and Properties when present).
- CIF
- POSCAR / VASP (Selective dynamics preserved via fixed flags).
- PDB (basic CRYST1 + ATOM/HETATM)
- Gaussian input (.gjf / .com)
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

## Development

### Prerequisites

- Node.js (LTS recommended)
- npm

### Install

```bash
npm install
```

### Build

```bash
npm run compile
```

### Watch mode

```bash
npm run watch
```

### Run the extension

- Press `F5` in VS Code to launch the Extension Development Host.
- Open a structure file and use the ACoord preview.

## Project Structure

```
src/
  extension.ts            Extension entry
  providers/              Custom editor provider
  renderers/              Three.js renderer
  io/                     Format parsers and file manager
  models/                 Atom, Structure, UnitCell
  webview/                UI (HTML/CSS/JS)
```

## License

Specify your license here.
