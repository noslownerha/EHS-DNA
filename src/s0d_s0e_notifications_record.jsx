import { useState } from "react";
import { EHSHeader } from "./AppShell.jsx";

const C = {
  forest: "#1C3A2A", pine: "#2D5A3D", sage: "#4A8C5C",
  mint: "#A8D5B5", foam: "#E8F5EC", ink: "#0F1F17",
  slate: "#4A5568", mist: "#8FA3A0", chalk: "#F4F7F5",
  white: "#FFFFFF", gold: "#C8922A", goldLt: "#FDF3E3",
  red: "#C0392B", alarm: "#B91C1C",
};

// ── Notification rules per outcome (spec §11.6) ───────────────────────────────
const NOTIFICATION_RULES = {
  "911":      ["Site Manager", "Emergency Response Coordinator (ERC)"],
  "triage":   ["Site Manager"],
  "firstaid": [],   // logged only unless configured otherwise
  "secure":   [],
};

const OUTCOME_SEVERITY = {
  "911":      { label: "Serious",     color: C.alarm,  emoji: "🚨" },
  "triage":   { label: "Moderate",    color: C.gold,   emoji: "📞" },
  "firstaid": { label: "Minor",       color: C.pine,   emoji: "🩹" },
  "secure":   { label: "Property",    color: C.slate,  emoji: "⚠️" },
};

