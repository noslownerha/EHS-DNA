"""
Training / LMS — a course is assigned, taken on a phone by staff, failed, retaken,
passed, and certified; every outcome checked in the database. Also verifies the
expiry-reminder job actually runs (it silently never fired in production: it
queried a table that doesn't exist and the catch only logged).
"""
import sys, os, datetime, urllib.error
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
from playwright.sync_api import sync_playwright

RESULTS = []
def check(name, ok, detail=""):
    RESULTS.append((name, bool(ok), detail))
    print(("PASS" if ok else "FAIL"), name, ("— " + str(detail)[:240]) if (detail and not ok) else "")

TITLE = "E2E Guard Interlock Awareness"
COURSE = {"title": TITLE, "kind": "cbt", "frequencyMonths": 12, "requiredRoles": ["staff"],
          "content": {"passThreshold": 100,
                      "slides": [{"heading": "E2E slide one", "body": "Body one"}, {"heading": "E2E slide two", "body": "Body two"}],
                      "questions": [{"q": "E2E Q1 pick Right", "choices": ["Wrong", "Right"], "correctIndex": 1},
                                    {"q": "E2E Q2 pick Yes", "choices": ["Yes", "No"], "correctIndex": 0}]}}

def take_course(pg, answers):
    """Walk slides + questions. answers: {question_text_fragment: choice_text}."""
    tap(pg, "Training"); pg.get_by_text(TITLE).first.click(); pg.wait_for_timeout(900)
    for _ in range(14):
        body = pg.inner_text("body")
        for frag, choice in answers.items():
            if frag in body:
                pg.get_by_text(choice, exact=True).first.click(); pg.wait_for_timeout(250)
                ca = pg.locator("button:visible", has_text="Check answer")
                if ca.count() and ca.first.is_enabled(): ca.first.click(); pg.wait_for_timeout(400)
        nxt = [l for l in ("Next →", "Finish", "Submit", "Complete", "See results") if pg.locator("button:visible", has_text=l).count()]
        if not nxt: break
        btn = pg.locator("button:visible", has_text=nxt[0]).first
        if not btn.is_enabled(): break
        btn.click(); pg.wait_for_timeout(800)
    return pg.inner_text("body")

def comp(user_email):
    return q("""SELECT c.* FROM training_completions c JOIN users u ON u.id=c.user_id JOIN trainings t ON t.id=c.training_id
                WHERE u.email=? AND t.title=? ORDER BY c.id""", user_email, TITLE)

def main():
    proc = boot_server()
    try:
        acc = seed_accounts(); tok = token_for(*acc["admin"])
        api("/api/trainings", "POST", COURSE, tok)
        staff_email = acc["staff"][0]
        with sync_playwright() as p:
            b = p.chromium.launch()
            pg = b.new_context(**PHONE).new_page(); errs = watch_errors(pg)
            login(pg, *acc["staff"]); tap(pg, "Training")
            body = pg.inner_text("body")
            check("queue: assigned course appears for staff", TITLE in body)
            check("queue: shows as not started", "Not started" in body)

            # ── Fail ──
            end = take_course(pg, {"E2E Q1": "Wrong", "E2E Q2": "No"})
            rows = comp(staff_email)
            check("fail: attempt recorded", len(rows) == 1, [dict(r) for r in rows])
            check("fail: marked NOT passed", rows and rows[-1]["passed"] == 0, rows and dict(rows[-1]))
            check("fail: no certificate offered", "Certificate" not in end, end[-300:])
            check("fail: no expiry granted", rows and rows[-1]["expires_at"] is None, rows and dict(rows[-1]))
            tap(pg, "Training")
            check("fail: course NOT shown as current", "Needs retake" in pg.inner_text("body") or "Not started" in pg.inner_text("body"),
                  pg.inner_text("body")[:300])

            # ── Pass ──
            end = take_course(pg, {"E2E Q1": "Right", "E2E Q2": "Yes"})
            rows = comp(staff_email)
            check("pass: second attempt recorded", len(rows) == 2, len(rows))
            check("pass: marked passed with score", rows and rows[-1]["passed"] == 1 and (rows[-1]["score"] or 0) >= 100, rows and dict(rows[-1]))
            exp = rows[-1]["expires_at"] if rows else None
            want = (datetime.date.today() + datetime.timedelta(days=365))
            check("pass: expiry set ~12 months out", exp and abs((datetime.date.fromisoformat(exp[:10]) - want).days) <= 3, exp)
            check("pass: result screen says recorded AND it is (no Done tap needed)",
                  "recorded" in end and len(rows) == 2, end[-200:])
            tap(pg, "Training")
            check("queue: now current", "Current" in pg.inner_text("body"), pg.inner_text("body")[:300])
            card = pg.locator(f"div:has-text('{TITLE}') >> button:has-text('Certificate'):visible")
            check("certificate: offered on the passed course's card", card.count() >= 1)
            check("staff training path: no JS errors", not errs, errs)
            pg.context.close()

            # ── Admin compliance reflects it ──
            pg = b.new_context(**PHONE).new_page(); errs = watch_errors(pg)
            login(pg, *acc["admin"]); tap(pg, "Training")
            body = pg.inner_text("body")
            check("admin: Training tab opens compliance, not a personal queue", "compliance" in body.lower(), body[:200])
            check("admin compliance path: no JS errors", not errs, errs)
            pg.context.close()

        # ── Reminder job: an expiring completion produces a notification ──
        c = db_exec = __import__("sqlite3").connect(DB)
        soon = (datetime.datetime.utcnow() + datetime.timedelta(days=5)).isoformat()
        c.execute("UPDATE training_completions SET expires_at=? WHERE id=(SELECT MAX(id) FROM training_completions)", (soon,)); c.commit(); c.close()
        op = token_for(*acc["operator"])
        api("/api/op/run-reminders", "POST", {}, op)
        n = q("""SELECT n.title FROM notifications n JOIN users u ON u.id=n.user_id WHERE u.email=? AND n.link_kind='training'""", staff_email)
        check("reminders: expiring training notifies the person (never fired before)", any("expiring" in r["title"].lower() for r in n), [dict(r) for r in n])
        api("/api/op/run-reminders", "POST", {}, op)
        n2 = q("""SELECT COUNT(*) k FROM notifications n JOIN users u ON u.id=n.user_id WHERE u.email=? AND n.link_kind='training'""", staff_email)[0]["k"]
        check("reminders: not repeated on the next run (7-day dedupe)", n2 == len(n), n2)
    finally:
        proc.terminate()
    fails = [r for r in RESULTS if not r[1]]
    print(f"\n{len(RESULTS) - len(fails)}/{len(RESULTS)} training checks passed")
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
