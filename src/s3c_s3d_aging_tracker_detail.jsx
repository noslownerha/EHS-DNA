import { useState, useMemo, useEffect } from "react";
import { EHSHeader } from "./AppShell.jsx";
import { BRAND, COLORS } from "./constants.js";
import { api } from "./api.js";

const C = { ...COLORS };

// Severity colours per spec
const SEV = {
  critical: { label: "Critical", color: C.red,    bg: C.redLt    },
  major:    { label: "Major",    color: C.orange, bg: C.orangeLt },
  minor:    { label: "Minor",    color: C.gold,   bg: C.goldLt   },
  noted:    { label: "Noted",    color: C.slate,  bg: "#EEF1F0"  },
};

const today = new Date("2024-06-14");

function isDueThisWeek(dueDateStr) {
  const d = new Date(dueDateStr);
  const diff = (d - today) / 86400000;
  return diff >= 0 && diff <= 7;
}
function isOverdue(dueDateStr) {
  return new Date(dueDateStr) < today;
}

function DesktopNav({ companyName = BRAND.company, active = "", onHome }) {
  return (
    <EHSHeader onHome={onHome} title={companyName} rightContent={
      active ? (
        <div style={{ fontSize: ".72rem", color: C.mist, background: "rgba(255,255,255,.08)", padding: "3px 12px", borderRadius: 20, whiteSpace: "nowrap" }}>{active}</div>
      ) : null
    } />
  );
}

function pill(label, bg, color) {
  return <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 9px", borderRadius: 20, fontSize: ".68rem", fontWeight: 600, whiteSpace: "nowrap", background: bg, color }}>{label}</span>;
}

// ── Age bar ───────────────────────────────────────────────────────────────────
function AgeBar({ days, maxDays = 14, severity }) {
  const pct = Math.min((days / maxDays) * 100, 100);
  const color = days >= 10 ? C.red : days >= 5 ? C.orange : C.sage;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: "#E2EBE6", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3, transition: "width .3s" }} />
      </div>
      <span style={{ fontSize: ".72rem", color, fontWeight: 600, minWidth: 32, textAlign: "right" }}>{days}d</span>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// S3c — Aging Tracker (Desktop)
