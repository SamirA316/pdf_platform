# API Architecture & Current API Map

**Base URL**: `http://localhost:3001`  
**Authentication**: Cookie-based JWT (`token` cookie) or Guest User (`GUEST_USER_ID`) fallback.

---

## 1. API Architecture & Versioning

### Current API (`/api/v1`)
The primary, forward-looking API surface built on a clean modular architecture:
- Health check: `GET /api/v1/health`
- Standard response envelope: `{ "success": true, "data": {} }`
- Standard error envelope: `{ "success": false, "error": { "code": "...", "message": "..." } }`
- 10 Module routers: `/auth`, `/files`, `/jobs`, `/pdf`, `/editor`, `/ocr`, `/ai`, `/usage`, `/billing`, `/admin`

### Active Operational Modules (`/api/v1`)
- **`/api/v1/files` (Phase 2 - OPERATIONAL ✅)**: Complete secure file lifecycle with user isolation, ownership verification, and physical storage.

| Method | Endpoint | Description | Auth Required | Request Payload | Response Data | Error Codes |
|---|---|---|---|---|---|---|
| `POST` | `/api/v1/files` | Upload single PDF | Yes (Strict) | Multipart `file` (Max 100MB) | `{ file: IFileDto }` | `FILE_REQUIRED`, `UNSUPPORTED_FORMAT`, `FILE_TOO_LARGE` |
| `GET` | `/api/v1/files` | List authenticated user files | Yes (Strict) | Query `?page=1&limit=20` | `{ files: IFileDto[], pagination: { ... } }` | `UNAUTHORIZED` |
| `GET` | `/api/v1/files/:id` | Get single file metadata | Yes (Strict) | None | `{ file: IFileDto }` | `FILE_NOT_FOUND`, `UNAUTHORIZED` |
| `GET` | `/api/v1/files/:id/download` | Secure streaming download | Yes (Strict) | None | Binary PDF stream (`Content-Disposition`) | `FILE_NOT_FOUND`, `UNAUTHORIZED` |
| `PATCH` | `/api/v1/files/:id` | Rename original document | Yes (Strict) | JSON `{ name: string }` | `{ file: IFileDto }` | `FILE_RENAME_INVALID`, `FILE_NOT_FOUND` |
| `DELETE` | `/api/v1/files/:id` | Delete DB record & disk file | Yes (Strict) | None | `{ message: string }` | `FILE_NOT_FOUND`, `FILE_DELETE_FAILED` |

- **`/api/v1/jobs` (Phase 3 & Phase 4.1 - OPERATIONAL ✅)**: Asynchronous PDF processing state machine (`QUEUED` ➔ `PROCESSING` ➔ `COMPLETED` / `FAILED` / `CANCELLED`) with atomic concurrency control, file cleanup, and active processors for `compress-pdf` (Phase 3) and `merge-pdf` (Phase 4.1).

| Method | Endpoint | Description | Auth Required | Request Payload | Response Data | Error Codes |
|---|---|---|---|---|---|---|
| `POST` | `/api/v1/jobs` | Create processing job | Yes (Strict) | JSON `{ tool, inputFileIds, options? }` | `{ job: IJobDto }` | `INVALID_TOOL`, `INVALID_INPUT_FILE`, `UNAUTHORIZED` |
| `GET` | `/api/v1/jobs` | List user jobs | Yes (Strict) | Query `?page=1&limit=20&status=&tool=` | `{ jobs: IJobDto[], pagination: { ... } }` | `UNAUTHORIZED` |
| `GET` | `/api/v1/jobs/:jobId` | Get job status & progress | Yes (Strict) | None | `{ job: IJobDto }` | `JOB_NOT_FOUND`, `JOB_ACCESS_DENIED` |
| `POST` | `/api/v1/jobs/:jobId/cancel` | Cancel active job | Yes (Strict) | None | `{ job: IJobDto }` | `JOB_NOT_FOUND`, `INVALID_JOB_STATUS` |
| `DELETE` | `/api/v1/jobs/:jobId` | Delete job from history | Yes (Strict) | None | `{ message: string }` | `JOB_NOT_FOUND`, `INVALID_JOB_STATUS` |

