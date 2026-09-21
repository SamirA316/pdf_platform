# API v1 Architecture & Foundation (Phase 1)

## 1. Overview

Phase 1 establishes the unified, enterprise-grade `/api/v1` architecture for the QuickPDF platform. It introduces central routing, standardized response envelopes, centralized operational error handling, and 10 modular subsystem boundaries without breaking legacy `/api/` endpoints.

```
                    ┌────────────────────────────┐
                    │      Client Requests       │
                    └─────────────┬──────────────┘
                                  │
                                  ▼
                    ┌────────────────────────────┐
                    │   Express Server (:3001)   │
                    └─────────────┬──────────────┘
                                  │
         ┌────────────────────────┴────────────────────────┐
         │                                                 │
         ▼                                                 ▼
┌──────────────────┐                              ┌──────────────────┐
│   Legacy /api/   │                              │     /api/v1      │
│ (Preserved for   │                              │ (Central Router: │
│ backwards compat)│                              │ routes/index.ts) │
└──────────────────┘                              └────────┬─────────┘
                                                           │
       ┌──────────┬──────────┬──────────┬──────────┬───────┴──┬──────────┬──────────┬──────────┬──────────┐
       ▼          ▼          ▼          ▼          ▼          ▼          ▼          ▼          ▼          ▼
    /auth      /files     /jobs       /pdf     /editor     /ocr       /ai      /usage    /billing    /admin
```

---

## 2. Standard Response Contract

All `/api/v1` endpoints strictly adhere to the following JSON structure:

### 2.1 Success Response (`200 OK`, `201 Created`)
```json
{
  "success": true,
  "data": {
    "key": "value"
  }
}
```

### 2.2 Error Response (`4xx Client Error`, `5xx Server Error`)
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE_STRING",
    "message": "Human-readable description of error.",
    "details": null
  }
}
```

---

## 3. Central Error Handling Architecture

- **`AppError`** (`backend/src/common/errors/AppError.ts`):
  Base operational error class providing `statusCode`, `code`, `isOperational`, and optional `details`.
  Derived classes:
  - `BadRequestError` (400)
  - `UnauthorizedError` (401)
  - `ForbiddenError` (403)
  - `NotFoundError` (404)
  - `ConflictError` (409)
  - `PayloadTooLargeError` (413)

- **`errorMiddleware`** (`backend/src/middlewares/error.middleware.ts`):
  Global error catcher registered at the end of the Express middleware stack in `server.ts`. Automatically standardizes:
  - `AppError` instances
  - Multer upload limits (`LIMIT_FILE_SIZE` -> `FILE_TOO_LARGE`)
  - JSON parse/syntax errors (`INVALID_JSON`)
  - Extension & MIME validation errors
  - Unhandled exceptions (`INTERNAL_SERVER_ERROR` with HTTP 500)

---

## 4. Module Boundaries (`src/modules/`)

Phase 1 registers 10 modular boundaries under `backend/src/modules/`:

| Module | Route Prefix | Responsibility | Status | Implementation Phase |
|---|---|---|---|---|
| **Health** | `GET /api/v1/health` | Service uptime and heartbeat | **OPERATIONAL** | Phase 1 (Core) |
| **Auth** | `/api/v1/auth` | User registration, login, JWT, OTP | Foundation Ready | Phase 2 / Phase 8 |
| **Files** | `/api/v1/files` | File uploads, metadata, secure download streams | **OPERATIONAL** | Phase 2 (File Management) |
| **Jobs** | `/api/v1/jobs` | Async background tasks & status polling | **OPERATIONAL** | Phase 3 (Job System) |
| **PDF** | `/api/v1/pdf` | Core PDF manipulation (merge, split, compress, etc.) | Active (compress-pdf) / Pending Migration | Phase 4 (Core Engine) |
| **Editor** | `/api/v1/editor` | Canvas annotations, signatures, edit state | Foundation Ready | Phase 5 (Editor) |
| **OCR** | `/api/v1/ocr` | Optical character recognition & text extraction | Foundation Ready | Phase 7 (OCR Pipeline) |
| **AI** | `/api/v1/ai` | Document summarization, translation, chat | Foundation Ready | Phase 8 (AI Engine) |
| **Usage** | `/api/v1/usage` | User quota and tier rate limit tracking | Foundation Ready | Phase 9 (Rate Limiting) |
| **Billing** | `/api/v1/billing` | Subscription plans & payments | Foundation Ready | Phase 10 (Billing) |
| **Admin** | `/api/v1/admin` | System monitoring and administrative controls | Foundation Ready | Phase 11 (Admin) |

---

## 5. Backward Compatibility Layer

To prevent breaking existing tool workflows and frontend UI components, the legacy endpoints remain fully mounted and operational:
- `/api/auth/*`
- `/api/documents/*`
- `/api/pdf/*`
