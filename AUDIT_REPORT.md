# ACoord Code Audit Report

**Date:** 2026-03-04
**Scope:** Full codebase review against DEVELOPMENT.md requirements
**Methodology:** Static analysis of all source files, cross-referenced with every requirement in DEVELOPMENT.md (Sections 1-22)

---

## Executive Summary

| Category | Total Items | Fixed | Partially Fixed | Not Fixed |
|---|---|---|---|---|
| Phase 1: Critical Bug Fixes | 4 | 4 | 0 | 0 |
| Phase 2: Type Safety | 4 | 4 | 0 | 0 |
| Phase 3: Extension Architecture | 4 | 4 | 0 | 0 |
| Phase 4: Webview Architecture | 6 | 6 | 0 | 0 |
| Phase 5: Performance | 4 | 2 | 2 | 0 |
| Phase 6: Parser Correctness | 6 | 3 | 1 | 2 |
| Phase 7: Testing & CI | 5 | 1 | 1 | 3 |
| Phase 8: Cleanup & Polish | 6 | 5 | 1 | 0 |
| General Architecture Rules | 7 | 4 | 2 | 1 |
| **Total** | **46** | **36** | **7** | **3** |

---

## Remaining Issues (Ordered by Priority)

### P0 — Critical

~~#### 1. `openCustomDocument` Does Not Restore from Backup (15.2)~~
**FIXED** — `openCustomDocument` now checks `openContext.backupId`, reads the backup file, and populates `document.backupFrames` via the new `Structure.fromJSON()` static method. `resolveCustomEditor` uses `document.backupFrames` when present.

~~#### 2. Drag-Based Atom Edits May Not Trigger Dirty Tracking (15.1)~~
**FIXED** — `endDrag` is now handled separately: it calls `renderStructure` and fires `notifyDocumentChanged` if the undo depth increased during the drag sequence.

~~#### 3. `onDidSaveTextDocument` Listener Uses Wrong Key (15.3 Side-Effect)~~
**FIXED** — Comparison changed from `savedDoc.uri.fsPath !== key` to `savedDoc.uri.fsPath !== session.document.uri.fsPath`.

---

### P1 — Type Safety & Boundaries

~~#### 4. `MessageRouter` Internal Handler Map Uses `any` (16.2)~~
**FIXED** — `AnyHandler` type changed from `(message: any) => ...` to `(message: unknown) => ...`. The cast in `registerTyped` updated to `handler as unknown as AnyHandler` to preserve compile safety.

---

~~#### 5. Webview Non-Null Assertions and Type Casts on Message Data (16.3)~~
**FIXED** — Removed all `!` non-null assertions and `?.` optional chains on `message.data` in `handleRenderMessage` (data is required on `RenderMessage`). Fixed `imageSaved`/`imageSaveFailed` cases to use TypeScript's switch narrowing instead of manual `as` casts. Removed redundant `as RenderMessage` cast in the `render` case.

---

~~#### 6. `Math.random()` Still Used for Config IDs (16.4)~~
**FIXED** — All three occurrences replaced with `crypto.randomUUID()`: temp file path suffix (`configStorage.ts:130`), imported config IDs (`configStorage.ts:174`), and new user config IDs (`configManager.ts:163`).

---

~~#### 7. `as DisplaySettings` Cast in MessageRouter (16.2)~~
**FIXED** — Changed `handleSaveDisplayConfig` and `handlePromptSaveDisplayConfig` in `displayConfigService.ts` to accept `WireDisplaySettings` instead of `DisplaySettings`. Internal `saveUserConfig` calls use `as unknown as DisplaySettings` (same pattern as the existing `updateDisplaySettings` with TODO Phase 8 comment). The `as DisplaySettings` casts in `messageRouter.ts` are removed.

---

### P1 — Architecture

