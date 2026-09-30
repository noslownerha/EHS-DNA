#!/bin/bash
# EHS DNA production deploy — /home/ehs-platform/deploy/deploy.sh
#
# Every deploy is reversible:
#   1. snapshots the database (consistent SQLite backup, not a file copy)
#   2. records the commit it's replacing in .last-deploy
#   3. fast-forwards to origin/main (refuses to create surprise merge commits)
#   4. builds (lint gate included), restarts, and checks the server came back
# Undo with:  bash /home/ehs-platform/deploy/rollback.sh
set -euo pipefail
APP=/home/ehs-platform
DB=$APP/data/ehs.db
SNAPDIR=/root/ehs-backups/pre-deploy
PORT=3000
cd "$APP"

PREV=$(git rev-parse --short HEAD)
echo "── Currently running: $PREV ──"

echo "── Snapshotting database ──"
mkdir -p "$SNAPDIR"
SNAP="$SNAPDIR/ehs-$(date +%Y%m%d-%H%M%S)-$PREV.db"
if [ -f "$DB" ]; then
  sqlite3 "$DB" ".backup '$SNAP'"
  echo "   $SNAP ($(du -h "$SNAP" | cut -f1))"
  # keep the 20 most recent pre-deploy snapshots
  { ls -1t "$SNAPDIR"/ehs-*.db 2>/dev/null || true; } | tail -n +21 | xargs -r rm -f
else
  SNAP=""
  echo "   (no database yet)"
fi
printf 'commit=%s\nsnapshot=%s\nat=%s\n' "$PREV" "$SNAP" "$(date -Is)" > "$APP/.last-deploy"

echo "── Pulling latest ──"
git fetch origin
if ! git merge --ff-only origin/main; then
  echo "!! Local changes on this server conflict with origin/main — nothing was changed."
  echo "   See: git status"
  exit 1
fi
NEW=$(git rev-parse --short HEAD)
if [ "$NEW" = "$PREV" ]; then echo "   Already up to date ($NEW)."; fi

echo "── Installing deps ──"
npm install
node -e "require('better-sqlite3')" 2>/dev/null || npm install better-sqlite3 --no-save --foreground-scripts

echo "── Building frontend (includes lint gate) ──"
npm run build

echo "── Restarting service ──"
if ! systemctl is-enabled ehs-dna >/dev/null 2>&1; then
  echo "systemd service not installed yet. One-time setup:"
  echo "  cp deploy/ehs-dna.service /etc/systemd/system/"
  echo "  echo \"EHS_JWT_SECRET=\$(openssl rand -hex 32)\" > /etc/ehs-dna.env && chmod 600 /etc/ehs-dna.env"
  echo "  systemctl daemon-reload && systemctl enable --now ehs-dna"
  exit 1
fi
systemctl restart ehs-dna

echo "── Health check ──"
for i in $(seq 1 20); do
  if curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then
    echo "✓ Live: $PREV → $NEW"
    echo "  Undo with: bash $APP/deploy/rollback.sh"
    exit 0
  fi
  sleep 1
done
echo "!! Server did not come back healthy. Last log lines:"
tail -n 30 /var/log/ehs-dna.log || true
echo "   Roll back with: bash $APP/deploy/rollback.sh"
exit 1
