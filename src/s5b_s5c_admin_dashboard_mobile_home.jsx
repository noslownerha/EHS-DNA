import { useState, useEffect } from "react";
import { EHSHeader } from "./AppShell.jsx";
import { BRAND, COLORS, moduleEnabled } from "./constants.js";
import { api } from "./api.js";

const C = { ...COLORS };

const SITES = [
  { name: "Moriah",       location: "Mineville, NY",    staff: 18, daysSince: 47, compliance: 74, openIncidents: 2, openCAs: 4, criticalFindings: 2 },
  { name: "Middlebury",   location: "Middlebury, VT",   staff: 17, daysSince: 112, compliance: 91, openIncidents: 1, openCAs: 1, criticalFindings: 0 },
  { name: "Shoreham",     location: "Shoreham, VT",     staff: 9,  daysSince: 23,  compliance: 68, openIncidents: 0, openCAs: 2, criticalFindings: 1 },
  { name: "Brandenburg",  location: "Brandenburg, KY",  staff: 11, daysSince: 198, compliance: 100, openIncidents: 0, openCAs: 0, criticalFindings: 0 },
];

function DesktopNav({ companyName = BRAND.company, label, onHome }) {
  return (
    <EHSHeader onHome={onHome} title={companyName} rightContent={
      <div style={{ fontSize: ".72rem", color: C.mist, background: "rgba(255,255,255,.08)", padding: "3px 12px", borderRadius: 20, whiteSpace: "nowrap" }}>{label}</div>
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
export function S5bCompanyAdminDashboard({ companyName = BRAND.company, onNavigate, onHome }) {
  const [SITES, setSites] = useState([]);
  useEffect(() => {
    api.dashboardSummary().then(setSites).catch(err => console.error("Dashboard summary failed:", err.message));
  }, []);
  const safeSites = SITES.length ? SITES : [{ name: "—", location: "", staff: 0, daysSince: 0, compliance: 0, openIncidents: 0, openCAs: 0, criticalFindings: 0 }];

  // Company-wide aggregates
  const totalStaff      = SITES.reduce((n, s) => n + s.staff, 0);
  const totalIncidents  = SITES.reduce((n, s) => n + s.openIncidents, 0);
  const totalCAs        = SITES.reduce((n, s) => n + s.openCAs, 0);
  const totalCritical   = SITES.reduce((n, s) => n + s.criticalFindings, 0);
  const avgCompliance   = SITES.length ? Math.round(SITES.reduce((n, s) => n + s.compliance, 0) / SITES.length) : 0;
  const belowThreshold  = SITES.filter(s => s.compliance < 80).length;
  const bestDays        = SITES.length ? Math.max(...SITES.map(s => s.daysSince)) : 0;

  const kpis = [
    { label: "Open incidents",      value: totalIncidents, color: C.red,    dest: "incidents", module: "incidents" },
    { label: "Open CAs",            value: totalCAs,       color: C.orange, dest: "cas",       module: "corrective_actions" },
    { label: "Critical findings",   value: totalCritical,  color: C.gold,   dest: "findings",  module: "inspections" },
    { label: "Sites < 80% training",value: belowThreshold, color: C.purple, dest: "training",  module: "lms" },
  ].filter(k => !k.module || moduleEnabled(k.module));

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
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .anim { animation: fadeUp .25s ease both; }
        .kpi-tile:active { transform: scale(.97); }
        .kpi-tile:hover { box-shadow: 0 4px 18px rgba(15,31,23,.13); }
        .site-row:hover td { background: ${C.foam} !important; cursor: pointer; }
        .nav-btn:hover { background: ${C.foam} !important; }
      `}</style>

      <DesktopNav onHome={onHome} companyName={companyName} label="Company Dashboard" />

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px" }}>

        {/* Header */}
        <div className="anim" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: C.ink }}>{companyName}</h1>
            <p style={{ fontSize: ".85rem", color: C.mist, marginTop: 3 }}>
              {SITES.length} sites · {totalStaff} staff · all-time best: {bestDays} days since recordable
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {JSON.parse(sessionStorage.getItem("ehs_user") || "{}").isOperator && (<>
            <button className="nav-btn" onClick={() => onNavigate?.("ops")} style={{
              padding: "8px 16px", background: C.forest, color: C.mint,
              border: `1.5px solid ${C.forest}`, borderRadius: 7,
              fontFamily: "'DM Sans', sans-serif", fontSize: ".85rem", fontWeight: 600,
              cursor: "pointer", transition: "all .15s",
            }}>EHS Ops →</button>
            <button className="nav-btn" onClick={() => onNavigate?.("billing")} style={{
              padding: "8px 16px", background: C.white, color: C.pine,
              border: `1.5px solid ${C.mint}`, borderRadius: 7,
              fontFamily: "'DM Sans', sans-serif", fontSize: ".85rem", fontWeight: 600,
              cursor: "pointer", transition: "all .15s",
            }}>Billing →</button>
            </>)}
            <button className="nav-btn" onClick={() => onNavigate?.("settings")} style={{
              padding: "8px 16px", background: C.white, color: C.pine,
              border: `1.5px solid ${C.mint}`, borderRadius: 7,
              fontFamily: "'DM Sans', sans-serif", fontSize: ".85rem", fontWeight: 600,
              cursor: "pointer", transition: "all .15s",
            }}>Settings →</button>
            <button className="nav-btn" onClick={() => onNavigate?.("staff")} style={{
              padding: "8px 16px", background: C.white, color: C.pine,
              border: `1.5px solid ${C.mint}`, borderRadius: 7,
              fontFamily: "'DM Sans', sans-serif", fontSize: ".85rem", fontWeight: 600,
              cursor: "pointer", transition: "all .15s",
            }}>Manage Staff →</button>
            <button className="nav-btn" onClick={() => onNavigate?.("report")} style={{
              padding: "8px 16px", background: C.white, color: C.pine,
              border: `1.5px solid ${C.mint}`, borderRadius: 7,
              fontFamily: "'DM Sans', sans-serif", fontSize: ".85rem", fontWeight: 600,
              cursor: "pointer", transition: "all .15s",
            }}>Reports →</button>
          </div>
        </div>

        {/* KPI tiles */}
        <div className="anim" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 14, marginBottom: 8 }}>
          {kpis.map((kpi, i) => (
            <button key={i} onClick={() => onNavigate?.(kpi.dest)} className="kpi-tile" style={{
              background: C.white, borderRadius: 10,
              boxShadow: "0 2px 12px rgba(15,31,23,.07)",
              padding: "20px 22px", height: 90, cursor: "pointer",
              display: "flex", flexDirection: "column", justifyContent: "center",
              border: "none", borderTop: `3px solid ${kpi.color}`,
              textAlign: "left", fontFamily: "'DM Sans', sans-serif",
              transition: "transform .12s, box-shadow .12s",
            }}>
              <div style={{ fontSize: "1.75rem", fontWeight: 700, color: kpi.color, lineHeight: 1 }}>{kpi.value}</div>
              <div style={{ fontSize: ".8rem", color: C.slate, marginTop: 4, fontWeight: 500 }}>{kpi.label} →</div>
            </button>
          ))}
        </div>

        {/* Supporting context */}
        <div className="anim" style={{ fontSize: ".78rem", color: C.mist, marginBottom: 22, paddingLeft: 4 }}>
          Avg training compliance: <strong style={{ color: avgCompliance >= 80 ? C.pine : C.gold }}>{avgCompliance}%</strong>
          &nbsp;· {belowThreshold} site{belowThreshold !== 1 ? "s" : ""} below 80% threshold
        </div>

        {/* Per-site summary table */}
        <div className="anim" style={{ background: C.white, borderRadius: 10, boxShadow: "0 2px 12px rgba(15,31,23,.07)", overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #E2EBE6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2 style={{ fontSize: ".95rem", fontWeight: 600, color: C.ink }}>Site breakdown</h2>
            <p style={{ fontSize: ".75rem", color: C.mist }}>Click a site to open its dashboard</p>
          </div>
          <div style={{ overflowX: "auto" }}>
<table style={{ width: "100%", minWidth: 620, borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Site", "Days since recordable", "Open incidents", "Open CAs", "Critical findings", "Training compliance", ""].map((h, i) => (
                  <th key={i} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SITES.map((site, i) => (
                <tr key={site.name} className="site-row" onClick={() => onNavigate?.("site", site.name)}>
                  <td style={{ padding: "12px 14px", borderBottom: "1px solid #F0F4F2" }}>
                    <div style={{ fontWeight: 600, fontSize: ".88rem", color: C.ink }}>📍 {site.name}</div>
                    <div style={{ fontSize: ".72rem", color: C.mist }}>{site.location} · {site.staff} staff</div>
                  </td>
                  <td style={{ padding: "12px 14px", borderBottom: "1px solid #F0F4F2" }}>
                    <DaysBadge days={site.daysSince} />
                  </td>
                  <td style={{ padding: "12px 14px", borderBottom: "1px solid #F0F4F2" }}>
                    {site.openIncidents > 0
                      ? <span style={{ fontWeight: 700, color: C.red, fontSize: ".88rem" }}>{site.openIncidents}</span>
                      : <span style={{ color: C.mist, fontSize: ".82rem" }}>—</span>
                    }
                  </td>
                  <td style={{ padding: "12px 14px", borderBottom: "1px solid #F0F4F2" }}>
                    {site.openCAs > 0
                      ? <span style={{ fontWeight: 700, color: C.orange, fontSize: ".88rem" }}>{site.openCAs}</span>
                      : <span style={{ color: C.mist, fontSize: ".82rem" }}>—</span>
                    }
                  </td>
                  <td style={{ padding: "12px 14px", borderBottom: "1px solid #F0F4F2" }}>
                    {site.criticalFindings > 0
                      ? <span style={{ fontWeight: 700, color: C.red, fontSize: ".88rem" }}>{site.criticalFindings}</span>
                      : <span style={{ fontSize: ".82rem" }}>✓ <span style={{ color: C.mist }}>None</span></span>
                    }
                  </td>
                  <td style={{ padding: "12px 14px", borderBottom: "1px solid #F0F4F2", minWidth: 140 }}>
                    <ComplianceBar pct={site.compliance} compact />
                  </td>
                  <td style={{ padding: "12px 14px", borderBottom: "1px solid #F0F4F2", color: C.mist, fontSize: ".8rem" }}>→</td>
                </tr>
              ))}
            </tbody>
          </table>
</div>
        </div>
      </div>
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
        <div style={{ fontSize: ".72rem", color: "rgba(255,255,255,.35)", background: "rgba(255,255,255,.07)", padding: "3px 10px", borderRadius: 20, whiteSpace: "nowrap" }}>
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
            <div style={{ fontSize: ".72rem", color: "rgba(255,255,255,.28)", textAlign: "center", marginTop: 6 }}>
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
            <div style={{ fontSize: ".7rem", color: "rgba(255,255,255,.35)", marginTop: 2 }}>After the fact</div>
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
              <div style={{ fontSize: ".75rem", color: "rgba(255,255,255,.4)", marginTop: 1 }}>
                Tap to view your training queue
              </div>
            </div>
            <span style={{ color: C.gold, fontSize: ".85rem" }}>→</span>
          </div>
        )}

        {/* Recent activity */}
        <div className="anim-3">
          <div style={{ fontSize: ".72rem", fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "rgba(255,255,255,.3)", marginBottom: 10 }}>
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
                  <div style={{ fontSize: ".7rem", color: "rgba(255,255,255,.3)", marginTop: 2 }}>{item.time}</div>
                </div>
                <span style={{ color: "rgba(255,255,255,.2)", fontSize: ".8rem" }}>→</span>
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