~~#### 8. `saveCustomDocument` Creates New `DocumentService` Each Call (17.2)~~
**FIXED** — Changed to `session.documentService.saveStructure(...)` instead of creating a throw-away instance.

---

~~#### 9. `animate()` Loop Not Cancellable (18.1)~~
**FIXED** — Added `animationFrameId: number | null` to `RendererState` interface and initializer. `animate()` now stores the RAF ID: `rendererState.animationFrameId = requestAnimationFrame(animate)`. `dispose()` now cancels the frame with `cancelAnimationFrame` and removes the `resize` listener with `window.removeEventListener('resize', onResize)`.

---

~~#### 10. Event Listeners Missing Cleanup in interaction.ts (18.2)~~
**FIXED (canvas listeners)** — Added `{ signal: controller.signal }` to both `canvas.addEventListener('pointerdown', ...)` and `canvas.addEventListener('pointermove', ...)`. All five canvas event listeners are now controlled by the `AbortController`. Sub-module DOM listeners (sliders, buttons) remain without cleanup — these are on panel elements destroyed with the DOM on webview close and are deferred to Phase 8 cleanup.

---

~~#### 11. Services Reference `vscode.WebviewPanel` Directly (Section 2.1 Rule 3)~~
**FIXED** — `DocumentService.saveRenderedImage` now accepts `postMessage: (msg: unknown) => void` and `getTitle: () => string` callbacks instead of `vscode.WebviewPanel`. `MessageRouter` passes lambdas: `(msg) => this.webviewPanel.webview.postMessage(msg)` and `() => this.webviewPanel.title`. `DocumentService` no longer imports or references `vscode.WebviewPanel`.

---

### P2 — Performance

#### 12. Periodic Bond Cross-Image Detection Still O(n^2) (19.1)

**File:** `src/models/structure.ts:439-469`

The `getPeriodicBonds()` method uses spatial hashing for intra-cell bonds (image `[0,0,0]`), but the cross-image loop (lines 439-469) iterates over all atoms for each of 13 half-space images:

```typescript
for (const offset of offsets) {
  if (isHalfSpace(offset)) {
    for (const atom2 of this.atoms) {  // O(n) per image
      ...
    }
  }
}
```

This makes cross-image bond detection O(n^2 * 13).

**Fix:** Build the spatial hash including image atoms (atoms + periodic images within the bond cutoff). Query neighbors from the hash for all images.

---

#### 13. Display Settings Sliders Not Debounced (19.4)

The following sliders trigger full `renderStructure()` or `updateLighting()` calls on every `input` event with no debounce:

| File | Line(s) | Slider |
|---|---|---|
| `appLattice.ts` | 262-291 | scale, atom size, bond size |
| `appLattice.ts` | 312-337 | global atom size, selected atom size |
| `appLattice.ts` | 169-175 | per-element atom size |
| `appTools.ts` | 110-147 | rotation, adsorption distance |
| `interactionLighting.ts` | 96-212 | all lighting sliders (12 total) |

Only `interactionDisplay.ts:77` (lattice thickness) is debounced.

**Fix:** Apply the same 16ms debounce pattern used for the trajectory slider to all sliders that trigger re-renders.

---

### P2 — Parser Correctness

#### 14. PDB Column Alignment Incorrect (20.3)

**File:** `src/io/parsers/pdbParser.ts:58-101`

The ATOM/HETATM record serializer has column alignment issues:

| Field | PDB Spec | Actual | Problem |
|---|---|---|---|
| Serial (cols 7-11) | 5 chars, `padStart(5)` | 6 chars, `padStart(6)` | Off by one, shifts all downstream columns |
| Atom name (cols 13-16) | 4 chars | 2 chars (`padEnd(2)`) | Missing space prefix for single-char elements, missing alt location indicator |
| Overall line | 80 chars | ~77 chars | Misaligned fields |

**Impact:** Output PDB files may break downstream tools that rely on fixed-width column parsing.

