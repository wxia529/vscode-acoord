# QWEN.md — ACoord (VS Code Extension)

## Project Overview

ACoord (Atomic Coordinate Toolkit) is a VS Code extension for 3D visualization and editing of atomic, molecular, and crystal structures. It uses a two-process architecture: Node.js extension host + sandboxed browser webview (Three.js). All inter-process communication (IPC) is typed JSON defined in `src/shared/protocol.ts`.

**Key characteristics:**
- Supports 12 file formats (XYZ, CIF, POSCAR, XDATCAR, OUTCAR, PDB, Gaussian, ORCA, Quantum ESPRESSO, ABACUS STRU, .acoord native)
- Interactive 3D rendering via Three.js inside VS Code Custom Editor API
- Trajectory support for multi-frame files
- Features: atom selection, bond measurement, lattice editing, supercell display, lighting controls, color schemes

**Authoritative documentation:** Read [DEVELOPMENT.md](DEVELOPMENT.md) for complete architecture reference, patterns, and design principles.

---

## Build & Run

```bash
npm run compile          # Full build: tsc + esbuild (webview bundle)
npm run watch            # Watch both tsc and esbuild concurrently
npm run watch:tsc        # Watch tsc only
npm run watch:webview    # Watch esbuild only
npm run lint             # ESLint on src/
npm run test:unit        # Unit tests (Mocha, fast, no VS Code needed)
npm run test             # Integration tests (launches VS Code)
```

### Running a Single Test

Unit tests use Mocha with `.mts` extension and `tsx` loader:

```bash
# Run a single test file
npx mocha --import tsx --timeout 5000 src/test/unit/parsers/xyz.test.mts

# Run tests matching a grep pattern
npx mocha --import tsx --timeout 5000 --grep "round-trip" "src/test/unit/**/*.test.mts"
```

Test files live under `src/test/unit/` with pattern `*.test.mts`.
Fixtures are in `src/test/fixtures/`.

---

## Directory Structure

```
src/
  extension.ts                      # Extension activation, command registration
  shared/
    protocol.ts                     # ALL wire types (no imports - shared between Node/browser)
  models/
    atom.ts                         # Atom class (id, element, position, color, radius)
    structure.ts                    # Structure class (atoms, bonds, unit cell, metadata)
    unitCell.ts                     # UnitCell class (lattice parameters → vectors)
    index.ts                        # Barrel re-exports
  providers/
    structureEditorProvider.ts      # CustomEditorProvider lifecycle (thin coordinator)
    structureDocumentManager.ts     # Load/save/export (delegates to FileManager)
    trajectoryManager.ts            # Multi-frame trajectory state
    undoManager.ts                  # Undo/redo stack of Structure snapshots
  services/
    messageRouter.ts                # Command string → typed handler dispatch
    atomEditService.ts              # Add/delete/move/copy/recolor atoms
    bondService.ts                  # Create/delete/recalculate bonds
    selectionService.ts             # Atom and bond selection state
    unitCellService.ts              # Unit cell CRUD, supercell, centering
    documentService.ts              # Save, save-as, reload, image export
    displayConfigService.ts         # Display settings load/save/apply
    clipboardService.ts             # Cross-session clipboard operations
  renderers/
    renderMessageBuilder.ts         # Build WireRenderData from Structure snapshot
  config/
    types.ts                        # DisplaySettings = Required<WireDisplaySettings>
    defaults.ts                     # getDefaultDisplaySettings()
    colorSchemeManager.ts           # ColorScheme lifecycle (load, save, import, export)
    colorSchemeStorage.ts           # Persistence via ExtensionContext.globalState
    colorSchemeValidator.ts         # JSON schema validation
    colorSchemeUtils.ts             # Color scheme utilities
    presets/color-schemes/          # Built-in presets (bright, jmol); immutable
  io/
    fileManager.ts                  # Format detection, parser dispatch, serialize
    parsers/
      structureParser.ts            # Abstract base class
      xyzParser.ts, cifParser.ts, poscarParser.ts, ...  # Format-specific parsers
      index.ts                      # Barrel re-exports
  utils/
    elementData.ts                  # Periodic table data (symbols, radii)
    parserUtils.ts                  # Shared parsing helpers
  test/
    extension.test.ts               # VS Code integration tests
    fixtures/                       # Representative files per format
    unit/                           # Unit tests (models, parsers, services)

media/webview/
  index.html                        # Webview HTML template
  styles.css                        # Webview CSS
  src/
    app.ts                          # Bootstrap, message dispatch (exhaustive switch)
    renderer.ts                     # Three.js scene, meshes, animate loop
    state.ts                        # 8 reactive stores (plain mutable objects)
    interaction.ts                  # Mouse/keyboard/pointer events (AbortController)
    interactionConfig.ts            # Keyboard shortcut configuration bindings
    interactionDisplay.ts           # Display toggle bindings
    interactionLighting.ts          # Lighting control UI bindings
    settingsUtil.ts                 # Display settings update utility
    colorSchemeHandler.ts           # Color scheme message handlers
    appEdit.ts, appLattice.ts, ...  # Panel UI modules
    state/selectionManager.ts       # Selection logic (multi-select, box-select)
    ui/                             # DOM helpers, input constructors
    utils/                          # Atom size, DOM cache, measurements, transformations

build/
  webview.mjs                       # esbuild config for webview bundle

out/                                # Compiled output (gitignored)
```

