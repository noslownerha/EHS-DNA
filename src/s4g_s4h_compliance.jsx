import { useState, useMemo, useEffect } from "react";
import { EHSHeader } from "./AppShell.jsx";
import { BRAND } from "./constants.js";
import { api } from "./api.js";

const C = {
  forest: "#1C3A2A", pine: "#2D5A3D", sage: "#4A8C5C",
  mint: "#A8D5B5", foam: "#E8F5EC", ink: "#0F1F17",
  slate: "#4A5568", mist: "#8FA3A0", chalk: "#F4F7F5",
  white: "#FFFFFF", gold: "#C8922A", goldLt: "#FDF3E3",
  red: "#C0392B", redLt: "#FDECEA",
  purple: "#6B3FA0", purpleLt: "#F3F0F9",
};

const STATUS = {
  current:       { label: "Current",       bg: C.foam,     color: C.pine   },
  expiring_soon: { label: "Expiring soon", bg: C.goldLt,   color: C.gold   },
  overdue:       { label: "Overdue",       bg: C.redLt,    color: C.red    },
  expired:       { label: "Expired",       bg: "#EEF1F0",  color: C.slate  },
  not_started:   { label: "Not started",   bg: C.purpleLt, color: C.purple },
};

const SEED_STAFF = [
  { id: 1,  name: "Sarah Mitchell",  site: "Moriah",      dept: "Bottling & Packaging",    compliance: 78,  overdue: 2, expiring: 1, current: 5, total: 8  },
  { id: 2,  name: "Jake Larson",     site: "Moriah",      dept: "Bottling & Packaging",    compliance: 62,  overdue: 3, expiring: 0, current: 5, total: 8  },
  { id: 3,  name: "Beth Torres",     site: "Moriah",      dept: "Bottling & Packaging",    compliance: 100, overdue: 0, expiring: 0, current: 8, total: 8  },
  { id: 4,  name: "Marcus Webb",     site: "Moriah",      dept: "Warehouse",               compliance: 88,  overdue: 1, expiring: 0, current: 7, total: 8  },
  { id: 5,  name: "Carlos R.",       site: "Moriah",      dept: "Warehouse",               compliance: 50,  overdue: 4, expiring: 0, current: 4, total: 8  },
  { id: 6,  name: "Tom Rivera",      site: "Shoreham",    dept: "Facility Maintenance",             compliance: 75,  overdue: 2, expiring: 1, current: 6, total: 9  },
  { id: 7,  name: "Dana Kowalski",   site: "Middlebury",  dept: "Production / Distilling", compliance: 92,  overdue: 0, expiring: 1, current: 12,total: 13 },
  { id: 8,  name: "Mia Chen",        site: "Middlebury",  dept: "Quality Control",         compliance: 100, overdue: 0, expiring: 0, current: 10,total: 10 },
  { id: 9,  name: "Lena Park",       site: "Middlebury",  dept: "Production / Distilling", compliance: 85,  overdue: 1, expiring: 0, current: 11,total: 13 },
  { id: 10, name: "Priya Nair",      site: "Brandenburg", dept: "Administration",          compliance: 100, overdue: 0, expiring: 0, current: 7, total: 7  },
  { id: 11, name: "Drew Nash",       site: "Shoreham",    dept: "Bottling & Packaging",    compliance: 44,  overdue: 5, expiring: 0, current: 4, total: 9  },
  { id: 12, name: "Ray Santos",      site: "Middlebury",  dept: "Production / Distilling", compliance: 69,  overdue: 2, expiring: 2, current: 9, total: 13 },
];

const STAFF_TRAININGS = [
  { id: 1, title: "Bottling Line Safety Orientation",   status: "overdue",       due: "Jun 10, 2024",  expiresAt: null           },
  { id: 2, title: "Hazard Communication (HAZCOM)",      status: "expiring_soon", due: null,            expiresAt: "Jul 5, 2024"  },
  { id: 3, title: "Emergency Evacuation Procedures",    status: "current",       due: null,            expiresAt: "Dec 2024"     },
  { id: 4, title: "PPE Selection & Use",                status: "not_started",   due: "Jun 30, 2024",  expiresAt: null           },
  { id: 5, title: "Slips, Trips & Falls Prevention",    status: "expired",       due: null,            expiresAt: "May 1, 2024"  },
  { id: 6, title: "Annual Safety Refresher",            status: "current",       due: null,            expiresAt: "Jan 2025"     },
  { id: 7, title: "Forklift Operator Certification",    status: "not_started",   due: "Jul 15, 2024",  expiresAt: null           },
  { id: 8, title: "First Aid & CPR",                    status: "current",       due: null,            expiresAt: "Apr 2026"     },
];

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
  return <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 9px", borderRadius: 20, fontSize: ".68rem", fontWeight: 600, background: bg, color }}>{label}</span>;
}

