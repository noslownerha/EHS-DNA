/**
 * EHS DNA — API server
 * Serves /api/* plus the built React app from ../dist in production.
 * Every query is tenant-scoped via the JWT's tenant_id claim.
 */
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { sendAlert, sendDigest, emailConfigured } = require("./email.cjs");
const db = require("./db.cjs");
const { MODULES, LIVE_MODULES, moduleForPath } = require("./modules.cjs");

const app = express();
const PORT = process.env.PORT || 3001;
const SECRET = process.env.EHS_JWT_SECRET || "dev-secret-change-in-prod";
if (process.env.NODE_ENV === "production" && SECRET === "dev-secret-change-in-prod") {
  console.error("FATAL: EHS_JWT_SECRET is not set in production. Refusing to start with the default secret (tokens would be forgeable). Set it in /etc/ehs-dna.env and restart.");
  process.exit(1);
}
const TOKEN_TTL = "12h";

// Message shown to a blocked tenant, by suspension reason.
const SUSPENSION_MESSAGES = {
  billing: "Access to your organization's account is paused due to an outstanding balance. Please have your Accounts Payable department contact EHS DNA billing at billing@ehsdna.com to restore access.",
  other:   "This account is suspended — contact EHS DNA support.",
};
function suspensionMessage(reason) {
  return SUSPENSION_MESSAGES[reason] || SUSPENSION_MESSAGES.other;
}

// ── Login rate limiting ──────────────────────────────────────────────────────
// Two layers, no external deps:
//   (a) in-memory sliding window per IP+email — blocks rapid bursts (resets on restart)
//   (b) SQLite failure counter per email — survives restarts, enforces a cooldown
//       after sustained failures so a deploy can't reset an attacker's progress.
const RL_WINDOW_MS   = 15 * 60 * 1000;  // 15 min window
const RL_MAX_BURST   = 10;              // attempts per window per IP+email
const RL_LOCK_FAILS  = 8;               // persistent failures before cooldown
const RL_LOCK_MS     = 15 * 60 * 1000;  // cooldown duration
const rlBurst = new Map();              // key -> [timestamps]

try { db.exec(`CREATE TABLE IF NOT EXISTS login_failures (
  email TEXT PRIMARY KEY, fails INTEGER DEFAULT 0, locked_until TEXT )`); } catch {}

function loginRateLimit(req, res, next) {
  const ip    = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || "?";
  const email = String(req.body?.email || "").toLowerCase().trim();
  const now   = Date.now();

  // (a) burst window
  const key = `${ip}|${email}`;
  const hits = (rlBurst.get(key) || []).filter(t => now - t < RL_WINDOW_MS);
  if (hits.length >= RL_MAX_BURST) {
    res.set("Retry-After", String(Math.ceil(RL_WINDOW_MS / 1000)));
    return res.status(429).json({ error: "Too many attempts. Please wait a few minutes and try again." });
  }
  hits.push(now); rlBurst.set(key, hits);

  // (b) persistent per-account lockout
  if (email) {
    const row = db.prepare("SELECT fails, locked_until FROM login_failures WHERE email = ?").get(email);
    if (row?.locked_until && new Date(row.locked_until).getTime() > now) {
      res.set("Retry-After", String(Math.ceil((new Date(row.locked_until).getTime() - now) / 1000)));
      return res.status(429).json({ error: "Account temporarily locked after repeated failed attempts. Try again later." });
    }
  }
  req._rlEmail = email;
  next();
}

function recordLoginResult(email, success) {
  if (!email) return;
  if (success) { db.prepare("DELETE FROM login_failures WHERE email = ?").run(email); return; }
  const row = db.prepare("SELECT fails FROM login_failures WHERE email = ?").get(email);
  const fails = (row?.fails || 0) + 1;
  const lock  = fails >= RL_LOCK_FAILS ? new Date(Date.now() + RL_LOCK_MS).toISOString() : null;
  db.prepare(`INSERT INTO login_failures (email, fails, locked_until) VALUES (?, ?, ?)
              ON CONFLICT(email) DO UPDATE SET fails = ?, locked_until = ?`)
    .run(email, fails, lock, fails, lock);
}

app.use(express.json({ limit: "15mb" }));

// ── Security headers ─────────────────────────────────────────────────────────
// Set without a dependency (avoids native-build install issues). CSP is tuned to
// what the app actually loads: same-origin scripts (bundled SPA), Google Fonts,
// inline styles (React style props + <style> tags), and training-video embeds
// (YouTube/Vimeo). img/connect stay same-origin + data: for inline photos.
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(self), microphone=(self), camera=(self)");
  // HSTS only meaningful over HTTPS; harmless to always send (browsers ignore on http).
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  res.setHeader("Content-Security-Policy", [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "frame-src https://www.youtube.com https://player.vimeo.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; "));
  next();
});

// ── Auth ─────────────────────────────────────────────────────────────────────
// Healthcheck for uptime monitors — no auth, verifies the DB responds.
app.get("/api/health", (req, res) => {
  try {
    db.prepare("SELECT 1").get();
    res.json({ status: "ok", time: new Date().toISOString() });
  } catch (e) {
    res.status(503).json({ status: "degraded", error: "database unreachable" });
  }
});

app.post("/api/auth/login", loginRateLimit, (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });
  const user = db.prepare("SELECT * FROM users WHERE email = ? AND active = 1").get(String(email).toLowerCase().trim());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    recordLoginResult(req._rlEmail, false);
    return res.status(401).json({ error: "Invalid email or password" });
  }
  recordLoginResult(req._rlEmail, true);
  const tenantRow = db.prepare("SELECT active, suspension_reason FROM tenants WHERE id = ?").get(user.tenant_id);
  if (tenantRow && tenantRow.active === 0 && !user.is_operator)
    return res.status(403).json({ error: suspensionMessage(tenantRow.suspension_reason), suspended: true, reason: tenantRow.suspension_reason || "other" });
  const token = jwt.sign(
    { uid: user.id, tenant: user.tenant_id, role: user.role, name: user.name, op: !!user.is_operator },
    SECRET, { expiresIn: TOKEN_TTL }
  );
  const site = user.site_id ? db.prepare("SELECT name FROM sites WHERE id = ?").get(user.site_id) : null;
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, site: site?.name ?? null, siteId: user.site_id, isOperator: !!user.is_operator, mustChangePassword: !!user.must_change_password } });
});

function auth(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Not authenticated" });
  try {
    req.auth = jwt.verify(token, SECRET);
    if (!req.auth.op) {
      const tRow = db.prepare("SELECT active, suspension_reason FROM tenants WHERE id = ?").get(req.auth.tenant);
      if (tRow && tRow.active === 0)
        return res.status(403).json({ error: suspensionMessage(tRow.suspension_reason), suspended: true, reason: tRow.suspension_reason || "other" });
    }
    // A deactivated user must lose access IMMEDIATELY. Without this their existing
    // token keeps working until it expires (up to 12h) — so someone who has just
    // been offboarded could still read and file records for the rest of the day,
    // which is exactly when you most need their access gone.
    const meRow = db.prepare("SELECT active, site_id FROM users WHERE id = ?").get(req.auth.uid);
    if (!meRow || meRow.active === 0)
      return res.status(401).json({ error: "This account is no longer active." });
    // The user's home site, read fresh each request (not baked into the token, so
    // moving someone between sites takes effect immediately).
    req.auth.siteId = meRow.site_id ?? null;

    // Accounts on a seeded/temporary password must change it before doing anything else.
    // Only the change-password endpoint itself stays reachable.
    if (req.path !== "/api/auth/change-password") {
      const pwRow = db.prepare("SELECT must_change_password FROM users WHERE id = ?").get(req.auth.uid);
      if (pwRow && pwRow.must_change_password === 1)
        return res.status(403).json({ error: "You must set a new password before continuing.", mustChangePassword: true });
    }
    // Module gate: block paths owned by a module this tenant doesn't have. No-op
    // when all modules are on. Runs here so it applies to every authenticated route.
    return moduleGate(req, res, next);
  }
  catch { return res.status(401).json({ error: "Session expired" }); }
}
function requireRole(...roles) {
  return (req, res, next) =>
    roles.includes(req.auth.role) ? next() : res.status(403).json({ error: "Insufficient permissions" });
}
const ADMINISH = ["admin", "safety"];

// ── Module enablement ─────────────────────────────────────────────────────────
// Resolve a tenant's enabled feature modules: an explicit tenant_modules row wins,
// otherwise the module's registry default. Core is always on. Returns a Set of
// enabled module keys.
function enabledModules(tenantId) {
  const rows = db.prepare("SELECT module, enabled FROM tenant_modules WHERE tenant_id = ?").all(tenantId);
  const explicit = new Map(rows.map(r => [r.module, r.enabled === 1]));
  const set = new Set(["core"]);
  for (const key of LIVE_MODULES) {
    const on = explicit.has(key) ? explicit.get(key) : (MODULES[key].default !== false);
    if (on) set.add(key);
  }
  return set;
}

// Single-module check for a tenant — the one source of truth for whether a feature
// is on (operator-controlled via the module grid). Use this instead of ad-hoc
// per-feature flags.
function moduleOn(tenantId, key) {
  return enabledModules(tenantId).has(key);
}

// Gate: block requests whose path is owned by a module this tenant doesn't have.
// Deliberately conservative — it only blocks a path it can POSITIVELY attribute to
// a KNOWN, DISABLED, LIVE module. Unrecognized paths, core paths, and operator
// requests pass through untouched, so this is a no-op for any tenant with all
// modules on. Runs after auth (needs req.auth.tenant).
function moduleGate(req, res, next) {
  if (!req.auth || req.auth.op) return next();          // operators bypass
  const mod = moduleForPath(req.path);
  if (!mod || mod === "core") return next();            // core/unknown → allow
  if (MODULES[mod]?.reserved) return next();            // not yet a real feature
  const enabled = req.auth._modules || (req.auth._modules = enabledModules(req.auth.tenant));
  if (enabled.has(mod)) return next();
  return res.status(403).json({
    error: `The ${MODULES[mod]?.label || mod} module isn't enabled for your account.`,
    module: mod, moduleDisabled: true,
  });
}

// ── Read scoping ──────────────────────────────────────────────────────────────
// Injury descriptions and the names of hurt colleagues are among the most
// sensitive data a workplace holds (OSHA even has a formal "privacy concern case"
// category that keeps names off the 300 log). A line worker must not be able to
// pull the full incident list, the corrective-action queue, or everyone else's
// training record — not from the UI, and not by hitting the API directly.
const CAN_SEE_ALL_INCIDENTS  = ["admin", "safety", "site_manager"];
const CAN_SEE_CAS            = ["admin", "safety", "site_manager"];
// A trainer's whole job is tracking who still owes training, so they keep the
// org-wide compliance view. Everyone below that sees only their own row.
const CAN_SEE_ALL_COMPLIANCE = ["admin", "safety", "site_manager", "trainer"];

// Roles that see EVERY site. A site_manager is deliberately not one of them: they
// are scoped to the site they are assigned to, so a manager at Moriah does not see
// Brandenburg's injuries. Admin/safety keep the whole-company view.
const CAN_SEE_ALL_SITES = ["admin", "safety"];

/**
 * The site a request is limited to, or null for "every site".
 * Operators (and impersonation sessions, which carry op:true) always see it all.
 */
function siteScope(req) {
  if (req.auth.op) return null;
  if (CAN_SEE_ALL_SITES.includes(req.auth.role)) return null;
  if (req.auth.role === "site_manager") {
    // A site_manager with no site assigned would otherwise silently see the whole
    // company. Fail closed: -1 matches nothing until an admin assigns their site.
    return req.auth.siteId ?? -1;
  }
  return null;   // staff/trainer are scoped by ownership elsewhere, not by site
}

// ── Photo storage ────────────────────────────────────────────────────────────
// Bytes on disk, refs in the DB. Keeps the SQLite file (and the nightly backup
// that lands in immutable 365-day B2 retention) small, and stops every query
// from dragging megabytes of base64 around.
const PHOTO_DIR = process.env.EHS_PHOTO_DIR
  || path.join(path.dirname(process.env.EHS_DB_PATH || path.join(__dirname, "..", "data", "ehs.db")), "photos");
fs.mkdirSync(PHOTO_DIR, { recursive: true });

const PHOTO_MIME_EXT = {
  "image/jpeg": "jpg",
  "image/png":  "png",
  "image/webp": "webp",
};
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;   // a 1280px JPEG is ~200 KB; this is generous

function photoPath(tenantId, id, mime) {
  const ext = PHOTO_MIME_EXT[mime] || "bin";
  return path.join(PHOTO_DIR, String(tenantId), `${id}.${ext}`);
}

/**
 * Persist one base64 data URL to disk and record it.
 * Returns the stored ref ({ id, name, gps }) or null if the payload is unusable.
 */
