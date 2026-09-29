"""
Reports — TRIR arithmetic with entered payroll hours, OSHA 300 inclusion rules,
the MBR slide export, and that non-safety findings stay out of every safety
number (the MBR slide used to count them).
"""
import sys, os, datetime, zipfile, io, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
from playwright.sync_api import sync_playwright

RESULTS = []
def check(name, ok, detail=""):
    RESULTS.append((name, bool(ok), detail))
    print(("PASS" if ok else "FAIL"), name, ("— " + str(detail)[:260]) if (detail and not ok) else "")

def raw(path, tok):
    r = urllib.request.urlopen(urllib.request.Request(BASE + path, headers={"Authorization": f"Bearer {tok}"}), timeout=30)
    return r.headers.get("Content-Type", ""), r.read()

def main():
    proc = boot_server()
    try:
        acc = seed_accounts(); tok = token_for(*acc["admin"])
        ym = datetime.date.today().strftime("%Y-%m")
        # Two injuries at Moriah this month: one recordable, one first-aid only.
        i1 = api("/api/incidents", "POST", {"type": "injury", "severity": "significant", "siteId": 1, "description": "E2E-R-01 laceration needing stitches"}, tok)
        i2 = api("/api/incidents", "POST", {"type": "injury", "severity": "minor", "siteId": 1, "description": "E2E-R-02 bandage only"}, tok)
        api(f"/api/incidents/{i1['id']}", "PUT", {"oshaClassification": "Recordable – Medical treatment"}, tok)
        api(f"/api/incidents/{i2['id']}", "PUT", {"oshaClassification": "First aid only"}, tok)
        api("/api/labor-hours", "PUT", {"siteId": 1, "month": ym, "hours": 20000}, tok)
        # Safety + non-safety findings at Moriah
        api("/api/findings", "POST", {"siteId": 1, "severity": "major", "description": "E2E-RF-01 guard missing"}, tok)
        api("/api/findings", "POST", {"siteId": 1, "severity": "minor", "description": "E2E-RF-02 dusty baseboard", "safetyRelevant": False}, tok)

        s = api("/api/reports/incident-summary?months=1", "GET", None, tok)
        m = next((x for x in s.get("months", []) if x["month"] == ym), {})
        mor = next((x for x in m.get("sites", []) if x["siteId"] == 1), {})
        check("TRIR: counts only the recordable (first aid excluded)", mor.get("recordables") == 1, mor)
        check("TRIR: uses entered payroll hours, not the headcount estimate", mor.get("estHours") == 20000 and mor.get("hoursActual") is True, mor)
        trir = mor.get("recordables", 0) * 200000 / max(1, mor.get("estHours", 1))
        check("TRIR: arithmetic = 1 × 200,000 / 20,000 = 10.0", abs(trir - 10.0) < 1e-9, trir)

        osha = api(f"/api/reports/osha300?year={ym[:4]}", "GET", None, tok)
        rows = osha if isinstance(osha, list) else osha.get("cases", osha.get("rows", []))
        text = str(rows)
        check("OSHA 300: recordable case listed", "E2E-R-01" in text or any(str(r.get("id")) == str(i1["id"]) for r in rows if isinstance(r, dict)), text[:300])
        check("OSHA 300: first-aid case NOT listed", "E2E-R-02" not in text, text[:300])

        prev = api("/api/reports/mbr/preview", "GET", None, tok)
        ps = str(prev)
        site = next((x for x in prev.get("sites", []) if x.get("siteId") == 1 or x.get("site") == "Moriah" or x.get("name") == "Moriah"), None) if isinstance(prev, dict) else None
        check("MBR: non-safety finding excluded from the slide's findings count",
              site is not None and site.get("findings") == 1, site or ps[:300])
        ctype, blob = raw("/api/reports/mbr/export", tok)
        ok_zip = blob[:2] == b"PK"
        slides = []
        if ok_zip:
            z = zipfile.ZipFile(io.BytesIO(blob)); slides = [n for n in z.namelist() if n.startswith("ppt/slides/slide")]
        check("MBR export: a real .pptx (zip) with at least one slide", ok_zip and len(slides) >= 1, (ctype, len(blob)))
        if ok_zip:
            xml = z.read(slides[0]).decode("utf8", "ignore")
            check("MBR export: slide defines TRIR", "200,000" in xml or "200000" in xml, xml[:200])

        with sync_playwright() as p:
            b = p.chromium.launch()
            pg = b.new_context(**PHONE).new_page(); errs = watch_errors(pg)
            login(pg, *acc["admin"])
            # Fresh sign-in, no reload: admin must be able to classify OSHA.
            tap(pg, "Home"); pg.locator("button.kpi-tile", has_text="incidents").first.click(); pg.wait_for_timeout(1300)
            import re
            pg.get_by_text(re.compile(r"INC-\d")).first.click(); pg.wait_for_timeout(1300)
            check("role: admin can set OSHA class right after sign-in (no refresh)",
                  pg.locator("select:visible").filter(has_text="Recordable").count() > 0)
            tap(pg, "Analyze"); pg.wait_for_timeout(800)
            gen = pg.locator("button:visible", has_text="Generate")
            if not gen.count(): print("ANALYZE BUTTONS:", [t for t in pg.locator("button:visible").all_inner_texts()][:20])
            gen.first.click(); pg.wait_for_timeout(2500)
            body = pg.inner_text("body")
            check("Report Builder: generates on a phone", "TRIR" in body, body[:400])
            check("Report Builder: shows the entered-hours TRIR (10.0)", "10.0" in body or "10.00" in body, body[:600])
            check("Report Builder: no JS errors", not errs, errs)
            b.close()
    finally:
        proc.terminate()
    fails = [r for r in RESULTS if not r[1]]
    print(f"\n{len(RESULTS) - len(fails)}/{len(RESULTS)} report checks passed")
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
