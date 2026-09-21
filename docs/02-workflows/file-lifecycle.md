# File Lifecycle & Storage Architecture (Phase 2)

## 1. Lifecycle State Machine

The QuickPDF platform manages documents through a strict lifecycle state machine to guarantee consistency, access control, and privacy.

```
       [ Client PDF ]
             │
             ▼
      POST /api/v1/files
             │
      ┌──────┴──────┐
      │  Validate   │  (PDF MIME + .pdf extension + <=100MB)
      └──────┬──────┘
             │ PASS
             ▼
      ┌─────────────┐
      │   Storage   │  (Save to uploads/users/{userId}/file_{randomHex}.pdf)
      └──────┬──────┘
             │
             ▼
      ┌─────────────┐
      │  Database   │  (Insert File record with status = READY)
      └──────┬──────┘
             │
    ┌────────┴───────────────────────────┐
    ▼                                    ▼
[ List / Details / Download / Rename ]   [ Delete ]
(Enforces strict userId ownership)       (Unlinks disk file + drops DB record)
```

---

## 2. File Status Values

| Status | Meaning | Operations Permitted |
|---|---|---|
| `UPLOADING` | File stream currently being written to storage | None |
| `READY` | File stored and verified; database record active | Read, Download, Rename, Delete |
| `PROCESSING` | File undergoing background transformation (Phase 3+) | Read metadata |
| `FAILED` | File validation or processing failed | Delete |
| `EXPIRED` | File retention window exceeded; marked for purge | None |

---

## 3. Storage Hierarchy & Key Conventions

To prevent path traversal, filename collisions, and directory leakage:
1. **Physical Storage Path**:
   ```
   backend/uploads/users/{userId}/file_{randomHex}.pdf
   ```
2. **Database `storageKey`**:
   ```
   users/{userId}/file_{randomHex}.pdf
   ```
3. **Public Exposure**:
   - Neither the absolute path (`/Users/...`) nor the relative `storageKey` is ever returned in API payloads.
   - The user's original filename (e.g. `My Resume.pdf`) is preserved in `originalName`.
   - On download, the browser receives `Content-Disposition: attachment; filename="My Resume.pdf"`.
