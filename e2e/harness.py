"""Shared harness for EHS DNA e2e: boots a scratch server, seeds one account per role,
logs in through the real UI, and gives direct DB access for backend verification."""
import json, os, subprocess, time, urllib.request, sqlite3
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(os.environ.get("E2E_PORT", "3999"))
BASE = f"http://localhost:{PORT}"
DB = os.environ.get("E2E_DB", "/tmp/e2e.db")
ADMIN_PW, OP_PW, USER_PW = "E2eAdmin!2026", "E2eOp!2026", "E2eUser!2026"
PHONE = dict(viewport={"width": 360, "height": 780}, device_scale_factor=2, is_mobile=True, has_touch=True)
DESKTOP = dict(viewport={"width": 1280, "height": 860})


def api(path, method="GET", body=None, token=None):
    req = urllib.request.Request(BASE + path, method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {token}"} if token else {})})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        try: return e.code, json.loads(e.read() or b"{}")
        except Exception: return e.code, {}


def boot():
    for f in (DB, DB + "-wal", DB + "-shm"):
        if os.path.exists(f): os.remove(f)
    os.makedirs("/tmp/e2e-photos", exist_ok=True)
    env = dict(os.environ, EHS_DB_PATH=DB, EHS_PHOTO_DIR="/tmp/e2e-photos", PORT=str(PORT),
               EHS_ADMIN_PASSWORD=ADMIN_PW, EHS_OPERATOR_PASSWORD=OP_PW)
    proc = subprocess.Popen(["node", "server/index.cjs"], cwd=ROOT, env=env,
                            stdout=open("/tmp/e2e-server.log", "w"), stderr=subprocess.STDOUT)
    for _ in range(40):
        try:
            if api("/api/health")[0] == 200: break
        except Exception: pass
        time.sleep(0.25)
    return proc


def seed():
    _, a = api("/api/auth/login", "POST", {"email": "ahren@whistlepig.com", "password": ADMIN_PW})
    tok = a["token"]
    accts = {"admin": ("ahren@whistlepig.com", ADMIN_PW), "operator": ("ahrenwolson@gmail.com", OP_PW)}
    for role in ["safety", "site_manager", "trainer", "staff"]:
        email = f"e2e-{role}@example.com"
        api("/api/users", "POST", {"email": email, "name": f"E2E {role.replace('_', ' ').title()}",
                                   "role": role, "siteId": 1, "password": USER_PW}, tok)
        accts[role] = (email, USER_PW)
    return accts


def token(accts, role):
    e, p = accts[role]
    return api("/api/auth/login", "POST", {"email": e, "password": p})[1]["token"]


def db():
    c = sqlite3.connect(DB); c.row_factory = sqlite3.Row; return c


def login(browser, accts, role, vp=PHONE):
    ctx = browser.new_context(**vp); pg = ctx.new_page()
    pg.errs = []; pg.on("pageerror", lambda e: pg.errs.append(str(e)[:200]))
    pg.goto(BASE + "/")
    e, p = accts[role]
    pg.fill("input[type=email]", e); pg.fill("input[type=password]", p)
    pg.get_by_role("button", name="Sign in").click(); pg.wait_for_timeout(1800)
    return ctx, pg


def tab(pg, name):
    pg.locator("button", has_text=name).last.click(); pg.wait_for_timeout(1200)


def click(pg, text, exact=False, wait=900):
    loc = pg.get_by_text(text, exact=exact)
    loc.first.scroll_into_view_if_needed(); loc.first.click(); pg.wait_for_timeout(wait)


def dump(pg, label=""):
    """Exploration aid: list visible buttons + inputs on the current screen."""
    return pg.evaluate("""() => ({
      buttons: [...document.querySelectorAll('button')].filter(b=>b.offsetParent).map(b=>b.innerText.replace(/\\s+/g,' ').trim()).filter(Boolean).slice(0,60),
      inputs: [...document.querySelectorAll('input,textarea,select')].filter(i=>i.offsetParent).map(i=>(i.tagName+':'+(i.type||'')+':'+(i.placeholder||i.name||'')).slice(0,70))
    })""")


class Results:
    def __init__(self): self.rows = []
    def check(self, step_id, desc, ok, detail=""):
        self.rows.append((step_id, desc, bool(ok), detail))
        print(("PASS" if ok else "FAIL"), step_id, "-", desc, ("" if ok else f"  [{detail}]"))
        return ok
    @property
    def failed(self): return [r for r in self.rows if not r[2]]
