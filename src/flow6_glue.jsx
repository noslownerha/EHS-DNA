/**
 * EHS DNA — Flow 6 Glue Layer
 * ──────────────────────────────────
 * CS & Billing Backend. Internal only — platform owner and CS team.
 *
 * 7 screens:
 *   s6a — Account list
 *   s6b — Account detail (health score, modules, pricing override note)
 *   s6c — Invoice queue (pending approval)
 *   s6d — Invoice detail (approve + send)
 *   s6e — Platform metrics (hideable tiles, editable cost fields)
 *   s6f — CS backend settings (rate card, module pricing, feature flags)
 *   s6g — Enrollment queue (self-serve + sales-assisted)
 *
 * Usage:
 *   import { CSProvider, CSRouter } from "./flow6_glue";
 *
 *   <CSProvider>
 *     <CSRouter />
 *   </CSProvider>
 */

import { createContext, useContext, useReducer, useCallback } from "react";

import { S6aAccountList, S6bAccountDetail }              from "./s6a_s6b_account_list_detail";
import { S6cInvoiceQueue, S6dInvoiceDetail }              from "./s6c_s6d_invoice_queue_detail";
import { S6ePlatformMetrics, S6fCSSettings, S6gEnrollmentQueue } from "./s6e_s6f_s6g_metrics_settings_enrollment";

// ─────────────────────────────────────────────────────────────────────────────
// Screen IDs
// ─────────────────────────────────────────────────────────────────────────────
export const CS_SCREENS = {
  ACCOUNTS:   "s6a",
  ACCOUNT:    "s6b",
  INVOICES:   "s6c",
  INVOICE:    "s6d",
  METRICS:    "s6e",
  SETTINGS:   "s6f",
  ENROLLMENT: "s6g",
};

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────
const INITIAL_STATE = {
  screen:           CS_SCREENS.ACCOUNTS,
  history:          [],
  viewingAccountId: null,
  viewingInvoiceId: null,
};

