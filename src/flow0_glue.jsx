/**
 * EHS DNA — Flow 0 Glue Layer
 * ──────────────────────────────────
 * Incident triage flow. Mobile-first. No login required.
 *
 * Usage:
 *   import { TriageProvider, TriageRouter } from "./flow0_glue";
 *
 *   <TriageProvider user={authenticatedUser}>
 *     <TriageRouter />
 *   </TriageProvider>
 *
 * Integration with Flow 1 glue:
 *   In flow1_glue.jsx FlowRouter, mount <TriageRouter /> over the top of
 *   the normal app when triageActive state is set. Pass onDone to dismiss.
 */

import { createContext, useContext, useReducer, useCallback, useRef } from "react";

import { api } from "./api.js";
import { BRAND, COLORS as C } from "./constants.js";
import S0aTriageEntry                from "./s0a_triage_entry";
import S0bDecisionTree               from "./s0b_decision_tree";
import S0cImmediateAction            from "./s0c_immediate_action";
import { S0dNotificationsSent,
         S0eTriageRecord }            from "./s0d_s0e_notifications_record";
import S0fTriageSettings             from "./s0f_triage_settings";

// ─────────────────────────────────────────────────────────────────────────────
// Screen IDs
// ─────────────────────────────────────────────────────────────────────────────
export const TRIAGE_SCREENS = {
  ENTRY:       "s0a",
  DECISION:    "s0b",
  ACTION:      "s0c",
  NOTIFIED:    "s0d",
  RECORD:      "s0e",
  SETTINGS:    "s0f",
};

