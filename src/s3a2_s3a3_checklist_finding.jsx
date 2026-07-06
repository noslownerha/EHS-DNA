import { COLORS } from "./constants.js";
import { useState, useRef } from "react";
import { EHSHeader } from "./AppShell.jsx";

const C = { ...COLORS };

// Severity scale — spec §13.1: Critical/Major/Minor/Noted (not Obs.)
const SEVERITIES = [
  { id: "critical", label: "Critical", color: C.red,    bg: C.redLt,    desc: "Immediate action required" },
  { id: "major",    label: "Major",    color: C.orange, bg: C.orangeLt, desc: "Resolve within 1–3 days"   },
  { id: "minor",    label: "Minor",    color: C.gold,   bg: C.goldLt,   desc: "Requires resolution"        },
  { id: "noted",    label: "Noted",    color: C.slate,  bg: "#EEF1F0",  desc: "Logged for awareness"       },
];

// Seed checklist items
const SEED_ITEMS = [
  { id: 1,  section: "PPE",         text: "All workers wearing hard hats in active zones",            result: null },
  { id: 2,  section: "PPE",         text: "Safety glasses present at all bottling stations",          result: null },
  { id: 3,  section: "PPE",         text: "Cut-resistant gloves available at de-boxing stations",     result: null },
  { id: 4,  section: "Housekeeping",text: "Floor clear of slip/trip hazards",                         result: null },
  { id: 5,  section: "Housekeeping",text: "Wet floor signs in place where applicable",                result: null },
  { id: 6,  section: "Housekeeping",text: "Waste bins not overflowing",                               result: null },
  { id: 7,  section: "Equipment",   text: "Conveyor guards in place and secured",                     result: null },
  { id: 8,  section: "Equipment",   text: "Emergency stop buttons unobstructed and visible",          result: null },
  { id: 9,  section: "Equipment",   text: "Forklift charging area clear of foot traffic",             result: null },
  { id: 10, section: "Fire Safety", text: "Fire extinguishers accessible and not blocked",            result: null },
  { id: 11, section: "Fire Safety", text: "Emergency exit routes clearly marked and unobstructed",   result: null },
];

const ASSIGNEES = ["Site Manager", "Department Lead", "Facility Maintenance", "Safety Officer"];

// ── Due date shortcuts ────────────────────────────────────────────────────────
const DUE_SHORTCUTS = [
  { label: "Today",    days: 0 },
  { label: "Tomorrow", days: 1 },
  { label: "3 days",   days: 3 },
  { label: "1 week",   days: 7 },
];

