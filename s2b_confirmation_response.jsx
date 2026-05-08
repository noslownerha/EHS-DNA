import { useState, useRef } from "react";

const C = {
  forest: "#1C3A2A", pine: "#2D5A3D", sage: "#4A8C5C",
  mint: "#A8D5B5", foam: "#E8F5EC", ink: "#0F1F17",
  slate: "#4A5568", mist: "#8FA3A0", chalk: "#F4F7F5",
  white: "#FFFFFF", gold: "#C8922A", goldLt: "#FDF3E3",
  red: "#C0392B", redLt: "#FDECEA",
};

// Spec §12.6 Part 2: auto-generated CAs from ca_templates based on type + severity
function generateCAs(incidentType, severity) {
  const base = [];
  if (incidentType === "injury") {
    base.push({ id: 1, description: "Complete first aid log entry", assignee: "Site Manager", dueDays: 1,  priority: "high",   auto: true });
    base.push({ id: 2, description: "Review incident with involved worker", assignee: "Department Lead", dueDays: 3, priority: "medium", auto: true });
    if (severity === "significant" || severity === "serious") {
      base.push({ id: 3, description: "Conduct root cause analysis", assignee: "Safety Officer", dueDays: 7, priority: "high", auto: true });
      base.push({ id: 4, description: "Review PPE adequacy for task", assignee: "Safety Officer", dueDays: 5, priority: "medium", auto: true });
    }
    if (severity === "serious") {
      base.push({ id: 5, description: "Notify OSHA if recordable (within 24hrs for hospitalization)", assignee: "Company Admin", dueDays: 1, priority: "high", auto: true });
    }
  }
  if (incidentType === "near_miss") {
    base.push({ id: 1, description: "Document near-miss in safety log", assignee: "Safety Officer", dueDays: 1, priority: "medium", auto: true });
    base.push({ id: 2, description: "Identify and eliminate hazard", assignee: "Site Manager", dueDays: 3, priority: "high", auto: true });
  }
  if (incidentType === "property") {
    base.push({ id: 1, description: "Assess and document property damage", assignee: "Site Manager", dueDays: 1, priority: "medium", auto: true });
    base.push({ id: 2, description: "Obtain repair estimates", assignee: "Site Manager", dueDays: 5, priority: "low", auto: true });
  }
  if (base.length === 0) {
    base.push({ id: 1, description: "Review incident and assign corrective actions", assignee: "Site Manager", dueDays: 3, priority: "medium", auto: true });
  }
  return base.map(ca => ({
    ...ca,
    dueDate: new Date(Date.now() + ca.dueDays * 86400000).toLocaleDateString([], { month: "short", day: "numeric" }),
  }));
}

// Spec §12.6 Part 3: customer-configurable response checklist steps
const DEFAULT_CHECKLIST = [
  "Complete first aid log",
  "Notify shift supervisor",
  "Preserve scene — don't move anything until photos are done",
  "Secure the area if hazard still present",
  "Check in with the injured person within 24 hours",
];

