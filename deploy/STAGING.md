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
- Demo company (default): `bash /home/ehs-staging/deploy/staging/refresh-staging-data.sh demo`
- Copy of **live** data, to reproduce a real bug: `… refresh-staging-data.sh prod`
  (real people's records — password-protected, email off; refresh back to demo afterwards)

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