function dueDateFromShortcut(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

// ── Inline finding form (expands on Fail) ─────────────────────────────────────
// Spec §s3a3: pre-filled from checklist fail; photo + assign only; due shortcuts;
// CapEx toggle in collapsed Additional details; Log & Continue returns to checklist
function InlineFindingForm({ item, onSubmit, onCancel }) {
  const [photo,       setPhoto]    = useState(null);
  const [desc,        setDesc]     = useState(item.text);
  const [severity,    setSeverity] = useState("minor");
  const [assignee,    setAssignee] = useState("Site Manager");
  const [dueShortcut, setDue]      = useState(1);
  const [showCapEx,   setShowCapEx]= useState(false);
  const [capex,       setCapex]    = useState(false);
  const [capexNotes,  setCapexNotes]= useState("");
  const [descFocused, setDescF]    = useState(false);
  const fileRef = useRef(null);

  return (
    <div style={{
      margin: "8px 0 4px",
      background: C.redLt,
      border: `1.5px solid #F5C6C2`,
      borderRadius: 10, padding: 14,
      animation: "slideDown .2s ease both",
    }}>
      <div style={{ fontSize: ".72rem", fontWeight: 600, color: C.red, letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 12 }}>
        Log finding
      </div>

      {/* Photo nudge */}
      <div style={{ marginBottom: 12 }}>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
          onChange={e => e.target.files[0] && setPhoto(e.target.files[0].name)} />
        <button
          onClick={() => fileRef.current?.click()}
          style={{
            width: "100%", padding: "11px",
            background: photo ? C.foam : C.white,
            border: `1.5px dashed ${photo ? C.sage : "#D0DEDB"}`,
            borderRadius: 8, fontFamily: "'DM Sans', sans-serif",
            fontSize: ".85rem", color: photo ? C.pine : C.mist,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
          }}
        >
          <span>📷</span> {photo ? `✓ ${photo}` : "Add photo (recommended)"}
        </button>
      </div>

      {/* Description — pre-filled from item */}
      <div style={{ marginBottom: 12 }}>
        <textarea
          value={desc}
          onChange={e => setDesc(e.target.value)}
          onFocus={() => setDescF(true)}
          onBlur={() => setDescF(false)}
          rows={2}
          style={{
            width: "100%", padding: "8px 10px",
            border: `1.5px solid ${descFocused ? C.sage : "#D0DEDB"}`,
            borderRadius: 7, fontFamily: "'DM Sans', sans-serif",
            fontSize: ".85rem", color: C.ink, outline: "none", resize: "none",
            transition: "all .18s",
          }}
        />
      </div>

      {/* Severity buttons */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: ".68rem", fontWeight: 600, color: C.mist, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>Severity</div>
        <div style={{ display: "flex", gap: 6 }}>
          {SEVERITIES.map(s => (
            <button key={s.id} onClick={() => setSeverity(s.id)} style={{
              flex: 1, padding: "7px 4px",
              background: severity === s.id ? s.bg : C.white,
              border: `1.5px solid ${severity === s.id ? s.color : "#E2EBE6"}`,
              borderRadius: 7, fontFamily: "'DM Sans', sans-serif",
              fontSize: ".72rem", fontWeight: 700,
              color: severity === s.id ? s.color : C.mist,
              cursor: "pointer", transition: "all .12s",
            }}>{s.label}</button>
          ))}
        </div>
      </div>

      {/* Assignee */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: ".68rem", fontWeight: 600, color: C.mist, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>Assign to</div>
        <select value={assignee} onChange={e => setAssignee(e.target.value)} style={{
          width: "100%", padding: "8px 10px",
          border: "1.5px solid #D0DEDB", borderRadius: 7,
          fontFamily: "'DM Sans', sans-serif", fontSize: ".85rem",
          color: C.ink, background: C.white, outline: "none", cursor: "pointer", appearance: "none",
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%238FA3A0'/%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center", paddingRight: 28,
        }}>
          {ASSIGNEES.map(a => <option key={a}>{a}</option>)}
        </select>
      </div>

      {/* Due date shortcuts */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: ".68rem", fontWeight: 600, color: C.mist, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>Due</div>
        <div style={{ display: "flex", gap: 6 }}>
          {DUE_SHORTCUTS.map((s, i) => (
            <button key={i} onClick={() => setDue(s.days)} style={{
              flex: 1, padding: "7px 4px",
              background: dueShortcut === s.days ? C.sage : C.white,
              border: `1.5px solid ${dueShortcut === s.days ? C.sage : "#D0DEDB"}`,
              borderRadius: 7, fontFamily: "'DM Sans', sans-serif",
              fontSize: ".72rem", fontWeight: 600,
              color: dueShortcut === s.days ? C.white : C.slate,
              cursor: "pointer", transition: "all .12s",
            }}>{s.label}</button>
          ))}
        </div>
      </div>

      {/* CapEx — spec §13.2: collapsed "Additional details" section */}
      <div style={{ marginBottom: 14 }}>
        <button
          onClick={() => setShowCapEx(v => !v)}
          style={{
            background: "none", border: "none", padding: "6px 0",
            fontFamily: "'DM Sans', sans-serif", fontSize: ".78rem",
            color: C.mist, cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
          }}
        >
          <span style={{ fontSize: ".7rem" }}>{showCapEx ? "▲" : "▼"}</span>
          Additional details
        </button>

        {showCapEx && (
          <div style={{ padding: "10px 12px", background: C.white, borderRadius: 8, border: "1px solid #E2EBE6" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: capex ? 10 : 0 }}>
              <div>
                <div style={{ fontSize: ".83rem", fontWeight: 600, color: C.ink }}>Requires capital spend (CapEx)</div>
                {/* Spec §13.2: exact toggle subtext */}
                <div style={{ fontSize: ".72rem", color: C.mist, marginTop: 2, lineHeight: 1.4 }}>
                  Excludes this finding from aging metrics while pending budget approval
                </div>
              </div>
              <div onClick={() => setCapex(v => !v)} style={{
                width: 40, height: 22, borderRadius: 22, flexShrink: 0,
                background: capex ? C.navy : "#D0DEDB", cursor: "pointer",
                position: "relative", transition: "background .2s",
              }}>
                <div style={{
                  position: "absolute", width: 16, height: 16, borderRadius: "50%",
                  background: C.white, top: 3, left: capex ? 21 : 3,
                  transition: "left .18s", boxShadow: "0 1px 4px rgba(0,0,0,.2)",
                }} />
              </div>
            </div>
            {capex && (
              <textarea
                value={capexNotes}
                onChange={e => setCapexNotes(e.target.value)}
                placeholder="CapEx notes (optional)"
                rows={2}
                style={{
                  width: "100%", padding: "7px 10px",
                  border: "1.5px solid #D0DEDB", borderRadius: 7,
                  fontFamily: "'DM Sans', sans-serif", fontSize: ".82rem",
                  color: C.ink, outline: "none", resize: "none",
                }}
              />
            )}
          </div>
        )}
      </div>

      {/* Spec: "Log & Continue" returns to checklist */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => onSubmit({ desc, severity, assignee, dueDate: dueDateFromShortcut(dueShortcut), photo, capex, capexNotes })}
          style={{
            flex: 1, padding: "11px",
            background: C.red, color: C.white,
            border: "none", borderRadius: 8,
            fontFamily: "'DM Sans', sans-serif", fontSize: ".88rem", fontWeight: 700, cursor: "pointer",
          }}
        >Log & continue checklist</button>
        <button onClick={onCancel} style={{
          padding: "11px 14px", background: "none", color: C.slate,
          border: "1px solid #D0DEDB", borderRadius: 8,
          fontFamily: "'DM Sans', sans-serif", fontSize: ".85rem", cursor: "pointer",
        }}>Cancel</button>
      </div>
    </div>
  );
}

// ── Checklist item row ────────────────────────────────────────────────────────
function ChecklistItem({ item, onResult, findings }) {
  const hasFinding = findings.some(f => f.itemId === item.id);

  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{
        display: "flex", alignItems: "flex-start", gap: 10,
        padding: "12px 14px",
        background: item.result === "fail" ? C.redLt : item.result === "pass" ? C.foam : C.white,
        border: `1.5px solid ${item.result === "fail" ? "#F5C6C2" : item.result === "pass" ? C.mint : "#E2EBE6"}`,
        borderRadius: 10, transition: "all .15s",
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: ".88rem", color: C.ink, lineHeight: 1.4, marginBottom: 8 }}>{item.text}</div>

          {/* Pass / Fail / N/A tap buttons */}
          <div style={{ display: "flex", gap: 6 }}>
            {[
              { id: "pass", label: "Pass",color: C.sage,  bg: C.foam   },
              { id: "fail", label: "Fail",color: C.red,   bg: C.redLt  },
              { id: "na",   label: "N/A", color: C.slate, bg: "#EEF1F0"},
            ].map(opt => (
              <button key={opt.id} onClick={() => onResult(item.id, opt.id)} style={{
                padding: "6px 14px",
                background: item.result === opt.id ? opt.bg : C.chalk,
                border: `1.5px solid ${item.result === opt.id ? opt.color : "#D0DEDB"}`,
                borderRadius: 6, fontFamily: "'DM Sans', sans-serif",
                fontSize: ".78rem", fontWeight: item.result === opt.id ? 700 : 500,
                color: item.result === opt.id ? opt.color : C.mist,
                cursor: "pointer", transition: "all .12s",
              }}>{opt.label}</button>
            ))}
          </div>
        </div>

        {/* Status indicators */}
        <div style={{ flexShrink: 0, marginTop: 2 }}>
          {item.result === "pass" && <span style={{ fontSize: "1rem", color: C.sage }}>✓</span>}
          {item.result === "na"   && <span style={{ fontSize: ".8rem", color: C.mist }}>—</span>}
          {hasFinding             && <span style={{ fontSize: ".75rem", background: C.redLt, color: C.red, padding: "1px 6px", borderRadius: 10, fontWeight: 600 }}>Finding logged</span>}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// S3a2 — Checklist in Progress
// ════════════════════════════════════════════════════════════════════════════
export function S3a2ChecklistInProgress({ onHome,
  templateName = "Bottling Line Safety Check",
  site         = "Moriah",
  checklist    = null,   // DB checklist row: { id, name, items: JSON }
  onComplete,
  onBack,
}) {
  const dbItems = checklist
    ? JSON.parse(checklist.items || "[]").map((it, i) => ({
        id: it.id ?? i + 1, section: it.category ?? "Checklist", text: it.label ?? String(it), result: null,
      }))
    : null;
  const [items,    setItems]    = useState(dbItems?.length ? dbItems : SEED_ITEMS);
  const [findings, setFindings] = useState([]);
  const [expandedFail, setExpandedFail] = useState(null); // item id with inline finding form open

  const sections = [...new Set(items.map(i => i.section))];
  const answered = items.filter(i => i.result !== null).length;
  const total    = items.length;
  const pct      = Math.round((answered / total) * 100);
  const failCount = items.filter(i => i.result === "fail").length;
  const passCount = items.filter(i => i.result === "pass").length;
  const naCount   = items.filter(i => i.result === "na").length;
  const nextId    = useRef(1);

  function handleResult(itemId, result) {
    setItems(its => its.map(i => i.id === itemId ? { ...i, result } : i));
    // Spec: Fail expands inline finding form
    if (result === "fail") setExpandedFail(itemId);
    else if (expandedFail === itemId) setExpandedFail(null);
  }

  function handleLogFinding(itemId, data) {
    setFindings(fs => [...fs, { id: nextId.current++, itemId, ...data }]);
    setExpandedFail(null);
  }

  return (
    <div style={{ minHeight: "100vh", background: C.chalk, fontFamily: "'DM Sans', sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp   { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes slideDown{ from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }
        .anim { animation: fadeUp .22s ease both; }
        textarea::placeholder { color: ${C.mist}; }
        .done-btn:hover { background: ${C.pine} !important; }
      `}</style>

      {/* Top bar */}
      <div style={{ background: C.forest, padding: "12px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: C.mint, fontSize: ".85rem", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>← Back</button>
          <div style={{ fontSize: ".78rem", color: "rgba(255,255,255,.6)", textAlign: "center" }}>
            <div style={{ fontWeight: 600, color: C.white }}>{templateName}</div>
            <div>{site}</div>
          </div>
          <div style={{ fontSize: ".78rem", color: C.mint, fontWeight: 600 }}>{answered}/{total}</div>
        </div>

        {/* Progress bar */}
        <div style={{ height: 5, background: "rgba(255,255,255,.15)", borderRadius: 3, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: C.mint, borderRadius: 3, transition: "width .3s ease" }} />
        </div>

        {/* Pass/Fail/NA counts */}
        <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
          {[
            { label: `${passCount} pass`, color: C.mint },
            { label: `${failCount} fail`, color: "#F5C6C2" },
            { label: `${naCount} N/A`,    color: "rgba(255,255,255,.35)" },
          ].map((s, i) => (
            <span key={i} style={{ fontSize: ".72rem", color: s.color, fontWeight: 600 }}>{s.label}</span>
          ))}
          {findings.length > 0 && (
            <span style={{ fontSize: ".72rem", color: "#F5C6C2", fontWeight: 600 }}>· {findings.length} finding{findings.length > 1 ? "s" : ""} logged</span>
          )}
        </div>
      </div>

      <div style={{ flex: 1, padding: "14px 14px 100px", overflowY: "auto" }}>
        {sections.map(section => (
          <div key={section} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: ".72rem", fontWeight: 600, letterSpacing: ".07em", textTransform: "uppercase", color: C.mist, marginBottom: 8, paddingLeft: 2 }}>
              {section}
            </div>
            {items.filter(i => i.section === section).map(item => (
              <div key={item.id}>
                <ChecklistItem item={item} onResult={handleResult} findings={findings} />
                {/* Spec: fail items expand inline — inspector never leaves the checklist */}
                {expandedFail === item.id && (
                  <InlineFindingForm
                    item={item}
                    onSubmit={data => handleLogFinding(item.id, data)}
                    onCancel={() => setExpandedFail(null)}
                  />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div style={{ position: "fixed", bottom: 58, left: 0, right: 0, padding: "14px 18px", background: C.white, borderTop: "1px solid #E2EBE6", boxShadow: "0 -4px 20px rgba(0,0,0,.06)" }}>
        <button
          className="done-btn"
          onClick={() => onComplete?.({ items, findings, passCount, failCount, naCount })}
          style={{
            width: "100%", padding: "14px",
            background: C.sage, color: C.white,
            border: "none", borderRadius: 9,
            fontFamily: "'DM Sans', sans-serif", fontSize: ".95rem", fontWeight: 700,
            cursor: "pointer", transition: "all .18s",
          }}
        >
          {answered === total ? "Complete inspection →" : `Finish early (${total - answered} remaining) →`}
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// S3a3 — Log Finding from Checklist (standalone full-screen version)
// This is the same form but as a full screen when accessed outside a checklist
// ════════════════════════════════════════════════════════════════════════════
export function S3a3LogFinding({ onHome, prefill = {}, onSubmit, onBack }) {
  const [photo,       setPhoto]     = useState(null);
  const [desc,        setDesc]      = useState(prefill.text ?? "");
  const [severity,    setSeverity]  = useState(prefill.severity ?? "minor");
  const [assignee,    setAssignee]  = useState("Site Manager");
  const [dueShortcut, setDue]       = useState(1);
  const [showCapEx,   setShowCapEx] = useState(false);
  const [capex,       setCapex]     = useState(false);
  const [capexNotes,  setCapexNotes]= useState("");
  const [descFocused, setDescF]     = useState(false);
  const fileRef = useRef(null);

  return (
    <div style={{ minHeight: "100vh", background: C.chalk, fontFamily: "'DM Sans', sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        textarea::placeholder { color: ${C.mist}; }
        .submit-btn:hover { background: ${C.pine} !important; }
      `}</style>

      <EHSHeader onHome={onHome} rightContent={<button onClick={onBack} style={{ background: "none", border: "none", color: C.mint, fontSize: ".85rem", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>← Back</button>} />

      <div style={{ flex: 1, padding: "16px 18px 100px", overflowY: "auto" }}>
        <h1 style={{ fontSize: "1.2rem", fontWeight: 700, color: C.ink, marginBottom: 4 }}>Log finding</h1>
        {prefill.section && <p style={{ fontSize: ".8rem", color: C.mist, marginBottom: 16 }}>{prefill.section} · pre-filled from checklist</p>}

        <div style={{ background: C.white, borderRadius: 10, boxShadow: "0 1px 8px rgba(15,31,23,.06)", padding: 16, marginBottom: 14 }}>
          {/* Photo nudge */}
          <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
            onChange={e => e.target.files[0] && setPhoto(e.target.files[0].name)} />
          <button onClick={() => fileRef.current?.click()} style={{
            width: "100%", padding: "14px",
            background: photo ? C.foam : C.chalk,
            border: `2px dashed ${photo ? C.sage : C.mint}`,
            borderRadius: 9, fontFamily: "'DM Sans', sans-serif",
            fontSize: ".9rem", color: photo ? C.pine : C.mist,
            cursor: "pointer", marginBottom: 14,
          }}>
            📷 {photo ? `✓ ${photo}` : "Take or upload photo"}
          </button>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: ".7rem", fontWeight: 600, color: C.sage, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>Description</div>
            <textarea value={desc} onChange={e => setDesc(e.target.value)}
              onFocus={() => setDescF(true)} onBlur={() => setDescF(false)} rows={3}
              placeholder="Describe the finding…"
              style={{ width: "100%", padding: "9px 11px", border: `1.5px solid ${descFocused ? C.sage : "#D0DEDB"}`, borderRadius: 8, fontFamily: "'DM Sans', sans-serif", fontSize: ".9rem", color: C.ink, outline: "none", resize: "none", lineHeight: 1.5, transition: "all .18s" }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: ".7rem", fontWeight: 600, color: C.sage, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>Severity</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(70px, 1fr))", gap: 6 }}>
              {SEVERITIES.map(s => (
                <button key={s.id} onClick={() => setSeverity(s.id)} style={{
                  padding: "9px 4px",
                  background: severity === s.id ? s.bg : C.chalk,
                  border: `1.5px solid ${severity === s.id ? s.color : "#E2EBE6"}`,
                  borderRadius: 8, fontFamily: "'DM Sans', sans-serif",
                  fontSize: ".75rem", fontWeight: 700,
                  color: severity === s.id ? s.color : C.mist,
                  cursor: "pointer", transition: "all .12s",
                  textAlign: "center",
                }}>
                  {s.label}
                  <div style={{ fontSize: ".6rem", fontWeight: 400, marginTop: 2, lineHeight: 1.2, color: severity === s.id ? s.color : C.mist }}>
                    {s.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: ".7rem", fontWeight: 600, color: C.sage, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>Assign to</div>
              <select value={assignee} onChange={e => setAssignee(e.target.value)} style={{ width: "100%", padding: "9px 10px", border: "1.5px solid #D0DEDB", borderRadius: 7, fontFamily: "'DM Sans', sans-serif", fontSize: ".85rem", color: C.ink, background: C.white, outline: "none", cursor: "pointer", appearance: "none" }}>
                {ASSIGNEES.map(a => <option key={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: ".7rem", fontWeight: 600, color: C.sage, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>Due</div>
              <div style={{ display: "flex", gap: 4 }}>
                {DUE_SHORTCUTS.map((s, i) => (
                  <button key={i} onClick={() => setDue(s.days)} style={{
                    flex: 1, padding: "8px 2px",
                    background: dueShortcut === s.days ? C.sage : C.chalk,
                    border: `1.5px solid ${dueShortcut === s.days ? C.sage : "#D0DEDB"}`,
                    borderRadius: 6, fontFamily: "'DM Sans', sans-serif",
                    fontSize: ".68rem", fontWeight: 600,
                    color: dueShortcut === s.days ? C.white : C.slate,
                    cursor: "pointer", transition: "all .12s",
                  }}>{s.label}</button>
                ))}
              </div>
            </div>
          </div>

          {/* CapEx collapsed section */}
          <div>
            <button onClick={() => setShowCapEx(v => !v)} style={{ background: "none", border: "none", padding: "6px 0", fontFamily: "'DM Sans', sans-serif", fontSize: ".78rem", color: C.mist, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ fontSize: ".7rem" }}>{showCapEx ? "▲" : "▼"}</span> Additional details
            </button>
            {showCapEx && (
              <div style={{ padding: "12px", background: C.chalk, borderRadius: 8, marginTop: 6 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: capex ? 10 : 0 }}>
                  <div style={{ flex: 1, marginRight: 12 }}>
                    <div style={{ fontSize: ".85rem", fontWeight: 600, color: C.ink }}>Requires capital spend (CapEx)</div>
                    <div style={{ fontSize: ".72rem", color: C.mist, marginTop: 2 }}>Excludes this finding from aging metrics while pending budget approval</div>
                  </div>
                  <div onClick={() => setCapex(v => !v)} style={{ width: 40, height: 22, borderRadius: 22, background: capex ? C.navy : "#D0DEDB", cursor: "pointer", position: "relative", transition: "background .2s", flexShrink: 0 }}>
                    <div style={{ position: "absolute", width: 16, height: 16, borderRadius: "50%", background: C.white, top: 3, left: capex ? 21 : 3, transition: "left .18s" }} />
                  </div>
                </div>
                {capex && (
                  <textarea value={capexNotes} onChange={e => setCapexNotes(e.target.value)} placeholder="CapEx notes (optional)" rows={2}
                    style={{ width: "100%", padding: "7px 10px", border: "1.5px solid #D0DEDB", borderRadius: 7, fontFamily: "'DM Sans', sans-serif", fontSize: ".82rem", color: C.ink, outline: "none", resize: "none", marginTop: 8 }}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ position: "fixed", bottom: 58, left: 0, right: 0, padding: "14px 18px", background: C.white, borderTop: "1px solid #E2EBE6", boxShadow: "0 -4px 20px rgba(0,0,0,.06)" }}>
        <button className="submit-btn" onClick={() => onSubmit?.({ desc, severity, assignee, dueDate: dueDateFromShortcut(dueShortcut), photo, capex, capexNotes })}
          style={{ width: "100%", padding: "14px", background: C.sage, color: C.white, border: "none", borderRadius: 9, fontFamily: "'DM Sans', sans-serif", fontSize: ".95rem", fontWeight: 700, cursor: "pointer", transition: "all .18s" }}>
          Log finding →
        </button>
      </div>
    </div>
  );
}
