# Changelog

All notable changes to this project will be documented in this file.

## [Phase 4.10 - Repair PDF Tool] - 2026-09-22

### Added
- Integrated `repair-pdf` tool into the V1 Job Processing System (`/api/v1/jobs`)
- Added `"repair-pdf"` to `ALLOWED_TOOLS` in `job.constants.ts`
- Validation logic for `repair-pdf` in `job.validation.ts`:
  - Exactly 1 input file required, user ownership verified, status `READY`
  - Rejects 0-byte empty files
- Multi-tier recovery engine in `backend/src/modules/pdf/processors/repair.processor.ts`:
  - Stage 1: External `qpdf` linearize/repair attempt if available
  - Stage 2: External `Ghostscript` re-distillation attempt if available
  - Stage 3: Resilient internal stream and xref reconstructor engine (detects shifted headers, restores truncated EOF trailers, rebuilds clean object catalog)
  - Stage 4: Strict 5-point output validation (anti-fake-success guarantee)
- Frontend integration:
  - Added `slug === "repair-pdf"` dispatch in `ToolWorkspace.tsx`
  - Rendered `BasicConfig` with one-click repair workflow
- Comprehensive test suite `backend/tests/phase4_repair.test.ts` (`npm run test:repair`) covering 8 scenarios (100% pass)
- Complete documentation: `docs/04-api/repair-pdf.md`, `docs/05-features/repair-pdf.md`, `docs/08-testing/repair-pdf.md`

## [Phase 4.9 - Unlock PDF Tool] - 2026-09-22

### Added
- Integrated `unlock-pdf` tool into the V1 Job Processing System (`/api/v1/jobs`)
- Added `"unlock-pdf"` to `ALLOWED_TOOLS` in `job.constants.ts`
- Strict password validation in `job.validation.ts` (requires non-empty password)
- Decoupled `UnlockProcessor` in `backend/src/modules/pdf/processors/unlock.processor.ts`:
  - Detects if PDF is password-protected (`PDF_NOT_ENCRYPTED` if already unencrypted)
  - Validates password against encrypted PDF (`INVALID_PDF_PASSWORD` on mismatch)
  - Copies pages into a brand new `PDFDocument.create()` to strip all leftover encryption dictionaries
  - Atomic cleanup on failure
- Frontend integration:
  - Reused & specialized `ProtectConfig.tsx` in unlock mode
  - Handled `slug === "unlock-pdf"` in `ToolWorkspace.tsx`
- Complete documentation: `docs/04-api/unlock-pdf.md`, `docs/05-features/unlock-pdf.md`, `docs/08-testing/unlock-pdf.md`

## [Phase 4.8 - Protect PDF Tool] - 2026-09-22

### Added
- Integrated `protect-pdf` tool into the V1 Job Processing System (`/api/v1/jobs`)
- Added `"protect-pdf"` to `ALLOWED_TOOLS` in `job.constants.ts`
- Validation logic for `protect-pdf` in `job.validation.ts`:
  - Exactly 1 input file required, user ownership verified, status `READY`
  - Validates non-empty `userPassword` (max 128 characters)
  - Configurable permissions: `print`, `copy`, `modify`, `annotate`
- Decoupled `ProtectProcessor` in `backend/src/modules/pdf/processors/protect.processor.ts`:
  - Native AES-256 encryption via `@cantoo/pdf-lib`
  - Granular permission flags (printing, copying, editing, annotating)
  - Auto-generates random 128-bit owner password
  - Zero password leakage: `sanitizeOptionsForStorage()` strips passwords prior to DB writes
  - Atomic cleanup on processor failure
- Frontend integration:
  - Created enhanced `ProtectConfig.tsx` with password visibility toggle, confirm password matching, and permission toggles
  - Handled `slug === "protect-pdf"` in `ToolWorkspace.tsx`
- Comprehensive test suite `backend/tests/phase4_protect_unlock.test.ts` (`npm run test:protect`) covering 13 scenarios (100% pass)
- Complete documentation: `docs/04-api/protect-pdf.md`, `docs/05-features/protect-pdf.md`, `docs/08-testing/protect-pdf.md`

## [Phase 4.7 - Page Numbers Tool] - 2026-09-22