---

## Code Style

### TypeScript Strictness

tsconfig.json enforces `strict: true`, `noImplicitAny`, `strictNullChecks`, `noUnusedLocals`, `noUnusedParameters`. These are non-negotiable.

The project uses `"type": "module"` in package.json (native ES modules).

| Target | Module System | Output |
|--------|---------------|--------|
| Extension host | ES2022 | Node16 | out/ |
| Webview | ES2020 | ES2020 | out/webview/webview.js (bundled) |
| Unit tests | ES2022 | Node16 | .mts (loaded via tsx) |

### ESLint Rules

Configured in `eslint.config.mjs` (flat config, typescript-eslint):

- `@typescript-eslint/no-explicit-any`: warn — avoid `any`, especially on message boundaries
- `@typescript-eslint/no-non-null-assertion`: warn — prefer null checks
- `@typescript-eslint/naming-convention`: imports must be `camelCase` or `PascalCase`
- `curly`: warn — always use braces
- `eqeqeq`: warn — always use `===`/`!==`
- `no-throw-literal`: warn — throw `Error` objects, not strings
- `semi`: warn — use semicolons

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Classes | PascalCase | `AtomEditService`, `XYZParser`, `RenderMessageBuilder` |
| Files | camelCase.ts | `atomEditService.ts`, `messageRouter.ts` |
| Interfaces/types | PascalCase | `WireAtom`, `WireDisplaySettings` |
| Wire types | prefixed with `Wire` | `WireAtom`, `WireBond`, `WireRenderData` |
| Message interfaces | `{Action}Message` | `RenderMessage`, `SelectAtomMessage` |
| IDs | opaque strings | `atom_${crypto.randomUUID()}`, `struct_${...}` |
| Constants | UPPER_SNAKE_CASE | `BRIGHT_SCHEME`, `ELEMENT_DATA` |

### Imports

- `src/shared/protocol.ts` must have **zero imports** — shared between Node.js and browser
- Use barrel re-exports from `index.ts` files: `import { Structure } from '../../models'`
- Parsers import base class from `./structureParser` and models from `../../models`

---

## Architecture

### Two-Process Architecture

```
┌───────────────────────────────────┐      JSON       ┌──────────────────────────────────────┐
│         Extension Host (Node)      │ ◄─────────────► │            Webview (Browser)           │
│                                   │                  │                                        │
│  StructureEditorProvider          │                  │  app.ts  (message switch)              │
│    └── EditorSession (per panel)  │                  │    ├── renderer.ts   (Three.js)         │
│          ├── MessageRouter        │                  │    ├── state.ts      (stores)           │
│          ├── TrajectoryManager    │                  │    ├── interaction.ts (input)           │
│          ├── UndoManager          │                  │    └── app*.ts       (panels)           │
│          └── Services (atoms,     │                  │                                        │
│              bonds, selection...) │                  │  Responsibilities:                      │
│                                   │                  │    ✅ Render received data               │
│  Computation Logic (exclusive):   │                  │    ✅ Handle user input                  │
│    - Color/radius calculation     │                  │    ✅ Send messages to extension         │
│    - Bond detection               │                  │                                        │
│    - Parser/serializer logic      │                  │  Does NOT:                              │
│                                   │                  │    ❌ Compute colors/radii               │
│                                   │                  │    ❌ Override atom properties           │
└───────────────────────────────────┘                  └──────────────────────────────────────┘
```

