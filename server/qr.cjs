/**
 * QR-driven features beyond equipment:
 *
 *  - Inspection points: a named physical spot (eyewash station, extinguisher
 *    bay, dock door) tied to a checklist. Its QR opens that checklist ready to
 *    run — ?open=point:<id>.
 *  - Batch labels: POST /api/qr/labels with any mix of assets and points returns
 *    printable label data (name, subtitle, SVG) in one call, so the UI can print
 *    a whole sheet at once. Every item is verified to belong to the caller's
 *    tenant; anything else is silently dropped, never leaked.
 *  - Asset maintenance schedules: recurring tasks per asset ("grease bearings
 *    every 30 days") with next-due dates and an append-only done log. Shown on
 *    the asset page a QR scan opens.
 */
const qrGen = require("qrcode-generator");

const APP_URL = process.env.EHS_APP_URL || "https://app.ehsdna.com";
const deepLink = (kind, id) => `${APP_URL}/?open=${kind}:${id}`;
function qrSvg(url) {
  const qr = qrGen(0, "M"); qr.addData(url); qr.make();
  return qr.createSvgTag({ cellSize: 5, margin: 4, scalable: true });
}
const isoDate = d => new Date(d).toISOString().slice(0, 10);
const addDays = (d, n) => new Date(new Date(d).getTime() + n * 86400000);