### Added
- Integrated `page-numbers` tool into the V1 Job Processing System (`/api/v1/jobs`)
- Added `"page-numbers"` to `ALLOWED_TOOLS` and defined `ALLOWED_PAGE_NUMBER_POSITIONS` in `job.constants.ts`
- Validation logic for `page-numbers` in `job.validation.ts`:
  - Exactly 1 input file required, user ownership verified, status `READY`
  - Position validation across 6 locations: `bottom-center`, `bottom-left`, `bottom-right`, `top-center`, `top-left`, `top-right`
  - Starting page number validation (`startNumber >= 1`)
  - Target pages bounds validation against `totalPages` (`PAGE_OUT_OF_BOUNDS`)
- Decoupled `PageNumbersProcessor` in `backend/src/modules/pdf/processors/page-numbers.processor.ts`:
  - Uses `pdf-lib` to embed `StandardFonts.Helvetica` and dynamically calculate text positions based on page bounds and margin
  - Supports template placeholders `{n}` (page index + offset) and `{total}` (total pages)
  - Saves with `{ useObjectStreams: false }` for universal compatibility
  - Automatic partial output file unlinking on processor failure
- Frontend integration:
  - Created `PageNumbersConfig.tsx` with visual position selector, format template presets, live preview pill, and cover page skipping
  - Updated `ToolWorkspace.tsx` with `slug === "page-numbers"` dispatch and result download
- Comprehensive test suite `backend/tests/phase4_page_numbers.test.ts` (`npm run test:page-numbers`) covering 14 scenarios (100% pass)
- Complete documentation: `docs/04-api/page-numbers.md`, `docs/05-features/page-numbers.md`, `docs/08-testing/page-numbers.md`

## [Phase 4.6 - Watermark PDF Tool] - 2026-09-22

### Added
- Integrated `watermark-pdf` tool into the V1 Job Processing System (`/api/v1/jobs`)
- Added `"watermark-pdf"` to `ALLOWED_TOOLS` and defined `ALLOWED_WATERMARK_TYPES` and `ALLOWED_WATERMARK_POSITIONS` in `job.constants.ts`
- Support for both Text and Image watermarks:
  - Text: custom text, fontSize, color, rotation angle, opacity, and positioning
  - Image: PNG/JPEG image stamps with scale factor, opacity, rotation, and positioning
- Multi-file validation in `job.validation.ts`:
  - Exactly 1 input PDF file required, owned by user, in `READY` status
  - For image watermarks: strict ownership check on `imageFileId`, `READY` status, and image MIME verification (`image/png`, `image/jpeg`)
  - Target pages bounds validation against `totalPages` (`PAGE_OUT_OF_BOUNDS`)
- Decoupled `WatermarkProcessor` in `backend/src/modules/pdf/processors/watermark.processor.ts`:
  - Uses `pdf-lib` to embed `StandardFonts.HelveticaBold` or PNG/JPEG image files
  - Calculates precise geometric centers accounting for rotated text and page coordinates
  - Saves with `{ useObjectStreams: false }` for universal viewer compatibility
  - Automatic partial output file unlinking on processor failure
- Frontend integration:
  - Rich `WatermarkConfig.tsx` supporting text/image toggling, live preview, color picker, quick suggestions, and position selector
  - Updated `ToolWorkspace.tsx` with `slug === "watermark" || slug === "watermark-pdf"` dispatch
  - Enhanced `/api/v1/files` to permit user image uploads with `?type=image`
- Comprehensive test suite `backend/tests/phase4_watermark.test.ts` (`npm run test:watermark`) covering 19 scenarios (100% pass)
- Complete documentation: `docs/04-api/watermark-pdf.md`, `docs/05-features/watermark-pdf.md`, `docs/08-testing/watermark-pdf.md`

## [Phase 4.5 - Resize PDF Tool] - 2026-09-22

### Added
- Integrated `resize-pdf` tool into the V1 Job Processing System (`/api/v1/jobs`)
- Added `"resize-pdf"` to `ALLOWED_TOOLS` in `job.constants.ts`
- Added standard presets and dimensions for `a3`, `a4`, `a5`, `letter`, `legal`, and `custom` sizes
- Validation logic for `resize-pdf` in `job.validation.ts`:
  - Exactly 1 input file required
  - Strict ownership, `READY` status, and `application/pdf` MIME verification
  - Page size validation (`ALLOWED_PAGE_SIZES`)
  - Orientation validation (`portrait` vs `landscape`)
  - Custom dimension validation with unit conversion (`mm`, `inch`, `pt`) and bounds enforcement (10 pt to 5000 pt)
