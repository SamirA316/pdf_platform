# Text Box Resizing & Bounding Handles (Phase 5.5.3)

## Overview
Phase 5.5.3 implements interactive text box resizing with four corner bounding handles for the QuickPDF Editor. When a text object is selected in the select tool mode (and not in inline editing), a selection bounding box with four corner handles (`top-left`, `top-right`, `bottom-left`, `bottom-right`) is displayed. Users can drag any corner handle to resize the text box smoothly in real time across any direction (including reverse/inverted dragging). The box strictly enforces minimum bounds (`MIN_TEXT_WIDTH = 40` pt, `MIN_TEXT_HEIGHT = 20` pt) and clamps to page bounds, while text typography (`fontSize`, font styles) remains preserved and text reflows naturally. Resizing operations are recorded as single atomic undo/redo transactions upon mouse release.

---

## 1. Architectural Interaction Model

```
┌────────────────────────────────────────────────────────────────────────┐
│                   Selection & Bounding Box Display                     │
│  - Active tool: activeTool === "select"                                │
│  - Target: selectedObjectIds.length === 1 && obj.type === "text"       │
│  - Hidden when inline text editing is active (!isEditing)              │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Four Corner Resize Handles                           │
│  - Top-Left: cursor-nwse-resize (Anchor: Bottom-Right [x+w, y+h])      │
│  - Top-Right: cursor-nesw-resize (Anchor: Bottom-Left [x, y+h])        │
│  - Bottom-Left: cursor-nesw-resize (Anchor: Top-Right [x+w, y])        │
│  - Bottom-Right: cursor-nwse-resize (Anchor: Top-Left [x, y])          │
│  - Touch & Pointer events stopPropagation() to prevent conflict        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│               Interactive Drag & Real-time Math Pipeline               │
│                                                                        │
│  1. Window pointermove captures screen cursor (clientX, clientY)       │
│  2. Offset relative to page container [0, containerWidth/Height]       │
│  3. screenPointToGroundTruthPdf() inverts zoom & two-stage rotations:  │
│     Screen Px ──(zoom)──► Visual Pt ──(viewport)──► Native ──► Truth   │
│  4. calculateResizedRect() calculates new normalized rect:             │
│     - Clamped to page boundaries [0, pageWidth] & [0, pageHeight]      │
│     - Strict enforcement of MIN_TEXT_WIDTH (40) & MIN_TEXT_HEIGHT (20) │
│     - Normalizes across all 4 quadrants on inverted/reverse dragging   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│               Live Update & Single Atomic Undo Transaction             │
│                                                                        │
│  - During drag: updateObject(id, newRect, addToHistory=false)          │
│    (Updates state & re-renders text box without flooding undo stack)   │
│  - Typography (fontSize, fontFamily, color) preserved without scaling │
│  - On pointerup: commitResize(id, origRect, finalRect)                 │
│    Pushes a single RESIZE_OBJECT transaction to history stack          │
│  - Zero-delta drag excluded from history                               │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Corner Anchoring & Inverted Drag Mathematics

When resizing begins, the corner opposite the active handle becomes the **fixed anchor point** $(A_x, A_y)$ in PDF points:

| Handle | Fixed Anchor Corner | Anchor Formula | Initial Cursor |
| :--- | :--- | :--- | :--- |
| **top-left** | Bottom-Right | $(x + \text{width}, y + \text{height})$ | `nwse-resize` |
| **top-right** | Bottom-Left | $(x, y + \text{height})$ | `nesw-resize` |
| **bottom-left** | Top-Right | $(x + \text{width}, y)$ | `nesw-resize` |
| **bottom-right** | Top-Left | $(x, y)$ | `nwse-resize` |

### Normalization Across Quadrants & Independent Axis Mathematics
Given anchor $(A_x, A_y)$ and pointer in PDF points $(P_x, P_y)$, each axis is resolved strictly independently via `resizeAxis(anchor, pointer, pageSize, minSize)`:

```typescript
function resizeAxis(
  anchor: number,
  pointer: number,
  pageSize: number,
  minSize: number
): { pos: number; size: number } {
  const clampedAnchor = Math.max(0, Math.min(pageSize, anchor));
  const clampedPointer = Math.max(0, Math.min(pageSize, pointer));

  if (clampedPointer >= clampedAnchor) {
    const available = pageSize - clampedAnchor;
    const effectiveMin = Math.min(minSize, available);
    const rawSpan = clampedPointer - clampedAnchor;
    const size = Math.min(available, Math.max(effectiveMin, rawSpan));
    return { pos: clampedAnchor, size };
  } else {
    const available = clampedAnchor;
    const effectiveMin = Math.min(minSize, available);
    const rawSpan = clampedAnchor - clampedPointer;
    const size = Math.min(available, Math.max(effectiveMin, rawSpan));
    return { pos: clampedAnchor - size, size };
  }
}
```

### Deterministic Constraint Resolution Rules
When simultaneous constraints (fixed anchor, minimum size, and page boundaries $[0, \text{pageSize}]$) are evaluated:

1. **Anchor Preservation**: The opposite anchor is preserved whenever mathematically possible:
   - When dragging in positive direction ($P \ge A$): $\text{pos} = A$, and size expands rightward/downward.
   - When dragging in negative direction ($P < A$): $\text{pos} + \text{size} = A$, and size expands leftward/upward.
2. **Page Bounds Invariant**: At all times, $\text{pos} \ge 0$ and $\text{pos} + \text{size} \le \text{pageSize}$.
3. **Minimum Dimension Constraint**: When available space $\ge \text{minSize}$, the box strictly satisfies $\text{size} \ge \text{minSize}$.
4. **Boundary Collision Determinism**: When the available distance between the fixed anchor and the page boundary is strictly less than $\text{minSize}$ ($\text{available} < \text{minSize}$):
   - It is mathematically impossible to have $\text{size} \ge \text{minSize}$ without moving the anchor or crossing the page edge.
   - **Resolution Rule**: The fixed anchor is **strictly preserved**, the page boundary $[0, \text{pageSize}]$ is **strictly maintained**, and the size is clamped to the maximum feasible space: $\text{size} = \text{available}$.
   - Example 1: `anchor.x = 20`, `minWidth = 40`, pointer dragged to left edge ($0$) $\rightarrow$ `x = 0, width = 20`. Right edge is $0 + 20 = 20$ (anchor preserved!).
   - Example 2: `anchor.x = pageWidth - 20`, `minWidth = 40`, pointer dragged to right edge $\rightarrow$ `x = pageWidth - 20, width = 20`. Left edge is `pageWidth - 20` (anchor preserved!).
   - Example 3: `anchor.y = 10`, `minHeight = 20`, pointer dragged to top edge ($0$) $\rightarrow$ `y = 0, height = 10`. Bottom edge is $0 + 10 = 10$ (anchor preserved!).
   - Example 4: `anchor.y = pageHeight - 10`, `minHeight = 20`, pointer dragged to bottom edge $\rightarrow$ `y = pageHeight - 10, height = 10`. Top edge is `pageHeight - 10` (anchor preserved!).


---

## 3. History & Undo/Redo Engine Integration

- **Intermediate Frames**: Mouse movement fires up to 60–120 times per second during a drag. `updateObject(id, updates, addToHistory = false)` mutates the React state and marks the document dirty, but does not push actions to the history stack.
- **Commit on Release**: When the user releases the pointer, `commitResize(id, origRect, finalRect)` evaluates if the geometry changed. If changed, a single `RESIZE_OBJECT` action is pushed:
  - **Undo**: Reverts to `origRect`
  - **Redo**: Restores `finalRect`

---

## 4. Verification & Automated Test Suite

A dedicated regression test suite (`phase5_editor_resize.test.ts`) validates 17 distinct aspects:
1. Corner handle opposite anchor identification
2. Standard expansion drag (bottom-right)
3. Standard expansion drag (top-left)
4. Strict `MIN_TEXT_WIDTH = 40` and `MIN_TEXT_HEIGHT = 20` clamping
5. Inverted/reverse drag across all four quadrants
6. Page boundary clamping $[0, \text{pageWidth}]$ and $[0, \text{pageHeight}]$
7. Zoom scaling invariance ($0.25\times$ to $4.0\times$)
8. Viewport rotation invariance ($0^\circ, 90^\circ, 180^\circ, 270^\circ$)
9. Combined native + viewport rotation coordinate recovery
10. Typography preservation during geometric resizing
11. Single atomic undo/redo transaction per completed resize
12. Zero-delta resize exclusion from history
13. Backend `textEditorObjectSchema` validation of resized objects
14. Anchor preservation when `anchor.x = 20`, `minWidth = 40`, pointer toward left boundary
15. Anchor preservation when `anchor.x = pageWidth - 20`, `minWidth = 40`, pointer toward right boundary
16. Anchor preservation when `anchor.y = 10`, `minHeight = 20`, pointer toward top boundary
17. Anchor preservation when `anchor.y = pageHeight - 10`, `minHeight = 20`, pointer toward bottom boundary

Run command:
```bash
npm run test:phase5:resize
```
