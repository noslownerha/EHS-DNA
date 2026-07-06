import { COLORS } from "./constants.js";
import { useState, useRef } from "react";
import { EHSHeader } from "./AppShell.jsx";

const C = { ...COLORS };

// Spec §13.1: Critical / Major / Minor / Noted (Noted replaces Obs.)
const SEVERITIES = [
  { id: "critical", label: "Critical", color: C.red,    bg: C.redLt    },
  { id: "major",    label: "Major",    color: C.orange, bg: C.orangeLt },
  { id: "minor",    label: "Minor",    color: C.gold,   bg: C.goldLt   },
  { id: "noted",    label: "Noted",    color: C.slate,  bg: "#EEF1F0"  },
];

// Spec §13.4: "Positive Obs." renamed to "Positive Note"
const CATEGORIES = [
  { id: "ppe",            label: "PPE",              emoji: "🦺" },
  { id: "housekeeping",   label: "Housekeeping",     emoji: "🧹" },
  { id: "equipment",      label: "Equipment",        emoji: "⚙️" },
  { id: "fire",           label: "Fire Safety",      emoji: "🔥" },
  { id: "ergonomics",     label: "Ergonomics",       emoji: "💺" },
  { id: "chemical",       label: "Chemical / MSDS",  emoji: "🧪" },
  { id: "documentation",  label: "Documentation",    emoji: "📋" },
  { id: "positive",       label: "Positive Note",    emoji: "⭐" },  // Spec §13.4
  { id: "other",          label: "Other",            emoji: "📌" },
];

const ASSIGNEES = ["Site Manager", "Department Lead", "Facility Maintenance", "Safety Officer"];

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