module.exports = function mountQr(app, db, auth, requireRole, ADMINISH, moduleEnabled) {
  const canManage = requireRole(...ADMINISH, "site_manager");
  const T = req => req.auth.tenant;

  // ── Inspection points ──────────────────────────────────────────────────────
  const pointRow = (t, id) => db.prepare(`
    SELECT p.*, s.name AS site_name, c.name AS checklist_name
    FROM inspection_points p
    LEFT JOIN sites s ON s.id = p.site_id
    LEFT JOIN checklists c ON c.id = p.checklist_id
    WHERE p.tenant_id = ? AND p.id = ?`).get(t, id);

  app.get("/api/inspection-points", auth, (req, res) => {
    res.json(db.prepare(`
      SELECT p.*, s.name AS site_name, c.name AS checklist_name
      FROM inspection_points p
      LEFT JOIN sites s ON s.id = p.site_id
      LEFT JOIN checklists c ON c.id = p.checklist_id
      WHERE p.tenant_id = ? AND p.active = 1 ORDER BY s.name, p.name`).all(T(req)));
  });
  app.get("/api/inspection-points/:id", auth, (req, res) => {
    const p = pointRow(T(req), req.params.id);
    if (!p || !p.active) return res.status(404).json({ error: "Inspection point not found" });
    res.json(p);
  });
  function validChecklist(t, id) {
    return id && db.prepare("SELECT 1 FROM checklists WHERE tenant_id = ? AND id = ? AND active = 1").get(t, id);
  }
  function validSite(t, id) {
    return !id || db.prepare("SELECT 1 FROM sites WHERE tenant_id = ? AND id = ?").get(t, id);
  }
  app.post("/api/inspection-points", auth, canManage, (req, res) => {
    const { name, siteId, location, checklistId } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: "Name is required" });
    if (!validChecklist(T(req), checklistId)) return res.status(400).json({ error: "Pick the checklist this point runs" });
    if (!validSite(T(req), siteId)) return res.status(400).json({ error: "Unknown site" });
    const r = db.prepare(`INSERT INTO inspection_points (tenant_id, name, site_id, location, checklist_id, active)
                          VALUES (?, ?, ?, ?, ?, 1)`).run(T(req), name.trim(), siteId ?? null, location ?? null, checklistId);
    res.json(pointRow(T(req), r.lastInsertRowid));
  });
  app.put("/api/inspection-points/:id", auth, canManage, (req, res) => {
    const p = pointRow(T(req), req.params.id);
    if (!p) return res.status(404).json({ error: "Inspection point not found" });
    const { name, siteId, location, checklistId } = req.body || {};
    if (checklistId !== undefined && !validChecklist(T(req), checklistId)) return res.status(400).json({ error: "Unknown checklist" });
    if (siteId !== undefined && !validSite(T(req), siteId)) return res.status(400).json({ error: "Unknown site" });
    db.prepare(`UPDATE inspection_points SET name = COALESCE(?, name), site_id = COALESCE(?, site_id),
                location = COALESCE(?, location), checklist_id = COALESCE(?, checklist_id)
                WHERE tenant_id = ? AND id = ?`)
      .run(name?.trim() || null, siteId ?? null, location ?? null, checklistId ?? null, T(req), p.id);
    res.json(pointRow(T(req), p.id));
  });
  app.delete("/api/inspection-points/:id", auth, canManage, (req, res) => {
    // Soft delete: a printed label may still be on the wall; it then says "not found".
    const r = db.prepare("UPDATE inspection_points SET active = 0 WHERE tenant_id = ? AND id = ?").run(T(req), req.params.id);
    if (!r.changes) return res.status(404).json({ error: "Inspection point not found" });
    res.json({ ok: true });
  });

  // ── Batch labels (print a sheet of any mix) ────────────────────────────────
  app.post("/api/qr/labels", auth, (req, res) => {
    const items = Array.isArray(req.body?.items) ? req.body.items.slice(0, 200) : [];
    if (!items.length) return res.status(400).json({ error: "Select at least one label to print" });
    const out = [];
    for (const it of items) {
      if (it.kind === "asset" && moduleEnabled(T(req), "equipment")) {
        const a = db.prepare(`SELECT a.id, a.name, a.asset_tag, s.name AS site_name, a.location FROM assets a
                              LEFT JOIN sites s ON s.id = a.site_id WHERE a.tenant_id = ? AND a.id = ? AND a.active = 1`).get(T(req), it.id);
        if (a) out.push({ kind: "asset", id: a.id, name: a.name, code: a.asset_tag,
                          subtitle: [a.site_name, a.location].filter(Boolean).join(" · "),
                          foot: "Scan for LOTO, SOPs & inspection", svg: qrSvg(deepLink("asset", a.id)), deepLink: deepLink("asset", a.id) });
      } else if (it.kind === "point" && moduleEnabled(T(req), "inspections")) {
        const p = pointRow(T(req), it.id);
        if (p && p.active) out.push({ kind: "point", id: p.id, name: p.name, code: p.checklist_name,
                                      subtitle: [p.site_name, p.location].filter(Boolean).join(" · "),
                                      foot: "Scan to start this inspection", svg: qrSvg(deepLink("point", p.id)), deepLink: deepLink("point", p.id) });
      }
    }
    res.json(out);
  });

  // ── Asset maintenance schedules ────────────────────────────────────────────
  const assetOf = (t, id) => db.prepare("SELECT id, name FROM assets WHERE tenant_id = ? AND id = ? AND active = 1").get(t, id);
  const maintRows = (t, assetId) => db.prepare(`
    SELECT m.*, (SELECT u.name FROM asset_maintenance_log l LEFT JOIN users u ON u.id = l.done_by
                 WHERE l.maintenance_id = m.id ORDER BY l.id DESC LIMIT 1) AS last_done_by
    FROM asset_maintenance m WHERE m.tenant_id = ? AND m.asset_id = ? AND m.active = 1
    ORDER BY m.next_due`).all(t, assetId)
    .map(m => ({ ...m, overdue: !!m.next_due && m.next_due < isoDate(Date.now()) }));

  app.get("/api/assets/:id/maintenance", auth, (req, res) => {
    if (!assetOf(T(req), req.params.id)) return res.status(404).json({ error: "Asset not found" });
    res.json(maintRows(T(req), req.params.id));
  });
  app.post("/api/assets/:id/maintenance", auth, canManage, (req, res) => {
    const a = assetOf(T(req), req.params.id);
    if (!a) return res.status(404).json({ error: "Asset not found" });
    const { task, intervalDays, lastDone } = req.body || {};
    const n = Number(intervalDays);
    if (!task?.trim()) return res.status(400).json({ error: "Describe the task" });
    if (!Number.isInteger(n) || n < 1 || n > 3650) return res.status(400).json({ error: "Interval must be 1–3650 days" });
    const base = lastDone ? new Date(lastDone) : new Date();
    if (isNaN(base)) return res.status(400).json({ error: "Invalid last-done date" });
    db.prepare(`INSERT INTO asset_maintenance (tenant_id, asset_id, task, interval_days, last_done_at, next_due, active)
                VALUES (?, ?, ?, ?, ?, ?, 1)`)
      .run(T(req), a.id, task.trim(), n, lastDone ? isoDate(base) : null, isoDate(lastDone ? addDays(base, n) : base));
    res.json(maintRows(T(req), a.id));
  });
  const maintOf = (t, id) => db.prepare("SELECT * FROM asset_maintenance WHERE tenant_id = ? AND id = ? AND active = 1").get(t, id);
  app.put("/api/maintenance/:id", auth, canManage, (req, res) => {
    const m = maintOf(T(req), req.params.id);
    if (!m) return res.status(404).json({ error: "Maintenance task not found" });
    const { task, intervalDays } = req.body || {};
    const n = intervalDays === undefined ? m.interval_days : Number(intervalDays);
    if (!Number.isInteger(n) || n < 1 || n > 3650) return res.status(400).json({ error: "Interval must be 1–3650 days" });
    const nextDue = m.last_done_at ? isoDate(addDays(m.last_done_at, n)) : m.next_due;
    db.prepare("UPDATE asset_maintenance SET task = COALESCE(?, task), interval_days = ?, next_due = ? WHERE id = ?")
      .run(task?.trim() || null, n, nextDue, m.id);
    res.json(maintRows(T(req), m.asset_id));
  });
  app.delete("/api/maintenance/:id", auth, canManage, (req, res) => {
    const m = maintOf(T(req), req.params.id);
    if (!m) return res.status(404).json({ error: "Maintenance task not found" });
    db.prepare("UPDATE asset_maintenance SET active = 0 WHERE id = ?").run(m.id);
    res.json(maintRows(T(req), m.asset_id));
  });
  // Anyone who can see the asset can record the work — the tech at the machine
  // with a phone is exactly who should. Who did it and when is logged.
  app.post("/api/maintenance/:id/done", auth, (req, res) => {
    const m = maintOf(T(req), req.params.id);
    if (!m) return res.status(404).json({ error: "Maintenance task not found" });
    const now = new Date();
    db.prepare(`INSERT INTO asset_maintenance_log (tenant_id, maintenance_id, asset_id, done_by, done_at, notes)
                VALUES (?, ?, ?, ?, ?, ?)`).run(T(req), m.id, m.asset_id, req.auth.uid, now.toISOString(), req.body?.notes ?? null);
    db.prepare("UPDATE asset_maintenance SET last_done_at = ?, next_due = ? WHERE id = ?")
      .run(isoDate(now), isoDate(addDays(now, m.interval_days)), m.id);
    res.json(maintRows(T(req), m.asset_id));
  });
  app.get("/api/maintenance/:id/log", auth, (req, res) => {
    const m = maintOf(T(req), req.params.id);
    if (!m) return res.status(404).json({ error: "Maintenance task not found" });
    res.json(db.prepare(`SELECT l.done_at, l.notes, u.name AS done_by FROM asset_maintenance_log l
                         LEFT JOIN users u ON u.id = l.done_by WHERE l.maintenance_id = ? ORDER BY l.id DESC LIMIT 50`).all(m.id));
  });
};

module.exports.qrSvg = qrSvg;
module.exports.deepLink = deepLink;
