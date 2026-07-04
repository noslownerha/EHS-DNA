import { useState, useEffect } from "react";
import { EHSHeader } from "./AppShell.jsx";
import { BRAND } from "./constants.js";
import { api } from "./api.js";

const C = {
  forest: "#1C3A2A", pine: "#2D5A3D", sage: "#4A8C5C",
  mint: "#A8D5B5", foam: "#E8F5EC", ink: "#0F1F17",
  slate: "#4A5568", mist: "#8FA3A0", chalk: "#F4F7F5",
  white: "#FFFFFF", gold: "#C8922A", goldLt: "#FDF3E3",
  red: "#C0392B", redLt: "#FDECEA",
  orange: "#D4622A", orangeLt: "#FEF0E7",
  purple: "#6B3FA0", purpleLt: "#F3F0F9",
};

// Seed data scoped to Moriah site
const SITE = { name: "Moriah", location: "Mineville, NY", staffCount: 18, deptCount: 4 };




const SEV_COLOR = {
  critical:    C.red, major: C.orange, significant: C.gold, minor: C.sage,
};

function DesktopNav({ companyName = BRAND.company, siteName, onHome }) {
  return (
    <EHSHeader onHome={onHome} title={companyName} rightContent={
      <div style={{ fontSize: ".72rem", color: C.mint, background: "rgba(255,255,255,.1)", padding: "3px 12px", borderRadius: 20, whiteSpace: "nowrap" }}>
        📍 {siteName}
      </div>
    } />
  );
}

function SectionCard({ title, subtitle, children, action }) {
  return (
    <div style={{ background: C.white, borderRadius: 10, boxShadow: "0 2px 12px rgba(15,31,23,.07)", overflow: "hidden", marginBottom: 16 }}>
      <div style={{ padding: "14px 18px 0", display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ fontSize: ".95rem", fontWeight: 600, color: C.ink }}>{title}</h2>
          {subtitle && <p style={{ fontSize: ".75rem", color: C.mist, marginTop: 2 }}>{subtitle}</p>}
        </div>
        {action}
      </div>
      <div style={{ padding: "12px 18px 16px" }}>{children}</div>
    </div>
  );
}