> [!NOTE]
> **Sequential Modernization Plan**:
> - **Phase 1**: API v1 Architecture & Foundation (COMPLETE ✅)
> - **Phase 2**: File Management (`/api/v1/files`) (COMPLETE ✅)
> - **Phase 3**: Job Processing System (`/api/v1/jobs`) (COMPLETE ✅)
> - **Phase 4**: PDF Core Tools Migration (`/api/v1/jobs`):
>   - **Phase 4.1**: Merge PDF (`merge-pdf`) (COMPLETE ✅)
>   - **Phase 4.2**: Split PDF (`split-pdf`) (NEXT)
>   - **Phase 4.3**: Rotate PDF (`rotate-pdf`)
>   - **Phase 4.4**: Organize PDF (`organize-pdf`)
> - **Phase 5**: Editor & Annotations (`/api/v1/editor`)
> - **Phase 6**: Office & Conversions
> - **Phase 7**: OCR Pipeline (`/api/v1/ocr`)
> - **Phase 8**: AI Services (`/api/v1/ai`)
> - **Phase 9**: Usage & Rate Limiting (`/api/v1/usage`)
> - **Phase 10**: Billing & Subscriptions (`/api/v1/billing`)
> - **Phase 11**: Admin & System Controls (`/api/v1/admin`)

### Legacy API (`/api/*`)
- `/api/auth`
- `/api/documents`
- `/api/pdf`

> [!WARNING]
> **Legacy API Compatibility Policy**:  
> Legacy routes are temporarily maintained strictly for backward compatibility with the existing frontend application.  
> **No new functionality should be added to legacy routes.** All new development must target `/api/v1`.  
> Legacy routes will be deprecated and removed module-by-module as their `/api/v1` replacements become operational.

---

## 2. Legacy Authentication Routes (`/api/auth`)

| Method | Endpoint | Description | Auth Required | Request Payload | Response | Notes |
|---|---|---|---|---|---|---|
| `POST` | `/api/auth/register` | Register new user & send OTP email | No | `{ name, email, password }` | `{ message, userId }` | |
| `POST` | `/api/auth/verify-otp` | Verify OTP and set JWT cookie | No | `{ email, otp }` | `{ user: { id, name, email } }` | |
| `POST` | `/api/auth/login` | Log in with email and password | No | `{ email, password }` | `{ user: { id, name, email } }` | |
| `GET` | `/api/auth/me` | Fetch authenticated user profile | Yes (Strict) | None | `{ user: { id, name, email } }` | |
| `POST` | `/api/auth/logout` | Clear JWT auth cookie | No | None | `{ message: "Logged out successfully" }` | |
| `GET` | `/api/auth/google` | Initiate Google OAuth login | No | None | Redirects to OAuth provider / mock | Falls back to mock if credentials missing |
| `GET` | `/api/auth/google/callback` | OAuth callback handler | No | Query params | Sets cookie & redirects to `/` | |
| `GET` | `/api/auth/facebook` | Initiate Facebook OAuth login | No | None | Redirects to OAuth provider / mock | Falls back to mock if credentials missing |
| `GET` | `/api/auth/apple` | Initiate Apple OAuth login | No | None | Redirects to OAuth provider / mock | Falls back to mock if credentials missing |
| `GET` | `/api/auth/mock/:provider` | Simulated OAuth login | No | URL param `:provider` | Sets JWT cookie & redirects | **DEVELOPMENT ONLY** (Removed in Production) |

> [!NOTE]
> **DEVELOPMENT ONLY — Mock OAuth**:  
> `router.get("/mock/:provider", mockOAuthLogin)` and mock redirects are active solely because production OAuth credentials (client IDs & secrets) are not yet provisioned. This is marked as technical debt and will be strictly removed during the Production Hardening Phase.

---

## 3. Legacy Document Routes (`/api/documents`)

| Method | Endpoint | Description | Auth Required | Request Payload | Response |
|---|---|---|---|---|---|
| `GET` | `/api/documents` | List user's processed documents | Yes | None | `{ documents: Document[] }` |
| `GET` | `/api/documents/download/:id` | Download a processed document | Yes | URL param `:id` | Binary file stream with `Content-Disposition` |
| `DELETE` | `/api/documents/:id` | Delete document record and disk file | Yes | URL param `:id` | `{ message: "Document deleted successfully" }` |
| `POST` | `/api/documents/upload` | Upload a raw document (Max 100MB) | Yes | Multipart FormData (`file`) | `{ message, document }` |

