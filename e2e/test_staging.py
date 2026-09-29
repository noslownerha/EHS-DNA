"""
Staging mode: banner on every screen (and on sign-in by hostname), email
switched off so a copy of live data can't message real people, and the
refresh-to-demo snippet works against a scratch database.
"""
import sys, os, subprocess, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
from playwright.sync_api import sync_playwright

RESULTS = []
def check(name, ok, detail=""):
    RESULTS.append((name, bool(ok), detail))
    print(("PASS" if ok else "FAIL"), name, ("— " + str(detail)[:240]) if (detail and not ok) else "")

def main():
    # Production mode: no banner, email on
    proc = boot_server()
    try:
        acc = seed_accounts(); cfg = api("/api/config", "GET", None, token_for(*acc["admin"]))
        check("production: environment reported as production", cfg.get("environment") == "production" and not cfg.get("emailDisabled"), cfg.get("environment"))
        with sync_playwright() as p:
            b = p.chromium.launch(); pg = b.new_context(**PHONE).new_page(); login(pg, *acc["admin"])
            check("production: no staging banner", pg.locator("[aria-label='Staging environment']").count() == 0)
            b.close()
    finally:
        proc.terminate()

    # Staging mode
    os.environ.update(EHS_STAGING="1", EHS_EMAIL_DISABLED="1", RESEND_API_KEY="would-send-if-not-disabled")
    proc = boot_server()
    try:
        acc = seed_accounts(); cfg = api("/api/config", "GET", None, token_for(*acc["admin"]))
        check("staging: environment + email-off reported", cfg.get("environment") == "staging" and cfg.get("emailDisabled") is True, cfg)
        with sync_playwright() as p:
            b = p.chromium.launch(); pg = b.new_context(**PHONE).new_page(); errs = watch_errors(pg)
            login(pg, *acc["admin"])
            ban = pg.locator("[aria-label='Staging environment']")
            check("staging: banner on the app", ban.count() == 1 and "emails are switched off" in ban.inner_text())
            for t in ("Flag", "Training", "Analyze"):
                pg.locator("button", has_text=t).last.click(); pg.wait_for_timeout(700)
                check(f"staging: banner still there on {t}", pg.locator("[aria-label='Staging environment']").count() == 1)
            check("staging: no JS errors", not errs, errs)
            b.close()
        api("/api/auth/forgot", "POST", {"email": "ahren@whistlepig.com"})
        time.sleep(1.2)
        log = open("/tmp/e2e-server.log").read()
        check("staging: email NOT sent — logged instead", "[email disabled] would send" in log, log[-400:])
    finally:
        proc.terminate()
        for k in ("EHS_STAGING", "EHS_EMAIL_DISABLED", "RESEND_API_KEY"): os.environ.pop(k, None)

    # Sign-in page detects staging by hostname (config isn't available before sign-in)
    proc = boot_server()
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(args=["--host-resolver-rules=MAP staging.ehsdna.test 127.0.0.1"])
            pg = b.new_context(**PHONE).new_page()
            pg.goto(f"http://staging.ehsdna.test:{PORT}/"); pg.wait_for_timeout(1500)
            check("sign-in page: staging banner by hostname", "STAGING" in pg.inner_text("body"))
            pg.goto(f"http://localhost:{PORT}/"); pg.wait_for_timeout(1000)
            check("sign-in page: no banner on the live hostname", "STAGING" not in pg.inner_text("body"))
            b.close()
    finally:
        proc.terminate()

    # The refresh-to-demo snippet from refresh-staging-data.sh, on a scratch DB
    env = dict(os.environ, EHS_DB_PATH="/tmp/e2e-stg.db", EHS_PHOTO_DIR="/tmp/e2e-stg-photos")
    for f in ("/tmp/e2e-stg.db", "/tmp/e2e-stg.db-wal", "/tmp/e2e-stg.db-shm"):
        if os.path.exists(f): os.remove(f)
    out = subprocess.run(["node", "-e", "const m=require('./server/db.cjs');const db=m.db||m;const r=require('./server/demo.cjs').resetDemo(db);"
                          "console.log('OK', r.name, r.logins.length)"], cwd=ROOT, env=env, capture_output=True, text=True, timeout=60)
    check("refresh demo: snippet builds the demo company", "OK Northfield Components (Demo) 2" in out.stdout, (out.stdout[-200:], out.stderr[-200:]))
    fails = [r for r in RESULTS if not r[1]]
    print(f"\n{len(RESULTS) - len(fails)}/{len(RESULTS)} staging checks passed")
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
