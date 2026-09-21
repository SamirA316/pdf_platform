# Feature Documentation: Organize PDF (Phase 4.4)

## 1. Overview
The Organize PDF tool empowers users to comprehensively restructure the pages of a PDF document before saving or sharing.

### Key Capabilities
1. **Arbitrary Page Reordering**: Change the order of pages (e.g. swap pages, reverse order, move back cover to front).
2. **Page Deletion / Extraction**: Exclude unwanted pages from the final output while extracting only needed pages.
3. **Page Duplication**: Duplicate specific pages (e.g., forms, checklists, template pages).
4. **Individual Page Rotation**: Rotate specific individual pages by 90°, 180°, or 270° clockwise without affecting the orientation of other pages.

---

## 2. Architecture & Data Model
- **Single Output Document**:
  Organize PDF outputs a consolidated restructured PDF document recorded in `File` and linked to `Job.outputFileId`.
- **Decoupled Engine (`organize.processor.ts`)**:
  - Leverages `pdf-lib` to copy requested pages by source index.
  - Applies selective degrees rotation per page item.
  - Saves with `{ useObjectStreams: false }`.
  - Automatic disk and DB orphan cleanup on job cancellation or execution failure.
- **Resource Safeguard**:
  - Maximum 200 pages allowed in the organized output (`MAX_OUTPUT_PAGES_EXCEEDED`) preventing resource abuse via infinite page cloning.

---

## 3. Frontend Experience
- **Interactive Card Organizer (`OrganizeConfig.tsx`)**:
  - Visual thumbnail cards representing each page in its current sequence.
  - Position badge (`Pos #1`, `Pos #2`) and Source indicator (`Src: P3`).
  - Move Left (←) / Move Right (→) controls.
  - ↷ Individual page rotation control.
  - 📄 Duplicate page control.
  - 🗑 Delete page control.
  - Reset button to restore original sequence.
- **Quick Sequence Input Mode**:
  - Comma-separated input for power users (e.g. `3, 1, 5, 2, 4`).
- **Single-Click Download**:
  - Streamlined download from `/api/v1/files/:outputFileId/download`.
