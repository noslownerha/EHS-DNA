/**
 * EHS DNA — Flow 2 Glue Layer
 * ──────────────────────────────────
 * Incident reporting flow. Mobile entry (s2a1–s2b), desktop views (s2c–s2e).
 *
 * Usage:
 *   import { IncidentProvider, IncidentRouter } from "./flow2_glue";
 *
 *   // Mobile reporting entry:
 *   <IncidentProvider user={currentUser} triageProvider={company.triageProvider}>
 *     <IncidentRouter mode="mobile" onDone={() => navigate("/")} />
 *   </IncidentProvider>
 *
 *   // Desktop dashboard:
 *   <IncidentProvider user={currentUser}>
 *     <IncidentRouter mode="desktop" initialScreen="s2c" />
 *   </IncidentProvider>
 */

import { createContext, useContext, useReducer, useCallback } from "react";
import { BRAND } from "./constants.js";
import { api } from "./api.js";

import S2a1IncidentType                     from "./s2a1_incident_type";
import S2a2WhatHappened                     from "./s2a2_what_happened";
import S2a3WhoWasInvolved                   from "./s2a3_who_was_involved";
import { S2a4PhotosLocation, S2a5ReviewSubmit } from "./s2a4_s2a5_photos_review";
import S2bConfirmationResponse              from "./s2b_confirmation_response";
import { S2cIncidentList, S2dIncidentDetail } from "./s2c_s2d_incident_list_detail";
import S2eCATracker                         from "./s2e_ca_tracker";

// ─────────────────────────────────────────────────────────────────────────────
// Screen IDs
// ─────────────────────────────────────────────────────────────────────────────
export const INCIDENT_SCREENS = {
  TYPE:        "s2a1",
  WHAT:        "s2a2",
  WHO:         "s2a3",
  PHOTOS:      "s2a4",
  REVIEW:      "s2a5",
  CONFIRMATION:"s2b",
  LIST:        "s2c",
  DETAIL:      "s2d",
  CA_TRACKER:  "s2e",
};

