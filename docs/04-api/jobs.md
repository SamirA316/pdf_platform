# Jobs API Reference (v1)

Base URL: `/api/v1/jobs`  
Authentication: Bearer Token required on all endpoints (`Authorization: Bearer <token>`).

---

### 1. Create Processing Job
`POST /api/v1/jobs`

Creates a new asynchronous processing job for a previously uploaded file.

#### Request Body
```json
{
  "tool": "compress-pdf",
  "inputFileIds": ["cuid_input_file_1"],
  "options": {
    "level": "medium"
  }
}
```

#### Success Response (`201 Created`)
```json
{
  "success": true,
  "data": {
    "id": "cuid_job_id",
    "tool": "compress-pdf",
    "status": "QUEUED",
    "progress": 0,
    "inputFileIds": ["cuid_input_file_1"],
    "outputFileId": null,
    "options": {
      "level": "medium"
    },
    "errorCode": null,
    "errorMessage": null,
    "startedAt": null,
    "completedAt": null,
    "expiresAt": "2026-09-22T18:22:33.000Z",
    "createdAt": "2026-09-21T18:22:33.000Z",
    "updatedAt": "2026-09-21T18:22:33.000Z"
  }
}
```

#### Error Responses
- `400 INVALID_TOOL`: Tool is not supported or not enabled in Phase 3.
- `400 INVALID_INPUT_FILE`: Input file doesn't exist, isn't READY, or doesn't belong to the authenticated user.
- `400 INVALID_COMPRESS_OPTIONS`: Invalid compression level.

---

### 2. Get Job Details & Status
`GET /api/v1/jobs/:jobId`

Retrieves current status, progress, metrics, and output file reference.

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "id": "cuid_job_id",
    "tool": "compress-pdf",
    "status": "COMPLETED",
    "progress": 100,
    "inputFileIds": ["cuid_input_file_1"],
    "outputFileId": "cuid_output_file_id",
    "options": {
      "level": "medium",
      "metrics": {
        "originalSize": 12345,
        "compressedSize": 6789,
        "compressionRatio": 0.55
      }
    },
    "errorCode": null,
    "errorMessage": null,
    "startedAt": "2026-09-21T18:22:34.000Z",
    "completedAt": "2026-09-21T18:22:36.000Z",
    "expiresAt": "2026-09-22T18:22:33.000Z",
    "createdAt": "2026-09-21T18:22:33.000Z",
    "updatedAt": "2026-09-21T18:22:36.000Z"
  }
}
```

#### Error Responses
- `403 JOB_ACCESS_DENIED`: Job exists but belongs to a different user.
- `404 JOB_NOT_FOUND`: Job ID does not exist.

---

### 3. List Jobs
`GET /api/v1/jobs?page=1&limit=20&status=COMPLETED&tool=compress-pdf`

Returns paginated list of user's jobs sorted by newest first.

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "jobs": [
      {
        "id": "cuid_job_id",
        "tool": "compress-pdf",
        "status": "COMPLETED",
        "progress": 100,
        "inputFileIds": ["cuid_input_file_1"],
        "outputFileId": "cuid_output_file_id",
        "createdAt": "2026-09-21T18:22:33.000Z"
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
}
```

---

### 4. Cancel Job
`POST /api/v1/jobs/:jobId/cancel`

Cancels a job if it is currently `QUEUED` or `PROCESSING`.

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "id": "cuid_job_id",
    "status": "CANCELLED"
  }
}
```

#### Error Responses
- `400 INVALID_JOB_STATUS`: Job is already `COMPLETED`, `FAILED`, or `CANCELLED`.
- `403 JOB_ACCESS_DENIED`: Job belongs to another user.
- `404 JOB_NOT_FOUND`: Job not found.

---

### 5. Delete Job History
`DELETE /api/v1/jobs/:jobId`

Deletes the job record from user history.
**Constraint**: Active jobs (`QUEUED` or `PROCESSING`) cannot be deleted directly. The user must cancel the job first before removing it from history.

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "message": "Job deleted from history successfully"
  }
}
```

#### Error Responses
- `400 INVALID_JOB_STATUS`: Attempted to delete a job in `QUEUED` or `PROCESSING` state.
- `403 JOB_ACCESS_DENIED`: Job belongs to another user.
- `404 JOB_NOT_FOUND`: Job not found.

---

### Lifecycle Notes & Expiry
- **Cancellation & Cleanup**: When a job is cancelled while processing is running, any output file generated upon completion is automatically purged from disk and deleted from the database.
- **EXPIRED Status**: The `EXPIRED` status is defined in the lifecycle enum for future automated retention workers. Automatic background expiry cleanup is not active in Phase 3.
- **Queue Architecture**: Phase 3 uses in-process `setImmediate` asynchronous dispatching. Dedicated queue infrastructure (Redis/BullMQ) is scheduled for later architecture phases.
