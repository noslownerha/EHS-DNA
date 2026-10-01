"""
Company settings — identity, triage line, response checklists, notification
rules, recognition points, sites and departments — changed through the phone UI
and checked in the database and where each setting takes effect; plus role and
tenant boundaries and malformed input.
"""
import sys, os, json, urllib.error
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
from playwright.sync_api import sync_playwright

RESULTS = []
def check(name, ok, detail=""):
    RESULTS.append((name, bool(ok), detail))
    print(("PASS" if ok else "FAIL"), name, ("— " + str(detail)[:240]) if (detail and not ok) else "")

def call(path, method="GET", body=None, tok=None):
    try: return 200, api(path, method, body, tok)
    except urllib.error.HTTPError as e:
        try: return e.code, json.loads(e.read() or b"{}")
        except Exception: return e.code, {}

def section(pg, title):
    return pg.locator("div").filter(has=pg.locator(f"h2:text-is('{title}'), h3:text-is('{title}')")).last

def main():
    proc = boot_server()
    try:
        acc = seed_accounts(); adm = token_for(*acc["admin"])
        with sync_playwright() as p:
            b = p.chromium.launch()
            pg = b.new_context(**PHONE).new_page(); errs = watch_errors(pg)
            login(pg, *acc["admin"]); pg.locator("button:visible", has_text="Settings").first.click(); pg.wait_for_timeout(1500)

            # Identity
            pg.locator("input[value='Safety & Operations Management']").fill("E2E tagline — built safe")
            pg.locator("button:visible", has_text="Save changes").first.click(); pg.wait_for_timeout(1000)
            check("identity: tagline saved", q("SELECT tagline FROM tenants WHERE id=1")[0]["tagline"] == "E2E tagline — built safe")

            # Response checklist (Injury)
            ta = pg.locator("textarea").first
            ta.fill(ta.input_value() + "\nE2E secure the machine")
            pg.locator("button:visible", has_text="Save checklist").click(); pg.wait_for_timeout(1000)
            rc = api("/api/response-checklists", "GET", None, token_for(*acc["staff"]))
            txt = json.dumps(rc)
            check("response checklist: new step saved and visible to staff", "E2E secure the machine" in txt, txt[:200])

            # Recognition points: change the first value
            before = api("/api/points/values", "GET", None, adm)
            first_key = list(before["values"] if "values" in before else before)[0]
            pts = pg.locator("xpath=//h2[normalize-space()='Recognition points' or normalize-space()='Recognition points']/following::input[@type='number'][1]")
            if not pts.count():
                pts = pg.locator("input[value='10']").first
            pts.fill("25")
            pg.locator("button:visible", has_text="Save point values").click(); pg.wait_for_timeout(1000)
            after = api("/api/points/values", "GET", None, adm)
            av = after["values"] if "values" in after else after
            check("points: new value saved", 25 in av.values(), av)

            # Sites
            pg.fill("input[placeholder='Site name']", "E2E Site")
            pg.fill("input[placeholder='Location (optional)']", "Nowhere, VT")
            pg.locator("button:visible", has_text="+ Add site").click(); pg.wait_for_timeout(1000)
            s = q("SELECT * FROM sites WHERE name='E2E Site'")
            check("sites: added", s and s[0]["active"] == 1, s and dict(s[0]))
            check("sites: header count updated", "Sites (5)" in pg.inner_text("body"))
            # Departments
            pg.fill("input[placeholder='Department name']", "E2E Dept")
            pg.locator("button:visible", has_text="+ Add department").click(); pg.wait_for_timeout(1000)
            check("departments: added", q("SELECT 1 FROM departments WHERE name='E2E Dept'"))
            check("settings path: no JS errors", not errs, errs)
            pg.context.close()

            # New site appears where staff pick a site
            pg = b.new_context(**PHONE).new_page(); errs = watch_errors(pg)
            login(pg, *acc["staff"]); tap(pg, "Flag"); tap(pg, "Flag something"); pg.wait_for_timeout(500)
            if pg.get_by_text("A risk or hazard").count(): tap(pg, "A risk or hazard")
            opts = pg.locator("select").first.evaluate("s => [...s.options].map(o => o.text)") if pg.locator("select").count() else []
            check("sites: new site offered when reporting", "E2E Site" in opts, opts)
            pg.context.close()
            b.close()

        # Deactivate the site (API — the ✕ button path) incl. boolean
        sid = q("SELECT id FROM sites WHERE name='E2E Site'")[0]["id"]
        st, body = call(f"/api/sites/{sid}", "PUT", {"active": False}, adm)
        check("sites: deactivate with active:false works (no 500)", st == 200 and q("SELECT active FROM sites WHERE id=?", sid)[0]["active"] == 0, (st, body))
        st, body = call("/api/sites", "POST", {"name": ""}, adm)
        check("sites: blank name refused with a message (not a 500)", st == 400, (st, body))
        st, body = call("/api/departments", "POST", {"name": "  "}, adm)
        check("departments: blank name refused", st == 400, (st, body))

        # Notification rule: injury, significant+, to safety → fires; idea doesn't
        st, r = call("/api/notification-rules", "POST", {"event": "incident", "category": "injury", "minSeverity": "significant",
                                                         "recipientRoles": ["safety"], "recipientUsers": [], "email": False}, adm)
        check("rules: created", st == 200, (st, r))
        saf_id = q("SELECT id FROM users WHERE email=?", acc["safety"][0])[0]["id"]
        n0 = q("SELECT COUNT(*) n FROM notifications WHERE user_id=?", saf_id)[0]["n"]
        stok = token_for(*acc["staff"])
        api("/api/incidents", "POST", {"type": "idea", "severity": "minor", "siteId": 1, "description": "E2E idea"}, stok)
        n1 = q("SELECT COUNT(*) n FROM notifications WHERE user_id=?", saf_id)[0]["n"]
        api("/api/incidents", "POST", {"type": "injury", "severity": "serious", "siteId": 1, "description": "E2E serious injury"}, stok)
        n2 = q("SELECT COUNT(*) n FROM notifications WHERE user_id=?", saf_id)[0]["n"]
        check("rules: a non-matching report doesn't notify", n1 == n0, (n0, n1))
        check("rules: a matching report notifies the role", n2 > n1, (n1, n2))

        # Industry benchmark: drives TRIR colour; validated
        st, _ = call("/api/config", "PUT", {"benchmark": {"trir": 2.7, "dart": 1.4, "source": "BLS 2024 · E2E"}}, adm)
        b = api("/api/config", "GET", None, adm).get("benchmark", {})
        check("benchmark: saved and returned to the app", st == 200 and b.get("trir") == 2.7 and b.get("source") == "BLS 2024 · E2E", (st, b))
        st, _ = call("/api/config", "PUT", {"benchmark": {"trir": 99}}, adm)
        check("benchmark: implausible rate refused", st == 400, st)
        st, _ = call("/api/config", "PUT", {"benchmark": {"trir": None}}, adm)
        check("benchmark: can be cleared (TRIR then shows no colour)", api("/api/config", "GET", None, adm)["benchmark"]["trir"] is None)

        # Triage line
        st, _ = call("/api/config", "PUT", {"triage": {"enabled": True, "providerName": "E2E Triage Co", "providerPhone": "(800) 555-0101"}}, adm)
        cfg = api("/api/config", "GET", None, stok)
        check("triage: provider visible to staff config", "E2E Triage Co" in json.dumps(cfg), json.dumps(cfg)[:200])

        # Roles
        for role in ("staff", "site_manager", "trainer"):
            st, _ = call("/api/config", "PUT", {"tagline": f"hijacked by {role}"}, token_for(*acc[role]))
            check(f"roles: {role} cannot change company settings", st in (401, 403), st)
        st, _ = call("/api/config", "PUT", {"tagline": "hijacked by operator"}, token_for(*acc["operator"]))
        check("roles: operator (not in support mode) cannot change a company's settings", st in (401, 403), st)
        st, _ = call("/api/config", "GET", None, token_for(*acc["operator"]))
        check("roles: operator can still READ config (the console needs it)", st == 200, st)
        check("roles: tagline unchanged by refused attempts", "hijacked" not in q("SELECT tagline FROM tenants WHERE id=1")[0]["tagline"])

        # Tenant boundary
        op = token_for(*acc["operator"])
        en = api("/api/op/tenants", "POST", {"name": "E2E Other Co", "industry": "x", "adminEmail": "e2e-oth@example.com", "adminName": "O"}, op)
        ot = api("/api/auth/login", "POST", {"email": "e2e-oth@example.com", "password": en["tempPassword"]})["token"]
        api("/api/auth/change-password", "POST", {"current": en["tempPassword"], "next": "OtherCo!2026x"}, ot)
        ot = api("/api/auth/login", "POST", {"email": "e2e-oth@example.com", "password": "OtherCo!2026x"})["token"]
        call("/api/sites/1", "PUT", {"name": "PWNED"}, ot)
        call("/api/response-checklists/injury", "PUT", {"items": ["PWNED"]}, ot)
        check("tenant: another company can't rename our site", q("SELECT name FROM sites WHERE id=1")[0]["name"] != "PWNED")
        check("tenant: another company's checklist edit stays in their company",
              "PWNED" not in json.dumps(api("/api/response-checklists", "GET", None, adm)))
    finally:
        proc.terminate()
    fails = [r for r in RESULTS if not r[1]]
    print(f"\n{len(RESULTS) - len(fails)}/{len(RESULTS)} settings checks passed")
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
