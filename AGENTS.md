# AGENTS.md — ACoord (VS Code Extension)

## Project Overview

ACoord is a VS Code extension for 3D visualization and editing of atomic, molecular, and crystal structures.

**Architecture:** Two-process (Node.js extension host + browser webview with Three.js)
**IPC:** Typed JSON messages via `src/shared/protocol.ts`
**Rendering:** `acoord-3d` standalone package

**Key facts:**
- 15 file formats (XYZ, CIF, POSCAR, XDATCAR, OUTCAR, PDB, Gaussian, ORCA, QE, ABACUS STRU, CASTEP, SIESTA, .acoord)
- 50+ webview commands, all typed
- Extension owns computation; webview is pure rendering

**Authoritative docs:** [DEVELOPMENT.md](DEVELOPMENT.md)

---

## Quick Commands

```bash
npm run compile          # Full build
npm run watch            # Watch mode (tsc + esbuild)
npm run lint             # ESLint
npm run test:unit        # Unit tests (no VS Code)
npm run test             # Integration tests
```

**Single test:**
```bash
npx mocha --import tsx --timeout 5000 src/test/unit/parsers/xyz.test.mts
```

---

## Directory Structure (Simplified)

```
src/
  extension.ts                      # Activation
  shared/protocol.ts                # ALL wire types (ZERO imports)
  models/                           # Atom, Structure, UnitCell
  providers/                        # CustomEditorProvider, UndoManager
  services/                         # MessageRouter, AtomEdit, Bond, Selection...
  io/parsers/                       # 15 format parsers
  config/                           # Color schemes, display settings

media/webview/
  src/
    app.ts                          # Bootstrap + message switch
    renderer.ts                     # acoord-3d integration
    state.ts                        # 8 stores
    interaction.ts                  # Input handling
    axisIndicator.ts                # 3D axis overlay

packages/acoord-3d/                 # Standalone rendering engine
  src/
    index.ts                        # createRenderer()
    renderer/                       # Three.js rendering
    state/                          # State injection
```

---

## Code Style (Non-Negotiable)

**TypeScript:** `strict: true`, `noImplicitAny`, `strictNullChecks`

**ESLint rules:**
- No `any` on message boundaries
- No `no-non-null-assertion`
- Always `===`/`!==`
- Throw `Error` objects, not strings

**Naming:**
- Classes: `PascalCase` (AtomEditService)
- Files: `camelCase.ts` (atomEditService.ts)
- Wire types: `Wire` prefix (WireAtom)
- IDs: `atom_${uuid}` (opaque, never parse)

**Imports:**
- `protocol.ts` has **zero imports**
- Use barrel exports: `import { Structure } from '../../models'`

---

## Architecture Rules

### The Golden Rule

**Extension host owns computation. Webview is pure rendering.**

```
Extension Host (Node)          Webview (Browser)
  - Color/radius calculation     - Render received data
  - Bond detection               - Handle user input
  - Parser/serializer            - Send messages to extension
  - ALL domain logic             - NO computation
```

### Design Principles

1. **Protocol-first** — Define in `protocol.ts` before implementation
2. **Service isolation** — No cross-service domain access
3. **Thin coordinator** — StructureEditorProvider delegates to services
4. **Immutable updates** — Edits produce new Structure snapshots
5. **Dispose everything** — Track all listeners, Three.js objects, RAF IDs
6. **Session keys** — Use `session_N`, NOT `document.uri.fsPath`
7. **InstancedMesh** — Never per-atom geometries
8. **No preview renderStructure()** — Use local update paths
9. **DisplaySettings = "current brush"** — Must explicitly apply

---

## Key Types

### Atom Model

```typescript
class Atom {
  id: string;           // atom_${uuid}
  element: string;      // "C", "H", "O"
  x: number, y: number, z: number;  // Cartesian, Angstroms
  color: string;        // "#RRGGBB" — REQUIRED, pre-computed
  radius: number;       // Angstroms — REQUIRED, pre-computed
  selected: boolean;    // Temporary (not saved)
}
```

**Why:** No runtime computation in webview. Round-trip preservation.

### Adding a Message

1. Define in `protocol.ts` with `command` literal
2. Add to message union
3. Extension: `messageRouter.registerTyped('cmd', handler)`
4. Webview: `case 'cmd':` in `app.ts` switch (compiler enforces)
5. Write test

---

## Error Handling

**Services:** Throw descriptive `Error`, let MessageRouter catch and show

```typescript
throw new Error(`addAtom: invalid element "${message.element}"`);
```

**Parsers:** Include parser name, line number, expected value

```typescript
throw new Error(`XYZParser line ${lineNum}: expected atom count, got "${raw}"`);
```

**Webview:** `_exhaustive: never` pattern — compiler enforces completeness

---

## Common Mistakes (MUST AVOID)

| ❌ Don't | ✅ Do |
|----------|-------|
| `any` on message boundaries | Use protocol types |
| `document.uri.fsPath` as session key | Use `session_N` counter |
| Domain logic in StructureEditorProvider | Put in services |
| `renderStructure()` on preview | Use local update paths |
| Return `false` silently on errors | Throw descriptive Error |
| Per-atom Three.js geometries | Use `InstancedMesh` |
| Bypass `_exhaustive: never` | Add case — compiler enforces |
| `atoms.find()` for ID lookup | Use `Structure.getAtom(id)` (O(1)) |
| Calculate color/radius in webview | Extension sets pre-computed |
| Auto-apply DisplaySettings | User must explicitly apply |

---

## Testing Requirements

| Change | Required Test |
|--------|---------------|
| New parser | Round-trip: parse → serialize → parse |
| New service method | Success, failure, edge cases |
| New message type | Dispatch test in messageRouter.test.mts |
| New Structure method | Unit test in structure.test.mts |

**Parser tests must verify:**
- Atom count, elements, positions (1e-6 tolerance)
- Round-trip identity
- **Atoms have valid color and radius**
- Metadata preservation
- Empty/malformed input throws

---

## Workflow

### Daily Development

```bash
npm run watch          # Terminal 1
npm run test:unit      # Terminal 2 (optional)
# Press F5 in VS Code
```

### Before Committing

```bash
npm run lint && npm run test:unit && npm run compile
```

### Adding a Parser

1. Create `src/io/parsers/myFormatParser.ts` extends `StructureParser`
2. Export from `index.ts`, register in `FileManager.PARSER_MAP`
3. Add fixture to `src/test/fixtures/`
4. Write round-trip test

**MUST set atom.color and atom.radius:**
```typescript
import { BRIGHT_SCHEME } from '../../config/presets/color-schemes/index.js';
import { ELEMENT_DATA } from '../../utils/elementData';

atom.color = BRIGHT_SCHEME.colors[element] || '#C0C0C0';
atom.radius = ELEMENT_DATA[element]?.covalentRadius ?? 0.3;
```

---

## Key Files

| File | Purpose |
|------|---------|
| `src/shared/protocol.ts` | IPC single source of truth |
| `src/models/structure.ts` | Structure class |
| `src/services/messageRouter.ts` | Command dispatch |
| `media/webview/src/app.ts` | Webview entry point |
| `media/webview/src/renderer.ts` | acoord-3d integration |
| `packages/acoord-3d/src/index.ts` | createRenderer() factory |

---

## Resources

- [DEVELOPMENT.md](DEVELOPMENT.md) — Full architecture
- [README.md](README.md) — User documentation
- [CHANGELOG.md](CHANGELOG.md) — Version history
