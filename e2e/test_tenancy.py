"""
Tenant isolation + operator boundary. Seeds marked WhistlePig records, enrolls
a second company, then tries to reach WhistlePig data from it every way an app
user could: list endpoints, direct IDs, edits, photos, QR links, reports. Also
checks the operator can't read customer records without impersonating, a
customer admin can't reach operator endpoints, impersonation shows the support
banner and exits cleanly, and suspension blocks sign-in with a real reason.
Before this suite, isolation had never been exercised — there was only ever
one tenant in production.
"""
import sys, os, json, urllib.error, base64, re
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

MARK = "WPMARK"
PNG = "data:image/png;base64," + base64.b64encode(bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4a10000000049454e44ae426082")).decode()

def main():
    proc = boot_server()
    try:
        acc = seed_accounts(); wp = token_for(*acc["admin"]); op = token_for(*acc["operator"])
        # ── Marked WhistlePig data ──
        inc = api("/api/incidents", "POST", {"type": "injury", "severity": "significant", "siteId": 1,
                                             "description": f"{MARK} incident", "photos": [PNG]}, wp)
        fnd = api("/api/findings", "POST", {"siteId": 1, "severity": "major", "description": f"{MARK} finding"}, wp)
        ca  = api("/api/cas", "POST", {"title": f"{MARK} action", "priority": "high"}, wp)
        ast = api("/api/assets", "POST", {"name": f"{MARK} pump", "siteId": 1}, wp)
        photo_ids = [r["id"] for r in q("SELECT id FROM photo_files")]

        # ── Operator enrolls tenant B ──
        st, en = call("/api/op/tenants", "POST", {"name": "E2E Test Distillery", "industry": "Distilling",
                                                  "adminEmail": "e2e-b-admin@example.com", "adminName": "B Admin"}, op)
        check("enroll: operator can create a company", st == 200 and en.get("tempPassword"), en)
        st, lg = call("/api/auth/login", "POST", {"email": "e2e-b-admin@example.com", "password": en.get("tempPassword")})
        b = lg.get("token")
        check("enroll: new admin can sign in with the temp password", st == 200 and b, lg)

        # ── B lists: zero WhistlePig data anywhere ──
        for path in ["/api/incidents", "/api/findings", "/api/cas", "/api/assets", "/api/users/directory",
                     "/api/trainings", "/api/sites", "/api/notifications", "/api/reports/findings-training",
                     "/api/reports/incident-summary?months=12", "/api/reports/mbr/preview", "/api/labor-hours",
                     "/api/dashboard/compliance"]:
            st, body = call(path, tok=b)
            txt = json.dumps(body)
            leaked = MARK in txt or "WhistlePig" in txt or "ahren@whistlepig.com" in txt or "Moriah" in txt
            check(f"isolation: {path} shows no WhistlePig data", not leaked and st in (200, 403, 404), (st, txt[:200]))

        # ── B direct-ID access to WhistlePig records ──
        for path, method, body in [
            (f"/api/incidents/{inc['id']}", "GET", None),
            (f"/api/incidents/{inc['id']}", "PUT", {"description": "B overwrote this"}),
            (f"/api/findings/{fnd['id']}", "GET", None),
            (f"/api/findings/{fnd['id']}", "PUT", {"status": "resolved"}),
            (f"/api/cas/{ca['id']}", "PUT", {"status": "done"}),
            (f"/api/assets/{ast['id']}", "GET", None),
            (f"/api/assets/{ast['id']}/qr", "GET", None),
        ] + [(f"/api/photos/{pid}", "GET", None) for pid in photo_ids]:
            st, resp = call(path, method, body, b)
            check(f"isolation: B cannot {method} {path.split('/api/')[1]}", st in (403, 404), (st, str(resp)[:150]))
        i_row = q("SELECT description FROM incidents WHERE id = ?", inc["id"])[0]
        f_row = q("SELECT status FROM findings WHERE id = ?", fnd["id"])[0]
        c_row = q("SELECT status FROM corrective_actions WHERE id = ?", ca["id"])[0]
        check("isolation: WhistlePig records unchanged in the DB",
              MARK in i_row["description"] and f_row["status"] == "open" and c_row["status"] != "done",
              (dict(i_row), dict(f_row), dict(c_row)))

        # ── Operator boundary ──
        st, body = call("/api/incidents", tok=op)
        check("operator: cannot read customer incidents without impersonating",
              st in (403, 404) or MARK not in json.dumps(body), (st, json.dumps(body)[:150]))
        st, body = call("/api/op/attention", tok=op)
        check("operator: attention feed names no individual or incident", MARK not in json.dumps(body) and "ahren@whistlepig.com" not in json.dumps(body))
        for path in ["/api/op/tenants", "/api/op/attention", "/api/op/billing/overview"]:
            st, _ = call(path, tok=wp)
            check(f"customer admin: cannot reach {path}", st in (401, 403), st)

        # ── Support mode still reaches the impersonated company's records ──
        st, imp = call("/api/op/impersonate", "POST", {"tenantId": 1}, op)
        st2, body = call("/api/incidents", tok=imp.get("token"))
        check("support mode: impersonation token CAN read that company's records", st2 == 200 and MARK in json.dumps(body), (st, st2))

        # ── Suspension ──
        tid = en.get("tenantId")
        call(f"/api/op/tenants/{tid}/status", "PUT", {"active": False, "reason": "billing"}, op)
        st, lg = call("/api/auth/login", "POST", {"email": "e2e-b-admin@example.com", "password": en.get("tempPassword")})
        check("suspend: company's users cannot sign in", st in (401, 403), (st, lg))
        check("suspend: refusal says why (not 'invalid credentials')",
              any(w in json.dumps(lg).lower() for w in ("suspend", "paused", "inactive", "disabled")), lg)
        st, _ = call("/api/incidents", tok=b)
        check("suspend: an already-issued session is cut off too", st in (401, 403), st)
        call(f"/api/op/tenants/{tid}/status", "PUT", {"active": True}, op)
        st, _ = call("/api/auth/login", "POST", {"email": "e2e-b-admin@example.com", "password": en.get("tempPassword")})
        check("reactivate: can sign in again", st == 200, st)

        # ── Impersonation in the UI ──
        with sync_playwright() as p:
            br = p.chromium.launch()
            pg = br.new_context(**PHONE).new_page(); errs = watch_errors(pg)
            login(pg, *acc["operator"]); tap(pg, "Companies")
            body = pg.inner_text("body")
            check("operator UI: Companies lists both tenants", "E2E Test Distillery" in body and "WhistlePig" in body, body[:300])
            clicked = pg.evaluate("""(name) => {
                const cards = [...document.querySelectorAll('div')].filter(el => el.offsetParent && el.innerText.includes(name)
                    && [...el.querySelectorAll('button')].filter(b => b.innerText.includes('Enter app')).length === 1);
                if (!cards.length) return false;
                cards.sort((x, y) => x.innerText.length - y.innerText.length);
                [...cards[0].querySelectorAll('button')].find(b => b.innerText.includes('Enter app')).click(); return true;
            }""", "E2E Test Distillery")
            check("impersonate: 'Enter app' available on the company card", clicked)
            pg.wait_for_timeout(2200)
            body = pg.inner_text("body")
            check("impersonate: support-mode banner names the right company", "Support mode" in body and "E2E Test Distillery" in body, body[:300])
            check("impersonate: sees the customer's nav, not operator's", "Flag" in body and "Attention" not in body)
            check("impersonate: sees none of WhistlePig's data", MARK not in body)
            ex = pg.get_by_role("button", name=re.compile("Exit|Return to operator"))
            if ex.count(): ex.first.click(); pg.wait_for_timeout(2000)
            body = pg.inner_text("body")
            check("impersonate: exit returns to the operator nav", "Attention" in body and "Support mode" not in body, body[:300])
            check("operator UI: no JS errors", not errs, errs)
            br.close()
    finally:
        proc.terminate()
    fails = [r for r in RESULTS if not r[1]]
    print(f"\n{len(RESULTS) - len(fails)}/{len(RESULTS)} tenancy checks passed")
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
