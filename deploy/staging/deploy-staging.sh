#!/bin/bash
# Deploy the latest `staging` branch to staging.ehsdna.com.
#   bash /home/ehs-staging/deploy/staging/deploy-staging.sh
set -euo pipefail
APP=/home/ehs-staging
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
systemctl restart ehs-dna-staging
for i in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:3002/api/health >/dev/null 2>&1; then
    echo "✓ Staging live: https://staging.ehsdna.com  ($(git rev-parse --short HEAD))"
    exit 0
  fi
  sleep 1
done
echo "!! Staging didn't come back healthy:"; tail -n 30 /var/log/ehs-dna-staging.log; exit 1
