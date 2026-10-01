import { useState } from "react";
import Icon from "./Icon.jsx";
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
  // White card, tinted icon tile: injury red, speak-up green, everything else brand.
  const accent = tone === "injury" ? C.red : C.ink;
  const tileBg = tone === "injury" ? C.redLt : tone === "good" ? C.greenLt : C.foam;
  const tileFg = tone === "injury" ? C.red : tone === "good" ? C.green : C.sage;
  const bg     = C.white;
  const border = tone === "injury" ? C.red : C.line;
  return (
    <button className="type-tile" onClick={onClick} style={{
      width: "100%", padding: "18px 16px", textAlign: "left",
      background: bg, border: `1.5px solid ${border}`, borderRadius: 13, cursor: "pointer",
      boxShadow: "0 2px 8px rgba(15,31,23,.08)", fontFamily: "'DM Sans', sans-serif",
      display: "flex", alignItems: "center", gap: 14, transition: "transform .12s",
    }}>
      <span style={{ width: 46, height: 46, borderRadius: 13, background: tileBg, color: tileFg, display: "flex", alignItems: "center",
                     justifyContent: "center", flexShrink: 0 }}><Icon name={icon} size={24} stroke={2} /></span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: "1rem", fontWeight: 700, lineHeight: 1.2, color: accent }}>{label}</div>
        {sub && <div style={{ fontSize: ".82rem", color: C.slate, marginTop: 2, lineHeight: 1.3 }}>{sub}</div>}
      </div>
      <span style={{ color: accent, fontSize: "1.1rem", flexShrink: 0 }}>›</span>
    </button>
  );
}

export default function S2a1IncidentType({
  user = { name: "Responder", site: "Moriah" },
  onContinue, onBack, onTriage, onHome, initialStep = "top",
}) {
  // step: "top" -> "flag" -> "idea". Injury peels off to triage; terminal tiles
  // call proceed() with a resolved type. Fewer taps than the old flat grid, and
  // every tap encodes a real routing distinction rather than making the worker
  // read a wall of options. initialStep lets other entry points (e.g. coming back
  // from triage once the situation is handled) skip the top-level choice.
  const [step, setStep] = useState(initialStep);
  const nowStr = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const [site] = useState(user.site ?? SITES[0]);
  const [datetime] = useState(nowStr);

  const proceed = (type) => onContinue?.({ type, site, datetime });
  const goBack  = () => step === "idea" ? setStep("flag")
                      : step === "flag" && initialStep !== "flag" ? setStep("top")
                      : onBack?.();

  const HEAD = {
    top:  { h: "What's going on?", p: "Pick the closest — it only takes a moment." },
    flag: { h: "What would you like to flag?", p: "Pick the closest fit — you can add detail next." },
    idea: { h: "What would you like to share?", p: "" },
  }[step];

  return (
    <div style={{ height: "100dvh", minHeight: "100vh", background: C.chalk, fontFamily: "'DM Sans', sans-serif", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .type-tile:hover { transform: translateY(-2px); } .type-tile:active { transform: scale(.98); }
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
            <Card icon="bandage" label="Report an injury" sub="Someone got hurt or ill" tone="injury"
              onClick={() => (onTriage ? onTriage() : proceed("injury"))} />
            <Card icon="flag" label="Flag something" sub="A hazard, damage, or an idea to share"
              onClick={() => setStep("flag")} />
          </>
        )}

        {step === "flag" && (
          <>
            <Card icon="alert" label="A risk or hazard" sub="Something unsafe, or a close call"
              onClick={() => proceed("hazard")} />
            <Card icon="wrench" label="Damage or a security issue" sub="Property, equipment, or a security concern"
              onClick={() => proceed("property")} />
            <Card icon="bulb" label="An idea or a shout-out" sub="A better way, or someone doing it right" tone="good"
              onClick={() => setStep("idea")} />
          </>
        )}

        {step === "idea" && (
          <>
            <Card icon="bulb" label="I have an idea" sub="A way to make things safer or better" tone="good"
              onClick={() => proceed("idea")} />
            <Card icon="thumb" label="Give a shout-out" sub="Someone did something right" tone="good"
              onClick={() => proceed("positive")} />
          </>
        )}

      </div>
    </div>
  );
}
