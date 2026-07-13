import { createContext, useContext, useState, useEffect } from "react";
import { BRAND, ROLE_PERMS, TAB_CONFIG } from "./constants.js";
import { api } from "./api.js";
import { onQueueChange, queueCount } from "./offlineQueue.js";

// Optional account context — when provided (by App), EHSHeader shows an account menu
export const AccountContext = createContext(null);

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
        <div style={{ flex: 1, minWidth: 0, margin: "0 10px", fontSize: ".82rem", fontWeight: 600, color: "rgba(255,255,255,.6)", textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {title}
        </div>
      )}
      <div style={{ minWidth: 60, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10 }}>
        {rightContent ?? (
          <span style={{ fontSize: ".65rem", color: "rgba(255,255,255,.2)", fontFamily: "'DM Mono', monospace" }}>
            {BRAND.tagline.split(" ").slice(0, 4).join(" ")}…
          </span>
        )}
        <NotificationBell />
        <AccountButton />
      </div>
    </div>
  );
}

// ── Notification bell (poll every 60s; dropdown inbox) ───────────────────────
function NotificationBell() {
  const account = useContext(AccountContext);
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);

  const load = () => api.listNotifications().then(setItems).catch(() => {});
  useEffect(() => {
    if (!account?.user) return;
    load();
    const iv = setInterval(load, 60000);
    return () => clearInterval(iv);
  }, [account?.user?.id]);

  if (!account?.user) return null;
  const unread = items.filter(n => !n.read).length;

  function openPanel() {
    setOpen(o => !o);
    if (!open && unread) {
      api.markNotificationsRead().then(load).catch(() => {});
    }
  }

  return (
    <div style={{ position: "relative" }}>
      <button onClick={openPanel} title="Notifications" style={{
        width: 28, height: 28, borderRadius: "50%", position: "relative",
        background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.2)",
        color: "#fff", fontSize: ".85rem", cursor: "pointer", lineHeight: 1,
      }}>🔔
        {unread > 0 && (
          <span style={{
            position: "absolute", top: -4, right: -4, minWidth: 16, height: 16,
            background: "#C0392B", color: "#fff", borderRadius: 9, fontSize: ".6rem",
            fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center",
            padding: "0 3px", fontFamily: "'DM Sans', sans-serif",
          }}>{unread > 9 ? "9+" : unread}</span>
        )}
      </button>
      {open && (
        <div style={{
          position: "absolute", right: -40, top: 36, zIndex: 300,
          background: "#fff", borderRadius: 10, boxShadow: "0 8px 30px rgba(0,0,0,.25)",
          width: "min(320px, 88vw)", maxHeight: 380, overflowY: "auto",
          fontFamily: "'DM Sans', sans-serif",
        }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid #EEF2F0", fontSize: ".85rem", fontWeight: 700, color: "#0F1F17" }}>
            Notifications
          </div>
          {items.length === 0 && <div style={{ padding: 18, fontSize: ".8rem", color: "#8FA3A0" }}>Nothing yet.</div>}
          {items.map(n => (
            <div key={n.id}
              onClick={() => { if (n.link_kind) { setOpen(false); window.dispatchEvent(new CustomEvent("ehs:navigate", { detail: { kind: n.link_kind, ref: n.link_ref } })); } }}
              style={{ padding: "10px 14px", borderBottom: "1px solid #F5F8F6", background: n.read ? "#fff" : "#F3FAF5", cursor: n.link_kind ? "pointer" : "default" }}>
              <div style={{ fontSize: ".82rem", fontWeight: 700, color: "#0F1F17" }}>{n.title}</div>
              {n.body && <div style={{ fontSize: ".76rem", color: "#4A5568", marginTop: 2 }}>{n.body}</div>}
              <div style={{ fontSize: ".68rem", color: "#8FA3A0", marginTop: 3 }}>
                {(n.created_at ?? "").slice(0, 16).replace("T", " ")}{n.emailed ? " · 📧 emailed" : ""}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Account menu (avatar → change password / sign out) ────────────────────────
function AccountButton() {
  const account = useContext(AccountContext);
  const [open, setOpen] = useState(false);
  const [showPw, setShowPw] = useState(false);
  if (!account?.user) return null;
  const initial = (account.user.name ?? "?").trim().charAt(0).toUpperCase();
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(o => !o)} title="Account" style={{
        width: 28, height: 28, borderRadius: "50%",
        background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.2)",
        color: "#fff", fontSize: ".78rem", fontWeight: 700, cursor: "pointer",
        fontFamily: "'DM Sans', sans-serif", lineHeight: 1,
      }}>{initial}</button>
      {open && (
        <div style={{
          position: "absolute", right: 0, top: 36, zIndex: 300,
          background: "#fff", borderRadius: 10, boxShadow: "0 8px 30px rgba(0,0,0,.25)",
          minWidth: 190, overflow: "hidden", fontFamily: "'DM Sans', sans-serif",
        }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid #EEF2F0" }}>
            <div style={{ fontSize: ".85rem", fontWeight: 700, color: "#0F1F17" }}>{account.user.name}</div>
            <div style={{ fontSize: ".72rem", color: "#8FA3A0" }}>{account.user.email ?? account.user.role}</div>
          </div>
          {sessionStorage.getItem("ehs_operator_token") && (
            <button onClick={() => {
              localStorage.setItem("ehs_token", sessionStorage.getItem("ehs_operator_token"));
              sessionStorage.setItem("ehs_user", sessionStorage.getItem("ehs_operator_user") || "{}");
              sessionStorage.removeItem("ehs_operator_token");
              sessionStorage.removeItem("ehs_operator_user");
              window.location.reload();
            }} style={{ ...menuItemStyle, color: "#2D5A3D", fontWeight: 700 }}>← Return to operator</button>
          )}
          <button onClick={() => { setShowPw(true); setOpen(false); }} style={menuItemStyle}>Change password</button>
          <button onClick={() => { setOpen(false); account.onLogout?.(); }} style={{ ...menuItemStyle, color: "#C0392B" }}>Sign out</button>
        </div>
      )}
      {showPw && <ChangePasswordModal onClose={() => setShowPw(false)} />}
    </div>
  );
}
const menuItemStyle = {
  display: "block", width: "100%", textAlign: "left", padding: "10px 14px",
  background: "none", border: "none", cursor: "pointer",
  fontSize: ".85rem", color: "#0F1F17", fontFamily: "'DM Sans', sans-serif",
};

function ChangePasswordModal({ onClose }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const input = {
    width: "100%", padding: "10px 12px", border: "1.5px solid #D0DEDB",
    borderRadius: 7, fontSize: ".88rem", fontFamily: "'DM Sans', sans-serif",
    color: "#0F1F17", outline: "none", boxSizing: "border-box", marginBottom: 10,
  };
  async function submit(e) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      await api.changePassword(current, next);
      setMsg({ ok: true, text: "Password updated" });
      setTimeout(onClose, 900);
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally { setBusy(false); }
  }
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(15,31,23,.45)",
      zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <form onClick={e => e.stopPropagation()} onSubmit={submit} style={{
        background: "#fff", borderRadius: 12, padding: 22, width: "100%", maxWidth: 360,
        fontFamily: "'DM Sans', sans-serif", boxShadow: "0 20px 60px rgba(0,0,0,.3)",
      }}>
        <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0F1F17", marginBottom: 14 }}>Change password</h3>
        <input type="password" required placeholder="Current password" autoComplete="current-password"
          value={current} onChange={e => setCurrent(e.target.value)} style={input} />
        <input type="password" required minLength={8} placeholder="New password (8+ characters)" autoComplete="new-password"
          value={next} onChange={e => setNext(e.target.value)} style={input} />
        {msg && <div style={{ fontSize: ".8rem", marginBottom: 10, color: msg.ok ? "#4A8C5C" : "#C0392B" }}>{msg.text}</div>}
        <div style={{ display: "flex", gap: 10 }}>
          <button type="submit" disabled={busy} style={{
            flex: 1, padding: "10px 0", background: busy ? "#9BBBA6" : "#4A8C5C", color: "#fff",
            border: "none", borderRadius: 7, fontSize: ".88rem", fontWeight: 700, cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif",
          }}>{busy ? "Saving…" : "Update"}</button>
          <button type="button" onClick={onClose} style={{
            padding: "10px 16px", background: "none", border: "1px solid #D0DEDB",
            borderRadius: 7, fontSize: ".85rem", color: "#4A5568", cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif",
          }}>Cancel</button>
        </div>
      </form>
    </div>
  );
}

// ── Bottom tab bar ─────────────────────────────────────────────────────────────
function BottomTabBar({ tabs, activeTab, onTab }) {
  return (
    <div className="bottom-nav" style={{
      position: "fixed", bottom: 0, left: 0, right: 0,
      height: 58,
      background: "#2A4435",
      borderTop: "1px solid rgba(168,213,181,.25)",
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
              color: active ? "#D6EDDD" : "rgba(255,255,255,.65)",
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

  // Plant floors and warehouses have dead zones. Tell people plainly when they
  // are offline, so a failed submit reads as "no signal" rather than "app broken".
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [pending, setPending] = useState(0);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    queueCount().then(setPending);
    const unsub = onQueueChange(setPending);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
      unsub();
    };
  }, []);

  return (
    <RoleContext.Provider value={{ user, perms }}>
      {(!online || pending > 0) && (
        <div className="no-print" style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 500,
          background: online ? "#2A4435" : "#8A5A00", color: "#fff", textAlign: "center",
          padding: "6px 12px", fontSize: ".78rem", fontWeight: 600,
          fontFamily: "'DM Sans', sans-serif",
        }}>
          {!online
            ? (pending > 0
                ? `⚠ Offline — ${pending} report${pending === 1 ? "" : "s"} saved on this device, will send automatically`
                : "⚠ Offline — anything you report is saved and sent when you reconnect")
            : `📤 Sending ${pending} saved report${pending === 1 ? "" : "s"}…`}
        </div>
      )}
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
