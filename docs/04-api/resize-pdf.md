# Resize PDF API Specification (Phase 4.5)

**Base URL**: `http://localhost:3001`  
**Authentication**: Required (Cookie-based JWT or `Authorization: Bearer <token>`)

---

## Overview
The Resize PDF operation is an asynchronous background tool executing on the V1 Job Processing System (`/api/v1/jobs`). It takes a single existing PDF file uploaded to `/api/v1/files`, validates user ownership and format, and scales/transforms the PDF pages to match target page dimensions without cropping existing content.

Supported formats:
- Standard Presets: `a3`, `a4`, `a5`, `letter`, `legal`
- Custom Dimensions: `width`, `height`, `unit` (`mm`, `inch`, `pt`)
- Orientations: `portrait`, `landscape`

---

## 1. Create Resize PDF Job

- **Endpoint**: `POST /api/v1/jobs`
- **Method**: `POST`
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <token>` or credentials cookie

### Request Payload Examples

#### Preset Size (e.g. A4 Portrait)
```json
{
  "tool": "resize-pdf",
  "inputFileIds": ["cmubfile123"],
  "options": {
    "size": "a4",
    "orientation": "portrait"
  }
}
```

#### Preset Size with Landscape Orientation (e.g. A3 Landscape)
```json
{
  "tool": "resize-pdf",
  "inputFileIds": ["cmubfile123"],
  "options": {
    "size": "a3",
    "orientation": "landscape"
  }
}
```

#### Custom Dimensions
```json
{
  "tool": "resize-pdf",
  "inputFileIds": ["cmubfile123"],
  "options": {
    "size": "custom",
    "width": 150,
    "height": 200,
    "unit": "mm",
    "orientation": "portrait"
  }
}
```

---

### Constraints & Validation Rules
1. **Tool Name**: Must be `"resize-pdf"`.
2. **Input Count**: `inputFileIds` must contain exactly 1 file ID (`length === 1`).
3. **File Ownership**: The input file must belong to the authenticated user.
4. **File Status**: The input file must be in `READY` status.
5. **MIME Type**: Must be `application/pdf`.
6. **Size**:
   - Must be one of `["a3", "a4", "a5", "letter", "legal", "custom"]` (case-insensitive).
7. **Orientation**:
   - Optional, defaults to `"portrait"`. Must be `"portrait"` or `"landscape"`.
8. **Custom Dimensions** (When `size === "custom"`):
   - `width` and `height` are required positive numbers (`width > 0`, `height > 0`).
   - `unit` optional, defaults to `"mm"`. Allowed: `"mm"`, `"inch"`, `"in"`, `"pt"`.
   - Dimension bounds: Minimum equivalent 10 pt, maximum equivalent 5000 pt.

---

### Success Response (201 Created)
```json
{
  "success": true,
  "data": {
    "job": {
      "id": "cmubres120001tle6yt6w9abc",
      "userId": "user_123",
      "tool": "resize-pdf",
      "status": "QUEUED",
      "progress": 0,
      "inputFileIds": ["cmubfile123"],
      "outputFileId": null,
      "options": {
        "size": "a4",
        "orientation": "portrait",
        "targetWidthPt": 595.28,
        "targetHeightPt": 841.89
      },
      "createdAt": "2026-09-22T01:50:00.000Z"
    }
  }
}
```

---

## 2. Poll Job Status

- **Endpoint**: `GET /api/v1/jobs/:jobId`
- **Method**: `GET`
- **Headers**:
  - `Authorization: Bearer <token>` or credentials cookie

### Completed Job Response (200 OK)
```json
{
  "success": true,
  "data": {
    "job": {
      "id": "cmubres120001tle6yt6w9abc",
      "tool": "resize-pdf",
      "status": "COMPLETED",
      "progress": 100,
      "outputFileId": "cmubfileout456",
      "outputFile": {
        "id": "cmubfileout456",
        "originalName": "document_resized_a4.pdf",
        "mimeType": "application/pdf",
        "size": 142589,
        "status": "READY",
        "createdAt": "2026-09-22T01:50:02.000Z"
      },
      "options": {
        "size": "a4",
        "orientation": "portrait",
        "metrics": {
          "totalPages": 3,
          "targetSize": "a4",
          "orientation": "portrait",
          "targetWidthPt": 595.28,
          "targetHeightPt": 841.89,
          "outputSize": 142589
        }
      },
      "completedAt": "2026-09-22T01:50:02.500Z"
    }
  }
}
```

---

## 3. Error Codes

| Code | HTTP Status | Meaning |
| :--- | :--- | :--- |
| `INVALID_INPUT_FILE` | 400 | Missing input, multiple inputs, or wrong ownership |
| `INVALID_TOOL_OPTIONS` | 400 | Missing required options or malformed payload |
| `INVALID_PAGE_SIZE` | 400 | Size is not in allowed presets |
| `INVALID_ORIENTATION` | 400 | Orientation is neither portrait nor landscape |
| `INVALID_DIMENSIONS` | 400 | Width or height is not positive or less than 10 pt |
| `OVERSIZED_DIMENSIONS`| 400 | Dimensions exceed 5000 pt equivalent |
| `INVALID_UNIT` | 400 | Unit is not mm, inch, or pt |
| `PROCESSING_FAILED` | 500 | Processor could not scale PDF document |
