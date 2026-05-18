import { useState } from "react";
import { EHSHeader } from "./AppShell.jsx";
import { BRAND, SITES } from "./constants.js";

const C = {
  forest: "#1C3A2A", pine: "#2D5A3D", sage: "#4A8C5C",
  mint: "#A8D5B5", foam: "#E8F5EC", ink: "#0F1F17",
  slate: "#4A5568", mist: "#8FA3A0", chalk: "#F4F7F5",
  white: "#FFFFFF", red: "#C0392B", redLt: "#FDECEA",
};

export default function S0aTriageEntry({
  user = { name: "Alex Torres", site: "Riverside" },
  onStart,
  onReportInstead,

  onHome,
}) {
  return (
    <div style={{
      minHeight: "100vh", background: "#0F1F17",
      fontFamily: "'DM Sans', sans-serif",
      display: "flex", flexDirection: "column",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes triage-pulse { 0%,100%{box-shadow:0 0 0 0 rgba(192,57,43,.5);} 50%{box-shadow:0 0 0 16px rgba(192,57,43,0);} }
        .triage-btn { animation: triage-pulse 2.2s ease-in-out infinite; }
        .triage-btn:hover { background: #991B1B !important; }
        .triage-btn:active { transform: scale(.97); }
        .secondary-btn:hover { background: rgba(255,255,255,.07) !important; }
        .a1 { animation: fadeUp .4s ease .05s both; }
        .a2 { animation: fadeUp .4s ease .2s both; }
        .a3 { animation: fadeUp .4s ease .35s both; }
      `}</style>

      <EHSHeader onHome={onHome} dark={true} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 24px 24px" }}>

        <div className="a1" style={{ marginBottom: 32, textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: 14 }}>ð¨</div>
          <h1 style={{ fontSize: "1.45rem", fontWeight: 800, color: C.white, lineHeight: 1.25, marginBottom: 10 }}>
            Did something just happen?
          </h1>
          <p style={{ fontSize: ".88rem", color: "rgba(255,255,255,.45)", lineHeight: 1.6, maxWidth: 300 }}>
            We'll guide you through what to do right now. Takes about 60 seconds.
          </p>
        </div>

        <div className="a2" style={{ width: "100%", maxWidth: 360 }}>
          {/* Bucket 3: button text updated to communicate live guidance */}
          <button
            className="triage-btn"
            onClick={onStart}
            style={{
              width: "100%", padding: "20px 24px",
              background: C.red, color: C.white, border: "none", borderRadius: 12,
              fontFamily: "'DM Sans', sans-serif", fontSize: "1.05rem", fontWeight: 800,
              cursor: "pointer", transition: "background .15s, transform .1s",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <span>Guide me through this now</span>
            <span style={{ opacity: .8 }}>â</span>
          </button>

          {/* Secondary: for after-the-fact reporting */}
          <button
            className="secondary-btn"
            onClick={onReportInstead}
            style={{
              width: "100%", padding: "14px 20px",
              background: "rgba(255,255,255,.04)", color: "rgba(255,255,255,.55)",
              border: "1px solid rgba(255,255,255,.1)", borderRadius: 10,
              fontFamily: "'DM Sans', sans-serif", fontSize: ".9rem", fontWeight: 500,
              cursor: "pointer", transition: "background .15s",
            }}
          >
            The immediate situation is handled â file a report
          </button>
        </div>

        <div className="a3" style={{ marginTop: 20, textAlign: "center" }}>
          <p style={{ fontSize: ".72rem", color: "rgba(255,255,255,.2)", lineHeight: 1.7, maxWidth: 280 }}>
            <strong style={{ color: "rgba(255,255,255,.3)" }}>"Guide me now"</strong> is for something happening right now.{" "}
            <strong style={{ color: "rgba(255,255,255,.3)" }}>"File a report"</strong> is for after the fact.
          </p>
        </div>
      </div>
    </div>
  );
}