function storePhoto(tenantId, ownerType, ownerId, photo) {
  const dataUrl = photo?.dataUrl;
  if (typeof dataUrl !== "string") return null;
  const m = /^data:([\w/+.-]+);base64,(.+)$/s.exec(dataUrl);
  if (!m) return null;
  const mime = m[1].toLowerCase();
  if (!PHOTO_MIME_EXT[mime]) return null;          // only real image types
  let buf;
  try { buf = Buffer.from(m[2], "base64"); } catch { return null; }
  if (!buf.length || buf.length > MAX_PHOTO_BYTES) return null;

  const id = crypto.randomUUID();
  const dest = photoPath(tenantId, id, mime);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
  db.prepare(`INSERT INTO photo_files (id, tenant_id, owner_type, owner_id, mime, bytes, name, gps)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, tenantId, ownerType, ownerId ?? null, mime, buf.length,
         photo.name ? String(photo.name).slice(0, 200) : null, photo.gps ? 1 : 0);
  return { id, name: photo.name ?? null, gps: !!photo.gps };
}

/** Store an array of incoming photos, returning the refs to persist on the row. */
function storePhotos(tenantId, ownerType, ownerId, photos) {
  if (!Array.isArray(photos)) return [];
  return photos.map(p => storePhoto(tenantId, ownerType, ownerId, p)).filter(Boolean);
}

/**
 * One-time migration: pull any base64 photos still embedded in incident/finding
 * rows out to disk. Runs at boot, is idempotent (rows already holding refs have no
 * dataUrl and are skipped), and never destroys a blob it could not write out.
 */
function migrateEmbeddedPhotos() {
  const tables = [
    { table: "incidents", ownerType: "incident" },
    { table: "findings",  ownerType: "finding"  },
  ];
  let moved = 0, rows = 0;
  for (const { table, ownerType } of tables) {
    let candidates;
    try {
      candidates = db.prepare(
        `SELECT id, tenant_id, photos FROM ${table} WHERE photos LIKE '%dataUrl%' OR photos LIKE '%data:image%'`
      ).all();
    } catch { continue; }
    for (const row of candidates) {
      let parsed;
      try { parsed = JSON.parse(row.photos || "[]"); } catch { continue; }
      if (!Array.isArray(parsed) || !parsed.length) continue;
      const refs = [];
      let converted = false;
      for (const item of parsed) {
        // Findings historically stored bare data-URL strings; incidents stored objects.
        const photo = typeof item === "string" ? { dataUrl: item } : item;
        if (photo && typeof photo.dataUrl === "string" && photo.dataUrl.startsWith("data:")) {
          const ref = storePhoto(row.tenant_id, ownerType, row.id, photo);
          if (ref) { refs.push(ref); converted = true; moved++; }
          else refs.push(photo);          // unwritable: keep the original rather than lose it
        } else {
          refs.push(item);                // already a ref
        }
      }
      if (converted) {
        db.prepare(`UPDATE ${table} SET photos = ? WHERE id = ?`).run(JSON.stringify(refs), row.id);
        rows++;
      }
    }
  }
  if (moved) console.log(`Photo migration: moved ${moved} embedded image(s) out of ${rows} row(s) to ${PHOTO_DIR}`);
}
migrateEmbeddedPhotos();
function requireOperator(req, res, next) {
  return req.auth.op ? next() : res.status(403).json({ error: "Operator access only" });
}

app.post("/api/auth/forgot", (req, res) => {
  const email = String(req.body?.email ?? "").toLowerCase().trim();
  const user = email && db.prepare("SELECT * FROM users WHERE email = ? AND active = 1").get(email);
  if (user) {
    const admins = db.prepare("SELECT id FROM users WHERE tenant_id = ? AND role = 'admin' AND active = 1 AND id != ?")
      .all(user.tenant_id, user.id);
    const stmt = db.prepare(`INSERT INTO notifications (tenant_id, user_id, title, body, link_kind, link_ref)
                             VALUES (?, ?, ?, ?, 'user', ?)`);
    admins.forEach(a => stmt.run(user.tenant_id, a.id,
      `🔑 Password reset requested`,
      `${user.name} (${user.email}) requested a password reset. Use Manage Staff → Reset to issue a temporary password.`,
      String(user.id)));
  }
  res.json({ ok: true }); // always ok — no account enumeration
});

app.post("/api/auth/change-password", auth, (req, res) => {
  const { current, next: nextPw } = req.body || {};
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.auth.uid);
  if (!bcrypt.compareSync(current || "", user.password_hash))
    return res.status(401).json({ error: "Current password incorrect" });
  if (!nextPw || nextPw.length < 8) return res.status(400).json({ error: "New password must be 8+ characters" });
  if (bcrypt.compareSync(nextPw, user.password_hash))
    return res.status(400).json({ error: "New password must be different from the current one" });
  db.prepare("UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?").run(bcrypt.hashSync(nextPw, 10), user.id);
  res.json({ ok: true });
});

// ── Public lead capture (marketing site) ─────────────────────────────────────
app.post("/api/leads", (req, res) => {
  const { name, email, company, message } = req.body || {};
  if (!email || !/.+@.+\..+/.test(email)) return res.status(400).json({ error: "Valid email required" });
  db.prepare("INSERT INTO leads (name, email, company, message) VALUES (?, ?, ?, ?)")
    .run((name ?? "").slice(0, 200), String(email).slice(0, 200), (company ?? "").slice(0, 200), (message ?? "").slice(0, 2000));
  // Alert every operator in-app
  const ops = db.prepare("SELECT id, tenant_id FROM users WHERE is_operator = 1 AND active = 1").all();
  const nstmt = db.prepare(`INSERT INTO notifications (tenant_id, user_id, title, body, link_kind, link_ref)
                            VALUES (?, ?, ?, ?, 'lead', ?)`);
  ops.forEach(o => nstmt.run(o.tenant_id, o.id,
    `🎯 New demo request: ${(company ?? name ?? email).slice(0, 60)}`,
    `${name ?? "—"} · ${email}${message ? ` · ${message.slice(0, 100)}` : ""}`, String(email).slice(0, 100)));
  res.json({ ok: true });
});
app.get("/api/leads", auth, requireOperator, (req, res) =>
  res.json(db.prepare("SELECT * FROM leads ORDER BY created_at DESC").all()));

// ── Response checklists (post-incident immediate steps, per type) ────────────
app.get("/api/response-checklists", auth, (req, res) => {
  const rows = db.prepare("SELECT incident_type, items FROM response_checklists WHERE tenant_id = ?").all(req.auth.tenant);
  res.json(Object.fromEntries(rows.map(r => [r.incident_type, JSON.parse(r.items)])));
});
app.put("/api/response-checklists/:type", auth, requireRole(...ADMINISH), (req, res) => {
  const items = req.body?.items;
  if (!Array.isArray(items)) return res.status(400).json({ error: "items array required" });
  db.prepare(`INSERT INTO response_checklists (tenant_id, incident_type, items) VALUES (?, ?, ?)
              ON CONFLICT(tenant_id, incident_type) DO UPDATE SET items = excluded.items`)
    .run(req.auth.tenant, req.params.type, JSON.stringify(items.filter(i => i && i.trim())));
  res.json({ ok: true });
});

// ── Site floor plans ──────────────────────────────────────────────────────────
app.get("/api/sites/:id/floorplan", auth, (req, res) => {
  const row = db.prepare("SELECT floorplan FROM sites WHERE id = ? AND tenant_id = ?").get(req.params.id, req.auth.tenant);
  res.json({ floorplan: row?.floorplan ?? null });
});
app.put("/api/sites/:id/floorplan", auth, requireRole(...ADMINISH), (req, res) => {
  const { floorplan } = req.body || {};   // base64 data URL or null to remove
  db.prepare("UPDATE sites SET floorplan = ? WHERE id = ? AND tenant_id = ?")
    .run(floorplan ?? null, req.params.id, req.auth.tenant);
  res.json({ ok: true });
});

// ── Tenant config (drives BRAND on the frontend; editable = onboarding) ──────
app.get("/api/config", auth, (req, res) => {
  const t = db.prepare("SELECT * FROM tenants WHERE id = ?").get(req.auth.tenant);
  const sites = db.prepare("SELECT id, name, location, (floorplan IS NOT NULL) AS hasFloorplan FROM sites WHERE tenant_id = ? AND active = 1").all(req.auth.tenant);
  const departments = db.prepare("SELECT id, name FROM departments WHERE tenant_id = ? AND active = 1").all(req.auth.tenant);
  res.json({
    company: t.name, shortName: t.short_name, industry: t.industry, tagline: t.tagline,
    triage: { enabled: !!t.triage_enabled, providerName: t.triage_provider_name, providerPhone: t.triage_provider_phone,
              questions: (() => { try { return JSON.parse(t.triage_questions || "null"); } catch { return null; } })() },
    sites, departments,
    // Enabled feature modules — the frontend intersects these with role tabs so a
    // tenant only sees nav for what they've bought.
    modules: [...enabledModules(req.auth.tenant)],
  });
});
app.put("/api/config", auth, requireRole(...ADMINISH), (req, res) => {
  const { company, shortName, industry, tagline, triage } = req.body || {};
  // Sanitize custom triage questions: array of {id,text}, text trimmed & capped,
  // max 20 questions. Undefined → leave unchanged (COALESCE null).
  let triageQuestionsJson = null;
  if (triage && Array.isArray(triage.questions)) {
    const clean = triage.questions
      .map((q, i) => ({ id: Number(q.id) || i + 1, text: String(q.text ?? "").trim().slice(0, 300) }))
      .filter(q => q.text)
      .slice(0, 20);
    triageQuestionsJson = JSON.stringify(clean);
  }
  db.prepare(`UPDATE tenants SET name = COALESCE(?, name), short_name = COALESCE(?, short_name),
              industry = COALESCE(?, industry), tagline = COALESCE(?, tagline),
              triage_enabled = COALESCE(?, triage_enabled),
              triage_provider_name = COALESCE(?, triage_provider_name),
              triage_provider_phone = COALESCE(?, triage_provider_phone),
              triage_questions = COALESCE(?, triage_questions)
              WHERE id = ?`)
    .run(company, shortName, industry, tagline,
         triage ? (triage.enabled ? 1 : 0) : null,
         triage?.providerName, triage?.providerPhone, triageQuestionsJson, req.auth.tenant);
  res.json({ ok: true });
});

// ── Generic tenant-scoped CRUD helper ────────────────────────────────────────
function listAll(table, orderBy = "id DESC") {
  return (req, res) =>
    res.json(db.prepare(`SELECT * FROM ${table} WHERE tenant_id = ? ORDER BY ${orderBy}`).all(req.auth.tenant));
}

// Sites & departments (admin manage)
app.post("/api/sites/bulk", auth, requireRole(...ADMINISH), (req, res) => {
  const rows = req.body?.rows;
  if (!Array.isArray(rows) || !rows.length) return res.status(400).json({ error: "rows array required" });
  if (rows.length > 500) return res.status(400).json({ error: "Max 500 rows per import" });
  const existing = new Set(db.prepare("SELECT name FROM sites WHERE tenant_id = ?").all(req.auth.tenant)
    .map(s => String(s.name).trim().toLowerCase()));
  const results = [];
  const ins = db.prepare("INSERT INTO sites (tenant_id, name, location) VALUES (?, ?, ?)");
  for (const [i, r] of rows.entries()) {
    const line = i + 2;
    const name = String(r.name ?? "").trim();
    const location = String(r.location ?? "").trim() || null;
    if (!name) { results.push({ line, error: "Missing site name" }); continue; }
    const key = name.toLowerCase();
    if (existing.has(key)) { results.push({ line, name, error: "Site name already exists" }); continue; }
    ins.run(req.auth.tenant, name, location);
    existing.add(key); // guard against duplicates within the same file
    results.push({ line, name });
  }
  res.json({ created: results.filter(r => !r.error).length, failed: results.filter(r => r.error).length, results });
});

app.post("/api/sites", auth, requireRole(...ADMINISH), (req, res) => {
  const r = db.prepare("INSERT INTO sites (tenant_id, name, location) VALUES (?, ?, ?)")
    .run(req.auth.tenant, req.body.name, req.body.location ?? null);
  res.json({ id: r.lastInsertRowid });
});
app.put("/api/sites/:id", auth, requireRole(...ADMINISH), (req, res) => {
  db.prepare("UPDATE sites SET name = COALESCE(?, name), location = COALESCE(?, location), active = COALESCE(?, active) WHERE id = ? AND tenant_id = ?")
    .run(req.body.name, req.body.location, req.body.active, req.params.id, req.auth.tenant);
  res.json({ ok: true });
});
app.post("/api/departments", auth, requireRole(...ADMINISH), (req, res) => {
  const r = db.prepare("INSERT INTO departments (tenant_id, name) VALUES (?, ?)").run(req.auth.tenant, req.body.name);
  res.json({ id: r.lastInsertRowid });
});
app.put("/api/departments/:id", auth, requireRole(...ADMINISH), (req, res) => {
  db.prepare("UPDATE departments SET name = COALESCE(?, name), active = COALESCE(?, active) WHERE id = ? AND tenant_id = ?")
    .run(req.body.name, req.body.active, req.params.id, req.auth.tenant);
  res.json({ ok: true });
});

// Users (admin manage; no password in list responses)
// Bulk staff creation from spreadsheet rows
app.post("/api/users/bulk", auth, requireRole("admin", "safety", "site_manager"), (req, res) => {
  const rows = req.body?.rows;
  if (!Array.isArray(rows) || !rows.length) return res.status(400).json({ error: "rows array required" });
  if (rows.length > 500) return res.status(400).json({ error: "Max 500 rows per import" });
  const VALID_ROLES = ["admin", "safety", "site_manager", "trainer", "staff"];
  const sites = db.prepare("SELECT id, name FROM sites WHERE tenant_id = ? AND active = 1").all(req.auth.tenant);
  const depts = db.prepare("SELECT id, name FROM departments WHERE tenant_id = ?").all(req.auth.tenant);
  const norm = s => String(s ?? "").trim().toLowerCase();
  const siteByName = Object.fromEntries(sites.map(s => [norm(s.name), s.id]));
  const deptByName = Object.fromEntries(depts.map(d => [norm(d.name), d.id]));
  const results = [];
  for (const [i, r] of rows.entries()) {
    const line = i + 2; // spreadsheet line (after header)
    const name = String(r.name ?? "").trim();
    const email = norm(r.email);
    let role = norm(r.role) || "staff";
    if (role === "site manager") role = "site_manager";
    if (!name || !email || !email.includes("@")) { results.push({ line, email, error: "Missing/invalid name or email" }); continue; }
    if (!VALID_ROLES.includes(role)) { results.push({ line, email, error: `Unknown role "${r.role}" — use staff, trainer, site_manager, safety, or admin` }); continue; }
    const siteId = r.site ? siteByName[norm(r.site)] : null;
    if (r.site && !siteId) { results.push({ line, email, error: `Unknown site "${r.site}"` }); continue; }
    const deptId = r.department ? deptByName[norm(r.department)] : null;
    if (r.department && !deptId) { results.push({ line, email, error: `Unknown department "${r.department}"` }); continue; }
    if (db.prepare("SELECT id FROM users WHERE email = ?").get(email)) { results.push({ line, email, error: "Email already exists" }); continue; }
    const tempPassword = Math.random().toString(36).slice(2, 10) + "!A1";
    db.prepare(`INSERT INTO users (tenant_id, email, password_hash, name, role, site_id, department_id, must_change_password)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1)`)
      .run(req.auth.tenant, email, bcrypt.hashSync(tempPassword, 10), name, role, siteId, deptId);
    results.push({ line, email, name, tempPassword });
  }
  res.json({ created: results.filter(r => !r.error).length, failed: results.filter(r => r.error).length, results });
});

app.get("/api/users/directory", auth, (req, res) =>
  res.json(db.prepare(`SELECT u.id, u.name, u.role, s.name AS site, d.name AS department
                       FROM users u LEFT JOIN sites s ON s.id = u.site_id
                       LEFT JOIN departments d ON d.id = u.department_id
                       WHERE u.tenant_id = ? AND u.active = 1 ORDER BY u.name`).all(req.auth.tenant)));

app.get("/api/users", auth, requireRole(...ADMINISH, "site_manager"), (req, res) =>
  res.json(db.prepare(`SELECT u.id, u.email, u.name, u.role, u.active, u.site_id, u.department_id,
                       s.name AS site, d.name AS department
                       FROM users u LEFT JOIN sites s ON s.id = u.site_id
                       LEFT JOIN departments d ON d.id = u.department_id
                       WHERE u.tenant_id = ? ORDER BY u.name`).all(req.auth.tenant)));
app.post("/api/users", auth, requireRole(...ADMINISH), (req, res) => {
  const { email, name, role, siteId, departmentId, password } = req.body || {};
  if (!email || !name || !role) return res.status(400).json({ error: "email, name, role required" });
  const pw = password || Math.random().toString(36).slice(2, 10) + "!A1";
  // Auto-generated temp password → force a change on first login.
  // An admin-chosen password is treated as intentional and is not forced.
  const mustChange = password ? 0 : 1;
  try {
    const r = db.prepare(`INSERT INTO users (tenant_id, email, password_hash, name, role, site_id, department_id, must_change_password)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(req.auth.tenant, String(email).toLowerCase().trim(), bcrypt.hashSync(pw, 10), name, role, siteId ?? null, departmentId ?? null, mustChange);
    res.json({ id: r.lastInsertRowid, tempPassword: password ? undefined : pw });
  } catch (e) {
    res.status(409).json({ error: "Email already exists" });
  }
});
app.put("/api/users/:id", auth, requireRole(...ADMINISH), (req, res) => {
  const { name, role, siteId, departmentId, active, resetPassword } = req.body || {};
  db.prepare(`UPDATE users SET name = COALESCE(?, name), role = COALESCE(?, role),
              site_id = COALESCE(?, site_id), department_id = COALESCE(?, department_id),
              active = COALESCE(?, active) WHERE id = ? AND tenant_id = ?`)
    .run(name, role, siteId, departmentId, active, req.params.id, req.auth.tenant);
  let tempPassword;
  if (resetPassword) {
    tempPassword = Math.random().toString(36).slice(2, 10) + "!A1";
    db.prepare("UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ? AND tenant_id = ?")
      .run(bcrypt.hashSync(tempPassword, 10), req.params.id, req.auth.tenant);
  }
  res.json({ ok: true, tempPassword });
});

// ── Incidents ────────────────────────────────────────────────────────────────
// Generate the next reference for a tenant, e.g. INC-2026-0007.
// Uses MAX(existing sequence)+1 rather than COUNT(*) so numbers are never reused
// if a row is ever removed, and is scoped to the CALLING tenant so each customer
// gets its own 0001-up sequence. Callers wrap the insert in refInsert() below to
// survive the (rare) race where two submits pick the same number concurrently.
function nextRef(prefix, table, tenantId) {
  const year = new Date().getFullYear();
  const like = `${prefix}-${year}-%`;
  const row = db.prepare(
    `SELECT MAX(CAST(substr(ref, ?) AS INTEGER)) AS mx
       FROM ${table} WHERE tenant_id = ? AND ref LIKE ?`
  ).get(`${prefix}-${year}-`.length + 1, tenantId, like);
  return `${prefix}-${year}-${String((row?.mx ?? 0) + 1).padStart(4, "0")}`;
}

// Insert a row that carries a generated ref, retrying if a concurrent request
// grabbed the same number first (UNIQUE(tenant_id, ref) makes that a hard error
// rather than a silent duplicate).
function refInsert(prefix, table, tenantId, insertFn) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const ref = nextRef(prefix, table, tenantId);
    try {
      return { ref, result: insertFn(ref) };
    } catch (e) {
      if (/UNIQUE constraint failed/i.test(String(e?.message)) && attempt < 4) continue;
      throw e;
    }
  }
}
// Columns for the LIST view. Deliberately EXCLUDES `photos`: that column holds
// base64 image data, and `SELECT i.*` was shipping every photo of every incident
// to the phone just to render a list of rows — ~76 MB at 200 incidents, over
// cellular, every time the screen opened. The list only needs the count; the full
// images come from GET /api/incidents/:id when a specific report is opened.
const INCIDENT_LIST_COLS = `i.id, i.tenant_id, i.ref, i.type, i.severity, i.status,
  i.site_id, i.description, i.location_detail, i.involved, i.reported_by,
  i.occurred_at, i.created_at, i.updated_at, i.department, i.osha_classification,
  i.response_progress, i.floor_pos, i.latitude, i.longitude,
  json_array_length(COALESCE(i.photos, '[]')) AS photo_count`;

app.get("/api/incidents", auth, (req, res) => {
  const seesAll = CAN_SEE_ALL_INCIDENTS.includes(req.auth.role);
  const site = siteScope(req);   // null = every site; a site_manager sees only theirs
  let rows;
  if (!seesAll) {
    // Staff/trainer get only the reports they filed themselves.
    rows = db.prepare(`SELECT ${INCIDENT_LIST_COLS}, s.name AS site_name, u.name AS reporter_name
                       FROM incidents i
                       LEFT JOIN sites s ON s.id = i.site_id
                       LEFT JOIN users u ON u.id = i.reported_by
                       WHERE i.tenant_id = ? AND i.reported_by = ? ORDER BY i.created_at DESC`)
      .all(req.auth.tenant, req.auth.uid);
  } else if (site === null) {
    rows = db.prepare(`SELECT ${INCIDENT_LIST_COLS}, s.name AS site_name, u.name AS reporter_name
                       FROM incidents i
                       LEFT JOIN sites s ON s.id = i.site_id
                       LEFT JOIN users u ON u.id = i.reported_by
                       WHERE i.tenant_id = ? ORDER BY i.created_at DESC`).all(req.auth.tenant);
  } else {
    rows = db.prepare(`SELECT ${INCIDENT_LIST_COLS}, s.name AS site_name, u.name AS reporter_name
                       FROM incidents i
                       LEFT JOIN sites s ON s.id = i.site_id
                       LEFT JOIN users u ON u.id = i.reported_by
                       WHERE i.tenant_id = ? AND i.site_id = ? ORDER BY i.created_at DESC`)
      .all(req.auth.tenant, site);
  }
  res.json(rows);
});

// Serve one photo. Authorization mirrors the parent record exactly — a worker must
// not be able to pull a photo from a colleague's injury report by guessing its id,
// and a site manager must not reach another site's photos.
app.get("/api/photos/:id", auth, (req, res) => {
  const p = db.prepare("SELECT * FROM photo_files WHERE id = ? AND tenant_id = ?")
    .get(String(req.params.id), req.auth.tenant);
  if (!p) return res.status(404).json({ error: "Not found" });

  if (p.owner_type === "incident" && p.owner_id) {
    const inc = db.prepare("SELECT reported_by, site_id FROM incidents WHERE id = ? AND tenant_id = ?")
      .get(p.owner_id, req.auth.tenant);
    if (!inc) return res.status(404).json({ error: "Not found" });
    if (!CAN_SEE_ALL_INCIDENTS.includes(req.auth.role) && inc.reported_by !== req.auth.uid)
      return res.status(403).json({ error: "Insufficient permissions" });
    const scope = siteScope(req);
    if (scope !== null && inc.site_id !== scope)
      return res.status(403).json({ error: "Insufficient permissions" });
  } else if (p.owner_type === "finding" && p.owner_id) {
    const f = db.prepare("SELECT site_id FROM findings WHERE id = ? AND tenant_id = ?")
      .get(p.owner_id, req.auth.tenant);
    if (!f) return res.status(404).json({ error: "Not found" });
    const scope = siteScope(req);
    if (scope !== null && f.site_id !== scope)
      return res.status(403).json({ error: "Insufficient permissions" });
  }

  const file = photoPath(p.tenant_id, p.id, p.mime);
  if (!fs.existsSync(file)) return res.status(404).json({ error: "Image missing" });
  res.set("Content-Type", p.mime);
  // Immutable content addressed by uuid — safe to cache hard, but keep it private.
  res.set("Cache-Control", "private, max-age=31536000, immutable");
  res.sendFile(file);
});

