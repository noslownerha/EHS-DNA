/**
 * EHS DNA — Flow 3 Glue Layer
 * ──────────────────────────────────
 * Inspections & Findings. Mobile entry (s3a1–s3b), desktop views (s3c–s3e).
 *
 * Usage:
 *   import { InspectionProvider, InspectionRouter } from "./flow3_glue";
 *
 *   // Mobile:
 *   <InspectionProvider user={currentUser}>
 *     <InspectionRouter mode="mobile" onDone={() => navigate("/")} />
 *   </InspectionProvider>
 *
 *   // Desktop:
 *   <InspectionProvider user={currentUser}>
 *     <InspectionRouter initialScreen="s3c" />
 *   </InspectionProvider>
 */

import { createContext, useContext, useReducer, useCallback } from "react";
import { BRAND } from "./constants.js";
import { api } from "./api.js";

import { S3a0ChecklistPicker, S3a5Schedule } from "./s3a0_s3a5_picker_schedule";
import S3a1StartInspection                            from "./s3a1_start_inspection";
import { S3a2ChecklistInProgress, S3a3LogFinding }    from "./s3a2_s3a3_checklist_finding";
import { S3a4SessionComplete, S3bQuickFinding }       from "./s3a4_s3b_session_quickfinding";
import { S3cAgingTracker, S3dFindingDetail }          from "./s3c_s3d_aging_tracker_detail";
import S3eChecklistBuilder                             from "./s3e_checklist_builder";

// ─────────────────────────────────────────────────────────────────────────────
// Screen IDs
// ─────────────────────────────────────────────────────────────────────────────
export const INSPECTION_SCREENS = {
  START:        "s3a1",
  PICKER:       "s3a0",
  SCHEDULE:     "s3a5",
  CHECKLIST:    "s3a2",
  LOG_FINDING:  "s3a3",
  SESSION_DONE: "s3a4",
  QUICK:        "s3b",
  AGING:        "s3c",
  FINDING_DETAIL:"s3d",
  BUILDER:      "s3e",
};

