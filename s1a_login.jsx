import { useState } from "react";

// ── Design tokens (matching wireframe exactly) ──────────────────────────────
const C = {
  forest:  "#1C3A2A",
  pine:    "#2D5A3D",
  sage:    "#4A8C5C",
  mint:    "#A8D5B5",
  foam:    "#E8F5EC",
  ink:     "#0F1F17",
  slate:   "#4A5568",
  mist:    "#8FA3A0",
  chalk:   "#F4F7F5",
  white:   "#FFFFFF",
  gold:    "#C8922A",
  goldLt:  "#FDF3E3",
  red:     "#C0392B",
  redLt:   "#FDECEA",
};

// ── Reusable micro-components ───────────────────────────────────────────────
function Label({ children }) {
  return (
    <div style={{
      fontSize: ".72rem", fontWeight: 600,
      letterSpacing: ".07em", textTransform: "uppercase",
      color: C.sage, marginBottom: 6,
      fontFamily: "'DM Sans', sans-serif",
    }}>
      {children}
    </div>
  );
}

function TextInput({ type = "text", value, onChange, placeholder, style = {} }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width: "100%",
        padding: "10px 14px",
        border: `1.5px solid ${focused ? C.sage : "#D0DEDB"}`,
        borderRadius: 7,
        fontFamily: "'DM Sans', sans-serif",
        fontSize: ".9rem",
        color: C.ink,
        background: C.white,
        outline: "none",
        boxShadow: focused ? `0 0 0 3px rgba(74,140,92,.12)` : "none",
        transition: "all .18s cubic-bezier(.4,0,.2,1)",
        ...style,
      }}
    />
  );
}

function Divider() {
  return <div style={{ height: 1, background: "#E8EFec", margin: "20px 0" }} />;
}