// Full record for ONE incident, including photo data. Same read scoping as the
// list: staff may only open a report they filed themselves.
app.get("/api/incidents/:id", auth, (req, res) => {
  // Accepts either the numeric id or the human ref (INC-2026-0001) — the UI
  // navigates by ref.
  const key = String(req.params.id);
  const row = db.prepare(`SELECT i.*, s.name AS site_name, u.name AS reporter_name
                          FROM incidents i
                          LEFT JOIN sites s ON s.id = i.site_id
                          LEFT JOIN users u ON u.id = i.reported_by
                          WHERE i.tenant_id = ? AND (i.id = ? OR i.ref = ?)`)
    .get(req.auth.tenant, /^\d+$/.test(key) ? Number(key) : -1, key);
  if (!row) return res.status(404).json({ error: "Incident not found" });
  if (!CAN_SEE_ALL_INCIDENTS.includes(req.auth.role) && row.reported_by !== req.auth.uid)
    return res.status(403).json({ error: "Insufficient permissions" });
  const dSite = siteScope(req);
  if (dSite !== null && row.site_id !== dSite)
    return res.status(403).json({ error: "Insufficient permissions" });
  res.json(row);
});
// Report types. The first group are "something's wrong" reports (may be OSHA-
// relevant); the second group are the engagement channels that drive a real
// safety culture — observations, positive callouts, and improvement ideas — which
// most EHS tools lack entirely and which is where frontline buy-in actually comes
// from. Workers never pick these codes directly; the entry screen offers plain-
// language prompts that map to them, and safety can always re-triage.
const INCIDENT_TYPES = [
  "injury", "near_miss", "property", "spill", "fire", "security",  // incident-shaped
  "hazard", "observation", "positive", "idea",                      // engagement-shaped
];
// Which types are "positive/neutral" — never treated as incidents, never OSHA,
// routed to safety as engagement rather than as something to respond to.
const ENGAGEMENT_TYPES = ["observation", "positive", "idea"];

// ── Recognition points ────────────────────────────────────────────────────────
// Point values per proactive act. Tunable; kept modest and recognition-forward
// rather than cash-forward (the research warns big extrinsic rewards crowd out
// intrinsic motivation). All are LEADING indicators — never "no incidents".
const POINTS = {
  report_reviewed: 10,   // any report you filed, once safety reviews/accepts it
  idea:            15,   // ideas take thought — worth a little more
  kudos_given:      5,   // you recognised a colleague
  kudos_received:  10,   // you were caught doing it right
  training:         5,   // completed an assigned training
};
// Per-tenant point values: a tenant can override any of the defaults above via the
// point_values JSON column. Falls back to POINTS for anything unset.
function pointsFor(tenantId) {
  try {
    const raw = db.prepare("SELECT point_values FROM tenants WHERE id = ?").get(tenantId)?.point_values;
    if (raw) return { ...POINTS, ...JSON.parse(raw) };
  } catch { /* fall through to defaults */ }
  return POINTS;
}
const periodOf = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

// Canonical recordability test — the ONE definition used by every report, the TRIR
// calc, the digest, and the 300 log. A case counts as recordable only when safety
// has CONFIRMED a "Recordable – …" classification (Medical treatment, Restricted
// work, Days away, Fatality, First aid only). It deliberately excludes:
//   • "Review: likely recordable"  — the provisional auto-flag, not yet confirmed
//   • "Non-recordable" / "Pending" / null
// (Prior bug: three call sites disagreed — one matched only the exact string
// "Recordable", so real classifications like "Recordable – Medical treatment"
// silently never counted, and the whole report looked empty.)
const isRecordableClass = (c) => typeof c === "string" && c.startsWith("Recordable");

