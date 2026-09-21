# Unlock PDF API Specification

## 1. Overview
The Unlock PDF API allows users with the known password to decrypt a password-protected PDF document, producing a clean, unencrypted PDF suitable for standard editing, printing, and archiving.

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
  "tool": "unlock-pdf",
  "inputFileIds": ["clw9encrypted12345"],
  "options": {
    "password": "SuperSecretPassword123"
  }
}
```

### Options Schema
| Field | Type | Required | Description |
|---|---|---|---|
| `password` | `string` | Yes | Valid document password required to decrypt document. |

## 4. Response Payload (Job Creation)
```json
{
  "success": true,
  "data": {
    "job": {
      "id": "job_clw9unlock890",
      "tool": "unlock-pdf",
      "status": "QUEUED",
      "progress": 0,
      "inputFileIds": ["clw9encrypted12345"],
      "options": {},
      "createdAt": "2026-09-22T02:00:00.000Z"
    }
  }
}
```

> **Security Guarantee**: `password` is never stored in plaintext in the database or reflected in job polling responses.

## 5. Completed Job Polling
`GET /api/v1/jobs/:jobId`

```json
{
  "success": true,
  "data": {
    "job": {
      "id": "job_clw9unlock890",
      "tool": "unlock-pdf",
      "status": "COMPLETED",
      "progress": 100,
      "outputFileId": "clw9unlocked12345",
      "options": {
        "metrics": {
          "totalPages": 5,
          "isEncrypted": false,
          "outputSize": 1024000
        }
      },
      "outputFile": {
        "id": "clw9unlocked12345",
        "originalName": "contract_unlocked.pdf",
        "mimeType": "application/pdf",
        "size": 1024000,
        "status": "READY"
      }
    }
  }
}
```

## 6. Error Codes
| Code | HTTP Status | Description |
|---|---|---|
| `UNAUTHORIZED` | 401 | Missing or invalid auth token |
| `INVALID_INPUT_FILE` | 400 | Missing input file, >1 files, or ownership violation |
| `INVALID_PASSWORD` | 400 | Missing or empty password |
| `PDF_NOT_ENCRYPTED` | 400 | The supplied PDF is already unencrypted |
| `INVALID_PDF_PASSWORD` | 400 | The supplied password was incorrect |
| `PROCESSING_FAILED` | 500 | Processing engine failed |