// ════════════════════════════════════════════════════════════════════════════
export function S3cAgingTracker({ onHome, companyName, onViewFinding }) {
  const [SEED_FINDINGS, setFindings] = useState([]);
  useEffect(() => {
    api.listFindings().then(rows => {
      const bySite = Object.fromEntries((BRAND.siteRecords ?? []).map(s => [s.id, s.name]));
      // These fields were hardcoded placeholders because the API never returned
      // them. It does now — so the tracker shows the real assignee, due date and
      // CapEx state instead of "Unassigned / General / no due date" for every row.
      setFindings(rows.map(f => ({
        id: f.id, site: bySite[f.site_id] ?? "—", dept: "—",
        category: f.category ?? "General", severity: f.severity ?? "minor",
        desc: f.description, assignee: f.assignee ?? "Unassigned",
        due: f.due_date ?? null, status: f.status, capex: !!f.capex,
        safetyRelevant: f.safety_relevant === 0 ? false : true,
        ageDays: Math.max(0, Math.floor((Date.now() - new Date(f.created_at).getTime()) / 86400000)),
      })));
    }).catch(err => console.error("Findings load failed:", err.message));
  }, []);
  const [filterSite,    setFilterSite]    = useState("");
  const [filterSev,     setFilterSev]     = useState("");
  const [filterAssignee,setFilterAssignee]= useState("");
  // "safety" (default) | "nonsafety" | "all". Defaults to safety-only so the tiles
  // read as safety numbers; the non-safety pile stays one tap away rather than
  // hidden, so an exclusion can never quietly disappear from view.
  const [scope,         setScope]         = useState("safety");
  const [selected,      setSelected]      = useState(new Set());
  const [sfocused,      setSfocused]      = useState(false);
  const [search,        setSearch]        = useState("");

  const allOpen = SEED_FINDINGS.filter(f => f.status !== "resolved");
  const open = allOpen.filter(f =>
    scope === "all" ? true : scope === "nonsafety" ? !f.safetyRelevant : f.safetyRelevant);
  const nonSafetyOpenCount = allOpen.filter(f => !f.safetyRelevant).length;

  // Spec §13.2: CapEx findings remain visible but excluded from avg age
  const nonCapExOpen = open.filter(f => !f.capex);
  const avgAge = nonCapExOpen.length > 0
    ? Math.round(nonCapExOpen.reduce((sum, f) => sum + f.ageDays, 0) / nonCapExOpen.length)
    : 0;

  // Spec §13.3: 4 tiles — Critical Open, Overdue, Due This Week, On Track
  const kpis = [
    { label: "Critical Open",  value: open.filter(f => f.severity === "critical").length, color: C.red,    accent: C.redLt    },
    { label: "Overdue",        value: open.filter(f => isOverdue(f.due)).length,           color: C.orange, accent: C.orangeLt },
    { label: "Due This Week",  value: open.filter(f => isDueThisWeek(f.due)).length,       color: C.gold,   accent: C.goldLt   },
    { label: "On Track",       value: open.filter(f => !isOverdue(f.due) && !isDueThisWeek(f.due)).length, color: C.sage, accent: C.foam },
  ];

  const sites     = [...new Set(SEED_FINDINGS.map(f => f.site))];
  const assignees = [...new Set(SEED_FINDINGS.map(f => f.assignee))];

  const filtered = useMemo(() =>
    // 'open' is derived from SEED_FINDINGS, which starts at [] and is
    // populated by an async fetch — without 'open' as a dependency here, this
    // memo never recomputes after that fetch resolves, so the tracker showed
    // "No open findings" forever on load until a filter happened to change.
    open.filter(f => {
      if (filterSite     && f.site !== filterSite)         return false;
      if (filterSev      && f.severity !== filterSev)      return false;
      if (filterAssignee && f.assignee !== filterAssignee) return false;
      if (search && !f.desc.toLowerCase().includes(search.toLowerCase()) &&
          !f.category.toLowerCase().includes(search.toLowerCase()))      return false;
      return true;
    }),
    [open, filterSite, filterSev, filterAssignee, search, scope]
  );

  function toggleSelect(id) {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

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
        .finding-row:hover td { background: ${C.foam} !important; cursor: pointer; }
        select option { color: ${C.ink}; }
      `}</style>

      <DesktopNav companyName={companyName} active="Findings" onHome={onHome} />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px" }}>

        {/* Header */}
        <div className="anim" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: C.ink }}>Open Findings</h1>
            <p style={{ fontSize: ".85rem", color: C.mist, marginTop: 3 }}>All sites · {open.length} open findings</p>
          </div>
        </div>

        {/* Spec §13.3: 4 KPI tiles, fixed height, value and label only */}
        <div className="anim" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 14, marginBottom: 8 }}>
          {kpis.map((kpi, i) => (
            <div key={i} style={{
              background: C.white, borderRadius: 10,
              boxShadow: "0 2px 12px rgba(15,31,23,.07)",
              padding: "20px 22px", height: 90,
              display: "flex", flexDirection: "column", justifyContent: "center",
              borderTop: `3px solid ${kpi.color}`,
            }}>
              <div style={{ fontSize: "1.75rem", fontWeight: 700, color: kpi.color, lineHeight: 1 }}>{kpi.value}</div>
              <div style={{ fontSize: ".8rem", color: C.slate, marginTop: 4, fontWeight: 500 }}>{kpi.label}</div>
            </div>
          ))}
        </div>

        {/* Spec §13.3: avg age as plain-text note line below tiles (not a fifth tile) */}
        <div className="anim" style={{ fontSize: ".78rem", color: C.mist, marginBottom: 22, paddingLeft: 4 }}>
          Avg age of open findings: {avgAge} days · CapEx-flagged findings excluded from aging
        </div>

        {/* Scope switch. The tiles above are SAFETY numbers, so this sits directly
            under them and defaults to Safety — but the non-safety count is always
            printed on the tab, so an excluded pile can never sit unnoticed. */}
        <div className="anim" style={{ display: "flex", gap: 6, marginBottom: 12, background: C.chalk, padding: 4, borderRadius: 9, width: "fit-content" }}>
          {[
            { id: "safety",    label: "Safety" },
            { id: "nonsafety", label: `Non-safety${nonSafetyOpenCount ? ` (${nonSafetyOpenCount})` : ""}` },
            { id: "all",       label: "All" },
          ].map(t => (
            <button key={t.id} onClick={() => setScope(t.id)} style={{
              padding: "6px 13px", border: "none", borderRadius: 7,
              background: scope === t.id ? C.white : "transparent",
              boxShadow: scope === t.id ? "0 1px 3px rgba(0,0,0,.08)" : "none",
              fontFamily: "'DM Sans', sans-serif", fontSize: ".78rem",
              fontWeight: scope === t.id ? 700 : 500,
              color: scope === t.id ? C.ink : C.slate, cursor: "pointer", transition: "all .15s",
            }}>{t.label}</button>
          ))}
        </div>
        {scope !== "safety" && (
          <div style={{ marginBottom: 12, fontSize: ".74rem", color: C.mist }}>
            {scope === "nonsafety"
              ? "Tracked and assigned, but excluded from safety metrics."
              : "Showing safety and non-safety together — tiles no longer read as safety numbers."}
          </div>
        )}

        {/* Filters + bulk actions */}
        <div className="anim" style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <input value={search} onChange={e => setSearch(e.target.value)}
              onFocus={() => setSfocused(true)} onBlur={() => setSfocused(false)}
              placeholder="Search findings…"
              style={{ padding: "8px 12px 8px 30px", width: 200, border: `1.5px solid ${sfocused ? C.sage : "#D0DEDB"}`, borderRadius: 7, fontFamily: "'DM Sans', sans-serif", fontSize: ".83rem", color: C.ink, background: C.white, outline: "none", boxShadow: sfocused ? `0 0 0 3px rgba(74,140,92,.12)` : "none", transition: "all .18s" }} />
            <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", fontSize: ".78rem", color: C.mist, pointerEvents: "none" }}>🔍</span>
          </div>

          {[
            { label: "All sites",      value: filterSite,     set: setFilterSite,     options: sites },
            { label: "All severities", value: filterSev,      set: setFilterSev,      options: Object.keys(SEV) },
            { label: "All assignees",  value: filterAssignee, set: setFilterAssignee, options: assignees },
          ].map((f, i) => (
            <select key={i} value={f.value} onChange={e => f.set(e.target.value)} style={{
              padding: "8px 28px 8px 10px", border: "1.5px solid #D0DEDB", borderRadius: 7,
              fontFamily: "'DM Sans', sans-serif", fontSize: ".83rem",
              color: f.value ? C.ink : C.mist, background: C.white, outline: "none",
              cursor: "pointer", appearance: "none",
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%238FA3A0'/%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center",
            }}>
              <option value="">{f.label}</option>
              {f.options.map(o => <option key={o} value={o}>{SEV[o]?.label ?? (o.charAt(0).toUpperCase() + o.slice(1))}</option>)}
            </select>
          ))}

          {selected.size > 0 && (
            <button style={{ padding: "8px 16px", background: C.sage, color: C.white, border: "none", borderRadius: 7, fontFamily: "'DM Sans', sans-serif", fontSize: ".83rem", fontWeight: 600, cursor: "pointer" }}>
              Reassign {selected.size} selected
            </button>
          )}
        </div>

        {/* Table */}
        <div className="anim" style={{ background: C.white, borderRadius: 10, boxShadow: "0 2px 12px rgba(15,31,23,.07)", overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
<table style={{ width: "100%", minWidth: 620, borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 36 }}><input type="checkbox" onChange={e => e.target.checked ? setSelected(new Set(filtered.map(f => f.id))) : setSelected(new Set())} style={{ cursor: "pointer" }} /></th>
                {["Finding", "Site / Dept", "Severity", "Assignee", "Due", "Age", ""].map((h, i) => (
                  <th key={i} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: "28px", textAlign: "center", color: C.mist, fontSize: ".85rem" }}>No open findings match your filters.</td></tr>
              ) : filtered.map((f, ri) => {
                const sev = SEV[f.severity] ?? SEV.noted;
                const overdue = isOverdue(f.due);
                return (
                  <tr key={f.id} className="finding-row" onClick={() => onViewFinding?.(f.id)}>
                    <td style={{ padding: "11px 14px", borderBottom: "1px solid #F0F4F2" }} onClick={e => { e.stopPropagation(); toggleSelect(f.id); }}>
                      <input type="checkbox" checked={selected.has(f.id)} onChange={() => toggleSelect(f.id)} style={{ cursor: "pointer" }} />
                    </td>
                    <td style={{ padding: "11px 14px", borderBottom: "1px solid #F0F4F2", maxWidth: 280 }}>
                      <div style={{ fontSize: ".88rem", color: C.ink, lineHeight: 1.3, marginBottom: f.capex ? 4 : 0 }}>{f.desc}</div>
                      {/* Spec §13.2: CapEx badge — navy colour */}
                      {f.capex && (
                        <span style={{ display: "inline-flex", alignItems: "center", padding: "1px 8px", borderRadius: 20, fontSize: ".65rem", fontWeight: 600, background: C.navyLt, color: C.navy }}>CapEx required</span>
                      )}
                    </td>
                    <td style={{ padding: "11px 14px", borderBottom: "1px solid #F0F4F2", fontSize: ".8rem", color: C.slate, whiteSpace: "nowrap" }}>
                      {f.site}<div style={{ fontSize: ".72rem", color: C.mist }}>{f.dept}</div>
                    </td>
                    <td style={{ padding: "11px 14px", borderBottom: "1px solid #F0F4F2" }}>{pill(sev.label, sev.bg, sev.color)}</td>
                    <td style={{ padding: "11px 14px", borderBottom: "1px solid #F0F4F2", fontSize: ".83rem", color: C.slate }}>{f.assignee}</td>
                    <td style={{ padding: "11px 14px", borderBottom: "1px solid #F0F4F2", fontSize: ".82rem", color: overdue ? C.red : C.slate, fontWeight: overdue ? 600 : 400, whiteSpace: "nowrap" }}>
                      {new Date(f.due).toLocaleDateString([], { month: "short", day: "numeric" })}
                      {overdue && <div style={{ fontSize: ".68rem", color: C.red }}>Overdue</div>}
                    </td>
                    <td style={{ padding: "11px 14px", borderBottom: "1px solid #F0F4F2", minWidth: 120 }}>
                      {f.capex
                        ? <span style={{ fontSize: ".72rem", color: C.mist, fontStyle: "italic" }}>Excluded (CapEx)</span>
                        : <AgeBar days={f.ageDays} severity={f.severity} />
                      }
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
// S3d — Finding Detail (Desktop)
// ════════════════════════════════════════════════════════════════════════════
const SEED_DETAIL = {
  id: 1, site: "Moriah", dept: "Bottling & Packaging", category: "PPE",
  severity: "critical",
  desc: "Guard missing on conveyor line 3 — immediate fix required",
  location: "Bottling line 3, north end",
  assignee: "Facility Maintenance", due: "2024-06-12", status: "open",
  ageDays: 2, capex: false, capexNotes: "",
  photos: 2, gps: true,
  loggedBy: "—", loggedAt: null,
  escalationTimeline: [

    { date: "Jun 12", event: "Site Manager notified (Critical severity)" },
    { date: "Jun 14", event: "No activity — reminder sent to Facility Maintenance" },
  ],
  linkedIncidentId: null,
};

const RESOLUTION_ACTIONS = ["Fixed on site", "Work order raised", "Interim control in place", "Deferred — awaiting parts", "Deferred — CapEx approval required", "Finding closed — no action needed"];

// action → pipeline status: resolved closes; interim/deferred stay open (aging continues)
const ACTION_STATUS = {
  "Fixed on site": "resolved",
  "Finding closed — no action needed": "resolved",
  "Work order raised": "interim",
  "Interim control in place": "interim",
  "Deferred — awaiting parts": "interim",
  "Deferred — CapEx approval required": "interim",
};
const ESCALATING = ["Work order raised", "Deferred — awaiting parts", "Deferred — CapEx approval required"];

// Reclassifying moves a finding in or out of the safety numbers, so it mirrors
// the server rule (PUT /api/findings rejects safetyRelevant from anyone else).
const CAN_RECLASSIFY = ["admin", "safety", "site_manager"];

export function S3dFindingDetail({ onHome, findingId, companyName, user, onBack }) {
  const [finding,   setFinding]   = useState({ ...SEED_DETAIL, id: findingId ?? SEED_DETAIL.id, photoList: [] });
  const [dbId, setDbId] = useState(null);

  useEffect(() => {
    if (!findingId) return;
    // Fetch just this finding — the list no longer carries base64 photo data.
    api.getFinding(findingId).then(row => {
      if (!row) return;
      setDbId(row.id);
      setFinding({
        id: `FND-${String(row.id).padStart(4, "0")}`,
        site: row.site_name ?? "—", dept: "—", category: row.category ?? "General",
        severity: row.severity ?? "low",
        desc: row.description, location: row.location ?? "—",
        assignee: row.assignee ?? "Unassigned", due: row.due_date ?? null,
        safetyRelevant: row.safety_relevant === 0 ? false : true,
        status: row.status,
        resolutionAction: row.resolution_action, resolutionNotes: row.resolution_notes,
        ageDays: Math.max(0, Math.floor((Date.now() - new Date(row.created_at).getTime()) / 86400000)),
        capex: !!row.capex, capexNotes: row.capex_notes ?? "",
        photoList: JSON.parse(row.photos || "[]"), gps: false,
        loggedBy: row.reporter_name ?? "—", loggedAt: row.created_at,
        // Real activity trail when the record has one (every finding logged after
        // the activity table shipped will). Falls back to the derived two-line
        // version for older findings that predate it.
        escalationTimeline: (row.activity?.length
          ? row.activity.map(a => ({
              date: String(a.created_at ?? "").slice(5, 10),
              event: `${a.detail ?? a.kind}${a.actor_name ? ` — ${a.actor_name}` : ""}`,
              kind: a.kind,
            }))
          : [
              { date: (row.created_at ?? "").slice(5, 10), event: `Finding logged by ${row.reporter_name ?? "staff"}` },
              ...(row.resolution_action ? [{ date: (row.resolved_at ?? "").slice(5, 10) || "—", event: `${row.resolution_action}${row.status === "resolved" ? " — resolved" : " — still open"}` }] : []),
            ]),
        linkedIncidentId: null,
      });
    }).catch(err => console.error("Finding load failed:", err.message));
  }, [findingId]);
  const [resAction, setResAction] = useState("");
  const [resNotes,  setResNotes]  = useState("");
  const [resolved,  setResolved]  = useState(false);
  const [editing,   setEditing]   = useState(null);
  const [draft,     setDraft]     = useState("");
  const [resFocused,setResFocused]= useState(false);
  const [viewPhoto, setViewPhoto]  = useState(null);

  function handleAddPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 900 / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
      const nextList = [...(finding.photoList ?? []), dataUrl];
      setFinding(f => ({ ...f, photoList: nextList }));
      if (dbId) api.updateFinding(dbId, { photos: nextList }).catch(err => console.error("Photo save failed:", err.message));
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
    e.target.value = "";
  }

  const sev = SEV[finding.severity] ?? SEV.noted;

  function handleResolve() {
    if (!resAction) return;
    const nextStatus = ACTION_STATUS[resAction] ?? "interim";
    setResolved(true);
    setFinding(f => ({ ...f, status: nextStatus }));
    if (dbId) {
      api.updateFinding(dbId, {
        status: nextStatus,
        resolutionAction: resAction,
        resolutionNotes: resNotes,
        escalateToCA: ESCALATING.includes(resAction),
      }).catch(err => console.error("Resolution save failed:", err.message));
    }
  }

  const [reclassifying, setReclassifying] = useState(false);
  const [reclassifyErr,  setReclassifyErr]  = useState("");
  const canReclassify = CAN_RECLASSIFY.includes(user?.role);

  function toggleSafetyRelevant() {
    if (!dbId || reclassifying) return;
    const next = !finding.safetyRelevant;
    setReclassifying(true);
    setReclassifyErr("");
    api.updateFinding(dbId, { safetyRelevant: next })
      // Re-fetch so the activity trail below picks up the entry this just wrote —
      // a reclassification that doesn't visibly land in the log defeats the point.
      .then(() => api.getFinding(dbId).catch(() => null))
      .then(row => setFinding(f => ({
        ...f,
        safetyRelevant: next,
        escalationTimeline: row?.activity?.length
          ? row.activity.map(a => ({
              date: String(a.created_at ?? "").slice(5, 10),
              event: `${a.detail ?? a.kind}${a.actor_name ? ` — ${a.actor_name}` : ""}`,
              kind: a.kind,
            }))
          : f.escalationTimeline,
      })))
      .catch(err => setReclassifyErr(err.message || "Could not reclassify this finding."))
      .finally(() => setReclassifying(false));
  }

  function startEdit(field, val) { setEditing(field); setDraft(val); }
  function saveEdit(field) { setFinding(f => ({ ...f, [field]: draft })); setEditing(null); }

  function EditableField({ field, label, value, multiline = false }) {
    const [focused, setFocused] = useState(false);
    if (editing === field) {
      return (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: ".7rem", fontWeight: 600, color: C.sage, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>{label}</div>
          {multiline ? (
            <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={3} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
              style={{ width: "100%", padding: "8px 10px", border: `1.5px solid ${focused ? C.sage : "#D0DEDB"}`, borderRadius: 7, fontFamily: "'DM Sans', sans-serif", fontSize: ".88rem", color: C.ink, outline: "none", resize: "vertical", lineHeight: 1.5, transition: "all .18s" }} />
          ) : (
            <input value={draft} onChange={e => setDraft(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
              style={{ width: "100%", padding: "8px 10px", border: `1.5px solid ${focused ? C.sage : "#D0DEDB"}`, borderRadius: 7, fontFamily: "'DM Sans', sans-serif", fontSize: ".88rem", color: C.ink, outline: "none", transition: "all .18s" }} />
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={() => saveEdit(field)} style={{ padding: "6px 14px", background: C.sage, color: C.white, border: "none", borderRadius: 6, fontFamily: "'DM Sans', sans-serif", fontSize: ".78rem", fontWeight: 600, cursor: "pointer" }}>Save</button>
            <button onClick={() => setEditing(null)} style={{ padding: "6px 12px", background: "none", color: C.slate, border: "1px solid #D0DEDB", borderRadius: 6, fontFamily: "'DM Sans', sans-serif", fontSize: ".78rem", cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      );
    }
    return (
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: ".7rem", fontWeight: 600, color: C.mist, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>{label}</div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <div style={{ flex: 1, fontSize: ".9rem", color: value ? C.ink : C.mist, lineHeight: 1.5 }}>{value || <em>Not set</em>}</div>
          <button onClick={() => startEdit(field, value)} style={{ background: "none", border: "none", color: C.mist, fontSize: ".75rem", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", padding: "2px 4px", transition: "color .12s" }}
            onMouseEnter={e => e.target.style.color = C.pine} onMouseLeave={e => e.target.style.color = C.mist}>Edit</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: C.chalk, fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .anim { animation: fadeUp .25s ease both; }
        textarea::placeholder { color: ${C.mist}; }
        .resolve-btn:hover:not(:disabled) { background: ${C.pine} !important; }
      `}</style>

      <DesktopNav companyName={companyName} active="Finding Detail" onHome={onHome} />

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px" }}>

        {/* Breadcrumb + header */}
        <div className="anim" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <button onClick={onBack} style={{ background: "none", border: "none", color: C.mist, fontSize: ".82rem", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>← Findings</button>
            <span style={{ color: "#D0DEDB" }}>/</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: ".82rem", color: C.sage, fontWeight: 600 }}>FND-{String(finding.id).padStart(4, "0")}</span>
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
            <div>
              <h1 style={{ fontSize: "1.3rem", fontWeight: 700, color: C.ink, marginBottom: 8 }}>{finding.desc}</h1>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                {pill(sev.label, sev.bg, sev.color)}
                {pill(finding.category, "#EEF1F0", C.slate)}
                {pill(finding.status === "resolved" ? "Resolved" : finding.status === "interim" ? "Interim control" : "Open", finding.status === "resolved" ? "#EEF1F0" : finding.status === "interim" ? C.goldLt : C.foam, finding.status === "resolved" ? C.slate : finding.status === "interim" ? C.gold : C.pine)}
                {/* Spec §13.2: CapEx badge navy */}
                {finding.capex && pill("CapEx required", C.navyLt, C.navy)}
                {finding.linkedIncidentId && (
                  <span style={{ fontSize: ".75rem", color: C.sage, fontStyle: "italic" }}>🔗 Incident: {finding.linkedIncidentId}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Two-col layout */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20, alignItems: "start" }}>

          {/* Left */}
          <div>
            {/* Details card */}
            <div className="anim" style={{ background: C.white, borderRadius: 10, boxShadow: "0 2px 12px rgba(15,31,23,.07)", padding: 24, marginBottom: 16 }}>
              <h2 style={{ fontSize: ".95rem", fontWeight: 600, color: C.ink, marginBottom: 16 }}>Finding details</h2>
              <EditableField field="desc"     label="Description" value={finding.desc}     multiline />
              <EditableField field="location" label="Location"    value={finding.location} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
                {[
                  { label: "Site",       value: finding.site     },
                  { label: "Department", value: finding.dept     },
                  { label: "Category",   value: finding.category },
                  { label: "Assignee",   value: finding.assignee },
                  { label: "Due date",   value: finding.due
                      ? new Date(finding.due).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
                      : "No due date" },
                  { label: "Logged by",  value: `${finding.loggedBy} · ${new Date(finding.loggedAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}` },
                ].map((row, i) => (
                  <div key={i}>
                    <div style={{ fontSize: ".7rem", fontWeight: 600, color: C.mist, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 3 }}>{row.label}</div>
                    <div style={{ fontSize: ".88rem", color: C.ink }}>{row.value}</div>
                  </div>
                ))}
              </div>

              {/* Safety-metric classification. Read-only for everyone except
                  admin/safety/site_manager — the person who logged a finding must
                  not be able to move it out of the safety numbers themselves. */}
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #E8EFec" }}>
                <div style={{ fontSize: ".7rem", fontWeight: 600, color: C.mist, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>Safety metrics</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ fontSize: ".88rem", color: finding.safetyRelevant ? C.ink : "#8A6212" }}>
                    {finding.safetyRelevant ? "Counted as a safety finding" : "Excluded — tracked and aged, not counted"}
                  </div>
                  {canReclassify ? (
                    <button onClick={toggleSafetyRelevant} disabled={reclassifying} style={{
                      padding: "6px 13px", background: "none", color: reclassifying ? C.mist : C.pine,
                      border: `1px solid ${reclassifying ? "#D0DEDB" : C.sage}`, borderRadius: 6,
                      fontFamily: "'DM Sans', sans-serif", fontSize: ".78rem", fontWeight: 600,
                      cursor: reclassifying ? "default" : "pointer",
                    }}>
                      {reclassifying ? "Saving…" : finding.safetyRelevant ? "Exclude from safety metrics" : "Count as safety finding"}
                    </button>
                  ) : (
                    <span style={{ fontSize: ".72rem", color: C.mist, fontStyle: "italic" }}>Safety or admin only</span>
                  )}
                </div>
                {!finding.safetyRelevant && (finding.severity === "critical" || finding.severity === "high" || finding.severity === "major") && (
                  <div style={{ marginTop: 9, padding: "8px 10px", background: "#FDF0D5", borderRadius: 6, fontSize: ".72rem", color: "#8A6212", fontWeight: 600 }}>
                    ⚠ High-severity but excluded from safety metrics. If it can hurt someone, count it.
                  </div>
                )}
                {reclassifyErr && (
                  <div style={{ marginTop: 8, fontSize: ".75rem", color: C.red }}>{reclassifyErr}</div>
                )}
              </div>

              {/* Spec §13.2: CapEx field in metadata grid */}
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #E8EFec" }}>
                <div style={{ fontSize: ".7rem", fontWeight: 600, color: C.mist, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 3 }}>CapEx required</div>
                <div style={{ fontSize: ".88rem", color: finding.capex ? C.navy : C.ink }}>
                  {finding.capex ? "Yes — flagged" : "No"}
                  {finding.capex && <span style={{ fontSize: ".75rem", color: C.mist, marginLeft: 8, fontStyle: "italic" }}>Excluded from aging metrics</span>}
                </div>
              </div>
            </div>

            {/* Photos */}
            <div className="anim" style={{ background: C.white, borderRadius: 10, boxShadow: "0 2px 12px rgba(15,31,23,.07)", padding: 24, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h2 style={{ fontSize: ".95rem", fontWeight: 600, color: C.ink }}>Photos</h2>
                <span style={{ fontSize: ".78rem", color: C.mist }}>{(finding.photoList ?? []).length} attached</span>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {(finding.photoList ?? []).map((src, i) => (
                  <img key={i} src={src} alt={`Photo ${i + 1}`} onClick={() => setViewPhoto(src)}
                    style={{ width: 100, height: 80, borderRadius: 8, objectFit: "cover", border: "2px solid #E2EBE6", cursor: "pointer" }} />
                ))}
                <label style={{ width: 100, height: 80, borderRadius: 8, border: "2px dashed #C8DDD2", background: C.chalk, display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".75rem", color: C.sage, cursor: "pointer" }}>
                  + Add
                  <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleAddPhoto} />
                </label>
              </div>
              {viewPhoto && (
                <div onClick={() => setViewPhoto(null)} style={{ position: "fixed", inset: 0, background: "rgba(15,31,23,.85)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
                  <img src={viewPhoto} alt="Finding photo" style={{ maxWidth: "100%", maxHeight: "90vh", borderRadius: 10 }} />
                </div>
              )}
            </div>

            {/* Resolution form */}
            {finding.status !== "resolved" && (
              <div className="anim" style={{ background: C.white, borderRadius: 10, boxShadow: "0 2px 12px rgba(15,31,23,.07)", padding: 24 }}>
                <h2 style={{ fontSize: ".95rem", fontWeight: 600, color: C.ink, marginBottom: 14 }}>
                  {resolved ? "✓ Finding resolved" : "Resolve this finding"}
                </h2>
                {!resolved ? (
                  <>
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: ".7rem", fontWeight: 600, color: C.sage, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>Resolution action</div>
                      <select value={resAction} onChange={e => setResAction(e.target.value)} style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #D0DEDB", borderRadius: 8, fontFamily: "'DM Sans', sans-serif", fontSize: ".88rem", color: resAction ? C.ink : C.mist, background: C.white, outline: "none", cursor: "pointer", appearance: "none" }}>
                        <option value="">Select action…</option>
                        {RESOLUTION_ACTIONS.map(a => <option key={a}>{a}</option>)}
                      </select>
                    </div>
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: ".7rem", fontWeight: 600, color: C.sage, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>Resolution notes</div>
                      <textarea value={resNotes} onChange={e => setResNotes(e.target.value)}
                        onFocus={() => setResFocused(true)} onBlur={() => setResFocused(false)}
                        placeholder="Describe what was done…" rows={3}
                        style={{ width: "100%", padding: "9px 11px", border: `1.5px solid ${resFocused ? C.sage : "#D0DEDB"}`, borderRadius: 8, fontFamily: "'DM Sans', sans-serif", fontSize: ".88rem", color: C.ink, outline: "none", resize: "vertical", lineHeight: 1.5, transition: "all .18s" }} />
                    </div>
                    <button className="resolve-btn" onClick={handleResolve} disabled={!resAction} style={{ padding: "10px 24px", background: resAction ? C.sage : "#B0C8BA", color: C.white, border: "none", borderRadius: 7, fontFamily: "'DM Sans', sans-serif", fontSize: ".88rem", fontWeight: 600, cursor: resAction ? "pointer" : "default", transition: "all .18s" }}>
                      Submit
                    </button>
                  </>
                ) : (
                  <div style={{ color: C.pine, fontSize: ".88rem" }}>
                    ✓ Submitted — {resAction}
                    {ACTION_STATUS[resAction] !== "resolved" && (
                      <div style={{ color: C.gold, marginTop: 4, fontSize: ".8rem" }}>
                        Finding remains open{ESCALATING.includes(resAction) ? " — corrective action created" : ""} and will keep aging until fully resolved.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right sidebar: escalation timeline */}
          <div>
            <div className="anim" style={{ background: C.white, borderRadius: 10, boxShadow: "0 2px 12px rgba(15,31,23,.07)", padding: 20 }}>
              <h2 style={{ fontSize: ".92rem", fontWeight: 600, color: C.ink, marginBottom: 14 }}>Escalation timeline</h2>
              <div style={{ position: "relative" }}>
                {finding.escalationTimeline.map((ev, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, marginBottom: i < finding.escalationTimeline.length - 1 ? 14 : 0 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: ev.kind === "reclassify" ? "#E0B96A" : i === 0 ? C.sage : "#D0DEDB", flexShrink: 0 }} />
                      {i < finding.escalationTimeline.length - 1 && (
                        <div style={{ width: 1, flex: 1, background: "#E2EBE6", margin: "3px 0" }} />
                      )}
                    </div>
                    <div style={{ paddingBottom: i < finding.escalationTimeline.length - 1 ? 8 : 0 }}>
                      <div style={{ fontSize: ".72rem", color: C.mist, marginBottom: 2 }}>{ev.date}</div>
                      <div style={{ fontSize: ".83rem", color: C.ink, lineHeight: 1.4 }}>{ev.event}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