// ── Main component ──────────────────────────────────────────────────────────
export default function S1aLogin({ onSignIn, onStartSetup }) {
  const [email, setEmail] = useState("ahren@whistlepigwhiskey.com");
  const [password, setPassword] = useState("••••••••••••");
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState("login"); // "login" | "forgot"
  const [forgotSent, setForgotSent] = useState(false);

  function handleSignIn() {
    if (!email.trim()) { setError("Please enter your email."); return; }
    if (!password.trim()) { setError("Please enter your password."); return; }
    setError("");
    setLoading(true);
    // Simulate async auth — replace with real call
    setTimeout(() => {
      setLoading(false);
      if (onSignIn) onSignIn({ email, keepSignedIn });
    }, 900);
  }

  function handleForgot() {
    if (!email.trim()) { setError("Enter your email above first."); return; }
    setError("");
    setLoading(true);
    setTimeout(() => { setLoading(false); setForgotSent(true); }, 800);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") mode === "login" ? handleSignIn() : handleForgot();
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: C.chalk,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px 16px 80px",
      fontFamily: "'DM Sans', sans-serif",
    }}>
      {/* Google Font load */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input::placeholder { color: ${C.mist}; }
        a { cursor: pointer; }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .card-anim { animation: fadeUp .32s cubic-bezier(.4,0,.2,1) both; }
        .btn-hover:hover {
          background: ${C.pine} !important;
          transform: translateY(-1px);
          box-shadow: 0 4px 14px rgba(45,90,61,.3);
        }
        .btn-hover:active { transform: translateY(0); }
        .link-hover { transition: color .15s; }
        .link-hover:hover { color: ${C.pine} !important; }
        .checkbox-label:hover { color: ${C.pine} !important; }
      `}</style>

      {/* ── Logo ── */}
      <div className="card-anim" style={{ textAlign: "center", marginBottom: 32, animationDelay: "0ms" }}>
        <div style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: "1.7rem",
          fontWeight: 500,
          color: C.forest,
          letterSpacing: ".04em",
        }}>
          <span style={{ color: C.sage }}>EHS</span>platform
        </div>
        <p style={{ fontSize: ".85rem", color: C.mist, marginTop: 6 }}>
          Safety &amp; Operations Management
        </p>
      </div>

      {/* ── Card ── */}
      <div
        className="card-anim"
        style={{
          width: "100%",
          maxWidth: 460,
          background: C.white,
          borderRadius: 10,
          boxShadow: "0 2px 16px rgba(15,31,23,.08)",
          overflow: "hidden",
          animationDelay: "60ms",
        }}
      >
        <div style={{ padding: 28 }}>

          {/* Title */}
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 600, color: C.ink }}>
              {mode === "login" ? "Welcome back" : "Reset your password"}
            </h1>
            <p style={{ fontSize: ".9rem", color: C.slate, marginTop: 4 }}>
              {mode === "login"
                ? "Sign in to your account"
                : "We'll send a reset link to your email"}
            </p>
          </div>

          {/* Error banner */}
          {error && (
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 14px",
              background: C.redLt,
              border: `1px solid #F5C6C2`,
              borderRadius: 7,
              fontSize: ".84rem",
              color: C.red,
              marginBottom: 18,
            }}>
              <span>⚠</span> {error}
            </div>
          )}

          {/* Forgot-sent confirmation */}
          {forgotSent && (
            <div style={{
              display: "flex", alignItems: "flex-start", gap: 10,
              padding: "12px 14px",
              background: C.foam,
              borderLeft: `3px solid ${C.sage}`,
              borderRadius: 7,
              fontSize: ".87rem",
              color: C.pine,
              marginBottom: 18,
              lineHeight: 1.5,
            }}>
              <span style={{ marginTop: 1 }}>✓</span>
              <span>Reset link sent to <strong>{email}</strong>. Check your inbox.</span>
            </div>
          )}

          {/* Email field */}
          <div style={{ marginBottom: 18 }}>
            <Label>Email</Label>
            <TextInput
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@yourcompany.com"
              style={{ onKeyDown: handleKeyDown }}
            />
          </div>

          {/* Password field — hidden in forgot mode */}
          {mode === "login" && (
            <div style={{ marginBottom: 18 }}>
              <Label>Password</Label>
              <div style={{ position: "relative" }}>
                <TextInput
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Your password"
                />
                <button
                  onClick={() => setShowPassword(p => !p)}
                  style={{
                    position: "absolute", right: 12, top: "50%",
                    transform: "translateY(-50%)",
                    background: "none", border: "none",
                    cursor: "pointer",
                    fontSize: ".78rem",
                    color: C.mist,
                    fontFamily: "'DM Sans', sans-serif",
                    padding: "2px 4px",
                  }}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>
          )}

          {/* Keep signed in + forgot link */}
          {mode === "login" && (
            <div style={{
              display: "flex", alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 22,
            }}>
              <label
                className="checkbox-label"
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  fontSize: ".83rem", color: C.slate,
                  cursor: "pointer", transition: "color .15s",
                }}
              >
                <input
                  type="checkbox"
                  checked={keepSignedIn}
                  onChange={e => setKeepSignedIn(e.target.checked)}
                  style={{ width: "auto", accentColor: C.sage }}
                />
                Keep me signed in
              </label>
              <span
                className="link-hover"
                onClick={() => { setMode("forgot"); setError(""); setForgotSent(false); }}
                style={{ fontSize: ".83rem", color: C.sage, textDecoration: "none" }}
              >
                Forgot password?
              </span>
            </div>
          )}

          {/* Primary CTA */}
          {mode === "login" ? (
            <button
              className="btn-hover"
              onClick={handleSignIn}
              disabled={loading}
              style={{
                width: "100%",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "11px 22px",
                background: loading ? C.sage + "99" : C.sage,
                color: C.white,
                border: "none", borderRadius: 7,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: ".88rem", fontWeight: 600,
                cursor: loading ? "default" : "pointer",
                transition: "all .18s cubic-bezier(.4,0,.2,1)",
              }}
            >
              {loading ? (
                <>
                  <span style={{
                    width: 14, height: 14,
                    border: `2px solid rgba(255,255,255,.4)`,
                    borderTopColor: C.white,
                    borderRadius: "50%",
                    display: "inline-block",
                    animation: "spin .7s linear infinite",
                  }} />
                  Signing in…
                </>
              ) : "Sign in →"}
            </button>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                className="btn-hover"
                onClick={handleForgot}
                disabled={loading || forgotSent}
                style={{
                  width: "100%",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "11px 22px",
                  background: forgotSent ? C.sage + "66" : C.sage,
                  color: C.white,
                  border: "none", borderRadius: 7,
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: ".88rem", fontWeight: 600,
                  cursor: loading || forgotSent ? "default" : "pointer",
                  transition: "all .18s cubic-bezier(.4,0,.2,1)",
                }}
              >
                {loading ? "Sending…" : forgotSent ? "Link sent ✓" : "Send reset link →"}
              </button>
              <button
                onClick={() => { setMode("login"); setError(""); setForgotSent(false); }}
                style={{
                  width: "100%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  padding: "10px 22px",
                  background: C.white,
                  color: C.pine,
                  border: `1.5px solid ${C.mint}`,
                  borderRadius: 7,
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: ".88rem", fontWeight: 600,
                  cursor: "pointer",
                  transition: "all .18s",
                }}
              >
                ← Back to sign in
              </button>
            </div>
          )}

          <Divider />

          {/* New company CTA */}
          <div style={{ textAlign: "center", fontSize: ".82rem", color: C.mist }}>
            New company?{" "}
            <span
              className="link-hover"
              onClick={onStartSetup}
              style={{
                color: C.sage, fontWeight: 600,
                textDecoration: "none", cursor: "pointer",
              }}
            >
              Start your free setup →
            </span>
          </div>
        </div>

        {/* ── Phase 2 SSO placeholder footer ── */}
        <div style={{
          padding: "12px 28px",
          background: C.chalk,
          borderTop: `1px solid #E8EFec`,
          textAlign: "center",
          fontSize: ".75rem",
          color: C.mist,
        }}>
          SSO / Google Workspace sign-in — Phase 2
        </div>
      </div>

      {/* ── UX annotation (dev/wireframe mode) ── */}
      <div
        className="card-anim"
        style={{
          width: "100%", maxWidth: 460,
          marginTop: 16,
          position: "relative",
          padding: "10px 14px 10px 36px",
          background: "#FFF8E7",
          border: "1px dashed #E8C87A",
          borderRadius: 7,
          fontSize: ".78rem",
          color: "#7A5A1A",
          lineHeight: 1.5,
          animationDelay: "120ms",
        }}
      >
        <span style={{
          position: "absolute", left: 10, top: 10, fontSize: ".85rem",
        }}>✏️</span>
        UX NOTE: First-time users land here from invite email — password already set via email flow. No separate "create account" screen needed. SSO button added here in Phase 2.
      </div>
    </div>
  );
}
