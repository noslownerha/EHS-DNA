import { useState, useEffect } from "react";
import { api, getToken } from "./api.js";
import { ROLE_PERMS } from "./constants.js";
import LandingPage                   from "./LandingPage.jsx";
import AppShell, { EHSHeader, AccountContext } from "./AppShell.jsx";
import { BRAND } from "./constants.js";
import StaffDashboard                from "./StaffDashboard.jsx";

import { TriageProvider, TriageRouter }                                from "./flow0_glue.jsx";
import { IncidentProvider, IncidentRouter, INCIDENT_SCREENS }          from "./flow2_glue.jsx";
import { InspectionProvider, InspectionRouter, INSPECTION_SCREENS }    from "./flow3_glue.jsx";
import { TrainingProvider, TrainingRouter, TRAINING_SCREENS }          from "./flow4_glue.jsx";
import { DashboardProvider, DashboardRouter, DASHBOARD_SCREENS, defaultScreenForRole } from "./flow5_glue.jsx";

// Placeholder for screens not yet built
function Placeholder({ title, icon, onHome }) {
  return (
    <div style={{ minHeight: "100vh", background: "#F4F7F5", fontFamily: "'DM Sans', sans-serif" }}>
      <EHSHeader onHome={onHome} title={title} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 48, minHeight: "60vh", gap: 14 }}>
        <span style={{ fontSize: "2.5rem" }}>{icon}</span>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#0F1F17" }}>{title}</h2>
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

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab,   setActiveTab]   = useState("home");
  const [booting,     setBooting]     = useState(!!getToken());
  const [flagScreen,  setFlagScreen]  = useState(INCIDENT_SCREENS.TYPE);

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
  function handleTab(tabId) {
    if (tabId === "flag" && activeTab !== "flag") setFlagScreen(s => s); // keep deep-link
    else if (tabId === "flag") setFlagScreen(INCIDENT_SCREENS.TYPE);
    setActiveTab(tabId);
  }
  function handleNavigate(dest) { setActiveTab(dest); }

  if (booting) return null;
  if (!currentUser) return <LandingPage onEnter={handleEnter} />;

  const perms   = ROLE_PERMS[currentUser.role] ?? ROLE_PERMS.staff;
  const userObj = { ...currentUser, name: currentUser.name ?? `${currentUser.first ?? ""} ${currentUser.last ?? ""}`.trim() };

  function renderContent() {
    switch (activeTab) {

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
              <IncidentRouter onDone={handleHome} />
            </IncidentProvider>
          </MobileFrame>
        );

      // ── TRIAGE ───────────────────────────────────────────────────────────
      // Bucket 3: accessible to all roles
      case "triage":
        return (
          <MobileFrame>
            <TriageProvider user={userObj} companyName={COMPANY}>
              <TriageRouter onDone={handleHome} onFileReport={() => setActiveTab("flag")} />
            </TriageProvider>
          </MobileFrame>
        );

      // ── INSPECT ──────────────────────────────────────────────────────────
      case "inspect":
        return (
          <MobileFrame>
            <InspectionProvider user={userObj} companyName={COMPANY} initialScreen={INSPECTION_SCREENS.START}>
              <InspectionRouter onDone={handleHome} />
            </InspectionProvider>
          </MobileFrame>
        );

      // ── TRAINING ─────────────────────────────────────────────────────────
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
