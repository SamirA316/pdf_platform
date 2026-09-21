# Feature Documentation: Rotate PDF (Phase 4.3)

## 1. Overview
The Rotate PDF tool allows users to correct page orientations in PDF files (e.g. upside down scans, sideways tables, mixed orientation reports).

### Supported Rotation Options
1. **Global Rotation (All Pages)**:
   - Rotates every page of the document by a chosen angle:
     - `90° Clockwise`
     - `180° Flip`
     - `270° Clockwise / 90° Counter-Clockwise`
2. **Selective Per-Page Rotation**:
   - Rotates only designated pages while leaving all other pages in their original orientation.
   - Example: `rotations: [{ page: 1, rotation: 90 }, { page: 3, rotation: 270 }]`.
3. **Cumulative Normalization**:
   - Accounts for any pre-existing rotation angle on the page so that rotating an already 90° rotated page by 90° produces an exact 180° orientation without distortion: `(currentAngle + deltaAngle) % 360`.

---

## 2. Architecture & Data Model
- **Single Output Model**:
  Rotate PDF produces a single updated document (`Job.outputFileId`).
- **Engine**:
  - Implemented with `pdf-lib` via `page.getRotation()` and `page.setRotation(degrees(newAngle))`.
  - Saved using `{ useObjectStreams: false }` for universal compatibility across standard PDF viewers.
- **Atomic Operations & Cleanup**:
  - Clean error recovery: if rotation fails mid-way, partial output files are unlinked from disk before returning.
  - Concurrency cancellation: if cancelled while processing, output file is purged automatically.

---

## 3. Frontend Experience
- **Interactive Orientation Preview**:
  - Live animated visual preview displaying the rotated document state.
  - Quick-action buttons: "Right (+90°)", "Left (-90°)", "Flip (180°)", "Reset (0°)".
  - Orientation badge: `90° Clockwise`, `180° Flip`, `270° Counter-Clockwise`.
- **Selective Mode**:
  - Comma-separated page input with strict digit regex verification.
  - Toggle buttons for selective angle selection.
