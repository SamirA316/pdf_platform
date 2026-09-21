# Test Specification: PDF to PDF/A (Phase 4.11)

## 1. Test Suite Overview
Integration and standards compliance tests for PDF to PDF/A conversion are implemented in `backend/tests/phase4_pdfa.test.ts`.

## 2. Test Cases Covered
1. **Empty File Input Rejection**: Rejects requests missing `inputFileIds`.
2. **Multiple Files Rejection**: Requires exactly 1 input PDF.
3. **Cross-Tenant Ownership Security**: Blocks access to files owned by another user.
4. **Invalid Version Specification**: Rejects unsupported versions.
5. **Encrypted Document Rejection**: Strictly rejects password-protected PDFs per ISO 19005 mandate.
6. **PDF/A-1b Compliance**: Verifies `<pdfaid:part>1</pdfaid:part>` and `OutputIntent`.
7. **PDF/A-2b Compliance**: Verifies `<pdfaid:part>2</pdfaid:part>` and `OutputIntent`.
8. **PDF/A-3b Compliance**: Verifies `<pdfaid:part>3</pdfaid:part>` and `OutputIntent`.
9. **Atomic Cancellation & Cleanup**: Verifies cancelling active job unlinks physical outputs.

## 3. Running Tests
```bash
npm run test:pdfa
```
