# Current System Architecture & Audit (Phase 0)

## 1. High-Level Architecture Overview

QuickPDF operates on a client-server web architecture composed of a **Next.js frontend** and an **Express.js / Node.js backend** connected via HTTP REST APIs.

```
┌─────────────────────────────────────────────────────────────────┐
│                       Frontend (Next.js 14)                     │
│  - React 18, Tailwind CSS, Lucide Icons                         │
│  - Tool routing (/tools/[toolSlug])                            │
│  - Client-side Canvas rendering (pdfjs-dist)                    │
│  - Client-side PDF generation (pdf-lib)                         │
└────────────────────────────────┬────────────────────────────────┘
                                 │ HTTP REST (FormData / JSON)
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend Server (Express.js)                  │
│  - Port 3001                                                    │
│  - Multer flexible upload middleware (100MB file limit)         │
│  - Cookie-based JWT & Guest authentication                      │
│  - Prisma ORM with SQLite database (dev.db)                     │
└────────────────┬───────────────────────────────┬────────────────┘
                 │                               │
                 ▼                               ▼
  ┌─────────────────────────────┐ ┌─────────────────────────────┐
  │     Processing Engines      │ │        File Storage         │
  │ - pdf-lib (pure JS engine)  │ │ - Local disk: ./uploads     │
  │ - Puppeteer (Chromium)      │ │ - express.static(/uploads)  │
  │ - Sharp (Image pipeline)    │ │   [Audit flag: Dev only]    │
  │ - Tesseract.js (OCR)        │ └─────────────────────────────┘
  │ - Ghostscript / QPDF        │
  │ - OpenAI API (Summarize/Chat│
  └─────────────────────────────┘
```

---

## 2. Platform Scope Boundary: PDF Platform vs. Image Platform

To prevent architectural creep, the scope of the QuickPDF platform is strictly demarcated:

### In-Scope (PDF Platform):
The 34 tools focused on PDF document manipulation, including format transformations:
- `JPG to PDF` (`jpg-to-pdf`)
- `PDF to JPG` (`pdf-to-jpg`)
- `PDF to PNG` (`pdf-to-png`)
- `Scan to PDF` (`scan-to-pdf`)

### Out-of-Scope (Separate Image Platform):
Standalone image processing features located in `frontend/app/image-tools/` and associated image manipulation scripts remain in the codebase to prevent broken imports, but are **excluded** from the PDF Platform:
- Image Resize ❌
- Background Remove ❌
- Passport Photo Maker ❌
- Standalone Image Editor ❌

---

## 3. Directory Structure

```
pdf_platform/
├── frontend/                     # Next.js application
│   ├── app/                      # App router pages & layouts
│   │   ├── tools/[toolSlug]/     # Dynamic tool workspace route
│   │   ├── login/ & signup/      # Authentication pages
│   │   ├── pricing/              # Pricing page (100MB limit aligned)
│   │   ├── about/, blog/, etc.   # Informational pages
│   │   └── image-tools/          # [Out of scope] Standalone image platform
│   ├── components/               # React components
│   │   ├── shared/               # ToolWorkspace, Navbar, Footer, StateCards
│   │   └── tools/                # Specialized tool panels (EditConfig, etc.)
│   ├── config/                   # Tool registry (34 tools in tools.ts, 100MB limit)
│   └── lib/                      # apiClient, authContext, utilities
├── backend/                      # Express.js REST API
│   ├── src/
│   │   ├── controllers/          # pdf.controller.ts, auth.controller.ts, etc.
│   │   ├── middlewares/          # upload.middleware.ts, auth.middleware.ts
│   │   ├── routes/               # pdf.routes.ts, auth.routes.ts, document.routes.ts
│   │   └── server.ts             # Express entry point
│   ├── prisma/                   # schema.prisma & SQLite databases (dev.db)
│   └── uploads/                  # Temporary & persistent processing artifacts
└── docs/                         # Project documentation & audit specifications
```

---

## 4. Core Processing Engines & Dependencies

1. **`pdf-lib` (v1.17.1 / `@cantoo/pdf-lib`)**:
   - Primary in-memory PDF manipulation library.
   - Used for: `merge`, `split`, `rotate`, `resize`, `watermark`, `page-numbers`, and `image-to-pdf`.
   - Fast, zero native dependency, reliable for standard PDF structures.

2. **`Puppeteer` (Chromium Automation)**:
   - Used for: `pdf-to-image` (renders pages to canvas via bundled PDF.js worker at 2x retina scale) and `html-to-pdf` (renders arbitrary HTML documents).
   - High fidelity but resource heavy; headless instances managed with `--no-sandbox` flags.

3. **`Sharp` (v0.34+)**:
   - High-speed image processing library for cropping, JPEG/PNG conversion, and OCR pre-processing.

4. **`Tesseract.js`**:
   - Pure JS/Wasm OCR extraction for `ocr-pdf` and `ocr-crop`.