- Decoupled `ResizeProcessor` in `backend/src/modules/pdf/processors/resize.processor.ts`:
  - Uses `pdf-lib` proportional content scaling (`scaleContent`), centering offset translation (`translateContent`), and media box adjustment (`setSize`)
  - Ensures no content cropping while adjusting dimensions
  - Saves with `{ useObjectStreams: false }` for universal compatibility
  - Automatic partial output file unlinking on processor failure
- Frontend integration:
  - Rich `ResizeConfig.tsx` component with preset cards, visual portrait/landscape orientation toggles, and custom dimension inputs
  - `ToolWorkspace.tsx` integrated with `slug === "resize-pdf"` dispatch and result download
- Comprehensive test suite `backend/tests/phase4_resize.test.ts` (`npm run test:resize`) covering 16 scenarios (100% pass)
- Complete documentation: `docs/04-api/resize-pdf.md`, `docs/05-features/resize-pdf.md`, `docs/08-testing/resize-pdf.md`

## [Phase 4.4 - Organize PDF Tool] - 2026-09-22

### Added
- Integrated `organize-pdf` tool into the V1 Job Processing System (`/api/v1/jobs`)
- Added `"organize-pdf"` to `ALLOWED_TOOLS` in `job.constants.ts`
- Validation logic for `organize-pdf` in `job.validation.ts`:
  - Exactly 1 input file required
  - Strict ownership, `READY` status, and `application/pdf` MIME verification
  - Non-empty `pages` array validation with maximum 200 pages safeguard (`MAX_OUTPUT_PAGES_EXCEEDED`)
  - Bounds validation: `1 <= sourcePage <= totalPages` (`PAGE_OUT_OF_BOUNDS`)
  - Per-page rotation angle validation (`0, 90, 180, 270`)
- Decoupled `OrganizeProcessor` in `backend/src/modules/pdf/processors/organize.processor.ts`:
  - Uses `pdf-lib` to copy and arrange pages arbitrarily
  - Supports arbitrary reordering, extraction/deletion, page duplication, and per-page rotation
  - Saves with `{ useObjectStreams: false }` for universal viewer compatibility
  - Automatic partial output file unlinking on processor failure
- Frontend integration:
  - Interactive `OrganizeConfig.tsx` with visual thumbnail cards, move left/right, rotate, duplicate, delete, and quick sequence modes
  - `ToolWorkspace.tsx` integrated with `slug === "organize-pdf"` dispatch and single-file download
- Comprehensive test suite `backend/tests/phase4_organize.test.ts` (`npm run test:organize`) covering 14 scenarios (100% pass)
- Complete documentation: `docs/04-api/organize-pdf.md`, `docs/05-features/organize-pdf.md`, `docs/08-testing/organize-pdf.md`

## [Phase 4.3 - Rotate PDF Tool] - 2026-09-22

### Added
- Integrated `rotate-pdf` tool into the V1 Job Processing System (`/api/v1/jobs`)
- Added `"rotate-pdf"` to `ALLOWED_TOOLS` and defined `ALLOWED_ROTATION_ANGLES = new Set([90, 180, 270])`
- Added safeguard in `job.validation.ts`: `MAX_SPLIT_OUTPUT_FILES = 100` (`MAX_OUTPUTS_EXCEEDED`) preventing resource abuse in `split-pdf`
- Validation logic for `rotate-pdf`:
  - Exactly 1 input file required
  - Strict ownership, `READY` status, and `application/pdf` MIME verification
  - Global rotation angle validation (90, 180, 270) with negative angle normalization
  - Selective per-page rotation validation: integer pages, page boundary checking (`PAGE_OUT_OF_BOUNDS`), allowed angle verification
- Decoupled `RotateProcessor` in `backend/src/modules/pdf/processors/rotate.processor.ts`:
  - Uses `pdf-lib` via `page.getRotation()` and `page.setRotation(degrees(newAngle))`
  - Supports cumulative rotation normalization on pre-rotated documents: `(currentAngle + deltaAngle) % 360`
  - Saves with `{ useObjectStreams: false }` for universal viewer compatibility
  - Automatic partial output file unlinking on processor failure
