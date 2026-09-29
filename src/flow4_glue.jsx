/**
 * EHS DNA — Flow 4 Glue Layer
 * ──────────────────────────────────
 * Training Management.
 * Mobile: s4a (queue), s4b (CBT player), s4c (in-person sign-off)
 * Shared: s4d (group session log — modal usable anywhere)
 * Desktop: s4e (library), s4f (training detail), s4g (compliance dashboard), s4h (staff detail)
 *
 * Usage:
 *   import { TrainingProvider, TrainingRouter } from "./flow4_glue";
 *
 *   // Mobile staff view:
 *   <TrainingProvider user={currentUser}>
 *     <TrainingRouter initialScreen="s4a" onDone={() => navigate("/")} />
 *   </TrainingProvider>
 *
 *   // Desktop admin view:
 *   <TrainingProvider user={currentUser}>
 *     <TrainingRouter initialScreen="s4g" />
 *   </TrainingProvider>
 */

import { createContext, useContext, useReducer, useCallback, useState, useRef } from "react";
import { BRAND, COLORS as C } from "./constants.js";
import S4iTrainingBuilder from "./s4i_training_builder";
import { api } from "./api.js";

import S4aTrainingQueue                    from "./s4a_training_queue";
import { S4bCBTPlayer, S4cInPersonSignOff } from "./s4b_s4c_cbt_signoff";
import { TrainingAcknowledge, PendingConfirmations } from "./TrainingAck.jsx";
import S4dGroupSessionLog                   from "./s4d_group_session_log";
import { S4eTrainingLibrary, S4fTrainingDetail } from "./s4e_s4f_library_detail";
import { S4gComplianceDashboard, S4hStaffComplianceDetail } from "./s4g_s4h_compliance";

// ─────────────────────────────────────────────────────────────────────────────
// Screen IDs
// ─────────────────────────────────────────────────────────────────────────────
export const TRAINING_SCREENS = {
  QUEUE:       "s4a",
  CBT:         "s4b",
  SIGN_OFF:    "s4c",
  GROUP_LOG:   "s4d",
  LIBRARY:     "s4e",
  DETAIL:      "s4f",
  COMPLIANCE:  "s4g",
  STAFF_DETAIL:"s4h",
  BUILDER:     "s4i",
  ACK:         "s4ack",   // trainee acknowledges an in-person course (trainer confirms)
};

