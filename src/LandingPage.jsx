import { useState } from "react";
import { BRAND, DEMO_USERS } from "./constants.js";

export default function LandingPage({ onEnter }) {
  const [hoveredId, setHoveredId] = useState(null);

  return (
    // Bucket 1.5: use 100dvh so it fills exactly the device viewport with no scroll
    <div style={{
      height: "100dvh", minHeight: "100vh",
      background: "#0B1610",
      fontFamily: "'DM Sans', sans-serif",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "24px 24px",
      position: "relative", overflow: "hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .landing-grid::before {
          content: '';
          position: absolute; inset: 0;
          background-image: linear-gradient(rgba(74,140,92,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(74,140,92,.05) 1px, transparent 1px);
          background-size: 40px 40px; pointer-events: none;
        }
        .landing-glow::after {
          content: '';
          position: absolute; top: 30%; left: 50%; transform: translate(-50%, -50%);
          width: 500px; height: 320px;
          background: radial-gradient(ellipse, rgba(74,140,92,.1) 0%, transparent 70%);
          pointer-events: none;
        }
        @keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse-ring { 0%,100%{box-shadow:0 0 0 0 rgba(74,140,92,.3);} 70%{box-shadow:0 0 0 10px rgba(74,140,92,0);} }
        .a1 { animation: fadeUp .45s ease .05s both; }
        .a2 { animation: fadeUp .45s ease .18s both; }
        .a3 { animation: fadeUp .45s ease .3s both; }
        .a4 { animation: fadeUp .45s ease .42s both; }
        .role-btn { transition: transform .15s ease, box-shadow .15s ease; }
        .role-btn:hover { transform: translateY(-2px); }
        .role-btn:active { transform: scale(.97); }
      `}</style>

      <div className="landing-grid landing-glow" style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", alignItems: "center" }}>

        {/* Logo mark */}
        <div className="a1" style={{ marginBottom: 10 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 13,
            background: "linear-gradient(135deg, #2D5A3D, #4A8C5C)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 20px rgba(74,140,92,.3)",
            animation: "pulse-ring 3s ease infinite",
          }}>
            <span style={{ fontSize: "1.25rem" }}>🧬</span>
          </div>
        </div>

        {/* Brand */}
        <div className="a1" style={{ marginBottom: 5, textAlign: "center" }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1.85rem", fontWeight: 600, letterSpacing: ".08em", color: "#fff" }}>
            <span style={{ color: "#A8D5B5" }}>EHS</span> DNA
          </div>
        </div>

        {/* Tagline */}
        <div className="a2" style={{ marginBottom: 36, textAlign: "center" }}>
          <p style={{ fontSize: ".85rem", color: "rgba(255,255,255,.35)", letterSpacing: ".02em", lineHeight: 1.5 }}>
            {BRAND.tagline}
          </p>
        </div>

        {/* Role selector label */}
        <div className="a3" style={{ marginBottom: 12, textAlign: "center", width: "100%" }}>
          <p style={{ fontSize: ".68rem", fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(255,255,255,.22)" }}>
            Select a role to explore
          </p>
        </div>

        {/* Role buttons */}
        <div className="a4" style={{ display: "flex", flexDirection: "column", gap: 9, width: "100%" }}>
          {DEMO_USERS.map(demo => (
            <button
              key={demo.id}
              className="role-btn"
              onClick={() => onEnter(demo)}
              onMouseEnter={() => setHoveredId(demo.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                width: "100%", padding: "14px 18px",
                background: hoveredId === demo.id ? `${demo.color}ee` : `${demo.color}bb`,
                border: "1px solid rgba(168,213,181,.12)",
                borderRadius: 11, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 12,
                boxShadow: hoveredId === demo.id ? "0 6px 20px rgba(0,0,0,.3)" : "0 2px 8px rgba(0,0,0,.2)",
              }}
            >
              <div style={{ width: 38, height: 38, borderRadius: 9, background: "rgba(255,255,255,.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", flexShrink: 0 }}>
                {demo.emoji}
              </div>
              <div style={{ textAlign: "left", flex: 1 }}>
                <div style={{ fontSize: ".92rem", fontWeight: 700, color: "#fff", marginBottom: 1 }}>{demo.label}</div>
                <div style={{ fontSize: ".73rem", color: "rgba(255,255,255,.45)" }}>{demo.sublabel}</div>
              </div>
              <div style={{ color: "rgba(255,255,255,.3)", fontSize: ".85rem", flexShrink: 0 }}>→</div>
            </button>
          ))}
        </div>

        {/* Bucket 3: footer note — remove company name, add prototype context */}
        <div style={{ marginTop: 28, textAlign: "center" }}>
          <p style={{ fontSize: ".67rem", color: "rgba(255,255,255,.15)", letterSpacing: ".04em", lineHeight: 1.6 }}>
            PROTOTYPE · This will be the login page when live
          </p>
        </div>
      </div>
    </div>
  );
}
