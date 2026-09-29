"""
Incident reporting — the highest-traffic path in the product, walked through the
real UI on a phone, with every outcome checked in the database.

Each check here exists because the thing it guards was found broken:
  - injury filed via triage handoff landed on the hazard/damage/idea picker, so no
    injury filed through the UI could ever reach TRIR / the OSHA 300 log
  - both flows showed a hardcoded placeholder triage provider (555 number)
    regardless of Triage Settings
  - staff reporters were told "No matching notification rules" (admin-only 403)
  - the operator account received customer incident alerts via role fan-out
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
from playwright.sync_api import sync_playwright

RESULTS = []
def check(name, ok, detail=""):
    RESULTS.append((name, bool(ok), detail))
    print(("PASS" if ok else "FAIL"), name, ("— " + str(detail)[:220]) if (detail and not ok) else "")


def injury_via_triage(pg, desc, provider_expected=None):
    tap(pg, "Flag"); tap(pg, "Report an injury"); tap(pg, "The immediate situation is handled")
    body = pg.inner_text("body")
    check("injury: triage handoff lands on the injury form (not the hazard picker)",
          "TYPE OF INJURY" in body.upper() and "A risk or hazard" not in body, body[:160])
    pg.fill("textarea", desc)
    pg.select_option("select >> nth=1", label="Laceration / Cut")
    pg.get_by_label("Needed medical treatment beyond basic first aid").check(); pg.wait_for_timeout(300)
    check("injury: OSHA-recordable banner appears", "OSHA-recordable" in pg.inner_text("body"))
    tap(pg, "Significant", exact=True)
    tap(pg, "Who was involved →", wait=1200)
    body = pg.inner_text("body")
    check("injury: no placeholder 555 triage number anywhere", "555-0147" not in body)
    if provider_expected:
        check("injury: triage prompt shows the tenant's CONFIGURED provider", provider_expected in body, body[:300])
    else:
        check("injury: no triage-call prompt when no provider is configured", "Consider calling triage" not in body)
    check("who: continue button no longer points at the removed Photos step",
          "Photos & location" not in body and "Review & submit →" in body)
    if pg.get_by_text("Understood, continue →").count(): tap(pg, "Understood, continue →")
    # An injury is about a person — it must NOT be submittable with nobody named.
    btn = pg.locator("button.continue-btn")
    check("injury: cannot proceed with nobody named", btn.count() and not btn.first.is_enabled())
    pg.fill("input[placeholder^='Type name']", "Safe"); pg.wait_for_timeout(600)
    tap(pg, "E2E Safety")
    tap(pg, "Review & submit →", wait=1500)
    return pg.inner_text("body")


def main():
    proc = boot_server()
    try:
        acc = seed_accounts()
        with sync_playwright() as p:
            b = p.chromium.launch()

            # ── 1. Injury via "Report an injury" → triage → handled, as STAFF ──
            pg = b.new_context(**PHONE).new_page(); errs = watch_errors(pg)
            login(pg, *acc["staff"])
            review = injury_via_triage(pg, "E2E-INC-01 caught hand between case packer guard and rail")
            check("review: type shows Injury", "TYPE | Injury" in review.replace("\n", " | ") or "\nInjury\n" in review)
            check("review: staff reporter sees real recipients (not 'No matching rules')",
                  "No matching notification rules" not in review and "No one —" not in review and "E2E Safety" in review, review[-400:])
            check("review: operator account is NOT listed as a recipient", "ahrenwolson" not in review and "Operator" not in review)
            tap(pg, "Submit incident report →", wait=2500)
            conf = pg.inner_text("body")
            check("submit: confirmation screen with a reference", "Incident reported" in conf and "INC-" in conf, conf[:200])
            inc = q("SELECT id, ref, type, severity, osha_classification, involved FROM incidents ORDER BY id DESC LIMIT 1")[0]
            check("db: stored as type=injury", inc["type"] == "injury", inc)
            check("db: provisionally flagged recordable", "recordable" in (inc["osha_classification"] or "").lower(), inc)
            check("db: involved person stored BY ID", '"id":' in (inc["involved"] or ""), inc["involved"])
            notified = q("""SELECT n.user_id, u.is_operator, n.emailed FROM notifications n JOIN users u ON u.id = n.user_id
                            WHERE n.link_ref = ?""", inc["ref"])
            check("db: someone was notified", len(notified) > 0, notified)
            check("db: operator NOT notified of customer incident", all(r["is_operator"] == 0 for r in notified), notified)
            check("db: 'emailed' not claimed when no mail provider configured", all(r["emailed"] == 0 for r in notified), notified)
            check("injury path: no JS errors", not errs, errs)
            pg.context.close()

            # ── 2. Configure a real provider → it's what workers see ──
            admin_tok = token_for(*acc["admin"])
            api("/api/config", "PUT", {"triage": {"providerName": "E2E Occ Health", "providerPhone": "(802) 555-0199"}}, admin_tok)
            pg = b.new_context(**PHONE).new_page(); errs = watch_errors(pg)
            login(pg, *acc["staff"])
            injury_via_triage(pg, "E2E-INC-02 configured provider check", provider_expected="E2E Occ Health")
            check("configured-provider path: no JS errors", not errs, errs)
            pg.context.close()

            # ── 3. Hazard via Flag something ──
            pg = b.new_context(**PHONE).new_page(); errs = watch_errors(pg)
            login(pg, *acc["staff"])
            tap(pg, "Flag"); tap(pg, "Flag something"); tap(pg, "A risk or hazard")
            body = pg.inner_text("body")
            check("hazard: no injury-type question", "TYPE OF INJURY" not in body.upper())
            pg.fill("textarea", "E2E-INC-03 pallet stacked over rack height")
            tap(pg, "Minor", exact=True)
            nxt = [t for t in ["Who was involved →", "Review & submit →", "Continue →"] if pg.get_by_text(t).count()]
            tap(pg, nxt[0], wait=1200)
            who = pg.inner_text("body")
            check("hazard: 'who was involved' is optional (says so)", "Optional" in who, who[:200])
            btn = pg.locator("button.continue-btn")
            check("hazard: can proceed with NOBODY named (used to be blocked)",
                  btn.count() and btn.first.is_enabled(), who[:200])
            if btn.count() and btn.first.is_enabled(): btn.first.click(); pg.wait_for_timeout(1200)
            review = pg.inner_text("body")
            check("hazard review: shows 'No one named', no demo person", "No one named" in review and "Sarah Mitchell" not in review, review[:300])
            check("hazard review: no 1970 epoch date", "1970" not in review, review[:300])
            tap(pg, "Submit", wait=2500)
            haz = q("SELECT type, osha_classification FROM incidents WHERE description LIKE 'E2E-INC-03%'")
            check("db: hazard stored as hazard, no OSHA flag",
                  haz and haz[0]["type"] == "hazard" and not haz[0]["osha_classification"], haz)
            check("hazard path: no JS errors", not errs, errs)
            pg.context.close()

            # ── 4. General triage from Home → file report → injury must be choosable, no loop ──
            pg = b.new_context(**PHONE).new_page(); errs = watch_errors(pg)
            login(pg, *acc["staff"])
            tap(pg, "Home"); tap(pg, "Something happening right now?") if pg.get_by_text("Something happening right now?").count() else tap(pg, "Triage")
            tap(pg, "The immediate situation is handled")
            body = pg.inner_text("body")
            check("general triage → picker offers injury", "Report an injury" in body, body[:200])
            tap(pg, "Report an injury")
            body = pg.inner_text("body")
            check("general triage → injury goes to the form, not back into triage (no loop)",
                  "TYPE OF INJURY" in body.upper() and "Guide me through this now" not in body, body[:200])
            check("general triage path: no JS errors", not errs, errs)
            pg.context.close()
            b.close()
    finally:
        proc.terminate()
    fails = [r for r in RESULTS if not r[1]]
    print(f"\n{len(RESULTS) - len(fails)}/{len(RESULTS)} incident checks passed")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