export default function S5aSiteManagerDashboard({
  onHome,
  companyName = BRAND.company,
  manager     = { name: "Site Manager", site: "Moriah" },
  onNavigate, // (destination: string) => void
}) {
  const [reminderSent, setReminderSent] = useState(false);
  const [siteStats, setSiteStats] = useState(null);
  const [trainingOverdue, setTrainingOverdue] = useState(null);

  const [RECENT_INCIDENTS, setRecentIncidents] = useState([]);
  const [OPEN_CAS, setOpenCAs] = useState([]);
  const [OPEN_FINDINGS, setOpenFindings] = useState([]);

  useEffect(() => {
    Promise.all([api.dashboardSummary(), api.dashboardCompliance()]).then(([sites, compliance]) => {
      setSiteStats(sites.find(s => s.name === manager.site) ?? null);
      setTrainingOverdue(compliance.filter(c => c.site === manager.site).reduce((n, c) => n + c.overdue, 0));
    }).catch(err => console.error("Site dashboard load failed:", err.message));

    Promise.all([api.listIncidents(), api.listCAs(), api.listFindings()]).then(([incs, cas, finds]) => {
      const mine = rows => rows.filter(r => (r.site_name ?? "") === manager.site);
      const typeLabel = { injury: "Injury", near_miss: "Near Miss", property: "Property", security: "Security" };
      setRecentIncidents(mine(incs).slice(0, 4).map(i => ({
        id: i.ref, type: typeLabel[i.type] ?? i.type, severity: i.severity ?? "minor",
        reporter: i.reporter_name ?? "—",
        date: (i.occurred_at ?? i.created_at ?? "").slice(5, 10), status: i.status,
      })));
      const incBySite = Object.fromEntries(incs.map(i => [i.id, i.site_name]));
      setOpenCAs(cas.filter(c => c.status !== "done" && c.status !== "verified" && incBySite[c.incident_id] === manager.site)
        .slice(0, 4).map(c => ({
          id: c.id, desc: c.title, assignee: c.assignee_name ?? "Unassigned",
          due: (c.due_date ?? "").slice(5, 10) || "—",
          overdue: c.due_date && new Date(c.due_date) < new Date(),
        })));
      setOpenFindings(mine(finds).filter(f => f.status !== "resolved").slice(0, 4).map(f => ({
        id: f.id, desc: f.description, severity: f.severity === "high" ? "critical" : f.severity ?? "minor",
        ageDays: Math.max(0, Math.floor((Date.now() - new Date(f.created_at).getTime()) / 86400000)),
      })));
    }).catch(err => console.error("Site lists load failed:", err.message));
  }, [manager.site]);

  // Spec: days-since-recordable is a visible, motivational metric on site manager dashboards
  const daysSinceRecordable = siteStats?.daysSince ?? 0;

  const kpis = [
    { label: "Open incidents",   value: siteStats?.openIncidents ?? 0,       color: C.red,    dest: "incidents" },
    { label: "Open CAs",         value: siteStats?.openCAs ?? 0,             color: C.orange, dest: "cas"       },
    { label: "Open findings",    value: siteStats?.criticalFindings ?? 0,    color: C.gold,   dest: "findings"  },
    { label: "Training overdue", value: trainingOverdue ?? 0,                color: C.purple, dest: "training"  },
  ];

  const overdueCACount = OPEN_CAS.filter(c => c.overdue).length;
  const criticalFindings = OPEN_FINDINGS.filter(f => f.severity === "critical").length;

  return (
    <div style={{ minHeight: "100vh", background: C.chalk, fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes countUp { from { opacity:0; transform:scale(.8); } to { opacity:1; transform:scale(1); } }
        .anim { animation: fadeUp .25s ease both; }
        .kpi-tile:active { transform: scale(.97); }
        .kpi-tile:hover { box-shadow: 0 4px 18px rgba(15,31,23,.13); }
        .kpi-val { animation: countUp .4s cubic-bezier(.4,0,.2,1) both; }
        .row-hover:hover { background: ${C.foam} !important; cursor: pointer; }
        .nav-btn:hover { background: ${C.foam} !important; }
        .reminder-btn:hover { background: ${C.pine} !important; }
      `}</style>

      <DesktopNav onHome={onHome} companyName={companyName} siteName={SITE.name} />

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px" }}>

        {/* Page header */}
        <div className="anim" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: C.ink }}>
              {SITE.name} Dashboard
            </h1>
            <p style={{ fontSize: ".85rem", color: C.mist, marginTop: 3 }}>
              {SITE.location} · {SITE.staffCount} staff · {SITE.deptCount} departments
            </p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="nav-btn" onClick={() => onNavigate?.("report")} style={{
              padding: "8px 16px", background: C.white, color: C.pine,
              border: `1.5px solid ${C.mint}`, borderRadius: 7,
              fontFamily: "'DM Sans', sans-serif", fontSize: ".85rem", fontWeight: 600,
              cursor: "pointer", transition: "all .15s",
            }}>View reports →</button>
          </div>
        </div>

        {/* ── Days-since-recordable — spec: visible, motivational metric ── */}
        <div className="anim" style={{
          background: daysSinceRecordable >= 30 ? C.forest : C.goldLt,
          borderRadius: 10, padding: "20px 24px", marginBottom: 18,
          display: "flex", alignItems: "center", gap: 20,
          border: daysSinceRecordable < 30 ? `1.5px solid #F0D090` : "none",
        }}>
          <div style={{ textAlign: "center", flexShrink: 0 }}>
            <div className="kpi-val" style={{
              fontSize: "3.5rem", fontWeight: 800, lineHeight: 1,
              color: daysSinceRecordable >= 30 ? C.mint : C.gold,
            }}>
              {daysSinceRecordable}
            </div>
            <div style={{ fontSize: ".78rem", fontWeight: 600, color: daysSinceRecordable >= 30 ? "rgba(168,213,181,.7)" : "#9A7A3A", marginTop: 4 }}>
              DAYS
            </div>
          </div>
          <div>
            <div style={{ fontSize: "1.05rem", fontWeight: 700, color: daysSinceRecordable >= 30 ? C.white : "#5A3A00", marginBottom: 4 }}>
              Since last OSHA recordable incident
            </div>
            <div style={{ fontSize: ".82rem", color: daysSinceRecordable >= 30 ? "rgba(255,255,255,.5)" : "#9A7A3A", lineHeight: 1.5 }}>
              {daysSinceRecordable >= 30
                ? `Great work — ${SITE.name} has maintained a clean record for ${daysSinceRecordable} days.`
                : "A recent recordable incident was logged. Continue focusing on safe practices."
              }
            </div>
          </div>
        </div>

        {/* ── KPI tiles — spec: value and label only, fixed height ── */}
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
              <div className="kpi-val" style={{ fontSize: "1.75rem", fontWeight: 700, color: kpi.color, lineHeight: 1 }}>{kpi.value}</div>
              <div style={{ fontSize: ".8rem", color: C.slate, marginTop: 4, fontWeight: 500 }}>{kpi.label} →</div>
            </button>
          ))}
        </div>

        {/* Supporting context row */}
        <div className="anim" style={{ fontSize: ".78rem", color: C.mist, marginBottom: 22, paddingLeft: 4, display: "flex", alignItems: "center", gap: 16 }}>
          <span>{criticalFindings} critical findings · {overdueCACount} CAs overdue</span>
          {overdueCACount > 0 && (
            <button className="reminder-btn" onClick={() => { setReminderSent(true); setTimeout(() => setReminderSent(false), 2500); }}
              style={{ padding: "5px 12px", background: reminderSent ? C.sage + "88" : C.sage, color: C.white, border: "none", borderRadius: 6, fontFamily: "'DM Sans', sans-serif", fontSize: ".75rem", fontWeight: 600, cursor: "pointer", transition: "all .15s" }}>
              {reminderSent ? "✓ Reminders sent" : `Send CA reminders (${overdueCACount})`}
            </button>
          )}
        </div>

        {/* Three-column lower grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>

          {/* Recent incidents */}
          <SectionCard
            title="Recent incidents"
            subtitle={`${SITE.name} · last 30 days`}
            action={<button className="nav-btn" onClick={() => onNavigate?.("incidents")} style={{ background: "none", border: "none", color: C.sage, fontSize: ".78rem", fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>View all →</button>}
          >
            {RECENT_INCIDENTS.map((inc, i) => (
              <div key={inc.id} className="row-hover" style={{
                padding: "9px 0", borderBottom: i < RECENT_INCIDENTS.length - 1 ? "1px solid #F0F4F2" : "none",
                display: "flex", alignItems: "flex-start", gap: 10,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: ".7rem", fontWeight: 600, color: SEV_COLOR[inc.severity] ?? C.slate }}>{inc.type}</span>
                    <span style={{
                      padding: "1px 7px", borderRadius: 20, fontSize: ".65rem", fontWeight: 600,
                      background: inc.status === "open" ? C.foam : "#EEF1F0",
                      color: inc.status === "open" ? C.pine : C.slate,
                    }}>{inc.status}</span>
                  </div>
                  <div style={{ fontSize: ".75rem", color: C.mist }}>{inc.reporter} · {inc.date}</div>
                </div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: ".68rem", color: C.mist, flexShrink: 0 }}>{inc.id}</div>
              </div>
            ))}
          </SectionCard>

          {/* Open CAs */}
          <SectionCard
            title="Open corrective actions"
            subtitle={`${OPEN_CAS.length} total · ${overdueCACount} overdue`}
            action={<button className="nav-btn" onClick={() => onNavigate?.("cas")} style={{ background: "none", border: "none", color: C.sage, fontSize: ".78rem", fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>CA tracker →</button>}
          >
            {OPEN_CAS.map((ca, i) => (
              <div key={ca.id} className="row-hover" style={{
                padding: "9px 0", borderBottom: i < OPEN_CAS.length - 1 ? "1px solid #F0F4F2" : "none",
              }}>
                <div style={{ fontSize: ".85rem", color: C.ink, lineHeight: 1.3, marginBottom: 3 }}>{ca.desc}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: ".72rem", color: C.mist }}>{ca.assignee}</span>
                  <span style={{ fontSize: ".72rem", color: ca.overdue ? C.red : C.mist, fontWeight: ca.overdue ? 600 : 400 }}>
                    {ca.overdue ? `⚠ Due ${ca.due}` : `Due ${ca.due}`}
                  </span>
                </div>
              </div>
            ))}
          </SectionCard>

          {/* Open findings */}
          <SectionCard
            title="Open findings"
            subtitle={`${SITE.name} · ${criticalFindings} critical`}
            action={<button className="nav-btn" onClick={() => onNavigate?.("findings")} style={{ background: "none", border: "none", color: C.sage, fontSize: ".78rem", fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Aging tracker →</button>}
          >
            {OPEN_FINDINGS.map((f, i) => (
              <div key={f.id} className="row-hover" style={{
                padding: "9px 0", borderBottom: i < OPEN_FINDINGS.length - 1 ? "1px solid #F0F4F2" : "none",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                  <span style={{ padding: "1px 7px", borderRadius: 20, fontSize: ".65rem", fontWeight: 600, background: SEV_COLOR[f.severity] + "18", color: SEV_COLOR[f.severity] }}>
                    {f.severity.charAt(0).toUpperCase() + f.severity.slice(1)}
                  </span>
                  <span style={{ fontSize: ".7rem", color: C.mist }}>{f.ageDays}d old</span>
                </div>
                <div style={{ fontSize: ".85rem", color: C.ink, lineHeight: 1.3 }}>{f.desc}</div>
              </div>
            ))}
          </SectionCard>
        </div>

        {/* Training compliance strip */}
        <div className="anim" style={{ background: C.white, borderRadius: 10, boxShadow: "0 2px 12px rgba(15,31,23,.07)", padding: "16px 20px", marginTop: 2, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ fontSize: ".92rem", fontWeight: 600, color: C.ink }}>Training compliance</h2>
            <p style={{ fontSize: ".75rem", color: C.mist, marginTop: 2 }}>Moriah · 7 staff with overdue trainings</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: C.gold }}>74%</div>
              <div style={{ fontSize: ".7rem", color: C.mist }}>Site avg</div>
            </div>
            <div style={{ width: 120, height: 8, background: "#E2EBE6", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", width: "74%", background: C.gold, borderRadius: 4 }} />
            </div>
            <button className="nav-btn" onClick={() => onNavigate?.("training")} style={{
              padding: "7px 14px", background: C.white, color: C.pine,
              border: `1.5px solid ${C.mint}`, borderRadius: 6,
              fontFamily: "'DM Sans', sans-serif", fontSize: ".8rem", fontWeight: 600,
              cursor: "pointer", transition: "all .15s",
            }}>View compliance →</button>
          </div>
        </div>
      </div>
    </div>
  );
}
