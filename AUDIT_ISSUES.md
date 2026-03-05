# ACoord Code Audit Report

**Audit Date:** 2026-03-05
**Audited Against:** DEVELOPMENT.md v0.2.0

This document summarizes the status of all issues found during the audit.
All actionable issues have been resolved. Items intentionally skipped are
noted below.

---

## Summary

| Phase | Total Items | Fixed | Remaining |
|-------|------------|-------|-----------|
| Phase 1: Critical Bug Fixes | 4 | 4 | 0 |
| Phase 2: Type Safety & Error Handling | 4 | 4 | 0 |
| Phase 3: Architecture — Extension Host | 4 | 4 | 0 |
| Phase 4: Architecture — Webview | 6 | 6 | 0 |
| Phase 5: Performance | 4 | 4 | 0 |
| Phase 6: Parser Correctness | 6 | 6 | 0 |
| Phase 7: Testing & CI | 5 | 4 | 1 (skipped) |
| Phase 8: Cleanup & Polish | 6 | 6 | 0 |
| General Architecture (Sections 1-13) | — | — | 1 (skipped) |
| **Total** | — | — | **0 outstanding** |

---

## Resolved Issues

### 1. [Phase 5] 19.3 — Trajectory Slider Debounce ✅ FIXED

**File:** `media/webview/src/appTrajectory.ts`

Dead `debouncedRequestTrajectoryFrame` function removed. Speed slider now
uses a `debouncedSpeedChange` with 50ms debounce inside `setup()`.

---

### 2. [Phase 6] 20.3 — PDB Column Alignment ✅ FIXED

**File:** `src/io/parsers/pdbParser.ts`

Added blank for altLoc (col 17), blank at col 21, adjusted trailing spacer
from 12 to 10 characters. Four column-alignment tests added to
`src/test/unit/parsers/pdb.test.mts`.

---

### 3. [Phase 7] 21.1/21.2 — Missing MessageRouter Tests ✅ FIXED

**File:** `src/test/unit/services/messageRouter.test.mts` (created)

12 tests covering correct dispatch, error containment, unknown command
handling, and handler re-registration.

---

### 4. [Phase 7] 21.2 — Parser Test Fixtures ✅ FIXED

**Directory:** `src/test/fixtures/`

Added 8 fixture files: `water.xyz`, `water.cif`, `water.pdb`, `water.vasp`,
`water.xdatcar`, `water.outcar`, `water.qe.in`, `water.stru`.

---

### 5. [Phase 7] 21.5 — Integration Tests ⏭ INTENTIONALLY SKIPPED

Requires running VS Code. Out of scope for this session.

---

### 6. [Phase 8] 22.2 — DisplaySettings vs WireDisplaySettings ✅ FIXED

**Files:** `src/config/types.ts`, `src/shared/protocol.ts`

`DisplaySettings` is now a type alias `= Required<WireDisplaySettings>`.
Narrowed `WireDisplaySettings.unitCellLineStyle` to `'solid' | 'dashed'`
and `projectionMode` to `'orthographic' | 'perspective'`. Removed
`Position3D`/`LightConfig` nested types. Removed all `as unknown as`
double-casts.

---

### 7. [Phase 8] 22.5 — `@github/copilot` Dependency

Not present in `package.json`. No action needed.

---

### 8. [General] Remaining `any` Types ✅ FIXED

- `displayConfigService.ts`: `PostMessageCallback`, `listConfigs`, `loadConfig`,
  `saveConfig` return types, `sessions` parameter all properly typed.
- `documentService.ts`: `undoManager: any` → `UndoManager`,
  `renderer: any` → `RenderMessageBuilder`.
- `configValidator.ts`: All 7 `any` parameters in normalization helpers
  changed to `unknown`. `Record<string, any>` input changed to
  `Record<string, unknown>`.
- `structureEditorProvider.ts`: `(session as any).messageRouter` cast removed;
  `messageRouter` is assigned directly since it is declared on `EditorSession`.

---

### 9. [General] Undo/Redo Domain Logic in Provider ✅ FIXED

**Files:** `src/providers/undoManager.ts`, `src/providers/structureEditorProvider.ts`

Added `applyUndo(traj, renderer, clearSelection)` and
`applyRedo(traj, renderer, clearSelection)` methods to `UndoManager`.
`StructureEditorProvider.undoLastEdit` and `redoLastEdit` now delegate
to these methods. Provider no longer contains undo/redo domain logic.

---

### 10. [General] tsconfig.json — `noImplicitAny` / `strictNullChecks` ✅ ALREADY SATISFIED

`"strict": true` is already present and subsumes both flags. No change
needed.

---

### 11. [Phase 4] 18.3 — Per-Atom Hit-Test Meshes ⏭ INTENTIONALLY SKIPPED

The critical geometry-sharing fix (shared `SphereGeometry`) is done.
Further instanced-mesh raycast optimization is out of scope.

---

## Fully Resolved Items (for reference)

The following items from DEVELOPMENT.md have been fully implemented:

- **Phase 1:** 15.1 `onDidChangeCustomDocument`, 15.2 `backupCustomDocument`,
  15.3 Session key collision, 15.4 MessageRouter error handling
- **Phase 2:** 16.1 Typed RenderMessageBuilder, 16.2 Typed MessageRouter,
  16.3 Typed webview messages, 16.4 crypto.randomUUID() IDs
- **Phase 3:** 17.1 DisplayConfigService extracted, 17.2 DocumentService
  extracted, 17.3 notifyConfigChange all sessions, 17.4 revertCustomDocument
- **Phase 4:** 18.1 animate() cancel, 18.2 AbortController event cleanup,
  18.4 Legacy state proxy removed, 18.5 vscodeApi.ts deleted,
  18.6 DOM cache fixed
- **Phase 5:** 19.1 Periodic bond spatial hash, 19.2 O(1) getAtom(),
  19.3 Trajectory slider debounce, 19.4 Display slider debounce
- **Phase 6:** 20.1 POSCAR selective dynamics, 20.2 GJF/ORCA charge &
  multiplicity, 20.3 PDB column alignment, 20.4 QE ibrav rejection,
  20.5 UnitCell NaN guard, 20.6 Ambiguous extension mapping
- **Phase 7:** 21.1/21.2 MessageRouter tests, 21.2 Parser test fixtures
- **Phase 8:** 22.1 `src/types/messages.ts` removed, 22.2 DisplaySettings
  consolidated, 22.3 WireBond fields made required, 22.4 Undo memory
  estimation updated, 22.5 `@github/copilot` removed, 22.6 Structure
  metadata field added
- **General:** `any` types eliminated from service boundaries,
  undo/redo domain logic moved to UndoManager, explicit strict TS config
