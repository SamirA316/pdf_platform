# PDF to PDF/A API Specification

## 1. Overview
The PDF to PDF/A API converts standard PDF documents into ISO-compliant PDF/A archival documents. It supports PDF/A-1b (ISO 19005-1), PDF/A-2b (ISO 19005-2), and PDF/A-3b (ISO 19005-3) with embedded XMP identification streams and sRGB OutputIntent profiles.

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
  "tool": "pdf-to-pdfa",
  "inputFileIds": ["clw9doc1234567890"],
  "options": {
    "version": "PDF/A-2b"
  }
}
```

### Options Schema
| Field | Type | Required | Default | Allowed Values | Description |
|---|---|---|---|---|---|
| `version` | `string` | No | `"PDF/A-2b"` | `"PDF/A-1b"`, `"PDF/A-2b"`, `"PDF/A-3b"` | PDF/A standard conformance level |

## 4. Response Payload (Job Creation)
```json
{
  "success": true,
  "data": {
    "job": {
      "id": "job_clw9pdfa890",
      "tool": "pdf-to-pdfa",
      "status": "QUEUED",
      "progress": 0,
      "inputFileIds": ["clw9doc1234567890"],
      "options": {
        "version": "PDF/A-2b"
      },
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
      "id": "job_clw9pdfa890",
      "tool": "pdf-to-pdfa",
      "status": "COMPLETED",
      "progress": 100,
      "outputFileId": "clw9output12345",
      "options": {
        "version": "PDF/A-2b",
        "metrics": {
          "totalPages": 3,
          "version": "PDF/A-2b",
          "conformsTo": "ISO 19005-2 Level B",
          "outputSize": 204800,
          "conversionEngine": "engine-archival"
        }
      },
      "outputFile": {
        "id": "clw9output12345",
        "originalName": "report_pdfa2b.pdf",
        "mimeType": "application/pdf",
        "size": 204800,
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
| `INVALID_TOOL_OPTIONS` | 400 | Invalid or unsupported PDF/A version specified |
| `ENCRYPTED_PDF_REJECTED` | 400 / Job FAILED | Password-protected documents cannot be converted to PDF/A |
| `PDF_CONVERSION_FAILED` | 500 / Job FAILED | Output compliance validation failed |
