# Test Specification: Protect PDF (Phase 4.8)

## 1. Test Suite Overview
Integration and security tests for the Protect PDF tool are implemented in `backend/tests/phase4_protect_unlock.test.ts`.

## 2. Test Cases Covered
1. **Empty File Input Rejection**: Rejects requests missing `inputFileIds`.
2. **Multiple Files Rejection**: Protect tool requires exactly 1 input PDF.
3. **Cross-Tenant Ownership Security**: Users cannot protect files owned by another user.
4. **Missing Password Rejection**: Rejects requests missing `userPassword`.
5. **Happy Path Encryption**: Generates encrypted PDF and registers output file.
6. **Strict Encryption Verification**: Confirms file cannot be opened without password (`EncryptedPDFError`).
7. **Decryption Verification**: Confirms file opens cleanly and renders pages when the correct password is provided.
8. **Password Scrubbing Audit**: Proves plaintext password is never recorded in database `job.options`.
9. **Atomic Cancellation & Cleanup**: Verifies cancelling an active job deletes physical files and zeroes references.

## 3. Running Tests
```bash
npm run test:protect
```
