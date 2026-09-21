# Rotate PDF Test Suite Documentation (Phase 4.3)

**Test Script**: `npm run test:rotate`  
**File**: `backend/tests/phase4_rotate.test.ts`  
**Execution Command**: `tsx tests/phase4_rotate.test.ts`

---

## Test Scenarios Summary

| # | Test Name | Purpose | Expected Result | Status |
|---|-----------|---------|-----------------|:------:|
| 1 | Empty input files rejection | Validate `inputFileIds: []` is rejected | `400 INVALID_INPUT_FILE` | ✅ PASS |
| 2 | Multiple input files rejection | Validate `inputFileIds.length > 1` is rejected | `400 INVALID_INPUT_FILE` | ✅ PASS |
| 3 | Non-existent file ID rejection | Validate missing file ID returns 400 | `400 INVALID_INPUT_FILE` | ✅ PASS |
| 4 | Unowned file isolation | Verify user cannot rotate another user's file | `400 INVALID_INPUT_FILE` | ✅ PASS |
| 5 | Invalid rotation angle | Angles other than 90, 180, 270 (e.g. 45°) rejected | `400 INVALID_ROTATION_ANGLE` | ✅ PASS |
| 6 | Out-of-bounds page | Selective rotation page > totalPages rejected | `400 PAGE_OUT_OF_BOUNDS` | ✅ PASS |
| 7 | Non-integer page number | Non-numeric page identifier rejected | `400 INVALID_PAGE` | ✅ PASS |
| 8 | Global 90° Clockwise | Rotate 3-page PDF by 90°, verify all pages angle = 90° | `COMPLETED`, angle=90° verified | ✅ PASS |
| 9 | Global 180° Flip | Rotate 3-page PDF by 180°, verify all pages angle = 180° | `COMPLETED`, angle=180° verified | ✅ PASS |
| 10 | Selective Per-Page Rotation | Rotate Page 1 by 90°, Page 3 by 270°, Page 2 unrotated | `COMPLETED`, P1=90°, P2=0°, P3=270° verified | ✅ PASS |
| 11 | Cumulative Rotation | Rotate already-rotated (90°) PDF by another 90° | `COMPLETED`, angle = 180° verified | ✅ PASS |
| 12 | Split Output Limit Safeguard | Verify split-pdf rejects > 100 output files | `400 MAX_OUTPUTS_EXCEEDED` | ✅ PASS |
| 13 | Cancellation Cleanup | Cancel during processing cleans up output file | Job CANCELLED, 0 orphan files | ✅ PASS |

---

## Regression Verification
- `npm run test:rotate` — 13/13 passed
- `npm run test:split` — 14/14 passed
- `npm run test:merge` — 9/9 passed
- `npm run test:jobs` — 12/12 passed
- `npm run test:files` — 10/10 passed
- `npx tsc --noEmit` (backend) — 0 errors
- `npx tsc --noEmit` (frontend) — 0 errors
- `npm run build` (frontend) — 0 errors, optimized production build complete
