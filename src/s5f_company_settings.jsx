import { useState, useEffect } from "react";
import { EHSHeader } from "./AppShell.jsx";
import { BRAND } from "./constants.js";
import { api } from "./api.js";

const C = {
  forest: "#1C3A2A", pine: "#2D5A3D", sage: "#4A8C5C",
  mint: "#A8D5B5", foam: "#E8F5EC", ink: "#0F1F17",
  slate: "#4A5568", mist: "#8FA3A0", chalk: "#F4F7F5",
  white: "#FFFFFF", gold: "#C8922A", red: "#C0392B", redLt: "#FDECEA",
};

const inputStyle = {
  width: "100%", padding: "9px 11px", border: "1.5px solid #D0DEDB", borderRadius: 7,
  fontFamily: "'DM Sans', sans-serif", fontSize: ".88rem", color: C.ink,
  outline: "none", background: C.white, boxSizing: "border-box",
};
const labelStyle = {
  fontSize: ".7rem", fontWeight: 600, letterSpacing: ".06em",
  textTransform: "uppercase", color: C.sage, marginBottom: 5, display: "block",
};

function Card({ title, children }) {
  return (
    <div style={{ background: C.white, borderRadius: 10, boxShadow: "0 2px 12px rgba(15,31,23,.07)", padding: 22, marginBottom: 18 }}>
      <h2 style={{ fontSize: "1rem", fontWeight: 700, color: C.ink, marginBottom: 16 }}>{title}</h2>
      {children}
    </div>
  );
}

