import { useState } from "react";
import { EHSHeader } from "./AppShell.jsx";
import { BRAND, SITES } from "./constants.js";

const C = {
  forest: "#1C3A2A", pine: "#2D5A3D", sage: "#4A8C5C",
  mint: "#A8D5B5", foam: "#E8F5EC", ink: "#0F1F17",
  slate: "#4A5568", mist: "#8FA3A0", chalk: "#F4F7F5",
  white: "#FFFFFF", gold: "#C8922A", goldLt: "#FDF3E3",
  red: "#C0392B", redLt: "#FDECEA",
};

// Seed staff directory for lookup
const STAFF_DIRECTORY = [
  { id: 1,  first: "Sarah",  last: "Mitchell", site: "Moriah",      dept: "Bottling & Packaging",   role: "Staff / Trainee"   },
  { id: 2,  first: "Marcus", last: "Webb",      site: "Moriah",      dept: "Warehouse",               role: "Staff / Trainee"   },
  { id: 3,  first: "Tom",    last: "Rivera",    site: "Shoreham",    dept: "Maintenance",             role: "Staff / Trainee"   },
  { id: 4,  first: "Dana",   last: "Kowalski",  site: "Middlebury",  dept: "Production / Distilling", role: "Site Manager"      },
  { id: 5,  first: "Priya",  last: "Nair",      site: "Brandenburg", dept: "Administration",          role: "Site Manager"      },
  { id: 6,  first: "Mia",    last: "Chen",      site: "Middlebury",  dept: "Quality Control",         role: "Inspector"         },
  { id: 7,  first: "Jake",   last: "Larson",    site: "Moriah",      dept: "Bottling & Packaging",    role: "Staff / Trainee"   },
  { id: 8,  first: "Beth",   last: "Torres",    site: "Moriah",      dept: "Bottling & Packaging",    role: "Staff / Trainee"   },
];

function fullName(p) { return `${p.first} ${p.last}`; }

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

function Label({ children }) {
  return (
    <div style={{ fontSize: ".7rem", fontWeight: 600, letterSpacing: ".07em", textTransform: "uppercase", color: C.sage, marginBottom: 5 }}>
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, type = "text" }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type={type} value={value} onChange={e => onChange(e.target.value)}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      placeholder={placeholder}
      style={{
        width: "100%", padding: "10px 12px",
        border: `1.5px solid ${focused ? C.sage : "#D0DEDB"}`,
        borderRadius: 8, fontFamily: "'DM Sans', sans-serif",
        fontSize: ".9rem", color: C.ink, background: C.white, outline: "none",
        boxShadow: focused ? `0 0 0 3px rgba(74,140,92,.12)` : "none",
        transition: "all .18s",
      }}
    />
  );
}

