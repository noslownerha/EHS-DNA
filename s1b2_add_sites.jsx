import { useState, useRef } from "react";
import { EHSHeader } from "./AppShell.jsx";
import { BRAND, SITES } from "./constants.js";

// ââ Design tokens ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
const C = {
  forest:  "#1C3A2A",
  pine:    "#2D5A3D",
  sage:    "#4A8C5C",
  mint:    "#A8D5B5",
  foam:    "#E8F5EC",
  ink:     "#0F1F17",
  slate:   "#4A5568",
  mist:    "#8FA3A0",
  chalk:   "#F4F7F5",
  white:   "#FFFFFF",
  gold:    "#C8922A",
  goldLt:  "#FDF3E3",
  red:     "#C0392B",
  redLt:   "#FDECEA",
};

const STEPS = ["Company", "Sites", "Departments", "Staff", "Training"];

const TIMEZONES = [
  "Auto-detect from address",
  "America/New_York (ET)",
  "America/Chicago (CT)",
  "America/Denver (MT)",
  "America/Los_Angeles (PT)",
  "America/Anchorage (AKT)",
  "Pacific/Honolulu (HT)",
];

const STATUSES = ["Active", "Inactive", "Seasonal"];

const INITIAL_SITES = [
  { id: 1, name: "Moriah",       location: "Mineville, NY",    status: "Active", tz: "America/New_York (ET)" },
  { id: 2, name: "Middlebury",   location: "Middlebury, VT",   status: "Active", tz: "America/New_York (ET)" },
  { id: 3, name: "Shoreham",     location: "Shoreham, VT",     status: "Active", tz: "America/New_York (ET)" },
  { id: 4, name: "Brandenburg",  location: "Brandenburg, KY",  status: "Active", tz: "America/Chicago (CT)"  },
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

function TextInput({ value, onChange, placeholder, hasError, style = {} }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type="text" value={value} onChange={onChange} placeholder={placeholder}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={{
        width: "100%", padding: "9px 12px",
        border: `1.5px solid ${hasError ? C.red : focused ? C.sage : "#D0DEDB"}`,
        borderRadius: 7, fontFamily: "'DM Sans', sans-serif",
        fontSize: ".88rem", color: C.ink, background: C.white, outline: "none",
        boxShadow: focused ? `0 0 0 3px rgba(74,140,92,.12)` : "none",
        transition: "all .18s cubic-bezier(.4,0,.2,1)", ...style,
      }}
    />
  );
}

function SelectInput({ value, onChange, options }) {
  const [focused, setFocused] = useState(false);
  return (
    <select
      value={value} onChange={onChange}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={{
        width: "100%", padding: "9px 12px",
        border: `1.5px solid ${focused ? C.sage : "#D0DEDB"}`,
        borderRadius: 7, fontFamily: "'DM Sans', sans-serif",
        fontSize: ".88rem", color: C.ink, background: C.white, outline: "none",
        boxShadow: focused ? `0 0 0 3px rgba(74,140,92,.12)` : "none",
        transition: "all .18s", cursor: "pointer", appearance: "none",
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%238FA3A0'/%3E%3C/svg%3E")`,
        backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", paddingRight: 32,
      }}
    >
      {options.map(o => <option key={o}>{o}</option>)}
    </select>
  );
}

function Badge({ status }) {
  const colors = {
    Active:   { bg: C.foam,   color: C.pine },
    Inactive: { bg: "#EEF1F0", color: C.slate },
    Seasonal: { bg: C.goldLt, color: C.gold },
  };
  const s = colors[status] || colors.Inactive;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "2px 9px", borderRadius: 20,
      fontSize: ".7rem", fontWeight: 600,
      background: s.bg, color: s.color,
    }}>{status}</span>
  );
}

function InlineError({ msg }) {
  return msg ? <div style={{ fontSize: ".74rem", color: C.red, marginTop: 4 }}>â  {msg}</div> : null;
}

function Divider() {
  return <div style={{ height: 1, background: "#E8EFec", margin: "16px 0" }} />;
}

