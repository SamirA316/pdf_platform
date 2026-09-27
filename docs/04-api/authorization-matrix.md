# Phase 2.6A: API Authorization Matrix & Access Control Specification

## 1. Overview
The QuickPDF platform enforces strict object-level authorization across all user-owned entities (`File`, `Document`, `Job`, `Job Output`). Cross-user access (Insecure Direct Object Reference - IDOR) is systematically prevented by scoping all database queries and physical file operations directly to the authenticated user ID (`req.userId`).

To avoid user and resource existence enumeration, requests attempting to access resources belonging to other users return **`404 Not Found`** instead of `403 Forbidden`.

---

## 2. API Authorization Matrix

| Resource | Operation | Endpoint | Access Level | Unowned ID Behavior | Notes |
|:---|:---|:---|:---|:---|:---|
| **File** | Create / Upload | `POST /api/v1/files` | Auth User | N/A | Bound to `req.userId`, stored in `uploads/users/{userId}/` |
| **File** | List | `GET /api/v1/files` | **Own** | Filtered by `userId` | Paginated listing only returns caller's files |
| **File** | Read Metadata | `GET /api/v1/files/:id` | **Own** | **`404 Not Found`** | Queries `WHERE id = :id AND userId = :userId` |
| **File** | Download Stream | `GET /api/v1/files/:id/download` | **Own** | **`404 Not Found`** | Validates ownership & strictly verifies path within `uploads/` |
| **File** | Update / Rename | `PATCH /api/v1/files/:id` | **Own** | **`404 Not Found`** | Scoped query, preserves `.pdf` extension |
| **File** | Delete | `DELETE /api/v1/files/:id` | **Own** | **`404 Not Found`** | Scoped lookup -> removes DB record -> unlinks physical file |
| **Document** | Create / Upload | `POST /api/documents/upload` | Auth User | N/A | Bound to `req.userId` |
| **Document** | List | `GET /api/documents` | **Own** | Filtered by `userId` | Only caller's documents returned |
| **Document** | Read Metadata | `GET /api/documents/:id` | **Own** | **`404 Not Found`** | Scoped query `WHERE id = :id AND userId = :userId` |
| **Document** | Download Stream | `GET /api/documents/download/:id` | **Own** | **`404 Not Found`** | Validates ownership & path containment |
| **Document** | Delete | `DELETE /api/documents/:id` | **Own** | **`404 Not Found`** | Scoped query `WHERE id = :id AND userId = :userId` |
| **Job** | Create | `POST /api/v1/jobs` | Auth User | **`400 Invalid Input`** | Validates all `inputFileIds` belong to `req.userId` |
| **Job** | List | `GET /api/v1/jobs` | **Own** | Filtered by `userId` | Only caller's jobs returned |
| **Job** | Read Details | `GET /api/v1/jobs/:jobId` | **Own** | **`404 Not Found`** | Scoped query `WHERE id = :jobId AND userId = :userId` |
| **Job** | Cancel | `POST /api/v1/jobs/:jobId/cancel` | **Own** | **`404 Not Found`** | Scoped query `WHERE id = :jobId AND userId = :userId` |
| **Job** | Delete | `DELETE /api/v1/jobs/:jobId` | **Own** | **`404 Not Found`** | Scoped query `WHERE id = :jobId AND userId = :userId` |
| **Job Output** | Read | Via `GET /api/v1/jobs/:jobId` | **Own** | **`404 Not Found`** | Output file references embedded in job DTO |
| **Job Output** | Download | `GET /api/v1/files/:id/download` | **Own** | **`404 Not Found`** | Job output files are owned `File` records |

*Operations marked "—" do not exist in the current API architecture and have not been created.*

---

## 3. Physical Storage Security Rules (A9)

1. **Storage Root Invariance**:
   Physical files must reside strictly within `path.resolve(process.cwd(), "uploads")`.
2. **Path Traversal Guard**:
   Relative paths (`../../etc/passwd`) and absolute external paths (`/etc/passwd`) are rejected before filesystem I/O:
   ```typescript
   const uploadBase = path.resolve(process.cwd(), "uploads");
   const physicalPath = path.resolve(uploadBase, file.storageKey);
   const relativePath = path.relative(uploadBase, physicalPath);

   if (
     relativePath.startsWith("..") ||
     path.isAbsolute(relativePath) ||
     !physicalPath.startsWith(uploadBase + path.sep)
   ) {
     throw new FileNotFoundError("Invalid file path.");
   }
   ```
3. **No Unauthenticated File Ingestion**:
   All file paths and storage keys originate exclusively from trusted, validated database records created through authenticated pipelines.
