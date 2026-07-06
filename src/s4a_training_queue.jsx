import { COLORS } from "./constants.js";
import { useState, useEffect } from "react";
import { EHSHeader } from "./AppShell.jsx";
import { printCertificate } from "./s4e_s4f_library_detail.jsx";
import { BRAND } from "./constants.js";
import { api } from "./api.js";

const C = { ...COLORS };

// Spec §14.1: status chips — current, expiring-soon, overdue, expired
const STATUS = {
  current:       { label: "Current",       bg: C.foam,     color: C.pine,   icon: "✓" },
  expiring_soon: { label: "Expiring soon", bg: C.goldLt,   color: C.gold,   icon: "⏱" },
  overdue:       { label: "Overdue",       bg: C.redLt,    color: C.red,    icon: "!" },
  expired:       { label: "Expired",       bg: "#EEF1F0",  color: C.slate,  icon: "×" },
  not_started:   { label: "Not started",   bg: C.purpleLt, color: C.purple, icon: "→" },
};

const TYPE = {
  cbt:       { label: "CBT",       emoji: "💻", color: C.purple },
  in_person: { label: "In-person", emoji: "👥", color: C.pine   },
};

const SEED_QUEUE_UNUSED = [
  { id: 1, title: "Bottling Line Safety Orientation",       type: "cbt",       status: "overdue",       due: "Jun 10, 2024",  duration: "~12 min",  progress: 0,    expiresAt: null       },
  { id: 2, title: "Forklift Operator Certification",        type: "in_person", status: "not_started",   due: "Jun 20, 2024",  duration: "4 hrs",    progress: 0,    expiresAt: null       },
  { id: 3, title: "Hazard Communication (HAZCOM)",          type: "cbt",       status: "expiring_soon", due: null,            duration: "~8 min",   progress: 100,  expiresAt: "Jul 5, 2024" },
  { id: 4, title: "Emergency Evacuation Procedures",        type: "cbt",       status: "current",       due: null,            duration: "~6 min",   progress: 100,  expiresAt: "Dec 2024" },
  { id: 5, title: "PPE Selection & Use",                    type: "cbt",       status: "not_started",   due: "Jun 30, 2024",  duration: "~10 min",  progress: 0,    expiresAt: null       },
  { id: 6, title: "Slips, Trips & Falls Prevention",        type: "cbt",       status: "expired",       due: null,            duration: "~7 min",   progress: 100,  expiresAt: "May 1, 2024" },
];

function StatusPill({ status }) {
  const s = STATUS[status] ?? STATUS.not_started;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 9px", borderRadius: 20,
      fontSize: ".68rem", fontWeight: 600,
      background: s.bg, color: s.color,
    }}>
      {s.icon} {s.label}
    </span>
  );
}

function ProgressBar({ pct }) {
  if (pct === 0 || pct === 100) return null;
  return (
    <div style={{ height: 3, background: "#E2EBE6", borderRadius: 2, overflow: "hidden", marginTop: 6 }}>
      <div style={{ height: "100%", width: `${pct}%`, background: C.purple, borderRadius: 2 }} />
    </div>
  );
}