function ComplianceBar({ pct, compact = false }) {
  const color = pct >= 80 ? C.sage : pct >= 60 ? C.gold : C.red;
  if (compact) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, height: 5, background: "#E2EBE6", borderRadius: 3, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3 }} />
        </div>
        <span style={{ fontSize: ".78rem", fontWeight: 600, color, minWidth: 32, textAlign: "right" }}>{pct}%</span>
      </div>
    );
  }
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".75rem", marginBottom: 4 }}>
        <span style={{ color: C.mist }}>Overall compliance</span>
        <span style={{ fontWeight: 700, color }}>{pct}%</span>
      </div>
      <div style={{ height: 8, background: "#E2EBE6", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 4, transition: "width .5s ease" }} />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// S4g — Compliance Dashboard (desktop)
// Spec §14.3: 4 KPI tiles (value + label only), "Send Reminders" BELOW tile row
// ════════════════════════════════════════════════════════════════════════════
export function S4gComplianceDashboard({ onHome, companyName, onViewStaff }) {
  const [SEED_STAFF, setStaff] = useState([]);
  const [filterSite, setFilterSite] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [sfocused,   setSfocused]   = useState(false);
  const [search,     setSearch]     = useState("");
  const [reminderSent, setReminderSent] = useState(false);

  useEffect(() => {
    api.dashboardCompliance().then(setStaff).catch(err => console.error("Compliance load failed:", err.message));
  }, []);

  const sites = (BRAND.siteRecords ?? []).map(s => s.name);
  const depts = [...new Set(SEED_STAFF.map(s => s.dept))];

  const filtered = useMemo(() =>
    SEED_STAFF.filter(s => {
      if (filterSite && s.site !== filterSite) return false;
      if (filterDept && s.dept !== filterDept) return false;
      if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    }),
    [filterSite, filterDept, search]
  );

  const overdueCount      = SEED_STAFF.reduce((n, s) => n + s.overdue, 0);
  const expiringSoonCount = SEED_STAFF.reduce((n, s) => n + s.expiring, 0);
  const overdueStaff      = SEED_STAFF.filter(s => s.overdue > 0).length;

  // KPI tile values
  const kpis = [
    { label: "Below threshold",  value: SEED_STAFF.filter(s => s.compliance < 80).length, color: C.red,    note: "< 80% compliance" },
    { label: "Overdue trainings",value: overdueCount,                                      color: C.gold,   note: `${overdueStaff} staff affected` },
    { label: "Expiring soon",    value: expiringSoonCount,                                 color: C.purple, note: "Within 30 days" },
    { label: "Fully current",    value: SEED_STAFF.filter(s => s.compliance === 100).length, color: C.sage, note: "100% complete" },
  ];

  const avgCompliance = Math.round(SEED_STAFF.reduce((n, s) => n + s.compliance, 0) / SEED_STAFF.length);

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
        input::placeholder { color: ${C.mist}; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .anim { animation: fadeUp .25s ease both; }
        .staff-row:hover td { background: ${C.foam} !important; cursor: pointer; }
        select option { color: ${C.ink}; }
        .reminder-btn:hover { background: ${C.pine} !important; }
      `}</style>

      <DesktopNav companyName={companyName} active="Training Compliance" onHome={onHome} />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px" }}>

        <div className="anim" style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: C.ink }}>Training Compliance</h1>
          <p style={{ fontSize: ".85rem", color: C.mist, marginTop: 3 }}>All sites · {SEED_STAFF.length} staff · avg {avgCompliance}% compliant</p>
        </div>

        {/* Spec §14.3: 4 KPI tiles — value and label ONLY, fixed height, no actions inside */}
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

        {/* Spec §14.3: "Send Reminders" action in the supporting context row BELOW tiles, never inside a tile */}
        <div className="anim" style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 22, paddingLeft: 4,
        }}>
          <span style={{ fontSize: ".78rem", color: C.mist }}>
            {overdueStaff} staff have overdue trainings
          </span>
          {overdueStaff > 0 && (
            <button
              className="reminder-btn"
              onClick={() => { setReminderSent(true); setTimeout(() => setReminderSent(false), 3000); }}
              style={{
                padding: "7px 16px",
                background: reminderSent ? C.sage + "99" : C.sage,
                color: C.white, border: "none", borderRadius: 6,
                fontFamily: "'DM Sans', sans-serif", fontSize: ".8rem", fontWeight: 600,
                cursor: reminderSent ? "default" : "pointer", transition: "all .15s",
              }}
            >
              {reminderSent ? "✓ Reminders sent" : `Send reminders (${overdueStaff})`}
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="anim" style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <input value={search} onChange={e => setSearch(e.target.value)}
              onFocus={() => setSfocused(true)} onBlur={() => setSfocused(false)}
              placeholder="Search staff…"
              style={{ padding: "8px 12px 8px 30px", width: 200, border: `1.5px solid ${sfocused ? C.sage : "#D0DEDB"}`, borderRadius: 7, fontFamily: "'DM Sans', sans-serif", fontSize: ".83rem", color: C.ink, background: C.white, outline: "none", boxShadow: sfocused ? `0 0 0 3px rgba(74,140,92,.12)` : "none", transition: "all .18s" }} />
            <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", fontSize: ".78rem", color: C.mist, pointerEvents: "none" }}>🔍</span>
          </div>
          {[
            { label: "All sites", value: filterSite, set: setFilterSite, options: sites },
            { label: "All depts", value: filterDept, set: setFilterDept, options: depts },
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
              {f.options.map(o => <option key={o}>{o}</option>)}
            </select>
          ))}
        </div>

        {/* Staff compliance table */}
        <div className="anim" style={{ background: C.white, borderRadius: 10, boxShadow: "0 2px 12px rgba(15,31,23,.07)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Name", "Site", "Department", "Compliance", "Overdue", "Expiring", ""].map((h, i) => (
                  <th key={i} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <tr key={s.id} className="staff-row" onClick={() => onViewStaff?.(s.id)}>
                  <td style={{ padding: "11px 14px", borderBottom: "1px solid #F0F4F2", fontWeight: 600, fontSize: ".88rem", color: C.ink }}>{s.name}</td>
                  <td style={{ padding: "11px 14px", borderBottom: "1px solid #F0F4F2", fontSize: ".82rem", color: C.slate }}>{s.site}</td>
                  <td style={{ padding: "11px 14px", borderBottom: "1px solid #F0F4F2", fontSize: ".82rem", color: C.slate }}>{s.dept}</td>
                  <td style={{ padding: "11px 14px", borderBottom: "1px solid #F0F4F2", minWidth: 160 }}>
                    <ComplianceBar pct={s.compliance} compact />
                  </td>
                  <td style={{ padding: "11px 14px", borderBottom: "1px solid #F0F4F2" }}>
                    {s.overdue > 0
                      ? <span style={{ fontWeight: 700, color: C.red, fontSize: ".88rem" }}>{s.overdue}</span>
                      : <span style={{ color: C.mist, fontSize: ".82rem" }}>—</span>
                    }
                  </td>
                  <td style={{ padding: "11px 14px", borderBottom: "1px solid #F0F4F2" }}>
                    {s.expiring > 0
                      ? <span style={{ fontWeight: 600, color: C.gold, fontSize: ".82rem" }}>{s.expiring}</span>
                      : <span style={{ color: C.mist, fontSize: ".82rem" }}>—</span>
                    }
                  </td>
                  <td style={{ padding: "11px 14px", borderBottom: "1px solid #F0F4F2", color: C.mist, fontSize: ".8rem" }}>→</td>
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
// S4h — Staff Compliance Detail (desktop)
// ════════════════════════════════════════════════════════════════════════════
export function S4hStaffComplianceDetail({ onHome, staffId, companyName, onBack }) {
  const [staff, setStaff] = useState({ name: "…", site: "", dept: "", compliance: 0, current: 0, total: 0, overdue: 0, expiring: 0 });
  const [trainings, setTrainings] = useState([]);

  useEffect(() => {
    Promise.all([api.dashboardCompliance(), api.listTrainings(), api.listCompletions()])
      .then(([compliance, trs, comps]) => {
        const row = compliance.find(c => c.id === staffId);
        if (row) setStaff(row);
        const fmt = d => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;
        const now = Date.now(), soon = now + 30 * 86400000;
        setTrainings(trs.filter(t => t.active).map(t => {
          const comp = comps.filter(c => c.training_id === t.id && c.user_id === staffId)
            .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at))[0];
          let status, due = null, expiresAt = null;
          if (!comp) { status = "not_started"; }
          else if (comp.expires_at && new Date(comp.expires_at).getTime() < now) { status = "expired"; expiresAt = fmt(comp.expires_at); }
          else if (comp.expires_at && new Date(comp.expires_at).getTime() < soon) { status = "expiring_soon"; expiresAt = fmt(comp.expires_at); }
          else { status = "current"; expiresAt = fmt(comp?.expires_at); }
          return { id: t.id, title: t.title, status, due, expiresAt };
        }));
      }).catch(err => console.error("Staff detail load failed:", err.message));
  }, [staffId]);

  const thStyle = {
    padding: "9px 14px", textAlign: "left",
    fontSize: ".7rem", fontWeight: 600, letterSpacing: ".06em",
    textTransform: "uppercase", color: C.mist,
    borderBottom: "1px solid #E2EBE6", background: C.chalk,
  };

  const compColor = staff.compliance >= 80 ? C.sage : staff.compliance >= 60 ? C.gold : C.red;

  return (
    <div style={{ minHeight: "100vh", background: C.chalk, fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .anim { animation: fadeUp .25s ease both; }
      `}</style>

      <DesktopNav companyName={companyName} active="Staff Compliance" onHome={onHome} />

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 24px" }}>

        {/* Breadcrumb + header */}
        <div className="anim" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <button onClick={onBack} style={{ background: "none", border: "none", color: C.mist, fontSize: ".82rem", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>← Compliance</button>
            <span style={{ color: "#D0DEDB" }}>/</span>
            <span style={{ fontSize: ".82rem", color: C.ink }}>{staff.name}</span>
          </div>
          <h1 style={{ fontSize: "1.3rem", fontWeight: 700, color: C.ink, marginBottom: 6 }}>{staff.name}</h1>
          <div style={{ fontSize: ".82rem", color: C.mist }}>{staff.dept} · {staff.site}</div>
        </div>

        {/* Summary card */}
        <div className="anim" style={{ background: C.white, borderRadius: 10, boxShadow: "0 2px 12px rgba(15,31,23,.07)", padding: "20px 22px", marginBottom: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 20, alignItems: "center" }}>
            <div>
              <ComplianceBar pct={staff.compliance} />
              <div style={{ fontSize: ".72rem", color: C.mist, marginTop: 6 }}>
                {staff.current} of {staff.total} trainings current
              </div>
            </div>
            {[
              { label: "Overdue",       value: staff.overdue,  color: C.red    },
              { label: "Expiring soon", value: staff.expiring, color: C.gold   },
              { label: "Current",       value: staff.current,  color: C.sage   },
            ].map((s, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ fontSize: "1.8rem", fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: ".75rem", color: C.mist, marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Training list */}
        <div className="anim" style={{ background: C.white, borderRadius: 10, boxShadow: "0 2px 12px rgba(15,31,23,.07)", overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #E2EBE6" }}>
            <h2 style={{ fontSize: ".95rem", fontWeight: 600, color: C.ink }}>Assigned trainings</h2>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Training", "Status", "Due / Expires", "Action"].map((h, i) => (
                  <th key={i} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trainings.map((t, i) => {
                const s = STATUS[t.status] ?? STATUS.not_started;
                return (
                  <tr key={t.id}>
                    <td style={{ padding: "11px 14px", borderBottom: "1px solid #F0F4F2", fontWeight: 500, fontSize: ".88rem", color: C.ink }}>{t.title}</td>
                    <td style={{ padding: "11px 14px", borderBottom: "1px solid #F0F4F2" }}>
                      <span style={{ padding: "2px 9px", borderRadius: 20, fontSize: ".68rem", fontWeight: 600, background: s.bg, color: s.color }}>{s.label}</span>
                    </td>
                    <td style={{ padding: "11px 14px", borderBottom: "1px solid #F0F4F2", fontSize: ".82rem", color: C.slate }}>
                      {t.due && <span style={{ color: t.status === "overdue" ? C.red : C.slate }}>Due {t.due}</span>}
                      {t.expiresAt && <span style={{ color: t.status === "expiring_soon" ? C.gold : C.mist }}>Expires {t.expiresAt}</span>}
                      {!t.due && !t.expiresAt && <span style={{ color: C.mist }}>—</span>}
                    </td>
                    <td style={{ padding: "11px 14px", borderBottom: "1px solid #F0F4F2" }}>
                      {(t.status === "overdue" || t.status === "not_started" || t.status === "expired") && (
                        <button style={{
                          padding: "5px 12px", background: C.white, color: C.pine,
                          border: `1.5px solid ${C.mint}`, borderRadius: 6,
                          fontFamily: "'DM Sans', sans-serif", fontSize: ".75rem",
                          fontWeight: 600, cursor: "pointer",
                        }}>Send reminder</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  function ComplianceBar({ pct }) {
    const color = pct >= 80 ? C.sage : pct >= 60 ? C.gold : C.red;
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".75rem", marginBottom: 5 }}>
          <span style={{ color: C.mist }}>Overall compliance</span>
          <span style={{ fontWeight: 700, color }}>{pct}%</span>
        </div>
        <div style={{ height: 8, background: "#E2EBE6", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 4 }} />
        </div>
      </div>
    );
  }
}
