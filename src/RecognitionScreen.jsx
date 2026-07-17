import { useState, useEffect } from "react";
import { COLORS as C } from "./constants.js";
import { api } from "./api.js";
import { EHSHeader } from "./AppShell.jsx";

const REASON_LABEL = {
  report_reviewed: "Report reviewed",
  idea: "Shared an idea",
  kudos_given: "Recognised a colleague",
  kudos_received: "Got a shout-out",
  training: "Completed training",
  manual: "Recognition",
};
const REASON_ICON = {
  report_reviewed: "📋", idea: "💡", kudos_given: "🙌", kudos_received: "👏", training: "🎓", manual: "⭐",
};

export default function RecognitionScreen({ onHome, currentUserName }) {
  const [me, setMe] = useState(null);
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.myPoints().catch(() => null), api.leaderboard().catch(() => null)])
      .then(([m, b]) => { setMe(m); setBoard(b); })
      .finally(() => setLoading(false));
  }, []);

  const monthName = new Date().toLocaleString(undefined, { month: "long" });

  return (
    <div style={{ minHeight: "100vh", background: C.chalk, fontFamily: "'DM Sans', sans-serif" }}>
      <EHSHeader onHome={onHome} title="Recognition" />

      <div style={{ padding: "16px 20px 100px", maxWidth: 560, margin: "0 auto" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: C.mist }}>Loading…</div>
        ) : (
          <>
            {/* Hero: my points + monthly standing */}
            <div style={{ background: `linear-gradient(135deg, ${C.forest}, ${C.pine})`, borderRadius: 16, padding: "22px 20px", color: "#fff", marginBottom: 16 }}>
              <div style={{ fontSize: ".8rem", opacity: .85 }}>Your safety points</div>
              <div style={{ fontSize: "2.6rem", fontWeight: 800, lineHeight: 1.1, marginTop: 2 }}>{me?.confirmed ?? 0}</div>
              <div style={{ display: "flex", gap: 20, marginTop: 14 }}>
                <div>
                  <div style={{ fontSize: "1.2rem", fontWeight: 700 }}>{me?.thisMonth ?? 0}</div>
                  <div style={{ fontSize: ".72rem", opacity: .8 }}>{monthName}</div>
                </div>
                {board?.me?.rank && (
                  <div>
                    <div style={{ fontSize: "1.2rem", fontWeight: 700 }}>#{board.me.rank}</div>
                    <div style={{ fontSize: ".72rem", opacity: .8 }}>this month</div>
                  </div>
                )}
                {me?.pending > 0 && (
                  <div>
                    <div style={{ fontSize: "1.2rem", fontWeight: 700 }}>{me.pending}</div>
                    <div style={{ fontSize: ".72rem", opacity: .8 }}>pending review</div>
                  </div>
                )}
              </div>
            </div>

            {/* Leaderboard — top performers this month (no shame list; only top-N shown) */}
            <div style={{ background: "#fff", borderRadius: 14, padding: "16px 18px", marginBottom: 16, boxShadow: "0 1px 8px rgba(15,31,23,.06)" }}>
              <div style={{ fontSize: ".95rem", fontWeight: 700, color: C.ink, marginBottom: 4 }}>🏆 {monthName} leaders</div>
              <div style={{ fontSize: ".74rem", color: C.mist, marginBottom: 12 }}>Points reset at the start of each month — everyone gets a fresh shot.</div>
              {(!board?.top || board.top.length === 0) ? (
                <div style={{ fontSize: ".85rem", color: C.mist, padding: "8px 0" }}>No points yet this month. Be the first — flag something or give a teammate a shout-out.</div>
              ) : board.top.map(row => (
                <div key={row.rank} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "9px 10px", borderRadius: 9, marginBottom: 4,
                  background: row.isMe ? C.foam : "transparent",
                }}>
                  <div style={{ width: 26, textAlign: "center", fontWeight: 800, fontSize: ".9rem",
                    color: row.rank === 1 ? "#C8922A" : row.rank === 2 ? "#7C8B99" : row.rank === 3 ? "#B06B3F" : C.mist }}>
                    {row.rank <= 3 ? ["🥇", "🥈", "🥉"][row.rank - 1] : row.rank}
                  </div>
                  <div style={{ flex: 1, fontSize: ".9rem", fontWeight: row.isMe ? 700 : 500, color: C.ink }}>
                    {row.name}{row.isMe && <span style={{ color: C.sage, fontWeight: 600 }}> · you</span>}
                  </div>
                  <div style={{ fontSize: ".92rem", fontWeight: 700, color: C.pine }}>{row.points}</div>
                </div>
              ))}
              {/* If I'm not in the top-N, show my own standing so I'm never "ranked last" publicly */}
              {board?.me?.rank && !board.top.some(r => r.isMe) && (
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 10px", borderRadius: 9, marginTop: 6, background: C.foam, borderTop: `1px dashed ${C.line ?? "#E2EBE6"}` }}>
                  <div style={{ width: 26, textAlign: "center", fontWeight: 800, fontSize: ".85rem", color: C.mist }}>#{board.me.rank}</div>
                  <div style={{ flex: 1, fontSize: ".9rem", fontWeight: 700, color: C.ink }}>You</div>
                  <div style={{ fontSize: ".92rem", fontWeight: 700, color: C.pine }}>{board.me.points}</div>
                </div>
              )}
            </div>

            {/* How to earn — sets expectations, nudges the right behaviours */}
            <div style={{ background: "#fff", borderRadius: 14, padding: "16px 18px", marginBottom: 16, boxShadow: "0 1px 8px rgba(15,31,23,.06)" }}>
              <div style={{ fontSize: ".95rem", fontWeight: 700, color: C.ink, marginBottom: 10 }}>Ways to earn</div>
              {[
                ["👏", "Catch a teammate doing it right", "Give a shout-out"],
                ["⚠️", "Flag a hazard or near miss", "Confirmed when reviewed"],
                ["💡", "Share a safety idea", "Best value"],
                ["🎓", "Finish assigned training", ""],
              ].map(([ic, label, note], i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
                  <span style={{ fontSize: "1.1rem", width: 22, textAlign: "center" }}>{ic}</span>
                  <span style={{ flex: 1, fontSize: ".86rem", color: C.ink }}>{label}</span>
                  {note && <span style={{ fontSize: ".72rem", color: C.mist }}>{note}</span>}
                </div>
              ))}
            </div>

            {/* Recent activity */}
            {me?.recent?.length > 0 && (
              <div style={{ background: "#fff", borderRadius: 14, padding: "16px 18px", boxShadow: "0 1px 8px rgba(15,31,23,.06)" }}>
                <div style={{ fontSize: ".95rem", fontWeight: 700, color: C.ink, marginBottom: 10 }}>Your recent activity</div>
                {me.recent.map((r, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: i < me.recent.length - 1 ? `1px solid ${C.foam}` : "none" }}>
                    <span style={{ fontSize: "1rem", width: 22, textAlign: "center" }}>{REASON_ICON[r.reason] ?? "⭐"}</span>
                    <span style={{ flex: 1, fontSize: ".85rem", color: C.ink }}>{REASON_LABEL[r.reason] ?? r.reason}</span>
                    <span style={{ fontSize: ".85rem", fontWeight: 700, color: C.sage }}>+{r.points}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
