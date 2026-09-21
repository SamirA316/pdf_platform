# Merge PDF Feature Overview (Phase 4.1)

## Objective
Enable authenticated users to combine multiple PDF documents into a single cohesive document with strict user-specified page sequencing, robust error handling, and secure asynchronous background execution.

---

## Architectural Highlights

1. **V1 Job Architecture Integration**:
   - Reuses the existing Phase 3 asynchronous job pipeline (`QUEUED` ➔ `PROCESSING` ➔ `COMPLETED` / `FAILED` / `CANCELLED`).
   - Does not create temporary public download links; uses secure streaming via `/api/v1/files/:id/download`.

2. **Order Preservation**:
   - The user selects the order of files in the frontend workspace (with Move Up / Move Down controls).
   - The processor reads the files in the exact sequence specified by `inputFileIds` array and concatenates pages using `pdf-lib`.

3. **Strict Validation Layer**:
   - Minimum 2 PDF files required. 0 or 1 file submissions are rejected (`INVALID_INPUT_FILE`).
   - Duplicate file IDs in `inputFileIds` are rejected.
   - All files must belong to the authenticated user, exist on disk, have status `READY`, and possess `application/pdf` MIME type.

4. **Decoupled Processor (`MergeProcessor`)**:
   - Resolves physical files in `uploads/users/{userId}/`.
   - Checks for directory traversal security (`path.relative`).
   - Loads pages via `pdf-lib` and adds them sequentially to a new `PDFDocument`.
   - Writes merged result to `uploads/users/{userId}/file_{randomHex}.pdf`.
   - Records new `File` entry in the database.
   - Automatically unlinks any partial output file if an error occurs.

5. **Atomic Concurrency & Orphan Cleanup**:
   - Inherits Phase 3 cancellation protection: If a user cancels during processing, the completion database update fails (`count === 0`) and the newly created output file is automatically purged from disk and deleted from the database.

6. **Frontend Experience**:
   - `MergeConfig.tsx` provides item numbering (`1.`, `2.`), move up/down controls, delete buttons, and an "+ Add More" button.
   - "Merge PDFs" button is disabled whenever fewer than 2 files are present.
   - Dynamic progress animation and sanitized failure notification ("We couldn't merge these PDFs. Please try again.").
