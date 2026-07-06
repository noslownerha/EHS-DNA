import { useState, useEffect } from "react";
import { EHSHeader } from "./AppShell.jsx";
import { BRAND, COLORS } from "./constants.js";
import { api } from "./api.js";

const C = { ...COLORS };

function Badge({ overdue, dueSoon, daysUntil }) {
  if (overdue) return <span style={{ fontSize: ".68rem", fontWeight: 700, background: C.redLt, color: C.red, padding: "3px 10px", borderRadius: 20 }}>Overdue {Math.abs(daysUntil)}d</span>;
  if (dueSoon) return <span style={{ fontSize: ".68rem", fontWeight: 700, background: C.goldLt, color: C.gold, padding: "3px 10px", borderRadius: 20 }}>Due in {daysUntil}d</span>;
  return <span style={{ fontSize: ".68rem", fontWeight: 700, background: C.foam, color: C.pine, padding: "3px 10px", borderRadius: 20 }}>Due in {daysUntil}d</span>;
}

const pageWrap = { minHeight: "100vh", background: C.chalk, fontFamily: "'DM Sans', sans-serif", paddingBottom: 80 };
const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  .pick-row:active { transform: scale(.98); }
`;

// ── s3a0: pick a checklist to run ─────────────────────────────────────────────
export function S3a0ChecklistPicker({ onHome, onBack, onPick, user, kind = "checklist" }) {
  const [lists, setLists] = useState(null);
  const [sched, setSched] = useState([]);

  useEffect(() => {
    Promise.all([api.listChecklists(), api.checklistSchedule().catch(() => [])])
      .then(([cls, sc]) => {
        const siteRec = (BRAND.siteRecords ?? []).find(s => s.name === user?.site);
        setLists(cls.filter(c => c.active && c.kind === kind && (!c.site_id || c.site_id === siteRec?.id)));
        setSched(sc);
      })
      .catch(err => console.error("Checklist load failed:", err.message));
  }, [kind, user?.site]);

  const siteRec = (BRAND.siteRecords ?? []).find(s => s.name === user?.site);

  return (
    <div style={pageWrap}>
      <style>{css}</style>
      <EHSHeader onHome={onHome} rightContent={
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.mint, fontSize: ".83rem", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>← Back</button>
      } />
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "24px 18px" }}>
        <h1 style={{ fontSize: "1.3rem", fontWeight: 700, color: C.ink }}>
          {kind === "gemba" ? "Start a Gemba walk" : "Run a checklist"}
        </h1>
        <p style={{ fontSize: ".84rem", color: C.mist, margin: "4px 0 18px" }}>
          {user?.site ? `Showing checklists for ${user.site}` : "Choose a checklist"}
        </p>
        {lists === null && <p style={{ color: C.mist, fontSize: ".85rem" }}>Loading…</p>}
        {lists?.length === 0 && <p style={{ color: C.mist, fontSize: ".85rem" }}>No {kind === "gemba" ? "gemba templates" : "checklists"} configured yet.</p>}
        {lists?.map(cl => {
          const row = sched.find(s => s.checklistId === cl.id && s.siteId === siteRec?.id);
          const items = JSON.parse(cl.items || "[]");
          return (
            <button key={cl.id} className="pick-row" onClick={() => onPick(cl)} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              width: "100%", textAlign: "left", background: C.white, border: "none",
              borderRadius: 12, boxShadow: "0 2px 12px rgba(15,31,23,.07)",
              padding: "16px 18px", marginBottom: 12, cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif", transition: "transform .12s",
            }}>
              <div>
                <div style={{ fontSize: ".95rem", fontWeight: 700, color: C.ink }}>{cl.name}</div>
                <div style={{ fontSize: ".76rem", color: C.mist, marginTop: 3 }}>
                  {items.length} items{cl.frequency_days ? ` · every ${cl.frequency_days} days` : " · on demand"}
                </div>
              </div>
              {row ? <Badge {...row} /> : <span style={{ color: C.sage, fontWeight: 700 }}>→</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── s3a5: scheduled inspections across the schedule rollup ────────────────────
export function S3a5Schedule({ onHome, onBack, onRun, user }) {
  const [rows, setRows] = useState(null);
  const [lists, setLists] = useState([]);
  const [mySiteOnly, setMySiteOnly] = useState(true);

  useEffect(() => {
    Promise.all([api.checklistSchedule(), api.listChecklists()])
      .then(([sc, cls]) => { setRows(sc); setLists(cls); })
      .catch(err => console.error("Schedule load failed:", err.message));
  }, []);

  const visible = (rows ?? []).filter(r => !mySiteOnly || !user?.site || r.site === user.site);

  return (
    <div style={pageWrap}>
      <style>{css}</style>
      <EHSHeader onHome={onHome} rightContent={
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.mint, fontSize: ".83rem", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>← Back</button>
      } />
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "24px 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <h1 style={{ fontSize: "1.3rem", fontWeight: 700, color: C.ink }}>Scheduled inspections</h1>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: ".78rem", color: C.slate }}>
            <input type="checkbox" checked={mySiteOnly} onChange={e => setMySiteOnly(e.target.checked)} style={{ accentColor: C.sage }} />
            My site only
          </label>
        </div>
        <p style={{ fontSize: ".84rem", color: C.mist, margin: "4px 0 18px" }}>Sorted by next due — overdue first.</p>
        {rows === null && <p style={{ color: C.mist, fontSize: ".85rem" }}>Loading…</p>}
        {rows !== null && visible.length === 0 && <p style={{ color: C.mist, fontSize: ".85rem" }}>Nothing scheduled.</p>}
        {visible.map((r, i) => {
          const cl = lists.find(l => l.id === r.checklistId);
          return (
            <button key={i} className="pick-row" onClick={() => cl && onRun(cl, r)} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              width: "100%", textAlign: "left", background: C.white,
              border: "none", borderLeft: `4px solid ${r.overdue ? C.red : r.dueSoon ? C.gold : C.sage}`,
              borderRadius: 12, boxShadow: "0 2px 12px rgba(15,31,23,.07)",
              padding: "14px 16px", marginBottom: 10, cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif", transition: "transform .12s",
            }}>
              <div>
                <div style={{ fontSize: ".92rem", fontWeight: 700, color: C.ink }}>{r.checklist}</div>
                <div style={{ fontSize: ".75rem", color: C.mist, marginTop: 3 }}>
                  {r.site} · every {r.frequencyDays}d · last: {r.lastRun ? r.lastRun.slice(0, 10) : "never"}
                </div>
              </div>
              <Badge {...r} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
