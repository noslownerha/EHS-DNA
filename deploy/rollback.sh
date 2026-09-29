#!/bin/bash
# EHS DNA rollback — undo the last production deploy.
#
#   bash /home/ehs-platform/deploy/rollback.sh            # code only (keeps all data)
#   bash /home/ehs-platform/deploy/rollback.sh --with-db  # code AND database
#
# Code-only is the normal choice: every schema change in this app is additive,
# so older code runs fine on the newer database, and nothing entered since the
# deploy is lost. Use --with-db only if the deploy damaged data — it restores the
# pre-deploy snapshot, so ANYTHING entered after the deploy is lost (a copy of
# the current database is kept first, just in case).
set -euo pipefail
APP=/home/ehs-platform
DB=$APP/data/ehs.db
cd "$APP"
[ -f .last-deploy ] || { echo "No .last-deploy record — nothing to roll back to."; exit 1; }
# shellcheck disable=SC1091
source <(grep -E '^(commit|snapshot|at)=' .last-deploy)
echo "Rolling back to $commit (deployed over at $at)"

git fetch origin --quiet || true
git reset --hard "$commit"
npm install
node -e "require('better-sqlite3')" 2>/dev/null || npm install better-sqlite3 --no-save --foreground-scripts
npm run build

if [ "${1:-}" = "--with-db" ]; then
  [ -n "${snapshot:-}" ] && [ -f "$snapshot" ] || { echo "Snapshot missing: ${snapshot:-none}. Code rolled back; database left as is."; systemctl restart ehs-dna; exit 1; }
  systemctl stop ehs-dna
  KEEP="/root/ehs-backups/pre-rollback-$(date +%Y%m%d-%H%M%S).db"
  sqlite3 "$DB" ".backup '$KEEP'" && echo "Current database kept at $KEEP"
  rm -f "$DB-wal" "$DB-shm"
  cp "$snapshot" "$DB"
  echo "Database restored from $snapshot"
fi
systemctl restart ehs-dna
sleep 2
curl -fsS http://127.0.0.1:3000/api/health >/dev/null && echo "✓ Rolled back to $commit and healthy." || { echo "!! Not healthy — check /var/log/ehs-dna.log"; exit 1; }
echo "Note: origin/main still has the newer commit, so the next deploy.sh would re-apply it."
echo "Tell Claude what went wrong so the fix lands on main before redeploying."