// ════════════════════════════════════════════════════════════════════════════
// S3a4 — Session Complete
// ════════════════════════════════════════════════════════════════════════════
export function S3a4SessionComplete({ onHome,
  templateName = "Bottling Line Safety Check",
  site         = "Moriah",
  sessionData  = { passCount: 8, failCount: 2, naCount: 1 },
  findings     = [
    { id: 1, desc: "Wet floor near line 2 — no signage",      severity: "minor",    assignee: "Site Manager",  dueDate: "Jun 13" },
    { id: 2, desc: "Safety glasses left on conveyor — unit 3", severity: "noted",    assignee: "Department Lead", dueDate: "Jun 14" },
  ],
  notified     = ["Site manager (per notification rules)"],
  onDone,
  onViewFinding,
}) {
  const total    = sessionData.passCount + sessionData.failCount + sessionData.naCount;
  const score    = total > 0 ? Math.round((sessionData.passCount / (total - sessionData.naCount)) * 100) : 100;
  const scoreColor = score >= 90 ? C.sage : score >= 70 ? C.gold : C.red;

  return (
    <div style={{ minHeight: "100vh", background: C.chalk, fontFamily: "'DM Sans', sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes popIn  { 0%{transform:scale(.8);opacity:0;} 60%{transform:scale(1.1);} 100%{transform:scale(1);opacity:1;} }
        .anim { animation: fadeUp .25s ease both; }
        .done-btn:hover { background: ${C.pine} !important; }
        .finding-row:hover { background: ${C.foam} !important; }
      `}</style>

      <EHSHeader onHome={onHome} />

      <div style={{ flex: 1, padding: "16px 18px 100px", overflowY: "auto" }}>

        {/* Score card */}
        <div className="anim" style={{ background: C.white, borderRadius: 10, boxShadow: "0 1px 8px rgba(15,31,23,.06)", padding: "22px 18px", marginBottom: 14, textAlign: "center" }}>
          <div style={{ fontSize: "2rem", marginBottom: 8, animation: "popIn .4s ease both" }}>
            {score >= 90 ? "✅" : score >= 70 ? "⚠️" : "❌"}
          </div>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: C.ink, marginBottom: 4 }}>Inspection complete</h1>
          <p style={{ fontSize: ".82rem", color: C.mist, marginBottom: 16 }}>{templateName} · {site}</p>

          {/* Score */}
          <div style={{ fontSize: "2.8rem", fontWeight: 700, color: scoreColor, lineHeight: 1, marginBottom: 4 }}>{score}%</div>
          <div style={{ fontSize: ".8rem", color: C.mist, marginBottom: 16 }}>Pass rate</div>

          {/* Counts row */}
          <div style={{ display: "flex", justifyContent: "center", gap: 20 }}>
            {[
              { label: "Pass", value: sessionData.passCount, color: C.sage  },
              { label: "Fail", value: sessionData.failCount, color: C.red   },
              { label: "N/A",  value: sessionData.naCount,   color: C.mist  },
            ].map((s, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ fontSize: "1.4rem", fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: ".72rem", color: C.mist }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Findings logged */}
        {findings.length > 0 && (
          <div className="anim" style={{ background: C.white, borderRadius: 10, boxShadow: "0 1px 8px rgba(15,31,23,.06)", overflow: "hidden", marginBottom: 14 }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #F0F4F2" }}>
              <h2 style={{ fontSize: ".92rem", fontWeight: 600, color: C.ink }}>Findings logged</h2>
              <p style={{ fontSize: ".73rem", color: C.mist, marginTop: 2 }}>
                {findings.length} finding{findings.length > 1 ? "s" : ""} · assigned and due dates set
              </p>
            </div>
            {findings.map((f, i) => {
              const sev = SEVERITIES.find(s => s.id === f.severity) ?? SEVERITIES[3];
              return (
                <div key={f.id} className="finding-row" onClick={() => onViewFinding?.(f.id)} style={{
                  display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 16px",
                  borderBottom: i < findings.length - 1 ? "1px solid #F0F4F2" : "none",
                  cursor: "pointer", transition: "background .12s",
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                      <span style={{ padding: "1px 8px", borderRadius: 20, fontSize: ".67rem", fontWeight: 600, background: sev.bg, color: sev.color }}>{sev.label}</span>
                    </div>
                    <div style={{ fontSize: ".85rem", color: C.ink, lineHeight: 1.3 }}>{f.desc}</div>
                    <div style={{ fontSize: ".72rem", color: C.mist, marginTop: 2 }}>→ {f.assignee} · Due {f.dueDate}</div>
                  </div>
                  <span style={{ color: C.mist, fontSize: ".8rem", flexShrink: 0 }}>→</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Who was notified */}
        <div className="anim" style={{ background: C.white, borderRadius: 10, boxShadow: "0 1px 8px rgba(15,31,23,.06)", padding: "14px 16px" }}>
          <div style={{ fontSize: ".7rem", fontWeight: 600, color: C.sage, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>Notifications sent</div>
          {notified.map((n, i) => (
            <div key={i} style={{ display: "flex", gap: 6, fontSize: ".85rem", color: C.pine, marginBottom: 3 }}>
              <span>✓</span> {n}
            </div>
          ))}
          {findings.length === 0 && (
            <div style={{ fontSize: ".82rem", color: C.mist }}>No findings logged — no notifications sent.</div>
          )}
        </div>
      </div>

      <div style={{ position: "fixed", bottom: 58, left: 0, right: 0, padding: "14px 18px", background: C.white, borderTop: "1px solid #E2EBE6", boxShadow: "0 -4px 20px rgba(0,0,0,.06)" }}>
        <button className="done-btn" onClick={onDone} style={{
          width: "100%", padding: "14px", background: C.sage, color: C.white,
          border: "none", borderRadius: 9, fontFamily: "'DM Sans', sans-serif",
          fontSize: ".95rem", fontWeight: 700, cursor: "pointer", transition: "all .18s",
        }}>Done</button>
      </div>
    </div>
  );
}


// ════════════════════════════════════════════════════════════════════════════
// S3b — Quick Finding (ad-hoc)
// ════════════════════════════════════════════════════════════════════════════
// Spec: category grid, photo-first nudge, description, severity, assign,
// due shortcuts, CapEx toggle in collapsed Additional details. Under 60 seconds.
export function S3bQuickFinding({ onHome,
  site = "Moriah",
  user = { name: "Staff" },
  onSubmit,
  onBack,
}) {
  const [step, setStep]           = useState("category"); // "category" | "details"
  const [category, setCategory]   = useState(null);
  const [photo,    setPhoto]       = useState(null);
  const [desc,     setDesc]        = useState("");
  const [severity, setSeverity]    = useState("minor");
  const [assignee, setAssignee]    = useState("Site Manager");
  const [dueShort, setDueShort]    = useState(1);
  const [showCapEx,setShowCapEx]   = useState(false);
  const [capex,    setCapex]       = useState(false);
  const [capexNotes,setCapexNotes] = useState("");
  const [submitting,setSubmitting] = useState(false);
  const [descFocused,setDescF]     = useState(false);
  const fileRef = useRef(null);

  function handleSubmit() {
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      onSubmit?.({ category, photo, desc, severity, assignee, dueDate: dueDateFromShortcut(dueShort), capex, capexNotes });
    }, 700);
  }

  const catObj = CATEGORIES.find(c => c.id === category);

  return (
    <div style={{ minHeight: "100vh", background: C.chalk, fontFamily: "'DM Sans', sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp   { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin     { to { transform: rotate(360deg); } }
        .anim { animation: fadeUp .22s ease both; }
        textarea::placeholder { color: ${C.mist}; }
        .cat-tile:hover { transform: translateY(-2px); }
        .cat-tile:active { transform: scale(.97); }
        .submit-btn:hover:not(:disabled) { background: ${C.pine} !important; }
      `}</style>

      <EHSHeader onHome={onHome} rightContent={
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: ".72rem", color: "rgba(255,255,255,.4)" }}>{site}</span>
          <button onClick={step === "details" ? () => setStep("category") : onBack}
            style={{ background: "none", border: "none", color: C.mint, fontSize: ".85rem", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>← Back</button>
        </div>
      } />

      {/* Step indicator */}
      <div style={{ display: "flex", gap: 4, padding: "10px 18px 0" }}>
        {["category","details"].map((s, i) => (
          <div key={s} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= ["category","details"].indexOf(step) ? C.sage : "#E2EBE6", transition: "background .3s" }} />
        ))}
      </div>

      <div style={{ flex: 1, padding: "14px 18px 100px", overflowY: "auto" }}>

        {step === "category" ? (
          <>
            <div className="anim" style={{ marginBottom: 18 }}>
              <h1 style={{ fontSize: "1.2rem", fontWeight: 700, color: C.ink }}>Quick finding</h1>
              <p style={{ fontSize: ".85rem", color: C.mist, marginTop: 3 }}>What category is this?</p>
            </div>

            {/* Category grid — spec: photo-first nudge implied by ordering */}
            <div className="anim" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
              {CATEGORIES.map(cat => (
                <div
                  key={cat.id}
                  className="cat-tile"
                  onClick={() => { setCategory(cat.id); setStep("details"); }}
                  style={{
                    padding: "14px 10px",
                    background: category === cat.id ? C.foam : C.white,
                    border: `2px solid ${category === cat.id ? C.sage : "#E2EBE6"}`,
                    borderRadius: 10, cursor: "pointer",
                    transition: "all .15s",
                    textAlign: "center",
                    boxShadow: "0 1px 4px rgba(0,0,0,.04)",
                    // Positive Note gets star styling
                    ...(cat.id === "positive" ? { borderColor: C.gold, background: category === cat.id ? C.goldLt : C.white } : {}),
                  }}
                >
                  <div style={{ fontSize: "1.3rem", marginBottom: 5 }}>{cat.emoji}</div>
                  <div style={{ fontSize: ".75rem", fontWeight: 600, color: cat.id === "positive" ? C.gold : C.ink, lineHeight: 1.2 }}>
                    {cat.label}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="anim" style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: "1.1rem" }}>{catObj?.emoji}</span>
                <h1 style={{ fontSize: "1.1rem", fontWeight: 700, color: C.ink }}>{catObj?.label}</h1>
              </div>
              <p style={{ fontSize: ".82rem", color: C.mist }}>Add details — target under 60 seconds</p>
            </div>

            <div className="anim" style={{ background: C.white, borderRadius: 10, boxShadow: "0 1px 8px rgba(15,31,23,.06)", padding: 16, marginBottom: 14 }}>

              {/* Photo-first nudge */}
              <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
                onChange={e => e.target.files[0] && setPhoto(e.target.files[0].name)} />
              <button onClick={() => fileRef.current?.click()} style={{
                width: "100%", padding: "13px",
                background: photo ? C.foam : C.chalk,
                border: `2px dashed ${photo ? C.sage : C.mint}`,
                borderRadius: 9, fontFamily: "'DM Sans', sans-serif",
                fontSize: ".9rem", color: photo ? C.pine : C.mist,
                cursor: "pointer", marginBottom: 14,
              }}>
                📷 {photo ? `✓ Photo added` : "Add photo first"}
              </button>

              {/* Description */}
              <div style={{ marginBottom: 12 }}>
                <textarea value={desc} onChange={e => setDesc(e.target.value)}
                  onFocus={() => setDescF(true)} onBlur={() => setDescF(false)} rows={2}
                  placeholder={`Describe the ${catObj?.label.toLowerCase()} finding…`}
                  style={{ width: "100%", padding: "9px 11px", border: `1.5px solid ${descFocused ? C.sage : "#D0DEDB"}`, borderRadius: 8, fontFamily: "'DM Sans', sans-serif", fontSize: ".9rem", color: C.ink, outline: "none", resize: "none", lineHeight: 1.5, transition: "all .18s" }}
                />
              </div>

              {/* Severity */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: ".68rem", fontWeight: 600, color: C.mist, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>Severity</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {SEVERITIES.map(s => (
                    <button key={s.id} onClick={() => setSeverity(s.id)} style={{
                      flex: 1, padding: "8px 4px",
                      background: severity === s.id ? s.bg : C.chalk,
                      border: `1.5px solid ${severity === s.id ? s.color : "#E2EBE6"}`,
                      borderRadius: 7, fontFamily: "'DM Sans', sans-serif",
                      fontSize: ".73rem", fontWeight: 700,
                      color: severity === s.id ? s.color : C.mist,
                      cursor: "pointer", transition: "all .12s",
                    }}>{s.label}</button>
                  ))}
                </div>
              </div>

              {/* Assign + Due */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: ".68rem", fontWeight: 600, color: C.mist, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>Assign to</div>
                  <select value={assignee} onChange={e => setAssignee(e.target.value)} style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #D0DEDB", borderRadius: 7, fontFamily: "'DM Sans', sans-serif", fontSize: ".82rem", color: C.ink, background: C.white, outline: "none", cursor: "pointer", appearance: "none" }}>
                    {ASSIGNEES.map(a => <option key={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: ".68rem", fontWeight: 600, color: C.mist, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>Due</div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {DUE_SHORTCUTS.map((s, i) => (
                      <button key={i} onClick={() => setDueShort(s.days)} style={{
                        flex: 1, padding: "7px 2px",
                        background: dueShort === s.days ? C.sage : C.chalk,
                        border: `1.5px solid ${dueShort === s.days ? C.sage : "#D0DEDB"}`,
                        borderRadius: 6, fontFamily: "'DM Sans', sans-serif",
                        fontSize: ".65rem", fontWeight: 600,
                        color: dueShort === s.days ? C.white : C.slate,
                        cursor: "pointer", transition: "all .12s",
                      }}>{s.label}</button>
                    ))}
                  </div>
                </div>
              </div>

              {/* CapEx collapsed */}
              <div>
                <button onClick={() => setShowCapEx(v => !v)} style={{ background: "none", border: "none", padding: "5px 0", fontFamily: "'DM Sans', sans-serif", fontSize: ".78rem", color: C.mist, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ fontSize: ".7rem" }}>{showCapEx ? "▲" : "▼"}</span> Additional details
                </button>
                {showCapEx && (
                  <div style={{ marginTop: 8, padding: "12px", background: C.chalk, borderRadius: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: capex ? 10 : 0 }}>
                      <div style={{ flex: 1, marginRight: 12 }}>
                        <div style={{ fontSize: ".83rem", fontWeight: 600, color: C.ink }}>Requires capital spend (CapEx)</div>
                        <div style={{ fontSize: ".7rem", color: C.mist, marginTop: 2 }}>Excludes this finding from aging metrics while pending budget approval</div>
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
          </>
        )}
      </div>

      {step === "details" && (
        <div style={{ position: "fixed", bottom: 58, left: 0, right: 0, padding: "14px 18px", background: C.white, borderTop: "1px solid #E2EBE6", boxShadow: "0 -4px 20px rgba(0,0,0,.06)" }}>
          <button className="submit-btn" onClick={handleSubmit} disabled={submitting || !desc.trim()} style={{
            width: "100%", padding: "14px",
            background: submitting || !desc.trim() ? "#B0C8BA" : C.sage,
            color: C.white, border: "none", borderRadius: 9,
            fontFamily: "'DM Sans', sans-serif", fontSize: ".95rem", fontWeight: 700,
            cursor: submitting || !desc.trim() ? "default" : "pointer", transition: "all .18s",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            {submitting ? (
              <>
                <span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,.4)", borderTopColor: C.white, borderRadius: "50%", display: "inline-block", animation: "spin .7s linear infinite" }} />
                Logging…
              </>
            ) : "Log finding →"}
          </button>
        </div>
      )}
    </div>
  );
}
