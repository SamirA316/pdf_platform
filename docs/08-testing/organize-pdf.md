# Organize PDF Test Suite Documentation (Phase 4.4)

**Test Script**: `npm run test:organize`  
**File**: `backend/tests/phase4_organize.test.ts`  
**Execution Command**: `tsx tests/phase4_organize.test.ts`

---

## Test Scenarios Summary

| # | Test Name | Purpose | Expected Result | Status |
|---|-----------|---------|-----------------|:------:|
| 1 | Empty input files rejection | Validate `inputFileIds: []` is rejected | `400 INVALID_INPUT_FILE` | ✅ PASS |
| 2 | Multiple input files rejection | Validate `inputFileIds.length > 1` is rejected | `400 INVALID_INPUT_FILE` | ✅ PASS |
| 3 | Non-existent file ID rejection | Validate missing file ID returns 400 | `400 INVALID_INPUT_FILE` | ✅ PASS |
| 4 | Unowned file isolation | Verify user cannot organize another user's file | `400 INVALID_INPUT_FILE` | ✅ PASS |
| 5 | Empty pages array | Reject `pages: []` | `400 INVALID_TOOL_OPTIONS` | ✅ PASS |
| 6 | Out-of-bounds sourcePage | Page index > totalPages rejected | `400 PAGE_OUT_OF_BOUNDS` | ✅ PASS |
| 7 | Invalid rotation angle | Angles other than 0, 90, 180, 270 (e.g. 45°) rejected | `400 INVALID_ROTATION_ANGLE` | ✅ PASS |
| 8 | Exceeding max output pages | Pages count > 200 rejected | `400 MAX_OUTPUT_PAGES_EXCEEDED` | ✅ PASS |
| 9 | Arbitrary reorder execution | Reorder 5 pages to `[3, 1, 5, 2, 4]`, verify text | `COMPLETED`, exact sequence verified | ✅ PASS |
| 10 | Reverse order execution | Reverse 5 pages to `[5, 4, 3, 2, 1]` | `COMPLETED`, reverse sequence verified | ✅ PASS |
| 11 | Page deletion / extraction | Extract only `[2, 4]`, verify subset | `COMPLETED`, 2 pages, verified text | ✅ PASS |
| 12 | Page duplication | Duplicate page to `[1, 2, 2, 3]` | `COMPLETED`, 4 pages, duplicated text verified | ✅ PASS |
| 13 | Per-page rotation | Rotate P1 by 90°, P2 unrotated | `COMPLETED`, P1 angle=90°, P2 angle=0° | ✅ PASS |
| 14 | Cancellation cleanup | Cancel during processing cleans up output file | Job CANCELLED, 0 orphan files | ✅ PASS |

---

## Regression Verification
- `npm run test:organize` — 14/14 passed
- `npm run test:rotate` — 13/13 passed
- `npm run test:split` — 14/14 passed
- `npm run test:merge` — 9/9 passed
- `npm run test:jobs` — 12/12 passed
- `npm run test:files` — 10/10 passed
- `npx tsc --noEmit` (backend) — 0 errors
- `npx tsc --noEmit` (frontend) — 0 errors
- `npm run build` (frontend) — 0 errors, optimized production build complete
