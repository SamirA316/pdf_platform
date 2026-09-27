# PDF Viewer & Rendering (Phase 5.2)

## Overview
Phase 5.2 implements the live, high-fidelity PDF rendering engine powered by **PDF.js** (`pdfjs-dist`). It replaces static placeholders with dynamic canvas rendering, hardware-accelerated High-DPI rasterization, render task cancellation, dynamic document dimension extraction, and live thumbnail generation.

---

## 1. Core Architecture & Services

The viewer subsystem resides in `frontend/lib/editor/pdf/`:
- **`pdfDocument.ts`**: Document loading, worker initialization, page dimension extraction, and memory lifecycle teardown.
- **`pdfRenderer.ts`**: High-DPI canvas rendering, active task cancellation, and thumbnail downscaling.
- **`pdfTypes.ts`**: TypeScript contracts for PDF.js document proxies, render handles, and viewports.

---

## 2. Dynamic Document Loading & Dimension Extraction

Documents are loaded dynamically via:
1. **Raw bytes**: `loadFromBytes(buffer: ArrayBuffer, fileName: string)`
2. **File object**: `loadFromFile(file: File)`
3. **Backend API**: `loadFromFileId(fileId: string)` (`GET /api/v1/files/:fileId/download`)

### Dimension Extraction:
Rather than relying on hardcoded page dimensions, `extractDocumentDimensions` inspects each page's native unscaled viewport:
```typescript
const viewport = page.getViewport({ scale: 1.0 });
return {
  pageIndex,
  width: viewport.width,   // Ground-truth 72 DPI PDF points
  height: viewport.height,
  rotation: page.rotate,   // Native page rotation (0°, 90°, 180°, 270°)
};
```

---

## 3. High-DPI Canvas Rendering

To guarantee sharp text and lines on Retina and high-density mobile screens, rendering uses `window.devicePixelRatio`:
- **Physical Canvas Buffer**:
  $$\text{scale} = \text{zoom} \times \text{dpr}$$
  $$\text{canvas.width} = \text{Math.round}(\text{viewport.width})$$
  $$\text{canvas.height} = \text{Math.round}(\text{viewport.height})$$
- **Logical CSS Dimensions**:
  $$\text{canvas.style.width} = (\text{viewport.width} / \text{dpr}) + \text{"px"}$$
  $$\text{canvas.style.height} = (\text{viewport.height} / \text{dpr}) + \text{"px"}$$

---

## 4. Render Task Cancellation

When a user navigates between pages or rapidly adjusts zoom, in-flight render operations are automatically aborted via `RenderTask.cancel()`:
```typescript
useEffect(() => {
  const handle = renderPageToCanvas(pdfDocument, pageIndex, canvas, { zoom });
  return () => {
    handle.cancel(); // Preemptively cancel in-flight render on dependency change
  };
}, [pdfDocument, pageIndex, zoom]);
```
`RenderingCancelledException` errors are intercepted and handled silently.

---

## 5. Live Thumbnail Generation

The thumbnail sidebar (`PDFEditorThumbnails.tsx`) renders every page onto a dedicated thumbnail canvas at a fixed target width ($112 \text{ px}$):
- Fast rendering without blocking the main editing viewport.
- Preserves heterogeneous aspect ratios (A4, US Letter, Landscape).
- Shows real-time spinner while rendering.

---

## 6. Memory Lifecycle Management

When switching documents or unmounting the editor, `destroyPdfDocument()` explicitly calls `doc.destroy()`, reclaiming Web Worker threads, canvas image memory, and font caches.

---

## 7. Verification Tests

Run the viewer test suite:
```bash
npm run test:phase5:viewer
```
Covering:
- Multi-page document loading
- Corrupted / 0-byte buffer rejection
- Exact dimension extraction (A4, Letter, Landscape, mixed sizes)
- Native rotation extraction (0°, 90°, 180°, 270°)
- Retina buffer math
- Thumbnail aspect ratio preservation
- Cancellation semantics and teardown
