# ACoord — Current Codebase Issues

**Last Updated:** 2026-03-10
**Codebase Version:** 0.3.2
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
8. [Active Bugs](#8-active-bugs)

---

## 8. Active Bugs

### 8.1 Atom Rotation Not Persisted After Canvas Click

**Severity:** High  
**Status:** Open  
**Last Verified:** 2026-03-10 (v0.3.2)

**Description:**  
After rotating selected atoms using the rotation tool (axis selection + angle slider), clicking anywhere in the 3D canvas causes the rotated atoms to snap back to their original pre-rotation positions. The rotation transformation is not committed to the structure model.

**Steps to Reproduce:**
1. Open any structure file
2. Select one or more atoms
3. Open the rotation panel (Edit tab → Rotate section)
4. Pick an axis (X/Y/Z)
5. Move the angle slider to rotate the selected atoms
6. Click anywhere in the 3D canvas (or perform any other interaction)

**Expected Behavior:**  
Rotated atoms should remain at their new positions after the rotation operation completes.

**Actual Behavior:**  
Atoms instantly return to their original positions when the canvas is clicked.

**Impact:**  
- Rotation tool is effectively unusable
- Users cannot perform rotational transformations on atoms
- Data loss of user's rotation operation

**Affected Files:**
- `media/webview/src/appEdit.ts` — Rotation UI handler
- `media/webview/src/interaction.ts` — Canvas click handling
- `src/services/atomEditService.ts` — Rotation command handler (if exists)
- `src/shared/protocol.ts` — `rotateGroup` message definition

**Workaround:**  
Use the rotation tools in the **Tools** panel instead of the Edit panel's rotation slider. The Tools panel rotation functionality works correctly and persists the transformed positions.

---
