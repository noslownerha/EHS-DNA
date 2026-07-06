import { COLORS } from "./constants.js";
import { useState } from "react";

// ── Ops backend colour palette (spec §5.4) ───────────────────────────────────
const C = { ...COLORS, gold: "#F4A261", goldLt: "#FEF3E2", red: "#E74C3C", redLt: "#FEF0EF" };

// ── Seed data ────────────────────────────────────────────────────────────────
const ACCOUNTS = [
  {
    id: 1, name: "WhistlePig Whiskey",    plan: "Premium", sites: 4, users: 42, mrr: 1840,
    healthScore: 84, enrolled: "2023-09-01", status: "active",
    modules: ["incidents", "inspections", "training", "triage"],
    lastActive: "Today",
  },
  {
    id: 2, name: "Champlain Valley Cider",plan: "Standard", sites: 2, users: 18, mrr: 620,
    healthScore: 67, enrolled: "2024-01-15", status: "active",
    modules: ["incidents", "inspections"],
    lastActive: "2 days ago",
  },
  {
    id: 3, name: "Green Mountain Brewing", plan: "Standard", sites: 1, users: 11, mrr: 390,
    healthScore: 92, enrolled: "2024-03-22", status: "active",
    modules: ["incidents", "inspections", "training"],
    lastActive: "Today",
  },
  {
    id: 4, name: "Northeast Logistics Co.", plan: "Basic",   sites: 3, users: 29, mrr: 870,
    healthScore: 41, enrolled: "2023-11-08", status: "at_risk",
    modules: ["incidents"],
    lastActive: "12 days ago",
  },
  {
    id: 5, name: "Adirondack Spirits",    plan: "Premium", sites: 2, users: 14, mrr: 780,
    healthScore: 78, enrolled: "2024-02-14", status: "active",
    modules: ["incidents", "inspections", "training", "triage"],
    lastActive: "Yesterday",
  },
];

const MODULES_CATALOG = [
  { id: "incidents",   label: "Incident Reporting",   price: 0,   included: true  },
  { id: "inspections", label: "Inspections & Findings",price: 0,   included: true  },
  { id: "training",    label: "Training / LMS",        price: 150, included: false },
  { id: "triage",      label: "Incident Triage",       price: 75,  included: false },
  { id: "advanced_reporting", label: "Advanced Reporting", price: 100, included: false },
  { id: "sms",         label: "SMS Alerts",            price: 50,  included: false },
];

const MODULE_COLORS = {
  incidents:  { bg: C.tealLt, color: C.teal },
  inspections:{ bg: C.greenLt,color: C.green },
  training:   { bg: "#F3F0F9", color: "#6B3FA0" },
  triage:     { bg: C.redLt,  color: C.red  },
  advanced_reporting: { bg: C.goldLt, color: C.gold },
  sms:        { bg: "#EEF1F0", color: C.slate },
};

