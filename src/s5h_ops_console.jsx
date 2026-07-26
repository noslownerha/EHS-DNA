import { COLORS } from "./constants.js";
import { useState, useEffect } from "react";
import { EHSHeader } from "./AppShell.jsx";
import { api, setToken } from "./api.js";

const C = { ...COLORS };
const input = {
  width: "100%", padding: "9px 11px", border: "1.5px solid #D0DEDB", borderRadius: 7,
  fontFamily: "'DM Sans', sans-serif", fontSize: ".88rem", color: C.ink, outline: "none",
  background: C.white, boxSizing: "border-box",
};
const fmt$ = n => n == null ? "—" : "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2 });

export default function S5hOpsConsole({ section = "attention", onHome, onOpenBilling }) {
  const [tenants, setTenants] = useState(null);
  const [error, setError] = useState(null);
  // Section is driven by the operator's nav tab (see OPERATOR_TABS) rather than
  // local state, so the console navigates like the rest of the app.
  const opsTab = section;
  const [attention, setAttention] = useState(null);
  const [billingOverview, setBillingOverview] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", industry: "", adminEmail: "", adminName: "" });
  const [created, setCreated] = useState(null);
  const [busy, setBusy] = useState(false);
  const [openUsers, setOpenUsers] = useState(null);   // tenantId whose users are expanded
  const [userRows, setUserRows] = useState([]);
  const [openModules, setOpenModules] = useState(null); // tenantId whose modules are expanded
  const [moduleData, setModuleData] = useState(null);   // { modules:[], reserved:[] }
  const [moduleBusy, setModuleBusy] = useState(null);   // module key mid-toggle
  const [resetInfo, setResetInfo] = useState(null);   // { email, tempPassword }
  const [openPacks, setOpenPacks] = useState(null);   // tenantId whose pack picker is open
  const [packList, setPackList] = useState(null);     // available packs (fetched once)
  const [packBusy, setPackBusy] = useState(null);     // packId mid-apply

  async function togglePacks(t) {
    if (openPacks === t.id) { setOpenPacks(null); return; }
    setOpenPacks(t.id);
    if (!packList) {
      try { const d = await api.opTemplatePacks(); setPackList(d.packs); }
      catch (err) { setError(err.message); }
    }
  }
  async function applyPack(tenantId, pack) {
    if (!window.confirm(`Add the "${pack.label}" starter pack to this account?\n\n${pack.checklistCount} inspection checklists and ${pack.trainingCount} training courses will be created — all editable afterward. Items with a name already present are skipped.`)) return;
    setPackBusy(pack.id);
    try {
      const r = await api.opApplyTemplatePack(pack.id, tenantId);
      window.alert(`Added ${r.checklistsAdded} checklist(s) and ${r.trainingsAdded} training(s).${r.skipped ? ` Skipped ${r.skipped} already present.` : ""}`);
    } catch (err) { setError(err.message); }
    finally { setPackBusy(null); }
  }

  async function toggleModules(t) {
    if (openModules === t.id) { setOpenModules(null); return; }
    setOpenModules(t.id); setModuleData(null);
    try { setModuleData(await api.opTenantModules(t.id)); }
    catch (err) { setError(err.message); }
  }
  async function flipModule(tenantId, key, next) {
    setModuleBusy(key);
    try {
      await api.opSetTenantModule(tenantId, key, next);
      setModuleData(await api.opTenantModules(tenantId));
    } catch (err) { setError(err.message); }
    finally { setModuleBusy(null); }
  }

  async function toggleUsers(t) {
    if (openUsers === t.id) { setOpenUsers(null); return; }
    setUserRows(await api.opTenantUsers(t.id));
    setOpenUsers(t.id);
  }

  async function enterApp(t) {
    try {
      // Save the operator's own token BEFORE impersonation swaps it
      sessionStorage.setItem("ehs_operator_token", localStorage.getItem("ehs_token"));
      sessionStorage.setItem("ehs_operator_user", sessionStorage.getItem("ehs_user"));
      const user = await api.opImpersonate(t.id);   // stores the impersonation token itself
      sessionStorage.setItem("ehs_user", JSON.stringify(user));
      window.location.reload();
    } catch (err) {
      sessionStorage.removeItem("ehs_operator_token");
      setError(err.message);
    }
  }

  const [leads, setLeads] = useState([]);
  const [showLeads, setShowLeads] = useState(false);
  const load = () => {
    api.opTenants().then(setTenants).catch(err => setError(err.message));
    api.opLeads().then(setLeads).catch(() => {});
    api.opAnalytics().then(setAnalytics).catch(() => {});
    api.opAttention().then(setAttention).catch(() => setAttention({ items: [], counts: {} }));
    api.opBillingOverview().then(setBillingOverview).catch(() => {});
  };
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
        {opsTab === "attention" && <OperatorAttention data={attention} onOpenTenantBilling={onOpenBilling} />}
        {opsTab === "overview" && <OperatorOverview analytics={analytics} />}
        {opsTab === "billing" && <OperatorBilling data={billingOverview} onOpenTenantBilling={onOpenBilling} />}

        {opsTab === "companies" && (<>
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

        {/* Sales leads from the marketing site */}
        <div style={{ background: C.white, borderRadius: 12, boxShadow: "0 2px 12px rgba(15,31,23,.07)", padding: "16px 18px", marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
            onClick={() => setShowLeads(s => !s)}>
            <div style={{ fontSize: ".98rem", fontWeight: 700, color: C.ink }}>
              🎯 Demo requests <span style={{ color: C.mist, fontWeight: 500 }}>({leads.length})</span>
            </div>
            <span style={{ color: C.sage, fontWeight: 700 }}>{showLeads ? "▾" : "▸"}</span>
          </div>
          {showLeads && (
            <div style={{ marginTop: 10, borderTop: "1px solid #F0F4F2" }}>
              {leads.length === 0 && <p style={{ padding: "12px 0", fontSize: ".82rem", color: C.mist }}>No leads yet — they'll appear here and in your bell the moment the form is submitted.</p>}
              {leads.map(l => (
                <div key={l.id} style={{ padding: "10px 0", borderBottom: "1px solid #F5F8F6", fontSize: ".84rem" }}>
                  <b style={{ color: C.ink }}>{l.company || l.name || "—"}</b>
                  <span style={{ color: C.slate, marginLeft: 8 }}>{l.name} · <a href={`mailto:${l.email}`} style={{ color: C.sage }}>{l.email}</a></span>
                  {l.message && <span style={{ color: C.mist, marginLeft: 8 }}>{l.message}</span>}
                  <div style={{ fontSize: ".7rem", color: C.mist, marginTop: 2 }}>{(l.created_at ?? "").slice(0, 16).replace("T", " ")}</div>
                </div>
              ))}
            </div>
          )}
        </div>

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
            padding: 20, marginBottom: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12,
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
              <button onClick={() => enterApp(t)} style={{
                padding: "7px 16px", background: C.forest, color: C.mint, border: "none",
                borderRadius: 7, fontFamily: "'DM Sans', sans-serif", fontSize: ".8rem", fontWeight: 700, cursor: "pointer",
              }}>Enter app →</button>
              <button onClick={() => toggleUsers(t)} style={{
                padding: "7px 16px", background: "#EEF2F0", color: C.slate, border: "none",
                borderRadius: 7, fontFamily: "'DM Sans', sans-serif", fontSize: ".8rem", fontWeight: 700, cursor: "pointer",
              }}>{openUsers === t.id ? "Hide users" : "Users"}</button>
              <button onClick={() => toggleModules(t)} style={{
                padding: "7px 16px", background: "#EEF2F0", color: C.slate, border: "none",
                borderRadius: 7, fontFamily: "'DM Sans', sans-serif", fontSize: ".8rem", fontWeight: 700, cursor: "pointer",
              }}>{openModules === t.id ? "Hide modules" : "Modules"}</button>
              <button onClick={() => togglePacks(t)} style={{
                padding: "7px 16px", background: "#EEF2F0", color: C.slate, border: "none",
                borderRadius: 7, fontFamily: "'DM Sans', sans-serif", fontSize: ".8rem", fontWeight: 700, cursor: "pointer",
              }}>{openPacks === t.id ? "Hide templates" : "Templates"}</button>
              {t.active ? (
                <>
                  <button onClick={async () => {
                    if (!window.confirm(`Pause ${t.name} for non-payment?\n\nTheir entire team will be locked out immediately and shown a message to have Accounts Payable contact billing. Reversible anytime.`)) return;
                    await api.opSetTenantStatus(t.id, false, "billing"); load();
                  }} style={{
                    padding: "7px 16px", background: "#FBECEC", color: C.red,
                    border: "none", borderRadius: 7, fontFamily: "'DM Sans', sans-serif", fontSize: ".8rem", fontWeight: 700, cursor: "pointer",
                  }}>Pause — billing</button>
                  <button onClick={async () => {
                    if (!window.confirm(`Suspend ${t.name}?\n\nTheir entire team will be locked out immediately with a generic support message. Reversible anytime.`)) return;
                    await api.opSetTenantStatus(t.id, false, "other"); load();
                  }} style={{
                    padding: "7px 16px", background: "#EEF2F0", color: C.slate,
                    border: "none", borderRadius: 7, fontFamily: "'DM Sans', sans-serif", fontSize: ".8rem", fontWeight: 700, cursor: "pointer",
                  }}>Suspend</button>
                </>
              ) : (
                <button onClick={async () => { await api.opSetTenantStatus(t.id, true); load(); }} style={{
                  padding: "7px 16px", background: C.foam, color: C.pine,
                  border: "none", borderRadius: 7, fontFamily: "'DM Sans', sans-serif", fontSize: ".8rem", fontWeight: 700, cursor: "pointer",
                }}>Reactivate</button>
              )}
              <button onClick={() => onOpenBilling?.(t.id, t.name)} style={{
                padding: "7px 16px", background: C.foam, color: C.pine, border: `1.5px solid ${C.mint}`,
                borderRadius: 7, fontFamily: "'DM Sans', sans-serif", fontSize: ".8rem", fontWeight: 700, cursor: "pointer",
              }}>Billing & invoices →</button>
            </div>
            {!t.active && <div style={{ marginTop: 8, fontSize: ".74rem", color: C.red, fontWeight: 700 }}>⛔ {t.suspensionReason === "billing" ? "Paused — non-payment (AP notified via login message)" : "Suspended"} — logins blocked</div>}
            {openUsers === t.id && (
              <div style={{ marginTop: 12, borderTop: "1px solid #F0F4F2", paddingTop: 10 }}>
                {resetInfo && (
                  <div style={{ marginBottom: 10, padding: "8px 12px", background: C.foam, borderRadius: 8, fontSize: ".78rem", color: C.ink }}>
                    <b>{resetInfo.email}</b> → temp password: <span style={{ fontFamily: "'DM Mono', monospace", background: C.white, padding: "1px 6px", borderRadius: 4 }}>{resetInfo.tempPassword}</span>
                  </div>
                )}
                {userRows.map(u => (
                  <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", fontSize: ".82rem" }}>
                    <div>
                      <b style={{ color: C.ink }}>{u.name}</b>
                      <span style={{ color: C.mist, marginLeft: 8 }}>{u.email} · {u.role}{u.active ? "" : " · inactive"}</span>
                    </div>
                    <button onClick={async () => {
                      const out = await api.opResetPassword(u.id);
                      setResetInfo({ email: u.email, tempPassword: out.tempPassword });
                    }} style={{ background: "none", border: "1px solid #D0DEDB", borderRadius: 6, padding: "4px 10px", fontSize: ".72rem", color: C.slate, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Reset password</button>
                  </div>
                ))}
              </div>
            )}

            {openModules === t.id && (
              <div style={{ marginTop: 12, borderTop: "1px solid #F0F4F2", paddingTop: 12 }}>
                {!moduleData ? (
                  <div style={{ fontSize: ".8rem", color: C.mist }}>Loading modules…</div>
                ) : (
                  <>
                    <div style={{ fontSize: ".74rem", color: C.mist, marginBottom: 10 }}>
                      Turn modules on or off for this account. Changes take effect immediately.
                    </div>
                    {moduleData.modules.map(m => (
                      <div key={m.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: `1px solid ${C.chalk}` }}>
                        <div style={{ flex: 1, paddingRight: 12 }}>
                          <div style={{ fontSize: ".85rem", fontWeight: 700, color: C.ink }}>{m.label}</div>
                          <div style={{ fontSize: ".72rem", color: C.mist, marginTop: 1 }}>{m.blurb}</div>
                        </div>
                        {/* Toggle switch */}
                        <button
                          onClick={() => flipModule(t.id, m.key, !m.enabled)}
                          disabled={moduleBusy === m.key}
                          aria-pressed={m.enabled}
                          style={{
                            width: 46, height: 26, borderRadius: 13, border: "none", cursor: moduleBusy === m.key ? "wait" : "pointer",
                            background: m.enabled ? C.sage : "#CBD5D1", position: "relative", transition: "background .15s", flexShrink: 0,
                          }}>
                          <span style={{
                            position: "absolute", top: 3, left: m.enabled ? 23 : 3, width: 20, height: 20, borderRadius: "50%",
                            background: "#fff", transition: "left .15s", boxShadow: "0 1px 3px rgba(0,0,0,.2)",
                          }} />
                        </button>
                      </div>
                    ))}
                    {/* Reserved / coming-soon modules (not yet toggleable) */}
                    {(moduleData.reserved ?? []).map(m => (
                      <div key={m.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", opacity: .55 }}>
                        <div style={{ flex: 1, paddingRight: 12 }}>
                          <div style={{ fontSize: ".85rem", fontWeight: 700, color: C.ink }}>{m.label}</div>
                          <div style={{ fontSize: ".72rem", color: C.mist, marginTop: 1 }}>{m.blurb}</div>
                        </div>
                        <span style={{ fontSize: ".68rem", fontWeight: 700, color: C.mist, background: "#EEF2F0", padding: "4px 9px", borderRadius: 6, flexShrink: 0 }}>Coming soon</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            {openPacks === t.id && (
              <div style={{ marginTop: 12, borderTop: "1px solid #F0F4F2", paddingTop: 12 }}>
                {!packList ? (
                  <div style={{ fontSize: ".8rem", color: C.mist }}>Loading packs…</div>
                ) : (
                  <>
                    <div style={{ fontSize: ".74rem", color: C.mist, marginBottom: 10 }}>
                      Apply an industry starter pack — creates ready-to-use inspection checklists and training courses for this account. Everything is editable afterward; existing items are never overwritten.
                    </div>
                    {packList.map(p => (
                      <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: `1px solid ${C.chalk}` }}>
                        <div style={{ flex: 1, paddingRight: 12 }}>
                          <div style={{ fontSize: ".85rem", fontWeight: 700, color: C.ink }}>{p.label}</div>
                          <div style={{ fontSize: ".72rem", color: C.mist, marginTop: 1 }}>{p.blurb}</div>
                          <div style={{ fontSize: ".68rem", color: C.sage, marginTop: 3, fontWeight: 600 }}>{p.checklistCount} checklists · {p.trainingCount} trainings</div>
                        </div>
                        <button
                          onClick={() => applyPack(t.id, p)}
                          disabled={packBusy === p.id}
                          style={{
                            padding: "7px 15px", background: packBusy === p.id ? "#CBD5D1" : C.sage, color: "#fff", border: "none",
                            borderRadius: 7, fontFamily: "'DM Sans', sans-serif", fontSize: ".78rem", fontWeight: 700,
                            cursor: packBusy === p.id ? "wait" : "pointer", flexShrink: 0,
                          }}>{packBusy === p.id ? "Applying…" : "Apply"}</button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </>)}
      </div>
    </div>
  );
}

// ── Operator business overview — MRR, adoption, module efficacy, at-risk tenants.
// This is the operator's view of the BUSINESS, deliberately separate from any
// customer safety data (which belongs to the tenants, not the operator).
const MODULE_LABELS = {
  incidents: "Incident Reporting", inspections: "Inspections", corrective_actions: "Corrective Actions",
  lms: "Training / LMS", equipment: "Equipment", recognition: "Recognition", reporting: "Reporting / OSHA",
};

function OperatorOverview({ analytics }) {
  if (!analytics) return <div style={{ padding: 40, textAlign: "center", color: C.mist }}>Loading analytics…</div>;
  const { summary: s, perTenant, moduleEfficacy } = analytics;
  const money = n => "$" + Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 });

  const kpis = [
    { label: "Monthly recurring revenue", value: money(s.mrr), sub: `${money(s.arr)} ARR`, color: C.sage },
    { label: "Active tenants", value: s.activeTenants, sub: s.suspendedTenants ? `${s.suspendedTenants} suspended` : "all active", color: C.pine },
    { label: "Avg revenue / tenant", value: money(s.avgMrrPerTenant), sub: `${s.totalUsers} users · ${s.totalSites} sites`, color: C.navy },
    { label: "Engaged (30d)", value: `${s.engagedTenants}/${s.activeTenants}`, sub: s.atRiskTenants ? `${s.atRiskTenants} at risk` : "none at risk", color: s.atRiskTenants ? C.gold : C.sage },
  ];

  return (
    <div className="anim">
      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 22 }}>
        {kpis.map((k, i) => (
          <div key={i} style={{ background: C.white, borderRadius: 10, boxShadow: "0 2px 12px rgba(15,31,23,.07)", padding: "16px 18px", borderTop: `3px solid ${k.color}` }}>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: C.ink, lineHeight: 1.1 }}>{k.value}</div>
            <div style={{ fontSize: ".78rem", color: C.slate, fontWeight: 600, marginTop: 4 }}>{k.label}</div>
            <div style={{ fontSize: ".7rem", color: C.mist, marginTop: 2 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Revenue by tenant */}
      <div style={{ background: C.white, borderRadius: 10, boxShadow: "0 2px 12px rgba(15,31,23,.07)", padding: "18px 20px", marginBottom: 18 }}>
        <h2 style={{ fontSize: ".98rem", fontWeight: 700, color: C.ink, marginBottom: 4 }}>Revenue & activity by tenant</h2>
        <p style={{ fontSize: ".72rem", color: C.mist, marginBottom: 14 }}>Monthly recurring revenue and recent engagement per account.</p>
        {perTenant.map(t => (
          <div key={t.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #F0F4F2", gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: ".88rem", fontWeight: 600, color: C.ink, display: "flex", alignItems: "center", gap: 7 }}>
                {t.name}
                {!t.active && <span style={{ fontSize: ".64rem", color: C.red, background: C.redLt, padding: "1px 7px", borderRadius: 10, fontWeight: 700 }}>SUSPENDED</span>}
                {t.active && (t.daysSinceActivity === null || t.daysSinceActivity >= 30) && <span style={{ fontSize: ".64rem", color: "#8A6D00", background: "#FBF0CE", padding: "1px 7px", borderRadius: 10, fontWeight: 700 }}>AT RISK</span>}
              </div>
              <div style={{ fontSize: ".7rem", color: C.mist, marginTop: 2 }}>
                {t.users} users · {t.sites} sites · {t.reports30d} reports/30d
                {t.daysSinceActivity !== null ? ` · last activity ${t.daysSinceActivity}d ago` : " · no activity yet"}
              </div>
            </div>
            <div style={{ fontSize: "1rem", fontWeight: 800, color: t.active ? C.sage : C.mist, whiteSpace: "nowrap" }}>{money(t.mrr)}<span style={{ fontSize: ".64rem", color: C.mist, fontWeight: 600 }}>/mo</span></div>
          </div>
        ))}
      </div>

      {/* Module efficacy */}
      <div style={{ background: C.white, borderRadius: 10, boxShadow: "0 2px 12px rgba(15,31,23,.07)", padding: "18px 20px" }}>
        <h2 style={{ fontSize: ".98rem", fontWeight: 700, color: C.ink, marginBottom: 4 }}>Module adoption</h2>
        <p style={{ fontSize: ".72rem", color: C.mist, marginBottom: 14 }}>Of tenants with each module enabled, how many are actually using it. Low adoption = churn risk or an onboarding gap.</p>
        {moduleEfficacy.filter(m => m.enabled > 0).map(m => (
          <div key={m.module} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".8rem", marginBottom: 4 }}>
              <span style={{ color: C.slate, fontWeight: 600 }}>{MODULE_LABELS[m.module] ?? m.module}</span>
              <span style={{ color: C.mist }}>{m.using}/{m.enabled} using · {m.adoptionPct}%</span>
            </div>
            <div style={{ height: 7, background: "#EEF3F0", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: `${m.adoptionPct ?? 0}%`, height: "100%", background: m.adoptionPct >= 60 ? C.sage : m.adoptionPct >= 30 ? C.gold : C.red, borderRadius: 4 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Operator: what needs my attention ────────────────────────────────────────
// A triaged worklist so problems surface on their own instead of the operator
// having to infer them by scanning the tenant table. Everything shown is an
// aggregate or an account-level fact — nothing that identifies a person or
// describes an incident, since that's tenant data and should require
// impersonating (which is attributable in the audit trail).
const SEV = {
  high:   { dot: "#B3261E", bg: "#FDECEA", label: "Needs action" },
  medium: { dot: "#8A6D00", bg: "#FBF0CE", label: "Worth a look" },
};

function OperatorAttention({ data, onOpenTenantBilling }) {
  if (!data) return <div style={{ padding: 40, textAlign: "center", color: C.mist }}>Loading…</div>;
  const { items = [], counts = {} } = data;

  if (!items.length) {
    return (
      <div className="anim" style={{ background: C.white, borderRadius: 10, boxShadow: "0 2px 12px rgba(15,31,23,.07)", padding: "40px 24px", textAlign: "center" }}>
        <div style={{ fontSize: "1.8rem", marginBottom: 8 }}>✅</div>
        <div style={{ fontSize: ".95rem", fontWeight: 700, color: C.ink }}>Nothing needs your attention</div>
        <div style={{ fontSize: ".8rem", color: C.mist, marginTop: 4 }}>No suspended accounts, unpaid invoices, or tenants gone quiet.</div>
      </div>
    );
  }

  return (
    <div className="anim">
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        {counts.high > 0 && (
          <span style={{ background: SEV.high.bg, color: SEV.high.dot, fontWeight: 700, fontSize: ".78rem", padding: "5px 12px", borderRadius: 20 }}>
            {counts.high} needs action
          </span>
        )}
        {counts.medium > 0 && (
          <span style={{ background: SEV.medium.bg, color: SEV.medium.dot, fontWeight: 700, fontSize: ".78rem", padding: "5px 12px", borderRadius: 20 }}>
            {counts.medium} worth a look
          </span>
        )}
      </div>

      {items.map((it, i) => {
        const sev = SEV[it.severity] ?? SEV.medium;
        const isMoney = it.kind === "unpaid_invoice";
        return (
          <div key={i} style={{
            background: C.white, borderRadius: 10, boxShadow: "0 2px 12px rgba(15,31,23,.07)",
            padding: "13px 16px", marginBottom: 9, borderLeft: `4px solid ${sev.dot}`,
            display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12,
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: ".9rem", fontWeight: 700, color: C.ink }}>{it.tenantName}</span>
                <span style={{ background: sev.bg, color: sev.dot, fontSize: ".68rem", fontWeight: 700, padding: "2px 8px", borderRadius: 10 }}>{it.title}</span>
              </div>
              <div style={{ fontSize: ".78rem", color: C.slate, marginTop: 4, lineHeight: 1.4 }}>{it.detail}</div>
            </div>
            {isMoney && onOpenTenantBilling && (
              <button onClick={() => onOpenTenantBilling(it.tenantId, it.tenantName)} style={{
                background: "none", border: `1px solid ${C.mint}`, borderRadius: 6, color: C.pine,
                padding: "5px 11px", fontSize: ".74rem", fontWeight: 700, cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap", flexShrink: 0,
              }}>Billing →</button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Operator: cross-tenant billing ───────────────────────────────────────────
// The portfolio view the per-tenant billing screen never had: every account's
// money in one place, with a direct link into each tenant's billing detail.
const INV_STATUS = {
  draft:    { label: "Draft",    bg: "#EEF1F0", color: "#5A5A5A" },
  approved: { label: "Approved", bg: "#FBF0CE", color: "#8A6D00" },
  sent:     { label: "Sent",     bg: "#FBF0CE", color: "#8A6D00" },
  paid:     { label: "Paid",     bg: "#E6F4EA", color: "#2E7D32" },
  void:     { label: "Void",     bg: "#EEF1F0", color: "#9AA5A1" },
};

function OperatorBilling({ data, onOpenTenantBilling }) {
  if (!data) return <div style={{ padding: 40, textAlign: "center", color: C.mist }}>Loading…</div>;
  const { rows = [], totals = {} } = data;
  const money = n => "$" + Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 });

  const kpis = [
    { label: "Monthly recurring revenue", value: money(totals.mrr), color: C.sage },
    { label: "Outstanding", value: money(totals.outstanding), color: totals.outstanding > 0 ? "#8A6D00" : C.sage,
      sub: totals.tenantsUnpaid ? `${totals.tenantsUnpaid} account${totals.tenantsUnpaid === 1 ? "" : "s"}` : "all settled" },
    { label: "Collected to date", value: money(totals.paidToDate), color: C.navy },
  ];

  return (
    <div className="anim">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
        {kpis.map((k, i) => (
          <div key={i} style={{ background: C.white, borderRadius: 10, boxShadow: "0 2px 12px rgba(15,31,23,.07)", padding: "16px 18px", borderTop: `3px solid ${k.color}` }}>
            <div style={{ fontSize: "1.4rem", fontWeight: 800, color: C.ink, lineHeight: 1.1 }}>{k.value}</div>
            <div style={{ fontSize: ".78rem", color: C.slate, fontWeight: 600, marginTop: 4 }}>{k.label}</div>
            {k.sub && <div style={{ fontSize: ".7rem", color: C.mist, marginTop: 2 }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      <div style={{ background: C.white, borderRadius: 10, boxShadow: "0 2px 12px rgba(15,31,23,.07)", padding: "18px 20px" }}>
        <h2 style={{ fontSize: ".98rem", fontWeight: 700, color: C.ink, marginBottom: 14 }}>By account</h2>
        {rows.map(r => {
          const inv = r.latestInvoice;
          const st = inv ? (INV_STATUS[inv.status] ?? INV_STATUS.draft) : null;
          return (
            <div key={r.tenantId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "11px 0", borderBottom: "1px solid #F0F4F2", flexWrap: "wrap" }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                  <span style={{ fontSize: ".88rem", fontWeight: 600, color: C.ink }}>{r.tenantName}</span>
                  {!r.active && <span style={{ fontSize: ".64rem", color: "#B3261E", background: "#FDECEA", padding: "1px 7px", borderRadius: 10, fontWeight: 700 }}>SUSPENDED</span>}
                  {st && <span style={{ fontSize: ".64rem", color: st.color, background: st.bg, padding: "1px 7px", borderRadius: 10, fontWeight: 700 }}>{inv.period} {st.label}</span>}
                </div>
                <div style={{ fontSize: ".72rem", color: C.mist, marginTop: 2 }}>
                  {r.unpaidCount > 0
                    ? `${money(r.unpaidTotal)} outstanding across ${r.unpaidCount} invoice${r.unpaidCount === 1 ? "" : "s"}`
                    : inv ? "Nothing outstanding" : "No invoices generated yet"}
                  {r.paidToDate > 0 ? ` · ${money(r.paidToDate)} collected` : ""}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                <div style={{ fontSize: ".95rem", fontWeight: 800, color: r.active ? C.sage : C.mist, whiteSpace: "nowrap" }}>
                  {money(r.mrr)}<span style={{ fontSize: ".62rem", color: C.mist, fontWeight: 600 }}>/mo</span>
                </div>
                {onOpenTenantBilling && (
                  <button onClick={() => onOpenTenantBilling(r.tenantId, r.tenantName)} style={{
                    background: "none", border: `1px solid ${C.mint}`, borderRadius: 6, color: C.pine,
                    padding: "5px 11px", fontSize: ".74rem", fontWeight: 700, cursor: "pointer",
                    fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap",
                  }}>Open →</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