5. **`OpenAI` SDK**:
   - Powers document intelligence: AI summarization (`gpt-3.5-turbo`), multi-language translation, and conversational PDF QA (`chatWithPdf`).

6. **External CLI Tools (`qpdf`, `ghostscript`)**:
   - Invoked via child process `exec` for military-grade password encryption (`protectPDF`), decryption (`unlockPDF`), PDF/A compliance (`pdfToPdfA`), and compression (`compressPDFFile`).

---

## 5. Upload Validation Architecture & Technical Debt

### Multer Configuration (`upload.middleware.ts`):
- **Upload Limit**: 100MB per file (`100 * 1024 * 1024` bytes), matching the frontend `maxSizeMB: 100` configuration across all tools and pricing tiers.
- **Batch Limit**: Max 20 files per batch.

### Identified Technical Debt & Limitations:
1. **`uploadMiddleware.any()` Usage**:
   - `flexibleUpload` uses `uploadMiddleware.any()` to accept arbitrary field names (`file`, `files`, `custom`, etc.).
   - Retained in Phase 0 to preserve compatibility with diverse frontend payloads. Tool-specific upload validation is scheduled for Phase 2.
2. **Permissive MIME Validation Logic**:
   - Current logic:
     ```ts
     if (!ALLOWED_MIME_TYPES.has(mime) && !ALLOWED_EXTENSIONS.has(ext))
     ```
   - Since `ALLOWED_EXTENSIONS` is pre-checked, this condition does not block an allowed extension if the MIME type mismatches or is generic (`application/octet-stream`).
   - Planned remediation: Deep magic-byte file signature verification in the Security Phase.

---

## 6. Authentication & Mock OAuth Audit

### Current Implementation:
- Email + password registration and login with OTP verification (`verifyOTP`).
- Cookie-based JWT authentication (`requireStrictAuth` and guest fallback `requireAuth`).
- Social OAuth routes (`/api/auth/google`, `/api/auth/facebook`, `/api/auth/apple`) with a fallback mock route (`/api/auth/mock/:provider`).

### Identified Technical Debt:
- **DEVELOPMENT ONLY — Mock OAuth**:
  - Because third-party OAuth provider credentials are not yet provisioned, the backend redirects to simulated mock login when placeholder credentials are detected.
  - This is strictly classified as development scaffolding and will be completely removed in the Production Hardening Phase.

---

## 7. Public Uploads Audit & Security Remediation

### Phase 0 Security Remediation:
- **Direct Static Serving Removed**:
  - Previously, `app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));` was enabled, exposing documents directly to unauthenticated URL probing.
  - In Phase 0, this line has been **commented out/removed** in `backend/src/server.ts`.
  - Processed and uploaded files remain saved in `backend/uploads/` on the local disk, but can **only** be downloaded via the authenticated `/api/documents/download/:id` controller endpoint with proper user ownership checks.

### Target Architecture (Phase 2 & Phase 12):
1. Maintain zero direct public exposure.
2. Migrate file persistence from local disk to private cloud object storage (Cloudflare R2 or AWS S3).
3. Serve downloads exclusively through short-lived, pre-signed URLs generated dynamically after verifying requester identity.

---

## 8. Edit PDF Architecture & Audit

### Component: `frontend/components/tools/EditConfig.tsx` (~3,770 LOC)

### Architectural Flow:
1. **Document Loading**:
   - Loads PDF array buffer into client memory.
   - Loads PDF.js worker from CDN (`cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`).
   - Renders each page to an HTML `<canvas>` element for crisp on-screen preview.
2. **Interactive Editing Canvas**:
   - Text extraction: Evaluates text content items from PDF.js to discover text boxes and coordinates.
   - Whiteout & text insertion: Replaces underlying text by painting an overlay background rectangle and rendering updated text in selected font (Helvetica, Times, Courier).
   - Drawing & Shapes: Freehand pen, highlighters, rectangles, circles, arrows, and signature stamps drawn on interactive canvas overlays.
3. **Compilation & Export**:
   - On clicking "Save & Download", client-side `pdf-lib` embeds all drawings, shapes, and font overlays directly into a freshly generated PDF byte stream.
   - The compiled PDF is sent to `/api/pdf/ui/edit-pdf` where `advancedUiProcessor` persists the finalized document record.

### Identified Bottlenecks & Known Issues:
- **Monolithic Component**: Over 3,700 lines of code combining state, PDF rendering, toolbars, modal dialogs, and canvas drawing handlers into a single file.
- **Memory Footprint**: Multi-page high-DPI PDFs (20+ pages) consume noticeable browser RAM during simultaneous canvas caching.
- **External CDN Dependency**: Relies on CDN-hosted PDF.js script instead of local npm bundled worker.

### Phase 0 Boundary:
- `EditConfig.tsx` is left **completely untouched and working**.
- A full modular refactor (splitting into canvas engine, toolbar controls, annotation managers, and bundled PDF.js worker) is strictly scheduled for **Phase 5**.
