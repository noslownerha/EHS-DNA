import { useState, useEffect } from "react";
import { COLORS, BRAND } from "./constants.js";
import { api } from "./api.js";
import { EHSHeader } from "./AppShell.jsx";

const C = { ...COLORS };

const CATEGORIES = ["pump", "forklift", "tank", "extinguisher", "aed", "compressor", "conveyor", "boiler", "electrical", "other"];
const CATEGORY_ICON = {
  pump: "🔧", forklift: "🚜", tank: "🛢️", extinguisher: "🧯", aed: "🩺",
  compressor: "💨", conveyor: "⚙️", boiler: "♨️", electrical: "⚡", other: "📦",
};
const STATUS = {
  in_service:     { label: "In service",     bg: C.foam,   color: C.pine },
  out_of_service: { label: "Out of service", bg: C.goldLt, color: C.gold },
  retired:        { label: "Retired",        bg: "#EEF1F0", color: C.slate },
};

const input = {
  width: "100%", padding: "10px 12px", border: "1.5px solid #D0DEDB", borderRadius: 8,
  fontFamily: "'DM Sans', sans-serif", fontSize: ".9rem", color: C.ink, outline: "none", boxSizing: "border-box",
};
const label = { fontSize: ".7rem", fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", color: C.sage, marginBottom: 6, display: "block" };

// Print an asset's QR label in a new window (name + tag + QR).
function printAssetLabel(qr) {
  const w = window.open("", "_blank", "width=500,height=600");
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><title>QR — ${qr.name}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@600;700&family=DM+Mono&display=swap');
      body { font-family:'DM Sans',sans-serif; margin:0; display:flex; align-items:center; justify-content:center; min-height:100vh; }
      .label { border:2px solid #1C3A2A; border-radius:10px; padding:24px 28px; text-align:center; width:300px; }
      .name { font-size:1.1rem; font-weight:700; color:#0F1F17; margin-bottom:2px; }
      .tag { font-family:'DM Mono',monospace; font-size:.85rem; color:#4A8C5C; margin-bottom:14px; }
      .qr { width:220px; height:220px; margin:0 auto; }
      .qr svg { width:100%; height:100%; }
      .foot { margin-top:12px; font-size:.66rem; color:#8FA3A0; font-family:'DM Mono',monospace; }
      @media print { body { min-height:auto; } }
    </style></head><body>
    <div class="label">
      <div class="name">${qr.name}</div>
      ${qr.assetTag ? `<div class="tag">${qr.assetTag}</div>` : ""}
      <div class="qr">${qr.svg}</div>
      <div class="foot">Scan to view procedures & inspection</div>
    </div>
    <script>window.onload = () => setTimeout(() => window.print(), 300);</scr` + `ipt>
    </body></html>`);
  w.document.close();
}

export default function S7bAssetRegistry({ user = { role: "admin" }, onHome, onBack, onOpenAsset }) {
  const [assets, setAssets]   = useState([]);
  const [sites, setSites]     = useState([]);
  const [checklists, setChecklists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);   // asset being edited, or {} for new
  const [search, setSearch]   = useState("");

  function load() {
    setLoading(true);
    api.listAssets().then(a => { setAssets(a); setLoading(false); }).catch(() => setLoading(false));
  }
  useEffect(() => {
    load();
    setSites(BRAND.siteRecords ?? []);
    api.listChecklists().then(cs => setChecklists(cs.filter(c => c.active !== 0))).catch(() => {});
  }, []);

  const filtered = assets.filter(a => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return [a.name, a.asset_tag, a.category, a.site_name, a.location].filter(Boolean).some(v => v.toLowerCase().includes(q));
  });

  return (
    <div style={{ minHeight: "100dvh", background: C.chalk, fontFamily: "'DM Sans', sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .asset-row:active { background: #F0F4F2; }
      `}</style>
      <EHSHeader onHome={onHome} rightContent={
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.mint, fontSize: ".85rem", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>← Back</button>
      } />

      <div style={{ flex: 1, padding: "18px 18px 60px", overflowY: "auto", maxWidth: 720, width: "100%", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 18 }}>
          <div>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: C.ink }}>Equipment & Assets</h1>
            <p style={{ fontSize: ".85rem", color: C.mist, marginTop: 3 }}>{assets.length} asset{assets.length === 1 ? "" : "s"}</p>
          </div>
          <button onClick={() => setEditing({ status: "in_service" })} style={{
            padding: "9px 16px", background: C.sage, color: C.white, border: "none", borderRadius: 8,
            cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: ".85rem", fontWeight: 700, flexShrink: 0,
          }}>+ New asset</button>
        </div>

        <input placeholder="🔍 Search assets…" value={search} onChange={e => setSearch(e.target.value)}
          style={{ ...input, marginBottom: 16 }} />

        {loading && <div style={{ textAlign: "center", padding: 50, color: C.mist }}>Loading…</div>}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: 50, color: C.mist, fontSize: ".88rem" }}>
            {assets.length === 0 ? "No assets yet — add your first piece of equipment." : "No assets match your search."}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map(a => {
            const st = STATUS[a.status] ?? STATUS.in_service;
            return (
              <div key={a.id} className="asset-row" style={{ background: C.white, borderRadius: 10, boxShadow: "0 1px 8px rgba(15,31,23,.06)", padding: "13px 15px", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ fontSize: "1.5rem" }}>{CATEGORY_ICON[a.category] ?? CATEGORY_ICON.other}</div>
                <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => onOpenAsset?.(a.id)}>
                  <div style={{ fontSize: ".92rem", fontWeight: 600, color: C.ink }}>{a.name}</div>
                  <div style={{ fontSize: ".76rem", color: C.mist, marginTop: 1 }}>
                    {[a.asset_tag, a.site_name, a.location].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <span style={{ fontSize: ".68rem", fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: st.bg, color: st.color, flexShrink: 0 }}>{st.label}</span>
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  <button onClick={() => api.getAssetQr(a.id, 6).then(printAssetLabel)} title="Print QR" style={iconBtn}>🏷️</button>
                  <button onClick={() => setEditing(a)} title="Edit" style={iconBtn}>✏️</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {editing && (
        <AssetEditor asset={editing} sites={sites} checklists={checklists}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }} />
      )}
    </div>
  );
}

