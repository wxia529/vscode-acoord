# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.7]

### Fixed

- File extension detection for paths containing dots (e.g., `OUT.cell-relax/STRU_ION10_D`). Previously, `split('.')` incorrectly extracted `cell-relax/STRU_ION10_D` as the extension, now correctly identifies it as ABACUS STRU format

## [0.3.6]

### Changed

- Minimum VS Code version requirement lowered from 1.109.0 to 1.90.0 for broader compatibility

## [0.3.5]

### Added

- CASTEP .cell format support:
  - Parse LATTICE_CART and LATTICE_ABC blocks
  - Parse POSITIONS_ABS (Cartesian) and POSITIONS_FRAC (fractional) blocks
  - Support custom species notation (e.g., Fe:1, O:custom)
  - Parse IONIC_CONSTRAINTS block and map to selectiveDynamics/fixed flags
  - Preserve SPIN, LABEL, and SPECIES_MASS metadata
  - Unit conversion (bohr, nm, pm, cm, m) with CODATA2002 standard
  - Round-trip serialization preserving all metadata
- CASTEP .castep output format support:
  - Parse lattice from "Unit Cell" block
  - Parse atomic positions from "Fractional coordinates of atoms" block
  - Trajectory extraction from BFGS geometry optimization and MD iterations

## [0.3.4]

### Fixed

- Right-drag rotation now correctly persists atom positions after the rotation operation completes. Previously, rotated atoms would snap back to their original positions when the canvas was clicked. The fix adds a proper `onSetAtomsPositions` callback to the interaction handlers, following the existing callback pattern used by other drag operations.

## [0.3.3]

### Changed

- File name recognition for POSCAR, CONTCAR, XDATCAR, OUTCAR, and STRU files now uses substring matching instead of exact match. Files containing these keywords (e.g., `POSCAR_001`, `STRU_relaxed`, `backup_CONTCAR`) are now automatically recognized and opened with ACoord

### Fixed

- Image export default directory now uses the document's location instead of home directory

## [0.3.2]

### Fixed

- XYZ file atom count not updating when saving after adding or removing atoms
- QE input file format preservation issues:
  - `parseTrajectory()` not preserving raw content, causing custom namelist parameters to be lost on save
  - Pseudopotential filenames being replaced with default values
  - Regex pattern in ATOMIC_SPECIES block incorrectly matching QE keywords (CELL_PARAMETERS, ATOMIC_POSITIONS, K_POINTS) as element symbols, causing coordinate data loss
  - `ntyp` not updating to reflect actual number of element types in structure

## [0.3.1]

### Added

- Periodic table element picker: interactive UI for element selection with hover tooltips showing element details (accessible from context menu)
- Read-only format support for specific file formats to preserve original content while allowing visualization

### Fixed

- Bond size settings not persisting across sessions
- Atom dragging behavior for smoother interaction
- View-related rendering issues
- DOM event handling issues

## [0.3.0]

### Added

- Right-click context menu in 3D canvas with atom operations, bond operations, and element selection submenus
- ACoord native format (`.acoord`): JSON-based format preserving all atom properties including user-specified colors and radii
- Enhanced axis indicator showing X/Y/Z orientation with real-time camera view updates
- Brush panel for applying color schemes to selected atoms
- Enhanced atom size and style controls with improved UI and real-time preview
- Interactive rotation tool for selected atoms with axis selection and angle control

### Changed

- Simplified configuration architecture: removed ConfigManager, ConfigStorage, and ConfigValidator; configuration now managed directly in services
- Streamlined DisplayConfigService with direct preset management

### Internal

- Added `bondSchemes.ts` with predefined bond color schemes

## [0.2.2]

### Added

- Clipboard copy/paste: `Ctrl+C` (copy selection), `Ctrl+V` (paste) with configurable offset (default 0.5Å)
- Keyboard shortcuts: `Ctrl+Y` (redo), `A` (focus add atom form)
- Format preservation on save for GJF, XYZ, ORCA, QE, and ABACUS STRU files (only coordinate data updated, original content preserved)

### Fixed

- Periodic bond detection for atoms with fractional coordinates outside `[0, 1)`: algorithm now properly filters atoms by fractional position before building spatial hashes
- Multi-atom drag plane normal calculation
- Camera controls remaining disabled after cancelled drag operations
- Atom color not updating immediately when element changes
- Duplicate "Change Element" panel removed; element changes now performed exclusively via "Selected Atom" panel

### Internal

- Added ColorScheme support

## [0.2.1]

### Fixed

- Periodic boundary condition bond detection: cross-boundary bond generation now checks if origin atom is inside unit cell to prevent duplicate bonds

## [0.2.0]

### Added

