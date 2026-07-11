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

app.use(express.json({ limit: "15mb" }));

// ── Auth ─────────────────────────────────────────────────────────────────────
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });
  const user = db.prepare("SELECT * FROM users WHERE email = ? AND active = 1").get(String(email).toLowerCase().trim());
  if (!user || !bcrypt.compareSync(password, user.password_hash))
    return res.status(401).json({ error: "Invalid email or password" });
  const tenantRow = db.prepare("SELECT active FROM tenants WHERE id = ?").get(user.tenant_id);
  if (tenantRow && tenantRow.active === 0 && !user.is_operator)
    return res.status(403).json({ error: "This account is suspended — contact EHS DNA support" });
  const token = jwt.sign(
    { uid: user.id, tenant: user.tenant_id, role: user.role, name: user.name, op: !!user.is_operator },
    SECRET, { expiresIn: TOKEN_TTL }
  );
  const site = user.site_id ? db.prepare("SELECT name FROM sites WHERE id = ?").get(user.site_id) : null;
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, site: site?.name ?? null, siteId: user.site_id, isOperator: !!user.is_operator } });
});

function auth(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Not authenticated" });
  try {
    req.auth = jwt.verify(token, SECRET);
    if (!req.auth.op) {
      const tRow = db.prepare("SELECT active FROM tenants WHERE id = ?").get(req.auth.tenant);
      if (tRow && tRow.active === 0)
        return res.status(403).json({ error: "This account is suspended — contact EHS DNA support" });
    }
    next();
  }
  catch { return res.status(401).json({ error: "Session expired" }); }
}
function requireRole(...roles) {
  return (req, res, next) =>
    roles.includes(req.auth.role) ? next() : res.status(403).json({ error: "Insufficient permissions" });
}
const ADMINISH = ["admin", "safety"];
function requireOperator(req, res, next) {
  return req.auth.op ? next() : res.status(403).json({ error: "Operator access only" });
}

app.post("/api/auth/forgot", (req, res) => {
  const email = String(req.body?.email ?? "").toLowerCase().trim();
  const user = email && db.prepare("SELECT * FROM users WHERE email = ? AND active = 1").get(email);
  if (user) {
    const admins = db.prepare("SELECT id FROM users WHERE tenant_id = ? AND role = 'admin' AND active = 1 AND id != ?")
      .all(user.tenant_id, user.id);
    const stmt = db.prepare(`INSERT INTO notifications (tenant_id, user_id, title, body)
                             VALUES (?, ?, ?, ?)`);
    admins.forEach(a => stmt.run(user.tenant_id, a.id,
      `🔑 Password reset requested: ${user.name}`,
      `${user.email} requested a password reset. Use Manage Staff → Reset password and share the temporary password securely.`));
  }
  res.json({ ok: true });  // never reveal whether the email exists
});

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
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(bcrypt.hashSync(nextPw, 10), user.id);
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
    db.prepare(`INSERT INTO users (tenant_id, email, password_hash, name, role, site_id, department_id)
                VALUES (?, ?, ?, ?, ?, ?, ?)`)
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
app.get("/api/incidents", auth, (req, res) =>
  res.json(db.prepare(`SELECT i.*, s.name AS site_name, u.name AS reporter_name
                       FROM incidents i
                       LEFT JOIN sites s ON s.id = i.site_id
                       LEFT JOIN users u ON u.id = i.reported_by
                       WHERE i.tenant_id = ? ORDER BY i.created_at DESC`).all(req.auth.tenant)));