> [!IMPORTANT]
> **Security Update (Phase 0)**:  
> Public direct static access to `./uploads` (`app.use("/uploads", express.static(...))`) has been removed from `server.ts`. All document downloads are securely mediated through authenticated `/api/documents/download/:id` streams.

---

## 4. Legacy PDF Processing Routes (`/api/pdf`)

> [!NOTE]
> **Current Technical Debt — `uploadMiddleware.any()`**:  
> All legacy PDF processing routes currently use `flexibleUpload`, which wraps `uploadMiddleware.any()`. This permits any multipart field name (`file`, `files`, `custom`, etc.) and normalizes `req.file` / `req.files`. This is intentionally preserved for backward compatibility. Tool-specific multipart field validation will replace this under `/api/v1/files` and `/api/v1/pdf`.

| Method | Endpoint | Controller Action | Engine | Request Payload | Success Response | Status |
|---|---|---|---|---|---|---|
| `POST` | `/api/pdf/merge` | `mergePDFs` | `pdf-lib` | FormData (`files`: 2+ PDFs) | `{ message, document }` | UNVERIFIED |
| `POST` | `/api/pdf/split` | `splitPDF` | `pdf-lib` | FormData (`file`, `range` / `pages`) | `{ message, document }` | UNVERIFIED |
| `POST` | `/api/pdf/compress` | `compressPDF` | `ghostscript` / `pdfCompressor` | FormData (`file`, `level`) | `{ message, document, savedPercentage, savedBytes }` | UNVERIFIED |
| `POST` | `/api/pdf/rotate` | `rotatePDF` | `pdf-lib` | FormData (`file`, `rotation`) | `{ message, document }` | UNVERIFIED |
| `POST` | `/api/pdf/organize` | `organizePDF` | `pdf-lib` | FormData (`file`, `order`) | `{ message, document }` | UNVERIFIED |
| `POST` | `/api/pdf/watermark` | `watermarkPDF` | `pdf-lib` | FormData (`file`, `text`, `opacity`) | `{ message, document }` | UNVERIFIED |
| `POST` | `/api/pdf/page-numbers` | `pageNumbersPDF` | `pdf-lib` | FormData (`file`, `position`, `format`) | `{ message, document }` | UNVERIFIED |
| `POST` | `/api/pdf/image-to-pdf` | `imageToPDF` | `pdf-lib` + `sharp` | FormData (`files`: JPG, PNG, WebP) | `{ message, document }` | UNVERIFIED |
| `POST` | `/api/pdf/jpg-to-pdf` | `imageToPDF` | `pdf-lib` + `sharp` | FormData (`files`: JPG, PNG) | `{ message, document }` | UNVERIFIED |
| `POST` | `/api/pdf/pdf-to-image/:slug`* | `pdfToImage` | `puppeteer` + `pdfjsLib` | FormData (`file`: PDF) | `{ message, document, documents, totalPages }` | UNVERIFIED |
| `POST` | `/api/pdf/resize` | `resizePDF` | `pdf-lib` | FormData (`file`, `pageSize`) | `{ message, document }` | UNVERIFIED |
| `POST` | `/api/pdf/protect` | `protectPDF` | `qpdf` | FormData (`file`, `password`) | `{ message, document }` | UNVERIFIED |
| `POST` | `/api/pdf/unlock` | `unlockPDF` | `qpdf` | FormData (`file`, `password`) | `{ message, document }` | UNVERIFIED |
| `POST` | `/api/pdf/summarize` | `aiSummarize` | `openai` | FormData (`file`: PDF) | `{ message, document }` | UNVERIFIED |
| `POST` | `/api/pdf/translate` | `aiTranslate` | `openai` | FormData (`file`: PDF, `targetLang`) | `{ message, document }` | UNVERIFIED |
| `POST` | `/api/pdf/chat` | `chatWithPdf` | `openai` | FormData (`file`, `message`, `history`) | `{ message, reply, history }` | UNVERIFIED |
| `POST` | `/api/pdf/convert-to-pdf` | `convertToPdf` | `libreoffice` / `pdf-lib` | FormData (`file`: DOC, XLS, PPT) | `{ message, document }` | UNVERIFIED |
| `POST` | `/api/pdf/repair` | `repairPdf` | `qpdf` / `ghostscript` | FormData (`file`: Corrupt PDF) | `{ message, document }` | UNVERIFIED |
| `POST` | `/api/pdf/pdfa` | `pdfToPdfA` | `ghostscript` | FormData (`file`: PDF) | `{ message, document }` | UNVERIFIED |
| `POST` | `/api/pdf/markdown` | `pdfToMarkdown` | `pdf-parse` | FormData (`file`: PDF) | `{ message, document }` | UNVERIFIED |
| `POST` | `/api/pdf/html-to-pdf` | `htmlToPdf` | `puppeteer` | FormData (`file`: HTML or `url`) | `{ message, document }` | UNVERIFIED |
| `POST` | `/api/pdf/ocr` | `ocrPdf` | `tesseract.js` | FormData (`file`: PDF / Scanned) | `{ message, document, text }` | UNVERIFIED |
| `POST` | `/api/pdf/ocr-crop` | `ocrCrop` | `sharp` + `tesseract.js` | FormData (`file`, `cropBox`) | `{ message, text }` | UNVERIFIED |
| `POST` | `/api/pdf/export/:slug`** | `pdfToOffice` | `pdf-parse` + Office formatters | FormData (`file`: PDF) | `{ message, document }` | UNVERIFIED |
| `POST` | `/api/pdf/ui/:slug`*** | `advancedUiProcessor`| Client-compiled PDF receiver | FormData (`file`: Edited PDF) | `{ message, document }` | AUDIT / UNVERIFIED |

