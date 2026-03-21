# ACoord Developer Guide

**Version:** 0.3.10  
**Last Updated:** 2026-03-21  
**License:** MIT

This document describes the **actual architecture** of ACoord. All new code must conform to the patterns described here.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Directory Structure](#3-directory-structure)
4. [acoord-3d Rendering Engine](#4-acoord-3d-rendering-engine)
5. [Shared Protocol](#5-shared-protocol)
6. [Extension Host](#6-extension-host)
7. [Webview](#7-webview)
8. [I/O and Parsers](#8-io-and-parsers)
9. [Build System](#9-build-system)
10. [Testing](#10-testing)
11. [Development Workflow](#11-development-workflow)
12. [Common Pitfalls](#12-common-pitfalls)

---

## 1. Project Overview

ACoord is a VS Code extension for 3D visualization and editing of atomic, molecular, and crystal structures. It uses a **two-process architecture**: Node.js extension host + sandboxed browser webview (Three.js).

### 1.1 Key Characteristics

- **15 file formats** — XYZ, CIF, POSCAR, XDATCAR, OUTCAR, PDB, Gaussian, ORCA, QE, ABACUS STRU, CASTEP, SIESTA, .acoord native
- **50+ webview commands** — Typed JSON messages via `src/shared/protocol.ts`
- **Interactive 3D rendering** — Three.js inside VS Code Custom Editor API
- **Trajectory support** — Multi-frame file navigation
- **Standalone rendering engine** — `acoord-3d` package for reuse

### 1.2 Design Principles

1. **Protocol-first** — Define messages in `protocol.ts` before implementation
2. **Service isolation** — Each domain concern in its own service class
3. **Extension owns computation** — Webview is a pure rendering surface
4. **Immutable updates** — Edits produce new `Structure` snapshots
5. **Dispose everything** — Track and release all resources
6. **Instanced rendering** — Use `InstancedMesh`, never per-atom geometries

---

## 2. Architecture

### 2.1 Two-Process Architecture

```
┌───────────────────────────────────┐      JSON       ┌──────────────────────────────────────┐
│         Extension Host (Node)      │ ◄─────────────► │            Webview (Browser)           │
│                                   │                  │                                        │
│  StructureEditorProvider          │                  │  app.ts  (message switch)              │
│    └── EditorSession (per panel)  │                  │    ├── renderer.ts   (Three.js)         │
│          ├── MessageRouter        │                  │    ├── state.ts      (stores)           │
│          ├── TrajectoryManager    │                  │    ├── interaction.ts (input)           │
│          ├── UndoManager          │                  │    └── app*.ts       (panels)           │
│          └── Services             │                  │                                        │
│                                   │                  │  Responsibilities:                      │
│  Computation (exclusive):         │                  │    ✅ Render received data               │
│    - Color/radius calculation     │                  │    ✅ Handle user input                  │
│    - Bond detection               │                  │    ✅ Send messages to extension         │
│    - Parser/serializer logic      │                  │                                        │
│                                   │                  │  Does NOT:                              │
│                                   │                  │    ❌ Compute colors/radii               │
│                                   │                  │    ❌ Override atom properties           │
└───────────────────────────────────┘                  └──────────────────────────────────────┘
```

**The rule:** Extension host owns the authoritative model and performs all computations. Webview is a pure rendering surface.

### 2.2 acoord-3d Rendering Engine

The core Three.js rendering logic is extracted into a standalone package:

```
┌─────────────────────────────────────────────────────────────────┐
│                     acoord-3d Package                            │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ createRenderer(options)                                    │  │
│  │   ├── canvas: HTMLCanvasElement                            │  │
│  │   ├── providers?: StoreProvider (state injection)          │  │
│  │   ├── onCameraChange?: (quat) => void                      │  │
│  │   └── returns RendererApi                                  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Features:                                                       │
│  - InstancedMesh rendering (atoms + bonds)                       │
│  - Camera controls (orbit, zoom, pan)                            │
│  - Lighting system (ambient + 3 directional)                     │
│  - Image export (high-resolution PNG)                            │
│  - State provider injection (for external state management)      │
└─────────────────────────────────────────────────────────────────┘
```

**Usage in webview:**
```typescript
import { createRenderer } from 'acoord-3d';

const renderer = createRenderer({
  canvas: document.getElementById('canvas'),
  providers: {
    structure: structureStore,
    display: displayStore,
    lighting: lightingStore,
  },
});
```

---

## 3. Directory Structure

```
vscode-acoord/
├── src/
│   ├── extension.ts                      # Extension activation
│   ├── shared/
│   │   └── protocol.ts                   # ALL wire types (zero imports)
│   ├── models/
│   │   ├── atom.ts                       # Atom class
│   │   ├── structure.ts                  # Structure class
│   │   ├── unitCell.ts                   # UnitCell class
│   │   └── index.ts                      # Barrel exports
│   ├── providers/
│   │   ├── structureEditorProvider.ts    # CustomEditorProvider lifecycle
│   │   ├── structureDocumentManager.ts   # Load/save/export
│   │   ├── trajectoryManager.ts          # Multi-frame state
│   │   └── undoManager.ts                # Undo/redo stack
│   ├── services/
│   │   ├── messageRouter.ts              # Command dispatch
│   │   ├── atomEditService.ts            # Atom CRUD
│   │   ├── bondService.ts                # Bond CRUD
│   │   ├── selectionService.ts           # Selection state
│   │   ├── unitCellService.ts            # Unit cell CRUD
│   │   ├── documentService.ts            # Save/reload/export
│   │   ├── displayConfigService.ts       # Display settings
│   │   └── clipboardService.ts           # Clipboard operations
│   ├── renderers/
│   │   └── renderMessageBuilder.ts       # Structure → WireRenderData
│   ├── config/
│   │   ├── types.ts                      # DisplaySettings type
│   │   ├── defaults.ts                   # Default settings
│   │   ├── colorSchemeManager.ts         # Color scheme lifecycle
│   │   ├── presets/color-schemes/        # Built-in presets
│   │   └── ...
│   ├── io/
│   │   ├── fileManager.ts                # Format detection
│   │   └── parsers/
│   │       ├── structureParser.ts        # Abstract base
│   │       ├── xyzParser.ts, cifParser.ts, ...
│   │       └── index.ts
│   ├── utils/
│   │   ├── elementData.ts                # Periodic table data
│   │   └── parserUtils.ts                # Shared helpers
│   └── test/
│       ├── extension.test.ts
│       ├── fixtures/
│       └── unit/
│
├── media/webview/
│   ├── index.html                        # Webview HTML
│   ├── styles.css                        # Webview CSS
│   └── src/
│       ├── app.ts                        # Bootstrap + message switch
│       ├── renderer.ts                   # acoord-3d integration
│       ├── state.ts                      # 8 reactive stores
│       ├── interaction.ts                # Input handling
│       ├── axisIndicator.ts              # 3D axis overlay
│       ├── appEdit.ts, appLattice.ts, ...# Panel modules
│       ├── components/                   # contextMenu, elementPicker
│       ├── ui/                           # DOM helpers
│       ├── utils/                        # Utilities
│       └── state/selectionManager.ts     # Selection logic
│
├── build/
│   └── webview.mjs                       # esbuild config
│
├── packages/
│   └── acoord-3d/                        # Standalone rendering engine
│       ├── src/
│       │   ├── index.ts
│       │   ├── renderer/
│       │   ├── state/
│       │   ├── types/
│       │   └── utils/
│       ├── test/
│       ├── package.json
│       └── README.md
│
└── out/                                  # Compiled output (gitignored)
```

---

## 4. acoord-3d Rendering Engine

### 4.1 Overview

`acoord-3d` is a standalone Three.js rendering engine extracted from the webview. It provides:

- **Pure rendering** — No computation logic, only display
- **State injection** — External state management via `StoreProvider`
- **Camera callbacks** — `onCameraChange` for UI synchronization
- **InstancedMesh** — Efficient rendering for 1000+ atoms

### 4.2 API

```typescript
import { createRenderer, type StoreProvider } from 'acoord-3d';

const provider: StoreProvider = {
  structure: structureStore,
  display: displayStore,
  lighting: lightingStore,
};

const renderer = createRenderer({
  canvas: document.getElementById('canvas'),
  providers: provider,
  onError: (msg) => console.error(msg),
  onCameraChange: (quat) => updateUI(quat),
});

renderer.renderStructure({
  atoms: [...],
  bonds: [...],
  unitCell: null,
  supercell: [1, 1, 1],
  selectedAtomIds: [],
  selectedBondKeys: [],
  trajectoryFrameIndex: 0,
  trajectoryFrameCount: 1,
});
```

### 4.3 Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Factory function** — `createRenderer()` | Enables dependency injection, testability |
| **State provider injection** | Allows external state management |
| **Camera change callback** | Enables axis indicator, UI sync |
| **No axis indicator** | UI concern, not rendering — host app implements |
| **ESM only** | Modern standard, Three.js is ESM |
| **Three.js peer dependency** | Avoid bundling duplicate Three.js |

### 4.4 Performance Characteristics

- **Draw calls:** O(radius groups) ≈ 5-10, not O(atoms)
- **Triangles per atom:** ~192 (16×12 sphere segments)
- **Memory:** ~5MB per 1000 atoms
- **1000 atoms:** ~10 draw calls, 60 FPS
- **5000 atoms:** ~15 draw calls, 55-60 FPS

---

## 5. Shared Protocol

### 5.1 protocol.ts Rules

`src/shared/protocol.ts` is the **single source of truth** for all IPC messages:

- **Zero imports** — Must be importable in Node.js and browser
- **Only types and constants** — No runtime code
- **No `any`** — All fields must have concrete types
- **Wire prefix** — All wire types prefixed with `Wire`

### 5.2 Core Types

```typescript
interface WireAtom {
  id: string;
  element: string;
  color: string;           // Required — "#RRGGBB"
  position: [number, number, number];
  radius: number;          // Required — Angstroms
  selected?: boolean;
  fixed?: boolean;
}

interface WireRenderData {
  atoms: WireAtom[];
  bonds: WireBond[];
  unitCell: WireUnitCell | null;
  supercell: [number, number, number];
  selectedAtomIds: string[];
  selectedBondKeys: string[];
  trajectoryFrameIndex: number;
  trajectoryFrameCount: number;
}
```

### 5.3 Message Conventions

- **Position:** `[x, y, z]` tuples, Cartesian, Angstroms
- **Color:** CSS hex `#RRGGBB`
- **IDs:** Opaque strings via `crypto.randomUUID()` — never parse structurally
- **Optional fields:** Use `?`, omit key if absent (don't send `undefined`)

### 5.4 Adding a New Message

1. Define interface in `protocol.ts` with `command` literal
2. Add to `ExtensionToWebviewMessage` or `WebviewToExtensionMessage` union
3. Extension: Register handler via `messageRouter.registerTyped('cmd', handler)`
4. Webview: Add `case 'cmd':` in `app.ts` switch (compiler enforces)
5. Write unit test

---

## 6. Extension Host

### 6.1 StructureEditorProvider

Thin coordinator implementing `vscode.CustomEditorProvider`:

**What it does:**
- Lifecycle management (open, save, revert, backup)
- EditorSession creation per panel
- Message routing via `MessageRouter`
- Dirty tracking via `_onDidChangeCustomDocument`

**What it must NOT do:**
- Domain logic (atoms, bonds, unit cells)
- Use `document.uri.fsPath` as session key (causes split-view collision)

### 6.2 EditorSession

Per-panel state container:

```typescript
class EditorSession {
  key: string;                          // 'session_N' — monotonic counter
  document: StructureDocument;
  webviewPanel: vscode.WebviewPanel;
  renderer: RenderMessageBuilder;
  trajectoryManager: TrajectoryManager;
  undoManager: UndoManager;
  // ... services
}
```

**Session keys:** Use `session_1`, `session_2`, NOT `document.uri.fsPath`

### 6.3 MessageRouter

Single dispatch entry point:

```typescript
messageRouter.registerTyped('addAtom', (message: MessageByCommand<'addAtom'>) => {
  return atomEditService.addAtom(message);
});

// In StructureEditorProvider:
async route(message: WebviewToExtensionMessage): Promise<boolean> {
  const handler = this.handlers.get(message.command);
  if (!handler) return false;
  try {
    return await handler(message);
  } catch (error) {
    vscode.window.showErrorMessage(`ACoord: ${error}`);
    return true;
  }
}
```

### 6.4 Services

| Service | Responsibility |
|---------|----------------|
| `AtomEditService` | Add/delete/move/copy/recolor atoms |
| `BondService` | Create/delete/recalculate bonds |
| `SelectionService` | Atom and bond selection state |
| `UnitCellService` | Unit cell CRUD, supercell, centering |
| `DocumentService` | Save, save-as, reload, image export |
| `DisplayConfigService` | Display settings load/save/apply |
| `ClipboardService` | Cross-session clipboard operations |

**Rule:** Services must not reach into another service's domain.

---

## 7. Webview

### 7.1 app.ts — Bootstrap

Entry point responsibilities:
1. Acquire `vscode.postMessage` API
2. Initialize all modules
3. Message switch with `_exhaustive: never` check

```typescript
window.addEventListener('message', (event: MessageEvent<ExtensionToWebviewMessage>) => {
  const message = event.data;
  switch (message.command) {
    case 'render': handleRender(message); break;
    // ... all cases
    default: {
      const _exhaustive: never = message;  // Compile error if case missing
      console.warn('Unhandled:', _exhaustive);
    }
  }
});
```

### 7.2 state.ts — Reactive Stores

8 plain mutable store objects:

| Store | Contents |
|-------|----------|
| `structureStore` | Current structure, selected atom/bond |
| `selectionStore` | Selected atom/bond IDs |
| `displayStore` | Background, unit cell, projection, scales |
| `lightingStore` | Lighting config (ambient, key, fill, rim) |
| `interactionStore` | Drag state, tool mode, box select |
| `trajectoryStore` | Frame index, count, playing, fps |
| `adsorptionStore` | Reference/adsorbate atom IDs |
| `colorSchemeStore` | Current scheme, available schemes |

**Rule:** Stores are single source of truth. No local caching.

### 7.3 axisIndicator.ts

3D orientation overlay (X/Y/Z axes):

- Implemented in **webview**, NOT in acoord-3d
- Receives camera quaternion via `onCameraChange` callback
- DOM-based overlay (not Three.js)
- Depth-aware opacity

---

## 8. I/O and Parsers

### 8.1 Parser Base Class

All parsers extend `StructureParser`:

```typescript
abstract class StructureParser {
  abstract parse(content: string): Structure;
  abstract serialize(structure: Structure): string;
  parseTrajectory?(content: string): Structure[];
}
```

### 8.2 Parser Contract

Every parser must:

1. **Set atom.color and atom.radius** — Required fields, not optional
2. **Throw on empty input** — Descriptive error with parser name
3. **Throw on malformed input** — Include line number and expected value
4. **Preserve metadata** — Store format-specific data in `structure.metadata`

```typescript
// Good parser error:
throw new Error(`XYZParser line ${lineNum}: expected atom count, got "${raw}"`);

// Setting atom properties:
import { BRIGHT_SCHEME } from '../../config/presets/color-schemes/index.js';
import { ELEMENT_DATA } from '../../utils/elementData';

const color = BRIGHT_SCHEME.colors[element] || '#C0C0C0';
const radius = ELEMENT_DATA[element]?.covalentRadius ?? 0.3;
atom.color = color;
atom.radius = radius;
```

### 8.3 Structure.metadata

Extensible store for format-specific data:

```typescript
// Parser sets:
structure.metadata.set('charge', 0);
structure.metadata.set('multiplicity', 1);
structure.metadata.set('comment', '# water molecule');

// Serializer reads:
const charge = (structure.metadata.get('charge') as number) ?? 0;
```

### 8.4 Format Detection

`FileManager` resolves parser by extension. For ambiguous extensions:

```
.out / .log  →  try: QEParser, ORCAParser (in priority order)
.inp         →  try: ORCAParser, QEParser
```

Parser signals "not my format" by throwing. FileManager catches and tries next.

---

## 9. Build System

### 9.1 Extension Host

- **Compiler:** `tsc` (strict mode)
- **Target:** ES2022, module: Node16
- **Output:** `out/` directory

### 9.2 Webview

- **Bundler:** esbuild via `build/webview.mjs`
- **Entry:** `media/webview/src/app.ts`
- **Output:** `out/webview/webview.js`
- **Target:** ES2020, module: ESNext

### 9.3 acoord-3d

- **Bundler:** esbuild via `build.config.mjs`
- **Entry:** `src/index.ts`
- **Output:** `dist/index.js` + source map
- **Format:** ESM only
- **External:** `three` (peer dependency)

### 9.4 Scripts

```bash
npm run compile          # Full build: tsc + esbuild
npm run watch            # Watch both tsc and esbuild
npm run watch:tsc        # Watch tsc only
npm run watch:webview    # Watch esbuild only
npm run lint             # ESLint
npm run test:unit        # Unit tests (Mocha)
npm run test             # Integration tests (VS Code)
```

---

## 10. Testing

### 10.1 Test Convention

- **Unit tests:** `src/test/unit/**/*.test.mts`
- **Integration tests:** `src/test/extension.test.ts`
- **Fixtures:** `src/test/fixtures/` (one per format)

### 10.2 Running Tests

```bash
# Run all unit tests
npm run test:unit

# Run single test file
npx mocha --import tsx --timeout 5000 src/test/unit/parsers/xyz.test.mts

# Run tests matching pattern
npx mocha --import tsx --timeout 5000 --grep "round-trip" "src/test/unit/**/*.test.mts"
```

### 10.3 What Tests Are Required

| Change | Required Test |
|--------|---------------|
| New parser | Round-trip: parse → serialize → parse = same result |
| New service method | Success, failure, edge cases |
| New message type | Dispatch test in `messageRouter.test.mts` |
| New Structure method | Unit test in `structure.test.mts` |

### 10.4 Parser Test Requirements

Parser tests must verify:
- Correct atom count, elements, positions (1e-6 tolerance)
- Round-trip identity
- **Atoms have valid color and radius** (not undefined)
- Metadata preservation
- Empty input throws descriptive error
- Malformed input throws error

---

## 11. Development Workflow

### 11.1 Daily Development

```bash
# Terminal 1: Start watch mode
npm run watch

# Terminal 2: Run tests (optional)
npm run test:unit

# VS Code: Press F5 to launch Extension Development Host
```

### 11.2 Before Committing

```bash
npm run lint           # ESLint check
npm run test:unit      # Run unit tests
npm run compile        # Full build
```

### 11.3 Adding a New Parser

1. Create `src/io/parsers/myFormatParser.ts` extending `StructureParser`
2. Export from `src/io/parsers/index.ts`
3. Register in `FileManager`'s `PARSER_MAP`
4. Add fixture file to `src/test/fixtures/`
5. Write round-trip test

**IMPORTANT:** Parsers MUST set `atom.color` and `atom.radius`:

```typescript
import { BRIGHT_SCHEME } from '../../config/presets/color-schemes/index.js';
import { ELEMENT_DATA } from '../../utils/elementData';

const color = BRIGHT_SCHEME.colors[element] || '#C0C0C0';
const radius = ELEMENT_DATA[element]?.covalentRadius ?? 0.3;
atom.color = color;
atom.radius = radius;
```

---

## 12. Common Pitfalls

### 12.1 What NOT to Do

| ❌ Don't | ✅ Do |
|----------|-------|
| Use `any` on message boundaries | Use protocol types from `protocol.ts` |
| Use `document.uri.fsPath` as session key | Use monotonic counter (`session_N`) |
| Put domain logic in `StructureEditorProvider` | Put it in services |
| Call `renderStructure()` on preview messages | Use local update paths |
| Silently return `false` on errors | Throw descriptive `Error` |
| Create per-atom Three.js geometries | Use `InstancedMesh` |
| Bypass `_exhaustive: never` check | Add the case — compiler enforces it |
| Add wire types without defining in `protocol.ts` | Protocol-first always |
| Use `atoms.find()` for ID lookup | Use `Structure.getAtom(id)` (O(1) map) |
| Calculate atom properties in webview | Extension sets `color`/`radius` |
| Auto-apply DisplaySettings | User must explicitly apply |

### 12.2 Key Files Reference

| File | Purpose |
|------|---------|
| `src/shared/protocol.ts` | Single source of truth for IPC messages |
| `src/models/atom.ts` | Atom class definition |
| `src/models/structure.ts` | Structure class |
| `src/providers/structureEditorProvider.ts` | CustomEditorProvider lifecycle |
| `src/services/messageRouter.ts` | Message dispatch |
| `media/webview/src/app.ts` | Webview entry point |
| `media/webview/src/renderer.ts` | acoord-3d integration |
| `src/io/fileManager.ts` | Format detection |

---

## Additional Resources

- [README.md](README.md) — User-facing documentation
- [AGENTS.md](AGENTS.md) — AI assistant guidelines
- [CHANGELOG.md](CHANGELOG.md) — Version history
- [CURRENT_ISSUES.md](CURRENT_ISSUES.md) — Known issues
