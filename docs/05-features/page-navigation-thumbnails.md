# Page Navigation & Thumbnails (Phase 5.3)

## Overview
Phase 5.3 delivers synchronized page navigation, interactive thumbnail browsing, direct page jumping, and keyboard shortcuts for the QuickPDF Editor. It establishes robust bi-directional synchronization between the thumbnail sidebar and the main multi-page viewport, ensuring an intuitive, responsive reading and editing experience across documents of any page count.

---

## 1. Core Architecture & Synchronization Model

The navigation subsystem connects `EditorContext`, `EditorViewport`, `PDFEditorThumbnails`, and `PDFEditorBottomBar`:

```
┌─────────────────────────────────────────────────────────────┐
│                       EditorContext                         │
│  - currentPageIndex: number                                 │
│  - scrollToPage(pageIndex: number, behavior?: ScrollBehavior)│
│  - isProgrammaticScrollRef: boolean (feedback-loop lock)    │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
       Scroll / Click                   Current Page Update
               │                               │
               ▼                               ▼
┌──────────────────────────────┐ ┌──────────────────────────────┐
│       EditorViewport         │ │     PDFEditorThumbnails      │
│  - DOM id="editor-page-{i}"  │ │  - DOM id="thumb-page-{i}"   │
│  - IntersectionObserver      │ │  - Active border highlight   │
│    (dominant page detection) │ │  - scrollIntoView(nearest)   │
└──────────────────────────────┘ └──────────────────────────────┘
               ▲
               │ Direct jump / Prev / Next / Keyboard
┌──────────────┴───────────────┐
│     PDFEditorBottomBar       │
│  - [ Input ] of {totalPages} │
│  - Prev (◄) / Next (►)       │
│  - PageUp / PageDown / Home  │
└──────────────────────────────┘
```

---

## 2. Bi-Directional Scroll Synchronization

### 2.1 Viewport to State (IntersectionObserver)
`EditorViewport` attaches an `IntersectionObserver` observing all rendered page wrappers (`#editor-page-{index}`).
- **Thresholds**: Evaluates intersections at `[0.1, 0.25, 0.5, 0.75, 1.0]`.
- **Dominant Page Selection**: Calculates which page possesses the highest intersection ratio in the visible viewport.
- **Feedback Loop Prevention**: When the user clicks a thumbnail or uses direct jump, `isProgrammaticScrollRef` is set to `true` for $600\text{ ms}$, temporarily ignoring observer callbacks to prevent jarring layout jitter or race conditions.

### 2.2 State to Viewport (`scrollToPage`)
```typescript
const scrollToPage = useCallback((pageIndex: number, behavior: ScrollBehavior = "smooth") => {
  const targetIndex = Math.max(0, Math.min(pageIndex, pages.length - 1));
  setCurrentPageIndex(targetIndex);
  
  isProgrammaticScrollRef.current = true;
  const pageEl = document.getElementById(`editor-page-${targetIndex}`);
  if (pageEl) {
    pageEl.scrollIntoView({ behavior, block: "start" });
  }
  
  setTimeout(() => {
    isProgrammaticScrollRef.current = false;
  }, 600);
}, [pages.length]);
```

---

## 3. Interactive Thumbnail Sidebar

`PDFEditorThumbnails.tsx` provides high-performance thumbnail navigation:
- **Instant Page Selection**: Clicking any thumbnail triggers `scrollToPage(index)`.
- **Active State Indication**: The current page thumbnail receives an active primary border, drop shadow, and badge indicator.
- **Auto-Scroll Active Thumbnail**: As the user scrolls through the document, `PDFEditorThumbnails` automatically keeps the active thumbnail visible in the sidebar using `scrollIntoView({ behavior: 'smooth', block: 'nearest' })`.
- **Accessibility**: Thumbnails support `aria-current="page"` and `tabIndex={0}` with keyboard activation (Enter / Space).

---

## 4. Direct Page Jump & Keyboard Navigation

### 4.1 Quick Jump Input (`PDFEditorBottomBar.tsx`)
Users can jump directly to any page by typing in the page counter input:
- Parses 1-based human-friendly page numbers into 0-based internal indices.
- Validates and clamps inputs strictly to `[1, numPages]`.
- Discards non-numeric values, negative numbers, and floats cleanly without state corruption.
- Commits navigation on `Enter` key or input `blur`.

### 4.2 Keyboard Navigation (`PDFEditor.tsx`)
Global keyboard listeners allow natural document traversal when not focused on text input:
- `PageDown`: Advance to next page (`currentPageIndex + 1`).
- `PageUp`: Return to previous page (`currentPageIndex - 1`).
- `Home`: Jump directly to first page (`0`).
- `End`: Jump directly to last page (`numPages - 1`).

---

## 5. Robust Remote File Loading (`loadFromFileId`)

In addition to client-side navigation, Phase 5.3 hardened `EditorContext.loadFromFileId()` against non-PDF server responses:
1. **HTTP Status Check**: Verifies `response.ok` (rejects 4xx / 5xx responses).
2. **MIME Type Validation**: Ensures `Content-Type` is `application/pdf` or `application/octet-stream`.
3. **HTML Error Rejection**: Explicitly rejects HTML error pages (e.g. 404/500 proxy pages) before passing to PDF.js.
4. **JSON Error Extraction**: Detects structured API errors (`{ "success": false, "error": { "message": "..." } }`) and surfaces clear diagnostic messages.
5. **Content-Length Verification**: Rejects empty 0-byte responses before worker initialization.

---

## 6. Automated Verification

Run the Phase 5.3 navigation test suite:
```bash
npm run test:phase5:navigation
```

### Verified Scenarios (12/12 Passing):
1. Page index clamping strictly within `[0, numPages - 1]`
2. `parsePageJumpInput` 1-based to 0-based page conversion
3. Out-of-bounds, float, and non-numeric input handling
4. Next / Prev boundary safety
5. Valid PDF MIME acceptance (`application/pdf`, `application/octet-stream`)
6. Rejection of HTML error pages
7. Rejection and extraction of JSON API error responses
8. Rejection of 0-byte empty responses
9. IntersectionObserver dominant page detection algorithm
10. Keyboard event mapping and boundary enforcement
11. DOM ID consistency across viewport and sidebar containers
12. Multi-page vertical offset calculations
