# Feature Specification: Repair PDF (Phase 4.10)

## 1. Feature Overview
The Repair PDF module reconstructs damaged, broken, or truncated PDF files into clean, fully compliant standards-compliant PDF documents.

## 2. Multi-Stage Pipeline Architecture
```
Damaged Input PDF
        ↓
[Stage 1: External QPDF Check]
        ↓ fails / not installed
[Stage 2: External Ghostscript Check]
        ↓ fails / not installed
[Stage 3: Resilient Stream & XRef Reconstructor Engine]
  - Locates shifted %PDF- magic bytes header (strips junk prepended data)
  - Restores truncated EOF trailers
  - Re-indexes object catalog and streams
  - Re-serializes into brand-new PDF container
        ↓
[Stage 4: Multi-Point Output Validation]
  - File exists on disk
  - File size > 0
  - Header starts with %PDF-
  - Parsable by PDF parser
  - Total page count > 0
        ↓
Output Valid?
  ├─ YES: Job COMPLETED, returns outputFileId
  └─ NO: Unlink output, Job FAILED (PDF_REPAIR_FAILED)
```

## 3. Strict Quality Guarantees
- **No Fake Success**: System never marks a job COMPLETED with an unreadable or zero-page PDF.
- **Safe Command Execution**: External command spawns use direct argument arrays without shell interpolation to prevent command injection.
- **Atomic Cleanup**: Failed jobs automatically purge orphaned physical artifacts.
