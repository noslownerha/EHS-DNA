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

import { createContext, useContext, useReducer, useCallback, useRef, useEffect } from "react";
import { enqueue, flushQueue, uuid as newUuid } from "./offlineQueue.js";
import { BRAND, COLORS as C } from "./constants.js";
import { api } from "./api.js";

import S2a1IncidentType                     from "./s2a1_incident_type";
import S2a2WhatHappened                     from "./s2a2_what_happened";
import S2a3WhoWasInvolved                   from "./s2a3_who_was_involved";
import { S2a5ReviewSubmit } from "./s2a4_s2a5_photos_review";
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
      clearDraft();   // the report is now the server's problem, not a draft
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
            submitted: { ...state.submitted, id: action.ref, dbId: action.dbId, notified: action.notified ?? null },
            incidents: state.incidents.map(i => i.id === state.submitted.id ? { ...i, id: action.ref } : i) }
        : state;

    case "SAVE_QUEUED":
      return state.submitted
        ? { ...state, submitted: { ...state.submitted, queued: true, saveFailed: false } }
        : state;

    case "SAVE_FAILED":
      return state.submitted ? { ...state, submitted: { ...state.submitted, saveFailed: true, saveError: action.error ?? null } } : state;

    case "VIEW_INCIDENT":
      return { ...state, viewingId: action.id, screen: INCIDENT_SCREENS.DETAIL, history: [...state.history, state.screen] };

    case "RESET_DRAFT":
      clearDraft();
      return { ...state, draft: { ...INITIAL_STATE.draft }, submitted: null };

    default:
      return state;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────
const IncidentContext = createContext(null);

// ── Draft persistence ─────────────────────────────────────────────────────────
// A half-filled incident report is real work — losing it to an accidental reload,
// a backgrounded tab, or a browser crash on the plant floor is unacceptable.
// We persist the draft (minus photos, which are base64 and would blow the ~5MB
// sessionStorage quota) and restore it on mount.
const DRAFT_KEY = "ehs_incident_draft";

function loadDraft() {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    // Ignore anything stale (older than 12h) so a forgotten draft doesn't haunt a new report.
    if (!saved?.at || Date.now() - saved.at > 12 * 3600 * 1000) {
      sessionStorage.removeItem(DRAFT_KEY);
      return null;
    }
    return saved.draft ?? null;
  } catch { return null; }
}

function saveDraft(draft) {
  try {
    // Only persist once the user has actually entered something worth keeping.
    const meaningful = draft?.type || draft?.description || draft?.location || draft?.involved;
    if (!meaningful) return;
    const { photos, ...rest } = draft;   // photos intentionally dropped
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ at: Date.now(), draft: rest }));
  } catch { /* quota or private mode — non-fatal */ }
}

function clearDraft() {
  try { sessionStorage.removeItem(DRAFT_KEY); } catch {}
}

