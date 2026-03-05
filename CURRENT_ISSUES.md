# ACoord — Current Codebase Issues

**Generated:** 2026-03-05
**Last Updated:** 2026-03-05
**Codebase Version:** 0.2.0
**Scope:** Issues verified against current source code. No aspirational items.

This document catalogs verified issues in the current ACoord codebase,
organized by category and severity. Each issue includes the file, line
numbers, and a description of the problem and its impact.

---

## Resolved Since Generation

### ✓ Atom drag stuttering / bond jitter (was: §5 Webview Issues)

**Root cause:** Every `pointermove` during atom drag triggered a full
`renderStructure()` round-trip:

```
pointermove
  → vscode.postMessage({ command: 'moveAtom', preview: true })
  → [extension host] atomEditService.moveAtom()
  → [extension host] renderStructure() → getRenderMessage() (rebuilds all bonds)
  → webviewPanel.webview.postMessage(fullRenderMessage)
  → [webview] renderer.renderStructure() — disposes + rebuilds ALL meshes
```

This created visible jitter because:
1. The full rebuild was expensive (O(atoms + bonds) allocations per frame).
2. Two competing tracks: the lerp-smoothed local atom position vs. the
   round-tripped extension position would fight on alternating frames.

**Fix (committed 2026-03-05):**

- `src/providers/structureEditorProvider.ts` — `handleWebviewMessage()` now
  detects `moveAtom`/`moveGroup` with `preview: true` and skips `renderStructure()`.
  The extension model is still updated (so `endDrag` commits the correct position
  and undo works) but no round-trip render is sent back.

- `media/webview/src/renderer.ts` — Added `updateBondPositions(moves)` function
  that incrementally updates only the affected bond `InstancedMesh` matrices
  when given a map of `atomId → newWorldPosition`.  The renderer now maintains:
  - `bondInstanceIndex`: maps `bondKey → [half0_entry, half1_entry]` with enough
    information to recompute each half-cylinder's matrix from atom positions.
  - `atomBondKeys`: maps `atomId → Set<bondKey>` for O(1) lookup of affected bonds.
  - `bondHalfEndpoints`: stores initial endpoint positions per half (for supercell cases).

- `media/webview/src/app.ts` — `onDragAtom` and `onDragGroup` callbacks now call
  `renderer.updateBondPositions()` immediately after `renderer.updateAtomPosition()`,
  keeping bonds visually in sync with the atom on every frame with no IPC overhead.

**Result:** Bond cylinders now follow the dragged atom smoothly at full frame rate.
The extension-host round-trip is deferred until `endDrag` fires, which triggers one
final `renderStructure()` to commit the canonical geometry.

---

## Table of Contents