function PriorityBadge({ priority }) {
  const map = {
    high:   { bg: C.redLt,   color: C.red,   label: "High"   },
    medium: { bg: C.goldLt,  color: C.gold,  label: "Medium" },
    low:    { bg: "#EEF1F0", color: C.slate, label: "Low"    },
  };
  const s = map[priority] ?? map.low;
  return (
    <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: ".68rem", fontWeight: 600, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

// ── CA editor row ─────────────────────────────────────────────────────────────
function CARow({ ca, onUpdate, onRemove }) {
  const [editing, setEditing]   = useState(false);
  const [desc,    setDesc]      = useState(ca.description);
  const [focused, setFocused]   = useState(false);

  return (
    <div style={{
      padding: "12px 14px",
      background: C.white,
      border: `1.5px solid ${editing ? C.sage : "#E2EBE6"}`,
      borderRadius: 9, marginBottom: 8,
      transition: "border-color .15s",
    }}>
      {editing ? (
        <div>
          <input
            value={desc}
            onChange={e => setDesc(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={{
              width: "100%", padding: "8px 10px",
              border: `1.5px solid ${focused ? C.sage : "#D0DEDB"}`,
              borderRadius: 6, fontFamily: "'DM Sans', sans-serif",
              fontSize: ".85rem", color: C.ink, outline: "none",
              boxShadow: focused ? `0 0 0 3px rgba(74,140,92,.12)` : "none",
              marginBottom: 10,
            }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { onUpdate({ ...ca, description: desc }); setEditing(false); }}
              style={{ padding: "6px 14px", background: C.sage, color: C.white, border: "none", borderRadius: 6, fontFamily: "'DM Sans', sans-serif", fontSize: ".78rem", fontWeight: 600, cursor: "pointer" }}>
              Save
            </button>
            <button onClick={() => { setDesc(ca.description); setEditing(false); }}
              style={{ padding: "6px 12px", background: "none", color: C.slate, border: "1px solid #D0DEDB", borderRadius: 6, fontFamily: "'DM Sans', sans-serif", fontSize: ".78rem", cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
            <div style={{ fontSize: ".88rem", color: C.ink, lineHeight: 1.4, flex: 1 }}>{ca.description}</div>
            <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
              <button onClick={() => setEditing(true)}
                style={{ background: "none", border: "none", color: C.mist, fontSize: ".72rem", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", padding: "2px 4px" }}>
                Edit
              </button>
              <button onClick={() => onRemove(ca.id)}
                style={{ background: "none", border: "none", color: C.mist, fontSize: ".95rem", cursor: "pointer", padding: "2px 4px" }}>×</button>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <PriorityBadge priority={ca.priority} />
            <span style={{ fontSize: ".72rem", color: C.mist }}>Assign: {ca.assignee}</span>
            <span style={{ fontSize: ".72rem", color: C.mist }}>Due: {ca.dueDate}</span>
            {ca.auto && <span style={{ fontSize: ".65rem", color: C.sage, fontStyle: "italic" }}>auto-suggested</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function S2bConfirmationResponse({
  incidentId   = "INC-2024-0087",
  incidentType = "injury",
  severity     = "significant",
  notified     = ["Dana Kowalski (Site Manager)"],
  timestamp    = new Date(),
  onDone,
  onViewIncident,
}) {
  const [cas,       setCas]      = useState(() => generateCAs(incidentType, severity));
  const [checklist, setChecklist]= useState(DEFAULT_CHECKLIST.map((s, i) => ({ id: i, text: s, done: false })));
  const [newCA,     setNewCA]    = useState("");
  const [caFocused, setCaFocused]= useState(false);
  const [confirmed, setConfirmed]= useState(false);
  const nextId = useRef(cas.length + 1);

  function updateCA(updated) { setCas(cs => cs.map(c => c.id === updated.id ? updated : c)); }
  function removeCA(id)      { setCas(cs => cs.filter(c => c.id !== id)); }

  function addCA() {
    if (!newCA.trim()) return;
    const ca = {
      id: nextId.current++,
      description: newCA.trim(),
      assignee: "—", dueDate: "TBD",
      priority: "medium", auto: false,
    };
    setCas(cs => [...cs, ca]);
    setNewCA("");
  }

  function toggleCheck(id) { setChecklist(cl => cl.map(c => c.id === id ? { ...c, done: !c.done } : c)); }

  function handleConfirmCAs() {
    setConfirmed(true);
  }

  const timeStr = timestamp.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div style={{
      minHeight: "100vh", background: C.chalk,
      fontFamily: "'DM Sans', sans-serif", display: "flex", flexDirection: "column",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp  { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes popIn   { 0% { transform:scale(.85); opacity:0; } 60% { transform:scale(1.05); } 100% { transform:scale(1); opacity:1; } }
        .anim  { animation: fadeUp .25s ease both; }
        .a0    { animation-delay: .0s; }
        .a1    { animation-delay: .1s; }
        .a2    { animation-delay: .2s; }
        .a3    { animation-delay: .3s; }
        input::placeholder { color: ${C.mist}; }
        .check-row:hover { background: ${C.foam} !important; }
        .done-btn:hover { background: ${C.pine} !important; }
      `}</style>

      {/* Top bar */}
      <div style={{ height: 52, background: C.forest, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 20px" }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: ".85rem", color: C.mint, letterSpacing: ".04em" }}><span style={{ color: C.white }}>EHS</span>platform</div>
      </div>

      <div style={{ flex: 1, padding: "16px 20px 80px", overflowY: "auto" }}>

        {/* ── Part 1: Confirmation ── */}
        <div className="anim a0" style={{
          background: C.white, borderRadius: 10,
          boxShadow: "0 1px 8px rgba(15,31,23,.06)",
          padding: "20px 18px", marginBottom: 14, textAlign: "center",
        }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 10, animation: "popIn .4s ease both" }}>✅</div>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: C.pine, marginBottom: 6 }}>
            Incident reported
          </h1>
          <div style={{
            fontFamily: "'DM Mono', monospace", fontSize: ".85rem",
            color: C.sage, fontWeight: 600, marginBottom: 12,
          }}>{incidentId}</div>
          <p style={{ fontSize: ".82rem", color: C.mist, lineHeight: 1.5, marginBottom: 12 }}>
            Submitted {timeStr}
          </p>
          <div style={{ background: C.foam, borderRadius: 8, padding: "10px 12px", textAlign: "left" }}>
            <div style={{ fontSize: ".7rem", fontWeight: 600, color: C.sage, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>Notified</div>
            {notified.map((n, i) => (
              <div key={i} style={{ display: "flex", gap: 6, fontSize: ".82rem", color: C.pine, marginBottom: 2 }}>
                <span>✓</span> {n}
              </div>
            ))}
          </div>
        </div>

        {/* ── Part 2: Corrective actions ── */}
        <div className="anim a1" style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
            <div>
              <h2 style={{ fontSize: "1rem", fontWeight: 600, color: C.ink }}>Corrective actions</h2>
              <p style={{ fontSize: ".75rem", color: C.mist, marginTop: 2 }}>
                Auto-suggested based on incident type. Edit, remove, or add before confirming.
              </p>
            </div>
          </div>

          {cas.map(ca => (
            <CARow key={ca.id} ca={ca} onUpdate={updateCA} onRemove={removeCA} />
          ))}

          {/* Add CA inline */}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <input
              value={newCA}
              onChange={e => setNewCA(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addCA()}
              onFocus={() => setCaFocused(true)}
              onBlur={() => setCaFocused(false)}
              placeholder="Add a corrective action…"
              style={{
                flex: 1, padding: "9px 12px",
                border: `1.5px solid ${caFocused ? C.sage : "#D0DEDB"}`,
                borderRadius: 8, fontFamily: "'DM Sans', sans-serif",
                fontSize: ".85rem", color: C.ink, outline: "none",
                boxShadow: caFocused ? `0 0 0 3px rgba(74,140,92,.12)` : "none",
                transition: "all .18s",
              }}
            />
            <button onClick={addCA} style={{
              padding: "9px 14px", background: C.sage, color: C.white,
              border: "none", borderRadius: 8, fontFamily: "'DM Sans', sans-serif",
              fontSize: ".82rem", fontWeight: 600, cursor: "pointer",
            }}>Add</button>
          </div>

          <button
            onClick={handleConfirmCAs}
            style={{
              width: "100%", marginTop: 12, padding: "12px",
              background: confirmed ? C.sage + "22" : C.sage,
              color: confirmed ? C.pine : C.white,
              border: confirmed ? `1.5px solid ${C.mint}` : "none",
              borderRadius: 8, fontFamily: "'DM Sans', sans-serif",
              fontSize: ".88rem", fontWeight: 600, cursor: "pointer",
              transition: "all .2s",
            }}
          >{confirmed ? "✓ Corrective actions confirmed" : `Confirm ${cas.length} corrective action${cas.length !== 1 ? "s" : ""}`}</button>
        </div>

        {/* ── Part 3: Response checklist ── */}
        <div className="anim a2" style={{ background: C.white, borderRadius: 10, boxShadow: "0 1px 8px rgba(15,31,23,.06)", overflow: "hidden", marginBottom: 14 }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid #F0F4F2" }}>
            <h2 style={{ fontSize: "1rem", fontWeight: 600, color: C.ink }}>Immediate response checklist</h2>
            <p style={{ fontSize: ".75rem", color: C.mist, marginTop: 2 }}>
              Check off steps as you go. Saved as draft — you don't need to finish before leaving.
            </p>
          </div>

          {checklist.map((item, i) => (
            <div
              key={item.id}
              className="check-row"
              onClick={() => toggleCheck(item.id)}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 16px",
                borderBottom: i < checklist.length - 1 ? "1px solid #F0F4F2" : "none",
                cursor: "pointer", transition: "background .12s",
                background: item.done ? C.foam : C.white,
              }}
            >
              <div style={{
                width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                border: `2px solid ${item.done ? C.sage : "#D0DEDB"}`,
                background: item.done ? C.sage : "none",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all .15s",
              }}>
                {item.done && <span style={{ color: C.white, fontSize: ".72rem", fontWeight: 700 }}>✓</span>}
              </div>
              <span style={{
                fontSize: ".87rem", color: item.done ? C.sage : C.ink,
                textDecoration: item.done ? "line-through" : "none",
                lineHeight: 1.4, transition: "all .15s",
              }}>{item.text}</span>
            </div>
          ))}

          <div style={{ padding: "10px 16px", background: C.chalk, fontSize: ".72rem", color: C.mist, textAlign: "center" }}>
            {checklist.filter(c => c.done).length}/{checklist.length} completed · progress auto-saved
          </div>
        </div>

        {/* View full incident button */}
        <div className="anim a3" style={{ display: "flex", gap: 10 }}>
          <button className="done-btn" onClick={onDone} style={{
            flex: 1, padding: "13px", background: C.sage, color: C.white,
            border: "none", borderRadius: 9, fontFamily: "'DM Sans', sans-serif",
            fontSize: ".9rem", fontWeight: 700, cursor: "pointer", transition: "all .18s",
          }}>Done</button>
          <button onClick={onViewIncident} style={{
            padding: "13px 16px", background: C.white, color: C.pine,
            border: `1.5px solid ${C.mint}`, borderRadius: 9,
            fontFamily: "'DM Sans', sans-serif", fontSize: ".9rem", fontWeight: 600,
            cursor: "pointer",
          }}>View report →</button>
        </div>
      </div>
    </div>
  );
}
