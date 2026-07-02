#!/bin/bash
# EHS DNA deploy — run from anywhere on the VPS: /home/ehs-platform/deploy/deploy.sh
set -euo pipefail
cd /home/ehs-platform

echo "── Pulling latest ──"
git fetch origin
git merge origin/main

echo "── Installing deps ──"
npm install
# better-sqlite3 is optional in package.json; ensure it's really present on the VPS
node -e "require('better-sqlite3')" 2>/dev/null || npm install better-sqlite3 --no-save --foreground-scripts

echo "── Building frontend ──"
npm run build

echo "── Restarting service ──"
if systemctl is-enabled ehs-dna >/dev/null 2>&1; then
  systemctl restart ehs-dna
  systemctl status ehs-dna --no-pager -l | head -8
else
  echo "systemd service not installed yet. One-time setup:"
  echo "  cp deploy/ehs-dna.service /etc/systemd/system/"
  echo "  echo \"EHS_JWT_SECRET=\$(openssl rand -hex 32)\" > /etc/ehs-dna.env && chmod 600 /etc/ehs-dna.env"
  echo "  systemctl daemon-reload && systemctl enable --now ehs-dna"
fi
