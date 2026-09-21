# PDF Platform - API Documentation

**Base URL**: `http://localhost:3001`  
**Authentication**: HTTP-only cookie (`token`) or Strict Bearer token. All browser requests must specify `credentials: 'include'`.

> [!NOTE]
> ### 🚀 API v1 Modern Endpoints (CURRENT ARCHITECTURE)
> Complete architectural blueprints, contracts, and flow diagrams are located in the `/docs/04-api/` directory:
> - **Health Check**: `GET /api/v1/health` (Operational)
> - **File Management API**: `/api/v1/files` (Phase 2 - Operational ✅) — See [`docs/04-api/files-api.md`](../docs/04-api/files-api.md)
> - **Job Processing API**: `/api/v1/jobs` (Phase 3 - Operational ✅) — See [`docs/04-api/jobs.md`](../docs/04-api/jobs.md)
> - **Sequential Modernization Map**: See [`docs/04-api/current-api-map.md`](../docs/04-api/current-api-map.md)
>
> | V1 Module | Path | Status | Methods | Description |
> |---|---|---|---|---|
> | **Files** | `/api/v1/files` | **OPERATIONAL ✅** | `POST`, `GET`, `PATCH`, `DELETE` | Secure file upload, storage, user isolation, metadata, streaming download |
> | **Jobs** | `/api/v1/jobs` | **OPERATIONAL ✅** | `POST`, `GET`, `DELETE` | Asynchronous PDF processing state machine (`QUEUED` ➔ `PROCESSING` ➔ `COMPLETED` / `FAILED` / `CANCELLED`) |

> [!WARNING]
> ### ⚠️ Legacy Endpoints (`/api/auth`, `/api/pdf`, `/api/documents`)
> The sections documented below represent legacy routes preserved strictly for backward compatibility with existing frontend tools.  
> These routes will be migrated to `/api/v1` module-by-module (Phase 4: Core PDF Tools migration). Do NOT add new functionality to these legacy endpoints.

---

## Legacy Authentication API Documentation

**Important Note for Frontend Team:** 
All requests must include `credentials: 'include'` in the fetch/axios configuration. The backend uses HTTP-only cookies (`token`) for secure session management. Without this flag, the session will not persist and subsequent requests to `/me` will fail.

---

## 1. User Registration (Step 1)
Creates a new account and sends a 6-digit OTP to the user's email.

- **Endpoint:** `/api/auth/register`
- **Method:** `POST`
- **Headers:** `Content-Type: application/json`

