"""
Draft a course from a pasted document. Uses a local stand-in for the Claude API
(EHS_AI_URL) so it runs without a key or network, and can inspect exactly what
the server sends. Checks: hidden + refused with no key; key/model/instructions
sent; good draft lands in the editor as a draft; garbled/malformed answers
handled; roles enforced.
"""
import sys, os, json, threading, http.server, urllib.error
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

DOC = ("Hot work permit procedure. Before any welding, cutting or grinding outside the weld shop, the supervisor issues a hot work permit. "
       "Remove combustibles within 35 feet or cover them with fire blankets. A fire watch stays for 60 minutes after work ends. "
       "Keep a charged extinguisher within reach. Permits expire at the end of the shift. ") * 2
GOOD = {"title": "Hot Work Permits", "slides": [
          {"heading": "Why permits matter", "body": "• Welding outside the shop needs a permit\n• The supervisor issues it"},
          {"heading": "Clear the area", "body": "Remove combustibles within 35 feet or cover them."},
          {"heading": "Fire watch", "body": "A fire watch stays 60 minutes after work ends."}],
        "questions": [
          {"q": "How long does the fire watch stay?", "choices": ["15 min", "60 min"], "correctIndex": 1, "explanation": "Per the procedure."},
          {"q": "BROKEN index", "choices": ["a", "b"], "correctIndex": 7}]}
MODE = {"reply": json.dumps(GOOD)}; SEEN = []

class FakeClaude(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["content-length"])))
        SEEN.append({"key": self.headers.get("x-api-key"), "version": self.headers.get("anthropic-version"), "body": body})
        out = json.dumps({"content": [{"type": "text", "text": MODE["reply"]}]}).encode()
        self.send_response(200); self.send_header("content-type", "application/json"); self.end_headers(); self.wfile.write(out)
    def log_message(self, *a): pass

def main():
    fake = http.server.HTTPServer(("127.0.0.1", 4011), FakeClaude)
    threading.Thread(target=fake.serve_forever, daemon=True).start()

    # ── 1. No key: hidden and refused ──
    os.environ.pop("ANTHROPIC_API_KEY", None)
    proc = boot_server()
    try:
        acc = seed_accounts(); adm = token_for(*acc["admin"])
        check("no key: config says drafting is off", api("/api/config", "GET", None, adm).get("features", {}).get("aiDraft") is False)
        st, _ = call("/api/trainings/draft", "POST", {"text": DOC}, adm)
        check("no key: endpoint refuses", st == 404, st)
        with sync_playwright() as p:
            b = p.chromium.launch(); pg = b.new_context(**PHONE).new_page()
            login(pg, *acc["admin"]); tap(pg, "Training")
            pg.locator("button:visible", has_text="Add / edit courses").click(); pg.wait_for_timeout(900)
            pg.locator("button:visible", has_text="+ New course").first.click(); pg.wait_for_timeout(1400)
            check("no key: button hidden", pg.locator("button:visible", has_text="Draft from a document").count() == 0)
            b.close()
    finally:
        proc.terminate()

    # ── 2. With a key, via the stand-in ──
    os.environ["ANTHROPIC_API_KEY"] = "test-key-123"; os.environ["EHS_AI_URL"] = "http://127.0.0.1:4011/v1/messages"
    proc = boot_server()
    try:
        acc = seed_accounts(); adm = token_for(*acc["admin"])
        with sync_playwright() as p:
            b = p.chromium.launch(); pg = b.new_context(**PHONE).new_page(); errs = watch_errors(pg)
            login(pg, *acc["admin"]); tap(pg, "Training")
            pg.locator("button:visible", has_text="Add / edit courses").click(); pg.wait_for_timeout(900)
            pg.locator("button:visible", has_text="+ New course").first.click(); pg.wait_for_timeout(1400)
            pg.locator("button:visible", has_text="Draft from a document").click(); pg.wait_for_timeout(300)
            pg.fill("textarea[aria-label='Document to draft from']", "too short")
            check("short paste: Draft button disabled", not pg.locator("button:visible", has_text="Draft course").is_enabled())
            pg.fill("textarea[aria-label='Document to draft from']", DOC)
            pg.locator("button:visible", has_text="Draft course").click(); pg.wait_for_timeout(2500)
            msg = pg.locator("[aria-label='Draft result']").inner_text()
            check("draft: says it's a first draft to check", "Drafted 3 slides and 1 quiz" in msg and "check every slide" in msg, msg)
            check("draft: malformed question dropped (bad answer index)", "1 quiz question" in msg)
            check("draft: title filled", pg.locator("input").first.input_value() == "Hot Work Permits")
            check("draft: slides in the editor", pg.locator("input[value='Fire watch']").count() == 1)
            sent = SEEN[-1]
            check("request: sends the key and API version", sent["key"] == "test-key-123" and sent["version"] == "2023-06-01", {k: sent[k] for k in ("key", "version")})
            check("request: tells the model to use only the document", "ONLY facts stated in the document" in sent["body"]["system"])
            check("request: includes the pasted text", "fire watch stays for 60 minutes" in sent["body"]["messages"][0]["content"])
            check("draft: nothing saved until Save", not q("SELECT 1 FROM trainings WHERE title = 'Hot Work Permits'"))
            pg.locator("button:visible", has_text="Save").first.click(); pg.wait_for_timeout(1500)
            row = q("SELECT content FROM trainings WHERE title = 'Hot Work Permits'")
            c = json.loads(row[0]["content"]) if row else {}
            check("save: slides + question stored", len(c.get("slides", [])) == 3 and len(c.get("questions", [])) == 1, c)

            MODE["reply"] = "Sorry, I can't help with that."
            pg.locator("button:visible", has_text="Draft from a document").click(); pg.wait_for_timeout(300)
            pg.fill("textarea[aria-label='Document to draft from']", DOC)
            pg.locator("button:visible", has_text="Draft course").click(); pg.wait_for_timeout(2000)
            msg = pg.locator("[aria-label='Draft result']").inner_text()
            check("garbled answer: plain error, editor untouched", "Couldn't turn that into a course" in msg and pg.locator("input[value='Fire watch']").count() == 1, msg)
            check("draft path: no JS errors", not errs, errs)
            b.close()
        st, _ = call("/api/trainings/draft", "POST", {"text": DOC}, token_for(*acc["staff"]))
        check("staff: cannot draft", st == 403, st)
        st, _ = call("/api/trainings/draft", "POST", {"text": "x" * 70000}, adm)
        check("too long: refused before calling the API", st == 400, st)
    finally:
        proc.terminate(); fake.shutdown()
        os.environ.pop("ANTHROPIC_API_KEY", None); os.environ.pop("EHS_AI_URL", None)
    fails = [r for r in RESULTS if not r[1]]
    print(f"\n{len(RESULTS) - len(fails)}/{len(RESULTS)} draft checks passed")
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
