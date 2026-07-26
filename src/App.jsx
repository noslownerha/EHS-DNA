import { useState, useEffect, useRef } from "react";
import { api, getToken } from "./api.js";
import { startAutoFlush } from "./offlineQueue.js";
import { ROLE_PERMS, COLORS as C } from "./constants.js";
import LandingPage                   from "./LandingPage.jsx";
import AppShell, { EHSHeader, AccountContext } from "./AppShell.jsx";
import S7aAssetDetail from "./s7a_asset_detail.jsx";
import { BRAND } from "./constants.js";
import StaffDashboard                from "./StaffDashboard.jsx";
import RecognitionScreen            from "./RecognitionScreen.jsx";

import { TriageProvider, TriageRouter }                                from "./flow0_glue.jsx";
import { IncidentProvider, IncidentRouter, INCIDENT_SCREENS }          from "./flow2_glue.jsx";
import { InspectionProvider, InspectionRouter, INSPECTION_SCREENS }    from "./flow3_glue.jsx";
import { TrainingProvider, TrainingRouter, TRAINING_SCREENS }          from "./flow4_glue.jsx";
import { DashboardProvider, DashboardRouter, DASHBOARD_SCREENS, defaultScreenForRole } from "./flow5_glue.jsx";

// Placeholder for screens not yet built
function Placeholder({ title, icon, onHome }) {
  return (
    <div style={{ minHeight: "100vh", background: C.chalk, fontFamily: "'DM Sans', sans-serif" }}>
      <EHSHeader onHome={onHome} title={title} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 48, minHeight: "60vh", gap: 14 }}>
        <span style={{ fontSize: "2.5rem" }}>{icon}</span>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: C.ink }}>{title}</h2>
        <p style={{ fontSize: ".85rem", color: "#8FA3A0", textAlign: "center", maxWidth: 280, lineHeight: 1.6 }}>
          This section is coming soon.
        </p>
      </div>
    </div>
  );
}

// ── Mobile layout wrapper ─────────────────────────────────────────────────────
// Bucket 2: wraps all flow content in single-column, no horizontal overflow,
// with correct bottom padding so fixed CTAs clear the nav bar.
function MobileFrame({ children }) {
  return (
    <div style={{
      width: "100%",
      maxWidth: "100vw",
      overflowX: "hidden",
      display: "flex",
      flexDirection: "column",
    }}>
      {children}
    </div>
  );
}

const COMPANY = BRAND.company;

import { Component } from "react";

