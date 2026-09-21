# Repair PDF API Specification

## 1. Overview
The Repair PDF API allows authenticated users to recover damaged, corrupted, or truncated PDF files. The engine uses a multi-tier recovery pipeline (qpdf, Ghostscript, and resilient PDF stream/xref reconstructor) followed by strict multi-point output validation.

## 2. Endpoint
`POST /api/v1/jobs`

### Headers
| Header | Type | Required | Description |
|---|---|---|---|
| `Authorization` | `string` | Yes | `Bearer <JWT_TOKEN>` |
| `Content-Type` | `string` | Yes | `application/json` |

## 3. Request Payload
```json
{
  "tool": "repair-pdf",
  "inputFileIds": ["clw9corrupted12345"]
}
```

### Options Schema
No special options required. Standard empty options object `{}` is accepted.

## 4. Response Payload (Job Creation)
```json
{
  "success": true,
  "data": {
    "job": {
      "id": "job_clw9repair890",
      "tool": "repair-pdf",
      "status": "QUEUED",
      "progress": 0,
      "inputFileIds": ["clw9corrupted12345"],
      "options": {},
      "createdAt": "2026-09-22T02:00:00.000Z"
    }
  }
}
```

## 5. Completed Job Polling
`GET /api/v1/jobs/:jobId`

```json
{
  "success": true,
  "data": {
    "job": {
      "id": "job_clw9repair890",
      "tool": "repair-pdf",
      "status": "COMPLETED",
      "progress": 100,
      "outputFileId": "clw9repaired12345",
      "options": {
        "metrics": {
          "totalPages": 4,
          "originalSize": 524288,
          "repairedSize": 512000,
          "method": "engine-reconstruct"
        }
      },
      "outputFile": {
        "id": "clw9repaired12345",
        "originalName": "damaged_document_repaired.pdf",
        "mimeType": "application/pdf",
        "size": 512000,
        "status": "READY"
      }
    }
  }
}
```

## 6. Error Codes & Anti-Fake-Success Rule
| Code | HTTP Status | Description |
|---|---|---|
| `UNAUTHORIZED` | 401 | Missing or invalid auth token |
| `INVALID_INPUT_FILE` | 400 | Missing input file, >1 files, empty 0-byte file, or ownership violation |
| `PDF_REPAIR_FAILED` | 500 / Job FAILED | Unrepairable corrupted file (Strict anti-fake-success guarantee) |

> **Anti-Fake-Success Guarantee**: If a repaired file cannot be cleanly parsed or validated, the job transitions to `FAILED` with `PDF_REPAIR_FAILED` and all temporary files are unlinked.
