# Staging, deploys and rollback

## The flow
1. Claude pushes changes to the **`staging`** branch.
2. You run: `bash /home/ehs-staging/deploy/staging/deploy-staging.sh`
3. You try it at **https://staging.ehsdna.com** (password prompt, orange STAGING bar, email off).
4. You tell Claude **"promote"** → Claude moves `main` to that exact commit.
5. You run the normal live deploy:
   `cd /home/ehs-platform && git pull && npm install && bash deploy/deploy.sh`

Urgent one-line fixes can still go straight to `main` — staging is for anything you want to see first.

## One-time setup (≈10 minutes)
1. DNS: add an **A record** `staging` → the same IP as `app.ehsdna.com`.
2. On the server, after `git pull` in `/home/ehs-platform`:
   `bash /home/ehs-platform/deploy/staging/setup-staging.sh`
   It asks for a username + password for the staging prompt, prints staging sign-ins,
   gets an HTTPS certificate, builds, and loads the demo company.

## Staging data
Every staging deploy runs on a **fresh copy of live data** — every company, account and
password, plus photos — so changes are proven against real records, and the new code's
database changes run on real data before they reach live. Sign in with normal live passwords.
- Keep staging's current data instead (e.g. testing across several deploys):
  `bash /home/ehs-staging/deploy/staging/deploy-staging.sh --keep-data`
- Refresh live data any time without deploying: `… refresh-staging-data.sh prod`
- Demo company only: `… refresh-staging-data.sh demo`
Safety: password prompt, own login secret, **email off**, no AI key. Nothing done in
staging touches live. Customer terms should say production data may be used in a
secured test environment to validate changes.

## Every live deploy is reversible
`deploy.sh` now snapshots the database and records the version it replaced first.
- Undo code only (normal — keeps everything entered since): `bash /home/ehs-platform/deploy/rollback.sh`
- Undo code **and** data (only if data was damaged): `bash /home/ehs-platform/deploy/rollback.sh --with-db`
  (anything entered after the deploy is lost; a copy of the current DB is kept first)
Snapshots: `/root/ehs-backups/pre-deploy/` (last 20 kept). Nightly B2 backups are unchanged.

## nginx change for live (one-time)
The repo's `deploy/nginx.conf` now allows 64 MB uploads (PowerPoint import) and a 120 s
timeout (course drafting). Apply to the live box once:
`sed -i 's/client_max_body_size 15m;/client_max_body_size 64m;/' /etc/nginx/sites-enabled/ehsdna`
then add `proxy_read_timeout 120s;` inside the app.ehsdna.com `location /` block, and
`nginx -t && systemctl reload nginx`.
