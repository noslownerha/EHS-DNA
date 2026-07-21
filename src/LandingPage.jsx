import { useState } from "react";
import { BRAND, COLORS as C } from "./constants.js";
import { api } from "./api.js";

const inputStyle = {
  width: "100%", padding: "13px 16px",
  background: "rgba(255,255,255,.06)",
  border: "1px solid rgba(168,213,181,.15)",
  borderRadius: 10, color: "#fff",
  fontSize: ".92rem", fontFamily: "'DM Sans', sans-serif",
  outline: "none", boxSizing: "border-box",
};

export default function LandingPage({ onEnter }) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  // A password-reset email link lands here as /?resetToken=... — this works
  // while fully logged out (unlike the ?open= deep-link pattern in App.jsx,
  // which only fires once a user is already authenticated).
  const [resetToken] = useState(() => new URLSearchParams(window.location.search).get("resetToken"));
  const [resetPw, setResetPw]   = useState("");
  const [resetPw2, setResetPw2] = useState("");
  const [resetDone, setResetDone] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [error, setError]       = useState(() => {
    try {
      const m = sessionStorage.getItem("ehs_suspended_msg");
      if (m) { sessionStorage.removeItem("ehs_suspended_msg"); return m; }
      const e = sessionStorage.getItem("ehs_expired_msg");
      if (e) { sessionStorage.removeItem("ehs_expired_msg"); return e; }
    } catch {}
    return null;
  });
  const [busy, setBusy]         = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const user = await api.login(email, password);
      await api.fetchConfig();
      onEnter(user);
    } catch (err) {
      // 401 is deliberately generic (don't reveal whether the email exists).
      // Any OTHER server response (429 rate-limit/lockout, 403 suspended, etc.)
      // already carries a specific, safe-to-show, actionable message — showing
      // a blanket "could not reach the server" for those buries the real reason
      // (e.g. "Account temporarily locked...") and sends people down the wrong
      // troubleshooting path. Reserve the network-failure message for when the
      // request truly never got a response (no err.status at all).
      if (err.status === 401) setError("Invalid email or password");
      else if (err.status) setError(err.message || "Something went wrong — try again");
      else setError("Could not reach the server — try again");
      setBusy(false);
    }
  }

  const [resetErr, setResetErr] = useState("");
  async function handleResetSubmit(e) {
    e.preventDefault();
    setResetErr("");
    if (resetPw.length < 8) return setResetErr("New password must be 8+ characters.");
    if (resetPw !== resetPw2) return setResetErr("Passwords don't match.");
    setResetBusy(true);
    try {
      await api.resetPassword(resetToken, resetPw);
      setResetDone(true);
    } catch (err) {
      setResetErr(err.message || "That reset link is invalid or has expired. Request a new one below.");
    } finally {
      setResetBusy(false);
    }
  }
  function backToSignIn() {
    // Clear the token from the URL so a refresh doesn't re-show the reset form.
    const params = new URLSearchParams(window.location.search);
    params.delete("resetToken");
    const qs = params.toString();
    window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
    window.location.reload();
  }

  return (
    // Bucket 1.5: use 100dvh so it fills exactly the device viewport with no scroll
    <div style={{
      height: "100dvh", minHeight: "100vh",
      background: "#0B1610",
      fontFamily: "'DM Sans', sans-serif",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "24px 24px",
      position: "relative", overflow: "hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .landing-grid::before {
          content: '';
          position: absolute; inset: 0;
          background-image: linear-gradient(rgba(74,140,92,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(74,140,92,.05) 1px, transparent 1px);
          background-size: 40px 40px; pointer-events: none;
        }
        .landing-glow::after {
          content: '';
          position: absolute; top: 30%; left: 50%; transform: translate(-50%, -50%);
          width: 500px; height: 320px;
          background: radial-gradient(ellipse, rgba(74,140,92,.1) 0%, transparent 70%);
          pointer-events: none;
        }
        @keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse-ring { 0%,100%{box-shadow:0 0 0 0 rgba(74,140,92,.3);} 70%{box-shadow:0 0 0 10px rgba(74,140,92,0);} }
        .a1 { animation: fadeUp .45s ease .05s both; }
        .a2 { animation: fadeUp .45s ease .18s both; }
        .a3 { animation: fadeUp .45s ease .3s both; }
        .a4 { animation: fadeUp .45s ease .42s both; }
        .role-btn { transition: transform .15s ease, box-shadow .15s ease; }
        .role-btn:hover { transform: translateY(-2px); }
        .role-btn:active { transform: scale(.97); }
      `}</style>

      <div className="landing-grid landing-glow" style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", alignItems: "center" }}>

        {/* Logo mark */}
        <div className="a1" style={{ marginBottom: 10 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 13,
            background: `linear-gradient(135deg, ${C.pine}, ${C.sage})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 20px rgba(74,140,92,.3)",
            animation: "pulse-ring 3s ease infinite",
          }}>
            <span style={{ fontSize: "1.25rem" }}>🧬</span>
          </div>
        </div>

        {/* Brand */}
        <div className="a1" style={{ marginBottom: 5, textAlign: "center" }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1.85rem", fontWeight: 600, letterSpacing: ".08em", color: "#fff" }}>
            <span style={{ color: C.mint }}>EHS</span> DNA
          </div>
        </div>

        {/* Tagline */}
        <div className="a2" style={{ marginBottom: 36, textAlign: "center" }}>
          <p style={{ fontSize: ".85rem", color: "rgba(255,255,255,.35)", letterSpacing: ".02em", lineHeight: 1.5 }}>
            {BRAND.tagline}
          </p>
        </div>

        {resetToken ? (
          resetDone ? (
            <>
              {/* Reset succeeded */}
              <div className="a3" style={{ marginBottom: 12, textAlign: "center", width: "100%" }}>
                <p style={{ fontSize: ".68rem", fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(255,255,255,.22)" }}>
                  Password updated
                </p>
              </div>
              <div className="a4" style={{ width: "100%", textAlign: "center" }}>
                <p style={{ fontSize: ".85rem", color: "rgba(255,255,255,.7)", lineHeight: 1.6, marginBottom: 20 }}>
                  Your password has been changed. Sign in with your new password.
                </p>
                <button type="button" onClick={backToSignIn} style={{
                  width: "100%", padding: "14px 18px", background: C.sage, border: "1px solid rgba(168,213,181,.2)",
                  borderRadius: 11, cursor: "pointer", fontSize: ".95rem", fontWeight: 700, color: "#fff",
                  fontFamily: "'DM Sans', sans-serif", boxShadow: "0 4px 16px rgba(74,140,92,.25)",
                }}>Back to sign in →</button>
              </div>
            </>
          ) : (
            <>
              {/* Set new password (landed here from an emailed reset link) */}
              <div className="a3" style={{ marginBottom: 12, textAlign: "center", width: "100%" }}>
                <p style={{ fontSize: ".68rem", fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(255,255,255,.22)" }}>
                  Set a new password
                </p>
              </div>
              <form className="a4" onSubmit={handleResetSubmit} style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
                <input
                  type="password" required autoComplete="new-password" placeholder="New password (8+ characters)"
                  value={resetPw} onChange={e => setResetPw(e.target.value)}
                  style={inputStyle}
                />
                <input
                  type="password" required autoComplete="new-password" placeholder="Confirm new password"
                  value={resetPw2} onChange={e => setResetPw2(e.target.value)}
                  style={inputStyle}
                />
                {resetErr && (
                  <div style={{ fontSize: ".78rem", color: "#F0A5A5", background: "rgba(220,80,80,.12)", border: "1px solid rgba(220,80,80,.25)", borderRadius: 8, padding: "8px 12px" }}>
                    {resetErr}
                  </div>
                )}
                <button type="submit" disabled={resetBusy} style={{
                  width: "100%", padding: "14px 18px", marginTop: 2,
                  background: resetBusy ? "rgba(74,140,92,.5)" : C.sage,
                  border: "1px solid rgba(168,213,181,.2)",
                  borderRadius: 11, cursor: resetBusy ? "default" : "pointer",
                  fontSize: ".95rem", fontWeight: 700, color: "#fff",
                  fontFamily: "'DM Sans', sans-serif",
                  boxShadow: "0 4px 16px rgba(74,140,92,.25)",
                }}>
                  {resetBusy ? "Saving…" : "Set new password →"}
                </button>
              </form>
              <div style={{ marginTop: 20, textAlign: "center" }}>
                <button type="button" onClick={backToSignIn} style={{ background: "none", border: "none", color: "rgba(168,213,181,.6)", fontSize: ".78rem", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                  ← Back to sign in
                </button>
              </div>
            </>
          )
        ) : (
        <>
        {/* Sign-in label */}
        <div className="a3" style={{ marginBottom: 12, textAlign: "center", width: "100%" }}>
          <p style={{ fontSize: ".68rem", fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(255,255,255,.22)" }}>
            Sign in
          </p>
        </div>

        {/* Login form */}
        <form className="a4" onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
          <input
            type="email" required autoComplete="email" placeholder="Email"
            value={email} onChange={e => setEmail(e.target.value)}
            style={inputStyle}
          />
          <div style={{ position: "relative" }}>
            <input
              type={showPw ? "text" : "password"} required autoComplete="current-password" placeholder="Password"
              value={password} onChange={e => setPassword(e.target.value)}
              style={{ ...inputStyle, width: "100%", paddingRight: 48 }}
            />
            <button type="button" onClick={() => setShowPw(s => !s)}
              aria-label={showPw ? "Hide password" : "Show password"} style={{
                position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer", fontSize: "1.05rem",
                color: "rgba(255,255,255,.55)", padding: 4, lineHeight: 1,
              }}>{showPw ? "🙈" : "👁️"}</button>
          </div>
          {error && (
            <div style={{ fontSize: ".78rem", color: "#F0A5A5", background: "rgba(220,80,80,.12)", border: "1px solid rgba(220,80,80,.25)", borderRadius: 8, padding: "8px 12px" }}>
              {error}
            </div>
          )}
          <button type="submit" disabled={busy} style={{
            width: "100%", padding: "14px 18px", marginTop: 2,
            background: busy ? "rgba(74,140,92,.5)" : C.sage,
            border: "1px solid rgba(168,213,181,.2)",
            borderRadius: 11, cursor: busy ? "default" : "pointer",
            fontSize: ".95rem", fontWeight: 700, color: "#fff",
            fontFamily: "'DM Sans', sans-serif",
            boxShadow: "0 4px 16px rgba(74,140,92,.25)",
          }}>
            {busy ? "Signing in…" : "Sign in →"}
          </button>
        </form>

        <div style={{ marginTop: 28, textAlign: "center" }}>
          <button type="button" onClick={async () => {
            const em = email || window.prompt("Enter your account email:");
            if (!em) return;
            try { await api.forgotPassword(em); } catch {}
            setError(null);
            alert(`If an account exists for ${em}, we've emailed a link to reset the password. Check your inbox (and spam folder) — the link is valid for 1 hour.`);
          }} style={{ background: "none", border: "none", color: "rgba(168,213,181,.6)", fontSize: ".78rem", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", marginBottom: 10 }}>
            Forgot password?
          </button>
          <p style={{ fontSize: ".67rem", color: "rgba(255,255,255,.15)", letterSpacing: ".04em", lineHeight: 1.6 }}>
            Access is provisioned by your administrator
          </p>
        </div>
        </>
        )}
      </div>
    </div>
  );
}
