# Merge PDF API Specification (Phase 4.1)

**Base URL**: `http://localhost:3001`  
**Authentication**: Required (Cookie-based JWT or `Authorization: Bearer <token>`)

---

## Overview
The Merge PDF operation is an asynchronous background tool executing on the V1 Job Processing System (`/api/v1/jobs`). It takes two or more existing PDF files uploaded to `/api/v1/files`, validates user ownership and format, and merges them in the exact sequential order provided by the client into a new output document.

---

## 1. Create Merge PDF Job

- **Endpoint**: `POST /api/v1/jobs`
- **Method**: `POST`
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <token>` or credentials cookie

### Request Payload
```json
{
  "tool": "merge-pdf",
  "inputFileIds": [
    "cmubluj9c000btle6zpgy7vns",
    "cmubluj9c000btle6zpgy7vnt",
    "cmubluj9c000btle6zpgy7vnu"
  ],
  "options": {
    "outputName": "combined-contract.pdf"
  }
}
```

### Constraints & Validation Rules
1. **Tool Name**: Must be `"merge-pdf"`.
2. **Input Count**: `inputFileIds` array must contain at least 2 distinct file IDs (`length >= 2`).
3. **Duplication**: Duplicate file IDs in `inputFileIds` are rejected (`INVALID_INPUT_FILE`).
4. **Ownership**: Every input file must belong to the authenticated user.
5. **File Status**: Every input file must be in `READY` status.
6. **MIME Type**: Every input file must be `application/pdf`.
7. **Sequence**: The pages of the merged PDF will strictly follow the order of `inputFileIds` provided.

### Success Response (201 Created)
```json
{
  "success": true,
  "data": {
    "job": {
      "id": "cmubluj920009tle6yt6w9tik",
      "userId": "user_123",
      "tool": "merge-pdf",
      "status": "QUEUED",
      "progress": 0,
      "inputFileIds": [
        "cmubluj9c000btle6zpgy7vns",
        "cmubluj9c000btle6zpgy7vnt"
      ],
      "outputFileId": null,
      "outputFile": null,
      "options": {
        "outputName": "combined-contract.pdf"
      },
      "errorCode": null,
      "errorMessage": null,
      "startedAt": null,
      "completedAt": null,
      "expiresAt": null,
      "createdAt": "2026-09-22T00:24:00.000Z",
      "updatedAt": "2026-09-22T00:24:00.000Z"
    }
  }
}
```

### Error Responses
- `400 Bad Request`:
  - `INVALID_TOOL`: Tool name is not supported or not recognized.
  - `INVALID_INPUT_FILE`:
    - Less than 2 input files provided (`"Tool 'merge-pdf' requires at least 2 input files."`).
    - Duplicate input file IDs provided (`"Duplicate input file IDs are not permitted."`).
    - Input file not owned by user or does not exist.
    - Input file not in `READY` status.
    - Input file is not a valid PDF (`mimeType !== "application/pdf"`).
- `401 Unauthorized`: User is not authenticated.

---

## 2. Poll Job Status

- **Endpoint**: `GET /api/v1/jobs/:jobId`
- **Method**: `GET`
- **Headers**: `Authorization: Bearer <token>` or credentials cookie

### In-Progress Response (200 OK)
```json
{
  "success": true,
  "data": {
    "job": {
      "id": "cmubluj920009tle6yt6w9tik",
      "tool": "merge-pdf",
      "status": "PROCESSING",
      "progress": 25,
      "outputFileId": null
    }
  }
}
```

### Completed Response (200 OK)
```json
{
  "success": true,
  "data": {
    "job": {
      "id": "cmubluj920009tle6yt6w9tik",
      "tool": "merge-pdf",
      "status": "COMPLETED",
      "progress": 100,
      "outputFileId": "cmubluj9c000btle6zpgy7vns",
      "options": {
        "outputName": "combined-contract.pdf",
        "metrics": {
          "pageCount": 4,
          "inputCount": 2,
          "outputSize": 254100
        }
      },
      "completedAt": "2026-09-22T00:24:02.000Z"
    }
  }
}
```

### Failure Response (200 OK)
```json
{
  "success": true,
  "data": {
    "job": {
      "id": "cmubluj920009tle6yt6w9tik",
      "tool": "merge-pdf",
      "status": "FAILED",
      "progress": 0,
      "errorCode": "PROCESSING_FAILED",
      "errorMessage": "We couldn't merge these PDFs. Please try again."
    }
  }
}
```

---

## 3. Secure Download of Merged PDF

- **Endpoint**: `GET /api/v1/files/:outputFileId/download`
- **Headers**: `Authorization: Bearer <token>` or credentials cookie
- **Response**: Binary PDF stream with HTTP header:
  `Content-Disposition: attachment; filename="combined-contract.pdf"`
