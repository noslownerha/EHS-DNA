"""
Equipment — asset created through the phone form, LOTO procedure added, QR deep
link opened logged-in and logged-out (the real-world scan), and role limits,
checked in the database.
"""
import sys, os, urllib.error
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
from playwright.sync_api import sync_playwright

RESULTS = []
def check(name, ok, detail=""):
    RESULTS.append((name, bool(ok), detail))
    print(("PASS" if ok else "FAIL"), name, ("— " + str(detail)[:260]) if (detail and not ok) else "")

V = "()=>[...document.querySelectorAll('input,textarea,select,button')].filter(e=>e.offsetParent).map(e=>e.tagName[0]+':'+(e.placeholder||e.innerText||e.type||'').replace(/\\s+/g,' ').slice(0,34))"

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
            login(pg, *acc["admin"]); tap(pg, "Equipment")
            check("registry: opens from Home", "Search assets" in str(pg.evaluate(V)))

            # ── Create through the form ──
            pg.locator("button:visible", has_text="New asset").first.click(); pg.wait_for_timeout(700)
            pg.fill("input[placeholder^='e.g. Bottling Line Transfer']", "E2E Transfer Pump")
            pg.fill("input[placeholder='PMP-014']", "E2E-PMP-01")
            sels = pg.locator("select:visible")
            sels.nth(0).select_option(index=0)                   # category
            sels.nth(1).select_option(label="Moriah")            # site
            pg.fill("input[placeholder^='Bottling Hall']", "E2E Bottling Hall — Line 2")
            sels.nth(3).select_option(index=1)                   # linked checklist
            pg.locator("button:visible", has_text="Create asset").first.click(); pg.wait_for_timeout(1400)
            a = q("SELECT * FROM assets WHERE name = 'E2E Transfer Pump'")
            check("create: stored", len(a) == 1)
            a = a[0] if a else None
            check("create: tag, site, location and checklist persisted",
                  a and a["asset_tag"] == "E2E-PMP-01" and a["site_id"] and a["location"] and a["checklist_id"], a and dict(a))
            check("create: appears in registry without reload", "E2E Transfer Pump" in pg.inner_text("body"))

            # ── Add a LOTO procedure via the edit form (✏️) ──
            # Click the ✏️ in the smallest element that contains this asset's name.
            pg.evaluate("""(name) => {
                const rows = [...document.querySelectorAll('div, tr, li')].filter(el =>
                    el.offsetParent && el.innerText && el.innerText.includes(name) &&
                    [...el.querySelectorAll('button')].filter(b => b.innerText.includes('✏️')).length === 1);
                rows.sort((x, y) => x.innerText.length - y.innerText.length);
                [...rows[0].querySelectorAll('button')].find(b => b.innerText.includes('✏️')).click();
            }""", "E2E Transfer Pump"); pg.wait_for_timeout(900)
            pg.locator("button:visible", has_text="+ Add").first.click(); pg.wait_for_timeout(500)   # first = Lockout / Tagout
            pg.fill("input[placeholder='Title']:visible", "E2E LOTO — pump isolation")
            pg.fill("textarea[placeholder^='One step per line']:visible", "Stop pump\nLock breaker 4B\nVerify zero energy")
            reqs = []; pg.on("request", lambda r: reqs.append(f"{r.method} {r.url.split(str(PORT))[-1]}") if "/procedures" in r.url else None)
            pg.get_by_role("button", name="Add", exact=True).first.click(); pg.wait_for_timeout(1400)
            if not q("SELECT 1 FROM asset_procedures WHERE asset_id = ?", a["id"]): print("DEBUG procedure requests:", reqs)
            pr = q("SELECT * FROM asset_procedures WHERE asset_id = ?", a["id"]) if a else []
            check("LOTO: procedure stored against the asset", any("pump isolation" in (r["title"] or "") for r in pr), [dict(r) for r in pr])
            check("LOTO: stored as lockout/tagout, not SOP", pr and "lo" in (pr[0]["kind"] or "").lower(), pr and dict(pr[0]))
            pg.locator("button:visible", has_text="Save changes").first.click(); pg.wait_for_timeout(1000)
            pg.get_by_text("E2E Transfer Pump").first.click(); pg.wait_for_timeout(1200)
            body = pg.inner_text("body")
            check("asset page: shows the LOTO steps", "Lock breaker 4B" in body or "pump isolation" in body, body[:400])
            check("asset page: offers the linked inspection", "INSPECTION" in body.upper() and "No inspection checklist linked" not in body, body[:400])
            check("admin equipment path: no JS errors", not errs, errs)

            # ── QR ──
            tok = token_for(*acc["admin"])
            qr = api(f"/api/assets/{a['id']}/qr", "GET", None, tok)
            check("QR: returns an SVG and a deep link to this asset",
                  "<svg" in (qr.get("svg") or "") and f"open=asset:{a['id']}" in (qr.get("deepLink") or ""), {k: str(v)[:60] for k, v in qr.items()})
            link = f"{BASE}/?open=asset:{a['id']}"
            pg.context.close()

            # ── Scan while signed in as staff ──
            pg = b.new_context(**PHONE).new_page(); errs = watch_errors(pg)
            login(pg, *acc["staff"])
            pg.goto(link); pg.wait_for_timeout(2200)
            body = pg.inner_text("body")
            check("scan (signed in): lands on the asset", "E2E Transfer Pump" in body, body[:300])
            check("scan (signed in): LOTO steps readable by staff", "pump isolation" in body or "Lock breaker" in body, body[:400])
            check("scan: URL param cleared so refresh doesn't re-trigger", "open=" not in pg.url, pg.url)
            check("staff: cannot create assets (API)", status_of("/api/assets", "POST", {"name": "E2E staff asset"}, token_for(*acc["staff"])) in (401, 403))
            check("staff scan path: no JS errors", not errs, errs)
            pg.context.close()

            # ── Scan while signed OUT (a phone that's never logged in) ──
            pg = b.new_context(**PHONE).new_page(); errs = watch_errors(pg)
            pg.goto(link); pg.wait_for_timeout(1500)
            check("scan (signed out): asks to sign in", pg.locator("input[type=password]").count() == 1)
            pg.fill("input[type=email]", acc["staff"][0]); pg.fill("input[type=password]", acc["staff"][1])
            pg.get_by_role("button", name="Sign in").click(); pg.wait_for_timeout(2500)
            body = pg.inner_text("body")
            check("scan (signed out): after sign-in, lands on the scanned asset (not Home)", "E2E Transfer Pump" in body, body[:300])
            check("signed-out scan path: no JS errors", not errs, errs)
            b.close()
    finally:
        proc.terminate()
    fails = [r for r in RESULTS if not r[1]]
    print(f"\n{len(RESULTS) - len(fails)}/{len(RESULTS)} equipment checks passed")
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
