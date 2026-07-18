import { COLORS, SITES, BRAND } from "./constants.js";
import { useState, useEffect, useRef } from "react";
import { api } from "./api.js";
import { EHSHeader } from "./AppShell.jsx";

const C = { ...COLORS };

// Spec: plain-language 3-tier scale. OSHA classification NOT shown to reporter.
const SEVERITIES = [
  {
    id: "minor",
    label: "Minor",
    desc: "Small injury or issue, handled on site",
    examples: "Cut, bruise, near miss, small spill",
    color: C.pine,
    bg: C.foam,
    border: C.mint,
  },
  {
    id: "significant",
    label: "Significant",
    desc: "Requires more than basic first aid or causes notable disruption",
    examples: "Possible fracture, chemical exposure, equipment damage",
    color: C.gold,
    bg: C.goldLt,
    border: "#F0D090",
  },
  {
    id: "serious",
    label: "Serious",
    desc: "Potential lost time, major damage, or life safety concern",
    examples: "Ambulance called, major release, fire",
    color: C.red,
    bg: C.redLt,
    border: "#F5C6C2",
  },
];

// Spec: contextual OSHA guidance shown when injury type selected — informational only
const INJURY_TYPES = ["Laceration / Cut", "Sprain / Strain", "Fracture", "Burns", "Chemical exposure", "Head injury", "Eye injury", "Other injury"];
const NON_INJURY_GUIDANCE = null; // only shown for injury types

function MobileProgress({ step, total }) {
  return (
    <div style={{ display: "flex", gap: 4, padding: "0 20px" }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          flex: 1, height: 3, borderRadius: 2,
          background: i < step ? C.sage : i === step ? C.mint : "#E2EBE6",
          transition: "background .3s",
        }} />
      ))}
    </div>
  );
}

function Label({ children }) {
  return (
    <div style={{ fontSize: ".7rem", fontWeight: 600, letterSpacing: ".07em", textTransform: "uppercase", color: C.sage, marginBottom: 5 }}>
      {children}
    </div>
  );
}

function SelectInput({ value, onChange, options, placeholder }) {
  const [focused, setFocused] = useState(false);
  return (
    <select
      value={value} onChange={e => onChange(e.target.value)}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={{
        width: "100%", padding: "11px 12px",
        border: `1.5px solid ${focused ? C.sage : "#D0DEDB"}`,
        borderRadius: 8, fontFamily: "'DM Sans', sans-serif",
        fontSize: ".9rem", color: value ? C.ink : C.mist,
        background: C.white, outline: "none",
        boxShadow: focused ? `0 0 0 3px rgba(74,140,92,.12)` : "none",
        transition: "all .18s", cursor: "pointer", appearance: "none",
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%238FA3A0'/%3E%3C/svg%3E")`,
        backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", paddingRight: 32,
      }}
    >
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o}>{o}</option>)}
    </select>
  );
}

