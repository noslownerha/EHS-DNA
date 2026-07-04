import { useState, useEffect } from "react";
import { EHSHeader } from "./AppShell.jsx";
import { BRAND } from "./constants.js";
import { api } from "./api.js";

const C = {
  forest: "#1C3A2A", pine: "#2D5A3D", sage: "#4A8C5C",
  mint: "#A8D5B5", foam: "#E8F5EC", ink: "#0F1F17",
  slate: "#4A5568", mist: "#8FA3A0", chalk: "#F4F7F5",
  white: "#FFFFFF", gold: "#C8922A", goldLt: "#FDF3E3",
  red: "#C0392B", redLt: "#FDECEA",
};

const ROLE_LABELS = {
  admin: "Admin", safety: "Safety Officer", site_manager: "Site Manager",
  trainer: "Trainer", staff: "Staff",
};

function DesktopNav({ companyName = BRAND.company, onHome }) {
  return (
    <EHSHeader onHome={onHome} title={companyName} rightContent={
      <div style={{ fontSize: ".72rem", color: C.mist, background: "rgba(255,255,255,.08)", padding: "3px 12px", borderRadius: 20, whiteSpace: "nowrap" }}>
        Manage Staff
      </div>
    } />
  );
}

const inputStyle = {
  padding: "8px 10px", border: "1.5px solid #D0DEDB", borderRadius: 7,
  fontFamily: "'DM Sans', sans-serif", fontSize: ".85rem", color: C.ink,
  outline: "none", background: C.white,
};

