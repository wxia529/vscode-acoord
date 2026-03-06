# Changelog

All notable changes to this project will be documented in this file.

## 0.2.2

### New features

- **Clipboard Copy/Paste**: Full clipboard support for atomic structures via `Ctrl+C` / `Ctrl+V` shortcuts. The `ClipboardService` enables cross-session copy/paste operations with configurable offset (default 0.5Å in each direction).
- **Enhanced Keyboard Shortcuts**: Added `Ctrl+C` (copy selection), `Ctrl+V` (paste), `Ctrl+Y` (redo), and `A` (focus add atom form) to the existing keyboard shortcut set.
- **Format Preservation on Save**: When editing GJF, XYZ, ORCA, QE, and ABACUS STRU files, ACoord now preserves original format-specific content and only updates coordinate data. This ensures user configurations are not lost during editing:

### Bug Fixes

- **Periodic Bond Detection for Out-of-Cell Atoms**: Fixed asymmetric bond detection where atoms with fractional coordinates outside `[0, 1)` would incorrectly form bonds. The algorithm now properly filters atoms by fractional position before building spatial hashes for periodic images, preventing ghost bonds and ensuring symmetric bond detection regardless of atom placement direction.
- **Multi-Atom Drag Plane Calculation**: Fixed drag plane normal calculation when dragging multiple atoms simultaneously, ensuring movement stays in the correct view plane.
- **Camera Control During Drag**: Fixed issue where camera controls remained disabled after cancelled drag operations.
- **Element Change Color Update**: Fixed bug where changing an atom's element did not immediately update its color to the new element's default. The `changeAtoms` method now clears the atom's custom color when the element changes.
- **UI Cleanup**: Removed duplicate "Change Element" panel; element changes are now performed exclusively via the "Selected Atom" panel for a cleaner interface.
- **ColorSchem**: Add ColorScheme

## 0.2.1

### Bug Fixes

- **Periodic Boundary Condition Bond Detection**: Fixed cross-boundary bond generation to prevent duplicate bonds when atoms are outside the unit cell. The algorithm now checks if the origin atom is inside the unit cell before generating bonds to periodic images, ensuring correct bonding visualization for supercell structures.

## 0.2.0

### Major Architecture Refactoring

This release includes a complete architectural overhaul for improved maintainability, type safety, and testability. The changes span 32 commits since v0.1.11.

#### Two-Process Architecture

- **Separated Extension Host and Webview**: Implemented a strict two-process architecture with the extension host running in Node.js and the webview in a sandboxed browser environment.
- **Protocol-First Design**: All messages between processes are defined in `src/shared/protocol.ts` with full TypeScript typing; no `any` types on message boundaries.
- **Service Isolation**: Extracted domain logic into dedicated services:
  - `AtomEditService` - atom manipulation (add, delete, move, copy, recolor)
  - `BondService` - bond creation, deletion, and recalculation
  - `SelectionService` - atom and bond selection state management
  - `UnitCellService` - unit cell CRUD, supercell, and centering operations
  - `DocumentService` - save, save-as, reload, and image export
  - `DisplayConfigService` - display settings lifecycle
- **Centralized Message Routing**: `MessageRouter` is the single dispatch point for all 37 webview-to-extension commands with typed handlers.

#### Configuration System

- **User Configuration Management**: Full configuration system with ConfigManager, ConfigStorage, and ConfigValidator.
- **Display Settings Presets**: Built-in immutable presets (default, white) plus user-created custom configs.
- **Import/Export**: Support for importing and exporting display configuration files.
- **Schema Validation**: JSON schema validation for all user-created configurations.
- **Versioned Migrations**: Automatic schema upgrades when stored config versions are outdated.

#### Webview Modernization

- **JavaScript to TypeScript Migration**: Complete rewrite of webview code from JS to TS with strict type checking.
- **Modular Architecture**: Split monolithic app.js into focused modules:
  - `app.ts` - bootstrap and message dispatch
  - `renderer.ts` - Three.js scene management
  - `state.ts` - reactive stores for UI state
  - `interaction.ts` - mouse/keyboard/pointer event handling
  - `appEdit.ts`, `appLattice.ts`, `appView.ts`, `appTools.ts`, `appTrajectory.ts` - UI panels
- **Resource Management**: Proper disposal of all event listeners, `requestAnimationFrame` IDs, Three.js geometries, materials, and textures.
- **Instanced Rendering**: Optimized rendering using `THREE.InstancedMesh` for atoms and bonds.

#### Type Safety & Code Quality

- **Strict TypeScript**: Enabled strict mode with `noImplicitAny`, `strictNullChecks`, `noUnusedLocals`, `noUnusedParameters`.
- **Exhaustive Pattern Matching**: Message dispatch uses `_exhaustive: never` pattern to catch missing cases at compile time.
- **Protocol Types**: All wire-format types (WireAtom, WireBond, WireDisplaySettings, etc.) are centrally defined.

#### Testing Infrastructure

- **Unit Test Framework**: Added Mocha-based unit test framework using `.mts` (ES Module TypeScript) files.
- **Parser Tests**: Round-trip tests for all 11 supported file formats (XYZ, CIF, POSCAR, XDATCAR, OUTCAR, QE, PDB, GJF, ORCA, STRU).
- **Service Tests**: Unit tests for AtomEditService, BondService, SelectionService, MessageRouter, and UndoManager.
- **Model Tests**: Unit tests for Structure and UnitCell models.
- **Test Fixtures**: Added representative test files for each supported format.

### Performance Improvements

- **Drag Preview Optimization**: Local preview updates during atom dragging without round-tripping to the extension host.
- **Debounced Controls**: Trajectory slider and display settings sliders are debounced to avoid flooding the extension host.
- **Optimized Bond Detection**: Spatial hash-based bond detection for O(n) amortized performance.
- **Display Settings Optimization**: Improved performance of display settings updates.

### Bug Fixes

## 0.1.11

- Added keyboard shortcuts in the structure editor: Delete/Backspace (delete selected atom(s)), Ctrl/Cmd+Z (undo), Ctrl/Cmd+S (save), Ctrl/Cmd+Shift+S (save as).
- Added canvas-based light direction picking for Key/Fill/Rim lights via "Pick in Canvas".
- Fixed lighting defaults/updates to preserve zero values for X/Y/Z and intensity controls.
- Changed Key Light default direction to (0, 0, 10).
- Updated lighting defaults: Ambient Intensity = 0.4 and Key Light Intensity = 0.7.
- Added light color controls for ambient/key/fill/rim lights.
- Updated default Key Light color to #CCCCCC.
- Added surface shininess control for atom/bond material gloss.
- Added inline numeric edit for slider values (double-click value label, press Enter to apply).

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