const iconBtn = {
  width: 34, height: 34, borderRadius: 8, border: "1px solid #E2EBE6", background: C.white,
  cursor: "pointer", fontSize: ".95rem", display: "flex", alignItems: "center", justifyContent: "center",
};

// Modal editor for creating/editing an asset + managing its procedures.
function AssetEditor({ asset, sites, checklists, onClose, onSaved }) {
  const isNew = !asset.id;
  const [form, setForm] = useState({
    name: asset.name ?? "", asset_tag: asset.asset_tag ?? "", category: asset.category ?? "pump",
    site_id: asset.site_id ?? "", location: asset.location ?? "", manufacturer: asset.manufacturer ?? "",
    model: asset.model ?? "", serial: asset.serial ?? "", status: asset.status ?? "in_service",
    checklist_id: asset.checklist_id ?? "", notes: asset.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [procs, setProcs] = useState({ loto: [], sops: [] });
  const [savedId, setSavedId] = useState(asset.id ?? null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Load existing procedures when editing.
  useEffect(() => {
    if (asset.id) api.getAsset(asset.id).then(a => setProcs({ loto: a.loto ?? [], sops: a.sops ?? [] })).catch(() => {});
  }, [asset.id]);

  async function save() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name, assetTag: form.asset_tag || null, category: form.category,
        siteId: form.site_id || null, location: form.location || null, manufacturer: form.manufacturer || null,
        model: form.model || null, serial: form.serial || null, status: form.status,
        checklistId: form.checklist_id || null, notes: form.notes || null,
      };
      if (isNew) { const r = await api.createAsset(payload); setSavedId(r.id); }
      else await api.updateAsset(asset.id, payload);
      onSaved();
    } catch (err) { console.error(err); setSaving(false); }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,31,23,.4)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.chalk, borderRadius: "16px 16px 0 0", width: "100%", maxWidth: 640, maxHeight: "92dvh", overflowY: "auto", padding: "20px 18px 40px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: C.ink }}>{isNew ? "New asset" : "Edit asset"}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "1.4rem", color: C.mist, cursor: "pointer" }}>×</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div><label style={label}>Name</label><input style={input} value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Bottling Line Transfer Pump" /></div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}><label style={label}>Asset tag</label><input style={input} value={form.asset_tag} onChange={e => set("asset_tag", e.target.value)} placeholder="PMP-014" /></div>
            <div style={{ flex: 1 }}><label style={label}>Category</label>
              <select style={input} value={form.category} onChange={e => set("category", e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_ICON[c]} {c}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}><label style={label}>Site</label>
              <select style={input} value={form.site_id} onChange={e => set("site_id", e.target.value)}>
                <option value="">—</option>
                {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}><label style={label}>Status</label>
              <select style={input} value={form.status} onChange={e => set("status", e.target.value)}>
                {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <div><label style={label}>Location within site</label><input style={input} value={form.location} onChange={e => set("location", e.target.value)} placeholder="Bottling Hall — Line 2" /></div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}><label style={label}>Manufacturer</label><input style={input} value={form.manufacturer} onChange={e => set("manufacturer", e.target.value)} /></div>
            <div style={{ flex: 1 }}><label style={label}>Model</label><input style={input} value={form.model} onChange={e => set("model", e.target.value)} /></div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}><label style={label}>Serial</label><input style={input} value={form.serial} onChange={e => set("serial", e.target.value)} /></div>
            <div style={{ flex: 1 }}><label style={label}>Inspection checklist</label>
              <select style={input} value={form.checklist_id} onChange={e => set("checklist_id", e.target.value)}>
                <option value="">— none —</option>
                {checklists.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          {/* Procedures (only after the asset exists) */}
          {savedId ? (
            <ProcedureManager assetId={savedId} procs={procs} onChange={setProcs} />
          ) : (
            <div style={{ fontSize: ".78rem", color: C.mist, background: C.foam, borderRadius: 8, padding: "10px 12px" }}>
              Save the asset first, then add LOTO procedures and SOPs.
            </div>
          )}

          <button onClick={save} disabled={saving || !form.name.trim()} style={{
            marginTop: 6, padding: "13px", background: form.name.trim() ? C.sage : "#B0C8BA", color: C.white,
            border: "none", borderRadius: 9, fontWeight: 700, fontSize: ".92rem", cursor: form.name.trim() ? "pointer" : "default", fontFamily: "'DM Sans', sans-serif",
          }}>{saving ? "Saving…" : isNew ? "Create asset" : "Save changes"}</button>
        </div>
      </div>
    </div>
  );
}

