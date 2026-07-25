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
// OSHA 1904.7 general recording criteria — checking any of these strongly suggests
// the case is recordable. Kept in plain language so a line worker can answer.
const OSHA_SIGNALS = [
  { id: "medical",       label: "Needed medical treatment beyond basic first aid" },
  { id: "days_away",     label: "Missed work / will miss work because of it" },
  { id: "restricted",    label: "Put on restricted duty or a different job" },
  { id: "unconscious",   label: "Lost consciousness" },
  { id: "diagnosis",     label: "Got a significant diagnosis (fracture, etc.) from a doctor" },
];
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

function Label({ children, style }) {
  return (
    <div style={{ fontSize: ".7rem", fontWeight: 600, letterSpacing: ".07em", textTransform: "uppercase", color: C.sage, marginBottom: 5, ...style }}>
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
  // Voice-to-text: line workers often have gloves or full hands. The Web Speech API
  // (SpeechRecognition) is built into mobile Chrome/Safari — no dependency. We append
  // transcribed speech to whatever's already typed. Gracefully absent where unsupported.
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);
  const speechSupported = typeof window !== "undefined" &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);

  function toggleDictation() {
    if (!speechSupported) return;
    if (listening) { recognitionRef.current?.stop(); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e) => {
      const said = Array.from(e.results).map(r => r[0].transcript).join(" ").trim();
      if (said) setDescription(d => (d.trim() ? d.trim() + " " : "") + said);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  }
  const [location,    setLocation]    = useState("");
  // ── Location capture (moved here from the old separate "Photos & location"
  // step, which was redundant: photos are already collected on THIS screen).
  // GPS and the floorplan pin answer different questions and are deliberately
  // independent — GPS records where the reporter physically stood (useful in
  // yards / tank farms / multi-building sites), while the floorplan pin is a
  // manual tap that stays accurate indoors, where phone GPS (5-20m, worse
  // inside steel-and-concrete buildings) would often land in the wrong room.
  const [gpsCoords,  setGpsCoords]  = useState(null);
  const [gpsError,   setGpsError]   = useState(null);
  const [plan,       setPlan]       = useState(null);
  const [floorPos,   setFloorPos]   = useState(null);   // { x, y } as % of image
  const [mapOpen,    setMapOpen]    = useState(false);
  const [site,        setSite]        = useState(initialSite ?? SITES[0]);
  const [severity,    setSeverity]    = useState(null);
  const [injuryType,  setInjuryType]  = useState("");
  // OSHA general recording criteria (1904.7): if the injury led to any of these
  // outcomes it's very likely recordable. We ask a few quick yes/no signals and
  // SUGGEST a flag — safety still makes the formal call. Empty = no signal yet.
  const [oshaSignals, setOshaSignals] = useState([]);
  const toggleSignal = (id) => setOshaSignals(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const [descFocused, setDescFocused] = useState(false);
  const [locFocused,  setLocFocused]  = useState(false);
  const [recognizedUserId, setRecognizedUserId] = useState("");
  const [users, setUsers] = useState([]);
  const [photos, setPhotos] = useState([]);

  // Only offer the floorplan pin when the selected site actually has a plan.
  const siteRec = (BRAND.siteRecords ?? []).find(s0 => s0.name === site);
  useEffect(() => {
    setPlan(null); setFloorPos(null);           // switching site invalidates any pin
    if (siteRec?.hasFloorplan) {
      api.siteFloorplan(siteRec.id).then(r => setPlan(r.floorplan)).catch(() => {});
    }
  }, [siteRec?.id, siteRec?.hasFloorplan]);

  function handleRequestGps() {
    setGpsError(null);
    if (!navigator.geolocation) { setGpsError("Location isn't supported on this device"); return; }
    navigator.geolocation.getCurrentPosition(
      pos => setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      err => setGpsError(err.code === 1 ? "Location permission denied" : "Couldn't get your location"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }
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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <Label style={{ marginBottom: 0 }}>Describe what happened</Label>
            {speechSupported && (
              <button type="button" onClick={toggleDictation} style={{
                display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 20,
                border: `1.5px solid ${listening ? C.red : C.mint}`,
                background: listening ? "rgba(192,57,43,.08)" : C.foam,
                color: listening ? C.red : C.pine, fontFamily: "'DM Sans', sans-serif",
                fontSize: ".76rem", fontWeight: 700, cursor: "pointer",
              }}>
                {listening ? "● Listening…" : "🎤 Speak"}
              </button>
            )}
          </div>
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

        {/* Pinpoint location — optional, and only as precise as the reporter can
            honestly be. Both controls are opt-in so a report filed later from a
            desk never silently attaches the wrong place. */}
        {(true) && (
          <div className="anim" style={{ background: C.white, borderRadius: 10, boxShadow: "0 1px 8px rgba(15,31,23,.06)", padding: 16, marginBottom: 14 }}>
            <Label>Pinpoint the location (optional)</Label>

            {gpsCoords ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "10px 12px", background: C.foam, borderRadius: 8 }}>
                <span>📍</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: ".85rem", color: C.pine }}>GPS location captured</div>
                  <div style={{ fontSize: ".72rem", color: C.mist }}>{gpsCoords.lat.toFixed(5)}, {gpsCoords.lng.toFixed(5)}</div>
                </div>
                <button type="button" onClick={() => setGpsCoords(null)} style={{ background: "none", border: "none", color: C.mist, fontSize: ".75rem", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Remove</button>
              </div>
            ) : (
              <>
                <button type="button" onClick={handleRequestGps} style={{
                  width: "100%", padding: "11px 12px", background: C.white, border: `1.5px solid ${C.mint}`,
                  borderRadius: 8, color: C.pine, fontFamily: "'DM Sans', sans-serif",
                  fontSize: ".88rem", fontWeight: 600, cursor: "pointer",
                }}>📍 Tag my current GPS location</button>
                <div style={{ fontSize: ".72rem", color: C.mist, marginTop: 6, lineHeight: 1.45 }}>
                  Only use this if you're standing at the spot right now — it records where <em>you</em> are, not where the hazard is.
                </div>
              </>
            )}
            {gpsError && <div style={{ fontSize: ".75rem", color: C.red, marginTop: 6 }}>{gpsError}</div>}

            {plan && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #EEF3F0" }}>
                <button type="button" onClick={() => setMapOpen(true)} style={{
                  width: "100%", padding: "11px 12px",
                  background: floorPos ? C.sage : C.white,
                  color: floorPos ? C.white : C.pine,
                  border: `1.5px solid ${floorPos ? C.sage : C.mint}`,
                  borderRadius: 8, fontFamily: "'DM Sans', sans-serif",
                  fontSize: ".88rem", fontWeight: 600, cursor: "pointer",
                }}>{floorPos ? "✓ Marked on site map — tap to adjust" : "🗺️ Mark the spot on the site map"}</button>
                <div style={{ fontSize: ".72rem", color: C.mist, marginTop: 6, lineHeight: 1.45 }}>
                  More precise than GPS indoors — you place the pin yourself.
                </div>
              </div>
            )}
          </div>
        )}

        {/* Floorplan pin modal */}
        {mapOpen && plan && (
          <div onClick={() => setMapOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(15,31,23,.55)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: C.white, borderRadius: 12, padding: 14, width: "100%", maxWidth: 560 }}>
              <div style={{ fontSize: ".85rem", fontWeight: 700, color: C.ink, marginBottom: 8 }}>Tap where it happened</div>
              <div style={{ position: "relative", width: "100%" }}
                onClick={e => {
                  const r = e.currentTarget.getBoundingClientRect();
                  setFloorPos({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
                }}>
                <img src={plan} alt="Site floorplan" style={{ width: "100%", display: "block", borderRadius: 8 }} />
                {floorPos && (
                  <div style={{ position: "absolute", left: `${floorPos.x}%`, top: `${floorPos.y}%`, transform: "translate(-50%, -90%)", fontSize: "1.6rem", pointerEvents: "none" }}>📍</div>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                {floorPos && (
                  <button type="button" onClick={() => setFloorPos(null)} style={{ padding: "9px 14px", background: "none", border: "1px solid #D0DEDB", borderRadius: 7, color: C.slate, fontSize: ".82rem", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Clear pin</button>
                )}
                <button type="button" onClick={() => setMapOpen(false)} style={{ flex: 1, padding: "9px 0", background: C.sage, color: "#fff", border: "none", borderRadius: 7, fontSize: ".85rem", fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                  {floorPos ? "Done" : "Close"}
                </button>
              </div>
            </div>
          </div>
        )}

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

            {/* Recordability signals — quick yes/no outcome checks. Any checked →
                we surface a "looks recordable" flag so it's prioritised for the
                300 log. Informational + non-accusatory; safety makes the formal call. */}
            {showOsha && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: ".76rem", fontWeight: 700, color: C.pine, marginBottom: 8 }}>
                  Did any of these happen? <span style={{ fontWeight: 400, color: C.mist }}>(helps us log it correctly)</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {OSHA_SIGNALS.map(sig => {
                    const on = oshaSignals.includes(sig.id);
                    return (
                      <label key={sig.id} style={{
                        display: "flex", alignItems: "flex-start", gap: 9, padding: "9px 11px", borderRadius: 8,
                        border: `1.5px solid ${on ? C.sage : "#E2EBE6"}`, background: on ? C.foam : C.white,
                        cursor: "pointer", transition: "all .12s",
                      }}>
                        <input type="checkbox" checked={on} onChange={() => toggleSignal(sig.id)}
                          style={{ width: 16, height: 16, marginTop: 1, accentColor: C.sage, flexShrink: 0 }} />
                        <span style={{ fontSize: ".82rem", color: C.ink, lineHeight: 1.4 }}>{sig.label}</span>
                      </label>
                    );
                  })}
                </div>

                {oshaSignals.length > 0 ? (
                  <div style={{
                    marginTop: 11, padding: "11px 13px", background: "rgba(180,83,9,.08)",
                    borderLeft: `3px solid #B45309`, borderRadius: 7, fontSize: ".8rem", color: "#8A4B0A", lineHeight: 1.55,
                  }}>
                    <strong>⚠ This looks OSHA-recordable.</strong> We'll flag it for your Safety Officer to review and log on the 300 if needed. You don't need to do anything else — just submit.
                  </div>
                ) : (
                  <div style={{
                    marginTop: 11, padding: "11px 13px", background: C.foam, borderLeft: `3px solid ${C.sage}`,
                    borderRadius: 7, fontSize: ".8rem", color: C.pine, lineHeight: 1.55,
                  }}>
                    Your Safety Officer makes the formal recordability determination — you don't need to classify it now.
                  </div>
                )}
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
          onClick={() => canContinue && onContinue?.({ description, location, severity, injuryType, site, recognizedUserId: recognizedUserId || null, photos, gpsCoords, floorPos, oshaSignals, oshaRecordableSuggested: isInjury && oshaSignals.length > 0 })}
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