// Award points. `status` is 'confirmed' for immediate awards (kudos, training) or
// 'pending' for report-linked awards that only count once safety reviews the
// report — dedup guards against awarding the same source twice.
function awardPoints(tenantId, userId, points, reason, { sourceType = null, sourceId = null, awardedBy = null, status = "confirmed", note = null } = {}) {
  if (!userId || !points) return;
  try {
    // Don't double-award the same (user, reason, source).
    if (sourceType && sourceId) {
      const dup = db.prepare(`SELECT 1 FROM points_ledger WHERE tenant_id=? AND user_id=? AND reason=? AND source_type=? AND source_id=? LIMIT 1`)
        .get(tenantId, userId, reason, sourceType, sourceId);
      if (dup) return;
    }
    db.prepare(`INSERT INTO points_ledger (tenant_id, user_id, points, reason, source_type, source_id, awarded_by, period, status, note)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(tenantId, userId, points, reason, sourceType, sourceId, awardedBy, periodOf(), status, note);
  } catch (e) { console.error("awardPoints failed:", e.message); }
}
const SEVERITIES = ["minor", "significant", "serious", "critical"];

app.post("/api/incidents", auth, (req, res) => {
  const { type, severity, siteId, description, locationDetail, involved, photos, occurredAt, floorPos, department, clientUuid, recognizedUserId, latitude, longitude, oshaRecordableSuggested, oshaSignals } = req.body || {};

  // Idempotency: the offline queue retries on reconnect. If this exact report was
  // already filed, return the original instead of creating a duplicate incident.
  if (clientUuid) {
    const existing = db.prepare("SELECT id, ref FROM incidents WHERE tenant_id = ? AND client_uuid = ?")
      .get(req.auth.tenant, String(clientUuid));
    if (existing) return res.json({ id: existing.id, ref: existing.ref, duplicate: true, notified: null });
  }

  if (!type) return res.status(400).json({ error: "type required" });
  if (!INCIDENT_TYPES.includes(type))
    return res.status(400).json({ error: `Invalid type. Must be one of: ${INCIDENT_TYPES.join(", ")}` });
  if (severity && !SEVERITIES.includes(severity))
    return res.status(400).json({ error: `Invalid severity. Must be one of: ${SEVERITIES.join(", ")}` });
  // Sane field caps — generous for real use, but stop a pasted novel from bloating
  // the DB or breaking list/report rendering.
  if (description && String(description).length > 10000)
    return res.status(400).json({ error: "Description is too long (10,000 character limit)" });
  if (locationDetail && String(locationDetail).length > 500)
    return res.status(400).json({ error: "Location is too long (500 character limit)" });
  if (Array.isArray(photos) && photos.length > 10)
    return res.status(400).json({ error: "Too many photos (10 maximum)" });
  // A site id must belong to THIS tenant — never trust a client-supplied FK.
  if (siteId) {
    const owns = db.prepare("SELECT 1 FROM sites WHERE id = ? AND tenant_id = ?").get(siteId, req.auth.tenant);
    if (!owns) return res.status(400).json({ error: "Unknown site for this account" });
  }
  // A named kudos recipient (for "positive" reports) must be a user in THIS tenant.
  let recognizedId = null;
  if (recognizedUserId) {
    const rec = db.prepare("SELECT id FROM users WHERE id = ? AND tenant_id = ? AND active = 1").get(recognizedUserId, req.auth.tenant);
    if (rec) recognizedId = rec.id;
  }
  // GPS is optional and auto-captured — validate it's a plausible coordinate pair
  // or drop it (never let a bad value block the report).
  const lat = Number.isFinite(Number(latitude)) && Math.abs(Number(latitude)) <= 90 ? Number(latitude) : null;
  const lng = Number.isFinite(Number(longitude)) && Math.abs(Number(longitude)) <= 180 ? Number(longitude) : null;
  // OSHA recordability suggestion: for injuries where the reporter flagged a
  // general-criteria outcome (medical beyond first aid, days away, restricted duty,
  // loss of consciousness, significant diagnosis), pre-set the classification to a
  // clearly-provisional "Review: likely recordable" so it surfaces for the Safety
  // Officer's formal determination rather than sitting unclassified. Non-injuries
  // and un-flagged injuries stay null (Pending) as before.
  const oshaSuggested = type === "injury" &&
    (oshaRecordableSuggested || (Array.isArray(oshaSignals) && oshaSignals.length > 0));
  const oshaClass = oshaSuggested ? "Review: likely recordable" : null;
  const stmt = db.prepare(`INSERT INTO incidents (tenant_id, ref, type, severity, site_id, description, location_detail, involved, photos, reported_by, occurred_at, floor_pos, department, client_uuid, recognized_user_id, latitude, longitude, osha_classification)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  // Insert with an empty photo list, then write the image bytes to disk and store
  // only the refs — the row must exist before a photo can be attached to it.
  // Engagement reports (positive/idea/observation) get a REP- ref, not INC- —
  // labelling a worker's kudos as "Incident INC-…" quietly undercuts the whole
  // point. Incident-shaped reports keep INC-.
  const refPrefix = ENGAGEMENT_TYPES.includes(type) ? "REP" : "INC";
  const { ref, result: r } = refInsert(refPrefix, "incidents", req.auth.tenant, (newRef) =>
    stmt.run(req.auth.tenant, newRef, type, severity ?? null, siteId ?? null, description ?? null,
             locationDetail ?? null, JSON.stringify(involved ?? []), "[]",
             req.auth.uid, occurredAt ?? null, floorPos ? JSON.stringify(floorPos) : null, department ?? null,
             clientUuid ? String(clientUuid) : null, recognizedId, lat, lng, oshaClass));
  const photoRefs = storePhotos(req.auth.tenant, "incident", r.lastInsertRowid, photos);
  if (photoRefs.length) {
    db.prepare("UPDATE incidents SET photos = ? WHERE id = ? AND tenant_id = ?")
      .run(JSON.stringify(photoRefs), r.lastInsertRowid, req.auth.tenant);
  }
  // Rule-driven notifications (in-app always; email flag → EHS_EMAIL_WEBHOOK).
  // Engagement reports (observation / positive / idea) are not incidents — they
  // route to safety as engagement, never trigger the injury/critical alarms, and
  // read as a friendly heads-up rather than "an incident was reported".
  const isEngagement = ENGAGEMENT_TYPES.includes(type);
  // Category for notification matching. Engagement types collapse to "engagement";
  // incident types map to their category (injury/near_miss/property/security/etc.).
  const notifyCategory = isEngagement ? "engagement" : (type || "any");
  const notifyMatch = { category: notifyCategory, severity: isEngagement ? "any" : (severity || "any") };
  // Legacy event strings kept for any rules not yet migrated to the matrix.
  const events = isEngagement ? ["engagement_any"] : ["incident_any"];
  if (type === "injury") events.push("incident_injury");
  if (!isEngagement && (severity === "critical" || severity === "serious")) events.push("incident_critical");
  const site = siteId ? db.prepare("SELECT name FROM sites WHERE id = ?").get(siteId)?.name : null;
  const TYPE_TITLE = {
    injury: "Injury reported", near_miss: "Near miss reported", property: "Property damage reported",
    spill: "Spill reported", fire: "Fire/heat event reported", security: "Security event reported",
    hazard: "Hazard flagged", observation: "Safety observation", positive: "Positive callout 👍", idea: "Safety idea 💡",
  };
  const notified = notify(req.auth.tenant, events, {
    title: `${oshaSuggested ? "⚠ Likely recordable — " : ""}${TYPE_TITLE[type] ?? "Report"}: ${ref}`,
    body: isEngagement
      ? `${site ?? "Unassigned site"} · by ${req.auth.name}`
      : `${site ?? "Unassigned site"} · ${severity ?? "unspecified"} · by ${req.auth.name}`,
    linkKind: "incident", linkRef: ref, match: notifyMatch,
  });
  // Recognition points (leading-indicator rewards). Report-linked points start as
  // 'pending' and are confirmed when safety reviews/closes the report — this is
  // the anti-gaming guard (spamming junk reports earns nothing until reviewed).
  // Kudos are immediate: naming a colleague recognises them now.
  const recoOn = moduleOn(req.auth.tenant, "recognition");
  if (recoOn) {
    const isIdea = type === "idea";
    const pv = pointsFor(req.auth.tenant);
    awardPoints(req.auth.tenant, req.auth.uid, isIdea ? pv.idea : pv.report_reviewed,
      isIdea ? "idea" : "report_reviewed", { sourceType: "incident", sourceId: r.lastInsertRowid, status: "pending" });
    if (type === "positive" && recognizedId) {
      // The reporter gets kudos-given now; the recognised colleague gets kudos-received.
      awardPoints(req.auth.tenant, req.auth.uid, pv.kudos_given, "kudos_given",
        { sourceType: "incident", sourceId: r.lastInsertRowid });
      awardPoints(req.auth.tenant, recognizedId, pv.kudos_received, "kudos_received",
        { sourceType: "incident", sourceId: r.lastInsertRowid, awardedBy: req.auth.uid });
      // Tell the recognised person they were caught doing it right.
      notifyUsers(req.auth.tenant, [recognizedId], {
        title: "👏 You got a shout-out",
        body: `A colleague recognised you for working safe${site ? ` at ${site}` : ""}.`,
        linkKind: "incident", linkRef: ref, email: false,
      });
    }
  }
  res.json({ id: r.lastInsertRowid, ref, notified: notified ?? null });
});
app.put("/api/incidents/:id/response", auth, (req, res) => {
  const progress = Array.isArray(req.body?.progress) ? req.body.progress : [];
  // Responders can work any incident; everyone else may only tick the checklist
  // on a report they filed themselves (that is the post-submit response screen).
  const inc = db.prepare("SELECT reported_by FROM incidents WHERE id = ? AND tenant_id = ?")
    .get(req.params.id, req.auth.tenant);
  if (!inc) return res.status(404).json({ error: "Incident not found" });
  const isResponder = CAN_SEE_ALL_INCIDENTS.includes(req.auth.role);
  if (!isResponder && inc.reported_by !== req.auth.uid)
    return res.status(403).json({ error: "Insufficient permissions" });
  db.prepare("UPDATE incidents SET response_progress = ?, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?")
    .run(JSON.stringify(progress), req.params.id, req.auth.tenant);
  res.json({ ok: true });
});

app.put("/api/incidents/:id", auth, requireRole(...ADMINISH, "site_manager"), (req, res) => {
  const b = req.body || {};
  // Only update keys actually present in the body, so "" clears a field but an
  // omitted key leaves it untouched (COALESCE couldn't distinguish those two).
  if (b.severity !== undefined && b.severity !== null && b.severity !== "" && !SEVERITIES.includes(b.severity))
    return res.status(400).json({ error: `Invalid severity. Must be one of: ${SEVERITIES.join(", ")}` });
  if (b.status !== undefined && !["open", "investigating", "closed"].includes(b.status))
    return res.status(400).json({ error: "Invalid status. Must be one of: open, investigating, closed" });
  const map = { status: "status", severity: "severity", department: "department",
                description: "description", locationDetail: "location_detail",
                oshaClassification: "osha_classification",
                rootCause: "root_cause", investigationNotes: "investigation_notes" };
  const sets = [], vals = [];
  for (const [key, col] of Object.entries(map)) {
    if (Object.prototype.hasOwnProperty.call(b, key)) { sets.push(`${col} = ?`); vals.push(b[key]); }
  }
  // Involved is a JSON array of names — accept an array (or a single string) and
  // store normalized JSON so elevated staff can record multiple people.
  if (Object.prototype.hasOwnProperty.call(b, "involved")) {
    const arr = Array.isArray(b.involved) ? b.involved : (b.involved ? [b.involved] : []);
    const clean = arr.map(s => String(s).trim()).filter(Boolean).slice(0, 50);
    sets.push("involved = ?"); vals.push(JSON.stringify(clean));
  }
  if (!sets.length) return res.json({ ok: true });

  // Close-the-loop: if this update closes the report, tell the person who filed it.
  // Workers stop reporting when nothing visibly comes of it — a "here's what
  // happened with your report" note is the single biggest driver of repeat
  // reporting. Only fire on the open→closed transition, and not for the closer
  // themselves.
  let notifyReporter = null;
  if (b.status === "closed") {
    const prev = db.prepare("SELECT status, reported_by, ref, type FROM incidents WHERE id = ? AND tenant_id = ?")
      .get(req.params.id, req.auth.tenant);
    if (prev && prev.status !== "closed" && prev.reported_by && prev.reported_by !== req.auth.uid) {
      notifyReporter = prev;
    }
  }

  vals.push(req.params.id, req.auth.tenant);
  db.prepare(`UPDATE incidents SET ${sets.join(", ")}, updated_at = datetime('now')
              WHERE id = ? AND tenant_id = ?`).run(...vals);

  if (notifyReporter) {
    const isEng = ENGAGEMENT_TYPES.includes(notifyReporter.type);
    notifyUsers(req.auth.tenant, [notifyReporter.reported_by], {
      title: isEng ? `Thanks for speaking up — ${notifyReporter.ref} was reviewed`
                   : `Your report ${notifyReporter.ref} has been resolved`,
      body: isEng ? "Your input was reviewed and closed out. Keep them coming — it makes a difference."
                  : "The team has closed out what you reported. Thanks for flagging it.",
      linkKind: "incident", linkRef: notifyReporter.ref, email: false,
    });
    // Confirm the reporter's pending points now that safety has reviewed it.
    db.prepare(`UPDATE points_ledger SET status = 'confirmed'
                WHERE tenant_id = ? AND source_type = 'incident' AND source_id = ? AND status = 'pending'`)
      .run(req.auth.tenant, req.params.id);
  }
  res.json({ ok: true });
});

// ── Recognition & leaderboard ─────────────────────────────────────────────────
// My own points: confirmed total, this month, and pending (awaiting review).
app.get("/api/points/me", auth, (req, res) => {
  const t = req.auth.tenant, u = req.auth.uid, p = periodOf();
  const confirmed = db.prepare("SELECT COALESCE(SUM(points),0) n FROM points_ledger WHERE tenant_id=? AND user_id=? AND status='confirmed'").get(t, u).n;
  const thisMonth = db.prepare("SELECT COALESCE(SUM(points),0) n FROM points_ledger WHERE tenant_id=? AND user_id=? AND status='confirmed' AND period=?").get(t, u, p).n;
  const pending = db.prepare("SELECT COALESCE(SUM(points),0) n FROM points_ledger WHERE tenant_id=? AND user_id=? AND status='pending'").get(t, u).n;
  const recent = db.prepare(`SELECT points, reason, note, created_at FROM points_ledger
                             WHERE tenant_id=? AND user_id=? AND status='confirmed'
                             ORDER BY created_at DESC LIMIT 10`).all(t, u);
  res.json({ confirmed, thisMonth, pending, period: p, recent });
});

// Monthly leaderboard. Anti-shame by design: returns only the TOP N plus the
// caller's OWN rank — never a full ranked list that publicly ranks people last.
app.get("/api/points/leaderboard", auth, (req, res) => {
  const t = req.auth.tenant, p = String(req.query.period || periodOf());
  const top = db.prepare(`SELECT u.id, u.name, SUM(l.points) AS pts
                          FROM points_ledger l JOIN users u ON u.id = l.user_id
                          WHERE l.tenant_id=? AND l.status='confirmed' AND l.period=? AND u.active=1
                          GROUP BY u.id ORDER BY pts DESC, u.name ASC LIMIT 10`).all(t, p);
  // Caller's own rank (computed, not exposed for others).
  const mine = db.prepare(`SELECT COALESCE(SUM(points),0) pts FROM points_ledger
                           WHERE tenant_id=? AND user_id=? AND status='confirmed' AND period=?`).get(t, req.auth.uid, p).pts;
  const ahead = db.prepare(`SELECT COUNT(*) n FROM (
                              SELECT user_id, SUM(points) pts FROM points_ledger
                              WHERE tenant_id=? AND status='confirmed' AND period=? GROUP BY user_id
                              HAVING pts > ?)`).get(t, p, mine).n;
  res.json({ period: p, top: top.map((r, i) => ({ rank: i + 1, name: r.name, points: r.pts, isMe: r.id === req.auth.uid })),
             me: { points: mine, rank: mine > 0 ? ahead + 1 : null } });
});

// The previous month's champion — powers the "reset ceremony": when a new month
// starts, everyone sees who won the month just ended. Returns the top scorer of the
// prior period (null if nobody scored), plus a short hall-of-fame of past winners.
const prevPeriod = (d = new Date()) => {
  const x = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`;
};
app.get("/api/points/champion", auth, (req, res) => {
  const t = req.auth.tenant;
  const period = String(req.query.period || prevPeriod());
  const champ = db.prepare(`SELECT u.id, u.name, SUM(l.points) AS pts
                            FROM points_ledger l JOIN users u ON u.id = l.user_id
                            WHERE l.tenant_id=? AND l.status='confirmed' AND l.period=? AND u.active=1
                            GROUP BY u.id ORDER BY pts DESC, u.name ASC LIMIT 1`).get(t, period);
  // Hall of fame: the champion of each of the last several completed months.
  const periods = db.prepare(`SELECT DISTINCT period FROM points_ledger
                              WHERE tenant_id=? AND status='confirmed' AND period < ?
                              ORDER BY period DESC LIMIT 6`).all(t, periodOf());
  const hallOfFame = periods.map(({ period: pr }) => {
    const w = db.prepare(`SELECT u.name, SUM(l.points) AS pts
                          FROM points_ledger l JOIN users u ON u.id = l.user_id
                          WHERE l.tenant_id=? AND l.status='confirmed' AND l.period=? AND u.active=1
                          GROUP BY u.id ORDER BY pts DESC, u.name ASC LIMIT 1`).get(t, pr);
    return w ? { period: pr, name: w.name, points: w.pts } : null;
  }).filter(Boolean);
  res.json({
    period,
    champion: champ ? { name: champ.name, points: champ.pts, isMe: champ.id === req.auth.uid } : null,
    hallOfFame,
  });
});

// Badges: persistent, attainable-by-anyone achievements (anti-shame — unlike the
// monthly race, everyone can earn every badge by participating). Computed on-read
// from the caller's ledger so there's no separate award job to run.
const BADGE_DEFS = [
  { id: "first_report",  icon: "📝", name: "First Report",     desc: "Filed your first report",            test: s => s.reportCount >= 1 },
  { id: "reporter_10",   icon: "🔍", name: "Sharp Eyes",       desc: "Filed 10 reports",                   test: s => s.reportCount >= 10 },
  { id: "reporter_25",   icon: "🦅", name: "Eagle Eye",        desc: "Filed 25 reports",                   test: s => s.reportCount >= 25 },
  { id: "first_kudos",   icon: "👏", name: "Team Player",      desc: "Gave your first shout-out",          test: s => s.kudosGiven >= 1 },
  { id: "kudos_10",      icon: "🤝", name: "Culture Builder",  desc: "Gave 10 shout-outs",                 test: s => s.kudosGiven >= 10 },
  { id: "recognized",    icon: "⭐", name: "Recognized",       desc: "Received a shout-out",               test: s => s.kudosReceived >= 1 },
  { id: "idea_person",   icon: "💡", name: "Idea Person",      desc: "Shared a safety idea",               test: s => s.ideaCount >= 1 },
  { id: "streak_3",      icon: "🔥", name: "On a Roll",        desc: "Active 3 months in a row",           test: s => s.streak >= 3 },
  { id: "streak_6",      icon: "🚀", name: "Committed",        desc: "Active 6 months in a row",           test: s => s.streak >= 6 },
  { id: "champion",      icon: "🏆", name: "Monthly Champion", desc: "Won a monthly leaderboard",          test: s => s.championMonths >= 1 },
];
app.get("/api/points/badges", auth, (req, res) => {
  const t = req.auth.tenant, u = req.auth.uid;
  // Participation badges count the ACTION taken, even if the points are still
  // pending review — filing a report is an achievement the moment you file it.
  const allRows = db.prepare(`SELECT reason, period, status FROM points_ledger WHERE tenant_id=? AND user_id=?`).all(t, u);
  const count = (fn) => allRows.filter(fn).length;
  const stats = {
    reportCount:   count(r => r.reason === "report_reviewed" || r.reason === "idea"),
    ideaCount:     count(r => r.reason === "idea"),
    kudosGiven:    count(r => r.reason === "kudos_given"),
    kudosReceived: count(r => r.reason === "kudos_received"),
  };
  // Streak & champion use CONFIRMED activity (they're about the competitive race).
  const rows = allRows.filter(r => r.status === "confirmed");
  // Streak: consecutive months (up to and including last month) with any activity.
  const active = new Set(rows.map(r => r.period));
  let streak = 0;
  for (let i = 0; i < 24; i++) {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    const per = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (active.has(per)) streak++;
    else if (i > 0) break; // current month not yet active is OK; a gap before that ends the streak
  }
  stats.streak = streak;
  // Champion months: how many completed months this user topped.
  const periods = [...active].filter(p => p < periodOf());
  let championMonths = 0;
  for (const p of periods) {
    const top = db.prepare(`SELECT user_id FROM points_ledger WHERE tenant_id=? AND status='confirmed' AND period=?
                            GROUP BY user_id ORDER BY SUM(points) DESC LIMIT 1`).get(t, p);
    if (top && top.user_id === u) championMonths++;
  }
  stats.championMonths = championMonths;
  const badges = BADGE_DEFS.map(b => ({ id: b.id, icon: b.icon, name: b.name, desc: b.desc, earned: b.test(stats) }));
  res.json({ badges, earnedCount: badges.filter(b => b.earned).length, total: badges.length, streak });
});

// Operator/admin: award manual recognition points to someone.
app.post("/api/points/award", auth, requireRole(...ADMINISH), (req, res) => {
  const { userId, points, note } = req.body || {};
  const n = parseInt(points, 10);
  if (!userId || !Number.isFinite(n) || n === 0) return res.status(400).json({ error: "userId and non-zero points required" });
  const target = db.prepare("SELECT id FROM users WHERE id=? AND tenant_id=?").get(userId, req.auth.tenant);
  if (!target) return res.status(404).json({ error: "User not found" });
  awardPoints(req.auth.tenant, userId, n, "manual", { awardedBy: req.auth.uid, note: note ? String(note).slice(0, 300) : null });
  res.json({ ok: true });
});

// Point-value tuning: read/set what each action is worth for this tenant.
app.get("/api/points/values", auth, requireRole(...ADMINISH), (req, res) => {
  res.json({ values: pointsFor(req.auth.tenant), defaults: POINTS });
});
app.put("/api/points/values", auth, requireRole(...ADMINISH), (req, res) => {
  const incoming = req.body?.values || {};
  const clean = {};
  for (const k of Object.keys(POINTS)) {
    const v = parseInt(incoming[k], 10);
    if (Number.isFinite(v) && v >= 0 && v <= 1000) clean[k] = v;
    else clean[k] = POINTS[k];
  }
  db.prepare("UPDATE tenants SET point_values = ? WHERE id = ?").run(JSON.stringify(clean), req.auth.tenant);
  res.json({ ok: true, values: clean });
});

// ── Corrective actions ───────────────────────────────────────────────────────
app.get("/api/cas", auth, (req, res) => {
  const sel = `SELECT c.*, i.ref AS incident_ref, u.name AS assignee_name,
                      d.name AS assignee_group_name
               FROM corrective_actions c
               LEFT JOIN incidents i ON i.id = c.incident_id
               LEFT JOIN findings f ON f.id = c.finding_id
               LEFT JOIN users u ON u.id = c.assignee_id
               LEFT JOIN departments d ON d.id = c.assignee_dept_id`;

  // Staff/trainer don't get the company CA list — BUT a group assignment is a
  // direct task for them, so they see CAs assigned to them personally or to their
  // department (optionally site-scoped to that group). Nothing else.
  if (!CAN_SEE_CAS.includes(req.auth.role)) {
    const me = db.prepare("SELECT department_id, site_id FROM users WHERE id = ?").get(req.auth.uid);
    const rows = db.prepare(`${sel}
      WHERE c.tenant_id = ?
        AND ( c.assignee_id = ?
              OR ( c.assignee_dept_id IS NOT NULL
                   AND c.assignee_dept_id = ?
                   AND (c.assignee_site_id IS NULL OR c.assignee_site_id = ?) ) )
      ORDER BY c.due_date ASC`)
      .all(req.auth.tenant, req.auth.uid, me?.department_id ?? -1, me?.site_id ?? -1);
    return res.json(rows);
  }

  const site = siteScope(req);
  if (site === null) {
    return res.json(db.prepare(`${sel} WHERE c.tenant_id = ? ORDER BY c.due_date ASC`).all(req.auth.tenant));
  }
  // Site-scoped managers: CAs whose incident/finding is at their site, OR that are
  // group-assigned to their site.
  res.json(db.prepare(`${sel}
                       WHERE c.tenant_id = ?
                         AND (i.site_id = ? OR f.site_id = ? OR c.assignee_site_id = ?)
                       ORDER BY c.due_date ASC`).all(req.auth.tenant, site, site, site));
});
// Valid CA statuses. capex_blocked is "open but awaiting budget" — see reports.
const CA_STATUSES = ["open", "in_progress", "capex_blocked", "done", "verified"];

// Record one entry in a CA's activity log. Best-effort; never blocks the action.
function logCA(tenantId, caId, actorId, kind, detail) {
  try {
    db.prepare(`INSERT INTO ca_activity (tenant_id, ca_id, actor_id, kind, detail) VALUES (?, ?, ?, ?, ?)`)
      .run(tenantId, caId, actorId ?? null, kind, detail ?? null);
  } catch (e) { console.error("logCA failed:", e.message); }
}

const userName = (id, tenantId) =>
  id ? (db.prepare("SELECT name FROM users WHERE id = ? AND tenant_id = ?").get(id, tenantId)?.name ?? "someone") : null;

// Resolve a group (department, optionally scoped to a site) to its active member
// user-ids — this is who gets notified and who sees the item as theirs.
function groupMemberIds(tenantId, deptId, siteId) {
  if (!deptId) return [];
  const rows = siteId
    ? db.prepare("SELECT id FROM users WHERE tenant_id = ? AND department_id = ? AND site_id = ? AND active = 1").all(tenantId, deptId, siteId)
    : db.prepare("SELECT id FROM users WHERE tenant_id = ? AND department_id = ? AND active = 1").all(tenantId, deptId);
  return rows.map(r => r.id);
}

// Human label for a group, e.g. "Bottling (Moriah)" or "Maintenance".
// Can this request act on a specific CA? Managers/safety always; otherwise only
// the individual assignee or a member of the assigned group. This lets a line
// worker close the group task assigned to their department without opening up the
// whole CA surface to all staff.
function canActOnCA(req, ca) {
  if (CAN_SEE_CAS.includes(req.auth.role)) return true;
  if (ca.assignee_id && ca.assignee_id === req.auth.uid) return true;
  if (ca.assignee_dept_id) {
    const me = db.prepare("SELECT department_id, site_id FROM users WHERE id = ?").get(req.auth.uid);
    if (me && me.department_id === ca.assignee_dept_id &&
        (!ca.assignee_site_id || ca.assignee_site_id === me.site_id)) return true;
  }
  return false;
}

function groupLabel(tenantId, deptId, siteId) {
  if (!deptId) return null;
  const dept = db.prepare("SELECT name FROM departments WHERE id = ? AND tenant_id = ?").get(deptId, tenantId)?.name ?? "a department";
  const site = siteId ? db.prepare("SELECT name FROM sites WHERE id = ? AND tenant_id = ?").get(siteId, tenantId)?.name : null;
  return site ? `${dept} (${site})` : dept;
}

app.post("/api/cas", auth, requireRole(...CAN_SEE_CAS), (req, res) => {
  const { incidentId, findingId, title, priority, assigneeId, dueDate, assigneeDeptId, assigneeSiteId } = req.body || {};
  if (!title) return res.status(400).json({ error: "title required" });
  // A CA is owned by an individual OR a group, not both.
  const indiv = assigneeDeptId ? null : (assigneeId ?? null);
  const dept = assigneeDeptId ?? null;
  const gsite = assigneeDeptId ? (assigneeSiteId ?? null) : null;
  const r = db.prepare(`INSERT INTO corrective_actions (tenant_id, incident_id, finding_id, title, priority, assignee_id, due_date, assignee_dept_id, assignee_site_id)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(req.auth.tenant, incidentId ?? null, findingId ?? null, title, priority ?? "medium", indiv, dueDate ?? null, dept, gsite);
  const who = dept ? `${groupLabel(req.auth.tenant, dept, gsite)} (group)` : (indiv ? userName(indiv, req.auth.tenant) : null);
  logCA(req.auth.tenant, r.lastInsertRowid, req.auth.uid, "created",
        `Created${who ? `, assigned to ${who}` : ""}${dueDate ? `, due ${dueDate}` : ""}`);
  if (dept) {
    const members = groupMemberIds(req.auth.tenant, dept, gsite);
    notifyUsers(req.auth.tenant, members, {
      title: `Corrective action assigned to your team: ${title}`,
      body: `${groupLabel(req.auth.tenant, dept, gsite)}${dueDate ? ` · due ${dueDate}` : ""}`,
      linkKind: "incident", linkRef: null,
    });
  }
  res.json({ id: r.lastInsertRowid });
});

// One CA plus its full activity trail.
app.get("/api/cas/:id", auth, (req, res) => {
  const ca = db.prepare(`SELECT c.*, i.ref AS incident_ref, u.name AS assignee_name, v.name AS verified_by_name
                         FROM corrective_actions c
                         LEFT JOIN incidents i ON i.id = c.incident_id
                         LEFT JOIN users u ON u.id = c.assignee_id
                         LEFT JOIN users v ON v.id = c.verified_by
                         WHERE c.id = ? AND c.tenant_id = ?`).get(req.params.id, req.auth.tenant);
  if (!ca) return res.status(404).json({ error: "Not found" });
  if (!canActOnCA(req, ca)) return res.status(403).json({ error: "Insufficient permissions" });
  // Surface the group as a friendly label + member count when assigned to one.
  if (ca.assignee_dept_id) {
    ca.assignee_group = groupLabel(req.auth.tenant, ca.assignee_dept_id, ca.assignee_site_id);
    ca.group_member_count = groupMemberIds(req.auth.tenant, ca.assignee_dept_id, ca.assignee_site_id).length;
  }
  const activity = db.prepare(`SELECT a.*, u.name AS actor_name FROM ca_activity a
                               LEFT JOIN users u ON u.id = a.actor_id
                               WHERE a.tenant_id = ? AND a.ca_id = ? ORDER BY a.created_at DESC`)
    .all(req.auth.tenant, req.params.id);
  res.json({ ...ca, activity });
});

