import { useState, useEffect } from "react";
import { EHSHeader } from "./AppShell.jsx";
import { BRAND, COLORS } from "./constants.js";
import { api } from "./api.js";

const C = { ...COLORS };

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
  const [editing, setEditing] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [importRows, setImportRows] = useState(null);   // parsed preview
  const [importResult, setImportResult] = useState(null);
  const [importBusy, setImportBusy] = useState(false);

  function downloadTemplate() {
    const siteNames = sites.map(s => s.name).join(" | ");
    const deptNames = (BRAND.departmentRecords ?? []).map(d => d.name).join(" | ");
    const csv = [
      "name,email,role,site,department",
      `John Smith,jsmith@company.com,staff,${sites[0]?.name ?? ""},${(BRAND.departmentRecords ?? [])[0]?.name ?? ""}`,
      `# Delete this row and the example above. Roles: staff | trainer | site_manager | safety | admin`,
      `# Sites: ${siteNames}`,
      `# Departments: ${deptNames}`,
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "staff-import-template.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function parseCsv(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim() && !l.trim().startsWith("#"));
    const header = lines[0].split(",").map(h => h.trim().toLowerCase());
    const idx = k => header.indexOf(k);
    if (idx("name") < 0 || idx("email") < 0) throw new Error("Header row must include: name,email,role,site,department");
    return lines.slice(1).map(l => {
      // handle quoted cells with commas
      const cells = l.match(/("([^"]|"")*"|[^,]*)(,|$)/g)?.map(c => c.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"').trim()) ?? l.split(",");
      return { name: cells[idx("name")] ?? "", email: cells[idx("email")] ?? "",
               role: cells[idx("role")] ?? "", site: cells[idx("site")] ?? "",
               department: cells[idx("department")] ?? "" };
    }).filter(r => r.name || r.email);
  }

  function handleImportFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try { setImportRows(parseCsv(String(reader.result))); setImportResult(null); setError(null); }
      catch (err) { setError(err.message); }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  async function runImport() {
    setImportBusy(true); setError(null);
    try {
      const out = await api.bulkCreateUsers(importRows);
      setImportResult(out);
      setImportRows(null);
      load();
    } catch (err) { setError(err.message); }
    finally { setImportBusy(false); }
  }

  const depts = BRAND.departmentRecords ?? [];
  async function saveEdit(e) {
    e.preventDefault();
    try {
      await api.updateUser(editing.id, {
        name: editing.name, role: editing.role,
        siteId: editing.siteId ? Number(editing.siteId) : null,
        departmentId: editing.departmentId ? Number(editing.departmentId) : null,
      });
      setEditing(null);
      load();
    } catch (err) { setError(err.message); }
  }

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
        departmentId: form.departmentId ? Number(form.departmentId) : null,
      });
      setLastCreated({ email: form.email, tempPassword: out.tempPassword });
      setForm({ email: "", name: "", role: "staff", siteId: "", departmentId: "" });
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
          <div>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: C.ink }}>Staff Accounts</h1>
            <p style={{ fontSize: ".85rem", color: C.mist, marginTop: 3 }}>{users.length} accounts</p>
          </div>
          <button className="add-btn" onClick={() => { setShowAdd(s => !s); setLastCreated(null); }} style={{
            padding: "9px 20px", background: C.sage, color: C.white, border: "none",
            borderRadius: 7, fontFamily: "'DM Sans', sans-serif", fontSize: ".88rem",
            fontWeight: 600, cursor: "pointer",
          }}>{showAdd ? "Cancel" : "+ Add staff"}</button>
          <button onClick={() => { setShowImport(true); setImportRows(null); setImportResult(null); }} style={{
            padding: "9px 16px", background: C.foam, color: C.pine, border: "1.5px solid #A8D5B5",
            borderRadius: 7, fontFamily: "'DM Sans', sans-serif", fontSize: ".84rem", fontWeight: 700,
            cursor: "pointer",
          }}>📥 Bulk import</button>
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
            padding: 20, marginBottom: 20, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12,
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
            <select value={form.departmentId ?? ""} onChange={e => setForm(f => ({ ...f, departmentId: e.target.value }))} style={inputStyle}>
              <option value="">No department</option>
              {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <button type="submit" disabled={saving} style={{
              gridColumn: "1 / -1", padding: "9px 20px", background: saving ? "#9BBBA6" : C.sage,
              color: C.white, border: "none", borderRadius: 7, fontFamily: "'DM Sans', sans-serif",
              fontSize: ".88rem", fontWeight: 600, cursor: saving ? "default" : "pointer",
            }}>{saving ? "Creating…" : "Create account"}</button>
          </form>
        )}

        <div style={{ background: C.white, borderRadius: 10, boxShadow: "0 2px 12px rgba(15,31,23,.07)", overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 680, borderCollapse: "collapse" }}>
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
                    <button onClick={() => setEditing({
                      id: u.id, name: u.name, role: u.role, email: u.email,
                      siteId: sites.find(s => s.name === u.site)?.id ?? "",
                      departmentId: depts.find(d => d.name === u.department)?.id ?? "",
                    })} style={{
                      background: "none", border: "1px solid #D0DEDB", borderRadius: 6,
                      padding: "5px 12px", fontSize: ".76rem", color: C.pine, cursor: "pointer",
                      fontFamily: "'DM Sans', sans-serif", marginRight: 6,
                    }}>Edit</button>
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

      {showImport && (
        <div onClick={() => !importBusy && setShowImport(false)} style={{ position: "fixed", inset: 0, background: "rgba(15,31,23,.45)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.white, borderRadius: 12, padding: 22, width: "100%", maxWidth: 560, maxHeight: "86vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,.3)" }}>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: C.ink, marginBottom: 4 }}>Bulk staff import</h3>
            <p style={{ fontSize: ".8rem", color: C.mist, marginBottom: 14 }}>
              1. Download the template · 2. Fill one row per person · 3. Upload — accounts are created with temp passwords.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
              <button onClick={downloadTemplate} style={{ padding: "9px 16px", background: C.white, color: C.pine, border: "1.5px solid #A8D5B5", borderRadius: 7, fontFamily: "'DM Sans', sans-serif", fontSize: ".82rem", fontWeight: 700, cursor: "pointer" }}>⬇ Download template (CSV)</button>
              <label style={{ padding: "9px 16px", background: C.foam, color: C.pine, borderRadius: 7, fontSize: ".82rem", fontWeight: 700, cursor: "pointer", border: "1.5px solid #A8D5B5" }}>
                ⬆ Upload filled template
                <input type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={handleImportFile} />
              </label>
            </div>

            {importRows && (
              <>
                <div style={{ fontSize: ".84rem", fontWeight: 700, color: C.ink, marginBottom: 8 }}>{importRows.length} people ready to import</div>
                <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid #E8EFEC", borderRadius: 8, marginBottom: 12 }}>
                  {importRows.map((r, i) => (
                    <div key={i} style={{ padding: "7px 12px", borderBottom: "1px solid #F5F8F6", fontSize: ".8rem" }}>
                      <b style={{ color: C.ink }}>{r.name}</b>
                      <span style={{ color: C.mist }}> · {r.email} · {r.role || "staff"}{r.site ? ` · ${r.site}` : ""}{r.department ? ` · ${r.department}` : ""}</span>
                    </div>
                  ))}
                </div>
                <button onClick={runImport} disabled={importBusy} style={{ width: "100%", padding: "11px 0", background: importBusy ? "#9BBBA6" : C.sage, color: "#fff", border: "none", borderRadius: 8, fontSize: ".9rem", fontWeight: 800, cursor: importBusy ? "default" : "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                  {importBusy ? "Creating accounts…" : `Create ${importRows.length} accounts`}
                </button>
              </>
            )}

            {importResult && (
              <>
                <div style={{ fontSize: ".88rem", fontWeight: 700, color: C.ink, margin: "6px 0 10px" }}>
                  ✓ {importResult.created} created{importResult.failed ? ` · ${importResult.failed} failed` : ""}
                </div>
                <div style={{ maxHeight: 260, overflowY: "auto", border: "1px solid #E8EFEC", borderRadius: 8, marginBottom: 12 }}>
                  {importResult.results.map((r, i) => (
                    <div key={i} style={{ padding: "7px 12px", borderBottom: "1px solid #F5F8F6", fontSize: ".8rem", background: r.error ? "#FDECEA" : C.white }}>
                      {r.error
                        ? <span style={{ color: C.red }}>Line {r.line} — {r.email || "row"}: {r.error}</span>
                        : <span><b style={{ color: C.ink }}>{r.name}</b> <span style={{ color: C.mist }}>{r.email}</span> → <span style={{ fontFamily: "'DM Mono', monospace", background: C.foam, padding: "1px 7px", borderRadius: 4, color: C.pine }}>{r.tempPassword}</span></span>}
                    </div>
                  ))}
                </div>
                <button onClick={() => {
                  const rows = importResult.results.filter(r => !r.error);
                  navigator.clipboard?.writeText(rows.map(r => `${r.name}\t${r.email}\t${r.tempPassword}`).join("\n"));
                }} style={{ padding: "8px 16px", background: C.white, border: "1.5px solid #D0DEDB", borderRadius: 7, fontSize: ".8rem", color: C.slate, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>📋 Copy all temp passwords</button>
                <p style={{ fontSize: ".72rem", color: C.mist, marginTop: 8 }}>Temp passwords are shown once — copy before closing. Staff change them on first login via the avatar menu.</p>
              </>
            )}

            <button onClick={() => setShowImport(false)} style={{ marginTop: 14, width: "100%", padding: "9px 0", background: "none", border: "1px solid #D0DEDB", borderRadius: 7, fontSize: ".84rem", color: C.slate, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Close</button>
          </div>
        </div>
      )}

      {editing && (
        <div onClick={() => setEditing(null)} style={{ position: "fixed", inset: 0, background: "rgba(15,31,23,.45)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
          <form onClick={e => e.stopPropagation()} onSubmit={saveEdit} style={{
            background: C.white, borderRadius: 12, padding: 22, width: "100%", maxWidth: 420,
            boxShadow: "0 20px 60px rgba(0,0,0,.3)",
          }}>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: C.ink, marginBottom: 4 }}>Edit staff member</h3>
            <p style={{ fontSize: ".76rem", color: C.mist, marginBottom: 14 }}>{editing.email}</p>
            <div style={{ display: "grid", gap: 10 }}>
              <input style={inputStyle} required value={editing.name} placeholder="Full name"
                onChange={e => setEditing(x => ({ ...x, name: e.target.value }))} />
              <select style={inputStyle} value={editing.role} onChange={e => setEditing(x => ({ ...x, role: e.target.value }))}>
                {Object.entries(ROLE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
              <select style={inputStyle} value={editing.siteId} onChange={e => setEditing(x => ({ ...x, siteId: e.target.value }))}>
                <option value="">No site</option>
                {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select style={inputStyle} value={editing.departmentId} onChange={e => setEditing(x => ({ ...x, departmentId: e.target.value }))}>
                <option value="">No department</option>
                {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button type="submit" style={{ flex: 1, padding: "10px 0", background: C.sage, color: "#fff", border: "none", borderRadius: 7, fontSize: ".88rem", fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Save</button>
              <button type="button" onClick={() => setEditing(null)} style={{ padding: "10px 16px", background: "none", border: "1px solid #D0DEDB", borderRadius: 7, fontSize: ".85rem", color: C.slate, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
