import { COLORS, BILLABLE_MODULES } from "./constants.js";
import { useState, useEffect } from "react";
import { EHSHeader } from "./AppShell.jsx";
import { api } from "./api.js";
import { getToken } from "./api.js";

const C = { ...COLORS, purple: "#7C5CBF" };

const input = {
  width: "100%", padding: "9px 11px", border: "1.5px solid #D0DEDB", borderRadius: 7,
  fontFamily: "'DM Sans', sans-serif", fontSize: ".88rem", color: C.ink,
  outline: "none", background: C.white, boxSizing: "border-box",
};
const label = {
  fontSize: ".68rem", fontWeight: 600, letterSpacing: ".06em",
  textTransform: "uppercase", color: C.sage, marginBottom: 5, display: "block",
};
const btn = (bg = C.sage, color = "#fff") => ({
  padding: "8px 16px", background: bg, color, border: "none", borderRadius: 7,
  fontFamily: "'DM Sans', sans-serif", fontSize: ".82rem", fontWeight: 700, cursor: "pointer",
});

const fmt$ = n => "$" + Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 });
const STATUS_STYLE = {
  draft:    { bg: "#EEF2F0", fg: C.slate },
  approved: { bg: C.goldLt,  fg: C.gold  },
  sent:     { bg: "#EAF0FD", fg: "#3B5FC0" },
  paid:     { bg: C.foam,    fg: C.pine  },
  void:     { bg: C.redLt,   fg: C.red   },
};

function Card({ title, right, children }) {
  return (
    <div style={{ background: C.white, borderRadius: 10, boxShadow: "0 2px 12px rgba(15,31,23,.07)", padding: 20, marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ fontSize: ".98rem", fontWeight: 700, color: C.ink }}>{title}</h2>
        {right}
      </div>
      {children}
    </div>
  );
}

