import { useState } from "react";
import { EHSHeader } from "./AppShell.jsx";
import { BRAND, SITES } from "./constants.js";

const C = {
  forest: "#1C3A2A", pine: "#2D5A3D", sage: "#4A8C5C",
  mint: "#A8D5B5", foam: "#E8F5EC", ink: "#0F1F17",
  slate: "#4A5568", mist: "#8FA3A0", chalk: "#F4F7F5",
  white: "#FFFFFF", gold: "#C8922A", goldLt: "#FDF3E3",
  red: "#C0392B", redLt: "#FDECEA",
  purple: "#6B3FA0", purpleLt: "#F3F0F9",
};

const TYPE_COLOR = { cbt: C.purple, in_person: C.pine };
const TYPE_EMOJI = { cbt: "ð»", in_person: "ð¥" };
const TYPE_LABEL = { cbt: "CBT", in_person: "In-person" };

const STATUS = {
  current:       { label: "Current",       bg: C.foam,     color: C.pine   },
  expiring_soon: { label: "Expiring soon", bg: C.goldLt,   color: C.gold   },
  overdue:       { label: "Overdue",       bg: C.redLt,    color: C.red    },
  expired:       { label: "Expired",       bg: "#EEF1F0",  color: C.slate  },
  not_started:   { label: "Not started",   bg: C.purpleLt, color: C.purple },
};

const SEED_LIBRARY = [
  { id: 1,  title: "Bottling Line Safety Orientation",     type: "cbt",       groups: ["Bottling & Packaging"],               recurrence: 12, passThreshold: 80,  version: "v1.3", completions: 18, overdue: 2  },
  { id: 2,  title: "Forklift Operator Certification",      type: "in_person", groups: ["Warehouse", "Forklift Certified"],    recurrence: 12, passThreshold: null, version: "v2.0", completions: 9,  overdue: 1  },
  { id: 3,  title: "Hazard Communication (HAZCOM)",        type: "cbt",       groups: ["All Staff"],                          recurrence: 12, passThreshold: 75,  version: "v1.1", completions: 41, overdue: 0  },
  { id: 4,  title: "Emergency Evacuation Procedures",      type: "cbt",       groups: ["All Staff"],                          recurrence: 6,  passThreshold: 100, version: "v1.0", completions: 38, overdue: 3  },
  { id: 5,  title: "PPE Selection & Use",                  type: "cbt",       groups: ["All Staff"],                          recurrence: 12, passThreshold: 80,  version: "v1.2", completions: 35, overdue: 4  },
  { id: 6,  title: "Slips, Trips & Falls Prevention",      type: "cbt",       groups: ["All Staff"],                          recurrence: 12, passThreshold: 80,  version: "v1.0", completions: 30, overdue: 5  },
  { id: 7,  title: "First Aid & CPR",                      type: "in_person", groups: ["Safety Officer", "ERC"],              recurrence: 24, passThreshold: null, version: "v1.0", completions: 4,  overdue: 0  },
  { id: 8,  title: "Annual Safety Refresher",              type: "in_person", groups: ["All Staff"],                          recurrence: 12, passThreshold: null, version: "v3.1", completions: 40, overdue: 2  },
];

const SEED_COMPLETIONS = [
  { id: 1, staffName: "Sarah Mitchell",  site: "Moriah",     completedAt: "2024-03-15", score: 92, passed: true,  expiresAt: "2025-03-15", trainerName: null,      sessionId: null           },
  { id: 2, staffName: "Jake Larson",     site: "Moriah",     completedAt: "2024-03-15", score: 88, passed: true,  expiresAt: "2025-03-15", trainerName: null,      sessionId: null           },
  { id: 3, staffName: "Beth Torres",     site: "Moriah",     completedAt: "2024-03-16", score: 76, passed: false, expiresAt: null,         trainerName: null,      sessionId: null           },
  { id: 4, staffName: "Marcus Webb",     site: "Moriah",     completedAt: "2024-01-10", score: 95, passed: true,  expiresAt: "2025-01-10", trainerName: null,      sessionId: null           },
  { id: 5, staffName: "Dana Kowalski",   site: "Middlebury", completedAt: "2024-03-20", score: 91, passed: true,  expiresAt: "2025-03-20", trainerName: null,      sessionId: null           },
  { id: 6, staffName: "Priya Nair",      site: "Brandenburg",completedAt: "2024-04-05", score: 85, passed: true,  expiresAt: "2025-04-05", trainerName: null,      sessionId: null           },
  { id: 7, staffName: "Tom Rivera",      site: "Shoreham",   completedAt: "2024-04-12", score: null, passed: true,expiresAt: "2025-04-12", trainerName: "Mia Chen",sessionId: "SES-2024-041" },
  { id: 8, staffName: "Lena Park",       site: "Middlebury", completedAt: "2024-04-12", score: null, passed: true,expiresAt: "2025-04-12", trainerName: "Mia Chen",sessionId: "SES-2024-041" },
];

