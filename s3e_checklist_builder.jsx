import { useState, useRef } from "react";
import { EHSHeader } from "./AppShell.jsx";
import { BRAND, SITES } from "./constants.js";

const C = {
  forest: "#1C3A2A", pine: "#2D5A3D", sage: "#4A8C5C",
  mint: "#A8D5B5", foam: "#E8F5EC", ink: "#0F1F17",
  slate: "#4A5568", mist: "#8FA3A0", chalk: "#F4F7F5",
  white: "#FFFFFF", gold: "#C8922A", goldLt: "#FDF3E3",
  red: "#C0392B", redLt: "#FDECEA",
  orange: "#D4622A", orangeLt: "#FEF0E7",
};

// Spec Â§13.1: Critical / Major / Minor / Noted (default severity includes Noted)
const SEVERITIES = ["Critical", "Major", "Minor", "Noted"];

const ASSIGNEES = ["Site Manager", "Department Lead", "Maintenance", "Safety Officer", "Inspector"];

const SEED_TEMPLATES = [
  { id: 1, name: "Bottling Line Safety Check",  site: "Moriah",      dept: "Bottling & Packaging",    items: 11, lastUsed: "Jun 12, 2024", schedule: "Daily"    },
  { id: 2, name: "Forklift Pre-Op Inspection",  site: "Moriah",      dept: "Warehouse",               items: 8,  lastUsed: "Jun 14, 2024", schedule: "Daily"    },
  { id: 3, name: "Chemical Storage Walkthrough",site: "Middlebury",  dept: "Production / Distilling", items: 14, lastUsed: "Jun 10, 2024", schedule: "Weekly"   },
  { id: 4, name: "Emergency Equipment Check",   site: "All sites",   dept: "All departments",         items: 6,  lastUsed: "Jun 07, 2024", schedule: "Monthly"  },
  { id: 5, name: "Barrel House Inspection",     site: "Shoreham",    dept: "Maintenance",             items: 9,  lastUsed: "May 28, 2024", schedule: "Monthly"  },
];

const SEED_ITEMS = [
  { id: 1,  section: "PPE",         text: "All workers wearing hard hats in active zones",           defaultSeverity: "Major",  autoAssign: "Site Manager"   },
  { id: 2,  section: "PPE",         text: "Safety glasses present at all bottling stations",         defaultSeverity: "Minor",  autoAssign: "Department Lead"},
  { id: 3,  section: "PPE",         text: "Cut-resistant gloves available at de-boxing stations",    defaultSeverity: "Minor",  autoAssign: "Department Lead"},
  { id: 4,  section: "Housekeeping",text: "Floor clear of slip/trip hazards",                        defaultSeverity: "Major",  autoAssign: "Site Manager"   },
  { id: 5,  section: "Housekeeping",text: "Wet floor signs in place where applicable",               defaultSeverity: "Minor",  autoAssign: "Department Lead"},
  { id: 6,  section: "Equipment",   text: "Conveyor guards in place and secured",                    defaultSeverity: "Critical",autoAssign:"Maintenance"    },
  { id: 7,  section: "Equipment",   text: "Emergency stop buttons unobstructed and visible",         defaultSeverity: "Critical",autoAssign:"Maintenance"    },
  { id: 8,  section: "Fire Safety", text: "Fire extinguishers accessible and not blocked",           defaultSeverity: "Major",  autoAssign: "Safety Officer" },
  { id: 9,  section: "Fire Safety", text: "Emergency exit routes clearly marked and unobstructed",   defaultSeverity: "Critical",autoAssign:"Site Manager"   },
  { id: 10, section: "Housekeeping",text: "Waste bins not overflowing",                              defaultSeverity: "Noted",  autoAssign: "Department Lead"},
];

const SEV_COLORS = {
  Critical: C.red, Major: C.orange, Minor: C.gold, Noted: C.slate,
};

function DesktopNav({ companyName = "WhistlePig Whiskey" }) {
  return (
    <EHSHeader onHome={onHome} />
  );
}

