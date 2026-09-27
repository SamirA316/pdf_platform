# Feature Specification: Protect PDF (Phase 4.8)

## 1. Feature Overview
The Protect PDF tool allows users to secure PDF documents with enterprise-grade AES-256 encryption and configurable access permissions.

## 2. Supported Features
1. **User Password**: Required to open and read the encrypted PDF.
2. **Owner Password**: Securely auto-generated with random 128-bit entropy to guard administrative permissions.
3. **Document Permissions**:
   - `Allow Printing`: High-resolution document printing.
   - `Allow Copying`: Text selection and clipboard copying.
   - `Allow Modification`: Editing text, pages, or form fields.
   - `Allow Annotation`: Adding comments, highlights, and annotations.

## 3. Architecture & Processing Flow
```
User (Browser)
   ↓ Uploads PDF
POST /api/v1/files
   ↓ File ID
POST /api/v1/jobs { tool: "protect-pdf", inputFileIds: [id], options: { userPassword, permissions } }
   ↓ Backend Job Validation (Ownership + READY + PDF MIME + Non-empty password)
Job Created (QUEUED) -> Options scrubbed before DB write
   ↓ Asynchronous Dispatch
ProtectProcessor.process()
   ↓ PDFDocument.load({ ignoreEncryption: true })
   ↓ doc.encrypt({ userPassword, ownerPassword, permissions })
   ↓ Output PDF written to /uploads/users/:userId/file_<hex>.pdf
Job Completed (COMPLETED) -> outputFileId linked
   ↓
Frontend Polls -> Displays ResultCard with Download Action
```

## 4. Security & Privacy Guarantees
- **Zero Plaintext Password Leakage**: `userPassword` and `ownerPassword` are never saved to the database. They are sanitized before writing to `Job.options` and never logged.
- **Strict Ownership**: Only the file owner can encrypt their documents.
- **Physical Path Traversal Guard**: Resolved paths are strictly verified against `uploads/`.
- **Atomic Cleanup**: Any partial file outputs are safely unlinked if the job fails or is cancelled.

---

## 5. Cryptographic Profile & Verification
- **Cipher**: AES-256 (Advanced Encryption Standard with 256-bit symmetric key)
- **Standard**: ISO 32000-1 / Adobe Extension Level 8
- **Dictionary Attributes**:
  - `Filter`: `/Standard`
  - `V`: `5` (Version 5 security handler specifying 256-bit AES algorithms)
  - `R`: `6` (Revision 6 cipher specification)
  - `Length`: `256`
  - `CryptFilter`: `/AESV3`
- **Key Derivation**: Iterative hashing with SHA-256, SHA-384, and SHA-512 incorporating random 32-byte initialization vectors.
- **Automated Proof**: Formally asserted in test suite `tests/phase4_protect_unlock.test.ts` (Test 7b).

