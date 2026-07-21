/**
 * EHS DNA — Billing module.
 * Pricing = base + per-site + per-user, using CONFIGURED (active) sites/users,
 * not usage. Per-tenant rates, credits/discounts, draft→approved→sent→paid
 * workflow with optional auto-approve. Invoice renders as printable HTML
 * (browser print → PDF).
 */
module.exports = function mountBilling(app, db, auth, requireRole) {
  const { MODULES, LIVE_MODULES } = require("./modules.cjs");
  const ADMIN = requireRole("admin");
  // Operators can act on any tenant; everyone else is pinned to their own.
  const tenantOf = (req) => {
    const want = Number(req.query.tenantId ?? req.body?.tenantId);
    return (req.auth.op && want) ? want : tenantOf(req);
  };
  const money = n => Math.round(n * 100) / 100;

  // ── Config ──────────────────────────────────────────────────────────────
  app.get("/api/billing/config", auth, ADMIN, (req, res) =>
    res.json(db.prepare("SELECT * FROM billing_config WHERE tenant_id = ?").get(tenantOf(req)) ?? {}));

  app.put("/api/billing/config", auth, ADMIN, (req, res) => {
    const { basePrice, perSite, perUser, modulePrices, autoApprove, billingContact, notes } = req.body || {};
    // Validate module_prices: only known live modules, non-negative numbers.
    let modulePricesJson;
    if (modulePrices !== undefined) {
      const clean = {};
      for (const [k, v] of Object.entries(modulePrices || {})) {
        if (LIVE_MODULES.includes(k)) {
          const n = Number(v);
          if (Number.isFinite(n) && n >= 0) clean[k] = Math.round(n * 100) / 100;
        }
      }
      modulePricesJson = JSON.stringify(clean);
    }
    db.prepare(`UPDATE billing_config SET
                base_price = COALESCE(?, base_price), per_site = COALESCE(?, per_site),
                per_user = COALESCE(?, per_user), module_prices = COALESCE(?, module_prices),
                auto_approve = COALESCE(?, auto_approve),
                billing_contact = COALESCE(?, billing_contact), notes = COALESCE(?, notes)
                WHERE tenant_id = ?`)
      .run(basePrice, perSite, perUser, modulePricesJson ?? null,
           autoApprove === undefined ? null : (autoApprove ? 1 : 0),
           billingContact, notes, tenantOf(req));
    res.json({ ok: true });
  });

  // ── Adjustments (credits & discounts) ───────────────────────────────────
  app.get("/api/billing/adjustments", auth, ADMIN, (req, res) =>
    res.json(db.prepare("SELECT * FROM billing_adjustments WHERE tenant_id = ? AND active = 1 ORDER BY created_at DESC").all(tenantOf(req))));

  app.post("/api/billing/adjustments", auth, ADMIN, (req, res) => {
    const { kind, amount, description, recurring } = req.body || {};
    if (!["credit", "discount_flat", "discount_pct"].includes(kind) || !(amount > 0))
      return res.status(400).json({ error: "kind (credit|discount_flat|discount_pct) and positive amount required" });
    const r = db.prepare("INSERT INTO billing_adjustments (tenant_id, kind, amount, description, recurring) VALUES (?, ?, ?, ?, ?)")
      .run(tenantOf(req), kind, amount, description ?? null, recurring ? 1 : 0);
    res.json({ id: r.lastInsertRowid });
  });

  app.delete("/api/billing/adjustments/:id", auth, ADMIN, (req, res) => {
    db.prepare("UPDATE billing_adjustments SET active = 0 WHERE id = ? AND tenant_id = ?").run(req.params.id, tenantOf(req));
    res.json({ ok: true });
  });

  // ── Invoice generation ──────────────────────────────────────────────────
  app.post("/api/billing/invoices/generate", auth, ADMIN, (req, res) => {
    const t = tenantOf(req);
    const period = req.body?.period ?? new Date().toISOString().slice(0, 7); // YYYY-MM
    if (!/^\d{4}-\d{2}$/.test(period)) return res.status(400).json({ error: "period must be YYYY-MM" });
    if (db.prepare("SELECT id FROM invoices WHERE tenant_id = ? AND period = ?").get(t, period))
      return res.status(409).json({ error: `Invoice for ${period} already exists` });

    const cfg = db.prepare("SELECT * FROM billing_config WHERE tenant_id = ?").get(t);
    if (!cfg) return res.status(400).json({ error: "No billing config for this account" });

    // "Active" = configured, not usage-based
    const sites = db.prepare("SELECT COUNT(*) n FROM sites WHERE tenant_id = ? AND active = 1").get(t).n;
    const users = db.prepare("SELECT COUNT(*) n FROM users WHERE tenant_id = ? AND active = 1").get(t).n;

    // The base license includes the first site; only ADDITIONAL sites are charged.
    const billableSites = Math.max(0, sites - 1);
    const lineItems = [
      { label: "Platform base license (includes 1st site)", qty: 1, rate: cfg.base_price, amount: money(cfg.base_price) },
    ];
    if (billableSites > 0) {
      lineItems.push({ label: "Additional sites", qty: billableSites, rate: cfg.per_site, amount: money(billableSites * cfg.per_site) });
    }
    if (cfg.per_user > 0) {
      lineItems.push({ label: "Active users", qty: users, rate: cfg.per_user, amount: money(users * cfg.per_user) });
    }

    // Per-module charges: a line item for each ENABLED, priced module. Enablement =
    // explicit tenant_modules row, else the registry default. This bills the tenant
    // for exactly the modules they have turned on.
    let modulePrices = {};
    try { modulePrices = JSON.parse(cfg.module_prices || "{}"); } catch { modulePrices = {}; }
    if (Object.keys(modulePrices).length) {
      const rows = db.prepare("SELECT module, enabled FROM tenant_modules WHERE tenant_id = ?").all(t);
      const explicit = new Map(rows.map(r => [r.module, r.enabled === 1]));
      for (const key of LIVE_MODULES) {
        const price = Number(modulePrices[key]) || 0;
        if (price <= 0) continue;
        const on = explicit.has(key) ? explicit.get(key) : (MODULES[key].default !== false);
        if (!on) continue;
        lineItems.push({ label: `${MODULES[key].label} module`, qty: 1, rate: price, amount: money(price) });
      }
    }

    const filteredItems = lineItems.filter(li => li.amount > 0 || li.qty > 0);
    const subtotal = money(filteredItems.reduce((n, li) => n + li.amount, 0));

    // Apply adjustments: recurring always; one-time only if unconsumed
    const adjRows = db.prepare(`SELECT * FROM billing_adjustments WHERE tenant_id = ? AND active = 1
                                AND (recurring = 1 OR consumed_invoice_id IS NULL)`).all(t);
    const adjustments = [];
    let total = subtotal;
    for (const a of adjRows) {
      let amt = a.kind === "discount_pct" ? money(subtotal * a.amount / 100) : money(a.amount);
      amt = Math.min(amt, total);                       // never below zero
      if (amt <= 0) continue;
      adjustments.push({ id: a.id, label: a.description ?? (a.kind === "credit" ? "Credit" : "Discount"), amount: -amt, recurring: !!a.recurring });
      total = money(total - amt);
    }

    const count = db.prepare("SELECT COUNT(*) n FROM invoices WHERE tenant_id = ? AND period LIKE ?").get(t, period.slice(0, 4) + "%").n;
    const ref = `INV-${period}-${String(count + 1).padStart(3, "0")}`;
    const autoStatus = cfg.auto_approve ? "approved" : "draft";

    const tx = db.transaction(() => {
      const r = db.prepare(`INSERT INTO invoices (tenant_id, ref, period, status, line_items, subtotal, adjustments, total, approved_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? THEN datetime('now') ELSE NULL END)`)
        .run(t, ref, period, autoStatus, JSON.stringify(filteredItems), subtotal, JSON.stringify(adjustments), total, cfg.auto_approve ? 1 : 0);
      // consume one-time adjustments
      adjustments.filter(a => !a.recurring).forEach(a =>
        db.prepare("UPDATE billing_adjustments SET consumed_invoice_id = ? WHERE id = ?").run(r.lastInsertRowid, a.id));
      return r.lastInsertRowid;
    });
    const id = tx();
    res.json({ id, ref, period, status: autoStatus, subtotal, total });
  });

  // ── Invoice list & status workflow ──────────────────────────────────────
  app.get("/api/billing/invoices", auth, ADMIN, (req, res) =>
    res.json(db.prepare("SELECT * FROM invoices WHERE tenant_id = ? ORDER BY period DESC").all(tenantOf(req))));

  const TRANSITIONS = {
    draft:    ["approved", "void"],
    approved: ["sent", "void", "draft"],
    sent:     ["paid", "void"],
    paid:     [],
    void:     [],
  };
  app.put("/api/billing/invoices/:id", auth, ADMIN, (req, res) => {
    const inv = db.prepare("SELECT * FROM invoices WHERE id = ? AND tenant_id = ?").get(req.params.id, tenantOf(req));
    if (!inv) return res.status(404).json({ error: "Invoice not found" });
    const next = req.body?.status;
    if (!TRANSITIONS[inv.status]?.includes(next))
      return res.status(400).json({ error: `Cannot move ${inv.status} → ${next}` });
    const stampCol = { approved: "approved_at", sent: "sent_at", paid: "paid_at" }[next];
    db.prepare(`UPDATE invoices SET status = ?${stampCol ? `, ${stampCol} = datetime('now')` : ""} WHERE id = ?`)
      .run(next, inv.id);
    res.json({ ok: true, status: next });
  });

  // ── Printable invoice (browser print → PDF) ─────────────────────────────
  app.get("/api/billing/invoices/:id/print", auth, ADMIN, (req, res) => {
    const inv = db.prepare("SELECT * FROM invoices WHERE id = ? AND tenant_id = ?").get(req.params.id, tenantOf(req));
    if (!inv) return res.status(404).send("Not found");
    const tenant = db.prepare("SELECT * FROM tenants WHERE id = ?").get(inv.tenant_id);
    const cfg = db.prepare("SELECT * FROM billing_config WHERE tenant_id = ?").get(inv.tenant_id);
    const items = JSON.parse(inv.line_items);
    const adjs = JSON.parse(inv.adjustments || "[]");
    const fmt = n => "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2 });
    // Escape user-controlled strings (tenant name, billing contact, adjustment
    // labels) before interpolating into the invoice HTML.
    const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const periodLabel = new Date(inv.period + "-15").toLocaleDateString("en-US", { month: "long", year: "numeric" });
    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${inv.ref}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&family=DM+Mono&display=swap');
  body{font-family:'DM Sans',sans-serif;color:#0F1F17;max-width:720px;margin:40px auto;padding:0 24px;}
  .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1C3A2A;padding-bottom:18px;}
  .logo{font-family:'DM Mono',monospace;font-size:1.3rem;font-weight:600;color:#1C3A2A;}
  .logo b{color:#4A8C5C;}
  h1{font-size:1.1rem;margin:0;color:#4A5568;text-align:right;}
  .ref{font-family:'DM Mono',monospace;color:#4A8C5C;font-weight:600;}
  table{width:100%;border-collapse:collapse;margin-top:28px;}
  th{font-size:.7rem;letter-spacing:.08em;text-transform:uppercase;color:#8FA3A0;text-align:left;padding:8px 10px;border-bottom:1.5px solid #E2EBE6;}
  td{padding:10px;border-bottom:1px solid #F0F4F2;font-size:.92rem;}
  .r{text-align:right;} .tot td{font-weight:800;font-size:1.05rem;border-top:2px solid #1C3A2A;border-bottom:none;}
  .adj td{color:#4A8C5C;}
  .meta{margin-top:22px;font-size:.85rem;color:#4A5568;line-height:1.7;}
  .status{display:inline-block;padding:3px 12px;border-radius:20px;background:#E8F5EC;color:#2D5A3D;font-weight:700;font-size:.75rem;text-transform:uppercase;letter-spacing:.06em;}
  @media print {.noprint{display:none;}}
  .noprint{margin-top:30px;} .noprint button{padding:10px 22px;background:#4A8C5C;color:#fff;border:none;border-radius:8px;font-size:.9rem;font-weight:700;cursor:pointer;}
</style></head><body>
<div class="head">
  <div>
    <div class="logo">🧬 <b>EHS</b> DNA</div>
    <div class="meta">Billed to: <b>${esc(tenant.name)}</b><br>${esc(cfg?.billing_contact ?? "")}</div>
  </div>
  <div>
    <h1>INVOICE</h1>
    <div class="meta" style="text-align:right;">
      <span class="ref">${inv.ref}</span><br>
      Period: ${periodLabel}<br>
      Issued: ${(inv.generated_at ?? "").slice(0, 10)}<br>
      <span class="status">${inv.status}</span>
    </div>
  </div>
</div>
<table>
  <tr><th>Description</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr>
  ${items.map(li => `<tr><td>${esc(li.label)}</td><td class="r">${li.qty}</td><td class="r">${fmt(li.rate)}</td><td class="r">${fmt(li.amount)}</td></tr>`).join("")}
  <tr><td colspan="3" class="r"><b>Subtotal</b></td><td class="r"><b>${fmt(inv.subtotal)}</b></td></tr>
  ${adjs.map(a => `<tr class="adj"><td colspan="3" class="r">${esc(a.label)}</td><td class="r">${fmt(a.amount)}</td></tr>`).join("")}
  <tr class="tot"><td colspan="3" class="r">Total due</td><td class="r">${fmt(inv.total)}</td></tr>
</table>
<div class="meta">Payment terms: Net 30. Questions: ${esc(cfg?.billing_contact ?? "your administrator")}.</div>
<div class="noprint"><button onclick="window.print()">Print / Save as PDF</button></div>
</body></html>`);
  });
};
