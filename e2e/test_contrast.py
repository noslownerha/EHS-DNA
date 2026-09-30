"""
WCAG AA colour contrast, measured on the RENDERED app (axe-core's color-contrast
rule) across every role's main screens on phone and desktop. Any text that
drops below 4.5:1 (3:1 for large text) anywhere fails the suite — so a future
colour change can't quietly make something unreadable.
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
from playwright.sync_api import sync_playwright

AXE = open(os.path.join(ROOT, "node_modules", "axe-core", "axe.min.js")).read()
SCREENS = {
    "admin": ["Home", "Flag", "Inspect", "Training", "Analyze"],
    "staff": ["Home", "Flag", "Inspect", "Training"],
    "operator": ["Attention", "Overview", "Companies", "Billing"],
}

def scan(pg):
    pg.add_script_tag(content=AXE)
    return pg.evaluate("""async () => {
        const r = await axe.run(document, { runOnly: { type: 'rule', values: ['color-contrast'] } });
        return r.violations.flatMap(v => v.nodes.map(n => ({
            html: n.html.slice(0, 110),
            summary: (n.any[0] && n.any[0].data) ? `${n.any[0].data.contrastRatio}:1 (${n.any[0].data.fgColor} on ${n.any[0].data.bgColor}, need ${n.any[0].data.expectedContrastRatio})` : n.failureSummary.slice(0, 120)
        })));
    }""")

def main():
    report = {}
    proc = boot_server()
    try:
        acc = seed_accounts()
        with sync_playwright() as p:
            b = p.chromium.launch()
            for role, tabs in SCREENS.items():
                for vp_name, vp in (("phone", PHONE), ("desktop", DESKTOP)):
                    pg = b.new_context(**vp, bypass_csp=True).new_page(); login(pg, *acc[role])  # test-only: lets the axe scanner load
                    pg.goto(BASE + "/") if False else None
                    # sign-in page first (only once)
                    for t in tabs:
                        pg.locator("button", has_text=t).last.click(); pg.wait_for_timeout(1300)
                        v = scan(pg)
                        report[f"{role}/{vp_name}/{t}"] = v
                    pg.context.close()
            pg = b.new_context(**PHONE, bypass_csp=True).new_page(); pg.goto(BASE + "/"); pg.wait_for_timeout(1200)
            report["signed-out/phone/Sign in"] = scan(pg)
            b.close()
    finally:
        proc.terminate()
    json.dump(report, open("/tmp/contrast-report.json", "w"), indent=1)
    total = 0
    for screen, v in report.items():
        total += len(v)
        print(("PASS" if not v else "FAIL"), screen, "" if not v else f"— {len(v)} element(s)")
        for n in v[:4]:
            print("      ", n["summary"], "|", n["html"][:80])
    print(f"\n{len(report) - sum(1 for v in report.values() if v)}/{len(report)} screens pass WCAG AA contrast ({total} failing elements)")
    sys.exit(1 if total else 0)

if __name__ == "__main__":
    main()
