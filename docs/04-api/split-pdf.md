# Split PDF API Specification (Phase 4.2)

**Base URL**: `http://localhost:3001`  
**Authentication**: Required (Cookie-based JWT or `Authorization: Bearer <token>`)

---

## Overview
The Split PDF operation is an asynchronous background tool executing on the V1 Job Processing System (`/api/v1/jobs`). It takes a single existing PDF file uploaded to `/api/v1/files`, validates user ownership, format, and page boundaries, and splits the document according to one of 3 supported modes:
1. **Mode A — `ranges`**: Extracts multiple custom page intervals into distinct output PDFs.
2. **Mode B — `pages`**: Extracts specific non-contiguous or contiguous pages into a single consolidated output PDF.
3. **Mode C — `every-page`**: Extracts each individual page into its own separate 1-page output PDF.

Each generated output PDF is stored as an independent `File` record linked to the parent `Job` via `jobId`, with metadata and download support.

---

## 1. Create Split PDF Job

- **Endpoint**: `POST /api/v1/jobs`
- **Method**: `POST`
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <token>` or credentials cookie

### Request Payload Examples

#### Mode A: Page Ranges
```json
{
  "tool": "split-pdf",
  "inputFileIds": ["cmubluj9c000btle6zpgy7vns"],
  "options": {
    "mode": "ranges",
    "ranges": [
      { "start": 1, "end": 3 },
      { "start": 4, "end": 7 }
    ]
  }
}
```

#### Mode B: Selected Pages
```json
{
  "tool": "split-pdf",
  "inputFileIds": ["cmubluj9c000btle6zpgy7vns"],
  "options": {
    "mode": "pages",
    "pages": [2, 5, 8]
  }
}
```

#### Mode C: Every Page Separately
```json
{
  "tool": "split-pdf",
  "inputFileIds": ["cmubluj9c000btle6zpgy7vns"],
  "options": {
    "mode": "every-page"
  }
}
```

---

### Constraints & Validation Rules
1. **Tool Name**: Must be `"split-pdf"`.
2. **Input Count**: `inputFileIds` must contain exactly 1 file ID (`length === 1`).
3. **File Ownership**: The input file must belong to the authenticated user.
4. **File Status**: The input file must be in `READY` status.
5. **MIME Type**: Input file must be `application/pdf`.
6. **Modes Supported**: Must be one of `"ranges"`, `"pages"`, or `"every-page"`.
7. **Range Validation** (`mode: "ranges"`):
   - `ranges` must be a non-empty array of objects containing `{ start, end }`.
   - `start` and `end` must be positive integers `>= 1`.
   - `end` must be `>= start` (inverted ranges rejected with `INVALID_PAGE_RANGE`).
   - `end` must be `<= totalPages` (out-of-bounds rejected with `PAGE_OUT_OF_BOUNDS`).
   - Ranges must not overlap (`OVERLAPPING_PAGE_RANGES`).
8. **Page Validation** (`mode: "pages"`):
   - `pages` must be a non-empty array of positive integers.
   - Each page must satisfy `1 <= page <= totalPages` (`PAGE_OUT_OF_BOUNDS`).
   - Duplicate page numbers are rejected (`DUPLICATE_PAGE`).

---

### Success Response (201 Created)
```json
{
  "success": true,
  "data": {
    "job": {
      "id": "cmubxyz120001tle6yt6w9abc",
      "userId": "user_123",
      "tool": "split-pdf",
      "status": "QUEUED",
      "progress": 0,
      "inputFileIds": ["cmubluj9c000btle6zpgy7vns"],
      "outputFileId": null,
      "outputFile": null,
      "outputFiles": [],
      "options": {
        "mode": "ranges",
        "ranges": [{ "start": 1, "end": 3 }]
      },
      "errorCode": null,
      "errorMessage": null,
      "startedAt": null,
      "completedAt": null,
      "expiresAt": null,
      "createdAt": "2026-09-22T00:30:00.000Z",
      "updatedAt": "2026-09-22T00:30:00.000Z"
    }
  }
}
```

---

## 2. Poll Job Status

- **Endpoint**: `GET /api/v1/jobs/:jobId`
- **Method**: `GET`
- **Headers**: `Authorization: Bearer <token>` or credentials cookie

### Completed Response with Multiple Output Files (200 OK)
```json
{
  "success": true,
  "data": {
    "job": {
      "id": "cmubxyz120001tle6yt6w9abc",
      "tool": "split-pdf",
      "status": "COMPLETED",
      "progress": 100,
      "outputFileId": "cmubout010001tle6yt6w9aaa",
      "outputFiles": [
        {
          "id": "cmubout010001tle6yt6w9aaa",
          "originalName": "document_1-3.pdf",
          "mimeType": "application/pdf",
          "size": 14220,
          "status": "READY",
          "createdAt": "2026-09-22T00:30:02.000Z",
          "updatedAt": "2026-09-22T00:30:02.000Z"
        },
        {
          "id": "cmubout020002tle6yt6w9bbb",
          "originalName": "document_4-7.pdf",
          "mimeType": "application/pdf",
          "size": 18910,
          "status": "READY",
          "createdAt": "2026-09-22T00:30:02.000Z",
          "updatedAt": "2026-09-22T00:30:02.000Z"
        }
      ],
      "options": {
        "mode": "ranges",
        "ranges": [
          { "start": 1, "end": 3 },
          { "start": 4, "end": 7 }
        ],
        "metrics": {
          "inputPages": 7,
          "outputFileCount": 2,
          "totalOutputBytes": 33130
        }
      },
      "completedAt": "2026-09-22T00:30:02.000Z"
    }
  }
}
```

---

## 3. Secure Download of Split PDFs

Each output file can be downloaded individually via the standard file download endpoint:
- **Endpoint**: `GET /api/v1/files/:outputFileId/download`
- **Headers**: `Authorization: Bearer <token>` or credentials cookie
- **Response**: Binary PDF stream with Content-Disposition header:
  `Content-Disposition: attachment; filename="document_1-3.pdf"`
