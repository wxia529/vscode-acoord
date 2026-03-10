# ACoord Developer Guide

**Version:** 0.3.2
**Last Updated:** 2026-03-10
**License:** GPL-3.0-only

This document is the authoritative reference for ACoord development. It
describes the **actual, current architecture** — not aspirational targets. All
new code must conform to the patterns described here. If you encounter code
that contradicts this document, fix the code (not the document) and note the
discrepancy in `CURRENT_ISSUES.md`.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Two-Process Architecture](#2-two-process-architecture)
3. [Directory Structure](#3-directory-structure)
4. [Shared Protocol — The Contract](#4-shared-protocol--the-contract)
   - 4.5 [Atom Data Model](#45-atom-data-model)
5. [Extension Host](#5-extension-host)
6. [Webview](#6-webview)
7. [I/O & Parsers](#7-io--parsers)
8. [Configuration System](#8-configuration-system)
   - 8.5 [.acoord Native File Format](#85-acoord-native-file-format)
   - 8.6 [User Interaction Patterns](#86-user-interaction-patterns)
9. [Build System](#9-build-system)
10. [Type Safety & Code Quality](#10-type-safety--code-quality)
11. [Testing](#11-testing)
12. [Performance Guidelines](#12-performance-guidelines)
13. [Error Handling](#13-error-handling)
14. [How to Add New Features](#14-how-to-add-new-features)
15. [Common Pitfalls & What Not to Do](#15-common-pitfalls--what-not-to-do)
16. [Architecture Evolution Notes](#16-architecture-evolution-notes)

---

## 1. Project Overview

ACoord (Atomic Coordinate Toolkit) is a VS Code extension for 3D visualization
and editing of atomic, molecular, and crystal structures. It supports 12 file
formats (XYZ, CIF, POSCAR, XDATCAR, OUTCAR, Quantum ESPRESSO, PDB, Gaussian
`.gjf`, ORCA `.inp`, ABACUS STRU, `.acoord` native format) and provides
interactive 3D rendering via Three.js inside VS Code's Custom Editor API.

### 1.1 Design Principles

1. **Protocol-first.** Every message between extension and webview is defined
   in `src/shared/protocol.ts` *before* implementation. Both sides import from
   this file. `any` on message boundaries is a build error.

2. **Service isolation.** Each domain concern (selection, bonds, atoms, unit
   cells, document I/O, display config) lives in its own service class. A
   service must not reach into another service's domain.

3. **Immutable model updates.** Structural edits produce a new `Structure`
   snapshot pushed onto the undo stack. Direct mutation is only permitted
   inside preview/drag operations, and must be committed or rolled back before
   the operation ends.

4. **Dispose everything.** Every event listener, `requestAnimationFrame` ID,
   Three.js geometry, material, and texture must be tracked and released in a
   `dispose()` method.

5. **No silent failures.** Operations that can fail must either throw a
   descriptive `Error` or return a typed error result. Never swallow errors
   and return a misleading `false` / empty object.

6. **Extension owns all computation.** The extension host is responsible for
   all calculations (color, radius, bond detection). The webview is a pure
   rendering surface that receives pre-computed `WireAtom`/`WireBond` data
   and displays it without modification.

7. **DisplaySettings as "current brush".** DisplaySettings represents the
   current "brush" configuration (color scheme, radius scale). It does not
   automatically apply to existing atoms. Users must explicitly "apply" to
   update atom properties. This is analogous to Photoshop's foreground color.

---

## 2. Two-Process Architecture

ACoord runs across two isolated processes connected by JSON messages:

| Process | Runtime | Entry Point | Communication |
|---|---|---|---|
| **Extension Host** | Node.js (VS Code API) | `src/extension.ts` | `webviewPanel.webview.postMessage()` / `webview.onDidReceiveMessage` |
| **Webview** | Browser (sandboxed iframe) | `media/webview/src/app.ts` | `window.addEventListener('message')` / `acquireVsCodeApi().postMessage()` |

All data crossing this boundary is serialized JSON. The wire format is defined
in `src/shared/protocol.ts`, which is the single source of truth for both sides.

```
┌───────────────────────────────────┐      JSON       ┌──────────────────────────────────────┐
│         Extension Host (Node)      │ ──────────────► │            Webview (Browser)           │
│                                   │                  │                                        │
│  StructureEditorProvider          │ ◄────────────── │  app.ts  (message switch)              │
│    └── EditorSession (per panel)  │  WebviewToExt   │    ├── renderer.ts   (Three.js)         │
│          ├── MessageRouter        │                  │    ├── state.ts      (stores)           │
│          ├── TrajectoryManager    │                  │    ├── interaction.ts (input)           │
│          ├── UndoManager          │  ExtToWebview    │    ├── settingsUtil.ts                 │
│          ├── SelectionService     │                  │    ├── appEdit / appLattice / ...       │
│          ├── BondService          │                  │    └── state/selectionManager.ts       │
│          ├── AtomEditService      │                  │                                        │
│          ├── UnitCellService      │                  │  Responsibilities:                      │
│          ├── DocumentService      │                  │    ✅ Render received data               │
│          └── DisplayConfigService │                  │    ✅ Handle user input                  │
│                                   │                  │    ✅ Send messages to extension         │
│  ColorSchemeManager  (global)     │                  │                                        │
│  FileManager    (stateless)       │                  │  Does NOT:                              │
│                                   │                  │    ❌ Compute colors/radii               │
│  Computation Logic (exclusive):   │                  │    ❌ Override atom properties           │
│    - Color calculation            │                  │    ❌ Store DisplaySettings copy          │
│    - Radius calculation           │                  │                                        │
│    - Bond detection               │                  └──────────────────────────────────────┘
└───────────────────────────────────┘
```

**The rule:** the extension host owns the authoritative model and performs all
computations. The webview is a pure rendering and input surface — it sends
user intent as messages and receives canonical data to display. The webview
never modifies model data or performs property calculations.

---

## 3. Directory Structure

```
src/
  extension.ts                 # activate() / deactivate() — thin bootstrap
  shared/
    protocol.ts                # ALL wire types and message unions (no imports)
  models/
    atom.ts                    # Atom class (id, element, position, color, radius, metadata)
    structure.ts               # Structure class (atoms, bonds, unit cell, metadata)
    unitCell.ts                # UnitCell class (lattice parameters → vectors)
    index.ts                   # Barrel re-exports
  providers/
    structureEditorProvider.ts # CustomEditorProvider lifecycle; thin orchestrator
    structureDocumentManager.ts# Load / save / export (delegates to FileManager)
    trajectoryManager.ts       # Multi-frame trajectory state
    undoManager.ts             # Undo/redo stack of Structure snapshots
  services/
    messageRouter.ts           # Command string → typed handler dispatch
    atomEditService.ts         # Add / delete / move / copy / recolor atoms
    bondService.ts             # Create / delete / recalculate bonds
    selectionService.ts        # Atom and bond selection state
    unitCellService.ts         # Unit cell CRUD, supercell, centering
    documentService.ts         # Save, save-as, reload, image export
    displayConfigService.ts    # Display settings load / save / apply
   renderers/
     renderMessageBuilder.ts    # Build WireRenderData from a Structure snapshot
   config/
     types.ts                   # DisplaySettings = Required<WireDisplaySettings>
     defaults.ts                # getDefaultDisplaySettings()
     colorSchemeManager.ts      # ColorScheme lifecycle (load, save, import, export)
     colorSchemeStorage.ts      # Persistence via ExtensionContext.globalState
     colorSchemeValidator.ts    # JSON schema validation
     colorSchemeUtils.ts        # Color scheme utility functions
     presets/
       color-schemes/           # Built-in presets (bright, jmol); immutable
   io/
     fileManager.ts             # Format detection, parser dispatch, serialize
     parsers/
       structureParser.ts       # Abstract base class
       xyzParser.ts
       cifParser.ts
       poscarParser.ts
       xdatcarParser.ts
       outcarParser.ts
       qeParser.ts
       pdbParser.ts
       gjfParser.ts
       orcaParser.ts
       struParser.ts
       acoordParser.ts          # Native .acoord format (JSON)
       index.ts                 # Barrel re-exports
   utils/
     elementData.ts             # Periodic table data (symbols, radii)
     parserUtils.ts             # Shared parsing helpers
    constants.ts               # App-wide constants

media/webview/
  index.html                   # Webview HTML template
  styles.css                   # Webview CSS
  src/
    app.ts                     # Bootstrap, message dispatch (exhaustive switch)
    renderer.ts                # Three.js scene, meshes, animate loop
    state.ts                   # 8 reactive stores (plain mutable objects)
    interaction.ts             # Mouse / keyboard / pointer events (AbortController)
    interactionConfig.ts       # Keyboard shortcuts config UI bindings
    interactionDisplay.ts      # Display toggle keyboard bindings
    interactionLighting.ts     # Lighting control UI bindings
    settingsUtil.ts            # Display settings update utility
    types.ts                   # Webview-side interface definitions
    colorSchemeHandler.ts      # Color scheme message handlers
    appEdit.ts                 # Atom editing panel UI
    appLattice.ts              # Lattice / supercell panel UI
    appView.ts                 # View controls panel UI
    appTools.ts                # Tools panel UI
    appTrajectory.ts           # Trajectory slider UI
    state/
      selectionManager.ts      # Selection logic (multi-select, box-select)
    ui/
      common.ts                # Shared DOM helpers
      inputs.ts                # Input element constructors / binders
      statusBar.ts             # Status bar updater
    utils/
      atomSize.ts              # Atom radius calculations
      domCache.ts              # getElementById cache (does not cache null)
      measurements.ts          # Distance, angle, dihedral calculations
      performance.ts           # debounce() utility
      transformations.ts       # Structure rotation / translation helpers

build/
  webview.mjs                  # esbuild config for the webview bundle

src/test/
  extension.test.ts            # VS Code integration tests
  fixtures/                    # One representative file per supported format
  unit/
    models/                    # Structure, UnitCell unit tests
    parsers/                   # Round-trip tests for all 11 parsers
    services/                  # AtomEditService, BondService, SelectionService,
                               # MessageRouter, UndoManager unit tests

out/                           # Compiled output (gitignored)
```

---

## 4. Shared Protocol — The Contract

`src/shared/protocol.ts` is the **single source of truth** for every message
that crosses the extension↔webview boundary.

### 4.1 File Rules

- **No imports** from any extension-only or webview-only module. This file
  must be importable in both Node.js and browser contexts without side effects.
- Contains only `interface`, `type`, and `const` declarations.
- No `any`. No `unknown` on message fields that have a concrete type.

### 4.2 Wire-Format Types

| Type | Description |
|---|---|
| `WireAtom` | Serialized atom (id, element, color, position, radius, label?, fixed?, selectiveDynamics?, selected?) |
| `WireBond` | Serialized bond (key, atomId1, atomId2, start, end, radius, color, selected?) |
| `WireUnitCell` | Unit cell corners and edge geometry |
| `WireUnitCellParams` | Lattice parameters (a, b, c, alpha, beta, gamma) |
| `WireLightConfig` | Light position and intensity |
| `WireDisplaySettings` | Rendering settings: current brush (colorScheme, radiusScale) + global toggles |
| `WireConfigEntry` | A named display config entry |
| `WireRenderData` | Complete render payload (atoms, bonds, unit cell, selection state, trajectory info) |

**Position convention:** all positions are `[number, number, number]` tuples in
Cartesian coordinates, Angstroms.  
**Color convention:** CSS hex strings `#RRGGBB`.  
**ID convention:** opaque strings from `crypto.randomUUID()`. Never parse,
sort, or compare IDs structurally.  
**Optional fields:** use `?` for fields that may be absent. Never send
`undefined` over the wire — omit the key instead.

**WireAtom semantics:**
- `color` and `radius` are **required** fields, always present with concrete values
- These are the **current properties** of the atom, pre-computed by Extension
- Webview receives and renders directly without any calculation
- Extension computes these values during parsing or when user applies DisplaySettings

### 4.3 Message Unions

```typescript
// Extension → Webview
type ExtensionToWebviewMessage =
  | RenderMessage            // 'render'
  | DisplayConfigChangedMessage
  | DisplayConfigsLoadedMessage
  | DisplayConfigLoadedMessage
  | DisplayConfigSavedMessage
  | CurrentDisplaySettingsMessage
  | DisplayConfigErrorMessage
  | ImageSavedMessage
  | ImageSaveFailedMessage;

// Webview → Extension
type WebviewToExtensionMessage =
  | ... (37 commands covering structural edits, selection, display, document I/O)
```

### 4.4 Utility Types

```typescript
// Extract a specific message type by its command literal
type MessageByCommand<C extends string> =
  Extract<ExtensionToWebviewMessage | WebviewToExtensionMessage, { command: C }>;
```

Use `MessageByCommand<'myCommand'>` when you need the type of a specific
message inside a generic handler.

### 4.5 Adding a New Message

1. Define the message interface in `protocol.ts`.
2. Add it to the appropriate union (`ExtensionToWebviewMessage` or
   `WebviewToExtensionMessage`).
3. **Extension side:** Add a handler via `messageRouter.registerTyped('myCommand', handler)`.
4. **Webview side:** Add a `case 'myCommand':` in the `switch` in `app.ts`.
   The `default` branch uses `_exhaustive: never` — TypeScript will produce a
   **compile error** if you forget to add the case.
5. The TypeScript compiler enforces that all fields are provided at send sites
   and all fields are available at receive sites.

---

## 4.5 Atom Data Model

### 4.5.1 Core Principle: Required Properties

Every `Atom` has **required** `color` and `radius` properties. These are not
computed at render time — they are set when the atom is created or modified.

```typescript
// src/models/atom.ts
export class Atom {
  id: string;
  element: string;
  x: number;
  y: number;
  z: number;
  
  // Required — always have concrete values
  color: string;      // CSS hex color: "#RRGGBB"
  radius: number;     // Angstroms
  
  // Optional metadata
  label?: string;
  fixed: boolean = false;
  selectiveDynamics?: [boolean, boolean, boolean];
  
  // Temporary state (not saved)
  selected: boolean = false;
}
```

**Why this design:**
1. **No runtime computation** — webview renders directly without calculation
2. **Explicit data** — atom's appearance is stored with the atom, not derived
3. **Round-trip preservation** — saving to .acoord preserves user modifications
4. **Multi-frontend support** — any frontend can render without reimplementing logic

### 4.5.2 Atom Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                      Atom Lifecycle                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Creation]                                                     │
│     │                                                           │
│     ├─ Parser creates from file (XYZ/POSCAR/CIF/.acoord)       │
│     │   └─ Sets: color = getColorForElement(element)           │
│     │           radius = ELEMENT_DATA[element].covalentRadius  │
│     │   OR (for .acoord): reads from file                      │
│     │                                                           │
│     └─ User adds new atom                                      │
│         └─ Sets: color = DisplaySettings.currentColorScheme    │
│                 radius = covalent * currentRadiusScale          │
│                                                                 │
│  [Modification]                                                 │
│     │                                                           │
│     ├─ User manually changes single atom                        │
│     │   └─ Message: setAtomColor / setAtomRadius               │
│     │                                                           │
│     ├─ User applies DisplaySettings to selection               │
│     │   └─ Message: applyDisplaySettings(atomIds)              │
│     │       atom.color = currentColorScheme[element]            │
│     │       atom.radius = covalent * currentRadiusScale         │
│     │                                                           │
│     └─ User changes color scheme setting                        │
│         └─ Does NOT modify existing atoms                       │
│             Only affects newly created atoms                    │
│                                                                 │
│  [Rendering]                                                    │
│     │                                                           │
│     └─ Extension sends WireAtom { color, radius }              │
│         Webview uses directly — no calculation                  │
│                                                                 │
│  [Saving]                                                       │
│     │                                                           │
│     ├─ .acoord format: saves color, radius                      │
│     └─ Other formats: may not support (loses on round-trip)     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.5.3 Color/Radius Priority

When setting atom properties, use this priority:

**For color:**
1. User-specified color (via `setAtomColor` or loaded from .acoord)
2. `DisplaySettings.currentColorByElement[element]` (when applying)
3. Color from `DisplaySettings.currentColorScheme` (when applying)
4. `'#C0C0C0'` (final fallback: gray)

**For radius:**
1. User-specified radius (via `setAtomRadius` or loaded from .acoord)
2. `DisplaySettings.currentRadiusByElement[element]` (when applying)
3. `ELEMENT_DATA[element].covalentRadius * DisplaySettings.currentRadiusScale` (when applying)
4. `ELEMENT_DATA[element].covalentRadius` (fallback)

**Important:** These priorities are used when *applying* DisplaySettings or
creating atoms. Once set, the atom's color/radius are fixed until explicitly
changed again.

---

## 5. Extension Host

### 5.1 StructureEditorProvider

Implements `vscode.CustomEditorProvider<StructureDocument>`. It is a **thin
lifecycle coordinator** — no domain logic belongs here.

**What it does:**

| Method | Responsibility |
|---|---|
| `openCustomDocument` | Create `StructureDocument`, restore from backup if present |
| `resolveCustomEditor` | Create `EditorSession`, wire webview HTML, attach message listener and dispose listener |
| `saveCustomDocument` / `saveCustomDocumentAs` | Delegate entirely to `DocumentService` |
| `revertCustomDocument` | Reload from disk, reset trajectory, undo, selection; re-render |
| `backupCustomDocument` | Serialize all frames to backup URI; supports hot-exit |
| `handleWebviewMessage` | Intercept `undo`/`redo`; delegate everything else to `messageRouter.route()` |
| `renderStructure` | Call `renderer.getRenderMessage()`, attach display settings, post to webview |
| `notifyDocumentChanged` | Fire `_onDidChangeCustomDocument` with `undo`/`redo` callbacks |
| `notifyConfigChange` | Post `displayConfigChanged` to **all** open sessions |

**What it must NOT do:**

- Contain inline domain logic for atoms, bonds, unit cells, or selection.
- Directly handle display config commands inline (use `DisplayConfigService`).
- Use `document.uri.fsPath` as a session map key (causes split-view collision).

**Dirty tracking:** `_onDidChangeCustomDocument` must fire after every
structural edit. The `handleWebviewMessage` implementation tracks
`undoManager.depth` before and after `messageRouter.route()` — if depth
increases, the document is considered modified and `notifyDocumentChanged()`
is called. Always verify that your new command correctly triggers this.

### 5.2 EditorSession

A plain container for per-panel state. One instance per webview panel.

```typescript
class EditorSession {
  key: string;                          // 'session_N' — unique per panel
  document: StructureDocument;
  webviewPanel: vscode.WebviewPanel;
  renderer: RenderMessageBuilder;
  trajectoryManager: TrajectoryManager;
  undoManager: UndoManager;
  selectionService: SelectionService;
  bondService: BondService;
  atomEditService: AtomEditService;
  unitCellService: UnitCellService;
  documentService: DocumentService;
  displayConfigService: DisplayConfigService;
  displaySettings?: DisplaySettings;    // Current display overrides
  messageRouter!: MessageRouter;        // Wired after construction (breaks circular dep)
}
```

**Session keys** use a monotonically increasing counter (`session_1`,
`session_2`, …), not `document.uri.fsPath`. This ensures each split-view
panel gets its own independent session even when displaying the same file.

> **Note:** `MessageRouter` receives `document.uri.fsPath` separately as
> `sessionKey: string` — this is only used for document I/O path resolution,
> not as the map key. Do not confuse the two.

### 5.3 MessageRouter

`MessageRouter` is the **only** class that maps `command` strings to handler
functions. All 37 webview-to-extension commands are registered here.

**Handler registration is fully typed:**

```typescript
messageRouter.registerTyped('addAtom', (message: MessageByCommand<'addAtom'>) => {
  return atomEditService.addAtom(message);
});
```

**`route()` is the single dispatch entry point:**

```typescript
async route(message: WebviewToExtensionMessage): Promise<boolean> {
  const handler = this.handlers.get(message.command);
  if (!handler) { return false; }
  try {
    return await handler(message);
  } catch (error) {
    console.error(`[ACoord] Handler for '${message.command}' threw:`, error);
    vscode.window.showErrorMessage(`ACoord: '${message.command}' failed: ${error}`);
    return true; // claim handled to prevent silent drop
  }
}
```

All exceptions from handlers are caught here. Handler implementations should
throw `Error` with descriptive messages rather than silently returning `false`.

**`undo` and `redo` are intentionally NOT registered in `MessageRouter`.**
They are intercepted directly in `StructureEditorProvider.handleWebviewMessage`
because they require access to the full session context to update the
trajectory, clear selection, and re-render.

### 5.4 UndoManager

- Maintains separate undo and redo stacks of `Structure` snapshots.
- `push(structure)` saves the current structure before an edit; clears redo stack.
- `undo()` / `redo()` pop from the respective stack and return the snapshot.
- Memory is bounded by a configurable maximum byte estimate (~1 KB per atom).
- `depth` (read-only) reflects current undo stack depth; used by the provider
  to detect structural modifications.

### 5.5 TrajectoryManager

- `frames: Structure[]` — all frames; `activeIndex: number` — current frame.
- `beginEdit()` clones the active frame. `commitEdit(structure)` replaces it.
  `rollbackEdit()` discards the clone and restores the original.
- `updateActiveFrame(structure)` replaces the active frame directly (used by
  undo/redo).
- `isEditing` — guard against nested edits.
- Frame switching clears the undo stack (documented trade-off: cross-frame undo
  is not supported).

### 5.6 RenderMessageBuilder

Transforms a `Structure` snapshot into `WireRenderData` for the webview.

- Holds selection state (`selectedAtomId`, `selectedAtomIds`, `selectedBondKey`,
  `selectedBondKeys`). This is view-layer state, not domain state.
- `getRenderMessage()` returns a fully typed `RenderMessage` (not `any`).
- **Does NOT compute color or radius** — these are already set on Atom instances.
- Simply copies `atom.color` and `atom.radius` directly when building `WireAtom`.
- `getPeriodicBondGeometry()` handles bonds across unit cell boundaries for
  periodic structures. **Known issue:** current implementation is O(n²×27) for
  periodic systems — see `CURRENT_ISSUES.md` for the fix plan.

**Key principle:** RenderMessageBuilder is a pure data transformer. All
computation happens elsewhere (parsers, services).

### 5.7 Document Lifecycle Contract

The VS Code Custom Editor API requires:

1. **Dirty tracking:** `_onDidChangeCustomDocument.fire(CustomDocumentEditEvent)`
   after every edit, with working `undo`/`redo` callbacks.
2. **Backup:** `backupCustomDocument` must serialize current state to the backup
   URI. `openCustomDocument` must check `openContext.backupId` and restore from
   it on hot-exit recovery.
3. **Revert:** `revertCustomDocument` must reload from disk and reset all editor
   state.
4. **Save:** `saveCustomDocument` delegates to `DocumentService.saveStructure()`.

**Verification checklist for new structural edit commands:**

- [ ] Open file, make edit, attempt to close — does VS Code prompt "Save?"?
- [ ] Make edit, press Ctrl+Z — does VS Code undo it?
- [ ] Open same file in two side-by-side panels — do they operate independently?

---

## 6. Webview

### 6.1 app.ts — Bootstrap and Message Dispatch

`app.ts` is the webview entry point. It:

1. Acquires `vscode.postMessage` via `acquireVsCodeApi()`.
2. Initializes all modules (renderer, interaction, UI panels).
3. Registers the message switch for incoming `ExtensionToWebviewMessage`.

**The message switch uses the `_exhaustive: never` pattern:**

```typescript
window.addEventListener('message', (event: MessageEvent<ExtensionToWebviewMessage>) => {
  const message = event.data;
  switch (message.command) {
    case 'render':           handleRenderMessage(message); break;
    case 'imageSaved':       /* ... */ break;
    case 'imageSaveFailed':  /* ... */ break;
    case 'displayConfigChanged':
    case 'displayConfigsLoaded':
    case 'currentDisplaySettings':
    // ... other display config cases
      configHandler.handleMessage(message); break;
    default: {
      const _exhaustive: never = message;  // compile error if a case is missing
      console.warn('Unhandled message:', (_exhaustive as { command: string }).command);
    }
  }
});
```

**When you add a new `ExtensionToWebviewMessage` type to `protocol.ts`, the
TypeScript compiler will produce a compile error here until you add the
corresponding `case`.** This is intentional and must not be circumvented.

### 6.2 renderer.ts — Three.js Scene

`renderer.ts` is the sole owner of all Three.js objects.

**Rules:**

- All `THREE.Geometry`, `THREE.Material`, `THREE.Mesh`, and `THREE.Texture`
  instances are created and disposed within this module. No other module may
  create Three.js objects.
- Atoms and bonds use `THREE.InstancedMesh` — one mesh for all atoms, one for
  bonds. Per-instance color is set via instance attributes, not separate
  materials.
- The `animate()` loop stores its `requestAnimationFrame` ID and cancels it in
  `dispose()`.
- Materials are disposed before their textures.
- `updateAtomPosition(atomId, position)` and `updateBondPositions(moves)` provide
  incremental update paths for drag previews — these bypass the full
  `renderStructure()` rebuild for performance.

**`renderStructure(structure, displaySettings)` is the full rebuild path.**
It disposes all existing meshes, rebuilds the instanced meshes from scratch,
and fits the camera if requested. It is called once per committed edit, not
during drag previews.

**No property calculation in webview:**
- `renderer.ts` uses `atom.color` and `atom.radius` directly from `WireAtom`
- No color scheme lookups, no radius calculations, no fallback logic
- All such computation happens in the Extension host

### 6.3 state.ts — Reactive Stores

`state.ts` defines 8 plain mutable store objects:

| Store | Contents |
|---|---|
| `structureStore` | `currentStructure`, `currentSelectedAtom`, `currentSelectedBondKey` |
| `selectionStore` | `selectedAtomIds[]`, `selectedBondKeys[]` |
| `displayStore` | Global display fields (background color, show axes, bond thickness, etc.) — **NOT atom color/radius overrides** |
| `lightingStore` | `lightingEnabled`, `ambientIntensity`, 3 named `WireLightConfig` objects |
| `interactionStore` | Drag state, `shouldFitCamera`, `renderAtomOffsets` |
| `trajectoryStore` | `frameIndex`, `frameCount`, `playing`, `fps` |
| `adsorptionStore` | Reference and adsorbate atom ID sets |
| `configStore` | `currentConfigId/Name`, `availableConfigs`, `isLoadingConfig` |

**Rules:**

- Stores are the single source of truth for their domains. Never cache a copy
  of store data in a local variable that outlives a single function call.
- There is no reactive mechanism — changes do not auto-propagate. Code that
  needs to react to state changes must be called explicitly after mutations.
- `applyDisplaySettings(settings)` is the canonical way to bulk-update
  `displayStore` from a `WireDisplaySettings` wire message.
- `extractDisplaySettings()` is the canonical way to read `displayStore` as
  `WireDisplaySettings` for sending back to the extension.

**Important — No atom property overrides in displayStore:**
- `displayStore` does NOT contain `atomSizeByAtom`, `atomColorByElement`, or similar override maps
- Atom `color` and `radius` are stored on `Atom` instances in the extension host
- When user wants to change atom properties, send `setAtomColor` or `applyDisplaySettings` messages
- This keeps the webview pure: it only displays what the extension sends

### 6.4 interaction.ts — Input Handling

Handles mouse, pointer, and keyboard events. Uses an `AbortController` for
cleanup:

```typescript
const controller = new AbortController();
canvas.addEventListener('mousedown', onMouseDown, { signal: controller.signal });
document.addEventListener('keydown', onKeyDown, { signal: controller.signal });
// ...

export function dispose(): void {
  controller.abort(); // removes all listeners at once
}
```

`dispose()` must be called when the webview is torn down. **Known issue:**
`app.ts` currently imports only `init` from `interaction.ts` and never calls
`dispose()` — see `CURRENT_ISSUES.md` §5.1.

### 6.5 Interaction Modules

Three specialized interaction modules handle specific UI binding concerns:

| Module | Responsibility |
|---|---|
| `interactionConfig.ts` | Keyboard shortcut configuration bindings |
| `interactionDisplay.ts` | Display toggle bindings (show/hide axes, unit cell, etc.) |
| `interactionLighting.ts` | Lighting control UI bindings |

These modules follow the same `init()` / `dispose()` pattern as `interaction.ts`.

### 6.6 DOM Access Rules

- Use `document.getElementById(id) as HTMLElement | null` with an explicit
  null guard before use.
- `domCache.ts` caches non-null results only (does not cache `null`). Use it
  for stable DOM elements that exist for the webview's lifetime.
- Do not cache DOM lookups for elements that may not exist yet (created
  dynamically).
- Use `addEventListener` (removable), not `element.onclick` assignment.
- If an element is expected to exist and doesn't, throw with a descriptive
  message rather than silently no-op.

---

## 7. I/O & Parsers

### 7.1 Parser Base Class

All parsers extend `StructureParser`:

```typescript
abstract class StructureParser {
  abstract readonly name: string;           // e.g. 'XYZ'
  abstract readonly extensions: string[];   // e.g. ['xyz']
  abstract parse(content: string, fileName?: string): Structure[];
  abstract serialize(structure: Structure): string;
  serializeMulti?(structures: Structure[]): string;
}
```

`parse()` always returns `Structure[]`. Single-structure formats return a
one-element array. Trajectory formats return the full frame array.

**Parser responsibility for atom properties:**
- Parsers MUST set `atom.color` and `atom.radius` during parsing
- Use the default color scheme (Bright) to determine colors
- Use covalent radii from `ELEMENT_DATA` to determine radii
- Example:
  ```typescript
  import { BRIGHT_SCHEME } from '../../config/presets/color-schemes/index.js';
  
  const color = BRIGHT_SCHEME.colors[element] || '#C0C0C0';
  const radius = ELEMENT_DATA[element]?.covalentRadius ?? 0.3;
  atom.color = color;
  atom.radius = radius;
  ```

### 7.2 Parser Contract

Every parser must:

1. **Return an empty array for empty input.** Never throw on an empty string.
2. **Throw a descriptive `Error` for malformed input.** Include the parser
   name, line number, and what was expected. Never return an empty structure
   in place of an error.
3. **Set atom color and radius.** These are required fields, not optional.
   Use default color scheme (Bright) and covalent radii.
4. **Preserve format-specific metadata.** Store format-specific data
   (charge, multiplicity, comments, selective dynamics, etc.) in
   `structure.metadata` (a `Map<string, unknown>`). Serializers must read
   from metadata and fall back to defaults only if the key is absent.
5. **Report errors with context.** `throw new Error('XYZParser line 3: expected atom count, got "foo"')`.

### 7.3 Structure.metadata

`Structure.metadata` is the extensible store for format-specific data:

```typescript
// Parser sets:
structure.metadata.set('charge', 0);
structure.metadata.set('multiplicity', 1);
structure.metadata.set('comment', '# water molecule');

// Serializer reads:
const charge = (structure.metadata.get('charge') as number) ?? 0;
```

`metadata` is deep-cloned in `Structure.clone()` and serialized/deserialized
in `Structure.toJSON()` / `Structure.fromJSON()`. Do not store non-serializable
objects in metadata.

### 7.4 Format Detection

`FileManager` resolves the parser by file extension. For ambiguous extensions
(`.out`, `.log`, `.inp`) that map to multiple formats, the file manager tries
parsers in priority order and uses the first that succeeds:

```
.out / .log  →  try: QEParser, ORCAParser  (in that order)
.inp         →  try: ORCAParser, QEParser
```

A parser signals that the content is not its format by throwing. `FileManager`
catches and tries the next parser. If all fail, it surfaces the error from the
most likely parser.

### 7.5 Known Open Parser Issues

See `CURRENT_ISSUES.md` §4 for the current list. Summary:

| Format | Issue |
|---|---|
| STRU (ABACUS) | Comment delimiter uses `//` but format spec uses `#` |
| QE | `ibrav > 0` is not supported; rejects with a clear error |
| PDB | Column alignment not verified against the PDB 80-column spec |
| `.inp` extension | Routes exclusively to ORCA; QE `.inp` files fail |

---

## 8. Configuration System

### 8.1 Architecture

ACoord uses a single configuration system for color schemes:

```
ColorSchemeManager
  ├── ColorSchemeStorage    (globalState persistence)
  ├── ColorSchemeValidator  (validation)
  └── presets/color-schemes/ (built-in immutable color schemes)
```

**All color scheme access goes through `ColorSchemeManager`.**

### 8.2 DisplaySettings Type

```typescript
// config/types.ts
export type DisplaySettings = Required<WireDisplaySettings>;
```

`DisplaySettings` represents the current rendering state passed to the webview. It is **not persisted** between sessions.

### 8.3 Default Settings

On each startup, the extension uses `getDefaultDisplaySettings()` to provide initial values:

- Background color: `#0d1015`
- Unit cell color: `#FF6600`
- Color scheme: `preset-bright`
- ... (see `src/config/defaults.ts`)

### 8.4 Color Schemes

Color schemes define element-to-color mappings:

```typescript
interface WireColorScheme {
  id: string;
  name: string;
  description?: string;
  colors: Record<string, string>;  // element -> hex color
}
```

Users can:
- Select from built-in presets (Bright, JMol, etc.)
- Create and save custom color schemes
- Import/export color scheme files

### 8.5 What is NOT Saved

The following settings are **not persisted**:
- Background color
- Unit cell color/style
- Lighting configuration
- Projection mode
- Bond thickness

Users must reconfigure these after each session restart.

---

## 8.5 .acoord Native File Format

ACoord has a native file format (`.acoord`) that preserves all atom properties,
unlike interchange formats (XYZ, POSCAR, etc.) which only store element and position.

### 8.5.1 File Structure

```typescript
interface ACoordFile {
  version: "1.0";
  atoms: ACoordAtom[];
  unitCell?: ACoordUnitCell;
  bonds?: ACoordBond[];
}

interface ACoordAtom {
  id: string;
  element: string;
  x: number;
  y: number;
  z: number;
  color: string;      // CSS hex color: "#RRGGBB" — rendered as-is
  radius: number;     // Render radius in Angstroms — used directly for display
  label?: string;
  fixed?: boolean;
  selectiveDynamics?: [boolean, boolean, boolean];
}

// Radius semantics in .acoord:
// - User-specified radius values are used directly for rendering (no scaling)
// - Users can specify any value (e.g., covalent radius 0.76Å for carbon)
// - If radius is omitted or invalid, defaults to covalent radius * 0.35
// - This gives users full control: physical units for precision, or any value for art

interface ACoordUnitCell {
  a: number;
  b: number;
  c: number;
  alpha: number;
  beta: number;
  gamma: number;
}

interface ACoordBond {
  atomId1: string;
  atomId2: string;
}
```

### 8.5.2 What Gets Saved

**Saved to .acoord:**
- Atom data: element, position, **color**, **radius**, label, fixed, selectiveDynamics
- Unit cell parameters
- Bonds (atom ID pairs)

**NOT saved to .acoord:**
- DisplaySettings (global user preference)
- Lighting settings (global user preference)
- Temporary state (selected, etc.)

### 8.5.3 Round-trip Guarantee

When a user opens a .acoord file, modifies it, and saves:
1. All atom colors and radii are preserved exactly
2. User-specified labels, fixed flags, and selective dynamics are preserved
3. DisplaySettings changes do NOT affect saved atom properties

### 8.5.4 Import from Other Formats

When opening XYZ, POSCAR, CIF, etc.:
1. Parser sets default color (from default color scheme: Bright)
2. Parser sets default radius (covalent radius × 0.35 for visual aesthetics)
3. User can modify these and save as .acoord to preserve changes

**Note:** The 0.35 scaling factor is only applied as a default for formats that don't
support radius. When users save to .acoord and specify their own radius values, those
values are used exactly as written.

---

## 8.6 User Interaction Patterns

### 8.6.1 DisplaySettings as "Current Brush"

The DisplaySettings panel works like Photoshop's color picker:

```
┌─────────────────────────────────────┐
│  Current Brush Settings              │
│  ─────────────────────               │
│  Color Scheme: [JMol ▼]              │
│  Radius Scale: [1.0] ────○──────     │
│  Element Override:                   │
│    C: [#909090] [0.76]              │
│    H: [#FFFFFF] [0.31]              │
│                                      │
│  [Apply to Selection (5)]            │
│  [Apply to All (50)]                 │
└─────────────────────────────────────┘
```

**Workflow:**
1. User adjusts "Current Brush" settings (color scheme, radius scale)
2. Existing atoms are **not affected** — their colors/radii stay the same
3. User selects atoms and clicks "Apply to Selection"
4. Extension updates selected atoms' `color` and `radius` properties
5. Extension sends `RenderMessage` with updated data

### 8.6.2 Scenario: Changing Color Scheme

```
User: Opens water.xyz with JMol colors
      └─ O: #FF0D0D, H: #FFFFFF

User: Changes color scheme to CPK
      └─ DisplaySettings.currentColorScheme = "cpk"
      └─ Atoms still have: O: #FF0D0D, H: #FFFFFF  (unchanged!)

User: Selects all atoms → Clicks "Apply to All"
      └─ Extension updates:
         - O.color = CPK["O"] = "#FF0000"
         - H.color = CPK["H"] = "#FFFFFF"
      └─ RenderMessage sent to webview
      └─ Webview displays new colors
```

### 8.6.3 Scenario: Per-Element Override

```
User: Wants all Carbon atoms to be blue
      └─ In DisplaySettings panel:
         - Element Override: C: [#0000FF] [0.76]
      └─ DisplaySettings.currentColorByElement["C"] = "#0000FF"
      └─ No atoms changed yet

User: Selects 10 Carbon atoms → Clicks "Apply to Selection"
      └─ Extension updates:
         - For each selected C atom: atom.color = "#0000FF"
      └─ RenderMessage sent
      └─ Those 10 Carbon atoms are now blue
```

### 8.6.4 Scenario: Individual Atom Edit

```
User: Selects one Hydrogen atom
      └─ Properties panel shows:
         Element: H
         Color: [#FFFFFF] ← color picker
         Radius: [0.31]

User: Changes color to #FF0000 via color picker
      └─ Webview sends: setAtomColor(atomId, "#FF0000")
      └─ Extension updates: atom.color = "#FF0000"
      └─ RenderMessage sent
      └─ That one Hydrogen is now red
```

---

## 9. Build System

### 9.1 Extension Host

- **Compiler:** `tsc` (strict mode, `src/tsconfig.json`)
- **Target:** `ES2022`, module system: `commonjs`
- **Output:** `out/` directory

### 9.2 Webview

- **Bundler:** esbuild via `build/webview.mjs`
- **Entry:** `media/webview/src/app.ts`
- **Output:** `out/webview/webview.js` (single bundle)
- **tsconfig:** `media/webview/src/tsconfig.json`, target `ES2020`, module `ES2020`
- **Three.js:** bundled (not external). Changes to `three` version require
  rebuilding the bundle.

### 9.3 Scripts

| Script | Purpose |
|---|---|
| `npm run compile` | Full build: `tsc` + esbuild |
| `npm run watch` | Watch both `tsc` and esbuild concurrently |
| `npm run watch:tsc` | Watch `tsc` only |
| `npm run watch:webview` | Watch esbuild only |
| `npm run lint` | Run ESLint on `src/` |
| `npm run test` | Run VS Code integration tests (requires VS Code) |
| `npm run test:unit` | Run unit tests (Mocha, no VS Code dependency) |
| `npm run vscode:prepublish` | Pre-publish build (runs `compile`) |

**For day-to-day development:** run `npm run watch` in a terminal. This
compiles both the extension host TypeScript and the webview bundle on every
save. Press `F5` in VS Code to launch the Extension Development Host.

---

## 10. Type Safety & Code Quality

### 10.1 Strict TypeScript

`tsconfig.json` enforces:

```json
{
  "strict": true,
  "noImplicitAny": true,
  "strictNullChecks": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true
}
```

These settings are not negotiable. Do not disable them for convenience.

### 10.2 No `any` on Message Boundaries

- All message handler parameters must use protocol types, not `any` or `unknown`.
- `getRenderMessage()` returns `RenderMessage`, typed against `protocol.ts`.
- `MessageRouter.registerTyped<C>()` gives each handler the exact
  `MessageByCommand<C>` type for its command.
- The internal `Map<string, AnyHandler>` uses `unknown` (not `any`) for type
  erasure inside the heterogeneous handler map. This is a deliberate,
  bounded workaround — the public API is fully typed.

### 10.3 ID Generation

All IDs use `crypto.randomUUID()`:

```typescript
// Atom (Node.js and browser both have crypto.randomUUID())
this.id = `atom_${crypto.randomUUID()}`;

// Structure
this.id = `struct_${crypto.randomUUID()}`;
```

IDs are opaque strings. Never parse, sort, compare structurally, or derive
semantic meaning from them.

### 10.4 ESLint

```
eslint.config.mjs — typescript-eslint recommended rules
```

Run `npm run lint` before committing. The CI pipeline runs lint. Disable rules
inline only with `// eslint-disable-next-line` plus a comment explaining why.

---

## 11. Testing

### 11.1 Test File Convention

All unit tests use the `.mts` extension (native ES Module TypeScript) and are
co-located under `src/test/unit/`. The Mocha config (`mocharc.json`) picks up
`**/*.test.mts`.

```
src/test/
  extension.test.ts          # VS Code integration tests (vscode-test runner)
  fixtures/                  # Representative input files (one per format)
  unit/
    models/
      structure.test.mts
      unitCell.test.mts
    parsers/
      xyz.test.mts            # (and one .test.mts per parser)
      ...
    services/
      atomEditService.test.mts
      bondService.test.mts
      messageRouter.test.mts
      selectionService.test.mts
      undoManager.test.mts
```

### 11.2 Running Tests

```bash
npm run test:unit    # Fast, no VS Code required — runs all *.test.mts
npm run test         # Full integration test (launches VS Code)
```

Unit tests should run in under 5 seconds. If a test requires VS Code APIs,
put it in `extension.test.ts`, not under `unit/`.

### 11.3 What Every New Feature Needs

| What you added | Test required |
|---|---|
| New parser | Round-trip test: `parse(fixture)` → `serialize()` → `parse()` → same atoms/positions/metadata/color/radius |
| New service method | Unit test covering success, failure, and edge cases |
| New structural edit command | Unit test for `AtomEditService` / `BondService` / `UnitCellService` |
| New message type | Test in `messageRouter.test.mts` that `route()` dispatches correctly |
| New `Structure` method | Unit test in `structure.test.mts` |
| Color scheme change | Test that atoms are NOT modified, only DisplaySettings |
| `applyDisplaySettings` | Test that selected atoms get new color/radius |

### 11.4 Parser Tests

Each parser test must verify:

1. `parse(fixtureContent)` produces the correct atom count, element types, and
   positions (within `1e-6` Angstrom tolerance).
2. `serialize(parsed[0])` → `parse(serialized)` produces an equivalent structure
   (round-trip identity).
3. **Atoms have valid color and radius** (not undefined, not null).
4. Format-specific metadata is preserved after round-trip.
5. Empty input returns `[]` (no throw).
6. Malformed input throws an `Error` with a descriptive message.

For `.acoord` parser, also verify:
- Custom atom colors and radii are preserved
- Labels, fixed flags, selective dynamics are preserved

### 11.5 Mocking VS Code Dependencies

Services that use `vscode.window.showErrorMessage` or `vscode.WebviewPanel`
cannot be tested without mocking. Pattern used in `messageRouter.test.mts`:

```typescript
// MinimalRouter mirrors MessageRouter's dispatch logic without VS Code deps
class MinimalRouter {
  private handlers = new Map<string, (msg: unknown) => boolean | Promise<boolean>>();
  register(command: string, handler: (msg: unknown) => boolean | Promise<boolean>) {
    this.handlers.set(command, handler);
  }
  async route(msg: { command: string }) {
    return (await this.handlers.get(msg.command)?.(msg)) ?? false;
  }
}
```

For services with unavoidable VS Code dependencies (e.g., `UnitCellService`
which calls `vscode.window.showWarningMessage`), either mock the `vscode`
module or refactor the service to accept error/warning callbacks injected
through the constructor.

---

## 12. Performance Guidelines

### 12.1 Bond Detection

- **Non-periodic:** Uses the spatial hash in `Structure.getBonds()`. O(n)
  amortized. Do not replace with a nested loop.
- **Periodic:** `RenderMessageBuilder.getPeriodicBondGeometry()` is currently
  O(n²×27). This is acceptable for structures under ~200 atoms. For larger
  structures, the fix is to add `structure.getPeriodicBonds()` using the same
  spatial hash approach with image atoms included. This is tracked in
  `CURRENT_ISSUES.md`.

### 12.2 Atom Lookup

`Structure.getAtom(id)` is O(1) via a private `Map<string, Atom>` index
(`atomIndex`). The index is maintained by `addAtom()`, `removeAtom()`, and
`clone()`. Never use `atoms.find()` for ID-based lookup.

### 12.3 Drag Preview — Do Not Round-Trip

Atom drag uses a **local preview** path:

1. The extension host receives `moveAtom` with `preview: true` and updates
   the internal model **without** calling `renderStructure()`. No render
   message is sent back.
2. The webview's `renderer.updateAtomPosition()` + `renderer.updateBondPositions()`
   update only the affected instance matrices locally, at full frame rate.
3. On `endDrag`, the extension host calls `renderStructure()` once to commit
   the canonical geometry.

**Never** trigger `renderStructure()` from preview messages — this was the
cause of the drag-stutter bug (now fixed). See `CURRENT_ISSUES.md` for the
resolved entry.

### 12.4 Debouncing

- Trajectory slider: debounced to avoid flooding the extension host with
  `setTrajectoryFrame` messages.
- Display settings sliders: debounced similarly.
- Use the `debounce()` utility from `media/webview/src/utils/performance.ts`.

### 12.5 Instanced Rendering

- Atoms: one `THREE.InstancedMesh` with a single `SphereGeometry`.
- Bonds: one `THREE.InstancedMesh` with a `CylinderGeometry`.
- Per-instance color is set via instance color attribute — not separate
  materials.
- Hit-testing uses the instanced mesh's built-in raycasting, not per-atom
  geometries.

---

## 13. Error Handling

### 13.1 Extension Host Pattern

```typescript
// MessageRouter.route() wraps all handlers:
try {
  return await handler(message);
} catch (error) {
  const errorMsg = error instanceof Error ? error.message : String(error);
  console.error(`[ACoord] ${message.command} failed:`, error);
  vscode.window.showErrorMessage(`ACoord: ${errorMsg}`);
  return true;
}
```

Handler implementations should **throw `Error`** with descriptive messages.
They should NOT call `vscode.window.showErrorMessage` directly (the router
handles that centrally), except for services like `DocumentService` that manage
their own user-facing feedback.

### 13.2 Service Return Values

Services return `boolean` to indicate whether the operation was handled (not
whether it succeeded). A handler that receives a valid message, attempts the
operation, and fails **should throw** rather than return `false`. Returning
`false` means "I don't know how to handle this command" — a routing miss,
not a domain error.

### 13.3 Webview Pattern

```typescript
// app.ts message handler:
default: {
  const _exhaustive: never = message;   // compile error on missing case
  console.warn('Unhandled message:', (_exhaustive as { command: string }).command);
  // do NOT throw — unknown commands should be ignored gracefully
}
```

For operations that can fail (Three.js context loss, texture loading):

```typescript
try {
  renderer.loadTexture(url);
} catch (error) {
  console.error('[ACoord] Texture load failed:', error);
  // recover gracefully — fall back to flat shading
}
```

### 13.4 Parser Errors

```typescript
// Good:
throw new Error(`XYZParser: line ${lineNum}: expected integer atom count, got "${raw}"`);

// Bad:
return [];              // silently ignores malformed input
console.error(msg);    // logs but does not surface to user
return new Structure(); // returns empty structure — caller can't distinguish from valid empty
```

---

## 14. How to Add New Features

This section walks through the complete workflow for common feature additions.
Following this order prevents the most common mistakes.

### 14.1 Adding a New Structural Edit Command

**Example:** Add a command to flip atom chirality.

**Step 1 — Define the message in `protocol.ts`:**

```typescript
export interface FlipChiralityMessage {
  command: 'flipChirality';
  atomId: string;
}
// Add to WebviewToExtensionMessage union:
type WebviewToExtensionMessage = ... | FlipChiralityMessage;
```

**Step 2 — Implement the service method:**

In the appropriate service (here, `AtomEditService`):

```typescript
flipChirality(message: MessageByCommand<'flipChirality'>): boolean {
  const atom = this.structure.getAtom(message.atomId);
  if (!atom) {
    throw new Error(`flipChirality: atom ${message.atomId} not found`);
  }
  // ... modify the structure snapshot
  return true;
}
```

Note: services receive the current `Structure` at call time; they do not hold
a persistent reference to the structure. The provider calls
`trajectoryManager.beginEdit()` before routing and `commitEdit()` after.

**Step 3 — Register in `MessageRouter`:**

In `messageRouter.ts`, in the appropriate `register*Commands()` method:

```typescript
this.registerTyped('flipChirality', (msg) => {
  return this.atomEditService.flipChirality(msg);
});
```

**Step 4 — Send from the webview:**

```typescript
// In the relevant appEdit.ts handler:
vscode.postMessage({ command: 'flipChirality', atomId: selectedAtomId } satisfies FlipChiralityMessage);
```

Using `satisfies FlipChiralityMessage` (instead of `as`) gives you a compile
error if any required field is missing or has the wrong type.

**Step 5 — Write the unit test:**

In `src/test/unit/services/atomEditService.test.mts`:

```typescript
it('flipChirality should mirror atom position', () => {
  // Arrange
  const structure = buildTestStructure();
  const atomId = structure.atoms[0].id;
  const service = new AtomEditService(structure);

  // Act
  service.flipChirality({ command: 'flipChirality', atomId });

  // Assert
  const atom = structure.getAtom(atomId)!;
  expect(atom.position[0]).to.be.closeTo(-originalX, 1e-6);
});
```

**Step 6 — Verify dirty tracking:**

Open the extension, trigger the command, confirm VS Code shows the dirty dot
in the tab and prompts "Save?" on close.

### 14.2 Adding a New File Format

**Step 1 — Create the parser** at `src/io/parsers/myFormatParser.ts`:

```typescript
import { StructureParser } from './structureParser';
import { Structure, Atom } from '../../models';
import { ELEMENT_DATA, getColorForElement } from '../../utils/elementData';

export class MyFormatParser extends StructureParser {
  readonly name = 'MyFormat';
  readonly extensions = ['myfmt'];

  parse(content: string, fileName?: string): Structure[] {
    if (!content.trim()) { return []; }
    // ... parse atom positions ...
    
    // IMPORTANT: Set color and radius for each atom
    for (const atom of structure.atoms) {
      const elementInfo = ELEMENT_DATA[atom.element];
      atom.color = getColorForElement(atom.element);  // Uses current color scheme
      atom.radius = elementInfo?.covalentRadius ?? 0.3;
    }
    
    // throw new Error(`MyFormatParser line ${n}: ...`) on malformed input
    return [structure];
  }

  serialize(structure: Structure): string {
    // ... serialize logic ...
    // Atom color/radius are already set on each atom, just serialize them
    // read metadata: const charge = (structure.metadata.get('charge') as number) ?? 0;
  }
}
```

**Key points for parsers:**
- You MUST set `atom.color` and `atom.radius` for every atom during parsing
- Use `BRIGHT_SCHEME.colors[element] || '#C0C0C0'` to get the default color
- Use `ELEMENT_DATA[element]?.covalentRadius ?? 0.3` for default radius
- For .acoord format, read color/radius directly from the file

**Step 2 — Register in `src/io/parsers/index.ts`:**

```typescript
export { MyFormatParser } from './myFormatParser';
```

**Step 3 — Register in `FileManager`:**

```typescript
// src/io/fileManager.ts
import { MyFormatParser } from './parsers';

const PARSER_MAP: Record<string, StructureParser[]> = {
  // ...
  myfmt: [new MyFormatParser()],
};
```

For ambiguous extensions shared with other formats, add to the array:
`out: [new QEParser(), new ORCAParser(), new MyFormatParser()]`

**Step 4 — Add a fixture file** to `src/test/fixtures/sample.myfmt`.

**Step 5 — Write the parser test** at `src/test/unit/parsers/myFormat.test.mts`:

Cover: atom count, element types, positions, metadata round-trip, empty input,
malformed input.

**Step 6 — Update `README.md`** to list the new format.

### 14.3 Adding a New Display Setting

Display settings fall into two categories:

1. **Current brush settings** — affect new atoms, can be applied to selection
2. **Global rendering settings** — affect entire scene immediately

**Step 1 — Add the field to `WireDisplaySettings` in `protocol.ts`:**

```typescript
export interface WireDisplaySettings {
  // ... existing fields
  
  // Example: Current brush setting
  currentMyFeatureScale?: number;  // Affects new atoms / apply to selection
  
  // OR: Global rendering setting
  showMyFeature?: boolean;         // Affects entire scene immediately
}
```

Because `DisplaySettings = Required<WireDisplaySettings>`, the extension-side
type automatically gains the new field — no separate update needed.

**Step 2 — Categorize the setting:**

- **Current brush**: Add to `displayStore` and wire up "Apply to Selection" UI
- **Global rendering**: Add to `displayStore`, takes effect immediately on render

**Step 3 — Use in `renderer.ts`:**

Read from `displayStore.showMyFeature` during `renderStructure()`.

**Step 4 — For current brush settings, implement application logic:**

```typescript
// In DisplayConfigService or AtomEditService
applyCurrentBrushToAtoms(atomIds: string[]): void {
  for (const atomId of atomIds) {
    const atom = this.structure.getAtom(atomId);
    if (!atom) continue;
    // Apply current brush setting to atom
    atom.myProperty = this.displaySettings.currentMyFeatureScale;
  }
}
```

**Step 5 — Add UI control** in the appropriate `app*.ts` panel file.

**Step 6 — Serialize/deserialize** — the setting is automatically included in
`WireDisplaySettings`, so the config system, presets, and migrations handle it
automatically. Add a migration if a default value change would break existing
stored configs.

**Step 7 — For current brush settings, add "Apply" UI:**

Provide buttons like "Apply to Selection" and "Apply to All" that call
`applyDisplaySettings` message with the selected atom IDs.

### 14.4 Applying DisplaySettings to Atoms

When user wants to change atom properties (color, radius) using the current
DisplaySettings:

**Step 1 — Define the message in `protocol.ts`:**

```typescript
export interface ApplyDisplaySettingsMessage {
  command: 'applyDisplaySettings';
  atomIds: string[];  // Atoms to apply the current brush to
}
```

**Step 2 — Implement in `DisplayConfigService` or `AtomEditService`:**

```typescript
applyDisplaySettings(message: MessageByCommand<'applyDisplaySettings'>): boolean {
  const { currentColorScheme, currentRadiusScale, currentColorByElement, currentRadiusByElement } = this.displaySettings;
  
  for (const atomId of message.atomIds) {
    const atom = this.structure.getAtom(atomId);
    if (!atom) continue;
    
    // Apply color from current brush
    atom.color = currentColorByElement?.[atom.element] 
      ?? getColorFromScheme(atom.element, currentColorScheme);
    
    // Apply radius from current brush
    const baseRadius = ELEMENT_DATA[atom.element]?.covalentRadius ?? 0.3;
    atom.radius = (currentRadiusByElement?.[atom.element] ?? baseRadius) * currentRadiusScale;
  }
  
  return true;
}
```

**Step 3 — Register in MessageRouter and add test.**

### 14.4 Adding a New Extension Host Service

When a service grows to the point where extracting a concern is warranted:

1. Create `src/services/myService.ts` extending no base class (services are
   not polymorphic — they handle a specific domain).
2. Inject dependencies through the constructor. Never accept
   `vscode.ExtensionContext` or `vscode.WebviewPanel` directly — accept
   callbacks instead (e.g., `postMessage: (msg: ExtensionToWebviewMessage) => void`).
3. Instantiate it in `StructureEditorProvider.resolveCustomEditor()` alongside
   the other services.
4. Pass it to `MessageRouter` as a constructor argument and register its
   commands in a new `register*Commands()` method.
5. Add it to `EditorSession`.

---

## 15. Common Pitfalls & What Not to Do

### 15.1 Don't Use `fsPath` as a Session Key

```typescript
// WRONG — causes silent data loss when same file is open in split view
const key = document.uri.fsPath;
this.sessions.set(key, session);

// CORRECT — unique per panel
const key = `session_${++this.nextSessionId}`;
this.sessions.set(key, session);
```

### 15.2 Don't Add Domain Logic to StructureEditorProvider

`StructureEditorProvider` is a lifecycle coordinator. If you find yourself
writing atom manipulation, bond calculation, or selection logic directly in
`structureEditorProvider.ts`, stop and put it in the appropriate service.

### 15.3 Don't Call renderStructure() on Preview Messages

```typescript
// WRONG — causes jitter, floods IPC
if (message.command === 'moveAtom' && message.preview) {
  this.renderStructure(session); // DO NOT DO THIS
}

// CORRECT — preview is handled locally in the webview
if (message.command === 'moveAtom' && message.preview) {
  session.atomEditService.moveAtom(message); // update model only
  // do NOT renderStructure — webview updates locally via updateAtomPosition()
}
```

### 15.4 Don't Silently Return false on Domain Errors

```typescript
// WRONG — caller interprets false as "command not handled"
addAtom(message: AddAtomMessage): boolean {
  const element = parseElement(message.element);
  if (!element) { return false; } // silent failure, no user feedback

// CORRECT — throw so MessageRouter.route() can surface the error
addAtom(message: AddAtomMessage): boolean {
  const element = parseElement(message.element);
  if (!element) {
    throw new Error(`addAtom: invalid element symbol "${message.element}"`);
  }
```

### 15.5 Don't Calculate Atom Properties in Webview

```typescript
// WRONG — webview should not calculate colors/radii
function getAtomColor(atom: WireAtom): string {
  return displayStore.atomColorByElement?.[atom.element] 
    ?? atom.color;
}

// CORRECT — use atom.color directly, it's already computed by extension
function getAtomColor(atom: WireAtom): string {
  return atom.color;  // Extension already set this
}

// WRONG — webview should not override atom properties
if (displayStore.atomSizeByAtom?.[atomId]) {
  radius = displayStore.atomSizeByAtom[atomId];  // Don't do this
}

// CORRECT — if user wants different radius, send message to extension
vscode.postMessage({ 
  command: 'setAtomRadius', 
  atomIds: [atomId], 
  radius: newRadius 
});
```

**Why:** The webview is a pure rendering surface. All calculations belong in
the extension host. This enables:
- Consistent behavior across different frontends (Webview, Jupyter, etc.)
- Easier testing (logic is in Node.js, not browser)
- Clear separation of concerns

### 15.6 Don't Store Runtime Objects in Structure.metadata

`Structure.metadata` is serialized to JSON via `toJSON()`. Storing
non-serializable objects (class instances, functions, `Buffer`s) will either
throw or silently produce `{}` in the JSON:

```typescript
// WRONG
structure.metadata.set('renderer', rendererInstance);  // will not serialize

// CORRECT — store only primitives, plain objects, arrays
structure.metadata.set('charge', -1);
structure.metadata.set('comment', 'water molecule');
structure.metadata.set('selectiveDynamics', [[true, true, false], [false, false, true]]);
```

### 15.7 Don't Create Per-Atom Three.js Objects

```typescript
// WRONG — O(n) geometry allocations, destroys performance
for (const atom of atoms) {
  const geo = new THREE.SphereGeometry(atom.radius);   // one per atom!
  const mat = new THREE.MeshStandardMaterial({ color: atom.color });
  scene.add(new THREE.Mesh(geo, mat));
}

// CORRECT — one InstancedMesh for all atoms
const geo = new THREE.SphereGeometry(1, 8, 8);
const mat = new THREE.MeshStandardMaterial();
const mesh = new THREE.InstancedMesh(geo, mat, atoms.length);
// set per-instance matrix and color
```

### 15.7 Don't Add New Message Types Without a Protocol Definition

```typescript
// WRONG — bypasses the type system
webview.postMessage({ command: 'myNewCommand', data: { foo: 'bar' } });

// CORRECT — define in protocol.ts first, then both sides have the type
```

### 15.8 Don't Skip the Exhaustiveness Check in app.ts

```typescript
// WRONG — breaks the compiler enforcement mechanism
default:
  console.warn('unknown command');
  break;

// CORRECT — keep the never assignment
default: {
  const _exhaustive: never = message;
  console.warn('Unhandled:', (_exhaustive as { command: string }).command);
}
```

### 15.9 Don't Duplicate Types Between protocol.ts and config/types.ts

`WireDisplaySettings` in `protocol.ts` is the canonical definition.
`DisplaySettings` in `config/types.ts` is `Required<WireDisplaySettings>`.
Never add a field to one without adding it to the other. In practice, just
add it to `WireDisplaySettings` and everything else follows automatically.

### 15.10 Don't Auto-Apply DisplaySettings to Existing Atoms

```typescript
// WRONG — changing color scheme should not modify existing atoms
setColorScheme(schemeId: string): void {
  this.displaySettings.currentColorScheme = schemeId;
  // Don't do this:
  for (const atom of this.structure.atoms) {
    atom.color = getColorFromScheme(atom.element, schemeId);
  }
}

// CORRECT — only update the setting, let user explicitly apply
setColorScheme(schemeId: string): void {
  this.displaySettings.currentColorScheme = schemeId;
  // Atoms unchanged, user can apply via "Apply to Selection"
}
```

**Rationale:** DisplaySettings is a "current brush" — it affects new atoms and
can be applied to selection, but should not silently modify existing data.

### 15.11 Don't Confuse "Atom Property" with "Display Setting"

| Atom Property | Display Setting |
|---|---|
| Stored on `Atom` instance | Stored in `DisplaySettings` |
| Saved to `.acoord` file | NOT saved to `.acoord` file |
| Per-atom, can differ | Global, applies uniformly |
| Set by: parser, `setAtomColor`, `applyDisplaySettings` | Set by: config UI, `setColorScheme`, etc. |
| Example: `atom.color = "#FF0000"` | Example: `currentColorScheme = "jmol"` |

---

## 16. Architecture Evolution Notes

### 16.1 Version 2.0 Changes (2026-03-08)

**Major architectural refactoring** based on design principles from
`docs/full-stack-refactor-plan.md`:

**1. Atom model refactoring:**
- `color` and `radius` changed from optional to **required** fields
- Parsers now set these values during parsing (using default color scheme and covalent radii)
- Webview no longer computes or overrides these values

**2. DisplaySettings semantics:**
- Reinterpreted as "current brush" — settings for new atoms
- Does NOT automatically apply to existing atoms
- User must explicitly "Apply to Selection" to update atom properties

**3. Computation centralization:**
- All color/radius calculation moved to extension host
- Webview is now a pure rendering surface
- Enables multi-frontend support (Webview, Jupyter, etc.)

**4. New .acoord native format:**
- JSON-based native format that preserves all atom properties
- Supports labels, fixed flags, selective dynamics
- Round-trip guarantee: save → load → save produces identical file

**5. WireDisplaySettings field renaming:**
- `atomColorSchemeId` → `currentColorScheme`
- `atomSizeScale` → `currentRadiusScale`
- `atomColorByElement` → `currentColorByElement`
- `atomSizeByElement` → `currentRadiusByElement`
- Removed: `atomSizeByAtom`, `atomSizeUseDefaultSettings`, `atomSizeGlobal`

### 16.2 Migration Guide

When updating existing code:

1. **Parser changes:** Ensure all parsers set `atom.color` and `atom.radius`
2. **Webview changes:** Remove any color/radius calculation logic
3. **Service changes:** Add `applyDisplaySettings(atomIds)` method
4. **Config migrations:** Add migration for renamed DisplaySettings fields

---

*For the current list of known bugs and architectural issues, see
[CURRENT_ISSUES.md](./CURRENT_ISSUES.md).*
