import { COLORS } from "./constants.js";
import { useState } from "react";
import { EHSHeader } from "./AppShell.jsx";

const C = { ...COLORS };

// ── Outcome definitions ───────────────────────────────────────────────────────
// Spec: CPR language is locked — cannot be changed to directive form.
// Spec: OSHA guidance shown for triage even without provider configured.
// Spec: No OSHA guidance on 911 screen (wrong moment).
// Spec: First aid screen must include "call triage first" wording if worsens.

const OUTCOMES = {
  "911": {
    emoji: "🚨",
    color: "#B91C1C",
    bgGrad: "linear-gradient(160deg, #7F1D1D 0%, #1C0A0A 100%)",
    heading: "Call 911 now",
    subheading: "This is a medical emergency. Call immediately.",
    primaryAction: { label: "Call 911", tel: "911" },
    steps: [
      "Call 911 and stay on the line",
      "Stay with the person — do not leave them alone",
      // Spec §5: CPR language is locked — non-directive
      "If they have no pulse and you are both trained and feel comfortable doing so, begin CPR",
      "Clear the area of bystanders",
      "Meet emergency services at the entrance",
    ],
    // Spec §3: post-911 OSHA note goes on "Add details" screen, not here
    oshaTip: null,
    addDetailsNote: "This incident will likely be OSHA recordable. Your Safety Officer will classify it once the report is submitted.",
    showTriageProvider: false,
  },

  "triage": {
    emoji: "📞",
    color: "#B45309",
    bgGrad: "linear-gradient(160deg, #78350F 0%, #1C1007 100%)",
    heading: "Call the triage line",
    subheading: "Get a clinical assessment before deciding on further care.",
    primaryAction: null, // filled from config
    steps: [
      "Call the triage line — number shown below",
      "Describe what happened and current symptoms",
      "Follow the clinician's guidance",
      "Do not send the person to outside medical care before speaking with triage",
    ],
    // Spec §1 and §5: OSHA guidance shown even when no provider configured
    oshaTip: "Calling the triage line before outside medical care keeps the option open for first-aid-only classification, which is generally non-recordable under OSHA. This is informational — not a guarantee.",
    addDetailsNote: null,
    showTriageProvider: true,
  },

  "firstaid": {
    emoji: "🩹",
    color: C.pine,
    bgGrad: "linear-gradient(160deg, #1C3A2A 0%, #0A1510 100%)",
    heading: "Administer first aid",
    subheading: "Treat the injury on site. No outside medical care needed right now.",
    primaryAction: null,
    steps: [
      "Use the first aid kit — location posted at each site entrance",
      "Clean and dress any wounds",
      "Monitor the person for the next 30 minutes",
      "Keep them seated and comfortable",
    ],
    // Spec §4: exact wording locked
    oshaTip: "If symptoms worsen or they want further evaluation, call the triage line first before going to outside medical care.",
    addDetailsNote: null,
    showTriageProvider: false,
  },

  "secure": {
    emoji: "⚠️",
    color: C.slate,
    bgGrad: "linear-gradient(160deg, #2D3748 0%, #0D1117 100%)",
    heading: "Secure the area",
    subheading: "No injuries reported. Contain the situation.",
    primaryAction: null,
    steps: [
      "Prevent access to the affected area",
      "Identify and eliminate immediate hazards if safe to do so",
      "Photograph the scene before anything is moved",
      "Notify your site manager",
    ],
    oshaTip: null,
    addDetailsNote: null,
    showTriageProvider: false,
  },
};