### Request Body
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "strongpassword123"
}
```

### Success Response (201 Created)
```json
{
  "message": "OTP sent to your email",
  "userId": "uuid-string-here"
}
```

### Error Responses
- `400 Bad Request`: `{"error": "All fields are required"}`
- `400 Bad Request`: `{"error": "Email already in use"}`

---

## 2. Verify OTP (Step 2)
Verifies the OTP sent to the email. On success, it logs the user in (sets HTTP-only cookie).

- **Endpoint:** `/api/auth/verify-otp`
- **Method:** `POST`
- **Headers:** `Content-Type: application/json`
- **Credentials:** `include` (Required to set the login cookie)

### Request Body
```json
{
  "email": "john@example.com",
  "otp": "123456"
}
```

### Success Response (200 OK)
```json
{
  "user": {
    "id": "uuid-string-here",
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

### Error Responses
- `400 Bad Request`: `{"error": "Invalid OTP"}`
- `400 Bad Request`: `{"error": "OTP has expired"}`
- `400 Bad Request`: `{"error": "User is already verified"}`
- `404 Not Found`: `{"error": "User not found"}`

---

## 3. User Login
Logs in an already verified user. Sets the HTTP-only cookie.

- **Endpoint:** `/api/auth/login`
- **Method:** `POST`
- **Headers:** `Content-Type: application/json`
- **Credentials:** `include` (Required to set the login cookie)

### Request Body
```json
{
  "email": "john@example.com",
  "password": "strongpassword123"
}
```

### Success Response (200 OK)
```json
{
  "user": {
    "id": "uuid-string-here",
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

### Error Responses
- `401 Unauthorized`: `{"error": "Invalid credentials"}`
- `403 Forbidden`: `{"error": "Please verify your email before logging in"}`

---

## 4. Get Current User (Session Check)
Verifies the HTTP-only cookie and returns the logged-in user's details. Call this on app initialization/page refresh.

- **Endpoint:** `/api/auth/me`
- **Method:** `GET`
- **Headers:** `Content-Type: application/json`
- **Credentials:** `include` (Mandatory - sends the secure cookie to the server)

### Success Response (200 OK)
```json
{
  "user": {
    "id": "uuid-string-here",
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

### Error Responses
- `401 Unauthorized`: `{"error": "Authentication required"}`
- `401 Unauthorized`: `{"error": "Invalid or expired token"}`
- `404 Not Found`: `{"error": "User not found"}`

---

## 5. Logout
Clears the HTTP-only cookie, logging the user out.

- **Endpoint:** `/api/auth/logout`
- **Method:** `POST`
- **Headers:** `Content-Type: application/json`
- **Credentials:** `include` (Mandatory)

### Success Response (200 OK)
```json
{
}
```

---

## 6. Upload a Document
Upload a PDF file for storage.

- **Endpoint:** `/api/documents/upload`
- **Method:** `POST`
- **Headers:** `Content-Type: multipart/form-data`
- **Credentials:** `include`

### Request Body (FormData)
- `file`: The PDF file to upload (Max 100MB)

### Success Response (201 Created)
```json
{
  "message": "File uploaded successfully",
  "document": {
    "id": "doc-uuid",
    "filename": "file-123.pdf",
    "originalName": "resume.pdf",
    "size": 102450,
    "type": "UPLOAD"
  }
}
```

---

## 7. Get User Documents
Fetch all documents belonging to the authenticated user.

- **Endpoint:** `/api/documents`
- **Method:** `GET`
- **Credentials:** `include`

### Success Response (200 OK)
```json
{
  "documents": [
    {
      "id": "doc-uuid",
      "filename": "file-123.pdf",
      "originalName": "resume.pdf",
      "size": 102450,
      "type": "UPLOAD",
      "createdAt": "2026-09-14T10:00:00.000Z"
    }
  ]
}
```

---

## 8. Delete a Document
Deletes a document from the database and the server's file system.

- **Endpoint:** `/api/documents/:id`
- **Method:** `DELETE`
- **Credentials:** `include`

### Success Response (200 OK)
```json
{
  "message": "Document deleted successfully"
}
```

---

## 9. Download a Document
Securely downloads a physical PDF file. This can be used in an `<a>` tag or fetched as a Blob.

- **Endpoint:** `/api/documents/download/:id`
- **Method:** `GET`
- **Credentials:** `include`

### Success Response (200 OK)
Returns the raw binary file with `Content-Type: application/pdf`.

---

## 10. Merge PDFs
Upload multiple PDFs and merge them into a single PDF.

- **Endpoint:** `/api/pdf/merge`
- **Method:** `POST`
- **Headers:** `Content-Type: multipart/form-data`
- **Credentials:** `include`

### Request Body (FormData)
- `files`: Multiple PDF files (Array of files)

### Success Response (201 Created)
```json
{
  "message": "PDFs merged successfully",
  "document": {
    "id": "doc-uuid",
    "filename": "merged-123.pdf",
    "originalName": "merged-document.pdf",
    "type": "MERGED"
  }
}
```

---

## 11. Split PDF
Upload a single PDF and specify the start and end pages to extract a specific range.

- **Endpoint:** `/api/pdf/split`
- **Method:** `POST`
- **Headers:** `Content-Type: multipart/form-data`
- **Credentials:** `include`

### Request Body (FormData)
- `file`: The single PDF file to split
- `startPage`: Number (e.g., "1")
- `endPage`: Number (e.g., "3")

### Success Response (201 Created)
```json
}
```

---

## 12. Rotate PDF
Rotate all pages of a PDF document by a specified angle.

- **Endpoint:** `/api/pdf/rotate`
- **Method:** `POST`
- **Headers:** `Content-Type: multipart/form-data`
- **Credentials:** `include`

### Request Body (FormData)
- `file`: The PDF file
- `angle`: Number (e.g., "90", "180", "270")

### Success Response (201 Created)
```json
{
  "message": "PDF rotated successfully",
  "document": {
    "id": "doc-uuid",
    "filename": "rotated-123.pdf",
    "originalName": "rotated-original.pdf",
    "type": "ROTATED"
  }
}
```

---

## 13. Organize PDF
Reorder or delete pages in a PDF document.

- **Endpoint:** `/api/pdf/organize`
- **Method:** `POST`
- **Headers:** `Content-Type: multipart/form-data`
- **Credentials:** `include`

### Request Body (FormData)
- `file`: The PDF file
- `pageOrder`: Stringified JSON array of 1-indexed page numbers (e.g., "[3, 1, 2]")

### Success Response (201 Created)
```json
{
  "message": "PDF organized successfully",
  "document": {
    "id": "doc-uuid",
    "filename": "organized-123.pdf",
    "originalName": "organized-original.pdf",
    "type": "ORGANIZED"
  }
}
```

---

## 14. Watermark PDF
Add text watermark diagonally across all pages of a PDF.

- **Endpoint:** `/api/pdf/watermark`
- **Method:** `POST`
- **Headers:** `Content-Type: multipart/form-data`
- **Credentials:** `include`

### Request Body (FormData)
- `file`: The PDF file
- `text`: String to be used as watermark (e.g., "CONFIDENTIAL")

### Success Response (201 Created)
```json
{
  "message": "PDF watermarked successfully",
  "document": {
    "id": "doc-uuid",
    "filename": "watermarked-123.pdf",
    "originalName": "watermarked-original.pdf",
    "type": "WATERMARKED"
  }
}
```

---

## 15. Page Numbers PDF
Add page numbers to the bottom center of each page.

- **Endpoint:** `/api/pdf/page-numbers`
- **Method:** `POST`
- **Headers:** `Content-Type: multipart/form-data`
- **Credentials:** `include`

### Request Body (FormData)
- `file`: The PDF file

### Success Response (201 Created)
```json
{
  "message": "Page numbers added successfully",
  "document": {
    "id": "doc-uuid",
    "filename": "numbered-123.pdf",
    "originalName": "numbered-original.pdf",
    "type": "NUMBERED"
  }
}
```

---

## 16. JPG/PNG to PDF
Convert multiple image files into a single PDF document.

- **Endpoint:** `/api/pdf/image-to-pdf`
- **Method:** `POST`
- **Headers:** `Content-Type: multipart/form-data`
- **Credentials:** `include`

### Request Body (FormData)
- `files`: Multiple image files (`.jpg`, `.jpeg`, `.png`)

### Success Response (201 Created)
```json
{
  "message": "Images converted to PDF successfully",
  "document": {
    "id": "doc-uuid",
    "filename": "from-images-123.pdf",
    "originalName": "converted-images.pdf",
    "type": "IMAGE_TO_PDF"
  }
}
```

---

## 17. Resize PDF
Resize PDF pages to a specified dimension. (Note: Only resizes the page boundaries, not actual content scaling).

- **Endpoint:** `/api/pdf/resize`
- **Method:** `POST`
- **Headers:** `Content-Type: multipart/form-data`
- **Credentials:** `include`

### Request Body (FormData)
- `file`: The PDF file
- `size`: String (e.g., "A4" or "Letter")

### Success Response (201 Created)
```json
{
  "message": "PDF resized successfully",
  "document": {
    "id": "doc-uuid",
    "filename": "resized-123.pdf",
    "originalName": "resized-original.pdf",
    "type": "RESIZED"
  }
}
```
