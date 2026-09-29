"""
In-person training: the trainee acknowledges, a trainer/manager confirms, and
only the confirmation creates a completion. Also course management: one clear
"Add / edit courses" entry, an Edit button per course, builder opens on it.
"""
import sys, os, json, urllib.error
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

TITLE = "E2E Forklift Practical"

def completions(email):
    return q("""SELECT c.* FROM training_completions c JOIN users u ON u.id = c.user_id JOIN trainings t ON t.id = c.training_id
                WHERE u.email = ? AND t.title = ?""", email, TITLE)

def main():
    proc = boot_server()
    try:
        acc = seed_accounts(); adm = token_for(*acc["admin"])
        tr = api("/api/trainings", "POST", {"title": TITLE, "kind": "in_person", "frequencyMonths": 36, "requiredRoles": ["staff", "trainer"]}, adm)
        tid = tr["id"]; staff_email = acc["staff"][0]; stok = token_for(*acc["staff"])

        # The hole: claiming a different method no longer works
        st, body = call("/api/completions", "POST", {"trainingId": tid, "method": "cbt"}, stok)
        check("server: trainee cannot self-complete in-person by claiming 'cbt'", st == 403 and not completions(staff_email), (st, body))

        with sync_playwright() as p:
            b = p.chromium.launch()
            pg = b.new_context(**PHONE).new_page(); errs = watch_errors(pg)
            login(pg, *acc["staff"]); tap(pg, "Training"); pg.get_by_text(TITLE).first.click(); pg.wait_for_timeout(900)
            body = pg.inner_text("body")
            check("trainee: sees acknowledgement screen, not a Finish button", "once your trainer or manager confirms" in body and "Finish" not in body, body[:300])
            pg.fill("textarea", "Jordan, Tuesday session")
            pg.locator("button:visible", has_text="I received this training").click(); pg.wait_for_timeout(1000)
            check("trainee: told it's waiting on the trainer", "Waiting for your trainer to confirm" in pg.inner_text("body"))
            ack = q("SELECT * FROM training_acknowledgements WHERE training_id = ?", tid)
            check("ack: stored as pending with the note", ack and ack[0]["status"] == "pending" and "Jordan" in (ack[0]["note"] or ""), ack and dict(ack[0]))
            check("ack: NO completion created yet", not completions(staff_email))
            pg.get_by_text("← My training").click(); pg.wait_for_timeout(1000)
            check("queue: shows Awaiting confirmation", "Awaiting confirmation" in pg.inner_text("body"))
            check("trainee path: no JS errors", not errs, errs)
            pg.context.close()

            notified = {r["email"] for r in q("""SELECT u.email FROM notifications n JOIN users u ON u.id = n.user_id
                                                 WHERE n.link_ref = 'confirm'""")}
            check("notify: trainer, safety, admin and the site's manager told", {acc[r][0] for r in ("trainer", "safety", "admin", "site_manager")} <= notified, notified)
            check("notify: not the trainee, not the operator", staff_email not in notified and acc["operator"][0] not in notified, notified)

            # Trainer says "not yet" — reason required, trainee sees it
            pg = b.new_context(**PHONE).new_page(); errs = watch_errors(pg)
            login(pg, *acc["trainer"]); tap(pg, "Training"); pg.wait_for_timeout(600)
            body = pg.inner_text("body")
            check("trainer: 'Waiting for your confirmation' shown on Training", "Waiting for your confirmation (1)" in body, body[:300])
            pg.locator("button:visible", has_text="Not yet").click(); pg.wait_for_timeout(300)
            check("decline: needs a reason", not pg.locator("button:visible", has_text='Send "not yet"').is_enabled())
            pg.fill("input[placeholder^='Why?']", "Missed the hands-on part — join Thursday")
            pg.locator("button:visible", has_text='Send "not yet"').click(); pg.wait_for_timeout(1000)
            check("decline: stored with reason, still no completion",
                  q("SELECT status FROM training_acknowledgements WHERE training_id=?", tid)[0]["status"] == "declined" and not completions(staff_email))
            check("trainer path: no JS errors", not errs, errs)
            pg.context.close()

            pg = b.new_context(**PHONE).new_page(); errs = watch_errors(pg)
            login(pg, *acc["staff"]); tap(pg, "Training")
            check("queue: shows Not confirmed", "Not confirmed" in pg.inner_text("body"))
            pg.get_by_text(TITLE).first.click(); pg.wait_for_timeout(800)
            check("trainee: sees the trainer's reason", "Missed the hands-on part" in pg.inner_text("body"))
            pg.locator("button:visible", has_text="Send again").click(); pg.wait_for_timeout(1000)
            pg.context.close()

            # Admin confirms
            pg = b.new_context(**PHONE).new_page(); errs = watch_errors(pg)
            login(pg, *acc["admin"]); tap(pg, "Training")
            pg.locator("button:visible", has_text="Confirm").first.click(); pg.wait_for_timeout(1200)
            c = completions(staff_email)
            check("confirm: completion created, in person, passed, with expiry", len(c) == 1 and c[0]["method"] == "inperson" and c[0]["passed"] == 1 and c[0]["expires_at"], [dict(x) for x in c])
            n = q("""SELECT n.title FROM notifications n JOIN users u ON u.id = n.user_id WHERE u.email = ? AND n.link_ref = 'ack'""", staff_email)
            check("confirm: trainee notified", any("confirmed" in r["title"] for r in n), [dict(r) for r in n])

            # ── Course management ──
            body = pg.inner_text("body")
            check("courses: one clear 'Add / edit courses' button", "Add / edit courses" in body and "+ New course" not in body and "Manage courses" not in body)
            pg.locator("button:visible", has_text="Add / edit courses").click(); pg.wait_for_timeout(1200)
            check("courses: every course has an Edit button", pg.locator("button[aria-label^='Edit ']").count() >= 3)
            pg.locator(f"button[aria-label='Edit {TITLE}']").click(); pg.wait_for_timeout(1500)
            check("edit: builder opens on THAT course", pg.locator("input").first.input_value() == TITLE, pg.locator("input").first.input_value())
            pg.locator("button:visible", has_text="← Back").first.click() if pg.locator("button:visible", has_text="← Back").count() else None
            pg.wait_for_timeout(900)
            if pg.locator("button:visible", has_text="+ New course").count():
                pg.locator("button:visible", has_text="+ New course").first.click(); pg.wait_for_timeout(1500)
                check("new: builder opens on a fresh course", pg.locator("input").first.input_value() == "New course", pg.locator("input").first.input_value())
            check("admin path: no JS errors", not errs, errs)
            b.close()

        # ── Boundaries ──
        ttok = token_for(*acc["trainer"])
        st, _ = call("/api/completions", "POST", {"trainingId": tid, "method": "inperson"}, ttok)
        check("self: a trainer can't sign off their own in-person training", st == 403, st)
        a2 = api(f"/api/trainings/{tid}/acknowledge", "POST", {}, ttok)
        check("self: own acknowledgement not in own confirm list", all(r["id"] != a2["id"] for r in api("/api/training-acks", "GET", None, ttok)))
        st, _ = call(f"/api/training-acks/{a2['id']}/confirm", "POST", {}, ttok)
        check("self: can't confirm own acknowledgement", st == 403, st)
        other_site = api("/api/users", "POST", {"email": "e2e-sm2@example.com", "name": "SM Two", "role": "site_manager", "siteId": 2, "password": USER_PW}, adm)
        smtok = token_for("e2e-sm2@example.com", USER_PW)
        st, _ = call(f"/api/training-acks/{a2['id']}/confirm", "POST", {}, smtok)
        check("site: another site's manager can't confirm", st == 403, st)
        st, _ = call(f"/api/training-acks/{a2['id']}/confirm", "POST", {}, stok)
        check("staff: can't confirm anyone", st == 403, st)
    finally:
        proc.terminate()
    fails = [r for r in RESULTS if not r[1]]
    print(f"\n{len(RESULTS) - len(fails)}/{len(RESULTS)} in-person checks passed")
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
