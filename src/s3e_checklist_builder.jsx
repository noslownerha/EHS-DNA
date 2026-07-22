import { useState, useRef, useEffect, useCallback } from "react";
import { EHSHeader } from "./AppShell.jsx";
import { BRAND, COLORS } from "./constants.js";
import { api } from "./api.js";
import { parseCSV, downloadCSV, readFileText } from "./csv.js";

const C = { ...COLORS };

// Spec §13.1: Critical / Major / Minor / Noted (default severity includes Noted)
const SEVERITIES = ["Critical", "Major", "Minor", "Noted"];

const ASSIGNEES = ["Site Manager", "Department Lead", "Facility Maintenance", "Safety Officer", "Inspector"];

const SEED_ITEMS = [
  { id: 1,  section: "PPE",         text: "All workers wearing hard hats in active zones",           defaultSeverity: "Major",  autoAssign: "Site Manager"   },
  { id: 2,  section: "PPE",         text: "Safety glasses present at all bottling stations",         defaultSeverity: "Minor",  autoAssign: "Department Lead"},
  { id: 3,  section: "PPE",         text: "Cut-resistant gloves available at de-boxing stations",    defaultSeverity: "Minor",  autoAssign: "Department Lead"},
  { id: 4,  section: "Housekeeping",text: "Floor clear of slip/trip hazards",                        defaultSeverity: "Major",  autoAssign: "Site Manager"   },
  { id: 5,  section: "Housekeeping",text: "Wet floor signs in place where applicable",               defaultSeverity: "Minor",  autoAssign: "Department Lead"},
  { id: 6,  section: "Equipment",   text: "Conveyor guards in place and secured",                    defaultSeverity: "Critical",autoAssign:"Facility Maintenance"    },
  { id: 7,  section: "Equipment",   text: "Emergency stop buttons unobstructed and visible",         defaultSeverity: "Critical",autoAssign:"Facility Maintenance"    },
  { id: 8,  section: "Fire Safety", text: "Fire extinguishers accessible and not blocked",           defaultSeverity: "Major",  autoAssign: "Safety Officer" },
  { id: 9,  section: "Fire Safety", text: "Emergency exit routes clearly marked and unobstructed",   defaultSeverity: "Critical",autoAssign:"Site Manager"   },
  { id: 10, section: "Housekeeping",text: "Waste bins not overflowing",                              defaultSeverity: "Noted",  autoAssign: "Department Lead"},
];

const SEV_COLORS = {
  Critical: C.red, Major: C.orange, Minor: C.gold, Noted: C.slate,
};

function DesktopNav({ companyName = BRAND.company, active = "", onHome }) {
  return (
    <EHSHeader onHome={onHome} onBack={onBack} title={companyName} rightContent={
      active ? (
        <div style={{ fontSize: ".72rem", color: C.mist, background: "rgba(255,255,255,.08)", padding: "3px 12px", borderRadius: 20, whiteSpace: "nowrap" }}>{active}</div>
      ) : null
    } />
  );
}