export default function S4aTrainingQueue({ onHome,
  user = { name: "Staff", site: "Moriah", dept: "" },
  onOpen,
  onBack,
}) {
  const [SEED_QUEUE, setQueue] = useState([]);
  useEffect(() => {
    Promise.all([api.listTrainings(), api.listCompletions()]).then(([trs, comps]) => {
      const me = JSON.parse(sessionStorage.getItem("ehs_user") || "{}");
      const now = Date.now(), soon = now + 30 * 86400000;
      const fmt = d => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;
      setQueue(trs.filter(tr => {
        if (!tr.active) return false;
        const roles = JSON.parse(tr.required_roles || "[]");
        const depts = JSON.parse(tr.required_departments || "[]");
        const users = JSON.parse(tr.required_users || "[]");
        return (roles.length === 0 && depts.length === 0 && users.length === 0)
          || roles.includes(me.role) || users.includes(me.id) || depts.includes(me.departmentId);
      }).map(tr => {
        const comp = comps.filter(c => c.training_id === tr.id && c.user_id === me.id)
          .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at))[0];
        let status;
        if (!comp) status = "not_started";
        else if (comp.expires_at && new Date(comp.expires_at).getTime() < now) status = "expired";
        else if (comp.expires_at && new Date(comp.expires_at).getTime() < soon) status = "expiring_soon";
        else status = "current";
        return {
          id: tr.id, title: tr.title, type: tr.kind ?? "cbt", status, content: tr.content,
          lastScore: comp?.score ?? null, lastCompletedAt: comp?.completed_at ? comp.completed_at.slice(0, 10) : null,
          due: null,
          duration: (() => {
            if (tr.kind === "in_person") return "In person";
            try {
              const c = tr.content ? JSON.parse(tr.content) : null;
              const n = (c?.slides?.length ?? 0) + (c?.questions?.length ?? 0);
              return n ? `~${Math.max(3, n * 2)} min` : "Quick sign-off";
            } catch { return "Self-serve"; }
          })(),
          progress: comp ? 100 : 0, expiresAt: fmt(comp?.expires_at),
        };
      }));
    }).catch(err => console.error("Queue load failed:", err.message));
  }, []);

  const [filter, setFilter] = useState("all"); // "all" | "due" | "expiring"

  const filtered = SEED_QUEUE.filter(t => {
    if (filter === "due")      return t.status === "overdue" || t.status === "not_started";
    if (filter === "expiring") return t.status === "expiring_soon" || t.status === "expired";
    return true;
  });

  const overdueCount      = SEED_QUEUE.filter(t => t.status === "overdue").length;
  const expiringSoonCount = SEED_QUEUE.filter(t => t.status === "expiring_soon").length;

  return (
    <div style={{ minHeight: "100vh", background: C.chalk, fontFamily: "'DM Sans', sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .anim { animation: fadeUp .22s ease both; }
        .training-row:hover { background: ${C.foam} !important; }
        .filter-chip:hover { border-color: ${C.sage} !important; }
        .start-btn:hover { background: ${C.purple}cc !important; }
      `}</style>

      <EHSHeader onHome={onHome} rightContent={<div style={{ fontSize: ".72rem", color: "rgba(255,255,255,.45)" }}>{user.name}</div>} />

      <div style={{ flex: 1, padding: "16px 18px 80px", overflowY: "auto" }}>

        {/* Header */}
        <div className="anim" style={{ marginBottom: 18 }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: C.ink }}>My training</h1>
          <p style={{ fontSize: ".82rem", color: C.mist, marginTop: 3 }}>{user.dept} · {user.site}</p>
        </div>

        {/* Urgent banners */}
        {overdueCount > 0 && (
          <div className="anim" style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "11px 14px", background: C.redLt,
            border: `1.5px solid #F5C6C2`, borderRadius: 9,
            marginBottom: 10, fontSize: ".85rem", color: C.red,
          }}>
            <span style={{ fontSize: "1rem" }}>⚠</span>
            <span><strong>{overdueCount} overdue</strong> — complete as soon as possible</span>
          </div>
        )}
        {expiringSoonCount > 0 && (
          <div className="anim" style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "11px 14px", background: C.goldLt,
            border: `1.5px solid #F0D090`, borderRadius: 9,
            marginBottom: 14, fontSize: ".85rem", color: "#7A5A1A",
          }}>
            <span>⏱</span>
            <span><strong>{expiringSoonCount} expiring soon</strong> — renew within 30 days</span>
          </div>
        )}

        {/* Filter chips */}
        <div className="anim" style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {[
            { id: "all",      label: `All (${SEED_QUEUE.length})` },
            { id: "due",      label: `Due / overdue (${overdueCount + SEED_QUEUE.filter(t => t.status === "not_started").length})` },
            { id: "expiring", label: "Expiring" },
          ].map(f => (
            <button key={f.id} className="filter-chip" onClick={() => setFilter(f.id)} style={{
              padding: "5px 12px", borderRadius: 20,
              background: filter === f.id ? C.sage : C.white,
              color: filter === f.id ? C.white : C.slate,
              border: `1.5px solid ${filter === f.id ? C.sage : "#D0DEDB"}`,
              fontFamily: "'DM Sans', sans-serif", fontSize: ".78rem", fontWeight: 600,
              cursor: "pointer", transition: "all .15s",
            }}>{f.label}</button>
          ))}
        </div>

        {/* Training list */}
        <div className="anim" style={{ background: C.white, borderRadius: 10, boxShadow: "0 1px 8px rgba(15,31,23,.06)", overflow: "hidden" }}>
          {filtered.map((t, i) => {
            const typeInfo = TYPE[t.type];
            const statusInfo = STATUS[t.status];
            const actionable = t.status !== "current";
            return (
              <div
                key={t.id}
                className="training-row"
                onClick={() => actionable && onOpen?.(t)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "13px 14px",
                  borderBottom: i < filtered.length - 1 ? "1px solid #F0F4F2" : "none",
                  cursor: actionable ? "pointer" : "default",
                  transition: "background .12s",
                  background: t.status === "overdue" ? "#FFFAF9" : C.white,
                }}
              >
                {/* Type icon */}
                <div style={{
                  width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                  background: typeInfo.color + "14",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "1.1rem",
                }}>
                  {typeInfo.emoji}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: ".88rem", fontWeight: 600, color: C.ink, lineHeight: 1.3, marginBottom: 4 }}>
                    {t.title}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <StatusPill status={t.status} />
                    <span style={{ fontSize: ".7rem", color: C.mist }}>{typeInfo.label} · {t.duration}</span>
                    {(t.status === "current" || t.status === "expiring_soon") && t.lastCompletedAt && (
                      <button onClick={e => { e.stopPropagation(); printCertificate({
                        staffName: JSON.parse(sessionStorage.getItem("ehs_user") || "{}").name ?? "—",
                        completedAt: t.lastCompletedAt, score: t.lastScore,
                        expiresAt: t.expiresAt, passed: true,
                      }, { title: t.title }, BRAND.company); }} style={{
                        background: "none", border: "1px solid #D0DEDB", borderRadius: 6,
                        padding: "2px 9px", fontSize: ".68rem", color: C.pine, cursor: "pointer",
                        fontFamily: "'DM Sans', sans-serif",
                      }}>🏅 Certificate</button>
                    )}
                  </div>
                  {t.due && (t.status === "overdue" || t.status === "not_started") && (
                    <div style={{ fontSize: ".7rem", color: t.status === "overdue" ? C.red : C.mist, marginTop: 3 }}>
                      Due {t.due}
                    </div>
                  )}
                  {t.expiresAt && (
                    <div style={{ fontSize: ".7rem", color: t.status === "expiring_soon" ? C.gold : C.mist, marginTop: 3 }}>
                      Expires {t.expiresAt}
                    </div>
                  )}
                  {t.progress > 0 && t.progress < 100 && (
                    <ProgressBar pct={t.progress} />
                  )}
                </div>

                {/* Action arrow */}
                {actionable && (
                  <div style={{ flexShrink: 0, color: C.mist, fontSize: ".85rem" }}>→</div>
                )}
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div style={{ padding: "28px", textAlign: "center", color: C.mist, fontSize: ".85rem" }}>
              No trainings in this category.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