**Fix:** Correct column widths per PDB format specification. Atom name should be `" C  "` (space + element + padding) for single-char elements. Serial should use `padStart(5)`.

---

#### 15. Ambiguous File Extension Fallback Is Dead Code (20.6)

**File:** `src/io/fileManager.ts:82-111`

The `selectParser()` method has multi-parser fallback code for `.out` and `.log` extensions, but it's unreachable. The method first checks `PARSER_MAP[ext]` (line 85-88) and returns immediately because `.out` and `.log` have entries in `PARSER_MAP`. The fallback block at lines 90-108 is never reached.

**Fix:** Move the ambiguous extension check before the `PARSER_MAP` lookup, or remove `.out`/`.log` from `PARSER_MAP` and handle them exclusively in the fallback logic.

---

#### 16. `UnitCell.getLatticeVectors()` Missing `sin(gamma) = 0` Guard (20.5)

**File:** `src/models/unitCell.ts:80`

Line 80 computes `c_y` with `/ Math.sin(gammaRad)`. If `gamma = 0` or `gamma = 180`, this produces `Infinity`/`NaN`. The existing negative-sqrt guard (lines 83-88) may not catch this case because `Infinity` propagated through arithmetic can produce valid-looking (but wrong) results.

The `fromVectors()` method (lines 158-160) correctly clamps acos inputs, but `getLatticeVectors()` does not guard against degenerate `gamma`.

**Fix:** Add `if (Math.abs(Math.sin(gammaRad)) < 1e-10) throw new Error("Invalid gamma: ...")` before the division.

---

### P2 — Code Quality Rules

#### 17. ESLint Rules `no-explicit-any` and `no-non-null-assertion` Not Configured (Section 10.4)

**File:** `eslint.config.mjs:16-26`

DEVELOPMENT.md Section 10.4 requires:
- `@typescript-eslint/no-explicit-any` as warning (target: error)
- `@typescript-eslint/no-non-null-assertion` as warning

Neither rule is present in the ESLint config. Only `naming-convention`, `curly`, `eqeqeq`, `no-throw-literal`, and `semi` are configured.

**Fix:** Add both rules to the ESLint config:
```javascript
rules: {
  "@typescript-eslint/no-explicit-any": "warn",
  "@typescript-eslint/no-non-null-assertion": "warn",
  // ... existing rules
}
```

---

#### 18. `tsconfig.json` Missing `noUnusedLocals` and `noUnusedParameters` (Section 10.1)

**File:** `tsconfig.json:13-15`

DEVELOPMENT.md Section 10.1 requires these options enabled:
```json
"noUnusedLocals": true,
"noUnusedParameters": true
```

Currently both are commented out (line 15: `// "noUnusedParameters": true`). `noUnusedLocals` is not present at all.

**Fix:** Uncomment and add these options. This may surface compile errors that need fixing.

---

#### 19. `tsconfig.json` Uses `module: "Node16"` Instead of `"commonjs"` (Section 9.1)

**File:** `tsconfig.json:3`

DEVELOPMENT.md Section 9.1 states: `module "commonjs"`. Current config uses `"Node16"`.

**Note:** `Node16` is actually the modern recommended setting for Node.js projects and produces CommonJS output when `package.json` lacks `"type": "module"`. This may be an intentional and correct deviation from the spec. Verify that the build output works correctly.

---

#### 20. Webview Uses `onclick` Assignment Instead of `addEventListener` (Section 6.4)

**Files:** Multiple webview source files

35 instances of `.onclick = ` assignment found across:

| File | Count |
|---|---|
| `app.ts` | 9 |
| `appTrajectory.ts` | 5 |
| `appLattice.ts` | 5 |
| `appTools.ts` | 6 |
| `appEdit.ts` | 7 |
| `state/selectionManager.ts` | 1 |
| `appView.ts` | 2 |

DEVELOPMENT.md Section 6.4 states: "Input bindings should use `addEventListener` (removable), not `onclick` assignment."

