import { useState, useRef } from "react";
import { EHSHeader } from "./AppShell.jsx";
import { BRAND, SITES } from "./constants.js";

// ââ Design tokens ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
const C = {
  forest: "#1C3A2A", pine: "#2D5A3D", sage: "#4A8C5C",
  mint: "#A8D5B5", foam: "#E8F5EC", ink: "#0F1F17",
  slate: "#4A5568", mist: "#8FA3A0", chalk: "#F4F7F5",
  white: "#FFFFFF", gold: "#C8922A", goldLt: "#FDF3E3",
  red: "#C0392B", redLt: "#FDECEA",
};

const STEPS = ["Company", "Sites", "Departments", "Staff", "Training"];

const SEED_MANUAL_GROUPS = [
  { id: 1, name: "Forklift Certified",    emoji: "ð", recurrence: "Annually",   members: 0 },
  { id: 2, name: "Electric Pallet Jack",  emoji: "â¡", recurrence: "Annually",   members: 0 },
];

const RECURRENCE_OPTIONS = ["One-time", "Annually", "Every 6 months", "Quarterly", "Monthly"];

// ââ Shared primitives ââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
function Stepper({ current }) {
  return (
    <div style={{ display: "flex", alignItems: "center", overflowX: "auto", paddingBottom: 4, marginBottom: 32, scrollbarWidth: "none" }}>
      {STEPS.map((label, i) => {
        const state = i < current ? "done" : i === current ? "active" : "pending";
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: ".8rem", fontWeight: 700,
              background: state === "done" ? C.sage : state === "active" ? C.forest : "#E2EBE6",
              color: state === "pending" ? C.mist : C.white,
              boxShadow: state === "active" ? `0 0 0 4px ${C.mint}` : "none",
              transition: "all .2s",
            }}>
              {state === "done" ? "â" : i + 1}
            </div>
            <span style={{
              fontSize: ".75rem", fontWeight: state === "active" ? 700 : 500,
              color: state === "done" ? C.sage : state === "active" ? C.forest : C.slate,
              marginLeft: 8, marginRight: 4, whiteSpace: "nowrap",
            }}>{label}</span>
            {i < STEPS.length - 1 && (
              <div style={{
                flex: 1, height: 2, minWidth: 20, maxWidth: 48,
                background: state === "done" ? C.sage : "#D0DEDB",
                margin: "0 4px", transition: "background .3s",
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ââ Auto-group row âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
function AutoGroupRow({ dept }) {
  return (
    <EHSHeader onHome={onHome} />
  );
}

// ââ Manual group row âââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
function ManualGroupRow({ group, onRemove }) {
  return (
    <div style={{
      padding: "12px 16px",
      background: C.goldLt,
      border: "1.5px solid #F0D090",
      borderRadius: 8,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      gap: 12,
      animation: "fadeUp .2s ease both",
    }}>
      <div>
        <div style={{ fontSize: ".88rem", fontWeight: 600, color: C.ink }}>
          {group.emoji} {group.name}
        </div>
        <div style={{ fontSize: ".75rem", color: C.mist, marginTop: 2 }}>
          Manual Â· {group.members} member{group.members !== 1 ? "s" : ""} Â· recurs {group.recurrence.toLowerCase()}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{
          display: "inline-flex", alignItems: "center",
          padding: "2px 10px", borderRadius: 20,
          fontSize: ".68rem", fontWeight: 600,
          background: C.goldLt, color: C.gold,
          border: `1px solid #E8C87A`,
          flexShrink: 0,
        }}>Manual</span>
        <button
          onClick={() => onRemove(group.id)}
          title="Remove"
          style={{
            background: "none", border: "none", color: C.mist,
            cursor: "pointer", fontSize: ".95rem", padding: "2px 4px",
            borderRadius: 4, transition: "color .15s",
          }}
        >Ã</button>
      </div>
    </div>
  );
}

// ââ Add manual group inline form âââââââââââââââââââââââââââââââââââââââââââââ
function AddGroupForm({ onAdd, onClose }) {
  const EMOJIS = ["ð","â¡","ð§¯","ð","ð·","ð¥","ð¬","âï¸","ð¡","ð"];
  const [name,       setName]       = useState("");
  const [recurrence, setRecurrence] = useState("Annually");
  const [emoji,      setEmoji]      = useState("ð·");
  const [nameErr,    setNameErr]    = useState("");
  const [focused,    setFocused]    = useState(false);

  function handleSubmit() {
    if (!name.trim()) { setNameErr("Group name is required."); return; }
    onAdd({ name: name.trim(), emoji, recurrence, members: 0 });
  }

  return (
    <div style={{
      padding: 16,
      background: C.white,
      border: `1.5px solid ${C.sage}`,
      borderRadius: 8,
      animation: "fadeUp .18s ease both",
    }}>
      <div style={{ fontSize: ".82rem", fontWeight: 600, color: C.pine, marginBottom: 12 }}>New manual group</div>

      {/* Emoji picker row */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {EMOJIS.map(e => (
          <div
            key={e}
            onClick={() => setEmoji(e)}
            style={{
              width: 30, height: 30,
              display: "flex", alignItems: "center", justifyContent: "center",
              borderRadius: 6, fontSize: "1rem", cursor: "pointer",
              background: emoji === e ? C.foam : "none",
              border: `1.5px solid ${emoji === e ? C.sage : "#E2EBE6"}`,
              transition: "all .12s",
            }}
          >{e}</div>
        ))}
      </div>

      <div style={{ marginBottom: 10 }}>
        <input
          value={name}
          onChange={e => { setName(e.target.value); setNameErr(""); }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="e.g. LOTO Certified, First Aid, Bottling Machine"
          onKeyDown={e => e.key === "Enter" && handleSubmit()}
          style={{
            width: "100%", padding: "8px 12px",
            border: `1.5px solid ${nameErr ? C.red : focused ? C.sage : "#D0DEDB"}`,
            borderRadius: 7, fontFamily: "'DM Sans', sans-serif",
            fontSize: ".85rem", color: C.ink, background: C.white, outline: "none",
            boxShadow: focused ? `0 0 0 3px rgba(74,140,92,.12)` : "none",
            transition: "all .18s",
          }}
        />
        {nameErr && <div style={{ fontSize: ".72rem", color: C.red, marginTop: 3 }}>â  {nameErr}</div>}
      </div>

      <div style={{ marginBottom: 14 }}>
        <select
          value={recurrence}
          onChange={e => setRecurrence(e.target.value)}
          style={{
            width: "100%", padding: "8px 12px",
            border: "1.5px solid #D0DEDB", borderRadius: 7,
            fontFamily: "'DM Sans', sans-serif", fontSize: ".85rem",
            color: C.ink, background: C.white, outline: "none",
            cursor: "pointer", appearance: "none",
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%238FA3A0'/%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", paddingRight: 32,
          }}
        >
          {RECURRENCE_OPTIONS.map(o => <option key={o}>{o}</option>)}
        </select>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={handleSubmit}
          style={{
            flex: 1, padding: "8px",
            background: C.sage, color: C.white,
            border: "none", borderRadius: 6,
            fontFamily: "'DM Sans', sans-serif", fontSize: ".82rem", fontWeight: 600,
            cursor: "pointer",
          }}
        >Add group</button>
        <button
          onClick={onClose}
          style={{
            padding: "8px 14px", background: "none",
            color: C.slate, border: "1px solid #D0DEDB",
            borderRadius: 6, fontFamily: "'DM Sans', sans-serif",
            fontSize: ".82rem", cursor: "pointer",
          }}
        >Cancel</button>
      </div>
    </div>
  );
}

// ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
// S1b5 â Training Groups
// ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
export function S1b5TrainingGroups({ departments = [], onContinue, onBack ,
  onHome,
}) {
  const [manualGroups, setManualGroups] = useState(SEED_MANUAL_GROUPS.map(g => ({ ...g })));
  const [adding,       setAdding]       = useState(false);
  const nextId = useRef(SEED_MANUAL_GROUPS.length + 1);

  // Default dept list if none passed from flow
  const deptList = departments.length > 0 ? departments : [
    { id: 1, emoji: "ð­", name: "Bottling & Packaging" },
    { id: 2, emoji: "ð¦", name: "Warehouse" },
    { id: 3, emoji: "âï¸", name: "Production / Distilling" },
    { id: 4, emoji: "ð§", name: "Maintenance" },
    { id: 5, emoji: "ð¬", name: "Quality Control" },
    { id: 6, emoji: "ð¥", name: "Tasting Room / Hospitality" },
    { id: 7, emoji: "ð",  name: "Administration" },
  ];

  const visibleDepts = deptList.slice(0, 4);
  const hiddenCount  = deptList.length - 4;

  function handleAddGroup(group) {
    setManualGroups(g => [...g, { ...group, id: nextId.current++ }]);
    setAdding(false);
  }

  function handleRemoveGroup(id) {
    setManualGroups(g => g.filter(x => x.id !== id));
  }

  return (
    <div style={{ minHeight: "100vh", background: C.chalk, fontFamily: "'DM Sans', sans-serif", paddingBottom: 80 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input::placeholder { color: ${C.mist}; }
        @keyframes fadeUp  { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .anim { animation: fadeUp .28s cubic-bezier(.4,0,.2,1) both; }
        .btn-primary-hover:hover { background: ${C.pine} !important; transform: translateY(-1px); box-shadow: 0 4px 14px rgba(45,90,61,.3); }
        .btn-ghost-hover:hover   { color: ${C.pine} !important; background: ${C.foam} !important; }
        .remove-btn:hover { color: ${C.red} !important; }
        .add-group-tile:hover { background: ${C.foam} !important; border-color: ${C.sage} !important; }
        .split { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }
        @media (max-width: 700px) { .split { grid-template-columns: 1fr; } }
      `}</style>

      {/* Top nav */}
      <div style={{
        height: 56, background: C.forest,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 28px", boxShadow: "0 2px 12px rgba(0,0,0,.2)",
      }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: ".95rem", fontWeight: 500, color: C.mint, letterSpacing: ".06em" }}>
          <span style={{ color: C.white }}>EHS</span>platform
        </div>
        <div style={{ fontSize: ".75rem", color: C.mist, background: "rgba(255,255,255,.08)", padding: "3px 10px", borderRadius: 20 }}>
          New account setup
        </div>
      </div>

      <div style={{ maxWidth: 980, margin: "0 auto", padding: "32px 24px 20px" }}>

        <div className="anim" style={{ animationDelay: "0ms" }}>
          <Stepper current={4} />
        </div>

        <div className="anim" style={{ marginBottom: 20, animationDelay: "30ms" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, color: C.ink }}>Review training groups</h1>
          <p style={{ fontSize: ".9rem", color: C.slate, marginTop: 4, lineHeight: 1.5 }}>
            Groups were created automatically from your departments. Add manual groups for specific certifications or roles.
          </p>
        </div>

        {/* Info alert */}
        <div className="anim" style={{
          display: "flex", gap: 12, alignItems: "flex-start",
          padding: "13px 16px", background: C.foam,
          borderLeft: `3px solid ${C.sage}`, borderRadius: 8,
          fontSize: ".87rem", color: C.pine, lineHeight: 1.5,
          marginBottom: 16, animationDelay: "50ms",
        }}>
          <span style={{ flexShrink: 0, marginTop: 1 }}>ð¡</span>
          <span>
            <strong>Auto-groups</strong> are linked to departments â staff added to a dept are automatically enrolled.{" "}
            <strong>Manual groups</strong> let you assign specific training to individuals regardless of department.
          </span>
        </div>

        <div className="split anim" style={{ animationDelay: "70ms" }}>

          {/* ââ Left: auto-groups ââ */}
          <div>
            <div style={{ marginBottom: 12 }}>
              <h2 style={{ fontSize: "1rem", fontWeight: 600, color: C.ink }}>Auto-groups</h2>
              <p style={{ fontSize: ".78rem", color: C.mist, marginTop: 2 }}>One per department â manages itself</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {visibleDepts.map(dept => <AutoGroupRow key={dept.id} dept={dept} />)}
              {hiddenCount > 0 && (
                <div style={{ fontSize: ".78rem", color: C.mist, padding: "4px 4px" }}>
                  + {hiddenCount} more auto-group{hiddenCount > 1 ? "s" : ""}
                </div>
              )}
            </div>
          </div>

          {/* ââ Right: manual groups ââ */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div>
                <h2 style={{ fontSize: "1rem", fontWeight: 600, color: C.ink }}>Manual groups</h2>
                <p style={{ fontSize: ".78rem", color: C.mist, marginTop: 2 }}>For certifications, equipment, or cross-dept roles</p>
              </div>
              {!adding && (
                <button
                  onClick={() => setAdding(true)}
                  style={{
                    padding: "6px 14px", background: C.white, color: C.pine,
                    border: `1.5px solid ${C.mint}`, borderRadius: 6,
                    fontFamily: "'DM Sans', sans-serif", fontSize: ".78rem", fontWeight: 600,
                    cursor: "pointer",
                  }}
                >+ New group</button>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {manualGroups.map(g => (
                <ManualGroupRow key={g.id} group={g} onRemove={handleRemoveGroup} />
              ))}

              {adding ? (
                <AddGroupForm onAdd={handleAddGroup} onClose={() => setAdding(false)} />
              ) : (
                <div
                  className="add-group-tile"
                  onClick={() => setAdding(true)}
                  style={{
                    padding: "14px 16px",
                    background: C.chalk,
                    border: "2px dashed #D0DEDB",
                    borderRadius: 8, textAlign: "center",
                    cursor: "pointer", transition: "all .15s",
                  }}
                >
                  <div style={{ fontSize: ".85rem", color: C.sage, fontWeight: 500 }}>+ Add a manual group</div>
                  <div style={{ fontSize: ".75rem", color: C.mist, marginTop: 3 }}>e.g. Bottling Machine, LOTO, First Aid</div>
                </div>
              )}
            </div>

            <div style={{ height: 1, background: "#E8EFec", margin: "18px 0" }} />

            {/* Gold advisory alert */}
            <div style={{
              display: "flex", gap: 12, alignItems: "flex-start",
              padding: "13px 16px", background: C.goldLt,
              borderLeft: `3px solid ${C.gold}`, borderRadius: 8,
              fontSize: ".87rem", color: "#7A5A1A", lineHeight: 1.5,
            }}>
              <span style={{ flexShrink: 0, marginTop: 1 }}>ð</span>
              <span>You'll assign actual training content to these groups in the Training module. For now, just make sure the right groups exist.</span>
            </div>
          </div>
        </div>

        {/* Annotation */}
        <div className="anim" style={{
          marginTop: 16,
          position: "relative", padding: "10px 14px 10px 36px",
          background: "#FFF8E7", border: "1px dashed #E8C87A",
          borderRadius: 7, fontSize: ".78rem", color: "#7A5A1A", lineHeight: 1.5,
          animationDelay: "90ms",
        }}>
          <span style={{ position: "absolute", left: 10, top: 10, fontSize: ".85rem" }}>âï¸</span>
          UX NOTE: Intentionally lightweight â no training content to build yet. The point is confirming the group structure exists.
          "You'll assign content later" messaging removes anxiety about leaving this incomplete.
        </div>
      </div>

      {/* Action bar */}
      <div style={{
        position: "fixed", bottom: 68, left: 0, right: 0,
        background: C.white, borderTop: "1px solid #E2EBE6",
        padding: "14px 28px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        zIndex: 50, boxShadow: "0 -4px 20px rgba(0,0,0,.06)",
      }}>
        <button
          className="btn-ghost-hover"
          onClick={onBack}
          style={{
            padding: "10px 16px", background: "none", color: C.slate,
            border: "none", borderRadius: 7, fontFamily: "'DM Sans', sans-serif",
            fontSize: ".88rem", fontWeight: 600, cursor: "pointer", transition: "all .18s",
          }}
        >â Back</button>
        <button
          className="btn-primary-hover"
          onClick={() => onContinue && onContinue({ manualGroups })}
          style={{
            padding: "10px 24px", background: C.sage, color: C.white,
            border: "none", borderRadius: 7, fontFamily: "'DM Sans', sans-serif",
            fontSize: ".88rem", fontWeight: 600, cursor: "pointer", transition: "all .18s",
          }}
        >Finish setup â</button>
      </div>
    </div>
  );
}


// ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
// S1b6 â Setup Complete
// ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
export function S1b6SetupComplete({
  companyName  = "WhistlePig Whiskey",
  industry     = "Spirits / Distilling",
  sites        = ["Moriah", "Middlebury", "Shoreham", "Brandenburg"],
  departments  = [],
  staff        = [],
  onOrgChart,
  onLogIncident,
  onStartInspection,
  onDashboard,
  onResumeStaff,

  onHome,
}) {
  const deptCount  = departments.length || 7;
  const staffCount = staff.length || 6;
  const siteList   = sites.slice(0, 3).join(", ") + (sites.length > 3 ? ` + ${sites.length - 3} more` : "");
  const deptPreview = departments.length > 0
    ? departments.slice(0, 3).map(d => d.name).join(", ") + (departments.length > 3 ? ` + ${departments.length - 3} more` : "")
    : "Bottling, Warehouse, Production, Maintenance + 3 more";

  // Compute progress: 3 done (company, sites, depts), staff partial, training pending
  const progress = Math.round(((3 + (staffCount > 0 ? 0.5 : 0)) / 5) * 100);

  const checklist = [
    {
      state: "done",
      label: "Company profile",
      detail: `${companyName} Â· ${industry}`,
    },
    {
      state: "done",
      label: `${sites.length} site${sites.length !== 1 ? "s" : ""} configured`,
      detail: siteList,
    },
    {
      state: "done",
      label: `${deptCount} department${deptCount !== 1 ? "s" : ""} set up`,
      detail: deptPreview,
    },
    {
      state: "current",
      label: `Staff â ${staffCount} of ~42 added`,
      detail: "Finish adding staff or import via CSV",
      action: onResumeStaff,
      actionLabel: "Continue",
    },
    {
      state: "pending",
      label: "Assign training content",
      detail: "Build or upload CBT modules for each group",
    },
    {
      state: "pending",
      label: "Assign site managers",
      detail: `${Math.max(0, sites.length - 2)} of ${sites.length} sites need a manager assigned`,
    },
  ];

  const navActions = [
    { label: "View org chart",       primary: true,   onClick: onOrgChart },
    { label: "Log your first incident", primary: false, onClick: onLogIncident },
    { label: "Start an inspection",  primary: false,  onClick: onStartInspection },
    { label: "Go to dashboard",      ghost: true,     onClick: onDashboard },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.chalk, fontFamily: "'DM Sans', sans-serif", paddingBottom: 60 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp   { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        @keyframes popIn    { 0% { transform:scale(.7); opacity:0; } 60% { transform:scale(1.15); } 100% { transform:scale(1); opacity:1; } }
        @keyframes fillBar  { from { width:0; } to { width:${progress}%; } }
        .anim  { animation: fadeUp .3s cubic-bezier(.4,0,.2,1) both; }
        .emoji-pop { animation: popIn .5s cubic-bezier(.4,0,.2,1) .1s both; display:inline-block; }
        .progress-fill { animation: fillBar .8s cubic-bezier(.4,0,.2,1) .3s both; }
        .nav-btn-primary:hover { background: ${C.pine} !important; transform: translateY(-1px); box-shadow: 0 4px 14px rgba(45,90,61,.3); }
        .nav-btn-secondary:hover { background: ${C.foam} !important; }
        .nav-btn-ghost:hover { color: ${C.pine} !important; background: ${C.foam} !important; }
        .resume-btn:hover { background: ${C.foam} !important; }
      `}</style>

      {/* Top nav */}
      <div style={{
        height: 56, background: C.forest,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 28px", boxShadow: "0 2px 12px rgba(0,0,0,.2)",
      }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: ".95rem", fontWeight: 500, color: C.mint, letterSpacing: ".06em" }}>
          <span style={{ color: C.white }}>EHS</span>platform
        </div>
        <div style={{ fontSize: ".75rem", color: C.mist, background: "rgba(255,255,255,.08)", padding: "3px 10px", borderRadius: 20 }}>
          Setup complete
        </div>
      </div>

      <div style={{ maxWidth: 560, margin: "0 auto", padding: "32px 24px 40px" }}>

        {/* Hero */}
        <div className="anim" style={{ textAlign: "center", padding: "24px 0 32px", animationDelay: "0ms" }}>
          <div className="emoji-pop" style={{ fontSize: "3rem", marginBottom: 12, display: "block" }}>ð</div>
          <h1 style={{ fontSize: "1.65rem", fontWeight: 700, color: C.forest }}>
            {companyName} is set up!
          </h1>
          <p style={{ color: C.slate, marginTop: 8, lineHeight: 1.6, fontSize: ".92rem" }}>
            Your org structure is ready. Here's where things stand and what to do next.
          </p>
        </div>

        {/* Progress + checklist card */}
        <div className="anim" style={{
          background: C.white, borderRadius: 10,
          boxShadow: "0 2px 16px rgba(15,31,23,.08)",
          padding: 24, marginBottom: 14,
          animationDelay: "80ms",
        }}>
          {/* Progress bar */}
          <div style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".8rem", color: C.slate, marginBottom: 6 }}>
              <span>Setup progress</span>
              <span style={{ fontWeight: 600, color: C.sage }}>{progress}%</span>
            </div>
            <div style={{ height: 6, background: "#E2EBE6", borderRadius: 3, overflow: "hidden" }}>
              <div
                className="progress-fill"
                style={{
                  height: "100%", background: C.sage,
                  borderRadius: 3, width: `${progress}%`,
                }}
              />
            </div>
          </div>

          {/* Checklist */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {checklist.map((item, i) => (
              <div
                key={i}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "11px 14px", borderRadius: 8,
                  background: item.state === "done" ? C.foam : item.state === "current" ? C.goldLt : C.chalk,
                  border: item.state === "current" ? `1px solid #F0D090` : "none",
                  animation: `fadeUp .25s ease ${i * 60}ms both`,
                }}
              >
                {/* Icon */}
                <div style={{
                  width: 22, height: 22, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: ".72rem", flexShrink: 0,
                  background: item.state === "done" ? C.sage : item.state === "current" ? C.gold : "#E2EBE6",
                  color: item.state === "pending" ? C.mist : C.white,
                }}>
                  {item.state === "done" ? "â" : item.state === "current" ? "â" : "â"}
                </div>

                {/* Text */}
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: ".88rem", fontWeight: 600,
                    color: item.state === "done" ? C.pine : item.state === "current" ? "#7A5A1A" : C.slate,
                  }}>{item.label}</div>
                  <div style={{
                    fontSize: ".75rem", marginTop: 2,
                    color: item.state === "done" ? C.sage : item.state === "current" ? C.gold : C.mist,
                  }}>{item.detail}</div>
                </div>

                {/* Action button (current items only) */}
                {item.action && (
                  <button
                    className="resume-btn"
                    onClick={item.action}
                    style={{
                      padding: "5px 12px", background: C.white,
                      color: C.pine, border: `1.5px solid ${C.mint}`,
                      borderRadius: 6, fontFamily: "'DM Sans', sans-serif",
                      fontSize: ".75rem", fontWeight: 600,
                      cursor: "pointer", flexShrink: 0, transition: "all .15s",
                    }}
                  >{item.actionLabel}</button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Start using card */}
        <div className="anim" style={{
          background: C.white, borderRadius: 10,
          boxShadow: "0 2px 16px rgba(15,31,23,.08)",
          padding: 24, marginBottom: 14,
          animationDelay: "160ms",
        }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, color: C.ink, marginBottom: 14 }}>Start using the platform</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {navActions.map((action, i) => (
              <button
                key={i}
                className={action.primary ? "nav-btn-primary" : action.ghost ? "nav-btn-ghost" : "nav-btn-secondary"}
                onClick={action.onClick}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "11px 16px",
                  background: action.primary ? C.sage : action.ghost ? "none" : C.white,
                  color: action.primary ? C.white : action.ghost ? C.slate : C.pine,
                  border: action.primary ? "none" : action.ghost ? "none" : `1.5px solid ${C.mint}`,
                  borderRadius: 7, fontFamily: "'DM Sans', sans-serif",
                  fontSize: ".88rem", fontWeight: 600, cursor: "pointer",
                  transition: "all .18s",
                }}
              >
                <span>{action.label}</span>
                <span style={{ opacity: .7 }}>â</span>
              </button>
            ))}
          </div>
        </div>

        {/* Annotation */}
        <div className="anim" style={{
          position: "relative", padding: "10px 14px 10px 36px",
          background: "#FFF8E7", border: "1px dashed #E8C87A",
          borderRadius: 7, fontSize: ".78rem", color: "#7A5A1A", lineHeight: 1.5,
          animationDelay: "200ms",
        }}>
          <span style={{ position: "absolute", left: 10, top: 10, fontSize: ".85rem" }}>âï¸</span>
          UX NOTE: Setup is resumable â the progress checklist is always available from the admin menu.
          No "you must complete setup before using the app" gate. Users can start logging incidents immediately even with an incomplete staff list.
        </div>
      </div>
    </div>
  );
}

// ââ Default export: both screens via internal step state âââââââââââââââââââââ
export default function S1b5and6({
  departments, staff, sites, companyName, industry,
  onBack, onOrgChart, onLogIncident, onStartInspection, onDashboard, onResumeStaff,

  onHome,
}) {
  const [screen, setScreen] = useState("training"); // "training" | "complete"
  const [trainingData, setTrainingData] = useState(null);

  if (screen === "complete") {
    return (
      <S1b6SetupComplete
        companyName={companyName}
        industry={industry}
        sites={sites}
        departments={departments}
        staff={staff}
        onOrgChart={onOrgChart}
        onLogIncident={onLogIncident}
        onStartInspection={onStartInspection}
        onDashboard={onDashboard}
        onResumeStaff={onResumeStaff}
      />
    );
  }

  return (
    <S1b5TrainingGroups
      departments={departments}
      onBack={onBack}
      onContinue={data => { setTrainingData(data); setScreen("complete"); }}
    />
  );
}
