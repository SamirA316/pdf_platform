# PDF Editor Foundation (Phase 5.1)

## Overview
Phase 5.1 establishes the architectural foundation, coordinate geometry engine, data models, state management, and modular UI structure for the interactive in-browser **PDF Editor**.

---

## Architectural Principles

### 1. Dual-Layer Architecture
- **Layer 0–1 (PDF.js Background Canvas)**: Hardware-accelerated pixel render of underlying PDF pages.
- **Layer 2–3 (Interactive Vector Overlay)**: DOM and SVG overlay rendering editable objects (text, shapes, pen strokes, images) with immediate local responsiveness and bounding box selection.

### 2. Strict PDF Ground-Truth Coordinate System
- **Ground Truth**: Every object's position ($x, y$), dimensions ($width, height$), and stroke width are stored in standard **72-DPI PDF points** ($1 \text{ pt} = \frac{1}{72} \text{ inch}$).
- **Viewport Scaling**: Responsive viewport zoom uses a mathematical multiplier ($S = \text{zoom} \times \frac{\text{targetDPI}}{72}$). Zooming or resizing the browser window never mutates the underlying object data model.

### 3. Command Pattern for Undo / Redo
- The `EditorHistoryManager` maintains an immutable stack of reversible actions (`ADD_OBJECT`, `REMOVE_OBJECT`, `UPDATE_OBJECT`, `MOVE_OBJECTS`).
- Memory ceiling: Stack is capped at 50 steps with FIFO eviction.

---

## Component Architecture

```
frontend/components/editor/
├── PDFEditor.tsx             # Root orchestrator & shortcut controller
├── PDFEditorHeader.tsx       # Top bar (Filename, Undo/Redo, Zoom, Save, Export)
├── PDFEditorToolbar.tsx      # Left vertical tool palette
├── PDFEditorProperties.tsx   # Right property inspector (Color, Typography, Stroke)
├── PDFEditorThumbnails.tsx   # Collapsible page navigation thumbnails
├── PDFEditorBottomBar.tsx    # Page navigation and fit-width controls
└── viewport/
    ├── EditorViewport.tsx    # Scrollable center workspace
    ├── PageContainer.tsx     # Single PDF page container
    ├── ObjectLayer.tsx       # Interactive object renderer
    └── SelectionOverlay.tsx  # 8-point resize handle bounding box
```

---

## API Endpoints

### 1. Editor Health & Capabilities
- **Method**: `GET /api/v1/editor`
- **Response**:
```json
{
  "success": true,
  "data": {
    "module": "editor",
    "phase": "5.1",
    "status": "ready",
    "capabilities": {
      "supportedTools": ["select", "hand", "text", "image", "rectangle", "circle", "line", "arrow", "pen", "highlighter", "eraser", "signature"],
      "supportedFonts": ["Helvetica", "Times", "Courier", "Inter", "Roboto", "Arial"],
      "coordinateSystem": { "unit": "pt", "pointsPerInch": 72, "origin": "top-left" }
    }
  }
}
```

### 2. Validate Editor Export Manifest
- **Method**: `POST /api/v1/editor/validate`
- **Payload**: `IEditorExportPayload`
- **Response**:
```json
{
  "success": true,
  "data": {
    "valid": true,
    "fileId": "cmuch51se0007wk7o453m4oey",
    "pageCount": 1,
    "totalObjects": 3
  }
}
```

---

## Test Verification
Run the Phase 5.1 foundation test suite:
```bash
npm run test:phase5:foundation
```
Covering:
- API capabilities & schema validation
- Rejection of invalid colors, missing IDs, non-positive dimensions
- Exact round-trip coordinate calculations (72 DPI points <-> Screen px)
- Fit-to-width zoom boundary logic
- Undo/redo history stack limits
