"""
Every bottom tab, tapped straight from Home, must land on ITS OWN screen — and
Home must come back. The nav sweep only checked that screens rendered without
errors, which let "Home → Analyze does nothing" ship (both tabs rendered the
same component at the same spot, so React kept the Home dashboard).
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
from playwright.sync_api import sync_playwright

RESULTS = []
def check(name, ok, detail=""):
    RESULTS.append((name, bool(ok), detail))
    print(("PASS" if ok else "FAIL"), name, ("— " + str(detail)[:200]) if (detail and not ok) else "")

# role -> [(tab, text that only that tab's screen shows)]
EXPECT = {
    "admin": [("Flag", "Report an injury"), ("Inspect", "Start inspection"), ("Training", "Training Compliance"), ("Analyze", "Report Builder")],
    "staff": [("Flag", "Report an injury"), ("Inspect", "Start inspection"), ("Training", "My training")],
    "operator": [("Overview", "Module adoption"), ("Companies", "Client companies"), ("Billing", "Outstanding"), ("Attention", "worth a look")],
}
HOME = {"admin": "Open incidents", "staff": "Report something", "operator": "Attention"}

def main():
    proc = boot_server()
    try:
        acc = seed_accounts()
        with sync_playwright() as p:
            b = p.chromium.launch()
            for role, tabs in EXPECT.items():
                for vp_name, vp in (("phone", PHONE), ("desktop", DESKTOP)):
                    pg = b.new_context(**vp).new_page(); errs = watch_errors(pg)
                    login(pg, *acc[role])
                    for tab, marker in tabs:
                        if role != "operator":
                            pg.locator("button", has_text="Home").last.click(); pg.wait_for_timeout(900)
                        pg.locator("button", has_text=tab).last.click(); pg.wait_for_timeout(1300)
                        body = pg.inner_text("body")
                        check(f"{role}/{vp_name}: Home → {tab} shows its screen", marker.lower() in body.lower(), body[:160])
                    if role != "operator":
                        pg.locator("button", has_text="Home").last.click(); pg.wait_for_timeout(900)
                        check(f"{role}/{vp_name}: back to Home", HOME[role].lower() in pg.inner_text("body").lower())
                    check(f"{role}/{vp_name}: no JS errors", not errs, errs)
                    pg.context.close()
            b.close()
    finally:
        proc.terminate()
    fails = [r for r in RESULTS if not r[1]]
    print(f"\n{len(RESULTS) - len(fails)}/{len(RESULTS)} tab checks passed")
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
