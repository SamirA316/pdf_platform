# Test Specification: Repair PDF (Phase 4.10)

## 1. Test Suite Overview
Integration and quality tests for Repair PDF are located in `backend/tests/phase4_repair.test.ts`.

## 2. Test Cases Covered
1. **Empty Input Rejection**: Rejects requests missing `inputFileIds`.
2. **Multiple Files Rejection**: Requires exactly 1 input PDF.
3. **Ownership Verification**: Cross-tenant isolation blocks unauthorized file access.
4. **Valid PDF Pass-Through**: Re-serializes clean PDFs safely.
5. **Shifted Header Recovery**: Successfully repairs files prepended with junk HTTP or server headers.
6. **Truncated Trailer Recovery**: Successfully restores files with missing or broken `%%EOF` markers.
7. **Severe Damage Quality Check**: Strictly ensures unrepairable garbage yields `FAILED` status and no fake success.
8. **Atomic Cancellation**: Early cancellation cleans up output files and prevents orphaned records.

## 3. Running Tests
```bash
npm run test:repair
```
