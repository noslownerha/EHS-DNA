#!/bin/bash
# Reset staging's data.
#   bash /home/ehs-staging/deploy/staging/refresh-staging-data.sh demo   # fresh + demo company (default)
#   bash /home/ehs-staging/deploy/staging/refresh-staging-data.sh prod   # copy of LIVE data
#
# "prod" copies real people's records into staging. Staging is password-protected
# and has email switched off, but treat it as live data: use it to reproduce a
# real bug, then refresh back to demo.
set -euo pipefail
MODE="${1:-demo}"
APP=/home/ehs-staging
set -a; . /etc/ehs-dna-staging.env; set +a
DB="$EHS_DB_PATH"; PHOTOS="$EHS_PHOTO_DIR"
mkdir -p "$(dirname "$DB")" "$PHOTOS"
systemctl stop ehs-dna-staging
rm -f "$DB" "$DB-wal" "$DB-shm"
if [ "$MODE" = "prod" ]; then
  echo "── Copying LIVE database + photos into staging ──"
  sqlite3 /home/ehs-platform/data/ehs.db ".backup '$DB'"
  rsync -a --delete /home/ehs-platform/data/photos/ "$PHOTOS/"
  echo "   Done. Sign in with your normal live accounts."
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
