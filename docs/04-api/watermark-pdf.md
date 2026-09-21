# Watermark PDF API Specification (Phase 4.6)

**Base URL**: `http://localhost:3001`  
**Authentication**: Required (Cookie-based JWT or `Authorization: Bearer <token>`)

---

## Overview
The Watermark PDF tool is an asynchronous background operation on the V1 Job Processing System (`/api/v1/jobs`). It takes a single input PDF file, validates user ownership, and stamps either a text or an image watermark with customizable opacity, rotation, and positioning onto all or selected pages.

Supported watermark types:
- **Text Watermark**: Custom text string, font size, hex color, rotation angle, opacity, and alignment.
- **Image Watermark**: Reference to a user-owned PNG/JPEG file (`imageFileId`), scale, rotation, opacity, and alignment.

---

## 1. Create Watermark PDF Job

- **Endpoint**: `POST /api/v1/jobs`
- **Method**: `POST`
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <token>` or credentials cookie

### Request Payload Examples

#### Text Watermark (All Pages, 45° Diagonal)
```json
{
  "tool": "watermark-pdf",
  "inputFileIds": ["cmubfile123"],
  "options": {
    "type": "text",
    "text": "CONFIDENTIAL",
    "fontSize": 40,
    "color": "#E5322D",
    "opacity": 0.35,
    "rotation": 45,
    "position": "center",
    "pages": "all"
  }
}
```

#### Text Watermark (Selected Pages, Top-Left)
```json
{
  "tool": "watermark-pdf",
  "inputFileIds": ["cmubfile123"],
  "options": {
    "type": "text",
    "text": "DRAFT",
    "fontSize": 24,
    "position": "top-left",
    "rotation": 0,
    "pages": [1, 3]
  }
}
```

#### Image Watermark (PNG/JPEG Stamp)
```json
{
  "tool": "watermark-pdf",
  "inputFileIds": ["cmubfile123"],
  "options": {
    "type": "image",
    "imageFileId": "cmubimg789",
    "scale": 0.8,
    "opacity": 0.5,
    "position": "center",
    "pages": "all"
  }
}
```

---

### Constraints & Validation Rules
1. **Tool Name**: Must be `"watermark-pdf"` (or alias `"watermark"`).
2. **Input Count**: `inputFileIds` must contain exactly 1 PDF file ID (`length === 1`).
3. **PDF File Verification**:
   - Must belong to the authenticated user.
   - Status must be `READY`.
   - MIME must be `application/pdf`.
4. **Watermark Type**: Must be `"text"` or `"image"`.
5. **Position**: Must be one of `["center", "top-left", "top-right", "bottom-left", "bottom-right"]`.
6. **Opacity**: Must be a number between `0.01` and `1.0`.
7. **Rotation**: Any numeric degree, normalized automatically to `0–359°`.
8. **Text Watermark Validation**:
   - `text`: Non-empty string, maximum 200 characters (`INVALID_WATERMARK_TEXT`).
   - `fontSize`: Integer between `6` and `200`.
9. **Image Watermark Validation**:
   - `imageFileId`: Required string referencing an existing user-owned file (`INVALID_WATERMARK_IMAGE`).
   - Image file status must be `READY`.
   - Image MIME must be `image/png`, `image/jpeg`, or `image/jpg` (`INVALID_MIME_TYPE`).
   - `scale`: Number between `0.05` and `5.0`.
10. **Pages**:
    - `"all"` or non-empty array of integer page numbers.
    - Out-of-bounds page numbers rejected with `PAGE_OUT_OF_BOUNDS`.

---

### Success Response (201 Created)
```json
{
  "success": true,
  "data": {
    "job": {
      "id": "cmubwtm120001tle6yt6w9abc",
      "userId": "user_123",
      "tool": "watermark-pdf",
      "status": "QUEUED",
      "progress": 0,
      "inputFileIds": ["cmubfile123"],
      "outputFileId": null,
      "options": {
        "type": "text",
        "text": "CONFIDENTIAL",
        "fontSize": 40,
        "opacity": 0.35,
        "rotation": 45,
        "position": "center",
        "pages": "all"
      },
      "createdAt": "2026-09-22T02:00:00.000Z"
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
      "id": "cmubwtm120001tle6yt6w9abc",
      "tool": "watermark-pdf",
      "status": "COMPLETED",
      "progress": 100,
      "outputFileId": "cmubfileout888",
      "outputFile": {
        "id": "cmubfileout888",
        "originalName": "contract_watermarked.pdf",
        "mimeType": "application/pdf",
        "size": 158920,
        "status": "READY",
        "createdAt": "2026-09-22T02:00:02.000Z"
      },
      "options": {
        "type": "text",
        "text": "CONFIDENTIAL",
        "metrics": {
          "totalPages": 3,
          "watermarkedPagesCount": 3,
          "type": "text",
          "position": "center",
          "outputSize": 158920
        }
      },
      "completedAt": "2026-09-22T02:00:02.300Z"
    }
  }
}
```

---

## 3. Error Codes

| Code | HTTP Status | Meaning |
| :--- | :--- | :--- |
| `INVALID_INPUT_FILE` | 400 | Missing input, multiple inputs, or wrong ownership |
| `INVALID_TOOL_OPTIONS` | 400 | Malformed options or out-of-range parameters |
| `INVALID_WATERMARK_TEXT` | 400 | Watermark text is empty or exceeds 200 characters |
| `INVALID_WATERMARK_IMAGE`| 400 | Image watermark is missing `imageFileId` |
| `INVALID_MIME_TYPE` | 400 | Referenced image file is not a valid PNG or JPEG |
| `PAGE_OUT_OF_BOUNDS` | 400 | Page number in `pages` array does not exist in the PDF |
| `PROCESSING_FAILED` | 500 | Watermark processor encountered an internal drawing error |