// ─────────────────────────────────────────────────────────────────────────────
// Initial state
// ─────────────────────────────────────────────────────────────────────────────
const INITIAL_STATE = {
  screen:  INSPECTION_SCREENS.START,
  history: [],

  // Active session
  mode:         null,      // "quick" | "checklist" | "gemba" | "scheduled"
  sessionItems: null,      // checklist results
  sessionFindings: [],     // findings logged during session
  submittedFinding: null,  // for quick finding confirmation

  // Desktop
  viewingFindingId: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// Reducer
// ─────────────────────────────────────────────────────────────────────────────
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

    case "START_MODE":
      return {
        ...state,
        mode: action.mode,
        screen: action.mode === "quick"      ? INSPECTION_SCREENS.QUICK
              : action.mode === "scheduled"  ? INSPECTION_SCREENS.SCHEDULE
              : INSPECTION_SCREENS.PICKER,   // checklist | gemba → pick one first
        history: [...state.history, state.screen],
      };

    case "SELECT_CHECKLIST":
      return {
        ...state,
        activeChecklist: action.checklist,
        screen: INSPECTION_SCREENS.CHECKLIST,
        history: [...state.history, state.screen],
      };

    case "COMPLETE_SESSION":
      return {
        ...state,
        sessionItems:    action.items,
        sessionFindings: action.findings,
        screen: INSPECTION_SCREENS.SESSION_DONE,
        history: [...state.history, state.screen],
      };

    case "SUBMIT_QUICK_FINDING":
      return {
        ...state,
        submittedFinding: action.finding,
        screen: INSPECTION_SCREENS.START, // Return to start after quick finding
        history: [...state.history, state.screen],
      };

    case "VIEW_FINDING":
      return {
        ...state,
        viewingFindingId: action.id,
        screen: INSPECTION_SCREENS.FINDING_DETAIL,
        history: [...state.history, state.screen],
      };

    case "RESET_SESSION":
      return {
        ...state,
        mode: null,
        sessionItems: null,
        sessionFindings: [],
        submittedFinding: null,
      };

    default:
      return state;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────
const InspectionContext = createContext(null);

export function InspectionProvider({
  children,
  user        = { name: "Mia Chen", site: "Moriah", role: "Inspector" },
  companyName = BRAND.company,
  initialScreen = INSPECTION_SCREENS.START,
}) {
  const [state, dispatch] = useReducer(reducer, { ...INITIAL_STATE, screen: initialScreen });
  const stateRef = { current: state };

  const navigate     = useCallback((screen, { replace = false } = {}) => dispatch({ type: "NAVIGATE", screen, replace }), []);
  const back         = useCallback(() => dispatch({ type: "BACK" }), []);
  const startMode    = useCallback(mode => dispatch({ type: "START_MODE", mode }), []);
  const selectChecklist = useCallback(checklist => dispatch({ type: "SELECT_CHECKLIST", checklist }), []);
  const completeSession = useCallback((items, findings) => {
    dispatch({ type: "COMPLETE_SESSION", items, findings });
    (async () => {
      try {
        const cl = stateRef?.current?.activeChecklist ?? null;
        const siteRec = (BRAND.siteRecords ?? []).find(s => s.name === user?.site);
        const { id: inspectionId } = await api.createInspection({ checklistId: cl?.id ?? null, siteId: siteRec?.id ?? null });
        const responses = Object.fromEntries((items ?? []).map(it => [it.id, it.result ?? it.status ?? "na"]));
        await api.updateInspection(inspectionId, { responses, complete: true });
        for (const f of (findings ?? [])) {
          await api.createFinding({
            inspectionId,
            severity: f?.severity ?? "low",
            description: f?.description ?? f?.notes ?? f?.label ?? "Inspection finding",
          });
        }
      } catch (err) { console.error("Inspection save failed:", err.message); }
    })();
  }, []);
  const submitQuick  = useCallback(finding => {
    dispatch({ type: "SUBMIT_QUICK_FINDING", finding });
    const siteRec = (BRAND.siteRecords ?? []).find(s => s.name === (finding?.site ?? ""));
    api.createFinding({
      siteId: siteRec?.id ?? null,
      severity: finding?.severity ?? "low",
      description: finding?.description ?? finding?.notes ?? "Quick finding",
    }).catch(err => console.error("Finding save failed:", err.message));
  }, []);
  const viewFinding  = useCallback(id => dispatch({ type: "VIEW_FINDING", id }), []);
  const resetSession = useCallback(() => dispatch({ type: "RESET_SESSION" }), []);

  return (
    <InspectionContext.Provider value={{
      state, navigate, back, startMode, selectChecklist, completeSession, submitQuick, viewFinding, resetSession,
      user, companyName,
    }}>
      {children}
    </InspectionContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────
export function useInspection() {
  const ctx = useContext(InspectionContext);
  if (!ctx) throw new Error("useInspection must be used inside <InspectionProvider>");
  return ctx;
}

// ─────────────────────────────────────────────────────────────────────────────
// InspectionRouter
// ─────────────────────────────────────────────────────────────────────────────
export function InspectionRouter({ onDone, onHome }) {
  const { state, navigate, back, startMode, selectChecklist, completeSession, submitQuick, viewFinding, resetSession, user, companyName } = useInspection();
  const { screen, sessionItems, sessionFindings, viewingFindingId } = state;

  switch (screen) {

    // ── s3a1: Start inspection ───────────────────────────────────────────────
    case INSPECTION_SCREENS.START:
      return (
        <S3a1StartInspection
          onHome={onHome ?? onDone}
          user={user}
          onMode={mode => startMode(mode)}
          onResume={id  => startMode("checklist")}
          onViewFinding={id => viewFinding(id)}
        />
      );

    // ── s3a0: Pick a checklist ───────────────────────────────────────────────
    case INSPECTION_SCREENS.PICKER:
      return (
        <S3a0ChecklistPicker
          onHome={onHome ?? onDone}
          onBack={back}
          user={user}
          kind={state.mode === "gemba" ? "gemba" : "checklist"}
          onPick={cl => selectChecklist(cl)}
        />
      );

    // ── s3a5: Scheduled inspections ──────────────────────────────────────────
    case INSPECTION_SCREENS.SCHEDULE:
      return (
        <S3a5Schedule
          onHome={onHome ?? onDone}
          onBack={back}
          user={user}
          onRun={cl => selectChecklist(cl)}
        />
      );

    // ── s3a2: Checklist in progress ──────────────────────────────────────────
    case INSPECTION_SCREENS.CHECKLIST:
      return (
        <S3a2ChecklistInProgress
          onHome={onHome ?? onDone}
          site={user.site}
          checklist={state.activeChecklist}
          templateName={state.activeChecklist?.name}
          onBack={back}
          onComplete={({ items, findings, passCount, failCount, naCount }) => {
            completeSession(items, findings);
          }}
        />
      );

    // ── s3a3: Log finding (standalone) ──────────────────────────────────────
    case INSPECTION_SCREENS.LOG_FINDING:
      return (
        <S3a3LogFinding
          onHome={onHome ?? onDone}
          onBack={back}
          onSubmit={data => {
            navigate(INSPECTION_SCREENS.SESSION_DONE);
          }}
        />
      );

    // ── s3a4: Session complete ───────────────────────────────────────────────
    case INSPECTION_SCREENS.SESSION_DONE:
      return (
        <S3a4SessionComplete
          onHome={onHome ?? onDone}
          site={user.site}
          findings={sessionFindings}
          onDone={() => { resetSession(); onDone?.(); }}
          onViewFinding={viewFinding}
        />
      );

    // ── s3b: Quick finding ───────────────────────────────────────────────────
    case INSPECTION_SCREENS.QUICK:
      return (
        <S3bQuickFinding
          onHome={onHome ?? onDone}
          site={user.site}
          user={user}
          onBack={back}
          onSubmit={finding => {
            submitQuick(finding);
            onDone?.();
          }}
        />
      );

    // ── s3c: Aging tracker (desktop) ─────────────────────────────────────────
    case INSPECTION_SCREENS.AGING:
      return (
        <S3cAgingTracker
          onHome={onHome ?? onDone}
          companyName={companyName}
          onViewFinding={viewFinding}
        />
      );

    // ── s3d: Finding detail (desktop) ────────────────────────────────────────
    case INSPECTION_SCREENS.FINDING_DETAIL:
      return (
        <S3dFindingDetail
          onHome={onHome ?? onDone}
          findingId={viewingFindingId}
          companyName={companyName}
          onBack={back}
        />
      );

    // ── s3e: Checklist builder (desktop) ─────────────────────────────────────
    case INSPECTION_SCREENS.BUILDER:
      return (
        <S3eChecklistBuilder
          onHome={onHome ?? onDone}
          companyName={companyName}
          onBack={back}
        />
      );

    default:
      return (
        <div style={{ padding: 40, fontFamily: "sans-serif", color: "#C0392B" }}>
          Unknown inspection screen: <code>{screen}</code>
        </div>
      );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DevPanel
// ─────────────────────────────────────────────────────────────────────────────
export function InspectionDevPanel() {
  const { state, navigate } = useInspection();

  const screens = [
    { id: INSPECTION_SCREENS.START,         label: "s3a1 · Start"    },
    { id: INSPECTION_SCREENS.CHECKLIST,     label: "s3a2 · Checklist"},
    { id: INSPECTION_SCREENS.LOG_FINDING,   label: "s3a3 · Finding"  },
    { id: INSPECTION_SCREENS.SESSION_DONE,  label: "s3a4 · Session"  },
    { id: INSPECTION_SCREENS.QUICK,         label: "s3b · Quick"     },
    { id: INSPECTION_SCREENS.AGING,         label: "s3c · Aging"     },
    { id: INSPECTION_SCREENS.FINDING_DETAIL,label: "s3d · Detail"    },
    { id: INSPECTION_SCREENS.BUILDER,       label: "s3e · Builder"   },
  ];

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: "#080F0C", borderTop: "2px solid #1C3A2A",
      display: "flex", alignItems: "center", overflowX: "auto",
      scrollbarWidth: "none", padding: "0 8px",
    }}>
      <span style={{ fontSize: ".68rem", color: "#4A8C5C", fontFamily: "monospace", padding: "0 10px", flexShrink: 0, letterSpacing: ".05em" }}>DEV · F3</span>
      {screens.map(s => (
        <button key={s.id} onClick={() => navigate(s.id, { replace: true })} style={{
          padding: "9px 14px",
          background: state.screen === s.id ? "#1C3A2A" : "none",
          color: state.screen === s.id ? "#A8D5B5" : "#8FA3A0",
          border: "none",
          borderBottom: state.screen === s.id ? "2px solid #4A8C5C" : "2px solid transparent",
          fontFamily: "monospace", fontSize: ".72rem",
          fontWeight: state.screen === s.id ? 700 : 400,
          cursor: "pointer", whiteSpace: "nowrap", transition: "all .15s",
        }}>{s.label}</button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Standalone app entry
// ─────────────────────────────────────────────────────────────────────────────
const IS_DEV = typeof import.meta !== "undefined"
  ? import.meta.env?.DEV
  : process.env.NODE_ENV === "development";

export function InspectionApp({ user, companyName, initialScreen }) {
  return (
    <InspectionProvider user={user} companyName={companyName} initialScreen={initialScreen}>
      <div style={{ paddingBottom: IS_DEV ? 40 : 0 }}>
        <InspectionRouter onDone={() => console.log("Done → home")} />
      </div>
      {IS_DEV && <InspectionDevPanel />}
    </InspectionProvider>
  );
}