export default function S5eManageStaff({ companyName, onHome }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", role: "staff", siteId: "" });
  const [saving, setSaving] = useState(false);
  const [lastCreated, setLastCreated] = useState(null); // { email, tempPassword }

  const sites = BRAND.siteRecords ?? [];

  function load() {
    setLoading(true);
    api.listUsers().then(setUsers).catch(err => setError(err.message)).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function handleAdd(e) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      const out = await api.createUser({
        email: form.email, name: form.name, role: form.role,
        siteId: form.siteId ? Number(form.siteId) : null,
      });
      setLastCreated({ email: form.email, tempPassword: out.tempPassword });
      setForm({ email: "", name: "", role: "staff", siteId: "" });
      setShowAdd(false);
      load();
    } catch (err) {
      setError(err.status === 409 ? "That email is already registered" : err.message);
    } finally {
      setSaving(false);
    }
  }

  function toggleActive(u) {
    api.updateUser(u.id, { active: u.active ? 0 : 1 }).then(load).catch(err => setError(err.message));
  }

  const thStyle = {
    padding: "9px 14px", textAlign: "left", fontSize: ".7rem", fontWeight: 600,
    letterSpacing: ".06em", textTransform: "uppercase", color: C.mist,
    borderBottom: "1px solid #E2EBE6", background: C.chalk, whiteSpace: "nowrap",
  };

  return (
    <div style={{ minHeight: "100vh", background: C.chalk, fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input::placeholder { color: ${C.mist}; }
        select option { color: ${C.ink}; }
        .staff-row:hover td { background: ${C.foam} !important; }
        .add-btn:hover { background: ${C.pine} !important; }
      `}</style>

      <DesktopNav companyName={companyName} onHome={onHome} />

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: C.ink }}>Staff Accounts</h1>
            <p style={{ fontSize: ".85rem", color: C.mist, marginTop: 3 }}>{users.length} accounts</p>
          </div>
          <button className="add-btn" onClick={() => { setShowAdd(s => !s); setLastCreated(null); }} style={{
            padding: "9px 20px", background: C.sage, color: C.white, border: "none",
            borderRadius: 7, fontFamily: "'DM Sans', sans-serif", fontSize: ".88rem",
            fontWeight: 600, cursor: "pointer",
          }}>{showAdd ? "Cancel" : "+ Add staff"}</button>
        </div>

        {error && (
          <div style={{ marginBottom: 16, padding: "10px 14px", background: C.redLt, color: C.red, borderRadius: 8, fontSize: ".85rem" }}>
            {error}
          </div>
        )}

        {lastCreated && (
          <div style={{ marginBottom: 16, padding: "12px 16px", background: C.foam, borderRadius: 8, fontSize: ".85rem", color: C.ink }}>
            <strong>{lastCreated.email}</strong> created.
            {lastCreated.tempPassword && (
              <> Temporary password: <span style={{ fontFamily: "'DM Mono', monospace", background: C.white, padding: "2px 8px", borderRadius: 5 }}>{lastCreated.tempPassword}</span> — share this securely; they should change it on first login.</>
            )}
          </div>
        )}

        {showAdd && (
          <form onSubmit={handleAdd} style={{
            background: C.white, borderRadius: 10, boxShadow: "0 2px 12px rgba(15,31,23,.07)",
            padding: 20, marginBottom: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12,
          }}>
            <input required type="email" placeholder="Email" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} />
            <input required placeholder="Full name" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} />
            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} style={inputStyle}>
              {Object.entries(ROLE_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
            <select value={form.siteId} onChange={e => setForm(f => ({ ...f, siteId: e.target.value }))} style={inputStyle}>
              <option value="">No site</option>
              {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button type="submit" disabled={saving} style={{
              gridColumn: "1 / -1", padding: "9px 20px", background: saving ? "#9BBBA6" : C.sage,
              color: C.white, border: "none", borderRadius: 7, fontFamily: "'DM Sans', sans-serif",
              fontSize: ".88rem", fontWeight: 600, cursor: saving ? "default" : "pointer",
            }}>{saving ? "Creating…" : "Create account"}</button>
          </form>
        )}

        <div style={{ background: C.white, borderRadius: 10, boxShadow: "0 2px 12px rgba(15,31,23,.07)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>{["Name", "Email", "Role", "Site", "Department", "Status", ""].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ padding: 28, textAlign: "center", color: C.mist, fontSize: ".85rem" }}>Loading…</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 28, textAlign: "center", color: C.mist, fontSize: ".85rem" }}>No staff yet.</td></tr>
              ) : users.map(u => (
                <tr key={u.id} className="staff-row">
                  <td style={{ padding: "11px 14px", borderBottom: "1px solid #F0F4F2", fontSize: ".85rem", color: C.ink, fontWeight: 600 }}>{u.name}</td>
                  <td style={{ padding: "11px 14px", borderBottom: "1px solid #F0F4F2", fontSize: ".82rem", color: C.slate }}>{u.email}</td>
                  <td style={{ padding: "11px 14px", borderBottom: "1px solid #F0F4F2", fontSize: ".82rem", color: C.slate }}>{ROLE_LABELS[u.role] ?? u.role}</td>
                  <td style={{ padding: "11px 14px", borderBottom: "1px solid #F0F4F2", fontSize: ".82rem", color: C.slate }}>{u.site ?? "—"}</td>
                  <td style={{ padding: "11px 14px", borderBottom: "1px solid #F0F4F2", fontSize: ".82rem", color: C.slate }}>{u.department ?? "—"}</td>
                  <td style={{ padding: "11px 14px", borderBottom: "1px solid #F0F4F2" }}>
                    <span style={{
                      fontSize: ".72rem", fontWeight: 600, padding: "3px 10px", borderRadius: 20,
                      background: u.active ? C.foam : C.redLt, color: u.active ? C.sage : C.red,
                    }}>{u.active ? "Active" : "Inactive"}</span>
                  </td>
                  <td style={{ padding: "11px 14px", borderBottom: "1px solid #F0F4F2", textAlign: "right" }}>
                    <button onClick={async () => {
                      try {
                        const out = await api.updateUser(u.id, { resetPassword: true });
                        setLastCreated({ email: u.email, tempPassword: out.tempPassword });
                      } catch (err) { setError(err.message); }
                    }} style={{
                      background: "none", border: "1px solid #D0DEDB", borderRadius: 6,
                      padding: "5px 12px", fontSize: ".76rem", color: C.slate, cursor: "pointer",
                      fontFamily: "'DM Sans', sans-serif", marginRight: 6,
                    }}>Reset password</button>
                    <button onClick={() => toggleActive(u)} style={{
                      background: "none", border: "1px solid #D0DEDB", borderRadius: 6,
                      padding: "5px 12px", fontSize: ".76rem", color: C.slate, cursor: "pointer",
                      fontFamily: "'DM Sans', sans-serif",
                    }}>{u.active ? "Deactivate" : "Reactivate"}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
