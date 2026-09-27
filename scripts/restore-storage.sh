#!/usr/bin/env bash
set -euo pipefail

# QuickPDF Production Storage & Database Restore Script (Launch Plan Item 4 & 42)
# Usage: ./scripts/restore-storage.sh <backup_folder_path>

if [ $# -lt 1 ]; then
  echo "Usage: $0 <path_to_backup_folder>"
  exit 1
fi

BACKUP_DIR="$1"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ ! -d "$BACKUP_DIR" ]; then
  echo "❌ Error: Backup folder '$BACKUP_DIR' does not exist."
  exit 1
fi

echo "=== Restoring QuickPDF from $BACKUP_DIR ==="

# 1. Verify Checksums
if [ -f "$BACKUP_DIR/SHA256SUMS" ]; then
  echo "🔍 Verifying checksums..."
  (cd "$BACKUP_DIR" && shasum -a 256 -c SHA256SUMS)
fi

# 2. Restore Storage
STORAGE_BACKUP="$BACKUP_DIR/storage_backup.tar.gz"
if [ -f "$STORAGE_BACKUP" ]; then
  STORAGE_ROOT="${STORAGE_ROOT:-$PROJECT_ROOT/backend/uploads}"
  echo "📦 Restoring storage to $(dirname "$STORAGE_ROOT") ..."
  mkdir -p "$(dirname "$STORAGE_ROOT")"
  tar -xzf "$STORAGE_BACKUP" -C "$(dirname "$STORAGE_ROOT")"
  echo "✅ Storage files restored."
fi

# 3. Restore Database
if [ -f "$BACKUP_DIR/database_sqlite.db.gz" ]; then
  SQLITE_DB="$PROJECT_ROOT/backend/prisma/dev.db"
  echo "📦 Restoring SQLite database to $SQLITE_DB ..."
  mkdir -p "$(dirname "$SQLITE_DB")"
  gunzip -c "$BACKUP_DIR/database_sqlite.db.gz" > "$SQLITE_DB"
  echo "✅ SQLite database restored."
elif [ -f "$BACKUP_DIR/database_postgres.sql.gz" ]; then
  if [[ -n "${DATABASE_URL:-}" ]]; then
    echo "📦 Restoring PostgreSQL database from $BACKUP_DIR/database_postgres.sql.gz ..."
    gunzip -c "$BACKUP_DIR/database_postgres.sql.gz" | psql "$DATABASE_URL"
    echo "✅ PostgreSQL database restored."
  else
    echo "⚠️ Warning: DATABASE_URL not set, cannot restore PostgreSQL database automatically."
  fi
fi

echo "=== Restore completed successfully ==="
