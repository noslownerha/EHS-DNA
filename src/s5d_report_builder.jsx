import { useState, useEffect, useMemo } from "react";
import { EHSHeader } from "./AppShell.jsx";
import { BRAND, COLORS } from "./constants.js";
import { api } from "./api.js";

const C = { ...COLORS };

// ── Seed TRIR data ────────────────────────────────────────────────────────────
// TRIR = (recordable incidents × 200,000) / total hours worked
const MONTHLY_DATA = {
  "Jan 2024": { incidents: 0, hours: 14200, trir: 0.00,   prevYearTrir: 1.41, blsRate: 2.8 },
  "Feb 2024": { incidents: 1, hours: 13800, trir: 1.45,   prevYearTrir: 0.00, blsRate: 2.8 },
  "Mar 2024": { incidents: 0, hours: 14100, trir: 0.00,   prevYearTrir: 2.84, blsRate: 2.8 },
  "Apr 2024": { incidents: 1, hours: 14500, trir: 1.38,   prevYearTrir: 0.00, blsRate: 2.8 },
  "May 2024": { incidents: 0, hours: 14300, trir: 0.00,   prevYearTrir: 1.40, blsRate: 2.8 },
  "Jun 2024": { incidents: 1, hours: 14600, trir: 1.37,   prevYearTrir: 0.00, blsRate: 2.8 },
};

const QUARTERLY_DATA = {
  "Q1 2024": { incidents: 1, hours: 42100, trir: 0.48, prevYearTrir: 1.42, blsRate: 2.8 },
  "Q2 2024": { incidents: 2, hours: 43400, trir: 0.92, prevYearTrir: 0.47, blsRate: 2.8 },
  "Q3 2023": { incidents: 3, hours: 41200, trir: 1.46, prevYearTrir: null,  blsRate: 2.8 },
  "Q4 2023": { incidents: 1, hours: 42800, trir: 0.47, prevYearTrir: null,  blsRate: 2.8 },
  "Q3 2022": { incidents: 2, hours: 40900, trir: 0.98, prevYearTrir: null,  blsRate: 2.8 },
};

const SITES = () => ["All sites", ...(BRAND.siteRecords ?? []).map(s => s.name)];

const SCHEDULED_CADENCES = ["Weekly", "Monthly", "Quarterly"];

