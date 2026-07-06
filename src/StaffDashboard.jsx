import { useState, useEffect } from "react";
import { BRAND, SITES, COLORS } from "./constants.js";
import { EHSHeader } from "./AppShell.jsx";
import { api } from "./api.js";

const C = { ...COLORS };

export default function StaffDashboard({ user, onHome, onNavigate }) {
  const site = SITES.find(s => s.name === user.site) ?? SITES[0];

  const [openTasks, setOpenTasks] = useState(0);
  const [overdueTrainings, setOverdueTrainings] = useState(0);
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    // My open work: incidents I reported that aren't closed
    Promise.all([api.listIncidents().catch(() => []), api.dashboardCompliance().catch(() => null), api.listNotifications().catch(() => [])])
      .then(([incs, compliance, notifs]) => {
        const mine = incs.filter(i => i.reporter_name === user.name && i.status !== "closed");
        setOpenTasks(mine.length);
        const meRow = compliance?.find?.(c => c.id === user.id);
        setOverdueTrainings(meRow?.overdue ?? 0);
        const fmt = ts => {
          const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
          if (mins < 60) return `${Math.max(1, mins)}m ago`;
          if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
          return `${Math.floor(mins / 1440)}d ago`;
        };
        setRecentActivity(notifs.slice(0, 4).map(n => ({
          icon: n.title?.includes("🩹") ? "🩹" : n.title?.includes("🔑") ? "🔑" : "🔔",
          desc: n.title?.replace(/^[^\w]+\s*/, "") ?? "Notification",
          time: fmt(n.created_at), nav: n.link_kind === "incident" ? "flag" : "home",
        })));
      });
  }, [user.id, user.name]);

  return (
    <div style={{ minHeight: "100vh", background: C.chalk, fontFamily: "'DM Sans', sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes triage-pulse { 0%,100%{box-shadow:0 0 0 0 rgba(192,57,43,.3);} 50%{box-shadow:0 0 0 10px rgba(192,57,43,0);} }
        .anim { animation: fadeUp .25s ease both; }
        .tile { transition: all .15s ease; cursor: pointer; }
        .tile:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,.1) !important; }
        .tile:active { transform: scale(.97); }
        .triage-tile { animation: triage-pulse 2.5s ease-in-out infinite; }
        .activity-row:hover { background: ${C.foam} !important; }
      `}</style>

      <EHSHeader
        onHome={onHome}
        rightContent={
          <span style={{ fontSize: ".72rem", color: "rgba(255,255,255,.4)" }}>
            {user.first} · {site.name}
          </span>
        }
      />

      <div style={{ flex: 1, padding: "16px 16px 0", overflowY: "auto" }}>

        {/* Greeting */}
        <div className="anim" style={{ marginBottom: 18 }}>
          <h1 style={{ fontSize: "1.2rem", fontWeight: 700, color: C.ink }}>Hey {user.first} 👋</h1>
          <p style={{ fontSize: ".82rem", color: C.mist, marginTop: 3 }}>
            {site.name} · {user.dept} · {new Date().toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}
          </p>
        </div>

        {/* Bucket 3: 3 tiles — 2-up top row, triage full-width below */}
        <div className="anim" style={{ marginBottom: 18 }}>

          {/* Top row: 2 tiles */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            {/* Open Tasks (combined flags + CAs) */}
            <div className="tile" onClick={() => onNavigate("flag")} style={{
              background: openTasks > 0 ? C.redLt : C.foam,
              border: `1.5px solid ${openTasks > 0 ? C.red + "33" : C.mint}`,
              borderRadius: 12, padding: "15px 14px",
              boxShadow: "0 2px 8px rgba(0,0,0,.06)",
            }}>
              <div style={{ fontSize: "1.2rem", marginBottom: 6 }}>🚩</div>
              <div style={{ fontSize: "1.7rem", fontWeight: 800, color: openTasks > 0 ? C.red : C.sage, lineHeight: 1, marginBottom: 3 }}>{openTasks}</div>
              <div style={{ fontSize: ".75rem", fontWeight: 600, color: C.ink }}>Open tasks</div>
              <div style={{ fontSize: ".67rem", color: C.mist, marginTop: 2 }}>Flags & actions</div>
            </div>

            {/* Overdue training */}
            <div className="tile" onClick={() => onNavigate("training")} style={{
              background: overdueTrainings > 0 ? C.goldLt : C.foam,
              border: `1.5px solid ${overdueTrainings > 0 ? C.gold + "44" : C.mint}`,
              borderRadius: 12, padding: "15px 14px",
              boxShadow: "0 2px 8px rgba(0,0,0,.06)",
            }}>
              <div style={{ fontSize: "1.2rem", marginBottom: 6 }}>📚</div>
              <div style={{ fontSize: "1.7rem", fontWeight: 800, color: overdueTrainings > 0 ? C.gold : C.sage, lineHeight: 1, marginBottom: 3 }}>{overdueTrainings}</div>
              <div style={{ fontSize: ".75rem", fontWeight: 600, color: C.ink }}>Overdue training</div>
              <div style={{ fontSize: ".67rem", color: overdueTrainings > 0 ? C.gold : C.mist, marginTop: 2 }}>
                {overdueTrainings > 0 ? "Action needed" : "All current"}
              </div>
            </div>
          </div>

          {/* Triage — full width, pulsing */}
          <div
            className="tile triage-tile"
            onClick={() => onNavigate("triage")}
            style={{
              background: C.redLt,
              border: `1.5px solid ${C.red}33`,
              borderRadius: 12, padding: "15px 18px",
              display: "flex", alignItems: "center", gap: 14,
              boxShadow: "0 2px 8px rgba(0,0,0,.06)",
            }}
          >
            <span style={{ fontSize: "1.6rem", flexShrink: 0 }}>🚨</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: ".88rem", fontWeight: 700, color: C.red }}>Triage · Something happening right now?</div>
              <div style={{ fontSize: ".72rem", color: C.mist, marginTop: 2 }}>Get live guidance · takes 60 seconds</div>
            </div>
            <span style={{ color: C.red, fontSize: ".9rem", flexShrink: 0 }}>→</span>
          </div>
        </div>

        {/* Recent activity */}
        <div className="anim">
          <div style={{ fontSize: ".7rem", fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: C.mist, marginBottom: 8, paddingLeft: 2 }}>
            Recent activity
          </div>
          <div style={{ background: C.white, borderRadius: 10, boxShadow: "0 1px 8px rgba(15,31,23,.06)", overflow: "hidden" }}>
            {recentActivity.map((item, i) => (
              <div key={i} className="activity-row" onClick={() => onNavigate(item.nav)} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                borderBottom: i < recentActivity.length - 1 ? "1px solid #F0F4F2" : "none",
                cursor: "pointer", transition: "background .12s",
              }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, background: C.chalk, display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".95rem" }}>
                  {item.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: ".85rem", color: C.ink, lineHeight: 1.3 }}>{item.desc}</div>
                  <div style={{ fontSize: ".7rem", color: C.mist, marginTop: 2 }}>{item.time}</div>
                </div>
                <span style={{ color: C.mist, fontSize: ".8rem" }}>→</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom spacer — ensures content clears the fixed nav bar */}
        <div style={{ height: 80 }} />
      </div>
    </div>
  );
}
