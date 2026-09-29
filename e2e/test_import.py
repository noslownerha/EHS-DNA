"""
PowerPoint import — a real deck imported through the phone UI into a new
course, saved, and then taken by a staff member (slides + picture visible).
"""
import sys, os, json, subprocess, urllib.error, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
from playwright.sync_api import sync_playwright

RESULTS = []
def check(name, ok, detail=""):
    RESULTS.append((name, bool(ok), detail))
    print(("PASS" if ok else "FAIL"), name, ("— " + str(detail)[:240]) if (detail and not ok) else "")

DECK, BAD = "/tmp/e2e-deck.pptx", "/tmp/e2e-bad.pptx"

def upload(tok, path):
    req = urllib.request.Request(BASE + "/api/trainings/import-pptx", data=open(path, "rb").read(), method="POST",
                                 headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/octet-stream"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r: return r.status
    except urllib.error.HTTPError as e: return e.code

def main():
    subprocess.run(["node", os.path.join(os.path.dirname(os.path.abspath(__file__)), "make_deck.cjs"), DECK], cwd=ROOT, check=True)
    open(BAD, "wb").write(b"definitely not a powerpoint")
    proc = boot_server()
    try:
        acc = seed_accounts()
        with sync_playwright() as p:
            b = p.chromium.launch()
            pg = b.new_context(**PHONE).new_page(); errs = watch_errors(pg)
            login(pg, *acc["admin"]); tap(pg, "Training")
            pg.locator("button:visible", has_text="Add / edit courses").click(); pg.wait_for_timeout(1000)
            pg.locator("button:visible", has_text="+ New course").first.click(); pg.wait_for_timeout(1500)
            pg.set_input_files("input[aria-label='Import PowerPoint']", DECK); pg.wait_for_timeout(2500)
            status = pg.locator("[role=status]").inner_text() if pg.locator("[role=status]").count() else ""
            check("import: reports what it imported", "Imported 10 slides" in status and "speaker notes" in status, status)
            check("import: course title taken from the deck", pg.locator("input").first.input_value() == "Forklift Safety Refresher", pg.locator("input").first.input_value())
            check("import: slide headings filled in", pg.locator("input[value='Pre-use inspection']").count() == 1)
            check("import: picture previewed in the editor", pg.locator("button:visible", has_text="Remove picture").count() == 1)
            pg.locator("button:visible", has_text="Save").first.click(); pg.wait_for_timeout(1500)
            row = q("SELECT content FROM trainings WHERE title = 'Forklift Safety Refresher'")
            c = json.loads(row[0]["content"]) if row else {}
            check("save: 10 slides stored", len(c.get("slides", [])) == 10, len(c.get("slides", [])))
            check("save: bullets kept", "• Check forks for cracks" in (c["slides"][1]["body"] if c else ""), c and c["slides"][1])
            check("save: table text kept", "FL-07 | 5,000 lb" in (c["slides"][2]["body"] if c else ""))
            check("save: notes used for the notes-only slide", "stability triangle" in (c["slides"][3]["body"] if c else ""))
            img = c["slides"][1].get("imageId") if c else None
            check("save: picture stored as a company photo", img and q("SELECT owner_type FROM photo_files WHERE id = ?", img)[0]["owner_type"] == "training")

            pg.set_input_files("input[aria-label='Import PowerPoint']", BAD); pg.wait_for_timeout(1500)
            msg = pg.locator("[role=status]").inner_text()
            check("bad file: plain-English error", "isn't a readable PowerPoint" in msg, msg)
            check("admin import path: no JS errors", not errs, errs)
            pg.context.close()

            # Staff takes the imported course
            pg = b.new_context(**PHONE).new_page(); errs = watch_errors(pg)
            login(pg, *acc["staff"]); tap(pg, "Training"); pg.get_by_text("Forklift Safety Refresher").first.click(); pg.wait_for_timeout(1000)
            check("staff: first slide shows the imported title", "Forklift Safety Refresher" in pg.inner_text("body"))
            pg.locator("button:visible", has_text="Next").first.click(); pg.wait_for_timeout(1500)
            body = pg.inner_text("body")
            check("staff: slide 2 text shown", "Check forks for cracks" in body, body[:300])
            src = pg.locator("img").first.get_attribute("src") if pg.locator("img").count() else ""
            check("staff: slide picture loads (authenticated)", (src or "").startswith("blob:"), src)
            check("staff course path: no JS errors", not errs, errs)
            b.close()

        check("staff: cannot import decks", upload(token_for(*acc["staff"]), DECK) == 403)
        check("trainer: can import decks", upload(token_for(*acc["trainer"]), DECK) == 200)
    finally:
        proc.terminate()
    fails = [r for r in RESULTS if not r[1]]
    print(f"\n{len(RESULTS) - len(fails)}/{len(RESULTS)} import checks passed")
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