// Full workflow update: status, assignment, due date, priority, CapEx block, and
// free-text notes — each change is diffed against the current row and written to
// the activity log so there's a defensible audit trail of who changed what, when.
app.put("/api/cas/:id", auth, (req, res) => {
  const t = req.auth.tenant;
  const cur = db.prepare("SELECT * FROM corrective_actions WHERE id = ? AND tenant_id = ?").get(req.params.id, t);
  if (!cur) return res.status(404).json({ error: "Not found" });
  if (!canActOnCA(req, cur)) return res.status(403).json({ error: "Insufficient permissions" });

  const { status, verified, assigneeId, dueDate, priority, note, blockedReason, assigneeDeptId, assigneeSiteId } = req.body || {};
  if (status && !CA_STATUSES.includes(status))
    return res.status(400).json({ error: `Invalid status. One of: ${CA_STATUSES.join(", ")}` });

  const sets = [], vals = [], logs = [];

  // Group assignment (a department, optionally at a site). Assigning to a group
  // clears any individual assignee, and vice-versa — a CA is owned by one or the
  // other, not both.
  if (assigneeDeptId !== undefined && (assigneeDeptId ?? null) !== cur.assignee_dept_id) {
    sets.push("assignee_dept_id = ?"); vals.push(assigneeDeptId ?? null);
    sets.push("assignee_site_id = ?"); vals.push(assigneeDeptId ? (assigneeSiteId ?? null) : null);
    if (assigneeDeptId) { sets.push("assignee_id = NULL"); }
    logs.push(["assign", assigneeDeptId
      ? `Assigned to ${groupLabel(t, assigneeDeptId, assigneeSiteId)} — all members notified`
      : "Group assignment cleared"]);
  }

  if (assigneeId !== undefined && assigneeId !== cur.assignee_id) {
    sets.push("assignee_id = ?"); vals.push(assigneeId ?? null);
    if (assigneeId) { sets.push("assignee_dept_id = NULL"); sets.push("assignee_site_id = NULL"); }
    logs.push(["assign", assigneeId ? `Reassigned to ${userName(assigneeId, t)}` : "Unassigned"]);
  }
  if (dueDate !== undefined && dueDate !== cur.due_date) {
    sets.push("due_date = ?"); vals.push(dueDate ?? null);
    logs.push(["due", dueDate ? `Due date set to ${dueDate}` : "Due date cleared"]);
  }
  if (priority !== undefined && priority !== cur.priority) {
    sets.push("priority = ?"); vals.push(priority);
    logs.push(["status", `Priority changed to ${priority}`]);
  }
  if (blockedReason !== undefined) {
    sets.push("blocked_reason = ?"); vals.push(blockedReason ?? null);
  }
  if (status && status !== cur.status) {
    sets.push("status = ?"); vals.push(status);
    if (["done", "verified"].includes(status)) { sets.push("closed_at = datetime('now')"); }
    else if (["open", "in_progress", "capex_blocked"].includes(status) && cur.closed_at) { sets.push("closed_at = NULL"); }
    if (status === "capex_blocked")
      logs.push(["capex", `Marked CapEx-blocked${blockedReason ? `: ${blockedReason}` : ""} — stays open, not counted overdue`]);
    else
      logs.push(["status", `Status → ${status.replace("_", " ")}`]);
  }
  if (verified) {
    sets.push("verified_by = ?"); vals.push(req.auth.uid);
    if (!status) { sets.push("status = ?"); vals.push("verified"); sets.push("closed_at = datetime('now')"); }
    logs.push(["status", "Verified & closed"]);
  }
  if (note && String(note).trim()) {
    logs.push(["note", String(note).trim().slice(0, 2000)]);
  }

  if (sets.length) {
    sets.push("updated_at = datetime('now')");
    vals.push(req.params.id, t);
    db.prepare(`UPDATE corrective_actions SET ${sets.join(", ")} WHERE id = ? AND tenant_id = ?`).run(...vals);
  }
  logs.forEach(([kind, detail]) => logCA(t, req.params.id, req.auth.uid, kind, detail));

  // If this update assigned the CA to a group, notify every member.
  if (assigneeDeptId !== undefined && assigneeDeptId && (assigneeDeptId ?? null) !== cur.assignee_dept_id) {
    const members = groupMemberIds(t, assigneeDeptId, assigneeSiteId);
    notifyUsers(t, members, {
      title: `Corrective action assigned to your team: ${cur.title}`,
      body: groupLabel(t, assigneeDeptId, assigneeSiteId),
      linkKind: "incident", linkRef: cur.incident_id ? null : null,
    });
  }

  res.json({ ok: true, changed: sets.length > 0 || logs.length > 0 });
});

// ── Checklists / inspections / findings ──────────────────────────────────────
app.get("/api/checklists", auth, listAll("checklists"));
app.post("/api/checklists", auth, requireRole(...ADMINISH, "site_manager"), (req, res) => {
  const { name, items, siteId, kind, frequencyDays } = req.body || {};
  if (!name) return res.status(400).json({ error: "name required" });
  const r = db.prepare("INSERT INTO checklists (tenant_id, name, items, site_id, kind, frequency_days) VALUES (?, ?, ?, ?, ?, ?)")
    .run(req.auth.tenant, name, JSON.stringify(items ?? []), siteId ?? null, kind ?? "checklist", frequencyDays ?? null);
  res.json({ id: r.lastInsertRowid });
});
app.put("/api/checklists/:id", auth, requireRole(...ADMINISH, "site_manager"), (req, res) => {
  const { name, items, siteId, kind, frequencyDays, active } = req.body || {};
  db.prepare(`UPDATE checklists SET name = COALESCE(?, name),
              items = COALESCE(?, items), site_id = COALESCE(?, site_id),
              kind = COALESCE(?, kind), frequency_days = COALESCE(?, frequency_days),
              active = COALESCE(?, active)
              WHERE id = ? AND tenant_id = ?`)
    .run(name, items ? JSON.stringify(items) : null, siteId, kind, frequencyDays, active,
         req.params.id, req.auth.tenant);
  res.json({ ok: true });
});

// ── Checklist schedule: per checklist × site — last run, next due, overdue ────
app.get("/api/checklists/schedule", auth, (req, res) => {
  const t = req.auth.tenant;
  const sites = db.prepare("SELECT id, name FROM sites WHERE tenant_id = ? AND active = 1").all(t);
  const lists = db.prepare("SELECT * FROM checklists WHERE tenant_id = ? AND active = 1 AND frequency_days IS NOT NULL").all(t);
  const out = [];
  for (const cl of lists) {
    const applicable = cl.site_id ? sites.filter(s => s.id === cl.site_id) : sites;
    for (const site of applicable) {
      const last = db.prepare(`SELECT MAX(completed_at) d FROM inspections
                               WHERE tenant_id = ? AND checklist_id = ? AND site_id = ? AND status = 'complete'`)
        .get(t, cl.id, site.id).d;
      const base = last ? new Date(last) : null;
      const nextDue = base ? new Date(base.getTime() + cl.frequency_days * 86400000) : new Date(); // never run = due now
      const daysUntil = Math.ceil((nextDue.getTime() - Date.now()) / 86400000);
      out.push({
        checklistId: cl.id, checklist: cl.name, kind: cl.kind,
        siteId: site.id, site: site.name,
        frequencyDays: cl.frequency_days,
        lastRun: last, nextDue: nextDue.toISOString().slice(0, 10),
        daysUntil, overdue: daysUntil < 0, dueSoon: daysUntil >= 0 && daysUntil <= 14,
      });
    }
  }
  out.sort((a, b) => a.daysUntil - b.daysUntil);
  res.json(out);
});
app.get("/api/inspections", auth, (req, res) => {
  const site = siteScope(req);
  const rows = site === null
    ? db.prepare("SELECT * FROM inspections WHERE tenant_id = ? ORDER BY started_at DESC").all(req.auth.tenant)
    : db.prepare("SELECT * FROM inspections WHERE tenant_id = ? AND site_id = ? ORDER BY started_at DESC")
        .all(req.auth.tenant, site);
  res.json(rows);
});
app.post("/api/inspections", auth, (req, res) => {
  const r = db.prepare("INSERT INTO inspections (tenant_id, checklist_id, site_id, inspector_id) VALUES (?, ?, ?, ?)")
    .run(req.auth.tenant, req.body.checklistId ?? null, req.body.siteId ?? null, req.auth.uid);
  res.json({ id: r.lastInsertRowid });
});
app.put("/api/inspections/:id", auth, (req, res) => {
  const { responses, complete } = req.body || {};
  db.prepare(`UPDATE inspections SET responses = COALESCE(?, responses),
              status = CASE WHEN ? THEN 'complete' ELSE status END,
              completed_at = CASE WHEN ? THEN datetime('now') ELSE completed_at END
              WHERE id = ? AND tenant_id = ?`)
    .run(responses ? JSON.stringify(responses) : null, complete ? 1 : 0, complete ? 1 : 0, req.params.id, req.auth.tenant);
  res.json({ ok: true });
});
// Same photo-bloat fix as incidents: the findings list must not carry base64
// image data. Detail comes from GET /api/findings/:id.
app.get("/api/findings", auth, (req, res) => {
  const site = siteScope(req);
  const cols = `f.id, f.tenant_id, f.inspection_id, f.site_id,
                f.description, f.severity, f.status, f.reported_by,
                f.resolution_action, f.resolution_notes,
                f.created_at, f.resolved_at,
                json_array_length(COALESCE(f.photos, '[]')) AS photo_count,
                u.name AS reporter_name, s.name AS site_name`;
  const rows = site === null
    ? db.prepare(`SELECT ${cols} FROM findings f
                  LEFT JOIN users u ON u.id = f.reported_by
                  LEFT JOIN sites s ON s.id = f.site_id
                  WHERE f.tenant_id = ? ORDER BY f.created_at DESC`).all(req.auth.tenant)
    : db.prepare(`SELECT ${cols} FROM findings f
                  LEFT JOIN users u ON u.id = f.reported_by
                  LEFT JOIN sites s ON s.id = f.site_id
                  WHERE f.tenant_id = ? AND f.site_id = ? ORDER BY f.created_at DESC`)
        .all(req.auth.tenant, site);
  res.json(rows);
});

