"""
Demo account — created and reset from the operator console on a phone, rebuilt
identically, never touching real customers, excluded from revenue, and usable
for a pitch (admin + worker sign-ins, realistic dashboards).
"""
import sys, os, json, re, urllib.error
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
from playwright.sync_api import sync_playwright

RESULTS = []
def check(name, ok, detail=""):
    RESULTS.append((name, bool(ok), detail))
    print(("PASS" if ok else "FAIL"), name, ("— " + str(detail)[:260]) if (detail and not ok) else "")

def demo_counts():
    t = q("SELECT id FROM tenants WHERE is_demo = 1")
    if not t: return None
    tid = t[0]["id"]
    return {k: q(f"SELECT COUNT(*) n FROM {k} WHERE tenant_id = ?", tid)[0]["n"]
            for k in ("users", "incidents", "corrective_actions", "findings", "assets", "trainings", "training_completions")}

def main():
    proc = boot_server()
    try:
        acc = seed_accounts(); wp = token_for(*acc["admin"]); op = token_for(*acc["operator"])
        api("/api/incidents", "POST", {"type": "hazard", "severity": "minor", "siteId": 1, "description": "WPKEEP real customer record"}, wp)
        wp_before = q("SELECT COUNT(*) n FROM incidents WHERE tenant_id = 1")[0]["n"]
        with sync_playwright() as p:
            b = p.chromium.launch()
            pg = b.new_context(**PHONE).new_page(); errs = watch_errors(pg)
            login(pg, *acc["operator"]); tap(pg, "Companies")
            body = pg.inner_text("body")
            check("console: demo card shown", "Demo account" in body, body[:300])
            pg.locator("button:visible", has_text="Create demo account").first.click(); pg.wait_for_timeout(400)
            check("console: asks for confirmation first", "wipes everything in the demo account" in pg.inner_text("body"))
            pg.locator("button:visible", has_text="Yes, rebuild it").first.click(); pg.wait_for_timeout(6000)
            body = pg.inner_text("body")
            check("console: shows the pitch sign-ins", "demo@ehsdna.com" in body and "demo-worker@ehsdna.com" in body, body[:400])
            c1 = demo_counts()
            check("create: realistic volume of data", c1 and c1["users"] >= 20 and c1["incidents"] >= 20 and c1["assets"] >= 8
                  and c1["training_completions"] >= 80, c1)
            check("create: real customer data untouched", q("SELECT COUNT(*) n FROM incidents WHERE tenant_id = 1")[0]["n"] == wp_before)

            # Add something during a "pitch", then reset — it must disappear
            dtok = api("/api/auth/login", "POST", {"email": "demo@ehsdna.com", "password": "DemoTour!2026"})["token"]
            api("/api/incidents", "POST", {"type": "hazard", "severity": "minor", "siteId": q("SELECT id FROM sites WHERE tenant_id=(SELECT id FROM tenants WHERE is_demo=1) LIMIT 1")[0]["id"],
                                           "description": "PITCHJUNK typed during a demo"}, dtok)
            pg.locator("button:visible", has_text="Reset demo data").first.click(); pg.wait_for_timeout(300)
            pg.locator("button:visible", has_text="Yes, rebuild it").first.click(); pg.wait_for_timeout(6000)
            check("reset: pitch leftovers removed", not q("SELECT 1 FROM incidents WHERE description LIKE 'PITCHJUNK%'"))
            check("reset: rebuilt identically", demo_counts() == c1, (demo_counts(), c1))
            check("reset: real customer data still untouched", q("SELECT COUNT(*) n FROM incidents WHERE tenant_id = 1")[0]["n"] == wp_before)
            check("reset: exactly one demo company (no duplicates)", q("SELECT COUNT(*) n FROM tenants WHERE is_demo = 1")[0]["n"] == 1)

            # Excluded from revenue / attention
            for path in ("/api/op/billing/overview", "/api/op/attention", "/api/op/analytics"):
                txt = json.dumps(api(path, "GET", None, op))
                check(f"excluded: {path} doesn't include the demo", "Northfield" not in txt, txt[:200])

            # Enter demo from the console
            pg.locator("button:visible", has_text="Enter demo").first.click(); pg.wait_for_timeout(2500)
            body = pg.inner_text("body")
            check("enter demo: support banner names Northfield", "Support mode" in body and "Northfield" in body, body[:300])
            check("console path: no JS errors", not errs, errs)
            pg.context.close()

            # Pitch as the demo admin, directly
            pg = b.new_context(**DESKTOP).new_page(); errs = watch_errors(pg)
            login(pg, "demo@ehsdna.com", "DemoTour!2026")
            body = pg.inner_text("body")
            check("pitch (admin): lands on a populated dashboard", "Northfield" in body and "Dayton Plant" in body, body[:300])
            check("pitch (admin): no forced password change for the shared login", "Set a new password" not in body)
            check("branding: header shows the tenant's own name, not WhistlePig", "WhistlePig" not in body, body[:200])
            pg.locator("button", has_text="Analyze").last.click()
            try: pg.get_by_text("Report Builder").first.wait_for(timeout=8000)
            except Exception:
                print("STUCK:", pg.inner_text("body")[:400].replace("\n", " | ")); pg.screenshot(path="/tmp/stuck.png")
                print("NAV:", pg.locator("button", has_text="Analyze").count(), pg.url)
            pg.locator("button:visible", has_text="Generate").first.click(); pg.wait_for_timeout(2500)
            check("pitch (admin): TRIR report generates", "TRIR" in pg.inner_text("body"))
            check("pitch admin path: no JS errors", not errs, errs)
            pg.context.close()
            pg = b.new_context(**PHONE).new_page(); errs = watch_errors(pg)
            login(pg, "demo-worker@ehsdna.com", "DemoTour!2026")
            home = pg.inner_text("body")
            check("worker home: greets by first name (was 'Hey 👋' with no name)", ", Luis" in home, home[:200])
            check("worker home: shows the worker's own site and department", "Dayton Plant · Welding" in home, home[:200])
            check("worker home: lists the courses they owe", "3 to do" in home and "Lockout / Tagout Basics" in home, home[:500])
            tap(pg, "Training")
            check("pitch (worker): has open training to demo", "Not started" in pg.inner_text("body"))
            check("pitch worker path: no JS errors", not errs, errs)
            b.close()
    finally:
        proc.terminate()
    fails = [r for r in RESULTS if not r[1]]
    print(f"\n{len(RESULTS) - len(fails)}/{len(RESULTS)} demo checks passed")
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
