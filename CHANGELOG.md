# Changelog

All notable changes to this project will be documented in this file.

## 0.1.10

- Added a toggle switch for axis display.
- Add atomic radius display settings
- Bug fixes.

## 0.1.9

- Fixed XDATCAR trajectory parsing for files that use `Direct configuration=     N` frame markers.

## 0.1.8

- Added HD PNG export from the 3D view.
- Added Quantum ESPRESSO input/output parsing and IO support (`.in/.pwi/.out/.pwo/.log`), including trajectory extraction from QE output.
- Added trajectory IO for XYZ/EXTXYZ, with support for reading, displaying, and exporting trajectory data.
- Added trajectory playback with adjustable speed, defaulting newly opened trajectories to the last frame.
- Improved playback stability by disposing WebGL resources during re-render and reducing frame-request buildup.
- Improved sidebar tab usability with adaptive multi-row tab layout when width is limited.
- Added unit-cell display controls for lattice thickness and solid/dashed line style.
- Improved POSCAR read/write compatibility (VASP 4/5 style headers, scaling factors, selective dynamics handling).
- Added XDATCAR trajectory read/write support.
- Added OUTCAR trajectory read support.

## 0.1.7

- Reorganized the sidebar into 4 tabs (Edit, Lattice, Display, Tools) to reduce scrolling.
- Moved Atom Color to the top of the Display tab and restored Copy/Delete actions to the top toolbar.
- Added bond thickness control in Display Scale panel with real-time rendering updates.
- Refined Atom size slider precision (step 0.05) and updated value display to 2 decimal places.
- Reduced Atom size slider maximum from 20 to 3 for tighter visual scaling control.
- Refined CIF io.

## 0.1.6

- Added atom color editing for selected atoms, with bond segment colors synchronized to atom colors.
- Added bond editing workflow: select bond in canvas, create bond from selected atoms, and delete selected bond.
- Added one-click `Recalculate All Bonds` action to rebuild auto bonds from current atom positions.
- Added click-empty-space behavior to clear current atom/bond selection.
- Added atom color preview in the Atom Color panel based on current selection.
- Added copy selected atoms action in toolbar (duplicate with offset).
- Added display settings panel for background color and unit-cell color.
- Added full lighting controls (ambient/key/fill/rim) and reset lighting action.
- Added toolbar actions to open source text and reload structure from disk.

## 0.1.5

- Updated ABACUS STRU export to use ONCV pseudopotentials and include NUMERICAL_ORBITAL defaults.

## 0.1.4

- Refined multi-select dragging to keep movement in the view plane.
- Added box selection for atoms (Shift-drag to select in screen space).
- Added a bottom status bar showing render status and selected atom coordinates.

## 0.1.3

- Added lattice editing panel with apply/remove and center-to-cell actions.
- Added orthographic projection option with view controls.
- Added supercell display and periodic bond rendering.
- Improved export naming defaults and CIF export validation.

## 0.1.2

- Bug fixes.

## 0.1.1

- Added undo support for rotation.
- Enabled 0-360 degree rotation.
- Improved rotation preview rendering performance.

## 0.1.0

- Initial release.