// ââ Staff lookup with typeahead âââââââââââââââââââââââââââââââââââââââââââââââ
function StaffLookup({ onSelect, selected }) {
  const [query,   setQuery]   = useState(selected ? fullName(selected) : "");
  const [focused, setFocused] = useState(false);

  const suggestions = query && !selected
    ? STAFF_DIRECTORY.filter(p =>
        fullName(p).toLowerCase().includes(query.toLowerCase()) ||
        p.dept.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 5)
    : [];

  return (
    <div style={{ position: "relative" }}>
      <Label>Search by name</Label>
      <input
        value={query}
        onChange={e => { setQuery(e.target.value); onSelect(null); }}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder="Type name or departmentâ¦"
        style={{
          width: "100%", padding: "10px 12px",
          border: `1.5px solid ${focused ? C.sage : "#D0DEDB"}`,
          borderRadius: 8, fontFamily: "'DM Sans', sans-serif",
          fontSize: ".9rem", color: C.ink, background: C.white, outline: "none",
          boxShadow: focused ? `0 0 0 3px rgba(74,140,92,.12)` : "none",
          transition: "all .18s",
        }}
      />

      {/* Typeahead dropdown */}
      {suggestions.length > 0 && focused && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 20,
          background: C.white, border: "1.5px solid #D0DEDB",
          borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,.1)",
          overflow: "hidden",
        }}>
          {suggestions.map(p => (
            <div
              key={p.id}
              onClick={() => { onSelect(p); setQuery(fullName(p)); }}
              style={{
                padding: "10px 14px", cursor: "pointer",
                borderBottom: "1px solid #F0F4F2", transition: "background .1s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = C.foam}
              onMouseLeave={e => e.currentTarget.style.background = C.white}
            >
              <div style={{ fontWeight: 600, fontSize: ".88rem", color: C.ink }}>{fullName(p)}</div>
              <div style={{ fontSize: ".72rem", color: C.mist, marginTop: 1 }}>
                {p.dept} Â· {p.site} Â· {p.role}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Selected chip */}
      {selected && (
        <EHSHeader onHome={onHome} />
      )}
    </div>
  );
}

// ââ Visitor / contractor form âââââââââââââââââââââââââââââââââââââââââââââââââ
// Spec: name required, all others optional. Stored in incident_visitors table.
function VisitorForm({ data, onChange }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <Label>Full name <span style={{ color: C.red, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>*</span></Label>
        <TextInput value={data.name} onChange={v => onChange({ ...data, name: v })} placeholder="Required" />
      </div>
      <div>
        <Label>Company / employer</Label>
        <TextInput value={data.company} onChange={v => onChange({ ...data, company: v })} placeholder="Optional" />
      </div>
      <div>
        <Label>Phone</Label>
        <TextInput type="tel" value={data.phone} onChange={v => onChange({ ...data, phone: v })} placeholder="Optional" />
      </div>
      <div>
        <Label>Email</Label>
        <TextInput type="email" value={data.email} onChange={v => onChange({ ...data, email: v })} placeholder="Optional" />
      </div>
    </div>
  );
}

// ââ Telehealth prompt âââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
// Spec: shown when injury + severity Minor or Significant. Suppressed for Serious or no provider.
function TelehealthPrompt({ provider, onDismiss }) {
  if (!provider) return null;
  return (
    <div style={{
      padding: "14px 16px",
      background: C.goldLt,
      border: `1.5px solid #F0D090`,
      borderRadius: 10, marginBottom: 16,
      animation: "fadeUp .2s ease both",
    }}>
      <div style={{ fontWeight: 600, fontSize: ".85rem", color: "#7A5A1A", marginBottom: 6 }}>
        ð Consider calling triage first
      </div>
      <p style={{ fontSize: ".82rem", color: "#9A7A3A", lineHeight: 1.5, marginBottom: 10 }}>
        Before seeking outside medical care, a quick call to your triage provider can help determine the right level of care â and may affect OSHA recordability.
      </p>
      <div style={{ fontWeight: 700, color: "#7A5A1A", marginBottom: 10 }}>
        {provider.name} Â· {provider.phone}
      </div>
      {/* Spec: one-sentence inline note on recordability threshold */}
      <p style={{ fontSize: ".75rem", color: "#B8922A", fontStyle: "italic" }}>
        First aid treatment is generally non-recordable. Medical treatment beyond first aid typically triggers OSHA recordability.
      </p>
      <button onClick={onDismiss} style={{
        marginTop: 10, padding: "7px 14px", background: "none",
        color: "#7A5A1A", border: `1px solid #E8C87A`, borderRadius: 6,
        fontFamily: "'DM Sans', sans-serif", fontSize: ".78rem", cursor: "pointer",
      }}>Understood, continue â</button>
    </div>
  );
}

// ââ Main component ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
export default function S2a3WhoWasInvolved({
  severity        = "minor",       // from s2a2
  incidentType    = "injury",
  triageProvider  = { name: "Concentra", phone: "(800) 555-0147" },
  onContinue,
  onBack,

  onHome,
}) {
  const [mode,             setMode]          = useState("staff");   // "staff" | "visitor"
  const [selectedStaff,   setSelectedStaff]  = useState(null);
  const [visitorData,     setVisitorData]    = useState({ name: "", company: "", phone: "", email: "" });
  const [showTelehealth,  setShowTelehealth] = useState(
    incidentType === "injury" && (severity === "minor" || severity === "significant")
  );

  // Spec: telehealth prompt suppressed for Serious severity
  const showPrompt = showTelehealth && severity !== "serious" && triageProvider;

  const canContinue = mode === "staff"
    ? !!selectedStaff
    : visitorData.name.trim().length > 0;

  function handleContinue() {
    if (!canContinue) return;
    const involved = mode === "staff"
      ? { type: "staff",   person: selectedStaff }
      : { type: "visitor", visitor: visitorData  };
    onContinue?.(involved);
  }

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
        input::placeholder { color: ${C.mist}; }
        .tab:hover { background: ${C.foam} !important; }
        .continue-btn:hover:not(:disabled) { background: ${C.pine} !important; transform: translateY(-1px); box-shadow: 0 4px 14px rgba(45,90,61,.3); }
      `}</style>

      {/* Top bar */}
      <div style={{ height: 52, background: C.forest, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.mint, fontSize: ".88rem", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>â Back</button>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: ".85rem", color: C.mint, letterSpacing: ".04em" }}><span style={{ color: C.white }}>EHS</span>platform</div>
        <div style={{ width: 40 }} />
      </div>

      <div style={{ padding: "14px 0 6px" }}>
        <MobileProgress step={2} total={5} />
      </div>

      <div style={{ flex: 1, padding: "16px 20px 100px", overflowY: "auto",
        paddingBottom: 80 }}>

        <div className="anim" style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: "1.3rem", fontWeight: 700, color: C.ink }}>Who was involved?</h1>
          <p style={{ fontSize: ".85rem", color: C.mist, marginTop: 4 }}>The person injured or affected by this incident.</p>
        </div>

        {/* Telehealth prompt â shown before form for applicable severities */}
        {showPrompt && (
          <TelehealthPrompt provider={triageProvider} onDismiss={() => setShowTelehealth(false)} />
        )}

        {/* Spec: toggle at top â staff lookup vs visitor/contractor */}
        <div className="anim" style={{
          display: "flex", background: C.white,
          border: "1.5px solid #E2EBE6", borderRadius: 9,
          marginBottom: 16, overflow: "hidden",
        }}>
          {[
            { id: "staff",   label: "Staff member"         },
            { id: "visitor", label: "Visitor / Contractor" },
          ].map(tab => (
            <button
              key={tab.id}
              className="tab"
              onClick={() => setMode(tab.id)}
              style={{
                flex: 1, padding: "11px",
                background: mode === tab.id ? C.sage : C.white,
                color: mode === tab.id ? C.white : C.slate,
                border: "none", fontFamily: "'DM Sans', sans-serif",
                fontSize: ".85rem", fontWeight: 600, cursor: "pointer",
                transition: "all .15s",
              }}
            >{tab.label}</button>
          ))}
        </div>

        <div className="anim" style={{ background: C.white, borderRadius: 10, boxShadow: "0 1px 8px rgba(15,31,23,.06)", padding: "16px" }}>
          {mode === "staff" ? (
            <StaffLookup selected={selectedStaff} onSelect={setSelectedStaff} />
          ) : (
            <VisitorForm data={visitorData} onChange={setVisitorData} />
          )}
        </div>
      </div>

      {/* Fixed bottom */}
      <div style={{
        position: "fixed", bottom: 68, left: 0, right: 0,
        padding: "14px 20px", background: C.white,
        borderTop: "1px solid #E2EBE6", boxShadow: "0 -4px 20px rgba(0,0,0,.06)",
      }}>
        <button
          className="continue-btn"
          onClick={handleContinue}
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
        >Photos & location â</button>
      </div>
    </div>
  );
}
