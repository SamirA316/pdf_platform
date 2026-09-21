# Feature Specification: Resize PDF (Phase 4.5)

## 1. Purpose & Overview
Resize PDF allows users to adjust physical page dimensions of an existing PDF document to standard paper formats (A3, A4, A5, Letter, Legal) or arbitrary custom dimensions (in millimeters, inches, or points), with selectable Portrait or Landscape orientation.

Unlike document compression, Resize PDF scales page media boxes and visual content proportionally, centering content onto the new page without cropping or loss of fidelity.

---

## 2. Supported Page Sizes & Dimensions

| Format | Portrait Dimensions (pt @ 72 DPI) | Millimeters / Inches Equivalent |
| :--- | :--- | :--- |
| **A3** | 841.89 × 1190.55 pt | 297 × 420 mm |
| **A4** | 595.28 × 841.89 pt | 210 × 297 mm |
| **A5** | 419.53 × 595.28 pt | 148 × 210 mm |
| **Letter** | 612.00 × 792.00 pt | 8.5 × 11 in |
| **Legal** | 612.00 × 1008.00 pt | 8.5 × 14 in |
| **Custom** | User specified | mm, inch, pt (min 10 pt, max 5000 pt) |

---

## 3. Architecture & Processing Flow

```
User (Frontend)
   │
   ▼
POST /api/v1/jobs (tool: "resize-pdf", inputFileIds: [id], options: { size, orientation, ... })
   │
   ▼
Validation (validateCreateJob)
   ├── 1 input file, READY, PDF MIME, ownership verified
   ├── Valid preset or validated custom dimensions
   └── Valid orientation ("portrait" | "landscape")
   │
   ▼
Prisma Job created (Status: QUEUED)
   │
   ▼
ResizeProcessor.process()
   ├── Load input PDF via pdf-lib
   ├── Calculate target width and height in points
   ├── For every page:
   │     ├── Proportional scale: scale = Math.min(targetW / origW, targetH / origH)
   │     ├── Center offset: xOffset = (targetW - scaledW)/2, yOffset = (targetH - scaledH)/2
   │     ├── page.scaleContent(scale, scale)
   │     ├── page.translateContent(xOffset, yOffset)
   │     └── page.setSize(targetW, targetH)
   ├── Save PDF with { useObjectStreams: false }
   └── Create output File record in Prisma
   │
   ▼
Prisma Job updateMany (Atomic transition to COMPLETED)
   │
   ▼
Frontend polls job -> Downloads resized PDF
```

---

## 4. Security & Error Handling
- **Path Traversal Protection**: Upload directory is resolved safely; relative traversals outside the base directory are strictly forbidden.
- **Atomic State Transitions**: Cancellation during processing cleans up physical output and does not leave orphaned files.
- **Fail-Safe Cleanup**: Unlink output files on any failure before throwing sanitized user-facing errors.
