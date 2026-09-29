"""
Accounts — admin creates a user on a phone, the temp password forces a change
at first sign-in, resets, deactivation (incl. live sessions), lockout, and the
foot-guns (an admin demoting/deactivating themselves), checked in the DB.
"""
import sys, os, re, json, urllib.error
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
from playwright.sync_api import sync_playwright

RESULTS = []
def check(name, ok, detail=""):
    RESULTS.append((name, bool(ok), detail))
    print(("PASS" if ok else "FAIL"), name, ("— " + str(detail)[:260]) if (detail and not ok) else "")

def call(path, method="GET", body=None, tok=None):
    try: return 200, api(path, method, body, tok)
    except urllib.error.HTTPError as e:
        try: return e.code, json.loads(e.read() or b"{}")
        except Exception: return e.code, {}

def temp_pw(text):
    m = re.search(r"[Tt]emporary password[:\s]+([^\s]+)", text)
    return m.group(1).strip() if m else None

NEW_EMAIL, NEW_PW = "e2e-newhire@example.com", "NewHire!2026x"

def forced_change(pg, email, temp, newpw):
    pg.goto(BASE + "/"); pg.fill("input[type=email]", email); pg.fill("input[type=password]", temp)
    pg.get_by_role("button", name="Sign in").click(); pg.wait_for_timeout(1800)
    return pg.inner_text("body")

