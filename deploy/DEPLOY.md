# EHS DNA — Deploy Runbook (GizmoDuck VPS)

Repo lives at `/home/ehs-platform`. App = Express API + built React SPA, one process, port 3000.

## Normal deploy (after any push to main)
```bash
/home/ehs-platform/deploy/deploy.sh
```

## One-time setup (do once)
```bash
cd /home/ehs-platform
chmod +x deploy/*.sh

# 1) Ensure the SQLite native module is really installed (see Troubleshooting)
npm install better-sqlite3 --no-save --foreground-scripts
node -e "require('better-sqlite3'); console.log('sqlite OK')"

# 2) Install the systemd service (survives reboots, auto-restarts)
cp deploy/ehs-dna.service /etc/systemd/system/
echo "EHS_JWT_SECRET=$(openssl rand -hex 32)" > /etc/ehs-dna.env
chmod 600 /etc/ehs-dna.env
systemctl daemon-reload
systemctl enable --now ehs-dna

# 2a) Email (transactional alerts: injury reported, CA overdue, password reset)
# Default provider is Resend (https://resend.com). Verify the ehsdna.com domain in
# Resend, generate a SENDING api key, then append to the env file and restart:
#   echo 'RESEND_API_KEY=re_xxxxxxxxxxxx' >> /etc/ehs-dna.env
#   systemctl restart ehs-dna
# Optional: override the From address (defaults to "EHS DNA <alerts@ehsdna.com>")
#   echo 'EHS_EMAIL_FROM=EHS DNA Safety <alerts@ehsdna.com>' >> /etc/ehs-dna.env
# To route through n8n/another service instead of Resend, set EHS_EMAIL_WEBHOOK
# (it takes precedence over RESEND_API_KEY) — no app change needed.
# Verify delivery (operator account): GET /api/op/email-test?to=you@example.com
# If neither var is set the app still runs; only the email copy is skipped
# (in-app notifications are unaffected).

# 3) Nightly backups (2:15 AM, 30-day retention)
apt install -y sqlite3   # needed by backup.sh
(crontab -l 2>/dev/null; echo "15 2 * * * /home/ehs-platform/deploy/backup.sh") | crontab -

# 4) Kill the old static server if still running
pkill -f "serve -s dist" || true
```

## First login
- URL: http://ehsdna.com:3000
- Admin: `ahren@whistlepig.com` / `ChangeMe!2026` — **change immediately** (profile → change password, or POST /api/auth/change-password)
- Then: Admin Dashboard → Settings (company identity, sites, departments, triage line) and Manage Staff (create accounts; temp passwords are shown once).

## Troubleshooting: "Cannot find module 'better-sqlite3'"
Seen on Node 18. `better-sqlite3` is listed under `optionalDependencies`, so npm
swallows its install failure silently ("reify failed optional dependency").
Fix — force it and watch the output:
```bash
npm install better-sqlite3 --no-save --foreground-scripts 2>&1 | tail -40
```
If the build fails for real, the usual causes on this box:
- missing build tools: `apt install -y build-essential python3`
- low disk: `df -h`
The app also runs on Node >= 22.5 with zero native deps (built-in node:sqlite);
upgrading Node via nodesource is the long-term fix:
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt install -y nodejs
```

## Restore (and REHEARSE it before you need it)
A backup you have never restored is a hope, not a backup. Rehearse now:
```bash
# Safe rehearsal — restores the latest local backup to a scratch copy and
# integrity-checks it. Changes NOTHING on the live system.
deploy/restore.sh --verify
```
You should see `integrity: ok` and non-zero tenants/users, then `REHEARSAL OK`.

Real recovery (replaces the live DB; stops app, snapshots current DB as an undo
point, restores, restarts, health-checks):
```bash
deploy/restore.sh --live /home/ehs-platform/backups/ehs-YYYYMMDD-HHMM.db.gz
# type  RESTORE LIVE  when prompted
```
Pull an off-site copy from B2 first if the box was lost:
```bash
deploy/restore.sh --from-b2 ehs-YYYYMMDD-HHMM.db.gz --live
```
Photos (disk-stored evidence) restore separately from B2:
`rclone copy b2:ehsdna-backups/photos/ /home/ehs-platform/data/photos/`

## Uptime monitoring
The app exposes `GET /api/health` (200 `{status:"ok"}` when the DB responds, 503
`degraded` otherwise). Point an external monitor at it so you hear about an
outage before a customer does:
- URL to watch: `https://app.ehsdna.com/api/health`
- Alert when: status is not 200, body lacks `"ok"`, or response takes >30s
- A free tier of UptimeRobot / Better Uptime / Healthchecks.io is plenty.
Also worth a cron heartbeat so a *silent backup failure* pages you: pipe
`backup.sh` success to a Healthchecks.io ping URL (it alerts when the nightly
ping goes missing).

## Where things live
- Database: `/home/ehs-platform/data/ehs.db` (WAL mode)
- Backups:  `/home/ehs-platform/backups/` (gzip, 30 days)
- Logs:     `/var/log/ehs-dna.log` (`journalctl -u ehs-dna` also works)
- Secrets:  `/etc/ehs-dna.env`

## Next infrastructure steps (planned)
- nginx reverse proxy + Let's Encrypt → https://app.ehsdna.com (drop :3000)
- Marketing site at https://ehsdna.com root
