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

## Where things live
- Database: `/home/ehs-platform/data/ehs.db` (WAL mode)
- Backups:  `/home/ehs-platform/backups/` (gzip, 30 days)
- Logs:     `/var/log/ehs-dna.log` (`journalctl -u ehs-dna` also works)
- Secrets:  `/etc/ehs-dna.env`

## Next infrastructure steps (planned)
- nginx reverse proxy + Let's Encrypt → https://app.ehsdna.com (drop :3000)
- Marketing site at https://ehsdna.com root