app.get("/api/findings/:id", auth, (req, res) => {
  const row = db.prepare(`SELECT f.*, u.name AS reporter_name, s.name AS site_name
                          FROM findings f LEFT JOIN users u ON u.id = f.reported_by
                          LEFT JOIN sites s ON s.id = f.site_id
                          WHERE f.id = ? AND f.tenant_id = ?`).get(req.params.id, req.auth.tenant);
  if (!row) return res.status(404).json({ error: "Finding not found" });
  const fSite = siteScope(req);
  if (fSite !== null && row.site_id !== fSite)
    return res.status(403).json({ error: "Insufficient permissions" });
  res.json(row);
});
app.post("/api/findings", auth, (req, res) => {
  const { inspectionId, siteId, severity, description, photos } = req.body || {};
  if (!description) return res.status(400).json({ error: "description required" });
  const r = db.prepare(`INSERT INTO findings (tenant_id, inspection_id, site_id, severity, description, photos, reported_by)
                        VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(req.auth.tenant, inspectionId ?? null, siteId ?? null, severity ?? "low", description,
         JSON.stringify(photos ?? []), req.auth.uid);
  if (severity === "high" || severity === "critical") {
    const site = siteId ? db.prepare("SELECT name FROM sites WHERE id = ?").get(siteId)?.name : null;
    notify(req.auth.tenant, ["finding_high"], {
      title: `High-severity finding logged`,
      body: `${site ?? "Unassigned site"} · ${description.slice(0, 120)} · by ${req.auth.name}`,
      linkKind: "finding", linkRef: String(r.lastInsertRowid),
    });
  }
  res.json({ id: r.lastInsertRowid });
});
app.put("/api/findings/:id", auth, (req, res) => {
  const { status, resolutionAction, resolutionNotes, escalateToCA, caDueDate } = req.body || {};
  const finding = db.prepare("SELECT * FROM findings WHERE id = ? AND tenant_id = ?").get(req.params.id, req.auth.tenant);
  if (!finding) return res.status(404).json({ error: "Finding not found" });
  const { photos } = req.body || {};
  db.prepare(`UPDATE findings SET status = COALESCE(?, status),
              resolution_action = COALESCE(?, resolution_action),
              resolution_notes = COALESCE(?, resolution_notes),
              photos = COALESCE(?, photos),
              resolved_at = CASE WHEN ? = 'resolved' THEN datetime('now') ELSE resolved_at END
              WHERE id = ? AND tenant_id = ?`)
    .run(status, resolutionAction, resolutionNotes,
         photos ? JSON.stringify(photos) : null, status, req.params.id, req.auth.tenant);
  let caId = null;
  if (escalateToCA) {
    const r = db.prepare(`INSERT INTO corrective_actions (tenant_id, finding_id, title, priority, due_date)
                          VALUES (?, ?, ?, ?, ?)`)
      .run(req.auth.tenant, finding.id, `Resolve finding: ${(finding.description ?? "").slice(0, 120)}`,
           finding.severity === "critical" || finding.severity === "high" ? "high" : "medium",
           caDueDate ?? null);
    caId = r.lastInsertRowid;
  }
  res.json({ ok: true, caId });
});

// ── Trainings & completions ──────────────────────────────────────────────────
app.get("/api/trainings", auth, listAll("trainings"));
app.post("/api/trainings", auth, requireRole(...ADMINISH, "trainer"), (req, res) => {
  const { title, kind, content, frequencyMonths, requiredRoles, requiredDepartments } = req.body || {};
  if (!title) return res.status(400).json({ error: "title required" });
  const r = db.prepare(`INSERT INTO trainings (tenant_id, title, kind, content, frequency_months, required_roles, required_departments)
                        VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(req.auth.tenant, title, kind ?? "cbt", JSON.stringify(content ?? {}), frequencyMonths ?? null,
         JSON.stringify(requiredRoles ?? []), JSON.stringify(requiredDepartments ?? []));
  res.json({ id: r.lastInsertRowid });
});
app.put("/api/trainings/:id", auth, requireRole(...ADMINISH, "trainer"), (req, res) => {
  const { title, kind, content, frequencyMonths, requiredRoles, requiredDepartments, requiredUsers, active } = req.body || {};
  db.prepare(`UPDATE trainings SET title = COALESCE(?, title), kind = COALESCE(?, kind),
              content = COALESCE(?, content),
              frequency_months = ${frequencyMonths === null ? "NULL" : "COALESCE(?, frequency_months)"},
              required_roles = COALESCE(?, required_roles),
              required_departments = COALESCE(?, required_departments),
              required_users = COALESCE(?, required_users),
              active = COALESCE(?, active)
              WHERE id = ? AND tenant_id = ?`)
    .run(...[title, kind, content ? JSON.stringify(content) : null,
         ...(frequencyMonths === null ? [] : [frequencyMonths]),
         requiredRoles ? JSON.stringify(requiredRoles) : null,
         requiredDepartments ? JSON.stringify(requiredDepartments) : null,
         requiredUsers ? JSON.stringify(requiredUsers) : null,
         active, req.params.id, req.auth.tenant]);
  res.json({ ok: true });
});

app.get("/api/completions", auth, (req, res) => {
  const rows = req.auth.role === "staff"
    ? db.prepare("SELECT * FROM training_completions WHERE tenant_id = ? AND user_id = ? ORDER BY completed_at DESC").all(req.auth.tenant, req.auth.uid)
    : db.prepare("SELECT * FROM training_completions WHERE tenant_id = ? ORDER BY completed_at DESC").all(req.auth.tenant);
  res.json(rows);
});
app.post("/api/completions", auth, (req, res) => {
  const { trainingId, userIds, method, score, sessionId, passed } = req.body || {};
  const didPass = passed === undefined ? 1 : (passed ? 1 : 0);
  if (!trainingId) return res.status(400).json({ error: "trainingId required" });
  const targets = Array.isArray(userIds) && userIds.length ? userIds : [req.auth.uid];
  const trainerRoles = ["admin", "safety", "trainer", "site_manager"];
  // Group logging requires trainer+; self-completion is open to all
  if ((targets.length > 1 || targets[0] !== req.auth.uid) &&
      !trainerRoles.includes(req.auth.role))
    return res.status(403).json({ error: "Insufficient permissions" });
  // In-person sign-off ATTESTS that someone verified the completion — it must be
  // recorded by a trainer/safety/manager/admin, never self-signed by staff, even
  // for oneself. (CBT/self-serve completion stays open to all.)
  if ((method === "inperson" || method === "signoff") && !trainerRoles.includes(req.auth.role))
    return res.status(403).json({ error: "In-person sign-off must be recorded by a trainer or manager" });
  const training = db.prepare("SELECT frequency_months FROM trainings WHERE id = ? AND tenant_id = ?").get(trainingId, req.auth.tenant);
  if (!training) return res.status(404).json({ error: "Training not found" });
  const sid = sessionId ?? `SES-${Date.now()}`;
  // Failed attempts are logged for the audit trail but never carry an expiry (they do not satisfy the requirement)
  const stmt = db.prepare(`INSERT INTO training_completions (tenant_id, training_id, user_id, session_id, method, score, passed, expires_at)
                           VALUES (?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 1 AND ? IS NOT NULL THEN datetime('now', '+' || ? || ' months') ELSE NULL END)`);
  const tx = db.transaction(() => targets.forEach(uid =>
    stmt.run(req.auth.tenant, trainingId, uid, sid, method ?? "cbt", score ?? null, didPass, didPass, training.frequency_months, training.frequency_months)));
  tx();
  // Recognition: reward passing a training (a leading indicator). One award per
  // (user, training) via the source dedup, so retakes don't farm points.
  const recoOn = moduleOn(req.auth.tenant, "recognition");
  if (recoOn && didPass) {
    const trainPts = pointsFor(req.auth.tenant).training;
    targets.forEach(uid => awardPoints(req.auth.tenant, uid, trainPts, "training",
      { sourceType: "training", sourceId: trainingId }));
  }
  res.json({ ok: true, sessionId: sid, count: targets.length });
});

// Admin/trainer: send a reminder now to staff with overdue or missing required
// trainings (what the compliance screen's "Send reminders" button triggers).
// Covers both expired completions AND never-started required trainings.
app.post("/api/trainings/remind", auth, requireRole(...["admin", "safety", "trainer", "site_manager"]), (req, res) => {
  const t = req.auth.tenant;
  const now = Date.now();
  const users = db.prepare("SELECT id, name, email, role, department_id, site_id FROM users WHERE tenant_id = ? AND active = 1 AND is_operator = 0").all(t);
  const trainings = db.prepare("SELECT id, title, required_roles, required_departments, required_users FROM trainings WHERE tenant_id = ? AND active = 1").all(t);
  const comps = db.prepare("SELECT user_id, training_id, expires_at, passed FROM training_completions WHERE tenant_id = ?").all(t);
  const notif = db.prepare(`INSERT INTO notifications (tenant_id, user_id, title, body, link_kind, link_ref) VALUES (?, ?, ?, ?, 'training', ?)`);
  const recent = db.prepare(`SELECT 1 FROM notifications WHERE user_id = ? AND link_kind = 'training' AND link_ref = ? AND created_at > datetime('now','-3 days') LIMIT 1`);
  const company = db.prepare("SELECT name FROM tenants WHERE id = ?").get(t)?.name;
  const emailTargets = [];
  let reminded = 0;
  for (const u of users) {
    // Which required trainings is this user missing or overdue on?
    const overdue = trainings.filter(tr => {
      const roles = JSON.parse(tr.required_roles || "[]");
      const depts = JSON.parse(tr.required_departments || "[]");
      const usrs = JSON.parse(tr.required_users || "[]");
      const required = (roles.length === 0 && depts.length === 0 && usrs.length === 0)
        || roles.includes(u.role) || usrs.includes(u.id) || depts.includes(u.department_id);
      if (!required) return false;
      const passed = comps.filter(c => c.user_id === u.id && c.training_id === tr.id && c.passed !== 0)
        .sort((a, b) => (b.expires_at || "").localeCompare(a.expires_at || ""))[0];
      if (!passed) return true;                                   // never passed
      if (passed.expires_at && new Date(passed.expires_at).getTime() < now) return true; // expired
      return false;
    });
    if (!overdue.length) continue;
    const ref = "reminder-overdue";
    if (recent.get(u.id, ref)) continue;                          // don't spam
    notif.run(t, u.id, `📚 ${overdue.length} training${overdue.length === 1 ? "" : "s"} need your attention`,
      `You have ${overdue.length} required training${overdue.length === 1 ? "" : "s"} overdue or not yet completed. Open your Training queue to get current.`, ref);
    if (u.email) emailTargets.push({ email: u.email, count: overdue.length });
    reminded++;
  }
  // A manually-pushed reminder should be loud — send email too, not just in-app.
  // Fire-and-forget so the response isn't blocked on delivery.
  let emailed = 0;
  if (emailConfigured()) {
    for (const tgt of emailTargets) {
      emailed++;
      sendAlert([tgt.email], {
        title: `Action needed: ${tgt.count} training${tgt.count === 1 ? "" : "s"} overdue`,
        meta: `You have ${tgt.count} required training${tgt.count === 1 ? "" : "s"} to complete`,
        linkKind: "training", linkRef: "queue", company,
      }).catch(() => {});
    }
  }
  res.json({ ok: true, reminded, emailed });
});
app.post("/api/triage", auth, (req, res) => {
  const { siteId, outcome, stepsCompleted, notified, linkedIncidentId } = req.body || {};
  const tstmt = db.prepare(`INSERT INTO triage_records (tenant_id, ref, responder_id, site_id, outcome, steps_completed, notified, linked_incident_id)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  const { ref, result: r } = refInsert("TRG", "triage_records", req.auth.tenant, (newRef) =>
    tstmt.run(req.auth.tenant, newRef, req.auth.uid, siteId ?? null, outcome ?? null,
              JSON.stringify(stepsCompleted ?? []), JSON.stringify(notified ?? []), linkedIncidentId ?? null));
  res.json({ id: r.lastInsertRowid, ref });
});

// ── Dashboard summary (per-site rollup for admin dashboards) ─────────────────
app.get("/api/dashboard/summary", auth, requireRole(...CAN_SEE_ALL_INCIDENTS), (req, res) => {
  const t = req.auth.tenant;
  // Scoping the site list scopes every rollup below it.
  const scope = siteScope(req);
  const sites = scope === null
    ? db.prepare("SELECT * FROM sites WHERE tenant_id = ? AND active = 1").all(t)
    : db.prepare("SELECT * FROM sites WHERE tenant_id = ? AND active = 1 AND id = ?").all(t, scope);
  const summary = sites.map(site => {
    const staff = db.prepare("SELECT COUNT(*) n FROM users WHERE tenant_id = ? AND site_id = ? AND active = 1").get(t, site.id).n;
    const openIncidents = db.prepare("SELECT COUNT(*) n FROM incidents WHERE tenant_id = ? AND site_id = ? AND status != 'closed'").get(t, site.id).n;
    const openCAs = db.prepare(`SELECT COUNT(*) n FROM corrective_actions c
                                JOIN incidents i ON i.id = c.incident_id
                                WHERE c.tenant_id = ? AND i.site_id = ? AND c.status NOT IN ('done','verified','capex_blocked')`).get(t, site.id).n;
    const criticalFindings = db.prepare("SELECT COUNT(*) n FROM findings WHERE tenant_id = ? AND site_id = ? AND status = 'open' AND severity IN ('high','critical')").get(t, site.id).n;
    // CapEx-blocked CAs are legitimately open (awaiting budget) but must NOT read
    // as overdue/lingering — surface them separately so the number is honest.
    const capexBlocked = db.prepare(`SELECT COUNT(*) n FROM corrective_actions c
                                     LEFT JOIN incidents i ON i.id = c.incident_id
                                     WHERE c.tenant_id = ? AND i.site_id = ? AND c.status = 'capex_blocked'`).get(t, site.id).n;
    const lastIncident = db.prepare("SELECT MAX(created_at) d FROM incidents WHERE tenant_id = ? AND site_id = ?").get(t, site.id).d;
    const daysSince = lastIncident ? Math.floor((Date.now() - new Date(lastIncident).getTime()) / 86400000) : 999;
    // Compliance: % of active site staff who are fully current on every required training
    // (expiry-aware, same definition as the per-user report — see staffCompliance()).
    const siteRows = staffCompliance(t, site.id);
    const fullyCompliant = siteRows.filter(r => r.total === 0 || r.current === r.total).length;
    const compliance = siteRows.length > 0 ? Math.round((fullyCompliant / siteRows.length) * 100) : 100;
    return { name: site.name, location: site.location, staff, daysSince, compliance,
             openIncidents, openCAs, criticalFindings, capexBlocked };
  });
  res.json(summary);
});


// ── Notifications ─────────────────────────────────────────────────────────────
// Notify an explicit list of users directly (not via event rules). Used for
// group assignment — everyone in the assigned department gets the alert. In-app
// always; email when configured. Best-effort; never throws into the caller.
function notifyUsers(tenantId, userIds, { title, body, linkKind, linkRef, email = true }) {
  try {
    const ids = [...new Set((userIds || []).filter(Boolean))];
    if (!ids.length) return { count: 0, email: false };
    const stmt = db.prepare(`INSERT INTO notifications (tenant_id, user_id, title, body, link_kind, link_ref, emailed)
                             VALUES (?, ?, ?, ?, ?, ?, ?)`);
    ids.forEach(uid => stmt.run(tenantId, uid, title, body ?? null, linkKind ?? null, linkRef ?? null, email ? 1 : 0));
    let emailQueued = false;
    if (email && emailConfigured()) {
      const emails = db.prepare(`SELECT email FROM users WHERE tenant_id = ? AND active = 1 AND id IN (${ids.map(() => "?").join(",")})`)
        .all(tenantId, ...ids).map(u => u.email).filter(Boolean);
      if (emails.length) {
        emailQueued = true;
        const company = db.prepare("SELECT name FROM tenants WHERE id = ?").get(tenantId)?.name;
        sendAlert(emails, { title, meta: body, linkKind, linkRef, company }).catch(err => console.error("sendAlert threw:", err.message));
      }
    }
    return { count: ids.length, email: emailQueued };
  } catch (e) { console.error("notifyUsers() failed:", e.message); return null; }
}

// Severity ordering for threshold comparison. A rule with min_severity "serious"
// fires for serious AND critical; "any" fires for everything.
const SEVERITY_RANK = { any: 0, minor: 1, significant: 2, serious: 3, critical: 4 };

function ruleMatches(rule, match) {
  // match = { category, severity }. A rule matches when its category is "any" or
  // equals the incident category, AND the incident severity meets the rule's
  // minimum. Engagement reports have no severity → treated as rank 0 ("any").
  const catOk = !rule.category || rule.category === "any" || rule.category === match.category;
  const ruleMin = SEVERITY_RANK[rule.min_severity || "any"] ?? 0;
  const evtRank = SEVERITY_RANK[match.severity || "any"] ?? 0;
  return catOk && evtRank >= ruleMin;
}

function notify(tenantId, events, { title, body, linkKind, linkRef, match }) {
  try {
    const allRules = db.prepare(`SELECT * FROM notification_rules WHERE tenant_id = ? AND active = 1`).all(tenantId);
    // Two matching paths: the new category×severity matrix (when `match` is given,
    // i.e. an incident/engagement), and the legacy event-string path (findings).
    const rules = match
      ? allRules.filter(r => ruleMatches(r, match))
      : allRules.filter(r => events.includes(r.event));
    if (!rules.length) return { count: 0, email: false, events: [] };
    const recipients = new Set();
    let wantsEmail = false;
    for (const r of rules) {
      if (r.email) wantsEmail = true;
      JSON.parse(r.recipient_users || "[]").forEach(id => recipients.add(id));
      const roles = JSON.parse(r.recipient_roles || "[]");
      if (roles.length)
        db.prepare(`SELECT id FROM users WHERE tenant_id = ? AND active = 1 AND role IN (${roles.map(() => "?").join(",")})`)
          .all(tenantId, ...roles).forEach(u => recipients.add(u.id));
    }
    const stmt = db.prepare(`INSERT INTO notifications (tenant_id, user_id, title, body, link_kind, link_ref, emailed)
                             VALUES (?, ?, ?, ?, ?, ?, ?)`);
    recipients.forEach(uid => stmt.run(tenantId, uid, title, body ?? null, linkKind ?? null, linkRef ?? null, wantsEmail ? 1 : 0));
    let emailQueued = false;
    if (wantsEmail && recipients.size && emailConfigured()) {
      const emails = db.prepare(`SELECT email FROM users WHERE id IN (${[...recipients].map(() => "?").join(",")})`)
        .all(...recipients).map(u => u.email).filter(Boolean);
      if (emails.length) {
        emailQueued = true;
        // Fire-and-forget: a slow or failing mail provider must never delay or
        // roll back the incident that triggered it.
        const company = db.prepare("SELECT name FROM tenants WHERE id = ?").get(tenantId)?.name;
        sendAlert(emails, { title, meta: body, linkKind, linkRef, company }).catch(err => console.error("sendAlert threw:", err.message));
      }
    }
    return { count: recipients.size, email: emailQueued, events: [...new Set(rules.map(r => r.event))] };
  } catch (e) { console.error("notify() failed:", e.message); return null; }
}

app.get("/api/notifications", auth, (req, res) =>
  res.json(db.prepare(`SELECT * FROM notifications WHERE tenant_id = ? AND user_id = ?
                       ORDER BY created_at DESC LIMIT 50`).all(req.auth.tenant, req.auth.uid)));
app.put("/api/notifications/read", auth, (req, res) => {
  const ids = req.body?.ids;
  if (Array.isArray(ids) && ids.length)
    db.prepare(`UPDATE notifications SET read = 1 WHERE tenant_id = ? AND user_id = ? AND id IN (${ids.map(() => "?").join(",")})`)
      .run(req.auth.tenant, req.auth.uid, ...ids);
  else
    db.prepare("UPDATE notifications SET read = 1 WHERE tenant_id = ? AND user_id = ?").run(req.auth.tenant, req.auth.uid);
  res.json({ ok: true });
});

app.get("/api/notification-rules", auth, requireRole(...ADMINISH), (req, res) =>
  res.json(db.prepare("SELECT * FROM notification_rules WHERE tenant_id = ? AND active = 1").all(req.auth.tenant)));
app.post("/api/notification-rules", auth, requireRole(...ADMINISH), (req, res) => {
  const { event, category, minSeverity, recipientRoles, recipientUsers, email } = req.body || {};
  // New rules use category × severity; keep a synthetic event string for back-compat
  // with any code still reading `event`.
  const cat = category || "any";
  const sev = minSeverity || "any";
  const evt = event || (cat === "engagement" ? "engagement_any" : "incident_any");
  const r = db.prepare("INSERT INTO notification_rules (tenant_id, event, category, min_severity, recipient_roles, recipient_users, email) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(req.auth.tenant, evt, cat, sev, JSON.stringify(recipientRoles ?? []), JSON.stringify(recipientUsers ?? []), email ? 1 : 0);
  res.json({ id: r.lastInsertRowid });
});
app.delete("/api/notification-rules/:id", auth, requireRole(...ADMINISH), (req, res) => {
  db.prepare("UPDATE notification_rules SET active = 0 WHERE id = ? AND tenant_id = ?").run(req.params.id, req.auth.tenant);
  res.json({ ok: true });
});

// ── Operator console (EHS DNA staff only) ────────────────────────────────────
// Operator-only: send a test email to confirm the provider is wired up correctly.
// GET /api/op/email-test?to=you@example.com
// Operator-only: run the reminder sweeps on demand (rather than waiting for the
// twice-daily interval). Useful for verifying reminders after setup.
app.post("/api/op/run-reminders", auth, requireOperator, (req, res) => {
  runCAReminders();
  runTrainingReminders();
  res.json({ ok: true, ran: ["ca", "training"] });
});

app.get("/api/op/email-test", auth, requireOperator, async (req, res) => {
  const to = String(req.query.to || req.auth.email || "").trim();
  if (!to) return res.status(400).json({ error: "pass ?to=an@email.com" });
  if (!emailConfigured())
    return res.status(400).json({ error: "No email transport configured. Set RESEND_API_KEY (or EHS_EMAIL_WEBHOOK) and restart." });
  const result = await sendAlert([to], {
    title: "EHS DNA — test alert",
    meta: "This is a test. If you received it, transactional email is working.",
    linkKind: null, linkRef: null,
  });
  res.status(result.sent ? 200 : 502).json(result);
});

// Operator: read a tenant's module enablement (registry + this tenant's state).
app.get("/api/op/tenants/:id/modules", auth, requireOperator, (req, res) => {
  const tid = parseInt(req.params.id, 10);
  const rows = db.prepare("SELECT module, enabled FROM tenant_modules WHERE tenant_id = ?").all(tid);
  const explicit = new Map(rows.map(r => [r.module, r.enabled === 1]));
  const modules = LIVE_MODULES.map(key => ({
    key, label: MODULES[key].label, blurb: MODULES[key].blurb,
    softDeps: MODULES[key].softDeps || [],
    enabled: explicit.has(key) ? explicit.get(key) : (MODULES[key].default !== false),
    explicit: explicit.has(key),
  }));
  // Reserved-but-unbuilt modules, surfaced so the grid can show "coming soon".
  const reserved = Object.keys(MODULES)
    .filter(k => MODULES[k].reserved)
    .map(k => ({ key: k, label: MODULES[k].label, blurb: MODULES[k].blurb, reserved: true }));
  res.json({ modules, reserved });
});

// Operator: enable/disable a module for a tenant.
app.put("/api/op/tenants/:id/modules/:module", auth, requireOperator, (req, res) => {
  const tid = parseInt(req.params.id, 10);
  const mod = req.params.module;
  if (!LIVE_MODULES.includes(mod)) return res.status(400).json({ error: "Unknown or non-toggleable module" });
  const enabled = req.body?.enabled ? 1 : 0;
  db.prepare(`INSERT INTO tenant_modules (tenant_id, module, enabled) VALUES (?, ?, ?)
              ON CONFLICT(tenant_id, module) DO UPDATE SET enabled = excluded.enabled, updated_at = datetime('now')`)
    .run(tid, mod, enabled);
  res.json({ ok: true, module: mod, enabled: !!enabled });
});

app.get("/api/op/tenants", auth, requireOperator, (req, res) => {
  const tenants = db.prepare("SELECT * FROM tenants ORDER BY id").all();
  res.json(tenants.map(t => {
    const sites = db.prepare("SELECT COUNT(*) n FROM sites WHERE tenant_id = ? AND active = 1").get(t.id).n;
    const users = db.prepare("SELECT COUNT(*) n FROM users WHERE tenant_id = ? AND active = 1 AND is_operator = 0").get(t.id).n;
    const cfg = db.prepare("SELECT base_price, per_site, per_user, auto_approve FROM billing_config WHERE tenant_id = ?").get(t.id);
    const lastInv = db.prepare("SELECT ref, period, status, total FROM invoices WHERE tenant_id = ? ORDER BY period DESC LIMIT 1").get(t.id);
    const est = cfg ? Math.round((cfg.base_price + sites * cfg.per_site + users * cfg.per_user) * 100) / 100 : null;
    return { id: t.id, name: t.name, industry: t.industry, created: t.created_at, active: t.active !== 0,
             suspensionReason: t.active === 0 ? (t.suspension_reason || "other") : null,
             sites, users, billing: cfg ?? null, estMonthly: est, lastInvoice: lastInv ?? null };
  }));
});

app.post("/api/op/users/:id/reset-password", auth, requireOperator, (req, res) => {
  const bcrypt2 = require("bcryptjs");
  const user = db.prepare("SELECT id FROM users WHERE id = ?").get(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  const tempPassword = Math.random().toString(36).slice(2, 10) + "!A1";
  db.prepare("UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?").run(bcrypt2.hashSync(tempPassword, 10), user.id);
  res.json({ tempPassword });
});

app.put("/api/op/tenants/:id/status", auth, requireOperator, (req, res) => {
  const active = req.body?.active ? 1 : 0;
  // reason only meaningful when suspending; cleared on reactivation
  const reason = active ? null : (["billing", "other"].includes(req.body?.reason) ? req.body.reason : "other");
  db.prepare("UPDATE tenants SET active = ?, suspension_reason = ? WHERE id = ?").run(active, reason, req.params.id);
  res.json({ ok: true });
});

app.post("/api/op/tenants", auth, requireOperator, (req, res) => {
  const { name, industry, adminEmail, adminName } = req.body || {};
  if (!name || !adminEmail) return res.status(400).json({ error: "name and adminEmail required" });
  const bcrypt2 = require("bcryptjs");
  const tempPassword = Math.random().toString(36).slice(2, 10) + "!A1";
  try {
    const tx = db.transaction(() => {
      const tr = db.prepare(`INSERT INTO tenants (name, industry, tagline, triage_enabled)
                             VALUES (?, ?, 'Safety & Operations Management', 0)`).run(name, industry ?? null);
      const tid = tr.lastInsertRowid;
      db.prepare(`INSERT INTO users (tenant_id, email, password_hash, name, role, must_change_password)
                  VALUES (?, ?, ?, ?, 'admin', 1)`)
        .run(tid, String(adminEmail).toLowerCase().trim(), bcrypt2.hashSync(tempPassword, 10), adminName ?? "Admin");
      db.prepare(`INSERT INTO billing_config (tenant_id, base_price, per_site, per_user, auto_approve)
                  VALUES (?, 250, 75, 8, 0)`).run(tid);
      db.prepare(`INSERT INTO notification_rules (tenant_id, event, category, min_severity, recipient_roles, email)
                  VALUES (?, 'incident_injury', 'injury', 'any', '["admin","safety"]', 1)`).run(tid);
      // Safety sees engagement reports (observations, positive callouts, ideas) in
      // app, without the email alarm — these are culture signal, not emergencies.
      db.prepare(`INSERT INTO notification_rules (tenant_id, event, category, min_severity, recipient_roles, email)
                  VALUES (?, 'engagement_any', 'engagement', 'any', '["admin","safety"]', 0)`).run(tid);
      const rc = db.prepare("INSERT INTO response_checklists (tenant_id, incident_type, items) VALUES (?, ?, ?)");
      rc.run(tid, "injury", JSON.stringify(["Complete first aid log", "Notify shift supervisor",
        "Preserve scene until photos are done", "Secure the area if hazard still present",
        "Check in with the injured person within 24 hours"]));
      // Seed explicit module rows from the registry defaults, so the operator's
      // module grid starts from a concrete, editable state rather than implicit
      // defaults. New tenants get every live module on by default.
      const modStmt = db.prepare(`INSERT INTO tenant_modules (tenant_id, module, enabled) VALUES (?, ?, ?)
                                  ON CONFLICT(tenant_id, module) DO NOTHING`);
      for (const key of LIVE_MODULES) modStmt.run(tid, key, MODULES[key].default !== false ? 1 : 0);
      return tid;
    });
    const tenantId = tx();
    res.json({ tenantId, adminEmail, tempPassword });
  } catch (e) {
    res.status(409).json({ error: "Admin email already exists" });
  }
});

app.put("/api/op/tenants/:id", auth, requireOperator, (req, res) => {
  const { active } = req.body || {};
  db.prepare("UPDATE tenants SET active = COALESCE(?, active) WHERE id = ?").run(active, req.params.id);
  res.json({ ok: true });
});

app.get("/api/op/tenants/:id/users", auth, requireOperator, (req, res) =>
  res.json(db.prepare(`SELECT u.id, u.email, u.name, u.role, u.active, s.name AS site
                       FROM users u LEFT JOIN sites s ON s.id = u.site_id
                       WHERE u.tenant_id = ? AND u.is_operator = 0 ORDER BY u.name`).all(req.params.id)));

app.post("/api/op/users/:id/reset", auth, requireOperator, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  const tempPassword = Math.random().toString(36).slice(2, 10) + "!A1";
  db.prepare("UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?").run(bcrypt.hashSync(tempPassword, 10), user.id);
  res.json({ email: user.email, tempPassword });
});

app.post("/api/op/impersonate", auth, requireOperator, (req, res) => {
  const tenant = db.prepare("SELECT * FROM tenants WHERE id = ?").get(req.body?.tenantId);
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });
  const token = jwt.sign(
    { uid: req.auth.uid, tenant: tenant.id, role: "admin", name: `${req.auth.name} (support)`, op: true },
    SECRET, { expiresIn: "4h" }
  );
  res.json({ token, user: { id: req.auth.uid, name: `EHS DNA Support`, role: "admin",
                            site: null, siteId: null, isOperator: true, supportTenant: tenant.name } });
});

// ── Reports: monthly incident summary (real data; hours estimated from headcount) ─
// ── Labor hours (actual payroll hours per site per month, for accurate TRIR) ──
app.get("/api/labor-hours", auth, (req, res) => {
  const rows = db.prepare("SELECT site_id, month, hours FROM labor_hours WHERE tenant_id = ?").all(req.auth.tenant);
  res.json(rows);
});

app.put("/api/labor-hours/bulk", auth, requireRole(...ADMINISH, "site_manager"), (req, res) => {
  const entries = Array.isArray(req.body?.entries) ? req.body.entries : null;
  if (!entries) return res.status(400).json({ error: "entries array required" });
  const upsert = db.prepare(`INSERT INTO labor_hours (tenant_id, site_id, month, hours) VALUES (?, ?, ?, ?)
              ON CONFLICT(tenant_id, site_id, month) DO UPDATE SET hours = ?, updated_at = datetime('now')`);
  const del = db.prepare("DELETE FROM labor_hours WHERE tenant_id = ? AND site_id = ? AND month = ?");
  let applied = 0, skipped = 0;
  const tx = db.transaction(() => {
    for (const e of entries) {
      const siteId = e?.siteId, month = e?.month, h = Number(e?.hours);
      if (!siteId || !/^\d{4}-\d{2}$/.test(String(month || "")) || !Number.isFinite(h) || h < 0) { skipped++; continue; }
      if (h === 0) del.run(req.auth.tenant, siteId, month);
      else upsert.run(req.auth.tenant, siteId, month, h, h);
      applied++;
    }
  });
  tx();
  res.json({ ok: true, applied, skipped });
});

app.put("/api/labor-hours", auth, requireRole(...ADMINISH, "site_manager"), (req, res) => {
  const { siteId, month, hours } = req.body || {};
  if (!siteId || !/^\d{4}-\d{2}$/.test(String(month || "")))
    return res.status(400).json({ error: "siteId and month (YYYY-MM) required" });
  const h = Number(hours);
  if (!Number.isFinite(h) || h < 0) return res.status(400).json({ error: "hours must be a non-negative number" });
  if (h === 0) {
    db.prepare("DELETE FROM labor_hours WHERE tenant_id = ? AND site_id = ? AND month = ?")
      .run(req.auth.tenant, siteId, month);
  } else {
    db.prepare(`INSERT INTO labor_hours (tenant_id, site_id, month, hours) VALUES (?, ?, ?, ?)
                ON CONFLICT(tenant_id, site_id, month) DO UPDATE SET hours = ?, updated_at = datetime('now')`)
      .run(req.auth.tenant, siteId, month, h, h);
  }
  res.json({ ok: true });
});

app.get("/api/reports/incident-summary", auth, requireRole(...CAN_SEE_ALL_INCIDENTS), (req, res) => {
  const t = req.auth.tenant;
  const rows = db.prepare(`SELECT strftime('%Y-%m', COALESCE(occurred_at, created_at)) AS ym,
                                  site_id, type, osha_classification, COUNT(*) n
                           FROM incidents WHERE tenant_id = ?
                           GROUP BY ym, site_id, type, osha_classification`).all(t);
  const scope = siteScope(req);
  const sites = scope === null
    ? db.prepare("SELECT id, name FROM sites WHERE tenant_id = ? AND active = 1").all(t)
    : db.prepare("SELECT id, name FROM sites WHERE tenant_id = ? AND active = 1 AND id = ?").all(t, scope);
  const headcount = Object.fromEntries(sites.map(s => [s.id,
    db.prepare("SELECT COUNT(*) n FROM users WHERE tenant_id = ? AND site_id = ? AND active = 1 AND is_operator = 0").get(t, s.id).n]));
  // Actual payroll hours override the headcount estimate where entered
  const actualRows = db.prepare("SELECT site_id, month, hours FROM labor_hours WHERE tenant_id = ?").all(t);
  const actualHours = {}; // `${siteId}|${ym}` -> hours
  actualRows.forEach(r => { actualHours[`${r.site_id}|${r.month}`] = r.hours; });
  // 24 calendar months so the report can show a prior-year comparison for each of the last 12
  const months = [];
  const d = new Date(); d.setDate(1);
  for (let i = 23; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    months.push(m.toISOString().slice(0, 7));
  }
  const isRecordable = isRecordableClass;
  let anyEstimated = false, anyActual = false;
  const out = months.map(ym => {
    const monthRows = rows.filter(r => r.ym === ym);
    const perSite = sites.map(s => {
      const siteRows = monthRows.filter(r => r.site_id === s.id);
      const actual = actualHours[`${s.id}|${ym}`];
      const hoursActual = actual !== undefined;
      if (hoursActual) anyActual = true; else anyEstimated = true;
      return { siteId: s.id, site: s.name,
               incidents:   siteRows.reduce((n, r) => n + r.n, 0),
               injuries:    siteRows.filter(r => r.type === "injury").reduce((n, r) => n + r.n, 0),
               recordables: siteRows.filter(r => isRecordable(r.osha_classification)).reduce((n, r) => n + r.n, 0),
               estHours: hoursActual ? actual : (headcount[s.id] ?? 0) * 160,
               hoursActual };
    });
    return { month: ym,
             incidents:   perSite.reduce((n, s) => n + s.incidents, 0),
             injuries:    perSite.reduce((n, s) => n + s.injuries, 0),
             recordables: perSite.reduce((n, s) => n + s.recordables, 0),
             estHours: perSite.reduce((n, s) => n + s.estHours, 0),
             sites: perSite };
  });
  const hoursNote = anyEstimated
    ? (anyActual ? "Some periods use actual payroll hours; others estimated from headcount × 160/mo."
                 : "Hours estimated from active headcount × 160/mo — enter payroll hours for audit-grade TRIR.")
    : "Hours from entered payroll data.";
  res.json({ months: out, hoursNote });
});

// ── Findings + training compliance summary (real data for the report tabs) ───
// The report builder's Findings and Training tabs used to show hardcoded numbers;
// this endpoint backs them with the tenant's actual records. `months` (default 1)
// scopes the "this period" counts to a trailing window; lifetime/open counts are
// point-in-time.
app.get("/api/reports/program-summary", auth, requireRole(...CAN_SEE_ALL_INCIDENTS), (req, res) => {
  const t = req.auth.tenant;
  const months = Math.max(1, Math.min(24, parseInt(req.query.months, 10) || 1));
  const since = `datetime('now','-${months} months')`;
  const scope = siteScope(req);
  const siteClause = scope === null ? "" : ` AND site_id = ${Number(scope)}`;

  // Findings — bucketed by severity + status, plus new/resolved in the window.
  const f = db.prepare(`
    SELECT
      SUM(CASE WHEN created_at > ${since} THEN 1 ELSE 0 END) AS newInPeriod,
      SUM(CASE WHEN status='open' AND severity IN ('critical') THEN 1 ELSE 0 END) AS critical,
      SUM(CASE WHEN status='open' AND severity IN ('high','major') THEN 1 ELSE 0 END) AS major,
      SUM(CASE WHEN status='open' AND severity IN ('medium','low') THEN 1 ELSE 0 END) AS minorOpen,
      SUM(CASE WHEN status='resolved' AND resolved_at > ${since} THEN 1 ELSE 0 END) AS resolvedInPeriod,
      SUM(CASE WHEN status='open' THEN 1 ELSE 0 END) AS totalOpen
    FROM findings WHERE tenant_id = ?${siteClause}`).get(t);

  // CapEx-blocked corrective actions (that's where the capex state lives).
  const capex = db.prepare(`SELECT COUNT(*) n FROM corrective_actions
    WHERE tenant_id = ? AND status = 'capex_blocked'`).get(t).n;

  // Training compliance — latest completion per active staff × active required
  // training; overdue = expired or never completed. Compliance = current / required.
  const staff = db.prepare(`SELECT id FROM users WHERE tenant_id = ? AND active = 1 AND is_operator = 0`).all(t).map(u => u.id);
  const requiredTrainings = db.prepare(`SELECT id, required_roles, required_departments FROM trainings
    WHERE tenant_id = ? AND active = 1`).all(t);
  // Simple model: every active required training applies to every active staffer.
  // (Role/dept targeting can refine this later; the point is real, not seeded.)
  const requiredCount = staff.length * requiredTrainings.length;
  let current = 0, overdue = 0;
  const latest = db.prepare(`SELECT expires_at FROM training_completions
    WHERE tenant_id = ? AND user_id = ? AND training_id = ?
    ORDER BY id DESC LIMIT 1`);
  for (const uid of staff) {
    for (const tr of requiredTrainings) {
      const c = latest.get(t, uid, tr.id);
      if (!c) { overdue++; continue; }                 // never completed
      if (c.expires_at && new Date(c.expires_at) < new Date()) overdue++;  // expired
      else current++;
    }
  }
  const compliancePct = requiredCount > 0 ? Math.round((current / requiredCount) * 100) : null;
  const completionsInPeriod = db.prepare(`SELECT COUNT(*) n FROM training_completions
    WHERE tenant_id = ? AND completed_at > ${since}`).get(t).n;
  const expiringSoon = db.prepare(`SELECT COUNT(*) n FROM training_completions tc
    WHERE tc.tenant_id = ? AND tc.expires_at IS NOT NULL
      AND tc.expires_at > datetime('now') AND tc.expires_at < datetime('now','+30 days')
      AND tc.id IN (SELECT MAX(id) FROM training_completions GROUP BY user_id, training_id)`).get(t).n;
  // Staff with at least one overdue/missing required training.
  const staffWithOverdue = (() => {
    let n = 0;
    for (const uid of staff) {
      let bad = false;
      for (const tr of requiredTrainings) {
        const c = latest.get(t, uid, tr.id);
        if (!c || (c.expires_at && new Date(c.expires_at) < new Date())) { bad = true; break; }
      }
      if (bad) n++;
    }
    return n;
  })();

  res.json({
    findings: {
      newInPeriod: f.newInPeriod || 0,
      critical: f.critical || 0,
      major: f.major || 0,
      minorOpen: f.minorOpen || 0,
      resolvedInPeriod: f.resolvedInPeriod || 0,
      totalOpen: f.totalOpen || 0,
      capexBlocked: capex,
    },
    training: {
      compliancePct,                       // null when no required trainings configured
      staffWithOverdue,
      completionsInPeriod,
      expiringSoon,
      requiredCount,
    },
  });
});

// Maps our recordable classifications onto the 300's case-classification columns.
// The 300 log is per-case; the 300A is the annual totals establishments must post
// Feb 1–Apr 30. Recordability is driven by the (safety-confirmed) osha_classification
// — provisional "Review: likely recordable" is NOT counted, so the log matches the
// formal determinations, never the suggestions.
const OSHA_300_MAP = {
  "Recordable – Fatality":            { col: "death",      injuryColumn: "injury" },
  "Recordable – Days away from work": { col: "days_away",  injuryColumn: "injury" },
  "Recordable – Restricted work":     { col: "restricted", injuryColumn: "injury" },
  "Recordable – Medical treatment":   { col: "other",      injuryColumn: "injury" },
  "Recordable – First aid only":      { col: "other",      injuryColumn: "injury" },
};
const isOsha300Recordable = (c) => Object.prototype.hasOwnProperty.call(OSHA_300_MAP, c || "");

function osha300Rows(tenantId, year, scope) {
  // Cases whose occurred/created date falls in the calendar year AND are recordable.
  const rows = db.prepare(`SELECT i.ref, i.type, i.description, i.location_detail, i.involved,
                                  i.department, i.osha_classification, i.occurred_at, i.created_at,
                                  s.name AS site_name, s.id AS site_id
                           FROM incidents i LEFT JOIN sites s ON s.id = i.site_id
                           WHERE i.tenant_id = ?`).all(tenantId);
  return rows
    .filter(r => isOsha300Recordable(r.osha_classification))
    .filter(r => (String(r.occurred_at || r.created_at || "")).slice(0, 4) === String(year))
    .filter(r => scope === null || r.site_id === scope)
    .map(r => {
      let names = "";
      try { const inv = JSON.parse(r.involved || "[]"); names = inv.map(p => p.name || p).filter(Boolean).join(", "); } catch {}
      const m = OSHA_300_MAP[r.osha_classification];
      return {
        caseNo: r.ref,
        employee: names || "—",
        jobTitle: r.department || "—",
        date: (r.occurred_at || r.created_at || "").slice(0, 10),
        site: r.site_name || "—",
        location: r.location_detail || "—",
        description: r.description || "—",
        classification: m.col,        // death | days_away | restricted | other
        injuryType: m.injuryColumn,   // injury | illness (we only capture injury today)
      };
    });
}

// Real findings-summary + training-compliance for the Report Builder's Findings
// and Training tabs (previously hardcoded). Optional ?period=YYYY-MM scopes the
// period-specific counts; lifetime/current counts ignore it.
app.get("/api/reports/findings-training", auth, requireRole(...CAN_SEE_ALL_INCIDENTS), (req, res) => {
  const t = req.auth.tenant;
  const period = /^\d{4}-\d{2}$/.test(req.query.period || "") ? req.query.period : null;
  const monthClause = period ? "AND strftime('%Y-%m', created_at) = ?" : "";
  const pArgs = period ? [period] : [];

  // Findings — severity is one of low|medium|high|critical; status open|resolved.
  const fNew = db.prepare(`SELECT COUNT(*) n FROM findings WHERE tenant_id=? ${monthClause}`).get(t, ...pArgs).n;
  const fCritical = db.prepare(`SELECT COUNT(*) n FROM findings WHERE tenant_id=? AND severity='critical' ${monthClause}`).get(t, ...pArgs).n;
  const fHigh = db.prepare(`SELECT COUNT(*) n FROM findings WHERE tenant_id=? AND severity='high' ${monthClause}`).get(t, ...pArgs).n;
  const fOpen = db.prepare(`SELECT COUNT(*) n FROM findings WHERE tenant_id=? AND status='open'`).get(t).n;
  const fResolved = period
    ? db.prepare(`SELECT COUNT(*) n FROM findings WHERE tenant_id=? AND status='resolved' AND strftime('%Y-%m', resolved_at)=?`).get(t, period).n
    : db.prepare(`SELECT COUNT(*) n FROM findings WHERE tenant_id=? AND status='resolved'`).get(t).n;

  // Training compliance — for each active staff user × each active training that
  // applies, the latest completion; overall compliance = current (not expired) ÷ required.
  const overdue = db.prepare(`SELECT COUNT(*) n FROM training_completions tc
      JOIN trainings tr ON tr.id = tc.training_id AND tr.active = 1
      JOIN users u ON u.id = tc.user_id AND u.active = 1 AND u.is_operator = 0
      WHERE tc.tenant_id=? AND tc.expires_at IS NOT NULL AND tc.expires_at < datetime('now')
        AND tc.id IN (SELECT MAX(id) FROM training_completions GROUP BY user_id, training_id)`).get(t).n;
  const current = db.prepare(`SELECT COUNT(*) n FROM training_completions tc
      JOIN trainings tr ON tr.id = tc.training_id AND tr.active = 1
      JOIN users u ON u.id = tc.user_id AND u.active = 1 AND u.is_operator = 0
      WHERE tc.tenant_id=? AND (tc.expires_at IS NULL OR tc.expires_at >= datetime('now'))
        AND tc.id IN (SELECT MAX(id) FROM training_completions GROUP BY user_id, training_id)`).get(t).n;
  const totalLatest = current + overdue;
  const compliancePct = totalLatest > 0 ? Math.round((current / totalLatest) * 100) : null;
  const completionsThisPeriod = db.prepare(`SELECT COUNT(*) n FROM training_completions
      WHERE tenant_id=? ${period ? "AND strftime('%Y-%m', completed_at)=?" : ""}`).get(t, ...pArgs).n;
  const expiringSoon = db.prepare(`SELECT COUNT(*) n FROM training_completions tc
      WHERE tc.tenant_id=? AND tc.expires_at IS NOT NULL
        AND tc.expires_at >= datetime('now') AND tc.expires_at < datetime('now','+30 days')
        AND tc.id IN (SELECT MAX(id) FROM training_completions GROUP BY user_id, training_id)`).get(t).n;

  res.json({
    findings: { new: fNew, critical: fCritical, high: fHigh, open: fOpen, resolvedInPeriod: fResolved },
    training: { compliancePct, overdue, completionsThisPeriod, expiringSoon },
  });
});

app.get("/api/reports/osha300", auth, requireRole(...CAN_SEE_ALL_INCIDENTS), (req, res) => {
  const t = req.auth.tenant;
  const year = String(req.query.year || new Date().getFullYear());
  const scope = siteScope(req);
  const cases = osha300Rows(t, year, scope);

  if (req.query.format === "csv") {
    const esc = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = ["Case No.", "Employee", "Job Title", "Date", "Establishment", "Location",
      "Description", "Death", "Days Away", "Restricted/Transfer", "Other Recordable", "Type"];
    const lines = [header.map(esc).join(",")];
    for (const c of cases) {
      lines.push([
        c.caseNo, c.employee, c.jobTitle, c.date, c.site, c.location, c.description,
        c.classification === "death" ? "X" : "",
        c.classification === "days_away" ? "X" : "",
        c.classification === "restricted" ? "X" : "",
        c.classification === "other" ? "X" : "",
        c.injuryType,
      ].map(esc).join(","));
    }
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="OSHA-300-${year}.csv"`);
    return res.send(lines.join("\r\n"));
  }

  // 300A annual summary totals.
  const totals = { death: 0, days_away: 0, restricted: 0, other: 0, injuries: 0, illnesses: 0 };
  for (const c of cases) {
    totals[c.classification]++;
    if (c.injuryType === "illness") totals.illnesses++; else totals.injuries++;
  }
  res.json({ year, cases, summary: {
    totalCases: cases.length,
    deaths: totals.death, daysAwayCases: totals.days_away,
    restrictedCases: totals.restricted, otherRecordableCases: totals.other,
    totalInjuries: totals.injuries, totalIllnesses: totals.illnesses,
  }, note: "Recordable cases only, per safety-confirmed OSHA classification. Days-away/restricted day counts and injury-vs-illness detail are not yet captured per case — add them for a fully audit-grade log." });
});