export function IncidentProvider({
  children,
  user           = { name: "Ahren H.", site: "Moriah", dept: "Administration", role: "admin" },
  triageProvider = { name: "Concentra Occupational Health", phone: "(800) 555-0147" },
  companyName    = BRAND.company,
  initialScreen  = INCIDENT_SCREENS.TYPE,
}) {
  const [state, dispatch] = useReducer(reducer, undefined, () => {
    const restored = loadDraft();
    return {
      ...INITIAL_STATE,
      screen: initialScreen,
      draft: restored ? { ...INITIAL_STATE.draft, ...restored } : INITIAL_STATE.draft,
    };
  });
  const stateRef = useRef(state);       // always-fresh snapshot for async callbacks
  stateRef.current = state;

  // Auto-capture GPS in the background as soon as the report flow opens, so the
  // coordinates are ready by the time the user submits (geolocation can take a few
  // seconds). Silent and best-effort: if permission is denied or it times out, the
  // report just files without coordinates — GPS never blocks or delays submission.
  const gpsRef = useRef(null);
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      pos => { gpsRef.current = { latitude: pos.coords.latitude, longitude: pos.coords.longitude }; },
      () => { /* denied/unavailable — file without GPS */ },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  // Persist the in-progress draft so a reload/crash doesn't discard the report.
  useEffect(() => { saveDraft(state.draft); }, [state.draft]);


  const navigate   = useCallback((screen, { replace = false } = {}) => dispatch({ type: "NAVIGATE", screen, replace }), []);
  const back       = useCallback(() => dispatch({ type: "BACK" }), []);
  const saveType   = useCallback(payload => dispatch({ type: "SAVE_TYPE",   payload }), []);
  const saveWhat   = useCallback(payload => dispatch({ type: "SAVE_WHAT",   payload }), []);
  const saveWho    = useCallback(payload => dispatch({ type: "SAVE_WHO",    payload }), []);
  const savePhotos = useCallback(payload => dispatch({ type: "SAVE_PHOTOS", payload }), []);
  const submit     = useCallback(() => {
    dispatch({ type: "SUBMIT" });
    const d = stateRef.current.draft;
    const siteRec = (BRAND.siteRecords ?? []).find(s => s.name === d.site);
    const payload = {
      clientUuid: newUuid(),   // idempotency key — a retry can never double-file this
      type: d.type, severity: d.severity, siteId: siteRec?.id ?? null,
      description: d.description, locationDetail: d.location, floorPos: d.floorPos ?? null,
      involved: d.involved ?? [], occurredAt: d.datetime ?? null, department: d.dept ?? null,
      recognizedUserId: d.recognizedUserId ?? null,
      latitude: gpsRef.current?.latitude ?? null,
      longitude: gpsRef.current?.longitude ?? null,
      oshaSignals: d.oshaSignals ?? [],
      oshaRecordableSuggested: !!d.oshaRecordableSuggested,
      photos: (d.photos ?? []).filter(ph => ph.dataUrl).map(ph => ({ dataUrl: ph.dataUrl, gps: ph.gps ?? false, name: ph.name ?? null })),
    };

    // Already offline? Don't even try — queue it and tell the user it's safe.
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      enqueue(payload)
        .then(() => dispatch({ type: "SAVE_QUEUED" }))
        .catch(err => dispatch({ type: "SAVE_FAILED", error: err.message }));
      return;
    }

    api.createIncident(payload)
      .then(({ ref, id, notified }) => {
        dispatch({ type: "SERVER_REF", ref, dbId: id, notified });
        // Opportunistically drain anything queued from an earlier dead zone.
        flushQueue(api.createIncident).catch(() => {});
      })
      .catch(err => {
        // A transport failure (no status) means the network dropped mid-submit —
        // queue it rather than losing the report. A 4xx is a real rejection.
        if (!err.status) {
          enqueue(payload)
            .then(() => dispatch({ type: "SAVE_QUEUED" }))
            .catch(() => dispatch({ type: "SAVE_FAILED", error: err.message }));
        } else {
          console.error("Incident save failed:", err.message);
          dispatch({ type: "SAVE_FAILED", error: `${err.status ?? ""} ${err.message}`.trim() });
        }
      });
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
export function IncidentRouter({ onDone, onGoToTriage, onHome, pickerStep = "top" }) {
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
          onTriage={onGoToTriage}
          initialStep={pickerStep}
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
          initialSite={draft.site}
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
          notified={
            submitted?.notified
              ? (submitted.notified.count > 0
                  ? [`${submitted.notified.count} recipient${submitted.notified.count === 1 ? "" : "s"} notified in-app${submitted.notified.email ? " + email queued" : ""} — rules: ${(submitted.notified.events ?? []).join(", ")}`]
                  : ["No active notification rules matched — configure in Settings → Notifications"])
              : ["Confirming…"]
          }
          timestamp={submitted?.submittedAt ?? new Date()}
          onDone={() => { resetDraft(); onDone?.(); }}
          onViewIncident={() => viewIncident(submitted?.id)}
          userRole={user?.role ?? "staff"}
          incidentDbId={submitted?.dbId ?? null}
          saveState={submitted?.dbId ? "saved" : submitted?.queued ? "queued" : submitted?.saveFailed ? "failed" : "saving"}
          saveError={submitted?.saveError ?? null}
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
        />
      );

    // ── s2e: CA tracker (desktop) ───────────────────────────────────────────
    case INCIDENT_SCREENS.CA_TRACKER:
      return (
        <S2eCATracker
          onHome={onHome ?? onDone}
          onBack={onHome ?? onDone}
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
    { id: INCIDENT_SCREENS.REVIEW,      label: "s2a5 · Review"    },
    { id: INCIDENT_SCREENS.CONFIRMATION,label: "s2b · Confirm"    },
    { id: INCIDENT_SCREENS.LIST,        label: "s2c · List"       },
    { id: INCIDENT_SCREENS.DETAIL,      label: "s2d · Detail"     },
    { id: INCIDENT_SCREENS.CA_TRACKER,  label: "s2e · CAs"        },
  ];

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: "#080F0C", borderTop: `2px solid ${C.forest}`,
      display: "flex", alignItems: "center", gap: 0,
      overflowX: "auto", scrollbarWidth: "none", padding: "0 8px",
    }}>
      <span style={{ fontSize: ".68rem", color: C.sage, fontFamily: "monospace", padding: "0 10px", flexShrink: 0, letterSpacing: ".05em" }}>DEV · F2</span>
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
