import { useState } from "react";
import { COLORS as C, BRAND } from "./constants.js";
import { api } from "./api.js";

/**
 * Create a standalone corrective action / task — one not tied to an incident or
 * inspection finding. For the everyday "this needs doing but it isn't a hazard or
 * a near-miss" case: trash in the wrong place, a sign that needs replacing, a
 * cleanup. Elevated roles can assign it to a person or a whole team, same as any
 * other CA.
 */
export default function NewTaskModal({ users = [], onClose, onCreated }) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [mode, setMode] = useState("person");        // person | team
  const [assigneeId, setAssigneeId] = useState("");
  const [deptId, setDeptId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [saving, setSaving] = useState(false);

  const depts = BRAND.departmentRecords ?? [];
  const sites = BRAND.siteRecords ?? [];

  const field = { width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.line ?? "#E2EBE6"}`, fontSize: ".9rem", fontFamily: "'DM Sans', sans-serif", color: C.ink, background: "#fff", boxSizing: "border-box" };
  const label = { fontSize: ".72rem", fontWeight: 700, color: C.mist, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 6 };

  function submit() {
    if (!title.trim()) return;
    setSaving(true);
    const body = {
      title: title.trim(),
      priority,
      dueDate: dueDate || null,
      ...(mode === "team"
        ? { assigneeDeptId: deptId ? Number(deptId) : null, assigneeSiteId: siteId ? Number(siteId) : null }
        : { assigneeId: assigneeId ? Number(assigneeId) : null }),
    };
    api.createCA(body)
      .then(() => { onCreated?.(); onClose?.(); })
      .catch(err => { console.error("Create task failed:", err.message); setSaving(false); });
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,31,23,.45)", zIndex: 620, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#fff", width: "min(460px, 100%)", maxHeight: "92vh", overflowY: "auto",
        borderRadius: "16px 16px 0 0", padding: 0,
      }}>
        <div style={{ position: "sticky", top: 0, background: C.forest, color: "#fff", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderRadius: "16px 16px 0 0" }}>
          <span style={{ fontWeight: 700 }}>New task</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#fff", fontSize: "1.4rem", cursor: "pointer", padding: 0, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <div style={label}>What needs doing?</div>
            <textarea value={title} onChange={e => setTitle(e.target.value)} rows={2} autoFocus
              placeholder="e.g. Clear pallet debris from loading dock B"
              style={{ ...field, resize: "vertical" }} />
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={label}>Priority</div>
              <select style={field} value={priority} onChange={e => setPriority(e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <div style={label}>Due date</div>
              <input type="date" style={field} value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          </div>

          <div>
            <div style={label}>Assign to</div>
            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              {["person", "team"].map(m => (
                <button key={m} onClick={() => setMode(m)} style={{
                  flex: 1, padding: "7px", borderRadius: 8, fontSize: ".8rem", fontWeight: 600,
                  border: mode === m ? `1.5px solid ${C.sage}` : `1px solid ${C.line ?? "#E2EBE6"}`,
                  background: mode === m ? "#EEF6F0" : "#fff", color: mode === m ? C.pine : C.slate, cursor: "pointer",
                }}>{m === "person" ? "A person" : "A team"}</button>
              ))}
            </div>
            {mode === "team" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <select style={field} value={deptId} onChange={e => setDeptId(e.target.value)}>
                  <option value="">Choose a department…</option>
                  {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                {deptId && (
                  <select style={field} value={siteId} onChange={e => setSiteId(e.target.value)}>
                    <option value="">All sites</option>
                    {sites.map(s => <option key={s.id} value={s.id}>{s.name} only</option>)}
                  </select>
                )}
              </div>
            ) : (
              <select style={field} value={assigneeId} onChange={e => setAssigneeId(e.target.value)}>
                <option value="">Unassigned</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            )}
          </div>

          <button disabled={saving || !title.trim()} onClick={submit} style={{
            padding: "12px", borderRadius: 10, border: "none",
            background: title.trim() ? C.sage : "#C9D6CE", color: "#fff",
            fontSize: ".9rem", fontWeight: 700, cursor: title.trim() ? "pointer" : "default",
          }}>{saving ? "Creating…" : "Create task"}</button>
        </div>
      </div>
    </div>
  );
}
