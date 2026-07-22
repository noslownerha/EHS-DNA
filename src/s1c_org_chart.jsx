import { useState, useMemo } from "react";
import { EHSHeader } from "./AppShell.jsx";
import { BRAND, COLORS } from "./constants.js";

// ── Design tokens ────────────────────────────────────────────────────────────
const C = { ...COLORS };


// ── Utilities ────────────────────────────────────────────────────────────────
function initials(first, last) {
  return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase();
}

function fullName(p) { return `${p.first} ${p.last}`; }

function allPeople(org) {
  return org.flatMap(site =>
    site.departments.flatMap(dept =>
      dept.staff.map(p => ({ ...p, site: site.name, dept: dept.name, deptId: dept.id, siteId: site.id }))
    )
  );
}

function buildTransferPreview(person, newDept, newSite, org) {
  const oldDept = org
    .flatMap(s => s.departments)
    .find(d => d.id === person.deptId);

  const changes = [];
  if (oldDept && oldDept.name !== newDept)
    changes.push({ type: "remove", text: `Removed from: ${oldDept.name} training group` });
  if (newDept && oldDept?.name !== newDept)
    changes.push({ type: "add",    text: `Added to: ${newDept} training group` });
  changes.push({ type: "keep", text: "Forklift Certified group (manual — retained)" });
  changes.push({ type: "keep", text: "All prior training completion records" });
  return changes;
}

// ── Avatar chip ──────────────────────────────────────────────────────────────
function StaffChip({ person, highlight, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={() => onClick && onClick(person)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "4px 10px",
        background: highlight ? C.mint : hov ? C.foam : C.white,
        border: `1px solid ${highlight ? C.sage : hov ? C.mint : "#D0DEDB"}`,
        borderRadius: 20,
        fontSize: ".75rem", color: highlight ? C.forest : C.slate,
        cursor: onClick ? "pointer" : "default",
        transition: "all .15s",
        fontWeight: highlight ? 600 : 400,
      }}
    >
      <div style={{
        width: 18, height: 18, borderRadius: "50%",
        background: highlight ? C.sage : C.mint,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: ".58rem", fontWeight: 700,
        color: highlight ? C.white : C.forest, flexShrink: 0,
      }}>
        {initials(person.first, person.last)}
      </div>
      {fullName(person)}
    </div>
  );
}

function AddChip({ onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "inline-flex", alignItems: "center",
        padding: "4px 10px",
        background: hov ? C.foam : "none",
        border: `1px dashed ${hov ? C.sage : C.mint}`,
        borderRadius: 20,
        fontSize: ".75rem", color: C.sage,
        cursor: "pointer", transition: "all .15s",
      }}
    >+ Add</div>
  );
}

// ── Dept block ───────────────────────────────────────────────────────────────
function DeptBlock({ dept, searchQuery, onChipClick, onTransferOpen }) {
  const matched = searchQuery
    ? dept.staff.filter(p => fullName(p).toLowerCase().includes(searchQuery.toLowerCase()))
    : null;

  return (
    <div style={{
      marginBottom: 10, padding: "10px 12px",
      background: C.chalk, borderRadius: 7,
      borderLeft: `3px solid ${C.sage}`,
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7,
      }}>
        <strong style={{ fontSize: ".85rem", color: C.pine }}>
          {dept.emoji} {dept.name}
        </strong>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <small style={{ fontSize: ".73rem", color: C.mist }}>
            Lead: {dept.lead ?? "— unassigned"}
          </small>
          <button
            onClick={() => onTransferOpen && onTransferOpen(dept)}
            style={{
              padding: "3px 9px", background: "none", color: C.mist,
              border: "1px solid transparent", borderRadius: 5,
              fontFamily: "'DM Sans', sans-serif", fontSize: ".72rem",
              cursor: "pointer", transition: "all .15s",
            }}
            onMouseEnter={e => { e.target.style.color = C.pine; e.target.style.background = C.foam; e.target.style.borderColor = C.mint; }}
            onMouseLeave={e => { e.target.style.color = C.mist; e.target.style.background = "none"; e.target.style.borderColor = "transparent"; }}
          >Edit</button>
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {dept.staff.map(p => (
          <StaffChip
            key={p.id}
            person={p}
            highlight={matched?.some(m => m.id === p.id)}
            onClick={onChipClick}
          />
        ))}
        <AddChip />
      </div>
    </div>
  );
}

