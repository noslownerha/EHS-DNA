import { useState } from "react";
import { EHSHeader } from "./AppShell.jsx";
import { BRAND, SITES } from "./constants.js";

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

const RECENT_INCIDENTS = [
  { id: "INC-2024-0087", type: "Injury",       severity: "significant", reporter: "Sarah M.", date: "Jun 12", status: "open"   },
  { id: "INC-2024-0082", type: "Vehicle",      severity: "significant", reporter: "Jake L.",  date: "May 20", status: "open"   },
  { id: "INC-2024-0079", type: "Near Miss",    severity: "minor",       reporter: "Marcus W.",date: "May 14", status: "closed" },
];

const OPEN_CAS = [
  { id: 1, desc: "Review incident with Sarah Mitchell",   assignee: "Dana K.",  due: "Jun 15", overdue: true  },
  { id: 2, desc: "Conduct root cause analysis â Jun 12", assignee: "Mia C.",   due: "Jun 19", overdue: false },
  { id: 3, desc: "Review vehicle inspection records",    assignee: "Dana K.",  due: "May 25", overdue: true  },
  { id: 4, desc: "Assess loading dock leveller repair",  assignee: "Dana K.",  due: "Jul 15", overdue: false },
];

const OPEN_FINDINGS = [
  { id: 1, desc: "Guard missing on conveyor line 3",         severity: "critical", ageDays: 2  },
  { id: 2, desc: "Blocked emergency exit â pallet at door",  severity: "major",    ageDays: 4  },
  { id: 3, desc: "Forklift horn inoperable â unit 4",        severity: "critical", ageDays: 5  },
];

const SEV_COLOR = {
  critical:    C.red, major: C.orange, significant: C.gold, minor: C.sage,
};