// ─────────────────────────────────────────────────────────────────────────────
// Initial state
// ─────────────────────────────────────────────────────────────────────────────
const INITIAL_STATE = {
  screen:  TRAINING_SCREENS.QUEUE,
  history: [],

  // Current active training (for CBT player)
  activeTraining: null,

  // Desktop drill-down targets
  viewingTrainingId: null,
  viewingStaffId:    null,

  // Group session modal open flag
  groupSessionOpen: false,
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

    case "OPEN_TRAINING":
      return {
        ...state,
        activeTraining: action.training,
        screen: action.targetScreen
          ?? (action.training?.type === "cbt" ? TRAINING_SCREENS.CBT : TRAINING_SCREENS.SIGN_OFF),
        history: [...state.history, state.screen],
      };

    case "VIEW_TRAINING":
      return {
        ...state,
        viewingTrainingId: action.id,
        screen: TRAINING_SCREENS.DETAIL,
        history: [...state.history, state.screen],
      };

    case "VIEW_STAFF":
      return {
        ...state,
        viewingStaffId: action.id,
        screen: TRAINING_SCREENS.STAFF_DETAIL,
        history: [...state.history, state.screen],
      };

    case "OPEN_GROUP_LOG":
      return { ...state, groupSessionOpen: true };

    case "CLOSE_GROUP_LOG":
      return { ...state, groupSessionOpen: false };

    default:
      return state;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────
const TrainingContext = createContext(null);

export function TrainingProvider({
  children,
  user        = { name: "Staff", site: "Moriah", dept: "", role: "staff" },
  companyName = BRAND.company,
  initialScreen = TRAINING_SCREENS.QUEUE,
}) {
  const [state, dispatch] = useReducer(reducer, { ...INITIAL_STATE, screen: initialScreen });

  const navigate       = useCallback((screen, { replace = false } = {}) => dispatch({ type: "NAVIGATE", screen, replace }), []);
  const back           = useCallback(() => dispatch({ type: "BACK" }), []);
  const openTraining   = useCallback(item => {
    let training = item;
    if (item?.type === "cbt") {
      let parsed = null;
      try { parsed = item.content ? JSON.parse(item.content) : null; } catch {}
      const contentSlides = (parsed?.slides ?? []).map((s, i) => ({
        id: `c${i}`, type: "content", heading: s.heading || item.title,
        body: s.body || "", videoUrl: s.videoUrl || null, example: s.example || null, image: null,
        imageId: s.imageId || null,
      }));
      const quizSlides = (parsed?.questions ?? []).map((q, i) => ({
        id: `q${i}`, type: "knowledge_check", heading: `Question ${i + 1}`,
        question: q.q, options: q.choices, correctIndex: q.correctIndex,
        explanation: q.explanation || null,
      }));
      const slides = [...contentSlides, ...quizSlides];
      training = {
        ...item,
        passThreshold: parsed?.passThreshold ?? 80,
        slides: slides.length ? slides : [{
          id: "ack", type: "content", heading: item.title,
          body: "Review this training's material with your supervisor or trainer, then tap Finish to record your completion.",
          example: null, image: null,
        }],
      };
    }
    // Route by role: a trainer/manager opening a non-CBT training records it via
    // in-person sign-off (they're attesting for others). A staff member is taking
    // the training themselves, so they always get the self-serve player — never the
    // sign-off screen (which they can't use and which would defeat verification).
    // Non-CBT trainings for staff fall back to a simple acknowledge-to-complete.
    const isTrainer = ["trainer", "safety", "site_manager", "admin"].includes(user.role);
    let targetScreen;
    if (training?.type === "cbt") {
      targetScreen = TRAINING_SCREENS.CBT;
    } else if (isTrainer) {
      targetScreen = TRAINING_SCREENS.SIGN_OFF;
    } else {
      // Staff on an in-person course: they ACKNOWLEDGE it; a trainer/manager
      // confirms it. (This used to be a one-slide "Finish" that recorded the
      // course as complete with no trainer involved.)
      targetScreen = TRAINING_SCREENS.ACK;
    }
    dispatch({ type: "OPEN_TRAINING", training, targetScreen });
  }, [user.role]);
  const viewTraining   = useCallback(id  => dispatch({ type: "VIEW_TRAINING", id }), []);
  const viewStaff      = useCallback(id  => dispatch({ type: "VIEW_STAFF",    id }), []);
  const openGroupLog   = useCallback(()  => dispatch({ type: "OPEN_GROUP_LOG"  }), []);
  const closeGroupLog  = useCallback(()  => dispatch({ type: "CLOSE_GROUP_LOG" }), []);

  return (
    <TrainingContext.Provider value={{
      state, navigate, back, openTraining, viewTraining, viewStaff, openGroupLog, closeGroupLog,
      user, companyName,
    }}>
      {children}
    </TrainingContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────
export function useTraining() {
  const ctx = useContext(TrainingContext);
  if (!ctx) throw new Error("useTraining must be used inside <TrainingProvider>");
  return ctx;
}

// ─────────────────────────────────────────────────────────────────────────────
// TrainingRouter
// ─────────────────────────────────────────────────────────────────────────────
export function TrainingRouter({ onDone, onHome }) {
  const {
    state, navigate, back, openTraining, viewTraining, viewStaff, openGroupLog, closeGroupLog,
    user, companyName,
  } = useTraining();

  const { screen, activeTraining, viewingTrainingId, viewingStaffId, groupSessionOpen } = state;
  // A pass used to navigate away even if saving the completion failed (the error
  // only reached the console) — someone could "pass" and have no record at all.
  // Now the save must succeed before leaving; otherwise they're told plainly.
  const [saveError, setSaveError] = useState("");
  const isConfirmer = ["admin", "safety", "trainer", "site_manager"].includes(user?.role);
  // Which course the builder should open on: { id } from an Edit button, { new: true } from "+ New course".
  const [builderTarget, setBuilderTarget] = useState(null);
  const passSave = useRef(null);   // null | "saving" | "saved" | "failed"
  function savePass(score, leaveAfter) {
    if (!activeTraining?.id || passSave.current === "saving") return;
    passSave.current = "saving"; setSaveError("");
    api.logCompletion({ trainingId: activeTraining.id, method: "cbt", score, passed: true })
      .then(() => { passSave.current = "saved"; if (leaveAfter) back(); })
      .catch(err => {
        passSave.current = "failed";
        setSaveError(`Your pass was NOT saved — ${err.message}. Check your connection and tap Done to retry.`);
      });
  }

  // Group session log modal — overlays any desktop screen
  const GroupSessionModal = groupSessionOpen ? (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(15,31,23,.55)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24,
    }}>
      <div style={{
        background: "#fff", borderRadius: 12,
        width: "100%", maxWidth: 580,
        boxShadow: "0 20px 60px rgba(0,0,0,.2)",
        overflow: "hidden",
        animation: "fadeUp .2s ease both",
      }}>
        <S4dGroupSessionLog
          onHome={onHome ?? onDone}
          userRole={user.role}
          userName={user.name}
          onConfirm={data => {
            const trainingId = data?.trainingId ?? data?.training?.id;
            const userIds = data?.attendeeIds ?? data?.attendees?.map(a => a.id ?? a) ?? [];
            if (trainingId && userIds.length) {
              api.logCompletion({ trainingId, userIds, method: "group" })
                .catch(err => console.error("Group session save failed:", err.message));
            }
            closeGroupLog();
          }}
          onClose={closeGroupLog}
        />
      </div>
    </div>
  ) : null;

  switch (screen) {

    // ── s4a: Training queue (mobile) ─────────────────────────────────────────
    case TRAINING_SCREENS.ACK:
      return <TrainingAcknowledge training={activeTraining} onBack={back} />;

    case TRAINING_SCREENS.QUEUE:
      return (
        <>
          {GroupSessionModal}
          {isConfirmer && <PendingConfirmations />}
          <S4aTrainingQueue
          onHome={onHome ?? onDone}
            user={user}
            onOpen={openTraining}
            onBack={onDone ?? back}
          />
        </>
      );

    // ── s4b: CBT player (mobile) ─────────────────────────────────────────────
    case TRAINING_SCREENS.CBT:
      return (
        <>
        {saveError && (
          <div role="alert" style={{ position: "fixed", top: 70, left: 12, right: 12, zIndex: 50, background: "#FEF3F2", color: "#B42318",
                                     border: "1px solid #F3C4BF", borderRadius: 10, padding: "12px 14px", fontSize: ".85rem", fontWeight: 600 }}>
            ⚠ {saveError}
          </div>
        )}
        <S4bCBTPlayer
          onHome={onHome ?? onDone}
          training={activeTraining ?? undefined}
          onComplete={({ score, passed }) => {
            // The pass was already saved when the result appeared (onPassed).
            // "Done" only leaves — unless that save failed, in which case retry it.
            if (!activeTraining?.id || passSave.current === "saved") { back(); return; }
            savePass(score, true);
          }}
          onFail={({ score }) => {
            if (activeTraining?.id) {
              api.logCompletion({ trainingId: activeTraining.id, method: "cbt", score, passed: false })
                .catch(err => console.error("Failed-attempt log failed:", err.message));
            }
          }}
          onPassed={({ score }) => savePass(score, false)}
          onBack={() => { setSaveError(""); back(); }}
        />
        </>
      );

    // ── s4c: In-person sign-off (mobile) ─────────────────────────────────────
    case TRAINING_SCREENS.SIGN_OFF:
      return (
        <>
        {saveError && (
          <div role="alert" style={{ position: "fixed", top: 70, left: 12, right: 12, zIndex: 50, background: "#FEF3F2", color: "#B42318",
                                     border: "1px solid #F3C4BF", borderRadius: 10, padding: "12px 14px", fontSize: ".85rem", fontWeight: 600 }}>
            ⚠ {saveError}
          </div>
        )}
        <S4cInPersonSignOff
          onHome={onHome ?? onDone}
          trainerRole={user.role}
          trainer={{ name: user.name, site: user.site }}
          onBack={back}
          onComplete={({ training, staff, notes }) => {
            // Record the in-person completion for the signed-off staff member.
            if (training?.id && staff?.id) {
              // Used to be console-only: a refused/failed sign-off looked like it worked.
              api.logCompletion({ trainingId: training.id, userIds: [staff.id], method: "inperson", passed: true, notes })
                .then(() => { setSaveError(""); back(); })
                .catch(err => setSaveError(`Sign-off NOT recorded — ${err.message}`));
              return;
            }
            back();
          }}
        />
        </>
      );

    // ── s4d: Group session log (standalone) ──────────────────────────────────
    case TRAINING_SCREENS.GROUP_LOG:
      return (
        <S4dGroupSessionLog
          onHome={onHome ?? onDone}
          userRole={user.role}
          userName={user.name}
          onConfirm={() => back()}
          onClose={back}
        />
      );

    // ── s4e: Training library (desktop) ──────────────────────────────────────
    case TRAINING_SCREENS.LIBRARY:
      return (
        <>
          {GroupSessionModal}
          <S4eTrainingLibrary
          onHome={onHome ?? onDone}
            companyName={companyName}
            userRole={user.role}
            onBack={back}
            onViewTraining={viewTraining}
            onLogGroupSession={openGroupLog}
            onCreateTraining={() => { setBuilderTarget({ new: true }); navigate(TRAINING_SCREENS.BUILDER); }}
            onEditTraining={id => { setBuilderTarget({ id }); navigate(TRAINING_SCREENS.BUILDER); }}
          />
        </>
      );

    // ── s4i: Training Builder ────────────────────────────────────────────────
    case TRAINING_SCREENS.BUILDER:
      return (
        <S4iTrainingBuilder
          key={builderTarget?.id ?? (builderTarget?.new ? "new" : "builder")}
          initialTrainingId={builderTarget?.id ?? null}
          startNew={!!builderTarget?.new}
          onHome={onHome ?? onDone}
          companyName={companyName}
          onBack={() => { setBuilderTarget(null); back(); }}
        />
      );

    // ── s4f: Training detail (desktop) ───────────────────────────────────────
    case TRAINING_SCREENS.DETAIL:
      return (
        <>
          {GroupSessionModal}
          <S4fTrainingDetail
          onHome={onHome ?? onDone}
            trainingId={viewingTrainingId}
            companyName={companyName}
            userRole={user.role}
            onBack={back}
            onLogGroupSession={openGroupLog}
          />
        </>
      );

    // ── s4g: Compliance dashboard (desktop) ───────────────────────────────────
    case TRAINING_SCREENS.COMPLIANCE:
      return (
        <>
          {GroupSessionModal}
          {isConfirmer && <PendingConfirmations />}
          <S4gComplianceDashboard
          onHome={onHome ?? onDone}
            companyName={companyName}
            onViewStaff={viewStaff}
            onManageCourses={() => navigate(TRAINING_SCREENS.LIBRARY)}
            onCreateTraining={() => navigate(TRAINING_SCREENS.BUILDER)}
          />
        </>
      );

    // ── s4h: Staff compliance detail (desktop) ────────────────────────────────
    case TRAINING_SCREENS.STAFF_DETAIL:
      return (
        <S4hStaffComplianceDetail
          onHome={onHome ?? onDone}
          staffId={viewingStaffId}
          companyName={companyName}
          onBack={back}
        />
      );

    default:
      return (
        <div style={{ padding: 40, fontFamily: "sans-serif", color: "#C0392B" }}>
          Unknown training screen: <code>{screen}</code>
        </div>
      );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DevPanel
// ─────────────────────────────────────────────────────────────────────────────
export function TrainingDevPanel() {
  const { state, navigate } = useTraining();

  const screens = [
    { id: TRAINING_SCREENS.QUEUE,        label: "s4a · Queue"      },
    { id: TRAINING_SCREENS.CBT,          label: "s4b · CBT"        },
    { id: TRAINING_SCREENS.SIGN_OFF,     label: "s4c · Sign-off"   },
    { id: TRAINING_SCREENS.GROUP_LOG,    label: "s4d · Group"      },
    { id: TRAINING_SCREENS.LIBRARY,      label: "s4e · Library"    },
    { id: TRAINING_SCREENS.DETAIL,       label: "s4f · Detail"     },
    { id: TRAINING_SCREENS.COMPLIANCE,   label: "s4g · Compliance" },
    { id: TRAINING_SCREENS.STAFF_DETAIL, label: "s4h · Staff"      },
  ];

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: "#080F0C", borderTop: `2px solid ${C.forest}`,
      display: "flex", alignItems: "center", overflowX: "auto",
      scrollbarWidth: "none", padding: "0 8px",
    }}>
      <span style={{ fontSize: ".68rem", color: C.sage, fontFamily: "monospace", padding: "0 10px", flexShrink: 0, letterSpacing: ".05em" }}>DEV · F4</span>
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

export function TrainingApp({ user, companyName, initialScreen }) {
  return (
    <TrainingProvider user={user} companyName={companyName} initialScreen={initialScreen}>
      <div style={{ paddingBottom: IS_DEV ? 40 : 0 }}>
        <TrainingRouter onDone={() => console.log("Done → home")} />
      </div>
      {IS_DEV && <TrainingDevPanel />}
    </TrainingProvider>
  );
}
