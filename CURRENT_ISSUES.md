# ACoord — Current Codebase Issues

**Last Updated:** 2026-03-05  
**Codebase Version:** 0.2.0  
**Scope:** Issues verified against current source code. No aspirational items.

This document catalogs **verified, open issues** in the current ACoord
codebase, organized by severity and category. Each issue includes the file,
line numbers, impact, and the recommended fix.

When an issue is resolved, move it to the **Resolved** section at the bottom
with a note on the commit/date. Do not delete resolved entries — they serve as
a record of why a design decision was made.

---

## Table of Contents

1. [Architecture & Design](#1-architecture--design)
2. [Type Safety](#2-type-safety)
3. [Error Handling Inconsistencies](#3-error-handling-inconsistencies)
4. [Parser Issues](#4-parser-issues)
5. [Webview Issues](#5-webview-issues)
6. [Dead Code](#6-dead-code)
7. [Test Coverage Gaps](#7-test-coverage-gaps)

---

## 1. Architecture & Design

### 1.1 RenderMessageBuilder Mixes Selection State with Geometry Generation (Medium)

**File:** `src/renderers/renderMessageBuilder.ts` (~417 lines)

`RenderMessageBuilder` has two distinct responsibilities:

- **View-state store:** Holds `selectedAtomId`, `selectedAtomIds`,
  `selectedBondKey`, `selectedBondKeys` in a `RendererState` struct. Methods
  `selectAtom()`, `setSelection()`, `deselectAtom()`, `deselectBond()` mutate
  this state. `setSelection()` directly mutates domain model `Atom` objects
  by setting `atom.selected = true/false`.

- **Geometry generator:** Transforms domain data into `WireRenderData`
  (atoms, bonds, unit cell geometry).

**Impact:** `atom.selected` is a view-layer concern leaking into the domain
model. The class is harder to test in isolation because geometry generation
requires setting up selection state.

**Fix:** Move selection state out of `RenderMessageBuilder` into
`SelectionService`. `RenderMessageBuilder.setSelection()` should be replaced
by a `SelectionService` that owns `atom.selected` toggling, and
`getRenderMessage()` should read from it.

---

### 1.2 UndoManager Orchestrates Too Much (Medium)

**File:** `src/providers/undoManager.ts`, lines 126–170

`applyUndo()` and `applyRedo()` each take three parameters:
`traj: TrajectoryManager`, `renderer: RenderMessageBuilder`,
`clearSelection: () => void`. Internally they call `traj.updateActiveFrame()`,
`renderer.setStructure()`, `renderer.setShowUnitCell()`, and
`clearSelection()`.

**Impact:** The undo manager knows about trajectory management, rendering, and
selection clearing. Its pure responsibility is stack management
(`push` / `pop` / `redo` / `clear`). The orchestration belongs in the caller
(`StructureEditorProvider.undoLastEdit` / `redoLastEdit`).

**Fix:** `applyUndo()` / `applyRedo()` should return the `Structure` snapshot
and nothing else. The caller is responsible for updating the trajectory,
renderer, and selection.

---

### 1.3 MessageRouter Receives vscode.WebviewPanel Directly (Low)

**File:** `src/services/messageRouter.ts`, line ~36

`MessageRouter` receives a `vscode.WebviewPanel` directly in its constructor.
`DEVELOPMENT.md §2.1` rule 3 states that services must not hold a direct
reference to `WebviewPanel`. The panel reference is only used in one handler
(`saveRenderedImage`) to post a response message.

**Impact:** `MessageRouter` cannot be tested without a real or mocked
`WebviewPanel`. Increases coupling between the service layer and VS Code API.

**Fix:** Replace the panel reference with a `postMessage` callback:
```typescript
constructor(
  ...services,
  postMessage: (msg: ExtensionToWebviewMessage) => void
) { ... }
```
The provider passes `(msg) => session.webviewPanel.webview.postMessage(msg)`.

---

### 1.4 MessageRouter Has 13 Constructor Parameters (Low)

**File:** `src/services/messageRouter.ts`, lines 25–47

The constructor takes: `renderer`, `trajectoryManager`, `undoManager`,
`selectionService`, `bondService`, `atomEditService`, `unitCellService`,
`documentService`, `displayConfigService`, `sessionKey`, `webviewPanel`,
`onRenderRequired`, `onSelectionClearRequired`.

**Impact:** Adding a new service requires modifying the constructor signature,
`EditorSession`, and `StructureEditorProvider`. A parameter object would
reduce the blast radius of each addition.

**Fix:** Group into a `RouterDependencies` object:
```typescript
interface RouterDependencies {
  renderer: RenderMessageBuilder;
  trajectoryManager: TrajectoryManager;
  // ...
}
constructor(deps: RouterDependencies) { ... }
```

---

### 1.5 DisplayConfigService Has Temporal Coupling via setCallbacks() (Medium)

**File:** `src/services/displayConfigService.ts`, line ~15

The service is constructed before `setCallbacks(postMessage, session)` is
called. Between construction and `setCallbacks`, `postMessageCallback` and
`sessionRef` are `undefined`. Multiple handler methods guard with
`if (!this.postMessageCallback) { return false; }` — the object is in an
invalid state.

**Impact:** A caller who forgets `setCallbacks` gets silent failures rather
than a compile-time error. Violates the principle that constructed objects
are ready to use.

**Fix:** Inject `postMessage` callback and `sessionKey` through the
constructor. Remove `setCallbacks()`.

---

### 1.6 UnitCellService Directly Calls VS Code UI API (Medium)

**File:** `src/services/unitCellService.ts`, lines ~88, ~96

`centerToUnitCell()` calls `vscode.window.showWarningMessage()` and
`vscode.window.showErrorMessage()` directly.

**Impact:** The service cannot be unit-tested without mocking `vscode.window`.
All other services delegate UI concerns to the error thrown upward
(caught by `MessageRouter.route()`).

**Fix:** Remove `vscode.window` calls from `unitCellService.ts`. Throw
descriptive `Error`s instead; `MessageRouter.route()` will surface them to
the user.

---

### 1.7 sessionKey in MessageRouter is document.uri.fsPath, Not session_N (Low)

**File:** `src/providers/structureEditorProvider.ts`, line ~161

`MessageRouter` receives `document.uri.fsPath` as `sessionKey`. The session
*map key* uses `session_N` (correct), but the string stored in
`MessageRouter` (used for document I/O path resolution) is the `fsPath`.

**Impact:** Not a functional bug, but confusing — a reader of `MessageRouter`
code might think the `sessionKey` is the same as the map key. It is not.

**Fix:** Rename the `MessageRouter` constructor parameter to `documentPath`
or `filePath` to make the distinction clear.

---

### 1.8 Duplicate ConfigItem Interface (Low)

**File:** `src/extension.ts`, lines ~270 and ~380

`interface ConfigItem extends vscode.QuickPickItem { id?: string; }` is
defined identically in two separate command handler closures.

**Fix:** Extract to a single definition at file scope.

---

## 2. Type Safety

### 2.1 displayStore Uses Widened String Types (Medium)

**File:** `media/webview/src/state.ts`, lines ~132, ~143

`displayStore.bondStyle` is typed as `string` in `DisplayState`, but
`WireDisplaySettings.bondStyle` is `'solid' | 'dashed' | undefined`.
Same issue for `projectionMode`: `string` in store vs
`'orthographic' | 'perspective' | undefined` in the wire type.

This causes LSP errors:
```
Type 'string' is not assignable to type '"solid" | "dashed" | undefined'.
Type 'string' is not assignable to type '"orthographic" | "perspective" | undefined'.
```

**Impact:** The narrower types from `WireDisplaySettings` are not enforced on
the store, allowing invalid values at runtime.

**Fix:** Update `DisplayState` to use the same union types as
`WireDisplaySettings`:
```typescript
bondStyle?: 'solid' | 'dashed';
projectionMode?: 'orthographic' | 'perspective';
```

---

## 3. Error Handling Inconsistencies

The codebase uses inconsistent error strategies across services, making the
contract implicit and confusing for contributors.

### 3.1 AtomEditService Returns false Silently on Domain Errors (Medium)

**File:** `src/services/atomEditService.ts`

- `addAtom()` returns `false` when `parseElement()` fails (lines ~27–31).
- `changeAtoms()` returns `false` on invalid element (lines ~172–174).
- `setAtomColor()` returns `false` on invalid input (line ~195).
- `updateAtom()` returns `false` if atom not found (lines ~226–228).

**Impact:** `MessageRouter` interprets `false` as "message not handled" — the
message was handled, the operation just failed. No feedback reaches the user.

**Fix:** Throw `Error` with a descriptive message. `MessageRouter.route()` will
catch it and show `vscode.window.showErrorMessage`.

---

### 3.2 BondService Returns Silently on Failure (Medium)

**File:** `src/services/bondService.ts`, lines ~90–122

`setBondLength()` silently returns (no throw, no `false`, no logging) when:
- `atomIds.length < 2`
- `length` is not a number
- Either atom is not found
- Current bond length is essentially zero

**Impact:** User actions silently fail with no feedback.

**Fix:** Throw descriptive `Error`s for each case.

---

### 3.3 DocumentService Has Redundant Inner try/catch (Low)

**File:** `src/services/documentService.ts`

Every public method (`saveStructure`, `saveStructureAs`, `saveRenderedImage`,
`openSource`, `reloadStructure`) wraps its body in a try/catch that calls
`vscode.window.showErrorMessage()` and returns silently.

**Impact:** `MessageRouter.route()` already has a catch-all. The inner catches
swallow errors before they reach the router's centralized logging.

**Fix:** Remove the inner try/catch blocks. Let errors propagate to
`MessageRouter.route()`. Keep only the `vscode.window.showErrorMessage` calls
that provide user-facing context specific to the operation (e.g., "Save failed:
permission denied").

---

### 3.4 DisplayConfigService Error Channel Is Inconsistent (Low)

**File:** `src/services/displayConfigService.ts`

Every `handle*` method catches errors and sends them via
`postMessage({ command: 'displayConfigError', error: String(error) })`. All
catch blocks return `true`, claiming success.

**Impact:** `MessageRouter.route()` never sees config failures. Errors may be
silently dropped if the webview's `displayConfigError` handler is not
implemented correctly.

**Fix:** Let thrown errors propagate to `MessageRouter.route()` for centralized
handling. The separate `displayConfigError` channel can remain for non-fatal
warnings, but fatal errors should reach the router.

---

## 4. Parser Issues

### 4.1 STRU Parser Uses Wrong Comment Delimiter (Medium)

**File:** `src/io/parsers/struParser.ts`, lines ~243–246

`cleanLine()` strips comments using `line.split('//')[0]`. ABACUS STRU files
use `#` for comments, not `//`. Lines with `#` comments will be parsed as
data, potentially causing silent errors or incorrect structures.

**Fix:** Change to `line.split('#')[0]`. Verify against ABACUS STRU format
specification.

---

### 4.2 .inp Extension Always Routes to ORCA (Low)

**File:** `src/io/fileManager.ts`, line ~26

The `PARSER_MAP` maps `.inp` exclusively to `ORCAParser`. Quantum ESPRESSO
also uses `.inp` as its input file extension. A QE `.inp` file is rejected with
"Invalid ORCA input: missing * xyz block" instead of being tried against the
QE parser.

**Note:** Content-sniffing for `.out` and `.log` already exists (lines ~88–106)
and could be extended to `.inp`.

**Fix:** Add QE parser as a fallback for `.inp`:
```typescript
inp: [new ORCAParser(), new QEParser()],
```

---

### 4.3 Silent Empty Return on Invalid Input — CIF, PDB, STRU (Medium)

**File:** Multiple parsers

Three parsers silently return empty structures instead of throwing on
malformed input:

| Parser | File | Behavior |
|---|---|---|
| CIFParser | `src/io/parsers/cifParser.ts:12–20` | Returns empty `Structure` if no atoms/cell found |
| PDBParser | `src/io/parsers/pdbParser.ts:11–56` | Returns empty `Structure` if no ATOM/HETATM lines |
| STRUParser | `src/io/parsers/struParser.ts:14–177` | Returns empty `Structure` if no atomic positions |

All other parsers (XYZ, POSCAR, OUTCAR, QE, GJF, ORCA) throw on invalid
content. The inconsistency means callers cannot distinguish "valid file with
zero atoms" from "completely wrong file format".

**Fix:** Each parser should throw on content that is clearly the wrong format
(e.g., a CIF file with no `loop_` blocks at all). An empty structure with zero
atoms is only valid if the file's syntax is correct but contains no atoms.

---

### 4.4 Inconsistent parse() Return-Frame Convention (Low)

| Parser | Returns | Line |
|---|---|---|
| XYZParser | First frame (`frames[0]`) | ~21 |
| QEParser | Last frame (`frames[frames.length-1]`) | ~39 |
| OUTCARParser | Last frame | ~18 |
| XDATCARParser | Last frame | ~27 |

XYZ returns the first frame while all trajectory-capable parsers return the
last. The convention is not documented.

**Fix:** Document the convention in `StructureParser` abstract class:
> "For trajectory formats, `parse()` returns all frames. The first element
> is the initial configuration; the caller displays the last by default."
> XYZParser should return all frames it finds, not just `frames[0]`.

---

### 4.5 QE ibrav > 0 Not Supported (Medium)

**File:** `src/io/parsers/qeParser.ts`

Only `ibrav = 0` (explicit cell vectors) is supported. Quantum ESPRESSO
supports `ibrav` 1–14 with predefined Bravais lattice types. A QE file with
`ibrav = 2` (FCC) will be parsed with incorrect or no unit cell.

**Fix (minimal):** Detect `ibrav > 0` during parsing and throw:
```typescript
throw new Error(
  `QEParser: ibrav=${ibrav} is not supported. ` +
  `Convert to ibrav=0 with explicit CELL_PARAMETERS before opening in ACoord.`
);
```

**Fix (full):** Implement lattice vector generation for all 14 ibrav types
using the QE documentation formulas.

---

### 4.6 PDB Column Alignment Unverified (Low)

**File:** `src/io/parsers/pdbParser.ts`

The ATOM/HETATM record serializer column alignment has not been verified
against the PDB 80-column format specification. Misalignment can break
downstream tools.

**Fix:** Review the [PDB format specification](https://www.wwpdb.org/documentation/file-format) and verify:
- Atom name: columns 13–16 (right-justified for 1-character elements)
- X coordinate: columns 31–38 (8.3f format)
- Y coordinate: columns 39–46
- Z coordinate: columns 47–54
Add a test comparing serializer output against a known-good reference PDB file.

---

## 5. Webview Issues

### 5.1 interaction.dispose() Never Called (Medium)

**File:** `media/webview/src/interaction.ts` lines ~320–324,
`media/webview/src/app.ts`

`interaction.ts` exports a `dispose()` function that calls
`controller.abort()` to remove all event listeners. However, `app.ts` imports
only `init` from `interaction.ts` — `dispose()` is never imported or called.
The renderer's own `dispose()` is wired to `beforeunload` (renderer.ts
line ~1112), but the interaction module's listeners are not cleaned up.

**Impact:** When the webview is destroyed and recreated (tab hidden/shown),
stale pointer and keyboard event listeners may remain active.

**Fix:** In `app.ts`, import and call `interaction.dispose()` from the
webview's teardown path:
```typescript
import { init as initInteraction, dispose as disposeInteraction } from './interaction';
// In teardown:
window.addEventListener('beforeunload', () => {
  renderer.dispose();
  disposeInteraction();
});
```

---

### 5.2 transformations.ts Directly Calls Renderer (Low)

**File:** `media/webview/src/utils/transformations.ts`, line ~190

The utility module directly calls `renderer.renderStructure(...)` during
rotation preview. Utility modules should not have upward dependencies on the
renderer.

**Impact:** Tight coupling creates a layering violation
(renderer → transformations is expected, but transformations → renderer is
not). Prevents independent testing of transformation logic.

**Fix:** Remove the `renderStructure` call from `transformations.ts`. Instead,
have it return the transformed structure and let the caller (in `appLattice.ts`
or `appView.ts`) decide whether to trigger a render.

---

### 5.3 renderStructure() is a ~284-Line Monolith (Low)

**File:** `media/webview/src/renderer.ts`, lines ~466–750

The function handles in a single body: auto-scaling, disposing old meshes,
building instanced atom meshes, building ghost atom meshes, building instanced
bond meshes, building unit cell geometry, updating UI, and fitting the camera.

**Impact:** Difficult to read, modify, or test individual rendering phases.
Any change risks breaking unrelated logic.

**Fix:** Extract into private methods:
- `disposeSceneObjects()` — cleanup phase
- `buildAtomMesh(atoms, settings)` — instanced atom mesh
- `buildBondMesh(bonds, settings)` — instanced bond mesh
- `buildUnitCellMesh(unitCell, settings)` — unit cell edges
- `fitCameraToStructure(structure)` — camera fitting

---

### 5.4 AppCallbacks Migration Incomplete (Low)

**File:** `media/webview/src/types.ts` line ~119,
`media/webview/src/app.ts` line ~177

`AppCallbacks` is marked `@deprecated` but `app.ts` still constructs the
full monolithic object (~30 properties) and passes it to `setupEdit()`,
`setupLattice()`, `setupTools()`. The downstream modules already accept
narrower domain-specific interfaces (`VscodeContext & SelectionContext &
EditContext`, etc.), so the migration is structurally complete on the consumer
side but not yet on the producer side.

**Fix:** Replace the monolithic `AppCallbacks` construction in `app.ts` with
individual, narrower context objects per module. Remove `AppCallbacks`
interface after all callers are updated.

---

### 5.5 State Stores Have No Reactive Mechanism (Low)

**File:** `media/webview/src/state.ts`

All 8 stores are plain mutable objects. Direct property mutation
(`displayStore.showAxes = true`) has no notification mechanism. Code that
needs to react to state changes must be called explicitly.

**Impact:** Adding new state consumers requires manually wiring calls at every
mutation site. This creates maintenance risk as the codebase grows.

**Fix (pragmatic):** Document the pattern explicitly in `state.ts`: mutations
must be followed by an explicit call to whichever function needs the updated
value. This is acceptable for the current codebase size.

**Fix (architectural):** If fan-out becomes a problem, introduce a lightweight
pub/sub mechanism (e.g., `EventTarget` or a tiny signal library).

---

## 6. Dead Code

### 6.1 Extension Host Dead Code

| Item | File | Line | Evidence |
|---|---|---|---|
| `generateSupercell()` | `src/models/structure.ts` | ~279 | Never called from production code |
| `centerAtOrigin()` | `src/models/structure.ts` | ~271 | Never called |
| `hasManualBond()` | `src/models/structure.ts` | ~88 | Never called |
| `estimatedMemoryMB` getter | `src/providers/undoManager.ts` | ~110 | Never read |
| `rollbackEdit()` | `src/providers/trajectoryManager.ts` | ~65 | Never called |
| `resetToDefault()` | `src/config/configManager.ts` | ~314 | Never called |
| `getParameters()` | `src/models/unitCell.ts` | ~31 | Never called |
| `hasHandler()` | `src/services/messageRouter.ts` | ~72 | Never called |
| `register()` | `src/services/messageRouter.ts` | ~49 | Redundant public wrapper for `registerTyped()`; never called externally |
| `MessageCommand` type | `src/shared/protocol.ts` | ~522 | Never imported |
| Placeholder `addAtom` cmd | `src/extension.ts` | ~246 | Shows an info message, no implementation |
| Placeholder `deleteAtom` cmd | `src/extension.ts` | ~255 | Shows an info message, no implementation |

### 6.2 Webview Dead Code

| Item | File | Line | Evidence |
|---|---|---|---|
| `throttle()` | `media/webview/src/utils/performance.ts` | ~39 | Never imported (only `debounce` is used) |
| `clearElementCache()` | `media/webview/src/utils/domCache.ts` | ~21 | Never called |
| `RendererHandlers` interface | `media/webview/src/types.ts` | ~107 | Never imported |

### 6.3 Dead Test File

| Item | File | Evidence |
|---|---|---|
| `simple-tests.ts` | `src/test/unit/simple-tests.ts` | Uses `console.log` assertions, not `.test.mts` extension, not picked up by Mocha (`.mocharc.json` spec matches `**/*.test.mts` only) |

---

## 7. Test Coverage Gaps

### 7.1 Current Test Stats

- **179 tests** across 17 Mocha test files (`.test.mts`), all passing
- All 10 parsers have fixture-based round-trip tests
- 5 services (`AtomEditService`, `BondService`, `SelectionService`,
  `MessageRouter`, `UndoManager`) have unit tests

### 7.2 Missing Test Coverage

| Area | Gap |
|---|---|
| Parser error paths | Only ORCA has an error-path test. CIF, PDB, STRU silently return empty — this behavior is not tested (§4.3 above). |
| FileManager | No tests for format selection, extension mapping, content sniffing, or the `.out`/`.log` multi-parser fallback logic. |
| Utility functions | No tests for `expandElements()`, `fractionalToCartesian()` (standalone), `parseElement()`, or `parserUtils.ts` helpers. |
| Extended format features | No tests for CIF symmetry operations, QE output parsing, PDB multi-model, XDATCAR multi-frame beyond basic cases, OUTCAR forces/energy extraction. |
| Services without tests | `UnitCellService`, `DocumentService`, `DisplayConfigService`. |
| Dead test file | `src/test/unit/simple-tests.ts` is never run by Mocha (§6.3 above). |

---

## Resolved Issues

### ✓ Atom drag stuttering / bond jitter

**Resolved:** 2026-03-05

**Root cause:** Every `pointermove` during atom drag triggered a full
`renderStructure()` round-trip through the extension host, causing O(atoms +
bonds) mesh allocations per frame plus a race between the local lerp-smoothed
position and the round-tripped canonical position.

**Fix:**

- `structureEditorProvider.ts` — `handleWebviewMessage()` detects
  `moveAtom`/`moveGroup` with `preview: true` and skips `renderStructure()`.
  The extension model is updated (so `endDrag` commits the correct position
  and undo works) but no render message is sent back.

- `renderer.ts` — Added `updateBondPositions(moves)` that incrementally updates
  only the affected bond `InstancedMesh` matrices. The renderer maintains:
  - `bondInstanceIndex`: maps `bondKey → [half0_entry, half1_entry]`
  - `atomBondKeys`: maps `atomId → Set<bondKey>` for O(1) bond lookup
  - `bondHalfEndpoints`: initial endpoint positions per half

- `app.ts` — `onDragAtom` and `onDragGroup` call
  `renderer.updateBondPositions()` immediately after `renderer.updateAtomPosition()`,
  keeping bonds in sync at full frame rate with no IPC overhead.

---

### ✓ `onDidChangeCustomDocument` never fired

**Resolved:** before 2026-03-05

`notifyDocumentChanged()` fires `_onDidChangeCustomDocument` with a full
`CustomDocumentEditEvent` (including `undo`/`redo` callbacks). Called from all
edit paths in `handleWebviewMessage`.

---

### ✓ `backupCustomDocument` wrote no data

**Resolved:** before 2026-03-05

`backupCustomDocument` now serializes all frames via
`JSON.stringify(session.trajectoryManager.frames.map(f => f.toJSON()))` and
writes to `context.destination`. `openCustomDocument` restores from backup
when `openContext.backupId` is present.

---

### ✓ Session key used `fsPath` (split-view collision)

**Resolved:** before 2026-03-05

Session map key is now `session_${++this.nextSessionId}` (monotonic counter).
`supportsMultipleEditorsPerDocument: true` is set in `extension.ts`.

---

### ✓ No error handling in `MessageRouter.route()`

**Resolved:** before 2026-03-05

`route()` wraps all handler calls in try/catch with `console.error` and
`vscode.window.showErrorMessage`.

---

### ✓ `revertCustomDocument` was a no-op

**Resolved:** before 2026-03-05

Fully implemented: re-reads from disk, replaces trajectory, clears undo, resets
selection, re-renders.

---

### ✓ `getAtom()` was O(n) linear scan

**Resolved:** before 2026-03-05

`Structure` has a private `atomIndex: Map<string, Atom>`. `getAtom(id)` is O(1).
Index is maintained by `addAtom()`, `removeAtom()`, and `clone()`.

---

### ✓ IDs used `Math.random()` (collision risk)

**Resolved:** before 2026-03-05

`Atom.id = \`atom_${crypto.randomUUID()}\`` and
`Structure.id = \`struct_${crypto.randomUUID()}\``.

---

### ✓ `Structure` had no `metadata` field

**Resolved:** before 2026-03-05

`metadata: Map<string, unknown>` added. Cloned in `clone()`, serialized in
`toJSON()`, deserialized in `fromJSON()`.

---

### ✓ Dual display settings types (`DisplaySettings` vs `WireDisplaySettings`)

**Resolved:** before 2026-03-05

`config/types.ts`: `export type DisplaySettings = Required<WireDisplaySettings>`.
No separately maintained duplicate interface.

---

*End of document.*