export default function S5fCompanySettings({ companyName, onHome }) {
  const [cfg, setCfg]       = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [error, setError]   = useState(null);
  const [newSite, setNewSite] = useState({ name: "", location: "" });
  const [rules, setRules] = useState([]);
  const [users, setUsers] = useState([]);
  const [newRule, setNewRule] = useState({ event: "incident_injury", recipientRoles: ["admin", "safety"], recipientUsers: [], email: true });
  const [newDept, setNewDept] = useState("");

  useEffect(() => {
    api.fetchConfig().then(setCfg).catch(err => setError(err.message));
    api.notificationRules().then(setRules).catch(() => {});
    api.listUsers().then(setUsers).catch(() => {});
  }, []);

  const EVENTS = [
    { value: "incident_any",      label: "Any incident" },
    { value: "incident_injury",   label: "Injury / illness incident" },
    { value: "incident_critical", label: "Serious or critical severity" },
  ];
  const ROLES = ["admin", "safety", "site_manager", "trainer"];
  const toggleIn = (arr, v) => arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v];

  async function addRule(e) {
    e.preventDefault();
    try {
      await api.createNotificationRule(newRule);
      setRules(await api.notificationRules());
    } catch (err) { setError(err.message); }
  }
  async function removeRule(id) {
    try { await api.deleteNotificationRule(id); setRules(await api.notificationRules()); }
    catch (err) { setError(err.message); }
  }

  function set(field, value) { setCfg(c => ({ ...c, [field]: value })); setSaved(false); }
  function setTriage(field, value) { setCfg(c => ({ ...c, triage: { ...c.triage, [field]: value } })); setSaved(false); }

  async function saveCompany() {
    setSaving(true); setError(null);
    try {
      await api.updateConfig({
        company: cfg.company, shortName: cfg.shortName, industry: cfg.industry,
        tagline: cfg.tagline, triage: cfg.triage,
      });
      await api.fetchConfig();  // re-sync BRAND so every screen updates
      setSaved(true);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function addSite(e) {
    e.preventDefault();
    if (!newSite.name.trim()) return;
    try {
      await api.createSite({ name: newSite.name.trim(), location: newSite.location.trim() || null });
      setNewSite({ name: "", location: "" });
      setCfg(await api.fetchConfig());
    } catch (err) { setError(err.message); }
  }
  async function removeSite(id) {
    try { await api.updateSite(id, { active: 0 }); setCfg(await api.fetchConfig()); }
    catch (err) { setError(err.message); }
  }
  async function addDept(e) {
    e.preventDefault();
    if (!newDept.trim()) return;
    try {
      await api.createDepartment({ name: newDept.trim() });
      setNewDept("");
      setCfg(await api.fetchConfig());
    } catch (err) { setError(err.message); }
  }
  async function removeDept(id) {
    try { await api.updateDepartment(id, { active: 0 }); setCfg(await api.fetchConfig()); }
    catch (err) { setError(err.message); }
  }

  if (!cfg) return (
    <div style={{ minHeight: "100vh", background: C.chalk, fontFamily: "'DM Sans', sans-serif" }}>
      <EHSHeader onHome={onHome} title={companyName} />
      <div style={{ padding: 40, textAlign: "center", color: C.mist }}>{error ?? "Loading…"}</div>
    </div>
  );

  const chip = (text, onRemove) => (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      background: C.foam, color: C.pine, borderRadius: 20,
      padding: "6px 8px 6px 14px", fontSize: ".82rem", fontWeight: 600,
      marginRight: 8, marginBottom: 8,
    }}>
      {text}
      <button onClick={onRemove} title="Deactivate" style={{
        background: "rgba(0,0,0,.06)", border: "none", borderRadius: "50%",
        width: 20, height: 20, cursor: "pointer", color: C.pine,
        fontSize: ".7rem", lineHeight: 1,
      }}>✕</button>
    </span>
  );

  return (
    <div style={{ minHeight: "100vh", background: C.chalk, fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input::placeholder { color: ${C.mist}; }
        .save-btn:hover { background: ${C.pine} !important; }
      `}</style>

      <EHSHeader onHome={onHome} title={cfg.company} rightContent={
        <div style={{ fontSize: ".72rem", color: C.mist, background: "rgba(255,255,255,.08)", padding: "3px 12px", borderRadius: 20, whiteSpace: "nowrap" }}>
          Company Settings
        </div>
      } />

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "28px 24px" }}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: C.ink, marginBottom: 4 }}>Company Settings</h1>
        <p style={{ fontSize: ".85rem", color: C.mist, marginBottom: 22 }}>
          Changes apply immediately across every screen and every user.
        </p>

        {error && <div style={{ marginBottom: 16, padding: "10px 14px", background: C.redLt, color: C.red, borderRadius: 8, fontSize: ".85rem" }}>{error}</div>}

        <Card title="Identity">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div><label style={labelStyle}>Company name</label>
              <input style={inputStyle} value={cfg.company} onChange={e => set("company", e.target.value)} /></div>
            <div><label style={labelStyle}>Short name</label>
              <input style={inputStyle} value={cfg.shortName ?? ""} onChange={e => set("shortName", e.target.value)} /></div>
            <div><label style={labelStyle}>Industry</label>
              <input style={inputStyle} value={cfg.industry ?? ""} onChange={e => set("industry", e.target.value)} /></div>
            <div><label style={labelStyle}>Tagline</label>
              <input style={inputStyle} value={cfg.tagline ?? ""} onChange={e => set("tagline", e.target.value)} /></div>
          </div>
        </Card>

        <Card title="Triage line">
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr", gap: 14, alignItems: "end" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: ".88rem", color: C.ink, paddingBottom: 9 }}>
              <input type="checkbox" checked={!!cfg.triage?.enabled}
                onChange={e => setTriage("enabled", e.target.checked)} style={{ width: 16, height: 16, accentColor: C.sage }} />
              Enabled
            </label>
            <div><label style={labelStyle}>Provider name</label>
              <input style={inputStyle} value={cfg.triage?.providerName ?? ""} onChange={e => setTriage("providerName", e.target.value)} /></div>
            <div><label style={labelStyle}>Provider phone</label>
              <input style={inputStyle} value={cfg.triage?.providerPhone ?? ""} onChange={e => setTriage("providerPhone", e.target.value)} /></div>
          </div>
        </Card>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 26 }}>
          <button className="save-btn" onClick={saveCompany} disabled={saving} style={{
            padding: "10px 26px", background: saving ? "#9BBBA6" : C.sage, color: C.white,
            border: "none", borderRadius: 7, fontFamily: "'DM Sans', sans-serif",
            fontSize: ".9rem", fontWeight: 700, cursor: saving ? "default" : "pointer",
          }}>{saving ? "Saving…" : "Save changes"}</button>
          {saved && <span style={{ fontSize: ".82rem", color: C.sage, fontWeight: 600 }}>✓ Saved</span>}
        </div>

        <Card title="Notification rules">
          <p style={{ fontSize: ".8rem", color: C.mist, marginBottom: 12 }}>
            Matching events create in-app alerts for the recipients. Email adds an email copy (delivery setup pending).
          </p>
          {rules.map(r => (
            <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #F0F4F2", fontSize: ".84rem", flexWrap: "wrap", gap: 6 }}>
              <div>
                <b style={{ color: C.ink }}>{(
                  { incident_any: "Any incident", incident_injury: "Injury / illness", incident_critical: "Serious / critical" }[r.event] ?? r.event
                )}</b>
                <span style={{ color: C.mist, marginLeft: 8 }}>
                  → {[...JSON.parse(r.recipient_roles || "[]"),
                       ...JSON.parse(r.recipient_users || "[]").map(id => users.find(u => u.id === id)?.name ?? `#${id}`)
                     ].join(", ") || "no recipients"}
                  {r.email ? " · 📧 email" : ""}
                </span>
              </div>
              <button onClick={() => removeRule(r.id)} style={{ background: "none", border: "1px solid #D0DEDB", borderRadius: 6, padding: "4px 10px", fontSize: ".74rem", color: C.slate, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Remove</button>
            </div>
          ))}
          <form onSubmit={addRule} style={{ marginTop: 14 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
              <select style={{ ...inputStyle, width: 220 }} value={newRule.event}
                onChange={e => setNewRule(r => ({ ...r, event: e.target.value }))}>
                {EVENTS.map(ev => <option key={ev.value} value={ev.value}>{ev.label}</option>)}
              </select>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: ".82rem", color: C.ink }}>
                <input type="checkbox" checked={newRule.email} style={{ accentColor: C.sage }}
                  onChange={e => setNewRule(r => ({ ...r, email: e.target.checked }))} /> also email
              </label>
            </div>
            <div style={{ marginBottom: 8 }}>
              {ROLES.map(role => (
                <button type="button" key={role} onClick={() => setNewRule(r => ({ ...r, recipientRoles: toggleIn(r.recipientRoles, role) }))} style={{
                  padding: "5px 12px", borderRadius: 20, fontSize: ".76rem", fontWeight: 600, marginRight: 6, marginBottom: 6,
                  border: `1.5px solid ${newRule.recipientRoles.includes(role) ? C.sage : "#D0DEDB"}`,
                  background: newRule.recipientRoles.includes(role) ? C.foam : C.white,
                  color: newRule.recipientRoles.includes(role) ? C.pine : C.slate,
                  cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                }}>{newRule.recipientRoles.includes(role) ? "✓ " : ""}{role.replace("_", " ")}</button>
              ))}
              {users.filter(u => u.active).map(u => (
                <button type="button" key={u.id} onClick={() => setNewRule(r => ({ ...r, recipientUsers: toggleIn(r.recipientUsers, u.id) }))} style={{
                  padding: "5px 12px", borderRadius: 20, fontSize: ".76rem", fontWeight: 600, marginRight: 6, marginBottom: 6,
                  border: `1.5px dashed ${newRule.recipientUsers.includes(u.id) ? C.sage : "#D0DEDB"}`,
                  background: newRule.recipientUsers.includes(u.id) ? C.foam : C.white,
                  color: newRule.recipientUsers.includes(u.id) ? C.pine : C.slate,
                  cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                }}>{newRule.recipientUsers.includes(u.id) ? "✓ " : ""}{u.name}</button>
              ))}
            </div>
            <button type="submit" style={{ padding: "8px 18px", background: C.foam, color: C.pine, border: `1.5px solid ${C.mint}`, borderRadius: 7, fontFamily: "'DM Sans', sans-serif", fontSize: ".82rem", fontWeight: 700, cursor: "pointer" }}>+ Add rule</button>
          </form>
        </Card>

        <Card title={`Sites (${cfg.sites.length})`}>
          <div style={{ marginBottom: 12 }}>
            {cfg.sites.map(s => chip(`${s.name}${s.location ? ` · ${s.location}` : ""}`, () => removeSite(s.id)))}
          </div>
          <form onSubmit={addSite} style={{ display: "flex", gap: 10 }}>
            <input style={{ ...inputStyle, width: 180 }} placeholder="Site name" value={newSite.name}
              onChange={e => setNewSite(s => ({ ...s, name: e.target.value }))} />
            <input style={{ ...inputStyle, width: 200 }} placeholder="Location (optional)" value={newSite.location}
              onChange={e => setNewSite(s => ({ ...s, location: e.target.value }))} />
            <button type="submit" style={{ padding: "9px 18px", background: C.foam, color: C.pine, border: `1.5px solid ${C.mint}`, borderRadius: 7, fontFamily: "'DM Sans', sans-serif", fontSize: ".85rem", fontWeight: 600, cursor: "pointer" }}>+ Add site</button>
          </form>
        </Card>

        <Card title={`Departments (${cfg.departments.length})`}>
          <div style={{ marginBottom: 12 }}>
            {cfg.departments.map(d => chip(d.name, () => removeDept(d.id)))}
          </div>
          <form onSubmit={addDept} style={{ display: "flex", gap: 10 }}>
            <input style={{ ...inputStyle, width: 260 }} placeholder="Department name" value={newDept}
              onChange={e => setNewDept(e.target.value)} />
            <button type="submit" style={{ padding: "9px 18px", background: C.foam, color: C.pine, border: `1.5px solid ${C.mint}`, borderRadius: 7, fontFamily: "'DM Sans', sans-serif", fontSize: ".85rem", fontWeight: 600, cursor: "pointer" }}>+ Add department</button>
          </form>
        </Card>
      </div>
    </div>
  );
}