// Add/remove LOTO and SOP procedures on an asset.
function ProcedureManager({ assetId, procs, onChange }) {
  const [adding, setAdding] = useState(null); // "loto" | "sop" | null
  const [title, setTitle] = useState("");
  const [text, setText]   = useState("");

  async function refresh() {
    const a = await api.getAsset(assetId);
    onChange({ loto: a.loto ?? [], sops: a.sops ?? [] });
  }
  async function add() {
    if (!title.trim()) return;
    const steps = adding === "loto" ? text.split("\n").map(s => s.trim()).filter(Boolean) : [];
    const body = adding === "sop" ? text : null;
    await api.addProcedure(assetId, { kind: adding, title, steps, body });
    setTitle(""); setText(""); setAdding(null); refresh();
  }
  async function remove(id) { await api.deleteProcedure(id); refresh(); }

  return (
    <div style={{ borderTop: "1px solid #E2EBE6", paddingTop: 14, marginTop: 4 }}>
      {["loto", "sop"].map(kind => {
        const list = kind === "loto" ? procs.loto : procs.sops;
        const heading = kind === "loto" ? "🔒 Lockout / Tagout" : "📋 SOPs";
        return (
          <div key={kind} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: ".78rem", fontWeight: 700, color: kind === "loto" ? C.red : C.pine }}>{heading}</span>
              <button onClick={() => { setAdding(kind); setTitle(""); setText(""); }} style={{ background: "none", border: "none", color: C.sage, fontSize: ".78rem", fontWeight: 700, cursor: "pointer" }}>+ Add</button>
            </div>
            {list.map(p => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: C.white, borderRadius: 7, padding: "8px 11px", marginBottom: 5, fontSize: ".82rem", color: C.ink }}>
                <span>{p.title}</span>
                <button onClick={() => remove(p.id)} style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: ".9rem" }}>×</button>
              </div>
            ))}
            {adding === kind && (
              <div style={{ background: C.white, borderRadius: 8, padding: 12, marginTop: 4 }}>
                <input style={{ ...input, marginBottom: 8 }} placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} />
                <textarea style={{ ...input, minHeight: 80, resize: "vertical" }}
                  placeholder={kind === "loto" ? "One step per line…" : "Procedure text…"}
                  value={text} onChange={e => setText(e.target.value)} />
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button onClick={add} style={{ flex: 1, padding: "9px", background: C.sage, color: C.white, border: "none", borderRadius: 7, fontWeight: 700, fontSize: ".82rem", cursor: "pointer" }}>Add</button>
                  <button onClick={() => setAdding(null)} style={{ padding: "9px 14px", background: "none", color: C.mist, border: "1px solid #D0DEDB", borderRadius: 7, fontSize: ".82rem", cursor: "pointer" }}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
