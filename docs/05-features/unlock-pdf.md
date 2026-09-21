# Feature Specification: Unlock PDF (Phase 4.9)

## 1. Feature Overview
The Unlock PDF tool allows users to decrypt their password-protected PDF files using their known password. It produces a clean, unencrypted PDF without lingering security dictionaries.

## 2. Business Rules & Security Boundaries
1. **No Brute-Forcing**: The system exclusively processes user-supplied credentials.
2. **Encrypted Verification**: Attempting to unlock an already unencrypted PDF immediately returns `PDF_NOT_ENCRYPTED`.
3. **Password Verification**: An incorrect password returns `INVALID_PDF_PASSWORD`.
4. **Clean Reconstruction**: Pages from the decrypted document are copied into a brand new `PDFDocument.create()` container, ensuring all encryption dictionaries and restrictions are stripped.
5. **Zero Password Leakage**: Passwords are scrubbed from job options prior to database persistence.

## 3. Architecture & Processing Flow
```
User (Browser)
   ↓ Uploads Encrypted PDF + Enters Password
POST /api/v1/jobs { tool: "unlock-pdf", inputFileIds: [id], options: { password } }
   ↓ Validation (Ownership + READY + PDF MIME + Non-empty password)
Job Created (QUEUED)
   ↓ Asynchronous Dispatch
UnlockProcessor.process()
   ↓ Test encryption status
   ↓ Decrypt via PDFDocument.load(bytes, { password })
   ↓ Copy pages to clean unencrypted PDF
   ↓ Save to /uploads/users/:userId/file_<hex>.pdf
Job Completed (COMPLETED) -> outputFileId linked
   ↓
Frontend Polls -> Displays ResultCard with Download Action
```
