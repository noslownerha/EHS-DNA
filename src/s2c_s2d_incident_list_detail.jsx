import { useState, useMemo, useEffect } from "react";
import { EHSHeader } from "./AppShell.jsx";
import { BRAND, COLORS } from "./constants.js";
import { api } from "./api.js";
import PersonPicker from "./PersonPicker.jsx";
import AuthImg from "./AuthImg.jsx";

const C = { ...COLORS };


const TYPE_LABELS = {
  injury: "Injury", near_miss: "Near Miss", property: "Property Damage",
  environmental: "Environmental Release", vehicle: "Vehicle Incident", security: "Security Event",
};
const TYPE_EMOJI = {
  injury: "🩹", near_miss: "⚠️", property: "🏗", environmental: "🌿", vehicle: "🚛", security: "🔒",
};
const SEV_COLORS = {
  minor: C.pine, significant: C.gold, serious: C.red,
};
const CA_STATUS = {
  overdue:  { label: "Overdue",  bg: C.redLt,   color: C.red  },
  // "Blocked" is a roadblock the assignee can't clear alone. It keeps ageing on
  // purpose, so it reads as an alert rather than a parked/neutral state.
  blocked:  { label: "⚠ Blocked — needs help", bg: "#FBF0CE", color: "#8A6D00" },
  "on-track":{ label: "On track", bg: C.foam,    color: C.pine },
  closed:   { label: "Closed",   bg: "#EEF1F0", color: C.slate},
};
const OSHA_COLORS = {
  "Pending":                    { bg: C.goldLt, color: C.gold },
  "Review: likely recordable":  { bg: "rgba(180,83,9,.12)", color: "#B45309" },
  "Recordable":                 { bg: C.redLt,  color: C.red  },
  "Non-recordable":             { bg: C.foam,   color: C.pine },
};

function pill(label, bg, color) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "2px 9px", borderRadius: 20,
      fontSize: ".68rem", fontWeight: 600, background: bg, color,
    }}>{label}</span>
  );
}

// ── Desktop nav ──────────────────────────────────────────────────────────────
function DesktopNav({ companyName = BRAND.company, onHome }) {
  return (
    <EHSHeader onHome={onHome} title={companyName} rightContent={
      <div style={{ fontSize: ".72rem", color: C.mist, background: "rgba(255,255,255,.08)", padding: "3px 12px", borderRadius: 20, whiteSpace: "nowrap" }}>
        Incidents
      </div>
    } />
  );
}

