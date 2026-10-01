"""Legal pages: public (no sign-in), linked from sign-in and the account menu,
always revalidated (not year-cached), readable on a phone, AA contrast."""
import sys, os, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
from playwright.sync_api import sync_playwright

RESULTS = []
def check(name, ok, detail=""):
    RESULTS.append((name, bool(ok), detail)); print(("PASS" if ok else "FAIL"), name, ("— " + str(detail)[:200]) if (detail and not ok) else "")

def main():
    proc = boot_server()
    try:
        acc = seed_accounts()
        for path, must in (("/legal/terms.html", ["Joseph McRory LLC", "Customer owns its data", "New York", "test environment"]),
                           ("/legal/privacy.html", ["Hetzner Online GmbH", "Germany", "never sell", "Tag my current location", "info@ehsdna.com"])):
            r = urllib.request.urlopen(BASE + path, timeout=10); html = r.read().decode()
            check(f"{path}: public, no sign-in needed", r.status == 200)
            check(f"{path}: not year-cached", "no-cache" in (r.headers.get("Cache-Control") or ""), r.headers.get("Cache-Control"))
            check(f"{path}: key commitments present", all(m in html for m in must), [m for m in must if m not in html])
        AXE = open(os.path.join(ROOT, "node_modules", "axe-core", "axe.min.js")).read()
        with sync_playwright() as p:
            b = p.chromium.launch()
            pg = b.new_context(**PHONE, bypass_csp=True).new_page(); errs = watch_errors(pg)
            pg.goto(BASE + "/"); pg.wait_for_timeout(1000)
            check("sign-in: Terms link", pg.locator("a[href='/legal/terms.html']").count() == 1)
            check("sign-in: Privacy link", pg.locator("a[href='/legal/privacy.html']").count() == 1)
            pg.locator("a[href='/legal/privacy.html']").click(); pg.wait_for_timeout(800)
            check("sign-in → Privacy opens", "Privacy Policy" in pg.inner_text("h1"))
            check("legal page: no sideways scroll on a phone", pg.evaluate("document.documentElement.scrollWidth - innerWidth") <= 2)
            pg.add_script_tag(content=AXE)
            v = pg.evaluate("async () => (await axe.run(document, { runOnly: { type: 'rule', values: ['color-contrast'] } })).violations.length")
            check("legal page: WCAG AA contrast", v == 0, v)
            pg.context.close()
            pg = b.new_context(**PHONE).new_page(); login(pg, *acc["staff"])
            pg.get_by_role("button", name="Account menu").click(); pg.wait_for_timeout(400)
            check("account menu: Terms + Privacy links", pg.locator("a[href='/legal/terms.html']").count() == 1 and pg.locator("a[href='/legal/privacy.html']").count() == 1)
            check("no JS errors", not errs, errs)
            b.close()
    finally:
        proc.terminate()
    fails = [r for r in RESULTS if not r[1]]
    print(f"\n{len(RESULTS) - len(fails)}/{len(RESULTS)} legal checks passed"); sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