**Impact:** `onclick` assignments cannot be removed for cleanup, and can be silently overwritten by subsequent assignments.

**Fix:** Replace all `.onclick =` with `.addEventListener('click', ...)`. If cleanup is needed, pass `{ signal }` from an `AbortController`.

---

#### 21. Non-Null Assertions on DOM Elements (Section 6.4 / 13.2)

**File:** `media/webview/src/renderer.ts:204,322,818`

Three instances of `document.getElementById('container')!` use non-null assertions. DEVELOPMENT.md Section 6.4 states: "Use `document.getElementById()` with null-checking: `as HTMLElement | null`, then guard."

Section 13.2 states: "Non-null assertions (`!`) on message data are forbidden. Always check for null/undefined first."

**Fix:** Replace with null check + error:
```typescript
const container = document.getElementById('container');
if (!container) throw new Error('Container element not found');
```

---

### P3 — Testing

#### 22. `test:unit` Script Runs Fake Test Runner (21.1)

**File:** `src/test/run-tests.mjs`

The `npm run test:unit` script runs `node src/test/run-tests.mjs`, which is a 302-line handwritten script that logs `logTest('...', true, '...')` for every "test" — it always passes unconditionally without exercising any real code.

Real mocha-based tests exist in `src/test/unit/` (poscar.test.ts, structure.test.ts, unitCell.test.ts) but no npm script invokes mocha against them.

**Additionally:** `src/test/tsconfig.json:11` has `"strict": false`, undermining type safety in tests.

**Fix:**
1. Add `"test:mocha": "mocha"` script that uses `.mocharc.json` config
2. Update `test:unit` to invoke mocha instead of the fake runner
3. Enable `"strict": true` in test tsconfig

---

#### 23. Parser Round-Trip Tests Missing for 9 of 10 Parsers (21.2)

Only POSCAR has a test file (`src/test/unit/parsers/poscar.test.ts`). Missing tests for: XYZ, CIF, GJF, ORCA, QE, XDATCAR, OUTCAR, PDB, STRU.

Fixture files exist for ORCA (`water.orca`) and GJF (`water.gjf`) but are not used by any test.

---

#### 24. No Service Tests (21.4)

No test files exist for any service. No `src/test/unit/services/` directory exists. Missing tests for: SelectionService, BondService, AtomEditService, UndoManager.

---

#### 25. No Real Integration Tests (21.5)

**File:** `src/test/extension.test.ts`

Contains only a trivial `indexOf` assertion and an XDATCAR parser unit test. No tests that open files in the custom editor, verify rendering, test editing, or test split-view scenarios.

---

### P3 — Minor

#### 26. Undo Max Depth Not Configurable via VS Code Settings (22.4)

**File:** `src/providers/undoManager.ts:14`

Max undo depth is hardcoded to 100 (`maxDepth: number = 100`). DEVELOPMENT.md recommends making it configurable via VS Code settings. The 1KB per atom estimation (line 5) is correct per spec.

---

#### 27. `src/types/` Directory Is Empty but Still Exists (22.1)

**Path:** `src/types/`

The `messages.ts` file has been deleted (correct), but the empty `types/` directory remains. This is a minor cleanliness issue.

---

#### 28. Webview Message Switch Has `default` Fallthrough (Section 2.3 Rule 4)

**File:** `media/webview/src/app.ts:423-424`

```typescript
default:
  configHandler.handleMessage(message);
```

DEVELOPMENT.md Section 2.3 Rule 4 states: "`app.ts` message handler must use an exhaustive switch on `ExtensionToWebviewMessage['command']`, never a fallthrough `default`."

The current implementation delegates unknown commands to `configHandler.handleMessage()` via a `default` case. This prevents compile-time exhaustiveness checking.

**Fix:** Add explicit case branches for all `ExtensionToWebviewMessage['command']` values. Display config messages should have their own cases that call `configHandler`. The `default` can be replaced with a `never` exhaustiveness guard.

