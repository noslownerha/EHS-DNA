import { useState, useEffect } from "react";
import { COLORS, BRAND } from "./constants.js";
import { api } from "./api.js";
import { EHSHeader } from "./AppShell.jsx";

const C = { ...COLORS };

const STATUS = {
  in_service:     { label: "In service",     bg: C.foam,   color: C.pine },
  out_of_service: { label: "Out of service", bg: C.goldLt, color: C.gold },
  retired:        { label: "Retired",        bg: "#EEF1F0", color: C.slate },
};

const CATEGORY_ICON = {
  pump: "🔧", forklift: "🚜", tank: "🛢️", extinguisher: "🧯", aed: "🩺",
  compressor: "💨", conveyor: "⚙️", boiler: "♨️", electrical: "⚡", default: "📦",
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
  const icon = asset ? (CATEGORY_ICON[asset.category] ?? CATEGORY_ICON.default) : "📦";
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
            <div style={{ fontSize: "2rem", marginBottom: 10 }}>⚠️</div>
            <div style={{ fontWeight: 700, color: C.ink, marginBottom: 6 }}>Couldn't load this asset</div>
            <div style={{ fontSize: ".82rem", color: C.mist }}>{error}</div>
          </div>
        )}

        {asset && !loading && (
          <>
            {/* Identity header */}
            <div style={{ background: C.white, borderRadius: 12, boxShadow: "0 2px 12px rgba(15,31,23,.07)", padding: "20px 20px", marginBottom: 16 }}>
              <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div style={{ fontSize: "2.4rem", lineHeight: 1 }}>{icon}</div>
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
              <Section title="Lockout / Tagout" icon="🔒" accent={C.red}>
                {asset.loto.map(p => (
                  <ProcedureCard key={p.id} proc={p} open={openProc === p.id}
                    onToggle={() => setOpenProc(openProc === p.id ? null : p.id)} accent={C.red} />
                ))}
              </Section>
            )}

            {/* SOPs */}
            {asset.sops?.length > 0 && (
              <Section title="Standard Operating Procedures" icon="📋" accent={C.pine}>
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
                }}>✅ Run {asset.checklist_name || "inspection"} now</button>
              ) : (
                <div style={{ fontSize: ".82rem", color: C.mist }}>
                  No inspection checklist linked to this asset yet.
                  {canManage && " Link one when editing the asset."}
                </div>
              )}
            </div>

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
        <span style={{ fontSize: "1rem" }}>{icon}</span>
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
