# Rotate PDF API Specification (Phase 4.3)

**Base URL**: `http://localhost:3001`  
**Authentication**: Required (Cookie-based JWT or `Authorization: Bearer <token>`)

---

## Overview
The Rotate PDF operation is an asynchronous background tool executing on the V1 Job Processing System (`/api/v1/jobs`). It accepts a single existing PDF file uploaded to `/api/v1/files`, validates user ownership and format, and rotates either the entire document or specified pages by discrete 90° intervals (90°, 180°, 270° clockwise), outputting a new rotated PDF file.

---

## 1. Create Rotate PDF Job

- **Endpoint**: `POST /api/v1/jobs`
- **Method**: `POST`
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <token>` or credentials cookie

### Request Payload Examples

#### Option A: Global Rotation (Rotate All Pages)
```json
{
  "tool": "rotate-pdf",
  "inputFileIds": ["cmubfile123"],
  "options": {
    "rotation": 90
  }
}
```

#### Option B: Selective Per-Page Rotation
```json
{
  "tool": "rotate-pdf",
  "inputFileIds": ["cmubfile123"],
  "options": {
    "rotations": [
      { "page": 1, "rotation": 90 },
      { "page": 3, "rotation": 270 }
    ]
  }
}
```

---

### Constraints & Validation Rules
1. **Tool Name**: Must be `"rotate-pdf"`.
2. **Input Count**: `inputFileIds` must contain exactly 1 file ID (`length === 1`).
3. **File Ownership**: The input file must belong to the authenticated user.
4. **File Status**: The input file must be in `READY` status.
5. **MIME Type**: Must be `application/pdf`.
6. **Rotation Angles**:
   - Supported clockwise angles: `90`, `180`, `270`.
   - Negative values (e.g. `-90`) are normalized to positive clockwise degrees (e.g. `270`).
   - Angles other than multiples of 90° are rejected with `INVALID_ROTATION_ANGLE`.
7. **Page Boundaries** (for `rotations`):
   - `page` must be an integer between `1` and `totalPages` (`PAGE_OUT_OF_BOUNDS`).

---

### Success Response (201 Created)
```json
{
  "success": true,
  "data": {
    "job": {
      "id": "cmubrot120001tle6yt6w9abc",
      "userId": "user_123",
      "tool": "rotate-pdf",
      "status": "QUEUED",
      "progress": 0,
      "inputFileIds": ["cmubfile123"],
      "outputFileId": null,
      "options": {
        "rotation": 90
      },
      "errorCode": null,
      "errorMessage": null,
      "startedAt": null,
      "completedAt": null,
      "expiresAt": null,
      "createdAt": "2026-09-22T01:10:00.000Z",
      "updatedAt": "2026-09-22T01:10:00.000Z"
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
      "id": "cmubrot120001tle6yt6w9abc",
      "tool": "rotate-pdf",
      "status": "COMPLETED",
      "progress": 100,
      "outputFileId": "cmubout010001tle6yt6w9rot",
      "outputFile": {
        "id": "cmubout010001tle6yt6w9rot",
        "originalName": "contract_rotated.pdf",
        "mimeType": "application/pdf",
        "size": 28410,
        "status": "READY",
        "createdAt": "2026-09-22T01:10:02.000Z",
        "updatedAt": "2026-09-22T01:10:02.000Z"
      },
      "options": {
        "rotation": 90,
        "metrics": {
          "totalPages": 3,
          "rotatedPagesCount": 3,
          "outputSize": 28410
        }
      },
      "completedAt": "2026-09-22T01:10:02.000Z"
    }
  }
}
```

---

## 3. Secure Download of Rotated PDF

- **Endpoint**: `GET /api/v1/files/:outputFileId/download`
- **Headers**: `Authorization: Bearer <token>` or credentials cookie
- **Response**: Binary PDF stream with Content-Disposition header:
  `Content-Disposition: attachment; filename="contract_rotated.pdf"`
