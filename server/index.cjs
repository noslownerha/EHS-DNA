/**
 * EHS DNA — API server
 * Serves /api/* plus the built React app from ../dist in production.
 * Every query is tenant-scoped via the JWT's tenant_id claim.
 */
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const db = require("./db.cjs");

const app = express();
const PORT = process.env.PORT || 3001;
const SECRET = process.env.EHS_JWT_SECRET || "dev-secret-change-in-prod";
const TOKEN_TTL = "12h";

app.use(express.json({ limit: "5mb" }));

// ── Auth ─────────────────────────────────────────────────────────────────────
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });
  const user = db.prepare("SELECT * FROM users WHERE email = ? AND active = 1").get(String(email).toLowerCase().trim());
  if (!user || !bcrypt.compareSync(password, user.password_hash))
    return res.status(401).json({ error: "Invalid email or password" });
  const token = jwt.sign(
    { uid: user.id, tenant: user.tenant_id, role: user.role, name: user.name },
    SECRET, { expiresIn: TOKEN_TTL }
  );
  const site = user.site_id ? db.prepare("SELECT name FROM sites WHERE id = ?").get(user.site_id) : null;
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, site: site?.name ?? null, siteId: user.site_id } });
});

function auth(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Not authenticated" });
  try { req.auth = jwt.verify(token, SECRET); next(); }
  catch { return res.status(401).json({ error: "Session expired" }); }
}
function requireRole(...roles) {
  return (req, res, next) =>
    roles.includes(req.auth.role) ? next() : res.status(403).json({ error: "Insufficient permissions" });
}
const ADMINISH = ["admin", "safety"];

app.post("/api/auth/change-password", auth, (req, res) => {
  const { current, next: nextPw } = req.body || {};
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.auth.uid);
  if (!bcrypt.compareSync(current || "", user.password_hash))
    return res.status(401).json({ error: "Current password incorrect" });
  if (!nextPw || nextPw.length < 8) return res.status(400).json({ error: "New password must be 8+ characters" });
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(bcrypt.hashSync(nextPw, 10), user.id);
  res.json({ ok: true });
});

// ── Tenant config (drives BRAND on the frontend; editable = onboarding) ──────
app.get("/api/config", auth, (req, res) => {
  const t = db.prepare("SELECT * FROM tenants WHERE id = ?").get(req.auth.tenant);
  const sites = db.prepare("SELECT id, name, location FROM sites WHERE tenant_id = ? AND active = 1").all(req.auth.tenant);
  const departments = db.prepare("SELECT id, name FROM departments WHERE tenant_id = ? AND active = 1").all(req.auth.tenant);
  res.json({
    company: t.name, shortName: t.short_name, industry: t.industry, tagline: t.tagline,
    triage: { enabled: !!t.triage_enabled, providerName: t.triage_provider_name, providerPhone: t.triage_provider_phone },
    sites, departments,
  });
});
app.put("/api/config", auth, requireRole(...ADMINISH), (req, res) => {
  const { company, shortName, industry, tagline, triage } = req.body || {};
  db.prepare(`UPDATE tenants SET name = COALESCE(?, name), short_name = COALESCE(?, short_name),
              industry = COALESCE(?, industry), tagline = COALESCE(?, tagline),
              triage_enabled = COALESCE(?, triage_enabled),
              triage_provider_name = COALESCE(?, triage_provider_name),
              triage_provider_phone = COALESCE(?, triage_provider_phone)
              WHERE id = ?`)
    .run(company, shortName, industry, tagline,
         triage ? (triage.enabled ? 1 : 0) : null,
         triage?.providerName, triage?.providerPhone, req.auth.tenant);
  res.json({ ok: true });
});

// ── Generic tenant-scoped CRUD helper ────────────────────────────────────────
function listAll(table, orderBy = "id DESC") {
  return (req, res) =>
    res.json(db.prepare(`SELECT * FROM ${table} WHERE tenant_id = ? ORDER BY ${orderBy}`).all(req.auth.tenant));
}

