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

// "2026-06" → "June". Used for the champion banner heading.
function lastMonthName(period) {
  if (!period) return "Last month";
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString(undefined, { month: "long" });
}

export default function RecognitionScreen({ onHome, currentUserName }) {
  const [me, setMe] = useState(null);
  const [board, setBoard] = useState(null);
  const [champ, setChamp] = useState(null);
  const [badgeData, setBadgeData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.myPoints().catch(() => null),
      api.leaderboard().catch(() => null),
      api.champion().catch(() => null),
      api.myBadges().catch(() => null),
    ])
      .then(([m, b, c, bd]) => { setMe(m); setBoard(b); setChamp(c); setBadgeData(bd); })
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

            {/* Last month's champion — the "reset ceremony". Celebrates the winner
                of the month just ended so the contest has a real finish line. */}
            {champ?.champion && (
              <div style={{ background: `linear-gradient(135deg, ${C.gold}, #E0A93A)`, borderRadius: 14, padding: "16px 18px", marginBottom: 16, color: "#fff", boxShadow: "0 2px 10px rgba(200,146,42,.25)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ fontSize: "2.2rem", lineHeight: 1 }}>🏆</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: ".72rem", opacity: .9, textTransform: "uppercase", letterSpacing: ".05em", fontWeight: 700 }}>
                      {lastMonthName(champ.period)} Champion
                    </div>
                    <div style={{ fontSize: "1.2rem", fontWeight: 800, marginTop: 1 }}>
                      {champ.champion.isMe ? "You! 🎉" : champ.champion.name}
                    </div>
                    <div style={{ fontSize: ".76rem", opacity: .9 }}>{champ.champion.points} points</div>
                  </div>
                </div>
              </div>
            )}

            {/* Badges — persistent achievements anyone can earn (anti-shame). */}
            {badgeData?.badges && (
              <div style={{ background: "#fff", borderRadius: 14, padding: "16px 18px", marginBottom: 16, boxShadow: "0 1px 8px rgba(15,31,23,.06)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <div style={{ fontSize: ".95rem", fontWeight: 700, color: C.ink }}>🎖 Your badges</div>
                  <div style={{ fontSize: ".78rem", color: C.mist }}>
                    {badgeData.earnedCount}/{badgeData.total}{badgeData.streak >= 2 ? ` · 🔥 ${badgeData.streak}mo streak` : ""}
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))", gap: 8, marginTop: 12 }}>
                  {badgeData.badges.map(b => (
                    <div key={b.id} title={b.desc} style={{
                      textAlign: "center", padding: "10px 4px", borderRadius: 10,
                      background: b.earned ? C.foam : "#F4F6F5",
                      opacity: b.earned ? 1 : .45, filter: b.earned ? "none" : "grayscale(1)",
                    }}>
                      <div style={{ fontSize: "1.5rem", lineHeight: 1.1 }}>{b.icon}</div>
                      <div style={{ fontSize: ".62rem", fontWeight: 600, color: C.ink, marginTop: 3, lineHeight: 1.2 }}>{b.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
