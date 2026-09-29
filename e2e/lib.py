"""Shared e2e plumbing: throwaway server, seeded accounts, login, direct DB checks."""
import json, os, sqlite3, subprocess, time, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(os.environ.get("E2E_PORT", "3999"))
BASE = f"http://localhost:{PORT}"
DB = "/tmp/e2e.db"
ADMIN_PW, OP_PW, USER_PW = "E2eAdmin!2026", "E2eOp!2026", "E2eUser!2026"
PHONE = dict(viewport={"width": 360, "height": 780}, device_scale_factor=2, is_mobile=True, has_touch=True)
DESKTOP = dict(viewport={"width": 1280, "height": 860})


def api(path, method="GET", body=None, token=None):
    req = urllib.request.Request(BASE + path, method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {token}"} if token else {})})
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read() or b"{}")


def boot_server():
    for f in (DB, DB + "-wal", DB + "-shm"):
        if os.path.exists(f): os.remove(f)
    os.makedirs("/tmp/e2e-photos", exist_ok=True)
    env = dict(os.environ, EHS_DB_PATH=DB, EHS_PHOTO_DIR="/tmp/e2e-photos", PORT=str(PORT),
               EHS_ADMIN_PASSWORD=ADMIN_PW, EHS_OPERATOR_PASSWORD=OP_PW)
    proc = subprocess.Popen(["node", "server/index.cjs"], cwd=ROOT, env=env,
                            stdout=open("/tmp/e2e-server.log", "w"), stderr=subprocess.STDOUT)
    for _ in range(40):
        try: api("/api/health"); return proc
        except Exception: time.sleep(0.25)
    raise SystemExit("server failed to start — see /tmp/e2e-server.log")


def seed_accounts():
    """One account per role. Returns {role: (email, password)}."""
    tok = api("/api/auth/login", "POST", {"email": "ahren@whistlepig.com", "password": ADMIN_PW})["token"]
    accounts = {"admin": ("ahren@whistlepig.com", ADMIN_PW), "operator": ("ahrenwolson@gmail.com", OP_PW)}
    for role in ["safety", "site_manager", "trainer", "staff"]:
        email = f"e2e-{role}@example.com"
        api("/api/users", "POST", {"email": email, "name": f"E2E {role.replace('_', ' ').title()}",
                                   "role": role, "siteId": 1, "password": USER_PW}, tok)
        accounts[role] = (email, USER_PW)
    return accounts


def token_for(email, pw):
    return api("/api/auth/login", "POST", {"email": email, "password": pw})["token"]


def login(pg, email, pw):
    pg.goto(BASE + "/")
    pg.fill("input[type=email]", email)
    pg.fill("input[type=password]", pw)
    pg.get_by_role("button", name="Sign in").click()
    pg.wait_for_timeout(2000)


def q(sql, *args):
    """Read the live DB directly — the backend verification a human can't do by eye."""
    con = sqlite3.connect(DB); con.row_factory = sqlite3.Row
    try: return [dict(r) for r in con.execute(sql, args).fetchall()]
    finally: con.close()


def tap(pg, text, exact=False, wait=900):
    """Click the last visible element with this text (bottom-most = the action, not a heading)."""
    loc = pg.get_by_text(text, exact=exact)
    for i in range(loc.count() - 1, -1, -1):
        el = loc.nth(i)
        if el.is_visible():
            el.click(); pg.wait_for_timeout(wait); return
    raise AssertionError(f"no visible element with text {text!r}")


def watch_errors(pg):
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:240]))
    return errs
