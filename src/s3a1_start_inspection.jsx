import { useState } from "react";
import { EHSHeader } from "./AppShell.jsx";

const C = {
  forest: "#1C3A2A", pine: "#2D5A3D", sage: "#4A8C5C",
  mint: "#A8D5B5", foam: "#E8F5EC", ink: "#0F1F17",
  slate: "#4A5568", mist: "#8FA3A0", chalk: "#F4F7F5",
  white: "#FFFFFF", gold: "#C8922A", goldLt: "#FDF3E3",
  red: "#C0392B", redLt: "#FDECEA",
  orange: "#D4622A", orangeLt: "#FEF0E7",
};

// 4 inspection modes
const MODES = [
  {
    id: "quick",
    emoji: "⚡",
    label: "Quick Finding",
    desc: "Log a single observation right now",
    color: C.gold,
    bg: C.goldLt,
  },
  {
    id: "checklist",
    emoji: "✅",
    label: "Run Checklist",
    desc: "Work through a structured inspection template",
    color: C.sage,
    bg: C.foam,
  },
  {
    id: "gemba",
    emoji: "🚶",
    label: "Gemba Walk",
    desc: "Unscheduled floor walkthrough — log as you go",
    color: C.pine,
    bg: C.foam,
  },
  {
    id: "scheduled",
    emoji: "📅",
    label: "Scheduled",
    desc: "A planned inspection assigned to you",
    color: C.slate,
    bg: "#EEF1F0",
  },
];

// Seed: due-today items that surface automatically
const DUE_TODAY = [
  { id: 1, name: "Bottling Line Safety Check", template: "Bottling & Packaging", site: "Moriah",     due: "Today" },
  { id: 2, name: "Forklift Pre-Op Inspection", template: "Warehouse",            site: "Moriah",     due: "Today" },
];

// Seed: recent findings for feedback loop
const RECENT_FINDINGS = [
  { id: 1, category: "Housekeeping",  severity: "minor",    desc: "Wet floor near line 2 — no signage",    site: "Moriah",     ago: "2h" },
  { id: 2, category: "Equipment",     severity: "major",    desc: "Forklift horn not working — unit 4",    site: "Moriah",     ago: "Yesterday" },
  { id: 3, category: "PPE",           severity: "noted",    desc: "Safety glasses left on conveyor belt",  site: "Middlebury", ago: "2d" },
];

const SEV = {
  critical: { label: "Critical", color: C.red,    bg: C.redLt   },
  major:    { label: "Major",    color: C.orange, bg: C.orangeLt },
  minor:    { label: "Minor",    color: C.gold,   bg: C.goldLt  },
  noted:    { label: "Noted",    color: C.slate,  bg: "#EEF1F0" },
};

