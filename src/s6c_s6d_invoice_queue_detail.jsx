import { COLORS } from "./constants.js";
import { useState } from "react";

// Ops backend colour palette
const C = { ...COLORS, gold: "#F4A261", goldLt: "#FEF3E2", red: "#E74C3C", redLt: "#FEF0EF" };

// Spec §16.3: YYMM-XXXX format
// Spec §16.2: no invoice auto-sends without owner approval
const INVOICES = [
  { id: "2606-4721", company: "WhistlePig Whiskey",    period: "Jun 2024", amount: 1840, status: "pending",  generated: "Jun 30, 2024", lineItems: [
    { desc: "Base platform access",      amount: 800 },
    { desc: "Sites (4 × $180)",          amount: 720 },
    { desc: "Users (42 × 0 — included)", amount: 0   },
    { desc: "Training module",           amount: 150 },
    { desc: "Triage module",             amount: 75  },
    { desc: "SMS Alerts",                amount: 50  },
    { desc: "One-time setup fee",        amount: 0   },
  ]},
  { id: "2606-2234", company: "Northeast Logistics Co.",period: "Jun 2024", amount: 870,  status: "pending",  generated: "Jun 30, 2024", lineItems: [
    { desc: "Base platform access",      amount: 600 },
    { desc: "Sites (3 × $90)",           amount: 270 },
  ]},
  { id: "2606-5891", company: "Champlain Valley Cider", period: "Jun 2024", amount: 620,  status: "pending",  generated: "Jun 30, 2024", lineItems: [
    { desc: "Base platform access",      amount: 500 },
    { desc: "Sites (2 × $90)",           amount: 180 },
    { desc: "Advanced reporting",        amount: 100 },
    { desc: "Discount (annual prepay)",  amount: -160},
  ]},
  { id: "2605-3847", company: "WhistlePig Whiskey",    period: "May 2024", amount: 1840, status: "approved", generated: "May 31, 2024", lineItems: [] },
  { id: "2605-2109", company: "Green Mountain Brewing", period: "May 2024", amount: 390,  status: "sent",     generated: "May 31, 2024", lineItems: [] },
  { id: "2604-3847", company: "WhistlePig Whiskey",    period: "Apr 2024", amount: 1840, status: "paid",     generated: "Apr 30, 2024", lineItems: [] },
];

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

function InvStatusPill({ status }) {
  const map = {
    pending:  { label: "Pending approval", bg: C.goldLt,  color: C.gold  },
    approved: { label: "Approved",         bg: C.tealLt,  color: C.teal  },
    sent:     { label: "Sent to customer", bg: C.greenLt, color: C.green },
    paid:     { label: "Paid",             bg: "#EEF1F0", color: C.slate },
  };
  const s = map[status] ?? map.pending;
  return <span style={{ padding: "2px 9px", borderRadius: 20, fontSize: ".68rem", fontWeight: 600, whiteSpace: "nowrap", background: s.bg, color: s.color }}>{s.label}</span>;
}

