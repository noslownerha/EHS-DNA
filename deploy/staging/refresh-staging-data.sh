#!/bin/bash
# Reset staging's data.
#   bash /home/ehs-staging/deploy/staging/refresh-staging-data.sh demo   # fresh + demo company (default)
#   bash /home/ehs-staging/deploy/staging/refresh-staging-data.sh prod   # copy of LIVE data
#
# "prod" copies real people's records (every company, account and password) into
# staging. deploy-staging.sh does this on every deploy by default. Staging is
# password-protected, has its own login secret, and has email switched off.
set -euo pipefail
MODE="${1:-demo}"
APP=/home/ehs-staging
set -a; . /etc/ehs-dna-staging.env; set +a
DB="$EHS_DB_PATH"; PHOTOS="$EHS_PHOTO_DIR"
mkdir -p "$(dirname "$DB")" "$PHOTOS"
systemctl stop ehs-dna-staging
# Never leave staging stopped silently: on any failure from here, say where and restart it.
trap 'echo "!! Data refresh failed at line $LINENO — restarting staging on whatever data it has."; systemctl start ehs-dna-staging' ERR
rm -f "$DB" "$DB-wal" "$DB-shm"
if [ "$MODE" = "prod" ]; then
  echo "── Copying LIVE database + photos into staging ──"
  # .backup is a consistent snapshot even while live is being written to.
  sqlite3 /home/ehs-platform/data/ehs.db ".backup '$DB'"
  # `|| true`: live usually has no EHS_PHOTO_DIR line (it uses the default), and
  # under `set -o pipefail` a no-match grep silently killed the whole script here.
  LIVE_PHOTOS="$(grep -s '^EHS_PHOTO_DIR=' /etc/ehs-dna.env | cut -d= -f2- || true)"
  rsync -a --delete "${LIVE_PHOTOS:-/home/ehs-platform/data/photos}/" "$PHOTOS/"
  # Sanity: the copy must be readable and non-empty before staging starts on it.
  sqlite3 "$DB" "PRAGMA quick_check;" | grep -qx ok || { echo "!! Copied database failed its integrity check"; exit 1; }
  echo "   Copied: $(sqlite3 "$DB" "SELECT COUNT(*) FROM users") accounts, $(find "$PHOTOS" -type f | wc -l) photos."
elif [ "$MODE" = "demo" ]; then
  echo "── Fresh database + demo company ──"
  rm -rf "$PHOTOS"; mkdir -p "$PHOTOS"
  cd "$APP"
  node -e "
    const m = require('./server/db.cjs'); const db = m.db || m;
    const r = require('./server/demo.cjs').resetDemo(db);
    console.log('   Demo company rebuilt:', r.name);
    for (const l of r.logins) console.log('   ' + l.role + ': ' + l.email + ' / ' + l.password);
  " 2>&1 | grep -vE 'Backfilled|ExperimentalWarning|trace-warnings|SQLite engine'
else
  echo "Usage: $0 demo|prod"; exit 1
fi
systemctl start ehs-dna-staging
echo "✓ Staging data reset ($MODE)."