function pill(severity) {
  const s = SEV[severity] ?? SEV.noted;
  return (
    <span style={{ padding: "1px 8px", borderRadius: 20, fontSize: ".67rem", fontWeight: 600, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

export default function S3a1StartInspection({ onHome,
  user = { name: "Staff", site: "Moriah", role: "Inspector" },
  onMode,         // (mode: "quick"|"checklist"|"gemba"|"scheduled") => void
  onResume,       // (inspectionId) => void
  onViewFinding,  // (findingId) => void
}) {
  const [selectedMode, setSelectedMode] = useState(null);

  function handleContinue() {
    if (selectedMode) onMode?.(selectedMode);
  }

  return (
    <div style={{ minHeight: "100vh", background: C.chalk, fontFamily: "'DM Sans', sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .anim { animation: fadeUp .25s ease both; }
        .mode-tile:hover { transform: translateY(-2px); }
        .mode-tile:active { transform: scale(.97); }
        .due-row:hover { background: ${C.foam} !important; }
        .continue-btn:hover:not(:disabled) { background: ${C.pine} !important; transform: translateY(-1px); }
      `}</style>

      <EHSHeader onHome={onHome} rightContent={<div style={{ fontSize: ".72rem", color: "rgba(255,255,255,.45)" }}>{user.name} · {user.site}</div>} />

      <div style={{ flex: 1, padding: "18px 18px 100px", overflowY: "auto" }}>

        {/* Header */}
        <div className="anim" style={{ marginBottom: 22 }}>
          <h1 style={{ fontSize: "1.3rem", fontWeight: 700, color: C.ink }}>Start inspection</h1>
          <p style={{ fontSize: ".85rem", color: C.mist, marginTop: 4 }}>What are you doing right now?</p>
        </div>

        {/* Mode tiles — 2×2 grid */}
        <div className="anim" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 22 }}>
          {MODES.map(mode => (
            <div
              key={mode.id}
              className="mode-tile"
              onClick={() => setSelectedMode(mode.id)}
              style={{
                padding: "16px 14px",
                background: selectedMode === mode.id ? mode.bg : C.white,
                border: `2px solid ${selectedMode === mode.id ? mode.color : "#E2EBE6"}`,
                borderRadius: 10, cursor: "pointer",
                transition: "all .15s",
                boxShadow: selectedMode === mode.id ? `0 2px 12px ${mode.color}22` : "0 1px 4px rgba(0,0,0,.05)",
              }}
            >
              <div style={{ fontSize: "1.4rem", marginBottom: 7 }}>{mode.emoji}</div>
              <div style={{ fontSize: ".88rem", fontWeight: 700, color: selectedMode === mode.id ? mode.color : C.ink, marginBottom: 3 }}>
                {mode.label}
              </div>
              <div style={{ fontSize: ".73rem", color: C.mist, lineHeight: 1.4 }}>{mode.desc}</div>
            </div>
          ))}
        </div>

        {/* Due today — surface automatically per spec */}
        {DUE_TODAY.length > 0 && (
          <div className="anim" style={{ marginBottom: 20 }}>
            <div style={{ fontSize: ".7rem", fontWeight: 600, letterSpacing: ".07em", textTransform: "uppercase", color: C.orange, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <span>🗓</span> Due today
            </div>
            <div style={{ background: C.white, borderRadius: 10, boxShadow: "0 1px 8px rgba(15,31,23,.06)", overflow: "hidden" }}>
              {DUE_TODAY.map((item, i) => (
                <div
                  key={item.id}
                  className="due-row"
                  onClick={() => { setSelectedMode("checklist"); onResume?.(item.id); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 14px",
                    borderBottom: i < DUE_TODAY.length - 1 ? "1px solid #F0F4F2" : "none",
                    cursor: "pointer", transition: "background .12s",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: ".88rem", fontWeight: 600, color: C.ink }}>{item.name}</div>
                    <div style={{ fontSize: ".73rem", color: C.mist, marginTop: 2 }}>{item.template} · {item.site}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: ".72rem", color: C.orange, fontWeight: 600 }}>Due today</span>
                    <span style={{ color: C.mist, fontSize: ".8rem" }}>→</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent findings — immediate feedback loop */}
        <div className="anim">
          <div style={{ fontSize: ".7rem", fontWeight: 600, letterSpacing: ".07em", textTransform: "uppercase", color: C.mist, marginBottom: 8 }}>
            Recent findings
          </div>
          <div style={{ background: C.white, borderRadius: 10, boxShadow: "0 1px 8px rgba(15,31,23,.06)", overflow: "hidden" }}>
            {RECENT_FINDINGS.map((f, i) => (
              <div
                key={f.id}
                className="due-row"
                onClick={() => onViewFinding?.(f.id)}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 10,
                  padding: "11px 14px",
                  borderBottom: i < RECENT_FINDINGS.length - 1 ? "1px solid #F0F4F2" : "none",
                  cursor: "pointer", transition: "background .12s",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                    {pill(f.severity)}
                    <span style={{ fontSize: ".72rem", color: C.mist }}>{f.category}</span>
                  </div>
                  <div style={{ fontSize: ".85rem", color: C.ink, lineHeight: 1.4 }}>{f.desc}</div>
                  <div style={{ fontSize: ".7rem", color: C.mist, marginTop: 3 }}>{f.site} · {f.ago}</div>
                </div>
                <span style={{ color: C.mist, fontSize: ".8rem", flexShrink: 0, marginTop: 2 }}>→</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Fixed bottom */}
      <div style={{ position: "fixed", bottom: 58, left: 0, right: 0, padding: "14px 18px", background: C.white, borderTop: "1px solid #E2EBE6", boxShadow: "0 -4px 20px rgba(0,0,0,.06)" }}>
        <button
          className="continue-btn"
          onClick={handleContinue}
          disabled={!selectedMode}
          style={{
            width: "100%", padding: "14px",
            background: selectedMode ? C.sage : "#B0C8BA",
            color: C.white, border: "none", borderRadius: 9,
            fontFamily: "'DM Sans', sans-serif", fontSize: ".95rem", fontWeight: 700,
            cursor: selectedMode ? "pointer" : "default", transition: "all .18s",
          }}
        >
          {selectedMode
            ? `Start — ${MODES.find(m => m.id === selectedMode)?.label} →`
            : "Select an inspection type"}
        </button>
      </div>
    </div>
  );
}
