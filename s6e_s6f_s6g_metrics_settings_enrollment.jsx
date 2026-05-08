import { useState } from "react";

const C = {
  dark: "#1A1A2E", mid: "#16213E", teal: "#00B4D8", tealLt: "#E0F7FC",
  white: "#FFFFFF", ink: "#0F1F17", slate: "#4A5568", mist: "#8FA3A0",
  chalk: "#F4F7F5", gold: "#F4A261", goldLt: "#FEF3E2",
  green: "#2EC4B6", greenLt: "#E8FAF9", red: "#E74C3C", redLt: "#FEF0EF",
  purple: "#6B3FA0", purpleLt: "#F3F0F9",
};

function OpsNav({ title }) {
  return (
    <div style={{ height: 52, background: C.dark, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", boxShadow: "0 2px 10px rgba(0,0,0,.4)", position: "sticky", top: 0, zIndex: 100, borderBottom: "1px solid rgba(0,180,216,.15)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: ".9rem", fontWeight: 500, color: C.teal, letterSpacing: ".06em" }}>
          <span style={{ color: C.white }}>EHS</span>ops
        </div>
        <span style={{ color: "rgba(255,255,255,.15)" }}>|</span>
        <span style={{ fontSize: ".8rem", color: "rgba(255,255,255,.5)" }}>{title}</span>
      </div>
      <span style={{ fontSize: ".7rem", color: "rgba(255,255,255,.3)", background: "rgba(255,255,255,.06)", padding: "2px 8px", borderRadius: 12 }}>Super Admin</span>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// S6e — Platform Metrics
// Spec §16.5:
//   - Each tile has X button to hide it; hidden state persisted per owner
//   - "Unhide all tiles" ghost button always visible at bottom
//   - No per-tile unhide — unhide all is the only restoration path
//   - Benchmark cost fields editable inline by owner only, save on blur
// ════════════════════════════════════════════════════════════════════════════
const ALL_TILES = [
  { id: "mrr",      label: "MRR",                value: "$8,540",    trend: "+$390 MoM", color: C.teal  },
  { id: "arr",      label: "ARR",                value: "$102,480",  trend: "+$4,680 YoY",color: C.teal },
  { id: "accounts", label: "Active accounts",    value: "5",         trend: "+1 this month", color: C.green },
  { id: "churn",    label: "Churn rate",         value: "0%",        trend: "0 cancellations",color: C.green },
  { id: "at_risk",  label: "At-risk accounts",   value: "1",         trend: "Health < 60",color: C.gold  },
  { id: "support",  label: "Open support tickets",value: "3",        trend: "2 avg resolution",color: C.gold },
  { id: "incidents",label: "Incidents logged",   value: "12",        trend: "Last 30 days",color: "#8B9CF0" },
  { id: "findings", label: "Findings logged",    value: "47",        trend: "Last 30 days", color: "#8B9CF0" },
];

export function S6ePlatformMetrics() {
  // Spec §16.5: hidden state persisted per owner account
  const [hiddenTiles,  setHiddenTiles]  = useState(new Set());

  // Spec §16.5: editable benchmark cost fields, owner only, save on blur
  const [buildCost,    setBuildCost]    = useState("185000");
  const [monthlyOpex,  setMonthlyOpex]  = useState("4200");
  const [buildFocused, setBuildFocused] = useState(false);
  const [opexFocused,  setOpexFocused]  = useState(false);

  const totalMRR       = 8540;
  const buildCostNum   = parseFloat(buildCost.replace(/[^0-9.]/g, "")) || 0;
  const monthlyOpexNum = parseFloat(monthlyOpex.replace(/[^0-9.]/g, "")) || 0;
  const buildRecovery  = buildCostNum > 0 ? Math.round((totalMRR / buildCostNum) * 100) : 0;
  const profitableIn   = monthlyOpexNum > 0 ? Math.ceil((buildCostNum) / Math.max(totalMRR - monthlyOpexNum, 1)) : "—";

  function hideTile(id) { setHiddenTiles(h => new Set([...h, id])); }
  // Spec §16.5: only restoration path is unhide all
  function unhideAll()  { setHiddenTiles(new Set()); }

  const visibleTiles = ALL_TILES.filter(t => !hiddenTiles.has(t.id));

  const fieldStyle = focused => ({
    background: focused ? "rgba(255,255,255,.08)" : "transparent",
    border: `1px solid ${focused ? C.teal : "rgba(255,255,255,.1)"}`,
    borderRadius: 6, padding: "6px 10px",
    fontFamily: "'DM Mono', monospace", fontSize: ".9rem",
    color: C.teal, outline: "none", width: "100%",
    transition: "all .18s",
  });

  return (
    <div style={{ minHeight: "100vh", background: C.mid, fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .anim { animation: fadeUp .25s ease both; }
        .hide-btn:hover { color: ${C.red} !important; }
        .unhide-btn:hover { background: rgba(255,255,255,.08) !important; }
        input::placeholder { color: rgba(255,255,255,.2); }
      `}</style>

      <OpsNav title="Platform Metrics" />

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 22px" }}>

        <div className="anim" style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: "1.2rem", fontWeight: 700, color: C.white }}>Platform Metrics</h1>
          <p style={{ fontSize: ".78rem", color: "rgba(255,255,255,.35)", marginTop: 3 }}>
            Tile layout customisable — use X to hide tiles. Hidden state persists across sessions.
          </p>
        </div>

        {/* Metric tiles — spec §16.5: X button top-right, no detail inside tile */}
        {visibleTiles.length > 0 ? (
          <div className="anim" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 8 }}>
            {visibleTiles.map(tile => (
              <div key={tile.id} style={{
                position: "relative",
                background: "rgba(255,255,255,.04)",
                border: "1px solid rgba(255,255,255,.07)",
                borderTop: `3px solid ${tile.color}`,
                borderRadius: 10, padding: "18px 18px 16px",
                height: 90, display: "flex", flexDirection: "column", justifyContent: "center",
              }}>
                {/* Spec §16.5: X button top-right, no confirmation */}
                <button className="hide-btn" onClick={() => hideTile(tile.id)} style={{
                  position: "absolute", top: 6, right: 8,
                  background: "none", border: "none",
                  color: "rgba(255,255,255,.2)", fontSize: ".8rem",
                  cursor: "pointer", padding: "2px 4px",
                  transition: "color .12s",
                }} title="Hide tile">×</button>

                <div style={{ fontSize: "1.6rem", fontWeight: 800, color: tile.color, lineHeight: 1 }}>{tile.value}</div>
                <div style={{ fontSize: ".75rem", color: "rgba(255,255,255,.5)", marginTop: 3, fontWeight: 500 }}>{tile.label}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="anim" style={{ padding: "32px", textAlign: "center", background: "rgba(255,255,255,.03)", border: "1px dashed rgba(255,255,255,.08)", borderRadius: 10, marginBottom: 8 }}>
            <div style={{ color: "rgba(255,255,255,.3)", fontSize: ".88rem" }}>All tiles hidden</div>
          </div>
        )}

        {/* Supporting context */}
        <div className="anim" style={{ fontSize: ".75rem", color: "rgba(255,255,255,.3)", marginBottom: 20, paddingLeft: 2 }}>
          {hiddenTiles.size > 0 && `${hiddenTiles.size} tile${hiddenTiles.size > 1 ? "s" : ""} hidden`}
        </div>

        {/* Spec §16.5: editable benchmark cost fields — owner only */}
        <div className="anim" style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 10, padding: "18px 20px", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <h2 style={{ fontSize: ".9rem", fontWeight: 600, color: C.white }}>Benchmark cost fields</h2>
              <p style={{ fontSize: ".72rem", color: "rgba(255,255,255,.3)", marginTop: 2 }}>Owner-only · editable inline · saves on blur · drives recovery calculations below</p>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            <div>
              <div style={{ fontSize: ".68rem", fontWeight: 600, color: "rgba(255,255,255,.3)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>Build cost ($)</div>
              <input value={buildCost} onChange={e => setBuildCost(e.target.value)}
                onFocus={() => setBuildFocused(true)} onBlur={() => setBuildFocused(false)}
                style={fieldStyle(buildFocused)} />
            </div>
            <div>
              <div style={{ fontSize: ".68rem", fontWeight: 600, color: "rgba(255,255,255,.3)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>Monthly opex ($)</div>
              <input value={monthlyOpex} onChange={e => setMonthlyOpex(e.target.value)}
                onFocus={() => setOpexFocused(true)} onBlur={() => setOpexFocused(false)}
                style={fieldStyle(opexFocused)} />
            </div>
            <div>
              <div style={{ fontSize: ".68rem", fontWeight: 600, color: "rgba(255,255,255,.3)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>Build cost recovery</div>
              <div style={{ padding: "6px 10px", fontSize: ".9rem", color: buildRecovery >= 50 ? C.green : C.gold, fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>
                {buildRecovery}% · ~{profitableIn} months
              </div>
            </div>
          </div>
        </div>

        {/* Spec §16.5: "Unhide all tiles" — ghost style, always visible, only restoration path */}
        {hiddenTiles.size > 0 && (
          <button className="unhide-btn" onClick={unhideAll} style={{
            padding: "9px 18px", background: "none",
            color: "rgba(255,255,255,.4)", border: "1px solid rgba(255,255,255,.1)",
            borderRadius: 7, fontFamily: "'DM Sans', sans-serif",
            fontSize: ".82rem", fontWeight: 500, cursor: "pointer", transition: "background .15s",
          }}>Unhide all tiles ({hiddenTiles.size})</button>
        )}
      </div>
    </div>
  );
}


// ════════════════════════════════════════════════════════════════════════════
// S6f — CS Backend Settings
// Rate card, module pricing, feature flags, routine invoice rules
// ════════════════════════════════════════════════════════════════════════════
export function S6fCSSettings() {
  const [baseAnnual,   setBaseAnnual]   = useState("9600");
  const [perSite,      setPerSite]      = useState("180");
  const [perUser,      setPerUser]      = useState("0");
  const [routineInv,   setRoutineInv]   = useState(false);
  const [routinePct,   setRoutinePct]   = useState("5");
  const [saved,        setSaved]        = useState(false);

  const MODULE_PRICES = [
    { id: "training",          label: "Training / LMS",         price: 150 },
    { id: "triage",            label: "Incident Triage",        price: 75  },
    { id: "advanced_reporting",label: "Advanced Reporting",     price: 100 },
    { id: "sms",               label: "SMS Alerts",             price: 50  },
  ];

  const FEATURE_FLAGS = [
    { id: "shadow_mode",    label: "Shadow mode",          enabled: true,  locked: true  },
    { id: "self_serve",     label: "Self-serve enrollment",enabled: true,  locked: false },
    { id: "bls_benchmark",  label: "BLS rate benchmarks",  enabled: true,  locked: false },
    { id: "ai_analysis",    label: "AI account analysis",  enabled: false, locked: false, note: "Post-MVP" },
  ];

  const inputStyle = {
    background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)",
    borderRadius: 6, padding: "7px 10px", fontFamily: "'DM Mono', monospace",
    fontSize: ".85rem", color: C.teal, outline: "none", width: "100%",
    transition: "all .18s",
  };

  return (
    <div style={{ minHeight: "100vh", background: C.mid, fontFamily: "'DM Sans', sans-serif", paddingBottom: 80 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input::placeholder { color: rgba(255,255,255,.2); }
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .anim { animation: fadeUp .25s ease both; }
        .save-btn:hover:not(:disabled) { background: ${C.teal}cc !important; }
      `}</style>

      <OpsNav title="CS Settings" />

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "24px 22px" }}>
        <div className="anim" style={{ marginBottom: 22 }}>
          <h1 style={{ fontSize: "1.2rem", fontWeight: 700, color: C.white }}>CS Backend Settings</h1>
          <p style={{ fontSize: ".78rem", color: "rgba(255,255,255,.35)", marginTop: 3 }}>Rate card, module pricing, feature flags, invoice rules. Super Admin only.</p>
        </div>

        {/* Rate card */}
        <div className="anim" style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 10, padding: "18px 20px", marginBottom: 14 }}>
          <h2 style={{ fontSize: ".9rem", fontWeight: 600, color: C.white, marginBottom: 14 }}>Standard rate card</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            {[
              { label: "Annual base fee ($)", val: baseAnnual, set: setBaseAnnual },
              { label: "Per site/mo ($)",     val: perSite,    set: setPerSite    },
              { label: "Per user/mo ($)",     val: perUser,    set: setPerUser    },
            ].map((f, i) => (
              <div key={i}>
                <div style={{ fontSize: ".68rem", fontWeight: 600, color: "rgba(255,255,255,.3)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>{f.label}</div>
                <input value={f.val} onChange={e => f.set(e.target.value)} style={inputStyle} />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, fontSize: ".72rem", color: "rgba(255,255,255,.25)" }}>
            Per-account overrides take precedence. Changes to this card apply to new accounts only.
          </div>
        </div>

        {/* Module pricing */}
        <div className="anim" style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 10, padding: "18px 20px", marginBottom: 14 }}>
          <h2 style={{ fontSize: ".9rem", fontWeight: 600, color: C.white, marginBottom: 14 }}>Module add-on pricing</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {MODULE_PRICES.map(mod => (
              <div key={mod.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: ".85rem", color: "rgba(255,255,255,.6)" }}>{mod.label}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: ".72rem", color: "rgba(255,255,255,.25)" }}>$/mo</span>
                  <input defaultValue={mod.price} style={{ ...inputStyle, width: 80, textAlign: "right" }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Routine invoice rule */}
        <div className="anim" style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 10, padding: "18px 20px", marginBottom: 14 }}>
          <h2 style={{ fontSize: ".9rem", fontWeight: 600, color: C.white, marginBottom: 4 }}>Routine invoice rule</h2>
          <p style={{ fontSize: ".75rem", color: "rgba(255,255,255,.3)", marginBottom: 14 }}>
            Invoices within X% of prior month may be configured for auto-send. Owner retains override at all times.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div onClick={() => setRoutineInv(v => !v)} style={{ width: 40, height: 22, borderRadius: 22, background: routineInv ? C.teal : "rgba(255,255,255,.1)", cursor: "pointer", position: "relative", transition: "background .2s", flexShrink: 0 }}>
              <div style={{ position: "absolute", width: 16, height: 16, borderRadius: "50%", background: C.white, top: 3, left: routineInv ? 21 : 3, transition: "left .18s" }} />
            </div>
            <span style={{ fontSize: ".85rem", color: routineInv ? "rgba(255,255,255,.7)" : "rgba(255,255,255,.3)" }}>Enable routine auto-send</span>
            {routineInv && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: ".75rem", color: "rgba(255,255,255,.4)" }}>within</span>
                <input value={routinePct} onChange={e => setRoutinePct(e.target.value)} style={{ ...inputStyle, width: 48, textAlign: "center" }} />
                <span style={{ fontSize: ".75rem", color: "rgba(255,255,255,.4)" }}>% of prior month</span>
              </div>
            )}
          </div>
        </div>

        {/* Feature flags */}
        <div className="anim" style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 10, padding: "18px 20px", marginBottom: 14 }}>
          <h2 style={{ fontSize: ".9rem", fontWeight: 600, color: C.white, marginBottom: 14 }}>Feature flags (platform-wide)</h2>
          {FEATURE_FLAGS.map((flag, i) => (
            <div key={flag.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: i < FEATURE_FLAGS.length - 1 ? "1px solid rgba(255,255,255,.05)" : "none" }}>
              <div>
                <div style={{ fontSize: ".85rem", color: "rgba(255,255,255,.7)" }}>{flag.label}</div>
                {flag.note && <div style={{ fontSize: ".7rem", color: "rgba(255,255,255,.25)", marginTop: 1 }}>{flag.note}</div>}
                {flag.locked && <div style={{ fontSize: ".7rem", color: "rgba(255,255,255,.2)", marginTop: 1 }}>Locked — cannot be disabled</div>}
              </div>
              <div style={{ opacity: flag.locked ? 0.4 : 1, pointerEvents: flag.locked ? "none" : "auto" }}>
                <div style={{ width: 36, height: 20, borderRadius: 20, background: flag.enabled ? C.teal : "rgba(255,255,255,.1)", position: "relative", cursor: "pointer", transition: "background .2s" }}>
                  <div style={{ position: "absolute", width: 14, height: 14, borderRadius: "50%", background: C.white, top: 3, left: flag.enabled ? 19 : 3, transition: "left .18s" }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Save bar */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: C.dark, borderTop: "1px solid rgba(255,255,255,.07)", padding: "12px 24px", display: "flex", justifyContent: "flex-end" }}>
        <button className="save-btn" onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 1500); }} style={{
          padding: "9px 22px", background: saved ? C.teal + "88" : C.teal,
          color: C.white, border: "none", borderRadius: 7,
          fontFamily: "'DM Sans', sans-serif", fontSize: ".88rem", fontWeight: 600,
          cursor: saved ? "default" : "pointer", transition: "all .18s",
        }}>
          {saved ? "✓ Saved" : "Save settings"}
        </button>
      </div>
    </div>
  );
}


