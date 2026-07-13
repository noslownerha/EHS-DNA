#!/bin/bash
# EHS DNA nightly database backup.
#   Local:  /home/ehs-platform/backups  — 30-day retention, fast restore.
#   Remote: Backblaze B2 (off-vendor)   — 365-day retention, disaster copy.
#
# Install cron:  (crontab -l 2>/dev/null; echo "15 2 * * * /home/ehs-platform/deploy/backup.sh") | crontab -
#
# One-time B2 setup on this box:
#   sudo apt install -y rclone
#   rclone config      # remote name "b2", type=b2, scoped Application Key
# Then set B2_BUCKET below (or via /home/ehs-platform/deploy/backup.env).
#
# Exit non-zero (fail loudly) if the off-site push fails — the local backup is
# still kept, so cron's failure mail / your monitor flags the missing off-site copy.
set -euo pipefail

DB="/home/ehs-platform/data/ehs.db"
PHOTOS="/home/ehs-platform/data/photos"     # image bytes live on disk, not in the DB
DEST="/home/ehs-platform/backups"
STAMP=$(date +%Y%m%d-%H%M)
LOG="$DEST/backup.log"

# Optional overrides (keeps secrets/config out of the repo)
ENV_FILE="/home/ehs-platform/deploy/backup.env"
[ -f "$ENV_FILE" ] && source "$ENV_FILE"

RCLONE_REMOTE="${RCLONE_REMOTE:-b2}"           # rclone remote name
B2_BUCKET="${B2_BUCKET:-ehsdna-backups}"       # bucket name
REMOTE_RETENTION_DAYS="${REMOTE_RETENTION_DAYS:-365}"

mkdir -p "$DEST"

log() { echo "$(date -Is) $*" >> "$LOG"; }

# 1. Local backup (online .backup respects WAL; safe while app runs)
sqlite3 "$DB" ".backup '$DEST/ehs-$STAMP.db'"
gzip "$DEST/ehs-$STAMP.db"
ARCHIVE="$DEST/ehs-$STAMP.db.gz"
log "local ok: ehs-$STAMP.db.gz ($(du -h "$ARCHIVE" | cut -f1))"

# Local retention: 30 days
find "$DEST" -name "ehs-*.db.gz" -mtime +30 -delete

# 2. Off-site push to Backblaze B2
if ! command -v rclone >/dev/null 2>&1; then
  log "FAIL off-site: rclone not installed — local backup kept"
  echo "backup.sh: rclone missing, off-site copy NOT made" >&2
  exit 1
fi

if ! rclone copy "$ARCHIVE" "$RCLONE_REMOTE:$B2_BUCKET/" --no-traverse 2>>"$LOG"; then
  log "FAIL off-site: rclone copy to $RCLONE_REMOTE:$B2_BUCKET failed — local backup kept"
  echo "backup.sh: B2 upload FAILED, off-site copy NOT made" >&2
  exit 1
fi
log "off-site ok: $RCLONE_REMOTE:$B2_BUCKET/ehs-$STAMP.db.gz"

# 3. Photos. These used to live as base64 inside the DB (so the dump covered them);
#    they are now files on disk and MUST be backed up separately or an incident's
#    evidence is lost. `sync` is incremental — only new/changed photos upload, and
#    since each file is content-addressed by uuid it is written once and never
#    rewritten. Photos are NOT deleted from B2 when removed locally (--no-delete
#    behaviour via copy), because compliance evidence should not vanish.
if [ -d "$PHOTOS" ]; then
  if ! rclone copy "$PHOTOS" "$RCLONE_REMOTE:$B2_BUCKET/photos/" 2>>"$LOG"; then
    log "FAIL off-site: photo sync to $RCLONE_REMOTE:$B2_BUCKET/photos failed"
    echo "backup.sh: photo upload FAILED" >&2
    exit 1
  fi
  PHOTO_COUNT=$(find "$PHOTOS" -type f | wc -l)
  log "off-site ok: photos synced ($PHOTO_COUNT file(s), $(du -sh "$PHOTOS" 2>/dev/null | cut -f1))"
fi

# Remote retention: purge B2 objects older than REMOTE_RETENTION_DAYS
# NB: --include "ehs-*.db.gz" deliberately scopes this to DB dumps only. Photos are
# evidence attached to compliance records and are never purged.
if ! rclone delete "$RCLONE_REMOTE:$B2_BUCKET/" --min-age "${REMOTE_RETENTION_DAYS}d" --include "ehs-*.db.gz" 2>>"$LOG"; then
  log "WARN off-site retention purge failed (backup itself succeeded)"
fi

log "backup complete: local + off-site"