// ── Bar chart primitive ───────────────────────────────────────────────────────
function BarChart({ data, showBls, showPrevYear, blsRate }) {
  const labels   = Object.keys(data);
  const values   = labels.map(k => data[k].trir);
  const maxVal   = Math.max(...values, showBls ? blsRate : 0, showPrevYear ? Math.max(...labels.map(k => data[k].prevYearTrir ?? 0)) : 0, 0.1);
  const chartH   = 200;

  return (
    <div style={{ position: "relative" }}>
      {/* Y-axis grid */}
      <div style={{ position: "relative", height: chartH, display: "flex", alignItems: "flex-end", gap: 8, padding: "0 0 0 40px" }}>
        {/* Horizontal guide lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(pct => {
          const y = chartH * (1 - pct);
          const val = (maxVal * pct).toFixed(2);
          return (
            <div key={pct} style={{ position: "absolute", left: 0, right: 0, top: y, display: "flex", alignItems: "center", gap: 6, pointerEvents: "none" }}>
              <span style={{ width: 32, textAlign: "right", fontSize: ".62rem", color: C.mist }}>{val}</span>
              <div style={{ flex: 1, height: 1, background: "#E8EFec" }} />
            </div>
          );
        })}

        {/* BLS benchmark line */}
        {showBls && blsRate <= maxVal && (
          <div style={{
            position: "absolute", left: 40, right: 0,
            top: chartH * (1 - blsRate / maxVal),
            borderTop: `2px dashed ${C.navy}`,
            display: "flex", alignItems: "center", justifyContent: "flex-end",
            paddingRight: 4, zIndex: 10,
          }}>
            <span style={{ fontSize: ".65rem", color: C.navy, background: C.white, padding: "1px 5px", borderRadius: 3, fontWeight: 600 }}>
              BLS {blsRate}
            </span>
          </div>
        )}

        {/* Bars */}
        {labels.map((label, i) => {
          const val       = data[label].trir;
          const prevVal   = data[label].prevYearTrir;
          const barH      = val > 0 ? Math.max((val / maxVal) * chartH, 4) : 0;
          const prevBarH  = (showPrevYear && prevVal != null && prevVal > 0) ? Math.max((prevVal / maxVal) * chartH, 4) : 0;
          const barColor  = val > blsRate ? C.red : val > blsRate * 0.5 ? C.gold : C.sage;

          return (
            <div key={label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, height: "100%", justifyContent: "flex-end", position: "relative" }}>
              {/* Value label on hover would go here */}
              <div style={{ display: "flex", gap: 2, alignItems: "flex-end", width: "100%" }}>
                {/* Current period bar */}
                <div style={{
                  flex: 1, height: barH, background: barColor, borderRadius: "3px 3px 0 0",
                  transition: "height .4s ease", minHeight: val > 0 ? 4 : 0,
                  position: "relative",
                }}>
                  {val > 0 && (
                    <div style={{ position: "absolute", top: -16, left: "50%", transform: "translateX(-50%)", fontSize: ".6rem", fontWeight: 700, color: barColor, whiteSpace: "nowrap" }}>
                      {val.toFixed(2)}
                    </div>
                  )}
                </div>
                {/* Prior year bar */}
                {showPrevYear && prevVal != null && (
                  <div style={{
                    flex: 1, height: prevBarH, background: "#D0DEDB",
                    borderRadius: "3px 3px 0 0", opacity: .7,
                    transition: "height .4s ease",
                  }} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* X-axis labels */}
      <div style={{ display: "flex", paddingLeft: 40, gap: 8, marginTop: 6 }}>
        {labels.map(label => (
          <div key={label} style={{ flex: 1, textAlign: "center", fontSize: ".65rem", color: C.mist, lineHeight: 1.2 }}>
            {label}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginTop: 12, justifyContent: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: ".72rem", color: C.slate }}>
          <div style={{ width: 12, height: 12, borderRadius: 2, background: C.sage }} /> Current TRIR
        </div>
        {showPrevYear && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: ".72rem", color: C.slate }}>
            <div style={{ width: 12, height: 12, borderRadius: 2, background: "#D0DEDB" }} /> Prior year (same period)
          </div>
        )}
        {showBls && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: ".72rem", color: C.navy }}>
            <div style={{ width: 16, height: 2, background: C.navy, borderRadius: 1 }} /> BLS industry rate
          </div>
        )}
      </div>
    </div>
  );
}

// ── Toggle switch ─────────────────────────────────────────────────────────────
function Toggle({ checked, onChange, label, sublabel }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0" }}>
      <div>
        <div style={{ fontSize: ".85rem", fontWeight: 500, color: C.ink }}>{label}</div>
        {sublabel && <div style={{ fontSize: ".72rem", color: C.mist, marginTop: 1 }}>{sublabel}</div>}
      </div>
      <div onClick={() => onChange(!checked)} style={{
        width: 40, height: 22, borderRadius: 22, flexShrink: 0, marginLeft: 12,
        background: checked ? C.navy : "#D0DEDB", cursor: "pointer",
        position: "relative", transition: "background .2s",
      }}>
        <div style={{ position: "absolute", width: 16, height: 16, borderRadius: "50%", background: C.white, top: 3, left: checked ? 21 : 3, transition: "left .18s", boxShadow: "0 1px 4px rgba(0,0,0,.2)" }} />
      </div>
    </div>
  );
}