### Parameterized Route Slugs Breakdown:

- **`POST /api/pdf/export/:slug`** handles PDF export to office formats:
  - `POST /api/pdf/export/pdf-to-word` (Converts PDF to Word `.docx`)
  - `POST /api/pdf/export/pdf-to-excel` (Converts PDF to Excel `.xlsx`)
  - `POST /api/pdf/export/pdf-to-powerpoint` (Converts PDF to PowerPoint `.pptx`)

- **`POST /api/pdf/pdf-to-image/:slug`** handles rendering PDF pages into images:
  - `POST /api/pdf/pdf-to-image/pdf-to-jpg`
  - `POST /api/pdf/pdf-to-image/pdf-to-png`

- **`POST /api/pdf/ui/:slug`** receives client-rendered / canvas-processed PDFs:
  - `POST /api/pdf/ui/edit-pdf`
  - `POST /api/pdf/ui/sign-pdf`
  - `POST /api/pdf/ui/compare-pdf`
  - `POST /api/pdf/ui/redact-pdf`
  - `POST /api/pdf/ui/crop-pdf`
  - `POST /api/pdf/ui/pdf-forms`

---

## 5. Fallback & Validation Error Contract

### 5.1 Unrecognized Tool Fallback
If any client sends a request to an unrecognized tool endpoint (`POST /api/pdf/:slug`), the API responds with **HTTP 404**:
```json
{
  "error": "TOOL_NOT_FOUND",
  "message": "Tool endpoint '/api/pdf/<slug>' not found or unsupported."
}
```

### 5.2 File Upload Validation Contract (HTTP 400)
- **Unsupported Extension**:
  ```json
  {
    "error": "UPLOAD_VALIDATION_ERROR",
    "message": "INVALID_EXTENSION: File extension '.exe' is not supported. Allowed: PDF, Images, Office & Text documents."
  }
  ```
- **Oversized File (>100MB)**:
  ```json
  {
    "error": "FILE_TOO_LARGE",
    "message": "File exceeds the 100MB size limit."
  }
  ```

### 5.3 Upload Validation Audit: Current Limitations vs Planned
- **Current**: Extension + MIME allowlist checking.
- **Known Limitation**: Because extension check occurs first, `!ALLOWED_MIME_TYPES.has(mime) && !ALLOWED_EXTENSIONS.has(ext)` currently permits an upload if the extension is valid (e.g. `document.pdf`) even if the MIME type is invalid or generic (`application/octet-stream`).
- **Planned**: True magic-byte signature inspection in the Security Phase.
