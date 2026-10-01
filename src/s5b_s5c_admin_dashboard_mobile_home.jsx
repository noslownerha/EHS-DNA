import { useState, useEffect } from "react";
import { EHSHeader } from "./AppShell.jsx";
import { BRAND, COLORS, FONTS, moduleEnabled } from "./constants.js";
import Icon from "./Icon.jsx";
import { StatusChip, Card, CardHeader, Row } from "./ui.jsx";
import { api } from "./api.js";

const C = { ...COLORS };

function DesktopNav({ companyName = BRAND.company, label, onHome }) {
  return (
    <EHSHeader onHome={onHome} title={companyName} rightContent={
      <div style={{ fontSize: ".72rem", color: "rgba(255,255,255,.82)", background: "rgba(255,255,255,.1)", padding: "3px 12px", borderRadius: 20, whiteSpace: "nowrap" }}>{label}</div>
    } />
  );
}

function ComplianceBar({ pct, compact = false }) {
  const color = pct >= 80 ? C.sage : pct >= 60 ? C.gold : C.red;
  if (compact) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ flex: 1, height: 5, background: "#E2EBE6", borderRadius: 3, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3 }} />
        </div>
        <span style={{ fontSize: ".75rem", fontWeight: 700, color, minWidth: 30, textAlign: "right" }}>{pct}%</span>
      </div>
    );
  }
  return null;
}

function DaysBadge({ days }) {
  // null = no recordable ever logged at this site. Say so in words — a number
  // here reads as a real, verified streak.
  if (days === null || days === undefined) {
    return (
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: ".78rem", fontWeight: 700, color: C.sage, lineHeight: 1.2 }}>None</div>
        <div style={{ fontSize: ".6rem", fontWeight: 600, color: C.mist, marginTop: 1 }}>on record</div>
      </div>
    );
  }
  const color = days >= 90 ? C.sage : days >= 30 ? C.gold : C.red;
  const bg    = days >= 90 ? C.foam  : days >= 30 ? C.goldLt : C.redLt;
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: "1.4rem", fontWeight: 800, color, lineHeight: 1 }}>{days}</div>
      <div style={{ fontSize: ".6rem", fontWeight: 600, color: color + "cc", marginTop: 1 }}>days</div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// S5b — Company Admin Dashboard (desktop)
// ════════════════════════════════════════════════════════════════════════════
// ── S5b · Company dashboard ("Clarity with character") ──────────────────────
// Visual management: every tile and site metric carries a status (green on
// track · amber watch · red act now · blue in progress) as colour + shape +
// words. Opens with one sentence saying what needs the admin today, then the
// items themselves, then a site scorecard.
const STATUS_SHAPE = {
  green: { label: "On track", d: <><circle cx="8" cy="8" r="7" fill={COLORS.green} /><path d="m4.8 8.2 2.1 2.1 4.3-4.3" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></> },
  amber: { label: "Watch", d: <><path d="M8 1.2 15.2 14H.8z" fill={COLORS.amberGfx} /><path d="M8 6v3.6M8 11.6v.1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" /></> },
  red:   { label: "Act now", d: <><path d="M5 .8h6L15.2 5v6L11 15.2H5L.8 11V5z" fill={COLORS.red} /><path d="m5.5 5.5 5 5m0-5-5 5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" /></> },
};
function StatusShape({ tone }) {
  const s = STATUS_SHAPE[tone] || STATUS_SHAPE.green;
  return <svg width="16" height="16" viewBox="0 0 16 16" role="img" aria-label={s.label} style={{ flexShrink: 0 }}>{s.d}</svg>;
}
const TILE_STRIP = { green: COLORS.green, amber: COLORS.amberFill, red: COLORS.red, blue: COLORS.navy };
const dayMs = 86400000;

