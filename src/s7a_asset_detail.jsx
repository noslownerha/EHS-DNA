import { useState, useEffect } from "react";
import Icon from "./Icon.jsx";
import { COLORS, BRAND } from "./constants.js";
import { api } from "./api.js";
import AuthImg from "./AuthImg.jsx";
import { EHSHeader } from "./AppShell.jsx";

const C = { ...COLORS };

const STATUS = {
  in_service:     { label: "In service",     bg: C.foam,   color: C.pine },
  out_of_service: { label: "Out of service", bg: C.goldLt, color: C.gold },
  retired:        { label: "Retired",        bg: "#EEF1F0", color: C.slate },
};

const CATEGORY_ICON = {
  pump: "wrench", forklift: "truck", tank: "tank", extinguisher: "flame", aed: "medic",
  compressor: "gear", conveyor: "gear", boiler: "flame", electrical: "bolt", default: "box",
};

// The scan-result page: what a worker sees after scanning an asset's QR. Leads with
// safety-critical info (LOTO), then SOPs, then the inspection action.
export default function S7aAssetDetail({ assetId, user = { role: "staff" }, onHome, onBack, onRunInspection }) {
  const [asset, setAsset]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  const [openProc, setOpenProc] = useState(null); // expanded procedure id

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.getAsset(assetId)
      .then(a => { if (alive) { setAsset(a); setLoading(false); } })
      .catch(err => { if (alive) { setError(err.message); setLoading(false); } });
    return () => { alive = false; };
  }, [assetId]);

  const canManage = ["admin", "safety", "site_manager"].includes(user.role);
  const icon = asset ? (CATEGORY_ICON[asset.category] ?? CATEGORY_ICON.default) : "box";
  const st = asset ? (STATUS[asset.status] ?? STATUS.in_service) : STATUS.in_service;

  return (
    <div style={{ minHeight: "100dvh", background: C.chalk, fontFamily: "'DM Sans', sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .proc-card { transition: background .12s; }
        .proc-head:active { background: #F0F4F2; }
      `}</style>

      <EHSHeader onHome={onHome} rightContent={
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.mint, fontSize: ".85rem", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>← Back</button>
      } />

      <div style={{ flex: 1, padding: "18px 18px 60px", overflowY: "auto", maxWidth: 640, width: "100%", margin: "0 auto" }}>
        {loading && <div style={{ textAlign: "center", padding: 60, color: C.mist }}>Loading asset…</div>}
        {error && !loading && (
          <div style={{ textAlign: "center", padding: 60 }}>
            <div style={{ color: C.red, marginBottom: 10 }}><Icon name="alert" size={36} /></div>
            <div style={{ fontWeight: 700, color: C.ink, marginBottom: 6 }}>Couldn't load this asset</div>
            <div style={{ fontSize: ".82rem", color: C.mist }}>{error}</div>
          </div>
        )}

        {asset && !loading && (
          <>
            {/* Identity header */}
            <div style={{ background: C.white, borderRadius: 12, boxShadow: "0 2px 12px rgba(15,31,23,.07)", padding: "20px 20px", marginBottom: 16 }}>
              <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                {(() => {
                  let ph = null;
                  try { ph = asset.photo ? JSON.parse(asset.photo) : null; } catch { ph = null; }
                  return ph
                    ? <AuthImg photo={ph} alt={asset.name} style={{ width: 56, height: 56, borderRadius: 10, objectFit: "cover", background: "#EEF1F0", flexShrink: 0 }} />
                    : <div style={{ width: 64, height: 64, borderRadius: 16, background: C.foam, color: C.sage, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name={icon} size={34} stroke={1.8} /></div>;
                })()}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                    <h1 style={{ fontSize: "1.3rem", fontWeight: 700, color: C.ink, lineHeight: 1.2 }}>{asset.name}</h1>
                    <span style={{ fontSize: ".72rem", fontWeight: 700, padding: "3px 9px", borderRadius: 6, background: st.bg, color: st.color }}>{st.label}</span>
                  </div>
                  {asset.asset_tag && <div style={{ fontSize: ".8rem", color: C.sage, fontWeight: 600, fontFamily: "'DM Mono', monospace" }}>{asset.asset_tag}</div>}
                  <div style={{ fontSize: ".82rem", color: C.mist, marginTop: 4 }}>
                    {[asset.site_name, asset.location].filter(Boolean).join(" · ")}
                  </div>
                  {(asset.manufacturer || asset.model) && (
                    <div style={{ fontSize: ".78rem", color: C.mist, marginTop: 2 }}>
                      {[asset.manufacturer, asset.model].filter(Boolean).join(" ")}{asset.serial ? ` · S/N ${asset.serial}` : ""}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* LOTO — safety-critical, leads. */}
            {asset.loto?.length > 0 && (
              <Section title="Lockout / Tagout" icon="lock" accent={C.red}>
                {asset.loto.map(p => (
                  <ProcedureCard key={p.id} proc={p} open={openProc === p.id}
                    onToggle={() => setOpenProc(openProc === p.id ? null : p.id)} accent={C.red} />
                ))}
              </Section>
            )}

            {/* SOPs */}
            {asset.sops?.length > 0 && (
              <Section title="Standard Operating Procedures" icon="doc" accent={C.pine}>
                {asset.sops.map(p => (
                  <ProcedureCard key={p.id} proc={p} open={openProc === p.id}
                    onToggle={() => setOpenProc(openProc === p.id ? null : p.id)} accent={C.pine} />
                ))}
              </Section>
            )}

            {/* Inspection action */}
            <div style={{ background: C.white, borderRadius: 12, boxShadow: "0 2px 12px rgba(15,31,23,.07)", padding: "16px 18px", marginBottom: 16 }}>
              <div style={{ fontSize: ".72rem", fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: C.sage, marginBottom: 10 }}>Inspection</div>
              {asset.checklist_id ? (
                <button onClick={() => onRunInspection?.(asset.checklist_id, asset)} style={{
                  width: "100%", padding: "13px", background: C.sage, color: C.white, border: "none",
                  borderRadius: 9, fontWeight: 700, fontSize: ".9rem", cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                }}><Icon name="checkCircle" size={18} style={{ verticalAlign: "-4px", marginRight: 6 }} />Run {asset.checklist_name || "inspection"} now</button>
              ) : (
                <div style={{ fontSize: ".82rem", color: C.mist }}>
                  No inspection checklist linked to this asset yet.
                  {canManage && " Link one when editing the asset."}
                </div>
              )}
            </div>

            {/* Maintenance schedule — recurring tasks with next-due dates. */}
            <MaintenanceSection assetId={asset.id} canManage={canManage} />

            {/* Empty-state hint when nothing attached */}
            {!asset.loto?.length && !asset.sops?.length && !asset.checklist_id && (
              <div style={{ textAlign: "center", padding: "24px 20px", color: C.mist, fontSize: ".85rem" }}>
                No procedures or inspections attached to this asset yet.
                {canManage && " Add them from the asset registry."}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, icon, accent, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, paddingLeft: 2 }}>
        <span style={{ color: accent, display: "flex" }}><Icon name={icon} size={18} stroke={2} /></span>
        <span style={{ fontSize: ".8rem", fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: accent }}>{title}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{children}</div>
    </div>
  );
}

function ProcedureCard({ proc, open, onToggle, accent }) {
  let steps = [];
  try { steps = JSON.parse(proc.steps || "[]"); } catch { steps = []; }
  const hasSteps = steps.length > 0;
  return (
    <div className="proc-card" style={{ background: C.white, borderRadius: 10, boxShadow: "0 1px 8px rgba(15,31,23,.06)", overflow: "hidden", borderLeft: `3px solid ${accent}` }}>
      <button className="proc-head" onClick={onToggle} style={{
        width: "100%", padding: "13px 16px", background: "none", border: "none", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontFamily: "'DM Sans', sans-serif",
      }}>
        <span style={{ fontSize: ".9rem", fontWeight: 600, color: C.ink, textAlign: "left" }}>{proc.title}</span>
        <span style={{ color: C.mist, fontSize: ".9rem", transform: open ? "rotate(90deg)" : "none", transition: "transform .15s" }}>›</span>
      </button>
      {open && (
        <div style={{ padding: "0 16px 14px" }}>
          {hasSteps ? (
            <ol style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 7 }}>
              {steps.map((s, i) => (
                <li key={i} style={{ fontSize: ".85rem", color: C.ink, lineHeight: 1.45 }}>{s}</li>
              ))}
            </ol>
          ) : proc.body ? (
            <p style={{ fontSize: ".85rem", color: C.ink, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{proc.body}</p>
          ) : (
            <p style={{ fontSize: ".82rem", color: C.mist }}>No detail recorded.</p>
          )}
        </div>
      )}
    </div>
  );
}


// ── Maintenance schedule ─────────────────────────────────────────────────────
// Recurring tasks ("grease bearings every 30 days"). Anyone who can see the
// asset can record the work — the tech standing at the machine with the phone
// that just scanned it. Adding/removing tasks is for admin/safety/site managers.
function MaintenanceSection({ assetId, canManage }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ task: "", intervalDays: "30", lastDone: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.listMaintenance(assetId).then(setRows).catch(e => { setRows([]); setErr(e.message); }); }, [assetId]);

  const run = (fn) => { setBusy(true); setErr(""); fn().then(r => { setRows(r); setConfirm(null); }).catch(e => setErr(e.message)).finally(() => setBusy(false)); };
  const fmt = d => d ? new Date(d + (d.length === 10 ? "T12:00:00" : "")).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : "—";
  const inp = { width: "100%", padding: "9px 11px", border: "1.5px solid #D0DEDB", borderRadius: 8, fontFamily: "'DM Sans', sans-serif", fontSize: ".88rem", boxSizing: "border-box" };
  if (rows === null) return null;
  if (!rows.length && !canManage) return null;

  return (
    <div style={{ background: C.white, borderRadius: 12, boxShadow: "0 2px 12px rgba(15,31,23,.07)", padding: "16px 18px", marginBottom: 16 }}>
      <div style={{ fontSize: ".72rem", fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: C.sage, marginBottom: 10 }}><Icon name="wrench" size={14} style={{ verticalAlign: "-2px", marginRight: 5 }} />Maintenance</div>
      {err && <div role="alert" style={{ color: "#B42318", fontSize: ".8rem", fontWeight: 600, marginBottom: 8 }}>⚠ {err}</div>}
      {!rows.length && <div style={{ fontSize: ".82rem", color: C.mist, marginBottom: 8 }}>No scheduled maintenance yet.</div>}
      {rows.map(m => (
        <div key={m.id} style={{ padding: "10px 0", borderTop: "1px solid #EEF3F1" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: ".9rem", fontWeight: 600, color: C.ink }}>{m.task}</div>
              <div style={{ fontSize: ".75rem", color: C.mist }}>
                Every {m.interval_days} day{m.interval_days === 1 ? "" : "s"}
                {m.last_done_at && ` · last done ${fmt(m.last_done_at)}${m.last_done_by ? ` by ${m.last_done_by}` : ""}`}
              </div>
              <div style={{ fontSize: ".78rem", fontWeight: 700, marginTop: 2, color: m.overdue ? "#B42318" : C.pine }}>
                {m.overdue ? `⚠ Overdue — was due ${fmt(m.next_due)}` : `Next due ${fmt(m.next_due)}`}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              {confirm === m.id ? (
                <>
                  <button disabled={busy} onClick={() => run(() => api.markMaintenanceDone(m.id))} style={{ padding: "7px 11px", borderRadius: 7, border: "none", background: C.sage, color: "#fff", fontWeight: 700, fontSize: ".78rem", cursor: "pointer" }}>Confirm done</button>
                  <button onClick={() => setConfirm(null)} style={{ padding: "7px 9px", borderRadius: 7, border: "1px solid #D0DEDB", background: "#fff", fontSize: ".78rem", cursor: "pointer" }}>Cancel</button>
                </>
              ) : (
                <button onClick={() => setConfirm(m.id)} style={{ padding: "7px 11px", borderRadius: 7, border: `1.5px solid ${C.sage}`, background: "#fff", color: C.pine, fontWeight: 700, fontSize: ".78rem", cursor: "pointer" }}>✓ Done</button>
              )}
              {canManage && confirm !== m.id && (
                <button aria-label={`Remove ${m.task}`} onClick={() => { if (window.confirm(`Remove "${m.task}" from the schedule?`)) run(() => api.deleteMaintenance(m.id)); }}
                  style={{ background: "none", border: "none", color: C.mist, fontSize: "1rem", cursor: "pointer" }}>×</button>
              )}
            </div>
          </div>
        </div>
      ))}
      {canManage && (adding ? (
        <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
          <input style={inp} placeholder="Task, e.g. Grease main bearings" value={form.task} onChange={e => setForm({ ...form, task: e.target.value })} />
          <div style={{ display: "flex", gap: 8 }}>
            <label style={{ flex: 1, fontSize: ".72rem", color: C.mist }}>Every (days)
              <input style={inp} type="number" min="1" max="3650" value={form.intervalDays} onChange={e => setForm({ ...form, intervalDays: e.target.value })} />
            </label>
            <label style={{ flex: 1, fontSize: ".72rem", color: C.mist }}>Last done (optional)
              <input style={inp} type="date" value={form.lastDone} onChange={e => setForm({ ...form, lastDone: e.target.value })} />
            </label>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button disabled={busy || !form.task.trim()} onClick={() => run(() => api.addMaintenance(assetId, { task: form.task, intervalDays: Number(form.intervalDays), lastDone: form.lastDone || null }).then(r => { setAdding(false); setForm({ task: "", intervalDays: "30", lastDone: "" }); return r; }))}
              style={{ padding: "9px 16px", borderRadius: 8, border: "none", background: form.task.trim() ? C.sage : "#B0C8BA", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Add task</button>
            <button onClick={() => setAdding(false)} style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid #D0DEDB", background: "#fff", cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} style={{ marginTop: 10, padding: "8px 14px", borderRadius: 8, border: `1.5px dashed ${C.mint}`, background: "#fff", color: C.pine, fontWeight: 600, cursor: "pointer" }}>+ Add maintenance task</button>
      ))}
    </div>
  );
}
