# System Dependencies & External Binaries

This document details the external system dependencies utilized by QuickPDF Platform backend processors, their installation requirements, runtime health detection, and engine fallback architectures.

---

## 1. Overview of System Dependencies

While the majority of Phase 4 PDF operations (Merge, Split, Rotate, Organize, Resize, Watermark, Page Numbers, Protect, Unlock) run entirely within pure Node.js / TypeScript using `@cantoo/pdf-lib`, advanced operations utilize external system binaries when available for accelerated processing and ISO-standard re-distillation:

| Binary | Used By Modules | Primary Purpose | Required in Production? | Fallback When Absent |
|---|---|---|---|---|
| **`qpdf`** | `repair-pdf` (Phase 4.10) | Structural linearization, object xref table recovery, deep syntax repair | **Recommended** | Pure-TS xref & EOF reconstructor engine |
| **`ghostscript` (`gs`)** | `pdf-to-pdfa` (Phase 4.11), `repair-pdf` (Phase 4.10), `compress-pdf` (Phase 3) | Strict PostScript/PDF re-distillation, device-independent color conversion | **Recommended** | Pure-TS ISO 19005 engine with embedded sRGB ICC profile |

---

## 2. Minimum Version Requirements

| Dependency | Minimum Version | Recommended Version | Verification Command |
|---|---|---|---|
| **qpdf** | `>= 10.0.0` | `>= 11.5.0` | `qpdf --version` |
| **Ghostscript** | `>= 9.50` | `>= 10.02.0` | `gs --version` |

---

## 3. Installation Guide

### macOS (Homebrew)
```bash
brew update
brew install qpdf ghostscript
```

### Ubuntu / Debian (APT)
```bash
sudo apt-get update
sudo apt-get install -y qpdf ghostscript
```

### Red Hat / CentOS / Fedora (DNF/YUM)
```bash
sudo dnf install -y qpdf ghostscript
```

### Alpine Linux (Docker Containers)
```dockerfile
RUN apk update && apk add --no-cache \
    qpdf \
    ghostscript
```

---

## 4. Runtime Detection & Fallback Architecture

### 4.1 Repair PDF Pipeline (`repair.processor.ts`)
```
Input Corrupt PDF
       │
       ▼
┌───────────────────────────┐
│ Stage 1: Try qpdf         │ ───► Valid Output? ───► COMPLETED (method: 'qpdf')
└───────────────────────────┘
       │ Failed / Not found
       ▼
┌───────────────────────────┐
│ Stage 2: Try Ghostscript  │ ───► Valid Output? ───► COMPLETED (method: 'ghostscript')
└───────────────────────────┘
       │ Failed / Not found
       ▼
┌───────────────────────────┐
│ Stage 3: Pure-TS Engine   │ ───► Valid Output? ───► COMPLETED (method: 'engine-reconstruct')
│ Reconstruction Fallback   │
└───────────────────────────┘
       │ Failed validation
       ▼
     FAILED ("We couldn't repair this PDF. The document is severely corrupted.")
```
- External processes are executed safely using Node `child_process.spawn()` with isolated arguments (preventing command injection).
- If neither `qpdf` nor `gs` is installed on the host machine, Stage 3 cleanly executes in-process without crashing or hanging.

### 4.2 PDF/A Archival Pipeline (`pdfa.processor.ts`)
```
Input PDF
    │
    ▼
┌─────────────────────────────────┐
│ Stage 1: Try Ghostscript PDFA   │ ───► Passes AST Validation? ───► COMPLETED (ghostscript)
└─────────────────────────────────┘
    │ Unavailable / Failed
    ▼
┌─────────────────────────────────┐
│ Stage 2: Native Archival Engine │
│ - Embeds sRGB v2.1 ICC Profile  │
│ - Embeds ISO 19005 XMP Metadata │
│ - Registers /GTS_PDFA1 Intent   │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│ Stage 3: Independent AST        │ ───► PASS ───► COMPLETED (engine-archival)
│ Conformance Validator           │ ───► FAIL ───► FAILED ("PDF_CONVERSION_FAILED")
└─────────────────────────────────┘
```
- Native fallback creates a clean document AST, embeds a valid 548-byte sRGB v2.1 ICC color profile stream, and links it to `/DestOutputProfile` under `/OutputIntents`.
- Output is verified by `PdfaValidator` inspecting document dictionaries (no raw regex string fake-passes).

---

## 5. Automated Health Check Verification

To verify host system binary availability from command line:
```bash
# Check presence and paths
which qpdf gs

# Verify versions
qpdf --version
gs --version
```
In server startup logs, missing optional binaries are non-fatal; processors detect binary availability dynamically per job run.