- Frontend integration:
  - Interactive `RotateConfig.tsx` with live animated document orientation preview
  - Quick action buttons: "Right (+90°)", "Left (-90°)", "Flip (180°)", "Reset (0°)"
  - Per-page selective rotation mode with strict numeric validation
  - `ToolWorkspace.tsx` integrated with `slug === "rotate-pdf"` dispatch and single-file download
- Comprehensive test suite `backend/tests/phase4_rotate.test.ts` (`npm run test:rotate`) covering 13 scenarios (100% pass)
- Complete documentation: `docs/04-api/rotate-pdf.md`, `docs/05-features/rotate-pdf.md`, `docs/08-testing/rotate-pdf.md`

## [Phase 4.2 - Split PDF Tool] - 2026-09-22

### Added
- Integrated `split-pdf` tool into the V1 Job Processing System (`/api/v1/jobs`)
- Relational 1-to-many output files architecture:
  - Added `jobId` foreign key to `File` model (`sourceJob Job? @relation("JobProducedFiles")`) with index `@@index([jobId])`
  - Added `outputFiles File[] @relation("JobProducedFiles")` to `Job` model
  - Preserved `Job.outputFileId` for backwards compatibility with single-file output jobs (`compress-pdf`, `merge-pdf`)
  - Prisma migration `20260921191934_add_job_multi_output_files`
- Implemented 3 split modes:
  - **Mode A (`ranges`)**: Extracts multiple custom page intervals into distinct output PDFs (e.g. `doc_1-3.pdf`, `doc_4-7.pdf`)
  - **Mode B (`pages`)**: Extracts selected page numbers into a single consolidated output PDF (e.g. `doc_pages_2_5_8.pdf`)
  - **Mode C (`every-page`)**: Extracts every page of the document into its own individual 1-page PDF
- Strict validation in `job.validation.ts`:
  - Exactly 1 input file required
  - Strict ownership and `READY` status verification
  - Range validation: integer start/end, `end >= start`, `end <= totalPages`, non-overlapping ranges (`OVERLAPPING_PAGE_RANGES`)
  - Page selection validation: 1-indexed integers, bounded within total pages, rejection of duplicate pages (`DUPLICATE_PAGE`)
- Decoupled `SplitProcessor` in `backend/src/modules/pdf/processors/split.processor.ts`:
  - Uses `pdf-lib` with `{ useObjectStreams: false }` for maximum reader compatibility
  - Clean error recovery: immediately purges all generated physical files and DB records on failure
  - Multi-output atomic cancellation: purges all generated output files from disk and DB if job is cancelled during execution
- Frontend integration:
  - Redesigned `SplitConfig.tsx` with modern tabbed interface for all 3 modes, range addition/removal, and client-side pre-validation
  - Updated `ToolWorkspace.tsx` to upload file, dispatch `split-pdf` job, and render multi-file results
  - Enhanced `StateCards.tsx` to display split PDF file lists with individual download buttons and bulk download support
- Comprehensive test suite `backend/tests/phase4_split.test.ts` (`npm run test:split`) covering 14 scenarios (100% pass)
- Complete documentation: `docs/04-api/split-pdf.md`, `docs/05-features/split-pdf.md`, `docs/08-testing/split-pdf.md`

## [Phase 4.1 - Merge PDF Tool] - 2026-09-22

### Added
- Integrated `merge-pdf` tool into the V1 Job Processing System (`/api/v1/jobs`)
- Added `merge-pdf` to `ALLOWED_TOOLS` whitelist in `job.constants.ts`
- Strict input validation in `job.validation.ts`:
  - Enforced minimum 2 input files requirement (`INVALID_INPUT_FILE`)
  - Duplicate input file IDs rejection
  - Strict user ownership, `READY` status, and `application/pdf` MIME verification
  - Preservation of user-selected input file order
- Decoupled `MergeProcessor` in `backend/src/modules/pdf/processors/merge.processor.ts`:
  - Loads files sequentially using `pdf-lib` and concatenates all pages into a new `PDFDocument`
  - Output written to secure user directory (`uploads/users/{userId}/file_{randomHex}.pdf`)
  - Created output `File` DB record with calculated metrics (`pageCount`, `inputCount`, `outputSize`)
  - Automatic partial output file unlinking on failure
  - Sanitized error messages (`"We couldn't merge these PDFs. Please try again."`)
- Automatic inheritance of atomic state transition protection and orphan cleanup from Phase 3
- Frontend integration:
  - `MergeConfig.tsx` enhanced with page sequence numbering, move up/down controls, and remove/add buttons
  - `ToolWorkspace.tsx` integrated to upload multiple files via `/api/v1/files`, create V1 merge job, poll status, and download via `/api/v1/files/:outputFileId/download`