function reducer(state, action) {
  switch (action.type) {
    case "NAVIGATE": {
      const history = action.replace
        ? state.history
        : [...state.history, state.screen];
      return { ...state, screen: action.screen, history };
    }
    case "BACK": {
      if (state.history.length === 0) return state;
      const history = [...state.history];
      const screen  = history.pop();
      return { ...state, screen, history };
    }
    case "VIEW_ACCOUNT":
      return { ...state, viewingAccountId: action.id, screen: CS_SCREENS.ACCOUNT, history: [...state.history, state.screen] };
    case "VIEW_INVOICE":
      return { ...state, viewingInvoiceId: action.id, screen: CS_SCREENS.INVOICE, history: [...state.history, state.screen] };
    default:
      return state;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────
const CSContext = createContext(null);

export function CSProvider({ children, initialScreen = CS_SCREENS.ACCOUNTS }) {
  const [state, dispatch] = useReducer(reducer, { ...INITIAL_STATE, screen: initialScreen });

  const navigate     = useCallback((screen, { replace = false } = {}) => dispatch({ type: "NAVIGATE", screen, replace }), []);
  const back         = useCallback(() => dispatch({ type: "BACK" }), []);
  const viewAccount  = useCallback(id => dispatch({ type: "VIEW_ACCOUNT", id }), []);
  const viewInvoice  = useCallback(id => dispatch({ type: "VIEW_INVOICE", id }), []);

  return (
    <CSContext.Provider value={{ state, navigate, back, viewAccount, viewInvoice }}>
      {children}
    </CSContext.Provider>
  );
}

export function useCS() {
  const ctx = useContext(CSContext);
  if (!ctx) throw new Error("useCS must be used inside <CSProvider>");
  return ctx;
}

// ─────────────────────────────────────────────────────────────────────────────
// CSRouter
// ─────────────────────────────────────────────────────────────────────────────
export function CSRouter() {
  const { state, navigate, back, viewAccount, viewInvoice } = useCS();
  const { screen, viewingAccountId, viewingInvoiceId } = state;

  switch (screen) {

    case CS_SCREENS.ACCOUNTS:
      return (
        <S6aAccountList
          onViewAccount={viewAccount}
          onNewEnrollment={() => navigate(CS_SCREENS.ENROLLMENT)}
        />
      );

    case CS_SCREENS.ACCOUNT:
      return (
        <S6bAccountDetail
          accountId={viewingAccountId}
          onBack={back}
          onViewInvoice={id => id === "all" ? navigate(CS_SCREENS.INVOICES) : viewInvoice(id)}
          onShadowMode={id => console.log(`Shadow mode entered for account ${id} — session logged`)}
        />
      );

    case CS_SCREENS.INVOICES:
      return (
        <S6cInvoiceQueue
          onViewInvoice={viewInvoice}
          onBack={back}
        />
      );

    case CS_SCREENS.INVOICE:
      return (
        <S6dInvoiceDetail
          invoiceId={viewingInvoiceId}
          onBack={back}
          onApprove={id => console.log(`Invoice ${id} approved`)}
        />
      );

    case CS_SCREENS.METRICS:
      return <S6ePlatformMetrics />;

    case CS_SCREENS.SETTINGS:
      return <S6fCSSettings />;

    case CS_SCREENS.ENROLLMENT:
      return (
        <S6gEnrollmentQueue
          onProvisionAccount={id => console.log(`Provisioning account for enrollment ${id}`)}
        />
      );

    default:
      return (
        <div style={{ padding: 40, fontFamily: "sans-serif", color: "#E74C3C" }}>
          Unknown CS screen: <code>{screen}</code>
        </div>
      );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar nav (CS backend has a persistent sidebar, unlike customer flows)
// ─────────────────────────────────────────────────────────────────────────────
export function CSSidebar() {
  const { state, navigate } = useCS();

  const navItems = [
    { id: CS_SCREENS.ACCOUNTS,   label: "Accounts",    icon: "🏢" },
    { id: CS_SCREENS.INVOICES,   label: "Invoices",    icon: "🧾" },
    { id: CS_SCREENS.ENROLLMENT, label: "Enrollment",  icon: "📋" },
    { id: CS_SCREENS.METRICS,    label: "Metrics",     icon: "📊" },
    { id: CS_SCREENS.SETTINGS,   label: "Settings",    icon: "⚙️" },
  ];

  return (
    <div style={{
      width: 200, background: "#1A1A2E", height: "100vh",
      borderRight: "1px solid rgba(0,180,216,.12)",
      display: "flex", flexDirection: "column",
      padding: "16px 0", position: "sticky", top: 0,
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{ padding: "0 16px 16px", borderBottom: "1px solid rgba(255,255,255,.06)", marginBottom: 8 }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: ".85rem", fontWeight: 500, color: "#00B4D8", letterSpacing: ".06em" }}>
          <span style={{ color: "#FFFFFF" }}>EHS</span>ops
        </div>
        <div style={{ fontSize: ".65rem", color: "rgba(255,255,255,.25)", marginTop: 2 }}>CS Backend</div>
      </div>
      {navItems.map(item => {
        const isActive = state.screen === item.id ||
          (item.id === CS_SCREENS.ACCOUNTS && state.screen === CS_SCREENS.ACCOUNT) ||
          (item.id === CS_SCREENS.INVOICES  && state.screen === CS_SCREENS.INVOICE);
        return (
          <button key={item.id} onClick={() => navigate(item.id)} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "9px 16px", background: isActive ? "rgba(0,180,216,.1)" : "none",
            borderLeft: isActive ? "3px solid #00B4D8" : "3px solid transparent",
            border: "none", cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
            fontSize: ".83rem", fontWeight: isActive ? 600 : 400,
            color: isActive ? "#00B4D8" : "rgba(255,255,255,.45)",
            textAlign: "left", transition: "all .15s",
          }}>
            <span>{item.icon}</span>
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Full CS app shell (sidebar + main)
// ─────────────────────────────────────────────────────────────────────────────
export function CSApp({ initialScreen }) {
  return (
    <CSProvider initialScreen={initialScreen}>
      <div style={{ display: "flex", minHeight: "100vh" }}>
        <CSSidebar />
        <div style={{ flex: 1, overflowY: "auto" }}>
          <CSRouter />
        </div>
      </div>
    </CSProvider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DevPanel
// ─────────────────────────────────────────────────────────────────────────────
export function CSDevPanel() {
  const { state, navigate } = useCS();

  const screens = [
    { id: CS_SCREENS.ACCOUNTS,   label: "s6a · Accounts"   },
    { id: CS_SCREENS.ACCOUNT,    label: "s6b · Detail"     },
    { id: CS_SCREENS.INVOICES,   label: "s6c · Invoices"   },
    { id: CS_SCREENS.INVOICE,    label: "s6d · Invoice"    },
    { id: CS_SCREENS.METRICS,    label: "s6e · Metrics"    },
    { id: CS_SCREENS.SETTINGS,   label: "s6f · Settings"   },
    { id: CS_SCREENS.ENROLLMENT, label: "s6g · Enrollment" },
  ];

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: "#080808", borderTop: "2px solid #1A1A2E",
      display: "flex", alignItems: "center", overflowX: "auto",
      scrollbarWidth: "none", padding: "0 8px",
    }}>
      <span style={{ fontSize: ".68rem", color: "#00B4D8", fontFamily: "monospace", padding: "0 10px", flexShrink: 0, letterSpacing: ".05em" }}>DEV · F6</span>
      {screens.map(s => (
        <button key={s.id} onClick={() => navigate(s.id, { replace: true })} style={{
          padding: "9px 14px",
          background: state.screen === s.id ? "#1A1A2E" : "none",
          color: state.screen === s.id ? "#00B4D8" : "rgba(255,255,255,.3)",
          border: "none",
          borderBottom: state.screen === s.id ? "2px solid #00B4D8" : "2px solid transparent",
          fontFamily: "monospace", fontSize: ".72rem",
          fontWeight: state.screen === s.id ? 700 : 400,
          cursor: "pointer", whiteSpace: "nowrap", transition: "all .15s",
        }}>{s.label}</button>
      ))}
    </div>
  );
}
