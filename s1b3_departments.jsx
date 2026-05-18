import { useState, useRef, useEffect } from "react";
import { EHSHeader } from "./AppShell.jsx";
import { BRAND, SITES } from "./constants.js";

// ââ Design tokens ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
const C = {
  forest: "#1C3A2A", pine: "#2D5A3D", sage: "#4A8C5C",
  mint: "#A8D5B5", foam: "#E8F5EC", ink: "#0F1F17",
  slate: "#4A5568", mist: "#8FA3A0", chalk: "#F4F7F5",
  white: "#FFFFFF", gold: "#C8922A", goldLt: "#FDF3E3",
  red: "#C0392B", redLt: "#FDECEA",
};

const STEPS = ["Company", "Sites", "Departments", "Staff", "Training"];

// Industry â suggested dept templates
const DEPT_TEMPLATES = {
  "Spirits / Distilling": [
    { id: 1, name: "Production / Distilling",    emoji: "ð­", autoOnboard: true,  requireOrientation: true  },
    { id: 2, name: "Bottling & Packaging",        emoji: "ð¦", autoOnboard: true,  requireOrientation: true  },
    { id: 3, name: "Warehouse",                   emoji: "ð",  autoOnboard: true,  requireOrientation: true  },
    { id: 4, name: "Maintenance",                 emoji: "ð§", autoOnboard: true,  requireOrientation: true  },
    { id: 5, name: "Quality Control",             emoji: "ð¬", autoOnboard: true,  requireOrientation: false },
    { id: 6, name: "Tasting Room / Hospitality",  emoji: "ð¥", autoOnboard: true,  requireOrientation: false },
    { id: 7, name: "Administration",              emoji: "ð",  autoOnboard: false, requireOrientation: false },
  ],
  "Craft Brewing": [
    { id: 1, name: "Brewing Operations",  emoji: "ðº", autoOnboard: true,  requireOrientation: true  },
    { id: 2, name: "Packaging",           emoji: "ð¦", autoOnboard: true,  requireOrientation: true  },
    { id: 3, name: "Warehouse",           emoji: "ð",  autoOnboard: true,  requireOrientation: true  },
    { id: 4, name: "Quality & Lab",       emoji: "ð¬", autoOnboard: true,  requireOrientation: false },
    { id: 5, name: "Taproom",             emoji: "ð»", autoOnboard: true,  requireOrientation: false },
    { id: 6, name: "Administration",      emoji: "ð",  autoOnboard: false, requireOrientation: false },
  ],
  "Light Manufacturing": [
    { id: 1, name: "Production",          emoji: "ð­", autoOnboard: true,  requireOrientation: true  },
    { id: 2, name: "Assembly",            emoji: "ð©", autoOnboard: true,  requireOrientation: true  },
    { id: 3, name: "Warehouse & Shipping",emoji: "ð¦", autoOnboard: true,  requireOrientation: true  },
    { id: 4, name: "Maintenance",         emoji: "ð§", autoOnboard: true,  requireOrientation: true  },
    { id: 5, name: "Quality Control",     emoji: "ð¬", autoOnboard: true,  requireOrientation: false },
    { id: 6, name: "Administration",      emoji: "ð",  autoOnboard: false, requireOrientation: false },
  ],
};
const DEFAULT_TEMPLATE = [
  { id: 1, name: "Operations",    emoji: "âï¸", autoOnboard: true,  requireOrientation: true  },
  { id: 2, name: "Warehouse",     emoji: "ð",  autoOnboard: true,  requireOrientation: true  },
  { id: 3, name: "Maintenance",   emoji: "ð§", autoOnboard: true,  requireOrientation: true  },
  { id: 4, name: "Administration",emoji: "ð",  autoOnboard: false, requireOrientation: false },
];

