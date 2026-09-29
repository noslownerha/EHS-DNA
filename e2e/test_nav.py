"""
EHS DNA automated regression — phase 1: every role x every tab x phone + desktop.

Replaces the manual click-through for anything a headless browser can verify.
Boots a throwaway server on a scratch DB, seeds one account per role, then for
each role and each viewport visits every nav tab and records:
  - uncaught JS errors (white-screen class — the onBack / hooks-order regressions)
  - CrashShield / "Something went wrong" text on screen
  - horizontal overflow (the 360px clipping class)
  - nav tabs actually shown vs what that role should get (role-leak class)
Screenshots every screen. Exit code 1 if anything fails, so it can gate deploys.

Usage:  python3 e2e/run_e2e.py [--out DIR]
"""
import json, os, sys, shutil, argparse
from playwright.sync_api import sync_playwright

from lib import BASE, PHONE, DESKTOP, api, boot_server, seed_accounts, login

# What each role's bottom nav must contain — and must NOT (role-leak guard).
EXPECT = {
    "operator":     {"has": ["Attention", "Overview", "Companies", "Billing"], "not": ["Flag", "Inspect", "Training", "Analyze"]},
    "admin":        {"has": ["Home", "Flag", "Inspect", "Training", "Analyze"], "not": ["Attention", "Companies"]},
    "safety":       {"has": ["Home", "Flag", "Inspect", "Training", "Analyze"], "not": ["Attention", "Companies"]},
    "site_manager": {"has": ["Home", "Flag", "Inspect", "Training", "Analyze"], "not": ["Attention", "Companies"]},
    "trainer":      {"has": ["Home", "Training"], "not": ["Attention", "Companies"]},
    "staff":        {"has": ["Home", "Flag", "Inspect", "Training"], "not": ["Analyze", "Attention", "Companies", "Billing"]},
}
VIEWPORTS = {"phone": PHONE, "desktop": DESKTOP}
CRASH_TEXT = ["Something went wrong", "is not defined", "Minified React error"]


def nav_labels(pg):
    # The bottom tab bar is the last fixed nav on the page; read its button labels.
    return pg.evaluate("""() => {
        const navs = [...document.querySelectorAll('nav, [role=navigation], div')]
          .filter(n => getComputedStyle(n).position === 'fixed' && n.getBoundingClientRect().bottom >= innerHeight - 2
                       && n.querySelectorAll('button, a').length >= 2);
        const n = navs[navs.length - 1];
        return n ? [...n.querySelectorAll('button, a')].map(b => b.innerText.replace(/\\s+/g,' ').trim()).filter(Boolean) : [];
    }""")


def check_screen(pg, errs_before):
    body = pg.inner_text("body")
    problems = [f"crash text: '{t}'" for t in CRASH_TEXT if t in body]
    overflow = pg.evaluate("() => document.documentElement.scrollWidth - innerWidth")
    if overflow > 4: problems.append(f"horizontal overflow {overflow}px")
    if len(body.strip()) < 40: problems.append("near-empty screen (possible white-screen)")
    return problems


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--out", default="/tmp/e2e-out"); a = ap.parse_args()
    shutil.rmtree(a.out, ignore_errors=True); os.makedirs(a.out)
    proc = boot_server()
    results, failures = [], 0
    try:
        accounts = seed_accounts()
        with sync_playwright() as p:
            browser = p.chromium.launch()
            for role, (email, pw) in accounts.items():
                for vp_name, vp in VIEWPORTS.items():
                    ctx = browser.new_context(**vp); pg = ctx.new_page()
                    js_errs = []; pg.on("pageerror", lambda e: js_errs.append(str(e)[:200]))
                    login(pg, email, pw)
                    labels = nav_labels(pg)
                    exp = EXPECT[role]
                    nav_issues = [f"missing tab '{t}'" for t in exp["has"] if not any(t in l for l in labels)]
                    nav_issues += [f"LEAKED tab '{t}'" for t in exp["not"] if any(t in l for l in labels)]
                    rec = {"role": role, "viewport": vp_name, "nav": labels, "screens": [], "nav_issues": nav_issues}
                    for i, label in enumerate(labels or ["(landing)"]):
                        if labels:
                            pg.get_by_role("button", name=label).last.click() if pg.get_by_role("button", name=label).count() else pg.get_by_text(label).last.click()
                            pg.wait_for_timeout(1400)
                        n_before = len(js_errs)
                        probs = check_screen(pg, n_before) + [f"JS error: {e}" for e in js_errs[n_before:]]
                        shot = f"{role}-{vp_name}-{i:02d}-{label.split(' ')[-1].lower()}.png"
                        pg.screenshot(path=os.path.join(a.out, shot), full_page=False)
                        rec["screens"].append({"tab": label, "problems": probs, "shot": shot})
                    rec["js_errors"] = js_errs
                    bad = bool(nav_issues or js_errs or any(s["problems"] for s in rec["screens"]))
                    failures += bad
                    results.append(rec)
                    print(("FAIL" if bad else "PASS"), f"{role:13s} {vp_name:8s} tabs={len(labels)}",
                          "; ".join(nav_issues + [f"{s['tab']}: {', '.join(s['problems'])}" for s in rec['screens'] if s['problems']] + js_errs)[:300])
                    ctx.close()
            browser.close()
    finally:
        proc.terminate()
    json.dump(results, open(os.path.join(a.out, "results.json"), "w"), indent=1)
    print(f"\n{len(results) - failures}/{len(results)} role x viewport combos clean. Screenshots: {a.out}")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
