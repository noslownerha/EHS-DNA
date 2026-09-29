"""
Findings — quick capture on a phone, the safety-relevance flag, severity
normalisation, CapEx, reclassification + audit trail, and the report numbers,
each checked in the database. Guards the August bugs: the capture screen
collected category/assignee/due/CapEx and the API dropped them; "Major" was never
stored as "high" so the High tile could only read zero; tracker/detail showed
hardcoded placeholders.
"""
import sys, os, urllib.error
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
from playwright.sync_api import sync_playwright

RESULTS = []
def check(name, ok, detail=""):
    RESULTS.append((name, bool(ok), detail))
    print(("PASS" if ok else "FAIL"), name, ("— " + str(detail)[:240]) if (detail and not ok) else "")

def f(desc):
    r = q("SELECT * FROM findings WHERE description LIKE ? ORDER BY id DESC LIMIT 1", desc + "%")
    return r[0] if r else None

def toggle(pg, label):
    # The switches are divs next to a label; click the 40px track in the same row.
    pg.evaluate("""(label) => {
        const el = [...document.querySelectorAll('div')].find(d => d.innerText && d.innerText.trim() === label);
        let row = el; for (let i = 0; i < 4 && row; i++) { row = row.parentElement;
            const t = [...row.querySelectorAll('div')].find(d => getComputedStyle(d).width === '40px');
            if (t) { t.click(); return; } }
        throw new Error('toggle not found: ' + label);
    }""", label); pg.wait_for_timeout(300)

def quick_finding(pg, category, desc, sev, due="3 days", safety=True, capex=False):
    tap(pg, "Inspect"); tap(pg, "Quick Finding"); tap(pg, "Start — Quick Finding"); tap(pg, category)
    pg.fill("textarea", desc)
    pg.locator("button", has_text=sev).first.click()
    pg.locator("button", has_text=due).first.click()
    if not safety: toggle(pg, "Counts toward safety metrics")
    if capex: toggle(pg, "Requires capital spend (CapEx)")
    body = pg.inner_text("body")
    pg.locator("button", has_text="Log finding").first.click(); pg.wait_for_timeout(1500)
    return body

def status_of(path, method, body, tk):
    try: api(path, method, body, tk); return 200
    except urllib.error.HTTPError as e: return e.code