**The rule:** Extension host owns the authoritative model and performs all computations. Webview is a pure rendering surface — it sends user intent as messages and receives canonical data to display.

### Core Design Principles

1. **Protocol-first:** Every message defined in `protocol.ts` before implementation. The `_exhaustive: never` check in `app.ts` enforces completeness.

2. **Service isolation:** Each domain concern (selection, bonds, atoms, unit cells, config) in its own service class. Services must not reach into another service's domain.

3. **StructureEditorProvider is a thin coordinator:** No domain logic — delegate to services.

4. **Immutable model updates:** Edits produce new `Structure` snapshots on the undo stack.

5. **Dispose everything:** Track and release all event listeners, Three.js objects, and `requestAnimationFrame` IDs.

6. **Session keys:** Use monotonic counter (`session_1`, `session_2`), NOT `document.uri.fsPath`.

7. **Three.js:** All objects owned by `renderer.ts`. Use `InstancedMesh` — never per-atom geometries.

8. **Drag previews:** Never call `renderStructure()` on preview messages. Use local update paths.

9. **Extension owns all computation:** Webview receives pre-computed `WireAtom`/`WireBond` data.

10. **DisplaySettings as "current brush":** Represents current rendering settings. Does NOT auto-apply to existing atoms — users must explicitly "apply".

---

## Key Types & Protocol

### Atom Data Model

```typescript
export class Atom {
  id: string;                    // opaque: atom_${uuid}
  element: string;               // e.g., "C", "H", "O"
  x: number, y: number, z: number;  // Cartesian, Angstroms
  
  // Required — always have concrete values (NOT computed at render time)
  color: string;                 // CSS hex: "#RRGGBB"
  radius: number;                // Angstroms
  
  // Optional metadata
  label?: string;
  fixed: boolean;
  selectiveDynamics?: [boolean, boolean, boolean];
  
  // Temporary state (not saved)
  selected: boolean;
}
```

**Why this design:**
- No runtime computation — webview renders directly without calculation
- Explicit data — atom's appearance is stored with the atom, not derived
- Round-trip preservation — saving to `.acoord` preserves user modifications
- Multi-frontend support — any frontend can render without reimplementing logic

### Message Types

All messages defined in `src/shared/protocol.ts`:

```typescript
// Extension → Webview
type ExtensionToWebviewMessage =
  | RenderMessage            // 'render'
  | DisplayConfigChangedMessage
  | ColorSchemesLoadedMessage
  | ImageSavedMessage
  | ...;

// Webview → Extension
type WebviewToExtensionMessage =
  | SelectAtomMessage        // 'selectAtom'
  | AddAtomMessage           // 'addAtom'
  | MoveAtomMessage          // 'moveAtom'
  | ApplyDisplaySettingsMessage  // 'applyDisplaySettings'
  | ...;  // 37 commands total
```

**Position convention:** `[number, number, number]` tuples (Cartesian, Angstroms)
**Color convention:** CSS hex `#RRGGBB` strings
**ID convention:** Opaque strings via `crypto.randomUUID()` — never parse or compare structurally

### Adding a New Message

1. Define interface in `protocol.ts` with `command` string literal
2. Add to `ExtensionToWebviewMessage` or `WebviewToExtensionMessage` union
3. Extension: register handler via `messageRouter.registerTyped('cmd', handler)`
4. Webview: add `case 'cmd':` in `app.ts` switch (compiler enforces this)
5. Write unit test in `src/test/unit/`

---

## Error Handling

### Extension Host Services

- Throw `Error` with descriptive messages
- `MessageRouter.route()` catches all handler errors and calls `vscode.window.showErrorMessage`
- Handlers should NOT call `showErrorMessage` directly (exception: `DocumentService`)
- Service return values: `boolean` means "handled" not "succeeded". Return `false` only for routing misses.

