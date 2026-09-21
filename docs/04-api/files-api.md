# Files API Specification (`/api/v1/files`)

**Base Route**: `/api/v1/files`  
**Authentication**: Required on all routes (`Cookie` or `Authorization: Bearer <token>`).

---

## 1. Upload File
- **Method**: `POST`
- **Endpoint**: `/api/v1/files`
- **Content-Type**: `multipart/form-data`
- **Field**: `file` (single file, max 100MB, PDF only)

### Success Response (`201 Created`):
```json
{
  "success": true,
  "data": {
    "file": {
      "id": "cmub376jz0001qafz2ij0nrgw",
      "originalName": "document.pdf",
      "mimeType": "application/pdf",
      "size": 245760,
      "status": "READY",
      "createdAt": "2026-09-21T10:13:02.064Z",
      "updatedAt": "2026-09-21T10:13:02.064Z"
    }
  }
}
```

---

## 2. List Files
- **Method**: `GET`
- **Endpoint**: `/api/v1/files`
- **Query Parameters**:
  - `page` (number, default: 1)
  - `limit` (number, default: 20, max: 100)
  - `status` (string, optional: e.g. `READY`)

### Success Response (`200 OK`):
```json
{
  "success": true,
  "data": {
    "files": [
      {
        "id": "cmub376jz0001qafz2ij0nrgw",
        "originalName": "document.pdf",
        "mimeType": "application/pdf",
        "size": 245760,
        "status": "READY",
        "createdAt": "2026-09-21T10:13:02.064Z",
        "updatedAt": "2026-09-21T10:13:02.064Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

---

## 3. Get Single File Metadata
- **Method**: `GET`
- **Endpoint**: `/api/v1/files/:id`

### Success Response (`200 OK`):
```json
{
  "success": true,
  "data": {
    "file": {
      "id": "cmub376jz0001qafz2ij0nrgw",
      "originalName": "document.pdf",
      "mimeType": "application/pdf",
      "size": 245760,
      "status": "READY",
      "createdAt": "2026-09-21T10:13:02.064Z",
      "updatedAt": "2026-09-21T10:13:02.064Z"
    }
  }
}
```

---

## 4. Secure File Download
- **Method**: `GET`
- **Endpoint**: `/api/v1/files/:id/download`
- **Response**: Binary PDF file stream with header:
  `Content-Disposition: attachment; filename="document.pdf"`

---

## 5. Rename File
- **Method**: `PATCH`
- **Endpoint**: `/api/v1/files/:id`
- **Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "name": "My Renamed Document.pdf"
  }
  ```

### Success Response (`200 OK`):
```json
{
  "success": true,
  "data": {
    "file": {
      "id": "cmub376jz0001qafz2ij0nrgw",
      "originalName": "My Renamed Document.pdf",
      "mimeType": "application/pdf",
      "size": 245760,
      "status": "READY",
      "createdAt": "2026-09-21T10:13:02.064Z",
      "updatedAt": "2026-09-21T10:15:30.120Z"
    }
  }
}
```

---

## 6. Delete File
- **Method**: `DELETE`
- **Endpoint**: `/api/v1/files/:id`

### Success Response (`200 OK`):
```json
{
  "success": true,
  "data": {
    "message": "File deleted successfully"
  }
}
```

---

## 7. Error Codes

| Code | HTTP Status | Meaning |
|---|---|---|
| `FILE_REQUIRED` | 400 | No file sent in the `file` multipart field |
| `INVALID_FILE` | 400 | File or upload parameter is malformed |
| `UNSUPPORTED_FORMAT` | 400 | File is not a valid PDF (extension or MIME mismatch) |
| `FILE_TOO_LARGE` | 400 | File exceeds the 100MB size limit |
| `FILE_NOT_FOUND` | 404 | File ID does not exist or belongs to another user |
| `FILE_ACCESS_DENIED` | 403 | User is not permitted to perform operation |
| `FILE_RENAME_INVALID` | 400 | Invalid, empty, or path-traversal filename requested |
| `FILE_UPLOAD_FAILED` | 500 | Storage failure during file upload write |
| `FILE_DELETE_FAILED` | 500 | Database or storage failure during file delete |