class CrashShield extends Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div style={{ fontFamily: "'DM Sans', sans-serif", padding: 24, maxWidth: 560, margin: "40px auto" }}>
        <h2 style={{ color: "#C0392B", fontSize: "1.1rem" }}>Something went wrong on this screen</h2>
        <p style={{ fontSize: ".85rem", color: "#4A5568", margin: "10px 0" }}>
          Screenshot this and send it to support — then tap reload.
        </p>
        <pre style={{ background: C.chalk, padding: 12, borderRadius: 8, fontSize: ".7rem", whiteSpace: "pre-wrap", color: C.ink }}>
          {String(this.state.err?.message ?? this.state.err)}{"\n"}{(this.state.err?.stack ?? "").split("\n").slice(1, 5).join("\n")}
        </pre>
        <button onClick={() => window.location.reload()} style={{ marginTop: 12, padding: "10px 24px", background: C.sage, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Reload</button>
      </div>
    );
  }
}

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab,   setActiveTab]   = useState("home");
  // An operator's nav has no "home" tab, so the default would highlight nothing.
  // Send them to the worklist instead — "what needs me today" is the first
  // question, and it's the console's landing section.
  useEffect(() => {
    if (currentUser?.isOperator && !currentUser?.supportTenant) {
      setActiveTab(t => (t === "home" ? "attention" : t));
    }
  }, [currentUser?.isOperator, currentUser?.supportTenant]);
  const [assetIdView, setAssetIdView] = useState(null);
  const [pendingChecklistId, setPendingChecklistId] = useState(null);
  const [booting,     setBooting]     = useState(!!getToken());
  const [flagScreen,  setFlagScreen]  = useState(INCIDENT_SCREENS.TYPE);
  const [pickerStep,  setPickerStep]  = useState("top");

  // Drain any incident reports queued while offline (dead zones on the plant floor).
  // Safe to run always: it no-ops when the queue is empty or the device is offline.
  useEffect(() => startAutoFlush(api.createIncident), []);

  // Resume session if a valid token exists
  useEffect(() => {
    if (!getToken()) return;
    api.fetchConfig()
      .then(() => {
        const cached = sessionStorage.getItem("ehs_user");
        if (cached) setCurrentUser(JSON.parse(cached));
      })
      .catch(() => api.logout())
      .finally(() => setBooting(false));
  }, []);

  function handleEnter(user) {
    sessionStorage.setItem("ehs_user", JSON.stringify(user));
    setCurrentUser(user);
    setActiveTab("home");
  }

  function handleLogout() {
    api.logout();
    sessionStorage.removeItem("ehs_user");
    setCurrentUser(null);
  }

  function handleHome() { setActiveTab("home"); }
  useEffect(() => {
    function onDeepLink(e) {
      const { kind } = e.detail ?? {};
      if (kind === "incident") { setFlagScreen(INCIDENT_SCREENS.LIST); handleTab("flag"); }
      else if (kind === "training") handleTab("training");
      else if (kind === "finding") handleTab("inspect");
      else if (kind === "asset") { setAssetIdView(e.detail.ref); setActiveTab("asset"); }
      else handleTab("home");
    }
    window.addEventListener("ehs:navigate", onDeepLink);
    return () => window.removeEventListener("ehs:navigate", onDeepLink);
  });

  // Deep link from an email/notification: /?open=incident:INC-2026-0004 lands the
  // user on the right screen after login. Reuses the same navigate event that a
  // notification tap fires, then clears the param so a refresh doesn't re-trigger.
  useEffect(() => {
    if (!currentUser) return;
    try {
      const params = new URLSearchParams(window.location.search);
      const open = params.get("open");
      if (open) {
        const [kind, ref] = open.split(":");
        window.dispatchEvent(new CustomEvent("ehs:navigate", { detail: { kind, ref } }));
        params.delete("open");
        const qs = params.toString();
        window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
      }

    } catch { /* malformed param — ignore */ }
  }, [currentUser]);

  function handleTab(tabId) {
    if (tabId === "flag" && activeTab !== "flag") setFlagScreen(s => s); // keep deep-link
    else if (tabId === "flag") setFlagScreen(INCIDENT_SCREENS.TYPE);
    if (tabId === "flag") setPickerStep("top"); // normal Flag entry starts at top
    if (tabId === "inspect") setPendingChecklistId(null); // manual Inspect entry: fresh Start screen
    setActiveTab(tabId);
  }
  function handleNavigate(dest) { setActiveTab(dest); }

  if (booting) return null;
  if (!currentUser) return <LandingPage onEnter={handleEnter} />;
  if (currentUser.mustChangePassword) {
    return <ForcePasswordChange
      onDone={() => setCurrentUser(u => {
        const updated = { ...u, mustChangePassword: false };
        try { sessionStorage.setItem("ehs_user", JSON.stringify(updated)); } catch {}
        return updated;
      })}
      onLogout={handleLogout} />;
  }

  const perms   = ROLE_PERMS[currentUser.role] ?? ROLE_PERMS.staff;
  const userObj = { ...currentUser, name: currentUser.name ?? `${currentUser.first ?? ""} ${currentUser.last ?? ""}`.trim() };

  function renderContent() {
    switch (activeTab) {

      // ── OPERATOR (EHS DNA staff) ─────────────────────────────────────────
      // All four render the same console; the tab selects which section. Keyed
      // on activeTab so switching tabs returns from a drill-in (e.g. a single
      // tenant's billing detail) rather than stranding the user there.
      case "attention":
      case "overview":
      case "companies":
      case "billing":
        return (
          <MobileFrame>
            <DashboardProvider key={activeTab} user={userObj} companyName={COMPANY} initialScreen={DASHBOARD_SCREENS.OPS}>
              <DashboardRouter opsSection={activeTab} onDone={handleHome} />
            </DashboardProvider>
          </MobileFrame>
        );

      // ── HOME ─────────────────────────────────────────────────────────────
      case "home": {
        if (perms.dashboard === "staff") {
          return (
            <StaffDashboard user={currentUser} onHome={handleHome} onNavigate={handleNavigate} />
          );
        }
        return (
          <MobileFrame>
            <DashboardProvider user={userObj} companyName={COMPANY} initialScreen={defaultScreenForRole(currentUser.role, currentUser.isOperator)}>
              <DashboardRouter
                onTriage={()        => handleTab("triage")}
                onReportIncident={() => handleTab("flag")}
                onTraining={()      => handleTab("training")}
                onIncidents={()     => { setFlagScreen(INCIDENT_SCREENS.LIST); handleTab("flag"); }}
                onFindings={()      => handleTab("inspect")}
                onCAs={()           => { setFlagScreen(INCIDENT_SCREENS.CA_TRACKER); handleTab("flag"); }}
                onRecognition={()   => handleTab("recognition")}
              />
            </DashboardProvider>
          </MobileFrame>
        );
      }

      // ── FLAG SOMETHING ───────────────────────────────────────────────────
      case "flag":
        return (
          <MobileFrame>
            <IncidentProvider key={flagScreen} user={userObj} companyName={COMPANY} initialScreen={flagScreen}>
              <IncidentRouter onDone={handleHome} onGoToTriage={() => setActiveTab("triage")} pickerStep={pickerStep} />
            </IncidentProvider>
          </MobileFrame>
        );

      // ── ASSET (equipment scan-result / deep link) ────────────────────────
      case "asset":
        return (
          <MobileFrame>
            <S7aAssetDetail
              assetId={assetIdView}
              user={userObj}
              onHome={handleHome}
              onBack={handleHome}
              onRunInspection={(checklistId, asset) => {
                // Open the inspect flow directly on this asset's checklist.
                setPendingChecklistId(checklistId);
                setActiveTab("inspect");
              }}
            />
          </MobileFrame>
        );

      // ── TRIAGE ───────────────────────────────────────────────────────────
      // Bucket 3: accessible to all roles
      case "triage":
        return (
          <MobileFrame>
            <TriageProvider user={userObj} companyName={COMPANY}>
              <TriageRouter onDone={handleHome} onFileReport={() => { setPickerStep("flag"); setFlagScreen(INCIDENT_SCREENS.TYPE); setActiveTab("flag"); }} />
            </TriageProvider>
          </MobileFrame>
        );

      // ── INSPECT ──────────────────────────────────────────────────────────
      case "inspect":
        return (
          <MobileFrame>
            <InspectionProvider user={userObj} companyName={COMPANY} initialScreen={INSPECTION_SCREENS.START}
              initialChecklistId={pendingChecklistId} key={pendingChecklistId ?? "inspect"}>
              <InspectionRouter onDone={() => { setPendingChecklistId(null); handleHome(); }} />
            </InspectionProvider>
          </MobileFrame>
        );

      // ── TRAINING ─────────────────────────────────────────────────────────
      case "recognition":
        return (
          <MobileFrame>
            <RecognitionScreen onHome={handleHome} currentUserName={currentUser.name} />
          </MobileFrame>
        );

      case "training":
        return (
          <MobileFrame>
            <TrainingProvider
              user={userObj}
              companyName={COMPANY}
              initialScreen={
                currentUser.role === "staff" || currentUser.role === "trainer"
                  ? TRAINING_SCREENS.QUEUE
                  : TRAINING_SCREENS.COMPLIANCE
              }
            >
              <TrainingRouter onDone={handleHome} />
            </TrainingProvider>
          </MobileFrame>
        );

      // ── REPORTS — site_manager and above only (Bucket 3) ─────────────────
      case "reports":
        if (!perms.seeCAs) return <Placeholder title="Reports" icon="📊" onHome={handleHome} />;
        return (
          <MobileFrame>
            <DashboardProvider user={userObj} companyName={COMPANY} initialScreen={DASHBOARD_SCREENS.REPORT}>
              <DashboardRouter onDone={handleHome} />
            </DashboardProvider>
          </MobileFrame>
        );

      default:
        return <Placeholder title="Coming soon" icon="🔧" onHome={handleHome} />;
    }
  }

  return (
    <AccountContext.Provider value={{ user: currentUser, onLogout: handleLogout }}>
    <AppShell user={currentUser} activeTab={activeTab} onTab={handleTab}>
      {renderContent()}
    </AppShell>
    </AccountContext.Provider>
  );
}