---

## Summary of All Remaining Issues

| # | Priority | Issue | Spec Section | File(s) |
|---|---|---|---|---|
| ~~1~~ | ~~P0~~ | ~~Backup restore not implemented in `openCustomDocument`~~ | ~~15.2~~ | **FIXED** |
| ~~2~~ | ~~P0~~ | ~~Drag edits may not trigger dirty tracking~~ | ~~15.1~~ | **FIXED** |
| ~~3~~ | ~~P0~~ | ~~`onDidSaveTextDocument` listener compares wrong key~~ | ~~15.3~~ | **FIXED** |
| ~~4~~ | ~~P1~~ | ~~MessageRouter internal handler map uses `any`~~ | ~~16.2~~ | **FIXED** |
| ~~5~~ | ~~P1~~ | ~~Non-null assertions and type casts in webview messages~~ | ~~16.3~~ | **FIXED** |
| ~~6~~ | ~~P1~~ | ~~`Math.random()` used for config IDs~~ | ~~16.4~~ | **FIXED** |
| ~~7~~ | ~~P1~~ | ~~`as DisplaySettings` cast on message boundary~~ | ~~16.2~~ | **FIXED** |
| ~~8~~ | ~~P1~~ | ~~`saveCustomDocument` creates new DocumentService~~ | ~~17.2~~ | **FIXED** |
| ~~9~~ | ~~P1~~ | ~~`animate()` loop not cancellable~~ | ~~18.1~~ | **FIXED** |
| ~~10~~ | ~~P1~~ | ~~Event listeners missing cleanup (canvas)~~ | ~~18.2~~ | **FIXED** |
| ~~11~~ | ~~P1~~ | ~~Services reference `vscode.WebviewPanel` directly~~ | ~~2.1~~ | **FIXED** |
| 12 | P2 | Periodic bond cross-image is still O(n^2) | 19.1 | `structure.ts:439-469` |
| 13 | P2 | Display sliders not debounced | 19.4 | `appLattice.ts`, `appTools.ts`, `interactionLighting.ts` |
| 14 | P2 | PDB column alignment incorrect | 20.3 | `pdbParser.ts:58-101` |
| 15 | P2 | Ambiguous extension fallback is dead code | 20.6 | `fileManager.ts:82-111` |
| 16 | P2 | `UnitCell.getLatticeVectors()` missing sin(gamma)=0 guard | 20.5 | `unitCell.ts:80` |
| 17 | P2 | ESLint `no-explicit-any`/`no-non-null-assertion` not configured | 10.4 | `eslint.config.mjs` |
| 18 | P2 | `noUnusedLocals`/`noUnusedParameters` not enabled | 10.1 | `tsconfig.json` |
| 19 | P2 | `module: "Node16"` vs spec's `"commonjs"` | 9.1 | `tsconfig.json:3` |
| 20 | P2 | 35 instances of `.onclick =` instead of `addEventListener` | 6.4 | Multiple webview files |
| 21 | P2 | 3 non-null assertions on DOM elements | 6.4, 13.2 | `renderer.ts:204,322,818` |
| 22 | P3 | `test:unit` runs fake test runner, not mocha | 21.1 | `run-tests.mjs`, `package.json:203` |
| 23 | P3 | Parser round-trip tests missing for 9/10 parsers | 21.2 | `src/test/unit/parsers/` |
| 24 | P3 | No service tests | 21.4 | N/A |
| 25 | P3 | No real integration tests | 21.5 | `extension.test.ts` |
| 26 | P3 | Undo max depth not configurable via settings | 22.4 | `undoManager.ts:14` |
| 27 | P3 | Empty `src/types/` directory remains | 22.1 | `src/types/` |
| 28 | P3 | Webview message switch uses `default` fallthrough | 2.3 | `app.ts:423-424` |
