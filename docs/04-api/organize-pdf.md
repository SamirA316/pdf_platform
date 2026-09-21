# Organize PDF API Specification (Phase 4.4)

**Base URL**: `http://localhost:3001`  
**Authentication**: Required (Cookie-based JWT or `Authorization: Bearer <token>`)

---

## Overview
The Organize PDF operation is an asynchronous background tool executing on the V1 Job Processing System (`/api/v1/jobs`). It takes a single existing PDF file uploaded to `/api/v1/files`, validates user ownership and format, and constructs a new PDF based on user page instructions, supporting:
- Arbitrary page reordering
- Page extraction / deletion
- Page duplication
- Individual per-page rotation (0°, 90°, 180°, 270°)

---

## 1. Create Organize PDF Job

- **Endpoint**: `POST /api/v1/jobs`
- **Method**: `POST`
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <token>` or credentials cookie

### Request Payload Example
```json
{
  "tool": "organize-pdf",
  "inputFileIds": ["cmubfile123"],
  "options": {
    "pages": [
      { "sourcePage": 3, "rotation": 0 },
      { "sourcePage": 1, "rotation": 90 },
      { "sourcePage": 5, "rotation": 0 },
      { "sourcePage": 2, "rotation": 0 },
      { "sourcePage": 4, "rotation": 0 }
    ]
  }
}
```

*Note: `options.pages` also accepts shorthand array of numbers (e.g. `[3, 1, 5, 2, 4]`).*

---

### Constraints & Validation Rules
1. **Tool Name**: Must be `"organize-pdf"`.
2. **Input Count**: `inputFileIds` must contain exactly 1 file ID (`length === 1`).
3. **File Ownership**: The input file must belong to the authenticated user.
4. **File Status**: The input file must be in `READY` status.
5. **MIME Type**: Must be `application/pdf`.
6. **Pages Array**: Must be a non-empty array with `length <= 200` (`MAX_OUTPUT_PAGES_EXCEEDED`).
7. **Source Page**:
   - `sourcePage` must be an integer between `1` and `totalPages` (`PAGE_OUT_OF_BOUNDS`).
8. **Rotation**:
   - Optional, must be multiple of 90° (`0, 90, 180, 270`). Normalized clockwise.

---

### Success Response (201 Created)
```json
{
  "success": true,
  "data": {
    "job": {
      "id": "cmuborg120001tle6yt6w9abc",
      "userId": "user_123",
      "tool": "organize-pdf",
      "status": "QUEUED",
      "progress": 0,
      "inputFileIds": ["cmubfile123"],
      "outputFileId": null,
      "options": {
        "pages": [
          { "sourcePage": 3, "rotation": 0 },
          { "sourcePage": 1, "rotation": 90 }
        ]
      },
      "errorCode": null,
      "errorMessage": null,
      "startedAt": null,
      "completedAt": null,
      "expiresAt": null,
      "createdAt": "2026-09-22T01:30:00.000Z",
      "updatedAt": "2026-09-22T01:30:00.000Z"
    }
  }
}
```

---

## 2. Poll Job Status

- **Endpoint**: `GET /api/v1/jobs/:jobId`
- **Method**: `GET`
- **Headers**: `Authorization: Bearer <token>` or credentials cookie

### Completed Response (200 OK)
```json
{
  "success": true,
  "data": {
    "job": {
      "id": "cmuborg120001tle6yt6w9abc",
      "tool": "organize-pdf",
      "status": "COMPLETED",
      "progress": 100,
      "outputFileId": "cmubout010001tle6yt6w9org",
      "outputFile": {
        "id": "cmubout010001tle6yt6w9org",
        "originalName": "contract_organized.pdf",
        "mimeType": "application/pdf",
        "size": 34120,
        "status": "READY",
        "createdAt": "2026-09-22T01:30:02.000Z",
        "updatedAt": "2026-09-22T01:30:02.000Z"
      },
      "options": {
        "pages": [
          { "sourcePage": 3, "rotation": 0 },
          { "sourcePage": 1, "rotation": 90 }
        ],
        "metrics": {
          "inputPages": 5,
          "outputPages": 2,
          "outputSize": 34120
        }
      },
      "completedAt": "2026-09-22T01:30:02.000Z"
    }
  }
}
```

---

## 3. Secure Download of Organized PDF

- **Endpoint**: `GET /api/v1/files/:outputFileId/download`
- **Headers**: `Authorization: Bearer <token>` or credentials cookie
- **Response**: Binary PDF stream with Content-Disposition header:
  `Content-Disposition: attachment; filename="contract_organized.pdf"`
