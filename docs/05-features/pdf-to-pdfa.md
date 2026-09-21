# Feature Specification: PDF to PDF/A (Phase 4.11)

## 1. Feature Overview
The PDF to PDF/A converter transforms standard PDF documents into ISO-standardized PDF/A formats to ensure permanent document legibility, accessibility, and legal archival compliance.

## 2. Supported Conformance Standards
1. **PDF/A-1b (ISO 19005-1:2005)**:
   - Baseline standard guaranteeing visual preservation over decadal time horizons.
   - Header: `%PDF-1.4`.
2. **PDF/A-2b (ISO 19005-2:2011)**:
   - Modern recommended standard supporting JPEG2000 compression, transparency layers, and embedded OpenType fonts.
   - Header: `%PDF-1.7`.
3. **PDF/A-3b (ISO 19005-3:2012)**:
   - Universal archival format permitting arbitrary embedded file attachments (such as XML structured invoices, e.g. ZUGFeRD / Factur-X).
   - Header: `%PDF-1.7`.

## 3. Compliance Architecture
```
Input PDF
   ↓
Validate Unencrypted Status (PDF/A strictly forbids encryption)
   ↓
External Ghostscript PDF/A Check (if available in environment)
   ↓ fails / not installed
Native Archival Engine:
   - Copies clean page streams into ISO-standardized container
   - Embeds XMP identification stream (<pdfaid:part> & <pdfaid:conformance>B</pdfaid:conformance>)
   - Registers standard sRGB OutputIntent dictionary in Document Catalog
   - Re-indexes object catalog with uncompressed object streams
   ↓
Strict Output Validation:
   - PDF signature %PDF-
   - Parsable by PDF reader with > 0 pages
   - XMP metadata stream verified
   - OutputIntent verified
   ↓
Save output in READY status & return outputFileId
```

## 4. Security & Cleanup
- Encrypted documents are strictly rejected upfront with `ENCRYPTED_PDF_REJECTED`.
- Temporary outputs are securely unlinked upon any failure or cancellation.
