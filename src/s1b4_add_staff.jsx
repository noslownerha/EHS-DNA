import { useState, useRef } from "react";
import { EHSHeader } from "./AppShell.jsx";

// ── Design tokens ────────────────────────────────────────────────────────────
const C = {
  forest: "#1C3A2A", pine: "#2D5A3D", sage: "#4A8C5C",
  mint: "#A8D5B5", foam: "#E8F5EC", ink: "#0F1F17",
  slate: "#4A5568", mist: "#8FA3A0", chalk: "#F4F7F5",
  white: "#FFFFFF", gold: "#C8922A", goldLt: "#FDF3E3",
  red: "#C0392B", redLt: "#FDECEA",
};

const STEPS = ["Company", "Sites", "Departments", "Staff", "Training"];

const ROLES = [
  "Staff / Trainee",
  "Inspector / Safety Officer",
  "Department Lead",
  "Site Manager",
  "Company Admin",
];

const SEED_STAFF = [
  { id: 1, first: "Sarah",  last: "Mitchell", email: "sarah.m@whistlepig.com",  site: "Moriah",      dept: "Bottling & Packaging",    role: "Staff / Trainee",           invited: true  },
  { id: 2, first: "Marcus", last: "Webb",      email: "marcus.w@whistlepig.com", site: "Moriah",      dept: "Warehouse",                role: "Staff / Trainee",           invited: true  },
  { id: 3, first: "Dana",   last: "Kowalski",  email: "dana.k@whistlepig.com",   site: "Middlebury",  dept: "Production / Distilling",  role: "Site Manager",              invited: true  },
  { id: 4, first: "Tom",    last: "Rivera",    email: "tom.r@whistlepig.com",    site: "Shoreham",    dept: "Facility Maintenance",              role: "Staff / Trainee",           invited: false },
  { id: 5, first: "Priya",  last: "Nair",      email: "priya.n@whistlepig.com",  site: "Brandenburg", dept: "Administration",           role: "Site Manager",              invited: true  },
];

// ── Shared primitives ────────────────────────────────────────────────────────
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
              {state === "done" ? "✓" : i + 1}
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
    <div style={{ fontSize: ".72rem", fontWeight: 600, letterSpacing: ".07em", textTransform: "uppercase", color: C.sage, marginBottom: 6 }}>
      {children}
    </div>
  );
}