- Dedicated automated test suite `backend/tests/phase4_merge.test.ts` (`npm run test:merge`) with 9 test scenarios (100% pass)
- Full documentation in `docs/04-api/merge-pdf.md`, `docs/05-features/merge-pdf.md`, and `docs/08-testing/merge-pdf.md`

## [Phase 3 - PDF Job / Processing System] - 2026-09-21

### Added
- Asynchronous Job Processing System with full state machine (`QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`, `CANCELLED`, `EXPIRED`)
- Prisma `Job` model with foreign key relations to `User` and output `File`, indexed by `[userId]` and `[status]`
- Prisma migration `20260921125257_add_job_system`
- Five REST endpoints under `/api/v1/jobs`:
  - `POST /api/v1/jobs` (create job & trigger async in-process background dispatch)
  - `GET /api/v1/jobs` (paginated list with `status` and `tool` filters)
  - `GET /api/v1/jobs/:jobId` (get single job status, progress, and metrics)
  - `POST /api/v1/jobs/:jobId/cancel` (cancel in-progress or queued job with automatic orphan output file purging)
  - `DELETE /api/v1/jobs/:jobId` (delete job from history; blocks deletion of active `QUEUED` or `PROCESSING` jobs)
- Decoupled PDF processor layer (`backend/src/modules/pdf/processors/compress.processor.ts`) for Compress PDF PoC
- Atomic state transitions (`PROCESSING` ➔ `COMPLETED`, `QUEUED`/`PROCESSING` ➔ `CANCELLED`) preventing concurrency race conditions
- Guaranteed orphan cleanup: automatic physical file unlinking and DB record deletion both when a job is cancelled during processing and if any failure occurs during completion transition
- Scoped `ALLOWED_TOOLS` strictly to `compress-pdf` for Phase 3 (subsequent tools added incrementally in Phase 4)
- Sanitized error reporting (`PROCESSING_FAILED`) to prevent internal system or path leakage on corrupt files
- Frontend job client library (`frontend/lib/api/jobs.ts`) with typed CRUD operations
- Frontend `ToolWorkspace.tsx` integrated with job creation, progress polling, completion download via `/api/v1/files/:outputFileId/download`, and double-submit prevention
- Automated Phase 3 test suite (`backend/tests/phase3_jobs.test.ts`) covering 12 scenarios with 100% pass rate
- Comprehensive documentation in `docs/03-architecture/job-processing.md`, `docs/04-api/jobs.md`, `docs/05-features/job-system.md`, and `docs/08-testing/job-system-tests.md`

## [Phase 2 - File Management System] - 2026-09-21

### Added
- File upload API (`POST /api/v1/files`) with PDF-only MIME and extension validation and 100MB limit
- File listing (`GET /api/v1/files`) with pagination and status filtering
- File metadata (`GET /api/v1/files/:id`) with user ownership enforcement
- Secure download (`GET /api/v1/files/:id/download`) via streaming with Content-Disposition headers
- File rename (`PATCH /api/v1/files/:id`) with input sanitization and automatic `.pdf` preservation
- File deletion (`DELETE /api/v1/files/:id`) with disk asset unlinking and DB record deletion
- User-isolated storage architecture (`backend/uploads/users/{userId}/file_{randomHex}.pdf`)
- Prisma `File` model and `FileStatus` enum representation
- Standardized file error codes (`FILE_REQUIRED`, `INVALID_FILE`, `UNSUPPORTED_FORMAT`, `FILE_TOO_LARGE`, `FILE_NOT_FOUND`, `FILE_ACCESS_DENIED`, etc.)
- Frontend upload integration via `uploadFileToV1` helper in `apiClient.ts` and `ToolWorkspace.tsx`
- Prisma migration `20260921103652_add_file_management` creating `File` model and indexing `userId`
- Hardened download path security with `path.relative` directory traversal checks
- Upload-to-database atomicity: automatic physical file unlink if database insertion fails
- Controlled validation layer for `FileStatus` enum (`validateFileStatus`) with `INVALID_FILE_STATUS` error code
- Repository cleanup: removed duplicate DB files and updated `.gitignore` with `*.db`, `*.db-journal`, `*.db-shm`, `*.db-wal`