```typescript
// Good service error:
throw new Error(`addAtom: invalid element symbol "${message.element}"`);
```

### Parsers

- Throw `Error` with parser name, line number, and what was expected
- Return `[]` for empty input (never throw on empty string)
- Never return an empty `Structure` for errors

```typescript
// Good parser error:
throw new Error(`XYZParser: line ${lineNum}: expected integer atom count, got "${raw}"`);
```

### Webview

- Use `_exhaustive: never` pattern in message switch for compile-time completeness
- Do not throw on unknown messages — log and ignore

---

## Testing Requirements

| Change | Required Test |
|--------|---------------|
| New parser | Round-trip: `parse(fixture)` → `serialize()` → `parse()` → same result |
| New service method | Success, failure, and edge cases |
| New message type | Dispatch test in `messageRouter.test.mts` |
| New `Structure` method | Unit test in `structure.test.mts` |

**Parser tests must verify:**
- Correct atom count/elements/positions (1e-6 tolerance)
- Round-trip identity
- Metadata preservation
- Empty input returns `[]`
- Malformed input throws
- Atoms have valid color and radius

---

## Common Mistakes to Avoid

| ❌ Don't | ✅ Do |
|----------|-------|
| Use `any` on message boundaries | Use protocol types from `protocol.ts` |
| Use `document.uri.fsPath` as session map key | Use monotonic counter (`session_N`) |
| Put domain logic in `StructureEditorProvider` | Put it in services |
| Call `renderStructure()` on preview/drag messages | Use local update paths |
| Silently return `false` on domain errors | Throw descriptive `Error` |
| Store non-serializable objects in `Structure.metadata` | Only store JSON-serializable data |
| Create per-atom Three.js geometries | Use `InstancedMesh` |
| Bypass the `_exhaustive: never` check in `app.ts` | Add the case — compiler enforces it |
| Add wire types without defining in `protocol.ts` first | Protocol-first always |
| Use `atoms.find()` for ID lookup | Use `Structure.getAtom(id)` (O(1) map) |
| Calculate atom properties in webview | Extension sets `color`/`radius` |
| Auto-apply DisplaySettings to existing atoms | User must explicitly apply |
| Confuse atom properties (saved to .acoord) with display settings (not saved) | Keep them separate |

---

## Development Workflow

### Daily Development

```bash
# Terminal 1: Start watch mode
npm run watch

# Terminal 2: Run tests (optional)
npm run test:unit

# VS Code: Press F5 to launch Extension Development Host
```

### Before Committing

```bash
npm run lint           # ESLint check
npm run test:unit      # Run unit tests
npm run compile        # Full build
```

### Adding a New Parser

1. Create `src/io/parsers/myFormatParser.ts` extending `StructureParser`
2. Export from `src/io/parsers/index.ts`
3. Register in `FileManager`'s `PARSER_MAP`
4. Add fixture file to `src/test/fixtures/`
5. Write round-trip test at `src/test/unit/parsers/`

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

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/shared/protocol.ts` | Single source of truth for all IPC messages |
| `src/models/atom.ts` | Atom class definition |
| `src/models/structure.ts` | Structure class (atoms, bonds, unit cell) |
| `src/providers/structureEditorProvider.ts` | VS Code CustomEditorProvider lifecycle |
| `src/services/messageRouter.ts` | Message dispatch (command → handler) |
| `src/renderers/renderMessageBuilder.ts` | Transform Structure → WireRenderData |
| `media/webview/src/app.ts` | Webview entry point, message switch |
| `media/webview/src/renderer.ts` | Three.js scene management |
| `src/io/fileManager.ts` | Format detection, parser dispatch |
| `src/config/colorSchemeManager.ts` | Color scheme lifecycle |

---

## Additional Resources

- [DEVELOPMENT.md](DEVELOPMENT.md) — Complete architecture reference (1839 lines)
- [CURRENT_ISSUES.md](CURRENT_ISSUES.md) — Verified open issues
- [CHANGELOG.md](CHANGELOG.md) — Version history
- [README.md](README.md) — User-facing feature documentation
