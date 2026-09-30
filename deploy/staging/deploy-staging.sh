#!/bin/bash
# Deploy the latest `staging` branch to staging.ehsdna.com, running it against a
# FRESH COPY OF LIVE DATA (every company, account and password, plus photos).
#
#   bash /home/ehs-staging/deploy/staging/deploy-staging.sh              # refresh live data (default)
#   bash /home/ehs-staging/deploy/staging/deploy-staging.sh --keep-data  # keep staging's current data
#
# Why copy first: the new code's database changes then run against real data here,
# before they ever touch live. Email stays OFF in staging, so nobody is messaged.
set -euo pipefail

# git reset below rewrites this very file; bash reads scripts as it runs them, so
# run from a private copy to avoid executing a half-old, half-new script.
if [ -z "${EHS_STG_COPY:-}" ]; then
  tmp=$(mktemp /tmp/deploy-staging.XXXXXX.sh); cp "$0" "$tmp"
  EHS_STG_COPY=1 exec bash "$tmp" "$@"
fi

APP=/home/ehs-staging
KEEP=0; [ "${1:-}" = "--keep-data" ] && KEEP=1
cd "$APP"
echo "── Fetching staging branch ──"
git fetch origin
git checkout -q staging
git reset -q --hard origin/staging      # staging always matches GitHub exactly
echo "   $(git log -1 --format='%h  %s')"
npm install --silent
node -e "require('better-sqlite3')" 2>/dev/null || npm install better-sqlite3 --no-save --foreground-scripts
echo "── Building (includes lint gate) ──"
npm run build

if [ "$KEEP" = "1" ]; then
  echo "── Keeping staging's current data ──"
  systemctl restart ehs-dna-staging
else
  bash "$APP/deploy/staging/refresh-staging-data.sh" prod   # stops, copies live, starts on the new code
fi

for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3002/api/health >/dev/null 2>&1; then
    set -a; . /etc/ehs-dna-staging.env; set +a
    echo "✓ Staging live: https://staging.ehsdna.com  ($(git rev-parse --short HEAD))"
    sqlite3 "$EHS_DB_PATH" "SELECT '   data: ' || (SELECT COUNT(*) FROM tenants) || ' companies, ' ||
      (SELECT COUNT(*) FROM users WHERE active = 1) || ' active accounts, ' || (SELECT COUNT(*) FROM incidents) || ' incidents';"
    [ "$KEEP" = "1" ] || echo "   (fresh copy of live data — sign in with your normal live passwords; email is off)"
    exit 0
  fi
  sleep 1
done
echo "!! Staging didn't come back healthy — the new code may have failed on live data:"
tail -n 40 /var/log/ehs-dna-staging.log; exit 1
