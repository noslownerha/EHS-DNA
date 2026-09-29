"""
Corrective actions — created, assigned, blocked, CapEx-paused, completed and
verified through the real UI on a phone, every outcome checked in the database.
Guards the bug classes that have actually shipped here: client-invented ids
(edits silently went nowhere), 'blocked' conflated with CapEx, blocking with no
readable reason, and the activity trail missing changes.
"""
import sys, os, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
from playwright.sync_api import sync_playwright

RESULTS = []
def check(name, ok, detail=""):
    RESULTS.append((name, bool(ok), detail))
    print(("PASS" if ok else "FAIL"), name, ("— " + str(detail)[:240]) if (detail and not ok) else "")

def ca(desc):
    r = q("SELECT * FROM corrective_actions WHERE title LIKE ? ORDER BY id DESC LIMIT 1", desc + "%")
    return r[0] if r else None

def open_tracker(pg):
    tap(pg, "Home")
    pg.locator("button.kpi-tile", has_text="corrective").first.click(); pg.wait_for_timeout(1400)

def main():
    proc = boot_server()
    try:
        acc = seed_accounts()
        with sync_playwright() as p:
            b = p.chromium.launch()
            pg = b.new_context(**PHONE).new_page(); errs = watch_errors(pg)
            dialogs = []
            pg.on("dialog", lambda d: (dialogs.append(d.message), d.accept("E2E blocked — waiting on maintenance engineer")))
            login(pg, *acc["admin"]); open_tracker(pg)
            check("tracker: opens from the dashboard tile", "Corrective Action Tracker" in pg.inner_text("body"))

            # ── Create a standalone task through the form ──
            pg.locator("button", has_text="+ New task").first.click(); pg.wait_for_timeout(700)
            pg.fill("textarea[placeholder^='e.g. Clear pallet']", "E2E-CA-01 relabel caustic tote station")
            pg.locator("select").filter(has_text="Medium").first.select_option(label="High")
            due = (datetime.date.today() + datetime.timedelta(days=7)).isoformat()
            dinput = pg.locator("input[type=date]")
            if dinput.count(): dinput.first.fill(due)
            pg.locator("select").filter(has_text="Unassigned").last.select_option(label="E2E Safety")
            pg.locator("button", has_text="Create task").first.click(); pg.wait_for_timeout(1500)
            row = ca("E2E-CA-01")
            check("create: row stored", row is not None)
            check("create: priority persisted", row and row["priority"] == "high", row and row["priority"])
            check("create: assignee persisted (by id)", row and row["assignee_id"] is not None, row and dict(row))
            check("create: due date persisted", row and (row["due_date"] or "").startswith(due), row and row["due_date"])
            check("create: appears in tracker without reload", "E2E-CA-01" in pg.inner_text("body"))

            # ── Open it via Manage; edit IMMEDIATELY (the tmp-id bug class) ──
            def manage(title):
                # Cards (phone) and table rows (desktop) are both in the DOM; one is hidden by CSS.
                btn = pg.locator(f".ca-cards > div:has-text('{title}') button:has-text('Manage'):visible")
                if not btn.count():
                    btn = pg.locator(f"tr:has-text('{title}') button:has-text('Manage'):visible")
                btn.first.click(); pg.wait_for_timeout(1100)
            def close_panel():
                for sel in ("button[aria-label='Close']:visible", "button:has-text('×'):visible", "button:has-text('✕'):visible", "button:has-text('Close'):visible"):
                    loc = pg.locator(sel)
                    if loc.count(): loc.last.click(); pg.wait_for_timeout(500); return
                pg.keyboard.press("Escape")
            manage("E2E-CA-01")
            check("detail: Manage opens the panel", "Add note" in pg.inner_text("body"))
            pg.fill("textarea[placeholder^='Progress update']", "E2E progress — parts ordered")
            pg.locator("button", has_text="Add note").first.click(); pg.wait_for_timeout(1000)
            acts = q("SELECT kind, detail FROM ca_activity WHERE ca_id = ?", row["id"])
            check("note: logged immediately after create (no tmp-id)",
                  any("parts ordered" in (a["detail"] or "") for a in acts), [dict(a) for a in acts])

            # ── Roadblock from the tracker: reason required ──
            pg.locator("button", has_text="Blocked — needs help").first.click(); pg.wait_for_timeout(500)
            flag = pg.locator("button", has_text="Flag as blocked — needs help").first
            check("roadblock: cannot flag without a reason", not flag.is_enabled())
            pg.fill("textarea[placeholder^=\"What's blocking you\"]", "E2E waiting on maintenance engineer")
            flag.click(); pg.wait_for_timeout(1100)
            r2 = ca("E2E-CA-01")
            check("roadblock: status = blocked", r2["status"] == "blocked", r2["status"])
            check("roadblock: reason stored", "maintenance engineer" in (r2["blocked_reason"] or ""), r2["blocked_reason"])
            check("roadblock: panel shows it still ages", "still aging" in pg.inner_text("body"))
            close_panel(); open_tracker(pg)
            body = pg.inner_text("body")
            check("roadblock: badge + reason on the tracker card",
                  "Blocked — needs help" in body and "maintenance engineer" in body, body[:400])

            # ── CapEx on a past-due CA: paused, not overdue ──
            tok = token_for(*acc["admin"])
            past = (datetime.date.today() - datetime.timedelta(days=20)).isoformat()
            c2 = api("/api/cas", "POST", {"title": "E2E-CA-02 awaiting FY27 capital", "priority": "medium", "dueDate": past}, tok)
            c3 = api("/api/cas", "POST", {"title": "E2E-CA-03 plain overdue", "priority": "medium", "dueDate": past}, tok)
            open_tracker(pg)
            check("overdue: a past-due CA opens the tracker on Overdue", "E2E-CA-03" in pg.inner_text("body"))
            manage("E2E-CA-02")
            pg.locator("button", has_text="Mark blocked on budget").first.click(); pg.wait_for_timeout(400)
            pg.fill("textarea[placeholder^='Why is this blocked']", "E2E awaiting FY27 capital")
            pg.locator("button", has_text="Mark CapEx-blocked").first.click(); pg.wait_for_timeout(1100)
            check("capex: stored as capex_blocked", ca("E2E-CA-02")["status"] == "capex_blocked", ca("E2E-CA-02")["status"])
            close_panel(); open_tracker(pg)
            pg.locator("button", has_text="Overdue").first.click(); pg.wait_for_timeout(600)
            body = pg.inner_text("body")
            check("capex: NOT listed as overdue (clock paused)", "E2E-CA-02" not in body and "E2E-CA-03" in body, body[:300])
            pg.locator("button", has_text="CapEx hold").first.click(); pg.wait_for_timeout(600)
            check("capex: listed under CapEx hold", "E2E-CA-02" in pg.inner_text("body"))

            # ── Complete + verify through the panel ──
            pg.locator("button", has_text="Overdue").first.click(); pg.wait_for_timeout(500)
            manage("E2E-CA-03")
            for lbl in ("Done", "Complete"):
                b_ = pg.locator("button", has_text=lbl)
                if b_.count(): b_.first.click(); break
            pg.wait_for_timeout(1000)
            b_ = pg.locator("button", has_text="Verified")
            if b_.count() and b_.first.is_enabled(): b_.first.click(); pg.wait_for_timeout(1000)
            r3 = ca("E2E-CA-03")
            check("verify: done + verified_by recorded", r3["status"] in ("done", "verified") and r3["verified_by"] is not None, dict(r3))
            kinds = [a["kind"] for a in q("SELECT kind FROM ca_activity WHERE ca_id = ?", r3["id"])]
            check("activity: completion logged", len(kinds) >= 2, kinds)
            check("admin CA path: no JS errors", not errs, errs)
            pg.context.close()

            # ── Permissions ──
            import urllib.error
            def status_of(path, method, body, tk):
                try: api(path, method, body, tk); return 200
                except urllib.error.HTTPError as e: return e.code
            mine = api("/api/cas", "GET", None, token_for(*acc["safety"]))
            mine = mine if isinstance(mine, list) else mine.get("items", [])
            check("assignee can see the CA assigned to them", any(str(x.get("title", "")).startswith("E2E-CA-01") for x in mine))
            st = status_of("/api/cas", "POST", {"title": "E2E-CA-XX staff attempt"}, token_for(*acc["staff"]))
            check("staff: cannot create a standalone CA", st in (401, 403), st)
            b.close()
    finally:
        proc.terminate()
    fails = [r for r in RESULTS if not r[1]]
    print(f"\n{len(RESULTS) - len(fails)}/{len(RESULTS)} corrective-action checks passed")
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