// Two failure modes this exists to fix, both reported as "nav buttons stop
// responding until I refresh, especially right after a deploy":
//
// 1. STALE CLIENT vs FRESH SERVER. A tab left open across a deploy is still
//    running the OLD JS bundle while the server underneath has changed shape
//    (new routes, new response fields, etc.) — a version-skew mismatch. Old
//    code hitting a changed API can throw inside a click handler, which fails
//    completely SILENTLY: React error boundaries (CrashShield) only catch
//    render/lifecycle errors, NOT errors thrown inside onClick handlers — so
//    nothing crashes, nothing shows, the click just does nothing.
//    Fix: poll /api/health's bootId (a fresh random id set once per server
//    process start, i.e. every deploy restart). If it changes after we first
//    saw it, the server restarted under this tab — surface an unmissable,
//    one-tap "Refresh to get the latest version" banner instead of leaving
//    the person to eventually guess that a refresh will help.
//
// 2. THE EVENT-HANDLER BLIND SPOT ITSELF, independent of cause. Any uncaught
//    error or promise rejection outside the render phase is invisible to
//    CrashShield. A window-level listener catches these and shows the same
//    kind of recoverable banner, so "click does nothing with no way to tell
//    why" can no longer happen for ANY reason, not just version skew.
function StaleClientBanner() {
  const [bannerMsg, setBannerMsg] = useState(null); // null | string
  const bootIdRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function checkVersion() {
      try {
        const res = await fetch("/api/health");
        const data = await res.json().catch(() => null);
        if (cancelled || !data?.bootId) return;
        if (bootIdRef.current === null) { bootIdRef.current = data.bootId; return; }
        if (data.bootId !== bootIdRef.current) {
          setBannerMsg("A new version is available.");
        }
      } catch { /* offline or a transient network hiccup — not a version signal, ignore */ }
    }
    checkVersion();
    const iv = setInterval(checkVersion, 60000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  useEffect(() => {
    // Errors thrown inside event handlers (onClick, onChange, etc.) and
    // unhandled promise rejections never reach CrashShield — this is the only
    // safety net for them.
    function onError() { setBannerMsg(m => m ?? "Something went wrong with that last action."); }
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onError);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onError);
    };
  }, []);

  if (!bannerMsg) return null;
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999,
      background: "#2A4435", color: "#fff", padding: "10px 16px",
      display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
      fontFamily: "'DM Sans', sans-serif", fontSize: ".85rem",
      boxShadow: "0 2px 10px rgba(0,0,0,.25)",
    }}>
      <span>{bannerMsg} Refresh to make sure everything works.</span>
      <button onClick={() => window.location.reload()} style={{
        background: "#fff", color: "#2A4435", border: "none", borderRadius: 6,
        padding: "6px 14px", fontWeight: 700, fontSize: ".8rem", cursor: "pointer",
        fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap",
      }}>Refresh now</button>
    </div>
  );
}