- Two-process architecture: extension host (Node.js) and webview (sandboxed browser) with strict separation
- Protocol-first design: all IPC messages defined in `src/shared/protocol.ts` with full TypeScript typing
- Dedicated services: `AtomEditService`, `BondService`, `SelectionService`, `UnitCellService`, `DocumentService`, `DisplayConfigService`
- Centralized message routing via `MessageRouter` for all webview-to-extension commands
- Configuration system with ConfigManager, ConfigStorage, and ConfigValidator
- Display settings presets (default, white) with import/export support
- JSON schema validation for user configurations with versioned migrations
- Unit test framework (Mocha) with `.mts` test files
- Parser round-trip tests for 11 file formats (XYZ, CIF, POSCAR, XDATCAR, OUTCAR, QE, PDB, GJF, ORCA, STRU)

### Changed

- Webview rewritten from JavaScript to TypeScript with strict type checking
- Modular webview architecture: `app.ts`, `renderer.ts`, `state.ts`, `interaction.ts`, and panel-specific modules
- Message dispatch uses `_exhaustive: never` pattern for compile-time completeness

### Fixed

- Proper disposal of event listeners, `requestAnimationFrame` IDs, Three.js geometries, materials, and textures

### Internal

- Optimized rendering using `THREE.InstancedMesh` for atoms and bonds
- Spatial hash-based bond detection for O(n) amortized performance
- Debounced trajectory slider and display settings controls
- Local preview updates during atom dragging

## [0.1.11]

### Added

- Keyboard shortcuts: Delete/Backspace (delete selected), Ctrl/Cmd+Z (undo), Ctrl/Cmd+S (save), Ctrl/Cmd+Shift+S (save as)
- Canvas-based light direction picking for Key/Fill/Rim lights
- Light color controls for ambient/key/fill/rim lights
- Surface shininess control for atom/bond material gloss
- Inline numeric edit for slider values (double-click value label, press Enter to apply)

### Changed

- Key Light default direction to (0, 0, 10)
- Lighting defaults: Ambient Intensity to 0.4, Key Light Intensity to 0.7
- Default Key Light color to #CCCCCC

### Fixed

- Lighting defaults/updates not preserving zero values for X/Y/Z and intensity controls

## [0.1.10]

### Added

- Axis display toggle switch
- Atomic radius display settings

## [0.1.9]

### Fixed

- XDATCAR trajectory parsing for files with `Direct configuration=     N` frame markers

## [0.1.8]

### Added

- HD PNG export from 3D view
- Quantum ESPRESSO input/output parsing and IO support (`.in/.pwi/.out/.pwo/.log`) with trajectory extraction
- Trajectory IO for XYZ/EXTXYZ (read, display, export)
- Trajectory playback with adjustable speed (newly opened trajectories default to last frame)
- Adaptive multi-row tab layout for sidebar when width is limited
- Unit-cell display controls for lattice thickness and solid/dashed line style
- XDATCAR trajectory read/write support
- OUTCAR trajectory read support

### Changed

- Improved POSCAR read/write compatibility (VASP 4/5 style headers, scaling factors, selective dynamics)
- Improved playback stability by disposing WebGL resources during re-render

## [0.1.7]

### Added

- Bond thickness control in Display Scale panel with real-time rendering updates

### Changed

- Sidebar reorganized into 4 tabs (Edit, Lattice, Display, Tools)
- Atom Color moved to top of Display tab; Copy/Delete actions restored to top toolbar
- Atom size slider precision refined (step 0.05, 2 decimal places display)
- Atom size slider maximum reduced from 20 to 3

### Fixed

- CIF I/O handling

## [0.1.6]

### Added

- Atom color editing for selected atoms (bond colors synchronized)
- Bond editing workflow: select bond in canvas, create bond from selected atoms, delete selected bond
- `Recalculate All Bonds` action to rebuild auto bonds from current positions
- Click-empty-space behavior to clear current atom/bond selection
- Atom color preview in Atom Color panel based on current selection
- Copy selected atoms action in toolbar (duplicate with offset)
- Display settings panel for background color and unit-cell color
- Full lighting controls (ambient/key/fill/rim) with reset action
- Toolbar actions to open source text and reload structure from disk

## [0.1.5]

### Changed

- ABACUS STRU export to use ONCV pseudopotentials and include NUMERICAL_ORBITAL defaults

## [0.1.4]

### Added

- Box selection for atoms (Shift-drag to select in screen space)
- Bottom status bar showing render status and selected atom coordinates

### Changed

- Multi-select dragging to keep movement in the view plane

## [0.1.3]

### Added

- Lattice editing panel with apply/remove and center-to-cell actions
- Orthographic projection option with view controls
- Supercell display and periodic bond rendering

### Changed

- Export naming defaults
- CIF export validation

## [0.1.2]

### Fixed

- Various bug fixes

## [0.1.1]

### Added

- Undo support for rotation
- 0-360 degree rotation support

### Changed

- Improved rotation preview rendering performance

## [0.1.0]

### Added

- Initial release
