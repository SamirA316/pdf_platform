# Text Box Creation & Input (Phase 5.5.2)

## Overview
Phase 5.5.2 implements the interactive text box creation and inline typing engine for the QuickPDF Editor. It replaces the primitive static click-to-create baseline with a full interactive drag-to-create interaction flow, live dashed rubber-band previewing, multi-directional coordinate normalization, strict 72-DPI ground-truth PDF point translation through two-stage rotation inversion, automatic inline WYSIWYG typing via `editingObjectId`, and automated cleanup of abandoned empty text boxes.

---

## 1. Architectural Interaction Model

```
┌────────────────────────────────────────────────────────────────────────┐
│                        User Pointer Event                              │
│  - Tool: activeTool === "text"                                         │
│  - Event: onMouseDown on PageContainer (empty page area)               │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Interactive Drag & Live Preview                      │
│  - Tracks start screen coords (sx1, sy1) and current (sx2, sy2)        │
│  - Renders instant dashed visual rubber-band box on screen             │
│  - Fully zoom & rotation invariant visual feedback                     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│               Mouse Up: Dual-Path Dimension Resolution                 │
│                                                                        │
│  Path A: dx < 5 && dy < 5 (Click)   Path B: Drag (Any Direction)       │
│  - Default minimum box (140x36 pt)  - Normalize opposite corners:      │
│  - Clamped to page boundaries          minX, minY, width, height       │
│                                     - Enforce MIN_TEXT_WIDTH (40 pt)   │
│                                       and MIN_TEXT_HEIGHT (20 pt)      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│               Two-Stage Coordinate Inversion Pipeline                  │
│                                                                        │
│  1. Screen Display Pixels ──(screenToPdf / zoom)──► Visual PDF Points  │
│  2. Visual PDF Points ──(unrotatePoint / viewportRotation)──► Native Pt│
│  3. Native Pt ──(unrotatePoint / nativeRotation)──► Ground-Truth Pt   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│               ITextObject Creation & Immediate Edit Mode               │
│                                                                        │
│  - Dispatches addObject() with activeProperties typography             │
│  - Selects object: selectObject(newId)                                 │
│  - Enters inline editing immediately: setEditingObjectId(newId)        │
│  - ObjectLayer renders WYSIWYG <InlineTextEditor> textarea             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Editing Commit / Blur Lifecycle                      │
│                                                                        │
│  - User types text into auto-focused, auto-styled inline textarea      │
│  - Enter (Ctrl/Cmd+Enter) or Blur commits text: updateObject()         │
│  - Empty box cleanup: if text.trim() === "", deleteObject() deletes    │
│    the 0-character ghost object automatically                          │
│  - Double-click on existing text in select mode re-enters edit mode    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Capabilities & Mechanics

### 2.1 Drag-to-Create in All Four Quadrants
The drag engine accepts drags originating from any direction:
1. **Top-Left to Bottom-Right**: $x_1 < x_2, y_1 < y_2$
2. **Bottom-Right to Top-Left**: $x_1 > x_2, y_1 > y_2$
3. **Top-Right to Bottom-Left**: $x_1 > x_2, y_1 < y_2$
4. **Bottom-Left to Top-Right**: $x_1 < x_2, y_1 > y_2$

Inversion maps both start and end points into unrotated ground-truth PDF coordinates:
$$x = \min(P_{1,\text{pdf}}.x, P_{2,\text{pdf}}.x)$$
$$y = \min(P_{1,\text{pdf}}.y, P_{2,\text{pdf}}.y)$$
$$\text{width} = |P_{1,\text{pdf}}.x - P_{2,\text{pdf}}.x|$$
$$\text{height} = |P_{1,\text{pdf}}.y - P_{2,\text{pdf}}.y|$$

### 2.2 Minimum Dimensions & Boundary Clamping
- **Minimum Dimensions**: Enforces `MIN_TEXT_WIDTH = 40` pt and `MIN_TEXT_HEIGHT = 20` pt.
- **Click Fallback**: A click without meaningful drag ($dx < 5\text{px}, dy < 5\text{px}$) produces a default $140 \times 36$ pt box positioned at the click target.
- **Page Margin Clamping**: Ensures $x + \text{width} \le \text{pageWidth}$ and $y + \text{height} \le \text{pageHeight}$.

### 2.3 WYSIWYG Inline Text Input
When an object enters editing mode (`editingObjectId === obj.id`):
- `ObjectLayer` replaces the static text block with an auto-focused `<InlineTextEditor>` `<textarea>`.
- Typography is accurately inherited from `ITextObject` and scaled by the current viewport zoom:
  - `fontSize: pdfToScreen(object.fontSize, zoom)`
  - `fontFamily: object.fontFamily`
  - `fontWeight: object.fontWeight`
  - `fontStyle: object.fontStyle`
  - `textDecoration: object.textDecoration`
  - `color: object.color`
  - `textAlign: object.textAlign`
  - `lineHeight: object.lineHeight`
- Global keyboard shortcut events (`PDFEditor.tsx`) stop propagation during typing, preventing key conflicts (such as typing 't', 'v', 'h', 'Delete', 'Backspace').

### 2.4 Empty Text Box Cleanup
If a user clicks or drags to create a text box but blurs or clicks outside without typing any characters (`text.trim() === ""`):
- The empty object is automatically removed via `deleteObject(obj.id)`.
- Prevents accumulation of invisible, zero-character ghost text frames in the document tree.

### 2.5 Double-Click Re-Editing
In `select` tool mode, double-clicking any existing text object immediately selects it and sets `editingObjectId(obj.id)`, reopening the inline WYSIWYG editor.

---

## 3. Zoom & Rotation Invariance

| Configuration | Behavior | Verification |
| :--- | :--- | :--- |
| **Zoom Scaling ($25\%$ - $400\%$)** | Start & end screen pixels scale with zoom; inversion preserves exact ground-truth PDF coordinates | Verified in automated tests |
| **Viewport Rotation ($0^\circ, 90^\circ, 180^\circ, 270^\circ$)** | Display dimensions swap at $90^\circ/270^\circ$; Stage 1 inversion restores native page space | Verified in automated tests |
| **Native PDF Rotation ($90^\circ, 180^\circ, 270^\circ$)** | Stage 2 inversion restores unrotated ISO standard PDF points | Verified in automated tests |
| **Combined Rotation** | Total visual rotation ($\text{native} + \text{viewport} \pmod{360}$) resolves with zero coordinate distortion | Verified in automated tests |

---

## 4. Verification & Test Suite

The automated test suite in `backend/tests/phase5_editor_text_box.test.ts` executes 10 test scenarios:
- **Test 1**: Click creates minimum text box ($\ge$ MIN dimensions, default $140 \times 36$ pt).
- **Test 2**: Drag creates text box with matching PDF point dimensions at $100\%$ zoom.
- **Test 3**: All 4 drag directions normalize to positive dimensions and correct top-left origin.
- **Test 4**: Small drags below threshold clamp to `MIN_TEXT_WIDTH` ($40$) and `MIN_TEXT_HEIGHT` ($20$).
- **Test 5**: Text boxes near right and bottom margins strictly clamp to page bounds.
- **Test 6**: Zoom factors ($25\%$, $100\%$, $400\%$) preserve ground-truth PDF coordinates invariant.
- **Test 7**: Viewport rotation angles ($0^\circ, 90^\circ, 180^\circ, 270^\circ$) resolve ground-truth coordinates.
- **Test 8**: Combined native ($90^\circ$) and viewport ($90^\circ = 180^\circ$) rotation resolves accurately.
- **Test 9**: New text box enters editing state and inherits `activeProperties` typography.
- **Test 10**: Empty text box cleanup removes 0-character object on editing blur/commit.

Run with:
```bash
npm run test:phase5:text-box
```

---

## 5. Phase 5.5 Roadmap & Next Modules

- **Phase 5.5.1**: Text Object Model & State Architecture (`COMPLETE ✅`)
- **Phase 5.5.2**: Text Box Creation & Input (`COMPLETE ✅`)
- **Phase 5.5.3**: Text Box Resizing & Bounding Handles (`SCHEDULED ⏳`)
- **Phase 5.5.4**: Text Object Moving & Drag Positioning (`SCHEDULED ⏳`)
- **Phase 5.5.5**: Formatting Toolbar & Rich Text Typography Controls (`SCHEDULED ⏳`)
- **Phase 5.5.6**: Text Object Rotation Handles & Transformations (`SCHEDULED ⏳`)
