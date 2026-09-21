# Feature Specification: File Management (Phase 2)

## 1. Feature Goals

The File Management subsystem handles the complete document lifecycle on the QuickPDF platform, acting as the single source of truth for uploads, storage, access control, and metadata before downstream PDF transformation engines are invoked.

## 2. Core Capabilities

1. **PDF-Only Ingestion**:
   - Accepts exclusively `application/pdf` MIME types and `.pdf` extensions.
   - Rejects non-PDF files with `UNSUPPORTED_FORMAT`.
2. **File Size Enforcement**:
   - Caps uploads at 100MB (`100 * 1024 * 1024` bytes) through Multer limits.
   - Oversized files trigger `FILE_TOO_LARGE`.
3. **Multi-Tenant User Isolation**:
   - Files are stored per user under `uploads/users/{userId}/`.
   - All queries filter by `userId`, preventing cross-account enumeration or access.
   - Unauthorized access attempts respond with `FILE_NOT_FOUND` (404) to avoid leaking the existence of files belonging to other users.
4. **Safe File Renaming**:
   - Only updates the logical `originalName` in the database.
   - Automatically preserves or appends `.pdf`.
   - Strips malicious directory traversal sequences (`/`, `\`, null bytes).
5. **Secure Streaming Downloads**:
   - Documents are streamed via Node.js streams directly from disk with RFC-compliant `Content-Disposition` attachment headers.
   - Direct static URL access is blocked.
6. **Graceful File Deletion**:
   - Deletes both physical disk assets and Prisma database records.
   - Tolerates missing disk files gracefully without blocking database cleanup.