// ── Checklist item row in editor ──────────────────────────────────────────────
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
            style={{ background: "none", border: "none", cursor: index === 0 ? "default" : "pointer", color: index === 0 ? "#D0DEDB" : C.mist, fontSize: ".6rem", padding: "1px 3px", lineHeight: 1 }}>▲</button>
          <button onClick={() => onMove(index, 1)} disabled={index === totalItems - 1}
            style={{ background: "none", border: "none", cursor: index === totalItems - 1 ? "default" : "pointer", color: index === totalItems - 1 ? "#D0DEDB" : C.mist, fontSize: ".6rem", padding: "1px 3px", lineHeight: 1 }}>▼</button>
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
          {expanded ? "▲" : "▼"}
        </button>
        <button onClick={() => onRemove(item.id)} style={{ background: "none", border: "none", color: C.mist, cursor: "pointer", fontSize: "1rem", padding: "2px 4px" }}
          onMouseEnter={e => e.target.style.color = C.red} onMouseLeave={e => e.target.style.color = C.mist}>×</button>
      </div>

      {/* Expanded config — auto-assign on fail, default severity */}
      {expanded && (
        <div style={{ padding: "0 12px 12px 54px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, borderTop: "1px solid #F0F4F2", paddingTop: 10 }}>
          <div>
            <div style={{ fontSize: ".68rem", fontWeight: 600, color: C.mist, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>Default severity on fail</div>
            <select value={item.defaultSeverity} onChange={e => onUpdate({ ...item, defaultSeverity: e.target.value })} style={{ width: "100%", padding: "7px 10px", border: "1.5px solid #D0DEDB", borderRadius: 6, fontFamily: "'DM Sans', sans-serif", fontSize: ".83rem", color: C.ink, background: C.white, outline: "none", cursor: "pointer", appearance: "none" }}>
              {/* Spec §s3e: default severity includes Noted */}
              {SEVERITIES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            {/* Spec §s3e: auto-assign on fail configured per item */}
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

// ── Section header ────────────────────────────────────────────────────────────
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

// ── Main component ────────────────────────────────────────────────────────────
const FREQ_OPTIONS = [
  { label: "On demand", value: "" },
  { label: "Weekly",    value: 7 },
  { label: "Monthly",   value: 30 },
  { label: "Every 2 months", value: 60 },
  { label: "Quarterly", value: 90 },
  { label: "Every 6 months", value: 180 },
  { label: "Yearly",    value: 365 },
];

export default function S3eChecklistBuilder({ onHome, companyName, onBack }) {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [items,    setItems]    = useState([]);
  const [sections, setSections] = useState([]);
  const [saved,    setSaved]    = useState(false);
  const [error,    setError]    = useState(null);

  function rowFromDb(c) {
    const its = JSON.parse(c.items || "[]");
    const siteName = (BRAND.siteRecords ?? []).find(s => s.id === c.site_id)?.name ?? "All sites";
    const schedule = c.frequency_days ? (FREQ_OPTIONS.find(f => f.value === c.frequency_days)?.label ?? `Every ${c.frequency_days}d`) : "On demand";
    return { id: c.id, name: c.name, site: siteName, siteId: c.site_id, kind: c.kind,
             frequencyDays: c.frequency_days, items: its.length, schedule, dept: c.kind === "gemba" ? "Gemba" : "Checklist", lastUsed: "", raw: its };
  }

  const loadTemplates = useCallback((selectId) => {
    api.listChecklists().then(cls => {
      const rows = cls.filter(c => c.active).map(rowFromDb);
      setTemplates(rows);
      const sel = rows.find(r => r.id === selectId) ?? rows[0] ?? null;
      selectTemplate(sel);
    }).catch(err => setError(err.message));
  }, []);
  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  function selectTemplate(t) {
    setSelectedTemplate(t);
    if (!t) { setItems([]); setSections([]); return; }
    const editorItems = t.raw.map((it, i) => ({
      id: i + 1, section: it.category ?? "Checklist", text: it.label ?? String(it),
      defaultSeverity: it.defaultSeverity ?? "Minor", autoAssign: it.autoAssign ?? "Site Manager",
    }));
    setItems(editorItems);
    setSections([...new Set(editorItems.map(i => i.section))].length ? [...new Set(editorItems.map(i => i.section))] : ["Checklist"]);
    nextId.current = editorItems.length + 1;
  }

  async function createNew(kind = "checklist") {
    try {
      const { id } = await api.createChecklist({ name: kind === "gemba" ? "New Gemba Walk" : "New Checklist", items: [], kind });
      loadTemplates(id);
    } catch (err) { setError(err.message); }
  }

  async function deactivate() {
    if (!selectedTemplate) return;
    try { await api.updateChecklist(selectedTemplate.id, { active: 0 }); loadTemplates(); }
    catch (err) { setError(err.message); }
  }
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

  const [importMsg, setImportMsg] = useState("");
  function downloadChecklistTemplate() {
    downloadCSV("checklist-items-template.csv",
      ["section", "text", "severity", "assign"],
      [["PPE", "All workers wearing hard hats in active zones", "Major", "Site Manager"],
       ["Housekeeping", "Floor clear of slip/trip hazards", "Minor", "Department Lead"]]);
  }
  async function importChecklistCSV(file) {
    setImportMsg("");
    if (!selectedTemplate) { setImportMsg("Select or create a template first."); return; }
    try {
      const text = await readFileText(file);
      const { headers, rows } = parseCSV(text);
      if (!headers.map(h => h.toLowerCase()).includes("text")) { setImportMsg('CSV must include a "text" column.'); return; }
      const VALID_SEV = ["Critical", "Major", "Minor", "Noted"];
      const added = [], newSections = new Set(sections);
      rows.forEach(r => {
        const o = {}; Object.keys(r).forEach(k => { o[k.toLowerCase()] = r[k]; });
        const t = String(o.text ?? "").trim();
        if (!t) return;
        const section = String(o.section ?? "").trim() || "General";
        let sev = String(o.severity ?? "").trim();
        sev = VALID_SEV.find(v => v.toLowerCase() === sev.toLowerCase()) || "Minor";
        const assign = String(o.assign ?? "").trim() || "Site Manager";
        added.push({ id: nextId.current++, section, text: t, defaultSeverity: sev, autoAssign: assign });
        newSections.add(section);
      });
      if (!added.length) { setImportMsg("No valid rows found."); return; }
      setSections([...newSections]);
      setItems(its => [...its, ...added]);   // APPEND — never replaces existing items
      setImportMsg(`Added ${added.length} item${added.length === 1 ? "" : "s"}. Review, then Save template.`);
    } catch (e) { setImportMsg(e.message || "Import failed"); }
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

  async function handleSave() {
    if (!selectedTemplate) return;
    try {
      await api.updateChecklist(selectedTemplate.id, {
        name: selectedTemplate.name,
        siteId: selectedTemplate.siteId ?? null,
        kind: selectedTemplate.kind,
        frequencyDays: selectedTemplate.frequencyDays ?? null,
        items: items.map(i => ({ id: `i${i.id}`, label: i.text, category: i.section,
                                 defaultSeverity: i.defaultSeverity, autoAssign: i.autoAssign })),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      loadTemplates(selectedTemplate.id);
    } catch (err) { setError(err.message); }
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

      <DesktopNav companyName={companyName} active="Checklists" onHome={onHome} />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px" }}>

        <div className="anim" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: C.ink }}>Checklist Builder</h1>
            <p style={{ fontSize: ".85rem", color: C.mist, marginTop: 3 }}>Create and manage inspection templates.</p>
          </div>
        </div>

        {/* Spec §s3e: template list + editor side by side */}
        <div className="split-pane" style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20, alignItems: "start" }}>

          {/* Left: template list */}
          <div className="anim">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <h2 style={{ fontSize: ".95rem", fontWeight: 600, color: C.ink }}>Templates</h2>
              <button style={{ padding: "5px 12px", background: C.white, color: C.pine, border: `1.5px solid ${C.mint}`, borderRadius: 6, fontFamily: "'DM Sans', sans-serif", fontSize: ".75rem", fontWeight: 600, cursor: "pointer" }}>+ New</button>
            </div>

            <div style={{ background: C.white, borderRadius: 10, boxShadow: "0 2px 12px rgba(15,31,23,.07)", overflow: "hidden" }}>
              <div style={{ display: "flex", gap: 8, padding: "10px 12px", borderBottom: "1px solid #F0F4F2" }}>
                <button onClick={() => createNew("checklist")} style={{ flex: 1, padding: "7px 0", background: C.foam, color: C.pine, border: `1px solid ${C.mint}`, borderRadius: 7, fontSize: ".76rem", fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>+ Checklist</button>
                <button onClick={() => createNew("gemba")} style={{ flex: 1, padding: "7px 0", background: C.foam, color: C.pine, border: `1px solid ${C.mint}`, borderRadius: 7, fontSize: ".76rem", fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>+ Gemba</button>
              </div>
              {templates.map((t, i) => (
                <div key={t.id} className="template-row" onClick={() => selectTemplate(t)} style={{
                  padding: "12px 14px",
                  borderBottom: i < templates.length - 1 ? "1px solid #F0F4F2" : "none",
                  cursor: "pointer", transition: "background .12s",
                  background: selectedTemplate?.id === t.id ? C.foam : C.white,
                  borderLeft: selectedTemplate?.id === t.id ? `3px solid ${C.sage}` : "3px solid transparent",
                }}>
                  <div style={{ fontWeight: 600, fontSize: ".88rem", color: selectedTemplate?.id === t.id ? C.pine : C.ink, marginBottom: 3 }}>{t.name}</div>
                  <div style={{ fontSize: ".72rem", color: C.mist }}>{t.items} items · {t.schedule}</div>
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
                    <input value={selectedTemplate.name}
                      onChange={e => setSelectedTemplate(t => ({ ...t, name: e.target.value }))}
                      style={{ fontSize: "1.05rem", fontWeight: 700, color: C.ink, marginBottom: 6, border: "1.5px solid transparent", borderRadius: 6, padding: "2px 6px", background: "transparent", fontFamily: "'DM Sans', sans-serif", width: "100%", maxWidth: 380, outline: "none" }}
                      onFocus={e => e.target.style.borderColor = "#D0DEDB"}
                      onBlur={e => e.target.style.borderColor = "transparent"} />
                    <div style={{ fontSize: ".78rem", color: C.mist }}>
                      {selectedTemplate.kind === 'gemba' ? 'Gemba walk template' : 'Inspection checklist'}
                    </div>
                    <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
                      <select value={selectedTemplate.siteId ?? ""} onChange={e => setSelectedTemplate(t => ({ ...t, siteId: e.target.value ? Number(e.target.value) : null }))}
                        style={{ padding: "7px 10px", border: "1.5px solid #D0DEDB", borderRadius: 7, fontSize: ".8rem", color: C.ink, fontFamily: "'DM Sans', sans-serif", background: C.white }}>
                        <option value="">All sites</option>
                        {(BRAND.siteRecords ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      <select value={selectedTemplate.frequencyDays ?? ""} onChange={e => setSelectedTemplate(t => ({ ...t, frequencyDays: e.target.value ? Number(e.target.value) : null }))}
                        style={{ padding: "7px 10px", border: "1.5px solid #D0DEDB", borderRadius: 7, fontSize: ".8rem", color: C.ink, fontFamily: "'DM Sans', sans-serif", background: C.white }}>
                        {FREQ_OPTIONS.map(f => <option key={f.label} value={f.value}>{f.label}</option>)}
                      </select>
                      <button onClick={deactivate} style={{ padding: "7px 12px", background: "none", border: "1px solid #E4B4B4", color: C.red ?? "#C0392B", borderRadius: 7, fontSize: ".76rem", fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Deactivate</button>
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
                      placeholder="New section name…"
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
      <div style={{ position: "fixed", bottom: 58, left: 0, right: 0, background: C.white, borderTop: "1px solid #E2EBE6", padding: "14px 28px", display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 50, boxShadow: "0 -4px 20px rgba(0,0,0,.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <span style={{ fontSize: ".8rem", color: C.mist }}>
            {items.length} items · {sections.length} sections
          </span>
          {selectedTemplate && (
            <>
              <button onClick={downloadChecklistTemplate} style={{ background: "none", border: "none", color: C.sage, fontSize: ".76rem", fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Get template</button>
              <label style={{ color: C.sage, fontSize: ".76rem", fontWeight: 600, cursor: "pointer" }}>
                Import items
                <input type="file" accept=".csv" style={{ display: "none" }}
                  onChange={e => e.target.files[0] && importChecklistCSV(e.target.files[0])} />
              </label>
              {importMsg && <span style={{ fontSize: ".72rem", color: C.pine }}>{importMsg}</span>}
            </>
          )}
        </div>
        <button className="save-btn" onClick={handleSave} disabled={saved} style={{
          padding: "10px 24px", background: saved ? C.sage + "99" : C.sage, color: C.white,
          border: "none", borderRadius: 7, fontFamily: "'DM Sans', sans-serif",
          fontSize: ".88rem", fontWeight: 600, cursor: saved ? "default" : "pointer", transition: "all .18s",
        }}>
          {saved ? "✓ Saved" : "Save template"}
        </button>
      </div>
    </div>
  );
}
