#!/bin/bash
# ONE-TIME setup of staging.ehsdna.com on this server. Run as root:
#   bash /home/ehs-platform/deploy/staging/setup-staging.sh
#
# Before running: add a DNS A record  staging.ehsdna.com → this server's IP
# (same IP as app.ehsdna.com), and wait a few minutes for it to resolve.
set -euo pipefail
PROD=/home/ehs-platform
APP=/home/ehs-staging
ENVF=/etc/ehs-dna-staging.env

echo "── 1/7 Checking DNS ──"
MYIP=$(hostname -I | awk '{print $1}')
DNSIP=$(getent hosts staging.ehsdna.com | awk '{print $1}' | head -1 || true)
if [ -z "$DNSIP" ]; then
  echo "!! staging.ehsdna.com doesn't resolve yet. Add the DNS A record (→ $MYIP), wait a few minutes, re-run."; exit 1
fi
echo "   staging.ehsdna.com → $DNSIP (this server: $MYIP)"

echo "── 2/7 Tools ──"
command -v htpasswd >/dev/null || apt-get install -y -qq apache2-utils
command -v rsync >/dev/null || apt-get install -y -qq rsync
command -v sqlite3 >/dev/null || apt-get install -y -qq sqlite3

echo "── 3/7 Code (separate checkout on the staging branch) ──"
if [ ! -d "$APP/.git" ]; then
  git clone -q "$(git -C "$PROD" remote get-url origin)" "$APP"
fi
cd "$APP"; git fetch -q origin
git checkout -q staging 2>/dev/null || git checkout -q -b staging origin/staging

echo "── 4/7 Environment (own secret, own data, email OFF) ──"
if [ ! -f "$ENVF" ]; then
  ADMINPW="Stg-$(openssl rand -hex 4)!A"; OPPW="StgOp-$(openssl rand -hex 4)!A"
  cat > "$ENVF" <<ENV
EHS_JWT_SECRET=$(openssl rand -hex 32)
EHS_STAGING=1
EHS_EMAIL_DISABLED=1
EHS_APP_URL=https://staging.ehsdna.com
EHS_DB_PATH=$APP/data/ehs.db
EHS_PHOTO_DIR=$APP/data/photos
EHS_ADMIN_PASSWORD=$ADMINPW
EHS_OPERATOR_PASSWORD=$OPPW
ENV
  chmod 600 "$ENVF"
  echo "   Staging sign-ins (also in $ENVF):"
  echo "     ahren@whistlepig.com / $ADMINPW"
  echo "     ahrenwolson@gmail.com / $OPPW"
else
  echo "   $ENVF already exists — kept."
fi

echo "── 5/7 Service ──"
cp "$APP/deploy/staging/ehs-dna-staging.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable -q ehs-dna-staging

echo "── 6/7 Web address + password prompt ──"
if [ ! -f /etc/nginx/ehsdna-staging.htpasswd ]; then
  read -rp "   Choose a username for the staging password prompt: " SU
  htpasswd -c /etc/nginx/ehsdna-staging.htpasswd "$SU"
fi
cp "$APP/deploy/staging/nginx-staging.conf" /etc/nginx/sites-available/ehsdna-staging
ln -sf /etc/nginx/sites-available/ehsdna-staging /etc/nginx/sites-enabled/ehsdna-staging
nginx -t && systemctl reload nginx
# This server's Certbot account already exists (it issued app.ehsdna.com's certificate).
certbot --nginx -d staging.ehsdna.com --redirect --non-interactive \
  || echo "!! HTTPS not set up yet — run: certbot --nginx -d staging.ehsdna.com"

echo "── 7/7 Build + demo data ──"
bash "$APP/deploy/staging/deploy-staging.sh"
bash "$APP/deploy/staging/refresh-staging-data.sh" demo
echo
echo "✓ Staging ready: https://staging.ehsdna.com"