// ─────────────────────────────────────────────────────────────────────────────
// Initial state
// ─────────────────────────────────────────────────────────────────────────────
const INITIAL_STATE = {
  screen:  INCIDENT_SCREENS.TYPE,
  history: [],

  // Submitted incidents (in production: fetched from API)
  incidents: [],

  // Active incident being built across the mobile flow
  draft: {
    type:       null,
    site:       null,
    dept:       null,
    datetime:   null,
    description:"",
    location:   "",
    severity:   null,
    injuryType: "",
    involved:   null,
    photos:     [],
    gpsGranted: false,
    anonymous:  false,
  },

  // Submitted incident data (set after s2b)
  submitted: null,   // { id, ...draftData }

  // For s2d: which incident is open
  viewingId: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// Reducer
// ─────────────────────────────────────────────────────────────────────────────
function generateIncidentId() {
  const n = String(Math.floor(Math.random() * 90) + 10);
  return `INC-${new Date().getFullYear()}-00${n}`;
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

    case "SAVE_TYPE":
      return { ...state, draft: { ...state.draft, ...action.payload } };

    case "SAVE_WHAT":
      return { ...state, draft: { ...state.draft, ...action.payload } };

    case "SAVE_WHO":
      return { ...state, draft: { ...state.draft, involved: action.payload,
        dept: action.payload?.person?.dept ?? state.draft.dept } };

    case "SAVE_PHOTOS":
      return { ...state, draft: { ...state.draft, ...action.payload } };

    case "SUBMIT": {
      const id = generateIncidentId();
      const submitted = { id, ...state.draft, submittedAt: new Date() };
      return {
        ...state,
        submitted,
        incidents: [submitted, ...state.incidents],
        screen: INCIDENT_SCREENS.CONFIRMATION,
        history: [...state.history, state.screen],
      };
    }

    case "SERVER_REF":
      // Replace client-generated id with the server's canonical ref
      return state.submitted
        ? { ...state,
            submitted: { ...state.submitted, id: action.ref, dbId: action.dbId },
            incidents: state.incidents.map(i => i.id === state.submitted.id ? { ...i, id: action.ref } : i) }
        : state;

    case "VIEW_INCIDENT":
      return { ...state, viewingId: action.id, screen: INCIDENT_SCREENS.DETAIL, history: [...state.history, state.screen] };

    case "RESET_DRAFT":
      return { ...state, draft: { ...INITIAL_STATE.draft }, submitted: null };

    default:
      return state;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────
const IncidentContext = createContext(null);

export function IncidentProvider({
  children,
  user           = { name: "Ahren H.", site: "Moriah", dept: "Administration", role: "admin" },
  triageProvider = { name: "Concentra Occupational Health", phone: "(800) 555-0147" },
  companyName    = BRAND.company,
  initialScreen  = INCIDENT_SCREENS.TYPE,
}) {
  const [state, dispatch] = useReducer(reducer, { ...INITIAL_STATE, screen: initialScreen });
  const stateRef = { current: state };  // always-fresh snapshot for async callbacks


  const navigate   = useCallback((screen, { replace = false } = {}) => dispatch({ type: "NAVIGATE", screen, replace }), []);
  const back       = useCallback(() => dispatch({ type: "BACK" }), []);
  const saveType   = useCallback(payload => dispatch({ type: "SAVE_TYPE",   payload }), []);
  const saveWhat   = useCallback(payload => dispatch({ type: "SAVE_WHAT",   payload }), []);
  const saveWho    = useCallback(payload => dispatch({ type: "SAVE_WHO",    payload }), []);
  const savePhotos = useCallback(payload => dispatch({ type: "SAVE_PHOTOS", payload }), []);
  const submit     = useCallback(() => {
    dispatch({ type: "SUBMIT" });
    // Persist to server; UI already advanced optimistically
    const d = stateRef.current.draft;
    const siteRec = (BRAND.siteRecords ?? []).find(s => s.name === d.site);
    api.createIncident({
      type: d.incidentType, severity: d.severity, siteId: siteRec?.id ?? null,
      description: d.description, locationDetail: d.location, floorPos: d.floorPos ?? null,
      involved: d.involved ?? [], occurredAt: d.datetime ?? null,
    }).then(({ ref, id }) => dispatch({ type: "SERVER_REF", ref, dbId: id }))
      .catch(err => console.error("Incident save failed:", err.message));
  }, []);
  const viewIncident = useCallback(id   => dispatch({ type: "VIEW_INCIDENT", id }), []);
  const resetDraft = useCallback(()     => dispatch({ type: "RESET_DRAFT" }), []);

  return (
    <IncidentContext.Provider value={{
      state, navigate, back,
      saveType, saveWhat, saveWho, savePhotos, submit, viewIncident, resetDraft,
      user, triageProvider, companyName,
    }}>
      {children}
    </IncidentContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────
export function useIncident() {
  const ctx = useContext(IncidentContext);
  if (!ctx) throw new Error("useIncident must be used inside <IncidentProvider>");
  return ctx;
}

// ─────────────────────────────────────────────────────────────────────────────
// IncidentRouter
// ─────────────────────────────────────────────────────────────────────────────
export function IncidentRouter({ onDone, onGoToTriage, onHome }) {
  const {
    state, navigate, back,
    saveType, saveWhat, saveWho, savePhotos, submit, viewIncident, resetDraft,
    user, triageProvider, companyName,
  } = useIncident();

  const { screen, draft, submitted, viewingId } = state;

  switch (screen) {

    // ── s2a1: Incident type select ──────────────────────────────────────────
    case INCIDENT_SCREENS.TYPE:
      return (
        <S2a1IncidentType
          onHome={onHome ?? onDone}
          user={user}
          onBack={onDone ?? back}
          onContinue={data => {
            saveType(data);
            navigate(INCIDENT_SCREENS.WHAT);
          }}
        />
      );

    // ── s2a2: What happened ─────────────────────────────────────────────────
    case INCIDENT_SCREENS.WHAT:
      return (
        <S2a2WhatHappened
          onHome={onHome ?? onDone}
          incidentType={draft.type}
          onBack={back}
          onContinue={data => {
            saveWhat(data);
            navigate(INCIDENT_SCREENS.WHO);
          }}
        />
      );

    // ── s2a3: Who was involved ──────────────────────────────────────────────
    case INCIDENT_SCREENS.WHO:
      return (
        <S2a3WhoWasInvolved
          onHome={onHome ?? onDone}
          severity={draft.severity}
          incidentType={draft.type}
          triageProvider={triageProvider}
          onBack={back}
          onContinue={involved => {
            saveWho(involved);
            navigate(INCIDENT_SCREENS.PHOTOS);
          }}
        />
      );

    // ── s2a4: Photos & location ─────────────────────────────────────────────
    case INCIDENT_SCREENS.PHOTOS:
      return (
        <S2a4PhotosLocation
          onHome={onHome ?? onDone}
          site={state.draft.site}
          onBack={back}
          onContinue={data => {
            savePhotos(data);
            navigate(INCIDENT_SCREENS.REVIEW);
          }}
        />
      );

    // ── s2a5: Review & submit ───────────────────────────────────────────────
    case INCIDENT_SCREENS.REVIEW:
      return (
        <S2a5ReviewSubmit
          onHome={onHome ?? onDone}
          flowData={draft}
          onBack={back}
          onSubmit={extraData => {
            submit();
          }}
        />
      );

    // ── s2b: Confirmation + response ────────────────────────────────────────
    case INCIDENT_SCREENS.CONFIRMATION:
      return (
        <S2bConfirmationResponse
          onHome={onHome ?? onDone}
          incidentId={submitted?.id}
          incidentType={submitted?.type}
          severity={submitted?.severity}
          notified={[`Site manager and safety team${user?.site ? ` — ${user.site}` : ""} (per notification rules)`]}
          timestamp={submitted?.submittedAt ?? new Date()}
          onDone={() => { resetDraft(); onDone?.(); }}
          onViewIncident={() => viewIncident(submitted?.id)}
          userRole={user?.role ?? "staff"}
          incidentDbId={submitted?.dbId ?? null}
        />
      );

    // ── s2c: Incident list (desktop) ────────────────────────────────────────
    case INCIDENT_SCREENS.LIST:
      return (
        <S2cIncidentList
          onHome={onHome ?? onDone}
          companyName={companyName}
          onViewIncident={id => viewIncident(id)}
          onNewIncident={() => navigate(INCIDENT_SCREENS.TYPE)}
        />
      );

    // ── s2d: Incident detail (desktop) ──────────────────────────────────────
    case INCIDENT_SCREENS.DETAIL:
      return (
        <S2dIncidentDetail
          onHome={onHome ?? onDone}
          incidentId={viewingId}
          companyName={companyName}
          onBack={back}
          onExport={format => console.log(`Export ${viewingId} as ${format}`)}
        />
      );

    // ── s2e: CA tracker (desktop) ───────────────────────────────────────────
    case INCIDENT_SCREENS.CA_TRACKER:
      return (
        <S2eCATracker
          onHome={onHome ?? onDone}
          companyName={companyName}
          onViewIncident={id => viewIncident(id)}
        />
      );

    default:
      return (
        <div style={{ padding: 40, fontFamily: "sans-serif", color: "#C0392B" }}>
          Unknown incident screen: <code>{screen}</code>
        </div>
      );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DevPanel
// ─────────────────────────────────────────────────────────────────────────────
export function IncidentDevPanel() {
  const { state, navigate } = useIncident();

  const screens = [
    { id: INCIDENT_SCREENS.TYPE,        label: "s2a1 · Type"      },
    { id: INCIDENT_SCREENS.WHAT,        label: "s2a2 · What"      },
    { id: INCIDENT_SCREENS.WHO,         label: "s2a3 · Who"       },
    { id: INCIDENT_SCREENS.PHOTOS,      label: "s2a4 · Photos"    },
    { id: INCIDENT_SCREENS.REVIEW,      label: "s2a5 · Review"    },
    { id: INCIDENT_SCREENS.CONFIRMATION,label: "s2b · Confirm"    },
    { id: INCIDENT_SCREENS.LIST,        label: "s2c · List"       },
    { id: INCIDENT_SCREENS.DETAIL,      label: "s2d · Detail"     },
    { id: INCIDENT_SCREENS.CA_TRACKER,  label: "s2e · CAs"        },
  ];

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: "#080F0C", borderTop: "2px solid #1C3A2A",
      display: "flex", alignItems: "center", gap: 0,
      overflowX: "auto", scrollbarWidth: "none", padding: "0 8px",
    }}>
      <span style={{ fontSize: ".68rem", color: "#4A8C5C", fontFamily: "monospace", padding: "0 10px", flexShrink: 0, letterSpacing: ".05em" }}>DEV · F2</span>
      {screens.map(s => (
        <button
          key={s.id}
          onClick={() => navigate(s.id, { replace: true })}
          style={{
            padding: "9px 14px",
            background: state.screen === s.id ? "#1C3A2A" : "none",
            color: state.screen === s.id ? "#A8D5B5" : "#8FA3A0",
            border: "none",
            borderBottom: state.screen === s.id ? "2px solid #4A8C5C" : "2px solid transparent",
            fontFamily: "monospace", fontSize: ".72rem",
            fontWeight: state.screen === s.id ? 700 : 400,
            cursor: "pointer", whiteSpace: "nowrap", transition: "all .15s",
          }}
        >{s.label}</button>
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

export function IncidentApp({ user, companyName, initialScreen }) {
  return (
    <IncidentProvider user={user} companyName={companyName} initialScreen={initialScreen}>
      <div style={{ paddingBottom: IS_DEV ? 40 : 0 }}>
        <IncidentRouter onDone={() => console.log("Done → home")} />
      </div>
      {IS_DEV && <IncidentDevPanel />}
    </IncidentProvider>
  );
}
