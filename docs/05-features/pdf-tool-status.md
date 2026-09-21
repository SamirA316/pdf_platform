# PDF Tool Status (Phase 0 Audit)

This document provides a 100% factual audit of all 34 tools registered in the QuickPDF platform based on inspection of `frontend/config/tools.ts`, `frontend/components/shared/ToolWorkspace.tsx`, `backend/src/routes/pdf.routes.ts`, and `backend/src/controllers/pdf.controller.ts`.

---

## Status Definitions

- **EXISTING**: Frontend route, backend controller, and processing implementation exist in code.
- **UNVERIFIED**: Implementation exists in code, but end-to-end functional verification (processing real files and asserting valid outputs) is pending.
- **AUDIT**: Complex client-side canvas/editor architecture (e.g., `EditConfig.tsx`) requiring dedicated audit and modular refactor (scheduled for Phase 5).

---

## Tool Mapping Table

| # | Tool | Frontend Slug | Frontend UI Component | API Route (Parameterized) | Controller Function | Processing Engine | Status |
|---|---|---|---|---|---|---|---|
| 1 | Merge PDF | `merge-pdf` | `MergeConfig` | `POST /api/pdf/merge` | `mergePDFs` | `pdf-lib` | UNVERIFIED |
| 2 | Split PDF | `split-pdf` | `SplitConfig` | `POST /api/pdf/split` | `splitPDF` | `pdf-lib` | UNVERIFIED |
| 3 | Compress PDF | `compress-pdf` | `CompressConfig` | `POST /api/pdf/compress` | `compressPDF` | `ghostscript` / `pdfCompressor` | UNVERIFIED |
| 4 | PDF to Word | `pdf-to-word` | `BasicConfig` | `POST /api/pdf/export/:slug` (`/pdf-to-word`) | `pdfToOffice` | `pdf-parse` + Word XML | UNVERIFIED |
| 5 | PDF to PowerPoint | `pdf-to-powerpoint` | `BasicConfig` | `POST /api/pdf/export/:slug` (`/pdf-to-powerpoint`) | `pdfToOffice` | `pdf-parse` + PPT XML | UNVERIFIED |
| 6 | PDF to Excel | `pdf-to-excel` | `BasicConfig` | `POST /api/pdf/export/:slug` (`/pdf-to-excel`) | `pdfToOffice` | `pdf-parse` + Spreadsheet | UNVERIFIED |
| 7 | Word to PDF | `word-to-pdf` | `BasicConfig` | `POST /api/pdf/convert-to-pdf` | `convertToPdf` | `libreoffice` / `pdf-lib` fallback | UNVERIFIED |
| 8 | PowerPoint to PDF | `powerpoint-to-pdf` | `BasicConfig` | `POST /api/pdf/convert-to-pdf` | `convertToPdf` | `libreoffice` / `pdf-lib` fallback | UNVERIFIED |
| 9 | Excel to PDF | `excel-to-pdf` | `BasicConfig` | `POST /api/pdf/convert-to-pdf` | `convertToPdf` | `libreoffice` / `pdf-lib` fallback | UNVERIFIED |
| 10 | Edit PDF | `edit-pdf` | `EditConfig` | `POST /api/pdf/ui/:slug` (`/edit-pdf`) | `advancedUiProcessor` | `pdfjs-dist` + Canvas + `pdf-lib` | AUDIT |
| 11 | PDF to JPG | `pdf-to-jpg` | `BasicConfig` | `POST /api/pdf/pdf-to-image/:slug` (`/pdf-to-jpg`) | `pdfToImage` | `puppeteer` + `pdf.js` canvas | UNVERIFIED |
| 12 | JPG to PDF | `jpg-to-pdf` | `BasicConfig` | `POST /api/pdf/image-to-pdf` | `imageToPDF` | `pdf-lib` + `sharp` | UNVERIFIED |
| 13 | Sign PDF | `sign-pdf` | `EditConfig` (Sign mode) | `POST /api/pdf/ui/:slug` (`/sign-pdf`) | `advancedUiProcessor` | Canvas signature + `pdf-lib` | AUDIT |
| 14 | Watermark PDF | `watermark` | `WatermarkConfig` | `POST /api/pdf/watermark` | `watermarkPDF` | `pdf-lib` | UNVERIFIED |
| 15 | Rotate PDF | `rotate-pdf` | `RotateConfig` | `POST /api/pdf/rotate` | `rotatePDF` | `pdf-lib` | UNVERIFIED |
| 16 | HTML to PDF | `html-to-pdf` | `BasicConfig` | `POST /api/pdf/html-to-pdf` | `htmlToPdf` | `puppeteer` headless Chromium | UNVERIFIED |
| 17 | Unlock PDF | `unlock-pdf` | `ProtectConfig` | `POST /api/pdf/unlock` | `unlockPDF` | `qpdf` CLI | UNVERIFIED |
| 18 | Protect PDF | `protect-pdf` | `ProtectConfig` | `POST /api/pdf/protect` | `protectPDF` | `qpdf` AES-256 | UNVERIFIED |
| 19 | Organize PDF | `organize-pdf` | `OrganizeConfig` | `POST /api/pdf/organize` | `organizePDF` | `pdf-lib` | UNVERIFIED |
| 20 | PDF to PDF/A | `pdf-to-pdfa` | `BasicConfig` | `POST /api/pdf/pdfa` | `pdfToPdfA` | `ghostscript` PDF/A-1b | UNVERIFIED |
| 21 | Repair PDF | `repair-pdf` | `BasicConfig` | `POST /api/pdf/repair` | `repairPdf` | `qpdf` / `ghostscript` | UNVERIFIED |
| 22 | Page Numbers | `page-numbers` | `BasicConfig` | `POST /api/pdf/page-numbers` | `pageNumbersPDF` | `pdf-lib` | UNVERIFIED |
| 23 | Scan to PDF | `scan-to-pdf` | `BasicConfig` | `POST /api/pdf/image-to-pdf` | `imageToPDF` | `pdf-lib` + `sharp` | UNVERIFIED |
| 24 | OCR PDF | `ocr-pdf` | `BasicConfig` | `POST /api/pdf/ocr` | `ocrPdf` | `tesseract.js` OCR engine | UNVERIFIED |
| 25 | Compare PDF | `compare-pdf` | `BasicConfig` | `POST /api/pdf/ui/:slug` (`/compare-pdf`) | `advancedUiProcessor` | Client side-by-side + canvas | UNVERIFIED |
| 26 | Redact PDF | `redact-pdf` | `BasicConfig` | `POST /api/pdf/ui/:slug` (`/redact-pdf`) | `advancedUiProcessor` | Client canvas redaction + `pdf-lib` | UNVERIFIED |
| 27 | Crop PDF | `crop-pdf` | `BasicConfig` | `POST /api/pdf/ui/:slug` (`/crop-pdf`) | `advancedUiProcessor` | Client crop boundary + `pdf-lib` | UNVERIFIED |
| 28 | PDF Forms | `pdf-forms` | `BasicConfig` | `POST /api/pdf/ui/:slug` (`/pdf-forms`) | `advancedUiProcessor` | Client form field overlay + `pdf-lib` | UNVERIFIED |
| 29 | AI Summarizer | `ai-summarizer` | `BasicConfig` | `POST /api/pdf/summarize` | `aiSummarize` | `pdf-parse` + `openai` GPT | UNVERIFIED |
| 30 | Translate PDF | `translate-pdf` | `BasicConfig` | `POST /api/pdf/translate` | `aiTranslate` | `pdf-parse` + `openai` GPT | UNVERIFIED |
| 31 | PDF to Markdown | `pdf-to-markdown` | `BasicConfig` | `POST /api/pdf/markdown` | `pdfToMarkdown` | `pdf-parse` AST / markdown writer | UNVERIFIED |
| 32 | Resize PDF | `resize-pdf` | `ResizeConfig` | `POST /api/pdf/resize` | `resizePDF` | `pdf-lib` PageSizes dimensions | UNVERIFIED |
| 33 | PDF to PNG | `pdf-to-png` | `BasicConfig` | `POST /api/pdf/pdf-to-image/:slug` (`/pdf-to-png`) | `pdfToImage` | `puppeteer` PNG renderer | UNVERIFIED |
| 34 | Chat with PDF | `chat-with-pdf` | `ChatConfig` | `POST /api/pdf/chat` | `chatWithPdf` | `pdf-parse` + `openai` Chat API | UNVERIFIED |

---

## Scope Boundary: PDF Platform vs. Image Platform

### In-Scope for PDF Platform:
PDF conversions involving images belong strictly to the PDF project scope:
- `JPG to PDF` (`jpg-to-pdf`): In-scope
- `PDF to JPG` (`pdf-to-jpg`): In-scope
- `PDF to PNG` (`pdf-to-png`): In-scope
- `Scan to PDF` (`scan-to-pdf`): In-scope

### Out-of-Scope (Separate Image Platform):
The existing files under `frontend/app/image-tools/` and dedicated image manipulation modules are retained in the repository to avoid breaking references, but are **excluded** from the PDF Platform scope:
- Image Resize ❌
- Background Remove ❌
- Passport Photo Maker ❌
- Image Editor ❌
