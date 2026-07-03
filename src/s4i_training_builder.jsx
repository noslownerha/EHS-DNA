import { useState, useEffect } from "react";
import { EHSHeader } from "./AppShell.jsx";
import { BRAND } from "./constants.js";
import { api } from "./api.js";

const C = {
  forest: "#1C3A2A", pine: "#2D5A3D", sage: "#4A8C5C", mint: "#A8D5B5",
  foam: "#E8F5EC", ink: "#0F1F17", slate: "#4A5568", mist: "#8FA3A0",
  chalk: "#F4F7F5", white: "#FFFFFF", red: "#C0392B", redLt: "#FDECEA",
};
const input = {
  width: "100%", padding: "9px 11px", border: "1.5px solid #D0DEDB", borderRadius: 7,
  fontFamily: "'DM Sans', sans-serif", fontSize: ".88rem", color: C.ink, outline: "none",
  background: C.white, boxSizing: "border-box",
};
const label = { fontSize: ".68rem", fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: C.sage, marginBottom: 5, display: "block" };
const btn = (bg = C.sage, fg = "#fff") => ({ padding: "8px 16px", background: bg, color: fg, border: "none", borderRadius: 7, fontFamily: "'DM Sans', sans-serif", fontSize: ".82rem", fontWeight: 700, cursor: "pointer" });

const FREQ = [
  { label: "One-time (no recurrence)", value: "" },
  { label: "Every 6 months", value: 6 },
  { label: "Annual", value: 12 },
  { label: "Every 2 years", value: 24 },
  { label: "Every 3 years", value: 36 },
];

function Chip({ text, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: "6px 14px", borderRadius: 20, fontSize: ".8rem", fontWeight: 600,
      border: `1.5px solid ${active ? C.sage : "#D0DEDB"}`,
      background: active ? C.foam : C.white, color: active ? C.pine : C.slate,
      cursor: "pointer", fontFamily: "'DM Sans', sans-serif", marginRight: 8, marginBottom: 8,
    }}>{active ? "✓ " : ""}{text}</button>
  );
}

