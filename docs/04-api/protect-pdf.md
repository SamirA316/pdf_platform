# Protect PDF API Specification

## 1. Overview
The Protect PDF API allows authenticated users to encrypt PDF documents using strong AES-256 encryption. Users can set a document password and specify granular permission flags (printing, copying, modification, annotation).

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
  "tool": "protect-pdf",
  "inputFileIds": ["clw9abc1234567890"],
  "options": {
    "userPassword": "SuperSecretPassword123",
    "permissions": {
      "print": true,
      "copy": false,
      "modify": false,
      "annotate": false
    }
  }
}
```

### Options Schema
| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `userPassword` | `string` | Yes | - | Password required to open and decrypt document (1–128 chars). |
| `permissions.print` | `boolean` | No | `true` | Allow high-resolution printing. |
| `permissions.copy` | `boolean` | No | `false` | Allow copying text and graphics. |
| `permissions.modify` | `boolean` | No | `false` | Allow modifying document contents. |
| `permissions.annotate` | `boolean` | No | `false` | Allow adding comments and form filling. |

## 4. Response Payload (Job Creation)
```json
{
  "success": true,
  "data": {
    "job": {
      "id": "job_clw9xyz890",
      "tool": "protect-pdf",
      "status": "QUEUED",
      "progress": 0,
      "inputFileIds": ["clw9abc1234567890"],
      "options": {
        "permissions": {
          "print": true,
          "copy": false,
          "modify": false,
          "annotate": false
        }
      },
      "createdAt": "2026-09-22T02:00:00.000Z"
    }
  }
}
```

> **Security Guarantee**: `userPassword` and `ownerPassword` are automatically scrubbed before saving `job.options` into the database or returning to the client.

## 5. Completed Job Polling
`GET /api/v1/jobs/:jobId`

```json
{
  "success": true,
  "data": {
    "job": {
      "id": "job_clw9xyz890",
      "tool": "protect-pdf",
      "status": "COMPLETED",
      "progress": 100,
      "outputFileId": "clw9output12345",
      "options": {
        "permissions": {
          "print": true,
          "copy": false,
          "modify": false,
          "annotate": false
        },
        "metrics": {
          "totalPages": 5,
          "isEncrypted": true,
          "permissions": {
            "print": true,
            "copy": false,
            "modify": false,
            "annotate": false
          },
          "outputSize": 1048576
        }
      },
      "outputFile": {
        "id": "clw9output12345",
        "originalName": "contract_protected.pdf",
        "mimeType": "application/pdf",
        "size": 1048576,
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
| `INVALID_PASSWORD` | 400 | Missing or empty user password |
| `PROCESSING_FAILED` | 500 | Processing engine failed |
