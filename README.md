# QuickPDF Platform

> Enterprise-grade, high-performance PDF manipulation and document processing platform built on an asynchronous job queue architecture with full multi-tenant isolation.

---

## 📌 Project Overview

QuickPDF Platform provides robust PDF workflows ranging from core document operations (merging, splitting, rotating, resizing, protecting, repair, PDF/A archiving) to interactive client-side vector text editing. 

The architecture strictly decouples the client from long-running operations:
1. **Frontend**: Next.js 16 (React 19) web application with client-side canvas rendering and centralized API client layer.
2. **V1 REST API**: Express 5 asynchronous endpoints for authentication, file intake, job lifecycle management, and editor operations.
3. **Processing Engines**: Specialized, sandboxed processors for manipulation tasks with automatic fallback mechanisms.
4. **Data & Storage Layer**: Centralized Prisma database access and user-isolated file system storage.

---

## 💻 Tech Stack

### Frontend
- **Framework**: Next.js 16.3 (Turbopack, App Router)
- **UI & State**: React 19.2, Redux Toolkit, Lucide React, Tailwind CSS 4
- **PDF Engine**: PDF.js (v4.10), pdf-lib (v1.17)
- **Language**: TypeScript 5 (Strict Mode)

### Backend
- **Framework**: Express 5.2, Node.js 18+
- **ORM & Data**: Prisma 5.22, SQLite (Development) / PostgreSQL (Production)
- **PDF Processing**: `@cantoo/pdf-lib`, `node-qpdf`, `sharp`, `tesseract.js`, `mammoth`, `xlsx`, `puppeteer`
- **Security & Ops**: Helmet, CORS, Express Rate Limit, Cookie Parser, Bcrypt, JsonWebToken, Nodemailer

---

## 🗄️ Database Configuration

| Environment | Database Engine | Connection String | Notes |
|---|---|---|---|
| **Development** | **SQLite** | `file:./dev.db` | Lightweight, zero-config local file database used for rapid local development and automated regression testing. |
| **Production** | **PostgreSQL** | `postgresql://USER:PASSWORD@HOST:PORT/DB` | High-concurrency relational database with connection pooling and schema migrations for production deployments. |