export default function S4iTrainingBuilder({ onHome, companyName, onBack }) {
  const [trainings, setTrainings] = useState([]);
  const [users, setUsers] = useState([]);
  const [sel, setSel] = useState(null);   // working copy of selected training
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  function load(selectId) {
    Promise.all([api.listTrainings(), api.listUsers().catch(() => [])])
      .then(([trs, us]) => {
        const active = trs.filter(t => t.active);
        setTrainings(active);
        setUsers(us);
        const pick = active.find(t => t.id === selectId) ?? active[0] ?? null;
        setSel(pick ? hydrate(pick) : null);
      }).catch(err => setError(err.message));
  }
  useEffect(() => load(), []);

  function hydrate(t) {
    return {
      ...t,
      requiredDepartments: JSON.parse(t.required_departments || "[]"),
      requiredUsers: JSON.parse(t.required_users || "[]"),
    };
  }

  async function createNew() {
    try {
      const { id } = await api.createTraining({ title: "New Training", kind: "cbt" });
      load(id);
    } catch (err) { setError(err.message); }
  }

  async function save() {
    if (!sel) return;
    try {
      await api.updateTraining(sel.id, {
        title: sel.title, kind: sel.kind,
        frequencyMonths: sel.frequency_months ? Number(sel.frequency_months) : null,
        requiredDepartments: sel.requiredDepartments,
        requiredUsers: sel.requiredUsers,
      });
      setSaved(true); setTimeout(() => setSaved(false), 1500);
      load(sel.id);
    } catch (err) { setError(err.message); }
  }

  async function deactivate() {
    if (!sel) return;
    try { await api.updateTraining(sel.id, { active: 0 }); load(); }
    catch (err) { setError(err.message); }
  }

  const toggle = (arr, v) => arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v];
  const depts = BRAND.departmentRecords ?? [];
  const targeted = sel && (sel.requiredDepartments.length || sel.requiredUsers.length);

  return (
    <div style={{ minHeight: "100vh", background: C.chalk, fontFamily: "'DM Sans', sans-serif", paddingBottom: 80 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .tpl-row:hover { background: ${C.foam}; }
      `}</style>

      <EHSHeader onHome={onHome} title={companyName} rightContent={
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.mint, fontSize: ".83rem", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>← Back</button>
      } />

      <div style={{ maxWidth: 980, margin: "0 auto", padding: "24px 18px" }}>
        <h1 style={{ fontSize: "1.35rem", fontWeight: 700, color: C.ink, marginBottom: 16 }}>Training Builder</h1>
        {error && <div style={{ marginBottom: 12, padding: "10px 14px", background: C.redLt, color: C.red, borderRadius: 8, fontSize: ".84rem" }}>{error}</div>}

        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 18, alignItems: "start" }}>
          {/* Left: course list */}
          <div style={{ background: C.white, borderRadius: 10, boxShadow: "0 2px 12px rgba(15,31,23,.07)", overflow: "hidden" }}>
            <div style={{ padding: "10px 12px", borderBottom: "1px solid #F0F4F2" }}>
              <button onClick={createNew} style={{ ...btn(C.foam, C.pine), width: "100%" }}>+ New training</button>
            </div>
            {trainings.map((t, i) => (
              <div key={t.id} className="tpl-row" onClick={() => setSel(hydrate(t))} style={{
                padding: "11px 14px", cursor: "pointer",
                borderBottom: i < trainings.length - 1 ? "1px solid #F0F4F2" : "none",
                background: sel?.id === t.id ? C.foam : C.white,
                borderLeft: sel?.id === t.id ? `3px solid ${C.sage}` : "3px solid transparent",
              }}>
                <div style={{ fontSize: ".85rem", fontWeight: 600, color: sel?.id === t.id ? C.pine : C.ink }}>{t.title}</div>
                <div style={{ fontSize: ".7rem", color: C.mist, marginTop: 2 }}>
                  {t.kind === "cbt" ? "CBT" : "In-person"}{t.frequency_months ? ` · every ${t.frequency_months} mo` : " · one-time"}
                </div>
              </div>
            ))}
          </div>

          {/* Right: editor */}
          {sel ? (
            <div style={{ background: C.white, borderRadius: 10, boxShadow: "0 2px 12px rgba(15,31,23,.07)", padding: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 160px 200px", gap: 12, marginBottom: 18 }}>
                <div><span style={label}>Title</span>
                  <input style={input} value={sel.title} onChange={e => setSel(s => ({ ...s, title: e.target.value }))} /></div>
                <div><span style={label}>Type</span>
                  <select style={input} value={sel.kind} onChange={e => setSel(s => ({ ...s, kind: e.target.value }))}>
                    <option value="cbt">CBT (self-serve)</option>
                    <option value="in_person">In-person</option>
                  </select></div>
                <div><span style={label}>Recurrence</span>
                  <select style={input} value={sel.frequency_months ?? ""} onChange={e => setSel(s => ({ ...s, frequency_months: e.target.value ? Number(e.target.value) : null }))}>
                    {FREQ.map(f => <option key={f.label} value={f.value}>{f.label}</option>)}
                  </select></div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <span style={label}>Assigned departments</span>
                <div>{depts.map(d => (
                  <Chip key={d.id} text={d.name} active={sel.requiredDepartments.includes(d.id)}
                    onClick={() => setSel(s => ({ ...s, requiredDepartments: toggle(s.requiredDepartments, d.id) }))} />
                ))}</div>
              </div>

              <div style={{ marginBottom: 6 }}>
                <span style={label}>Assigned staff (specific)</span>
                <div>{users.filter(u => u.active).map(u => (
                  <Chip key={u.id} text={u.name} active={sel.requiredUsers.includes(u.id)}
                    onClick={() => setSel(s => ({ ...s, requiredUsers: toggle(s.requiredUsers, u.id) }))} />
                ))}</div>
              </div>

              <p style={{ fontSize: ".76rem", color: C.mist, margin: "10px 0 18px" }}>
                {targeted
                  ? "Required for the selected departments and staff."
                  : "No targeting selected — this training is required for ALL staff."}
              </p>

              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button style={btn()} onClick={save}>Save</button>
                {saved && <span style={{ fontSize: ".8rem", color: C.sage, fontWeight: 700 }}>✓ Saved</span>}
                <button style={btn(C.redLt, C.red)} onClick={deactivate}>Deactivate</button>
              </div>
            </div>
          ) : (
            <div style={{ padding: 30, color: C.mist, fontSize: ".85rem" }}>No trainings yet — create one.</div>
          )}
        </div>
      </div>
    </div>
  );
}
