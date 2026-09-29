// QR labels — one place to print QR codes for equipment and inspection points,
// one at a time or as a whole sheet, and to set up inspection points (a spot
// like an eyewash station whose QR starts its checklist when scanned).
import { useState, useEffect, useMemo } from "react";
import { EHSHeader } from "./AppShell.jsx";
import { COLORS, BRAND } from "./constants.js";
import { api } from "./api.js";

const C = COLORS;
const field = {
  width: "100%", padding: "9px 11px", border: "1.5px solid #D0DEDB", borderRadius: 8,
  fontFamily: "'DM Sans', sans-serif", fontSize: ".88rem", color: C.ink, outline: "none", boxSizing: "border-box", background: "#fff",
};
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Print a sheet of labels. The window is opened synchronously inside the tap
// (phones block pop-ups opened after an await), then filled once labels arrive.
function printLabels(items, onError) {
  const w = window.open("", "_blank");
  if (!w) { onError("Your browser blocked the print window — allow pop-ups for this site and try again."); return; }
  w.document.write("<p style='font-family:sans-serif;padding:24px'>Preparing labels…</p>");
  api.qrLabels(items).then(labels => {
    if (!labels.length) { w.close(); onError("None of the selected items can be printed."); return; }
    w.document.open();
    w.document.write(`<!DOCTYPE html><html><head><title>QR labels — ${esc(BRAND.company)}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        @page { size: letter; margin: 0.4in; }
        body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; margin: 0; }
        .sheet { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.25in; }
        .label { border: 2px solid #1C3A2A; border-radius: 10px; padding: 14px 16px; text-align: center;
                 break-inside: avoid; page-break-inside: avoid; }
        .kind { font-size: 9px; letter-spacing: .12em; text-transform: uppercase; color: #4A8C5C; font-weight: 700; }
        .name { font-size: 16px; font-weight: 700; color: #0F1F17; margin: 3px 0 1px; }
        .code { font-family: ui-monospace, Menlo, monospace; font-size: 12px; color: #4A8C5C; }
        .sub  { font-size: 11px; color: #56706A; margin-top: 2px; min-height: 13px; }
        .qr   { width: 2.1in; height: 2.1in; margin: 8px auto 4px; }
        .qr svg { width: 100%; height: 100%; }
        .foot { font-size: 10px; color: #8FA3A0; }
        .brand { font-size: 9px; color: #B0BFBC; margin-top: 3px; }
        @media screen { body { padding: 16px; background: #F4F7F6; } .label { background: #fff; } }
      </style></head><body><div class="sheet">
      ${labels.map(l => `
        <div class="label">
          <div class="kind">${l.kind === "point" ? "Inspection point" : "Equipment"}</div>
          <div class="name">${esc(l.name)}</div>
          ${l.code ? `<div class="code">${esc(l.code)}</div>` : ""}
          <div class="sub">${esc(l.subtitle)}</div>
          <div class="qr">${l.svg}</div>
          <div class="foot">${esc(l.foot)}</div>
          <div class="brand">${esc(BRAND.company)} · EHS DNA</div>
        </div>`).join("")}
      </div><script>window.onload = () => setTimeout(() => window.print(), 350);</scr` + `ipt></body></html>`);
    w.document.close();
  }).catch(err => { w.close(); onError(`Couldn't prepare labels — ${err.message}`); });
}

function Row({ checked, onToggle, title, sub, onPrint, onRemove }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderBottom: "1px solid #EEF3F1" }}>
      <input type="checkbox" checked={checked} onChange={onToggle} aria-label={`Select ${title}`}
             style={{ width: 20, height: 20, accentColor: C.sage, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }} onClick={onToggle}>
        <div style={{ fontSize: ".9rem", fontWeight: 600, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
        <div style={{ fontSize: ".74rem", color: C.mist }}>{sub}</div>
      </div>
      <button onClick={onPrint} aria-label={`Print label for ${title}`} title="Print this label" style={{
        background: "none", border: "1px solid #D0DEDB", borderRadius: 7, padding: "6px 9px", cursor: "pointer", fontSize: ".78rem" }}>🖨️ Print</button>
      {onRemove && (
        <button onClick={onRemove} aria-label={`Remove ${title}`} title="Remove inspection point" style={{
          background: "none", border: "none", color: C.mist, cursor: "pointer", fontSize: "1rem", padding: 4 }}>×</button>
      )}
    </div>
  );
}