// Sites & departments (admin manage)
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
  try {
    const r = db.prepare(`INSERT INTO users (tenant_id, email, password_hash, name, role, site_id, department_id)
                          VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(req.auth.tenant, String(email).toLowerCase().trim(), bcrypt.hashSync(pw, 10), name, role, siteId ?? null, departmentId ?? null);
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
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ? AND tenant_id = ?")
      .run(bcrypt.hashSync(tempPassword, 10), req.params.id, req.auth.tenant);
  }
  res.json({ ok: true, tempPassword });
});

// ── Incidents ────────────────────────────────────────────────────────────────
function nextRef(prefix, table) {
  const year = new Date().getFullYear();
  const row = db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE tenant_id = ? AND ref LIKE ?`)
    .get(1, `${prefix}-${year}-%`);
  return `${prefix}-${year}-${String(row.n + 1).padStart(4, "0")}`;
}
app.get("/api/incidents", auth, listAll("incidents", "created_at DESC"));
app.post("/api/incidents", auth, (req, res) => {
  const { type, severity, siteId, description, locationDetail, involved, photos, occurredAt } = req.body || {};
  if (!type) return res.status(400).json({ error: "type required" });
  const ref = nextRef("INC", "incidents");
  const r = db.prepare(`INSERT INTO incidents (tenant_id, ref, type, severity, site_id, description, location_detail, involved, photos, reported_by, occurred_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(req.auth.tenant, ref, type, severity ?? null, siteId ?? null, description ?? null,
         locationDetail ?? null, JSON.stringify(involved ?? []), JSON.stringify(photos ?? []),
         req.auth.uid, occurredAt ?? null);
  res.json({ id: r.lastInsertRowid, ref });
});
app.put("/api/incidents/:id", auth, requireRole(...ADMINISH, "site_manager"), (req, res) => {
  const { status, severity } = req.body || {};
  db.prepare("UPDATE incidents SET status = COALESCE(?, status), severity = COALESCE(?, severity), updated_at = datetime('now') WHERE id = ? AND tenant_id = ?")
    .run(status, severity, req.params.id, req.auth.tenant);
  res.json({ ok: true });
});

// ── Corrective actions ───────────────────────────────────────────────────────
app.get("/api/cas", auth, listAll("corrective_actions", "due_date ASC"));
app.post("/api/cas", auth, requireRole(...ADMINISH, "site_manager"), (req, res) => {
  const { incidentId, findingId, title, priority, assigneeId, dueDate } = req.body || {};
  if (!title) return res.status(400).json({ error: "title required" });
  const r = db.prepare(`INSERT INTO corrective_actions (tenant_id, incident_id, finding_id, title, priority, assignee_id, due_date)
                        VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(req.auth.tenant, incidentId ?? null, findingId ?? null, title, priority ?? "medium", assigneeId ?? null, dueDate ?? null);
  res.json({ id: r.lastInsertRowid });
});
app.put("/api/cas/:id", auth, (req, res) => {
  const { status, verified } = req.body || {};
  db.prepare(`UPDATE corrective_actions SET status = COALESCE(?, status),
              verified_by = CASE WHEN ? THEN ? ELSE verified_by END,
              updated_at = datetime('now') WHERE id = ? AND tenant_id = ?`)
    .run(status, verified ? 1 : 0, req.auth.uid, req.params.id, req.auth.tenant);
  res.json({ ok: true });
});

// ── Checklists / inspections / findings ──────────────────────────────────────
app.get("/api/checklists", auth, listAll("checklists"));
app.post("/api/checklists", auth, requireRole(...ADMINISH), (req, res) => {
  const r = db.prepare("INSERT INTO checklists (tenant_id, name, items) VALUES (?, ?, ?)")
    .run(req.auth.tenant, req.body.name, JSON.stringify(req.body.items ?? []));
  res.json({ id: r.lastInsertRowid });
});
app.get("/api/inspections", auth, listAll("inspections", "started_at DESC"));
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
app.get("/api/findings", auth, listAll("findings", "created_at DESC"));
app.post("/api/findings", auth, (req, res) => {
  const { inspectionId, siteId, severity, description, photos } = req.body || {};
  if (!description) return res.status(400).json({ error: "description required" });
  const r = db.prepare(`INSERT INTO findings (tenant_id, inspection_id, site_id, severity, description, photos, reported_by)
                        VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(req.auth.tenant, inspectionId ?? null, siteId ?? null, severity ?? "low", description,
         JSON.stringify(photos ?? []), req.auth.uid);
  res.json({ id: r.lastInsertRowid });
});
app.put("/api/findings/:id", auth, (req, res) => {
  const { status } = req.body || {};
  db.prepare(`UPDATE findings SET status = COALESCE(?, status),
              resolved_at = CASE WHEN ? = 'resolved' THEN datetime('now') ELSE resolved_at END
              WHERE id = ? AND tenant_id = ?`)
    .run(status, status, req.params.id, req.auth.tenant);
  res.json({ ok: true });
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
app.get("/api/completions", auth, (req, res) => {
  const rows = req.auth.role === "staff"
    ? db.prepare("SELECT * FROM training_completions WHERE tenant_id = ? AND user_id = ? ORDER BY completed_at DESC").all(req.auth.tenant, req.auth.uid)
    : db.prepare("SELECT * FROM training_completions WHERE tenant_id = ? ORDER BY completed_at DESC").all(req.auth.tenant);
  res.json(rows);
});
app.post("/api/completions", auth, (req, res) => {
  const { trainingId, userIds, method, score, sessionId } = req.body || {};
  if (!trainingId) return res.status(400).json({ error: "trainingId required" });
  const targets = Array.isArray(userIds) && userIds.length ? userIds : [req.auth.uid];
  // Group logging requires trainer+; self-completion is open to all
  if ((targets.length > 1 || targets[0] !== req.auth.uid) &&
      !["admin", "safety", "trainer", "site_manager"].includes(req.auth.role))
    return res.status(403).json({ error: "Insufficient permissions" });
  const training = db.prepare("SELECT frequency_months FROM trainings WHERE id = ? AND tenant_id = ?").get(trainingId, req.auth.tenant);
  if (!training) return res.status(404).json({ error: "Training not found" });
  const sid = sessionId ?? `SES-${Date.now()}`;
  const stmt = db.prepare(`INSERT INTO training_completions (tenant_id, training_id, user_id, session_id, method, score, expires_at)
                           VALUES (?, ?, ?, ?, ?, ?, CASE WHEN ? IS NOT NULL THEN datetime('now', '+' || ? || ' months') ELSE NULL END)`);
  const tx = db.transaction(() => targets.forEach(uid =>
    stmt.run(req.auth.tenant, trainingId, uid, sid, method ?? "cbt", score ?? null, training.frequency_months, training.frequency_months)));
  tx();
  res.json({ ok: true, sessionId: sid, count: targets.length });
});

// ── Triage records ───────────────────────────────────────────────────────────
app.get("/api/triage", auth, listAll("triage_records", "created_at DESC"));
app.post("/api/triage", auth, (req, res) => {
  const { siteId, outcome, stepsCompleted, notified, linkedIncidentId } = req.body || {};
  const ref = nextRef("TRG", "triage_records");
  const r = db.prepare(`INSERT INTO triage_records (tenant_id, ref, responder_id, site_id, outcome, steps_completed, notified, linked_incident_id)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(req.auth.tenant, ref, req.auth.uid, siteId ?? null, outcome ?? null,
         JSON.stringify(stepsCompleted ?? []), JSON.stringify(notified ?? []), linkedIncidentId ?? null);
  res.json({ id: r.lastInsertRowid, ref });
});

// ── Static app (production) ──────────────────────────────────────────────────
const DIST = path.join(__dirname, "..", "dist");
app.use(express.static(DIST));
app.use((req, res) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error: "Not found" });
  res.sendFile(path.join(DIST, "index.html"));
});

app.listen(PORT, () => console.log(`EHS DNA API listening on :${PORT}`));
