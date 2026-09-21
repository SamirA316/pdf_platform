# Split PDF Test Suite Documentation (Phase 4.2)

**Test Script**: `npm run test:split`  
**File**: `backend/tests/phase4_split.test.ts`  
**Execution Command**: `tsx tests/phase4_split.test.ts`

---

## Test Scenarios Summary

| # | Test Name | Purpose | Expected Result | Status |
|---|-----------|---------|-----------------|:------:|
| 1 | Empty input files rejection | Validate `inputFileIds: []` is rejected | `400 INVALID_INPUT_FILE` | ✅ PASS |
| 2 | Multiple input files rejection | Validate `inputFileIds.length > 1` is rejected | `400 INVALID_INPUT_FILE` | ✅ PASS |
| 3 | Non-existent file ID rejection | Validate non-existent file ID returns 400 | `400 INVALID_INPUT_FILE` | ✅ PASS |
| 4 | Unowned file isolation | Verify user cannot split another user's file | `400 INVALID_INPUT_FILE` | ✅ PASS |
| 5 | Unsupported split mode | Verify unknown mode is rejected | `400 INVALID_TOOL_OPTIONS` | ✅ PASS |
| 6 | Inverted range validation | Range with `start > end` (e.g. 4-2) rejected | `400 INVALID_PAGE_RANGE` | ✅ PASS |
| 7 | Out-of-bounds range | Range `end > totalPages` (e.g. 1-10 on 5-page PDF) rejected | `400 PAGE_OUT_OF_BOUNDS` | ✅ PASS |
| 8 | Overlapping ranges | Overlapping ranges (1-3 and 3-5) rejected | `400 OVERLAPPING_PAGE_RANGES` | ✅ PASS |
| 9 | Out-of-bounds page | Page index > totalPages rejected | `400 PAGE_OUT_OF_BOUNDS` | ✅ PASS |
| 10 | Duplicate page selection | Duplicate pages (e.g. [2, 3, 2]) rejected | `400 DUPLICATE_PAGE` | ✅ PASS |
| 11 | Mode A (ranges) execution | Split 5-page PDF into `1-2` and `4-5` | 2 output files, 2 pages each, verified on disk | ✅ PASS |
| 12 | Mode B (pages) execution | Extract pages `[2, 4]` into single PDF | 1 output file, 2 pages, verified text matches | ✅ PASS |
| 13 | Mode C (every-page) execution | Split 4-page PDF into 4 single-page PDFs | 4 output files, 1 page each, verified text | ✅ PASS |
| 14 | Concurrency / cancellation | Cancel during processing cleans up all output files | Job CANCELLED, 0 orphan files in DB or disk | ✅ PASS |

---

## Regression Verification
All prior phases were verified alongside Phase 4.2 with 0 regressions:
- `npm run test:merge` — 9/9 tests passed
- `npm run test:jobs` — 12/12 tests passed
- `npm run test:files` — 10/10 tests passed
- `npx tsc --noEmit` (backend) — 0 errors
- `npx tsc --noEmit` (frontend) — 0 errors
- `npm run build` (frontend) — 0 errors, optimized production build complete
