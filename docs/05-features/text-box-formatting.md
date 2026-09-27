# Text Box Formatting (Phase 5.5.5)

## Overview
Phase 5.5.5 implements rich, production-grade text formatting for the QuickPDF Editor. Building on the foundational `ITextObject` model (Phase 5.5.1), interactive box creation (Phase 5.5.2), bounding handle resizing (Phase 5.5.3), and body drag moving (Phase 5.5.4), Phase 5.5.5 allows selected text objects to be styled across 8 core typographic dimensions.

All text formatting integrates directly into the unified editor context and history architecture (`EditorContext.tsx`), preserving undo/redo state, supporting multi-selection formatting, isolating text operations from unrelated object types, preventing history pollution during numeric keystrokes, and maintaining full invariance across move, resize, rotation, and zoom.

---

## 1. Supported Formatting Properties

| Property | Type / Constraints | Default | Behavior |
| :--- | :--- | :--- | :--- |
| **Font Family** | `Helvetica` \| `Times` \| `Courier` \| `Inter` \| `Roboto` \| `Arial` | `Helvetica` | Standard approved fonts. Rejects unsupported fonts. |
| **Font Size** | Finite number, $> 0$, range `[4, 500]` pt | `16` pt | Input commits on blur or Enter. Clamped to valid schema limits. |
| **Bold** | `fontWeight`: `"normal"` \| `"bold"` | `"normal"` | Toggle button with active visual indicator. |
| **Italic** | `fontStyle`: `"normal"` \| `"italic"` | `"normal"` | Toggle button with active visual indicator. |
| **Underline** | `textDecoration`: `"none"` \| `"underline"` | `"none"` | Toggle button with active visual indicator. |
| **Text Color** | Hex string (`#RRGGBB` or `#RGB`) | `#000000` | Preset palette swatches + native color picker / custom hex input. Validated via regex. |
| **Alignment** | `textAlign`: `"left"` \| `"center"` \| `"right"` | `"left"` | 3-button alignment group with active toggle state. |
| **Line Height** | Finite number, $> 0$, range `[0.5, 3.0]` multiplier | `1.2` | Numeric input (commits on blur/Enter) + quick preset buttons (`1.0`, `1.2`, `1.5`, `2.0`). |

---

## 2. Validation & Boundary Enforcement

1. **Font Size**:
   - Must be finite and strictly $> 0$.
   - Input rejecting `NaN`, `Infinity`, `0`, and negative values.
   - Clamped to minimum `4 pt` and maximum `500 pt` matching `textEditorObjectSchema`.
2. **Line Height**:
   - Must be finite and strictly $> 0$.
   - Input rejecting `NaN`, `Infinity`, `0`, and negative values.
   - Clamped to minimum `0.5` and maximum `3.0` matching `textEditorObjectSchema`.
3. **Color**:
   - Strictly validated against `/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/`.
   - Rejects named colors ("red", "blue"), RGB/RGBA strings, or invalid characters.
4. **Font Family**:
   - Strictly restricted to the 6 system-supported fonts: `Helvetica`, `Times`, `Courier`, `Inter`, `Roboto`, `Arial`.
5. **Alignment**:
   - Restricted to `"left" | "center" | "right"`.

---

## 3. Selection & Multi-Select Semantics

- **Primary Selection**: When a text object is selected, all properties controls in `PDFEditorProperties` synchronize to display the selected object's formatting values.
- **Multiple Text Selection**: When multiple text objects are selected simultaneously, formatting commands update all selected text objects in a single batch.
- **Heterogeneous Selection**: When both text and non-text objects (such as shapes or drawings) are selected together, formatting operations safely filter to text objects only, leaving shapes and drawings uncorrupted.
- **Zero Selection**: When no text object is selected and the text tool is active, changes update `activeProperties`, ensuring the next text box created automatically inherits the selected styling.

---

## 4. History & Undo/Redo Architecture

- **Single Atomic Transaction**: Each logical formatting change produces a single undoable `UPDATE_OBJECT` action containing the complete previous and next state snapshots.
- **No-Op Deduplication**: If an update does not change any property values (e.g. setting font size to 16 when it is already 16), the update is skipped and no redundant history entry is created.
- **Numeric Input Protection (Keystroke Flood Prevention)**:
  - While typing a numeric value (e.g. font size `24` or line height `1.5`), updates are held in local component state.
  - The logical change is only committed upon `blur` or when pressing `Enter`.
  - Intermediate typing keystrokes do NOT flood the history stack.
- **Undo State Restoration**: Invoking `undo()` restores the previous formatting state across all modified properties.
- **Redo State Restoration**: Invoking `redo()` restores the new formatting state.

---

## 5. Invariance Across Transformations

- **Move / Drag**: Formatted text objects moved across pages retain all 8 formatting properties without degradation.
- **Resize**: Resizing bounding boxes preserves font size, styles, colors, alignment, and line height.
- **Viewport & Native Rotation**: Formatted text rendered under 0°, 90°, 180°, and 270° viewport or native PDF rotations remains completely invariant.
- **Zoom Scaling**: Font sizes and line heights are defined in ground-truth 72-DPI PDF points; on-screen rendering scales smoothly across 25% to 400% zoom levels while retaining original point values.

---

## 6. Verification Status

Automated test suite: `backend/tests/phase5_editor_format.test.ts`
- 19 automated test scenarios passing 100%.
- Integrated into master regression runner `run_regression.ts`.
