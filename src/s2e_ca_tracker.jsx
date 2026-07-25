import { useState, useMemo, useEffect } from "react";
import { EHSHeader } from "./AppShell.jsx";
import { BRAND, COLORS } from "./constants.js";
import { api } from "./api.js";
import CADetailPanel from "./CADetailPanel.jsx";
import NewTaskModal from "./NewTaskModal.jsx";

const C = { ...COLORS };

const PRIORITY_MAP = {
  high:   { bg: C.redLt,  color: C.red,   label: "High"   },
  medium: { bg: C.goldLt, color: C.gold,  label: "Medium" },
  low:    { bg: "#EEF1F0",color: C.slate, label: "Low"    },
};

function pill(label, bg, color) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 9px", borderRadius: 20, fontSize: ".68rem", fontWeight: 600, whiteSpace: "nowrap", background: bg, color }}>
      {label}
    </span>
  );
}

function DesktopNav({ companyName = BRAND.company, onHome, onBack }) {
  return (
    <EHSHeader onHome={onHome} onBack={onBack} title={companyName} rightContent={
      <div style={{ fontSize: ".72rem", color: C.mist, background: "rgba(255,255,255,.08)", padding: "3px 12px", borderRadius: 20, whiteSpace: "nowrap" }}>
        Corrective Actions
      </div>
    } />
  );
}

