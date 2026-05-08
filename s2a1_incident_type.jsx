import { useState } from "react";
import { INCIDENT_TYPES } from "./constants.js";

const C = {
  forest: "#1C3A2A", pine: "#2D5A3D", sage: "#4A8C5C",
  mint: "#A8D5B5", foam: "#E8F5EC", ink: "#0F1F17",
  slate: "#4A5568", mist: "#8FA3A0", chalk: "#F4F7F5",
  white: "#FFFFFF", gold: "#C8922A", goldLt: "#FDF3E3",
  red: "#C0392B", redLt: "#FDECEA",
};

const SITES = ["Riverside", "Highland"];

function Progress({ step, total }) {
  return (
    <div style={{ display: "flex", gap: 4, padding: "0 18px" }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i < step ? C.sage : i === step ? C.mint : "#E2EBE6" }} />
      ))}
    </div>
  );
}

export default function S2a1IncidentType({
  user = { name: "Alex Torres", site: "Riverside" },
  onContinue, onBack, onTriage,
}) {
  const nowStr = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const [selectedType, setSelectedType] = useState(null);
  const [site,         setSite]         = useState(user.site ?? SITES[0]);
  const [datetime,     setDatetime]     = useState(nowStr);

  return (
    <div style={{ height: "100dvh", minHeight: "100vh", background: C.chalk, fontFamily: "'DM Sans', sans-serif", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .type-tile:hover { transform: translateY(-2px); } .type-tile:active { transform: scale(.97); }
        .continue-btn:hover:not(:disabled) { background: ${C.pine} !important; }
        .triage-hint:hover { background: ${C.redLt} !important; }
        select, input { appearance: none; color-scheme: light; }
      `}</style>

      <div style={{ height: 52, background: C.forest, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px", flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.mint, fontSize: ".88rem", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>← Back</button>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: ".85rem", color: C.mint }}><span style={{ color: C.white }}>EHS</span> DNA</div>
        <div style={{ width: 40 }} />
      </div>

      <div style={{ padding: "10px 0 6px", flexShrink: 0 }}><Progress step={0} total={5} /></div>

      <div style={{ flex: 1, padding: "12px 18px 0", overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>

        <div>
          <h1 style={{ fontSize: "1.2rem", fontWeight: 700, color: C.ink }}>Report an incident</h1>
          <p style={{ fontSize: ".82rem", color: C.mist, marginTop: 3 }}>The immediate situation is handled — what happened?</p>
        </div>

        {/* Bucket 3: triage shortcut above incident type grid */}
        {onTriage && (
          <button className="triage-hint" onClick={onTriage} style={{
            width: "100%", padding: "11px 14px", background: C.redLt,
            border: `1.5px solid ${C.red}33`, borderRadius: 9, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 10,
            fontFamily: "'DM Sans', sans-serif", transition: "background .15s",
          }}>
            <span style={{ fontSize: "1rem" }}>🚨</span>
            <div style={{ textAlign: "left", flex: 1 }}>
              <div style={{ fontSize: ".83rem", fontWeight: 700, color: C.red }}>Something still happening right now?</div>
              <div style={{ fontSize: ".7rem", color: C.mist }}>Get live guidance instead → Triage</div>
            </div>
            <span style={{ color: C.red }}>→</span>
          </button>
        )}

        {/* Bucket 3: 2x2 grid — 4 types only */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
          {INCIDENT_TYPES.map(t => (
            <div key={t.id} className="type-tile" onClick={() => setSelectedType(t.id)} style={{
              padding: "14px 12px",
              background: selectedType === t.id ? t.bg : C.white,
              border: `2px solid ${selectedType === t.id ? t.color : "#E2EBE6"}`,
              borderRadius: 10, cursor: "pointer", transition: "all .15s",
              boxShadow: selectedType === t.id ? `0 2px 12px ${t.color}22` : "0 1px 4px rgba(0,0,0,.05)",
            }}>
              <div style={{ fontSize: "1.3rem", marginBottom: 5 }}>{t.emoji}</div>
              <div style={{ fontSize: ".85rem", fontWeight: 600, color: selectedType === t.id ? t.color : C.ink }}>{t.label}</div>
            </div>
          ))}
        </div>

        {/* Site + datetime — no department (Bucket 3) */}
        <div style={{ background: C.white, borderRadius: 10, boxShadow: "0 1px 8px rgba(15,31,23,.06)", padding: "14px" }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: ".68rem", fontWeight: 600, letterSpacing: ".07em", textTransform: "uppercase", color: C.sage, marginBottom: 5 }}>Site</div>
            <select value={site} onChange={e => setSite(e.target.value)} style={{ width: "100%", padding: "9px 28px 9px 10px", border: "1.5px solid #D0DEDB", borderRadius: 8, fontFamily: "'DM Sans', sans-serif", fontSize: ".9rem", color: C.ink, background: `${C.white} url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%238FA3A0'/%3E%3C/svg%3E") no-repeat right 10px center`, outline: "none" }}>
              {SITES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: ".68rem", fontWeight: 600, letterSpacing: ".07em", textTransform: "uppercase", color: C.sage, marginBottom: 5 }}>Date & time</div>
            <input type="datetime-local" value={datetime} onChange={e => setDatetime(e.target.value)} style={{ width: "100%", padding: "9px 10px", border: "1.5px solid #D0DEDB", borderRadius: 8, fontFamily: "'DM Sans', sans-serif", fontSize: ".9rem", color: C.ink, outline: "none" }} />
            <div style={{ fontSize: ".7rem", color: C.mist, marginTop: 4 }}>Defaults to now — edit if reporting after the fact</div>
          </div>
        </div>

        <div style={{ height: 8, flexShrink: 0 }} />
      </div>

      {/* Bottom CTA */}
      <div style={{ padding: "12px 18px 14px", background: C.white, borderTop: "1px solid #E2EBE6", boxShadow: "0 -4px 20px rgba(0,0,0,.06)", flexShrink: 0 }}>
        <button className="continue-btn" onClick={() => selectedType && onContinue?.({ type: selectedType, site, datetime })} disabled={!selectedType} style={{
          width: "100%", padding: "14px",
          background: selectedType ? C.sage : "#B0C8BA",
          color: C.white, border: "none", borderRadius: 9,
          fontFamily: "'DM Sans', sans-serif", fontSize: ".95rem", fontWeight: 700,
          cursor: selectedType ? "pointer" : "default", transition: "all .18s",
        }}>
          {selectedType ? `Continue — ${INCIDENT_TYPES.find(t => t.id === selectedType)?.label} →` : "Select an incident type to continue"}
        </button>
      </div>
    </div>
  );
}