// ════════════════════════════════════════════════════════════════════════════
// S6c — Invoice Queue
// Spec: no invoice auto-sends; YYMM-XXXX numbering; owner email on generation
// ════════════════════════════════════════════════════════════════════════════
export function S6cInvoiceQueue({ onViewInvoice, onBack }) {
  const [filterStatus, setFilterStatus] = useState("pending");

  const pending  = INVOICES.filter(i => i.status === "pending");
  const filtered = INVOICES.filter(i => filterStatus ? i.status === filterStatus : true);

  const thStyle = {
    padding: "9px 14px", textAlign: "left",
    fontSize: ".68rem", fontWeight: 600, letterSpacing: ".07em",
    textTransform: "uppercase", color: "rgba(255,255,255,.3)",
    borderBottom: "1px solid rgba(255,255,255,.07)",
    background: "rgba(255,255,255,.02)", whiteSpace: "nowrap",
  };

  return (
    <div style={{ minHeight: "100vh", background: C.mid, fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .anim { animation: fadeUp .25s ease both; }
        select option { color: #0F1F17; background: #fff; }
        .inv-row:hover td { background: rgba(255,255,255,.04) !important; cursor: pointer; }
      `}</style>

      <OpsNav title="Invoice Queue" />

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 22px" }}>

        {/* Spec: locked no-auto-send rule reminder */}
        <div className="anim" style={{ padding: "11px 16px", background: "rgba(244,162,97,.08)", border: "1px solid rgba(244,162,97,.2)", borderRadius: 8, marginBottom: 20, fontSize: ".82rem", color: C.gold, display: "flex", alignItems: "center", gap: 8 }}>
          <span>🔒</span>
          <span><strong>No invoice auto-sends.</strong> All invoices require explicit owner approval before sending. Review each before approving.</span>
        </div>

        <div className="anim" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: "1.2rem", fontWeight: 700, color: C.white }}>Invoice Queue</h1>
            <p style={{ fontSize: ".78rem", color: "rgba(255,255,255,.35)", marginTop: 3 }}>
              {pending.length} pending approval · {INVOICES.length} total
            </p>
          </div>
          {/* Filter tabs */}
          <div style={{ display: "flex", gap: 6 }}>
            {[
              { id: "pending",  label: `Pending (${pending.length})` },
              { id: "approved", label: "Approved"  },
              { id: "sent",     label: "Sent"       },
              { id: "paid",     label: "Paid"       },
              { id: "",         label: "All"        },
            ].map(f => (
              <button key={f.id} onClick={() => setFilterStatus(f.id)} style={{
                padding: "6px 12px",
                background: filterStatus === f.id ? "rgba(0,180,216,.15)" : "rgba(255,255,255,.05)",
                border: `1px solid ${filterStatus === f.id ? C.teal : "rgba(255,255,255,.08)"}`,
                borderRadius: 6, fontFamily: "'DM Sans', sans-serif",
                fontSize: ".75rem", fontWeight: filterStatus === f.id ? 600 : 400,
                color: filterStatus === f.id ? C.teal : "rgba(255,255,255,.45)",
                cursor: "pointer", transition: "all .15s",
              }}>{f.label}</button>
            ))}
          </div>
        </div>

        <div className="anim" style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 10, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Invoice #", "Company", "Period", "Amount", "Generated", "Status", ""].map((h, i) => (
                  <th key={i} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv, i) => (
                <tr key={inv.id} className="inv-row" onClick={() => onViewInvoice?.(inv.id)}>
                  <td style={{ padding: "11px 14px", borderBottom: "1px solid rgba(255,255,255,.05)", fontFamily: "'DM Mono', monospace", fontSize: ".82rem", color: C.teal, fontWeight: 600 }}>{inv.id}</td>
                  <td style={{ padding: "11px 14px", borderBottom: "1px solid rgba(255,255,255,.05)", fontWeight: 600, fontSize: ".85rem", color: C.white }}>{inv.company}</td>
                  <td style={{ padding: "11px 14px", borderBottom: "1px solid rgba(255,255,255,.05)", fontSize: ".82rem", color: "rgba(255,255,255,.5)" }}>{inv.period}</td>
                  <td style={{ padding: "11px 14px", borderBottom: "1px solid rgba(255,255,255,.05)", fontWeight: 700, color: C.white, fontFamily: "'DM Mono', monospace" }}>${inv.amount.toLocaleString()}</td>
                  <td style={{ padding: "11px 14px", borderBottom: "1px solid rgba(255,255,255,.05)", fontSize: ".8rem", color: "rgba(255,255,255,.35)" }}>{inv.generated}</td>
                  <td style={{ padding: "11px 14px", borderBottom: "1px solid rgba(255,255,255,.05)" }}><InvStatusPill status={inv.status} /></td>
                  <td style={{ padding: "11px 14px", borderBottom: "1px solid rgba(255,255,255,.05)", color: "rgba(255,255,255,.2)", fontSize: ".8rem" }}>→</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


// ════════════════════════════════════════════════════════════════════════════
// S6d — Invoice Detail
// Spec: approval action required; no auto-send; YYMM-XXXX format
// ════════════════════════════════════════════════════════════════════════════
export function S6dInvoiceDetail({ invoiceId, onBack, onApprove }) {
  const inv = INVOICES.find(i => i.id === (invoiceId ?? "2606-4721")) ?? INVOICES[0];
  const [status,   setStatus]   = useState(inv.status);
  const [approving,setApproving]= useState(false);
  const [sent,     setSent]     = useState(false);

  function handleApprove() {
    setApproving(true);
    setTimeout(() => { setApproving(false); setStatus("approved"); onApprove?.(inv.id); }, 800);
  }

  function handleSend() {
    setSent(true);
    setStatus("sent");
  }

  const subtotal = inv.lineItems.reduce((n, l) => n + l.amount, 0);

  return (
    <div style={{ minHeight: "100vh", background: C.mid, fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        .anim { animation: fadeUp .22s ease both; }
        .approve-btn:hover:not(:disabled) { background: ${C.teal}cc !important; transform: translateY(-1px); }
        .send-btn:hover:not(:disabled) { background: ${C.green}cc !important; }
      `}</style>

      <OpsNav title={`Invoice · ${inv.id}`} />

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "24px 22px" }}>

        {/* Breadcrumb */}
        <div className="anim" style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <button onClick={onBack} style={{ background: "none", border: "none", color: "rgba(255,255,255,.3)", fontSize: ".8rem", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>← Invoices</button>
            <span style={{ color: "rgba(255,255,255,.15)" }}>/</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: ".8rem", color: C.teal }}>{inv.id}</span>
          </div>

          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div>
              <h1 style={{ fontSize: "1.2rem", fontWeight: 700, color: C.white, marginBottom: 6 }}>{inv.company}</h1>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <InvStatusPill status={status} />
                <span style={{ fontSize: ".78rem", color: "rgba(255,255,255,.35)" }}>{inv.period} · Generated {inv.generated}</span>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "2rem", fontWeight: 800, color: C.teal, fontFamily: "'DM Mono', monospace" }}>${inv.amount.toLocaleString()}</div>
              <div style={{ fontSize: ".72rem", color: "rgba(255,255,255,.3)" }}>Total due</div>
            </div>
          </div>
        </div>

        {/* Line items */}
        {inv.lineItems.length > 0 && (
          <div className="anim" style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
              <h2 style={{ fontSize: ".88rem", fontWeight: 600, color: C.white }}>Line items</h2>
            </div>
            {inv.lineItems.map((line, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 18px", borderBottom: i < inv.lineItems.length - 1 ? "1px solid rgba(255,255,255,.04)" : "none" }}>
                <span style={{ fontSize: ".85rem", color: line.amount < 0 ? C.gold : "rgba(255,255,255,.65)" }}>{line.desc}</span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: ".85rem", fontWeight: 600, color: line.amount < 0 ? C.gold : C.white }}>
                  {line.amount < 0 ? `-$${Math.abs(line.amount)}` : line.amount > 0 ? `$${line.amount}` : "—"}
                </span>
              </div>
            ))}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", background: "rgba(255,255,255,.04)", borderTop: "1px solid rgba(255,255,255,.1)" }}>
              <span style={{ fontSize: ".9rem", fontWeight: 700, color: C.white }}>Total</span>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: ".9rem", fontWeight: 800, color: C.teal }}>${inv.amount.toLocaleString()}</span>
            </div>
          </div>
        )}

        {/* Approval actions — spec: always requires explicit approval before sending */}
        <div className="anim" style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 10, padding: "18px 20px" }}>
          <h2 style={{ fontSize: ".88rem", fontWeight: 600, color: C.white, marginBottom: 14 }}>Approval</h2>

          {status === "pending" && (
            <>
              <div style={{ padding: "10px 14px", background: "rgba(244,162,97,.08)", border: "1px solid rgba(244,162,97,.15)", borderRadius: 8, fontSize: ".82rem", color: C.gold, marginBottom: 14 }}>
                🔒 This invoice will not send until you explicitly approve it. Review the line items above before approving.
              </div>
              <button className="approve-btn" onClick={handleApprove} disabled={approving} style={{
                padding: "11px 24px", background: approving ? C.teal + "70" : C.teal,
                color: C.white, border: "none", borderRadius: 8,
                fontFamily: "'DM Sans', sans-serif", fontSize: ".9rem", fontWeight: 700,
                cursor: approving ? "default" : "pointer", transition: "all .18s",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                {approving ? (
                  <><span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,.4)", borderTopColor: C.white, borderRadius: "50%", display: "inline-block", animation: "spin .7s linear infinite" }} />Approving…</>
                ) : "Approve invoice"}
              </button>
            </>
          )}

          {status === "approved" && !sent && (
            <>
              <div style={{ padding: "10px 14px", background: C.tealLt + "18", border: `1px solid ${C.teal}33`, borderRadius: 8, fontSize: ".82rem", color: C.teal, marginBottom: 14 }}>
                ✓ Approved. Ready to send to {inv.company}'s billing contact.
              </div>
              <button className="send-btn" onClick={handleSend} style={{
                padding: "11px 24px", background: C.green, color: C.white,
                border: "none", borderRadius: 8, fontFamily: "'DM Sans', sans-serif",
                fontSize: ".9rem", fontWeight: 700, cursor: "pointer", transition: "all .18s",
              }}>Send to customer →</button>
            </>
          )}

          {(status === "sent" || sent) && (
            <div style={{ padding: "10px 14px", background: C.greenLt + "18", border: `1px solid ${C.green}33`, borderRadius: 8, fontSize: ".82rem", color: C.green }}>
              ✓ Sent to customer. Invoice {inv.id} delivered to billing contact.
            </div>
          )}

          {status === "paid" && (
            <div style={{ padding: "10px 14px", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 8, fontSize: ".82rem", color: "rgba(255,255,255,.4)" }}>
              ✓ Paid — no further action required.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