export default function S5gBilling({ companyName, onHome, onBack, tenantId = null, tenantName = null }) {
  const [cfg, setCfg]         = useState(null);
  const [adjs, setAdjs]       = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [error, setError]     = useState(null);
  const [saved, setSaved]     = useState(false);
  const [period, setPeriod]   = useState(new Date().toISOString().slice(0, 7));
  const [newAdj, setNewAdj]   = useState({ kind: "credit", amount: "", description: "", recurring: false });

  // module_prices is stored as a JSON string on the config; parse to an object for
  // editing and back to an object of numbers on save.
  function moduleprices() { try { return JSON.parse(cfg?.module_prices || "{}"); } catch { return {}; } }
  function parseModulePrices(raw) { try { return typeof raw === "string" ? JSON.parse(raw || "{}") : (raw || {}); } catch { return {}; } }
  function setModulePrice(key, val) {
    const mp = moduleprices();
    if (val === "" || Number(val) === 0) delete mp[key]; else mp[key] = Number(val);
    setCfg(c => ({ ...c, module_prices: JSON.stringify(mp) })); setSaved(false);
  }

  function loadAll() {
    Promise.all([api.billingConfig(tenantId), api.billingAdjustments(tenantId), api.billingInvoices(tenantId)])
      .then(([c, a, i]) => { setCfg(c); setAdjs(a); setInvoices(i); })
      .catch(err => setError(err.message));
  }
  useEffect(loadAll, []);

  async function saveCfg() {
    setError(null); setSaved(false);
    try {
      await api.updateBillingConfig({
        basePrice: Number(cfg.base_price), perSite: Number(cfg.per_site),
        perUser: Number(cfg.per_user), autoApprove: !!cfg.auto_approve,
        billingContact: cfg.billing_contact,
        modulePrices: parseModulePrices(cfg.module_prices),
      }, tenantId);
      setSaved(true);
    } catch (err) { setError(err.message); }
  }

  async function addAdj(e) {
    e.preventDefault();
    setError(null);
    try {
      await api.createBillingAdjustment({ ...newAdj, amount: Number(newAdj.amount) }, tenantId);
      setNewAdj({ kind: "credit", amount: "", description: "", recurring: false });
      loadAll();
    } catch (err) { setError(err.message); }
  }

  async function generate() {
    setError(null);
    try { await api.generateInvoice(period, tenantId); loadAll(); }
    catch (err) { setError(err.message); }
  }

  async function move(inv, status) {
    setError(null);
    try { await api.updateInvoice(inv.id, status, tenantId); loadAll(); }
    catch (err) { setError(err.message); }
  }

  function openPrint(inv) {
    // print route needs the auth header — fetch then open as blob
    fetch(`/api/billing/invoices/${inv.id}/print${tenantId ? `?tenantId=${tenantId}` : ""}`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.text())
      .then(html => {
        const w = window.open("", "_blank");
        w.document.write(html); w.document.close();
      })
      .catch(err => setError(err.message));
  }

  const NEXT = { draft: ["approved", "void"], approved: ["sent", "void", "draft"], sent: ["paid", "void"], paid: [], void: [] };
  const VERB = { approved: "Approve", sent: "Mark sent", paid: "Mark paid", void: "Void", draft: "Back to draft" };

  if (!cfg) return (
    <div style={{ minHeight: "100vh", background: C.chalk, fontFamily: "'DM Sans', sans-serif" }}>
      <EHSHeader onHome={onHome} onBack={onBack} title={companyName} />
      <div style={{ padding: 40, textAlign: "center", color: C.mist }}>{error ?? "Loading…"}</div>
    </div>
  );

  const previewSites = "configured active sites", previewUsers = "configured active users";

  return (
    <div style={{ minHeight: "100vh", background: C.chalk, fontFamily: "'DM Sans', sans-serif", paddingBottom: 80 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input::placeholder { color: ${C.mist}; }
      `}</style>

      <EHSHeader onHome={onHome} onBack={onBack} title={companyName} rightContent={
        <div style={{ fontSize: ".72rem", color: C.mist, background: "rgba(255,255,255,.08)", padding: "3px 12px", borderRadius: 20, whiteSpace: "nowrap" }}>Billing</div>
      } />

      <div style={{ maxWidth: 820, margin: "0 auto", padding: "26px 20px" }}>
        <h1 style={{ fontSize: "1.35rem", fontWeight: 700, color: C.ink, marginBottom: 4 }}>Billing{tenantName ? ` — ${tenantName}` : ""}</h1>
        <p style={{ fontSize: ".84rem", color: C.mist, marginBottom: 20 }}>
          Charges are computed from configured active sites and users at generation time.
        </p>

        {error && <div style={{ marginBottom: 14, padding: "10px 14px", background: C.redLt, color: C.red, borderRadius: 8, fontSize: ".84rem" }}>{error}</div>}

        <Card title="Pricing" right={
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {saved && <span style={{ fontSize: ".78rem", color: C.sage, fontWeight: 700 }}>✓ Saved</span>}
            <button style={btn()} onClick={saveCfg}>Save</button>
          </div>
        }>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
            <div><span style={label}>Base / month</span>
              <input style={input} type="number" step="0.01" value={cfg.base_price}
                onChange={e => { setCfg(c => ({ ...c, base_price: e.target.value })); setSaved(false); }} /></div>
            <div><span style={label}>Per additional site</span>
              <input style={input} type="number" step="0.01" value={cfg.per_site}
                onChange={e => { setCfg(c => ({ ...c, per_site: e.target.value })); setSaved(false); }} /></div>
            <div><span style={label}>Per user</span>
              <input style={input} type="number" step="0.01" value={cfg.per_user}
                onChange={e => { setCfg(c => ({ ...c, per_user: e.target.value })); setSaved(false); }} /></div>
          </div>
          <div style={{ fontSize: ".74rem", color: C.mist, marginTop: 8 }}>
            The base license includes the first site. Only additional sites are billed the per-site rate. Leave per-user at 0 for flat/modular pricing.
          </div>
          <div style={{ marginTop: 12 }}>
            <div><span style={label}>Billing contact</span>
              <input style={input} value={cfg.billing_contact ?? ""}
                onChange={e => { setCfg(c => ({ ...c, billing_contact: e.target.value })); setSaved(false); }} /></div>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: ".85rem", color: C.ink, marginTop: 14 }}>
            <input type="checkbox" checked={!!cfg.auto_approve} style={{ width: 15, height: 15, accentColor: C.sage }}
              onChange={e => { setCfg(c => ({ ...c, auto_approve: e.target.checked ? 1 : 0 })); setSaved(false); }} />
            Auto-approve generated invoices (skips the review gate)
          </label>

          {/* Per-module pricing — each enabled module with a price becomes its own
              invoice line item. Leave blank/0 to not charge for a module. */}
          <div style={{ marginTop: 18, borderTop: "1px solid #F0F4F2", paddingTop: 14 }}>
            <div style={{ fontSize: ".78rem", fontWeight: 700, color: C.ink, marginBottom: 4 }}>Per-module pricing</div>
            <div style={{ fontSize: ".76rem", color: C.mist, marginBottom: 12 }}>
              Monthly charge per module. Only modules the tenant has enabled are billed.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
              {BILLABLE_MODULES.map(m => (
                <div key={m.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: ".82rem", color: C.ink }}>{m.label}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: ".82rem", color: C.mist }}>$</span>
                    <input type="number" step="0.01" min="0" value={moduleprices()[m.key] ?? ""}
                      placeholder="0"
                      onChange={e => setModulePrice(m.key, e.target.value)}
                      style={{ ...input, width: 80, textAlign: "right" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card title="Credits & discounts">
          {adjs.length === 0 && <p style={{ fontSize: ".82rem", color: C.mist, marginBottom: 12 }}>None active.</p>}
          {adjs.map(a => (
            <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #F0F4F2", fontSize: ".85rem" }}>
              <div>
                <b style={{ color: C.ink }}>{a.description || (a.kind === "credit" ? "Credit" : "Discount")}</b>
                <span style={{ color: C.mist, marginLeft: 8 }}>
                  {a.kind === "discount_pct" ? `${a.amount}%` : fmt$(a.amount)} · {a.recurring ? "recurring" : a.consumed_invoice_id ? "used" : "one-time"}
                </span>
              </div>
              <button style={btn("#EEF2F0", C.slate)} onClick={() => api.deleteBillingAdjustment(a.id, tenantId).then(loadAll)}>Remove</button>
            </div>
          ))}
          <form onSubmit={addAdj} style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14, alignItems: "center" }}>
            <select style={{ ...input, width: 150 }} value={newAdj.kind} onChange={e => setNewAdj(a => ({ ...a, kind: e.target.value }))}>
              <option value="credit">Credit ($)</option>
              <option value="discount_flat">Discount ($)</option>
              <option value="discount_pct">Discount (%)</option>
            </select>
            <input style={input} required type="number" step="0.01" min="0.01" placeholder="Amount"
              value={newAdj.amount} onChange={e => setNewAdj(a => ({ ...a, amount: e.target.value }))} />
            <input style={input} placeholder="Description" value={newAdj.description}
              onChange={e => setNewAdj(a => ({ ...a, description: e.target.value }))} />
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: ".8rem", color: C.slate, whiteSpace: "nowrap" }}>
              <input type="checkbox" checked={newAdj.recurring} style={{ accentColor: C.sage }}
                onChange={e => setNewAdj(a => ({ ...a, recurring: e.target.checked }))} /> recurring
            </label>
            <button type="submit" style={btn(C.foam, C.pine)}>+ Add</button>
          </form>
        </Card>

        <Card title="Invoices" right={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input style={{ ...input, width: 130 }} type="month" value={period} onChange={e => setPeriod(e.target.value)} />
            <button style={btn()} onClick={generate}>Generate</button>
          </div>
        }>
          {invoices.length === 0 && <p style={{ fontSize: ".82rem", color: C.mist }}>No invoices yet — pick a period and hit Generate.</p>}
          {invoices.map(inv => {
            const st = STATUS_STYLE[inv.status] ?? STATUS_STYLE.draft;
            return (
              <div key={inv.id} style={{ padding: "12px 0", borderBottom: "1px solid #F0F4F2" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 600, color: C.ink, fontSize: ".88rem" }}>{inv.ref}</span>
                    <span style={{ marginLeft: 10, fontSize: ".8rem", color: C.mist }}>{inv.period}</span>
                    <span style={{ marginLeft: 10, fontSize: ".7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", background: st.bg, color: st.fg, padding: "3px 10px", borderRadius: 20 }}>{inv.status}</span>
                  </div>
                  <b style={{ color: C.ink, fontSize: ".95rem" }}>{fmt$(inv.total)}</b>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  <button style={btn("#EEF2F0", C.slate)} onClick={() => openPrint(inv)}>View / Print</button>
                  {(NEXT[inv.status] ?? []).map(s => (
                    <button key={s} style={btn(s === "void" ? C.redLt : C.foam, s === "void" ? C.red : C.pine)} onClick={() => move(inv, s)}>{VERB[s]}</button>
                  ))}
                </div>
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}