export default function S7cQrLabels({ onHome, onBack, user }) {
  const canManage = ["admin", "safety", "site_manager"].includes(user?.role);
  const [assets, setAssets] = useState([]);
  const [points, setPoints] = useState([]);
  const [checklists, setChecklists] = useState([]);
  const [site, setSite] = useState("");
  const [sel, setSel] = useState(() => new Set());
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", siteId: "", location: "", checklistId: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const sites = BRAND.siteRecords ?? [];

  function load() {
    Promise.all([
      api.listAssets().catch(() => []),
      api.listInspectionPoints().catch(() => []),
      api.listChecklists().catch(() => []),
    ]).then(([a, p, c]) => { setAssets(a); setPoints(p); setChecklists(c.filter(x => x.active !== 0)); setLoading(false); });
  }
  useEffect(load, []);

  const key = (kind, id) => `${kind}:${id}`;
  const vis = useMemo(() => ({
    points: points.filter(p => !site || String(p.site_id) === site),
    assets: assets.filter(a => !site || String(a.site_id) === site),
  }), [points, assets, site]);
  const toggle = k => setSel(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const allOf = (kind, rows) => rows.every(r => sel.has(key(kind, r.id)));
  const toggleAll = (kind, rows) => setSel(s => {
    const n = new Set(s), on = !allOf(kind, rows);
    rows.forEach(r => on ? n.add(key(kind, r.id)) : n.delete(key(kind, r.id))); return n;
  });
  const selected = [...sel].map(k => { const [kind, id] = k.split(":"); return { kind, id: Number(id) }; });

  async function addPoint() {
    setError("");
    try {
      const p = await api.createInspectionPoint({
        name: form.name, siteId: form.siteId ? Number(form.siteId) : null,
        location: form.location || null, checklistId: form.checklistId ? Number(form.checklistId) : null,
      });
      setPoints(ps => [...ps, p]); setSel(s => new Set(s).add(key("point", p.id)));
      setForm({ name: "", siteId: form.siteId, location: "", checklistId: form.checklistId }); setAdding(false);
    } catch (e) { setError(e.message); }
  }
  async function removePoint(p) {
    if (!window.confirm(`Remove "${p.name}"? Printed labels for it will stop working.`)) return;
    try { await api.deleteInspectionPoint(p.id); setPoints(ps => ps.filter(x => x.id !== p.id)); }
    catch (e) { setError(e.message); }
  }

  const section = (title, blurb, kind, rows, extra) => (
    <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2EBE6", marginBottom: 16, overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 12px 8px", gap: 8, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: ".95rem", fontWeight: 700, color: C.ink }}>{title}</div>
          <div style={{ fontSize: ".74rem", color: C.mist }}>{blurb}</div>
        </div>
        {rows.length > 0 && (
          <button onClick={() => toggleAll(kind, rows)} style={{ background: "none", border: "none", color: C.pine, fontWeight: 600, fontSize: ".8rem", cursor: "pointer" }}>
            {allOf(kind, rows) ? "Clear all" : `Select all (${rows.length})`}
          </button>
        )}
      </div>
      {extra}
      {rows.length === 0 && <div style={{ padding: "8px 12px 14px", fontSize: ".82rem", color: C.mist }}>None yet{site ? " at this site" : ""}.</div>}
      {rows.map(r => kind === "point" ? (
        <Row key={r.id} checked={sel.has(key("point", r.id))} onToggle={() => toggle(key("point", r.id))}
             title={r.name} sub={[r.checklist_name, r.site_name, r.location].filter(Boolean).join(" · ")}
             onPrint={() => printLabels([{ kind: "point", id: r.id }], setError)}
             onRemove={canManage ? () => removePoint(r) : null} />
      ) : (
        <Row key={r.id} checked={sel.has(key("asset", r.id))} onToggle={() => toggle(key("asset", r.id))}
             title={r.name} sub={[r.asset_tag, r.site_name ?? sites.find(s => s.id === r.site_id)?.name, r.location].filter(Boolean).join(" · ")}
             onPrint={() => printLabels([{ kind: "asset", id: r.id }], setError)} />
      ))}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: C.chalk ?? "#F4F7F6", fontFamily: "'DM Sans', sans-serif", paddingBottom: 150 }}>
      <EHSHeader onHome={onHome} rightContent={onBack && <button onClick={onBack} style={{ background: "none", border: "none", color: C.mint, fontSize: ".85rem", cursor: "pointer" }}>← Back</button>} />
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "20px 16px" }}>
        <h1 style={{ fontSize: "1.3rem", fontWeight: 700, color: C.ink, margin: 0 }}>QR labels</h1>
        <p style={{ fontSize: ".84rem", color: C.mist, margin: "4px 0 14px" }}>
          Tick any mix and print them on one sheet, or print one with its 🖨️ button.
        </p>
        <select value={site} onChange={e => setSite(e.target.value)} style={{ ...field, width: "auto", marginBottom: 14 }} aria-label="Filter by site">
          <option value="">All sites</option>
          {sites.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
        </select>
        {error && <div role="alert" style={{ background: "#FEF3F2", color: "#B42318", borderRadius: 8, padding: "10px 12px", marginBottom: 12, fontSize: ".82rem", fontWeight: 600 }}>⚠ {error}</div>}
        {loading ? <div style={{ color: C.mist }}>Loading…</div> : (<>
          {section("Inspection points", "A spot on the floor whose QR starts its checklist — eyewash stations, extinguisher bays, dock doors.", "point", vis.points,
            canManage && (adding ? (
              <div style={{ padding: "4px 12px 12px", display: "grid", gap: 8 }}>
                <input style={field} placeholder="Name, e.g. Eyewash station — Paint booth" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                <select style={field} value={form.checklistId} onChange={e => setForm({ ...form, checklistId: e.target.value })} aria-label="Checklist this point runs">
                  <option value="">Checklist it runs…</option>
                  {checklists.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select style={field} value={form.siteId} onChange={e => setForm({ ...form, siteId: e.target.value })} aria-label="Site">
                  <option value="">Site…</option>
                  {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <input style={field} placeholder="Where exactly (optional), e.g. North wall by door 3" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={addPoint} disabled={!form.name.trim() || !form.checklistId} style={{
                    padding: "9px 16px", borderRadius: 8, border: "none", background: form.name.trim() && form.checklistId ? C.sage : "#B0C8BA",
                    color: "#fff", fontWeight: 700, cursor: "pointer" }}>Add point</button>
                  <button onClick={() => setAdding(false)} style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid #D0DEDB", background: "#fff", color: C.slate, cursor: "pointer" }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ padding: "0 12px 10px" }}>
                <button onClick={() => setAdding(true)} style={{ padding: "8px 14px", borderRadius: 8, border: `1.5px dashed ${C.mint}`, background: "#fff", color: C.pine, fontWeight: 600, cursor: "pointer" }}>+ Add inspection point</button>
              </div>
            )))}
          {section("Equipment", "Scanning opens the asset: LOTO steps, SOPs, maintenance and its inspection.", "asset", vis.assets)}
        </>)}
      </div>
      <div style={{ position: "fixed", left: 0, right: 0, bottom: 58, padding: "10px 16px calc(10px + env(safe-area-inset-bottom))",
                    background: "rgba(255,255,255,.96)", borderTop: "1px solid #E2EBE6", zIndex: 150 }}>
        <button disabled={!selected.length} onClick={() => printLabels(selected, setError)} style={{
          width: "100%", maxWidth: 760, display: "block", margin: "0 auto", padding: "13px", borderRadius: 10, border: "none",
          background: selected.length ? C.pine : "#B0C8BA", color: "#fff", fontSize: ".95rem", fontWeight: 700, cursor: selected.length ? "pointer" : "default" }}>
          {selected.length ? `🖨️ Print ${selected.length} label${selected.length === 1 ? "" : "s"}` : "Tick labels to print"}
        </button>
      </div>
    </div>
  );
}