// ── CA row ────────────────────────────────────────────────────────────────────
// Mobile card for a corrective action. The 7-column table (minWidth 620) forced
// horizontal scrolling on a phone — the Verify button and due date sat off-screen,
// which is fatal for the one screen people are supposed to ACT on.
function CACard({ ca, onVerify, onViewIncident, onManage }) {
  const [verifying, setVerifying] = useState(false);
  const pri = PRIORITY_MAP[ca.priority] ?? PRIORITY_MAP.low;

  function handleVerify() {
    setVerifying(true);
    setTimeout(() => { setVerifying(false); onVerify?.(ca.id); }, 700);
  }

  return (
    <div style={{
      background: ca.status === "overdue" ? C.redLt + "60" : C.white,
      borderRadius: 10, padding: "12px 14px", marginBottom: 8,
      boxShadow: "0 2px 12px rgba(15,31,23,.07)",
      borderLeft: `3px solid ${ca.status === "overdue" ? C.red : pri.color}`,
    }}>
      <div style={{ fontSize: ".9rem", color: C.ink, lineHeight: 1.4, fontWeight: 600, marginBottom: 8 }}>
        {ca.desc}
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        <span style={{ fontSize: ".72rem", fontWeight: 700, color: pri.color, background: pri.bg, padding: "3px 9px", borderRadius: 20 }}>
          {pri.label}
        </span>
        <span style={{
          fontSize: ".72rem", fontWeight: 600, padding: "3px 9px", borderRadius: 20,
          color: ca.status === "overdue" ? C.red : C.slate,
          background: ca.status === "overdue" ? "#FBECEC" : "#EEF1F0",
        }}>
          Due {ca.due}
        </span>
      </div>

      <div style={{ fontSize: ".78rem", color: C.slate, marginBottom: 10 }}>
        {ca.assignee} · {ca.site}
        {ca.incidentId && (
          <> · <span onClick={() => onViewIncident?.(ca.incidentId)} style={{ color: C.sage, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Mono', monospace" }}>
            {ca.incidentId}
          </span></>
        )}
        {ca.escalated && (
          <span style={{ color: C.red, fontWeight: 700 }}> · ⬆ Escalated</span>
        )}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => onManage?.(ca.id)} style={{
          flex: 1, padding: "10px", borderRadius: 8, border: `1px solid ${C.sage}`,
          background: "#fff", color: C.pine, fontFamily: "'DM Sans', sans-serif",
          fontSize: ".85rem", fontWeight: 700, cursor: "pointer",
        }}>Manage</button>
        {ca.status !== "closed" && (
          <button onClick={handleVerify} disabled={verifying} style={{
            flex: 1, padding: "10px", borderRadius: 8, border: "none",
            background: verifying ? C.mint : C.sage, color: verifying ? C.forest : C.white,
            fontFamily: "'DM Sans', sans-serif", fontSize: ".85rem", fontWeight: 700,
            cursor: verifying ? "default" : "pointer",
          }}>{verifying ? "Verifying…" : "✓ Verify"}</button>
        )}
      </div>
    </div>
  );
}

function CARow({ ca, onVerify, onViewIncident, onManage }) {
  const [verifying, setVerifying] = useState(false);
  const pri = PRIORITY_MAP[ca.priority] ?? PRIORITY_MAP.low;

  function handleVerify() {
    setVerifying(true);
    setTimeout(() => { setVerifying(false); onVerify?.(ca.id); }, 700);
  }

  return (
    <tr style={{ background: ca.status === "overdue" ? C.redLt + "60" : C.white }}>
      <td style={{ padding: "11px 14px", borderBottom: "1px solid #F0F4F2", verticalAlign: "middle" }}>
        <div style={{ fontSize: ".88rem", color: C.ink, lineHeight: 1.4 }}>{ca.desc}</div>
        {ca.escalated && (
          <span style={{ fontSize: ".68rem", color: C.red, fontWeight: 600 }}>⬆ Escalated</span>
        )}
      </td>
      <td style={{ padding: "11px 14px", borderBottom: "1px solid #F0F4F2", verticalAlign: "middle" }}>
        <button
          onClick={() => onViewIncident?.(ca.incidentId)}
          style={{
            fontFamily: "'DM Mono', monospace", fontSize: ".75rem", color: C.sage,
            background: "none", border: "none", cursor: "pointer", fontWeight: 600,
          }}
        >{ca.incidentId}</button>
      </td>
      <td style={{ padding: "11px 14px", borderBottom: "1px solid #F0F4F2", fontSize: ".83rem", color: C.slate, verticalAlign: "middle", whiteSpace: "nowrap" }}>
        {ca.assignee}
      </td>
      <td style={{ padding: "11px 14px", borderBottom: "1px solid #F0F4F2", verticalAlign: "middle" }}>
        {pill(pri.label, pri.bg, pri.color)}
      </td>
      <td style={{ padding: "11px 14px", borderBottom: "1px solid #F0F4F2", fontSize: ".83rem", color: ca.status === "overdue" ? C.red : C.slate, fontWeight: ca.status === "overdue" ? 600 : 400, verticalAlign: "middle", whiteSpace: "nowrap" }}>
        {ca.due}
        {ca.status === "overdue" && <div style={{ fontSize: ".7rem", color: C.red }}>Overdue</div>}
      </td>
      <td style={{ padding: "11px 14px", borderBottom: "1px solid #F0F4F2", fontSize: ".78rem", color: C.slate, verticalAlign: "middle" }}>
        {ca.site}
      </td>
      <td style={{ padding: "11px 14px", borderBottom: "1px solid #F0F4F2", verticalAlign: "middle" }}>
        <button onClick={() => onManage?.(ca.id)} style={{
          padding: "5px 12px", background: C.white, color: C.pine, marginRight: 6,
          border: `1.5px solid ${C.line ?? "#E2EBE6"}`, borderRadius: 6,
          fontFamily: "'DM Sans', sans-serif", fontSize: ".75rem", fontWeight: 600,
          cursor: "pointer", whiteSpace: "nowrap",
        }}>Manage</button>
        {ca.status === "closed" ? (
          <span style={{ fontSize: ".78rem", color: C.sage, display: "inline-flex", alignItems: "center", gap: 4 }}>✓ Verified</span>
        ) : (
          <button
            onClick={handleVerify}
            disabled={verifying}
            style={{
              padding: "5px 12px", background: verifying ? C.sage + "80" : C.white,
              color: verifying ? C.white : C.pine,
              border: `1.5px solid ${C.mint}`, borderRadius: 6,
              fontFamily: "'DM Sans', sans-serif", fontSize: ".75rem", fontWeight: 600,
              cursor: verifying ? "default" : "pointer", whiteSpace: "nowrap",
              transition: "all .15s",
            }}
          >{verifying ? "Saving…" : "Verify ✓"}</button>
        )}
      </td>
    </tr>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function S2eCATracker({ companyName, onViewIncident, onHome, onBack }) {
  const [cas,          setCas]         = useState([]);
  const [openCaId,     setOpenCaId]    = useState(null);
  const [showNewTask,  setShowNewTask] = useState(false);
  const [users,        setUsers]       = useState([]);
  const [activeTab,    setActiveTab]   = useState("overdue"); // "overdue" | "on-track" | "closed"
  const [filterSite,   setFilterSite]  = useState("");
  const [filterAssignee, setFilterAssignee] = useState("");

  useEffect(() => { api.listUsers().then(setUsers).catch(() => {}); }, []);

  function reload() {
    Promise.all([api.listCAs(), api.listIncidents()]).then(([rawCAs, incs]) => {
      const bySite = Object.fromEntries((BRAND.siteRecords ?? []).map(s => [s.id, s.name]));
      const incById = Object.fromEntries(incs.map(i => [i.id, i]));
      setCas(rawCAs.map(c => {
        const inc = incById[c.incident_id];
        const overdue = c.due_date && new Date(c.due_date) < new Date()
          && !["done", "verified", "capex_blocked"].includes(c.status);
        // Assignee label: an individual, or the group, or Unassigned.
        const assignee = c.assignee_name
          ?? (c.assignee_group_name ? `${c.assignee_group_name} (team)` : "Unassigned");
        // Site: from the linked incident, else the group's site scope, else none.
        const site = bySite[inc?.site_id] ?? bySite[c.assignee_site_id] ?? "—";
        return {
          id: c.id, incidentId: inc?.ref ?? null, desc: c.title,
          assignee, due: c.due_date,
          status: ["done", "verified"].includes(c.status) ? "closed"
            : c.status === "capex_blocked" ? "blocked"
            : overdue ? "overdue" : "on-track",
          priority: c.priority, site,
          escalated: overdue && c.priority === "high",
        };
      }));
    }).catch(err => console.error("Failed to load corrective actions:", err.message));
  }
  useEffect(() => { reload(); }, []);

  const sites     = [...new Set(cas.map(c => c.site))];
  const assignees = [...new Set(cas.map(c => c.assignee))];

  function handleVerify(id) {
    setCas(cs => cs.map(c => c.id === id ? { ...c, status: "closed" } : c));
    api.updateCA(id, { status: "done", verified: true }).catch(err => console.error("Verify failed:", err.message));
  }

  // Spec §12.9: split overdue / on-track / closed
  const tabs = [
    { id: "overdue",  label: "Overdue",  color: C.red  },
    { id: "on-track", label: "On track", color: C.pine },
    { id: "blocked",  label: "Blocked",  color: "#8A5A00" },
    { id: "closed",   label: "Closed",   color: C.slate},
  ];

  const filtered = useMemo(() =>
    cas.filter(c => {
      if (c.status !== activeTab)              return false;
      if (filterSite     && c.site !== filterSite)     return false;
      if (filterAssignee && c.assignee !== filterAssignee) return false;
      return true;
    }),
    [cas, activeTab, filterSite, filterAssignee]
  );

  const counts = {
    overdue:   cas.filter(c => c.status === "overdue").length,
    "on-track":cas.filter(c => c.status === "on-track").length,
    blocked:   cas.filter(c => c.status === "blocked").length,
    closed:    cas.filter(c => c.status === "closed").length,
  };

  const escalatedCount = cas.filter(c => c.escalated && c.status !== "closed").length;

  const thStyle = {
    padding: "9px 14px", textAlign: "left",
    fontSize: ".7rem", fontWeight: 600, letterSpacing: ".06em",
    textTransform: "uppercase", color: C.mist,
    borderBottom: "1px solid #E2EBE6", background: C.chalk,
    whiteSpace: "nowrap",
  };

  return (
    <div style={{ minHeight: "100vh", background: C.chalk, fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .anim { animation: fadeUp .28s ease both; }
        select option { color: ${C.ink}; }
        .ca-row:hover td { background: ${C.foam} !important; }

        /* Cards on phones, table on desktop. The 7-column table hid the Verify
           button off-screen on mobile — unusable for the screen people act on. */
        .ca-cards { display: block; }
        .ca-table { display: none; }
        @media (min-width: 760px) {
          .ca-cards { display: none; }
          .ca-table { display: block; }
        }
      `}</style>

      <DesktopNav companyName={companyName} onHome={onHome} onBack={onBack} />

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px" }}>

        {/* Header */}
        <div className="anim" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: C.ink }}>Corrective Action Tracker</h1>
            <p style={{ fontSize: ".85rem", color: C.mist, marginTop: 3 }}>
              All sites · {cas.length} total CAs
              {escalatedCount > 0 && (
                <span style={{ color: C.red, fontWeight: 600, marginLeft: 10 }}>⬆ {escalatedCount} escalated</span>
              )}
            </p>
          </div>
          <button onClick={() => setShowNewTask(true)} style={{
            padding: "9px 16px", borderRadius: 8, border: "none", background: C.sage, color: "#fff",
            fontFamily: "'DM Sans', sans-serif", fontSize: ".85rem", fontWeight: 700, cursor: "pointer",
            whiteSpace: "nowrap", flexShrink: 0,
          }}>+ New task</button>
        </div>

        {/* Tab bar — spec: split overdue / on-track / closed */}
        <div className="anim" style={{
          display: "flex", gap: 0,
          background: C.white, borderRadius: 10,
          boxShadow: "0 2px 12px rgba(15,31,23,.07)",
          overflow: "hidden", marginBottom: 16,
        }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1, padding: "14px 16px",
                background: activeTab === tab.id ? tab.color + "14" : C.white,
                color: activeTab === tab.id ? tab.color : C.slate,
                border: "none",
                borderBottom: activeTab === tab.id ? `3px solid ${tab.color}` : "3px solid transparent",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: ".88rem", fontWeight: 600, cursor: "pointer",
                transition: "all .15s",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              {tab.label}
              <span style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                minWidth: 22, height: 22, borderRadius: 11,
                background: activeTab === tab.id ? tab.color : "#E2EBE6",
                color: activeTab === tab.id ? C.white : C.slate,
                fontSize: ".72rem", fontWeight: 700,
                transition: "all .15s",
              }}>
                {counts[tab.id]}
              </span>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="anim" style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          {[
            { label: "All sites",     value: filterSite,     set: setFilterSite,     options: sites },
            { label: "All assignees", value: filterAssignee, set: setFilterAssignee, options: assignees },
          ].map((f, i) => (
            <select key={i} value={f.value} onChange={e => f.set(e.target.value)} style={{
              padding: "8px 28px 8px 10px", border: "1.5px solid #D0DEDB", borderRadius: 7,
              fontFamily: "'DM Sans', sans-serif", fontSize: ".83rem",
              color: f.value ? C.ink : C.mist, background: C.white, outline: "none",
              cursor: "pointer", appearance: "none",
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%238FA3A0'/%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center",
            }}>
              <option value="">{f.label}</option>
              {f.options.map(o => <option key={o}>{o}</option>)}
            </select>
          ))}
          {(filterSite || filterAssignee) && (
            <button onClick={() => { setFilterSite(""); setFilterAssignee(""); }}
              style={{ background: "none", border: "none", color: C.mist, fontSize: ".8rem", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
              Clear
            </button>
          )}
        </div>

        {/* Mobile: card list (the table needed horizontal scrolling on a phone) */}
        <div className="ca-cards anim">
          {filtered.length === 0 ? (
            <div style={{ background: C.white, borderRadius: 10, padding: "32px", textAlign: "center", color: C.mist, fontSize: ".85rem", boxShadow: "0 2px 12px rgba(15,31,23,.07)" }}>
              No {activeTab} corrective actions{filterSite || filterAssignee ? " matching filters" : ""}.
            </div>
          ) : filtered.map(ca => (
            <CACard key={ca.id} ca={ca} onVerify={handleVerify} onViewIncident={onViewIncident} onManage={() => setOpenCaId(ca.id)} />
          ))}
        </div>

        {/* Desktop: CA table */}
        <div className="ca-table anim" style={{ background: C.white, borderRadius: 10, boxShadow: "0 2px 12px rgba(15,31,23,.07)", overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
<table style={{ width: "100%", minWidth: 620, borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Action", "Incident", "Assignee", "Priority", "Due date", "Site", ""].map((h, i) => (
                  <th key={i} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: "32px", textAlign: "center", color: C.mist, fontSize: ".85rem" }}>
                  No {activeTab} corrective actions{filterSite || filterAssignee ? " matching filters" : ""}.
                </td></tr>
              ) : filtered.map(ca => (
                <CARow
                  key={ca.id}
                  ca={ca}
                  onVerify={handleVerify}
                  onViewIncident={onViewIncident}
                  onManage={() => setOpenCaId(ca.id)}
                />
              ))}
            </tbody>
          </table>
</div>

          {/* Escalation note */}
          {activeTab === "overdue" && escalatedCount > 0 && (
            <div style={{
              padding: "12px 16px",
              background: C.redLt,
              borderTop: "1px solid #F5C6C2",
              fontSize: ".78rem", color: C.red,
            }}>
              ⬆ {escalatedCount} overdue CA{escalatedCount > 1 ? "s" : ""} have been escalated to Site Manager. Escalation is automatic after 5 days overdue.
            </div>
          )}
        </div>

        
      </div>
      {openCaId && (
        <CADetailPanel
          caId={openCaId}
          users={users}
          onClose={() => setOpenCaId(null)}
          onChanged={reload}
        />
      )}
      {showNewTask && (
        <NewTaskModal
          users={users}
          onClose={() => setShowNewTask(false)}
          onCreated={reload}
        />
      )}
    </div>
  );
}
