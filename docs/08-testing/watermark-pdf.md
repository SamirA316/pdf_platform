# Test Verification Report: Watermark PDF (Phase 4.6)

**Test File**: `backend/tests/phase4_watermark.test.ts`  
**Execution Command**: `npm run test:watermark`  
**Passed Tests**: 19 / 19 (100% Pass Rate)

---

## Verified Test Cases

| # | Test Scenario | Expected Result | Status |
| :--- | :--- | :--- | :--- |
| 1 | Empty `inputFileIds` | 400 `INVALID_INPUT_FILE` | ✅ PASS |
| 2 | Multiple `inputFileIds` (>1) | 400 `INVALID_INPUT_FILE` | ✅ PASS |
| 3 | Nonexistent file ID | 400 `INVALID_INPUT_FILE` | ✅ PASS |
| 4 | File owned by another user | 400 `INVALID_INPUT_FILE` | ✅ PASS |
| 5 | Empty watermark text | 400 `INVALID_WATERMARK_TEXT` | ✅ PASS |
| 6 | Oversized watermark text (> 200 chars) | 400 `INVALID_WATERMARK_TEXT` | ✅ PASS |
| 7 | Invalid watermark type | 400 `INVALID_TOOL_OPTIONS` | ✅ PASS |
| 8 | Invalid position | 400 `INVALID_TOOL_OPTIONS` | ✅ PASS |
| 9 | Invalid opacity | 400 `INVALID_TOOL_OPTIONS` | ✅ PASS |
| 10 | Image watermark without `imageFileId` | 400 `INVALID_WATERMARK_IMAGE` | ✅ PASS |
| 11 | Image watermark with nonexistent `imageFileId` | 400 `INVALID_INPUT_FILE` | ✅ PASS |
| 12 | Image watermark with unowned image file | 400 `INVALID_INPUT_FILE` | ✅ PASS |
| 13 | Image watermark with non-image file MIME | 400 `INVALID_MIME_TYPE` | ✅ PASS |
| 14 | Out-of-bounds page number in `pages` array | 400 `PAGE_OUT_OF_BOUNDS` | ✅ PASS |
| 15 | Text watermark on all pages | COMPLETED, valid 3-page watermarked PDF | ✅ PASS |
| 16 | Text watermark on selected pages ([1, 3]) | COMPLETED, target pages watermarked | ✅ PASS |
| 17 | Image watermark using uploaded PNG stamp | COMPLETED, PNG embedded and rendered | ✅ PASS |
| 18 | Text watermark with corner positions (top-left) | COMPLETED, position calculated correctly | ✅ PASS |
| 19 | Job cancellation triggers cleanup of output file | CANCELLED, output file deleted | ✅ PASS |
