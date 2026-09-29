"""
QR features — inspection points (create, print, scan → checklist, retire),
batch + single label printing, maintenance schedules on the asset a scan opens
(add, overdue, mark done by the person at the machine), and tenant/module
boundaries on labels.
"""
import sys, os, json, datetime, urllib.error
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

def main():
    proc = boot_server()
    try:
        acc = seed_accounts(); adm = token_for(*acc["admin"]); op = token_for(*acc["operator"])
        assets = api("/api/assets", "GET", None, adm)
        cl = api("/api/checklists", "GET", None, adm)[0]
        with sync_playwright() as p:
            b = p.chromium.launch()
            ctx = b.new_context(**PHONE); pg = ctx.new_page(); errs = watch_errors(pg)
            login(pg, *acc["admin"]); pg.locator("button:visible", has_text="QR labels").first.click(); pg.wait_for_timeout(1200)
            check("labels screen: opens from the dashboard", "Inspection points" in pg.inner_text("body"))

            # ── Create an inspection point in the UI ──
            pg.locator("button:visible", has_text="+ Add inspection point").click(); pg.wait_for_timeout(300)
            pg.fill("input[placeholder^='Name, e.g. Eyewash']", "E2E Eyewash — Paint booth")
            pg.select_option("select[aria-label='Checklist this point runs']", value=str(cl["id"]))
            pg.select_option("select[aria-label='Site']", index=1)
            pg.locator("button:visible", has_text="Add point").click(); pg.wait_for_timeout(1000)
            pt = q("SELECT * FROM inspection_points WHERE name = 'E2E Eyewash — Paint booth'")
            check("point: stored with checklist and site", pt and pt[0]["checklist_id"] == cl["id"] and pt[0]["site_id"], pt and dict(pt[0]))
            pt = pt[0]

            # ── Batch print: the new point is pre-selected; add all equipment ──
            pg.locator("button:visible", has_text=f"Select all ({len(assets)})").last.click(); pg.wait_for_timeout(300)
            n = len(assets) + 1
            btn = pg.locator("button:visible", has_text=f"Print {n} labels")
            check("batch: footer counts the selection", btn.count() == 1, pg.locator("button:visible").all_inner_texts()[-6:])
            with ctx.expect_page() as pi: btn.click()
            sheet = pi.value; sheet.wait_for_timeout(1500)
            check("batch: one sheet with every selected label", sheet.locator(".label").count() == n, sheet.locator(".label").count())
            check("batch: each label has a QR code", sheet.locator(".label svg").count() == n)
            check("batch: point label says it starts an inspection", "Scan to start this inspection" in sheet.inner_text("body"))
            sheet.close()

            # ── Single print ──
            with ctx.expect_page() as pi:
                pg.locator("button[aria-label='Print label for E2E Eyewash — Paint booth']").click()
            one = pi.value; one.wait_for_timeout(1200)
            check("single: prints exactly one label", one.locator(".label").count() == 1)
            one.close()
            check("labels path: no JS errors", not errs, errs)
            ctx.close()

            # ── Scan the point as staff → its checklist, ready to run ──
            ctx = b.new_context(**PHONE); pg = ctx.new_page(); errs = watch_errors(pg)
            login(pg, *acc["staff"]); pg.goto(f"{BASE}/?open=point:{pt['id']}"); pg.wait_for_timeout(2500)
            body = pg.inner_text("body")
            check("scan point: opens its checklist, not the Start screen", cl["name"] in body and "What are you doing right now" not in body, body[:300])
            stok = token_for(*acc["staff"])
            ins = api("/api/inspections", "POST", {"inspectionPointId": pt["id"]}, stok)
            row = q("SELECT checklist_id, site_id, inspection_point_id FROM inspections WHERE id = ?", ins["id"])[0]
            check("scan point: inspection records the point and takes its checklist + site",
                  row["inspection_point_id"] == pt["id"] and row["checklist_id"] == cl["id"] and row["site_id"] == pt["site_id"], dict(row))
            check("scan path: no JS errors", not errs, errs)

            # ── Retired point: label on the wall says so ──
            api(f"/api/inspection-points/{pt['id']}", "DELETE", None, adm)
            pg.goto(f"{BASE}/?open=point:{pt['id']}"); pg.wait_for_timeout(2200)
            check("retired point: clear message, not a blank screen", "no longer active" in pg.inner_text("body"))
            ctx.close()

            # ── Maintenance: admin adds on the asset page ──
            a0 = assets[0]
            ctx = b.new_context(**PHONE); pg = ctx.new_page(); errs = watch_errors(pg)
            login(pg, *acc["admin"]); pg.goto(f"{BASE}/?open=asset:{a0['id']}"); pg.wait_for_timeout(2200)
            pg.locator("button:visible", has_text="+ Add maintenance task").click(); pg.wait_for_timeout(300)
            pg.fill("input[placeholder^='Task, e.g.']", "E2E Drain condensate")
            pg.fill("input[type=number]", "7")
            pg.fill("input[type=date]", (datetime.date.today() - datetime.timedelta(days=10)).isoformat())
            pg.locator("button:visible", has_text="Add task").click(); pg.wait_for_timeout(1000)
            m = q("SELECT * FROM asset_maintenance WHERE task = 'E2E Drain condensate'")
            check("maintenance: stored with interval and next due", m and m[0]["interval_days"] == 7 and m[0]["next_due"], m and dict(m[0]))
            check("maintenance: overdue shown in red wording", "Overdue" in pg.inner_text("body"))
            check("admin maintenance path: no JS errors", not errs, errs)
            ctx.close()

            # ── Staff at the machine marks it done ──
            ctx = b.new_context(**PHONE); pg = ctx.new_page(); errs = watch_errors(pg)
            login(pg, *acc["staff"]); pg.goto(f"{BASE}/?open=asset:{a0['id']}"); pg.wait_for_timeout(2200)
            check("staff: sees the schedule", "E2E Drain condensate" in pg.inner_text("body"))
            check("staff: cannot add tasks (no button)", pg.locator("button:visible", has_text="+ Add maintenance task").count() == 0)
            pg.locator("button:visible", has_text="✓ Done").first.click(); pg.wait_for_timeout(300)
            pg.locator("button:visible", has_text="Confirm done").first.click(); pg.wait_for_timeout(1200)
            m2 = q("SELECT * FROM asset_maintenance WHERE task = 'E2E Drain condensate'")[0]
            want = (datetime.date.today() + datetime.timedelta(days=7)).isoformat()
            check("done: next due rolls forward by the interval", m2["next_due"] == want, (m2["next_due"], want))
            lg = q("SELECT l.*, u.email FROM asset_maintenance_log l JOIN users u ON u.id = l.done_by WHERE maintenance_id = ?", m2["id"])
            check("done: logged with who did it", lg and lg[-1]["email"] == acc["staff"][0], [dict(r) for r in lg])
            check("done: overdue cleared on screen", "Overdue" not in pg.inner_text("body"))
            st, _ = call(f"/api/assets/{a0['id']}/maintenance", "POST", {"task": "x", "intervalDays": 5}, token_for(*acc["staff"]))
            check("staff: cannot add tasks (API)", st == 403, st)
            check("staff maintenance path: no JS errors", not errs, errs)
            ctx.close()
            b.close()

        # ── Boundaries ──
        st, bad = call("/api/assets/1/maintenance", "POST", {"task": "x", "intervalDays": 0}, adm)
        check("validation: interval must be ≥ 1 day", st == 400, st)
        en = api("/api/op/tenants", "POST", {"name": "E2E Other Co", "industry": "x", "adminEmail": "e2e-other@example.com", "adminName": "O"}, op)
        other = api("/api/auth/login", "POST", {"email": "e2e-other@example.com", "password": en["tempPassword"]})["token"]
        api("/api/auth/change-password", "POST", {"current": en["tempPassword"], "next": "OtherCo!2026x"}, other)
        other = api("/api/auth/login", "POST", {"email": "e2e-other@example.com", "password": "OtherCo!2026x"})["token"]
        st, labels = call("/api/qr/labels", "POST", {"items": [{"kind": "asset", "id": a["id"]} for a in assets]}, other)
        check("isolation: another company can't print our labels", st == 200 and labels == [], (st, labels))
        st, _ = call(f"/api/assets/{assets[0]['id']}/maintenance", "GET", None, other)
        check("isolation: another company can't read our maintenance", st in (403, 404), st)
        api("/api/op/tenants/1/modules/equipment", "PUT", {"enabled": False}, op)
        st, labels = call("/api/qr/labels", "POST", {"items": [{"kind": "asset", "id": assets[0]["id"]}]}, adm)
        check("module off: equipment labels not produced", labels == [] or st in (403,), (st, labels))
        api("/api/op/tenants/1/modules/equipment", "PUT", {"enabled": True}, op)
    finally:
        proc.terminate()
    fails = [r for r in RESULTS if not r[1]]
    print(f"\n{len(RESULTS) - len(fails)}/{len(RESULTS)} QR checks passed")
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
