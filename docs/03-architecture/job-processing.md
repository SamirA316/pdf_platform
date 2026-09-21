# Job Processing Architecture (Phase 3)

## 1. Overview
In Phase 3, processing is decoupled from synchronous request-response loops into an asynchronous Job Processing abstraction.

Instead of performing PDF operations inline inside upload/tool routes, operations follow an explicit state machine:
```
Client
  │
  ├─ 1. Upload File ──> POST /api/v1/files ──> fileId (READY)
  │
  ├─ 2. Create Job  ──> POST /api/v1/jobs  ──> jobId (QUEUED)
  │                                                │
  │                                                ▼
  │                                    In-Process Dispatch (setImmediate)
  │                                                │
  │                                                ▼
  │                                           PROCESSING (progress: 25)
  │                                                │
  │                                                ▼
  │                                       CompressProcessor
  │                                                │
  │                                     ┌──────────┴──────────┐
  │                                     ▼                     ▼
  │                                 COMPLETED               FAILED
  │                               (outputFileId)      (sanitized error)
  │                                     │
  ├─ 3. Poll Status ──> GET /api/v1/jobs/:jobId
  │
  └─ 4. Download ─────> GET /api/v1/files/:outputFileId/download
```

## 2. Job Lifecycle State Machine

- `QUEUED` (progress: 0): Job created in database, assigned unique CUID, scheduled for immediate processing.
- `PROCESSING` (progress: 25): Background processor acquired the job, reading input file, and running the compression pipeline.
- `COMPLETED` (progress: 100): Processing finished successfully. An output `File` record was created, linked to `outputFileId`, progress is 100%, and completion timestamp set.
- `FAILED` (progress: 0): Processing encountered an error (e.g. invalid/corrupt PDF structure). Error details are sanitized to prevent internal path leakage (`PROCESSING_FAILED`).
- `CANCELLED`: User requested cancellation while job was `QUEUED` or `PROCESSING`.
- `EXPIRED`: Reserved state for future automated data retention and temporary file cleanup workers. Automatic expiry is not implemented in Phase 3.

## 3. Decoupled Processor Layer

Processors reside in `backend/src/modules/pdf/processors/`:
- `compress.processor.ts`: Proof-of-concept processor that loads the input file from `File` record, executes `compressPDFFile`, writes output to secure user folder (`uploads/users/{userId}/`), registers a new `File` record in Prisma, and returns the output `fileId` and compression metrics.
- In Phase 3, strictly `compress-pdf` is active. Additional tool processors (Merge, Split, Rotate, etc.) will be added in Phase 4.

## 4. Concurrency & Race Condition Guarantees

- **Cancellation Orphan Cleanup**: If a user cancels a job while processing is in flight, the processor still completes safely, detects that the job was cancelled, and immediately unlinks the generated output file from disk and deletes its `File` DB record to prevent orphan files.
- **Active Job Deletion Prevention**: Users cannot delete jobs in `QUEUED` or `PROCESSING` state (`400 INVALID_JOB_STATUS`). Active jobs must first be explicitly cancelled before deleting them from history.
- **Strict Ownership**: Processors only read input files confirmed to belong to the authenticated `userId`.
- **In-Process Dispatch & Queue Scope**: In Phase 3, jobs are dispatched asynchronously using `setImmediate` within the Node.js event loop without external Redis or BullMQ dependencies. Persistent queues and distributed workers are planned for a subsequent infrastructure phase.
