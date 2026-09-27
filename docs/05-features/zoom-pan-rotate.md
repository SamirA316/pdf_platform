# Zoom, Pan & Page Rotation (Phase 5.4)

## Overview
Phase 5.4 establishes production-grade viewport manipulation tools for the QuickPDF Editor: multi-level zoom stepping ($25\%$ to $400\%$), fit-to-width/fit-to-page calculations, mouse-wheel and trackpad pinch zoom, dedicated Hand tool and temporary Spacebar drag-panning, and Viewport View Rotation with coordinate stability and layer alignment.

---

## 1. Core Architecture & Transformations

The viewport interaction layer bridges client input with geometric coordinate transforms:

```
┌─────────────────────────────────────────────────────────────┐
│                       EditorContext                         │
│  - zoom: number (0.25 to 4.0)                               │
│  - viewportRotation: 0 | 90 | 180 | 270                     │
│  - isPanning: boolean                                       │
│  - activeTool: "select" | "hand" | ...                      │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
       Scale & Orientation              Pan & Drag Delta
               │                               │
               ▼                               ▼
┌──────────────────────────────┐ ┌──────────────────────────────┐
│        PageContainer         │ │       EditorViewport         │
│  - getRotatedDimensions()    │ │  - Hand tool drag            │
│  - PdfCanvasLayer (rotation) │ │  - Space + Mouse drag        │
│  - ObjectLayer (centered CSS │ │  - Middle-click drag         │
│    rotation transform)       │ │  - Ctrl + Wheel pinch zoom   │
│  - unrotatePoint() on click  │ │  - pointer-events suppression│
└──────────────────────────────┘ └──────────────────────────────┘
               ▲
               │ Zoom select, Rotate buttons & Shortcuts
┌──────────────┴───────────────┐
│     PDFEditorBottomBar       │
│  - Zoom select [25% - 400%]  │
│  - Zoom In / Out (+ / -)     │
│  - Rotate View 90° (Ccw/Cw)  │
│  - Fit Width / Fit Page      │
└──────────────────────────────┘
```

---

## 2. Zoom System

### 2.1 Presets & Boundary Snapping
Standard zoom presets:
$$\text{ZOOM\_PRESETS} = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0, 4.0]$$

Stepping helpers snap to the nearest preset:
- `getNextZoomIn(currentZoom)`: Advances to the next higher preset up to $400\%$.
- `getNextZoomOut(currentZoom)`: Reverses to the next lower preset down to $25\%$.
- Min zoom: $25\%$ ($0.25$) | Max zoom: $400\%$ ($4.0$).

### 2.2 Fit-to-Width and Fit-to-Page Calculations
```typescript
// Fit to available container width
const widthRatio = availableWidth / pageWidthPt;

// Fit to page: constrained by the tighter dimension
const heightRatio = availableHeight / pageHeightPt;
const fitPageZoom = Math.min(widthRatio, heightRatio);
```

### 2.3 Mouse-Wheel and Trackpad Pinch Zoom
In `EditorViewport.tsx`, wheel events with `e.ctrlKey` or `e.metaKey` (trackpad pinch gesture or Ctrl + mouse wheel) smoothly adjust the zoom factor:
```typescript
const factor = e.deltaY < 0 ? 1.05 : 0.95;
setZoom(zoom * factor);
```

### 2.4 Coordinate Invariance (72-DPI Points)
All editor objects (Text, Shapes, Drawings, Images) store position and dimensions strictly in unscaled 72-DPI PDF document points ($pt$). The screen representation is computed on-the-fly:
$$\text{screenPx} = \text{pdfPoints} \times \text{zoom}$$
When zoom changes, visual elements scale proportionally without accumulating rounding errors or spatial drift.

---

## 3. Pan / Hand Tool System

### 3.1 Hand Tool Mode (`activeTool === "hand"`)
- Activated via toolbar Hand icon or keyboard shortcut `H`.
- Viewport displays `cursor-grab` (or `cursor-grabbing` while dragging).
- Dragging adjusts the scroll container offsets:
  $$\text{scrollLeft}_{\text{target}} = \text{scrollLeft}_{\text{start}} - (x_{\text{current}} - x_{\text{start}})$$
  $$\text{scrollTop}_{\text{target}} = \text{scrollTop}_{\text{start}} - (y_{\text{current}} - y_{\text{start}})$$

