# Page Numbers API Specification (Phase 4.7)

**Base URL**: `http://localhost:3001`  
**Authentication**: Required (Cookie-based JWT or `Authorization: Bearer <token>`)

---

## Overview
The Page Numbers PDF operation is an asynchronous background tool on the V1 Job Processing System (`/api/v1/jobs`). It takes a single input PDF file, validates user ownership, and stamps formatted page numbers at the user-specified position (e.g., bottom-center, top-right).

---

## 1. Create Page Numbers Job

- **Endpoint**: `POST /api/v1/jobs`
- **Method**: `POST`
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <token>` or credentials cookie

### Request Payload Examples

#### Default Formatting (Bottom Center, "Page {n} / {total}")
```json
{
  "tool": "page-numbers",
  "inputFileIds": ["cmubfile123"],
  "options": {
    "position": "bottom-center",
    "startNumber": 1,
    "fontSize": 12,
    "format": "Page {n} / {total}"
  }
}
```

#### Custom Top-Right Header (Skip First Page)
```json
{
  "tool": "page-numbers",
  "inputFileIds": ["cmubfile123"],
  "options": {
    "position": "top-right",
    "startNumber": 1,
    "fontSize": 10,
    "format": "{n} of {total}",
    "pages": [2, 3, 4, 5]
  }
}
```

---

### Constraints & Validation Rules
1. **Tool Name**: Must be `"page-numbers"` (or alias `"add-page-numbers"`).
2. **Input Count**: Exactly 1 PDF file ID (`length === 1`).
3. **File Ownership**: Belongs to authenticated user.
4. **File Status**: Must be `READY`.
5. **MIME Type**: Must be `application/pdf`.
6. **Position**: Must be one of `["bottom-center", "bottom-left", "bottom-right", "top-center", "top-left", "top-right"]`.
7. **Start Number**: Must be an integer `>= 1` (`INVALID_START_NUMBER`).
8. **Font Size**: Must be an integer between `6` and `48` pt.
9. **Margin**: Must be a number between `5` and `150` pt.
10. **Format**: Template string with `{n}` and/or `{total}` placeholders (max 50 chars).
11. **Pages**: `"all"` or non-empty array of page numbers within `1 <= page <= totalPages` (`PAGE_OUT_OF_BOUNDS`).

---

### Success Response (201 Created)
```json
{
  "success": true,
  "data": {
    "job": {
      "id": "cmubpgn120001tle6yt6w9abc",
      "userId": "user_123",
      "tool": "page-numbers",
      "status": "QUEUED",
      "progress": 0,
      "inputFileIds": ["cmubfile123"],
      "outputFileId": null,
      "options": {
        "position": "bottom-center",
        "startNumber": 1,
        "fontSize": 12,
        "format": "Page {n} / {total}",
        "pages": "all"
      },
      "createdAt": "2026-09-22T02:05:00.000Z"
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
      "id": "cmubpgn120001tle6yt6w9abc",
      "tool": "page-numbers",
      "status": "COMPLETED",
      "progress": 100,
      "outputFileId": "cmubfileout999",
      "outputFile": {
        "id": "cmubfileout999",
        "originalName": "document_numbered.pdf",
        "mimeType": "application/pdf",
        "size": 134210,
        "status": "READY",
        "createdAt": "2026-09-22T02:05:02.000Z"
      },
      "options": {
        "position": "bottom-center",
        "startNumber": 1,
        "metrics": {
          "totalPages": 4,
          "numberedPagesCount": 4,
          "position": "bottom-center",
          "startNumber": 1,
          "format": "Page {n} / {total}",
          "outputSize": 134210
        }
      },
      "completedAt": "2026-09-22T02:05:02.300Z"
    }
  }
}
```

---

## 3. Error Codes

| Code | HTTP Status | Meaning |
| :--- | :--- | :--- |
| `INVALID_INPUT_FILE` | 400 | Missing input, multiple inputs, or wrong ownership |
| `INVALID_TOOL_OPTIONS` | 400 | Malformed options or unsupported position |
| `INVALID_START_NUMBER` | 400 | Starting page number is less than 1 or non-integer |
| `PAGE_OUT_OF_BOUNDS` | 400 | Page number in `pages` array does not exist in the PDF |
| `PROCESSING_FAILED` | 500 | Processor encountered an internal error while numbering |