// ââ Checklist item row in editor ââââââââââââââââââââââââââââââââââââââââââââââ
function ItemRow({ item, index, totalItems, onUpdate, onRemove, onMove, isDragging }) {
  const [expanded, setExpanded] = useState(false);
  const [textFocused, setTextF] = useState(false);

  return (
    <div style={{
      background: isDragging ? C.foam : C.white,
      border: `1.5px solid ${isDragging ? C.sage : "#E2EBE6"}`,
      borderRadius: 8, marginBottom: 6,
      transition: "all .15s",
      opacity: isDragging ? .7 : 1,
    }}>
      {/* Item header row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px" }}>
        {/* Drag handle + reorder */}
        <div style={{ display: "flex", flexDirection: "column", gap: 1, flexShrink: 0 }}>
          <button onClick={() => onMove(index, -1)} disabled={index === 0}
            style={{ background: "none", border: "none", cursor: index === 0 ? "default" : "pointer", color: index === 0 ? "#D0DEDB" : C.mist, fontSize: ".6rem", padding: "1px 3px", lineHeight: 1 }}>â²</button>
          <button onClick={() => onMove(index, 1)} disabled={index === totalItems - 1}
            style={{ background: "none", border: "none", cursor: index === totalItems - 1 ? "default" : "pointer", color: index === totalItems - 1 ? "#D0DEDB" : C.mist, fontSize: ".6rem", padding: "1px 3px", lineHeight: 1 }}>â¼</button>
        </div>

        {/* Item number */}
        <div style={{ width: 22, height: 22, borderRadius: "50%", background: C.chalk, display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".7rem", fontWeight: 600, color: C.mist, flexShrink: 0 }}>
          {index + 1}
        </div>

        {/* Text */}
        <input
          value={item.text}
          onChange={e => onUpdate({ ...item, text: e.target.value })}
          onFocus={() => setTextF(true)}
          onBlur={() => setTextF(false)}
          style={{
            flex: 1, padding: "6px 8px",
            border: `1.5px solid ${textFocused ? C.sage : "transparent"}`,
            borderRadius: 6, fontFamily: "'DM Sans', sans-serif",
            fontSize: ".88rem", color: C.ink, background: textFocused ? C.white : "none",
            outline: "none", transition: "all .15s",
          }}
        />

        {/* Severity pill */}
        <span style={{
          padding: "2px 9px", borderRadius: 20,
          fontSize: ".68rem", fontWeight: 600,
          background: SEV_COLORS[item.defaultSeverity] + "18",
          color: SEV_COLORS[item.defaultSeverity],
          flexShrink: 0, cursor: "pointer",
        }} onClick={() => setExpanded(e => !e)}>
          {item.defaultSeverity}
        </span>

        {/* Expand / remove */}
        <button onClick={() => setExpanded(e => !e)} style={{ background: "none", border: "none", color: C.mist, cursor: "pointer", fontSize: ".8rem", padding: "2px 4px" }}>
          {expanded ? "â²" : "â¼"}
        </button>
        <button onClick={() => onRemove(item.id)} style={{ background: "none", border: "none", color: C.mist, cursor: "pointer", fontSize: "1rem", padding: "2px 4px" }}
          onMouseEnter={e => e.target.style.color = C.red} onMouseLeave={e => e.target.style.color = C.mist}>Ã</button>
      </div>

      {/* Expanded config â auto-assign on fail, default severity */}
      {expanded && (
        <div style={{ padding: "0 12px 12px 54px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, borderTop: "1px solid #F0F4F2", paddingTop: 10 }}>
          <div>
            <div style={{ fontSize: ".68rem", fontWeight: 600, color: C.mist, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>Default severity on fail</div>
            <select value={item.defaultSeverity} onChange={e => onUpdate({ ...item, defaultSeverity: e.target.value })} style={{ width: "100%", padding: "7px 10px", border: "1.5px solid #D0DEDB", borderRadius: 6, fontFamily: "'DM Sans', sans-serif", fontSize: ".83rem", color: C.ink, background: C.white, outline: "none", cursor: "pointer", appearance: "none" }}>
              {/* Spec Â§s3e: default severity includes Noted */}
              {SEVERITIES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            {/* Spec Â§s3e: auto-assign on fail configured per item */}
            <div style={{ fontSize: ".68rem", fontWeight: 600, color: C.mist, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>Auto-assign on fail</div>
            <select value={item.autoAssign} onChange={e => onUpdate({ ...item, autoAssign: e.target.value })} style={{ width: "100%", padding: "7px 10px", border: "1.5px solid #D0DEDB", borderRadius: 6, fontFamily: "'DM Sans', sans-serif", fontSize: ".83rem", color: C.ink, background: C.white, outline: "none", cursor: "pointer", appearance: "none" }}>
              {ASSIGNEES.map(a => <option key={a}>{a}</option>)}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

// ââ Section header ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
function SectionHeader({ name, count, onRename, onAdd }) {
  const [editing, setEditing] = useState(false);
  const [val,     setVal]     = useState(name);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, marginTop: 14 }}>
      {editing ? (
        <>
          <input value={val} onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { onRename(val); setEditing(false); } if (e.key === "Escape") setEditing(false); }}
            style={{ padding: "4px 8px", border: "1.5px solid #D0DEDB", borderRadius: 6, fontFamily: "'DM Sans', sans-serif", fontSize: ".82rem", outline: "none", flex: 1 }}
            autoFocus />
          <button onClick={() => { onRename(val); setEditing(false); }} style={{ background: "none", border: "none", color: C.sage, cursor: "pointer", fontSize: ".78rem", fontFamily: "'DM Sans', sans-serif" }}>Save</button>
        </>
      ) : (
        <>
          <div style={{ fontSize: ".72rem", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: C.pine }}>
            {name} <span style={{ color: C.mist, fontWeight: 400 }}>({count})</span>
          </div>
          <button onClick={() => setEditing(true)} style={{ background: "none", border: "none", color: C.mist, cursor: "pointer", fontSize: ".7rem", fontFamily: "'DM Sans', sans-serif" }}>rename</button>
          <button onClick={onAdd} style={{ background: "none", border: "none", color: C.sage, cursor: "pointer", fontSize: ".7rem", fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>+ add item</button>
        </>
      )}
    </div>
  );
}

// ââ Main component ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
export default function S3eChecklistBuilder({ companyName, onBack 
  onHome,
}) {
  const [selectedTemplate, setSelectedTemplate] = useState(SEED_TEMPLATES[0]);
  const [items,    setItems]    = useState(SEED_ITEMS);
  const [sections, setSections] = useState([...new Set(SEED_ITEMS.map(i => i.section))]);
  const [saved,    setSaved]    = useState(false);
  const [newSectionName, setNewSectionName] = useState("");
  const [addingSection,  setAddingSection]  = useState(false);
  const [secFocused,     setSecFocused]     = useState(false);
  const nextId = useRef(SEED_ITEMS.length + 1);

  function updateItem(updated) { setItems(its => its.map(i => i.id === updated.id ? updated : i)); }
  function removeItem(id)      { setItems(its => its.filter(i => i.id !== id)); }

  function addItem(section) {
    const newItem = { id: nextId.current++, section, text: "New checklist item", defaultSeverity: "Minor", autoAssign: "Site Manager" };
    setItems(its => [...its, newItem]);
  }

  function moveItem(section, index, dir) {
    const sectionItems = items.filter(i => i.section === section);
    const target = index + dir;
    if (target < 0 || target >= sectionItems.length) return;
    const ids = sectionItems.map(i => i.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    const reordered = ids.map(id => sectionItems.find(i => i.id === id));
    setItems(all => [
      ...all.filter(i => i.section !== section),
      ...reordered,
    ]);
  }

  function renameSection(oldName, newName) {
    setSections(ss => ss.map(s => s === oldName ? newName : s));
    setItems(its => its.map(i => i.section === oldName ? { ...i, section: newName } : i));
  }

  function addSection() {
    if (!newSectionName.trim()) return;
    setSections(ss => [...ss, newSectionName.trim()]);
    setNewSectionName("");
    setAddingSection(false);
  }

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div style={{ minHeight: "100vh", background: C.chalk, fontFamily: "'DM Sans', sans-serif", paddingBottom: 80 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input::placeholder { color: ${C.mist}; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .anim { animation: fadeUp .25s ease both; }
        .template-row:hover { background: ${C.foam} !important; }
        .save-btn:hover:not(:disabled) { background: ${C.pine} !important; transform: translateY(-1px); }
        select option { color: ${C.ink}; }
      `}</style>

      <DesktopNav companyName={companyName} />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px" }}>

        <div className="anim" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: C.ink }}>Checklist Builder</h1>
            <p style={{ fontSize: ".85rem", color: C.mist, marginTop: 3 }}>Create and manage inspection templates.</p>
          </div>
        </div>

        {/* Spec Â§s3e: template list + editor side by side */}
        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20, alignItems: "start" }}>

          {/* Left: template list */}
          <div className="anim">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <h2 style={{ fontSize: ".95rem", fontWeight: 600, color: C.ink }}>Templates</h2>
              <button style={{ padding: "5px 12px", background: C.white, color: C.pine, border: `1.5px solid ${C.mint}`, borderRadius: 6, fontFamily: "'DM Sans', sans-serif", fontSize: ".75rem", fontWeight: 600, cursor: "pointer" }}>+ New</button>
            </div>

            <div style={{ background: C.white, borderRadius: 10, boxShadow: "0 2px 12px rgba(15,31,23,.07)", overflow: "hidden" }}>
              {SEED_TEMPLATES.map((t, i) => (
                <div key={t.id} className="template-row" onClick={() => setSelectedTemplate(t)} style={{
                  padding: "12px 14px",
                  borderBottom: i < SEED_TEMPLATES.length - 1 ? "1px solid #F0F4F2" : "none",
                  cursor: "pointer", transition: "background .12s",
                  background: selectedTemplate?.id === t.id ? C.foam : C.white,
                  borderLeft: selectedTemplate?.id === t.id ? `3px solid ${C.sage}` : "3px solid transparent",
                }}>
                  <div style={{ fontWeight: 600, fontSize: ".88rem", color: selectedTemplate?.id === t.id ? C.pine : C.ink, marginBottom: 3 }}>{t.name}</div>
                  <div style={{ fontSize: ".72rem", color: C.mist }}>{t.items} items Â· {t.schedule}</div>
                  <div style={{ fontSize: ".7rem", color: C.mist, marginTop: 1 }}>{t.site}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: editor */}
          {selectedTemplate ? (
            <div className="anim">
              {/* Template header */}
              <div style={{ background: C.white, borderRadius: 10, boxShadow: "0 2px 12px rgba(15,31,23,.07)", padding: "18px 20px", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: C.ink, marginBottom: 4 }}>{selectedTemplate.name}</h2>
                    <div style={{ fontSize: ".78rem", color: C.mist }}>
                      {selectedTemplate.site} Â· {selectedTemplate.dept} Â· {selectedTemplate.schedule} Â· Last used {selectedTemplate.lastUsed}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <span style={{ padding: "3px 10px", borderRadius: 20, background: C.foam, color: C.pine, fontSize: ".72rem", fontWeight: 600 }}>
                      {items.length} items
                    </span>
                  </div>
                </div>
              </div>

              {/* Items editor */}
              <div style={{ background: C.white, borderRadius: 10, boxShadow: "0 2px 12px rgba(15,31,23,.07)", padding: "18px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <h2 style={{ fontSize: ".95rem", fontWeight: 600, color: C.ink }}>Checklist items</h2>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setAddingSection(v => !v)} style={{ padding: "6px 12px", background: C.white, color: C.pine, border: `1.5px solid ${C.mint}`, borderRadius: 6, fontFamily: "'DM Sans', sans-serif", fontSize: ".78rem", fontWeight: 600, cursor: "pointer" }}>+ Section</button>
                  </div>
                </div>

                {/* Render by section */}
                {sections.map(section => {
                  const sectionItems = items.filter(i => i.section === section);
                  return (
                    <div key={section}>
                      <SectionHeader
                        name={section}
                        count={sectionItems.length}
                        onRename={newName => renameSection(section, newName)}
                        onAdd={() => addItem(section)}
                      />
                      {sectionItems.map((item, idx) => (
                        <ItemRow
                          key={item.id}
                          item={item}
                          index={idx}
                          totalItems={sectionItems.length}
                          onUpdate={updateItem}
                          onRemove={removeItem}
                          onMove={(i, dir) => moveItem(section, i, dir)}
                          isDragging={false}
                        />
                      ))}
                    </div>
                  );
                })}

                {/* Add section input */}
                {addingSection && (
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <input
                      value={newSectionName}
                      onChange={e => setNewSectionName(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") addSection(); if (e.key === "Escape") setAddingSection(false); }}
                      onFocus={() => setSecFocused(true)}
                      onBlur={() => setSecFocused(false)}
                      placeholder="New section nameâ¦"
                      autoFocus
                      style={{ flex: 1, padding: "8px 10px", border: `1.5px solid ${secFocused ? C.sage : "#D0DEDB"}`, borderRadius: 7, fontFamily: "'DM Sans', sans-serif", fontSize: ".88rem", color: C.ink, outline: "none", transition: "all .18s" }}
                    />
                    <button onClick={addSection} style={{ padding: "8px 14px", background: C.sage, color: C.white, border: "none", borderRadius: 7, fontFamily: "'DM Sans', sans-serif", fontSize: ".82rem", fontWeight: 600, cursor: "pointer" }}>Add</button>
                    <button onClick={() => setAddingSection(false)} style={{ padding: "8px 12px", background: "none", color: C.slate, border: "1px solid #D0DEDB", borderRadius: 7, fontFamily: "'DM Sans', sans-serif", fontSize: ".82rem", cursor: "pointer" }}>Cancel</button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", background: C.white, borderRadius: 10, height: 200, color: C.mist, fontSize: ".88rem" }}>
              Select a template to edit
            </div>
          )}
        </div>
      </div>

      {/* Fixed save bar */}
      <div style={{ position: "fixed", bottom: 68, left: 0, right: 0, background: C.white, borderTop: "1px solid #E2EBE6", padding: "14px 28px", display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 50, boxShadow: "0 -4px 20px rgba(0,0,0,.06)" }}>
        <span style={{ fontSize: ".8rem", color: C.mist }}>
          {items.length} items Â· {sections.length} sections
        </span>
        <button className="save-btn" onClick={handleSave} disabled={saved} style={{
          padding: "10px 24px", background: saved ? C.sage + "99" : C.sage, color: C.white,
          border: "none", borderRadius: 7, fontFamily: "'DM Sans', sans-serif",
          fontSize: ".88rem", fontWeight: 600, cursor: saved ? "default" : "pointer", transition: "all .18s",
        }}>
          {saved ? "â Saved" : "Save template"}
        </button>
      </div>
    </div>
  );
}