1. [Architecture & Design](#1-architecture--design)
2. [Error Handling Inconsistencies](#2-error-handling-inconsistencies)
3. [Dead Code](#3-dead-code)
4. [Parser Issues](#4-parser-issues)
5. [Webview Issues](#5-webview-issues)
6. [Test Coverage Gaps](#6-test-coverage-gaps)

---

## 1. Architecture & Design

### 1.1 RenderMessageBuilder Violates SRP (Medium)

**File:** `src/renderers/renderMessageBuilder.ts` (417 lines)

`RenderMessageBuilder` has two distinct responsibilities:

- **State store:** Holds selection state (`selectedAtomId`, `selectedAtomIds`,
  `selectedBondKey`, `selectedBondKeys`) in `RendererState` (line 29). Methods
  `selectAtom()`, `setSelection()`, `deselectAtom()`, `deselectBond()` mutate
  this state. Critically, `setSelection()` (lines 80-82) directly mutates
  domain model `Atom` objects by setting `atom.selected = true/false`.

- **Geometry generator:** Methods `getAtomGeometry()`, `getBondGeometry()`,
  `getPeriodicBondGeometry()`, `getUnitCellGeometry()`, `getRenderAtomGeometry()`,
  and `getRenderBondGeometry()` transform domain data into wire format.

**Impact:** Selection state leaks into the domain model (`Atom.selected` is a
view-layer concern). The class is difficult to test in isolation because
exercising geometry generation requires setting up selection state and vice
versa.

### 1.2 UndoManager.applyUndo/applyRedo Violate SRP (Medium)

**File:** `src/providers/undoManager.ts`, lines 126-170

`applyUndo()` and `applyRedo()` each take three parameters:
`traj: TrajectoryManager`, `renderer: RenderMessageBuilder`,
`clearSelection: () => void`. They directly call `traj.updateActiveFrame()`,
`renderer.setStructure()`, `renderer.setShowUnitCell()`, and
`clearSelection()`.

**Impact:** The undo manager knows about trajectory management, rendering, and
selection clearing. Its pure responsibility should be stack management
(`push`/`pop`/`redo`/`clear`). The cross-cutting orchestration belongs in the
caller (e.g., `StructureEditorProvider`).

### 1.3 MessageRouter Has 13 Constructor Parameters (Low)

**File:** `src/services/messageRouter.ts`, lines 25-47

The constructor takes: `renderer`, `trajectoryManager`, `undoManager`,
`selectionService`, `bondService`, `atomEditService`, `unitCellService`,
`documentService`, `displayConfigService`, `sessionKey`, `webviewPanel`,
`onRenderRequired`, `onSelectionClearRequired`.

**Impact:** God Object smell. Adding a new service requires modifying the
constructor signature, `EditorSession`, and `StructureEditorProvider`. A
parameter object or builder pattern would reduce coupling.

### 1.4 EditorSession Has 14 Fields (Low)

**File:** `src/providers/structureEditorProvider.ts`, lines 30-52

The session object holds `key`, `document`, `webviewPanel`, `renderer`,
`trajectoryManager`, `undoManager`, `selectionService`, `bondService`,
`atomEditService`, `unitCellService`, `documentService`, `displayConfigService`,
`displaySettings`, and `messageRouter`.

**Impact:** Same God Object concern as 1.3. Tightly couples all services to
the session lifecycle.

### 1.5 DisplayConfigService Has setCallbacks Temporal Coupling (Medium)

**File:** `src/services/displayConfigService.ts`, line 15

The service is constructed (line 123 of `structureEditorProvider.ts`) before
`setCallbacks(postMessage, session)` is called (line 145). Between
construction and `setCallbacks`, `postMessageCallback` and `sessionRef` are
`undefined`. Multiple handler methods guard with
`if (!this.postMessageCallback) { return false; }`.

**Impact:** The object is in an invalid state between construction and
`setCallbacks`. A caller forgetting to call `setCallbacks` gets silent
failures, not a type error. Constructor injection would prevent this.

### 1.6 UnitCellService Directly Calls VS Code UI API (Medium)

**File:** `src/services/unitCellService.ts`, lines 88, 96

`centerToUnitCell()` calls `vscode.window.showWarningMessage()` (line 96) and
`vscode.window.showErrorMessage()` (line 88) directly. This is the only
service with a direct VS Code UI dependency.

**Impact:** The service cannot be unit tested without mocking `vscode.window`.
All other services delegate UI concerns to `MessageRouter` or throw errors
that `MessageRouter.route()` catches and displays.

### 1.7 Duplicate ConfigItem Interface (Low)

**File:** `src/extension.ts`, lines 270 and 380

`interface ConfigItem extends vscode.QuickPickItem { id?: string; }` is
defined identically in two different command handler closures.

**Impact:** Code duplication. Should be extracted to a single definition at
file scope.

---

## 2. Error Handling Inconsistencies

The codebase uses four different error handling strategies across services,
making the contract implicit and confusing for contributors.

### 2.1 AtomEditService Returns false Silently (Medium)

**File:** `src/services/atomEditService.ts`

- `addAtom()` (lines 27-31): Returns `false` when `parseElement()` fails.
- `changeAtoms()` (lines 172-174): Returns `false` on invalid element.
- `setAtomColor()` (line 195): Returns `false` on invalid input.
- `updateAtom()` (lines 226-228): Returns `false` if atom not found.

**Impact:** The caller (`messageRouter.ts` line 158) interprets `false` as
"message not handled," which is semantically wrong — the message was received,
the operation just failed. No feedback reaches the user.

### 2.2 BondService Returns Silently on Failure (Medium)

**File:** `src/services/bondService.ts`, lines 90-122

`setBondLength()` silently returns (no throw, no `false`, no logging) when:
- `atomIds.length < 2` (line 90)
- `length` is not a number (line 93)
- Either atom is not found (lines 103-105)
- Current bond length is essentially zero (lines 113-122)

**Impact:** User actions (setting bond length) silently fail with no feedback.

### 2.3 DisplayConfigService Swallows Errors via postMessage (Low)

**File:** `src/services/displayConfigService.ts`

Every `handle*` method catches errors and sends them via
`postMessage({ command: 'displayConfigError', error: String(error) })` at
lines 67-69, 86-89, 109-112, 153-157, 193-197, 210-213, 237-241, 252-256.
All catch blocks return `true`, claiming success.

**Impact:** The separate error channel means `MessageRouter.route()` never
sees failures. Config errors may be silently dropped if the webview doesn't
handle `displayConfigError` properly.

### 2.4 DocumentService Has Redundant try/catch Blocks (Low)

**File:** `src/services/documentService.ts`

Every public method (`saveStructure` line 12, `saveStructureAs` line 85,
`saveRenderedImage` line 126, `openSource` line 143, `reloadStructure`
line 159) wraps its body in try/catch that calls
`vscode.window.showErrorMessage()` and returns silently.

**Impact:** `MessageRouter.route()` (lines 61-68) already has a catch-all
try/catch. The inner catches are redundant and swallow the error before it
reaches the router, preventing centralized error logging.

---

## 3. Dead Code

### 3.1 Extension Host Dead Code

| Item | File | Line | Evidence |
|---|---|---|---|
| `generateSupercell()` | `src/models/structure.ts` | 279 | Never called |
| `centerAtOrigin()` | `src/models/structure.ts` | 271 | Never called |
| `hasManualBond()` | `src/models/structure.ts` | 88 | Never called |
| `estimatedMemoryMB` getter | `src/providers/undoManager.ts` | 110 | Never read |
| `rollbackEdit()` | `src/providers/trajectoryManager.ts` | 65 | Never called |
| `resetToDefault()` | `src/config/configManager.ts` | 314 | Never called |
| `getParameters()` | `src/models/unitCell.ts` | 31 | Never called |
| `hasHandler()` | `src/services/messageRouter.ts` | 72 | Never called |
| `register()` | `src/services/messageRouter.ts` | 49 | Redundant wrapper for `registerTyped()`, never called externally |
| `MessageCommand` type | `src/shared/protocol.ts` | 522 | Never imported |
| Placeholder `addAtom` cmd | `src/extension.ts` | 246 | Shows info message, no function |
| Placeholder `deleteAtom` cmd | `src/extension.ts` | 255 | Shows info message, no function |

### 3.2 Webview Dead Code

| Item | File | Line | Evidence |
|---|---|---|---|
| `throttle()` | `media/webview/src/utils/performance.ts` | 39 | Never called (only `debounce` is used) |
| `clearElementCache()` | `media/webview/src/utils/domCache.ts` | 21 | Never called |
| `RendererHandlers` interface | `media/webview/src/types.ts` | 107 | Never imported |

### 3.3 Dead Test File

| Item | File | Evidence |
|---|---|---|
| `simple-tests.ts` | `src/test/unit/simple-tests.ts` | Uses `console.log` assertions, not `.test.mts` extension, not picked up by Mocha (`.mocharc.json` spec pattern is `**/*.test.mts`) |

---

## 4. Parser Issues

### 4.1 Silent Empty Return on Invalid Input (Medium)

Three parsers silently return empty structures instead of throwing on
malformed input:

| Parser | File | Behavior |
|---|---|---|
| CIFParser | `src/io/parsers/cifParser.ts:12-20` | Returns empty `Structure` if no atoms/cell found |
| PDBParser | `src/io/parsers/pdbParser.ts:11-56` | Returns empty `Structure` if no ATOM/HETATM lines |
| STRUParser | `src/io/parsers/struParser.ts:14-177` | Returns empty `Structure` if no atomic positions |

All other parsers (XYZ, POSCAR, OUTCAR, QE, GJF, ORCA) throw on invalid
content. The inconsistency means callers cannot distinguish "valid file with
0 atoms" from "completely wrong file format."

### 4.2 Inconsistent parse() Return-Frame Convention (Low)

| Parser | Returns | Line |
|---|---|---|
| XYZParser | First frame (`frames[0]`) | Line 21 |
| QEParser | Last frame (`frames[frames.length - 1]`) | Line 39 |
| OUTCARParser | Last frame | Line 18 |
| XDATCARParser | Last frame | Line 27 |

XYZ returns the first frame while all trajectory-capable parsers return the
last. The convention should be documented or standardized.

### 4.3 STRU Parser Uses Wrong Comment Delimiter (Medium)

**File:** `src/io/parsers/struParser.ts`, lines 243-246

The `cleanLine()` method strips comments using `line.split('//')[0]`. ABACUS
STRU files use `#` for comments, not `//`. Lines with `#` comments will be
parsed as data, potentially causing silent errors or incorrect structures.

### 4.4 .inp Extension Always Routes to ORCA (Low)

**File:** `src/io/fileManager.ts`, line 26

The `PARSER_MAP` maps `inp` exclusively to `ORCAParser`. Quantum ESPRESSO
also uses `.inp` files. QE `.inp` files will be rejected with "Invalid ORCA
input: missing * xyz block" instead of being tried against the QE parser.

Note: Content-sniffing already exists for `.out` and `.log` extensions
(lines 88-106) and could be extended to `.inp`.

---

## 5. Webview Issues

### 5.1 interaction.dispose() Never Called (Medium)

**File:** `media/webview/src/interaction.ts` lines 320-324,
`media/webview/src/app.ts`

`interaction.ts` has an `AbortController` (line 22) and a `dispose()` function
(line 320) that calls `controller.abort()`. However, `app.ts` imports only
`init` from interaction (line 9) and never imports or calls `dispose()`. The
renderer has its own `dispose()` wired to `beforeunload` (renderer.ts
line 1112), but the interaction module's event listeners are never cleaned up.

**Impact:** When the webview is destroyed and recreated (e.g., tab
hidden/shown), stale event listeners may remain active.

### 5.2 transformations.ts Directly Calls Renderer (Low)

**File:** `media/webview/src/utils/transformations.ts`, line 190

The utility module directly calls
`renderer.renderStructure(structureStore.currentStructure, ...)` during
rotation preview. Utility modules should not have upward dependencies on the
renderer.

**Impact:** Tight coupling prevents independent testing of transformations
and makes the renderer dependency graph cyclic (renderer -> transformations
is expected, but transformations -> renderer is a layering violation).

### 5.3 renderStructure() is a 284-Line Monolith (Low)

**File:** `media/webview/src/renderer.ts`, lines 466-750

The function handles in a single body: auto-scaling, disposing old meshes,
building instanced atom meshes, building ghost atom meshes, building instanced
bond meshes, building unit cell geometry, updating UI, and fitting the camera.

**Impact:** Difficult to understand, modify, or test individual rendering
phases. Any change risks breaking unrelated rendering logic.

### 5.4 AppCallbacks Migration Incomplete (Low)

**File:** `media/webview/src/types.ts` line 119, `media/webview/src/app.ts`
line 177

`AppCallbacks` is marked `@deprecated` but `app.ts` still constructs the full
monolithic object (line 177, ~30 properties) and passes it to `setupEdit()`,
`setupLattice()`, `setupTools()`. The downstream modules already accept
narrower domain-specific interfaces (`VscodeContext & SelectionContext &
EditContext`, etc.), so the migration is structurally complete on the consumer
side but not on the producer side.

### 5.5 State Stores Have No Reactive Mechanism (Low)

**File:** `media/webview/src/state.ts`

All 8 stores (`structureStore`, `selectionStore`, `displayStore`,
`lightingStore`, `interactionStore`, `trajectoryStore`, `adsorptionStore`,
`configStore`) are plain mutable objects. Direct property mutation
(e.g., `displayStore.showAxes = true`) has no notification mechanism. Code
that needs to react to state changes must be called explicitly.

**Impact:** No automatic propagation of state changes. Adding new state
consumers requires manually wiring up calls at every mutation site.

---

## 6. Test Coverage Gaps

### 6.1 Current Test Stats

- **179 tests** across 17 Mocha test files, all passing
- All 10 parsers have test files with fixture-based round-trip tests
- Tests use both inline strings and fixture files from `src/test/fixtures/`

### 6.2 Missing Test Coverage

| Area | Gap |
|---|---|
| Parser error paths | Only ORCA has an error-path test ("should throw on missing * xyz block"). CIF, PDB, STRU silently return empty — this behavior is untested. |
| FileManager | No tests for format selection, extension mapping, content sniffing, or the `.out`/`.log` multi-parser fallback logic. |
| Utility functions | No tests for `expandElements()`, `fractionalToCartesian()` (standalone), `parseElement()`, or `parserUtils.ts` helpers. |
| Extended format features | No tests for CIF symmetry operations, QE output parsing, PDB multi-model, XDATCAR multi-frame beyond basic cases, OUTCAR forces/energy extraction. |
| Services | No unit tests for `SelectionService`, `BondService`, `AtomEditService`, `UnitCellService`, `DocumentService`, `DisplayConfigService`, or `MessageRouter`. |
| Dead test file | `src/test/unit/simple-tests.ts` is not picked up by Mocha (wrong extension pattern). |

---

*End of document.*