// ════════════════════════════════════════════════════════════════════════════
// S2c — Incident List (Desktop)
// ════════════════════════════════════════════════════════════════════════════
export function S2cIncidentList({ companyName, onViewIncident, onNewIncident, onHome }) {
  const [liveIncidents, setLiveIncidents] = useState([]);
  const [liveCAs,       setLiveCAs]       = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [loadError,     setLoadError]     = useState(false);

  function loadData() {
    setLoading(true); setLoadError(false);
    return Promise.all([api.listIncidents(), api.listCAs()])
      .then(([incs, cas]) => { setLiveIncidents(incs ?? []); setLiveCAs(cas ?? []); setLoadError(false); })
      .catch(err => { console.error("Failed to load incidents:", err.message); setLoadError(true); })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    let cancelled = false;
    // Fetch on mount; if the first attempt fails (transient/token race), retry once
    // after a short delay so the user isn't stranded on an empty-looking list.
    loadData().then(() => {
      if (!cancelled) setTimeout(() => {
        // Only retry if we ended up with nothing due to an error, not a real empty list.
        setLoadError(e => { if (e) loadData(); return e; });
      }, 800);
    });
    return () => { cancelled = true; };
  }, []);

  // Adapt server rows to the shape this screen was built around
  const SEED_INCIDENTS = useMemo(() => liveIncidents.map(i => {
    const openCAs = liveCAs.filter(c => c.incident_id === i.id && c.status !== "done" && c.status !== "verified");
    const overdue = openCAs.some(c => c.due_date && new Date(c.due_date) < new Date());
    const hasAnyCA = liveCAs.some(c => c.incident_id === i.id);
    return {
      id: i.ref, type: i.type, site: i.site_name ?? "—", dept: i.department ?? "—",
      severity: i.severity ?? "minor", status: i.status,
      reporter: i.reporter_name ?? "—",
      date: (i.occurred_at ?? i.created_at ?? "").slice(0, 10),
      osha: i.osha_classification && String(i.osha_classification).startsWith("Recordable") ? "Recordable"
            : i.osha_classification && String(i.osha_classification).startsWith("Review") ? "Review"
            : i.osha_classification === "Non-recordable" ? "Non-recordable" : "Pending",
      caStatus: !hasAnyCA ? "closed" : overdue ? "overdue" : "on-track",
      triageId: null,
    };
  }), [liveIncidents, liveCAs]);

  const [search,      setSearch]      = useState("");
  const [filterSite,  setFilterSite]  = useState("");
  const [filterType,  setFilterType]  = useState("");
  const [filterStatus,setFilterStatus]= useState("");
  const [sfocused,    setSfocused]    = useState(false);

  // Spec §12.7: KPI tiles — value and label ONLY. Fixed height. No detail inside.
  const kpis = [
    { value: SEED_INCIDENTS.filter(i => i.status === "open").length,    label: "Open",        color: C.sage  },
    { value: SEED_INCIDENTS.filter(i => i.caStatus === "overdue").length,label: "Corrective actions overdue", color: C.red   },
    { value: SEED_INCIDENTS.filter(i => i.osha === "Recordable").length, label: "Recordable",  color: C.gold  },
    { value: SEED_INCIDENTS.filter(i => i.status === "closed").length,   label: "Closed",      color: C.slate },
  ];

  // Spec §12.7: supporting context below tiles as concise bullets
  const overdueIds  = SEED_INCIDENTS.filter(i => i.caStatus === "overdue").length;
  const onTrackIds  = SEED_INCIDENTS.filter(i => i.caStatus === "on-track").length;
  const closedCAs   = SEED_INCIDENTS.filter(i => i.caStatus === "closed").length;
  const caContext   = `${overdueIds} overdue · ${onTrackIds} on track · ${closedCAs} closed`;

  const filtered = useMemo(() =>
    SEED_INCIDENTS.filter(i => {
      if (filterSite   && i.site !== filterSite)     return false;
      if (filterType   && i.type !== filterType)     return false;
      if (filterStatus && i.status !== filterStatus) return false;
      if (search && !i.id.toLowerCase().includes(search.toLowerCase()) &&
          !i.reporter.toLowerCase().includes(search.toLowerCase()) &&
          !i.dept.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    }),
    [search, filterSite, filterType, filterStatus, SEED_INCIDENTS]
  );

  const sites = [...new Set(SEED_INCIDENTS.map(i => i.site))];

  const thStyle = {
    padding: "9px 14px", textAlign: "left",
    fontSize: ".7rem", fontWeight: 600, letterSpacing: ".06em",
    textTransform: "uppercase", color: C.mist,
    borderBottom: "1px solid #E2EBE6", background: C.chalk,
    whiteSpace: "nowrap",
  };

  return (
    <div style={{ minHeight: "100vh", background: C.chalk, fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .anim { animation: fadeUp .28s ease both; }
        input::placeholder { color: ${C.mist}; }
        select option { color: ${C.ink}; }
        .incident-row:hover td { background: ${C.foam} !important; cursor: pointer; }

        /* Mobile-first: cards by default, table only when there's room for its
           9 columns. Below ~760px the table required horizontal scrolling and
           columns (Status, CAs) sat off-screen where nobody found them. */
        .incident-cards { display: block; }
        .incident-table { display: none; }
        @media (min-width: 760px) {
          .incident-cards { display: none; }
          .incident-table { display: block; }
        }

        /* On a phone the detail header (breadcrumb + title on the left, three
           export/close buttons on the right) could not fit side by side: the
           buttons ran off-screen and the breadcrumb was crushed to one letter
           per line. Stack them, and let the buttons share the full width. */
        @media (max-width: 760px) {
          .detail-header { flex-direction: column; align-items: stretch; gap: 12px; }
          .detail-actions { width: 100%; flex-wrap: wrap; }
          .detail-actions button { flex: 1 1 auto; min-width: 0; white-space: nowrap; }
        }
        .new-btn:hover { background: ${C.pine} !important; transform: translateY(-1px); }
      `}</style>

      <DesktopNav companyName={companyName} onHome={onHome} />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px" }}>

        {/* Page header */}
        <div className="anim" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: C.ink }}>Incidents</h1>
            <p style={{ fontSize: ".85rem", color: C.mist, marginTop: 3 }}>All sites · {SEED_INCIDENTS.length} total</p>
          </div>
          <button className="new-btn" onClick={onNewIncident} style={{
            padding: "9px 20px", background: C.sage, color: C.white,
            border: "none", borderRadius: 7, fontFamily: "'DM Sans', sans-serif",
            fontSize: ".88rem", fontWeight: 600, cursor: "pointer", transition: "all .15s",
          }}>+ Report incident</button>
        </div>

        {/* Spec §12.7: KPI tiles — value and label only, fixed height */}
        <div className="anim" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 14, marginBottom: 10 }}>
          {kpis.map((kpi, i) => (
            <div key={i} style={{
              background: C.white, borderRadius: 10,
              boxShadow: "0 2px 12px rgba(15,31,23,.07)",
              padding: "20px 22px",
              height: 90,           // Spec: tiles fixed height — must not stretch
              display: "flex", flexDirection: "column", justifyContent: "center",
              borderTop: `3px solid ${kpi.color}`,
            }}>
              <div style={{ fontSize: "1.75rem", fontWeight: 700, color: kpi.color, lineHeight: 1 }}>{kpi.value}</div>
              <div style={{ fontSize: ".8rem", color: C.slate, marginTop: 4, fontWeight: 500 }}>{kpi.label}</div>
            </div>
          ))}
        </div>

        {/* Spec §12.7: supporting context below tiles as concise bullets */}
        <div className="anim" style={{ fontSize: ".78rem", color: C.mist, marginBottom: 22, paddingLeft: 4 }}>
          CAs: {caContext}
        </div>

        {/* Filters */}
        <div className="anim" style={{
          display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center",
        }}>
          {/* Search */}
          <div style={{ position: "relative" }}>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              onFocus={() => setSfocused(true)} onBlur={() => setSfocused(false)}
              placeholder="Search ID, reporter, department…"
              style={{
                padding: "8px 12px 8px 32px", width: 240,
                border: `1.5px solid ${sfocused ? C.sage : "#D0DEDB"}`,
                borderRadius: 7, fontFamily: "'DM Sans', sans-serif",
                fontSize: ".85rem", color: C.ink, background: C.white, outline: "none",
                boxShadow: sfocused ? `0 0 0 3px rgba(74,140,92,.12)` : "none",
                transition: "all .18s",
              }}
            />
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: ".8rem", color: C.mist, pointerEvents: "none" }}>🔍</span>
          </div>

          {[
            { label: "All sites",    value: filterSite,   set: setFilterSite,   options: sites },
            { label: "All types",    value: filterType,   set: setFilterType,   options: Object.keys(TYPE_LABELS) },
            { label: "All statuses", value: filterStatus, set: setFilterStatus, options: ["open", "closed"] },
          ].map((f, i) => (
            <select key={i} value={f.value} onChange={e => f.set(e.target.value)} style={{
              padding: "8px 30px 8px 10px", border: "1.5px solid #D0DEDB", borderRadius: 7,
              fontFamily: "'DM Sans', sans-serif", fontSize: ".83rem", color: f.value ? C.ink : C.mist,
              background: C.white, outline: "none", cursor: "pointer", appearance: "none",
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%238FA3A0'/%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center",
            }}>
              <option value="">{f.label}</option>
              {f.options.map(o => <option key={o} value={o}>{TYPE_LABELS[o] ?? o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
            </select>
          ))}

          {(search || filterSite || filterType || filterStatus) && (
            <button onClick={() => { setSearch(""); setFilterSite(""); setFilterType(""); setFilterStatus(""); }}
              style={{ background: "none", border: "none", color: C.mist, fontSize: ".8rem", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
              Clear filters
            </button>
          )}
        </div>

        {/* Mobile: card list. A 9-column table at minWidth 620 forced horizontal
            scrolling on a 360px phone — Status and CAs were off-screen and easy
            to miss entirely. Same data, scannable, one tap to open. */}
        <div className="incident-cards anim">
          {loading ? (
            <div style={{ background: C.white, borderRadius: 10, padding: "28px", textAlign: "center", color: C.mist, fontSize: ".85rem", boxShadow: "0 2px 12px rgba(15,31,23,.07)" }}>
              Loading incidents…
            </div>
          ) : loadError ? (
            <div style={{ background: C.white, borderRadius: 10, padding: "24px", textAlign: "center", color: C.mist, fontSize: ".85rem", boxShadow: "0 2px 12px rgba(15,31,23,.07)" }}>
              Couldn't load incidents.
              <div><button onClick={loadData} style={{ marginTop: 10, padding: "8px 18px", background: C.sage, color: "#fff", border: "none", borderRadius: 7, fontWeight: 700, fontSize: ".82rem", cursor: "pointer" }}>Retry</button></div>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ background: C.white, borderRadius: 10, padding: "28px", textAlign: "center", color: C.mist, fontSize: ".85rem", boxShadow: "0 2px 12px rgba(15,31,23,.07)" }}>
              {SEED_INCIDENTS.length === 0 ? "No incidents reported yet." : "No incidents match your filters."}
            </div>
          ) : filtered.map(inc => {
            const cas = CA_STATUS[inc.caStatus];
            const osha = OSHA_COLORS[inc.osha] ?? OSHA_COLORS["Pending"];
            return (
              <div key={inc.id} onClick={() => onViewIncident?.(inc.id)} className="clickable-card has-chevron" style={{
                background: C.white, borderRadius: 10, padding: "12px 26px 12px 14px", marginBottom: 8,
                boxShadow: "0 2px 12px rgba(15,31,23,.07)",
                borderLeft: `3px solid ${SEV_COLORS[inc.severity] ?? C.mist}`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: ".76rem", color: C.sage, fontWeight: 600, whiteSpace: "nowrap" }}>
                    {inc.id}
                  </span>
                  {pill(inc.status === "open" ? "Open" : "Closed", inc.status === "open" ? C.foam : "#EEF1F0", inc.status === "open" ? C.pine : C.slate)}
                </div>
                <div style={{ fontSize: ".92rem", color: C.ink, fontWeight: 600, marginBottom: 4 }}>
                  {TYPE_EMOJI[inc.type]} {TYPE_LABELS[inc.type]}
                </div>
                <div style={{ fontSize: ".8rem", color: C.slate, marginBottom: 8 }}>
                  {inc.site} · <span style={{ color: SEV_COLORS[inc.severity], fontWeight: 600 }}>
                    {inc.severity.charAt(0).toUpperCase() + inc.severity.slice(1)}
                  </span> · {inc.date}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {pill(inc.osha, osha.bg, osha.color)}
                  {pill(cas.label, cas.bg, cas.color)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop: full table */}
        <div className="incident-table anim" style={{ background: C.white, borderRadius: 10, boxShadow: "0 2px 12px rgba(15,31,23,.07)", overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
<table style={{ width: "100%", minWidth: 620, borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["ID", "Type", "Site", "Severity", "Reported", "OSHA", "Corrective actions", "Status", ""].map((h, i) => (
                  <th key={i} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ padding: "28px", textAlign: "center", color: C.mist, fontSize: ".85rem" }}>Loading incidents…</td></tr>
              ) : loadError ? (
                <tr><td colSpan={9} style={{ padding: "24px", textAlign: "center", color: C.mist, fontSize: ".85rem" }}>
                  Couldn't load incidents. <button onClick={loadData} style={{ marginLeft: 8, padding: "6px 14px", background: C.sage, color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, fontSize: ".8rem", cursor: "pointer" }}>Retry</button>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: "28px", textAlign: "center", color: C.mist, fontSize: ".85rem" }}>
                  {SEED_INCIDENTS.length === 0 ? "No incidents reported yet." : "No incidents match your filters."}
                </td></tr>
              ) : filtered.map((inc, ri) => {
                const cas = CA_STATUS[inc.caStatus];
                const osha = OSHA_COLORS[inc.osha] ?? OSHA_COLORS["Pending"];
                return (
                  <tr key={inc.id} className="incident-row" onClick={() => onViewIncident?.(inc.id)}>
                    <td style={{ padding: "11px 14px", borderBottom: "1px solid #F0F4F2", fontFamily: "'DM Mono', monospace", fontSize: ".78rem", color: C.sage, fontWeight: 600 }}>
                      {inc.id}
                    </td>
                    <td style={{ padding: "11px 14px", borderBottom: "1px solid #F0F4F2", fontSize: ".85rem", color: C.ink, whiteSpace: "nowrap" }}>
                      {TYPE_EMOJI[inc.type]} {TYPE_LABELS[inc.type]}
                    </td>
                    <td style={{ padding: "11px 14px", borderBottom: "1px solid #F0F4F2", fontSize: ".83rem", color: C.slate }}>
                      {inc.site}
                    </td>
                    <td style={{ padding: "11px 14px", borderBottom: "1px solid #F0F4F2" }}>
                      <span style={{ fontWeight: 600, fontSize: ".82rem", color: SEV_COLORS[inc.severity] }}>
                        {inc.severity.charAt(0).toUpperCase() + inc.severity.slice(1)}
                      </span>
                    </td>
                    <td style={{ padding: "11px 14px", borderBottom: "1px solid #F0F4F2", fontSize: ".82rem", color: C.slate, whiteSpace: "nowrap" }}>
                      {inc.date}
                    </td>
                    <td style={{ padding: "11px 14px", borderBottom: "1px solid #F0F4F2" }}>
                      {pill(inc.osha, osha.bg, osha.color)}
                    </td>
                    <td style={{ padding: "11px 14px", borderBottom: "1px solid #F0F4F2" }}>
                      {pill(cas.label, cas.bg, cas.color)}
                    </td>
                    <td style={{ padding: "11px 14px", borderBottom: "1px solid #F0F4F2" }}>
                      {pill(inc.status === "open" ? "Open" : "Closed", inc.status === "open" ? C.foam : "#EEF1F0", inc.status === "open" ? C.pine : C.slate)}
                    </td>
                    <td style={{ padding: "11px 14px", borderBottom: "1px solid #F0F4F2", color: C.mist, fontSize: ".8rem" }}>→</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
</div>
        </div>
      </div>
    </div>
  );
}


// ════════════════════════════════════════════════════════════════════════════
// S2d — Incident Detail (Desktop)
// ════════════════════════════════════════════════════════════════════════════

const SEED_DETAIL = {
  id: "INC-2024-0087",
  type: "injury", site: "—", dept: "—",
  severity: "minor", status: "open",
  reporter: "—", date: null,
  description: "—",
  location: "—",
  involved: [],
  rootCause: "",
  investigationNotes: "",
  photos: [],
  osha: "Pending",
  oshaClassification: "",
  triageId: null,
  cas: [],
  checklist: [],
};

// Spec §12.8: OSHA classification editable by Safety Officer and Company Admin only
const USER_ROLE = JSON.parse(sessionStorage.getItem("ehs_user") || "{}").role ?? "staff";

const OSHA_OPTIONS = [
  "Pending", "Review: likely recordable", "Non-recordable", "First aid only (non-recordable)",
  "Recordable – Medical treatment", "Recordable – Restricted work",
  "Recordable – Days away from work", "Recordable – Fatality",
];

function EditableField({ label, value, onSave, multiline = false, canEdit = true }) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(value);
  const [focused, setFocused] = useState(false);

  if (!editing) {
    return (
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: ".7rem", fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: C.mist, marginBottom: 4 }}>{label}</div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <div style={{ fontSize: ".9rem", color: value ? C.ink : C.mist, lineHeight: 1.5, flex: 1 }}>
            {value || <em>Not set</em>}
          </div>
          {canEdit && (
            <button onClick={() => setEditing(true)} style={{
              background: "none", border: "none", color: C.mist, fontSize: ".75rem",
              cursor: "pointer", fontFamily: "'DM Sans', sans-serif", flexShrink: 0,
              padding: "2px 4px", transition: "color .12s",
            }}
              onMouseEnter={e => e.target.style.color = C.pine}
              onMouseLeave={e => e.target.style.color = C.mist}
            >Edit</button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: ".7rem", fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: C.sage, marginBottom: 4 }}>{label}</div>
      {multiline ? (
        <textarea value={draft} onChange={e => setDraft(e.target.value)}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} rows={3}
          style={{ width: "100%", padding: "8px 10px", border: `1.5px solid ${focused ? C.sage : "#D0DEDB"}`, borderRadius: 7, fontFamily: "'DM Sans', sans-serif", fontSize: ".88rem", color: C.ink, outline: "none", resize: "vertical", lineHeight: 1.5, transition: "all .18s" }}
        />
      ) : (
        <input value={draft} onChange={e => setDraft(e.target.value)}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          style={{ width: "100%", padding: "8px 10px", border: `1.5px solid ${focused ? C.sage : "#D0DEDB"}`, borderRadius: 7, fontFamily: "'DM Sans', sans-serif", fontSize: ".88rem", color: C.ink, outline: "none", transition: "all .18s" }}
        />
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button onClick={() => { onSave(draft); setEditing(false); }}
          style={{ padding: "6px 14px", background: C.sage, color: C.white, border: "none", borderRadius: 6, fontFamily: "'DM Sans', sans-serif", fontSize: ".78rem", fontWeight: 600, cursor: "pointer" }}>Save</button>
        <button onClick={() => { setDraft(value); setEditing(false); }}
          style={{ padding: "6px 12px", background: "none", color: C.slate, border: "1px solid #D0DEDB", borderRadius: 6, fontFamily: "'DM Sans', sans-serif", fontSize: ".78rem", cursor: "pointer" }}>Cancel</button>
      </div>
    </div>
  );
}

export function S2dIncidentDetail({ incidentId, companyName, onBack, onHome }) {
  const [incident, setIncident] = useState({ ...SEED_DETAIL, id: incidentId ?? SEED_DETAIL.id });
  const [dbId, setDbId] = useState(null); // server row id, needed for PUT calls
  const [phase, setPhase] = useState(incidentId ? "loading" : "ready"); // loading | ready | notfound
  const [checklistErr, setChecklistErr] = useState("");
  const [floorRef, setFloorRef] = useState(null); // { plan, pos:{x,y} }
  const [newCA, setNewCA] = useState("");
  // NOTE: every hook must stay ABOVE the phase-based early returns further down —
  // React requires a stable hook order across renders (a hook below a conditional
  // return runs only on some renders → error #310, the white "Something went wrong").
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [savedFlash, setSavedFlash] = useState("");
  useEffect(() => { api.listUsers().then(us => setAssignableUsers((us || []).filter(u => u.active !== 0 && !u.is_operator))).catch(() => {}); }, []);

  function handleAddCA(e) {
    e.preventDefault();
    const title = newCA.trim();
    if (!title || !dbId) return;
    api.createCA({ incidentId: dbId, title, priority: "medium" })
      .then(created => {
        setNewCA("");
        // Use the id the SERVER just assigned. This previously invented a
        // client-side placeholder (`tmp-<timestamp>`), so every later action on
        // a freshly-added corrective action — assigning it, changing its status,
        // blocking it — sent that fake id to PUT /api/cas/:id, which matched
        // nothing. The failure was only console.error'd, so the card simply sat
        // there saying "Unassigned" no matter how many times you tried, until a
        // page reload refetched the real ids.
        setIncident(inc => ({ ...inc, cas: [...(inc.cas ?? []), {
          id: created?.id, desc: title, status: "on-track", serverStatus: "open",
          due: null, assignee: "Unassigned", assigneeId: null,
        }] }));
      })
      .catch(err => {
        console.error("Add CA failed:", err.message);
        window.alert("Couldn't add that corrective action — please try again.");
      });
  }
  const [showClose, setShowClose] = useState(false);

  // Load the real incident + its CAs, overlaying server data onto the seed shape
  useEffect(() => {
    if (!incidentId) return;
    // Fetch just THIS incident (photos included) rather than pulling the whole
    // list — the list no longer carries photo data, and downloading every photo
    // of every incident to render one detail screen was a huge mobile cost.
    Promise.all([
      api.getIncident(incidentId).catch(() => null),
      api.listCAs(),
      api.responseChecklists().catch(() => ({})),
    ]).then(([row, cas, tpls]) => {
      if (!row) { setPhase("notfound"); return; }
      setDbId(row.id);
      setPhase("ready");
      if (row.floor_pos && row.site_id) {
        const pos = JSON.parse(row.floor_pos);
        api.siteFloorplan(row.site_id).then(r => {
          if (r.floorplan) setFloorRef({ plan: r.floorplan, pos });
        }).catch(() => {});
      }
      const rowCAs = cas.filter(c => c.incident_id === row.id);
      setIncident(i => ({
        ...i,
        id: row.ref, type: row.type, site: row.site_name ?? i.site,
        severity: row.severity ?? i.severity, status: row.status,
        reporter: row.reporter_name ?? i.reporter,
        date: row.occurred_at ?? row.created_at ?? i.date,
        description: row.description ?? i.description,
        location: row.location_detail ?? i.location,
        latitude: row.latitude ?? null, longitude: row.longitude ?? null,
        osha: row.osha_classification ?? "Pending",
        involved: JSON.parse(row.involved || "[]"),
        rootCause: row.root_cause ?? "",
        investigationNotes: row.investigation_notes ?? "",
        dept: row.department ?? "—",
        photos: JSON.parse(row.photos || "[]"),
        cas: rowCAs.length ? rowCAs.map(c => ({
          id: c.id, desc: c.title, assignee: c.assignee_name ?? "Unassigned", serverStatus: c.status,
          assigneeId: c.assignee_id ?? null,
          blockedReason: c.blocked_reason ?? null,
          // "blocked" outranks overdue in the badge: an overdue item that's ALSO
          // blocked needs a person, not another nag — surface the actionable one.
          due: c.due_date, status: c.status === "done" || c.status === "verified" ? "closed"
               : c.status === "blocked" ? "blocked"
               : (c.due_date && new Date(c.due_date) < new Date()) ? "overdue" : "on-track",
          priority: c.priority,
        })) : [],
        triageId: null,
        checklist: (() => {
          const items = Array.isArray(tpls[row.type]) ? tpls[row.type] : [];
          const prog  = JSON.parse(row.response_progress || "[]");
          return items.map((t, idx) => ({ id: idx, text: t, done: prog.includes(t) }));
        })(),
      }));
    }).catch(err => { console.error("Failed to load incident detail:", err.message); setPhase("notfound"); });
  }, [incidentId]);

  if (phase === "loading") return (
    <div style={{ padding: "60px 24px", textAlign: "center", color: "#7A8B82", fontSize: ".9rem" }}>Loading incident…</div>
  );
  if (phase === "notfound") return (
    <div style={{ padding: "60px 24px", textAlign: "center" }}>
      <div style={{ fontSize: "2rem", marginBottom: 10 }}>🔎</div>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>Incident not found</div>
      <div style={{ color: "#7A8B82", fontSize: ".85rem", marginBottom: 16 }}>{incidentId} isn't on the server — it may not have saved.</div>
      <button onClick={onBack} style={{ padding: "10px 18px", borderRadius: 8, border: "1px solid #CBD9D1", background: "#fff", fontWeight: 600 }}>← Back</button>
    </div>
  );

  function exportCSV() {
    const inc = incident;
    const rows = [
      ["Field", "Value"],
      ["Incident ID", inc.id],
      ["Type", inc.type],
      ["Site", inc.site],
      ["Department", inc.dept],
      ["Severity", inc.severity],
      ["Status", inc.status],
      ["OSHA Classification", inc.osha],
      ["Reporter", inc.reporter],
      ["Reported", inc.date ? new Date(inc.date).toLocaleString() : "—"],
      ["Location", inc.location],
      ["Description", inc.description],
      [],
      ["Corrective Action", "Assignee", "Due", "Status"],
      ...inc.cas.map(c => [c.desc, c.assignee, c.due || "—", c.status]),
      [],
      ["Response Checklist Item", "Done"],
      ...inc.checklist.map(c => [c.text, c.done ? "Yes" : "No"]),
    ];
    const esc = v => {
      const str = String(v ?? "");
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const csv = rows.map(r => r.map(esc).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${inc.id}.csv`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  function exportPDF() {
    // Browser-native print-to-PDF: robust on mobile, no bundle bloat.
    window.print();
  }

  function toggleChecklistItem(id) {
    if (!dbId) return;
    setIncident(inc => {
      const next = inc.checklist.map(c => c.id === id ? { ...c, done: !c.done } : c);
      api.saveResponseProgress(dbId, next.filter(c => c.done).map(c => c.text))
        .catch(err => {
          console.error("Checklist save failed:", err.message);
          setChecklistErr("Couldn't save that step — check your connection and try again.");
          // Roll the toggle back so the UI never shows a tick that isn't saved.
          setIncident(cur => ({ ...cur, checklist: cur.checklist.map(c => c.id === id ? { ...c, done: !c.done } : c) }));
          setTimeout(() => setChecklistErr(""), 4000);
        });
      return { ...inc, checklist: next };
    });
  }

  // Explicit CA status change (no more tap-to-cycle, which closed CAs on an
  // accidental click with no way back). Closing asks for confirmation; a closed CA
  // can be reopened. Maps UI status → server status.
  function setCaStatus(ca, serverNext) {
    if (!dbId) return;
    if (serverNext === "done" && !window.confirm("Mark this corrective action complete?")) return;
    const patch = { status: serverNext };
    if (serverNext === "blocked") {
      // A blocker with no explanation can't be actioned by anyone else, which
      // defeats the point — so the reason is required, not optional.
      const why = window.prompt("What's blocking this? (needed so someone can help unstick it)");
      if (why === null) return;                    // cancelled — leave status alone
      if (!why.trim()) { window.alert("Please describe what's blocking it."); return; }
      patch.blockedReason = why.trim();
    }
    api.updateCA(ca.id, patch).then(() => {
      setIncident(inc => ({ ...inc, cas: inc.cas.map(c => c.id !== ca.id ? c : {
        ...c, serverStatus: serverNext,
        blockedReason: serverNext === "blocked" ? patch.blockedReason : c.blockedReason,
        status: serverNext === "done" || serverNext === "verified" ? "closed"
              : serverNext === "blocked" ? "blocked"
              : (c.due && new Date(c.due) < new Date()) ? "overdue" : "on-track",
      })}));
    }).catch(err => {
      // Was console-only, which is how the temp-id bug stayed invisible: the
      // request failed, nothing changed on screen, and no one was told.
      console.error("CA update failed:", err.message);
      window.alert("Couldn't save that change — please try again.");
    });
  }
  // Pick from the real roster instead of typing a name. The previous version used
  // window.prompt and fuzzy-matched the text, which failed constantly on a phone:
  // keyboard autocomplete would rewrite "joh" into "john de", nothing matched
  // "John Doe", and the assignment silently never happened — so a corrective
  // action could sit unassigned while looking like it had been actioned.
  function assignCA(ca, rawUserId) {
    if (!dbId) return;
    if (!ca.id || String(ca.id).startsWith("tmp-")) {   // belt-and-braces
      window.alert("Please reload before assigning this one — it hasn't finished saving.");
      return;
    }
    const userId = rawUserId === "" || rawUserId == null ? null : Number(rawUserId);
    api.updateCA(ca.id, { assigneeId: userId }).then(() => {
      const name = userId
        ? ((assignableUsers || []).find(u => u.id === userId)?.name ?? "Unassigned")
        : "Unassigned";
      setIncident(inc => ({ ...inc, cas: inc.cas.map(c => c.id === ca.id ? { ...c, assignee: name, assigneeId: userId } : c) }));
    }).catch(err => {
      console.error("CA assign failed:", err.message);
      window.alert("Couldn't save that assignment — please try again.");
    });
  }

  const canClose = ["admin", "safety", "site_manager"].includes(USER_ROLE);
  function toggleIncidentStatus() {
    if (!dbId) return;
    const next = incident.status === "closed" ? "open" : "closed";
    api.updateIncident(dbId, { status: next })
      .then(() => setIncident(inc => ({ ...inc, status: next })))
      .catch(err => console.error("Status update failed:", err.message));
  }

  const canEditOsha = USER_ROLE === "safety" || USER_ROLE === "admin";
  // Spec §12.8: once closed, read-only for standard users; Company Admin can edit for error correction
  const canEdit = incident.status !== "closed" || USER_ROLE === "admin";

  function updateField(field, value) {
    setIncident(i => ({ ...i, [field]: value }));
    if (field === "status" && dbId) {
      api.updateIncident(dbId, { status: value }).catch(err => console.error("Status update failed:", err.message));
    }
    if (field === "dept" && dbId) {
      api.updateIncident(dbId, { department: value }).then(() => flashSaved("dept")).catch(err => console.error("Department update failed:", err.message));
    }
    if (field === "description" && dbId) {
      api.updateIncident(dbId, { description: value }).then(() => flashSaved("description")).catch(err => console.error("Description update failed:", err.message));
    }
    if (field === "location" && dbId) {
      api.updateIncident(dbId, { locationDetail: value }).then(() => flashSaved("location")).catch(err => console.error("Location update failed:", err.message));
    }
    if (field === "osha" && dbId) {
      api.updateIncident(dbId, { oshaClassification: value }).then(() => flashSaved("osha")).catch(err => console.error("OSHA update failed:", err.message));
    }
    if (field === "rootCause" && dbId) {
      api.updateIncident(dbId, { rootCause: value }).then(() => flashSaved("rootCause")).catch(err => console.error("Root cause update failed:", err.message));
    }
    if (field === "investigationNotes" && dbId) {
      api.updateIncident(dbId, { investigationNotes: value }).then(() => flashSaved("investigationNotes")).catch(err => console.error("Notes update failed:", err.message));
    }
    if (field === "involved" && dbId) {
      api.updateIncident(dbId, { involved: value }).then(() => flashSaved("involved")).catch(err => console.error("Involved update failed:", err.message));
    }
  }

  // Lightweight "Saved ✓" feedback for the investigation fields.
  function flashSaved(key) { setSavedFlash(key); setTimeout(() => setSavedFlash(k => k === key ? "" : k), 1800); }

  const caStatusSummary = {
    overdue:   incident.cas.filter(c => c.status === "overdue").length,
    onTrack:   incident.cas.filter(c => c.status === "on-track").length,
    closed:    incident.cas.filter(c => c.status === "closed").length,
  };

  return (
    <div className="incident-detail-root" style={{ minHeight: "100vh", background: C.chalk, fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .anim { animation: fadeUp .25s ease both; }
        input::placeholder, textarea::placeholder { color: ${C.mist}; }
        .export-btn:hover { background: ${C.foam} !important; }
        .close-btn:hover  { background: ${C.pine} !important; }
        @media print {
          @page { margin: 16mm; }
          body { background: #fff !important; }
          .no-print, nav, .bottom-nav, [data-nav] { display: none !important; }
          .incident-detail-root { background: #fff !important; min-height: auto !important; }
          .print-card { box-shadow: none !important; border: 1px solid #ddd; break-inside: avoid; }
          textarea, input, select { border: none !important; padding: 0 !important; }
        }
      `}</style>

      <DesktopNav companyName={companyName} onHome={onHome} />

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px" }}>

        {/* Header */}
        {/* flexWrap matters: the action buttons are flexShrink:0, so without it
            they hold ~350px on a 360px phone and squeeze the title column to
            nothing — minWidth:0 then lets the heading collapse to one character
            per line ("M / ori / ah"). Wrapping drops the actions to their own
            row instead, and flex-basis keeps the title readable until it does. */}
        <div className="anim detail-header" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 16, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0, flex: "1 1 240px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <button onClick={onBack} style={{ background: "none", border: "none", color: C.mist, fontSize: ".82rem", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap", flexShrink: 0, padding: 0 }}>← Incidents</button>
              <span style={{ color: "#D0DEDB" }}>/</span>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: ".85rem", color: C.sage, fontWeight: 600, whiteSpace: "nowrap" }}>{incident.id}</span>
            </div>
            <h1 style={{ fontSize: "1.35rem", fontWeight: 700, color: C.ink, overflowWrap: "anywhere", wordBreak: "normal" }}>
              {TYPE_EMOJI[incident.type]} {TYPE_LABELS[incident.type]} — {incident.site}
            </h1>
            <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
              {pill(incident.severity.charAt(0).toUpperCase() + incident.severity.slice(1), SEV_COLORS[incident.severity] + "18", SEV_COLORS[incident.severity])}
              {pill(incident.status === "open" ? "Open" : "Closed", incident.status === "open" ? C.foam : "#EEF1F0", incident.status === "open" ? C.pine : C.slate)}
              {canClose && dbId && incident.status === "closed" && (
                <button onClick={toggleIncidentStatus} style={{
                  padding: "5px 12px", borderRadius: 7, border: `1.5px solid ${C.mint}`,
                  background: C.white, color: C.pine, fontFamily: "'DM Sans', sans-serif",
                  fontSize: ".76rem", fontWeight: 700, cursor: "pointer",
                }}>Reopen</button>
              )}
              {incident.triageId && (
                <span style={{ fontSize: ".75rem", color: C.sage, fontStyle: "italic" }}>
                  🔗 Triage: {incident.triageId}
                </span>
              )}
            </div>
          </div>
          <div className="no-print detail-actions" style={{ display: "flex", gap: 10, flexShrink: 0 }}>
            <button className="export-btn" onClick={exportPDF} style={{
              padding: "8px 16px", background: C.white, color: C.pine,
              border: `1.5px solid ${C.mint}`, borderRadius: 7,
              fontFamily: "'DM Sans', sans-serif", fontSize: ".83rem", fontWeight: 600,
              cursor: "pointer", transition: "all .15s",
            }}>Export PDF</button>
            <button className="export-btn" onClick={exportCSV} style={{
              padding: "8px 16px", background: C.white, color: C.pine,
              border: `1.5px solid ${C.mint}`, borderRadius: 7,
              fontFamily: "'DM Sans', sans-serif", fontSize: ".83rem", fontWeight: 600,
              cursor: "pointer", transition: "all .15s",
            }}>Export CSV</button>
            {incident.status === "open" && (
              <button className="close-btn" onClick={() => setShowClose(true)} style={{
                padding: "8px 16px", background: C.sage, color: C.white,
                border: "none", borderRadius: 7,
                fontFamily: "'DM Sans', sans-serif", fontSize: ".83rem", fontWeight: 600,
                cursor: "pointer", transition: "all .15s",
              }}>Close incident</button>
            )}
          </div>
        </div>

        {/* Two-column layout */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20, alignItems: "start" }}>

          {/* Left: main details */}
          <div>
            {/* Incident details card */}
            <div className="anim" style={{ background: C.white, borderRadius: 10, boxShadow: "0 2px 12px rgba(15,31,23,.07)", padding: 24, marginBottom: 16 }}>
              <h2 style={{ fontSize: ".95rem", fontWeight: 600, color: C.ink, marginBottom: 16 }}>Incident details</h2>

              <EditableField label="Description" value={incident.description} multiline canEdit={canEdit}
                onSave={v => updateField("description", v)} />

              {floorRef && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: ".7rem", fontWeight: 600, letterSpacing: ".07em", textTransform: "uppercase", color: C.mist, marginBottom: 8 }}>Marked location</div>
                  <div style={{ position: "relative", maxWidth: 420 }}>
                    <img src={floorRef.plan} alt="Floor plan" style={{ width: "100%", borderRadius: 8, border: "1px solid #E2EBE6", display: "block" }} />
                    <div style={{ position: "absolute", left: `${floorRef.pos.x}%`, top: `${floorRef.pos.y}%`, transform: "translate(-50%, -90%)", fontSize: "1.4rem", pointerEvents: "none" }}>📍</div>
                  </div>
                </div>
              )}
              <EditableField label="Location within site" value={incident.location} canEdit={canEdit}
                onSave={v => updateField("location", v)} />

              {incident.latitude != null && incident.longitude != null && (
                <div style={{ marginTop: -6, marginBottom: 14 }}>
                  <a href={`https://www.google.com/maps?q=${incident.latitude},${incident.longitude}`}
                     target="_blank" rel="noopener noreferrer"
                     style={{ fontSize: ".8rem", color: C.sage, fontWeight: 600, textDecoration: "none" }}>
                    📍 GPS captured — view on map
                  </a>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <div style={{ fontSize: ".7rem", fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: C.mist, marginBottom: 4 }}>Reporter</div>
                  <div style={{ fontSize: ".9rem", color: C.ink }}>{incident.reporter}</div>
                </div>
                <div>
                  <div style={{ fontSize: ".7rem", fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: C.mist, marginBottom: 4 }}>Reported</div>
                  <div style={{ fontSize: ".9rem", color: C.ink }}>{new Date(incident.date).toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <div style={{ fontSize: ".7rem", fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: C.mist, marginBottom: 4 }}>Department</div>
                    {canEdit && dbId && (
                      <button onClick={() => { const v = window.prompt("Department", incident.dept === "—" ? "" : incident.dept); if (v !== null) updateField("dept", v.trim() || "—"); }}
                        style={{ background: "none", border: "none", color: C.sage, fontSize: ".72rem", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", padding: 0 }}>Edit</button>
                    )}
                  </div>
                  <div style={{ fontSize: ".9rem", color: C.ink }}>{incident.dept}</div>
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <div style={{ fontSize: ".7rem", fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: C.mist }}>Involved</div>
                    {savedFlash === "involved" && <span style={{ fontSize: ".68rem", color: C.sage, fontWeight: 700 }}>Saved ✓</span>}
                    {canEdit && dbId && (
                      <button onClick={() => {
                        const current = (incident.involved || []).join(", ");
                        const v = window.prompt("Involved people (comma-separated for multiple)", current);
                        if (v !== null) { const arr = v.split(",").map(s => s.trim()).filter(Boolean); updateField("involved", arr); }
                      }} style={{ background: "none", border: "none", color: C.sage, fontSize: ".72rem", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", padding: 0 }}>Edit</button>
                    )}
                  </div>
                  <div style={{ fontSize: ".9rem", color: C.ink }}>
                    {(incident.involved && incident.involved.length) ? incident.involved.join(", ") : "—"}
                  </div>
                </div>
              </div>

              <div style={{ height: 1, background: "#E8EFec", margin: "16px 0" }} />

              {/* Spec §12.8: OSHA classification — editable by Safety Officer and Company Admin ONLY */}
              <div style={{ marginBottom: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ fontSize: ".7rem", fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: canEditOsha ? C.sage : C.mist }}>
                    OSHA Classification
                  </div>
                  {savedFlash === "osha" && <span style={{ fontSize: ".68rem", color: C.sage, fontWeight: 700 }}>Saved ✓</span>}
                  {!canEditOsha && (
                    <span style={{ fontSize: ".68rem", color: C.mist, fontStyle: "italic" }}>Safety Officer or Admin only</span>
                  )}
                </div>
                {canEditOsha ? (
                  <select
                    value={incident.osha}
                    onChange={e => updateField("osha", e.target.value)}
                    style={{
                      width: "100%", padding: "9px 12px",
                      border: "1.5px solid #D0DEDB", borderRadius: 7,
                      fontFamily: "'DM Sans', sans-serif", fontSize: ".88rem",
                      color: C.ink, background: C.white, outline: "none",
                      cursor: "pointer", appearance: "none",
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%238FA3A0'/%3E%3C/svg%3E")`,
                      backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", paddingRight: 32,
                    }}
                  >
                    {OSHA_OPTIONS.map(o => <option key={o}>{o}</option>)}
                  </select>
                ) : (
                  <div style={{ fontSize: ".9rem", color: C.ink }}>{incident.osha}</div>
                )}
              </div>
            </div>

            {/* Photos */}
            <div className="anim" style={{ background: C.white, borderRadius: 10, boxShadow: "0 2px 12px rgba(15,31,23,.07)", padding: 24, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <h2 style={{ fontSize: ".95rem", fontWeight: 600, color: C.ink }}>Photos</h2>
                <span style={{ fontSize: ".78rem", color: C.mist }}>{Array.isArray(incident.photos) ? incident.photos.length : incident.photos} attached</span>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                {Array.isArray(incident.photos)
                  ? incident.photos.map((ph, i) => (
                      <AuthImg key={i} photo={ph} alt={ph.name ?? `Photo ${i + 1}`} style={{
                        width: 100, height: 80, borderRadius: 8, objectFit: "cover", border: "2px solid #E2EBE6",
                      }} />
                    ))
                  : Array.from({ length: incident.photos }).map((_, i) => (
                  <div key={i} style={{
                    width: 100, height: 80, borderRadius: 8,
                    background: `hsl(${140 + i * 20}, 20%, 85%)`,
                    border: "2px solid #E2EBE6",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: ".72rem", color: C.mist,
                  }}>Photo {i + 1}</div>
                ))}
                {canEdit && (
                  <div style={{
                    width: 100, height: 80, borderRadius: 8,
                    border: "2px dashed #C8DDD2", background: C.chalk,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: ".75rem", color: C.sage, cursor: "pointer",
                  }}>+ Add</div>
                )}
              </div>
            </div>

            {/* Investigation — elevated-staff fields: root cause + notes. Editable by
                admin/safety/site_manager; read-only summary for everyone else. */}
            <div className="anim" style={{ background: C.white, borderRadius: 10, boxShadow: "0 2px 12px rgba(15,31,23,.07)", padding: 24, marginBottom: 16 }}>
              <h2 style={{ fontSize: ".95rem", fontWeight: 600, color: C.ink, marginBottom: 14 }}>Investigation</h2>

              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                  <label style={{ fontSize: ".7rem", fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: C.mist }}>Root cause</label>
                  {savedFlash === "rootCause" && <span style={{ fontSize: ".68rem", color: C.sage, fontWeight: 700 }}>Saved ✓</span>}
                </div>
                {canEdit && dbId ? (
                  <textarea defaultValue={incident.rootCause} onBlur={e => { if (e.target.value !== incident.rootCause) updateField("rootCause", e.target.value); }}
                    placeholder="What was the underlying cause? (saved when you click away)"
                    style={{ width: "100%", minHeight: 60, padding: "9px 11px", border: "1.5px solid #D7E3DD", borderRadius: 8, fontFamily: "'DM Sans', sans-serif", fontSize: ".88rem", color: C.ink, resize: "vertical", boxSizing: "border-box" }} />
                ) : (
                  <div style={{ fontSize: ".9rem", color: incident.rootCause ? C.ink : C.mist }}>{incident.rootCause || "Not yet determined"}</div>
                )}
              </div>

              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                  <label style={{ fontSize: ".7rem", fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: C.mist }}>Investigation notes</label>
                  {savedFlash === "investigationNotes" && <span style={{ fontSize: ".68rem", color: C.sage, fontWeight: 700 }}>Saved ✓</span>}
                </div>
                {canEdit && dbId ? (
                  <textarea defaultValue={incident.investigationNotes} onBlur={e => { if (e.target.value !== incident.investigationNotes) updateField("investigationNotes", e.target.value); }}
                    placeholder="Findings, witness statements, HR / Workers' Comp follow-up, additional context… (saved when you click away)"
                    style={{ width: "100%", minHeight: 90, padding: "9px 11px", border: "1.5px solid #D7E3DD", borderRadius: 8, fontFamily: "'DM Sans', sans-serif", fontSize: ".88rem", color: C.ink, resize: "vertical", boxSizing: "border-box" }} />
                ) : (
                  <div style={{ fontSize: ".9rem", color: incident.investigationNotes ? C.ink : C.mist, whiteSpace: "pre-wrap" }}>{incident.investigationNotes || "No notes yet"}</div>
                )}
              </div>
            </div>
          </div>
          <div>
            {/* CAs summary */}
            <div className="anim" style={{ background: C.white, borderRadius: 10, boxShadow: "0 2px 12px rgba(15,31,23,.07)", padding: 20, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h2 style={{ fontSize: ".95rem", fontWeight: 600, color: C.ink }}>Corrective actions</h2>
                <span style={{ fontSize: ".72rem", color: C.mist }}>
                  {caStatusSummary.overdue} overdue · {caStatusSummary.onTrack} on track · {caStatusSummary.closed} closed
                </span>
              </div>
              {incident.cas.map(ca => {
                const s = CA_STATUS[ca.status] ?? CA_STATUS["on-track"];
                const canManageCA = ["admin", "safety", "site_manager"].includes(USER_ROLE);
                const srv = ca.serverStatus ?? "open";
                return (
                  <div key={ca.id} style={{
                    padding: "10px 12px", marginBottom: 8,
                    background: C.chalk, borderRadius: 8, borderLeft: `3px solid ${s.color}`,
                  }}>
                    <div style={{ fontSize: ".85rem", color: C.ink, marginBottom: 6, lineHeight: 1.3 }}>{ca.desc}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      {pill(s.label, s.bg, s.color)}
                      {ca.due && <span style={{ fontSize: ".7rem", color: C.mist }}>Due {ca.due}</span>}
                      <span style={{ fontSize: ".7rem", color: C.mist }}>→ {ca.assignee}</span>
                    </div>
                    {ca.serverStatus === "blocked" && ca.blockedReason && (
                      <div style={{ fontSize: ".75rem", color: "#8A6D00", background: "#FBF0CE", borderRadius: 6, padding: "6px 9px", marginTop: 6, lineHeight: 1.35 }}>
                        <strong>Blocked:</strong> {ca.blockedReason}
                      </div>
                    )}
                    {canManageCA && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                        <select value={srv} onChange={e => setCaStatus(ca, e.target.value)}
                          style={{ padding: "5px 8px", border: "1.5px solid #D0DEDB", borderRadius: 6, fontFamily: "'DM Sans', sans-serif", fontSize: ".76rem", color: C.ink, background: "#fff", cursor: "pointer" }}>
                          <option value="open">Open</option>
                          <option value="in_progress">In progress</option>
                          <option value="blocked">Blocked — needs help</option>
                          <option value="done">Complete</option>
                        </select>
                        <PersonPicker
                          value={ca.assigneeId ?? null}
                          options={assignableUsers}
                          onChange={id => assignCA(ca, id)}
                        />
                        {(srv === "done" || srv === "verified") && (
                          <button onClick={() => setCaStatus(ca, "open")} style={{ background: "none", border: "none", color: C.mist, fontSize: ".74rem", fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", padding: 0 }}>Reopen</button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {["admin", "safety", "site_manager"].includes(USER_ROLE) && (
                <form onSubmit={handleAddCA} style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <input value={newCA} onChange={e => setNewCA(e.target.value)} placeholder="Add a corrective action…"
                    style={{ flex: 1, padding: "9px 11px", border: "1.5px solid #D0DEDB", borderRadius: 7, fontFamily: "'DM Sans', sans-serif", fontSize: ".84rem", color: C.ink, outline: "none" }} />
                  <button type="submit" disabled={!newCA.trim()} style={{
                    padding: "9px 16px", background: newCA.trim() ? C.sage : "#C8D8CE", color: "#fff",
                    border: "none", borderRadius: 7, fontFamily: "'DM Sans', sans-serif",
                    fontSize: ".82rem", fontWeight: 700, cursor: newCA.trim() ? "pointer" : "default",
                  }}>Add</button>
                </form>
              )}
            </div>

            {/* Response checklist */}
            <div className="anim" style={{ background: C.white, borderRadius: 10, boxShadow: "0 2px 12px rgba(15,31,23,.07)", overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid #F0F4F2" }}>
                <h2 style={{ fontSize: ".95rem", fontWeight: 600, color: C.ink }}>Response checklist</h2>
                <p style={{ fontSize: ".72rem", color: C.mist, marginTop: 2 }}>
                  {incident.checklist.filter(c => c.done).length}/{incident.checklist.length} completed
                </p>
              </div>
              {checklistErr && (
                <div style={{ margin: "0 18px 8px", padding: "8px 10px", background: "#FDEDEC",
                              borderRadius: 6, fontSize: ".75rem", color: "#B3261E" }}>
                  {checklistErr}
                </div>
              )}
              {incident.checklist.map((item, i) => (
                <div key={item.id} onClick={() => toggleChecklistItem(item.id)} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "11px 18px", cursor: dbId ? "pointer" : "default",
                  borderBottom: i < incident.checklist.length - 1 ? "1px solid #F0F4F2" : "none",
                  background: item.done ? C.foam : C.white,
                }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                    border: `2px solid ${item.done ? C.sage : "#D0DEDB"}`,
                    background: item.done ? C.sage : "none",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {item.done && <span style={{ color: C.white, fontSize: ".6rem" }}>✓</span>}
                  </div>
                  <span style={{ fontSize: ".85rem", color: item.done ? C.sage : C.ink, textDecoration: item.done ? "line-through" : "none" }}>
                    {item.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
