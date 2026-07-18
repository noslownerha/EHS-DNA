import { useState } from "react";
import { COLORS } from "./constants.js";
import { EHSHeader } from "./AppShell.jsx";

const C = { ...COLORS };

import { SITES } from "./constants.js";

function Progress({ step, total }) {
  return (
    <div style={{ display: "flex", gap: 4, padding: "0 18px" }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i < step ? C.sage : i === step ? C.mint : "#E2EBE6" }} />
      ))}
    </div>
  );
}

// A single choice card. Big tap target, icon + label + one-line sub.
function Card({ icon, label, sub, tone = "neutral", onClick }) {
  const accent = tone === "injury" ? C.red : tone === "good" ? C.sage : C.ink;
  const bg     = tone === "injury" ? C.redLt : tone === "good" ? C.foam : "#EFF6F1";
  const border = tone === "injury" ? `${C.red}44` : tone === "good" ? `${C.sage}55` : "#C9D8D0";
  return (
    <button className="type-tile" onClick={onClick} style={{
      width: "100%", padding: "18px 16px", textAlign: "left",
      background: bg, border: `1.5px solid ${border}`, borderRadius: 13, cursor: "pointer",
      boxShadow: "0 2px 8px rgba(15,31,23,.08)", fontFamily: "'DM Sans', sans-serif",
      display: "flex", alignItems: "center", gap: 14, transition: "transform .12s",
    }}>
      <span style={{ fontSize: "1.7rem", flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: "1rem", fontWeight: 700, lineHeight: 1.2, color: accent }}>{label}</div>
        {sub && <div style={{ fontSize: ".76rem", color: C.mist, marginTop: 2, lineHeight: 1.3 }}>{sub}</div>}
      </div>
      <span style={{ color: accent, fontSize: "1.1rem", flexShrink: 0 }}>›</span>
    </button>
  );
}

export default function S2a1IncidentType({
  user = { name: "Responder", site: "Moriah" },
  onContinue, onBack, onTriage, onHome,
}) {
  // step: "top" -> "flag" -> "idea". Injury peels off to triage; terminal tiles
  // call proceed() with a resolved type. Fewer taps than the old flat grid, and
  // every tap encodes a real routing distinction rather than making the worker
  // read a wall of options.
  const [step, setStep] = useState("top");
  const nowStr = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const [site] = useState(user.site ?? SITES[0]);
  const [datetime] = useState(nowStr);

  const proceed = (type) => onContinue?.({ type, site, datetime });
  const goBack  = () => step === "idea" ? setStep("flag") : step === "flag" ? setStep("top") : onBack?.();

  const HEAD = {
    top:  { h: "What's going on?", p: "Pick the closest — it only takes a moment." },
    flag: { h: "What kind of thing?", p: "Just the closest fit. You can add detail next." },
    idea: { h: "What would you like to share?", p: "" },
  }[step];

  return (
    <div style={{ height: "100dvh", minHeight: "100vh", background: C.chalk, fontFamily: "'DM Sans', sans-serif", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .type-tile:hover { transform: translateY(-2px); } .type-tile:active { transform: scale(.98); }
        .triage-hint:hover { background: ${C.redLt} !important; }
      `}</style>

      <EHSHeader onHome={onHome} rightContent={<button onClick={goBack} style={{ background: "none", border: "none", color: C.mint, fontSize: ".85rem", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>&larr; Back</button>} />

      <div style={{ padding: "10px 0 6px", flexShrink: 0 }}><Progress step={step === "top" ? 0 : 1} total={5} /></div>

      <div style={{ flex: 1, padding: "16px 18px 40px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>

        <div>
          <h1 style={{ fontSize: "1.35rem", fontWeight: 700, color: C.ink }}>{HEAD.h}</h1>
          {HEAD.p && <p style={{ fontSize: ".85rem", color: C.mist, marginTop: 4 }}>{HEAD.p}</p>}
        </div>

        {step === "top" && (
          <>
            <Card icon="🩹" label="Report an injury" sub="Someone got hurt or ill" tone="injury"
              onClick={() => (onTriage ? onTriage() : proceed("injury"))} />
            <Card icon="🚩" label="Flag something" sub="A hazard, damage, or an idea to share"
              onClick={() => setStep("flag")} />
          </>
        )}

        {step === "flag" && (
          <>
            <Card icon="⚠️" label="A risk or hazard" sub="Something unsafe, or a close call"
              onClick={() => proceed("hazard")} />
            <Card icon="🔧" label="Damage or a security issue" sub="Property, equipment, or a security concern"
              onClick={() => proceed("property")} />
            <Card icon="💡" label="An idea or a shout-out" sub="A better way, or someone doing it right" tone="good"
              onClick={() => setStep("idea")} />
          </>
        )}

        {step === "idea" && (
          <>
            <Card icon="💡" label="I have an idea" sub="A way to make things safer or better" tone="good"
              onClick={() => proceed("idea")} />
            <Card icon="👏" label="Give a shout-out" sub="Someone did something right" tone="good"
              onClick={() => proceed("positive")} />
          </>
        )}

        {step === "top" && onTriage && (
          <button className="triage-hint" onClick={onTriage} style={{
            marginTop: 4, width: "100%", padding: "11px 14px", background: C.redLt,
            border: `1.5px solid ${C.red}33`, borderRadius: 9, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 10, fontFamily: "'DM Sans', sans-serif", transition: "background .15s",
          }}>
            <span style={{ fontSize: "1rem" }}>🚨</span>
            <div style={{ textAlign: "left", flex: 1 }}>
              <div style={{ fontSize: ".83rem", fontWeight: 700, color: C.red }}>Something happening right now?</div>
              <div style={{ fontSize: ".7rem", color: C.mist }}>Get live step-by-step guidance &rarr;</div>
            </div>
            <span style={{ color: C.red }}>&rarr;</span>
          </button>
        )}
      </div>
    </div>
  );
}