// ── Training due-date reminders (runs at boot + every 12h) ───────────────────
function runTrainingReminders() {
  try {
    const soonMs = 14 * 86400000;
    const rows = db.prepare(`
      SELECT c.user_id, c.training_id, c.expires_at, t.title, t.tenant_id,
             u.active AS user_active, u.is_operator
      FROM completions c
      JOIN trainings t ON t.id = c.training_id AND t.active = 1
      JOIN users u ON u.id = c.user_id
      WHERE c.expires_at IS NOT NULL
        AND c.id IN (SELECT MAX(id) FROM completions GROUP BY user_id, training_id)
    `).all().filter(r => r.user_active && !r.is_operator);
    const now = Date.now();
    const stmt = db.prepare(`INSERT INTO notifications (tenant_id, user_id, title, body, link_kind, link_ref)
                             VALUES (?, ?, ?, ?, 'training', ?)`);
    const recent = db.prepare(`SELECT 1 FROM notifications
                               WHERE user_id = ? AND link_kind = 'training' AND link_ref = ?
                                 AND created_at > datetime('now', '-7 days') LIMIT 1`);
    let sent = 0;
    for (const r of rows) {
      const exp = new Date(r.expires_at).getTime();
      if (exp - now > soonMs) continue;
      const ref = `reminder-${r.training_id}`;
      if (recent.get(r.user_id, ref)) continue;
      const days = Math.round((exp - now) / 86400000);
      stmt.run(r.tenant_id, r.user_id,
        days < 0 ? `⚠️ Training overdue: ${r.title}` : `📚 Training expiring: ${r.title}`,
        days < 0 ? `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago — retake it from your Training queue.`
                 : `Expires in ${days} day${days === 1 ? "" : "s"} — retake it from your Training queue to stay current.`,
        ref);
      sent++;
    }
    if (sent) console.log(`Training reminders sent: ${sent}`);
  } catch (e) { console.error("Reminder run failed:", e.message); }
}
setTimeout(runTrainingReminders, 30000);
setInterval(runTrainingReminders, 12 * 3600 * 1000);

