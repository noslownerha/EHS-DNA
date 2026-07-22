/**
 * EHS DNA — Flow 5 Glue Layer
 * ──────────────────────────────────
 * Dashboard & Reporting.
 *
 * 4 screens:
 *   s5a — Site Manager Dashboard (desktop)
 *   s5b — Company Admin Dashboard (desktop)
 *   s5c — Staff Mobile Home (mobile)
 *   s5d — Report Builder (desktop)
 *
 * Usage:
 *   import { DashboardProvider, DashboardRouter } from "./flow5_glue";
 *
 *   // Staff mobile:
 *   <DashboardProvider user={currentUser}>
 *     <DashboardRouter initialScreen="s5c" onTriage={() => ...} onReportIncident={() => ...} />
 *   </DashboardProvider>
 *
 *   // Site Manager desktop:
 *   <DashboardProvider user={currentUser}>
 *     <DashboardRouter initialScreen="s5a" />
 *   </DashboardProvider>
 *
 *   // Company Admin desktop:
 *   <DashboardProvider user={currentUser}>
 *     <DashboardRouter initialScreen="s5b" />
 *   </DashboardProvider>
 */

import { BRAND, COLORS as C } from "./constants.js";
import { createContext, useContext, useReducer, useCallback, useState } from "react";

import S5aSiteManagerDashboard                        from "./s5a_site_manager_dashboard";
import { S5bCompanyAdminDashboard, S5cStaffMobileHome } from "./s5b_s5c_admin_dashboard_mobile_home";
import S5dReportBuilder                                from "./s5d_report_builder";
import S5eManageStaff                                  from "./s5e_manage_staff";
import S7bAssetRegistry                                from "./s7b_asset_registry.jsx";
import S7aAssetDetail                                  from "./s7a_asset_detail.jsx";
import S5fCompanySettings                              from "./s5f_company_settings";
import S5gBilling                                      from "./s5g_billing";
import S5hOpsConsole                                   from "./s5h_ops_console";

// ─────────────────────────────────────────────────────────────────────────────
// Screen IDs
// ─────────────────────────────────────────────────────────────────────────────
export const DASHBOARD_SCREENS = {
  SITE_MANAGER: "s5a",
  ADMIN:        "s5b",
  STAFF_HOME:   "s5c",
  REPORT:       "s5d",
  STAFF_MGMT:   "s5e",
  SETTINGS:     "s5f",
  BILLING:      "s5g",
  OPS:          "s5h",
  EQUIPMENT:    "s7b",   // asset registry
  ASSET:        "s7a",   // single asset detail
};

// ─────────────────────────────────────────────────────────────────────────────
// Auto-routing helper: pick the right default screen for a given role
// ─────────────────────────────────────────────────────────────────────────────
export function defaultScreenForRole(role, isOperator = false) {
  if (isOperator && !sessionStorage.getItem("ehs_operator_token")) return DASHBOARD_SCREENS.OPS;
  if (role === "admin" || role === "company_admin") return DASHBOARD_SCREENS.ADMIN;
  if (role === "site_manager" || role === "safety")  return DASHBOARD_SCREENS.SITE_MANAGER;
  return DASHBOARD_SCREENS.STAFF_HOME;
}

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────
const INITIAL_STATE = {
  screen:  DASHBOARD_SCREENS.STAFF_HOME,
  history: [],
};