app.post("/api/incidents", auth, (req, res) => {
  const { type, severity, siteId, description, locationDetail, involved, photos, occurredAt, floorPos, department } = req.body || {};
  if (!type) return res.status(400).json({ error: "type required" });
  const ref = nextRef("INC", "incidents");
  const r = db.prepare(`INSERT INTO incidents (tenant_id, ref, type, severity, site_id, description, location_detail, involved, photos, reported_by, occurred_at, floor_pos, department)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(req.auth.tenant, ref, type, severity ?? null, siteId ?? null, description ?? null,
         locationDetail ?? null, JSON.stringify(involved ?? []), JSON.stringify(photos ?? []),
         req.auth.uid, occurredAt ?? null, floorPos ? JSON.stringify(floorPos) : null, department ?? null);
  // Rule-driven notifications (in-app always; email flag → EHS_EMAIL_WEBHOOK)
  const events = ["incident_any"];
  if (type === "injury") events.push("incident_injury");
  if (severity === "critical" || severity === "serious") events.push("incident_critical");
  const site = siteId ? db.prepare("SELECT name FROM sites WHERE id = ?").get(siteId)?.name : null;
  const notified = notify(req.auth.tenant, events, {
    title: `${type === "injury" ? "Injury reported" : "Incident reported"}: ${ref}`,
    body: `${site ?? "Unassigned site"} · ${severity ?? "unspecified"} · by ${req.auth.name}`,
    linkKind: "incident", linkRef: ref,
  });
  res.json({ id: r.lastInsertRowid, ref, notified: notified ?? null });
});
app.put("/api/incidents/:id/response", auth, (req, res) => {
  const progress = Array.isArray(req.body?.progress) ? req.body.progress : [];
  db.prepare("UPDATE incidents SET response_progress = ?, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?")
    .run(JSON.stringify(progress), req.params.id, req.auth.tenant);
  res.json({ ok: true });
});

app.put("/api/incidents/:id", auth, requireRole(...ADMINISH, "site_manager"), (req, res) => {
  const { status, severity, department, description, locationDetail, oshaClassification } = req.body || {};
  db.prepare(`UPDATE incidents SET status = COALESCE(?, status), severity = COALESCE(?, severity),
              department = COALESCE(?, department), description = COALESCE(?, description),
              location_detail = COALESCE(?, location_detail), osha_classification = COALESCE(?, osha_classification),
              updated_at = datetime('now') WHERE id = ? AND tenant_id = ?`)
    .run(status, severity, department, description, locationDetail, oshaClassification, req.params.id, req.auth.tenant);
  res.json({ ok: true });
});

// ── Corrective actions ───────────────────────────────────────────────────────
app.get("/api/cas", auth, (req, res) =>
  res.json(db.prepare(`SELECT c.*, i.ref AS incident_ref, u.name AS assignee_name
                       FROM corrective_actions c
                       LEFT JOIN incidents i ON i.id = c.incident_id
                       LEFT JOIN users u ON u.id = c.assignee_id
                       WHERE c.tenant_id = ? ORDER BY c.due_date ASC`).all(req.auth.tenant)));
app.post("/api/cas", auth, (req, res) => {
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
app.get("/api/findings", auth, (req, res) =>
  res.json(db.prepare(`SELECT f.*, u.name AS reporter_name, s.name AS site_name
                       FROM findings f LEFT JOIN users u ON u.id = f.reported_by
                       LEFT JOIN sites s ON s.id = f.site_id
                       WHERE f.tenant_id = ? ORDER BY f.created_at DESC`).all(req.auth.tenant)));
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
  // Group logging requires trainer+; self-completion is open to all
  if ((targets.length > 1 || targets[0] !== req.auth.uid) &&
      !["admin", "safety", "trainer", "site_manager"].includes(req.auth.role))
    return res.status(403).json({ error: "Insufficient permissions" });
  const training = db.prepare("SELECT frequency_months FROM trainings WHERE id = ? AND tenant_id = ?").get(trainingId, req.auth.tenant);
  if (!training) return res.status(404).json({ error: "Training not found" });
  const sid = sessionId ?? `SES-${Date.now()}`;
  // Failed attempts are logged for the audit trail but never carry an expiry (they do not satisfy the requirement)
  const stmt = db.prepare(`INSERT INTO training_completions (tenant_id, training_id, user_id, session_id, method, score, passed, expires_at)
                           VALUES (?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 1 AND ? IS NOT NULL THEN datetime('now', '+' || ? || ' months') ELSE NULL END)`);
  const tx = db.transaction(() => targets.forEach(uid =>
    stmt.run(req.auth.tenant, trainingId, uid, sid, method ?? "cbt", score ?? null, didPass, didPass, training.frequency_months, training.frequency_months)));
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

// ── Dashboard summary (per-site rollup for admin dashboards) ─────────────────
app.get("/api/dashboard/summary", auth, (req, res) => {
  const t = req.auth.tenant;
  const sites = db.prepare("SELECT * FROM sites WHERE tenant_id = ? AND active = 1").all(t);
  const summary = sites.map(site => {
    const staff = db.prepare("SELECT COUNT(*) n FROM users WHERE tenant_id = ? AND site_id = ? AND active = 1").get(t, site.id).n;
    const openIncidents = db.prepare("SELECT COUNT(*) n FROM incidents WHERE tenant_id = ? AND site_id = ? AND status != 'closed'").get(t, site.id).n;
    const openCAs = db.prepare(`SELECT COUNT(*) n FROM corrective_actions c
                                JOIN incidents i ON i.id = c.incident_id
                                WHERE c.tenant_id = ? AND i.site_id = ? AND c.status NOT IN ('done','verified')`).get(t, site.id).n;
    const criticalFindings = db.prepare("SELECT COUNT(*) n FROM findings WHERE tenant_id = ? AND site_id = ? AND status = 'open' AND severity IN ('high','critical')").get(t, site.id).n;
    const lastIncident = db.prepare("SELECT MAX(created_at) d FROM incidents WHERE tenant_id = ? AND site_id = ?").get(t, site.id).d;
    const daysSince = lastIncident ? Math.floor((Date.now() - new Date(lastIncident).getTime()) / 86400000) : 999;
    // Compliance: % of active site staff who are fully current on every required training
    // (expiry-aware, same definition as the per-user report — see staffCompliance()).
    const siteRows = staffCompliance(t, site.id);
    const fullyCompliant = siteRows.filter(r => r.total === 0 || r.current === r.total).length;
    const compliance = siteRows.length > 0 ? Math.round((fullyCompliant / siteRows.length) * 100) : 100;
    return { name: site.name, location: site.location, staff, daysSince, compliance,
             openIncidents, openCAs, criticalFindings };
  });
  res.json(summary);
});


// ── Notifications ─────────────────────────────────────────────────────────────
function notify(tenantId, events, { title, body, linkKind, linkRef }) {
  try {
    const rules = db.prepare(`SELECT * FROM notification_rules WHERE tenant_id = ? AND active = 1`).all(tenantId)
      .filter(r => events.includes(r.event));
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
    if (wantsEmail && process.env.EHS_EMAIL_WEBHOOK) {
      const emails = db.prepare(`SELECT email FROM users WHERE id IN (${[...recipients].map(() => "?").join(",")})`)
        .all(...recipients).map(u => u.email);
      fetch(process.env.EHS_EMAIL_WEBHOOK, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: emails, subject: title, text: body ?? title }),
      }).catch(err => console.error("Email webhook failed:", err.message));
    }
    return { count: recipients.size, email: wantsEmail, events: [...new Set(rules.map(r => r.event))] };
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
  const { event, recipientRoles, recipientUsers, email } = req.body || {};
  if (!event) return res.status(400).json({ error: "event required" });
  const r = db.prepare("INSERT INTO notification_rules (tenant_id, event, recipient_roles, recipient_users, email) VALUES (?, ?, ?, ?, ?)")
    .run(req.auth.tenant, event, JSON.stringify(recipientRoles ?? []), JSON.stringify(recipientUsers ?? []), email ? 1 : 0);
  res.json({ id: r.lastInsertRowid });
});
app.delete("/api/notification-rules/:id", auth, requireRole(...ADMINISH), (req, res) => {
  db.prepare("UPDATE notification_rules SET active = 0 WHERE id = ? AND tenant_id = ?").run(req.params.id, req.auth.tenant);
  res.json({ ok: true });
});

// ── Operator console (EHS DNA staff only) ────────────────────────────────────
app.get("/api/op/tenants", auth, requireOperator, (req, res) => {
  const tenants = db.prepare("SELECT * FROM tenants ORDER BY id").all();
  res.json(tenants.map(t => {
    const sites = db.prepare("SELECT COUNT(*) n FROM sites WHERE tenant_id = ? AND active = 1").get(t.id).n;
    const users = db.prepare("SELECT COUNT(*) n FROM users WHERE tenant_id = ? AND active = 1 AND is_operator = 0").get(t.id).n;
    const cfg = db.prepare("SELECT base_price, per_site, per_user, auto_approve FROM billing_config WHERE tenant_id = ?").get(t.id);
    const lastInv = db.prepare("SELECT ref, period, status, total FROM invoices WHERE tenant_id = ? ORDER BY period DESC LIMIT 1").get(t.id);
    const est = cfg ? Math.round((cfg.base_price + sites * cfg.per_site + users * cfg.per_user) * 100) / 100 : null;
    return { id: t.id, name: t.name, industry: t.industry, created: t.created_at, active: t.active !== 0, active: t.active !== 0,
             sites, users, billing: cfg ?? null, estMonthly: est, lastInvoice: lastInv ?? null };
  }));
});

app.get("/api/op/tenants/:id/users", auth, requireOperator, (req, res) =>
  res.json(db.prepare(`SELECT id, name, email, role, active FROM users
                       WHERE tenant_id = ? AND is_operator = 0 ORDER BY name`).all(req.params.id)));

app.post("/api/op/users/:id/reset-password", auth, requireOperator, (req, res) => {
  const bcrypt2 = require("bcryptjs");
  const user = db.prepare("SELECT id FROM users WHERE id = ?").get(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  const tempPassword = Math.random().toString(36).slice(2, 10) + "!A1";
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(bcrypt2.hashSync(tempPassword, 10), user.id);
  res.json({ tempPassword });
});

app.put("/api/op/tenants/:id/status", auth, requireOperator, (req, res) => {
  db.prepare("UPDATE tenants SET active = ? WHERE id = ?").run(req.body?.active ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

app.post("/api/op/impersonate", auth, requireOperator, (req, res) => {
  const tenant = db.prepare("SELECT * FROM tenants WHERE id = ?").get(req.body?.tenantId);
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });
  const token = jwt.sign(
    { uid: req.auth.uid, tenant: tenant.id, role: "admin", name: `${req.auth.name} (support)`, op: true },
    SECRET, { expiresIn: "4h" }
  );
  res.json({ token, tenantName: tenant.name });
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
      db.prepare(`INSERT INTO users (tenant_id, email, password_hash, name, role)
                  VALUES (?, ?, ?, ?, 'admin')`)
        .run(tid, String(adminEmail).toLowerCase().trim(), bcrypt2.hashSync(tempPassword, 10), adminName ?? "Admin");
      db.prepare(`INSERT INTO billing_config (tenant_id, base_price, per_site, per_user, auto_approve)
                  VALUES (?, 250, 75, 8, 0)`).run(tid);
      db.prepare(`INSERT INTO notification_rules (tenant_id, event, recipient_roles, email)
                  VALUES (?, 'incident_injury', '["admin","safety"]', 1)`).run(tid);
      const rc = db.prepare("INSERT INTO response_checklists (tenant_id, incident_type, items) VALUES (?, ?, ?)");
      rc.run(tid, "injury", JSON.stringify(["Complete first aid log", "Notify shift supervisor",
        "Preserve scene until photos are done", "Secure the area if hazard still present",
        "Check in with the injured person within 24 hours"]));
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
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(bcrypt.hashSync(tempPassword, 10), user.id);
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
app.get("/api/reports/incident-summary", auth, (req, res) => {
  const t = req.auth.tenant;
  const rows = db.prepare(`SELECT strftime('%Y-%m', COALESCE(occurred_at, created_at)) AS ym,
                                  site_id, type, COUNT(*) n
                           FROM incidents WHERE tenant_id = ?
                           GROUP BY ym, site_id, type`).all(t);
  const sites = db.prepare("SELECT id, name FROM sites WHERE tenant_id = ? AND active = 1").all(t);
  const headcount = Object.fromEntries(sites.map(s => [s.id,
    db.prepare("SELECT COUNT(*) n FROM users WHERE tenant_id = ? AND site_id = ? AND active = 1 AND is_operator = 0").get(t, s.id).n]));
  // Last 12 calendar months
  const months = [];
  const d = new Date(); d.setDate(1);
  for (let i = 11; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    months.push(m.toISOString().slice(0, 7));
  }
  const out = months.map(ym => {
    const monthRows = rows.filter(r => r.ym === ym);
    const perSite = sites.map(s => {
      const siteRows = monthRows.filter(r => r.site_id === s.id);
      return { siteId: s.id, site: s.name,
               incidents: siteRows.reduce((n, r) => n + r.n, 0),
               injuries: siteRows.filter(r => r.type === "injury").reduce((n, r) => n + r.n, 0),
               estHours: (headcount[s.id] ?? 0) * 160 };
    });
    return { month: ym,
             incidents: perSite.reduce((n, s) => n + s.incidents, 0),
             injuries: perSite.reduce((n, s) => n + s.injuries, 0),
             estHours: perSite.reduce((n, s) => n + s.estHours, 0),
             sites: perSite };
  });
  res.json({ months: out, hoursNote: "Hours estimated from active headcount × 160/mo — replace with payroll hours when available" });
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

// ── Billing module ────────────────────────────────────────────────────────────
require("./billing.cjs")(app, db, auth, () => requireOperator);

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
  res.json(staffCompliance(req.auth.tenant));
});

const DIST = path.join(__dirname, "..", "dist");
// Hashed assets cache forever; index.html must never be cached (stale-bundle white screens)
app.use(express.static(DIST, { index: false, maxAge: "365d", immutable: true }));
app.use((req, res) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error: "Not found" });
  res.set("Cache-Control", "no-store, must-revalidate");
  res.sendFile(path.join(DIST, "index.html"));
});

app.listen(PORT, () => console.log(`EHS DNA API listening on :${PORT}`));
