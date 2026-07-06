import { COLORS } from "./constants.js";
import { useState, useEffect, useMemo } from "react";

const C = { ...COLORS };

// Spec §14.2: permitted roles — Trainer, Safety Officer, Site Manager, Company Admin
// Department Lead is explicitly excluded.
const PERMITTED_ROLES = ["trainer", "safety", "site_manager", "admin"];

let ALL_STAFF = [];
const ALL_STAFF_UNUSED = [
  { id: 1,  first: "Sarah",  last: "Mitchell", dept: "Bottling & Packaging",    site: "Moriah",      group: "Bottling & Packaging" },
  { id: 2,  first: "Jake",   last: "Larson",    dept: "Bottling & Packaging",    site: "Moriah",      group: "Bottling & Packaging" },
  { id: 3,  first: "Beth",   last: "Torres",    dept: "Bottling & Packaging",    site: "Moriah",      group: "Bottling & Packaging" },
  { id: 4,  first: "Marcus", last: "Webb",      dept: "Warehouse",               site: "Moriah",      group: "Warehouse"             },
  { id: 5,  first: "Carlos", last: "R.",        dept: "Warehouse",               site: "Moriah",      group: "Warehouse"             },
  { id: 6,  first: "Tom",    last: "Rivera",    dept: "Facility Maintenance",             site: "Shoreham",    group: "Facility Maintenance"           },
  { id: 7,  first: "Dana",   last: "Kowalski",  dept: "Production / Distilling", site: "Middlebury",  group: "Production / Distilling"},
  { id: 8,  first: "Mia",    last: "Chen",      dept: "Quality Control",         site: "Middlebury",  group: "Quality Control"       },
  { id: 9,  first: "Lena",   last: "Park",      dept: "Production / Distilling", site: "Middlebury",  group: "Production / Distilling"},
  { id: 10, first: "Ray",    last: "Santos",    dept: "Production / Distilling", site: "Middlebury",  group: "Production / Distilling"},
  { id: 11, first: "Priya",  last: "Nair",      dept: "Administration",          site: "Brandenburg", group: "Administration"        },
  { id: 12, first: "Drew",   last: "Nash",      dept: "Bottling & Packaging",    site: "Shoreham",    group: "Bottling & Packaging"  },
];

let TRAINING_LIBRARY = [];
const TRAINING_LIBRARY_UNUSED = [
  { id: 1, title: "Annual Safety Refresher",             type: "in_person", recurrence_months: 12 },
  { id: 2, title: "Emergency Evacuation Drill Sign-Off", type: "in_person", recurrence_months: 6  },
  { id: 3, title: "Hazard Communication (HAZCOM)",       type: "in_person", recurrence_months: 12 },
  { id: 4, title: "First Aid & CPR",                     type: "in_person", recurrence_months: 24 },
  { id: 5, title: "Forklift Safety All-Hands",           type: "in_person", recurrence_months: 12 },
];

