import { createContext, useContext } from "react";
import { BRAND, ROLE_PERMS, TAB_CONFIG } from "./constants.js";

const RoleContext = createContext(null);
export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be inside AppShell");
  return ctx;
}

// ── EHS DNA header — on every screen, logo taps to role dashboard ─────────────
export function EHSHeader({ onHome, title, rightContent, dark = false }) {
  const bg     = dark ? "#1A1A2E" : "#1C3A2A";
  const accent = dark ? "#00B4D8" : "#A8D5B5";
  return (
    <div style={{
      height: 52, background: bg,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 18px",
      boxShadow: "0 2px 10px rgba(0,0,0,.2)",
      position: "sticky", top: 0, zIndex: 100, flexShrink: 0,
    }}>
      <button onClick={onHome} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, padding: 0 }}>
        <span style={{ fontSize: "1rem" }}>🧬</span>
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: ".88rem", fontWeight: 600, letterSpacing: ".06em", color: accent }}>
          <span style={{ color: "#fff" }}>EHS</span> DNA
        </span>
      </button>
      {title && (
        <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", fontSize: ".82rem", fontWeight: 600, color: "rgba(255,255,255,.6)", pointerEvents: "none" }}>
          {title}
        </div>
      )}
      <div style={{ minWidth: 60, display: "flex", justifyContent: "flex-end" }}>
        {rightContent ?? (
          <span style={{ fontSize: ".65rem", color: "rgba(255,255,255,.2)", fontFamily: "'DM Mono', monospace" }}>
            {BRAND.tagline.split(" ").slice(0, 4).join(" ")}…
          </span>
        )}
      </div>
    </div>
  );
}

// ── Bottom tab bar ─────────────────────────────────────────────────────────────
function BottomTabBar({ tabs, activeTab, onTab }) {
  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0,
      height: 58,
      background: "#0F1F17",
      borderTop: "1px solid rgba(168,213,181,.12)",
      display: "flex", zIndex: 200,
      boxShadow: "0 -4px 20px rgba(0,0,0,.3)",
    }}>
      <style>{`.tab-btn-inner{transition:all .15s ease;}.tab-btn-inner:active{transform:scale(.9);}`}</style>
      {tabs.map(tabId => {
        const cfg    = TAB_CONFIG[tabId];
        const active = activeTab === tabId;
        if (!cfg) return null;
        return (
          <button key={tabId} onClick={() => onTab(tabId)} style={{
            flex: 1, background: "none", border: "none", cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 3, padding: "6px 2px 4px", position: "relative",
          }}>
            {active && (
              <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 24, height: 2, background: "#4A8C5C", borderRadius: "0 0 2px 2px" }} />
            )}
            <div className="tab-btn-inner">
              <span style={{ fontSize: "1.1rem", lineHeight: 1 }}>{cfg.icon}</span>
            </div>
            <span style={{
              fontSize: ".58rem", fontWeight: active ? 700 : 400,
              color: active ? "#A8D5B5" : "rgba(255,255,255,.3)",
              fontFamily: "'DM Sans', sans-serif", letterSpacing: ".03em", transition: "color .15s",
            }}>{cfg.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── AppShell ───────────────────────────────────────────────────────────────────
// Bucket 1.4 fix: paddingBottom on inner content wrapper = 58px (nav height) + 20px buffer = 78px
// This ensures bottom CTAs on ALL screens are never hidden behind the nav bar.
export default function AppShell({ user, children, activeTab, onTab }) {
  const perms = ROLE_PERMS[user.role] ?? ROLE_PERMS.staff;
  const tabs  = perms.tabs;

  return (
    <RoleContext.Provider value={{ user, perms }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }

        /* ── Bucket 1.4: Global bottom padding fix ──────────────────────────
           Every scrollable content area needs clearance for the fixed bottom
           nav bar (58px) + a comfortable buffer (20px) = 78px.
           Applied globally here so no individual screen needs to manage it.
           Screens that already set paddingBottom will override this with max. */
        .ehs-content-root > * {
          padding-bottom: max(78px, var(--screen-pb, 78px)) !important;
        }

        /* Any fixed bottom action bar inside a screen should sit above the nav */
        .ehs-fixed-bottom {
          bottom: 58px !important;
        }
      `}</style>
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#F4F7F5", fontFamily: "'DM Sans', sans-serif" }}>
        {/* Content wrapper — gives global bottom clearance */}
        <div className="ehs-content-root" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {children}
        </div>
        <BottomTabBar tabs={tabs} activeTab={activeTab} onTab={onTab} />
      </div>
    </RoleContext.Provider>
  );
}