// ── Site accordion ───────────────────────────────────────────────────────────
function SiteBlock({ site, searchQuery, onToggle, onChipClick, onTransferOpen }) {
  const staffCount = site.departments.reduce((n, d) => n + d.staff.length, 0);

  return (
    <div style={{
      marginBottom: 14,
      border: "1.5px solid #E2EBE6",
      borderRadius: 10, overflow: "hidden",
    }}>
      {/* Header */}
      <div
        onClick={onToggle}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "13px 16px",
          background: C.forest, color: C.white,
          cursor: "pointer", userSelect: "none",
        }}
      >
        <div>
          <div style={{ fontWeight: 600, fontSize: ".92rem", display: "flex", alignItems: "center", gap: 6 }}>
            <span>📍</span> {site.name}
            <span style={{
              fontSize: ".65rem", color: C.forest, background: C.mint,
              padding: "2px 7px", borderRadius: 10, fontWeight: 700, marginLeft: 2,
            }}>
              {site.expanded ? "▲" : "▼"}
            </span>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 3 }}>
            <small style={{ fontSize: ".73rem", color: C.mint }}>{site.location}</small>
            <small style={{ fontSize: ".73rem", color: C.mint }}>{staffCount} staff</small>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{
            display: "inline-flex", alignItems: "center",
            padding: "2px 9px", borderRadius: 20,
            fontSize: ".68rem", fontWeight: 600,
            background: C.foam, color: C.pine,
          }}>{site.status}</span>
          <button
            onClick={e => e.stopPropagation()}
            style={{
              padding: "4px 10px", background: "none",
              color: C.mint, border: `1px solid rgba(168,213,181,.4)`,
              borderRadius: 5, fontFamily: "'DM Sans', sans-serif",
              fontSize: ".73rem", fontWeight: 600, cursor: "pointer",
            }}
          >Edit site</button>
        </div>
      </div>

      {/* Body */}
      {site.expanded && (
        <div style={{ padding: "12px 14px", background: C.white }}>
          {site.departments.map(dept => (
            <DeptBlock
              key={dept.id}
              dept={dept}
              searchQuery={searchQuery}
              onChipClick={onChipClick}
              onTransferOpen={onTransferOpen}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Transfer panel ────────────────────────────────────────────────────────────
function TransferPanel({ org, allStaff, initialPerson, onClose, onConfirm }) {
  const [personQuery, setPersonQuery]   = useState(initialPerson ? fullName(initialPerson) : "");
  const [personFocus, setPersonFocus]   = useState(false);
  const [selectedPerson, setSelected]   = useState(initialPerson ?? null);
  const [newDept, setNewDept]           = useState("");
  const [newSite, setNewSite]           = useState("");
  const [confirmed, setConfirmed]       = useState(false);

  const allDepts = [...new Set(org.flatMap(s => s.departments.map(d => d.name)))];
  const suggestions = personQuery && !selectedPerson
    ? allStaff.filter(p => fullName(p).toLowerCase().includes(personQuery.toLowerCase())).slice(0, 5)
    : [];

  const preview = selectedPerson && (newDept || newSite)
    ? buildTransferPreview(selectedPerson, newDept || selectedPerson.dept, newSite || selectedPerson.site, org)
    : null;

  function handleConfirm() {
    setConfirmed(true);
    setTimeout(() => { setConfirmed(false); onConfirm && onConfirm({ person: selectedPerson, newDept, newSite }); }, 1200);
  }

  const inputStyle = (focused) => ({
    width: "100%", padding: "9px 12px",
    border: `1.5px solid ${focused ? C.sage : "#D0DEDB"}`,
    borderRadius: 7, fontFamily: "'DM Sans', sans-serif",
    fontSize: ".85rem", color: C.ink, background: C.white, outline: "none",
    boxShadow: focused ? `0 0 0 3px rgba(74,140,92,.12)` : "none",
    transition: "all .18s",
  });

  const selectStyle = {
    width: "100%", padding: "9px 12px",
    border: "1.5px solid #D0DEDB", borderRadius: 7,
    fontFamily: "'DM Sans', sans-serif", fontSize: ".85rem",
    color: C.ink, background: C.white, outline: "none",
    cursor: "pointer", appearance: "none",
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%238FA3A0'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", paddingRight: 32,
  };

  return (
    <div style={{
      marginTop: 16, padding: 20,
      background: C.goldLt,
      border: `1.5px solid #F0D090`,
      borderRadius: 10,
      animation: "fadeUp .2s ease both",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, color: C.gold }}>🔄 Transfer a person</h2>
          <p style={{ fontSize: ".78rem", color: "#9A7A3A", marginTop: 2 }}>
            Moving someone? The system shows exactly what changes before you confirm.
          </p>
        </div>
        <button onClick={onClose} style={{
          background: "none", border: "none", color: C.mist, fontSize: "1.1rem",
          cursor: "pointer", padding: "2px 6px", borderRadius: 4,
        }}>×</button>
      </div>

      {/* 3-col form */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 14 }}>

        {/* Person field with typeahead */}
        <div style={{ position: "relative" }}>
          <div style={{ fontSize: ".7rem", fontWeight: 600, letterSpacing: ".07em", textTransform: "uppercase", color: C.sage, marginBottom: 5 }}>Person</div>
          <input
            value={personQuery}
            onChange={e => { setPersonQuery(e.target.value); setSelected(null); }}
            onFocus={() => setPersonFocus(true)}
            onBlur={() => setTimeout(() => setPersonFocus(false), 150)}
            placeholder="Search by name…"
            style={inputStyle(personFocus)}
          />
          {suggestions.length > 0 && personFocus && (
            <div style={{
              position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20,
              background: C.white, border: "1.5px solid #D0DEDB",
              borderRadius: 7, boxShadow: "0 4px 16px rgba(0,0,0,.1)",
              overflow: "hidden", marginTop: 2,
            }}>
              {suggestions.map(p => (
                <div
                  key={p.id}
                  onClick={() => { setSelected(p); setPersonQuery(fullName(p)); setNewDept(p.dept); setNewSite(p.site); }}
                  style={{
                    padding: "8px 12px", cursor: "pointer",
                    fontSize: ".83rem", borderBottom: "1px solid #F0F4F2",
                    transition: "background .12s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = C.foam}
                  onMouseLeave={e => e.currentTarget.style.background = C.white}
                >
                  <div style={{ fontWeight: 600, color: C.ink }}>{fullName(p)}</div>
                  <div style={{ fontSize: ".72rem", color: C.mist }}>{p.dept} · {p.site}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* New dept */}
        <div>
          <div style={{ fontSize: ".7rem", fontWeight: 600, letterSpacing: ".07em", textTransform: "uppercase", color: C.sage, marginBottom: 5 }}>New primary department</div>
          <select value={newDept} onChange={e => setNewDept(e.target.value)} style={selectStyle}>
            <option value="">— select dept —</option>
            {allDepts.map(d => <option key={d}>{d}</option>)}
          </select>
        </div>

        {/* New site */}
        <div>
          <div style={{ fontSize: ".7rem", fontWeight: 600, letterSpacing: ".07em", textTransform: "uppercase", color: C.sage, marginBottom: 5 }}>New site (if moving)</div>
          <select value={newSite} onChange={e => setNewSite(e.target.value)} style={selectStyle}>
            <option value="">— same site —</option>
            {org.map(s => <option key={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      {/* Preview block */}
      {preview && (
        <div style={{
          background: C.white, border: "1px solid #E0D0A0",
          borderRadius: 8, padding: 14, marginBottom: 14,
          fontSize: ".82rem", animation: "fadeUp .18s ease both",
        }}>
          <div style={{ fontWeight: 600, marginBottom: 10, color: C.gold }}>Preview of changes:</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {preview.map((c, i) => (
              <div key={i} style={{
                color: c.type === "remove" ? C.red : c.type === "add" ? C.sage : C.slate,
                display: "flex", gap: 5, alignItems: "flex-start",
              }}>
                <span style={{ flexShrink: 0, fontWeight: 700 }}>
                  {c.type === "remove" ? "−" : c.type === "add" ? "+" : "="}
                </span>
                {c.text}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={handleConfirm}
          disabled={!selectedPerson || (!newDept && !newSite) || confirmed}
          style={{
            padding: "9px 20px",
            background: confirmed ? C.sage + "99" : (!selectedPerson || (!newDept && !newSite)) ? "#B0C8BA" : C.sage,
            color: C.white, border: "none", borderRadius: 7,
            fontFamily: "'DM Sans', sans-serif", fontSize: ".85rem", fontWeight: 600,
            cursor: (!selectedPerson || (!newDept && !newSite)) ? "default" : "pointer",
            transition: "all .18s",
          }}
        >{confirmed ? "✓ Transferred" : "Confirm transfer"}</button>
        <button
          onClick={onClose}
          style={{
            padding: "9px 16px", background: "none", color: C.slate,
            border: "none", borderRadius: 7, fontFamily: "'DM Sans', sans-serif",
            fontSize: ".85rem", fontWeight: 600, cursor: "pointer",
          }}
        >Cancel</button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function S1cOrgChart({
  onHome,
  onBack,
  companyName = BRAND.company,
  initialOrg  = [],
  onAddStaff,
  onAddSite,
}) {
  const [org,            setOrg]           = useState(initialOrg.map(s => ({ ...s, departments: s.departments.map(d => ({ ...d, staff: [...d.staff] })) })));
  const [search,         setSearch]         = useState("");
  const [transferOpen,   setTransferOpen]   = useState(false);
  const [transferPerson, setTransferPerson] = useState(null);
  const [searchFocused,  setSearchFocused]  = useState(false);

  const people = useMemo(() => allPeople(org), [org]);
  const totalStaff = people.length;
  const totalDepts = org.reduce((n, s) => n + s.departments.length, 0);

  // Highlight matching chips
  const searchLower = search.toLowerCase().trim();
  const matchedIds  = searchLower
    ? new Set(people.filter(p => fullName(p).toLowerCase().includes(searchLower) || p.dept.toLowerCase().includes(searchLower) || p.site.toLowerCase().includes(searchLower)).map(p => p.id))
    : null;

  function toggleSite(siteId) {
    setOrg(o => o.map(s => s.id === siteId ? { ...s, expanded: !s.expanded } : s));
  }

  function expandAll() { setOrg(o => o.map(s => ({ ...s, expanded: true }))); }
  function collapseAll() { setOrg(o => o.map(s => ({ ...s, expanded: false }))); }

  function handleChipClick(person) {
    setTransferPerson(person);
    setTransferOpen(true);
  }

  function handleTransferConfirm({ person, newDept, newSite }) {
    setOrg(o => {
      // Remove from old dept
      let updated = o.map(site => ({
        ...site,
        departments: site.departments.map(dept => ({
          ...dept,
          staff: dept.staff.filter(p => p.id !== person.id),
        })),
      }));
      // Add to new dept/site
      const targetSiteName = newSite || person.site;
      const targetDeptName = newDept || person.dept;
      updated = updated.map(site => {
        if (site.name !== targetSiteName) return site;
        return {
          ...site,
          departments: site.departments.map(dept => {
            if (dept.name !== targetDeptName) return dept;
            return { ...dept, staff: [...dept.staff, { id: person.id, first: person.first, last: person.last }] };
          }),
        };
      });
      return updated;
    });
    setTransferOpen(false);
    setTransferPerson(null);
  }

  return (
    <div style={{ minHeight: "100vh", background: C.chalk, fontFamily: "'DM Sans', sans-serif", paddingBottom: 40 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input::placeholder { color: ${C.mist}; }
        @keyframes fadeUp  { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .anim { animation: fadeUp .28s cubic-bezier(.4,0,.2,1) both; }
        .btn-primary:hover   { background: ${C.pine} !important; transform: translateY(-1px); box-shadow: 0 4px 14px rgba(45,90,61,.3); }
        .btn-secondary:hover { background: ${C.foam} !important; }
        .expand-btn:hover    { color: ${C.pine} !important; }
        select option { color: ${C.ink}; }
      `}</style>

      {/* ── Top nav ── */}
      <EHSHeader onHome={onHome} onBack={onBack} rightContent={
        <div style={{ fontSize: ".72rem", color: C.mist, background: "rgba(255,255,255,.08)", padding: "3px 10px", borderRadius: 20, whiteSpace: "nowrap" }}>
          Organization
        </div>
      } />

      {/* ── Content ── */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px" }}>

        {/* Page header */}
        <div className="anim" style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          marginBottom: 24, flexWrap: "wrap", gap: 14,
          animationDelay: "0ms",
        }}>
          <div>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: C.ink }}>Organization</h1>
            <p style={{ fontSize: ".85rem", color: C.mist, marginTop: 3 }}>
              {companyName} · {org.length} site{org.length !== 1 ? "s" : ""} · {totalStaff} staff · {totalDepts} departments
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            {/* Search */}
            <div style={{ position: "relative" }}>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Search people, depts, sites…"
                style={{
                  padding: "8px 12px 8px 32px", width: 224,
                  border: `1.5px solid ${searchFocused ? C.sage : "#D0DEDB"}`,
                  borderRadius: 7, fontFamily: "'DM Sans', sans-serif",
                  fontSize: ".85rem", color: C.ink, background: C.white, outline: "none",
                  boxShadow: searchFocused ? `0 0 0 3px rgba(74,140,92,.12)` : "none",
                  transition: "all .18s",
                }}
              />
              <span style={{
                position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
                fontSize: ".85rem", color: C.mist, pointerEvents: "none",
              }}>🔍</span>
              {search && (
                <span
                  onClick={() => setSearch("")}
                  style={{
                    position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                    fontSize: ".8rem", color: C.mist, cursor: "pointer",
                  }}
                >×</span>
              )}
            </div>

            <button className="btn-secondary" onClick={onAddStaff} style={{
              padding: "7px 14px", background: C.white, color: C.pine,
              border: `1.5px solid ${C.mint}`, borderRadius: 6,
              fontFamily: "'DM Sans', sans-serif", fontSize: ".8rem", fontWeight: 600,
              cursor: "pointer", transition: "all .15s",
            }}>+ Add staff</button>

            <button className="btn-secondary" onClick={onAddSite} style={{
              padding: "7px 14px", background: C.white, color: C.pine,
              border: `1.5px solid ${C.mint}`, borderRadius: 6,
              fontFamily: "'DM Sans', sans-serif", fontSize: ".8rem", fontWeight: 600,
              cursor: "pointer", transition: "all .15s",
            }}>+ Add site</button>

            <button className="btn-primary" onClick={() => setTransferOpen(t => !t)} style={{
              padding: "7px 16px", background: C.sage, color: C.white,
              border: "none", borderRadius: 6,
              fontFamily: "'DM Sans', sans-serif", fontSize: ".8rem", fontWeight: 600,
              cursor: "pointer", transition: "all .15s",
            }}>🔄 Bulk transfer</button>
          </div>
        </div>

        {/* Expand / collapse controls */}
        <div className="anim" style={{
          display: "flex", alignItems: "center", gap: 6,
          marginBottom: 12, animationDelay: "30ms",
        }}>
          <button className="expand-btn" onClick={expandAll} style={{
            background: "none", border: "none", color: C.mist, fontSize: ".75rem",
            cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "color .15s",
          }}>Expand all</button>
          <span style={{ color: "#D0DEDB", fontSize: ".8rem" }}>·</span>
          <button className="expand-btn" onClick={collapseAll} style={{
            background: "none", border: "none", color: C.mist, fontSize: ".75rem",
            cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "color .15s",
          }}>Collapse all</button>
          {search && (
            <>
              <span style={{ color: "#D0DEDB", fontSize: ".8rem" }}>·</span>
              <span style={{ fontSize: ".75rem", color: C.sage }}>
                {matchedIds?.size ?? 0} result{matchedIds?.size !== 1 ? "s" : ""} for "{search}"
              </span>
            </>
          )}
        </div>

        {/* Site tree */}
        <div className="anim" style={{ animationDelay: "60ms" }}>
          {org.map(site => (
            <SiteBlock
              key={site.id}
              site={{
                ...site,
                departments: site.departments.map(dept => ({
                  ...dept,
                  staff: dept.staff.map(p => ({
                    ...p,
                    highlighted: matchedIds ? matchedIds.has(p.id) : false,
                  })),
                })),
              }}
              searchQuery={searchLower}
              onToggle={() => toggleSite(site.id)}
              onChipClick={handleChipClick}
              onTransferOpen={() => { setTransferOpen(true); }}
            />
          ))}
        </div>

        {/* Transfer panel */}
        {transferOpen && (
          <div className="anim" style={{ animationDelay: "0ms" }}>
            <TransferPanel
              org={org}
              allStaff={people}
              initialPerson={transferPerson}
              onClose={() => { setTransferOpen(false); setTransferPerson(null); }}
              onConfirm={handleTransferConfirm}
            />
          </div>
        )}

        {/* Annotation */}
        <div className="anim" style={{
          marginTop: 16,
          position: "relative", padding: "10px 14px 10px 36px",
          background: "#FFF8E7", border: "1px dashed #E8C87A",
          borderRadius: 7, fontSize: ".78rem", color: "#7A5A1A", lineHeight: 1.5,
          animationDelay: "80ms",
        }}>
          <span style={{ position: "absolute", left: 10, top: 10 }}>✏️</span>
          UX NOTE: Transfer preview is the key UX win — no surprises. Shows additions, removals, and what's retained BEFORE committing.
          Org chart collapses by site to keep the view manageable at scale. Global search highlights matching chips across all expanded sites.
          Click any staff chip to pre-fill the transfer panel for that person.
        </div>
      </div>
    </div>
  );
}
