// ── Equipment & Assets module routes ─────────────────────────────────────────
// Asset registry, QR code generation (deep-links to the asset page), and the
// LOTO/SOP procedures attached to each asset. Mounted from index.cjs, gated by
// the `equipment` module via the standard moduleGate on /api/assets paths.
const qrGen = require("qrcode-generator");

const APP_URL = process.env.EHS_APP_URL || "https://app.ehsdna.com";

// Build the deep link a QR encodes: scanning it opens the asset page in-app.
function assetDeepLink(assetId) {
  return `${APP_URL}/?open=asset:${assetId}`;
}

// Generate an SVG QR for an asset's deep link. Pure-JS (qrcode-generator), no
// native deps, no network — safe to run inline on every request.
function assetQrSvg(assetId, { cellSize = 5, margin = 4 } = {}) {
  const qr = qrGen(0, "M");            // type 0 = auto-size, M = ~15% error correction
  qr.addData(assetDeepLink(assetId));
  qr.make();
  return qr.createSvgTag({ cellSize, margin, scalable: true });
}

module.exports = function mountEquipment(app, db, auth, requireRole, ADMINISH, photoUtils = {}) {
  const canManage = requireRole(...ADMINISH, "site_manager");
  const storePhoto = photoUtils.storePhoto || (() => null);

  // ── Assets ─────────────────────────────────────────────────────────────────
  // List assets for the tenant (optionally filtered by site or status).
  app.get("/api/assets", auth, (req, res) => {
    const { site, status } = req.query || {};
    let sql = `SELECT a.*, s.name AS site_name, c.name AS checklist_name
               FROM assets a
               LEFT JOIN sites s ON s.id = a.site_id
               LEFT JOIN checklists c ON c.id = a.checklist_id
               WHERE a.tenant_id = ? AND a.active = 1`;
    const args = [req.auth.tenant];
    if (site)   { sql += " AND a.site_id = ?";  args.push(site); }
    if (status) { sql += " AND a.status = ?";   args.push(status); }
    sql += " ORDER BY a.name";
    res.json(db.prepare(sql).all(...args));
  });

  // Single asset with its procedures (LOTO + SOPs) — this is the "scan result" page.
  app.get("/api/assets/:id", auth, (req, res) => {
    const asset = db.prepare(`SELECT a.*, s.name AS site_name, c.name AS checklist_name
                              FROM assets a
                              LEFT JOIN sites s ON s.id = a.site_id
                              LEFT JOIN checklists c ON c.id = a.checklist_id
                              WHERE a.id = ? AND a.tenant_id = ? AND a.active = 1`)
      .get(req.params.id, req.auth.tenant);
    if (!asset) return res.status(404).json({ error: "Asset not found" });
    const procedures = db.prepare(`SELECT * FROM asset_procedures
                                   WHERE asset_id = ? AND tenant_id = ? AND active = 1
                                   ORDER BY kind, id`).all(asset.id, req.auth.tenant);
    asset.loto = procedures.filter(p => p.kind === "loto");
    asset.sops = procedures.filter(p => p.kind === "sop");
    asset.deepLink = assetDeepLink(asset.id);
    res.json(asset);
  });

  // The asset's QR code as an SVG (for printing/reprinting labels).
  app.get("/api/assets/:id/qr", auth, (req, res) => {
    const asset = db.prepare("SELECT id, name, asset_tag FROM assets WHERE id = ? AND tenant_id = ? AND active = 1")
      .get(req.params.id, req.auth.tenant);
    if (!asset) return res.status(404).json({ error: "Asset not found" });
    const size = Math.min(12, Math.max(3, Number(req.query.cell) || 5));
    res.json({
      id: asset.id, name: asset.name, assetTag: asset.asset_tag,
      deepLink: assetDeepLink(asset.id),
      svg: assetQrSvg(asset.id, { cellSize: size }),
    });
  });

  app.post("/api/assets", auth, canManage, (req, res) => {
    const { name, assetTag, category, siteId, location, manufacturer, model, serial, status, checklistId, notes, photo } = req.body || {};
    if (!name) return res.status(400).json({ error: "name required" });
    const r = db.prepare(`INSERT INTO assets
      (tenant_id, name, asset_tag, category, site_id, location, manufacturer, model, serial, status, checklist_id, notes)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(req.auth.tenant, name, assetTag ?? null, category ?? null, siteId ?? null, location ?? null,
           manufacturer ?? null, model ?? null, serial ?? null, status ?? "in_service", checklistId ?? null, notes ?? null);
    // Optional photo: store the image on disk, keep only the ref on the row.
    if (photo?.dataUrl) {
      const ref = storePhoto(req.auth.tenant, "asset", r.lastInsertRowid, photo);
      if (ref) db.prepare("UPDATE assets SET photo = ? WHERE id = ? AND tenant_id = ?")
        .run(JSON.stringify(ref), r.lastInsertRowid, req.auth.tenant);
    }
    res.json({ id: r.lastInsertRowid });
  });

  app.put("/api/assets/:id", auth, canManage, (req, res) => {
    const existing = db.prepare("SELECT id FROM assets WHERE id = ? AND tenant_id = ?").get(req.params.id, req.auth.tenant);
    if (!existing) return res.status(404).json({ error: "Asset not found" });
    const fields = ["name", "asset_tag", "category", "site_id", "location", "manufacturer", "model", "serial", "status", "checklist_id", "notes"];
    const map = { name: "name", assetTag: "asset_tag", category: "category", siteId: "site_id", location: "location",
                  manufacturer: "manufacturer", model: "model", serial: "serial", status: "status", checklistId: "checklist_id", notes: "notes" };
    const sets = [], args = [];
    for (const [k, col] of Object.entries(map)) {
      if (k in (req.body || {})) { sets.push(`${col} = ?`); args.push(req.body[k]); }
    }
    if (!sets.length && !req.body?.photo?.dataUrl) return res.json({ ok: true });
    if (sets.length) {
      args.push(req.params.id, req.auth.tenant);
      db.prepare(`UPDATE assets SET ${sets.join(", ")} WHERE id = ? AND tenant_id = ?`).run(...args);
    }
    // Replace the photo if a new one was supplied.
    if (req.body?.photo?.dataUrl) {
      const ref = storePhoto(req.auth.tenant, "asset", req.params.id, req.body.photo);
      if (ref) db.prepare("UPDATE assets SET photo = ? WHERE id = ? AND tenant_id = ?")
        .run(JSON.stringify(ref), req.params.id, req.auth.tenant);
    }
    res.json({ ok: true });
  });

  app.delete("/api/assets/:id", auth, canManage, (req, res) => {
    db.prepare("UPDATE assets SET active = 0 WHERE id = ? AND tenant_id = ?").run(req.params.id, req.auth.tenant);
    res.json({ ok: true });
  });

  // ── Procedures (LOTO / SOP) ─────────────────────────────────────────────────
  app.post("/api/assets/:id/procedures", auth, canManage, (req, res) => {
    const asset = db.prepare("SELECT id FROM assets WHERE id = ? AND tenant_id = ?").get(req.params.id, req.auth.tenant);
    if (!asset) return res.status(404).json({ error: "Asset not found" });
    const { kind, title, steps, body } = req.body || {};
    if (!["loto", "sop"].includes(kind)) return res.status(400).json({ error: "kind must be loto or sop" });
    if (!title) return res.status(400).json({ error: "title required" });
    const r = db.prepare(`INSERT INTO asset_procedures (tenant_id, asset_id, kind, title, steps, body)
                          VALUES (?,?,?,?,?,?)`)
      .run(req.auth.tenant, asset.id, kind, title, JSON.stringify(steps ?? []), body ?? null);
    res.json({ id: r.lastInsertRowid });
  });

  app.put("/api/procedures/:id", auth, canManage, (req, res) => {
    const existing = db.prepare("SELECT id FROM asset_procedures WHERE id = ? AND tenant_id = ?").get(req.params.id, req.auth.tenant);
    if (!existing) return res.status(404).json({ error: "Procedure not found" });
    const { title, steps, body } = req.body || {};
    const sets = [], args = [];
    if (title !== undefined) { sets.push("title = ?"); args.push(title); }
    if (steps !== undefined) { sets.push("steps = ?"); args.push(JSON.stringify(steps)); }
    if (body  !== undefined) { sets.push("body = ?");  args.push(body); }
    if (!sets.length) return res.json({ ok: true });
    args.push(req.params.id, req.auth.tenant);
    db.prepare(`UPDATE asset_procedures SET ${sets.join(", ")} WHERE id = ? AND tenant_id = ?`).run(...args);
    res.json({ ok: true });
  });

  app.delete("/api/procedures/:id", auth, canManage, (req, res) => {
    db.prepare("UPDATE asset_procedures SET active = 0 WHERE id = ? AND tenant_id = ?").run(req.params.id, req.auth.tenant);
    res.json({ ok: true });
  });
};

module.exports.assetDeepLink = assetDeepLink;
module.exports.assetQrSvg = assetQrSvg;
