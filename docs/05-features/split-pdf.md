# Feature Documentation: Split PDF (Phase 4.2)

## 1. Overview
The Split PDF tool allows users to divide a single PDF document into multiple PDFs according to their exact workflow requirements.

### Supported Split Modes
1. **Mode A — Page Ranges**:
   - Allows users to specify discrete page intervals (e.g. `1-3`, `4-7`, `8-10`).
   - Produces a separate output PDF for each range with intuitive naming (e.g. `Document_1-3.pdf`, `Document_4-7.pdf`).
   - Rejects overlapping ranges, inverted intervals, and out-of-bounds pages.

2. **Mode B — Extract Selected Pages**:
   - Allows users to select individual pages (e.g. `2, 5, 8`).
   - Consolidates selected pages into a single output PDF (e.g. `Document_pages_2_5_8.pdf`).
   - Rejects duplicate page selections and out-of-bounds page requests.

3. **Mode C — Every Page Separately**:
   - Splits every single page of the document into its own separate 1-page PDF (e.g. `Document_page_1.pdf`, `Document_page_2.pdf`, ...).

---

## 2. Architecture & Data Model
- **1-to-Many Output Mapping**:
  A single `Job` can generate multiple output `File`s. The database schema links files back to their generating job via `File.jobId`:
  ```prisma
  model File {
    ...
    jobId     String?
    sourceJob Job?    @relation("JobProducedFiles", fields: [jobId], references: [id], onDelete: Cascade)
    @@index([jobId])
  }
  ```
  `Job.outputFileId` is preserved for 100% backwards compatibility with single-output jobs (`compress-pdf`, `merge-pdf`), pointing to the primary/first output file.
- **Atomic Operations & Cleanup**:
  - If a job is cancelled during processing, the atomic conditional update ensures that 0 rows are updated and all generated output files are immediately purged from disk and deleted from the database.
  - If processing fails mid-way, `SplitProcessor` purges all partial files created during that execution cycle before bubbling up the error.
- **PDF Compatibility**:
  All split documents are saved with `{ useObjectStreams: false }` to guarantee compatibility across all modern and legacy PDF viewers and standard parsers.

---

## 3. Frontend Experience
- **Tabbed Interface**:
  - Seamless mode selector between **Page Ranges**, **Select Pages**, and **Every Page**.
  - Dynamic range builder supporting arbitrary additions and removals with inline validation.
  - Client-side pre-validation catches inverted or overlapping ranges and non-integer inputs immediately.
- **Multi-File Result Display**:
  - Displays a clean list of all generated split PDF documents.
  - Individual "Download" button for each split PDF file.
  - "Download All (N Files)" action for bulk downloads.
