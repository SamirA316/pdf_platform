# Job System Feature Overview (Phase 3)

## Objective
Provide an asynchronous job execution pattern for PDF platform tools, decoupling long-running PDF transforms from HTTP request lifecycles.

## Implemented Scope
1. **Database Schema**:
   - `Job` table in Prisma with indexes on `[userId]` and `[status]`.
   - Foreign key relationship to `User` and optional relationship to output `File`.
2. **REST Endpoints (`/api/v1/jobs`)**:
   - `POST /api/v1/jobs` (Job creation & in-process async dispatch)
   - `GET /api/v1/jobs` (Paginated list with filter by status & tool)
   - `GET /api/v1/jobs/:jobId` (Status tracking)
   - `POST /api/v1/jobs/:jobId/cancel` (Cancellation of in-progress tasks with orphan file cleanup)
   - `DELETE /api/v1/jobs/:jobId` (History purging; active jobs in QUEUED/PROCESSING blocked)
3. **Decoupled PDF Processor**:
   - PoC implemented strictly for `compress-pdf`.
   - `ALLOWED_TOOLS` strictly limited to `compress-pdf` in Phase 3. Other tools will be added incrementally in Phase 4.
4. **Lifecycle & Queue Architecture**:
   - In-process dispatch using `setImmediate`. Persistent queue (Redis/BullMQ) planned for future worker phase.
   - `EXPIRED` status reserved for future retention cleanup workers.
5. **Frontend Integration**:
   - `frontend/lib/api/jobs.ts` client library.
   - `ToolWorkspace.tsx` integrated with job polling, progress animation, failure alert with sanitized messages, and download trigger via `/api/v1/files/:outputFileId/download`.
   - Prevented multiple simultaneous submits.
