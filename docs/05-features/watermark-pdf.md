# Feature Specification: Watermark PDF (Phase 4.6)

## 1. Purpose & Overview
The Watermark PDF tool allows users to brand, protect, or classify PDF documents with semi-transparent text stamps or logos/images.

Users can choose between:
1. **Text Watermark**: Custom text (e.g. "CONFIDENTIAL", "DO NOT COPY"), font size, rotation angle, opacity, and color.
2. **Image Watermark**: A PNG or JPEG image/logo uploaded to user storage, scaled and stamped over target pages.

---

## 2. Watermark Positions & Coordinates

PDF coordinate space places `(0, 0)` at the bottom-left corner of each page:

| Position | Calculation |
| :--- | :--- |
| `center` | `x = (pageWidth - itemWidth) / 2`, `y = (pageHeight - itemHeight) / 2` (with rotational center transformation for text) |
| `top-left` | `x = margin`, `y = pageHeight - margin - itemHeight` |
| `top-right` | `x = pageWidth - margin - itemWidth`, `y = pageHeight - margin - itemHeight` |
| `bottom-left` | `x = margin`, `y = margin` |
| `bottom-right`| `x = pageWidth - margin - itemWidth`, `y = margin` |

---

## 3. Architecture & Processing Flow

```
User (Frontend)
   │
   ▼
POST /api/v1/jobs (tool: "watermark-pdf", inputFileIds: [pdfId], options: { type, ... })
   │
   ▼
Validation (validateCreateJob)
   ├── 1 input PDF file, READY, PDF MIME, ownership verified
   ├── If image watermark: imageFileId ownership, READY, image MIME (PNG/JPEG) verified
   ├── Position, opacity, rotation angle normalized
   └── Target pages bounds checked against totalPages
   │
   ▼
Prisma Job created (Status: QUEUED)
   │
   ▼
WatermarkProcessor.process()
   ├── Load PDF bytes via pdf-lib
   ├── If text: embed HelveticaBold, compute rotated bounding box
   ├── If image: embed PNG or JPEG, calculate scaled dimensions
   ├── For each target page:
   │     └── Draw text / image with specified opacity, position, and rotation
   ├── Save PDF with { useObjectStreams: false }
   └── Create output File record in Prisma
   │
   ▼
Prisma Job updateMany (Atomic transition to COMPLETED)
   │
   ▼
Frontend polls job -> Downloads watermarked PDF
```

---

## 4. Security
- **Multi-File Ownership Check**: Both the source PDF file and the watermark image file are strictly verified for authenticated user ownership.
- **MIME & Disk Validation**: Image file must physically exist and match standard PNG/JPEG image MIME types.
- **Fail-Safe Cleanup**: Unlink output files on any failure before throwing sanitized user-facing errors.
