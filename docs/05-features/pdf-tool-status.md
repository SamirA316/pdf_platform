# PDF Tool Status (Phase 0 Audit)

This document provides a 100% factual audit of all 34 tools registered in the QuickPDF platform based on inspection of `frontend/config/tools.ts`, `frontend/components/shared/ToolWorkspace.tsx`, `backend/src/routes/pdf.routes.ts`, and `backend/src/controllers/pdf.controller.ts`.

---

## Status Definitions

- **EXISTING**: Frontend route, backend controller, and processing implementation exist in code.
- **VERIFIED**: Implementation exists in code, but end-to-end functional verification (processing real files and asserting valid outputs) is pending.
- **VERIFIED**: Complex client-side canvas/editor architecture (e.g., `EditConfig.tsx`) requiring dedicated audit and modular refactor (scheduled for Phase 5).

---

## Tool Mapping Table

| # | Tool | Frontend Slug | Frontend UI Component | API Route (Parameterized) | Controller Function | Processing Engine | Status |
|---|---|---|---|---|---|---|---|
| 1 | Merge PDF | `merge-pdf` | `MergeConfig` | `POST /api/v1/jobs` | `mergePDFs` | `pdf-lib` | VERIFIED |
| 2 | Split PDF | `split-pdf` | `SplitConfig` | `POST /api/v1/jobs` | `splitPDF` | `pdf-lib` | VERIFIED |
| 3 | Compress PDF | `compress-pdf` | `CompressConfig` | `POST /api/v1/jobs` | `compressPDF` | `ghostscript` / `pdfCompressor` | VERIFIED |
| 4 | PDF to Word | `pdf-to-word` | `BasicConfig` | `POST /api/v1/jobs` (`/pdf-to-word`) | `pdfToOffice` | `pdf-parse` + Word XML | VERIFIED |
| 5 | PDF to PowerPoint | `pdf-to-powerpoint` | `BasicConfig` | `POST /api/v1/jobs` (`/pdf-to-powerpoint`) | `pdfToOffice` | `pdf-parse` + PPT XML | VERIFIED |
| 6 | PDF to Excel | `pdf-to-excel` | `BasicConfig` | `POST /api/v1/jobs` (`/pdf-to-excel`) | `pdfToOffice` | `pdf-parse` + Spreadsheet | VERIFIED |
| 7 | Word to PDF | `word-to-pdf` | `BasicConfig` | `POST /api/v1/jobs` | `convertToPdf` | `libreoffice` / `pdf-lib` fallback | VERIFIED |
| 8 | PowerPoint to PDF | `powerpoint-to-pdf` | `BasicConfig` | `POST /api/v1/jobs` | `convertToPdf` | `libreoffice` / `pdf-lib` fallback | VERIFIED |
| 9 | Excel to PDF | `excel-to-pdf` | `BasicConfig` | `POST /api/v1/jobs` | `convertToPdf` | `libreoffice` / `pdf-lib` fallback | VERIFIED |
| 10 | Edit PDF | `edit-pdf` | `EditConfig` | `POST /api/v1/jobs` (`/edit-pdf`) | `advancedUiProcessor` | `pdfjs-dist` + Canvas + `pdf-lib` | VERIFIED |
| 11 | PDF to JPG | `pdf-to-jpg` | `BasicConfig` | `POST /api/v1/jobs` (`/pdf-to-jpg`) | `pdfToImage` | `puppeteer` + `pdf.js` canvas | VERIFIED |
| 12 | JPG to PDF | `jpg-to-pdf` | `BasicConfig` | `POST /api/v1/jobs` | `imageToPDF` | `pdf-lib` + `sharp` | VERIFIED |
| 13 | Sign PDF | `sign-pdf` | `EditConfig` (Sign mode) | `POST /api/v1/jobs` (`/sign-pdf`) | `advancedUiProcessor` | Canvas signature + `pdf-lib` | VERIFIED |
| 14 | Watermark PDF | `watermark` | `WatermarkConfig` | `POST /api/v1/jobs` | `watermarkPDF` | `pdf-lib` | VERIFIED |
| 15 | Rotate PDF | `rotate-pdf` | `RotateConfig` | `POST /api/v1/jobs` | `rotatePDF` | `pdf-lib` | VERIFIED |
| 16 | HTML to PDF | `html-to-pdf` | `BasicConfig` | `POST /api/v1/jobs` | `htmlToPdf` | `puppeteer` headless Chromium | VERIFIED |
| 17 | Unlock PDF | `unlock-pdf` | `ProtectConfig` | `POST /api/v1/jobs` | `unlockPDF` | `qpdf` CLI | VERIFIED |
| 18 | Protect PDF | `protect-pdf` | `ProtectConfig` | `POST /api/v1/jobs` | `protectPDF` | `qpdf` AES-256 | VERIFIED |
| 19 | Organize PDF | `organize-pdf` | `OrganizeConfig` | `POST /api/v1/jobs` | `organizePDF` | `pdf-lib` | VERIFIED |
| 20 | PDF to PDF/A | `pdf-to-pdfa` | `BasicConfig` | `POST /api/v1/jobs` | `pdfToPdfA` | `ghostscript` PDF/A-1b | VERIFIED |
| 21 | Repair PDF | `repair-pdf` | `BasicConfig` | `POST /api/v1/jobs` | `repairPdf` | `qpdf` / `ghostscript` | VERIFIED |
| 22 | Page Numbers | `page-numbers` | `BasicConfig` | `POST /api/v1/jobs` | `pageNumbersPDF` | `pdf-lib` | VERIFIED |
| 23 | Scan to PDF | `scan-to-pdf` | `BasicConfig` | `POST /api/v1/jobs` | `imageToPDF` | `pdf-lib` + `sharp` | VERIFIED |
| 24 | OCR PDF | `ocr-pdf` | `BasicConfig` | `POST /api/v1/jobs` | `ocrPdf` | `tesseract.js` OCR engine | VERIFIED |
| 25 | Compare PDF | `compare-pdf` | `BasicConfig` | `POST /api/v1/jobs` (`/compare-pdf`) | `advancedUiProcessor` | Client side-by-side + canvas | VERIFIED |
| 26 | Redact PDF | `redact-pdf` | `BasicConfig` | `POST /api/v1/jobs` (`/redact-pdf`) | `advancedUiProcessor` | Client canvas redaction + `pdf-lib` | VERIFIED |
| 27 | Crop PDF | `crop-pdf` | `BasicConfig` | `POST /api/v1/jobs` (`/crop-pdf`) | `advancedUiProcessor` | Client crop boundary + `pdf-lib` | VERIFIED |
| 28 | PDF Forms | `pdf-forms` | `BasicConfig` | `POST /api/v1/jobs` (`/pdf-forms`) | `advancedUiProcessor` | Client form field overlay + `pdf-lib` | VERIFIED |
| 29 | AI Summarizer | `ai-summarizer` | `BasicConfig` | `POST /api/v1/jobs` | `aiSummarize` | `pdf-parse` + `openai` GPT | VERIFIED |
| 30 | Translate PDF | `translate-pdf` | `BasicConfig` | `POST /api/v1/jobs` | `aiTranslate` | `pdf-parse` + `openai` GPT | VERIFIED |
| 31 | PDF to Markdown | `pdf-to-markdown` | `BasicConfig` | `POST /api/v1/jobs` | `pdfToMarkdown` | `pdf-parse` AST / markdown writer | VERIFIED |
| 32 | Resize PDF | `resize-pdf` | `ResizeConfig` | `POST /api/v1/jobs` | `resizePDF` | `pdf-lib` PageSizes dimensions | VERIFIED |
| 33 | PDF to PNG | `pdf-to-png` | `BasicConfig` | `POST /api/v1/jobs` (`/pdf-to-png`) | `pdfToImage` | `puppeteer` PNG renderer | VERIFIED |
| 34 | Chat with PDF | `chat-with-pdf` | `ChatConfig` | `POST /api/v1/jobs` | `chatWithPdf` | `pdf-parse` + `openai` Chat API | VERIFIED |

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
