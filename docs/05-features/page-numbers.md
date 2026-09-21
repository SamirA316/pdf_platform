# Feature Specification: Page Numbers (Phase 4.7)

## 1. Purpose & Overview
The Page Numbers PDF tool stamps sequential page identifiers onto PDF pages. Users can select from standard header/footer positions, configure initial starting offsets, customize the string template, adjust font size and color, and select target pages (such as skipping cover pages).

---

## 2. Positions & Layout

| Position | Coordinate Calculation |
| :--- | :--- |
| `bottom-center` | `x = (pageWidth - textWidth) / 2`, `y = margin` |
| `bottom-left` | `x = margin`, `y = margin` |
| `bottom-right` | `x = pageWidth - margin - textWidth`, `y = margin` |
| `top-center` | `x = (pageWidth - textWidth) / 2`, `y = pageHeight - margin - textHeight` |
| `top-left` | `x = margin`, `y = pageHeight - margin - textHeight` |
| `top-right` | `x = pageWidth - margin - textWidth`, `y = pageHeight - margin - textHeight` |

---

## 3. Supported Template Formats

- `"Page {n} / {total}"` -> e.g. "Page 1 / 10"
- `"{n} of {total}"` -> e.g. "1 of 10"
- `"{n}"` -> e.g. "1"
- `"- {n} -"` -> e.g. "- 1 -"
- Any custom string template containing `{n}` (page index + startNumber) and `{total}` (document page count).

---

## 4. Architecture & Processing Flow

```
User (Frontend)
   │
   ▼
POST /api/v1/jobs (tool: "page-numbers", inputFileIds: [pdfId], options: { position, startNumber, format, ... })
   │
   ▼
Validation (validateCreateJob)
   ├── 1 input PDF file, READY, PDF MIME, ownership verified
   ├── Position in ALLOWED_PAGE_NUMBER_POSITIONS
   ├── startNumber >= 1 integer
   └── Target pages bounds checked against totalPages
   │
   ▼
Prisma Job created (Status: QUEUED)
   │
   ▼
PageNumbersProcessor.process()
   ├── Load PDF bytes via pdf-lib
   ├── Embed StandardFonts.Helvetica
   ├── For each target page:
   │     ├── Calculate pageNum = physicalIndex + startNumber
   │     ├── Format string replacement: {n} -> pageNum, {total} -> totalPages
   │     ├── Measure text width & height
   │     ├── Calculate coordinate based on position and margin
   │     └── Draw text on page
   ├── Save PDF with { useObjectStreams: false }
   └── Create output File record in Prisma
   │
   ▼
Prisma Job updateMany (Atomic transition to COMPLETED)
   │
   ▼
Frontend polls job -> Downloads numbered PDF
```