const SITES  = () => [...new Set(ALL_STAFF.map(s => s.site))];
const DEPTS  = () => [...new Set(ALL_STAFF.map(s => s.dept))];
const GROUPS = () => [...new Set(ALL_STAFF.map(s => s.group))];

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function Avatar({ first, last, selected }) {
  return (
    <div style={{
      width: 28, height: 28, borderRadius: "50%",
      background: selected ? C.sage : C.mint,
      color: selected ? C.white : C.forest,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: ".65rem", fontWeight: 700, flexShrink: 0,
      transition: "all .15s",
    }}>
      {first[0]}{last[0]}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function S4dGroupSessionLog({ onHome,
  userRole    = "trainer",
  userName    = "Trainer",
  onConfirm,
  onClose,
}) {
  const [training,     setTraining]     = useState(null);
  const [, forceRender] = useState(0);
  useEffect(() => {
    Promise.all([api.staffDirectory(), api.listTrainings()]).then(([dir, trs]) => {
      ALL_STAFF = dir.map(u => {
        const [first, ...rest] = (u.name ?? "").split(" ");
        return { id: u.id, first, last: rest.join(" "), dept: u.department ?? "—",
                 site: u.site ?? "—", group: u.department ?? "—" };
      });
      TRAINING_LIBRARY = trs.filter(t => t.active && t.kind === "in_person")
        .map(t => ({ id: t.id, title: t.title, type: "in_person", recurrence_months: t.frequency_months }));
      forceRender(n => n + 1);
    }).catch(err => console.error("Group log load failed:", err.message));
  }, []);
  const [sessionDate,  setSessionDate]  = useState(todayStr());
  const [trainerName,  setTrainerName]  = useState(userName);
  const [notes,        setNotes]        = useState("");
  const [filterSite,   setFilterSite]   = useState("");
  const [filterDept,   setFilterDept]   = useState("");
  const [filterGroup,  setFilterGroup]  = useState("");
  const [selected,     setSelected]     = useState(new Set());
  const [confirmed,    setConfirmed]    = useState(false);
  const [dateFocused,  setDateFocused]  = useState(false);
  const [trainerFocus, setTrainerFocus] = useState(false);
  const [notesFocused, setNotesFocused] = useState(false);

  // Spec: role gate
  if (!PERMITTED_ROLES.includes(userRole)) {
    return (
      <div style={{ padding: 32, textAlign: "center", fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ fontSize: "2rem", marginBottom: 12 }}>🔒</div>
        <div style={{ fontSize: ".95rem", fontWeight: 600, color: C.ink, marginBottom: 6 }}>Access restricted</div>
        <div style={{ fontSize: ".85rem", color: C.mist }}>Group session logging requires Trainer, Safety Officer, Site Manager, or Company Admin role.</div>
      </div>
    );
  }

  const filtered = useMemo(() =>
    ALL_STAFF.filter(s => {
      if (filterSite  && s.site  !== filterSite)  return false;
      if (filterDept  && s.dept  !== filterDept)  return false;
      if (filterGroup && s.group !== filterGroup) return false;
      return true;
    }),
    [filterSite, filterDept, filterGroup]
  );

  // Group by training group for display
  const groupedByGroup = useMemo(() => {
    const groups = {};
    filtered.forEach(s => {
      if (!groups[s.group]) groups[s.group] = [];
      groups[s.group].push(s);
    });
    return groups;
  }, [filtered]);

  function toggleOne(id) {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  // Spec: "Select all" toggle per group
  function toggleGroup(groupName) {
    const groupIds = (groupedByGroup[groupName] ?? []).map(s => s.id);
    const allSelected = groupIds.every(id => selected.has(id));
    setSelected(prev => {
      const n = new Set(prev);
      if (allSelected) groupIds.forEach(id => n.delete(id));
      else             groupIds.forEach(id => n.add(id));
      return n;
    });
  }

  function handleConfirm() {
    setConfirmed(true);
    const attendees = ALL_STAFF.filter(s => selected.has(s.id));
    onConfirm?.({ training, trainingId: training?.id, attendeeIds: attendees.map(a => a.id), sessionDate, trainerName, notes, attendees });
  }

  const canConfirm = training && selected.size > 0 && trainerName.trim();

  const selectStyle = {
    padding: "8px 28px 8px 10px", border: "1.5px solid #D0DEDB", borderRadius: 7,
    fontFamily: "'DM Sans', sans-serif", fontSize: ".82rem",
    color: C.ink, background: C.white, outline: "none",
    cursor: "pointer", appearance: "none",
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%238FA3A0'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center",
  };

  const inputStyle = focused => ({
    width: "100%", padding: "9px 12px",
    border: `1.5px solid ${focused ? C.sage : "#D0DEDB"}`,
    borderRadius: 7, fontFamily: "'DM Sans', sans-serif",
    fontSize: ".88rem", color: C.ink, background: C.white, outline: "none",
    boxShadow: focused ? `0 0 0 3px rgba(74,140,92,.12)` : "none",
    transition: "all .18s",
  });

  if (confirmed) {
    return (
      <div style={{ padding: "32px 28px", textAlign: "center", fontFamily: "'DM Sans', sans-serif" }}>
        <style>{ `@keyframes popIn { 0%{transform:scale(.8);opacity:0;} 60%{transform:scale(1.1);} 100%{transform:scale(1);opacity:1;} }` }</style>
        <div style={{ fontSize: "2.8rem", marginBottom: 12, animation: "popIn .35s ease both" }}>✅</div>
        <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: C.ink, marginBottom: 6 }}>Session logged</h2>
        <p style={{ fontSize: ".85rem", color: C.mist, marginBottom: 8 }}>
          {selected.size} completion{selected.size > 1 ? "s" : ""} written for <strong>{training?.title}</strong>
        </p>
        <p style={{ fontSize: ".78rem", color: C.mist }}>Session date: {sessionDate} · Trainer: {trainerName}</p>
        <p style={{ fontSize: ".72rem", color: C.mist, marginTop: 4 }}>All completions share a session ID for audit traceability.</p>
        <button onClick={onClose} style={{
          marginTop: 20, padding: "10px 24px", background: C.sage, color: C.white,
          border: "none", borderRadius: 7, fontFamily: "'DM Sans', sans-serif",
          fontSize: ".88rem", fontWeight: 600, cursor: "pointer",
        }}>Done</button>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", maxHeight: "90vh", overflowY: "auto" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        textarea::placeholder, input::placeholder { color: ${C.mist}; }
        .staff-row:hover { background: ${C.foam} !important; }
        .confirm-btn:hover:not(:disabled) { background: ${C.pine} !important; }
        select option { color: ${C.ink}; }
      `}</style>

      {/* Header */}
      <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid #E2EBE6" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: C.ink }}>Log group session</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.mist, cursor: "pointer", fontSize: "1.1rem" }}>×</button>
        </div>
        <p style={{ fontSize: ".8rem", color: C.mist, marginTop: 3 }}>
          Mark multiple staff as complete in one action. All completions share a session ID.
        </p>
      </div>

      <div style={{ padding: "18px 22px" }}>

        {/* Training selection */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: ".7rem", fontWeight: 600, color: C.sage, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>Training</div>
          <select value={training?.id ?? ""} onChange={e => setTraining(TRAINING_LIBRARY.find(t => t.id === Number(e.target.value)) ?? null)}
            style={{ ...selectStyle, width: "100%" }}>
            <option value="">Select training…</option>
            {TRAINING_LIBRARY.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        </div>

        {/* Session date + trainer */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: ".7rem", fontWeight: 600, color: C.sage, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>Session date</div>
            <input type="date" value={sessionDate} onChange={e => setSessionDate(e.target.value)}
              onFocus={() => setDateFocused(true)} onBlur={() => setDateFocused(false)}
              style={inputStyle(dateFocused)} />
          </div>
          <div>
            <div style={{ fontSize: ".7rem", fontWeight: 600, color: C.sage, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>Trainer</div>
            <input value={trainerName} onChange={e => setTrainerName(e.target.value)}
              onFocus={() => setTrainerFocus(true)} onBlur={() => setTrainerFocus(false)}
              placeholder="Trainer name"
              style={inputStyle(trainerFocus)} />
          </div>
        </div>

        {/* Staff selection */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ fontSize: ".7rem", fontWeight: 600, color: C.sage, textTransform: "uppercase", letterSpacing: ".06em" }}>
              Attendees
            </div>
            {/* Spec: attendee count shown live */}
            <div style={{ fontSize: ".78rem", color: selected.size > 0 ? C.pine : C.mist, fontWeight: 600 }}>
              {selected.size} selected
            </div>
          </div>

          {/* Filters */}
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            {[
              { label: "All sites",  value: filterSite,  set: setFilterSite,  options: SITES  },
              { label: "All depts",  value: filterDept,  set: setFilterDept,  options: DEPTS  },
            ].map((f, i) => (
              <select key={i} value={f.value} onChange={e => f.set(e.target.value)} style={selectStyle}>
                <option value="">{f.label}</option>
                {f.options.map(o => <option key={o}>{o}</option>)}
              </select>
            ))}
            {(filterSite || filterDept) && (
              <button onClick={() => { setFilterSite(""); setFilterDept(""); }}
                style={{ background: "none", border: "none", color: C.mist, fontSize: ".78rem", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                Clear
              </button>
            )}
          </div>

          {/* Staff grouped by training group */}
          <div style={{ border: "1.5px solid #E2EBE6", borderRadius: 9, overflow: "hidden", maxHeight: 320, overflowY: "auto" }}>
            {Object.entries(groupedByGroup).map(([groupName, members], gi) => {
              const allGroupSelected = members.every(s => selected.has(s.id));
              return (
                <div key={groupName}>
                  {/* Group header with "Select all" toggle */}
                  <div style={{
                    padding: "8px 12px", background: C.chalk,
                    borderBottom: "1px solid #E2EBE6",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}>
                    <span style={{ fontSize: ".72rem", fontWeight: 700, color: C.pine, textTransform: "uppercase", letterSpacing: ".05em" }}>
                      {groupName} ({members.length})
                    </span>
                    <button onClick={() => toggleGroup(groupName)} style={{
                      background: "none", border: "none", fontSize: ".72rem",
                      color: allGroupSelected ? C.red : C.sage,
                      cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
                    }}>
                      {allGroupSelected ? "Deselect all" : "Select all"}
                    </button>
                  </div>
                  {members.map((s, si) => (
                    <div key={s.id} className="staff-row" onClick={() => toggleOne(s.id)} style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
                      borderBottom: si < members.length - 1 || gi < Object.keys(groupedByGroup).length - 1 ? "1px solid #F0F4F2" : "none",
                      cursor: "pointer", transition: "background .1s",
                      background: selected.has(s.id) ? C.foam : C.white,
                    }}>
                      <Avatar first={s.first} last={s.last} selected={selected.has(s.id)} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: ".85rem", fontWeight: selected.has(s.id) ? 600 : 400, color: selected.has(s.id) ? C.pine : C.ink }}>
                          {s.first} {s.last}
                        </div>
                        <div style={{ fontSize: ".7rem", color: C.mist }}>{s.site}</div>
                      </div>
                      <div style={{
                        width: 18, height: 18, borderRadius: "50%",
                        border: `2px solid ${selected.has(s.id) ? C.sage : "#D0DEDB"}`,
                        background: selected.has(s.id) ? C.sage : "none",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: ".65rem", color: C.white, transition: "all .15s",
                      }}>
                        {selected.has(s.id) ? "✓" : ""}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* Notes */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: ".7rem", fontWeight: 600, color: C.sage, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>Notes (optional)</div>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            onFocus={() => setNotesFocused(true)} onBlur={() => setNotesFocused(false)}
            placeholder="e.g. Q2 all-hands safety meeting — Moriah site" rows={2}
            style={{ width: "100%", padding: "9px 11px", border: `1.5px solid ${notesFocused ? C.sage : "#D0DEDB"}`, borderRadius: 8, fontFamily: "'DM Sans', sans-serif", fontSize: ".88rem", color: C.ink, outline: "none", resize: "none", lineHeight: 1.5, transition: "all .18s" }}
          />
        </div>

        {/* Confirm */}
        <button
          className="confirm-btn"
          onClick={handleConfirm}
          disabled={!canConfirm}
          style={{
            width: "100%", padding: "12px",
            background: canConfirm ? C.sage : "#B0C8BA",
            color: C.white, border: "none", borderRadius: 8,
            fontFamily: "'DM Sans', sans-serif", fontSize: ".92rem", fontWeight: 700,
            cursor: canConfirm ? "pointer" : "default", transition: "all .18s",
          }}
        >
          {canConfirm
            ? `Log ${selected.size} completion${selected.size !== 1 ? "s" : ""} →`
            : "Select training and at least one attendee"}
        </button>
      </div>
    </div>
  );
}
