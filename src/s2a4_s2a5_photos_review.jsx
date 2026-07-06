import { useState, useEffect, useRef } from "react";
import { EHSHeader } from "./AppShell.jsx";
import { BRAND, COLORS } from "./constants.js";
import { api } from "./api.js";

const C = { ...COLORS };

const INCIDENT_TYPE_LABELS = {
  injury:        "Injury",
  near_miss:     "Near Miss",
  property:      "Property Damage",
  environmental: "Environmental Release",
  vehicle:       "Vehicle Incident",
  security:      "Security Event",
};

const SEVERITY_COLORS = {
  minor:       C.pine,
  significant: C.gold,
  serious:     C.red,
};

function MobileProgress({ step, total }) {
  return (
    <div style={{ display: "flex", gap: 4, padding: "0 20px" }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          flex: 1, height: 3, borderRadius: 2,
          background: i < step ? C.sage : i === step ? C.mint : "#E2EBE6",
        }} />
      ))}
    </div>
  );
}

// ── Photo thumb ───────────────────────────────────────────────────────────────
function PhotoThumb({ photo, onRemove }) {
  return (
    <div style={{
      position: "relative", width: 80, height: 80,
      borderRadius: 8, overflow: "hidden",
      border: "2px solid #E2EBE6", flexShrink: 0,
    }}>
      <img src={photo.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      {photo.gps && (
        <div style={{
          position: "absolute", bottom: 3, left: 3,
          background: "rgba(0,0,0,.55)", borderRadius: 3,
          fontSize: ".55rem", color: C.white, padding: "1px 4px",
        }}>📍</div>
      )}
      <button onClick={() => onRemove(photo.id)} style={{
        position: "absolute", top: 3, right: 3,
        width: 18, height: 18, borderRadius: "50%",
        background: "rgba(0,0,0,.6)", border: "none",
        color: C.white, fontSize: ".7rem", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>×</button>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// S2a4 — Photos & Location
// ════════════════════════════════════════════════════════════════════════════
export function S2a4PhotosLocation({ onContinue, onBack, onHome, site }) {
  const siteRec = (BRAND.siteRecords ?? []).find(s => s.name === site);
  const [plan, setPlan] = useState(null);
  const [showPlan, setShowPlan] = useState(false);
  const [floorPos, setFloorPos] = useState(null);   // { x, y } as % of image
  useEffect(() => {
    if (siteRec?.hasFloorplan) {
      api.siteFloorplan(siteRec.id).then(r => setPlan(r.floorplan)).catch(() => {});
    }
  }, [siteRec?.id]);
  const [photos,     setPhotos]    = useState([]);
  const [anonymous,  setAnonymous] = useState(false);
  const [gpsGranted, setGps]       = useState(false);
  const [floorPlan,  setFloorPlan] = useState(false);
  const fileRef = useRef(null);
  const nextId  = useRef(1);

  function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    const newPhotos = files.map(file => ({
      id:  nextId.current++,
      url: URL.createObjectURL(file),
      gps: gpsGranted,
      name: file.name,
    }));
    setPhotos(p => [...p, ...newPhotos]);
    e.target.value = "";
  }

  const [gpsCoords, setGpsCoords] = useState(null);
  const [gpsError, setGpsError] = useState(null);
  function handleRequestGps() {
    if (!navigator.geolocation) { setGpsError("Location not supported on this device"); return; }
    navigator.geolocation.getCurrentPosition(
      pos => { setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGps(true); },
      err => setGpsError(err.code === 1 ? "Location permission denied" : "Could not get location"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function removePhoto(id) {
    setPhotos(p => p.filter(x => x.id !== id));
  }

  return (
    <div style={{
      minHeight: "100vh", background: C.chalk,
      fontFamily: "'DM Sans', sans-serif", display: "flex", flexDirection: "column",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .anim { animation: fadeUp .22s ease both; }
        .photo-add:hover { background: ${C.foam} !important; border-color: ${C.sage} !important; }
        .continue-btn:hover { background: ${C.pine} !important; }
      `}</style>

      <EHSHeader onHome={onHome} rightContent={<button onClick={onBack} style={{ background: "none", border: "none", color: C.mint, fontSize: ".85rem", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>← Back</button>} />

      <div style={{ padding: "14px 0 6px" }}><MobileProgress step={3} total={5} /></div>

      <div style={{ flex: 1, padding: "16px 20px 100px", overflowY: "auto" }}>
        <div className="anim" style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: "1.3rem", fontWeight: 700, color: C.ink }}>Photos & location</h1>
          <p style={{ fontSize: ".85rem", color: C.mist, marginTop: 4 }}>Add photos and confirm the location. Both are optional but help with investigation.</p>
        </div>

        {/* Photo area */}
        <div className="anim" style={{ background: C.white, borderRadius: 10, boxShadow: "0 1px 8px rgba(15,31,23,.06)", padding: 16, marginBottom: 14 }}>
          <div style={{ fontSize: ".7rem", fontWeight: 600, letterSpacing: ".07em", textTransform: "uppercase", color: C.sage, marginBottom: 10 }}>Photos</div>

          <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleFileSelect} />

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {photos.map(p => <PhotoThumb key={p.id} photo={p} onRemove={removePhoto} />)}

            {/* Add photo button */}
            <div
              className="photo-add"
              onClick={() => fileRef.current?.click()}
              style={{
                width: 80, height: 80, borderRadius: 8,
                border: "2px dashed #C8DDD2", background: C.chalk,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                cursor: "pointer", transition: "all .15s", gap: 4,
              }}
            >
              <span style={{ fontSize: "1.3rem" }}>📷</span>
              <span style={{ fontSize: ".65rem", color: C.sage, fontWeight: 600 }}>Add</span>
            </div>
          </div>

          {photos.length > 0 && (
            <div style={{ fontSize: ".72rem", color: C.mist, marginTop: 8 }}>
              {photos.length} photo{photos.length > 1 ? "s" : ""} · {photos.filter(p => p.gps).length} GPS-tagged
            </div>
          )}
        </div>

        {/* GPS */}
        <div className="anim" style={{ background: C.white, borderRadius: 10, boxShadow: "0 1px 8px rgba(15,31,23,.06)", padding: 16, marginBottom: 14 }}>
          <div style={{ fontSize: ".7rem", fontWeight: 600, letterSpacing: ".07em", textTransform: "uppercase", color: C.sage, marginBottom: 10 }}>Location</div>
          {gpsGranted ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "10px 12px", background: C.foam, borderRadius: 8 }}>
              <span>📍</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: ".85rem", color: C.pine }}>GPS location captured</div>
                <div style={{ fontSize: ".72rem", color: C.mist }}>{gpsCoords ? `${gpsCoords.lat.toFixed(5)}, ${gpsCoords.lng.toFixed(5)}` : "Captured"} · attached to this report</div>
              </div>
            </div>
          ) : (
            <button onClick={handleRequestGps} style={{
              width: "100%", padding: "12px", background: C.chalk,
              border: "1.5px solid #D0DEDB", borderRadius: 8,
              fontFamily: "'DM Sans', sans-serif", fontSize: ".88rem", color: C.slate,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}>
              📍 Auto-tag GPS location
            </button>
          )}
        </div>

        {gpsError && <div style={{ fontSize: ".76rem", color: "#C0392B", margin: "-8px 0 14px 4px" }}>{gpsError}</div>}

        {/* Floor plan — only when this site has one uploaded */}
        {plan && (
          <div className="anim" style={{ background: C.white, borderRadius: 10, boxShadow: "0 1px 8px rgba(15,31,23,.06)", padding: 16, marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: ".88rem", color: C.ink }}>Mark location on floor plan</div>
                <div style={{ fontSize: ".72rem", color: C.mist, marginTop: 2 }}>{floorPos ? "Location marked — tap to adjust" : "Tap to open the site map"}</div>
              </div>
              <button onClick={() => setShowPlan(true)} style={{
                padding: "7px 14px", background: floorPos ? C.sage : C.white,
                color: floorPos ? C.white : C.pine,
                border: `1.5px solid ${floorPos ? C.sage : C.mint}`,
                borderRadius: 6, fontFamily: "'DM Sans', sans-serif",
                fontSize: ".78rem", fontWeight: 600, cursor: "pointer",
              }}>{floorPos ? "✓ Marked" : "Open map"}</button>
            </div>
          </div>
        )}
        {showPlan && plan && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(15,31,23,.85)", zIndex: 500, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 14 }}>
            <div style={{ color: "#fff", fontSize: ".85rem", marginBottom: 10, fontFamily: "'DM Sans', sans-serif" }}>Tap the incident location</div>
            <div style={{ position: "relative", maxWidth: "100%", maxHeight: "78vh" }}>
              <img src={plan} alt="Floor plan" style={{ maxWidth: "100%", maxHeight: "78vh", borderRadius: 8, display: "block" }}
                onClick={e => {
                  const r = e.target.getBoundingClientRect();
                  setFloorPos({ x: +(((e.clientX - r.left) / r.width) * 100).toFixed(1),
                                y: +(((e.clientY - r.top) / r.height) * 100).toFixed(1) });
                }} />
              {floorPos && (
                <div style={{ position: "absolute", left: `${floorPos.x}%`, top: `${floorPos.y}%`, transform: "translate(-50%, -90%)", fontSize: "1.6rem", pointerEvents: "none" }}>📍</div>
              )}
            </div>
            <button onClick={() => setShowPlan(false)} style={{ marginTop: 14, padding: "10px 28px", background: C.sage, color: "#fff", border: "none", borderRadius: 8, fontSize: ".9rem", fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
              {floorPos ? "Done" : "Close"}
            </button>
          </div>
        )}
        {false && (<>
        <div className="anim" style={{ background: C.white, borderRadius: 10, boxShadow: "0 1px 8px rgba(15,31,23,.06)", padding: 16, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: ".88rem", color: C.ink }}>Floor plan overlay</div>
              <div style={{ fontSize: ".72rem", color: C.mist, marginTop: 2 }}>Tap to mark exact location on site map</div>
            </div>
            <button
              onClick={() => setFloorPlan(f => !f)}
              style={{
                padding: "7px 14px", background: floorPlan ? C.sage : C.white,
                color: floorPlan ? C.white : C.pine,
                border: `1.5px solid ${floorPlan ? C.sage : C.mint}`,
                borderRadius: 6, fontFamily: "'DM Sans', sans-serif",
                fontSize: ".78rem", fontWeight: 600, cursor: "pointer",
              }}
            >{floorPlan ? "✓ Marked" : "Open map"}</button>
          </div>
        </div>

        </>)}

        {/* Anonymous submission removed by policy */}
        {false && (<>
        <div className="anim" style={{ background: C.white, borderRadius: 10, boxShadow: "0 1px 8px rgba(15,31,23,.06)", padding: 16 }}>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }}>
            <input type="checkbox" checked={anonymous} onChange={e => setAnonymous(e.target.checked)}
              style={{ width: "auto", accentColor: C.sage, marginTop: 2 }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: ".88rem", color: C.ink }}>Submit anonymously</div>
              <div style={{ fontSize: ".72rem", color: C.mist, marginTop: 2, lineHeight: 1.4 }}>
                Your name won't appear on the report. Site Manager will still be notified of the incident.
              </div>
            </div>
          </label>
        </div>
        </>)}
      </div>

      <div style={{ position: "fixed", bottom: 58, left: 0, right: 0, padding: "14px 20px", background: C.white, borderTop: "1px solid #E2EBE6", boxShadow: "0 -4px 20px rgba(0,0,0,.06)" }}>
        <button className="continue-btn" onClick={() => onContinue?.({ photos, gpsGranted, gpsCoords, floorPos, anonymous: false })} style={{
          width: "100%", padding: "14px", background: C.sage, color: C.white,
          border: "none", borderRadius: 9, fontFamily: "'DM Sans', sans-serif",
          fontSize: ".95rem", fontWeight: 700, cursor: "pointer", transition: "all .18s",
        }}>Review & submit →</button>
      </div>
    </div>
  );
}


// ════════════════════════════════════════════════════════════════════════════
// S2a5 — Review & Submit
// ════════════════════════════════════════════════════════════════════════════

export function S2a5ReviewSubmit({ flowData = {}, onSubmit, onBack, onHome }) {
  const [optionalChecked, setOptionalChecked] = useState({});
  const [submitting,      setSubmitting]       = useState(false);

  // Rules-driven recipient preview: resolve who will actually be notified
  const [LOCKED_RECIPIENTS, setLocked] = useState([]);
  useEffect(() => {
    Promise.all([api.notificationRules().catch(() => []), api.staffDirectory().catch(() => [])])
      .then(([rules, dir]) => {
        const isInjury = (flowData.type ?? "injury") === "injury";
        const events = ["incident_any", ...(isInjury ? ["incident_injury"] : [])];
        const active = rules.filter(r => events.includes(r.event));
        const roleSet = new Set(), idSet = new Set();
        active.forEach(r => {
          JSON.parse(r.recipient_roles || "[]").forEach(x => roleSet.add(x));
          JSON.parse(r.recipient_users || "[]").forEach(x => idSet.add(x));
        });
        const people = dir.filter(u => roleSet.has(u.role) || idSet.has(u.id));
        setLocked(people.length
          ? people.map(u => ({ id: u.id, name: u.name, role: u.role.replace("_", " "), site: u.site ?? "" }))
          : [{ id: "none", name: "No matching notification rules", role: "Configure in Company Settings", site: "" }]);
      });
  }, [flowData.type]);
  const OPTIONAL_RECIPIENTS = [];

  const {
    type       = "injury",
    site       = "Moriah",
    dept       = "Bottling & Packaging",
    datetime   = new Date().toISOString(),
    description= "Staff member slipped on wet floor near bottling line 2.",
    severity   = "significant",
    involved   = { type: "staff", person: { first: "Sarah", last: "Mitchell" } },
    photos     = [],
  } = flowData;

  const involveName = involved?.type === "staff"
    ? `${involved.person?.first} ${involved.person?.last}`
    : involved?.visitor?.name ?? "—";

  function toggleOptional(id) {
    setOptionalChecked(s => ({ ...s, [id]: !s[id] }));
  }

  function handleSubmit() {
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      onSubmit?.({ ...flowData, optionalRecipients: Object.keys(optionalChecked).filter(k => optionalChecked[k]) });
    }, 1200);
  }

  const summaryRows = [
    { label: "Type",        value: INCIDENT_TYPE_LABELS[type] ?? type },
    { label: "Site",        value: site },
    { label: "Department",  value: dept },
    { label: "Date/time",   value: new Date(datetime).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) },
    { label: "Severity",    value: <span style={{ fontWeight: 700, color: SEVERITY_COLORS[severity] }}>{severity.charAt(0).toUpperCase() + severity.slice(1)}</span> },
    { label: "Involved",    value: involveName },
    { label: "Photos",      value: photos.length > 0 ? `${photos.length} attached` : "None" },
  ];

  return (
    <div style={{
      minHeight: "100vh", background: C.chalk,
      fontFamily: "'DM Sans', sans-serif", display: "flex", flexDirection: "column",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        .anim { animation: fadeUp .22s ease both; }
        .submit-btn:hover:not(:disabled) { background: ${C.pine} !important; transform: translateY(-1px); box-shadow: 0 4px 14px rgba(45,90,61,.3); }
      `}</style>

      <EHSHeader onHome={onHome} rightContent={<button onClick={onBack} style={{ background: "none", border: "none", color: C.mint, fontSize: ".85rem", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>← Back</button>} />

      <div style={{ padding: "14px 0 6px" }}><MobileProgress step={4} total={5} /></div>

      <div style={{ flex: 1, padding: "16px 20px 100px", overflowY: "auto" }}>

        <div className="anim" style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: "1.3rem", fontWeight: 700, color: C.ink }}>Review & submit</h1>
          <p style={{ fontSize: ".85rem", color: C.mist, marginTop: 4 }}>Check the details before sending.</p>
        </div>

        {/* Summary card */}
        <div className="anim" style={{ background: C.white, borderRadius: 10, boxShadow: "0 1px 8px rgba(15,31,23,.06)", overflow: "hidden", marginBottom: 14 }}>
          {summaryRows.map((row, i) => (
            <div key={i} style={{
              display: "flex", padding: "10px 16px", gap: 12,
              borderBottom: i < summaryRows.length - 1 ? "1px solid #F0F4F2" : "none",
            }}>
              <div style={{ fontSize: ".72rem", fontWeight: 600, color: C.mist, width: 90, flexShrink: 0, paddingTop: 2, textTransform: "uppercase", letterSpacing: ".04em" }}>
                {row.label}
              </div>
              <div style={{ fontSize: ".88rem", color: C.ink, flex: 1 }}>{row.value}</div>
            </div>
          ))}
          {/* Description */}
          <div style={{ padding: "10px 16px", borderTop: "1px solid #F0F4F2" }}>
            <div style={{ fontSize: ".72rem", fontWeight: 600, color: C.mist, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 5 }}>Description</div>
            <div style={{ fontSize: ".85rem", color: C.ink, lineHeight: 1.5 }}>{description}</div>
          </div>
        </div>

        {/* Notifications */}
        <div className="anim" style={{ background: C.white, borderRadius: 10, boxShadow: "0 1px 8px rgba(15,31,23,.06)", padding: 16, marginBottom: 14 }}>
          <div style={{ fontSize: ".7rem", fontWeight: 600, letterSpacing: ".07em", textTransform: "uppercase", color: C.sage, marginBottom: 12 }}>
            Who will be notified
          </div>

          {/* Spec: locked recipients — no checkbox */}
          {LOCKED_RECIPIENTS.map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #F0F4F2" }}>
              <div style={{ width: 22, height: 22, borderRadius: "50%", background: C.sage, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ color: C.white, fontSize: ".65rem" }}>✓</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: ".85rem", fontWeight: 600, color: C.ink }}>{r.name}</div>
                <div style={{ fontSize: ".72rem", color: C.mist }}>{r.role} · {r.site}</div>
              </div>
              <span style={{ fontSize: ".68rem", color: C.mist, fontStyle: "italic" }}>Required</span>
            </div>
          ))}

          {/* Spec: optional recipients — unchecked by default */}
          {OPTIONAL_RECIPIENTS.map(r => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #F0F4F2" }}>
              <input
                type="checkbox" checked={!!optionalChecked[r.id]}
                onChange={() => toggleOptional(r.id)}
                style={{ width: 18, height: 18, accentColor: C.sage, flexShrink: 0, cursor: "pointer" }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: ".85rem", color: C.ink }}>{r.name !== "—" ? r.name : r.role}</div>
                <div style={{ fontSize: ".72rem", color: C.mist }}>{r.role} · {r.site}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ position: "fixed", bottom: 58, left: 0, right: 0, padding: "14px 20px", background: C.white, borderTop: "1px solid #E2EBE6", boxShadow: "0 -4px 20px rgba(0,0,0,.06)" }}>
        <button
          className="submit-btn"
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            width: "100%", padding: "14px",
            background: submitting ? C.sage + "88" : C.sage,
            color: C.white, border: "none", borderRadius: 9,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: ".95rem", fontWeight: 700,
            cursor: submitting ? "default" : "pointer",
            transition: "all .18s",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          }}
        >
          {submitting ? (
            <>
              <span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,.4)", borderTopColor: C.white, borderRadius: "50%", display: "inline-block", animation: "spin .7s linear infinite" }} />
              Submitting…
            </>
          ) : "Submit incident report →"}
        </button>
      </div>
    </div>
  );
}
