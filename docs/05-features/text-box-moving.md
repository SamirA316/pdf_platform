# Text Object Move / Drag (Phase 5.5.4)

## Overview
Phase 5.5.4 implements continuous, interactive body dragging and repositioning for text objects in the QuickPDF Editor. When a text object is selected in select mode (`activeTool === "select"`), a pointer down anywhere on its body initiates drag-and-move mode. The interaction preserves the exact pointer-to-object grab offset (preventing sudden snapping or jumping), strictly clamps the entire object within page boundaries ($x \ge 0, y \ge 0, x + \text{width} \le \text{pageWidth}, y + \text{height} \le \text{pageHeight}$), maintains complete compatibility with zoom and two-stage rotation inversion, avoids conflicting with resize handles or inline text editing, and records a single atomic `MOVE_OBJECTS` undo/redo transaction upon pointer release.

---

## 1. Architectural Interaction Model

```
┌────────────────────────────────────────────────────────────────────────┐
│                   Text Body Pointer Down Event                         │
│  - Tool: activeTool === "select"                                       │
│  - Object: obj.type === "text" && editingObjectId !== obj.id           │
│  - If not selected: selectObject(obj.id)                               │
│  - Stops propagation to prevent clearing selection or canvas pan      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Grab Offset Calculation in PDF Points                │
│                                                                        │
│  1. Screen cursor (clientX, clientY) offset from page container rect    │
│  2. screenPointToGroundTruthPdf() inverts zoom & two-stage rotation:   │
│     Screen Px ──(zoom)──► Visual Pt ──(viewport)──► Native ──► Truth   │
│  3. grabOffset = { x: pointerPdf.x - obj.x, y: pointerPdf.y - obj.y }  │
│  4. Saves initial position: origPos = { x: obj.x, y: obj.y }           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│               Interactive Drag & Page Boundary Clamping                │
│                                                                        │
│  1. Window pointermove updates pointerPdf in PDF coordinates           │
│  2. calculateMovedPosition():                                          │
│     targetX = pointerPdf.x - grabOffset.x                              │
│     targetY = pointerPdf.y - grabOffset.y                              │
│     clampedX = clamp(targetX, 0, pageWidth - obj.width)                │
│     clampedY = clamp(targetY, 0, pageHeight - obj.height)              │
│  3. During drag: updateObject(id, { x, y }, addToHistory=false)        │
│     (Renders real-time movement without flooding history stack)        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│               Release & Single Atomic Undo Transaction                 │
│                                                                        │
│  - Window pointerup compares finalPos with origPos                     │
│  - If position changed: commitMove(id, origPos, finalPos)              │
│    Pushes a single MOVE_OBJECTS transaction to history stack           │
│  - Zero-delta drag (click without movement): excluded from history     │
│  - Restores default cursor and cleans up window listeners              │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Mathematical Formulation & Coordinate Pipeline

### Grab Offset Preservation
When dragging begins, the pointer may be anywhere inside the text box. To prevent the object from jumping:
$$\text{grabOffset}_x = P_{\text{start}, x} - O_x$$
$$\text{grabOffset}_y = P_{\text{start}, y} - O_y$$
Where $P_{\text{start}}$ is the initial pointer position in ground-truth PDF points and $O = (O_x, O_y)$ is the object's origin.

As the pointer moves to $P_{\text{current}}$:
$$x_{\text{target}} = P_{\text{current}, x} - \text{grabOffset}_x$$
$$y_{\text{target}} = P_{\text{current}, y} - \text{grabOffset}_y$$
At $t=0$, $x_{\text{target}} = O_x$ and $y_{\text{target}} = O_y$, guaranteeing zero displacement jump on grab.

### Page Boundary Clamping
To guarantee the complete text box remains inside the printable page at all times:
$$x_{\text{clamped}} = \max(0, \min(\text{pageWidth} - \text{width}, x_{\text{target}}))$$
$$y_{\text{clamped}} = \max(0, \min(\text{pageHeight} - \text{height}, y_{\text{target}}))$$
This ensures:
- $x \ge 0$
- $y \ge 0$
- $x + \text{width} \le \text{pageWidth}$
- $y + \text{height} \le \text{pageHeight}$

---

## 3. Conflict Isolation & Architectural Integrity

1. **Resize Handles vs. Move**:
   - Corner resize handles inside `SelectionOverlay` stop event propagation (`e.stopPropagation()` and `e.preventDefault()`).
   - Dragging a resize handle exclusively triggers `onResizeStart`, never initiating move mode.
2. **Inline Editing vs. Move**:
   - When `editingObjectId === obj.id`, `InlineTextEditor` intercepts clicks and `handleObjectPointerDown` guards against active editing.
   - Text selection, cursor movement, and typing within the editor never move the text box. Double-clicking seamlessly enters inline editing.
3. **Hand Tool & Viewport Pan**:
   - Move mode is active strictly when `activeTool === "select"`. When `activeTool === "hand"` or during spacebar panning, pointer events pass through to canvas pan handlers.
4. **Multi-Object Immutability**:
   - Moving object A mutates only object A. All other objects on the page maintain their exact positions and identity references.

---

## 4. History & Undo/Redo Engine Integration

- **Intermediate Moves**: During pointer movement (up to 120Hz), `updateObject(id, newPos, false)` updates React state and marks document dirty without adding undo actions.
- **Atomic Commit on Release**: `commitMove(id, origPos, finalPos)` is called on `pointerup`.
  - If `origPos === finalPos` (click without move), no history action is added.
  - If position changed, exactly one `MOVE_OBJECTS` action is pushed:
    - **Undo**: Restores `origPos`
    - **Redo**: Restores `finalPos`

---

## 5. Verification & Automated Test Suite

Automated regression test suite `phase5_editor_move.test.ts` validates 15 distinct requirements:
1. Dragging text body updates x and y in PDF points
2. Grab offset preservation without jumping
3. Smooth movement in all four directions (up, down, left, right)
4. Page boundary clamping ($x \ge 0, y \ge 0, x+w \le \text{pageWidth}, y+h \le \text{pageHeight}$)
5. Boundary placement near all 4 corners and page center
6. Zero-delta drag does not register history action
7. Intermediate moves do not flood history; single atomic `MOVE_OBJECTS` action pushed on release
8. Undo reverts to original position; Redo restores final moved position
9. Resize handle pointerdown does not trigger move mode
10. Active inline editing ignores move trigger
11. Zoom scaling invariance ($25\%, 50\%, 100\%, 200\%, 400\%$)
12. Viewport rotation invariance ($0^\circ, 90^\circ, 180^\circ, 270^\circ$)
13. Combined native PDF rotation + viewport rotation coordinate recovery
14. Multi-object safety: moving object A preserves other objects
15. Backend `textEditorObjectSchema` validation of moved object payload

Run command:
```bash
npm run test:phase5:move
```