export default function S2a2WhatHappened({
  incidentType = "injury",
  initialSite,
  onContinue,
  onBack,
  onHome,
}) {
  const [description, setDescription] = useState("");
  const [location,    setLocation]    = useState("");
  const [site,        setSite]        = useState(initialSite ?? SITES[0]);
  const [severity,    setSeverity]    = useState(null);
  const [injuryType,  setInjuryType]  = useState("");
  const [descFocused, setDescFocused] = useState(false);
  const [locFocused,  setLocFocused]  = useState(false);
  const [recognizedUserId, setRecognizedUserId] = useState("");
  const [users, setUsers] = useState([]);
  const [photos, setPhotos] = useState([]);
  const photoInput = useRef(null);
  const galleryInput = useRef(null);
  const nextPhotoId = useRef(1);

  // Compress a captured photo to a reasonable size before we carry it in state.
  async function compressPhoto(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      const MAX = 1280;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL("image/jpeg", 0.72);
    } finally { URL.revokeObjectURL(url); }
  }
  function handlePhotoSelect(e) {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      compressPhoto(file)
        .then(dataUrl => setPhotos(p => [...p, { id: nextPhotoId.current++, url: dataUrl, dataUrl, name: file.name }]))
        .catch(() => setPhotos(p => [...p, { id: nextPhotoId.current++, url: URL.createObjectURL(file), dataUrl: null, name: file.name }]));
    });
    e.target.value = "";
  }

  const isInjury   = incidentType === "injury";
  const isPositive = incidentType === "positive";
  const isIdea     = incidentType === "idea";
  const isEngagement = isPositive || isIdea || incidentType === "observation";
  const showOsha   = isInjury && injuryType !== "";
  // At least one of {a photo, a description} is required — the two are
  // interchangeably optional, so every report carries some context while the
  // barrier stays as low as possible. Severity is still required for non-engagement.
  const hasContext = description.trim() || photos.length > 0;
  const canContinue = hasContext && (isEngagement || severity);

  // Load the roster for the "who are you recognising?" picker (positives only).
  useEffect(() => {
    if (!isPositive) return;
    api.listUsers().then(setUsers).catch(() => setUsers([]));
  }, [isPositive]);

  // Type-aware copy so the screen speaks the worker's language.
  const COPY = {
    positive:    { h: "Nice catch! 👍", p: "Tell us what you saw someone do right.", ph: "What did they do well? (e.g. stopped to lock out the line before clearing a jam)" },
    idea:        { h: "What's your idea? 💡", p: "How could we make things safer or easier?", ph: "Describe your idea — what would you change, and why?" },
    observation: { h: "What did you notice?", p: "Describe what you observed.", ph: "What did you see?" },
    hazard:      { h: "What's the hazard?", p: "Describe what's unsafe so we can fix it.", ph: "What's unsafe, and where?" },
    _default:    { h: "What happened?", p: "Describe it in your own words.", ph: "Describe what happened, what you saw, and what you did…" },
  };
  const copy = COPY[incidentType] ?? COPY._default;

  return (
    <div style={{
      minHeight: "100vh", background: C.chalk,
      fontFamily: "'DM Sans', sans-serif",
      display: "flex", flexDirection: "column",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .anim { animation: fadeUp .22s ease both; }
        .sev-card:hover { transform: translateY(-1px); }
        .sev-card:active { transform: scale(.98); }
        .continue-btn:hover:not(:disabled) { background: ${C.pine} !important; transform: translateY(-1px); box-shadow: 0 4px 14px rgba(45,90,61,.3); }
        textarea::placeholder { color: ${C.mist}; }
        input::placeholder { color: ${C.mist}; }
      `}</style>

      {/* Top bar */}
      <EHSHeader onHome={onHome} rightContent={<button onClick={onBack} style={{ background: "none", border: "none", color: C.mint, fontSize: ".85rem", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>← Back</button>} />

      <div style={{ padding: "14px 0 6px" }}>
        <MobileProgress step={1} total={5} />
      </div>

      <div style={{ flex: 1, padding: "16px 20px 100px", overflowY: "auto" }}>

        <div className="anim" style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: "1.3rem", fontWeight: 700, color: C.ink }}>{copy.h}</h1>
          <p style={{ fontSize: ".85rem", color: C.mist, marginTop: 4 }}>{copy.p}</p>
        </div>

        {/* Photo — lead with it. A photo of the thing is worth more than a
            sentence a busy worker won't write, and it satisfies the "add some
            context" requirement on its own. */}
        <div className="anim" style={{ background: C.white, borderRadius: 10, boxShadow: "0 1px 8px rgba(15,31,23,.06)", padding: "16px", marginBottom: 14 }}>
          <Label>Add a photo</Label>
          <input ref={photoInput} type="file" accept="image/*" capture="environment" multiple onChange={handlePhotoSelect} style={{ display: "none" }} />
          <input ref={galleryInput} type="file" accept="image/*" multiple onChange={handlePhotoSelect} style={{ display: "none" }} />
          {photos.length === 0 ? (
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => photoInput.current?.click()} style={{
                flex: 1, padding: "18px 12px", background: C.foam,
                border: `1.5px dashed ${C.sage}`, borderRadius: 10, cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif", display: "flex", flexDirection: "column",
                alignItems: "center", gap: 5,
              }}>
                <span style={{ fontSize: "1.6rem" }}>📷</span>
                <span style={{ fontSize: ".84rem", fontWeight: 700, color: C.pine }}>Take a photo</span>
              </button>
              <button onClick={() => galleryInput.current?.click()} style={{
                flex: 1, padding: "18px 12px", background: C.foam,
                border: `1.5px dashed ${C.sage}`, borderRadius: 10, cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif", display: "flex", flexDirection: "column",
                alignItems: "center", gap: 5,
              }}>
                <span style={{ fontSize: "1.6rem" }}>🖼️</span>
                <span style={{ fontSize: ".84rem", fontWeight: 700, color: C.pine }}>Choose photo</span>
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {photos.map(p => (
                <div key={p.id} style={{ position: "relative", width: 72, height: 72, borderRadius: 8, overflow: "hidden", border: `1px solid ${C.mint}` }}>
                  <img src={p.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <button onClick={() => setPhotos(ps => ps.filter(x => x.id !== p.id))} style={{
                    position: "absolute", top: 2, right: 2, width: 18, height: 18, borderRadius: "50%",
                    background: "rgba(0,0,0,.6)", color: "#fff", border: "none", fontSize: ".7rem", cursor: "pointer", lineHeight: 1,
                  }}>×</button>
                </div>
              ))}
              <button onClick={() => photoInput.current?.click()} title="Take a photo" style={{
                width: 72, height: 72, borderRadius: 8, background: C.foam,
                border: `1.5px dashed ${C.sage}`, cursor: "pointer", fontSize: "1.4rem", color: C.sage,
              }}>📷</button>
              <button onClick={() => galleryInput.current?.click()} title="Choose from gallery" style={{
                width: 72, height: 72, borderRadius: 8, background: C.foam,
                border: `1.5px dashed ${C.sage}`, cursor: "pointer", fontSize: "1.4rem", color: C.sage,
              }}>🖼️</button>
            </div>
          )}
        </div>

        {/* Description */}
        <div className="anim" style={{ background: C.white, borderRadius: 10, boxShadow: "0 1px 8px rgba(15,31,23,.06)", padding: "16px", marginBottom: 14 }}>
          <Label>Describe what happened</Label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            onFocus={() => setDescFocused(true)}
            onBlur={() => setDescFocused(false)}
            placeholder={copy.ph}
            rows={4}
            style={{
              width: "100%", padding: "10px 12px",
              border: `1.5px solid ${descFocused ? C.sage : "#D0DEDB"}`,
              borderRadius: 8, fontFamily: "'DM Sans', sans-serif",
              fontSize: ".9rem", color: C.ink, background: C.white, outline: "none",
              boxShadow: descFocused ? `0 0 0 3px rgba(74,140,92,.12)` : "none",
              resize: "vertical", lineHeight: 1.5, transition: "all .18s",
            }}
          />
          <div style={{ fontSize: ".72rem", color: C.mist, marginTop: 4, textAlign: "right" }}>
            {description.length < 20 && description.length > 0 ? "Add more detail to help the investigation" : `${description.length} characters`}
          </div>
        </div>

        {/* Site — which location this is about. Defaults to the reporter's home
            site but must be changeable: at a multi-site company a worker may be
            reporting about a different site, and "location within site" text alone
            can't disambiguate NY from KY. */}
        <div className="anim" style={{ background: C.white, borderRadius: 10, boxShadow: "0 1px 8px rgba(15,31,23,.06)", padding: "16px", marginBottom: 14 }}>
          <Label>Which site?</Label>
          <select
            value={site}
            onChange={e => setSite(e.target.value)}
            style={{
              width: "100%", padding: "10px 32px 10px 12px", border: `1.5px solid #D0DEDB`,
              borderRadius: 8, fontFamily: "'DM Sans', sans-serif", fontSize: ".9rem", color: C.ink,
              outline: "none", appearance: "none",
              background: `${C.white} url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%238FA3A0'/%3E%3C/svg%3E") no-repeat right 12px center`,
            }}
          >
            {((BRAND.siteRecords?.length ? BRAND.siteRecords.map(s => s.name) : SITES)).map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Location */}
        <div className="anim" style={{ background: C.white, borderRadius: 10, boxShadow: "0 1px 8px rgba(15,31,23,.06)", padding: "16px", marginBottom: 14 }}>
          <Label>Location within site</Label>
          <input
            value={location}
            onChange={e => setLocation(e.target.value)}
            onFocus={() => setLocFocused(true)}
            onBlur={() => setLocFocused(false)}
            placeholder="e.g. Bottling line 2, Loading dock, Break room"
            style={{
              width: "100%", padding: "10px 12px",
              border: `1.5px solid ${locFocused ? C.sage : "#D0DEDB"}`,
              borderRadius: 8, fontFamily: "'DM Sans', sans-serif",
              fontSize: ".9rem", color: C.ink, background: C.white, outline: "none",
              boxShadow: locFocused ? `0 0 0 3px rgba(74,140,92,.12)` : "none",
              transition: "all .18s",
            }}
          />
        </div>

        {/* Injury sub-type (shown only for injury incidents) */}
        {isInjury && (
          <div className="anim" style={{ background: C.white, borderRadius: 10, boxShadow: "0 1px 8px rgba(15,31,23,.06)", padding: "16px", marginBottom: 14 }}>
            <Label>Type of injury</Label>
            <SelectInput
              value={injuryType}
              onChange={setInjuryType}
              options={INJURY_TYPES}
              placeholder="Select injury type…"
            />

            {/* Spec: contextual OSHA guidance when injury type selected — informational only, not accusatory */}
            {showOsha && (
              <div style={{
                marginTop: 12, padding: "11px 13px",
                background: C.foam, borderLeft: `3px solid ${C.sage}`,
                borderRadius: 7, fontSize: ".8rem", color: C.pine, lineHeight: 1.6,
                animation: "fadeUp .2s ease both",
              }}>
                <strong>What makes an injury recordable?</strong> OSHA requires recording injuries that result in medical treatment beyond first aid, days away from work, restricted duty, or loss of consciousness. Your Safety Officer will make the formal determination after you submit — you don't need to classify it now.
              </div>
            )}
          </div>
        )}

        {/* Who are you recognising? — positives only. This is the peer-kudos hook:
            naming a colleague is what turns a "positive observation" into
            recognition that person actually feels. */}
        {isPositive && (
          <div className="anim" style={{ marginBottom: 14 }}>
            <div style={{ fontSize: ".7rem", fontWeight: 600, letterSpacing: ".07em", textTransform: "uppercase", color: C.sage, marginBottom: 8 }}>
              Who are you recognising? <span style={{ color: C.mist, textTransform: "none", fontWeight: 400 }}>(optional)</span>
            </div>
            <select value={recognizedUserId} onChange={e => setRecognizedUserId(e.target.value)}
              style={{ width: "100%", padding: "12px 14px", border: "1.5px solid #D0DEDB", borderRadius: 10,
                       fontFamily: "'DM Sans', sans-serif", fontSize: ".92rem", color: C.ink, background: C.white }}>
              <option value="">Someone (no name) / a team</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <div style={{ fontSize: ".74rem", color: C.mist, marginTop: 6 }}>
              They'll get a shout-out and a few points. Catching people doing it right is how good habits spread.
            </div>
          </div>
        )}

        {/* Severity — not shown for engagement reports (a kudos isn't "severe"). */}
        {!isEngagement && (
        <div className="anim" style={{ marginBottom: 14 }}>
          <div style={{ fontSize: ".7rem", fontWeight: 600, letterSpacing: ".07em", textTransform: "uppercase", color: C.sage, marginBottom: 10 }}>
            How serious was it?
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {SEVERITIES.map(sev => (
              <div
                key={sev.id}
                className="sev-card"
                onClick={() => setSeverity(sev.id)}
                style={{
                  padding: "14px 16px",
                  background: severity === sev.id ? sev.bg : C.white,
                  border: `2px solid ${severity === sev.id ? sev.color : "#E2EBE6"}`,
                  borderRadius: 10, cursor: "pointer",
                  transition: "all .15s",
                  boxShadow: severity === sev.id ? `0 2px 10px ${sev.color}20` : "0 1px 4px rgba(0,0,0,.04)",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: ".9rem", fontWeight: 700, color: severity === sev.id ? sev.color : C.ink }}>
                      {sev.label}
                    </div>
                    <div style={{ fontSize: ".78rem", color: C.slate, marginTop: 2, lineHeight: 1.4 }}>{sev.desc}</div>
                    <div style={{ fontSize: ".72rem", color: C.mist, marginTop: 3, fontStyle: "italic" }}>e.g. {sev.examples}</div>
                  </div>
                  <div style={{
                    width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                    border: `2px solid ${severity === sev.id ? sev.color : "#D0DEDB"}`,
                    background: severity === sev.id ? sev.color : "none",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all .15s",
                  }}>
                    {severity === sev.id && <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.white }} />}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Spec: OSHA classification is NOT shown — reporter uses plain language only */}
          <div style={{ fontSize: ".72rem", color: C.mist, marginTop: 8, textAlign: "center" }}>
            Your Safety Officer will make the formal OSHA classification after submission.
          </div>
        </div>
        )}
      </div>

      {/* Fixed bottom */}
      <div style={{
        position: "fixed", bottom: 58, left: 0, right: 0,
        padding: "14px 20px", background: C.white,
        borderTop: "1px solid #E2EBE6", boxShadow: "0 -4px 20px rgba(0,0,0,.06)",
      }}>
        <button
          className="continue-btn"
          onClick={() => canContinue && onContinue?.({ description, location, severity, injuryType, site, recognizedUserId: recognizedUserId || null, photos })}
          disabled={!canContinue}
          style={{
            width: "100%", padding: "14px",
            background: canContinue ? C.sage : "#B0C8BA",
            color: C.white, border: "none", borderRadius: 9,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: ".95rem", fontWeight: 700,
            cursor: canContinue ? "pointer" : "default",
            transition: "all .18s",
          }}
        >{!hasContext ? "Add a photo or a few words to continue" : "Who was involved →"}</button>
      </div>
    </div>
  );
}