// ── Corrective-action due / overdue reminders (email + in-app) ───────────────
// Nudges the people responsible for a CA as it approaches its due date and again
// once it's overdue. Reminds the individual assignee, or every member of the
// assigned group. Skips CapEx-blocked CAs (they legitimately sit awaiting budget)
// and anything already done/verified. Deduped so we don't spam: an approaching
// reminder goes out once per 3-day window, an overdue reminder once per 3 days.
function runCAReminders() {
  try {
    const APPROACH_DAYS = 3;      // remind when due within this many days
    const now = Date.now();
    const cas = db.prepare(`
      SELECT c.id, c.tenant_id, c.title, c.due_date, c.status,
             c.assignee_id, c.assignee_dept_id, c.assignee_site_id,
             i.ref AS incident_ref
      FROM corrective_actions c
      LEFT JOIN incidents i ON i.id = c.incident_id
      WHERE c.due_date IS NOT NULL
        AND c.status NOT IN ('done','verified','capex_blocked')
    `).all();

    const recent = db.prepare(`SELECT 1 FROM notifications
                               WHERE user_id = ? AND link_kind = 'ca' AND link_ref = ?
                                 AND created_at > datetime('now', '-3 days') LIMIT 1`);
    const inApp = db.prepare(`INSERT INTO notifications (tenant_id, user_id, title, body, link_kind, link_ref, emailed)
                              VALUES (?, ?, ?, ?, 'ca', ?, ?)`);
    let sent = 0;

    for (const ca of cas) {
      const due = new Date(ca.due_date).getTime();
      if (Number.isNaN(due)) continue;
      const days = Math.round((due - now) / 86400000);
      // Only act when overdue, or due within the approach window.
      if (days > APPROACH_DAYS) continue;

      // Resolve who to remind.
      let recipients = [];
      if (ca.assignee_id) recipients = [ca.assignee_id];
      else if (ca.assignee_dept_id) recipients = groupMemberIds(ca.tenant_id, ca.assignee_dept_id, ca.assignee_site_id);
      if (!recipients.length) continue;   // nobody assigned — nothing to nudge

      const ref = `ca-${ca.id}`;
      const overdue = days < 0;
      const title = overdue
        ? `⚠️ Overdue corrective action: ${ca.title}`
        : `⏳ Corrective action due soon: ${ca.title}`;
      const body = overdue
        ? `Was due ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago${ca.incident_ref ? ` · ${ca.incident_ref}` : ""}. Please complete it or update its status.`
        : `Due in ${days} day${days === 1 ? "" : "s"}${ca.incident_ref ? ` · ${ca.incident_ref}` : ""}.`;

      // Send to each recipient not already reminded in the dedup window.
      const toEmail = [];
      for (const uid of recipients) {
        if (recent.get(uid, ref)) continue;
        const u = db.prepare("SELECT email, active, is_operator FROM users WHERE id = ? AND tenant_id = ?").get(uid, ca.tenant_id);
        if (!u || !u.active || u.is_operator) continue;
        inApp.run(ca.tenant_id, uid, title, body, ref, emailConfigured() ? 1 : 0);
        if (u.email) toEmail.push(u.email);
        sent++;
      }
      if (toEmail.length && emailConfigured()) {
        const company = db.prepare("SELECT name FROM tenants WHERE id = ?").get(ca.tenant_id)?.name;
        sendAlert(toEmail, {
          title, meta: body,
          linkKind: "incident", linkRef: ca.incident_ref ?? null, company,
        }).catch(err => console.error("CA reminder email failed:", err.message));
      }
    }
    if (sent) console.log(`CA reminders sent: ${sent}`);
  } catch (e) { console.error("CA reminder run failed:", e.message); }
}
setTimeout(runCAReminders, 45000);                 // shortly after boot, staggered from training
setInterval(runCAReminders, 12 * 3600 * 1000);     // twice daily

// ── Weekly executive digest ──────────────────────────────────────────────────
// The buyer rarely opens the app; a weekly scorecard email keeps safety posture
// visible to them. Metrics are computed from real data for one tenant.
function computeDigestMetrics(tenantId) {
  const q = (sql, ...a) => db.prepare(sql).get(tenantId, ...a)?.n ?? 0;
  const yearStart = `${new Date().getFullYear()}-01-01`;
  const reportsThisWeek = q(`SELECT COUNT(*) n FROM incidents WHERE tenant_id=? AND created_at > datetime('now','-7 days')`);
  const injuriesThisWeek = q(`SELECT COUNT(*) n FROM incidents WHERE tenant_id=? AND type='injury' AND created_at > datetime('now','-7 days')`);
  // Recordables YTD: only SAFETY-CONFIRMED "Recordable…" classifications count —
  // never the provisional "Review: likely recordable" suggestion.
  const recordablesYTD = q(`SELECT COUNT(*) n FROM incidents WHERE tenant_id=? AND created_at >= ?
                            AND osha_classification LIKE 'Recordable%'`, yearStart);
  const openCorrectiveActions = q(`SELECT COUNT(*) n FROM corrective_actions WHERE tenant_id=? AND status NOT IN ('done','verified')`);
  const overdueCorrectiveActions = q(`SELECT COUNT(*) n FROM corrective_actions WHERE tenant_id=? AND status NOT IN ('done','verified')
                                      AND due_date IS NOT NULL AND due_date < date('now')`);
  // Trainings overdue: latest completion per user×training that has expired.
  const trainingsOverdue = q(`SELECT COUNT(*) n FROM training_completions tc
      JOIN trainings t ON t.id = tc.training_id AND t.active = 1
      JOIN users u ON u.id = tc.user_id AND u.active = 1 AND u.is_operator = 0
      WHERE tc.tenant_id=? AND tc.expires_at IS NOT NULL AND tc.expires_at < datetime('now')
        AND tc.id IN (SELECT MAX(id) FROM training_completions GROUP BY user_id, training_id)`);
  const inspectionsThisWeek = q(`SELECT COUNT(*) n FROM inspections WHERE tenant_id=? AND status='complete' AND completed_at > datetime('now','-7 days')`);
  // Recognition leader this month (only if the module is on and someone has points).
  let topRecognition = null;
  if (moduleOn(tenantId, "recognition")) {
    const period = periodOf();
    const top = db.prepare(`SELECT u.name, SUM(l.points) AS pts FROM points_ledger l
        JOIN users u ON u.id = l.user_id
        WHERE l.tenant_id=? AND l.status='confirmed' AND l.period=? AND u.active=1
        GROUP BY u.id ORDER BY pts DESC LIMIT 1`).get(tenantId, period);
    if (top && top.pts > 0) topRecognition = `${top.name} (${top.pts} pts)`;
  }
  return { reportsThisWeek, injuriesThisWeek, recordablesYTD, openCorrectiveActions,
           overdueCorrectiveActions, trainingsOverdue, inspectionsThisWeek, topRecognition };
}

async function runWeeklyDigest() {
  if (!emailConfigured()) return;
  try {
    const tenants = db.prepare("SELECT id, name FROM tenants WHERE active = 1").all();
    const dedup = db.prepare(`SELECT 1 FROM notifications WHERE tenant_id=? AND link_kind='digest'
                              AND created_at > datetime('now','-6 days') LIMIT 1`);
    const markSent = db.prepare(`INSERT INTO notifications (tenant_id, user_id, title, body, link_kind, link_ref)
                                 VALUES (?, ?, 'Weekly digest sent', ?, 'digest', ?)`);
    const periodLabel = `Week of ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;
    let sentTenants = 0;
    for (const t of tenants) {
      if (dedup.get(t.id)) continue;                       // already sent this week
      const recips = db.prepare(`SELECT id, email, name FROM users
        WHERE tenant_id=? AND active=1 AND is_operator=0 AND role IN ('admin','safety') AND email IS NOT NULL`).all(t.id);
      if (!recips.length) continue;
      const metrics = computeDigestMetrics(t.id);
      for (const r of recips) {
        try { await sendDigest(r.email, { company: t.name, periodLabel, metrics }); } catch (e) { /* keep going */ }
      }
      markSent.run(t.id, recips[0].id, periodLabel, `digest-${Date.now()}`);
      sentTenants++;
    }
    if (sentTenants) console.log(`Weekly digest sent to ${sentTenants} tenant(s)`);
  } catch (e) { console.error("Weekly digest run failed:", e.message); }
}
// Check hourly; the 6-day dedup means each tenant gets exactly one per week
// regardless of restarts. First run staggered after boot.
setTimeout(runWeeklyDigest, 60000);
setInterval(runWeeklyDigest, 3600 * 1000);

// Operator: preview a tenant's digest metrics (no send) or trigger a send now.
app.get("/api/op/digest/:tenantId/preview", auth, requireOperator, (req, res) => {
  const t = db.prepare("SELECT id, name FROM tenants WHERE id = ?").get(req.params.tenantId);
  if (!t) return res.status(404).json({ error: "Tenant not found" });
  res.json({ tenant: t.name, metrics: computeDigestMetrics(t.id) });
});
app.post("/api/op/digest/run", auth, requireOperator, async (req, res) => {
  await runWeeklyDigest();
  res.json({ ok: true });
});

// ── Billing module ────────────────────────────────────────────────────────────
require("./billing.cjs")(app, db, auth, () => requireOperator);

// ── Equipment & Assets module ─────────────────────────────────────────────────
require("./equipment.cjs")(app, db, auth, requireRole, ADMINISH, { storePhoto });
require("./templates.cjs")(app, db, auth, requireOperator);

// ── Training compliance summary (per-staff rollup against required trainings) ─
// Shared compliance definition: a staff member is compliant when every required
// training has a passed, non-expired completion. Used by both the per-user report
// and the site rollup so "compliance" means the same thing everywhere.
function staffCompliance(t, siteId = null) {
  const users = db.prepare(`SELECT u.id, u.name, u.role, u.department_id, u.site_id, s.name AS site, d.name AS dept
                            FROM users u LEFT JOIN sites s ON s.id = u.site_id
                            LEFT JOIN departments d ON d.id = u.department_id
                            WHERE u.tenant_id = ? AND u.active = 1 AND u.is_operator = 0
                            ${siteId ? "AND u.site_id = ?" : ""}`).all(...(siteId ? [t, siteId] : [t]));
  const trainings = db.prepare("SELECT * FROM trainings WHERE tenant_id = ? AND active = 1").all(t);
  const completions = db.prepare("SELECT * FROM training_completions WHERE tenant_id = ?").all(t);
  const now = Date.now(), soon = now + 30 * 86400000;
  return users.map(u => {
    const required = trainings.filter(tr => {
      const roles = JSON.parse(tr.required_roles || "[]");
      const depts = JSON.parse(tr.required_departments || "[]");
      const usrs  = JSON.parse(tr.required_users || "[]");
      return (roles.length === 0 && depts.length === 0 && usrs.length === 0)
        || roles.includes(u.role) || depts.includes(u.department_id) || usrs.includes(u.id);
    });
    let current = 0, overdue = 0, expiring = 0;
    required.forEach(tr => {
      const comp = completions.filter(c => c.training_id === tr.id && c.user_id === u.id && c.passed !== 0)
        .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at))[0];
      const notExpired = comp && (!comp.expires_at || new Date(comp.expires_at).getTime() > now);
      if (notExpired) {
        current++;
        if (comp.expires_at && new Date(comp.expires_at).getTime() < soon) expiring++;
      } else {
        overdue++;
      }
    });
    const total = required.length;
    return { id: u.id, name: u.name, site: u.site, dept: u.dept,
             compliance: total > 0 ? Math.round((current / total) * 100) : 100,
             overdue, expiring, current, total };
  });
}

app.get("/api/dashboard/compliance", auth, (req, res) => {
  if (!CAN_SEE_ALL_COMPLIANCE.includes(req.auth.role)) {
    // Staff see only their own training record.
    const mine = staffCompliance(req.auth.tenant).filter(u => u.id === req.auth.uid);
    return res.json(mine);
  }
  // A site_manager sees the people at their site; admin/safety/trainer see everyone.
  res.json(staffCompliance(req.auth.tenant, siteScope(req)));
});

const DIST = path.join(__dirname, "..", "dist");
// Hashed assets cache forever; index.html must never be cached (stale-bundle white screens)
// The manifest is NOT content-hashed, so caching it immutably would freeze the
// app name/icons in installed PWAs for a year. Revalidate it instead.
app.get("/manifest.webmanifest", (req, res, next) => {
  res.set("Cache-Control", "no-cache");
  next();
});
app.use(express.static(DIST, { index: false, maxAge: "365d", immutable: true }));
app.use((req, res) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error: "Not found" });
  res.set("Cache-Control", "no-store, must-revalidate");
  res.sendFile(path.join(DIST, "index.html"));
});

// ── Global error handler — must be last. Never leak stack traces or file paths. ──
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("Unhandled error:", req.method, req.path, "—", err?.message);
  const msg = String(err?.message || "");
  // Malformed JSON body from a client → 400, not a 500 (it is not our fault).
  if (err?.type === "entity.parse.failed" || (err instanceof SyntaxError && "body" in err))
    return res.status(400).json({ error: "Malformed request body" });
  // Turn common DB constraint violations into honest 4xx instead of a 500.
  if (/FOREIGN KEY constraint failed/i.test(msg))
    return res.status(400).json({ error: "Referenced record does not exist or is not accessible" });
  if (/UNIQUE constraint failed/i.test(msg))
    return res.status(409).json({ error: "That record already exists" });
  if (/CHECK constraint failed/i.test(msg))
    return res.status(400).json({ error: "One or more values are not valid" });
  if (err?.type === "entity.too.large")
    return res.status(413).json({ error: "Upload too large — try fewer or smaller photos" });
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

app.listen(PORT, () => console.log(`EHS DNA API listening on :${PORT}`));
