#!/usr/bin/env bash
set -euo pipefail

# QuickPDF Production Storage & Database Backup Script (Launch Plan Item 4 & 42)
# Usage: ./scripts/backup-storage.sh [backup_dir]

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${1:-$PROJECT_ROOT/backups}"
TIMESTAMP="$(date +"%Y%m%d_%H%M%S")"
TARGET_DIR="$BACKUP_DIR/$TIMESTAMP"

mkdir -p "$TARGET_DIR"

echo "=== Starting QuickPDF Backup ($TIMESTAMP) ==="

# 1. Backup Storage / Uploads directory
STORAGE_ROOT="${STORAGE_ROOT:-$PROJECT_ROOT/backend/uploads}"
if [ -d "$STORAGE_ROOT" ]; then
  echo "📦 Backing up storage directory: $STORAGE_ROOT ..."
  tar -czf "$TARGET_DIR/storage_backup.tar.gz" -C "$(dirname "$STORAGE_ROOT")" "$(basename "$STORAGE_ROOT")"
  echo "✅ Storage backup archived to $TARGET_DIR/storage_backup.tar.gz"
else
  echo "⚠️ Warning: Storage directory $STORAGE_ROOT does not exist, skipping."
fi

# 2. Backup Database
if [[ "${DATABASE_URL:-}" == *"postgresql://"* ]] || [[ "${DATABASE_URL:-}" == *"postgres://"* ]]; then
  echo "📦 Backing up PostgreSQL database from DATABASE_URL ..."
  pg_dump "$DATABASE_URL" | gzip > "$TARGET_DIR/database_postgres.sql.gz"
  echo "✅ PostgreSQL backup saved to $TARGET_DIR/database_postgres.sql.gz"
else
  SQLITE_DB="$PROJECT_ROOT/backend/prisma/dev.db"
  if [ -f "$SQLITE_DB" ]; then
    echo "📦 Backing up SQLite database: $SQLITE_DB ..."
    sqlite3 "$SQLITE_DB" ".backup '$TARGET_DIR/database_sqlite.db'"
    gzip -c "$TARGET_DIR/database_sqlite.db" > "$TARGET_DIR/database_sqlite.db.gz"
    rm -f "$TARGET_DIR/database_sqlite.db"
    echo "✅ SQLite backup saved to $TARGET_DIR/database_sqlite.db.gz"
  fi
fi

# 3. Create backup manifest with SHA256 checksums
cd "$TARGET_DIR"
shasum -a 256 *.gz > SHA256SUMS
echo "=== Backup completed successfully in $TARGET_DIR ==="
cat SHA256SUMS
