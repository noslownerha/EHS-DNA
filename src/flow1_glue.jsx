/**
 * EHS DNA — Flow 1 Glue Layer
 * ─────────────────────────────────
 * Exports:
 *   FlowProvider   — wraps your app; holds all onboarding state
 *   useFlow        — hook to read/write flow state from any screen
 *   FlowRouter     — drop-in component that renders the right screen
 *                    and passes correct props + navigation callbacks
 *
 * Usage (e.g. index.jsx or App.jsx):
 *
 *   import { FlowProvider, FlowRouter } from "./flow1_glue";
 *
 *   export default function App() {
 *     return (
 *       <FlowProvider>
 *         <FlowRouter />
 *       </FlowProvider>
 *     );
 *   }
 */

import { createContext, useContext, useReducer, useCallback } from "react";

import S1aLogin                      from "./s1a_login";
import S1b1CompanyInfo               from "./s1b1_company_info";
import S1b2AddSites                  from "./s1b2_add_sites";
import S1b3Departments               from "./s1b3_departments";
import S1b4AddStaff                  from "./s1b4_add_staff";
import { S1b5TrainingGroups,
         S1b6SetupComplete }          from "./s1b5_s1b6_training_complete";
import S1cOrgChart                   from "./s1c_org_chart";

// ─────────────────────────────────────────────────────────────────────────────
// Screen IDs (single source of truth for navigation)
// ─────────────────────────────────────────────────────────────────────────────
export const SCREENS = {
  LOGIN:        "s1a",
  COMPANY:      "s1b1",
  SITES:        "s1b2",
  DEPARTMENTS:  "s1b3",
  STAFF:        "s1b4",
  TRAINING:     "s1b5",
  COMPLETE:     "s1b6",
  ORG_CHART:    "s1c",
};

// ─────────────────────────────────────────────────────────────────────────────
// Initial state shape
// ─────────────────────────────────────────────────────────────────────────────
const INITIAL_STATE = {
  screen: SCREENS.LOGIN,
  history: [],                 // for back navigation

  // s1a
  auth: null,                  // { email, keepSignedIn }

  // s1b1
  company: {
    companyName:  "",
    industry:     "Spirits / Distilling",
    siteCount:    "4–6",
    contactName:  "",
    billingEmail: "",
    apEmail:      "",
  },

  // s1b2
  sites: [],                   // [{ id, name, location, tz, status, manager }]

  // s1b3
  departments: [],             // [{ id, name, emoji, autoOnboard, requireOrientation, lead }]

  // s1b4
  staff: [],                   // [{ id, first, last, email, mobile, site, dept, role, invited }]

  // s1b5
  manualGroups: [],            // [{ id, name, emoji, recurrence, members }]
};