function DesktopNav({ companyName = "WhistlePig Whiskey", siteName }) {
  return (
    <EHSHeader onHome={onHome} />
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
  companyName = "WhistlePig Whiskey",
  manager     = { name: "Dana Kowalski", site: "Moriah" },
  onNavigate, // (destination: string) => void
,
  onHome,
}) {
  const [reminderSent, setReminderSent] = useState(false);

  // Spec: days-since-recordable is a visible, motivational metric on site manager dashboards
  const daysSinceRecordable = 47;

  const kpis = [
    { label: "Open incidents",   value: 2,  color: C.red    },
    { label: "Open CAs",         value: 4,  color: C.orange },
    { label: "Open findings",    value: 6,  color: C.gold   },
    { label: "Training overdue", value: 7,  color: C.purple },
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
        .kpi-val { animation: countUp .4s cubic-bezier(.4,0,.2,1) both; }
        .row-hover:hover { background: ${C.foam} !important; cursor: pointer; }
        .nav-btn:hover { background: ${C.foam} !important; }
        .reminder-btn:hover { background: ${C.pine} !important; }
      `}</style>

      <DesktopNav companyName={companyName} siteName={SITE.name} />

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px" }}>

        {/* Page header */}
        <div className="anim" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: C.ink }}>
              {SITE.name} Dashboard
            </h1>
            <p style={{ fontSize: ".85rem", color: C.mist, marginTop: 3 }}>
              {SITE.location} Â· {SITE.staffCount} staff Â· {SITE.deptCount} departments
            </p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="nav-btn" onClick={() => onNavigate?.("report")} style={{
              padding: "8px 16px", background: C.white, color: C.pine,
              border: `1.5px solid ${C.mint}`, borderRadius: 7,
              fontFamily: "'DM Sans', sans-serif", fontSize: ".85rem", fontWeight: 600,
              cursor: "pointer", transition: "all .15s",
            }}>View reports â</button>
          </div>
        </div>

        {/* ââ Days-since-recordable â spec: visible, motivational metric ââ */}
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
                ? `Great work â ${SITE.name} has maintained a clean record for ${daysSinceRecordable} days.`
                : "A recent recordable incident was logged. Continue focusing on safe practices."
              }
            </div>
          </div>
        </div>

        {/* ââ KPI tiles â spec: value and label only, fixed height ââ */}
        <div className="anim" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 8 }}>
          {kpis.map((kpi, i) => (
            <div key={i} style={{
              background: C.white, borderRadius: 10,
              boxShadow: "0 2px 12px rgba(15,31,23,.07)",
              padding: "20px 22px", height: 90,
              display: "flex", flexDirection: "column", justifyContent: "center",
              borderTop: `3px solid ${kpi.color}`,
            }}>
              <div className="kpi-val" style={{ fontSize: "1.75rem", fontWeight: 700, color: kpi.color, lineHeight: 1 }}>{kpi.value}</div>
              <div style={{ fontSize: ".8rem", color: C.slate, marginTop: 4, fontWeight: 500 }}>{kpi.label}</div>
            </div>
          ))}
        </div>

        {/* Supporting context row */}
        <div className="anim" style={{ fontSize: ".78rem", color: C.mist, marginBottom: 22, paddingLeft: 4, display: "flex", alignItems: "center", gap: 16 }}>
          <span>{criticalFindings} critical findings Â· {overdueCACount} CAs overdue</span>
          {overdueCACount > 0 && (
            <button className="reminder-btn" onClick={() => { setReminderSent(true); setTimeout(() => setReminderSent(false), 2500); }}
              style={{ padding: "5px 12px", background: reminderSent ? C.sage + "88" : C.sage, color: C.white, border: "none", borderRadius: 6, fontFamily: "'DM Sans', sans-serif", fontSize: ".75rem", fontWeight: 600, cursor: "pointer", transition: "all .15s" }}>
              {reminderSent ? "â Reminders sent" : `Send CA reminders (${overdueCACount})`}
            </button>
          )}
        </div>

        {/* Three-column lower grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>

          {/* Recent incidents */}
          <SectionCard
            title="Recent incidents"
            subtitle={`${SITE.name} Â· last 30 days`}
            action={<button className="nav-btn" onClick={() => onNavigate?.("incidents")} style={{ background: "none", border: "none", color: C.sage, fontSize: ".78rem", fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>View all â</button>}
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
                  <div style={{ fontSize: ".75rem", color: C.mist }}>{inc.reporter} Â· {inc.date}</div>
                </div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: ".68rem", color: C.mist, flexShrink: 0 }}>{inc.id}</div>
              </div>
            ))}
          </SectionCard>

          {/* Open CAs */}
          <SectionCard
            title="Open corrective actions"
            subtitle={`${OPEN_CAS.length} total Â· ${overdueCACount} overdue`}
            action={<button className="nav-btn" onClick={() => onNavigate?.("cas")} style={{ background: "none", border: "none", color: C.sage, fontSize: ".78rem", fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>CA tracker â</button>}
          >
            {OPEN_CAS.map((ca, i) => (
              <div key={ca.id} className="row-hover" style={{
                padding: "9px 0", borderBottom: i < OPEN_CAS.length - 1 ? "1px solid #F0F4F2" : "none",
              }}>
                <div style={{ fontSize: ".85rem", color: C.ink, lineHeight: 1.3, marginBottom: 3 }}>{ca.desc}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: ".72rem", color: C.mist }}>{ca.assignee}</span>
                  <span style={{ fontSize: ".72rem", color: ca.overdue ? C.red : C.mist, fontWeight: ca.overdue ? 600 : 400 }}>
                    {ca.overdue ? `â  Due ${ca.due}` : `Due ${ca.due}`}
                  </span>
                </div>
              </div>
            ))}
          </SectionCard>

          {/* Open findings */}
          <SectionCard
            title="Open findings"
            subtitle={`${SITE.name} Â· ${criticalFindings} critical`}
            action={<button className="nav-btn" onClick={() => onNavigate?.("findings")} style={{ background: "none", border: "none", color: C.sage, fontSize: ".78rem", fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Aging tracker â</button>}
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
            <p style={{ fontSize: ".75rem", color: C.mist, marginTop: 2 }}>Moriah Â· 7 staff with overdue trainings</p>
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
            }}>View compliance â</button>
          </div>
        </div>
      </div>
    </div>
  );
}