function TextInput({ type = "text", value, onChange, placeholder, hasError }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type={type} value={value} onChange={onChange} placeholder={placeholder}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={{
        width: "100%", padding: "9px 12px",
        border: `1.5px solid ${hasError ? C.red : focused ? C.sage : "#D0DEDB"}`,
        borderRadius: 7, fontFamily: "'DM Sans', sans-serif",
        fontSize: ".88rem", color: C.ink, background: C.white, outline: "none",
        boxShadow: focused ? `0 0 0 3px rgba(74,140,92,.12)` : "none",
        transition: "all .18s cubic-bezier(.4,0,.2,1)",
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

function Divider() {
  return <div style={{ height: 1, background: "#E8EFec", margin: "18px 0" }} />;
}

function InlineError({ msg }) {
  return msg ? <div style={{ fontSize: ".74rem", color: C.red, marginTop: 4 }}>⚠ {msg}</div> : null;
}

function Avatar({ first, last }) {
  const initials = `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase();
  return (
    <div style={{
      width: 28, height: 28, borderRadius: "50%",
      background: C.mint, color: C.forest,
      fontSize: ".65rem", fontWeight: 700,
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    }}>{initials}</div>
  );
}

function RoleBadge({ role }) {
  const isManager = role === "Site Manager" || role === "Company Admin";
  const isLead    = role === "Department Lead";
  const bg    = isManager ? C.goldLt : isLead ? "#EEF1F0" : C.foam;
  const color = isManager ? C.gold   : isLead ? C.slate   : C.pine;
  const label = isManager ? role : isLead ? "Dept Lead" : "Staff";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "2px 9px", borderRadius: 20,
      fontSize: ".68rem", fontWeight: 600,
      background: bg, color,
    }}>{label}</span>
  );
}

function SiteBadge({ site }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "2px 9px", borderRadius: 20,
      fontSize: ".68rem", fontWeight: 600,
      background: "#EEF1F0", color: C.slate,
    }}>{site}</span>
  );
}

// ── CSV dropzone ─────────────────────────────────────────────────────────────
function CsvDropzone({ onImport }) {
  const [dragging, setDragging] = useState(false);
  const [file, setFile]         = useState(null);
  const fileRef                 = useRef(null);

  function handleFile(f) { setFile(f.name); if (onImport) onImport(f.name); }

  return (
    <div
      onClick={() => fileRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
      style={{
        border: `2px dashed ${dragging ? C.sage : C.mint}`, borderRadius: 10,
        padding: "20px 16px", textAlign: "center", cursor: "pointer",
        background: dragging ? C.foam : C.chalk, transition: "all .18s",
      }}
    >
      <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }}
        onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />
      <div style={{ fontSize: "1.5rem", marginBottom: 6 }}>👥</div>
      {file ? (
        <>
          <div style={{ fontSize: ".85rem", fontWeight: 600, color: C.pine }}>✓ {file}</div>
          <div style={{ fontSize: ".75rem", color: C.mist, marginTop: 3 }}>Click to choose different file</div>
        </>
      ) : (
        <>
          <div style={{ fontSize: ".88rem", fontWeight: 600, color: C.pine }}>Import staff list</div>
          <div style={{ fontSize: ".75rem", color: C.mist, marginTop: 3 }}>CSV with name, email, site, department</div>
        </>
      )}
      <div style={{ margin: "10px 0", fontSize: ".7rem", color: C.mist, display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, height: 1, background: "#E2EBE6" }} />or<div style={{ flex: 1, height: 1, background: "#E2EBE6" }} />
      </div>
      <button
        onClick={e => e.stopPropagation()}
        style={{
          padding: "5px 14px", background: C.white, color: C.pine,
          border: `1.5px solid ${C.mint}`, borderRadius: 6,
          fontFamily: "'DM Sans', sans-serif", fontSize: ".78rem", fontWeight: 600, cursor: "pointer",
        }}
      >Download template</button>
    </div>
  );
}

// ── Add person form ──────────────────────────────────────────────────────────
const EMPTY_FORM = { first: "", last: "", email: "", mobile: "", site: "", dept: "", role: ROLES[0] };

function AddPersonForm({ sites, departments, onAdd }) {
  const [form,   setForm]   = useState({ ...EMPTY_FORM, site: sites[0] ?? "", dept: departments[0] ?? "" });
  const [errors, setErrors] = useState({});
  const [added,  setAdded]  = useState(false);

  function set(k, v) {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: "" }));
  }

  function validate() {
    const e = {};
    if (!form.first.trim()) e.first = "Required";
    if (!form.last.trim())  e.last  = "Required";
    if (!form.email.trim()) e.email = "Required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Invalid email";
    return e;
  }

  function handleAdd() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    onAdd({ ...form });
    setForm({ ...EMPTY_FORM, site: sites[0] ?? "", dept: departments[0] ?? "" });
    setErrors({});
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div style={{ background: C.white, borderRadius: 10, boxShadow: "0 2px 16px rgba(15,31,23,.08)", padding: 22 }}>
      <h2 style={{ fontSize: ".95rem", fontWeight: 600, color: C.ink, marginBottom: 16 }}>Add a person</h2>

      {added && (
        <div style={{
          padding: "8px 12px", background: C.foam, borderLeft: `3px solid ${C.sage}`,
          borderRadius: 7, fontSize: ".83rem", color: C.pine, marginBottom: 14,
          animation: "slideIn .15s ease both",
        }}>✓ Person added successfully</div>
      )}

      {/* Name row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        <div>
          <Label>First name</Label>
          <TextInput value={form.first} onChange={e => set("first", e.target.value)} placeholder="First" hasError={!!errors.first} />
          <InlineError msg={errors.first} />
        </div>
        <div>
          <Label>Last name</Label>
          <TextInput value={form.last} onChange={e => set("last", e.target.value)} placeholder="Last" hasError={!!errors.last} />
          <InlineError msg={errors.last} />
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <Label>Email</Label>
        <TextInput type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="work@email.com" hasError={!!errors.email} />
        <InlineError msg={errors.email} />
      </div>

      <div style={{ marginBottom: 14 }}>
        <Label>Mobile <span style={{ fontWeight: 400, color: C.mist, textTransform: "none", letterSpacing: 0 }}>(for SMS alerts)</span></Label>
        <TextInput type="tel" value={form.mobile} onChange={e => set("mobile", e.target.value)} placeholder="Optional" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        <div>
          <Label>Primary site</Label>
          <SelectInput value={form.site} onChange={e => set("site", e.target.value)} options={sites} />
        </div>
        <div>
          <Label>Primary department</Label>
          <SelectInput value={form.dept} onChange={e => set("dept", e.target.value)} options={departments} />
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <Label>Role / access level</Label>
        <SelectInput value={form.role} onChange={e => set("role", e.target.value)} options={ROLES} />
      </div>

      <button
        onClick={handleAdd}
        style={{
          width: "100%", padding: "10px",
          background: C.sage, color: C.white,
          border: "none", borderRadius: 7,
          fontFamily: "'DM Sans', sans-serif",
          fontSize: ".88rem", fontWeight: 600, cursor: "pointer",
          transition: "all .18s",
        }}
      >Add person</button>

      <Divider />
      <CsvDropzone onImport={name => console.log("Import:", name)} />
    </div>
  );
}

// ── Staff table ──────────────────────────────────────────────────────────────
function StaffTable({ staff, onInvite, onRemove, filterSite }) {
  const filtered = filterSite
    ? staff.filter(s => s.site === filterSite)
    : staff;

  const thStyle = {
    textAlign: "left", padding: "8px 12px",
    fontSize: ".7rem", fontWeight: 600,
    letterSpacing: ".06em", textTransform: "uppercase",
    color: C.mist, borderBottom: "1px solid #E2EBE6",
    background: C.chalk, whiteSpace: "nowrap",
  };

  if (filtered.length === 0) {
    return (
      <div style={{
        padding: "28px", textAlign: "center",
        background: C.white, borderRadius: 8,
        border: "1.5px dashed #D0DEDB",
        color: C.mist, fontSize: ".85rem",
      }}>
        {filterSite ? `No staff at ${filterSite} yet.` : "No staff added yet — use the form to get started."}
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid #E2EBE6" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={thStyle}>Name</th>
            <th style={thStyle}>Site</th>
            <th style={{ ...thStyle, display: "none" }}>Dept</th>
            <th style={thStyle}>Role</th>
            <th style={thStyle}>Invite</th>
            <th style={{ ...thStyle, width: 36 }}></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((person, i) => (
            <tr key={person.id} style={{ background: i % 2 === 0 ? C.white : "#FAFCFB" }}>
              <td style={{ padding: "10px 12px", fontSize: ".85rem", borderBottom: "1px solid #F0F4F2", verticalAlign: "middle" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Avatar first={person.first} last={person.last} />
                  <div>
                    <div style={{ fontWeight: 600, color: C.ink }}>{person.first} {person.last}</div>
                    <div style={{ fontSize: ".72rem", color: C.mist }}>{person.email}</div>
                  </div>
                </div>
              </td>
              <td style={{ padding: "10px 12px", fontSize: ".85rem", borderBottom: "1px solid #F0F4F2", verticalAlign: "middle" }}>
                <SiteBadge site={person.site} />
              </td>
              <td style={{ padding: "10px 12px", fontSize: ".82rem", color: C.slate, borderBottom: "1px solid #F0F4F2", verticalAlign: "middle", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 140 }}>
                {person.dept}
              </td>
              <td style={{ padding: "10px 12px", borderBottom: "1px solid #F0F4F2", verticalAlign: "middle" }}>
                <RoleBadge role={person.role} />
              </td>
              <td style={{ padding: "10px 12px", borderBottom: "1px solid #F0F4F2", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                {person.invited ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: ".75rem", color: C.sage }}>
                    <span>✓</span> Sent
                  </span>
                ) : (
                  <button
                    onClick={() => onInvite(person.id)}
                    style={{
                      padding: "4px 10px", background: C.white, color: C.pine,
                      border: `1.5px solid ${C.mint}`, borderRadius: 5,
                      fontFamily: "'DM Sans', sans-serif", fontSize: ".75rem", fontWeight: 600,
                      cursor: "pointer", whiteSpace: "nowrap",
                    }}
                  >Send invite</button>
                )}
              </td>
              <td style={{ padding: "10px 8px", borderBottom: "1px solid #F0F4F2", verticalAlign: "middle" }}>
                <button
                  onClick={() => onRemove(person.id)}
                  title="Remove"
                  style={{
                    background: "none", border: "none", color: C.mist,
                    cursor: "pointer", fontSize: ".95rem", padding: "2px 4px",
                    borderRadius: 4, transition: "color .15s",
                  }}
                >×</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function S1b4AddStaff({
  onHome,
  sites       = ["Moriah", "Middlebury", "Shoreham", "Brandenburg"],
  departments = ["Production / Distilling", "Bottling & Packaging", "Warehouse", "Facility Maintenance", "Quality Control", "Tasting Room / Hospitality", "Administration"],
  initialStaff = SEED_STAFF,
  onContinue,
  onBack,
}) {
  const [staff,      setStaff]      = useState(initialStaff.map(s => ({ ...s })));
  const [filterSite, setFilterSite] = useState("");
  const [bulkSent,   setBulkSent]   = useState(false);
  const nextId = useRef(initialStaff.length + 1);

  function handleAdd(person) {
    setStaff(s => [...s, { ...person, id: nextId.current++, invited: false }]);
  }

  function handleInvite(id) {
    setStaff(s => s.map(p => p.id === id ? { ...p, invited: true } : p));
  }

  function handleRemove(id) {
    setStaff(s => s.filter(p => p.id !== id));
  }

  function handleBulkInvite() {
    setStaff(s => s.map(p => ({ ...p, invited: true })));
    setBulkSent(true);
    setTimeout(() => setBulkSent(false), 3000);
  }

  const uninvitedCount = staff.filter(p => !p.invited).length;
  const invitedCount   = staff.filter(p => p.invited).length;

  return (
    <div style={{ minHeight: "100vh", background: C.chalk, fontFamily: "'DM Sans', sans-serif", paddingBottom: 80 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input::placeholder { color: ${C.mist}; }
        @keyframes fadeUp  { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes slideIn { from { opacity:0; transform:translateY(-5px); } to { opacity:1; transform:translateY(0); } }
        .anim  { animation: fadeUp .28s cubic-bezier(.4,0,.2,1) both; }
        .btn-primary-hover:hover  { background: ${C.pine} !important; transform: translateY(-1px); box-shadow: 0 4px 14px rgba(45,90,61,.3); }
        .btn-ghost-hover:hover    { color: ${C.pine} !important; background: ${C.foam} !important; }
        .btn-secondary-hover:hover{ background: ${C.foam} !important; }
        .invite-btn:hover { background: ${C.foam} !important; }
        .remove-btn:hover { color: ${C.red} !important; }
        .staff-row:hover td { background: ${C.foam} !important; }
        .split { display: grid; grid-template-columns: 420px 1fr; gap: 20px; align-items: start; }
        @media (max-width: 860px) { .split { grid-template-columns: 1fr; } }
        .filter-chip { transition: all .15s; cursor: pointer; }
        .filter-chip:hover { border-color: ${C.sage} !important; color: ${C.pine} !important; }
      `}</style>

      {/* Top nav */}
      <EHSHeader onHome={onHome} rightContent={
        <div style={{ fontSize: ".72rem", color: C.mist, background: "rgba(255,255,255,.08)", padding: "3px 10px", borderRadius: 20, whiteSpace: "nowrap" }}>
          New account setup
        </div>
      } />

      {/* Content */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px 20px" }}>

        <div className="anim" style={{ animationDelay: "0ms" }}>
          <Stepper current={3} />
        </div>

        <div className="anim" style={{ marginBottom: 24, animationDelay: "30ms" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, color: C.ink }}>Add your staff</h1>
          <p style={{ fontSize: ".9rem", color: C.slate, marginTop: 4, lineHeight: 1.5 }}>
            Add people one at a time or import a list. Invites are sent automatically when you're ready.
          </p>
        </div>

        <div className="split anim" style={{ animationDelay: "60ms" }}>

          {/* ── Left: add form + CSV ── */}
          <AddPersonForm sites={sites} departments={departments} onAdd={handleAdd} />

          {/* ── Right: staff list ── */}
          <div>
            {/* Header row */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
              <div>
                <h2 style={{ fontSize: "1rem", fontWeight: 600, color: C.ink }}>Added so far</h2>
                <p style={{ fontSize: ".78rem", color: C.mist, marginTop: 2 }}>
                  {staff.length} added · {invitedCount} invited · {uninvitedCount} pending
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {uninvitedCount > 0 && (
                  <button
                    onClick={handleBulkInvite}
                    style={{
                      padding: "6px 14px", background: C.white, color: C.pine,
                      border: `1.5px solid ${C.mint}`, borderRadius: 6,
                      fontFamily: "'DM Sans', sans-serif", fontSize: ".78rem", fontWeight: 600,
                      cursor: "pointer", transition: "all .15s",
                    }}
                  >
                    {bulkSent ? "✓ All invited" : `Send all invites (${uninvitedCount})`}
                  </button>
                )}
              </div>
            </div>

            {/* Site filter chips */}
            {sites.length > 1 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                <div
                  className="filter-chip"
                  onClick={() => setFilterSite("")}
                  style={{
                    padding: "4px 12px", borderRadius: 20,
                    fontSize: ".75rem", fontWeight: 600,
                    background: filterSite === "" ? C.forest : C.white,
                    color: filterSite === "" ? C.white : C.slate,
                    border: `1.5px solid ${filterSite === "" ? C.forest : "#D0DEDB"}`,
                  }}
                >All sites</div>
                {sites.map(s => (
                  <div
                    key={s}
                    className="filter-chip"
                    onClick={() => setFilterSite(s === filterSite ? "" : s)}
                    style={{
                      padding: "4px 12px", borderRadius: 20,
                      fontSize: ".75rem", fontWeight: 600,
                      background: filterSite === s ? C.forest : C.white,
                      color: filterSite === s ? C.white : C.slate,
                      border: `1.5px solid ${filterSite === s ? C.forest : "#D0DEDB"}`,
                    }}
                  >{s}</div>
                ))}
              </div>
            )}

            <StaffTable
              staff={staff}
              filterSite={filterSite}
              onInvite={handleInvite}
              onRemove={handleRemove}
            />

            {staff.length > 0 && (
              <div style={{
                marginTop: 10, padding: "10px 14px",
                background: C.chalk, borderRadius: 7,
                fontSize: ".78rem", color: C.mist, textAlign: "center",
              }}>
                Keep adding — or continue and{" "}
                <span
                  onClick={() => onContinue && onContinue({ staff })}
                  style={{ color: C.sage, fontWeight: 600, cursor: "pointer" }}
                >
                  import the rest via CSV later
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Annotation */}
        <div className="anim" style={{
          marginTop: 16,
          position: "relative", padding: "10px 14px 10px 36px",
          background: "#FFF8E7", border: "1px dashed #E8C87A",
          borderRadius: 7, fontSize: ".78rem", color: "#7A5A1A", lineHeight: 1.5,
          animationDelay: "90ms",
        }}>
          <span style={{ position: "absolute", left: 10, top: 10, fontSize: ".85rem" }}>✏️</span>
          UX NOTE: Invites sent per-person OR bulk via "Send all invites." Users can skip inviting now — invites sent later from Org Chart.
          "Add person" form auto-clears after each submission. CSV import tolerates varied column names with a column-mapper step.
        </div>
      </div>

      {/* ── Fixed action bar ── */}
      <div style={{
        position: "fixed", bottom: 58, left: 0, right: 0,
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
            border: "none", borderRadius: 7, fontFamily: "'DM Sans', sans-serif",
            fontSize: ".88rem", fontWeight: 600, cursor: "pointer", transition: "all .18s",
          }}
        >← Back</button>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: ".8rem", color: C.mist }}>
            {staff.length === 0 ? "No staff added yet" : `${staff.length} added · ${uninvitedCount} invite${uninvitedCount !== 1 ? "s" : ""} pending`}
          </span>
          <button
            className="btn-ghost-hover"
            onClick={() => onContinue && onContinue({ staff })}
            style={{
              padding: "10px 18px", background: "none", color: C.slate,
              border: `1.5px solid #D0DEDB`, borderRadius: 7,
              fontFamily: "'DM Sans', sans-serif", fontSize: ".88rem", fontWeight: 600,
              cursor: "pointer", transition: "all .18s",
            }}
          >Skip for now</button>
          <button
            className="btn-primary-hover"
            onClick={() => onContinue && onContinue({ staff })}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 22px", background: C.sage, color: C.white,
              border: "none", borderRadius: 7, fontFamily: "'DM Sans', sans-serif",
              fontSize: ".88rem", fontWeight: 600, cursor: "pointer", transition: "all .18s",
            }}
          >Continue to Training →</button>
        </div>
      </div>
    </div>
  );
}