> [!NOTE]
> During Phase 1 stabilization, SQLite remains active for development and test execution. The schema in [`backend/prisma/schema.prisma`](file:///Users/samiransari/Desktop/Project/pdf_platform/backend/prisma/schema.prisma) is normalized and ready for seamless migration to PostgreSQL in production environments.

---

## ⚙️ Requirements & Prerequisites

- **Node.js**: `>= 18.0.0` (LTS recommended)
- **npm**: `>= 9.0.0`
- **Optional System Binaries** (for hardware-accelerated repair & PDF/A distillation):
  - `qpdf` (`>= 10.0`): `brew install qpdf` (macOS) / `apt-get install -y qpdf` (Ubuntu/Debian)
  - `ghostscript` (`>= 9.50`): `brew install ghostscript` (macOS) / `apt-get install -y ghostscript` (Ubuntu/Debian)
  *(Pure TypeScript fallbacks are automatically utilized if external binaries are absent.)*

---

## 🚀 Installation & Setup

### 1. Clone & Setup Workspace
```bash
git clone <repository-url> pdf_platform
cd pdf_platform
```

### 2. Environment Variables Configuration
Copy the template files into place:
```bash
# Root template
cp .env.example .env

# Backend configuration
cp backend/.env.example backend/.env
```

Ensure `backend/.env` contains your desired local configuration:
```env
# Database
DATABASE_URL="file:./dev.db"

# Server & Security
PORT=3001
FRONTEND_URL=http://localhost:3000
JWT_SECRET=your_jwt_secret_key_change_in_production
STORAGE_PROVIDER=local

# SMTP / Email Configuration for OTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
EMAIL_FROM="PDF Platform" <your_email@gmail.com>

# OpenAI API (Optional - for AI summarize & chat tools)
OPENAI_API_KEY=your_openai_api_key
```

### 3. Backend Setup & Prisma Initialization
```bash
cd backend
npm install
npx prisma generate
npx prisma db push
npm run build
```

### 4. Frontend Setup
```bash
cd ../frontend
npm install
npm run build
```

---

## 🏃 Running the Application

### Development Mode
In separate terminal tabs:

**Terminal 1 — Backend API Server (Port 3001)**:
```bash
cd backend
npm run dev
```

**Terminal 2 — Frontend Next.js Server (Port 3000)**:
```bash
cd frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing Infrastructure

Execute the comprehensive automated test suites:
```bash
cd backend

# Run the complete regression test suite (Phase 2 through Phase 5.5)
npm test

# Run individual tool test suites
npm run test:merge          # Phase 4.1 Merge PDF
npm run test:split          # Phase 4.2 Split PDF
npm run test:rotate         # Phase 4.3 Rotate PDF
npm run test:organize       # Phase 4.4 Organize PDF
npm run test:resize         # Phase 4.5 Resize PDF
npm run test:watermark      # Phase 4.6 Watermark PDF
npm run test:page-numbers   # Phase 4.7 Page Numbers
npm run test:protect        # Phase 4.8 & 4.9 Protect & Unlock PDF
npm run test:repair         # Phase 4.10 Repair PDF
npm run test:pdfa           # Phase 4.11 PDF to PDF/A
npm run test:phase4         # Phase 4 Consolidated Runner (10 tools)
```

---

## 🌐 API Architecture

```
Frontend (Next.js)
       │
       ▼
/api/v1/* (Standardized V1 REST API)
  ├── /files          (Upload, download, list, metadata, deletion)
  ├── /jobs           (Asynchronous job queue & status tracking)
  └── /editor         (PDF Editor validation & manifest export)
       │
       ▼
Services & Domain Processors
  ├── files.service.ts
  ├── job.service.ts
  └── pdf/processors/*
       │
       ▼
Persistence & File Isolation Layer
  ├── Database: Centralized Prisma Client (common/prisma.ts)
  └── Storage: Isolated directory hierarchy (uploads/users/{userId}/)
```

### API Response Envelope Standard
All V1 API endpoints return predictable response envelopes:

**Success Response**:
```json
{
  "success": true,
  "data": { ... }
}
```

**Error Response**:
```json
{
  "success": false,
  "error": {
    "code": "FILE_NOT_FOUND",
    "message": "The requested file was not found."
  }
}
```

### Legacy Route Status
In production, legacy endpoints (`/api/documents/*`, `/api/pdf/*`) are permanently disabled. All production traffic and tools strictly execute through `/api/v1/*` (`/api/v1/files`, `/api/v1/jobs`, `/api/v1/files/:id/download`).

---

## 🚀 Production Deployment & Database Wiring

### PostgreSQL Schema & Migration Architecture
QuickPDF features a dedicated production PostgreSQL schema and migration pipeline:
- **Production Schema**: `backend/prisma/schema.postgresql.prisma` and `backend/prisma/postgresql/schema.prisma`
- **PostgreSQL Migrations**: `backend/prisma/postgresql/migrations/`
- **Production Provider**: `postgresql`

### Exact Production Deployment Sequence
```bash
cd backend

# 1. Generate Prisma Client for PostgreSQL
npm run prisma:generate:prod
# or: npx prisma generate --schema=prisma/schema.postgresql.prisma

# 2. Deploy PostgreSQL database migrations
npm run prisma:migrate:prod
# or: npx prisma migrate deploy --schema=prisma/postgresql/schema.prisma

# 3. Verify TypeScript build
npm run build:prod

# 4. Start production server
npm run start
```
Alternatively, execute the automated deployment runner:
```bash
bash scripts/deploy-production.sh
```

---

## 🛠️ Current Tools Status (Launch Reality)

Out of all tools in the platform, tools are classified into 2 primary operational levels for initial Beta launch:

### 🟢 READY (12 Core Production PDF Tools)
Fully backed by the persistent DB queue, quota tracking, atomic worker claims, and automated test coverage:
1. **Merge PDF** (`/tools/merge-pdf`)
2. **Split PDF** (`/tools/split-pdf`)
3. **Compress PDF** (`/tools/compress-pdf`)
4. **Rotate PDF** (`/tools/rotate-pdf`)
5. **Organize PDF** (`/tools/organize-pdf`)
6. **Resize PDF** (`/tools/resize-pdf`)
7. **Watermark PDF** (`/tools/watermark`)
8. **Page Numbers** (`/tools/page-numbers`)
9. **Protect PDF** (`/tools/protect-pdf`)
10. **Unlock PDF** (`/tools/unlock-pdf`)
11. **Repair PDF** (`/tools/repair-pdf`)
12. **PDF to PDF/A** (`/tools/pdf-to-pdfa`)

### ⚪ COMING SOON (Upcoming Tools)
Clearly designated on the UI with "Coming Soon" badges:
- PDF to Word, PDF to PowerPoint, PDF to Excel
- Word to PDF, PowerPoint to PDF, Excel to PDF
- PDF to JPG, JPG to PDF
- Sign PDF, OCR PDF, AI Summarizer, Chat with PDF, etc.

---

## 🔒 Security Hardening & Zero-Leakage Guarantee

- **Mandatory Production SMTP**: `config.ts` strictly validates `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `EMAIL_FROM` on production startup. Application refuses to start if missing; Ethereal fallback is forbidden in production.
- **Zero Plaintext OTP Logging**: OTPs and verification codes are never logged, printed to console, or stored plaintext. Only HMAC-SHA256 hashes are persisted in the database.
- **Multi-Tenant Storage Isolation**: Files are isolated under `users/{userId}/` with randomized disk filenames.
- **Path Traversal Protection**: User IDs, file paths, and storage keys are strictly validated against directory traversal and symlink poisoning.
- **Request Size Controls**: 50MB per-file upload limit, 100MB per-user quota, and 10MB JSON body limit.
- **Strict V1 Routing**: Legacy `/api/pdf` and `/api/documents` routes are disabled in production; all operations run through `/api/v1/files` and `/api/v1/jobs`.
