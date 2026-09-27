#!/bin/bash
set -e

# ==============================================================================
# QuickPDF Platform - Clean Release Packaging Script
# Excludes runtime/test artifacts, uploads, databases, node_modules, and secrets
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PARENT_DIR="$(cd "$ROOT_DIR/.." && pwd)"
OUTPUT_ZIP="$PARENT_DIR/pdf_platform.zip"

echo "=========================================================="
echo "📦 Packaging Clean QuickPDF Platform Release Archive"
echo "=========================================================="
echo "Source: $ROOT_DIR"
echo "Output: $OUTPUT_ZIP"

# 1. Clean test runtime uploads from disk
find "$ROOT_DIR/backend/uploads" -mindepth 1 -not -name ".gitkeep" -delete 2>/dev/null || true
mkdir -p "$ROOT_DIR/backend/uploads"
touch "$ROOT_DIR/backend/uploads/.gitkeep"

# 2. Clean any local SQLite database files, journal, wal, shm, and test DBs from disk
echo "🧹 Cleaning SQLite databases and test DB artifacts from disk..."
find "$ROOT_DIR" -type f \( -name "*.db" -o -name "*.db-journal" -o -name "*.db-wal" -o -name "*.db-shm" -o -name "*.db.bak" -o -name "*.sqlite" -o -name "*.sqlite3" \) -delete 2>/dev/null || true
rm -rf "$ROOT_DIR/backend/prisma/prisma" 2>/dev/null || true

# 3. Remove transient local OS/compiler files before zipping
find "$ROOT_DIR" -name ".DS_Store" -delete 2>/dev/null || true
find "$ROOT_DIR" -name "*.tsbuildinfo" -delete 2>/dev/null || true
find "$ROOT_DIR" -name "*.log" -delete 2>/dev/null || true

TEMP_ZIP="$PARENT_DIR/release_temp.zip"
rm -f "$TEMP_ZIP" "$OUTPUT_ZIP" "$ROOT_DIR/pdf_platform.zip"

cd "$PARENT_DIR"

# 4. Build clean zip archive excluding runtime/test artifacts, node_modules, .next, and secrets
zip -r "$TEMP_ZIP" "pdf_platform" \
  -x "*/node_modules/*" \
  -x "*/node_modules" \
  -x "*/.next/*" \
  -x "*/.next" \
  -x "*/dist/*" \
  -x "*/dist" \
  -x "*/.git/*" \
  -x "*/.vscode/*" \
  -x "*/.DS_Store" \
  -x "*.DS_Store" \
  -x "*/tsconfig.tsbuildinfo" \
  -x "*.tsbuildinfo" \
  -x "*/backend/uploads/*" \
  -x "*.db" \
  -x "*/*.db" \
  -x "*/*/*.db" \
  -x "*/*/*/*.db" \
  -x "*/*/*/*/*.db" \
  -x "*.db-journal" \
  -x "*/*.db-journal" \
  -x "*/*/*.db-journal" \
  -x "*/*/*/*.db-journal" \
  -x "*.db-wal" \
  -x "*/*.db-wal" \
  -x "*/*/*.db-wal" \
  -x "*.db-shm" \
  -x "*/*.db-shm" \
  -x "*/*/*.db-shm" \
  -x "*.db.bak" \
  -x "*/*.db.bak" \
  -x "*/*/*.db.bak" \
  -x "*.sqlite*" \
  -x "*/*.sqlite*" \
  -x "*/*/*.sqlite*" \
  -x "*/.env" \
  -x "*/.env.local" \
  -x "*/.env.production" \
  -x "*/.env.development" \
  -x "*/.env.test" \
  -x ".env" \
  -x ".env.local" \
  -x ".env.production" \
  -x ".env.development" \
  -x ".env.test" \
  -x "*.log" \
  -x "*/*.log" \
  -x "*/.cache/*" \
  -x "*/scratch/*" \
  -x "*/backend/scratch/*" \
  -x "*/backups/*" \
  -x "*/backups" \
  -x "pdf_platform/*.zip" \
  -x "*.zip"

# Ensure backend/uploads/.gitkeep placeholder is explicitly present
zip "$TEMP_ZIP" "pdf_platform/backend/uploads/.gitkeep"

# 5. Automated Verification of ZIP contents
echo "🔍 Verifying release archive contents for prohibited files..."
FORBIDDEN_FILES=$(unzip -l "$TEMP_ZIP" | grep -E '\.(db|db-journal|db-wal|db-shm|db\.bak|sqlite|sqlite3)$|/\.env$|/\.env\.(local|production|development|test)$|node_modules/|\.next/' || true)

if [ -n "$FORBIDDEN_FILES" ]; then
  echo "❌ FATAL: Prohibited files detected in release package:"
  echo "$FORBIDDEN_FILES"
  rm -f "$TEMP_ZIP"
  exit 1
fi

mv -f "$TEMP_ZIP" "$OUTPUT_ZIP"
cp -f "$OUTPUT_ZIP" "$ROOT_DIR/pdf_platform.zip"

ZIP_SIZE=$(du -h "$OUTPUT_ZIP" | cut -f1)

echo "=========================================================="
echo "✅ Release package successfully generated & verified!"
echo "🛡️ Zero prohibited files (*.db, *.env, node_modules, .next)"
echo "📦 File: $OUTPUT_ZIP ($ZIP_SIZE)"
echo "📦 Root: $ROOT_DIR/pdf_platform.zip"
echo "=========================================================="

# 6. Re-sync local dev database schema so local IDE/tests remain ready
(cd "$ROOT_DIR/backend" && npx prisma db push --skip-generate >/dev/null 2>&1 || true)
