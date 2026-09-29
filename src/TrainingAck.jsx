// In-person training is acknowledged by the trainee and CONFIRMED by a
// trainer/manager — only the confirmation creates the completion record.
import { useState, useEffect } from "react";
import { COLORS } from "./constants.js";
import { api } from "./api.js";

const C = COLORS;
const btn = (bg, color = "#fff") => ({
  padding: "11px 16px", borderRadius: 9, border: "none", background: bg, color,
  fontFamily: "'DM Sans', sans-serif", fontSize: ".9rem", fontWeight: 700, cursor: "pointer",
});
const fmt = d => d ? new Date(d.replace(" ", "T") + (d.includes("Z") ? "" : "Z")).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : "";

// ── Trainee: "I received this training" ────────────────────────────────────
export function TrainingAcknowledge({ training, onBack }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ack, setAck] = useState(training?.ack ?? null);
  const pending = ack?.status === "pending";
  const declined = ack?.status === "declined";

  function submit() {
    setBusy(true); setErr("");
    api.acknowledgeTraining(training.id, note.trim() || null)
      .then(a => { setAck(a); setNote(""); })
      .catch(e => setErr(e.message || "Not sent — check your connection and try again."))
      .finally(() => setBusy(false));
  }

  return (
    <div style={{ minHeight: "100vh", background: C.chalk ?? "#F4F7F6", fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "22px 18px 120px" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.pine, fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: 14 }}>← My training</button>
        <div style={{ fontSize: ".72rem", fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: C.sage }}>👥 In-person training</div>
        <h1 style={{ fontSize: "1.3rem", color: C.ink, margin: "4px 0 10px" }}>{training?.title}</h1>
        <p style={{ fontSize: ".9rem", color: C.slate, lineHeight: 1.5, margin: "0 0 18px" }}>
          This course is delivered in person. After you've attended, let your trainer know here —
          <strong> it counts as complete once your trainer or manager confirms it.</strong>
        </p>

        {pending && (
          <div style={{ background: "#FDF0D5", borderRadius: 10, padding: "14px 16px", marginBottom: 16, color: "#7A5A00" }}>
            <div style={{ fontWeight: 700 }}>⏳ Waiting for your trainer to confirm</div>
            <div style={{ fontSize: ".82rem", marginTop: 3 }}>You told them on {fmt(ack.acknowledged_at)}. Nothing else to do — you'll get a notification.</div>
          </div>
        )}
        {declined && (
          <div style={{ background: "#FEF3F2", borderRadius: 10, padding: "14px 16px", marginBottom: 16, color: "#B42318" }}>
            <div style={{ fontWeight: 700 }}>Not confirmed yet</div>
            {ack.decision_note && <div style={{ fontSize: ".85rem", marginTop: 3 }}>Your trainer said: “{ack.decision_note}”</div>}
            <div style={{ fontSize: ".8rem", marginTop: 6 }}>Once that's sorted, send it again below.</div>
          </div>
        )}

        {!pending && (
          <>
            <label style={{ fontSize: ".75rem", fontWeight: 600, color: C.mist, display: "block", marginBottom: 6 }}>
              Who trained you, and when? (optional)
            </label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="e.g. Jordan, Tuesday's forklift session"
              style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 9, border: "1.5px solid #D0DEDB",
                       fontFamily: "'DM Sans', sans-serif", fontSize: ".9rem", marginBottom: 14, resize: "vertical" }} />
            <button disabled={busy} onClick={submit} style={{ ...btn(busy ? "#B0C8BA" : C.sage), width: "100%" }}>
              {busy ? "Sending…" : declined ? "Send again" : "✋ I received this training"}
            </button>
          </>
        )}
        {err && <div role="alert" style={{ color: "#B42318", fontWeight: 600, fontSize: ".85rem", marginTop: 12 }}>⚠ {err}</div>}
      </div>
    </div>
  );
}

// ── Trainer / manager: confirmations waiting on them ───────────────────────
export function PendingConfirmations() {
  const [rows, setRows] = useState(null);
  const [declining, setDeclining] = useState(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState("");
  const load = () => api.pendingTrainingAcks().then(setRows).catch(() => setRows([]));
  useEffect(() => { load(); }, []);
  if (!rows || rows.length === 0) return null;

  function decide(a, confirm) {
    setBusy(a.id); setErr("");
    (confirm ? api.confirmTrainingAck(a.id) : api.declineTrainingAck(a.id, reason.trim()))
      .then(() => { setRows(r => r.filter(x => x.id !== a.id)); setDeclining(null); setReason(""); })
      .catch(e => { setErr(e.message); load(); })
      .finally(() => setBusy(null));
  }

  return (
    <div style={{ maxWidth: 900, margin: "14px auto 0", padding: "0 16px" }}>
      <div style={{ background: "#FFFBF2", border: "1px solid #F0D9AE", borderRadius: 12, padding: "14px 16px" }}>
        <div style={{ fontWeight: 700, color: C.ink, fontSize: ".95rem" }}>✋ Waiting for your confirmation ({rows.length})</div>
        <div style={{ fontSize: ".78rem", color: C.mist, marginBottom: 8 }}>
          These people say they received in-person training. Confirming records it as complete.
        </div>
        {err && <div role="alert" style={{ color: "#B42318", fontWeight: 600, fontSize: ".8rem", marginBottom: 6 }}>⚠ {err}</div>}
        {rows.map(a => (
          <div key={a.id} style={{ padding: "10px 0", borderTop: "1px solid #F3E6C9" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: C.ink, fontSize: ".9rem" }}>{a.user_name} — {a.training_title}</div>
                <div style={{ fontSize: ".76rem", color: C.mist }}>
                  {[a.site_name, `said so ${fmt(a.acknowledged_at)}`].filter(Boolean).join(" · ")}
                  {a.note && <> · “{a.note}”</>}
                </div>
              </div>
              {declining !== a.id && (
                <div style={{ display: "flex", gap: 6 }}>
                  <button disabled={busy === a.id} onClick={() => decide(a, true)} style={{ ...btn(C.sage), padding: "8px 13px", fontSize: ".82rem" }}>
                    {busy === a.id ? "…" : "Confirm"}
                  </button>
                  <button onClick={() => { setDeclining(a.id); setReason(""); }} style={{ ...btn("#fff", C.slate), padding: "8px 11px", fontSize: ".82rem", border: "1px solid #D0DEDB" }}>Not yet</button>
                </div>
              )}
            </div>
            {declining === a.id && (
              <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Why? They'll see this, e.g. 'Missed the hands-on part — join Thursday's session'"
                  style={{ padding: "9px 11px", borderRadius: 8, border: "1.5px solid #D0DEDB", fontFamily: "'DM Sans', sans-serif", fontSize: ".85rem" }} />
                <div style={{ display: "flex", gap: 6 }}>
                  <button disabled={!reason.trim() || busy === a.id} onClick={() => decide(a, false)}
                    style={{ ...btn(reason.trim() ? "#B42318" : "#E8B4AE"), padding: "8px 13px", fontSize: ".82rem" }}>Send "not yet"</button>
                  <button onClick={() => setDeclining(null)} style={{ ...btn("#fff", C.slate), padding: "8px 11px", fontSize: ".82rem", border: "1px solid #D0DEDB" }}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
