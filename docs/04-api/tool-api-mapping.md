# QuickPDF Platform — Tool API Mapping & Status Directory

This document establishes the official architectural mapping between the 34 frontend tools defined in [tools.ts](file:///Users/samiransari/Desktop/Project/pdf_platform/frontend/config/tools.ts), their frontend routing, backend endpoints, processing engines, and implementation readiness status.

> [!IMPORTANT]
> **Developer Rule: New Development = V1 Only**
> - **Question**: *"Should I call `/api/pdf/merge` or `/api/v1/jobs`?"*
> - **Answer**: **Always `POST /api/v1/jobs`**.
> 
> Direct `/api/pdf/*` calls for core tools have been completely removed from frontend code. All core PDF processing strictly uses the V1 architecture:
> $$\text{Tool UI} \longrightarrow \text{uploadFileToV1()} \longrightarrow \text{createJob()} \longrightarrow \text{getJob() polling} \longrightarrow \text{COMPLETED} \longrightarrow \text{/api/v1/files/:id/download}$$
> Legacy backend `/api/pdf/*` routes remain active **solely for backward compatibility** with old clients, decorated with `X-API-Deprecated: true` response headers.

---

## Tool Status Summary

| Category | Count | Status | Protocol |
|---|---|---|---|
| **CURRENT V1 TOOLS** | 13 | `READY` | V1 Job System (`POST /api/v1/jobs`) & V1 Editor Foundation |
| **LEGACY CONVERTERS & AI** | 12 | `IN_PROGRESS` | Legacy REST (`/api/pdf/*`), scheduled for V1 migration in Phase 3/4 |
| **PLANNED TOOLS** | 9 | `PLANNED` | UI routed, scheduled for V1 engine implementation |
| **TOTAL** | **34** | | |

---

## 1. CURRENT V1 TOOLS (13 Tools — Production Ready)

All 12 Core PDF manipulation tools plus the Editor foundation are completely standardized on the V1 Architecture. Frontend `ToolWorkspace.tsx` interacts solely with `/api/v1/files` and `/api/v1/jobs`.

| # | Tool Name | Slug / Route | Backend Endpoint | Engine / Processor | Status | Architectural Capabilities |
|---|---|---|---|---|---|---|
| 1 | **Merge PDF** | `/tools/merge-pdf` | `POST /api/v1/jobs` | `MergeProcessor` | `READY` | Multi-file ordered merging with outline & form preservation |
| 2 | **Split PDF** | `/tools/split-pdf` | `POST /api/v1/jobs` | `SplitProcessor` | `READY` | Range extraction, page list, and burst (every page) modes |
| 3 | **Compress PDF** | `/tools/compress-pdf` | `POST /api/v1/jobs` | `CompressProcessor` | `READY` | Presets (`extreme`, `recommended`, `less`), image downsampling & stream compression |
| 4 | **Rotate PDF** | `/tools/rotate-pdf` | `POST /api/v1/jobs` | `RotateProcessor` | `READY` | Bulk & per-page 90°, 180°, 270° clockwise rotations |
| 5 | **Organize PDF** | `/tools/organize-pdf` | `POST /api/v1/jobs` | `OrganizeProcessor` | `READY` | Arbitrary reordering, page deletion, and selective rotation |
| 6 | **Resize PDF** | `/tools/resize-pdf` | `POST /api/v1/jobs` | `ResizeProcessor` | `READY` | Standard presets (A3, A4, A5, Letter, Legal) & custom dimensions |
| 7 | **Watermark PDF** | `/tools/watermark` | `POST /api/v1/jobs` | `WatermarkProcessor` | `READY` | Text & image stamps with position, opacity, and rotation |
| 8 | **Page Numbers** | `/tools/page-numbers` | `POST /api/v1/jobs` | `PageNumbersProcessor` | `READY` | 6 standard positions, Roman/Arabic formats, margin offsets |
| 9 | **Protect PDF** | `/tools/protect-pdf` | `POST /api/v1/jobs` | `ProtectProcessor` | `READY` | AES-256 / RC4 encryption with user & owner passwords |
| 10 | **Unlock PDF** | `/tools/unlock-pdf` | `POST /api/v1/jobs` | `UnlockProcessor` | `READY` | Password verification and security removal |
| 11 | **Repair PDF** | `/tools/repair-pdf` | `POST /api/v1/jobs` | `RepairProcessor` | `READY` | QPDF structural repair & Ghostscript xref reconstruction |
| 12 | **PDF to PDF/A** | `/tools/pdf-to-pdfa` | `POST /api/v1/jobs` | `PdfaProcessor` | `READY` | PDF/A-1b, 2b, 3b archiving conformance |
| 13 | **Edit PDF** | `/tools/edit-pdf` | `POST /api/v1/editor/validate` | `EditorEngine` | `READY` | High-DPI canvas viewer, text objects, transforms, undo/redo |

---

## 2. LEGACY CONVERTERS & AI (12 Tools — In Progress / Transitional)

These tools currently run on legacy synchronous backend routes (`/api/pdf/*`). They are documented dependencies scheduled for migration into the V1 Job Engine in Phase 3 (Conversion Engine) and Phase 4 (AI Pipeline).

| # | Tool Name | Slug / Route | Current Endpoint | Target V1 Endpoint | Migration Phase | Current Implementation |
|---|---|---|---|---|---|---|
| 14 | **PDF to Word** | `/tools/pdf-to-word` | `POST /api/pdf/pdf-to-word` | `POST /api/v1/jobs` | Phase 3 | PDF extraction to DOCX |
| 15 | **PDF to PowerPoint** | `/tools/pdf-to-powerpoint` | `POST /api/pdf/pdf-to-pptx` | `POST /api/v1/jobs` | Phase 3 | PDF page conversion to PPTX slides |
| 16 | **PDF to Excel** | `/tools/pdf-to-excel` | `POST /api/pdf/pdf-to-excel` | `POST /api/v1/jobs` | Phase 3 | Table detection & XLSX export |
| 17 | **Word to PDF** | `/tools/word-to-pdf` | `POST /api/pdf/word-to-pdf` | `POST /api/v1/jobs` | Phase 3 | Mammoth & Puppeteer conversion pipeline |
| 18 | **PowerPoint to PDF** | `/tools/powerpoint-to-pdf` | `POST /api/pdf/pptx-to-pdf` | `POST /api/v1/jobs` | Phase 3 | Office slide renderer |
| 19 | **Excel to PDF** | `/tools/excel-to-pdf` | `POST /api/pdf/excel-to-pdf` | `POST /api/v1/jobs` | Phase 3 | SheetJS & Puppeteer pipeline |
| 20 | **PDF to JPG** | `/tools/pdf-to-jpg` | `POST /api/pdf/pdf-to-jpg` | `POST /api/v1/jobs` | Phase 3 | Page rasterization via Sharp / pdf-parse |
| 21 | **JPG to PDF** | `/tools/jpg-to-pdf` | `POST /api/pdf/jpg-to-pdf` | `POST /api/v1/jobs` | Phase 3 | Image-to-PDF packing via pdf-lib |
| 22 | **Sign PDF** | `/tools/sign-pdf` | `POST /api/pdf/sign-pdf` | `POST /api/v1/jobs` | Phase 5 | Visual signature stamping; PKI planned |
| 23 | **OCR PDF** | `/tools/ocr-pdf` | `POST /api/pdf/ocr` | `POST /api/v1/jobs` | Phase 4 | Tesseract optical character recognition |
| 24 | **AI Summarizer** | `/tools/ai-summarizer` | `POST /api/pdf/summarize` | `POST /api/v1/jobs` | Phase 4 | LLM text summarization pipeline |
| 25 | **Chat with PDF** | `/tools/chat-with-pdf` | `POST /api/pdf/chat` | `POST /api/v1/jobs` | Phase 4 | Interactive document Q&A engine |

---

## 3. PLANNED TOOLS (9 Tools — UI Configured / Engine Scheduled)

These tools are registered in `tools.ts` with valid UI routing and descriptions. Their backend engines will be built on the V1 Job Architecture in subsequent phases.

| # | Tool Name | Slug / Route | Target V1 Endpoint | Planned Engine | Target Phase | Description |
|---|---|---|---|---|---|---|
| 26 | **HTML to PDF** | `/tools/html-to-pdf` | `POST /api/v1/jobs` | `HtmlProcessor` | Phase 3 | Headless Chrome URL & HTML string renderer |
| 27 | **Scan to PDF** | `/tools/scan-to-pdf` | `POST /api/v1/jobs` | `ScanProcessor` | Phase 3 | Camera intake with perspective auto-correction |
| 28 | **Compare PDF** | `/tools/compare-pdf` | `POST /api/v1/jobs` | `CompareProcessor` | Phase 4 | Side-by-side visual difference & text diffing |
| 29 | **Redact PDF** | `/tools/redact-pdf` | `POST /api/v1/jobs` | `RedactProcessor` | Phase 5 | Irreversible stream-level text & vector data scrubbing |
| 30 | **Crop PDF** | `/tools/crop-pdf` | `POST /api/v1/jobs` | `CropProcessor` | Phase 5 | Visual bounding box cropping with page box updates |
| 31 | **PDF Forms** | `/tools/pdf-forms` | `POST /api/v1/jobs` | `FormsProcessor` | Phase 5 | Interactive AcroForm builder & field filling |
| 32 | **Translate PDF** | `/tools/translate-pdf` | `POST /api/v1/jobs` | `TranslateProcessor` | Phase 4 | AI multi-lingual document layout-preserving translation |
| 33 | **PDF to Markdown** | `/tools/pdf-to-markdown` | `POST /api/v1/jobs` | `MarkdownProcessor` | Phase 4 | Structured extraction to Markdown with tables |
| 34 | **PDF to PNG** | `/tools/pdf-to-png` | `POST /api/v1/jobs` | `PngProcessor` | Phase 3 | High-resolution alpha-channel transparent rasterization |

---

## Migration Architecture Rules

1. **Frontend Exclusivity**:
   All core PDF manipulation tools in `ToolWorkspace.tsx` use `uploadFileToV1()` and `createJob()`. Any attempt to call legacy endpoints for core tools is blocked by safety guards.
2. **Backward Compatibility**:
   Existing backend routes in `/api/pdf/*` and `/api/documents/*` remain operational with `X-API-Deprecated: true` headers. They must not be deleted until all non-core tools have been migrated in later phases.
3. **Phase-Gated Development**:
   Phase 1 focuses on core PDF stabilization. Phase 2 introduces full V1 Auth. Phase 3 & 4 will migrate the 12 legacy converters and implement planned tools.
