import { useState, useEffect } from "react";
import { EHSHeader } from "./AppShell.jsx";
import { api } from "./api.js";

const C = {
  forest: "#1C3A2A", pine: "#2D5A3D", sage: "#4A8C5C", mint: "#A8D5B5",
  foam: "#E8F5EC", ink: "#0F1F17", slate: "#4A5568", mist: "#8FA3A0",
  chalk: "#F4F7F5", white: "#FFFFFF", gold: "#C8922A", red: "#C0392B", redLt: "#FDECEA",
};
const input = {
  width: "100%", padding: "9px 11px", border: "1.5px solid #D0DEDB", borderRadius: 7,
  fontFamily: "'DM Sans', sans-serif", fontSize: ".88rem", color: C.ink, outline: "none",
  background: C.white, boxSizing: "border-box",
};
const fmt$ = n => n == null ? "—" : "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2 });

export default function S5hOpsConsole({ onHome, onOpenBilling }) {
  const [tenants, setTenants] = useState(null);
  const [error, setError] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", industry: "", adminEmail: "", adminName: "" });
  const [created, setCreated] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => api.opTenants().then(setTenants).catch(err => setError(err.message));
  useEffect(load, []);

  async function handleCreate(e) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const out = await api.opCreateTenant(form);
      setCreated(out);
      setForm({ name: "", industry: "", adminEmail: "", adminName: "" });
      setShowAdd(false);
      load();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ minHeight: "100vh", background: C.chalk, fontFamily: "'DM Sans', sans-serif", paddingBottom: 80 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>
      <EHSHeader onHome={onHome} title="EHS DNA Operations" rightContent={
        <div style={{ fontSize: ".72rem", color: C.mist, background: "rgba(255,255,255,.08)", padding: "3px 12px", borderRadius: 20, whiteSpace: "nowrap" }}>Operator</div>
      } />

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "26px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 6 }}>
          <h1 style={{ fontSize: "1.35rem", fontWeight: 700, color: C.ink }}>Client companies</h1>
          <button onClick={() => { setShowAdd(s => !s); setCreated(null); }} style={{
            padding: "9px 20px", background: C.sage, color: "#fff", border: "none", borderRadius: 7,
            fontFamily: "'DM Sans', sans-serif", fontSize: ".85rem", fontWeight: 700, cursor: "pointer",
          }}>{showAdd ? "Cancel" : "+ Enroll company"}</button>
        </div>
        <p style={{ fontSize: ".84rem", color: C.mist, marginBottom: 18 }}>
          {tenants ? `${tenants.length} account${tenants.length === 1 ? "" : "s"}` : "Loading…"}
        </p>

        {error && <div style={{ marginBottom: 14, padding: "10px 14px", background: C.redLt, color: C.red, borderRadius: 8, fontSize: ".84rem" }}>{error}</div>}

        {created && (
          <div style={{ marginBottom: 16, padding: "12px 16px", background: C.foam, borderRadius: 8, fontSize: ".85rem", color: C.ink }}>
            Company enrolled. Admin login: <b>{created.adminEmail}</b> · temp password:{" "}
            <span style={{ fontFamily: "'DM Mono', monospace", background: C.white, padding: "2px 8px", borderRadius: 5 }}>{created.tempPassword}</span>
            {" "}— share securely; shown once.
          </div>
        )}

        {showAdd && (
          <form onSubmit={handleCreate} style={{
            background: C.white, borderRadius: 10, boxShadow: "0 2px 12px rgba(15,31,23,.07)",
            padding: 20, marginBottom: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12,
          }}>
            <input required placeholder="Company name" value={form.name} style={input}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <input placeholder="Industry" value={form.industry} style={input}
              onChange={e => setForm(f => ({ ...f, industry: e.target.value }))} />
            <input required type="email" placeholder="Admin email" value={form.adminEmail} style={input}
              onChange={e => setForm(f => ({ ...f, adminEmail: e.target.value }))} />
            <input placeholder="Admin name" value={form.adminName} style={input}
              onChange={e => setForm(f => ({ ...f, adminName: e.target.value }))} />
            <button type="submit" disabled={busy} style={{
              gridColumn: "1 / -1", padding: "10px 0", background: busy ? "#9BBBA6" : C.sage, color: "#fff",
              border: "none", borderRadius: 7, fontFamily: "'DM Sans', sans-serif", fontSize: ".88rem",
              fontWeight: 700, cursor: busy ? "default" : "pointer",
            }}>{busy ? "Enrolling…" : "Enroll company"}</button>
          </form>
        )}

        {(tenants ?? []).map(t => (
          <div key={t.id} style={{
            background: C.white, borderRadius: 12, boxShadow: "0 2px 12px rgba(15,31,23,.07)",
            padding: "16px 18px", marginBottom: 12,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
              <div>
                <div style={{ fontSize: "1rem", fontWeight: 700, color: C.ink }}>{t.name}</div>
                <div style={{ fontSize: ".76rem", color: C.mist, marginTop: 2 }}>
                  {t.industry ?? "—"} · {t.sites} sites · {t.users} users · since {(t.created ?? "").slice(0, 10)}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: ".95rem", fontWeight: 800, color: C.pine }}>{fmt$(t.estMonthly)}<span style={{ fontSize: ".7rem", color: C.mist, fontWeight: 500 }}>/mo est.</span></div>
                {t.lastInvoice && (
                  <div style={{ fontSize: ".72rem", color: C.mist }}>
                    Last: {t.lastInvoice.ref} · {t.lastInvoice.status} · {fmt$(t.lastInvoice.total)}
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <button onClick={() => onOpenBilling?.(t.id, t.name)} style={{
                padding: "7px 16px", background: C.foam, color: C.pine, border: `1.5px solid ${C.mint}`,
                borderRadius: 7, fontFamily: "'DM Sans', sans-serif", fontSize: ".8rem", fontWeight: 700, cursor: "pointer",
              }}>Billing & invoices →</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