// ── Notified person row ───────────────────────────────────────────────────────
function NotifiedRow({ role, name, method, sent }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 16px",
      borderBottom: "1px solid rgba(255,255,255,.07)",
    }}>
      {/* Avatar */}
      <div style={{
        width: 34, height: 34, borderRadius: "50%",
        background: "rgba(255,255,255,.1)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: ".78rem", fontWeight: 700, color: C.mint, flexShrink: 0,
      }}>
        {name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() ?? "??"}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: ".88rem", fontWeight: 600, color: C.white }}>
          {name ?? "—"}
        </div>
        <div style={{ fontSize: ".72rem", color: "rgba(255,255,255,.35)", marginTop: 1 }}>
          {role} · via {method}
        </div>
      </div>
      {sent
        ? <span style={{ fontSize: ".75rem", color: C.mint, display: "flex", alignItems: "center", gap: 4 }}>✓ Sent</span>
        : <span style={{ fontSize: ".72rem", color: "rgba(255,255,255,.25)" }}>Not notified</span>
      }
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// S0d — Notifications Sent
// ════════════════════════════════════════════════════════════════════════════
export function S0dNotificationsSent({
  outcome    = "triage",
  responder  = "Responder",
  site       = "Moriah",
  timestamp  = new Date(),
  contacts   = {
    "Site Manager":                        { name: "per notification rules", method: "in-app" },
    "Emergency Response Coordinator (ERC)":{ name: "per notification rules", method: "in-app" },
  },
  onViewRecord,   // () => void → s0e
  onDone,         // () => void → home
  onHome,
}) {
  const notified     = NOTIFICATION_RULES[outcome] ?? [];
  const sev          = OUTCOME_SEVERITY[outcome] ?? OUTCOME_SEVERITY["secure"];
  const timeStr      = timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const dateStr      = timestamp.toLocaleDateString([], { month: "short", day: "numeric" });

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #0D1F17 0%, #080F0C 100%)",
      fontFamily: "'DM Sans', sans-serif",
      display: "flex", flexDirection: "column",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        .a0 { animation: fadeUp .25s ease .0s both; }
        .a1 { animation: fadeUp .25s ease .1s both; }
        .a2 { animation: fadeUp .25s ease .2s both; }
        .a3 { animation: fadeUp .25s ease .3s both; }
        .done-btn:hover { background: ${C.pine} !important; }
        .record-btn:hover { background: rgba(255,255,255,.08) !important; }
      `}</style>

      <EHSHeader onHome={onHome ?? onDone} dark rightContent={
        <div style={{ fontSize: ".72rem", color: "rgba(255,255,255,.35)", background: "rgba(255,255,255,.07)", padding: "3px 10px", borderRadius: 20 }}>{responder} · {site}</div>
      } />

      <div style={{
        flex: 1, padding: "0 20px 100px",
        maxWidth: 460, margin: "0 auto", width: "100%",
      }}>

        {/* Header */}
        <div className="a0" style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: "2.8rem", marginBottom: 10 }}>📬</div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: C.white, marginBottom: 6 }}>
            Notifications sent
          </h1>
          <p style={{ fontSize: ".85rem", color: "rgba(255,255,255,.45)", lineHeight: 1.5 }}>
            The right people have been alerted based on this outcome.
          </p>
        </div>

        {/* Outcome pill */}
        <div className="a1" style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px",
          background: "rgba(255,255,255,.05)",
          border: "1px solid rgba(255,255,255,.1)",
          borderRadius: 10, marginBottom: 16,
        }}>
          <div style={{ fontSize: ".85rem", color: "rgba(255,255,255,.55)" }}>
            Outcome · {dateStr} at {timeStr}
          </div>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "3px 10px", borderRadius: 20,
            fontSize: ".75rem", fontWeight: 600,
            background: sev.color + "22", color: sev.color,
            border: `1px solid ${sev.color}44`,
          }}>
            {sev.emoji} {sev.label}
          </span>
        </div>

        {/* Notified list */}
        <div className="a2" style={{
          background: "rgba(255,255,255,.05)",
          border: "1.5px solid rgba(255,255,255,.1)",
          borderRadius: 12, overflow: "hidden", marginBottom: 16,
        }}>
          <div style={{
            padding: "11px 16px",
            borderBottom: "1px solid rgba(255,255,255,.08)",
            fontSize: ".7rem", fontWeight: 600, letterSpacing: ".08em",
            textTransform: "uppercase", color: "rgba(255,255,255,.3)",
            display: "flex", justifyContent: "space-between",
          }}>
            <span>Who was notified</span>
            <span>{notified.length} contact{notified.length !== 1 ? "s" : ""}</span>
          </div>

          {notified.length === 0 ? (
            <div style={{ padding: "16px", fontSize: ".85rem", color: "rgba(255,255,255,.3)", textAlign: "center" }}>
              Logged only — no notifications for minor outcomes unless configured.
            </div>
          ) : notified.map(role => (
            <NotifiedRow
              key={role}
              role={role}
              name={contacts[role]?.name}
              method={contacts[role]?.method ?? "app"}
              sent={!!contacts[role]}
            />
          ))}
        </div>

        {/* What happens next */}
        <div className="a3" style={{
          padding: "14px 16px",
          background: "rgba(74,140,92,.1)",
          border: "1px solid rgba(74,140,92,.2)",
          borderRadius: 10, marginBottom: 16,
        }}>
          <div style={{ fontSize: ".72rem", fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: C.mint, marginBottom: 8 }}>
            What happens next
          </div>
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              "A triage record has been created automatically",
              "You can add a full incident report now or later",
              "Notified contacts will follow up with you",
            ].map((item, i) => (
              <li key={i} style={{
                display: "flex", gap: 8,
                fontSize: ".84rem", color: "rgba(255,255,255,.55)", lineHeight: 1.5,
              }}>
                <span style={{ color: C.sage, flexShrink: 0 }}>→</span> {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Fixed bottom */}
      <div style={{
        position: "fixed", bottom: 58, left: 0, right: 0,
        padding: "16px 20px",
        background: "rgba(8,15,12,.9)", backdropFilter: "blur(12px)",
        borderTop: "1px solid rgba(255,255,255,.07)",
        display: "flex", flexDirection: "column", gap: 10,
        maxWidth: 460, margin: "0 auto",
      }}>
        <button className="done-btn" onClick={onDone} style={{
          width: "100%", padding: "15px",
          background: C.sage, color: C.white,
          border: "none", borderRadius: 10,
          fontFamily: "'DM Sans', sans-serif",
          fontSize: ".95rem", fontWeight: 700, cursor: "pointer", transition: "all .15s",
        }}>Done — go to home screen</button>
        <button className="record-btn" onClick={onViewRecord} style={{
          width: "100%", padding: "12px",
          background: "none", color: "rgba(255,255,255,.45)",
          border: "1px solid rgba(255,255,255,.1)", borderRadius: 10,
          fontFamily: "'DM Sans', sans-serif", fontSize: ".85rem",
          cursor: "pointer", transition: "background .15s",
        }}>View triage record →</button>
      </div>
    </div>
  );
}


// ════════════════════════════════════════════════════════════════════════════
// S0e — Triage Record
// ════════════════════════════════════════════════════════════════════════════
export function S0eTriageRecord({
  record = {
    id:           "TRG-2024-0041",
    timestamp:    new Date(),
    responder:    "Responder",
    site:         "Moriah",
    outcome:      "triage",
    triageCallMade: false,
    stepsCompleted: ["Called triage line", "Stayed with person"],
    notified:     ["Site Manager"],
    linkedReportId: null,
  },
  onFileReport,   // () => void → Flow 2 pre-populated
  onDone,
  onHome,
}) {
  const sev     = OUTCOME_SEVERITY[record.outcome] ?? OUTCOME_SEVERITY["secure"];
  const timeStr = record.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const dateStr = record.timestamp.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });

  const fields = [
    { label: "Record ID",       value: record.id },
    { label: "Date & time",     value: `${dateStr} at ${timeStr}` },
    { label: "Initiated by",    value: record.responder },
    { label: "Site",            value: record.site },
    { label: "Outcome",         value: `${sev.emoji} ${sev.label}` },
    { label: "Triage call made", value: record.triageCallMade ? "Yes" : "No" },
    { label: "Notified",        value: record.notified.join(", ") || "None" },
  ];

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #0D1F17 0%, #080F0C 100%)",
      fontFamily: "'DM Sans', sans-serif",
      display: "flex", flexDirection: "column",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .a0 { animation: fadeUp .25s ease .0s both; }
        .a1 { animation: fadeUp .25s ease .1s both; }
        .a2 { animation: fadeUp .25s ease .2s both; }
        .report-btn:hover { background: ${C.pine} !important; }
        .done-btn:hover { background: rgba(255,255,255,.1) !important; }
      `}</style>

      <EHSHeader onHome={onHome ?? onDone} dark rightContent={
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: ".72rem", color: "rgba(255,255,255,.35)", letterSpacing: ".06em" }}>{record.id}</div>
      } />

      {/* Top bar */}
      <div style={{ padding: "16px 20px", display: "flex", alignItems: "center" }}>
        <button onClick={onDone} style={{
          background: "none", border: "none", color: "rgba(255,255,255,.4)",
          fontSize: ".88rem", cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
        }}>← Back</button>
      </div>

      <div style={{
        flex: 1, padding: "4px 20px 100px",
        maxWidth: 460, margin: "0 auto", width: "100%",
      }}>

        {/* Header */}
        <div className="a0" style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: "1.35rem", fontWeight: 700, color: C.white, marginBottom: 4 }}>
            Triage record
          </h1>
          <p style={{ fontSize: ".83rem", color: "rgba(255,255,255,.4)", lineHeight: 1.5 }}>
            Created automatically. This record will be linked to any incident report filed.
          </p>
        </div>

        {/* Field table */}
        <div className="a1" style={{
          background: "rgba(255,255,255,.05)",
          border: "1.5px solid rgba(255,255,255,.1)",
          borderRadius: 12, overflow: "hidden", marginBottom: 16,
        }}>
          {fields.map((f, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "flex-start",
              padding: "11px 16px",
              borderBottom: i < fields.length - 1 ? "1px solid rgba(255,255,255,.06)" : "none",
              gap: 12,
            }}>
              <div style={{ fontSize: ".72rem", fontWeight: 600, color: "rgba(255,255,255,.3)", width: 120, flexShrink: 0, paddingTop: 2, textTransform: "uppercase", letterSpacing: ".04em" }}>
                {f.label}
              </div>
              <div style={{ fontSize: ".88rem", color: C.white, flex: 1 }}>
                {f.value}
              </div>
            </div>
          ))}
        </div>

        {/* Steps taken */}
        {record.stepsCompleted?.length > 0 && (
          <div className="a2" style={{
            background: "rgba(255,255,255,.04)",
            border: "1px solid rgba(255,255,255,.08)",
            borderRadius: 10, padding: "14px 16px", marginBottom: 16,
          }}>
            <div style={{ fontSize: ".7rem", fontWeight: 600, letterSpacing: ".07em", textTransform: "uppercase", color: "rgba(255,255,255,.3)", marginBottom: 10 }}>
              Steps marked complete
            </div>
            {record.stepsCompleted.map((s, i) => (
              <div key={i} style={{
                display: "flex", gap: 8, fontSize: ".85rem",
                color: "rgba(255,255,255,.5)", marginBottom: 6, alignItems: "flex-start",
              }}>
                <span style={{ color: C.sage, flexShrink: 0 }}>✓</span> {s}
              </div>
            ))}
          </div>
        )}

        {/* Linked report */}
        <div className="a2" style={{
          padding: "12px 16px",
          background: record.linkedReportId ? "rgba(74,140,92,.1)" : "rgba(255,255,255,.04)",
          border: `1px solid ${record.linkedReportId ? "rgba(74,140,92,.2)" : "rgba(255,255,255,.08)"}`,
          borderRadius: 10, marginBottom: 8,
        }}>
          <div style={{ fontSize: ".72rem", fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: "rgba(255,255,255,.3)", marginBottom: 4 }}>
            Linked incident report
          </div>
          <div style={{ fontSize: ".88rem", color: record.linkedReportId ? C.mint : "rgba(255,255,255,.3)" }}>
            {record.linkedReportId ?? "No report filed yet"}
          </div>
        </div>
      </div>

      {/* Fixed bottom */}
      <div style={{
        position: "fixed", bottom: 58, left: 0, right: 0,
        padding: "16px 20px",
        background: "rgba(8,15,12,.9)", backdropFilter: "blur(12px)",
        borderTop: "1px solid rgba(255,255,255,.07)",
        display: "flex", flexDirection: "column", gap: 10,
        maxWidth: 460, margin: "0 auto",
      }}>
        {!record.linkedReportId && (
          <button className="report-btn" onClick={onFileReport} style={{
            width: "100%", padding: "15px",
            background: C.sage, color: C.white,
            border: "none", borderRadius: 10,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: ".95rem", fontWeight: 700, cursor: "pointer", transition: "all .15s",
          }}>File incident report →</button>
        )}
        <button className="done-btn" onClick={onDone} style={{
          width: "100%", padding: "12px",
          background: "none", color: "rgba(255,255,255,.4)",
          border: "1px solid rgba(255,255,255,.1)", borderRadius: 10,
          fontFamily: "'DM Sans', sans-serif", fontSize: ".85rem",
          cursor: "pointer", transition: "background .15s",
        }}>Done</button>
      </div>
    </div>
  );
}
