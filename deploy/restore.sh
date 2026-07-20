#!/bin/bash
# EHS DNA database restore — from a local or Backblaze B2 backup.
#
# A backup you have never restored is a hope, not a backup. Run this at least once
# as a REHEARSAL against a scratch path (--verify) before you ever need it for real.
#
# Usage:
#   # Rehearsal (safe): restore the latest local backup to a scratch DB and
#   # integrity-check it. Touches nothing the live app uses.
#   deploy/restore.sh --verify
#
#   # Rehearsal from a specific archive:
#   deploy/restore.sh --verify /home/ehs-platform/backups/ehs-20260719-0215.db.gz
#
#   # REAL restore over the live database (stops the app, backs up the current
#   # DB first, restores, restarts). Requires typing the confirmation phrase.
#   deploy/restore.sh --live /home/ehs-platform/backups/ehs-20260719-0215.db.gz
#
#   # Pull an archive from B2 first, then restore it:
#   deploy/restore.sh --from-b2 ehs-20260719-0215.db.gz --verify
#
set -euo pipefail

DB="/home/ehs-platform/data/ehs.db"
DEST="/home/ehs-platform/backups"
ENV_FILE="/home/ehs-platform/deploy/backup.env"
[ -f "$ENV_FILE" ] && source "$ENV_FILE"
RCLONE_REMOTE="${RCLONE_REMOTE:-b2}"
B2_BUCKET="${B2_BUCKET:-ehsdna-backups}"

MODE=""          # verify | live
ARCHIVE=""
FROM_B2=""

while [ $# -gt 0 ]; do
  case "$1" in
    --verify) MODE="verify"; shift ;;
    --live)   MODE="live";   shift ;;
    --from-b2) FROM_B2="$2";  shift 2 ;;
    *.db.gz|*.db) ARCHIVE="$1"; shift ;;
    *) echo "Unknown arg: $1"; exit 2 ;;
  esac
done
[ -z "$MODE" ] && { echo "Specify --verify (safe rehearsal) or --live (real restore)."; exit 2; }

# Pull from B2 if asked.
if [ -n "$FROM_B2" ]; then
  echo "Fetching $FROM_B2 from $RCLONE_REMOTE:$B2_BUCKET …"
  rclone copy "$RCLONE_REMOTE:$B2_BUCKET/$FROM_B2" "$DEST/" --no-traverse
  ARCHIVE="$DEST/$FROM_B2"
fi

# Default to the newest local archive if none specified.
if [ -z "$ARCHIVE" ]; then
  ARCHIVE=$(ls -1t "$DEST"/ehs-*.db.gz 2>/dev/null | head -1 || true)
  [ -z "$ARCHIVE" ] && { echo "No backups found in $DEST"; exit 1; }
  echo "Using latest backup: $ARCHIVE"
fi
[ -f "$ARCHIVE" ] || { echo "Archive not found: $ARCHIVE"; exit 1; }

# Decompress to a temp working copy (never touch the archive itself).
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
CANDIDATE="$WORK/restored.db"
if [[ "$ARCHIVE" == *.gz ]]; then
  gunzip -c "$ARCHIVE" > "$CANDIDATE"
else
  cp "$ARCHIVE" "$CANDIDATE"
fi

# Integrity + sanity checks on the restored copy before trusting it.
echo "Integrity check…"
INTEG=$(sqlite3 "$CANDIDATE" "PRAGMA integrity_check;")
if [ "$INTEG" != "ok" ]; then
  echo "FAILED integrity_check: $INTEG"; exit 1
fi
TENANTS=$(sqlite3 "$CANDIDATE" "SELECT COUNT(*) FROM tenants;")
USERS=$(sqlite3 "$CANDIDATE" "SELECT COUNT(*) FROM users;")
INCIDENTS=$(sqlite3 "$CANDIDATE" "SELECT COUNT(*) FROM incidents;")
echo "  integrity: ok"
echo "  tenants:   $TENANTS"
echo "  users:     $USERS"
echo "  incidents: $INCIDENTS"
if [ "$TENANTS" -lt 1 ] || [ "$USERS" -lt 1 ]; then
  echo "Refusing: restored DB has no tenants/users — looks empty or wrong."; exit 1
fi

if [ "$MODE" = "verify" ]; then
  echo ""
  echo "✅ REHEARSAL OK. This archive restores to a healthy, non-empty database."
  echo "   (Nothing on the live system was changed.)"
  echo "   Restored copy was at: $CANDIDATE (removed on exit)"
  exit 0
fi

# ── LIVE restore from here down ──────────────────────────────────────────────
echo ""
echo "⚠️  LIVE RESTORE will REPLACE the running database at:"
echo "    $DB"
echo "    with the contents of: $ARCHIVE"
echo "    ($TENANTS tenants, $USERS users, $INCIDENTS incidents)"
echo ""
read -r -p 'Type exactly  RESTORE LIVE  to proceed: ' CONFIRM
[ "$CONFIRM" = "RESTORE LIVE" ] || { echo "Aborted."; exit 1; }

echo "Stopping app…"
systemctl stop ehs-dna || true

# Safety net: snapshot the CURRENT db before overwriting, so a bad restore is undoable.
if [ -f "$DB" ]; then
  PRE="$DEST/pre-restore-$(date +%Y%m%d-%H%M%S).db"
  sqlite3 "$DB" ".backup '$PRE'" && gzip "$PRE"
  echo "Current DB saved to ${PRE}.gz (undo point)."
fi

# Replace DB; clear WAL/SHM/journal sidecars so SQLite doesn't replay a stale journal.
cp "$CANDIDATE" "$DB"
rm -f "$DB-wal" "$DB-shm" "$DB-journal"
chown --reference="$DEST" "$DB" 2>/dev/null || true

echo "Starting app…"
systemctl start ehs-dna
sleep 2
if curl -fs http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
  echo "✅ Restore complete and app healthy."
else
  echo "⚠️  App did not report healthy after restart — check: journalctl -u ehs-dna -n 50"
  exit 1
fi