// ââ Site list card ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
function SiteCard({ site, index, onEdit, onRemove, editing }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 14px",
      background: editing ? C.foam : C.chalk,
      border: `1.5px solid ${editing ? C.sage : "#E2EBE6"}`,
      borderRadius: 8,
      transition: "all .18s",
    }}>
      {/* Number */}
      <div style={{
        width: 26, height: 26, borderRadius: "50%",
        background: C.mint, color: C.forest,
        fontSize: ".75rem", fontWeight: 700,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>{index + 1}</div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: ".88rem", fontWeight: 600, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {site.name}
        </div>
        <div style={{ fontSize: ".75rem", color: C.slate, marginTop: 1, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{site.location}</span>
          <Badge status={site.status} />
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        <button
          onClick={() => onEdit(site)}
          style={{
            padding: "5px 12px", background: "none",
            color: editing ? C.pine : C.slate,
            border: `1px solid ${editing ? C.mint : "transparent"}`,
            borderRadius: 6, fontSize: ".78rem", fontWeight: 600,
            cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
            transition: "all .15s",
          }}
        >
          {editing ? "Editing" : "Edit"}
        </button>
        <button
          onClick={() => onRemove(site.id)}
          style={{
            padding: "5px 8px", background: "none",
            color: C.mist, border: "none",
            borderRadius: 6, fontSize: ".85rem",
            cursor: "pointer", transition: "all .15s",
          }}
          title="Remove site"
        >Ã</button>
      </div>
    </div>
  );
}

// ââ CSV Dropzone ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
function CsvDropzone({ onImport }) {
  const [dragging, setDragging] = useState(false);
  const [imported, setImported] = useState(null);
  const fileRef = useRef(null);

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleFile(file) {
    setImported(file.name);
    // In production: parse CSV and call onImport(parsedSites)
    if (onImport) onImport(file.name);
  }

  return (
    <div
      onClick={() => fileRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      style={{
        border: `2px dashed ${dragging ? C.sage : C.mint}`,
        borderRadius: 10, padding: "24px 20px",
        textAlign: "center", cursor: "pointer",
        background: dragging ? C.foam : C.chalk,
        transition: "all .18s",
      }}
    >
      <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }}
        onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />
      <div style={{ fontSize: "1.6rem", marginBottom: 8 }}>ð</div>
      {imported ? (
        <div>
          <div style={{ fontSize: ".88rem", fontWeight: 600, color: C.pine }}>â {imported} ready to import</div>
          <div style={{ fontSize: ".75rem", color: C.mist, marginTop: 4 }}>Click to choose a different file</div>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: ".88rem", fontWeight: 600, color: C.pine }}>Bulk import sites</div>
          <div style={{ fontSize: ".78rem", color: C.mist, marginTop: 3 }}>Drop a CSV here or click to upload</div>
        </div>
      )}
      <div style={{
        margin: "12px 0", fontSize: ".72rem", color: C.mist,
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <div style={{ flex: 1, height: 1, background: "#E2EBE6" }} />
        or
        <div style={{ flex: 1, height: 1, background: "#E2EBE6" }} />
      </div>
      <button
        onClick={e => { e.stopPropagation(); /* trigger download */ }}
        style={{
          padding: "6px 14px", background: C.white,
          color: C.pine, border: `1.5px solid ${C.mint}`,
          borderRadius: 6, fontFamily: "'DM Sans', sans-serif",
          fontSize: ".78rem", fontWeight: 600, cursor: "pointer",
        }}
      >
        Download template
      </button>
    </div>
  );
}

// ââ Add / Edit form panel âââââââââââââââââââââââââââââââââââââââââââââââââââââ
function SiteForm({ editingSite, onAdd, onUpdate, onCancel }) {
  const isEdit = !!editingSite;
  const [name,     setName]     = useState(editingSite?.name     ?? "");
  const [location, setLocation] = useState(editingSite?.location ?? "");
  const [tz,       setTz]       = useState(editingSite?.tz       ?? TIMEZONES[0]);
  const [status,   setStatus]   = useState(editingSite?.status   ?? "Active");
  const [manager,  setManager]  = useState(editingSite?.manager  ?? "");
  const [errors,   setErrors]   = useState({});

  function validate() {
    const e = {};
    if (!name.trim()) e.name = "Site name is required.";
    if (!location.trim()) e.location = "Address is required.";
    return e;
  }

  function handleSubmit() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    const site = { name: name.trim(), location: location.trim(), tz, status, manager };
    isEdit ? onUpdate({ ...editingSite, ...site }) : onAdd(site);
  }

  return (
    <div style={{
      background: C.white, borderRadius: 10,
      boxShadow: "0 2px 16px rgba(15,31,23,.08)",
      padding: 22,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 style={{ fontSize: ".95rem", fontWeight: 600, color: C.ink }}>
          {isEdit ? `Editing: ${editingSite.name}` : "Add a site"}
        </h2>
        {isEdit && (
          <button onClick={onCancel} style={{
            background: "none", border: "none", color: C.mist,
            fontSize: ".8rem", cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
          }}>Cancel</button>
        )}
      </div>

      <div style={{ marginBottom: 14 }}>
        <Label>Site name</Label>
        <TextInput value={name} onChange={e => { setName(e.target.value); setErrors(er => ({ ...er, name: "" })); }}
          placeholder="e.g. Chicago Distribution Center" hasError={!!errors.name} />
        <InlineError msg={errors.name} />
      </div>

      <div style={{ marginBottom: 14 }}>
        <Label>Address</Label>
        <TextInput value={location} onChange={e => { setLocation(e.target.value); setErrors(er => ({ ...er, location: "" })); }}
          placeholder="Start typing â auto-completes" hasError={!!errors.location} />
        <InlineError msg={errors.location} />
        <div style={{ fontSize: ".72rem", color: C.mist, marginTop: 4 }}>
          Google Places autocomplete â timezone fills automatically
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        <div>
          <Label>Timezone</Label>
          <SelectInput value={tz} onChange={e => setTz(e.target.value)} options={TIMEZONES} />
        </div>
        <div>
          <Label>Status</Label>
          <SelectInput value={status} onChange={e => setStatus(e.target.value)} options={STATUSES} />
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <Label>Site manager</Label>
        <TextInput value={manager} onChange={e => setManager(e.target.value)}
          placeholder="Search staff by name or email" />
        <div style={{ fontSize: ".72rem", color: C.mist, marginTop: 4 }}>
          Optional â you can assign this after adding staff in Step 4.
        </div>
      </div>

      {/* Floor plan mini-dropzone */}
      <div style={{ marginBottom: 18 }}>
        <Label>Floor plan <span style={{ fontWeight: 400, color: C.mist, textTransform: "none", letterSpacing: 0 }}>(optional)</span></Label>
        <div style={{
          border: `2px dashed ${C.mint}`, borderRadius: 8,
          padding: "12px 14px", textAlign: "center",
          cursor: "pointer", background: C.chalk,
          fontSize: ".83rem", color: C.sage, transition: "all .18s",
        }}>
          + Upload PDF or image
        </div>
      </div>

      <button
        onClick={handleSubmit}
        style={{
          width: "100%", padding: "10px",
          background: C.sage, color: C.white,
          border: "none", borderRadius: 7,
          fontFamily: "'DM Sans', sans-serif",
          fontSize: ".88rem", fontWeight: 600, cursor: "pointer",
          transition: "all .18s",
        }}
      >
        {isEdit ? "Save changes" : "Add this site"}
      </button>
    </div>
  );
}

// ââ Main component ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
export default function S1b2AddSites({ initialSites = INITIAL_SITES, onContinue, onBack }) {
  const [sites, setSites] = useState(initialSites);
  const [editingSite, setEditingSite] = useState(null); // null = "add new" mode
  const [added, setAdded] = useState(null); // flash confirmation
  const nextId = useRef(initialSites.length + 1);

  function handleAdd(site) {
    const newSite = { ...site, id: nextId.current++ };
    setSites(s => [...s, newSite]);
    setAdded(newSite.name);
    setEditingSite(null);
    setTimeout(() => setAdded(null), 2500);
  onHome,

  }

  function handleUpdate(updated) {
    setSites(s => s.map(x => x.id === updated.id ? updated : x));
    setEditingSite(null);
  }

  function handleRemove(id) {
    setSites(s => s.filter(x => x.id !== id));
    if (editingSite?.id === id) setEditingSite(null);
  }

  function handleEdit(site) {
    setEditingSite(prev => prev?.id === site.id ? null : site);
  }

  const canContinue = sites.length > 0;

  return (
    <div style={{ minHeight: "100vh", background: C.chalk, fontFamily: "'DM Sans', sans-serif", paddingBottom: 80 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input::placeholder { color: ${C.mist}; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes slideIn { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        .anim { animation: fadeUp .28s cubic-bezier(.4,0,.2,1) both; }
        .site-add-anim { animation: slideIn .2s ease both; }
        .btn-primary-hover:hover { background: ${C.pine} !important; transform: translateY(-1px); box-shadow: 0 4px 14px rgba(45,90,61,.3); }
        .btn-ghost-hover:hover { color: ${C.pine} !important; background: ${C.foam} !important; }
        .site-form-btn:hover { background: ${C.pine} !important; }
        .remove-btn:hover { color: ${C.red} !important; }
        .split-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }
        @media (max-width: 720px) { .split-grid { grid-template-columns: 1fr; } }
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
          <Stepper current={1} />
        </div>

        <div className="anim" style={{ marginBottom: 24, animationDelay: "40ms" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, color: C.ink }}>Add your sites</h1>
          <p style={{ fontSize: ".9rem", color: C.slate, marginTop: 4, lineHeight: 1.5 }}>
            Each site gets its own manager, departments, and staff. Add one at a time or import a list.
          </p>
        </div>

        {/* Flash confirmation */}
        {added && (
          <div className="site-add-anim" style={{
            marginBottom: 14, padding: "10px 16px",
            background: C.foam, borderLeft: `3px solid ${C.sage}`,
            borderRadius: 8, fontSize: ".85rem", color: C.pine,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <span>â</span> <strong>{added}</strong> added successfully.
          </div>
        )}

        <div className="split-grid anim" style={{ animationDelay: "80ms" }}>

          {/* ââ Left: site list + CSV import ââ */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div>
                <h2 style={{ fontSize: "1rem", fontWeight: 600, color: C.ink }}>Your sites</h2>
                <p style={{ fontSize: ".78rem", color: C.mist }}>{sites.length} added</p>
              </div>
              <button
                onClick={() => setEditingSite(null)}
                style={{
                  padding: "6px 14px", background: C.white,
                  color: C.pine, border: `1.5px solid ${C.mint}`,
                  borderRadius: 6, fontFamily: "'DM Sans', sans-serif",
                  fontSize: ".78rem", fontWeight: 600, cursor: "pointer",
                  transition: "all .15s",
                }}
              >
                + Add site
              </button>
            </div>

            {/* Site list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {sites.length === 0 ? (
                <div style={{
                  padding: "20px", textAlign: "center",
                  background: C.white, borderRadius: 8,
                  border: "1.5px dashed #D0DEDB",
                  color: C.mist, fontSize: ".85rem",
                }}>
                  No sites yet â add your first site using the form.
                </div>
              ) : sites.map((site, i) => (
                <div key={site.id} className="site-add-anim">
                  <SiteCard
                    site={site} index={i}
                    editing={editingSite?.id === site.id}
                    onEdit={handleEdit}
                    onRemove={handleRemove}
                  />
                </div>
              ))}
            </div>

            <Divider />

            <CsvDropzone onImport={(filename) => console.log("Import:", filename)} />
          </div>

          {/* ââ Right: add/edit form ââ */}
          <div>
            <SiteForm
              key={editingSite?.id ?? "new"}
              editingSite={editingSite}
              onAdd={handleAdd}
              onUpdate={handleUpdate}
              onCancel={() => setEditingSite(null)}
            />
          </div>
        </div>

        {/* Annotation */}
        <div className="anim" style={{
          marginTop: 16,
          position: "relative", padding: "10px 14px 10px 36px",
          background: "#FFF8E7", border: "1px dashed #E8C87A",
          borderRadius: 7, fontSize: ".78rem", color: "#7A5A1A", lineHeight: 1.5,
          animationDelay: "120ms",
        }}>
          <span style={{ position: "absolute", left: 10, top: 10, fontSize: ".85rem" }}>âï¸</span>
          UX NOTE: Address field uses Google Places autocomplete â timezone fills automatically.
          Site manager field is optional here â user can skip and assign later without blocking progress.
          Inactive sites shown in list but don't count toward billing.
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
            padding: "10px 16px", background: "none",
            color: C.slate, border: "none",
            borderRadius: 7, fontFamily: "'DM Sans', sans-serif",
            fontSize: ".88rem", fontWeight: 600, cursor: "pointer",
            transition: "all .18s",
          }}
        >â Back</button>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: ".8rem", color: C.mist }}>
            {sites.length === 0 ? "No sites added yet" : `${sites.length} site${sites.length > 1 ? "s" : ""} added`}
          </span>
          <button
            className="btn-primary-hover"
            onClick={() => canContinue && onContinue && onContinue({ sites })}
            disabled={!canContinue}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 22px",
              background: canContinue ? C.sage : "#B0C8BA",
              color: C.white, border: "none", borderRadius: 7,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: ".88rem", fontWeight: 600,
              cursor: canContinue ? "pointer" : "default",
              transition: "all .18s",
            }}
          >
            Continue to Departments â
          </button>
        </div>
      </div>
    </div>
  );
}