def main():
    proc = boot_server()
    try:
        acc = seed_accounts()
        with sync_playwright() as p:
            b = p.chromium.launch()
            pg = b.new_context(**PHONE).new_page(); errs = watch_errors(pg)
            login(pg, *acc["staff"])

            # ── Capture defaults ──
            tap(pg, "Inspect"); tap(pg, "Quick Finding"); tap(pg, "Start — Quick Finding"); tap(pg, "Housekeeping")
            body = pg.inner_text("body")
            check("capture: safety switch visible and ON by default", "Counts toward safety metrics" in body and "On — this is a safety item" in body)
            check("capture: CapEx switch visible without expanding anything", "Requires capital spend (CapEx)" in body)
            pg.locator("button", has_text="Critical").first.click(); toggle(pg, "Counts toward safety metrics")
            check("capture: Critical + excluded shows the warning", "If it can hurt someone" in pg.inner_text("body"))
            tap(pg, "Home")

            # ── Non-safety finding ──
            quick_finding(pg, "Housekeeping", "E2E-F-01 dusty baseboard in dry goods", "Minor", safety=False)
            r = f("E2E-F-01")
            check("non-safety: stored", r is not None)
            check("non-safety: safety_relevant = 0", r and r["safety_relevant"] == 0, r and r["safety_relevant"])
            check("non-safety: category persisted (was dropped)", r and (r["category"] or "").lower().startswith("housekeep"), r and r["category"])
            check("non-safety: assignee persisted (was dropped)", r and r["assignee"], r and r["assignee"])
            check("non-safety: due date persisted (was dropped)", r and r["due_date"], r and r["due_date"])
            acts = q("SELECT kind, detail FROM finding_activity WHERE finding_id = ?", r["id"]) if r else []
            check("audit: creation logged, noting the exclusion",
                  any(a["kind"] == "created" and "excluded" in (a["detail"] or "") for a in acts), [dict(a) for a in acts])

            # ── Major safety finding → stored as 'high' ──
            quick_finding(pg, "Housekeeping", "E2E-F-02 shrink wrap on floor at line exit", "Major")
            r2 = f("E2E-F-02")
            check("severity: 'Major' normalised to 'high' (High tile used to read 0)", r2 and r2["severity"] == "high", r2 and r2["severity"])
            check("safety default: counted", r2 and r2["safety_relevant"] == 1)

            # ── CapEx ──
            quick_finding(pg, "Housekeeping", "E2E-F-03 conveyor guard assembly needed", "Critical", capex=True)
            r3 = f("E2E-F-03")
            check("capex: persisted (the switch used to do nothing)", r3 and r3["capex"] == 1, r3 and r3["capex"])
            check("staff capture path: no JS errors", not errs, errs)

            # ── Staff cannot reclassify ──
            st = status_of(f"/api/findings/{r['id']}", "PUT", {"safetyRelevant": True}, token_for(*acc["staff"]))
            check("reclassify: staff gets 403", st == 403, st)
            pg.context.close()

            # ── Admin: tracker scope, real values, reclassify via UI ──
            pg = b.new_context(**PHONE).new_page(); errs = watch_errors(pg)
            login(pg, *acc["admin"]); tap(pg, "Home")
            pg.locator("button.kpi-tile", has_text="Critical findings").first.click(); pg.wait_for_timeout(1500)
            body = pg.inner_text("body")
            check("tracker: opens with a Safety / Non-safety scope switch", "Non-safety (1)" in body, body[:300])
            check("tracker: Safety scope excludes the non-safety item", "E2E-F-01" not in body and "E2E-F-02" in body, body[:400])
            check("tracker: real assignee shown, not a placeholder", "Unassigned" not in body.split("E2E-F-02")[1][:200] if "E2E-F-02" in body else False)
            pg.locator("button", has_text="Non-safety").first.click(); pg.wait_for_timeout(700)
            body = pg.inner_text("body")
            check("tracker: Non-safety scope lists it", "E2E-F-01" in body)
            pg.get_by_text("E2E-F-01").first.click(); pg.wait_for_timeout(1500)
            body = pg.inner_text("body")
            check("detail: shows excluded state", "Excluded — tracked and aged, not counted" in body, body[:300])
            check("detail: due date is a real date, not 'Invalid Date'", "Invalid Date" not in body)
            pg.locator("button", has_text="Count as safety finding").first.click(); pg.wait_for_timeout(1500)
            check("reclassify: persisted", f("E2E-F-01")["safety_relevant"] == 1)
            acts = q("SELECT kind, detail, actor_id FROM finding_activity WHERE finding_id = ? AND kind='reclassify'", r["id"])
            check("audit: reclassification logged with actor", len(acts) == 1 and acts[0]["actor_id"], [dict(a) for a in acts])
            check("audit: timeline shows it without reload", "Reclassified as a safety finding" in pg.inner_text("body"))
            st = status_of(f"/api/findings/{r['id']}", "PUT", {"safetyRelevant": True}, token_for(*acc["admin"]))
            n = q("SELECT COUNT(*) n FROM finding_activity WHERE finding_id = ? AND kind='reclassify'", r["id"])[0]["n"]
            check("audit: no-op save writes no phantom entry", n == 1, n)
            # A dashboard tile's destination must not stick to the bottom tab:
            # after opening the CA tracker from Home, tapping Flag must report.
            tap(pg, "Home"); pg.locator("button.kpi-tile", has_text="corrective").first.click(); pg.wait_for_timeout(1200)
            tap(pg, "Home"); tap(pg, "Flag")
            check("nav: Flag tab opens the report picker after a CA-tile deep link", "Report an injury" in pg.inner_text("body"))
            tap(pg, "Home"); pg.locator("button.kpi-tile", has_text="Critical findings").first.click(); pg.wait_for_timeout(1200)
            tap(pg, "Home"); tap(pg, "Inspect")
            check("nav: Inspect tab opens Start inspection after a findings-tile deep link", "Start inspection" in pg.inner_text("body"))
            check("admin findings path: no JS errors", not errs, errs)
            pg.context.close()

            # ── Report numbers ──
            tok = token_for(*acc["admin"])
            api(f"/api/findings/{r['id']}", "PUT", {"safetyRelevant": False}, tok)   # exclude again
            rep = api("/api/reports/findings-training", "GET", None, tok)
            fd, ns = rep.get("findings", {}), rep.get("nonSafety", {})
            check("report: High tile counts the Major finding", fd.get("high", 0) >= 1, fd)
            check("report: non-safety block present", ns.get("open") == 1, ns)
            check("report: safety open count excludes it", fd.get("open") == 2, fd)
            b.close()
    finally:
        proc.terminate()
    fails = [r for r in RESULTS if not r[1]]
    print(f"\n{len(RESULTS) - len(fails)}/{len(RESULTS)} findings checks passed")
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