function HealthBadge({ score }) {
  const color = score >= 80 ? C.green : score >= 60 ? C.gold : C.red;
  const bg    = score >= 80 ? C.greenLt : score >= 60 ? C.goldLt : C.redLt;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 36, height: 36, borderRadius: "50%", background: bg, border: `2px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".72rem", fontWeight: 800, color }}>{score}</div>
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    active:  { label: "Active",  bg: C.greenLt, color: C.green },
    at_risk: { label: "At risk", bg: C.redLt,   color: C.red   },
    churned: { label: "Churned", bg: "#EEF1F0", color: C.slate },
  };
  const s = map[status] ?? map.active;
  return <span style={{ padding: "2px 9px", borderRadius: 20, fontSize: ".68rem", fontWeight: 600, background: s.bg, color: s.color }}>{s.label}</span>;
}

function ModulePill({ id }) {
  const s = MODULE_COLORS[id] ?? { bg: "#EEF1F0", color: C.slate };
  const label = MODULES_CATALOG.find(m => m.id === id)?.label.split(" ")[0] ?? id;
  return <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: ".65rem", fontWeight: 600, background: s.bg, color: s.color }}>{label}</span>;
}

function OpsNav({ title }) {
  return (
    <div style={{ height: 52, background: C.dark, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", boxShadow: "0 2px 10px rgba(0,0,0,.4)", position: "sticky", top: 0, zIndex: 100, borderBottom: "1px solid rgba(0,180,216,.15)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: ".9rem", fontWeight: 500, color: C.teal, letterSpacing: ".06em" }}>
          <span style={{ color: C.white }}>EHS</span>ops
        </div>
        <span style={{ color: "rgba(255,255,255,.15)" }}>|</span>
        <span style={{ fontSize: ".8rem", color: "rgba(255,255,255,.5)" }}>{title}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: ".7rem", color: "rgba(255,255,255,.3)", background: "rgba(255,255,255,.06)", padding: "2px 8px", borderRadius: 12 }}>Super Admin</span>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// S6a — Account List
// ════════════════════════════════════════════════════════════════════════════
export function S6aAccountList({ onViewAccount, onNewEnrollment }) {
  const [search,    setSearch]    = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [sfocused,  setSfocused]  = useState(false);

  const totalMRR = ACCOUNTS.reduce((n, a) => n + a.mrr, 0);
  const activeCount = ACCOUNTS.filter(a => a.status === "active").length;
  const atRiskCount = ACCOUNTS.filter(a => a.status === "at_risk").length;

  const filtered = ACCOUNTS.filter(a => {
    if (filterStatus && a.status !== filterStatus) return false;
    if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const thStyle = {
    padding: "9px 14px", textAlign: "left",
    fontSize: ".68rem", fontWeight: 600, letterSpacing: ".07em",
    textTransform: "uppercase", color: "rgba(255,255,255,.3)",
    borderBottom: "1px solid rgba(255,255,255,.07)",
    background: C.mid, whiteSpace: "nowrap",
  };

  return (
    <div style={{ minHeight: "100vh", background: C.mid, fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .anim { animation: fadeUp .25s ease both; }
        input::placeholder { color: rgba(255,255,255,.2); }
        select option { color: #0F1F17; background: #fff; }
        .acct-row:hover td { background: rgba(255,255,255,.04) !important; cursor: pointer; }
        .create-btn:hover { background: ${C.teal}cc !important; transform: translateY(-1px); }
        .filter-sel:focus { outline: none; }
      `}</style>

      <OpsNav title="Accounts" />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 22px" }}>

        {/* Top stats */}
        <div className="anim" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12, marginBottom: 22 }}>
          {[
            { label: "Total MRR",      value: `$${totalMRR.toLocaleString()}`, color: C.teal   },
            { label: "Active accounts",value: activeCount,                      color: C.green  },
            { label: "At risk",        value: atRiskCount,                      color: C.red    },
            { label: "Accounts",       value: ACCOUNTS.length,                 color: "rgba(255,255,255,.7)" },
          ].map((s, i) => (
            <div key={i} style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, padding: "16px 18px", height: 80, display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: ".72rem", color: "rgba(255,255,255,.4)", marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="anim" style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1, maxWidth: 280 }}>
            <input value={search} onChange={e => setSearch(e.target.value)}
              onFocus={() => setSfocused(true)} onBlur={() => setSfocused(false)}
              placeholder="Search accounts…"
              style={{ width: "100%", padding: "8px 12px 8px 30px", background: "rgba(255,255,255,.06)", border: `1px solid ${sfocused ? C.teal : "rgba(255,255,255,.1)"}`, borderRadius: 7, fontFamily: "'DM Sans', sans-serif", fontSize: ".83rem", color: C.white, outline: "none", transition: "all .18s" }} />
            <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", fontSize: ".78rem", color: "rgba(255,255,255,.25)", pointerEvents: "none" }}>🔍</span>
          </div>
          <select className="filter-sel" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: "8px 28px 8px 10px", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 7, fontFamily: "'DM Sans', sans-serif", fontSize: ".82rem", color: "rgba(255,255,255,.7)", cursor: "pointer", appearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='rgba(255,255,255,.3)'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center" }}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="at_risk">At risk</option>
          </select>
          <button className="create-btn" onClick={onNewEnrollment} style={{ padding: "8px 16px", background: C.teal, color: C.white, border: "none", borderRadius: 7, fontFamily: "'DM Sans', sans-serif", fontSize: ".83rem", fontWeight: 600, cursor: "pointer", transition: "all .15s", marginLeft: "auto" }}>
            + New account
          </button>
        </div>

        {/* Account table */}
        <div className="anim" style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 10, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Account", "Health", "Status", "MRR", "Sites / Users", "Modules", "Last active", ""].map((h, i) => (
                  <th key={i} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((acct, ri) => (
                <tr key={acct.id} className="acct-row" onClick={() => onViewAccount?.(acct.id)}>
                  <td style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,.05)" }}>
                    <div style={{ fontWeight: 600, fontSize: ".88rem", color: C.white }}>{acct.name}</div>
                    <div style={{ fontSize: ".7rem", color: "rgba(255,255,255,.35)", marginTop: 1 }}>{acct.plan} · Enrolled {new Date(acct.enrolled).toLocaleDateString([], { month: "short", year: "numeric" })}</div>
                  </td>
                  <td style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,.05)" }}>
                    <HealthBadge score={acct.healthScore} />
                  </td>
                  <td style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,.05)" }}>
                    <StatusPill status={acct.status} />
                  </td>
                  <td style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,.05)", fontWeight: 700, color: C.teal, fontFamily: "'DM Mono', monospace", fontSize: ".88rem" }}>
                    ${acct.mrr.toLocaleString()}
                  </td>
                  <td style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,.05)", fontSize: ".82rem", color: "rgba(255,255,255,.55)" }}>
                    {acct.sites} sites · {acct.users} users
                  </td>
                  <td style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,.05)" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {acct.modules.map(m => <ModulePill key={m} id={m} />)}
                    </div>
                  </td>
                  <td style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,.05)", fontSize: ".8rem", color: "rgba(255,255,255,.35)" }}>
                    {acct.lastActive}
                  </td>
                  <td style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,.05)", color: "rgba(255,255,255,.2)", fontSize: ".8rem" }}>→</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


