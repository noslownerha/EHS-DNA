#!/bin/bash
# EHS DNA nightly database backup — 30-day retention.
# Install: crontab -e  →  15 2 * * * /home/ehs-platform/deploy/backup.sh
set -euo pipefail

DB="/home/ehs-platform/data/ehs.db"
DEST="/home/ehs-platform/backups"
STAMP=$(date +%Y%m%d-%H%M)

mkdir -p "$DEST"

# Safe online backup (works while the app is running, respects WAL)
sqlite3 "$DB" ".backup '$DEST/ehs-$STAMP.db'"
gzip "$DEST/ehs-$STAMP.db"

# Retention: delete backups older than 30 days
find "$DEST" -name "ehs-*.db.gz" -mtime +30 -delete

echo "$(date -Is) backup ok: ehs-$STAMP.db.gz" >> "$DEST/backup.log"