// ââ Shared primitives ââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
function Stepper({ current }) {
  return (
    <div style={{ display: "flex", alignItems: "center", overflowX: "auto", paddingBottom: 4, marginBottom: 32, scrollbarWidth: "none" }}>
      {STEPS.map((label, i) => {
        const state = i < current ? "done" : i === current ? "active" : "pending";
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: ".8rem", fontWeight: 700,
              background: state === "done" ? C.sage : state === "active" ? C.forest : "#E2EBE6",
              color: state === "pending" ? C.mist : C.white,
              boxShadow: state === "active" ? `0 0 0 4px ${C.mint}` : "none",
              transition: "all .2s",
            }}>
              {state === "done" ? "â" : i + 1}
            </div>
            <span style={{
              fontSize: ".75rem", fontWeight: state === "active" ? 700 : 500,
              color: state === "done" ? C.sage : state === "active" ? C.forest : C.slate,
              marginLeft: 8, marginRight: 4, whiteSpace: "nowrap",
            }}>{label}</span>
            {i < STEPS.length - 1 && (
              <div style={{
                flex: 1, height: 2, minWidth: 20, maxWidth: 48,
                background: state === "done" ? C.sage : "#D0DEDB",
                margin: "0 4px", transition: "background .3s",
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Label({ children }) {
  return (
    <div style={{
      fontSize: ".72rem", fontWeight: 600, letterSpacing: ".07em",
      textTransform: "uppercase", color: C.sage, marginBottom: 6,
    }}>{children}</div>
  );
}

// ââ Toggle switch ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
function Toggle({ checked, onChange }) {
  return (
    <div
      onClick={() => onChange(!checked)}
      style={{
        position: "relative", width: 40, height: 22, flexShrink: 0,
        background: checked ? C.sage : "#D0DEDB",
        borderRadius: 22, cursor: "pointer",
        transition: "background .2s",
      }}
    >
      <div style={{
        position: "absolute",
        width: 16, height: 16, borderRadius: "50%",
        background: C.white,
        top: 3, left: checked ? 21 : 3,
        transition: "left .18s cubic-bezier(.4,0,.2,1)",
        boxShadow: "0 1px 4px rgba(0,0,0,.2)",
      }} />
    </div>
  );
}

function ToggleRow({ label, sublabel, checked, onChange }) {
  return (
    <EHSHeader onHome={onHome} dark={true} />
  );
}

// ââ Department pill ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
function DeptPill({ dept, selected, onSelect, onRemove }) {
  return (
    <div
      onClick={() => onSelect(dept.id)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "6px 12px",
        background: selected ? C.pine : C.foam,
        border: `1.5px solid ${selected ? C.pine : C.mint}`,
        borderRadius: 20,
        fontSize: ".82rem", fontWeight: 500,
        color: selected ? C.white : C.pine,
        cursor: "pointer",
        transition: "all .15s",
        userSelect: "none",
      }}
    >
      <span style={{ fontSize: ".9rem" }}>{dept.emoji}</span>
      {dept.name}
      <span
        onClick={e => { e.stopPropagation(); onRemove(dept.id); }}
        style={{
          fontSize: ".7rem",
          color: selected ? "rgba(255,255,255,.6)" : C.mist,
          cursor: "pointer", lineHeight: 1,
          padding: "1px 2px",
          borderRadius: 3,
          transition: "color .15s",
        }}
        title="Remove"
      >â</span>
    </div>
  );
}

// ââ Inline "Add department" input ââââââââââââââââââââââââââââââââââââââââââââ
function AddDeptInput({ onAdd }) {
  const [open, setOpen]   = useState(false);
  const [value, setValue] = useState("");
  const inputRef          = useRef(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function handleKeyDown(e) {
    if (e.key === "Enter" && value.trim()) submit();
    if (e.key === "Escape") { setValue(""); setOpen(false); }
  }

  function submit() {
    if (!value.trim()) return;
    onAdd(value.trim());
    setValue("");
    setOpen(false);
  }

  if (!open) {
    return (
      <div
        onClick={() => setOpen(true)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "6px 12px",
          background: "none",
          border: `1.5px dashed ${C.mint}`,
          borderRadius: 20,
          fontSize: ".82rem", fontWeight: 500,
          color: C.sage, cursor: "pointer",
          transition: "all .15s",
        }}
      >
        + Add department
      </div>
    );
  }

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <input
        ref={inputRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Department nameâ¦"
        style={{
          padding: "5px 10px",
          border: `1.5px solid ${C.sage}`,
          borderRadius: 20,
          fontFamily: "'DM Sans', sans-serif",
          fontSize: ".82rem", color: C.ink,
          outline: "none",
          boxShadow: `0 0 0 3px rgba(74,140,92,.12)`,
          width: 180,
        }}
      />
      <button
        onClick={submit}
        style={{
          padding: "5px 12px", background: C.sage, color: C.white,
          border: "none", borderRadius: 20,
          fontFamily: "'DM Sans', sans-serif",
          fontSize: ".78rem", fontWeight: 600, cursor: "pointer",
        }}
      >Add</button>
      <button
        onClick={() => { setValue(""); setOpen(false); }}
        style={{
          padding: "5px 8px", background: "none",
          color: C.mist, border: "none", cursor: "pointer", fontSize: ".85rem",
        }}
      >Ã</button>
    </div>
  );
}

// ââ Dept settings panel ââââââââââââââââââââââââââââââââââââââââââââââââââââââ
function DeptSettings({ dept, onChange }) {
  const [lead, setLead] = useState(dept.lead ?? "");
  const [focused, setFocused] = useState(false);

  return (
    <div style={{
      padding: 14,
      background: C.foam,
      border: `1.5px solid ${C.sage}`,
      borderRadius: 8,
      animation: "fadeIn .15s ease both",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        fontWeight: 600, fontSize: ".88rem", color: C.pine, marginBottom: 12,
      }}>
        <span>{dept.emoji}</span>
        {dept.name}
        <span style={{
          fontSize: ".68rem", background: C.sage, color: C.white,
          padding: "2px 8px", borderRadius: 10,
        }}>Selected</span>
      </div>

      {/* Lead */}
      <div style={{ marginBottom: 12 }}>
        <Label>Department lead</Label>
        <input
          type="text"
          value={lead}
          onChange={e => { setLead(e.target.value); onChange({ lead: e.target.value }); }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Assign a lead (optional)"
          style={{
            width: "100%", padding: "8px 12px",
            border: `1.5px solid ${focused ? C.sage : "#C8DDD2"}`,
            borderRadius: 7, fontFamily: "'DM Sans', sans-serif",
            fontSize: ".85rem", color: C.ink, background: C.white,
            outline: "none",
            boxShadow: focused ? `0 0 0 3px rgba(74,140,92,.12)` : "none",
            transition: "all .18s",
          }}
        />
      </div>

      <div style={{ borderTop: "1px solid #D4EAD9", paddingTop: 10 }}>
        <ToggleRow
          label="Auto-assign onboarding training"
          sublabel="All new staff get onboarding training automatically"
          checked={dept.autoOnboard}
          onChange={v => onChange({ autoOnboard: v })}
        />
        <ToggleRow
          label="Require safety orientation"
          sublabel="Before starting any shift"
          checked={dept.requireOrientation}
          onChange={v => onChange({ requireOrientation: v })}
        />
      </div>
    </div>
  );
}

// ââ Idle dept card (not selected) ââââââââââââââââââââââââââââââââââââââââââââ
function DeptIdleCard({ dept, onSelect }) {
  return (
    <div
      onClick={() => onSelect(dept.id)}
      style={{
        padding: 12,
        background: C.chalk,
        border: "1.5px solid #E2EBE6",
        borderRadius: 8, opacity: 0.65,
        cursor: "pointer", transition: "all .15s",
      }}
    >
      <div style={{ fontWeight: 600, fontSize: ".85rem", color: C.slate, marginBottom: 4 }}>
        {dept.emoji} {dept.name}
      </div>
      <div style={{ fontSize: ".75rem", color: C.mist }}>Click to configure</div>
    </div>
  );
}

// ââ Main component ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
export default function S1b3Departments({ industry = "Spirits / Distilling", onContinue, onBack }) {
  const template = DEPT_TEMPLATES[industry] ?? DEFAULT_TEMPLATE;
  const [depts, setDepts]         = useState(template.map(d => ({ ...d })));
  const [selectedId, setSelectedId] = useState(null);
  const nextId = useRef(template.length + 1);

  const selectedDept = depts.find(d => d.id === selectedId);

  function handleRemove(id) {
    setDepts(ds => ds.filter(d => d.id !== id));
    if (selectedId === id) setSelectedId(null);
  onHome,

  }

  function handleAdd(name) {
    const emojis = ["âï¸","ð¢","ð","ð","ð","ð·","ð¿"];
    const newDept = {
      id: nextId.current++,
      name,
      emoji: emojis[Math.floor(Math.random() * emojis.length)],
      autoOnboard: true,
      requireOrientation: false,
      lead: "",
    };
    setDepts(ds => [...ds, newDept]);
    setSelectedId(newDept.id);
  }

  function handleSettingsChange(id, updates) {
    setDepts(ds => ds.map(d => d.id === id ? { ...d, ...updates } : d));
  }

  // Build settings grid: selected dept first, then others 2-up
  const others = depts.filter(d => d.id !== selectedId);
  const configuredCount = depts.filter(d => d.autoOnboard || d.requireOrientation || d.lead).length;

  return (
    <div style={{ minHeight: "100vh", background: C.chalk, fontFamily: "'DM Sans', sans-serif", paddingBottom: 80 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input::placeholder { color: ${C.mist}; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        .anim { animation: fadeUp .28s cubic-bezier(.4,0,.2,1) both; }
        .btn-primary-hover:hover { background: ${C.pine} !important; transform: translateY(-1px); box-shadow: 0 4px 14px rgba(45,90,61,.3); }
        .btn-ghost-hover:hover { color: ${C.pine} !important; background: ${C.foam} !important; }
        .dept-idle:hover { opacity: 1 !important; border-color: ${C.mint} !important; background: ${C.foam} !important; }
        .pill-add-hover:hover { background: ${C.foam} !important; border-style: solid !important; }
        .settings-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        @media (max-width: 600px) { .settings-grid { grid-template-columns: 1fr; } }
      `}</style>

      {/* Top nav */}
      <div style={{
        height: 56, background: C.forest,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 28px", boxShadow: "0 2px 12px rgba(0,0,0,.2)",
      }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: ".95rem", fontWeight: 500, color: C.mint, letterSpacing: ".06em" }}>
          <span style={{ color: C.white }}>EHS</span>platform
        </div>
        <div style={{ fontSize: ".75rem", color: C.mist, background: "rgba(255,255,255,.08)", padding: "3px 10px", borderRadius: 20 }}>
          New account setup
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "32px 24px 80px" }}>

        <div className="anim" style={{ animationDelay: "0ms" }}>
          <Stepper current={2} />
        </div>

        <div className="anim" style={{ marginBottom: 20, animationDelay: "30ms" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, color: C.ink }}>Set up departments</h1>
          <p style={{ fontSize: ".9rem", color: C.slate, marginTop: 4, lineHeight: 1.5 }}>
            We've suggested departments based on your industry. Edit, remove, or add your own.
            These apply to all sites â you can customize per-site later.
          </p>
        </div>

        {/* Info alert */}
        <div className="anim" style={{
          display: "flex", gap: 12, alignItems: "flex-start",
          padding: "13px 16px",
          background: C.foam,
          borderLeft: `3px solid ${C.sage}`,
          borderRadius: 8,
          fontSize: ".87rem", color: C.pine, lineHeight: 1.5,
          marginBottom: 16, animationDelay: "50ms",
        }}>
          <span style={{ marginTop: 1, flexShrink: 0 }}>ð¡</span>
          <span>Each department automatically gets a <strong>training group</strong>. Staff added to a department are auto-enrolled in that group's training.</span>
        </div>

        {/* ââ Pill card ââ */}
        <div className="anim" style={{
          background: C.white, borderRadius: 10,
          boxShadow: "0 2px 16px rgba(15,31,23,.08)",
          padding: 22, marginBottom: 14,
          animationDelay: "70ms",
        }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <h2 style={{ fontSize: "1rem", fontWeight: 600, color: C.ink }}>
                Suggested for {industry}
              </h2>
              <p style={{ fontSize: ".78rem", color: C.mist, marginTop: 2 }}>
                Based on your industry selection â {depts.length} department{depts.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            {depts.map(dept => (
              <DeptPill
                key={dept.id}
                dept={dept}
                selected={selectedId === dept.id}
                onSelect={id => setSelectedId(prev => prev === id ? null : id)}
                onRemove={handleRemove}
              />
            ))}
            <AddDeptInput onAdd={handleAdd} />
          </div>

          {depts.length === 0 && (
            <div style={{
              padding: "16px", textAlign: "center",
              color: C.mist, fontSize: ".85rem",
              border: "1.5px dashed #D0DEDB", borderRadius: 8, marginTop: 8,
            }}>
              All departments removed. Add at least one to continue.
            </div>
          )}
        </div>

        {/* ââ Settings card ââ */}
        <div className="anim" style={{
          background: C.white, borderRadius: 10,
          boxShadow: "0 2px 16px rgba(15,31,23,.08)",
          padding: 22, marginBottom: 14,
          animationDelay: "90ms",
        }}>
          <div style={{ marginBottom: 14 }}>
            <h2 style={{ fontSize: "1rem", fontWeight: 600, color: C.ink }}>Department settings</h2>
            <p style={{ fontSize: ".78rem", color: C.mist, marginTop: 2 }}>
              {selectedId
                ? "Configure training rules â or skip and continue. You can always edit these later."
                : "Click any department pill above to configure it."}
            </p>
          </div>

          {selectedId && selectedDept ? (
            <div className="settings-grid">
              {/* Selected: full config panel */}
              <DeptSettings
                key={selectedDept.id}
                dept={selectedDept}
                onChange={updates => handleSettingsChange(selectedDept.id, updates)}
              />

              {/* Others: idle cards */}
              {others.slice(0, 3).map(dept => (
                <div
                  key={dept.id}
                  className="dept-idle"
                  onClick={() => setSelectedId(dept.id)}
                  style={{
                    padding: 12, background: C.chalk,
                    border: "1.5px solid #E2EBE6", borderRadius: 8,
                    opacity: 0.65, cursor: "pointer", transition: "all .15s",
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: ".85rem", color: C.slate, marginBottom: 3 }}>
                    {dept.emoji} {dept.name}
                  </div>
                  <div style={{ fontSize: ".72rem", color: C.mist }}>Click to configure</div>
                </div>
              ))}
            </div>
          ) : (
            /* No selection: show all as a grid of idle cards */
            <div className="settings-grid">
              {depts.map(dept => (
                <div
                  key={dept.id}
                  className="dept-idle"
                  onClick={() => setSelectedId(dept.id)}
                  style={{
                    padding: 12, background: C.chalk,
                    border: "1.5px solid #E2EBE6", borderRadius: 8,
                    opacity: 0.65, cursor: "pointer", transition: "all .15s",
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: ".85rem", color: C.slate, marginBottom: 3 }}>
                    {dept.emoji} {dept.name}
                  </div>
                  <div style={{ fontSize: ".72rem", color: C.mist }}>Click to configure</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Annotation */}
        <div className="anim" style={{
          position: "relative", padding: "10px 14px 10px 36px",
          background: "#FFF8E7", border: "1px dashed #E8C87A",
          borderRadius: 7, fontSize: ".78rem", color: "#7A5A1A", lineHeight: 1.5,
          animationDelay: "110ms",
        }}>
          <span style={{ position: "absolute", left: 10, top: 10, fontSize: ".85rem" }}>âï¸</span>
          UX NOTE: Industry-suggested departments mean most users just review and click Continue â zero friction for the common case.
          Clicking "â" removes instantly (no confirm). "Add department" appears inline. Department settings panel is secondary â most users skip here and configure later.
        </div>
      </div>

      {/* ââ Fixed action bar ââ */}
      <div style={{
        position: "fixed", bottom: 68, left: 0, right: 0,
        background: C.white, borderTop: "1px solid #E2EBE6",
        padding: "14px 28px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        zIndex: 50, boxShadow: "0 -4px 20px rgba(0,0,0,.06)",
      }}>
        <button
          className="btn-ghost-hover"
          onClick={onBack}
          style={{
            padding: "10px 16px", background: "none", color: C.slate,
            border: "none", borderRadius: 7,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: ".88rem", fontWeight: 600, cursor: "pointer", transition: "all .18s",
          }}
        >â Back</button>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: ".8rem", color: C.mist }}>
            {depts.length} department{depts.length !== 1 ? "s" : ""} configured
          </span>
          <button
            className="btn-primary-hover"
            onClick={() => depts.length > 0 && onContinue && onContinue({ departments: depts })}
            disabled={depts.length === 0}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 22px",
              background: depts.length > 0 ? C.sage : "#B0C8BA",
              color: C.white, border: "none", borderRadius: 7,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: ".88rem", fontWeight: 600,
              cursor: depts.length > 0 ? "pointer" : "default",
              transition: "all .18s",
            }}
          >
            Continue to Staff â
          </button>
        </div>
      </div>
    </div>
  );
}