def main():
    proc = boot_server()
    try:
        acc = seed_accounts(); adm = token_for(*acc["admin"])
        with sync_playwright() as p:
            b = p.chromium.launch()
            pg = b.new_context(**PHONE).new_page(); errs = watch_errors(pg)
            login(pg, *acc["admin"]); tap(pg, "Manage Staff")
            pg.locator("button:visible", has_text="+ Add staff").first.click(); pg.wait_for_timeout(600)
            pg.fill("input[placeholder='Email']", NEW_EMAIL); pg.fill("input[placeholder='Full name']", "E2E New Hire")
            sels = pg.locator("select:visible"); sels.nth(0).select_option(label="Staff"); sels.nth(1).select_option(label="Moriah")
            pg.locator("button:visible", has_text="Create account").first.click(); pg.wait_for_timeout(1400)
            body = pg.inner_text("body"); temp = temp_pw(body)
            check("create: temporary password shown to the admin", temp, body[:300])
            u = q("SELECT * FROM users WHERE email = ?", NEW_EMAIL)
            check("create: user stored as staff at Moriah, must change password",
                  u and u[0]["role"] == "staff" and u[0]["site_id"] == 1 and u[0]["must_change_password"] == 1, u and dict(u[0]))
            # Duplicate
            pg.locator("button:visible", has_text="+ Add staff").first.click(); pg.wait_for_timeout(500)
            pg.fill("input[placeholder='Email']", NEW_EMAIL); pg.fill("input[placeholder='Full name']", "Dup")
            pg.locator("button:visible", has_text="Create account").first.click(); pg.wait_for_timeout(1200)
            body = pg.inner_text("body")
            check("create: duplicate email refused with a visible reason",
                  any(w in body.lower() for w in ("already", "exists", "in use")) and len(q("SELECT 1 FROM users WHERE email=?", NEW_EMAIL)) == 1, body[:300])
            check("admin staff path: no JS errors", not errs, errs)
            pg.context.close()

            # ── First sign-in: forced change ──
            pg = b.new_context(**PHONE).new_page(); errs = watch_errors(pg)
            body = forced_change(pg, NEW_EMAIL, temp, NEW_PW)
            check("first sign-in: reaches the Set-a-new-password screen (not bounced to sign-in)",
                  "Set a new password" in body and pg.locator("input[placeholder^='Current (temporary)']").count() == 1, body[:200])
            check("first sign-in: no way past it (no bottom nav)", "Inspect" not in body and "Training" not in body, body[:300])
            def attempt(cur, new, conf):
                pg.fill("input[placeholder^='Current (temporary)']", cur)
                pg.fill("input[placeholder^='New password']", new)
                pg.fill("input[placeholder='Confirm new password']", conf)
                pg.get_by_role("button", name=re.compile("Set password")).click(); pg.wait_for_timeout(1200)
            attempt(temp, "short", "short")
            check("first sign-in: short password refused", "new password" in pg.inner_text("body").lower())
            attempt(temp, NEW_PW, NEW_PW + "x")
            check("first sign-in: mismatch refused", "match" in pg.inner_text("body").lower(), pg.inner_text("body")[:200])
            attempt(temp, NEW_PW, NEW_PW); pg.wait_for_timeout(800)
            body = pg.inner_text("body")
            check("first sign-in: lands on Home after setting it", "Training" in body and "Home" in body, body[:200])
            check("first sign-in: flag cleared in DB", q("SELECT must_change_password m FROM users WHERE email=?", NEW_EMAIL)[0]["m"] == 0)
            st, _ = call("/api/auth/login", "POST", {"email": NEW_EMAIL, "password": temp})
            check("first sign-in: temp password no longer works", st in (400, 401, 403), st)
            check("new-hire path: no JS errors", not errs, errs)
            pg.context.close()

        # ── Reset, deactivate, lockout, foot-guns (API; UI already exercised above) ──
        uid = q("SELECT id FROM users WHERE email=?", NEW_EMAIL)[0]["id"]
        st, live = call("/api/auth/login", "POST", {"email": NEW_EMAIL, "password": NEW_PW}); live = live.get("token")
        st, r = call(f"/api/users/{uid}", "PUT", {"resetPassword": True}, adm)
        check("reset: admin gets a new temp password", st == 200 and r.get("tempPassword"), (st, r))
        check("reset: user must change it again", q("SELECT must_change_password m FROM users WHERE id=?", uid)[0]["m"] == 1)
        st, body = call(f"/api/users/{uid}", "PUT", {"active": False}, adm)
        check("deactivate: boolean false accepted (used to 500)", st == 200, (st, body))
        st2, _ = call("/api/auth/login", "POST", {"email": NEW_EMAIL, "password": r.get("tempPassword", "")})
        check("deactivate: cannot sign in", st2 in (401, 403), st2)
        st3, _ = call("/api/incidents", tok=live)
        check("deactivate: an already-open session is cut off", st3 in (401, 403), st3)
        st, body = call(f"/api/users/{uid}", "PUT", {"role": "superuser"}, adm)
        check("role: unknown role refused", st == 400, (st, body))
        saf = token_for(*acc["safety"])
        st, body = call("/api/users", "POST", {"email": "e2e-escalate@example.com", "name": "X", "role": "admin"}, saf)
        check("escalation: safety cannot create an admin", st == 403 and not q("SELECT 1 FROM users WHERE email='e2e-escalate@example.com'"), (st, body))
        stf = q("SELECT id FROM users WHERE email=?", acc["staff"][0])[0]["id"]
        st, body = call(f"/api/users/{stf}", "PUT", {"role": "admin"}, saf)
        check("escalation: safety cannot promote anyone to admin", st == 403 and q("SELECT role FROM users WHERE id=?", stf)[0]["role"] == "staff", (st, body))
        sm = token_for(*acc["site_manager"])
        st, body = call("/api/users/bulk", "POST", {"rows": [{"email": "e2e-bulkadmin@example.com", "name": "Bulk Admin", "role": "admin"}]}, sm)
        check("escalation: site manager cannot bulk-import an admin", not q("SELECT 1 FROM users WHERE email='e2e-bulkadmin@example.com'"), (st, body))
        sm_email = acc["site_manager"][0]
        codes = [call("/api/auth/login", "POST", {"email": sm_email, "password": "wrong-pw"})[0] for _ in range(8)]
        st, body = call("/api/auth/login", "POST", {"email": sm_email, "password": acc["site_manager"][1]})
        check("lockout: correct password refused after 8 failures", st in (401, 403, 423, 429), (codes, st))
        check("lockout: says it's a lockout, not 'invalid credentials'", "lock" in json.dumps(body).lower(), body)

        me = q("SELECT id FROM users WHERE email='ahren@whistlepig.com'")[0]["id"]
        st, body = call(f"/api/users/{me}", "PUT", {"role": "staff"}, adm)
        check("foot-gun: admin cannot demote themselves", st in (400, 403) and q("SELECT role FROM users WHERE id=?", me)[0]["role"] == "admin", (st, body))
        st, body = call(f"/api/users/{me}", "PUT", {"active": False}, adm)
        check("foot-gun: admin cannot deactivate themselves", st in (400, 403) and q("SELECT active FROM users WHERE id=?", me)[0]["active"] == 1, (st, body))
    finally:
        proc.terminate()
    fails = [r for r in RESULTS if not r[1]]
    print(f"\n{len(RESULTS) - len(fails)}/{len(RESULTS)} account checks passed")
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