// ════════════════════════════════════════════════════════════════════════════
// S6g — Enrollment Queue (self-serve + sales-assisted)
// ════════════════════════════════════════════════════════════════════════════
const ENROLLMENTS = [
  { id: 1, type: "self_serve",    name: "Adirondack Spirits",     contact: "Mike Tremblay",  email: "mike@adirondackspirits.com", plan: "Premium", sites: 2, submitted: "Jun 28, 2024", status: "active"  },
  { id: 2, type: "sales_assisted",name: "Finger Lakes Distilling", contact: "Amy Chen",       email: "amy@fingerlakes.com",        plan: "TBD",     sites: 3, submitted: "Jun 25, 2024", status: "pending" },
  { id: 3, type: "sales_assisted",name: "Hudson Whiskey Co.",      contact: "Dan Hoffman",    email: "dan@hudsonwhiskey.com",      plan: "TBD",     sites: 1, submitted: "Jun 22, 2024", status: "pending" },
  { id: 4, type: "self_serve",    name: "Vermont Farmhouse Cider", contact: "Sara Whitfield", email: "sara@vtfarmhouse.com",       plan: "Standard",sites: 1, submitted: "Jun 20, 2024", status: "active"  },
];

export function S6gEnrollmentQueue({ onProvisionAccount }) {
  const [filter, setFilter] = useState("all");

  const filtered = ENROLLMENTS.filter(e => {
    if (filter === "self_serve")    return e.type === "self_serve";
    if (filter === "sales_assisted")return e.type === "sales_assisted";
    if (filter === "pending")       return e.status === "pending";
    return true;
  });

  const pendingCount = ENROLLMENTS.filter(e => e.status === "pending").length;

  return (
    <div style={{ minHeight: "100vh", background: C.mid, fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .anim { animation: fadeUp .25s ease both; }
        .enroll-row:hover td { background: rgba(255,255,255,.04) !important; cursor: pointer; }
        .provision-btn:hover { background: ${C.teal}cc !important; }
      `}</style>

      <OpsNav title="Enrollment Queue" />

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 22px" }}>

        <div className="anim" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: "1.2rem", fontWeight: 700, color: C.white }}>Enrollment Queue</h1>
            <p style={{ fontSize: ".78rem", color: "rgba(255,255,255,.35)", marginTop: 3 }}>
              {pendingCount} pending · self-serve (auto-activated) · sales-assisted (manual provisioning)
            </p>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {[
              { id: "all",            label: `All (${ENROLLMENTS.length})` },
              { id: "pending",        label: `Pending (${pendingCount})`   },
              { id: "self_serve",     label: "Self-serve"  },
              { id: "sales_assisted", label: "Sales-assisted"},
            ].map(f => (
              <button key={f.id} onClick={() => setFilter(f.id)} style={{
                padding: "6px 12px",
                background: filter === f.id ? "rgba(0,180,216,.15)" : "rgba(255,255,255,.05)",
                border: `1px solid ${filter === f.id ? C.teal : "rgba(255,255,255,.08)"}`,
                borderRadius: 6, fontFamily: "'DM Sans', sans-serif",
                fontSize: ".75rem", fontWeight: filter === f.id ? 600 : 400,
                color: filter === f.id ? C.teal : "rgba(255,255,255,.45)",
                cursor: "pointer", transition: "all .15s",
              }}>{f.label}</button>
            ))}
          </div>
        </div>

        <div className="anim" style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 10, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Company", "Contact", "Type", "Plan", "Sites", "Submitted", "Status", ""].map((h, i) => (
                  <th key={i} style={{ padding: "9px 14px", textAlign: "left", fontSize: ".68rem", fontWeight: 600, letterSpacing: ".07em", textTransform: "uppercase", color: "rgba(255,255,255,.3)", borderBottom: "1px solid rgba(255,255,255,.07)", background: "rgba(255,255,255,.02)", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((enr, i) => (
                <tr key={enr.id} className="enroll-row">
                  <td style={{ padding: "11px 14px", borderBottom: "1px solid rgba(255,255,255,.05)" }}>
                    <div style={{ fontWeight: 600, fontSize: ".88rem", color: C.white }}>{enr.name}</div>
                    <div style={{ fontSize: ".7rem", color: "rgba(255,255,255,.35)", marginTop: 1 }}>{enr.email}</div>
                  </td>
                  <td style={{ padding: "11px 14px", borderBottom: "1px solid rgba(255,255,255,.05)", fontSize: ".83rem", color: "rgba(255,255,255,.55)" }}>{enr.contact}</td>
                  <td style={{ padding: "11px 14px", borderBottom: "1px solid rgba(255,255,255,.05)" }}>
                    <span style={{
                      padding: "2px 9px", borderRadius: 20, fontSize: ".68rem", fontWeight: 600,
                      background: enr.type === "self_serve" ? C.tealLt + "30" : "rgba(244,162,97,.15)",
                      color: enr.type === "self_serve" ? C.teal : C.gold,
                    }}>
                      {enr.type === "self_serve" ? "Self-serve" : "Sales-assisted"}
                    </span>
                  </td>
                  <td style={{ padding: "11px 14px", borderBottom: "1px solid rgba(255,255,255,.05)", fontSize: ".82rem", color: "rgba(255,255,255,.5)" }}>{enr.plan}</td>
                  <td style={{ padding: "11px 14px", borderBottom: "1px solid rgba(255,255,255,.05)", fontSize: ".82rem", color: "rgba(255,255,255,.5)" }}>{enr.sites}</td>
                  <td style={{ padding: "11px 14px", borderBottom: "1px solid rgba(255,255,255,.05)", fontSize: ".78rem", color: "rgba(255,255,255,.35)" }}>{enr.submitted}</td>
                  <td style={{ padding: "11px 14px", borderBottom: "1px solid rgba(255,255,255,.05)" }}>
                    {enr.status === "active"
                      ? <span style={{ padding: "2px 9px", borderRadius: 20, fontSize: ".68rem", fontWeight: 600, background: C.greenLt + "20", color: C.green }}>Active</span>
                      : <span style={{ padding: "2px 9px", borderRadius: 20, fontSize: ".68rem", fontWeight: 600, background: "rgba(244,162,97,.15)", color: C.gold }}>Pending</span>
                    }
                  </td>
                  <td style={{ padding: "11px 14px", borderBottom: "1px solid rgba(255,255,255,.05)" }}>
                    {enr.status === "pending" && enr.type === "sales_assisted" && (
                      <button className="provision-btn" onClick={() => onProvisionAccount?.(enr.id)} style={{
                        padding: "5px 12px", background: C.teal, color: C.white,
                        border: "none", borderRadius: 6, fontFamily: "'DM Sans', sans-serif",
                        fontSize: ".75rem", fontWeight: 600, cursor: "pointer", transition: "all .15s",
                      }}>Provision →</button>
                    )}
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