// ─────────────────────────────────────────────────────────────────────────────
// Initial state
// ─────────────────────────────────────────────────────────────────────────────
const INITIAL_STATE = {
  screen:     TRIAGE_SCREENS.ENTRY,
  history:    [],

  // Session data — built up as user moves through flow
  responder:  null,      // string — name of person initiating triage
  site:       null,      // string — site name
  outcome:    null,      // "911" | "triage" | "firstaid" | "secure"
  timestamp:  null,      // Date

  // Triage record (created at end of session)
  record:     null,      // { id, timestamp, responder, site, outcome, ... }

  // Config (loaded from company settings)
  config: {
    enabled:       true,
    providerName:  "Concentra Occupational Health",
    providerPhone: "(800) 555-0147",
  },

  // Contacts for notification display (loaded from org)
  contacts: {
    "Site Manager":                        { name: "per notification rules", method: "in-app" },
    "Emergency Response Coordinator (ERC)":{ name: "per notification rules", method: "in-app" },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Reducer
// ─────────────────────────────────────────────────────────────────────────────
function generateRecordId() {
  const n = String(Math.floor(Math.random() * 9000) + 1000);
  return `TRG-${new Date().getFullYear()}-${n}`;
}

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

    case "START": {
      // User confirmed who they are and where they are
      return {
        ...state,
        responder: action.responder,
        site:      action.site,
        timestamp: new Date(),
        screen:    TRIAGE_SCREENS.DECISION,
        history:   [...state.history, state.screen],
      };
    }

    case "SET_OUTCOME": {
      // Decision tree reached a leaf — create the triage record
      const record = {
        id:              generateRecordId(),
        timestamp:       state.timestamp ?? new Date(),
        responder:       state.responder,
        site:            state.site,
        outcome:         action.outcome,
        triageCallMade:  false,   // updated by s0c interaction in production
        stepsCompleted:  [],
        notified:        action.outcome === "911"
          ? ["Site Manager", "Emergency Response Coordinator (ERC)"]
          : action.outcome === "triage"
          ? ["Site Manager"]
          : [],
        linkedReportId:  null,
      };
      return {
        ...state,
        outcome: action.outcome,
        record,
        screen:  TRIAGE_SCREENS.ACTION,
        history: [...state.history, state.screen],
      };
    }

    case "SAVE_CONFIG":
      return { ...state, config: { ...state.config, ...action.payload } };

    case "RESET":
      return { ...INITIAL_STATE, config: state.config, contacts: state.contacts };

    default:
      return state;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────
const TriageContext = createContext(null);

export function TriageProvider({
  children,
  user = null,             // { name, site } if authenticated
  config = null,           // override default config from company settings
  contacts = null,         // override notification contacts from org
  initialScreen = TRIAGE_SCREENS.ENTRY,
}) {
  const [state, dispatch] = useReducer(reducer, {
    ...INITIAL_STATE,
    screen:   initialScreen,
    config:   config   ?? INITIAL_STATE.config,
    contacts: contacts ?? INITIAL_STATE.contacts,
  });
  const stateRef = useRef(state);
  // Keep the ref's snapshot current EVERY render (not just on mount) — a plain
  // object literal here (the previous code) is recreated fresh each render, so
  // a memoized (useCallback []) closure that captured it would freeze on the
  // FIRST render's snapshot forever. That was a real bug: setOutcome below
  // read stateRef.current.site to save the triage record's site, but site
  // starts at null and is only set later via start() — so every triage record
  // was silently saved with siteId: null, regardless of the site actually
  // selected. useRef's object identity is stable across renders, so mutating
  // .current here (not via setState) is safe and keeps it genuinely current.
  stateRef.current = state;

  const navigate = useCallback((screen, { replace = false } = {}) =>
    dispatch({ type: "NAVIGATE", screen, replace }), []);

  const back = useCallback(() => dispatch({ type: "BACK" }), []);

  const start = useCallback((responder, site) =>
    dispatch({ type: "START", responder, site }), []);

  const setOutcome = useCallback((outcome) => {
    dispatch({ type: "SET_OUTCOME", outcome });
    // Persist the triage record (fire-and-forget; UI proceeds regardless)
    const siteRec = (BRAND.siteRecords ?? []).find(s => s.name === stateRef.current.site);
    api.createTriage({
      siteId: siteRec?.id ?? null,
      outcome,
      notified: outcome === "911"
        ? ["Site Manager", "Emergency Response Coordinator (ERC)"]
        : outcome === "triage" ? ["Site Manager"] : [],
    }).catch(err => console.error("Triage save failed:", err.message));
  }, []);

  const saveConfig = useCallback((payload) => {
    dispatch({ type: "SAVE_CONFIG", payload });
    api.updateConfig({ triage: {
      enabled: payload.enabled,
      providerName: payload.providerName,
      providerPhone: payload.providerPhone,
      questions: payload.questions,
    }}).then(() => api.fetchConfig())
      .catch(err => console.error("Triage config save failed:", err.message));
  }, []);

  const reset = useCallback(() => dispatch({ type: "RESET" }), []);

  return (
    <TriageContext.Provider value={{
      state, navigate, back, start, setOutcome, saveConfig, reset,
      // Convenience: the authenticated user passed in from app shell
      authUser: user,
    }}>
      {children}
    </TriageContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────
export function useTriage() {
  const ctx = useContext(TriageContext);
  if (!ctx) throw new Error("useTriage must be used inside <TriageProvider>");
  return ctx;
}

// ─────────────────────────────────────────────────────────────────────────────
// TriageRouter
// ─────────────────────────────────────────────────────────────────────────────
export function TriageRouter({
  onDone,           // () => void — called when triage session ends (go home)
  onFileReport,     // () => void — called when user wants to file incident report
  onSettings,       // optional — if omitted, settings navigates internally
  onHome,           // () => void — logo tap → role dashboard (defaults to onDone)
}) {
  const { state, navigate, back, start, setOutcome, saveConfig, reset, authUser } = useTriage();
  const { screen, responder, site, outcome, record, config, contacts } = state;

  function handleDone() {
    reset();
    onDone?.();
  }

  function handleFileReport() {
    // In production: pass record.id to Flow 2 so it pre-populates
    reset();
    onFileReport?.({ triageRecordId: record?.id });
  }

  switch (screen) {

    // ── s0a: Entry ───────────────────────────────────────────────────────────
    case TRIAGE_SCREENS.ENTRY:
      return (
        <S0aTriageEntry
          user={authUser}
          onHome={onHome ?? handleDone}
          onStart={() => start(authUser?.name, authUser?.site)}
          onReportInstead={handleFileReport}
        />
      );

    // ── s0b: Decision tree ───────────────────────────────────────────────────
    case TRIAGE_SCREENS.DECISION:
      return (
        <S0bDecisionTree
          responder={responder}
          onHome={onHome ?? handleDone}
          onOutcome={setOutcome}
          onBack={back}
        />
      );

    // ── s0c: Immediate action ────────────────────────────────────────────────
    case TRIAGE_SCREENS.ACTION:
      return (
        <S0cImmediateAction
          onHome={onHome ?? handleDone}
          outcome={outcome}
          triageProvider={config.providerName
            ? { name: config.providerName, phone: config.providerPhone }
            : null
          }
          responder={responder}
          site={site}
          onNotificationsSent={() => navigate(TRIAGE_SCREENS.NOTIFIED)}
          onAddDetails={handleFileReport}
          onBack={back}
        />
      );

    // ── s0d: Notifications sent ──────────────────────────────────────────────
    case TRIAGE_SCREENS.NOTIFIED:
      return (
        <S0dNotificationsSent
          onHome={onHome ?? handleDone}
          outcome={outcome}
          responder={responder}
          site={site}
          timestamp={record?.timestamp ?? new Date()}
          contacts={contacts}
          onViewRecord={() => navigate(TRIAGE_SCREENS.RECORD)}
          onDone={handleDone}
        />
      );

    // ── s0e: Triage record ───────────────────────────────────────────────────
    case TRIAGE_SCREENS.RECORD:
      return (
        <S0eTriageRecord
          record={record}
          onHome={onHome ?? handleDone}
          onFileReport={handleFileReport}
          onDone={back}
        />
      );

    // ── s0f: Settings ────────────────────────────────────────────────────────
    case TRIAGE_SCREENS.SETTINGS:
      return (
        <S0fTriageSettings
          onBack={back}
          onHome={onHome ?? handleDone}
          onSave={(data) => {
            saveConfig({
              enabled:       data.enabled,
              providerName:  data.providerName,
              providerPhone: data.providerPhone,
              questions:     data.questions,
            });
            back();
          }}
        />
      );

    default:
      return (
        <div style={{ padding: 40, fontFamily: "sans-serif", color: "#C0392B" }}>
          Unknown triage screen: <code>{screen}</code>
        </div>
      );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DevPanel — screen-jump bar for development
// ─────────────────────────────────────────────────────────────────────────────
export function TriageDevPanel() {
  const { state, navigate } = useTriage();

  const screens = [
    { id: TRIAGE_SCREENS.ENTRY,    label: "s0a · Entry"     },
    { id: TRIAGE_SCREENS.DECISION, label: "s0b · Decision"  },
    { id: TRIAGE_SCREENS.ACTION,   label: "s0c · Action"    },
    { id: TRIAGE_SCREENS.NOTIFIED, label: "s0d · Notified"  },
    { id: TRIAGE_SCREENS.RECORD,   label: "s0e · Record"    },
    { id: TRIAGE_SCREENS.SETTINGS, label: "s0f · Settings"  },
  ];

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: "#080F0C", borderTop: `2px solid ${C.forest}`,
      display: "flex", alignItems: "center", gap: 0,
      overflowX: "auto", scrollbarWidth: "none", padding: "0 8px",
    }}>
      <span style={{
        fontSize: ".68rem", color: C.sage, fontFamily: "monospace",
        padding: "0 10px", flexShrink: 0, letterSpacing: ".05em",
      }}>DEV · F0</span>
      {screens.map(s => (
        <button
          key={s.id}
          onClick={() => navigate(s.id, { replace: true })}
          style={{
            padding: "9px 14px",
            background: state.screen === s.id ? C.forest : "none",
            color: state.screen === s.id ? C.mint : "#8FA3A0",
            border: "none",
            borderBottom: state.screen === s.id ? `2px solid ${C.sage}` : "2px solid transparent",
            fontFamily: "monospace", fontSize: ".72rem",
            fontWeight: state.screen === s.id ? 700 : 400,
            cursor: "pointer", whiteSpace: "nowrap",
            transition: "all .15s",
          }}
        >{s.label}</button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Standalone app entry point (for dev-only standalone triage testing)
// ─────────────────────────────────────────────────────────────────────────────
const IS_DEV = typeof import.meta !== "undefined"
  ? import.meta.env?.DEV
  : process.env.NODE_ENV === "development";

export function TriageApp({ user = null }) {
  return (
    <TriageProvider user={user}>
      <div style={{ paddingBottom: IS_DEV ? 40 : 0 }}>
        <TriageRouter
          onDone={()        => console.log("Triage done → home")}
          onFileReport={({ triageRecordId }) => console.log("File report, triage ID:", triageRecordId)}
        />
      </div>
      {IS_DEV && <TriageDevPanel />}
    </TriageProvider>
  );
}