export default function AppWithShield() {
  return <CrashShield><StaleClientBanner /><App /></CrashShield>;
}

// ── Forced password change ────────────────────────────────────────────────────
// Shown when an account is still on a seeded or temporary password. The server
// blocks every other endpoint until this is done, so there is no way around it.
function ForcePasswordChange({ onDone, onLogout }) {
  const [current, setCurrent] = useState("");
  const [next, setNext]       = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr]         = useState("");
  const [busy, setBusy]       = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    if (next.length < 8)    { setErr("New password must be at least 8 characters."); return; }
    if (next !== confirm)   { setErr("New passwords do not match."); return; }
    setBusy(true);
    try {
      await api.changePassword(current, next);
      onDone();
    } catch (e2) {
      setErr(e2.message || "Could not change password.");
    } finally { setBusy(false); }
  }

  const field = {
    width: "100%", padding: "12px 14px", borderRadius: 9, marginBottom: 10,
    border: "1px solid rgba(255,255,255,.18)", background: "rgba(255,255,255,.07)",
    color: "#fff", fontFamily: "'DM Sans', sans-serif", fontSize: ".95rem", outline: "none",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#1E3328", display: "flex", alignItems: "center",
                  justifyContent: "center", padding: "24px", fontFamily: "'DM Sans', sans-serif" }}>
      <form onSubmit={submit} style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ fontSize: "1.9rem", marginBottom: 10, textAlign: "center" }}>🔐</div>
        <h1 style={{ color: "#fff", fontSize: "1.3rem", fontWeight: 700, textAlign: "center", marginBottom: 6 }}>
          Set a new password
        </h1>
        <p style={{ color: "rgba(255,255,255,.6)", fontSize: ".85rem", textAlign: "center", marginBottom: 20, lineHeight: 1.5 }}>
          Your account is using a temporary password. Choose a new one to continue.
        </p>
        <input type="password" value={current} onChange={e => setCurrent(e.target.value)}
          placeholder="Current (temporary) password" autoComplete="current-password" style={field} />
        <input type="password" value={next} onChange={e => setNext(e.target.value)}
          placeholder="New password (8+ characters)" autoComplete="new-password" style={field} />
        <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
          placeholder="Confirm new password" autoComplete="new-password" style={field} />
        {err && (
          <div style={{ fontSize: ".78rem", color: "#F0A5A5", background: "rgba(220,80,80,.12)",
                        border: "1px solid rgba(220,80,80,.25)", borderRadius: 8, padding: "8px 12px", marginBottom: 10 }}>
            {err}
          </div>
        )}
        <button type="submit" disabled={busy} style={{
          width: "100%", padding: "14px 18px", background: busy ? "#7FA890" : C.mint,
          color: "#1E3328", border: "none", borderRadius: 9, fontFamily: "'DM Sans', sans-serif",
          fontSize: ".95rem", fontWeight: 700, cursor: busy ? "default" : "pointer",
        }}>{busy ? "Saving…" : "Set password & continue"}</button>
        <button type="button" onClick={onLogout} style={{
          width: "100%", marginTop: 10, background: "none", border: "none",
          color: "rgba(255,255,255,.5)", fontSize: ".8rem", cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
        }}>Sign out</button>
      </form>
    </div>
  );
}
