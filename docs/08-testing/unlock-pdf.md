# Test Specification: Unlock PDF (Phase 4.9)

## 1. Test Suite Overview
Integration and regression tests for Unlock PDF are included in `backend/tests/phase4_protect_unlock.test.ts`.

## 2. Test Cases Covered
1. **Empty Password Validation**: Rejects empty or missing password.
2. **Unencrypted Document Detection**: Returns clean error when attempting to unlock a non-encrypted file.
3. **Invalid Password Handling**: Accurately flags `INVALID_PDF_PASSWORD` on credential mismatch without crashing the worker.
4. **Successful Decryption Flow**: Validates end-to-end decryption, page count preservation, and creation of clean unencrypted document.
5. **No Password Leakage**: Verifies passwords are never stored in plain text or leaked via error stacks.
6. **Concurrent Cancellation**: Validates clean file unlinking upon job abort.

## 3. Running Tests
```bash
npm run test:protect
```
