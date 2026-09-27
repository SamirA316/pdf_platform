# Text Object Rotation (Phase 5.5.6)

## Overview
Phase 5.5.6 implements free text object rotation for the QuickPDF Editor. Building on the foundational text architecture (Phase 5.5.1–5.5.5), this module allows selected text objects to be rotated continuously around their visual center via a dedicated rotation handle positioned above the bounding box.

The rotation interaction preserves spatial coordinates ($x, y, \text{width}, \text{height}$), stores angles as normalized degrees in $[0, 360)$, maintains clean separation between text rotation, native PDF page rotation, and viewport view rotation, integrates into the atomic undo/redo history engine, and preserves compatibility across move, resize, editing, and zoom operations.

---

## 1. Architectural Interaction Model

```
┌────────────────────────────────────────────────────────────────────────┐
│                        User Pointer Event                              │
│  - Tool: activeTool === "select"                                       │
│  - Target: Rotation Knob (data-handle="rotate")                        │
│  - Event: onPointerDown on knob above bounding box                     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Interactive Drag & Live Rotation                     │
│  - Captures initial rotation: origRotation                             │
│  - Computes object center in 72-DPI PDF space:                         │
│      centerX = x + width / 2                                           │
│      centerY = y + height / 2                                          │
│  - Transforms screen pointer to ground-truth PDF coordinates           │
│  - Calculates instantaneous angle:                                     │
│      rad = atan2(dy, dx) + π/2                                         │
│      deg = normalizeAngle((rad * 180) / π)                             │
│  - Live visual update via updateObject(id, { rotation }, false)        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│               Pointer Up: Atomic History Transaction                   │
│                                                                        │
│  - Compares finalRotation with origRotation                            │
│  - If finalRotation !== origRotation:                                  │
│      Dispatches commitRotate()                                         │
│      Pushes single atomic ROTATE_OBJECT history action                 │
│  - Zero-delta rotations do not pollute the history stack               │
└───────────────────────────────────┬────────────────────────────────────┘
```

---

## 2. Rotation Handle UI & Specification

- **Handle Knob**:
  - Located on a vertical stem positioned directly above the top-center edge of the selection bounding box.
  - Sized at `16px × 16px` (`w-4 h-4`) circular knob (`rounded-full`) with a centered primary-color dot (`w-1.5 h-1.5`).
  - Distinct `data-handle="rotate"` attribute.
  - Uses `cursor-grab` (and `cursor-grabbing` while actively rotating).
- **Connecting Stem**:
  - Vertical connecting line (`w-[1.5px] h-3 bg-primary`) bridging the top border of the bounding box to the rotation knob.
- **Isolation**:
  - Clicking or dragging the rotation handle calls `stopPropagation()` and `preventDefault()`.
  - Does NOT trigger text body dragging, bounding corner resize, or text editing.

---

## 3. Mathematical Center & Angle Normalization

### Center Point
Rotation occurs around the visual geometric center of the text object in ground-truth 72-DPI PDF coordinates:
$$\text{center}_x = x + \frac{\text{width}}{2}$$
$$\text{center}_y = y + \frac{\text{height}}{2}$$

### Angle Calculation
Pointer offset from center:
$$dx = \text{pointer}_x - \text{center}_x$$
$$dy = \text{pointer}_y - \text{center}_y$$

In PDF coordinate space (where Y increases downwards):
- Straight UP ($dx = 0, dy < 0$): $0^\circ$
- Straight RIGHT ($dx > 0, dy = 0$): $90^\circ$
- Straight DOWN ($dx = 0, dy > 0$): $180^\circ$
- Straight LEFT ($dx < 0, dy = 0$): $270^\circ$

$$\theta_{\text{rad}} = \text{atan2}(dy, dx) + \frac{\pi}{2}$$
$$\theta_{\text{deg}} = \frac{\theta_{\text{rad}} \times 180}{\pi}$$

### Angle Normalization
Angles are normalized to $[0, 360)$ via `normalizeAngle`:
```ts
export function normalizeAngle(degrees: number): number {
  let normalized = degrees % 360;
  if (normalized < 0) {
    normalized += 360;
  }
  if (Object.is(normalized, -0) || Math.abs(normalized - 360) < 1e-9) {
    normalized = 0;
  }
  return Math.round(normalized * 100) / 100;
}
```
- $-10^\circ \to 350^\circ$
- $360^\circ \to 0^\circ$
- $370^\circ \to 10^\circ$
- $720^\circ \to 0^\circ$

---

## 4. Separation of Concerns: Text vs. Page vs. Viewport Rotation

| Rotation Type | Property | Scope | Effect |
| :--- | :--- | :--- | :--- |
| **Text Rotation** | `ITextObject.rotation` | Individual object | Rotates the text content around its center relative to the unrotated page. |
| **Native Page Rotation** | `IPageDimension.rotation` | Single page | Inherent orientation of the PDF page metadata (0°, 90°, 180°, 270°). |
| **Viewport Rotation** | `IEditorState.viewportRotation` | Global viewer | Temporary display orientation in the UI without modifying document contents. |

Text object rotation alters ONLY `ITextObject.rotation`. It never modifies page dimensions, page rotation metadata, or viewport rotation.

---

## 5. History & Undo/Redo

- **Single Atomic Transaction**: Continuous pointer updates use `updateObject(id, { rotation }, false)` to update the live DOM without history pollution.
- **Commit on Release**: Upon `pointerup`, if the angle changed, `commitRotate(id, origRotation, finalRotation)` pushes a single `ROTATE_OBJECT` action.
- **Zero-Delta Deduplication**: If the final angle equals the original angle, no action is pushed to history.
- **Bidirectional Restoration**:
  - `undo()` restores `origRotation`.
  - `redo()` restores `finalRotation`.

---

## 6. Compatibility & Known Limitations

- **Move / Drag**: Rotated text objects can be dragged across the page. Position ($x, y$) updates while `rotation` remains strictly preserved.
- **Inline Editing**: Double-clicking a rotated text box opens the inline editor. The editor aligns with the rotated box, and typing updates text without modifying rotation.
- **Zoom Invariance**: Rotation calculation is based on ground-truth PDF coordinates; the angle is identical across 25% to 400% zoom.
- **Rotated Resize Interaction (Known Limitation)**:
  - Resizing an object after rotation updates the unrotated bounding box dimensions ($x, y, \text{width}, \text{height}$) and preserves the rotation angle.
  - Multi-axis oriented bounding box deformation (skewing/shearing along rotated axes) is intentionally out of scope for Phase 5.5 and will be refined in future advanced transform passes.

---

## 7. Verification Status

Automated test suite: `backend/tests/phase5_editor_rotate.test.ts`
- 18 automated test scenarios passing 100%.
- Integrated into master regression runner `run_regression.ts`.
