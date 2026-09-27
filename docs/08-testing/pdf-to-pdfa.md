# Test Specification: PDF to PDF/A (Phase 4.11)

## 1. Test Suite Overview
Integration and standards compliance tests for PDF to PDF/A conversion are implemented in `backend/tests/phase4_pdfa.test.ts`.

## 2. Test Cases Covered
1. **Empty File Input Rejection**: Rejects requests missing `inputFileIds`.
2. **Multiple Files Rejection**: Requires exactly 1 input PDF.
3. **Cross-Tenant Ownership Security**: Blocks access to files owned by another user.
4. **Invalid Version Specification**: Rejects unsupported versions.
5. **Encrypted Document Rejection**: Strictly rejects password-protected PDFs per ISO 19005 mandate.
6. **PDF/A-1b Deep AST Compliance**: Verifies `<pdfaid:part>1</pdfaid:part>`, OutputIntent, and embedded ICC profile.
7. **PDF/A-2b Deep AST Compliance**: Verifies `<pdfaid:part>2</pdfaid:part>`, OutputIntent, and embedded sRGB IEC61966-2.1 ICC profile.
8. **PDF/A-3b Deep AST Compliance**: Verifies `<pdfaid:part>3</pdfaid:part>`, OutputIntent, and embedded ICC profile.
9. **Atomic Cancellation & Cleanup**: Verifies cancelling active job unlinks physical outputs.
10. **Independent Conformance Validation**: Strictly asserts that non-compliant or encrypted documents are rejected by `PdfaValidator` (anti-fake-pass guarantee).

## 3. Running Tests
```bash
npm run test:pdfa
```

