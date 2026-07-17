import { useState, useEffect } from "react";
import { COLORS as C, BRAND } from "./constants.js";
import { api } from "./api.js";

const STATUS_LABELS = {
  open: "Open",
  in_progress: "In progress",
  capex_blocked: "CapEx-blocked",
  done: "Done",
  verified: "Verified",
};
const STATUS_COLORS = {
  open:          { bg: "#EEF1F0", fg: C.slate },
  in_progress:   { bg: "#E5F0FB", fg: "#2563A8" },
  capex_blocked: { bg: "#FFF1DB", fg: "#8A5A00" },
  done:          { bg: "#E4F3EA", fg: C.pine },
  verified:      { bg: "#E4F3EA", fg: C.pine },
};

// A single activity-log entry, rendered as a timeline row.
function ActivityRow({ a }) {
  const when = a.created_at ? new Date(a.created_at.replace(" ", "T") + "Z") : null;
  const stamp = when ? when.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
  const icon = { note: "💬", status: "◆", assign: "👤", due: "📅", created: "✦", capex: "⛔" }[a.kind] ?? "•";
  return (
    <div style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.foam}` }}>
      <div style={{ fontSize: ".9rem", lineHeight: 1.4, width: 18, textAlign: "center", flexShrink: 0 }}>{icon}</div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: ".84rem", color: C.ink, lineHeight: 1.4, wordBreak: "break-word" }}>{a.detail}</div>
        <div style={{ fontSize: ".72rem", color: C.mist, marginTop: 2 }}>
          {a.actor_name ?? "System"}{stamp ? ` · ${stamp}` : ""}
        </div>
      </div>
    </div>
  );
}

/**
 * The panel where a corrective action actually gets worked: reassign it, set or
 * change its due date, move it through its status, block it on CapEx, and leave
 * notes — with a full activity trail so there's a record of who did what.
 *
 * Renders as a slide-over on desktop, full screen on mobile.
 */
export default function CADetailPanel({ caId, users = [], onClose, onChanged }) {
  const [ca, setCa] = useState(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [showBlock, setShowBlock] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assignMode, setAssignMode] = useState(null); // null = infer from CA; "person" | "team"
  const depts = BRAND.departmentRecords ?? [];
  const sites = BRAND.siteRecords ?? [];

  function load() {
    setLoading(true);
    api.getCA(caId)
      .then(data => { setCa(data); setBlockReason(data.blocked_reason ?? ""); })
      .catch(() => setCa(null))
      .finally(() => setLoading(false));
  }
  useEffect(() => { if (caId) load(); }, [caId]);

  // Apply a patch, refresh the panel, and let the parent list refresh too.
  function patch(body, after) {
    setSaving(true);
    api.updateCA(caId, body)
      .then(() => { load(); onChanged?.(); after?.(); })
      .catch(err => console.error("CA update failed:", err.message))
      .finally(() => setSaving(false));
  }

  const overlay = {
    position: "fixed", inset: 0, background: "rgba(15,31,23,.45)", zIndex: 600,
    display: "flex", justifyContent: "flex-end",
  };
  const panel = {
    background: "#fff", width: "min(480px, 100%)", height: "100%", overflowY: "auto",
    boxShadow: "-4px 0 24px rgba(15,31,23,.18)", display: "flex", flexDirection: "column",
  };
  const label = { fontSize: ".72rem", fontWeight: 700, color: C.mist, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 6 };
  const field = { width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.line ?? "#E2EBE6"}`, fontSize: ".9rem", fontFamily: "'DM Sans', sans-serif", color: C.ink, background: "#fff" };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ position: "sticky", top: 0, background: C.forest, color: "#fff", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 1 }}>
          <span style={{ fontWeight: 700, fontSize: "1rem" }}>Corrective action</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#fff", fontSize: "1.4rem", cursor: "pointer", lineHeight: 1, padding: 0 }}>×</button>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: C.mist }}>Loading…</div>
        ) : !ca ? (
          <div style={{ padding: 40, textAlign: "center", color: C.mist }}>Couldn't load this corrective action.</div>
        ) : (
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Title + linkage */}
            <div>
              <h2 style={{ margin: 0, fontSize: "1.1rem", color: C.ink, lineHeight: 1.35 }}>{ca.title}</h2>
              <div style={{ marginTop: 6, fontSize: ".8rem", color: C.mist }}>
                {ca.incident_ref ? <>From incident <span style={{ fontFamily: "'DM Mono', monospace", color: C.sage }}>{ca.incident_ref}</span></> : "Standalone task"}
              </div>
            </div>

            {/* Status pills — one tap to change */}
            <div>
              <div style={label}>Status</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {["open", "in_progress", "done", "verified"].map(st => {
                  const active = ca.status === st;
                  const col = STATUS_COLORS[st];
                  return (
                    <button key={st} disabled={saving || active}
                      onClick={() => patch(st === "verified" ? { verified: true } : { status: st })}
                      style={{
                        padding: "7px 12px", borderRadius: 20, fontSize: ".78rem", fontWeight: 600,
                        border: active ? `1.5px solid ${col.fg}` : `1px solid ${C.line ?? "#E2EBE6"}`,
                        background: active ? col.bg : "#fff", color: active ? col.fg : C.slate,
                        cursor: active ? "default" : "pointer",
                      }}>{STATUS_LABELS[st]}</button>
                  );
                })}
              </div>
            </div>

            {/* CapEx block */}
            <div>
              <div style={label}>Budget / CapEx</div>
              {ca.status === "capex_blocked" ? (
                <div style={{ background: "#FFF6E5", borderRadius: 8, padding: "12px 14px" }}>
                  <div style={{ fontSize: ".82rem", color: "#7A5A00", fontWeight: 600, marginBottom: 4 }}>⛔ Blocked on CapEx — stays open, not counted overdue</div>
                  {ca.blocked_reason && <div style={{ fontSize: ".82rem", color: "#7A5A00" }}>{ca.blocked_reason}</div>}
                  <button disabled={saving} onClick={() => patch({ status: "open", blockedReason: null })}
                    style={{ marginTop: 10, padding: "7px 12px", borderRadius: 8, border: "none", background: C.sage, color: "#fff", fontSize: ".8rem", fontWeight: 700, cursor: "pointer" }}>
                    Unblock — budget approved
                  </button>
                </div>
              ) : showBlock ? (
                <div style={{ background: "#FFF6E5", borderRadius: 8, padding: "12px 14px" }}>
                  <textarea value={blockReason} onChange={e => setBlockReason(e.target.value)} rows={2}
                    placeholder="Why is this blocked? (e.g. needs $40k floor regrade, submitted for FY27 capital budget)"
                    style={{ ...field, resize: "vertical", marginBottom: 8 }} />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button disabled={saving} onClick={() => patch({ status: "capex_blocked", blockedReason: blockReason }, () => setShowBlock(false))}
                      style={{ padding: "7px 12px", borderRadius: 8, border: "none", background: "#8A5A00", color: "#fff", fontSize: ".8rem", fontWeight: 700, cursor: "pointer" }}>
                      Mark CapEx-blocked
                    </button>
                    <button onClick={() => setShowBlock(false)} style={{ padding: "7px 12px", borderRadius: 8, border: `1px solid ${C.line ?? "#E2EBE6"}`, background: "#fff", color: C.slate, fontSize: ".8rem", cursor: "pointer" }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowBlock(true)} style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.line ?? "#E2EBE6"}`, background: "#fff", color: C.slate, fontSize: ".82rem", cursor: "pointer" }}>
                  Mark blocked on budget
                </button>
              )}
            </div>

            {/* Assignee — person or a whole team */}
            <div>
              <div style={label}>Assigned to</div>
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                {["person", "team"].map(mode => {
                  const active = (assignMode ?? (ca.assignee_dept_id ? "team" : "person")) === mode;
                  return (
                    <button key={mode} onClick={() => setAssignMode(mode)} style={{
                      flex: 1, padding: "7px", borderRadius: 8, fontSize: ".8rem", fontWeight: 600,
                      border: active ? `1.5px solid ${C.sage}` : `1px solid ${C.line ?? "#E2EBE6"}`,
                      background: active ? "#EEF6F0" : "#fff", color: active ? C.pine : C.slate, cursor: "pointer",
                    }}>{mode === "person" ? "A person" : "A team"}</button>
                  );
                })}
              </div>

              {(assignMode ?? (ca.assignee_dept_id ? "team" : "person")) === "team" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <select style={field} value={ca.assignee_dept_id ?? ""} disabled={saving}
                    onChange={e => patch({ assigneeDeptId: e.target.value ? Number(e.target.value) : null, assigneeSiteId: ca.assignee_site_id ?? null })}>
                    <option value="">Choose a department…</option>
                    {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  {ca.assignee_dept_id && (
                    <select style={field} value={ca.assignee_site_id ?? ""} disabled={saving}
                      onChange={e => patch({ assigneeDeptId: ca.assignee_dept_id, assigneeSiteId: e.target.value ? Number(e.target.value) : null })}>
                      <option value="">All sites</option>
                      {sites.map(s => <option key={s.id} value={s.id}>{s.name} only</option>)}
                    </select>
                  )}
                  {ca.assignee_group && (
                    <div style={{ fontSize: ".78rem", color: C.mist }}>
                      Assigned to {ca.assignee_group} — {ca.group_member_count ?? 0} {ca.group_member_count === 1 ? "person" : "people"} notified. Any of them can complete it.
                    </div>
                  )}
                </div>
              ) : (
                <select style={field} value={ca.assignee_id ?? ""} disabled={saving}
                  onChange={e => patch({ assigneeId: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">Unassigned</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              )}
            </div>

            {/* Due date */}
            <div>
              <div style={label}>Due date</div>
              <input type="date" style={field} value={ca.due_date ?? ""} disabled={saving}
                onChange={e => patch({ dueDate: e.target.value || null })} />
            </div>

            {/* Priority */}
            <div>
              <div style={label}>Priority</div>
              <select style={field} value={ca.priority ?? "medium"} disabled={saving}
                onChange={e => patch({ priority: e.target.value })}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            {/* Add a note */}
            <div>
              <div style={label}>Add a note</div>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                placeholder="Progress update, context, anything worth recording…"
                style={{ ...field, resize: "vertical" }} />
              <button disabled={saving || !note.trim()} onClick={() => patch({ note }, () => setNote(""))}
                style={{ marginTop: 8, padding: "8px 14px", borderRadius: 8, border: "none",
                  background: note.trim() ? C.sage : "#C9D6CE", color: "#fff", fontSize: ".82rem", fontWeight: 700,
                  cursor: note.trim() ? "pointer" : "default" }}>
                Add note
              </button>
            </div>

            {/* Activity timeline */}
            <div>
              <div style={label}>Activity</div>
              <div>
                {(ca.activity ?? []).length === 0
                  ? <div style={{ fontSize: ".82rem", color: C.mist }}>No activity yet.</div>
                  : ca.activity.map(a => <ActivityRow key={a.id} a={a} />)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