function DesktopNav({ companyName = BRAND.company, onHome }) {
  return (
    <EHSHeader onHome={onHome} title={companyName} rightContent={
      <div style={{ fontSize: ".72rem", color: C.mist, background: "rgba(255,255,255,.08)", padding: "3px 12px", borderRadius: 20, whiteSpace: "nowrap" }}>Reports</div>
    } />
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function S5dReportBuilder({ companyName = BRAND.company, onBack, onHome }) {
  // Spec §15.3: user selects (1) time frame type, (2) specific period
  const [frameType,   setFrameType]   = useState("monthly");    // "monthly" | "quarterly"
  const [period,      setPeriod]      = useState("Jun 2024");
  const [site,        setSite]        = useState("All sites");
  const [showBls,     setShowBls]     = useState(false);         // off by default per spec
  const [showPrevYear,setShowPrevYear]= useState(false);         // off by default per spec
  const [generating,  setGenerating]  = useState(false);
  const [generated,   setGenerated]   = useState(false);
  const [tab,         setTab]         = useState("trir");        // "trir" | "incidents" | "training"

  // Spec §15.3: completed periods only — not future or in-progress
  const [rawMonths, setRawMonths] = useState([]);
  const [hoursNote, setHoursNote] = useState("");
  const [laborHours, setLaborHours] = useState([]); // [{site_id, month, hours}]
  const [showHoursEntry, setShowHoursEntry] = useState(false);
  const [hoursSite, setHoursSite] = useState(null);
  const [hoursValue, setHoursValue] = useState("");
  const [hoursSaved, setHoursSaved] = useState(false);
  const [hoursErr, setHoursErr] = useState("");

  function loadReport() {
    api.reportIncidentSummary().then(r => { setRawMonths(r.months ?? []); setHoursNote(r.hoursNote ?? ""); })
      .catch(err => console.error("Report data load failed:", err.message));
    api.getLaborHours().then(setLaborHours).catch(() => {});
  }
  useEffect(() => { loadReport(); }, []);

  // Build MONTHLY/QUARTERLY from real data, honoring the site filter.
  // TRIR uses RECORDABLE incidents (OSHA definition), not all injuries.
  const labelOf = ym => new Date(ym + "-15").toLocaleDateString("en-US", { month: "short", year: "numeric" });
  const pick = m => {
    if (site === "All sites") return { recordables: m.recordables, hours: m.estHours };
    const s = m.sites.find(x => x.site === site);
    return { recordables: s?.recordables ?? 0, hours: s?.estHours ?? 0 };
  };
  const trir = (rec, hrs) => hrs > 0 ? +((rec * 200000) / hrs).toFixed(2) : 0;

  // Per-month TRIR keyed by YYYY-MM, so prior-year lookup is exact.
  const monthlyByYm = {};
  rawMonths.forEach(m => {
    const { recordables, hours } = pick(m);
    monthlyByYm[m.month] = { recordables, hours, trir: trir(recordables, hours) };
  });
  const priorYm = ym => { const [y, mo] = ym.split("-"); return `${Number(y) - 1}-${mo}`; };

  // Show only the most recent 12 months (endpoint returns 24 for the YoY lookback).
  const recentMonths = rawMonths.slice(-12);
  const MONTHLY_LIVE = Object.fromEntries(recentMonths.map(m => {
    const cur = monthlyByYm[m.month];
    const prev = monthlyByYm[priorYm(m.month)];
    return [labelOf(m.month), { incidents: cur.recordables, hours: cur.hours, trir: cur.trir,
                                prevYearTrir: prev ? prev.trir : null, blsRate: 2.8 }];
  }));

  const quarterOf = ym => `Q${Math.floor((Number(ym.slice(5, 7)) - 1) / 3) + 1} ${ym.slice(0, 4)}`;
  const quarterAgg = {};
  rawMonths.forEach(m => {
    const q = quarterOf(m.month);
    const { recordables, hours } = pick(m);
    quarterAgg[q] = quarterAgg[q] ?? { recordables: 0, hours: 0 };
    quarterAgg[q].recordables += recordables;
    quarterAgg[q].hours += hours;
  });
  Object.values(quarterAgg).forEach(v => { v.trir = trir(v.recordables, v.hours); });
  const priorQ = q => { const [qq, y] = q.split(" "); return `${qq} ${Number(y) - 1}`; };
  // Most recent 4 quarters for display
  const recentQuarters = [...new Set(recentMonths.map(m => quarterOf(m.month)))].slice(-4);
  const QUARTERLY_LIVE = Object.fromEntries(recentQuarters.map(q => {
    const cur = quarterAgg[q];
    const prev = quarterAgg[priorQ(q)];
    return [q, { incidents: cur.recordables, hours: cur.hours, trir: cur.trir,
                 prevYearTrir: prev ? prev.trir : null, blsRate: 2.8 }];
  }));

  const monthlyPeriods   = Object.keys(MONTHLY_LIVE);
  const quarterlyPeriods = Object.keys(QUARTERLY_LIVE);
  const periods          = frameType === "monthly" ? monthlyPeriods : quarterlyPeriods;

  // Default the selected period to the latest available once live data arrives / frame flips.
  useEffect(() => {
    if (periods.length && !periods.includes(period)) setPeriod(periods[periods.length - 1]);
  }, [frameType, rawMonths.length]); // eslint-disable-line

  const chartData = frameType === "monthly" ? MONTHLY_LIVE : QUARTERLY_LIVE;
  const blsRate   = 2.8; // BLS industry avg for beverage manufacturing
  const blsEntered = true;

  // Scheduled report config
  const [scheduledCadence, setScheduledCadence] = useState("Monthly");
  const [scheduledRecips,  setScheduledRecips]  = useState(["Site Manager", "Company Admin"]);
  const [scheduleActive,   setScheduleActive]   = useState(false);
  const [savedSchedule,    setSavedSchedule]    = useState(false);

  function handleGenerate() {
    setGenerating(true);
    setTimeout(() => { setGenerating(false); setGenerated(true); }, 400);
  }

  function exportReportCSV() {
    const rows = [
      [`${companyName} — TRIR Report (${frameType})`],
      [`Site: ${site}`, `Generated: ${new Date().toLocaleString()}`],
      ["Note: " + (hoursNote || "")],
      [],
      ["Period", "Recordables", "Hours", "TRIR", "Prior-Year TRIR", "BLS Rate"],
      ...periods.map(p => {
        const d = chartData[p] || {};
        return [p, d.incidents ?? 0, d.hours ?? 0, d.trir ?? 0,
                d.prevYearTrir == null ? "—" : d.prevYearTrir, d.blsRate ?? "—"];
      }),
    ];
    const esc = v => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const csv = rows.map(r => r.map(esc).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `TRIR-${site.replace(/\s+/g, "_")}-${frameType}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  function exportReportPDF() { window.print(); }

  // Map the selected monthly period label ("Jun 2024") back to its YYYY-MM.
  const ymForPeriod = () => {
    if (frameType !== "monthly") return null;
    const m = recentMonths.find(x => labelOf(x.month) === period);
    return m ? m.month : null;
  };
  function saveHours() {
    setHoursErr(""); setHoursSaved(false);
    const ym = ymForPeriod();
    const siteId = hoursSite ?? (BRAND.siteRecords ?? [])[0]?.id;
    if (!ym || !siteId) { setHoursErr("Pick a monthly period and a site first."); return; }
    const val = Number(hoursValue);
    if (!Number.isFinite(val) || val < 0) { setHoursErr("Enter a valid number of hours."); return; }
    api.setLaborHours(siteId, ym, val)
      .then(() => { setHoursSaved(true); setHoursValue(""); loadReport(); setTimeout(() => setHoursSaved(false), 1800); })
      .catch(err => setHoursErr(err.message || "Save failed"));
  }

  const inputStyle = focused => ({
    padding: "9px 12px", border: `1.5px solid ${focused ? C.sage : "#D0DEDB"}`,
    borderRadius: 7, fontFamily: "'DM Sans', sans-serif",
    fontSize: ".88rem", color: C.ink, background: C.white, outline: "none",
    transition: "all .18s", cursor: "pointer", appearance: "none",
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%238FA3A0'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", paddingRight: 32,
  });

  return (
    <div style={{ minHeight: "100vh", background: C.chalk, fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin   { to { transform: rotate(360deg); } }
        .anim { animation: fadeUp .25s ease both; }
        .generate-btn:hover:not(:disabled) { background: ${C.pine} !important; transform: translateY(-1px); }
        .tab-btn:hover { color: ${C.pine} !important; }
        select option { color: ${C.ink}; }
      `}</style>

      <DesktopNav onHome={onHome} companyName={companyName} />

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px" }}>

        {/* Header */}
        <div className="anim" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: C.ink }}>Report Builder</h1>
            <p style={{ fontSize: ".85rem", color: C.mist, marginTop: 3 }}>Generate reports for any historical period. Includes TRIR, incident summary, and training compliance.</p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20, alignItems: "start" }}>

          {/* Left: report configuration panel */}
          <div>
            {/* Manual report config */}
            <div className="anim" style={{ background: C.white, borderRadius: 10, boxShadow: "0 2px 12px rgba(15,31,23,.07)", padding: 20, marginBottom: 14 }}>
              <h2 style={{ fontSize: ".95rem", fontWeight: 600, color: C.ink, marginBottom: 16 }}>Manual report</h2>

              {/* Spec §15.3: (1) time frame type */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: ".7rem", fontWeight: 600, color: C.sage, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>Time frame type</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {["monthly", "quarterly"].map(t => (
                    <button key={t} onClick={() => { setFrameType(t); setPeriod(t === "monthly" ? monthlyPeriods[monthlyPeriods.length - 1] : quarterlyPeriods[0]); setGenerated(false); }} style={{
                      flex: 1, padding: "8px 10px",
                      background: frameType === t ? C.sage : C.chalk,
                      border: `1.5px solid ${frameType === t ? C.sage : "#D0DEDB"}`,
                      borderRadius: 7, fontFamily: "'DM Sans', sans-serif",
                      fontSize: ".82rem", fontWeight: 600,
                      color: frameType === t ? C.white : C.slate,
                      cursor: "pointer", transition: "all .15s",
                    }}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
                  ))}
                </div>
              </div>

              {/* Spec §15.3: (2) specific period — completed periods only */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: ".7rem", fontWeight: 600, color: C.sage, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>
                  Period <span style={{ fontWeight: 400, color: C.mist, textTransform: "none" }}>(completed only)</span>
                </div>
                <select value={period} onChange={e => { setPeriod(e.target.value); setGenerated(false); }} style={{ width: "100%", ...inputStyle(false) }}>
                  {periods.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>

              {/* Site scope */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: ".7rem", fontWeight: 600, color: C.sage, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>Site scope</div>
                <select value={site} onChange={e => { setSite(e.target.value); setGenerated(false); }} style={{ width: "100%", ...inputStyle(false) }}>
                  {SITES().map(s => <option key={s}>{s}</option>)}
                </select>
              </div>

              <button
                className="generate-btn"
                onClick={handleGenerate}
                disabled={generating}
                style={{
                  width: "100%", padding: "11px",
                  background: generating ? C.sage + "80" : C.sage,
                  color: C.white, border: "none", borderRadius: 8,
                  fontFamily: "'DM Sans', sans-serif", fontSize: ".9rem", fontWeight: 700,
                  cursor: generating ? "default" : "pointer", transition: "all .18s",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                {generating ? (
                  <>
                    <span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,.4)", borderTopColor: C.white, borderRadius: "50%", display: "inline-block", animation: "spin .7s linear infinite" }} />
                    Generating…
                  </>
                ) : generated ? "✓ Report ready — re-generate" : "Generate report"}
              </button>

              {generated && (
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button onClick={exportReportPDF} style={{ flex: 1, padding: "8px", background: C.white, color: C.pine, border: `1.5px solid ${C.mint}`, borderRadius: 7, fontFamily: "'DM Sans', sans-serif", fontSize: ".8rem", fontWeight: 600, cursor: "pointer" }}>Export PDF</button>
                  <button onClick={exportReportCSV} style={{ flex: 1, padding: "8px", background: C.white, color: C.pine, border: `1.5px solid ${C.mint}`, borderRadius: 7, fontFamily: "'DM Sans', sans-serif", fontSize: ".8rem", fontWeight: 600, cursor: "pointer" }}>Export CSV</button>
                </div>
              )}
            </div>

            {/* Benchmark overlays — spec §15.3: both off by default, toggleable independently */}
            {generated && (
              <div className="anim" style={{ background: C.white, borderRadius: 10, boxShadow: "0 2px 12px rgba(15,31,23,.07)", padding: 20, marginBottom: 14 }}>
                <h2 style={{ fontSize: ".95rem", fontWeight: 600, color: C.ink, marginBottom: 4 }}>Benchmark overlays</h2>
                <p style={{ fontSize: ".75rem", color: C.mist, marginBottom: 14 }}>TRIR view only. Both off by default.</p>

                <Toggle
                  label="BLS industry rate"
                  sublabel={blsEntered ? `${blsRate} (Spirits / Distilling, 2024)` : "Not entered — add in site settings"}
                  checked={showBls && blsEntered}
                  onChange={v => blsEntered ? setShowBls(v) : null}
                />
                {!blsEntered && (
                  <div style={{ fontSize: ".72rem", color: C.gold, marginBottom: 4 }}>⚠ Enter BLS rate in site settings to enable this overlay.</div>
                )}

                <div style={{ height: 1, background: "#E8EFec", margin: "8px 0" }} />

                <Toggle
                  label="Prior year (same period)"
                  sublabel={`Compare to ${frameType === "monthly" ? period.replace("2024", "2023") : period.replace("2024", "2023")}`}
                  checked={showPrevYear}
                  onChange={setShowPrevYear}
                />
              </div>
            )}

            {/* Scheduled reports — spec §15.3: weekly/monthly/quarterly cadences */}
            <div className="anim" style={{ background: C.white, borderRadius: 10, boxShadow: "0 2px 12px rgba(15,31,23,.07)", padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <h2 style={{ fontSize: ".95rem", fontWeight: 600, color: C.ink }}>Scheduled reports</h2>
                <div onClick={() => { setScheduleActive(a => !a); setSavedSchedule(false); }} style={{
                  width: 40, height: 22, borderRadius: 22, flexShrink: 0,
                  background: scheduleActive ? C.sage : "#D0DEDB", cursor: "pointer",
                  position: "relative", transition: "background .2s",
                }}>
                  <div style={{ position: "absolute", width: 16, height: 16, borderRadius: "50%", background: C.white, top: 3, left: scheduleActive ? 21 : 3, transition: "left .18s" }} />
                </div>
              </div>

              {scheduleActive && (
                <div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: ".7rem", fontWeight: 600, color: C.sage, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>Cadence</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {SCHEDULED_CADENCES.map(c => (
                        <button key={c} onClick={() => setScheduledCadence(c)} style={{
                          flex: 1, padding: "7px 4px",
                          background: scheduledCadence === c ? C.sage : C.chalk,
                          border: `1.5px solid ${scheduledCadence === c ? C.sage : "#D0DEDB"}`,
                          borderRadius: 6, fontFamily: "'DM Sans', sans-serif",
                          fontSize: ".75rem", fontWeight: 600,
                          color: scheduledCadence === c ? C.white : C.slate,
                          cursor: "pointer", transition: "all .12s",
                        }}>{c}</button>
                      ))}
                    </div>
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: ".7rem", fontWeight: 600, color: C.sage, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>Recipients</div>
                    {["Site Manager", "Company Admin", "Safety Officer"].map(role => (
                      <label key={role} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, cursor: "pointer" }}>
                        <input type="checkbox" checked={scheduledRecips.includes(role)}
                          onChange={() => setScheduledRecips(rs => rs.includes(role) ? rs.filter(r => r !== role) : [...rs, role])}
                          style={{ accentColor: C.sage, cursor: "pointer" }} />
                        <span style={{ fontSize: ".85rem", color: C.ink }}>{role}</span>
                      </label>
                    ))}
                  </div>
                  <button onClick={() => { setSavedSchedule(true); setTimeout(() => setSavedSchedule(false), 2000); }} style={{
                    width: "100%", padding: "9px",
                    background: savedSchedule ? C.sage + "88" : C.sage,
                    color: C.white, border: "none", borderRadius: 7,
                    fontFamily: "'DM Sans', sans-serif", fontSize: ".85rem", fontWeight: 600, cursor: "pointer",
                  }}>
                    {savedSchedule ? "✓ Schedule saved" : "Save schedule"}
                  </button>
                </div>
              )}

              {!scheduleActive && (
                <p style={{ fontSize: ".78rem", color: C.mist }}>Enable to send this report automatically on a recurring cadence.</p>
              )}
            </div>
          </div>

          {/* Right: report preview */}
          {generated ? (
            <div>
              {/* Report header */}
              <div className="anim" style={{ background: C.white, borderRadius: 10, boxShadow: "0 2px 12px rgba(15,31,23,.07)", padding: "18px 22px", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: ".75rem", color: C.mist, marginBottom: 4 }}>
                      {frameType === "monthly" ? "Monthly Report" : "Quarterly Report"} · Generated {new Date().toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                    </div>
                    <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: C.ink }}>{period} · {site}</h2>
                    <p style={{ fontSize: ".78rem", color: C.mist, marginTop: 2 }}>{BRAND.company} · {BRAND.industry}</p>
                  </div>
                </div>
              </div>

              {/* Report tabs */}
              <div className="anim" style={{ display: "flex", background: C.white, borderRadius: 10, boxShadow: "0 2px 12px rgba(15,31,23,.07)", overflow: "hidden", marginBottom: 14 }}>
                {[
                  { id: "trir",      label: "TRIR & Incidents" },
                  { id: "findings",  label: "Findings"         },
                  { id: "training",  label: "Training"         },
                ].map(t => (
                  <button key={t.id} className="tab-btn" onClick={() => setTab(t.id)} style={{
                    flex: 1, padding: "12px",
                    background: tab === t.id ? C.foam : C.white,
                    color: tab === t.id ? C.pine : C.slate,
                    border: "none",
                    borderBottom: tab === t.id ? `3px solid ${C.sage}` : "3px solid transparent",
                    fontFamily: "'DM Sans', sans-serif", fontSize: ".85rem", fontWeight: 600,
                    cursor: "pointer", transition: "all .15s",
                  }}>{t.label}</button>
                ))}
              </div>

              {/* TRIR chart tab */}
              {tab === "trir" && (
                <div className="anim" style={{ background: C.white, borderRadius: 10, boxShadow: "0 2px 12px rgba(15,31,23,.07)", padding: "18px 22px" }}>
                  <div style={{ marginBottom: 20 }}>
                    <h3 style={{ fontSize: ".95rem", fontWeight: 600, color: C.ink, marginBottom: 4 }}>Total Recordable Incident Rate (TRIR)</h3>
                    <p style={{ fontSize: ".75rem", color: C.mist }}>TRIR = (recordable incidents × 200,000) / total hours worked</p>
                  </div>

                  <BarChart
                    data={chartData}
                    showBls={showBls}
                    showPrevYear={showPrevYear}
                    blsRate={blsRate}
                  />
                  {hoursNote && <div style={{ fontSize: ".68rem", color: "#8FA3A0", marginTop: 6, fontStyle: "italic" }}>{hoursNote}</div>}

                  <button onClick={() => { setShowHoursEntry(v => !v); setHoursErr(""); }} style={{
                    marginTop: 10, background: "none", border: "none", color: C.sage,
                    fontSize: ".76rem", fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", padding: 0,
                  }}>{showHoursEntry ? "− Hide hours entry" : "+ Enter actual payroll hours"}</button>

                  {showHoursEntry && (
                    <div style={{ marginTop: 10, padding: "12px 14px", background: C.chalk, borderRadius: 8, border: "1px solid #E8EFec" }}>
                      {frameType !== "monthly" ? (
                        <div style={{ fontSize: ".76rem", color: C.mist }}>Switch to the monthly view to enter hours for a specific month.</div>
                      ) : (
                        <>
                          <div style={{ fontSize: ".72rem", color: C.slate, marginBottom: 8 }}>
                            Actual hours worked for <strong>{period}</strong> (overrides the headcount estimate for TRIR).
                          </div>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                            <select value={hoursSite ?? (BRAND.siteRecords ?? [])[0]?.id ?? ""} onChange={e => setHoursSite(Number(e.target.value))}
                              style={{ ...inputStyle(false), flex: "1 1 120px", minWidth: 110 }}>
                              {(BRAND.siteRecords ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                            <input type="number" min="0" inputMode="numeric" placeholder="Hours" value={hoursValue}
                              onChange={e => setHoursValue(e.target.value)}
                              style={{ ...inputStyle(false), flex: "1 1 90px", minWidth: 80, backgroundImage: "none", paddingRight: 12 }} />
                            <button onClick={saveHours} style={{ padding: "9px 16px", background: C.sage, color: C.white, border: "none", borderRadius: 7, fontFamily: "'DM Sans', sans-serif", fontSize: ".82rem", fontWeight: 700, cursor: "pointer" }}>Save</button>
                          </div>
                          {hoursErr && <div style={{ fontSize: ".72rem", color: C.red, marginTop: 6 }}>{hoursErr}</div>}
                          {hoursSaved && <div style={{ fontSize: ".72rem", color: C.pine, marginTop: 6 }}>✓ Saved — TRIR updated.</div>}
                          <div style={{ fontSize: ".68rem", color: C.mist, marginTop: 8 }}>Enter 0 to clear and revert to the estimate. Tip: sum all employees' hours for the month.</div>
                        </>
                      )}
                    </div>
                  )}

                  {/* KPI summary below chart */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginTop: 22, paddingTop: 18, borderTop: "1px solid #E8EFec" }}>
                    {[
                      { label: "Period TRIR",         value: chartData[period]?.trir.toFixed(2) ?? "—",  color: C.ink  },
                      { label: "Recordable incidents",value: chartData[period]?.incidents ?? 0,           color: C.red  },
                      { label: "Total hours worked",  value: (chartData[period]?.hours ?? 0).toLocaleString(), color: C.slate },
                    ].map((stat, i) => (
                      <div key={i} style={{ textAlign: "center" }}>
                        <div style={{ fontSize: "1.5rem", fontWeight: 700, color: stat.color }}>{stat.value}</div>
                        <div style={{ fontSize: ".72rem", color: C.mist, marginTop: 3 }}>{stat.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* BLS context note */}
                  {showBls && (
                    <div style={{ marginTop: 14, padding: "10px 14px", background: C.navyLt, borderLeft: `3px solid ${C.navy}`, borderRadius: 7, fontSize: ".78rem", color: C.navy, lineHeight: 1.5 }}>
                      BLS industry TRIR for Spirits / Distilling (NAICS 3121): <strong>{blsRate}</strong> · Source: BLS SOII 2023 · Stored in site settings.
                    </div>
                  )}
                </div>
              )}

              {tab === "findings" && (
                <div className="anim" style={{ background: C.white, borderRadius: 10, boxShadow: "0 2px 12px rgba(15,31,23,.07)", padding: "18px 22px" }}>
                  <h3 style={{ fontSize: ".95rem", fontWeight: 600, color: C.ink, marginBottom: 16 }}>Findings Summary — {period}</h3>
                  {[
                    { label: "New findings logged",   value: 4, color: C.ink    },
                    { label: "Critical",              value: 1, color: C.red    },
                    { label: "Major",                 value: 2, color: C.orange },
                    { label: "Resolved in period",    value: 3, color: C.sage   },
                    { label: "CapEx-flagged",         value: 1, color: C.navy   },
                  ].map((row, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderBottom: i < 4 ? "1px solid #F0F4F2" : "none" }}>
                      <span style={{ fontSize: ".88rem", color: C.slate }}>{row.label}</span>
                      <span style={{ fontWeight: 700, color: row.color, fontSize: ".95rem" }}>{row.value}</span>
                    </div>
                  ))}
                </div>
              )}

              {tab === "training" && (
                <div className="anim" style={{ background: C.white, borderRadius: 10, boxShadow: "0 2px 12px rgba(15,31,23,.07)", padding: "18px 22px" }}>
                  <h3 style={{ fontSize: ".95rem", fontWeight: 600, color: C.ink, marginBottom: 16 }}>Training Compliance — {period}</h3>
                  {[
                    { label: "Overall compliance",       value: "74%",  color: C.gold  },
                    { label: "Staff with overdue training",value: 7,    color: C.red   },
                    { label: "Completions this period",  value: 14,     color: C.ink   },
                    { label: "Expiring within 30 days",  value: 3,      color: C.gold  },
                  ].map((row, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderBottom: i < 3 ? "1px solid #F0F4F2" : "none" }}>
                      <span style={{ fontSize: ".88rem", color: C.slate }}>{row.label}</span>
                      <span style={{ fontWeight: 700, color: row.color, fontSize: ".95rem" }}>{row.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="anim" style={{
              background: C.white, borderRadius: 10,
              boxShadow: "0 2px 12px rgba(15,31,23,.07)",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              padding: "60px 32px", textAlign: "center",
            }}>
              <div style={{ fontSize: "2rem", marginBottom: 12, opacity: .4 }}>📊</div>
              <div style={{ fontSize: ".92rem", fontWeight: 600, color: C.ink, marginBottom: 6 }}>No report generated yet</div>
              <div style={{ fontSize: ".82rem", color: C.mist, lineHeight: 1.5 }}>
                Select a time frame and period, then click Generate to preview your report.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
