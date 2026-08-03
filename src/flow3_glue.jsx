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

import { createContext, useContext, useReducer, useCallback, useEffect, useRef } from "react";
import { BRAND, COLORS as C } from "./constants.js";
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
  user        = { name: "Staff", site: "Moriah", role: "Inspector" },
  companyName = BRAND.company,
  initialScreen = INSPECTION_SCREENS.START,
  initialChecklistId = null,      // when set (e.g. from an asset QR), open straight into this checklist
}) {
  const [state, dispatch] = useReducer(reducer, { ...INITIAL_STATE, screen: initialScreen });
  const stateRef = useRef(state);
  // Same class of bug as the triage flow's stateRef: a plain object literal is
  // recreated every render, so completeSession's useCallback([]) below would
  // freeze on the FIRST render's activeChecklist (null) forever — meaning
  // every completed inspection was silently saved with checklistId: null.
  // A real useRef, kept in sync here every render, is stable across renders
  // (safe for memoized callbacks to reference) while .current is always fresh.
  stateRef.current = state;

  // Deep-link from an asset: fetch the asset's checklist and drop the inspector
  // straight into running it, instead of the generic Start screen. Closes the
  // scan-to-inspect loop (scan pump → run its inspection) in one tap.
  useEffect(() => {
    if (!initialChecklistId) return;
    api.getChecklist?.(initialChecklistId)
      .then(cl => { if (cl && (!cl.active || cl.active === 1)) dispatch({ type: "SELECT_CHECKLIST", checklist: cl }); })
      .catch(() => { /* fall back to the Start screen */ });
  }, [initialChecklistId]);

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
            siteId: siteRec?.id ?? null,
            severity: f?.severity ?? "low",
            description: f?.description ?? f?.notes ?? f?.label ?? "Inspection finding",
            category:   f?.category ?? null,
            assignee:   f?.assignee ?? null,
            dueDate:    f?.dueDate ?? null,
            capex:      f?.capex ? 1 : 0,
            capexNotes: f?.capexNotes ?? null,
            safetyRelevant: f?.safetyRelevant === false ? false : true,
            photos:     f?.photo ? [f.photo] : [],
          });
        }
      } catch (err) { console.error("Inspection save failed:", err.message); }
    })();
  }, [user?.site]);
  const submitQuick  = useCallback(finding => {
    dispatch({ type: "SUBMIT_QUICK_FINDING", finding });
    const siteRec = (BRAND.siteRecords ?? []).find(s => s.name === (finding?.site ?? ""));
    api.createFinding({
      siteId: siteRec?.id ?? null,
      severity: finding?.severity ?? "low",
      description: finding?.description ?? finding?.notes ?? finding?.desc ?? "Quick finding",
      // These four were collected by the capture screen and dropped on the floor
      // before they ever reached the API. Passing them through is what makes the
      // CapEx and safety-relevance switches mean anything.
      category:   finding?.category ?? null,
      assignee:   finding?.assignee ?? null,
      dueDate:    finding?.dueDate ?? null,
      capex:      finding?.capex ? 1 : 0,
      capexNotes: finding?.capexNotes ?? null,
      safetyRelevant: finding?.safetyRelevant === false ? false : true,
      photos:     finding?.photo ? [finding.photo] : [],
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
          onManageChecklists={["admin", "safety", "site_manager"].includes(user.role) ? () => navigate(INSPECTION_SCREENS.BUILDER) : null}
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
          user={user}
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
      background: "#080F0C", borderTop: `2px solid ${C.forest}`,
      display: "flex", alignItems: "center", overflowX: "auto",
      scrollbarWidth: "none", padding: "0 8px",
    }}>
      <span style={{ fontSize: ".68rem", color: C.sage, fontFamily: "monospace", padding: "0 10px", flexShrink: 0, letterSpacing: ".05em" }}>DEV · F3</span>
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