// ── Triage provider display ───────────────────────────────────────────────────
function TriageProviderCard({ provider }) {
  const [calling, setCalling] = useState(false);

  if (!provider) {
    // Spec §1: OSHA guidance must still show even without provider configured
    return (
      <div style={{
        background: "rgba(255,255,255,.06)",
        border: "1.5px solid rgba(255,255,255,.12)",
        borderRadius: 12, padding: "16px 18px", marginBottom: 20,
      }}>
        <div style={{ fontSize: ".78rem", color: "rgba(255,255,255,.4)", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>
          Triage line
        </div>
        <div style={{ fontSize: ".9rem", color: "rgba(255,255,255,.55)", lineHeight: 1.5 }}>
          No triage provider configured. Seek a clinical assessment via your own occupational health contact or a telehealth provider <strong style={{ color: "rgba(255,255,255,.75)" }}>before</strong> going to outside medical care.
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: "rgba(255,255,255,.08)",
      border: "1.5px solid rgba(255,255,255,.2)",
      borderRadius: 12, padding: "16px 18px", marginBottom: 20,
    }}>
      <div style={{ fontSize: ".75rem", color: "rgba(255,255,255,.4)", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>
        Triage line
      </div>
      <div style={{ fontSize: "1rem", fontWeight: 700, color: C.white, marginBottom: 12 }}>
        {provider.name}
      </div>
      <a
        href={`tel:${provider.phone.replace(/\D/g, "")}`}
        onClick={() => setCalling(true)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          padding: "14px",
          background: calling ? "#D97706" : C.gold,
          color: C.white,
          borderRadius: 10, textDecoration: "none",
          fontFamily: "'DM Sans', sans-serif",
          fontSize: "1.1rem", fontWeight: 700,
          transition: "all .15s",
        }}
      >
        📞 {provider.phone}
      </a>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function S0cImmediateAction({
  onHome,
  outcome = "triage",           // "911" | "triage" | "firstaid" | "secure"
  triageProvider = null,         // { name, phone } or null
  responder = "Responder",
  site = "Moriah",
  onNotificationsSent,          // () => void — advances to s0d
  onAddDetails,                 // () => void — goes to incident report
  onBack,
}) {
  const config = OUTCOMES[outcome] ?? OUTCOMES["secure"];
  const [stepsDone, setStepsDone] = useState({});

  function toggleStep(i) {
    setStepsDone(s => ({ ...s, [i]: !s[i] }));
  }

  const doneCount = Object.values(stepsDone).filter(Boolean).length;
  const allDone   = doneCount === config.steps.length;

  return (
    <div style={{
      minHeight: "100vh",
      background: config.bgGrad,
      fontFamily: "'DM Sans', sans-serif",
      display: "flex", flexDirection: "column",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        .anim-0 { animation: fadeUp .25s ease .0s both; }
        .anim-1 { animation: fadeUp .25s ease .1s both; }
        .anim-2 { animation: fadeUp .25s ease .2s both; }
        .anim-3 { animation: fadeUp .25s ease .3s both; }
        .step-row:hover { background: rgba(255,255,255,.06) !important; }
        .continue-btn:hover { opacity: .9 !important; transform: translateY(-1px); }
      `}</style>

      <EHSHeader onHome={onHome} dark rightContent={
        <div style={{ fontSize: ".72rem", color: "rgba(255,255,255,.35)", background: "rgba(255,255,255,.07)", padding: "3px 10px", borderRadius: 20 }}>{responder} · {site}</div>
      } />

      {/* Top bar */}
      <div style={{ padding: "16px 20px", display: "flex", alignItems: "center" }}>
        <button onClick={onBack} style={{
          background: "none", border: "none", color: "rgba(255,255,255,.4)",
          fontSize: ".88rem", cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
        }}>← Back</button>
      </div>

      {/* Scrollable content */}
      <div style={{
        flex: 1, padding: "0 20px 100px",
        maxWidth: 460, margin: "0 auto", width: "100%",
        overflowY: "auto",
      }}>

        {/* Outcome header */}
        <div className="anim-0" style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: "3rem", marginBottom: 10 }}>{config.emoji}</div>
          <h1 style={{
            fontSize: "1.65rem", fontWeight: 700, color: C.white,
            lineHeight: 1.2, marginBottom: 8,
          }}>{config.heading}</h1>
          <p style={{ fontSize: ".92rem", color: "rgba(255,255,255,.55)", lineHeight: 1.5 }}>
            {config.subheading}
          </p>
        </div>

        {/* Triage provider card (triage outcome only) */}
        {config.showTriageProvider && (
          <div className="anim-1">
            <TriageProviderCard provider={triageProvider} />
          </div>
        )}

        {/* 911 direct call button */}
        {outcome === "911" && (
          <div className="anim-1" style={{ marginBottom: 20 }}>
            <a
              href="tel:911"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                padding: "18px",
                background: C.alarm, color: C.white,
                borderRadius: 12, textDecoration: "none",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "1.2rem", fontWeight: 700,
              }}
            >🚨 Call 911</a>
          </div>
        )}

        {/* Steps checklist */}
        <div className="anim-2" style={{
          background: "rgba(255,255,255,.06)",
          border: "1.5px solid rgba(255,255,255,.1)",
          borderRadius: 12, overflow: "hidden", marginBottom: 16,
        }}>
          <div style={{
            padding: "12px 16px",
            borderBottom: "1px solid rgba(255,255,255,.08)",
            fontSize: ".72rem", fontWeight: 600,
            letterSpacing: ".08em", textTransform: "uppercase",
            color: "rgba(255,255,255,.35)",
            display: "flex", justifyContent: "space-between",
          }}>
            <span>Steps</span>
            <span>{doneCount}/{config.steps.length} done</span>
          </div>
          {config.steps.map((step, i) => (
            <div
              key={i}
              className="step-row"
              onClick={() => toggleStep(i)}
              style={{
                display: "flex", alignItems: "flex-start", gap: 12,
                padding: "13px 16px",
                borderBottom: i < config.steps.length - 1 ? "1px solid rgba(255,255,255,.06)" : "none",
                cursor: "pointer", transition: "background .12s",
                background: stepsDone[i] ? "rgba(74,140,92,.15)" : "transparent",
              }}
            >
              <div style={{
                width: 22, height: 22, borderRadius: "50%", flexShrink: 0, marginTop: 1,
                border: `2px solid ${stepsDone[i] ? C.sage : "rgba(255,255,255,.25)"}`,
                background: stepsDone[i] ? C.sage : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: ".7rem", color: C.white, fontWeight: 700,
                transition: "all .15s",
              }}>
                {stepsDone[i] ? "✓" : ""}
              </div>
              <span style={{
                fontSize: ".9rem", lineHeight: 1.5,
                color: stepsDone[i] ? "rgba(255,255,255,.45)" : C.white,
                textDecoration: stepsDone[i] ? "line-through" : "none",
                transition: "all .15s",
              }}>{step}</span>
            </div>
          ))}
        </div>

        {/* OSHA tip */}
        {config.oshaTip && (
          <div className="anim-2" style={{
            background: "rgba(200,146,42,.1)",
            border: "1px solid rgba(200,146,42,.25)",
            borderRadius: 10, padding: "13px 15px",
            marginBottom: 16,
          }}>
            <div style={{ fontSize: ".72rem", fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: C.gold, marginBottom: 5 }}>
              OSHA note
            </div>
            <p style={{ fontSize: ".83rem", color: "rgba(255,255,255,.6)", lineHeight: 1.6 }}>
              {config.oshaTip}
            </p>
          </div>
        )}

        {/* Post-911 recordability note (shown on "add details" link, per spec §3) */}
        {outcome === "911" && config.addDetailsNote && (
          <div style={{
            background: "rgba(255,255,255,.05)",
            border: "1px solid rgba(255,255,255,.1)",
            borderRadius: 10, padding: "12px 14px", marginBottom: 16,
          }}>
            <p style={{ fontSize: ".82rem", color: "rgba(255,255,255,.5)", lineHeight: 1.6 }}>
              {config.addDetailsNote}
            </p>
          </div>
        )}
      </div>

      {/* Fixed bottom CTA */}
      <div style={{
        position: "fixed", bottom: 58, left: 0, right: 0,
        padding: "16px 20px",
        background: "rgba(15,31,23,.85)",
        backdropFilter: "blur(12px)",
        borderTop: "1px solid rgba(255,255,255,.07)",
        display: "flex", flexDirection: "column", gap: 10,
        maxWidth: 460, margin: "0 auto",
      }}>
        <button
          className="continue-btn"
          onClick={onNotificationsSent}
          style={{
            width: "100%", padding: "15px",
            background: config.color,
            color: C.white, border: "none", borderRadius: 10,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: ".95rem", fontWeight: 700,
            cursor: "pointer", transition: "all .15s",
          }}
        >
          {allDone ? "Situation handled → see who was notified" : "Continue → who was notified"}
        </button>
        <button
          onClick={onAddDetails}
          style={{
            width: "100%", padding: "12px",
            background: "none",
            color: "rgba(255,255,255,.4)",
            border: "1px solid rgba(255,255,255,.1)",
            borderRadius: 10,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: ".85rem", fontWeight: 500,
            cursor: "pointer",
          }}
        >Add details to incident report later</button>
      </div>
    </div>
  );
}
