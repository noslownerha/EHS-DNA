import { useState } from "react";
import { BRAND, COLORS as C, FONTS } from "./constants.js";
import Icon, { Logo } from "./Icon.jsx";
import { api } from "./api.js";

// Light form fields on a white card (the page used to be dark-on-dark).
const inputStyle = {
  width: "100%", height: 50, padding: "0 14px", borderRadius: 12,
  border: `1.5px solid ${C.field}`, background: C.white, color: C.ink,
  fontFamily: FONTS.body, fontSize: "1rem", outline: "none",
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

  // Inline "forgot password" (replaces window.prompt + alert pop-ups).
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotBusy, setForgotBusy] = useState(false);
  async function handleForgot(e) {
    e.preventDefault();
    setForgotBusy(true);
    try { await api.forgotPassword(forgotEmail); } catch { /* same answer either way: never reveal whether an account exists */ }
    setForgotBusy(false); setForgotSent(true);
  }

  const isStaging = /^staging\./.test(window.location.hostname);
  const primaryBtn = busyFlag => ({
    width: "100%", height: 52, marginTop: 4, border: "none", borderRadius: 12,
    background: busyFlag ? C.mist : C.sage, color: "#fff", cursor: busyFlag ? "default" : "pointer",
    fontFamily: FONTS.display, fontSize: "1.05rem", fontWeight: 700,
  });
  const linkBtn = { background: "none", border: "none", color: C.sage, fontWeight: 600, fontSize: ".9rem", cursor: "pointer", fontFamily: FONTS.body, padding: 6 };
  const errBox = msg => msg && (
    <div role="alert" style={{ fontSize: ".88rem", color: C.red, background: C.redLt, border: `1px solid ${C.red}`, borderRadius: 10, padding: "10px 12px" }}>{msg}</div>
  );
  const heading = t => <h2 style={{ margin: "0 0 4px", fontFamily: FONTS.display, fontSize: "1.6rem", fontWeight: 700, color: C.ink }}>{t}</h2>;
  const sub = t => <p style={{ margin: "0 0 20px", fontSize: ".95rem", color: C.slate, lineHeight: 1.5 }}>{t}</p>;

  let panel;
  if (resetToken && resetDone) {
    panel = (<>
      {heading("Password updated")}
      {sub("Your password has been changed. Sign in with your new password.")}
      <button type="button" onClick={backToSignIn} style={primaryBtn(false)}>Back to sign in →</button>
    </>);
  } else if (resetToken) {
    panel = (<>
      {heading("Set a new password")}
      {sub("Choose a password with at least 8 characters.")}
      <form onSubmit={handleResetSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label className="sr-only" htmlFor="reset-pw">New password</label>
        <input id="reset-pw" type="password" required autoComplete="new-password" placeholder="New password (8+ characters)"
               value={resetPw} onChange={e => setResetPw(e.target.value)} style={inputStyle} />
        <label className="sr-only" htmlFor="reset-pw2">Confirm new password</label>
        <input id="reset-pw2" type="password" required autoComplete="new-password" placeholder="Confirm new password"
               value={resetPw2} onChange={e => setResetPw2(e.target.value)} style={inputStyle} />
        {errBox(resetErr)}
        <button type="submit" disabled={resetBusy} style={primaryBtn(resetBusy)}>{resetBusy ? "Saving…" : "Set new password →"}</button>
      </form>
      <div style={{ marginTop: 14, textAlign: "center" }}><button type="button" onClick={backToSignIn} style={linkBtn}>← Back to sign in</button></div>
    </>);
  } else if (forgotOpen) {
    panel = forgotSent ? (<>
      {heading("Check your email")}
      {sub(`If an account exists for ${forgotEmail}, we've sent a link to reset the password. It works for 1 hour — check spam if it doesn't arrive.`)}
      <button type="button" onClick={() => { setForgotOpen(false); setForgotSent(false); }} style={primaryBtn(false)}>Back to sign in</button>
    </>) : (<>
      {heading("Reset your password")}
      {sub("Enter the email you sign in with and we'll send you a reset link.")}
      <form onSubmit={handleForgot} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label className="sr-only" htmlFor="forgot-email">Email</label>
        <input id="forgot-email" type="email" required autoComplete="email" placeholder="Email" value={forgotEmail}
               onChange={e => setForgotEmail(e.target.value)} style={inputStyle} />
        <button type="submit" disabled={forgotBusy} style={primaryBtn(forgotBusy)}>{forgotBusy ? "Sending…" : "Send reset link"}</button>
      </form>
      <div style={{ marginTop: 14, textAlign: "center" }}><button type="button" onClick={() => setForgotOpen(false)} style={linkBtn}>← Back to sign in</button></div>
    </>);
  } else {
    panel = (<>
      {heading("Sign in")}
      {sub("Welcome back. Use the email your administrator set up for you.")}
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label className="sr-only" htmlFor="signin-email">Email</label>
        <input id="signin-email" type="email" required autoComplete="email" placeholder="Email"
               value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
        <div style={{ position: "relative" }}>
          <label className="sr-only" htmlFor="signin-pw">Password</label>
          <input id="signin-pw" type={showPw ? "text" : "password"} required autoComplete="current-password" placeholder="Password"
                 value={password} onChange={e => setPassword(e.target.value)} style={{ ...inputStyle, paddingRight: 84 }} />
          <button type="button" onClick={() => setShowPw(v => !v)} aria-label={showPw ? "Hide password" : "Show password"}
                  style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", ...linkBtn, fontSize: ".82rem" }}>
            {showPw ? "Hide" : "Show"}
          </button>
        </div>
        {errBox(error)}
        <button type="submit" disabled={busy} style={primaryBtn(busy)}>{busy ? "Signing in…" : "Sign in →"}</button>
      </form>
      <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button type="button" onClick={() => { setForgotEmail(email); setForgotOpen(true); }} style={linkBtn}>Forgot password?</button>
        <span style={{ fontSize: ".8rem", color: C.slate }}>Access is set up by your administrator</span>
      </div>
    </>);
  }

  const points = [
    ["flag", "Report a hazard or injury in under a minute, from any phone"],
    ["check", "Inspections, findings and corrective actions in one place"],
    ["cap", "Training and certificates that track themselves"],
  ];
  return (
    <div className="signin-root" style={{ minHeight: "100dvh", background: C.chalk, fontFamily: FONTS.body, color: C.ink }}>
      {isStaging && (
        <div role="note" aria-label="Staging environment" style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 400,
          background: "#E8871E", color: "#fff", textAlign: "center", fontSize: ".72rem", fontWeight: 700, letterSpacing: ".06em", padding: "3px 8px" }}>
          STAGING — test copy, not the live app
        </div>
      )}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
        .signin-root { display: flex; flex-direction: column; }
        .signin-brand { background: ${C.forest}; color: #fff; padding: 28px 24px 30px; }
        .signin-points { display: none; }
        .signin-h1 { font-size: 1.45rem; }
        .signin-form { flex: 1; display: flex; justify-content: center; align-items: flex-start; padding: 24px 20px 40px; }
        input:focus-visible, button:focus-visible { outline: 3px solid ${C.sage}; outline-offset: 2px; box-shadow: 0 0 0 5px #fff; }
        @media (min-width: 900px) {
          .signin-root { flex-direction: row; }
          .signin-brand { width: 44%; max-width: 560px; padding: 56px 52px; display: flex; flex-direction: column; justify-content: space-between; }
          .signin-points { display: flex; }
          .signin-h1 { font-size: 2.1rem; }
          .signin-form { align-items: center; padding: 40px; }
        }
      `}</style>

      <aside className="signin-brand">
        <div>
          <Logo size={40} />
          <h1 className="signin-h1" style={{ margin: "18px 0 6px", fontFamily: FONTS.display, fontWeight: 700, lineHeight: 1.15, letterSpacing: "-0.02em" }}>
            Keeping the right eyes on what matters.
          </h1>
          <p style={{ margin: 0, fontSize: "1rem", color: "rgba(255,255,255,.82)", lineHeight: 1.5, maxWidth: 420 }}>
            Safety management for manufacturers — on the floor, on the phone, and in the boardroom.
          </p>
        </div>
        <ul className="signin-points" style={{ listStyle: "none", padding: 0, margin: "36px 0 0", flexDirection: "column", gap: 16 }}>
          {points.map(([icon, text]) => (
            <li key={icon} style={{ display: "flex", alignItems: "center", gap: 14, fontSize: ".98rem", color: "rgba(255,255,255,.9)" }}>
              <span style={{ width: 40, height: 40, borderRadius: 11, background: "rgba(127,209,195,.16)", color: C.mint, display: "flex",
                             alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name={icon} size={20} /></span>
              {text}
            </li>
          ))}
        </ul>
      </aside>

      <main className="signin-form">
        <div style={{ width: "100%", maxWidth: 420, background: C.white, border: `1px solid ${C.line}`, borderRadius: 18, padding: "28px 24px",
                      boxShadow: "0 8px 30px rgba(21,33,43,.06)" }}>
          {panel}
        </div>
      </main>
    </div>
  );
}