// ─────────────────────────────────────────────────────────────────────────────
// Reducer
// ─────────────────────────────────────────────────────────────────────────────
function reducer(state, action) {
  switch (action.type) {

    case "NAVIGATE": {
      // Push current screen to history unless we're going back
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

    case "SAVE_AUTH":
      return { ...state, auth: action.payload };

    case "SAVE_COMPANY":
      return { ...state, company: { ...state.company, ...action.payload } };

    case "SAVE_SITES":
      return { ...state, sites: action.payload };

    case "SAVE_DEPARTMENTS":
      return { ...state, departments: action.payload };

    case "SAVE_STAFF":
      return { ...state, staff: action.payload };

    case "SAVE_MANUAL_GROUPS":
      return { ...state, manualGroups: action.payload };

    case "RESET":
      return { ...INITIAL_STATE };

    default:
      return state;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────
const FlowContext = createContext(null);

export function FlowProvider({ children, initialScreen = SCREENS.LOGIN }) {
  const [state, dispatch] = useReducer(reducer, {
    ...INITIAL_STATE,
    screen: initialScreen,
  });

  const navigate = useCallback((screen, { replace = false } = {}) => {
    dispatch({ type: "NAVIGATE", screen, replace });
  }, []);

  const back = useCallback(() => {
    dispatch({ type: "BACK" });
  }, []);

  const save = useCallback((type, payload) => {
    dispatch({ type, payload });
  }, []);

  return (
    <FlowContext.Provider value={{ state, navigate, back, save }}>
      {children}
    </FlowContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────
export function useFlow() {
  const ctx = useContext(FlowContext);
  if (!ctx) throw new Error("useFlow must be used inside <FlowProvider>");
  return ctx;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility: build s1c org structure from flow state
// ─────────────────────────────────────────────────────────────────────────────
export function buildOrgFromFlowState({ sites, departments, staff }) {
  return sites.map((site, si) => ({
    id:       site.id ?? si + 1,
    name:     site.name,
    location: site.location,
    status:   site.status ?? "Active",
    expanded: si === 0,          // first site open by default
    departments: departments.map((dept, di) => ({
      id:    dept.id ?? di + 1,
      emoji: dept.emoji ?? "⚙️",
      name:  dept.name,
      lead:  dept.lead ?? null,
      staff: staff
        .filter(p => p.site === site.name && p.dept === dept.name)
        .map(p => ({ id: p.id, first: p.first, last: p.last })),
    })),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Derived selectors (memoize in components via useMemo if needed)
// ─────────────────────────────────────────────────────────────────────────────
export function selectSiteNames(state) {
  return state.sites.map(s => s.name);
}

export function selectDeptNames(state) {
  return state.departments.map(d => d.name);
}

// ─────────────────────────────────────────────────────────────────────────────
// FlowRouter — the single component you mount; renders the right screen
// ─────────────────────────────────────────────────────────────────────────────
export function FlowRouter() {
  const { state, navigate, back, save } = useFlow();
  const { screen, company, sites, departments, staff } = state;

  switch (screen) {

    // ── s1a: Login ──────────────────────────────────────────────────────────
    case SCREENS.LOGIN:
      return (
        <S1aLogin
          onSignIn={(auth) => {
            save("SAVE_AUTH", auth);
            navigate(SCREENS.COMPANY);
          }}
          onStartSetup={() => navigate(SCREENS.COMPANY)}
        />
      );

    // ── s1b1: Company Info ──────────────────────────────────────────────────
    case SCREENS.COMPANY:
      return (
        <S1b1CompanyInfo
          initialData={company}
          onBack={back}
          onContinue={(data) => {
            save("SAVE_COMPANY", data);
            navigate(SCREENS.SITES);
          }}
        />
      );

    // ── s1b2: Add Sites ─────────────────────────────────────────────────────
    case SCREENS.SITES:
      return (
        <S1b2AddSites
          initialSites={sites.length > 0 ? sites : undefined}
          onBack={back}
          onContinue={({ sites: newSites }) => {
            save("SAVE_SITES", newSites);
            navigate(SCREENS.DEPARTMENTS);
          }}
        />
      );

    // ── s1b3: Departments ───────────────────────────────────────────────────
    case SCREENS.DEPARTMENTS:
      return (
        <S1b3Departments
          industry={company.industry}
          onBack={back}
          onContinue={({ departments: newDepts }) => {
            save("SAVE_DEPARTMENTS", newDepts);
            navigate(SCREENS.STAFF);
          }}
        />
      );

    // ── s1b4: Add Staff ─────────────────────────────────────────────────────
    case SCREENS.STAFF:
      return (
        <S1b4AddStaff
          sites={selectSiteNames(state)}
          departments={selectDeptNames(state)}
          initialStaff={staff.length > 0 ? staff : undefined}
          onBack={back}
          onContinue={({ staff: newStaff }) => {
            save("SAVE_STAFF", newStaff);
            navigate(SCREENS.TRAINING);
          }}
        />
      );

    // ── s1b5: Training Groups ───────────────────────────────────────────────
    case SCREENS.TRAINING:
      return (
        <S1b5TrainingGroups
          departments={departments}
          onBack={back}
          onContinue={({ manualGroups }) => {
            save("SAVE_MANUAL_GROUPS", manualGroups);
            navigate(SCREENS.COMPLETE);
          }}
        />
      );

    // ── s1b6: Setup Complete ────────────────────────────────────────────────
    case SCREENS.COMPLETE:
      return (
        <S1b6SetupComplete
          companyName={company.companyName}
          industry={company.industry}
          sites={selectSiteNames(state)}
          departments={departments}
          staff={staff}
          onOrgChart={()         => navigate(SCREENS.ORG_CHART)}
          onLogIncident={()      => console.log("→ Log Incident (Flow 2)")}
          onStartInspection={()  => console.log("→ Start Inspection (Flow 3)")}
          onDashboard={()        => console.log("→ Dashboard")}
          onResumeStaff={()      => navigate(SCREENS.STAFF)}
        />
      );

    // ── s1c: Org Chart ──────────────────────────────────────────────────────
    case SCREENS.ORG_CHART:
      return (
        <S1cOrgChart
          companyName={company.companyName}
          initialOrg={buildOrgFromFlowState({ sites, departments, staff })}
          onAddStaff={() => navigate(SCREENS.STAFF)}
          onAddSite={()  => navigate(SCREENS.SITES)}
        />
      );

    default:
      return (
        <div style={{ padding: 40, fontFamily: "sans-serif", color: "#C0392B" }}>
          Unknown screen: <code>{screen}</code>
        </div>
      );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Optional: DevPanel — renders a screen switcher overlay for development
// Remove before shipping to production.
// ─────────────────────────────────────────────────────────────────────────────
export function DevPanel() {
  const { state, navigate } = useFlow();

  const screens = [
    { id: SCREENS.LOGIN,       label: "1a · Login"         },
    { id: SCREENS.COMPANY,     label: "1b1 · Company"      },
    { id: SCREENS.SITES,       label: "1b2 · Sites"        },
    { id: SCREENS.DEPARTMENTS, label: "1b3 · Departments"  },
    { id: SCREENS.STAFF,       label: "1b4 · Staff"        },
    { id: SCREENS.TRAINING,    label: "1b5 · Training"     },
    { id: SCREENS.COMPLETE,    label: "1b6 · Complete"     },
    { id: SCREENS.ORG_CHART,   label: "1c · Org Chart"     },
  ];

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: "#0F1F17", borderTop: "2px solid #2D5A3D",
      display: "flex", alignItems: "center", gap: 0,
      overflowX: "auto", scrollbarWidth: "none",
      padding: "0 8px",
    }}>
      <span style={{
        fontSize: ".68rem", color: "#4A8C5C", fontFamily: "monospace",
        padding: "0 10px", flexShrink: 0, letterSpacing: ".05em",
      }}>DEV</span>
      {screens.map(s => (
        <button
          key={s.id}
          onClick={() => navigate(s.id, { replace: true })}
          style={{
            padding: "9px 14px",
            background: state.screen === s.id ? "#2D5A3D" : "none",
            color: state.screen === s.id ? "#A8D5B5" : "#8FA3A0",
            border: "none", borderBottom: state.screen === s.id ? "2px solid #4A8C5C" : "2px solid transparent",
            fontFamily: "'DM Sans', monospace", fontSize: ".72rem",
            fontWeight: state.screen === s.id ? 700 : 400,
            cursor: "pointer", whiteSpace: "nowrap",
            transition: "all .15s",
          }}
        >{s.label}</button>
      ))}
    </div>
  );
}