function reducer(state, action) {
  switch (action.type) {
    case "NAVIGATE": {
      const history = action.replace
        ? state.history
        : [...state.history, state.screen];
      return { ...state, screen: action.screen, history,
               assetId: action.assetId !== undefined ? action.assetId : state.assetId };
    }
    case "BACK": {
      if (state.history.length === 0) return state;
      const history = [...state.history];
      const screen  = history.pop();
      return { ...state, screen, history };
    }
    default:
      return state;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────
const DashboardContext = createContext(null);

export function DashboardProvider({
  children,
  user        = { name: "Ahren H.", site: "Moriah", role: "admin" },
  companyName = BRAND.company,
  initialScreen,
}) {
  const startScreen = initialScreen ?? defaultScreenForRole(user.role);
  const [state, dispatch] = useReducer(reducer, { ...INITIAL_STATE, screen: startScreen });

  const navigate = useCallback((screen, { replace = false, assetId } = {}) =>
    dispatch({ type: "NAVIGATE", screen, replace, assetId }), []);
  const back = useCallback(() => dispatch({ type: "BACK" }), []);

  return (
    <DashboardContext.Provider value={{ state, navigate, back, user, companyName }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used inside <DashboardProvider>");
  return ctx;
}

// ─────────────────────────────────────────────────────────────────────────────
// DashboardRouter
// ─────────────────────────────────────────────────────────────────────────────
export function DashboardRouter({
  // Cross-flow navigation callbacks — wired by the app shell
  onTriage,         // () => void  — launches Flow 0
  onReportIncident, // () => void  — launches Flow 2
  onTraining,       // () => void  — launches Flow 4 queue
  onIncidents,      // () => void  — launches Flow 2 list
  onFindings,       // () => void  — launches Flow 3 aging tracker
  onCAs,            // () => void  — launches Flow 2 CA tracker
  onDone,
  onHome,
}) {
  const { state, navigate, back, user, companyName } = useDashboard();
  const [billingTarget, setBillingTarget] = useState(null);
  const { screen } = state;

  // Shared cross-module navigation handler used by both desktop dashboards
  function handleNavigate(dest, param) {
    switch (dest) {
      case "report":    return navigate(DASHBOARD_SCREENS.REPORT);
      case "staff":     return navigate(DASHBOARD_SCREENS.STAFF_MGMT);
      case "settings":  return navigate(DASHBOARD_SCREENS.SETTINGS);
      case "equipment": return navigate(DASHBOARD_SCREENS.EQUIPMENT);
      case "billing":   return navigate(DASHBOARD_SCREENS.BILLING);
      case "ops":       return navigate(DASHBOARD_SCREENS.OPS);
      case "incidents": return onIncidents?.();
      case "findings":  return onFindings?.();
      case "cas":       return onCAs?.();
      case "training":  return onTraining?.();
      case "site":      return navigate(DASHBOARD_SCREENS.SITE_MANAGER); // drill into site
      default:          return;
    }
  }

  switch (screen) {

    // ── s5a: Site Manager Dashboard ──────────────────────────────────────────
    case DASHBOARD_SCREENS.SITE_MANAGER:
      return (
        <S5aSiteManagerDashboard
          onHome={onHome ?? onDone}
          companyName={companyName}
          manager={{ name: user.name, site: user.site }}
          onNavigate={handleNavigate}
        />
      );

    // ── s5b: Company Admin Dashboard ─────────────────────────────────────────
    case DASHBOARD_SCREENS.ADMIN:
      return (
        <S5bCompanyAdminDashboard
          onHome={onHome ?? onDone}
          companyName={companyName}
          onNavigate={handleNavigate}
        />
      );

    // ── s5c: Staff Mobile Home ───────────────────────────────────────────────
    case DASHBOARD_SCREENS.STAFF_HOME:
      return (
        <S5cStaffMobileHome
          onHome={onHome ?? onDone}
          user={user}
          triageEnabled={true}
          onTriage={onTriage}
          onReportIncident={onReportIncident}
          onTraining={onTraining}
          onViewIncident={id => onIncidents?.()}
        />
      );

    // ── s5d: Report Builder ──────────────────────────────────────────────────
    case DASHBOARD_SCREENS.REPORT:
      return (
        <S5dReportBuilder
          onHome={onHome ?? onDone}
          companyName={companyName}
          onBack={back}
        />
      );

    // ── s5e: Manage Staff ──────────────────────────────────────────────────
    case DASHBOARD_SCREENS.STAFF_MGMT:
      return (
        <S5eManageStaff
          onHome={onHome ?? onDone}
          onBack={onHome ?? onDone}
          companyName={companyName}
        />
      );

    // ── s7b: Equipment & Assets registry ────────────────────────────────────
    case DASHBOARD_SCREENS.EQUIPMENT:
      return (
        <S7bAssetRegistry
          onHome={onHome ?? onDone}
          user={user}
          onBack={back}
          onOpenAsset={(id) => navigate(DASHBOARD_SCREENS.ASSET, { assetId: id })}
        />
      );

    // ── s7a: Single asset detail ────────────────────────────────────────────
    case DASHBOARD_SCREENS.ASSET:
      return (
        <S7aAssetDetail
          assetId={state.assetId}
          user={user}
          onHome={onHome ?? onDone}
          onBack={back}
        />
      );

    // ── s5g: Billing ────────────────────────────────────────────────────────
    case DASHBOARD_SCREENS.BILLING:
      return (
        <S5gBilling
          onHome={onHome ?? onDone}
          onBack={onHome ?? onDone}
          companyName={companyName}
          tenantId={billingTarget?.id ?? null}
          tenantName={billingTarget?.name ?? null}
        />
      );

    // ── s5h: EHS DNA operator console ────────────────────────────────────────
    case DASHBOARD_SCREENS.OPS:
      return (
        <S5hOpsConsole
          onHome={onHome ?? onDone}
          onOpenBilling={(id, name) => { setBillingTarget({ id, name }); navigate(DASHBOARD_SCREENS.BILLING); }}
        />
      );

    // ── s5f: Company Settings ────────────────────────────────────────────────
    case DASHBOARD_SCREENS.SETTINGS:
      return (
        <S5fCompanySettings
          onHome={onHome ?? onDone}
          onBack={onHome ?? onDone}
          companyName={companyName}
        />
      );

    default:
      return (
        <div style={{ padding: 40, fontFamily: "sans-serif", color: "#C0392B" }}>
          Unknown dashboard screen: <code>{screen}</code>
        </div>
      );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DevPanel
// ─────────────────────────────────────────────────────────────────────────────
export function DashboardDevPanel() {
  const { state, navigate } = useDashboard();

  const screens = [
    { id: DASHBOARD_SCREENS.SITE_MANAGER, label: "s5a · Site Mgr"  },
    { id: DASHBOARD_SCREENS.ADMIN,        label: "s5b · Admin"      },
    { id: DASHBOARD_SCREENS.STAFF_HOME,   label: "s5c · Staff Home" },
    { id: DASHBOARD_SCREENS.REPORT,       label: "s5d · Reports"    },
  ];

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: "#080F0C", borderTop: `2px solid ${C.forest}`,
      display: "flex", alignItems: "center", overflowX: "auto",
      scrollbarWidth: "none", padding: "0 8px",
    }}>
      <span style={{ fontSize: ".68rem", color: C.sage, fontFamily: "monospace", padding: "0 10px", flexShrink: 0, letterSpacing: ".05em" }}>DEV · F5</span>
      {screens.map(s => (
        <button key={s.id} onClick={() => navigate(s.id, { replace: true })} style={{
          padding: "9px 14px",
          background: state.screen === s.id ? C.forest : "none",
          color: state.screen === s.id ? C.mint : "#8FA3A0",
          border: "none",
          borderBottom: state.screen === s.id ? `2px solid ${C.sage}` : "2px solid transparent",
          fontFamily: "monospace", fontSize: ".72rem",
          fontWeight: state.screen === s.id ? 700 : 400,
          cursor: "pointer", whiteSpace: "nowrap", transition: "all .15s",
        }}>{s.label}</button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Standalone app
// ─────────────────────────────────────────────────────────────────────────────
const IS_DEV = typeof import.meta !== "undefined"
  ? import.meta.env?.DEV
  : process.env.NODE_ENV === "development";

export function DashboardApp({ user, companyName, initialScreen }) {
  return (
    <DashboardProvider user={user} companyName={companyName} initialScreen={initialScreen}>
      <div style={{ paddingBottom: IS_DEV ? 40 : 0 }}>
        <DashboardRouter
          onTriage={()         => console.log("→ Triage (Flow 0)")}
          onReportIncident={()  => console.log("→ Report Incident (Flow 2)")}
          onTraining={()        => console.log("→ Training (Flow 4)")}
          onIncidents={()       => console.log("→ Incident List (Flow 2)")}
          onFindings={()        => console.log("→ Aging Tracker (Flow 3)")}
          onCAs={()             => console.log("→ CA Tracker (Flow 2)")}
        />
      </div>
      {IS_DEV && <DashboardDevPanel />}
    </DashboardProvider>
  );
}
