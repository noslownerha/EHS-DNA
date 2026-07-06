import { useState, useEffect } from "react";
import { EHSHeader } from "./AppShell.jsx";
import { BRAND, COLORS } from "./constants.js";
import { api } from "./api.js";

const C = { ...COLORS };
const input = {
  width: "100%", padding: "9px 11px", border: "1.5px solid #D0DEDB", borderRadius: 7,
  fontFamily: "'DM Sans', sans-serif", fontSize: ".88rem", color: C.ink, outline: "none",
  background: C.white, boxSizing: "border-box",
};
const label = { fontSize: ".68rem", fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: C.sage, marginBottom: 5, display: "block" };
const btn = (bg = C.sage, fg = "#fff") => ({ padding: "8px 16px", background: bg, color: fg, border: "none", borderRadius: 7, fontFamily: "'DM Sans', sans-serif", fontSize: ".82rem", fontWeight: 700, cursor: "pointer" });

const FREQ = [
  { label: "On demand / one-time", value: "" },
  { label: "Monthly", value: 1 },
  { label: "Quarterly", value: 3 },
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
    let c = null;
    try { c = t.content ? JSON.parse(t.content) : null; } catch {}
    return {
      ...t,
      requiredDepartments: JSON.parse(t.required_departments || "[]"),
      requiredRoles: JSON.parse(t.required_roles || "[]"),
      requiredUsers: JSON.parse(t.required_users || "[]"),
      slides: c?.slides ?? [],
      questions: c?.questions ?? [],
      passThreshold: c?.passThreshold ?? 80,
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
        requiredRoles: sel.requiredRoles,
        requiredUsers: sel.requiredUsers,
        content: { slides: sel.slides, questions: sel.questions, passThreshold: Number(sel.passThreshold) || 80 },
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
  const targeted = sel && (sel.requiredDepartments.length || sel.requiredUsers.length || sel.requiredRoles.length);

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
                <span style={label}>Assigned roles</span>
                <div style={{ marginBottom: 12 }}>
                  {["staff", "trainer", "site_manager", "safety", "admin"].map(r => (
                    <Chip key={r} text={r.replace("_", " ")} active={(sel.requiredRoles ?? []).includes(r)}
                      onClick={() => setSel(s => ({ ...s, requiredRoles: toggle(s.requiredRoles ?? [], r) }))} />
                  ))}
                </div>
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

              {sel.kind === "cbt" && (
                <div style={{ borderTop: "1px solid #F0F4F2", paddingTop: 16, marginBottom: 16 }}>
                  <span style={label}>Course content — slides shown in order</span>
                  {sel.slides.map((s, i) => (
                    <div key={i} style={{ background: C.chalk, borderRadius: 10, padding: 12, marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                        <input style={{ ...input, fontWeight: 700 }} placeholder={`Slide ${i + 1} heading`} value={s.heading ?? ""}
                          onChange={e => setSel(x => ({ ...x, slides: x.slides.map((v, j) => j === i ? { ...v, heading: e.target.value } : v) }))} />
                        <button onClick={() => setSel(x => ({ ...x, slides: x.slides.filter((_, j) => j !== i) }))}
                          style={{ ...btn(C.redLt, C.red), padding: "6px 12px" }}>✕</button>
                      </div>
                      <input style={{ ...input, marginBottom: 8 }} placeholder="Video URL (YouTube, Vimeo, or direct .mp4 — optional)" value={s.videoUrl ?? ""}
                        onChange={e => setSel(x => ({ ...x, slides: x.slides.map((v, j) => j === i ? { ...v, videoUrl: e.target.value } : v) }))} />
                      <textarea rows={3} style={{ ...input, resize: "vertical" }} placeholder="Written content (optional if video provided)" value={s.body ?? ""}
                        onChange={e => setSel(x => ({ ...x, slides: x.slides.map((v, j) => j === i ? { ...v, body: e.target.value } : v) }))} />
                    </div>
                  ))}
                  <button style={btn(C.foam, C.pine)} onClick={() => setSel(x => ({ ...x, slides: [...x.slides, { heading: "", body: "", videoUrl: "" }] }))}>+ Add slide</button>
                </div>
              )}

              {sel.kind === "cbt" && (
                <div style={{ borderTop: "1px solid #F0F4F2", paddingTop: 16, marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    <span style={label}>Quiz — optional; leave empty for review-and-acknowledge</span>
                    {sel.questions.length > 0 && (
                      <label style={{ fontSize: ".78rem", color: C.slate, display: "flex", alignItems: "center", gap: 6 }}>
                        Pass threshold
                        <input type="number" min="1" max="100" value={sel.passThreshold}
                          onChange={e => setSel(x => ({ ...x, passThreshold: e.target.value }))}
                          style={{ ...input, width: 70, padding: "6px 8px" }} />%
                      </label>
                    )}
                  </div>
                  {sel.questions.map((q, i) => (
                    <div key={i} style={{ background: C.chalk, borderRadius: 10, padding: 12, marginBottom: 10, marginTop: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                        <input style={{ ...input, fontWeight: 700 }} placeholder={`Question ${i + 1}`} value={q.q ?? ""}
                          onChange={e => setSel(x => ({ ...x, questions: x.questions.map((v, j) => j === i ? { ...v, q: e.target.value } : v) }))} />
                        <button onClick={() => setSel(x => ({ ...x, questions: x.questions.filter((_, j) => j !== i) }))}
                          style={{ ...btn(C.redLt, C.red), padding: "6px 12px" }}>✕</button>
                      </div>
                      {(q.choices ?? []).map((c, ci) => (
                        <div key={ci} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <input type="radio" name={`correct-${i}`} checked={q.correctIndex === ci} title="Correct answer"
                            onChange={() => setSel(x => ({ ...x, questions: x.questions.map((v, j) => j === i ? { ...v, correctIndex: ci } : v) }))}
                            style={{ accentColor: C.sage, width: 15, height: 15, flexShrink: 0 }} />
                          <input style={input} placeholder={`Choice ${ci + 1}${q.correctIndex === ci ? " (correct)" : ""}`} value={c}
                            onChange={e => setSel(x => ({ ...x, questions: x.questions.map((v, j) => j === i ? { ...v, choices: v.choices.map((cv, cj) => cj === ci ? e.target.value : cv) } : v) }))} />
                          <button onClick={() => setSel(x => ({ ...x, questions: x.questions.map((v, j) => j === i ? { ...v, choices: v.choices.filter((_, cj) => cj !== ci), correctIndex: v.correctIndex >= ci && v.correctIndex > 0 ? v.correctIndex - 1 : v.correctIndex } : v) }))}
                            style={{ background: "none", border: "none", color: C.mist, cursor: "pointer", fontSize: ".9rem" }}>✕</button>
                        </div>
                      ))}
                      <button style={{ ...btn(C.white, C.slate), border: "1px solid #D0DEDB", padding: "5px 12px", fontSize: ".76rem" }}
                        onClick={() => setSel(x => ({ ...x, questions: x.questions.map((v, j) => j === i ? { ...v, choices: [...(v.choices ?? []), ""] } : v) }))}>+ Choice</button>
                    </div>
                  ))}
                  <button style={{ ...btn(C.foam, C.pine), marginTop: sel.questions.length ? 0 : 10 }}
                    onClick={() => setSel(x => ({ ...x, questions: [...x.questions, { q: "", choices: ["", ""], correctIndex: 0 }] }))}>+ Add question</button>
                </div>
              )}

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
