// Worker home — "Clarity with character". One big obvious action (report),
// then what's waiting on this person: their training and the things they've
// reported. Name, site and department come from the signed-in user — the old
// screen read fields sign-in never provided (and a hard-coded WhistlePig site
// list), so every worker saw "Hey 👋" with no name or site.
import { useState, useEffect } from "react";
import { COLORS as C, FONTS, moduleEnabled } from "./constants.js";
import { EHSHeader } from "./AppShell.jsx";
import { api } from "./api.js";
import Icon from "./Icon.jsx";
import { StatusChip, Card, CardHeader, Row, greeting } from "./ui.jsx";

const TRAINING_STATE = {
  not_started: { tone: "amber", label: "Not started" },
  expired:     { tone: "red",   label: "Expired" },
  expiring:    { tone: "amber", label: "Expiring soon" },
};
const INCIDENT_STATE = { open: { tone: "blue", label: "In progress" }, investigating: { tone: "blue", label: "Being looked at" },
                         closed: { tone: "green", label: "Closed" } };

export default function StaffDashboard({ user, onHome, onNavigate }) {
  const first = (user?.name || "").trim().split(/\s+/)[0] || "there";
  const where = [user?.site, user?.department].filter(Boolean).join(" · ");
  const [todo, setTodo] = useState(null);
  const [mine, setMine] = useState(null);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    Promise.all([api.listIncidents().catch(() => []), api.dashboardCompliance().catch(() => null), api.listNotifications().catch(() => [])])
      .then(([incs, compliance, notifs]) => {
        setMine(incs.filter(i => i.reporter_name === user.name).slice(0, 3));
        const me = compliance?.find?.(c => c.id === user.id);
        setTodo(me?.todo ?? []);
        setRecent((notifs || []).slice(0, 3));
      });
  }, [user.id, user.name]);

  const tile = { display: "flex", alignItems: "center", gap: 10, height: 60, padding: "0 14px", borderRadius: 14,
                 border: `1px solid ${C.line}`, background: C.white, fontFamily: FONTS.body, fontSize: ".9rem",
                 fontWeight: 600, color: C.ink, cursor: "pointer", textAlign: "left" };
  const ago = ts => {
    const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
    return m < 60 ? `${Math.max(1, m)}m ago` : m < 1440 ? `${Math.floor(m / 60)}h ago` : `${Math.floor(m / 1440)}d ago`;
  };

  return (
    <div style={{ minHeight: "100vh", background: C.chalk, fontFamily: FONTS.body, color: C.ink, display: "flex", flexDirection: "column" }}>
      <EHSHeader onHome={onHome} />

      {/* Hero band — continues the header colour so the greeting and the one
          primary action read as a single block. */}
      <div style={{ background: C.forest, color: "#fff", padding: "6px 20px 22px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          {where && <div style={{ fontSize: ".82rem", color: "rgba(255,255,255,.78)" }}>{where}</div>}
          <h1 style={{ margin: "2px 0 16px", fontSize: "1.75rem", fontWeight: 700 }}>{greeting()}, {first}</h1>
          {moduleEnabled("incidents") && (
            <button onClick={() => onNavigate("flag")} style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", padding: 16,
                    border: "none", borderRadius: 16, background: C.mint, color: C.forest, textAlign: "left", cursor: "pointer", fontFamily: FONTS.body }}>
              <span style={{ width: 46, height: 46, borderRadius: 13, background: C.forest, color: C.mint, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon name="flag" size={23} stroke={2} />
              </span>
              <span style={{ flex: 1 }}>
                <span style={{ display: "block", fontFamily: FONTS.display, fontSize: "1.2rem", fontWeight: 700 }}>Report something</span>
                <span style={{ display: "block", fontSize: ".85rem", fontWeight: 500 }}>Injury, hazard, damage or an idea</span>
              </span>
              <Icon name="chev" size={22} stroke={2.2} />
            </button>
          )}
        </div>
      </div>

      <main style={{ flex: 1, width: "100%", maxWidth: 640, margin: "0 auto", padding: "18px 20px 100px", display: "flex", flexDirection: "column", gap: 16 }}>
        {moduleEnabled("incidents") && (
          <button onClick={() => onNavigate("triage")} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 14,
                  border: `1.5px solid ${C.red}`, background: C.redLt, color: C.red, cursor: "pointer", textAlign: "left", fontFamily: FONTS.body }}>
            <Icon name="alert" size={22} stroke={2} />
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", fontWeight: 700, fontSize: ".95rem" }}>Something happening right now?</span>
              <span style={{ display: "block", fontSize: ".8rem", color: C.ink }}>Step-by-step guidance · about 60 seconds</span>
            </span>
            <Icon name="chev" size={18} />
          </button>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
          {moduleEnabled("inspections") && (
            <button style={tile} onClick={() => onNavigate("inspect")}><span style={{ color: C.sage }}><Icon name="check" size={22} /></span>Inspect</button>
          )}
          {moduleEnabled("recognition") && (
            <button style={tile} onClick={() => onNavigate("recognition")}><span style={{ color: C.sage }}><Icon name="star" size={22} /></span>Recognition</button>
          )}
        </div>

        {moduleEnabled("lms") && (
          <Card>
            <CardHeader title="Your training" right={todo && (todo.length
              ? <StatusChip tone="amber" solid>{todo.length} to do</StatusChip>
              : <StatusChip tone="green">All current</StatusChip>)} />
            {todo === null && <div style={{ padding: "4px 16px 14px", fontSize: ".85rem", color: C.slate }}>Loading…</div>}
            {todo && todo.length === 0 && <div style={{ padding: "4px 16px 14px", fontSize: ".88rem", color: C.slate }}>You're up to date. Nice work.</div>}
            {todo && todo.slice(0, 3).map(t => {
              const st = TRAINING_STATE[t.state] || TRAINING_STATE.not_started;
              return <Row key={t.id} tone={st.tone} icon={<Icon name={t.kind === "in_person" ? "building" : "cap"} size={18} />}
                          title={t.title} meta={t.kind === "in_person" ? "In person · with your trainer" : "Online course"}
                          status={<StatusChip tone={st.tone}>{st.label}</StatusChip>} onClick={() => onNavigate("training")} />;
            })}
            {todo && todo.length > 3 && (
              <button onClick={() => onNavigate("training")} style={{ width: "100%", padding: "12px 16px", border: "none", borderTop: `1px solid ${C.line}`,
                      background: "transparent", color: C.sage, fontWeight: 700, fontSize: ".88rem", cursor: "pointer", textAlign: "left", fontFamily: FONTS.body }}>
                See all {todo.length} →
              </button>
            )}
          </Card>
        )}

        {moduleEnabled("incidents") && mine && mine.length > 0 && (
          <Card>
            <CardHeader title="Things you reported" />
            {mine.map(i => {
              const st = INCIDENT_STATE[i.status] || INCIDENT_STATE.open;
              return <Row key={i.id} tone={st.tone} icon={<Icon name="alert" size={18} />}
                          title={i.description || i.ref} meta={`${i.ref} · ${ago(i.created_at)}`}
                          status={<StatusChip tone={st.tone}>{st.label}</StatusChip>}
                          onClick={() => window.dispatchEvent(new CustomEvent("ehs:navigate", { detail: { kind: "incident" } }))} />;
            })}
          </Card>
        )}

        {recent.length > 0 && (
          <Card>
            <CardHeader title="Recent activity" />
            {recent.map(n => (
              <Row key={n.id} tone="blue" icon={<Icon name="bell" size={18} />} title={(n.title || "Notification").replace(/^[^\w]+\s*/, "")}
                   meta={ago(n.created_at)} onClick={() => onNavigate(n.link_kind === "incident" ? "flag" : n.link_kind === "training" ? "training" : "home")} />
            ))}
          </Card>
        )}
      </main>
    </div>
  );
}
