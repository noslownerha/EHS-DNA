import { useState, useEffect, useMemo } from "react";
import { EHSHeader } from "./AppShell.jsx";
import { BRAND, COLORS } from "./constants.js";
import { parseCSV, downloadCSV, readFileText } from "./csv.js";
import { api } from "./api.js";

const C = { ...COLORS };

// ── Seed TRIR data ────────────────────────────────────────────────────────────
// TRIR = (recordable incidents × 200,000) / total hours worked.
// Trend data is computed live from /api/reports/incident-summary (see MONTHLY_LIVE
// / QUARTERLY_LIVE below) — there is intentionally no seed/sample data here.

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

function DesktopNav({ companyName = BRAND.company, onHome, onBack }) {
  return (
    <EHSHeader onHome={onHome} onBack={onBack} title={companyName} rightContent={
      <div style={{ fontSize: ".72rem", color: C.mist, background: "rgba(255,255,255,.08)", padding: "3px 12px", borderRadius: 20, whiteSpace: "nowrap" }}>Reports</div>
    } />
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function S5dReportBuilder({ companyName = BRAND.company, onBack, onHome }) {
  // Spec §15.3: user selects (1) time frame type, (2) specific period
  const [frameType,   setFrameType]   = useState("monthly");    // "monthly" | "quarterly"
  const [period,      setPeriod]      = useState("");
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
  const [hoursSaved, setHoursSaved] = useState(false);
  const [hoursErr, setHoursErr] = useState("");
  const [gridEdits, setGridEdits] = useState({});   // `${siteId}|${ym}` -> string (unsaved edits)
  const [gridSaving, setGridSaving] = useState(false);
  const [oshaYear, setOshaYear]   = useState(new Date().getFullYear());
  const [osha300, setOsha300]     = useState(null);
  const [osha300Loading, setOsha300Loading] = useState(false);
  const [ftData, setFtData]       = useState(null);   // real findings + training summary
  const [mbrBusy, setMbrBusy]     = useState(false);
  const [mbrErr, setMbrErr]       = useState("");
  const [findingsList, setFindingsList] = useState(null); // full findings for drill-down
  const [openBucket, setOpenBucket] = useState(null);  // which finding bucket is expanded

  // Load the OSHA 300 log/300A summary for the selected year (on demand).
  useEffect(() => {
    if (tab !== "osha300") return;
    setOsha300Loading(true);
    api.osha300(oshaYear).then(setOsha300).catch(() => setOsha300(null)).finally(() => setOsha300Loading(false));
  }, [tab, oshaYear]);

  function exportOsha300CSV() {
    if (!osha300?.cases) return;
    const header = ["Case No.", "Employee", "Job Title", "Date", "Establishment", "Location",
      "Description", "Death", "Days Away", "Restricted/Transfer", "Other Recordable", "Type"];
    const rows = [header, ...osha300.cases.map(c => [
      c.caseNo, c.employee, c.jobTitle, c.date, c.site, c.location, c.description,
      c.classification === "death" ? "X" : "", c.classification === "days_away" ? "X" : "",
      c.classification === "restricted" ? "X" : "", c.classification === "other" ? "X" : "", c.injuryType,
    ])];
    const esc = v => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const csv = rows.map(r => r.map(esc).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `OSHA-300-${oshaYear}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  function loadReport() {
    api.reportIncidentSummary().then(r => { setRawMonths(r.months ?? []); setHoursNote(r.hoursNote ?? ""); })
      .catch(err => console.error("Report data load failed:", err.message));
    api.getLaborHours().then(setLaborHours).catch(() => {});
  }
  useEffect(() => { loadReport(); }, []);

  // Map a display label ("Jun 2024") back to its YYYY-MM so we can scope the
  // findings/training summary to the selected period.
  const labelToYm = {};
  rawMonths.forEach(m => { labelToYm[new Date(m.month + "-15").toLocaleDateString("en-US", { month: "short", year: "numeric" })] = m.month; });

  // Load real findings + training compliance for the Findings/Training tabs,
  // scoped to the selected period (falls back to lifetime if the label is a quarter).
  useEffect(() => {
    if (tab !== "findings" && tab !== "training") return;
    const ym = labelToYm[period] || null;   // quarters won't map → null = lifetime/current
    api.reportFindingsTraining(ym).then(setFtData).catch(() => setFtData(null));
    if (tab === "findings" && findingsList === null) {
      api.listFindings().then(setFindingsList).catch(() => setFindingsList([]));
    }
  }, [tab, period, rawMonths.length]); // eslint-disable-line

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

  // Saved actual hours lookup for grid pre-fill
  const savedHoursMap = {};
  laborHours.forEach(r => { savedHoursMap[`${r.site_id}|${r.month}`] = r.hours; });
  const gridCellValue = (siteId, ym) => {
    const key = `${siteId}|${ym}`;
    if (key in gridEdits) return gridEdits[key];
    return savedHoursMap[key] != null ? String(savedHoursMap[key]) : "";
  };
  function saveGrid() {
    setHoursErr(""); setHoursSaved(false);
    const entries = Object.entries(gridEdits)
      .map(([key, v]) => { const [siteId, month] = key.split("|"); return { siteId: Number(siteId), month, hours: v === "" ? 0 : Number(v) }; })
      .filter(e => Number.isFinite(e.hours) && e.hours >= 0);
    if (!entries.length) { setHoursErr("No changes to save."); return; }
    setGridSaving(true);
    api.setLaborHoursBulk(entries)
      .then(r => { setHoursSaved(true); setGridEdits({}); loadReport(); setTimeout(() => setHoursSaved(false), 1800); })
      .catch(err => setHoursErr(err.message || "Bulk save failed"))
      .finally(() => setGridSaving(false));
  }

  function downloadHoursTemplate() {
    // One row per site × recent month, pre-filled with any saved actuals — a ready-to-edit grid.
    const rows = [];
    (BRAND.siteRecords ?? []).forEach(s => {
      recentMonths.forEach(m => {
        rows.push([s.name, m.month, savedHoursMap[`${s.id}|${m.month}`] ?? ""]);
      });
    });
    downloadCSV("labor-hours-template.csv", ["site", "month", "hours"], rows);
  }

  async function importHoursCSV(file) {
    setHoursErr(""); setHoursSaved(false);
    try {
      const text = await readFileText(file);
      const { headers, rows } = parseCSV(text);
      const lower = headers.map(h => h.toLowerCase());
      if (!["site", "month", "hours"].every(h => lower.includes(h))) {
        setHoursErr("CSV needs columns: site, month, hours"); return;
      }
      const siteByName = {};
      (BRAND.siteRecords ?? []).forEach(s => { siteByName[s.name.trim().toLowerCase()] = s.id; });
      const edits = {}; let bad = 0;
      rows.forEach(r => {
        const o = {}; Object.keys(r).forEach(k => { o[k.toLowerCase()] = r[k]; });
        const siteId = siteByName[String(o.site ?? "").trim().toLowerCase()];
        const month = String(o.month ?? "").trim();
        if (!siteId || !/^\d{4}-\d{2}$/.test(month) || o.hours === "" || o.hours == null) { bad++; return; }
        edits[`${siteId}|${month}`] = String(o.hours).trim();
      });
      if (!Object.keys(edits).length) { setHoursErr("No valid rows found (check site names and YYYY-MM months)."); return; }
      setGridEdits(g => ({ ...g, ...edits }));
      if (bad) setHoursErr(`${Object.keys(edits).length} rows loaded, ${bad} skipped — review highlighted cells, then Save all.`);
    } catch (e) { setHoursErr(e.message || "Import failed"); }
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

      <DesktopNav onHome={onHome} onBack={onBack} companyName={companyName} />

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px" }}>

        {/* Header */}
        <div className="anim" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: C.ink }}>Report Builder</h1>
            <p style={{ fontSize: ".85rem", color: C.mist, marginTop: 3 }}>Generate reports for any historical period. Includes TRIR, incident summary, and training compliance.</p>
          </div>
          <button onClick={async () => {
            setMbrBusy(true); setMbrErr("");
            try { await api.mbrExport(labelToYm[period] || null); }
            catch (e) { setMbrErr("Export failed — try again."); }
            finally { setMbrBusy(false); }
          }} disabled={mbrBusy} style={{
            padding: "10px 18px", background: mbrBusy ? "#C8D8CE" : C.sage, color: "#fff", border: "none",
            borderRadius: 8, fontFamily: "'DM Sans', sans-serif", fontSize: ".85rem", fontWeight: 700,
            cursor: mbrBusy ? "wait" : "pointer", whiteSpace: "nowrap",
          }}>{mbrBusy ? "Generating…" : "📊 Export MBR slide"}</button>
        </div>
        {mbrErr && <div style={{ marginTop: -12, marginBottom: 16, fontSize: ".8rem", color: C.red }}>{mbrErr}</div>}

        <div className="split-pane" style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20, alignItems: "start" }}>

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
                  { id: "osha300",   label: "OSHA 300"         },
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
                  {hoursNote && (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 7, marginTop: 10, padding: "8px 11px", background: "#F3F8F5", border: "1px solid #DCEAE1", borderRadius: 7 }}>
                      <span style={{ fontSize: ".8rem", lineHeight: 1 }}>ℹ️</span>
                      <span style={{ fontSize: ".72rem", color: C.slate, lineHeight: 1.4 }}>{hoursNote}</span>
                    </div>
                  )}

                  <button onClick={() => { setShowHoursEntry(v => !v); setHoursErr(""); }} style={{
                    marginTop: 10, padding: "8px 14px", background: showHoursEntry ? C.white : C.sage,
                    color: showHoursEntry ? C.sage : C.white, border: `1.5px solid ${C.sage}`, borderRadius: 7,
                    fontSize: ".78rem", fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                  }}>{showHoursEntry ? "− Hide hours entry" : "⏱ Enter actual payroll hours"}</button>

                  {showHoursEntry && (
                    <div className="no-print" style={{ marginTop: 10, padding: "12px 14px", background: C.chalk, borderRadius: 8, border: "1px solid #E8EFec" }}>
                      <div style={{ fontSize: ".72rem", color: C.slate, marginBottom: 4 }}>
                        Actual hours worked per site per month — overrides the headcount estimate for TRIR.
                      </div>
                      <div style={{ fontSize: ".68rem", color: C.mist, marginBottom: 10 }}>
                        Blank = use estimate. Enter 0 to force-clear. Sum all employees' hours for that month.
                      </div>
                      <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", borderRadius: 6 }}>
                        <table style={{ borderCollapse: "collapse", fontSize: ".76rem", minWidth: "100%" }}>
                          <thead>
                            <tr>
                              <th style={{ position: "sticky", left: 0, background: C.chalk, zIndex: 1, textAlign: "left", padding: "6px 10px 6px 2px", color: C.mist, fontWeight: 600, whiteSpace: "nowrap" }}>Site</th>
                              {recentMonths.map(m => (
                                <th key={m.month} style={{ padding: "6px 4px", color: C.mist, fontWeight: 600, whiteSpace: "nowrap", textAlign: "center", minWidth: 62 }}>
                                  {new Date(m.month + "-15").toLocaleDateString("en-US", { month: "short" })}<br />
                                  <span style={{ fontSize: ".62rem", opacity: .7 }}>{m.month.slice(0, 4)}</span>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(BRAND.siteRecords ?? []).map(s => (
                              <tr key={s.id}>
                                <td style={{ position: "sticky", left: 0, background: C.chalk, zIndex: 1, padding: "4px 10px 4px 2px", fontWeight: 600, color: C.ink, whiteSpace: "nowrap" }}>{s.name}</td>
                                {recentMonths.map(m => {
                                  const key = `${s.id}|${m.month}`;
                                  const edited = key in gridEdits;
                                  return (
                                    <td key={m.month} style={{ padding: 2 }}>
                                      <input type="number" min="0" inputMode="numeric"
                                        value={gridCellValue(s.id, m.month)}
                                        onChange={e => setGridEdits(g => ({ ...g, [key]: e.target.value }))}
                                        style={{
                                          width: 58, padding: "6px 4px", textAlign: "center",
                                          border: `1.5px solid ${edited ? C.sage : "#D9E4E0"}`,
                                          background: edited ? "#F3F8F5" : C.white,
                                          borderRadius: 5, fontFamily: "'DM Mono', monospace", fontSize: ".72rem",
                                          color: C.ink, outline: "none",
                                        }} />
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12 }}>
                        <button onClick={saveGrid} disabled={gridSaving || !Object.keys(gridEdits).length} style={{
                          padding: "9px 18px", background: (gridSaving || !Object.keys(gridEdits).length) ? C.sage + "80" : C.sage,
                          color: C.white, border: "none", borderRadius: 7, fontFamily: "'DM Sans', sans-serif",
                          fontSize: ".82rem", fontWeight: 700, cursor: (gridSaving || !Object.keys(gridEdits).length) ? "default" : "pointer",
                        }}>{gridSaving ? "Saving…" : `Save all${Object.keys(gridEdits).length ? ` (${Object.keys(gridEdits).length})` : ""}`}</button>
                        {Object.keys(gridEdits).length > 0 && (
                          <button onClick={() => setGridEdits({})} style={{ background: "none", border: "none", color: C.mist, fontSize: ".76rem", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Discard changes</button>
                        )}
                        <div style={{ flex: 1 }} />
                        <button onClick={downloadHoursTemplate} style={{ background: "none", border: "none", color: C.sage, fontSize: ".76rem", fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Get template</button>
                        <label style={{ color: C.sage, fontSize: ".76rem", fontWeight: 600, cursor: "pointer" }}>
                          Import CSV
                          <input type="file" accept=".csv" style={{ display: "none" }}
                            onChange={e => e.target.files[0] && importHoursCSV(e.target.files[0])} />
                        </label>
                      </div>
                      {hoursErr && <div style={{ fontSize: ".72rem", color: C.red, marginTop: 6 }}>{hoursErr}</div>}
                      {hoursSaved && <div style={{ fontSize: ".72rem", color: C.pine, marginTop: 6 }}>✓ Saved — TRIR updated.</div>}
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
                  <h3 style={{ fontSize: ".95rem", fontWeight: 600, color: C.ink, marginBottom: 4 }}>Findings Summary — {period}</h3>
                  <div style={{ fontSize: ".72rem", color: C.mist, marginBottom: 14 }}>Tap a row to see the findings behind the number.</div>
                  {!ftData ? (
                    <div style={{ padding: 20, textAlign: "center", color: C.mist, fontSize: ".85rem" }}>Loading…</div>
                  ) : (() => {
                    // The counts come from the server already excluding non-safety
                    // items; the drill-in list must apply the SAME filter or the
                    // rows won't add up to the number above them.
                    const isSafety = f => f.safety_relevant !== 0;
                    const all = (findingsList || []).filter(isSafety);
                    const nonSafetyRows = (findingsList || []).filter(f => !isSafety(f));
                    const ns = ftData.nonSafety ?? {};
                    const buckets = [
                      { key: "new",      label: "New findings logged", value: ftData.findings.new,             color: C.ink,    filter: () => all },
                      { key: "critical", label: "Critical",            value: ftData.findings.critical,        color: C.red,    filter: () => all.filter(f => f.severity === "critical") },
                      { key: "high",     label: "High severity",       value: ftData.findings.high,            color: C.orange, filter: () => all.filter(f => f.severity === "high") },
                      { key: "resolved", label: "Resolved in period",  value: ftData.findings.resolvedInPeriod, color: C.sage,  filter: () => all.filter(f => f.status === "resolved") },
                      { key: "open",     label: "Currently open",      value: ftData.findings.open,            color: C.navy,   filter: () => all.filter(f => f.status === "open") },
                    ];
                    const bucketRows = buckets.map((b, i) => {
                      const isOpen = openBucket === b.key;
                      const rows = isOpen ? b.filter() : [];
                      const clickable = b.value > 0;
                      return (
                        <div key={b.key} style={{ borderBottom: i < buckets.length - 1 && !isOpen ? "1px solid #F0F4F2" : "none" }}>
                          <div onClick={() => clickable && setOpenBucket(isOpen ? null : b.key)}
                            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", cursor: clickable ? "pointer" : "default" }}>
                            <span style={{ fontSize: ".88rem", color: C.slate, display: "flex", alignItems: "center", gap: 6 }}>
                              {clickable && <span style={{ fontSize: ".7rem", color: C.mist, transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .15s" }}>▶</span>}
                              {b.label}
                            </span>
                            <span style={{ fontWeight: 700, color: b.color, fontSize: ".95rem" }}>{b.value}</span>
                          </div>
                          {isOpen && (
                            <div style={{ paddingBottom: 10 }}>
                              {rows.length === 0 ? (
                                <div style={{ fontSize: ".78rem", color: C.mist, padding: "4px 0 8px 18px" }}>No matching findings on record.</div>
                              ) : rows.slice(0, 25).map(f => (
                                <div key={f.id} style={{ padding: "8px 10px 8px 18px", marginBottom: 6, background: C.chalk, borderRadius: 7, borderLeft: `3px solid ${b.color}` }}>
                                  <div style={{ fontSize: ".82rem", color: C.ink, lineHeight: 1.35 }}>{f.description}</div>
                                  <div style={{ fontSize: ".7rem", color: C.mist, marginTop: 3 }}>
                                    {f.site_name ?? "—"} · {f.severity} · {f.status}{f.created_at ? ` · ${String(f.created_at).slice(0, 10)}` : ""}
                                  </div>
                                </div>
                              ))}
                              {rows.length > 25 && <div style={{ fontSize: ".72rem", color: C.mist, paddingLeft: 18 }}>+{rows.length - 25} more…</div>}
                            </div>
                          )}
                        </div>
                      );
                    });

                    return (
                      <>
                        {bucketRows}
                        {/* Non-safety items are excluded from every number above.
                            They are reported here rather than hidden — an exclusion
                            nobody can see is an invitation to reclassify a bad month
                            away. Deliberately visually quiet: present, not alarming. */}
                        <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #E8EFec" }}>
                          <div style={{ fontSize: ".7rem", fontWeight: 600, color: C.mist, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>
                            Excluded from safety metrics
                          </div>
                          {(ns.open ?? 0) === 0 && (ns.new ?? 0) === 0 ? (
                            <div style={{ fontSize: ".78rem", color: C.mist }}>None — every finding on record counts toward safety metrics.</div>
                          ) : (
                            <>
                              <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 8 }}>
                                {[
                                  { label: "Logged this period", value: ns.new ?? 0 },
                                  { label: "Currently open",     value: ns.open ?? 0 },
                                  { label: "Overdue",            value: ns.overdue ?? 0 },
                                  { label: "Avg age (days)",     value: ns.avgAgeDays ?? 0 },
                                ].map((m, i) => (
                                  <div key={i}>
                                    <div style={{ fontSize: "1.05rem", fontWeight: 700, color: C.slate }}>{m.value}</div>
                                    <div style={{ fontSize: ".68rem", color: C.mist }}>{m.label}</div>
                                  </div>
                                ))}
                              </div>
                              <div onClick={() => setOpenBucket(openBucket === "nonsafety" ? null : "nonsafety")}
                                style={{ fontSize: ".76rem", color: C.pine, cursor: "pointer", fontWeight: 600 }}>
                                {openBucket === "nonsafety" ? "Hide" : "Show"} excluded findings ▾
                              </div>
                              {openBucket === "nonsafety" && (
                                <div style={{ marginTop: 8 }}>
                                  {nonSafetyRows.length === 0 ? (
                                    <div style={{ fontSize: ".78rem", color: C.mist, paddingLeft: 18 }}>No excluded findings on record.</div>
                                  ) : nonSafetyRows.slice(0, 25).map(f => (
                                    <div key={f.id} style={{ padding: "8px 10px 8px 18px", marginBottom: 6, background: "#FFF6E8", borderRadius: 7, borderLeft: "3px solid #E0B96A" }}>
                                      <div style={{ fontSize: ".82rem", color: C.ink, lineHeight: 1.35 }}>{f.description}</div>
                                      <div style={{ fontSize: ".7rem", color: C.mist, marginTop: 3 }}>
                                        {f.site_name ?? "—"} · {f.severity} · {f.status}{f.created_at ? ` · ${String(f.created_at).slice(0, 10)}` : ""}
                                      </div>
                                    </div>
                                  ))}
                                  {nonSafetyRows.length > 25 && <div style={{ fontSize: ".72rem", color: C.mist, paddingLeft: 18 }}>+{nonSafetyRows.length - 25} more…</div>}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {tab === "training" && (
                <div className="anim" style={{ background: C.white, borderRadius: 10, boxShadow: "0 2px 12px rgba(15,31,23,.07)", padding: "18px 22px" }}>
                  <h3 style={{ fontSize: ".95rem", fontWeight: 600, color: C.ink, marginBottom: 16 }}>Training Compliance — {period}</h3>
                  {!ftData ? (
                    <div style={{ padding: 20, textAlign: "center", color: C.mist, fontSize: ".85rem" }}>Loading…</div>
                  ) : (
                  [
                    { label: "Overall compliance",        value: ftData.training.compliancePct == null ? "—" : `${ftData.training.compliancePct}%`, color: C.gold },
                    { label: "Staff with overdue training", value: ftData.training.overdue,          color: C.red  },
                    { label: "Completions this period",   value: ftData.training.completionsThisPeriod, color: C.ink },
                    { label: "Expiring within 30 days",   value: ftData.training.expiringSoon,        color: C.gold },
                  ].map((row, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderBottom: i < 3 ? "1px solid #F0F4F2" : "none" }}>
                      <span style={{ fontSize: ".88rem", color: C.slate }}>{row.label}</span>
                      <span style={{ fontWeight: 700, color: row.color, fontSize: ".95rem" }}>{row.value}</span>
                    </div>
                  ))
                  )}
                  {ftData && ftData.training.compliancePct == null && (
                    <div style={{ fontSize: ".76rem", color: C.mist, marginTop: 10, lineHeight: 1.4 }}>No training assignments with completions yet — compliance shows once staff have training records.</div>
                  )}
                </div>
              )}

              {tab === "osha300" && (
                <div className="anim">
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: "1rem", fontWeight: 700, color: C.ink }}>OSHA Form 300 / 300A</div>
                      <div style={{ fontSize: ".78rem", color: C.mist, marginTop: 2 }}>Log of recordable work-related injuries & illnesses</div>
                    </div>
                    <select value={oshaYear} onChange={e => setOshaYear(Number(e.target.value))}
                      style={{ padding: "8px 12px", border: `1.5px solid ${C.mint}`, borderRadius: 8, fontFamily: "'DM Sans', sans-serif", fontSize: ".85rem", fontWeight: 600, color: C.pine, background: C.white }}>
                      {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>

                  {osha300Loading && <div style={{ padding: 30, textAlign: "center", color: C.mist }}>Loading…</div>}

                  {!osha300Loading && osha300 && (
                    <>
                      {/* 300A summary cards */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(88px, 1fr))", gap: 8, marginBottom: 16 }}>
                        {[
                          { n: osha300.summary.totalCases, l: "Total cases" },
                          { n: osha300.summary.deaths, l: "Deaths" },
                          { n: osha300.summary.daysAwayCases, l: "Days away" },
                          { n: osha300.summary.restrictedCases, l: "Restricted" },
                          { n: osha300.summary.otherRecordableCases, l: "Other" },
                        ].map(c => (
                          <div key={c.l} style={{ background: C.white, borderRadius: 9, boxShadow: "0 1px 6px rgba(15,31,23,.06)", padding: "12px 8px", textAlign: "center" }}>
                            <div style={{ fontSize: "1.4rem", fontWeight: 800, color: c.n > 0 ? C.pine : C.mist }}>{c.n}</div>
                            <div style={{ fontSize: ".66rem", color: C.mist, marginTop: 2, textTransform: "uppercase", letterSpacing: ".03em" }}>{c.l}</div>
                          </div>
                        ))}
                      </div>

                      {/* Case list */}
                      {osha300.cases.length === 0 ? (
                        <div style={{ padding: "28px 20px", textAlign: "center", color: C.mist, fontSize: ".85rem", background: C.white, borderRadius: 10 }}>
                          No recordable cases logged for {oshaYear}. (Only cases your Safety Officer has classified as recordable appear here.)
                        </div>
                      ) : (
                        <div style={{ background: C.white, borderRadius: 10, boxShadow: "0 1px 8px rgba(15,31,23,.06)", overflow: "hidden" }}>
                          {osha300.cases.map((c, i) => (
                            <div key={c.caseNo} style={{ padding: "11px 14px", borderTop: i ? "1px solid #F0F4F2" : "none", display: "flex", gap: 12, alignItems: "flex-start" }}>
                              <div style={{ fontSize: ".72rem", fontWeight: 700, color: C.sage, fontFamily: "monospace", flexShrink: 0, width: 96 }}>{c.caseNo}</div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: ".84rem", color: C.ink, lineHeight: 1.4 }}>{c.description}</div>
                                <div style={{ fontSize: ".72rem", color: C.mist, marginTop: 2 }}>{c.date} · {c.site} · {c.employee}</div>
                              </div>
                              <span style={{ fontSize: ".66rem", fontWeight: 700, padding: "2px 7px", borderRadius: 5, background: C.goldLt, color: C.gold, flexShrink: 0, textTransform: "uppercase" }}>
                                {c.classification === "days_away" ? "Days away" : c.classification === "restricted" ? "Restricted" : c.classification === "death" ? "Death" : "Other"}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div style={{ fontSize: ".72rem", color: C.mist, marginTop: 12, lineHeight: 1.5 }}>{osha300.note}</div>

                      <button onClick={exportOsha300CSV} disabled={!osha300.cases.length} style={{
                        marginTop: 14, width: "100%", padding: "11px", background: osha300.cases.length ? C.sage : "#B0C8BA",
                        color: C.white, border: "none", borderRadius: 9, fontFamily: "'DM Sans', sans-serif",
                        fontSize: ".88rem", fontWeight: 700, cursor: osha300.cases.length ? "pointer" : "default",
                      }}>↓ Download OSHA 300 Log (CSV)</button>
                    </>
                  )}
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