// ════════════════════════════════════════════════════════════════════════════
// S6b — Account Detail
// Spec §16.1: AI analysis panel removed from MVP
// Spec §16.4: pricing override note editable inline, saves on blur
// ════════════════════════════════════════════════════════════════════════════
export function S6bAccountDetail({ accountId, onBack, onViewInvoice, onShadowMode }) {
  const acct = ACCOUNTS.find(a => a.id === (accountId ?? 1)) ?? ACCOUNTS[0];

  const [modules,        setModules]        = useState(new Set(acct.modules));
  const [pricingNote,    setPricingNote]    = useState("Discounted 15% for annual prepay — renewal Apr 2025. Agreed with Ahren H. at contract signing.");
  const [noteEditing,    setNoteEditing]    = useState(false);
  const [noteFocused,    setNoteFocused]    = useState(false);
  const [overrideMRR,    setOverrideMRR]    = useState(null); // null = standard rate
  const [shadowConfirm,  setShadowConfirm]  = useState(false);

  // Health score sub-scores (spec glossary)
  const subScores = [
    { label: "Login activity",    score: 88, color: C.green },
    { label: "Feature adoption",  score: 72, color: C.gold  },
    { label: "Support load",      score: 95, color: C.green },
    { label: "Billing status",    score: 100,color: C.green },
  ];
  const healthScore = Math.round(subScores.reduce((n, s) => n + s.score, 0) / subScores.length);

  function toggleModule(id) {
    setModules(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  return (
    <div style={{ minHeight: "100vh", background: C.mid, fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .anim { animation: fadeUp .25s ease both; }
        textarea::placeholder, input::placeholder { color: rgba(255,255,255,.2); }
        .shadow-btn:hover { background: rgba(231,76,60,.15) !important; border-color: ${C.red} !important; }
        .module-toggle:hover { border-color: ${C.teal} !important; }
      `}</style>

      <OpsNav title={`Account · ${acct.name}`} />

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 22px" }}>

        {/* Breadcrumb + header */}
        <div className="anim" style={{ marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <button onClick={onBack} style={{ background: "none", border: "none", color: "rgba(255,255,255,.3)", fontSize: ".8rem", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>← Accounts</button>
            <span style={{ color: "rgba(255,255,255,.15)" }}>/</span>
            <span style={{ fontSize: ".8rem", color: "rgba(255,255,255,.5)" }}>{acct.name}</span>
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
            <div>
              <h1 style={{ fontSize: "1.3rem", fontWeight: 700, color: C.white, marginBottom: 6 }}>{acct.name}</h1>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <StatusPill status={acct.status} />
                <span style={{ fontSize: ".78rem", color: "rgba(255,255,255,.35)" }}>{acct.plan} · ${acct.mrr.toLocaleString()}/mo · {acct.sites} sites · {acct.users} users</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
              {/* Shadow mode — spec: always read-only and always logged */}
              {!shadowConfirm ? (
                <button className="shadow-btn" onClick={() => setShadowConfirm(true)} style={{
                  padding: "8px 14px", background: "rgba(231,76,60,.08)",
                  color: C.red, border: `1px solid rgba(231,76,60,.3)`,
                  borderRadius: 7, fontFamily: "'DM Sans', sans-serif",
                  fontSize: ".82rem", fontWeight: 600, cursor: "pointer", transition: "all .15s",
                }}>👁 Shadow mode</button>
              ) : (
                <div style={{ padding: "8px 14px", background: "rgba(231,76,60,.15)", border: `1px solid ${C.red}`, borderRadius: 7, fontSize: ".8rem", color: C.red, display: "flex", alignItems: "center", gap: 10 }}>
                  <span>Read-only · session logged</span>
                  <button onClick={() => { setShadowConfirm(false); onShadowMode?.(acct.id); }} style={{ background: C.red, color: C.white, border: "none", borderRadius: 5, padding: "3px 10px", fontFamily: "'DM Sans', sans-serif", fontSize: ".75rem", fontWeight: 600, cursor: "pointer" }}>Enter</button>
                  <button onClick={() => setShadowConfirm(false)} style={{ background: "none", border: "none", color: "rgba(231,76,60,.6)", cursor: "pointer", fontSize: ".85rem" }}>×</button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 18, alignItems: "start" }}>

          {/* Left column */}
          <div>
            {/* Health score breakdown */}
            <div className="anim" style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 10, padding: "18px 20px", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
                <HealthBadge score={healthScore} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: ".95rem", color: C.white }}>Health score</div>
                  <div style={{ fontSize: ".75rem", color: "rgba(255,255,255,.35)", marginTop: 1 }}>Composite of 4 sub-scores</div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {subScores.map(s => (
                  <div key={s.label} style={{ background: "rgba(255,255,255,.03)", borderRadius: 8, padding: "11px 14px" }}>
                    <div style={{ fontSize: ".72rem", color: "rgba(255,255,255,.35)", marginBottom: 4 }}>{s.label}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,.08)", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${s.score}%`, background: s.color, borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: ".8rem", fontWeight: 700, color: s.color }}>{s.score}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Module entitlements */}
            <div className="anim" style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 10, padding: "18px 20px", marginBottom: 14 }}>
              <h2 style={{ fontSize: ".92rem", fontWeight: 600, color: C.white, marginBottom: 14 }}>Module entitlements</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {MODULES_CATALOG.map(mod => {
                  const active = modules.has(mod.id);
                  const s = MODULE_COLORS[mod.id] ?? { bg: "#EEF1F0", color: C.slate };
                  return (
                    <div key={mod.id} className="module-toggle" onClick={() => toggleModule(mod.id)} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "10px 14px",
                      background: active ? "rgba(255,255,255,.05)" : "rgba(255,255,255,.02)",
                      border: `1px solid ${active ? "rgba(255,255,255,.12)" : "rgba(255,255,255,.05)"}`,
                      borderRadius: 8, cursor: "pointer", transition: "all .15s",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 22, height: 22, borderRadius: "50%", background: active ? s.bg : "rgba(255,255,255,.05)", display: "flex", alignItems: "center", justifyContent: "center", transition: "all .15s" }}>
                          {active && <span style={{ fontSize: ".6rem", fontWeight: 700, color: s.color }}>✓</span>}
                        </div>
                        <div>
                          <div style={{ fontSize: ".85rem", fontWeight: active ? 600 : 400, color: active ? C.white : "rgba(255,255,255,.4)" }}>{mod.label}</div>
                          {mod.price > 0 && <div style={{ fontSize: ".7rem", color: "rgba(255,255,255,.25)" }}>${mod.price}/mo add-on</div>}
                          {mod.included && <div style={{ fontSize: ".7rem", color: "rgba(255,255,255,.25)" }}>Included in all plans</div>}
                        </div>
                      </div>
                      <div style={{ width: 36, height: 20, borderRadius: 20, background: active ? C.teal : "rgba(255,255,255,.1)", position: "relative", flexShrink: 0, transition: "background .2s" }}>
                        <div style={{ position: "absolute", width: 14, height: 14, borderRadius: "50%", background: C.white, top: 3, left: active ? 19 : 3, transition: "left .18s" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Spec §16.4: pricing override note — editable inline, saves on blur, internal only */}
            <div className="anim" style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 10, padding: "18px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <h2 style={{ fontSize: ".92rem", fontWeight: 600, color: C.white }}>Pricing override</h2>
                <span style={{ fontSize: ".68rem", color: "rgba(255,255,255,.25)", fontStyle: "italic" }}>Internal only — not visible to customer</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: ".68rem", fontWeight: 600, color: "rgba(255,255,255,.3)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>Override MRR</div>
                  <div style={{ fontSize: ".92rem", color: overrideMRR ? C.gold : "rgba(255,255,255,.45)" }}>
                    {overrideMRR ? `$${overrideMRR}/mo` : "Standard rate ($1,840/mo)"}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: ".68rem", fontWeight: 600, color: "rgba(255,255,255,.3)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>Effective since</div>
                  <div style={{ fontSize: ".88rem", color: "rgba(255,255,255,.55)" }}>Sep 1, 2023</div>
                </div>
              </div>
              {/* Spec §16.4: editable note field, saves on blur */}
              <div>
                <div style={{ fontSize: ".68rem", fontWeight: 600, color: "rgba(255,255,255,.3)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>Override note</div>
                <textarea
                  value={pricingNote}
                  onChange={e => setPricingNote(e.target.value)}
                  onFocus={() => setNoteFocused(true)}
                  onBlur={() => setNoteFocused(false)}   // spec: saves on blur
                  rows={2}
                  style={{
                    width: "100%", padding: "9px 12px",
                    background: noteFocused ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.03)",
                    border: `1px solid ${noteFocused ? C.teal : "rgba(255,255,255,.08)"}`,
                    borderRadius: 8, fontFamily: "'DM Sans', sans-serif",
                    fontSize: ".85rem", color: "rgba(255,255,255,.7)",
                    outline: "none", resize: "vertical", lineHeight: 1.5,
                    transition: "all .18s",
                  }}
                />
                {noteFocused && <div style={{ fontSize: ".68rem", color: "rgba(255,255,255,.25)", marginTop: 3 }}>Saves on blur · internal only</div>}
              </div>
            </div>
          </div>

          {/* Right sidebar */}
          <div>
            {/* Company info */}
            <div className="anim" style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 10, padding: "16px 18px", marginBottom: 12 }}>
              <h2 style={{ fontSize: ".85rem", fontWeight: 600, color: C.white, marginBottom: 12 }}>Company info</h2>
              {[
                { label: "Plan",      value: acct.plan       },
                { label: "Enrolled",  value: new Date(acct.enrolled).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) },
                { label: "Sites",     value: acct.sites      },
                { label: "Users",     value: acct.users      },
                { label: "MRR",       value: `$${acct.mrr.toLocaleString()}` },
                { label: "Last login",value: acct.lastActive },
              ].map((row, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: i < 5 ? "1px solid rgba(255,255,255,.05)" : "none" }}>
                  <span style={{ fontSize: ".78rem", color: "rgba(255,255,255,.3)" }}>{row.label}</span>
                  <span style={{ fontSize: ".82rem", color: "rgba(255,255,255,.7)", fontWeight: 500 }}>{row.value}</span>
                </div>
              ))}
            </div>

            {/* Recent invoices */}
            <div className="anim" style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 10, padding: "16px 18px", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <h2 style={{ fontSize: ".85rem", fontWeight: 600, color: C.white }}>Recent invoices</h2>
                <button onClick={() => onViewInvoice?.("all")} style={{ background: "none", border: "none", color: C.teal, fontSize: ".75rem", cursor: "pointer", fontFamily: "'DM Sans', sans-serif' " }}>View all →</button>
              </div>
              {[
                { num: "2604-3847", amount: "$1,840", status: "paid",    date: "Apr 2024" },
                { num: "2603-2291", amount: "$1,840", status: "paid",    date: "Mar 2024" },
                { num: "2602-5518", amount: "$1,690", status: "paid",    date: "Feb 2024" },
              ].map((inv, i) => (
                <div key={i} onClick={() => onViewInvoice?.(inv.num)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0", borderBottom: i < 2 ? "1px solid rgba(255,255,255,.05)" : "none", cursor: "pointer" }}>
                  <div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: ".72rem", color: C.teal }}>{inv.num}</div>
                    <div style={{ fontSize: ".7rem", color: "rgba(255,255,255,.3)" }}>{inv.date}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: ".82rem", color: "rgba(255,255,255,.6)", fontWeight: 600 }}>{inv.amount}</span>
                    <span style={{ padding: "1px 7px", borderRadius: 10, fontSize: ".65rem", fontWeight: 600, background: C.greenLt, color: C.green }}>{inv.status}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Spec §16.1: AI analysis — deferred post-MVP */}
            <div className="anim" style={{ background: "rgba(255,255,255,.02)", border: "1px dashed rgba(255,255,255,.07)", borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ fontSize: ".72rem", color: "rgba(255,255,255,.2)", fontStyle: "italic", lineHeight: 1.5 }}>
                📊 AI account analysis — deferred post-MVP (§16.1). Will surface module adoption insights, usage trends, and proactive recommendations once sufficient usage data exists.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
