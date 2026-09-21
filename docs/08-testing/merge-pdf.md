# Merge PDF Test Suite Documentation (Phase 4.1)

## Overview
Automated test suite `backend/tests/phase4_merge.test.ts` covers the full lifecycle, validation rules, page order preservation, error handling, and cancellation behavior of the **Merge PDF** tool.

Command: `npm run test:merge` (executed from `backend/`)

---

## Test Scenarios & Results

| # | Scenario | Tested Condition | Expected Result | Result |
|---|---|---|---|:---:|
| **1** | Minimum Input Count | 0 or 1 file in `inputFileIds` | `400 INVALID_INPUT_FILE` | **PASS ✅** |
| **2** | Duplicate File Rejection | Duplicate IDs in `inputFileIds` | `400 INVALID_INPUT_FILE` | **PASS ✅** |
| **3** | Nonexistent File Rejection | Invalid / deleted file ID | `400 INVALID_INPUT_FILE` | **PASS ✅** |
| **4** | Cross-User Security | User B submitting User A's file | `400 INVALID_INPUT_FILE` | **PASS ✅** |
| **5** | File Status Verification | File in `PROCESSING` status | `400 INVALID_INPUT_FILE` | **PASS ✅** |
| **6** | 2-PDF Merge Execution | 1-page PDF + 2-page PDF | Output created with exactly 3 pages; download verified | **PASS ✅** |
| **7** | Order Preservation (3 PDFs) | Sequence: `[doc_c, doc_a, doc_b]` | All 4 pages genuinely inspected via stream decompression: Page 1=Doc C, Page 2=Doc A, Page 3=Doc B (P1), Page 4=Doc B (P2) | **PASS ✅** |
| **8** | Corrupted PDF Handling | Invalid byte stream uploaded | Job transitions to `FAILED` with sanitized message `"We couldn't merge these PDFs. Please try again."` | **PASS ✅** |
| **9** | Queued / Early Cancellation | Cancel request issued on queued/early job | Job transitions to and remains `CANCELLED`, `outputFileId` is `null`, no orphan output file created | **PASS ✅** |

---

## Summary
- **Total Test Cases**: 9 / 9 Passing
- **Phase 3 Regression**: 12 / 12 Passing (`npm run test:jobs`)
- **Phase 2 Regression**: 10 / 10 Passing (`npm run test:files`)
- **TypeScript Check**: Backend 0 errors (`npx tsc --noEmit`), Frontend 0 errors (`npx tsc --noEmit`)
- **Production Bundle**: Frontend Next.js build clean (`npm run build`)