function DesktopNav({ companyName = "WhistlePig Whiskey", active }) {
  return (
    <EHSHeader onHome={onHome} />
  );
}

function pill(label, bg, color) {
  return <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 9px", borderRadius: 20, fontSize: ".68rem", fontWeight: 600, background: bg, color }}>{label}</span>;
}

// ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
// S4e â Training Library (desktop)
// Spec Â§14.2: "Log Group Session" as top-level secondary action alongside "Create Training"
// ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
export function S4eTrainingLibrary({ companyName, userRole = "admin", onViewTraining, onLogGroupSession, onCreateTraining ,
  onHome,
}) {
  const [filterType, setFilterType] = useState("");
  const [search,     setSearch]     = useState("");
  const [sfocused,   setSfocused]   = useState(false);

  const filtered = SEED_LIBRARY.filter(t => {
    if (filterType && t.type !== filterType) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Role gate for Log Group Session (hidden for dept_lead and below)
  const canLogSession = ["trainer", "safety", "site_manager", "admin"].includes(userRole);

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
        .lib-row:hover td { background: ${C.foam} !important; cursor: pointer; }
        .create-btn:hover { background: ${C.pine} !important; transform: translateY(-1px); }
        .session-btn:hover { background: ${C.foam} !important; }
        select option { color: ${C.ink}; }
      `}</style>

      <DesktopNav companyName={companyName} active="Training Library" />

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px" }}>

        {/* Header â Spec Â§14.2: "Log Group Session" alongside "Create Training" as top-level actions */}
        <div className="anim" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: C.ink }}>Training Library</h1>
            <p style={{ fontSize: ".85rem", color: C.mist, marginTop: 3 }}>{SEED_LIBRARY.length} trainings Â· all sites</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {/* Spec Â§14.2: Log Group Session is top-level secondary action â not buried in a record */}
            {canLogSession && (
              <button className="session-btn" onClick={onLogGroupSession} style={{
                padding: "9px 18px", background: C.white, color: C.pine,
                border: `1.5px solid ${C.mint}`, borderRadius: 7,
                fontFamily: "'DM Sans', sans-serif", fontSize: ".88rem", fontWeight: 600,
                cursor: "pointer", transition: "all .15s",
              }}>ð¥ Log group session</button>
            )}
            <button className="create-btn" onClick={onCreateTraining} style={{
              padding: "9px 18px", background: C.sage, color: C.white,
              border: "none", borderRadius: 7,
              fontFamily: "'DM Sans', sans-serif", fontSize: ".88rem", fontWeight: 600,
              cursor: "pointer", transition: "all .15s",
            }}>+ Create training</button>
          </div>
        </div>

        {/* Filters */}
        <div className="anim" style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <div style={{ position: "relative" }}>
            <input value={search} onChange={e => setSearch(e.target.value)}
              onFocus={() => setSfocused(true)} onBlur={() => setSfocused(false)}
              placeholder="Search trainingsâ¦"
              style={{ padding: "8px 12px 8px 30px", width: 220, border: `1.5px solid ${sfocused ? C.sage : "#D0DEDB"}`, borderRadius: 7, fontFamily: "'DM Sans', sans-serif", fontSize: ".83rem", color: C.ink, background: C.white, outline: "none", boxShadow: sfocused ? `0 0 0 3px rgba(74,140,92,.12)` : "none", transition: "all .18s" }} />
            <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", fontSize: ".78rem", color: C.mist, pointerEvents: "none" }}>ð</span>
          </div>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{
            padding: "8px 28px 8px 10px", border: "1.5px solid #D0DEDB", borderRadius: 7,
            fontFamily: "'DM Sans', sans-serif", fontSize: ".83rem",
            color: filterType ? C.ink : C.mist, background: C.white, outline: "none",
            cursor: "pointer", appearance: "none",
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%238FA3A0'/%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center",
          }}>
            <option value="">All types</option>
            <option value="cbt">CBT</option>
            <option value="in_person">In-person</option>
          </select>
        </div>

        {/* Library table */}
        <div className="anim" style={{ background: C.white, borderRadius: 10, boxShadow: "0 2px 12px rgba(15,31,23,.07)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Training", "Type", "Groups", "Recurrence", "Completions", "Overdue", ""].map((h, i) => (
                  <th key={i} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, ri) => (
                <tr key={t.id} className="lib-row" onClick={() => onViewTraining?.(t.id)}>
                  <td style={{ padding: "12px 14px", borderBottom: "1px solid #F0F4F2" }}>
                    <div style={{ fontWeight: 600, fontSize: ".88rem", color: C.ink }}>{t.title}</div>
                    <div style={{ fontSize: ".72rem", color: C.mist, marginTop: 2 }}>v{t.version}</div>
                  </td>
                  <td style={{ padding: "12px 14px", borderBottom: "1px solid #F0F4F2" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: ".8rem", fontWeight: 600, color: TYPE_COLOR[t.type] }}>
                      {TYPE_EMOJI[t.type]} {TYPE_LABEL[t.type]}
                    </span>
                  </td>
                  <td style={{ padding: "12px 14px", borderBottom: "1px solid #F0F4F2", fontSize: ".8rem", color: C.slate }}>
                    {t.groups.slice(0, 2).join(", ")}{t.groups.length > 2 ? ` +${t.groups.length - 2}` : ""}
                  </td>
                  <td style={{ padding: "12px 14px", borderBottom: "1px solid #F0F4F2", fontSize: ".82rem", color: C.slate, whiteSpace: "nowrap" }}>
                    Every {t.recurrence} months
                  </td>
                  <td style={{ padding: "12px 14px", borderBottom: "1px solid #F0F4F2" }}>
                    <span style={{ fontSize: ".88rem", fontWeight: 600, color: C.pine }}>{t.completions}</span>
                    {t.passThreshold && <span style={{ fontSize: ".7rem", color: C.mist, marginLeft: 4 }}>pass â¥{t.passThreshold}%</span>}
                  </td>
                  <td style={{ padding: "12px 14px", borderBottom: "1px solid #F0F4F2" }}>
                    {t.overdue > 0
                      ? <span style={{ fontWeight: 600, color: C.red, fontSize: ".88rem" }}>{t.overdue}</span>
                      : <span style={{ color: C.mist, fontSize: ".82rem" }}>â</span>
                    }
                  </td>
                  <td style={{ padding: "12px 14px", borderBottom: "1px solid #F0F4F2", color: C.mist, fontSize: ".8rem" }}>â</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


// ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
// S4f â Training Record Detail (desktop)
// Spec Â§14.1: expiration derived from recurrence_months; status chips
// ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
export function S4fTrainingDetail({ trainingId, companyName, onBack, userRole = "admin" ,
  onHome,
}) {
  const training = SEED_LIBRARY.find(t => t.id === (trainingId ?? 1)) ?? SEED_LIBRARY[0];
  const [completions, setCompletions] = useState(SEED_COMPLETIONS);

  const canLogSession = ["trainer", "safety", "site_manager", "admin"].includes(userRole);

  // Derive status from completion data (spec Â§14.1)
  function getStatus(comp) {
    if (!comp.passed) return "overdue";
    if (!comp.expiresAt) return "current";
    const exp  = new Date(comp.expiresAt);
    const now  = new Date("2024-06-14");
    const days = (exp - now) / 86400000;
    if (days < 0)  return "expired";
    if (days <= 30)return "expiring_soon";
    return "current";
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
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .anim { animation: fadeUp .25s ease both; }
        .session-btn:hover { background: ${C.foam} !important; }
      `}</style>

      <DesktopNav companyName={companyName} active="Training Detail" />

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "28px 24px" }}>

        {/* Breadcrumb */}
        <div className="anim" style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <button onClick={onBack} style={{ background: "none", border: "none", color: C.mist, fontSize: ".82rem", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>â Library</button>
            <span style={{ color: "#D0DEDB" }}>/</span>
            <span style={{ fontSize: ".82rem", color: C.ink }}>{training.title}</span>
          </div>

          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
            <div>
              <h1 style={{ fontSize: "1.35rem", fontWeight: 700, color: C.ink, marginBottom: 8 }}>{training.title}</h1>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: ".82rem", fontWeight: 600, color: TYPE_COLOR[training.type] }}>
                  {TYPE_EMOJI[training.type]} {TYPE_LABEL[training.type]}
                </span>
                {pill(`v${training.version}`, "#EEF1F0", C.slate)}
                {pill(`Recurs every ${training.recurrence} months`, C.foam, C.pine)}
                {training.passThreshold && pill(`Pass â¥${training.passThreshold}%`, C.purpleLt, C.purple)}
              </div>
            </div>
            {canLogSession && (
              <button className="session-btn" onClick={() => {}} style={{
                padding: "9px 18px", background: C.white, color: C.pine,
                border: `1.5px solid ${C.mint}`, borderRadius: 7,
                fontFamily: "'DM Sans', sans-serif", fontSize: ".85rem", fontWeight: 600,
                cursor: "pointer", transition: "all .15s", flexShrink: 0,
              }}>ð¥ Log group session</button>
            )}
          </div>
        </div>

        {/* Training info grid */}
        <div className="anim" style={{ background: C.white, borderRadius: 10, boxShadow: "0 2px 12px rgba(15,31,23,.07)", padding: 22, marginBottom: 18 }}>
          <h2 style={{ fontSize: ".95rem", fontWeight: 600, color: C.ink, marginBottom: 14 }}>Training settings</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
            {[
              { label: "Assigned groups",     value: training.groups.join(", ")                  },
              { label: "Recurrence",          value: `Every ${training.recurrence} months`        },
              { label: "Expiration",          value: `${training.recurrence} months after completion` },
              { label: "Pass threshold",      value: training.passThreshold ? `${training.passThreshold}%` : "N/A (in-person)" },
            ].map((row, i) => (
              <div key={i}>
                <div style={{ fontSize: ".7rem", fontWeight: 600, color: C.mist, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 3 }}>{row.label}</div>
                <div style={{ fontSize: ".88rem", color: C.ink }}>{row.value}</div>
              </div>
            ))}
          </div>
          {/* Spec Â§14.1: expiration note */}
          <div style={{ marginTop: 14, padding: "10px 14px", background: C.foam, borderLeft: `3px solid ${C.sage}`, borderRadius: 7, fontSize: ".8rem", color: C.pine, lineHeight: 1.5 }}>
            Expiration is derived from the recurrence interval. When a completion is recorded, <code>expires_at</code> is set to <code>completed_at + {training.recurrence} months</code>. Trainings with no recurrence never expire.
          </div>
        </div>

        {/* Completion history */}
        <div className="anim" style={{ background: C.white, borderRadius: 10, boxShadow: "0 2px 12px rgba(15,31,23,.07)", overflow: "hidden" }}>
          <div style={{ padding: "16px 18px", borderBottom: "1px solid #E2EBE6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h2 style={{ fontSize: ".95rem", fontWeight: 600, color: C.ink }}>Completion history</h2>
              <p style={{ fontSize: ".75rem", color: C.mist, marginTop: 2 }}>{completions.length} records</p>
            </div>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Staff member", "Site", "Completed", "Score", "Status", "Expires", "Trainer / Session"].map((h, i) => (
                  <th key={i} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {completions.map((comp, i) => {
                const status = getStatus(comp);
                const s = STATUS[status] ?? STATUS.current;
                return (
                  <tr key={comp.id}>
                    <td style={{ padding: "10px 14px", borderBottom: "1px solid #F0F4F2", fontWeight: 600, fontSize: ".88rem", color: C.ink }}>{comp.staffName}</td>
                    <td style={{ padding: "10px 14px", borderBottom: "1px solid #F0F4F2", fontSize: ".82rem", color: C.slate }}>{comp.site}</td>
                    <td style={{ padding: "10px 14px", borderBottom: "1px solid #F0F4F2", fontSize: ".82rem", color: C.slate, whiteSpace: "nowrap" }}>{comp.completedAt}</td>
                    <td style={{ padding: "10px 14px", borderBottom: "1px solid #F0F4F2", fontSize: ".82rem" }}>
                      {comp.score !== null
                        ? <span style={{ color: comp.passed ? C.pine : C.red, fontWeight: 600 }}>{comp.score}% {comp.passed ? "â" : "â"}</span>
                        : <span style={{ color: C.mist }}>N/A</span>
                      }
                    </td>
                    <td style={{ padding: "10px 14px", borderBottom: "1px solid #F0F4F2" }}>
                      <span style={{ padding: "2px 9px", borderRadius: 20, fontSize: ".68rem", fontWeight: 600, background: s.bg, color: s.color }}>{s.label}</span>
                    </td>
                    <td style={{ padding: "10px 14px", borderBottom: "1px solid #F0F4F2", fontSize: ".8rem", color: comp.expiresAt ? C.slate : C.mist, whiteSpace: "nowrap" }}>
                      {comp.expiresAt ?? "â"}
                    </td>
                    <td style={{ padding: "10px 14px", borderBottom: "1px solid #F0F4F2", fontSize: ".78rem", color: C.mist }}>
                      {comp.sessionId
                        ? <span style={{ fontFamily: "'DM Mono', monospace", fontSize: ".72rem", color: C.sage }}>{comp.sessionId}</span>
                        : comp.trainerName ?? "â"
                      }
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
}