export function S5bCompanyAdminDashboard({ companyName = BRAND.company, onNavigate, onHome }) {
  const [sites, setSites] = useState(null);
  const [attention, setAttention] = useState([]);
  const [trir, setTrir] = useState(null);
  const isOperator = JSON.parse(sessionStorage.getItem("ehs_user") || "{}").isOperator;
  const me = JSON.parse(sessionStorage.getItem("ehs_user") || "{}");

  useEffect(() => {
    api.dashboardSummary().then(setSites).catch(() => setSites([]));
    const today = new Date(new Date().toDateString()).getTime();
    Promise.all([
      moduleEnabled("corrective_actions") ? api.listCAs().catch(() => []) : [],
      moduleEnabled("inspections") ? api.listFindings().catch(() => []) : [],
    ]).then(([cas, findings]) => {
      const items = [];
      (Array.isArray(cas) ? cas : []).forEach(c => {
        if (["done", "verified", "closed"].includes(c.status)) return;
        const due = c.due_date ? Math.round((new Date(c.due_date).getTime() - today) / dayMs) : null;
        if (c.status === "blocked") items.push({ tone: "red", rank: 0, icon: "wrench", title: c.title, meta: c.blocked_reason || "Blocked — needs help", status: "Blocked", dest: "cas" });
        else if (c.status === "capex_blocked") items.push({ tone: "blue", rank: 4, icon: "card", title: c.title, meta: c.blocked_reason || "Waiting on capital budget", status: "CapEx hold", dest: "cas" });
        else if (due !== null && due < 0) items.push({ tone: "red", rank: 1, icon: "wrench", title: c.title, meta: `Was due ${-due} day${due === -1 ? "" : "s"} ago`, status: `Overdue ${-due} d`, dest: "cas" });
        else if (due !== null && due <= 3) items.push({ tone: "amber", rank: 2, icon: "wrench", title: c.title, meta: due === 0 ? "Due today" : `Due in ${due} day${due === 1 ? "" : "s"}`, status: due === 0 ? "Due today" : `Due in ${due} d`, dest: "cas" });
      });
      (Array.isArray(findings) ? findings : []).forEach(f => {
        if (f.status === "resolved" || f.safety_relevant === 0) return;
        if (f.severity === "critical") items.push({ tone: "red", rank: 1, icon: "alert", title: f.description, meta: [f.site_name, "critical finding"].filter(Boolean).join(" · "), status: "Critical", dest: "findings" });
      });
      items.sort((a, b) => a.rank - b.rank);
      setAttention(items);
    });
    if (moduleEnabled("reporting")) {
      api.reportIncidentSummary().then(s => {
        const months = (s?.months || []).slice(-12);
        let rec = 0, hrs = 0;
        months.forEach(m => (m.sites || []).forEach(x => { rec += x.recordables || 0; hrs += x.estHours || 0; }));
        setTrir(hrs > 0 ? { value: (rec * 200000 / hrs).toFixed(2), rec, hrs } : null);
      }).catch(() => setTrir(null));
    }
  }, []);

  const S = sites || [];
  const sum = k => S.reduce((n, s) => n + (s[k] || 0), 0);
  const totalStaff = sum("staff"), totalIncidents = sum("openIncidents"), totalCAs = sum("openCAs"), totalCritical = sum("criticalFindings");
  const fullyTrained = S.length ? Math.round(S.reduce((n, s) => n + s.compliance * (s.staff || 1), 0) / S.reduce((n, s) => n + (s.staff || 1), 0)) : 0;
  const lowSites = S.filter(s => s.compliance < 80);
  const reds = attention.filter(a => a.tone === "red").length, ambers = attention.filter(a => a.tone === "amber").length;
  const first = (me.name || "").split(/\s+/)[0];

  const kpis = [
    trir && { label: "TRIR", value: trir.value, tone: "green", chip: "12 months", note: `${trir.rec} recordable${trir.rec === 1 ? "" : "s"} · ${Math.round(trir.hrs).toLocaleString()} hours`, dest: "report", module: "reporting" },
    { label: "Open incidents", value: totalIncidents, tone: totalIncidents ? "blue" : "green", chip: totalIncidents ? "In progress" : "None open", note: "Reported and not yet closed", dest: "incidents", module: "incidents" },
    { label: "Open corrective actions", value: totalCAs, tone: attention.some(a => a.dest === "cas" && a.tone === "red") ? "red" : totalCAs ? "amber" : "green",
      chip: attention.some(a => a.dest === "cas" && a.status === "Blocked") ? `${attention.filter(a => a.status === "Blocked").length} blocked` : totalCAs ? "Open" : "All closed", note: "Blocked, overdue and in progress", dest: "cas", module: "corrective_actions" },
    { label: "Critical findings", value: totalCritical, tone: totalCritical ? "red" : "green", chip: totalCritical ? "Act now" : "None", note: "Open, safety-relevant", dest: "findings", module: "inspections" },
    { label: "Staff fully trained", value: `${fullyTrained}%`, tone: lowSites.length ? "amber" : "green", chip: lowSites.length ? `${lowSites.length} site${lowSites.length === 1 ? "" : "s"} low` : "On target",
      note: lowSites.length ? `${lowSites.map(s => s.name).join(", ")} below 80%` : "Every site at or above 80%", dest: "training", module: "lms" },
  ].filter(k => k && (!k.module || moduleEnabled(k.module)));

  const metric = (tone, text) => <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: FONTS.mono, fontSize: ".92rem" }}><StatusShape tone={tone} />{text}</span>;
  const links = [
    isOperator && ["ops", "EHS Ops"], isOperator && ["billing", "Billing"],
    ["settings", "Settings"], ["staff", "Manage Staff"],
    moduleEnabled("equipment") && ["equipment", "Equipment"],
    (moduleEnabled("equipment") || moduleEnabled("inspections")) && ["qr", "QR labels"],
    ["report", "Reports"],
  ].filter(Boolean);

  return (
    <div style={{ minHeight: "100vh", background: C.chalk, fontFamily: FONTS.body, color: C.ink }}>
      <style>{`
        .dash-kpis { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        .dash-cols { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; }
        .site-grid { display: none; }
        .site-cards { display: block; }
        @media (min-width: 900px) {
          .dash-kpis { grid-template-columns: repeat(${Math.min(kpis.length, 5)}, minmax(0, 1fr)); gap: 14px; }
          .dash-cols { grid-template-columns: minmax(0, 1fr) minmax(0, 1.5fr); }
          .site-grid { display: block; } .site-cards { display: none; }
        }
        .kpi-tile { transition: box-shadow .15s ease; } .kpi-tile:hover { box-shadow: 0 6px 18px rgba(21,33,43,.08); }
        .dash-link:hover { background: ${C.foam}; }
        /* Phones: shortcuts are one swipeable row instead of three rows of buttons */
        @media (max-width: 899px) { .dash-links { flex-wrap: nowrap !important; overflow-x: auto; padding-bottom: 4px; } }
      `}</style>
      <EHSHeader onHome={onHome} title={companyName} rightContent={<span className="hdr-context" style={{ fontSize: ".75rem", color: "rgba(255,255,255,.82)" }}>Company Dashboard</span>} />

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px 110px", display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: ".85rem", color: C.slate }}>{companyName} · {S.length} site{S.length === 1 ? "" : "s"} · {totalStaff} people</div>
            <h1 style={{ margin: "2px 0 0", fontSize: "1.9rem", fontWeight: 700 }}>{first ? `Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, ${first}` : companyName}</h1>
            <div style={{ marginTop: 6, fontSize: ".95rem", color: C.slate }}>
              {reds + ambers === 0 ? "Nothing needs you right now." : <>
                {reds > 0 && <strong style={{ color: C.red }}>{reds} item{reds === 1 ? "" : "s"} to act on</strong>}
                {reds > 0 && ambers > 0 && " and "}
                {ambers > 0 && <strong style={{ color: C.gold }}>{ambers} due soon</strong>} need you today.
              </>}
            </div>
          </div>
          <div className="dash-links" style={{ display: "flex", gap: 8, flexWrap: "wrap", maxWidth: "100%" }}>
            {links.map(([dest, label]) => (
              <button key={dest} className="dash-link" onClick={() => onNavigate?.(dest)} style={{ height: 38, padding: "0 14px", borderRadius: 10,
                      border: `1px solid ${C.field}`, background: C.white, color: C.ink, fontWeight: 600, fontSize: ".85rem", cursor: "pointer", fontFamily: FONTS.body,
                      flexShrink: 0, whiteSpace: "nowrap" }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="dash-kpis">
          {kpis.map(k => (
            <button key={k.label} className="kpi-tile" onClick={() => onNavigate?.(k.dest)} style={{ display: "flex", flexDirection: "column", padding: 0, textAlign: "left",
                    background: C.white, border: `1px solid ${C.line}`, borderRadius: 14, overflow: "hidden", cursor: "pointer", fontFamily: FONTS.body, color: C.ink }}>
              <span style={{ height: 6, alignSelf: "stretch", background: TILE_STRIP[k.tone] }} />
              <span style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 6, alignSelf: "stretch" }}>
                <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: ".82rem", fontWeight: 600, color: C.slate }}>{k.label}</span>
                  <StatusChip tone={k.tone}>{k.chip}</StatusChip>
                </span>
                <span style={{ fontFamily: FONTS.display, fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.02em" }}>{k.value}</span>
                <span style={{ fontSize: ".8rem", color: C.slate }}>{k.note}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="dash-cols">
          <Card>
            <CardHeader title="Needs your attention" right={<span style={{ fontSize: ".82rem", color: C.slate }}>{attention.length} item{attention.length === 1 ? "" : "s"}</span>} />
            {attention.length === 0 && <div style={{ padding: "4px 16px 16px", color: C.slate, fontSize: ".9rem" }}>Nothing blocked, overdue or critical. 👍</div>}
            {attention.slice(0, 6).map((a, i) => (
              <Row key={i} tone={a.tone} icon={<Icon name={a.icon} size={18} />} title={a.title} meta={a.meta}
                   status={<StatusChip tone={a.tone}>{a.status}</StatusChip>} onClick={() => onNavigate?.(a.dest)} />
            ))}
          </Card>

          <Card>
            <CardHeader title="Sites at a glance" right={
              <span style={{ display: "flex", gap: 12, fontSize: ".78rem", color: C.slate, flexWrap: "wrap" }}>
                {["green", "amber", "red"].map(t => <span key={t} style={{ display: "flex", alignItems: "center", gap: 5 }}><StatusShape tone={t} />{STATUS_SHAPE[t].label}</span>)}
              </span>} />
            {/* Desktop: scorecard table */}
            <div className="site-grid">
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1.3fr 1fr 1fr 1fr 1.4fr", gap: 10, padding: "9px 16px", background: "#FAF8F4",
                            borderTop: `1px solid ${C.line}`, fontSize: ".75rem", fontWeight: 700, color: C.slate }}>
                <span>Site</span><span>Since recordable</span><span>Incidents</span><span>Actions</span><span>Critical</span><span>Fully trained</span>
              </div>
              {S.map(s => (
                <button key={s.name} className="site-row" onClick={() => onNavigate?.("site", s.name)} style={{ display: "grid", gridTemplateColumns: "2fr 1.3fr 1fr 1fr 1fr 1.4fr",
                        gap: 10, alignItems: "center", width: "100%", padding: "12px 16px", border: "none", borderTop: `1px solid ${C.line}`, background: "transparent",
                        textAlign: "left", cursor: "pointer", fontFamily: FONTS.body, color: C.ink }}>
                  <span><span style={{ display: "block", fontWeight: 600 }}>{s.name}</span><span style={{ fontSize: ".78rem", color: C.slate }}>{[s.location, `${s.staff} people`].filter(Boolean).join(" · ")}</span></span>
                  {metric(s.daysSince == null ? "green" : s.daysSince < 30 ? "red" : s.daysSince < 90 ? "amber" : "green", s.daysSince == null ? "None" : `${s.daysSince} d`)}
                  {metric(s.openIncidents === 0 ? "green" : "amber", s.openIncidents)}
                  {metric(s.openCAs === 0 ? "green" : s.openCAs >= 3 ? "red" : "amber", s.openCAs)}
                  {metric(s.criticalFindings ? "red" : "green", s.criticalFindings)}
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ flex: 1, height: 8, borderRadius: 4, background: "#EEEAE2" }}>
                      <span style={{ display: "block", width: `${s.compliance}%`, height: 8, borderRadius: 4, background: s.compliance >= 80 ? C.green : C.amberGfx }} />
                    </span>
                    <span style={{ fontFamily: FONTS.mono, fontSize: ".85rem" }}>{s.compliance}%</span>
                  </span>
                </button>
              ))}
            </div>
            {/* Phone: one card per site */}
            <div className="site-cards">
              {S.map(s => (
                <button key={s.name} onClick={() => onNavigate?.("site", s.name)} style={{ display: "block", width: "100%", padding: "12px 16px", border: "none",
                        borderTop: `1px solid ${C.line}`, background: "transparent", textAlign: "left", cursor: "pointer", fontFamily: FONTS.body, color: C.ink }}>
                  <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 600 }}>{s.name}</span>
                    <StatusChip tone={s.compliance >= 80 ? "green" : "amber"}>{s.compliance}% trained</StatusChip>
                  </span>
                  <span style={{ display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap", fontSize: ".82rem", color: C.slate }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}><StatusShape tone={s.daysSince == null ? "green" : s.daysSince < 30 ? "red" : s.daysSince < 90 ? "amber" : "green"} />{s.daysSince == null ? "No recordable" : `${s.daysSince} days since recordable`}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}><StatusShape tone={s.openCAs === 0 ? "green" : s.openCAs >= 3 ? "red" : "amber"} />{s.openCAs} actions</span>
                  </span>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}


// ════════════════════════════════════════════════════════════════════════════
// S5c — Staff Mobile Home Screen
// Spec: prominent "Something happened" button, own training queue, recent activity
// ════════════════════════════════════════════════════════════════════════════
export function S5cStaffMobileHome({
  onHome,
  user = { name: "Staff", site: "Moriah", dept: "", role: "staff" },
  triageEnabled = true,   // driven by company triage config
  onTriage,               // () => void — launches Flow 0
  onReportIncident,       // () => void — launches Flow 2
  onTraining,             // () => void — launches s4a queue
  onViewIncident,         // (id) => void
}) {
  const overdueTrainings = 2;
  const expiringSoon     = 1;

  const recentActivity = [
    { id: 1, type: "training",  desc: "Hazard Communication — expiring Jul 5",   icon: "📚", color: C.gold,   time: "Action needed" },
    { id: 2, type: "incident",  desc: "INC-2024-0087 submitted",                 icon: "📋", color: C.slate,  time: "Jun 12"        },
    { id: 3, type: "ca",        desc: "CA assigned: Review PPE for your role",   icon: "✅", color: C.orange, time: "Jun 11"        },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.ink, fontFamily: "'DM Sans', sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp  { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse   { 0%,100% { box-shadow: 0 0 0 0 rgba(185,28,28,.5); } 50% { box-shadow: 0 0 0 12px rgba(185,28,28,0); } }
        .anim-0 { animation: fadeUp .25s ease .05s both; }
        .anim-1 { animation: fadeUp .25s ease .12s both; }
        .anim-2 { animation: fadeUp .25s ease .2s both; }
        .anim-3 { animation: fadeUp .25s ease .28s both; }
        .triage-btn { animation: pulse 2.5s ease-in-out infinite; }
        .triage-btn:hover { background: #991B1B !important; transform: scale(1.02); }
        .action-tile:hover { background: rgba(255,255,255,.08) !important; }
        .activity-row:hover { background: rgba(255,255,255,.05) !important; }
      `}</style>

      <EHSHeader onHome={onHome} dark rightContent={
        <div style={{ fontSize: ".72rem", color: "rgba(255,255,255,.78)", background: "rgba(255,255,255,.07)", padding: "3px 10px", borderRadius: 20, whiteSpace: "nowrap" }}>
          {user.name} · {user.site}
        </div>
      } />

      {/* Top bar */}
      <div style={{ padding: "8px 18px", display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
        {(overdueTrainings > 0 || expiringSoon > 0) && (
          <div style={{
            background: C.gold, color: C.white, borderRadius: "50%",
            width: 22, height: 22, display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: ".7rem", fontWeight: 700,
          }}>
            {overdueTrainings + expiringSoon}
          </div>
        )}
      </div>

      <div style={{ flex: 1, padding: "4px 18px 80px", overflowY: "auto" }}>

        {/* Spec: prominent "Something happened" button on mobile home screen */}
        {triageEnabled && (
          <div className="anim-0" style={{ marginBottom: 14 }}>
            <button
              className="triage-btn"
              onClick={onTriage}
              style={{
                width: "100%", padding: "20px",
                background: "#B91C1C", color: C.white,
                border: "none", borderRadius: 12,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "1.05rem", fontWeight: 700,
                cursor: "pointer", transition: "background .15s, transform .1s",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}
            >
              <span>🚨 Something happened</span>
              <span style={{ fontSize: ".9rem", opacity: .7 }}>→</span>
            </button>
            <div style={{ fontSize: ".72rem", color: "rgba(255,255,255,.78)", textAlign: "center", marginTop: 6 }}>
              For right now — guided triage in 60 seconds
            </div>
          </div>
        )}

        {/* Secondary actions */}
        <div className="anim-1" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
          {moduleEnabled("incidents") && (
          <button className="action-tile" onClick={onReportIncident} style={{
            padding: "14px 12px",
            background: "rgba(255,255,255,.06)",
            border: "1.5px solid rgba(255,255,255,.1)",
            borderRadius: 10, textAlign: "left",
            cursor: "pointer", transition: "background .15s",
          }}>
            <div style={{ fontSize: "1.2rem", marginBottom: 6 }}>📋</div>
            <div style={{ fontSize: ".82rem", fontWeight: 600, color: "rgba(255,255,255,.8)" }}>Report incident</div>
            <div style={{ fontSize: ".7rem", color: "rgba(255,255,255,.78)", marginTop: 2 }}>After the fact</div>
          </button>
          )}
          {moduleEnabled("lms") && (
          <button className="action-tile" onClick={onTraining} style={{
            padding: "14px 12px",
            background: "rgba(255,255,255,.06)",
            border: `1.5px solid ${overdueTrainings > 0 ? C.gold + "55" : "rgba(255,255,255,.1)"}`,
            borderRadius: 10, textAlign: "left",
            cursor: "pointer", transition: "background .15s",
            position: "relative",
          }}>
            {overdueTrainings > 0 && (
              <div style={{
                position: "absolute", top: 8, right: 10,
                background: C.gold, color: C.white,
                borderRadius: "50%", width: 18, height: 18,
                fontSize: ".65rem", fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>{overdueTrainings}</div>
            )}
            <div style={{ fontSize: "1.2rem", marginBottom: 6 }}>📚</div>
            <div style={{ fontSize: ".82rem", fontWeight: 600, color: "rgba(255,255,255,.8)" }}>My training</div>
            <div style={{ fontSize: ".7rem", color: overdueTrainings > 0 ? C.gold : "rgba(255,255,255,.35)", marginTop: 2 }}>
              {overdueTrainings > 0 ? `${overdueTrainings} overdue` : "Up to date"}
            </div>
          </button>
          )}
        </div>

        {/* Training nudge banner */}
        {overdueTrainings > 0 && (
          <div className="anim-2" style={{
            padding: "12px 14px", marginBottom: 16,
            background: C.goldLt + "18",
            border: `1px solid ${C.gold}44`,
            borderRadius: 9, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 10,
          }} onClick={onTraining}>
            <span style={{ fontSize: "1rem" }}>⏱</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: ".85rem", fontWeight: 600, color: C.gold }}>
                {overdueTrainings} training{overdueTrainings > 1 ? "s" : ""} overdue
              </div>
              <div style={{ fontSize: ".75rem", color: "rgba(255,255,255,.78)", marginTop: 1 }}>
                Tap to view your training queue
              </div>
            </div>
            <span style={{ color: C.gold, fontSize: ".85rem" }}>→</span>
          </div>
        )}

        {/* Recent activity */}
        <div className="anim-3">
          <div style={{ fontSize: ".72rem", fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "rgba(255,255,255,.78)", marginBottom: 10 }}>
            Recent activity
          </div>
          <div style={{ background: "rgba(255,255,255,.05)", borderRadius: 10, overflow: "hidden" }}>
            {recentActivity.map((item, i) => (
              <div key={item.id} className="activity-row" style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                borderBottom: i < recentActivity.length - 1 ? "1px solid rgba(255,255,255,.06)" : "none",
                cursor: "pointer", transition: "background .12s",
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                  background: "rgba(255,255,255,.08)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "1rem",
                }}>{item.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: ".85rem", color: "rgba(255,255,255,.8)", lineHeight: 1.3 }}>{item.desc}</div>
                  <div style={{ fontSize: ".7rem", color: "rgba(255,255,255,.78)", marginTop: 2 }}>{item.time}</div>
                </div>
                <span style={{ color: "rgba(255,255,255,.78)", fontSize: ".8rem" }}>→</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom nav */}
      <div style={{
        position: "fixed", bottom: 58, left: 0, right: 0,
        background: "rgba(15,31,23,.95)", backdropFilter: "blur(12px)",
        borderTop: "1px solid rgba(255,255,255,.07)",
        display: "flex", padding: "10px 0 4px",
      }}>
        {[
          { icon: "🏠", label: "Home",     active: true  },
          { icon: "📋", label: "Incidents", active: false },
          { icon: "📚", label: "Training",  active: false },
          { icon: "👤", label: "Profile",   active: false },
        ].map((tab, i) => (
          <button key={i} style={{
            flex: 1, background: "none", border: "none", cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
            padding: "4px 0",
          }}>
            <span style={{ fontSize: "1.1rem" }}>{tab.icon}</span>
            <span style={{ fontSize: ".62rem", color: tab.active ? C.mint : "rgba(255,255,255,.3)", fontFamily: "'DM Sans', sans-serif" }}>
              {tab.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