### 3.2 Temporary Spacebar Drag-to-Pan
- Holding `Space` temporarily enables hand/grab mode without altering `activeTool`.
- Releasing `Space` smoothly restores the previously active tool.
- Form inputs (`<input>`, `<textarea>`, `contentEditable`) are automatically bypassed so regular text typing is never interrupted.

### 3.3 Middle-Click Pan
- Pressing middle-mouse button (`e.button === 1`) initiates drag-to-pan in any tool mode.

### 3.4 Object Interaction Suppression
While panning (`isPanning === true` or Hand tool active), page containers apply `pointer-events-none` to object layers, completely preventing accidental selection, dragging, or resizing of annotations during viewport navigation.

---

## 4. Viewport View Rotation vs. Native PDF Page Rotation

A critical architectural distinction is maintained:

| Feature | Viewport View Rotation | Native PDF Page Rotation |
|---|---|---|
| **Scope** | Client-side visual orientation ($0^\circ, 90^\circ, 180^\circ, 270^\circ$) | Document metadata dictionary (`/Rotate`) |
| **Purpose** | Editing comfort and landscape/portrait alignment | Permanent PDF document modification |
| **Storage** | `EditorContext.viewportRotation` | Extracted via PDF.js, exported in `rotationDelta` |
| **Export Impact** | Display only (does not alter original PDF unless applied) | Flattened into final exported PDF |

### 4.1 Dimension Swapping
When rotated $90^\circ$ or $270^\circ$, `getRotatedDimensions` swaps container width and height:
```typescript
export function getRotatedDimensions(width: number, height: number, rotation: ViewportRotation) {
  if (rotation === 90 || rotation === 270) {
    return { width: height, height: width };
  }
  return { width, height };
}
```

### 4.2 Geometric Point Transforms
Forward rotation (`rotatePoint`):
- $90^\circ$: $(x', y') = (H - y, x)$
- $180^\circ$: $(x', y') = (W - x, H - y)$
- $270^\circ$: $(x', y') = (y, W - x)$

Inverse unrotation (`unrotatePoint`):
Restores exact ground-truth page coordinates on user click:
- $90^\circ$: $(x, y) = (y', H - x')$
- $180^\circ$: $(x, y) = (W - x', H - y')$
- $270^\circ$: $(x, y) = (W - y', x')$

### 4.3 Combined PDF.js Rendering
`pdfRenderer.ts` sums the native PDF page rotation with the viewport rotation:
$$\text{effectiveRotation} = (\text{page.rotate} + \text{viewportRotation}) \pmod{360}$$
High-DPI canvas buffer is re-rasterized cleanly, while `ObjectLayer` applies a centered CSS rotation transform so existing annotations match the rotated canvas.

---

## 5. Keyboard Shortcuts Reference

| Shortcut | Action |
|---|---|
| `Cmd` / `Ctrl` + `+` or `=` | Zoom In (next preset) |
| `Cmd` / `Ctrl` + `-` or `_` | Zoom Out (previous preset) |
| `Cmd` / `Ctrl` + `0` | Reset Zoom ($100\%$) |
| `Shift` + `R` | Rotate View Clockwise ($90^\circ$) |
| `H` | Select Hand / Pan Tool |
| `V` | Select Selection Tool |
| `Space` + Drag | Temporary Pan Drag |

---

## 6. Verification & Automated Tests

Run the Phase 5.4 test suite:
```bash
npm run test:phase5:zoom-pan-rotate
```

### Verified Scenarios (12/12 Passing):
1. Zoom preset stepping snaps cleanly through standard levels
2. Zoom boundaries clamp at $25\%$ minimum and $400\%$ maximum
3. Object coordinates in PDF points remain invariant across all zoom factors
4. `calculateFitZoom` fits page to available container width
5. `calculateFitZoom` fits page to the most constrained container dimension
6. Viewport view rotation advances and reverses through $0^\circ, 90^\circ, 180^\circ, 270^\circ$
7. `getRotatedDimensions` swaps width and height exclusively on $90^\circ$ and $270^\circ$
8. `rotatePoint` accurately maps corners from page space to rotated viewport space
9. `unrotatePoint` restores original coordinates with exact round-trip fidelity
10. Effective rotation combines native PDF page rotation with viewport rotation
11. Hand tool drag calculates viewport `scrollLeft` and `scrollTop` accurately
12. Spacebar pan correctly enables temporary hand mode and ignores input targets
