import { useState } from "react";

const C = {
  forest: "#1C3A2A", pine: "#2D5A3D", sage: "#4A8C5C",
  mint: "#A8D5B5", foam: "#E8F5EC", ink: "#0F1F17",
  slate: "#4A5568", mist: "#8FA3A0", chalk: "#F4F7F5",
  white: "#FFFFFF", gold: "#C8922A", goldLt: "#FDF3E3",
  red: "#C0392B", redLt: "#FDECEA",
  alarm: "#B91C1C", alarmLt: "#FEF2F2",
};

// ── Decision tree definition ──────────────────────────────────────────────────
// Each node: { id, question, yes, no }
// Leaf node: { id, outcome } where outcome ∈ "911"|"triage"|"firstaid"|"secure"
//
// Spec rule: uncertainty routes TOWARD triage, not away.
// Spec rule: "Are you unsure whether basic first aid is enough?" not "Do they need more?"

const TREE = {
  id: "q1",
  question: "Is anyone injured?",
  sublabel: null,
  yes: {
    id: "q2",
    question: "Are they conscious and breathing normally?",
    sublabel: null,
    yes: {
      id: "q3",
      question: "Can they walk and talk normally?",
      sublabel: null,
      yes: {
        id: "q4",
        // Spec: phrasing lowers bar for triage routing
        question: "Are you unsure whether basic first aid is enough?",
        sublabel: "Choose Yes if you have any doubt at all.",
        yes: { id: "out-triage",  outcome: "triage"   },
        no:  { id: "out-firstaid", outcome: "firstaid" },
      },
      no: { id: "out-triage", outcome: "triage" },
    },
    no: { id: "out-911", outcome: "911" },
  },
  no: {
    id: "q5",
    question: "Is there property damage, a spill, or a release?",
    sublabel: null,
    yes: { id: "out-secure", outcome: "secure"   },
    no:  { id: "out-secure", outcome: "secure"   },
  },
};

const OUTCOME_LABELS = {
  "911":      { label: "Call 911",             color: C.alarm },
  "triage":   { label: "Call triage line",     color: "#B45309" },
  "firstaid": { label: "Administer first aid", color: C.pine  },
  "secure":   { label: "Secure the area",      color: C.slate },
};

// ── Progress dots ─────────────────────────────────────────────────────────────
function ProgressDots({ total, current }) {
  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 28 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          width: i === current ? 22 : 8,
          height: 8, borderRadius: 4,
          background: i < current
            ? "rgba(168,213,181,.7)"
            : i === current
            ? C.mint
            : "rgba(255,255,255,.12)",
          transition: "all .3s ease",
        }} />
      ))}
    </div>
  );
}

// ── Answer button ─────────────────────────────────────────────────────────────
function AnswerBtn({ label, onClick, variant }) {
  const [pressed, setPressed] = useState(false);
  const isYes = variant === "yes";

  return (
    <button
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onClick={onClick}
      style={{
        width: "100%", padding: "18px 20px",
        background: isYes
          ? pressed ? "rgba(255,255,255,.22)" : "rgba(255,255,255,.13)"
          : pressed ? "rgba(255,255,255,.08)" : "rgba(255,255,255,.05)",
        color: C.white,
        border: `2px solid ${isYes ? "rgba(255,255,255,.35)" : "rgba(255,255,255,.12)"}`,
        borderRadius: 12,
        fontFamily: "'DM Sans', sans-serif",
        fontSize: "1rem", fontWeight: isYes ? 600 : 500,
        cursor: "pointer",
        transition: "all .12s",
        transform: pressed ? "scale(.98)" : "scale(1)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 10,
      }}
    >
      <span>{label}</span>
      <span style={{ fontSize: "1.1rem", opacity: .6 }}>{isYes ? "→" : "→"}</span>
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function S0bDecisionTree({
  responder = "Responder",
  onOutcome,   // (outcome: "911"|"triage"|"firstaid"|"secure") => void
  onBack,
}) {
  // Stack of visited node IDs for back navigation within the tree
  const [nodeStack, setNodeStack] = useState([TREE]);
  const node = nodeStack[nodeStack.length - 1];

  // Estimate depth for progress dots (max ~4 questions deep)
  const maxDepth = 4;
  const depth    = nodeStack.length - 1;

  function handleAnswer(branch) {
    if (branch.outcome) {
      onOutcome?.(branch.outcome);
    } else {
      setNodeStack(s => [...s, branch]);
    }
  }

  function handleBack() {
    if (nodeStack.length <= 1) {
      onBack?.();
    } else {
      setNodeStack(s => s.slice(0, -1));
    }
  }

  if (node.outcome) return null; // Shouldn't render; parent navigates on outcome

  return (
    <div style={{
      minHeight: "100vh",
      background: C.ink,
      fontFamily: "'DM Sans', sans-serif",
      display: "flex", flexDirection: "column",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes slideIn { from { opacity:0; transform:translateX(24px); } to { opacity:1; transform:translateX(0); } }
        .q-anim { animation: slideIn .22s cubic-bezier(.4,0,.2,1) both; }
      `}</style>

      {/* Top bar */}
      <div style={{
        padding: "16px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <button
          onClick={handleBack}
          style={{
            background: "none", border: "none",
            color: "rgba(255,255,255,.45)", fontSize: ".88rem",
            cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
            display: "flex", alignItems: "center", gap: 4, padding: "4px 0",
          }}
        >← Back</button>
        <div style={{
          fontSize: ".72rem", color: "rgba(255,255,255,.3)",
          background: "rgba(255,255,255,.07)",
          padding: "3px 10px", borderRadius: 20,
        }}>
          {responder}
        </div>
      </div>

      {/* Content */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "0 24px 60px",
        maxWidth: 440, margin: "0 auto", width: "100%",
      }}>

        <ProgressDots total={maxDepth} current={depth} />

        {/* Question card */}
        <div key={node.id} className="q-anim" style={{ width: "100%", marginBottom: 28 }}>
          <p style={{
            fontSize: ".72rem", fontWeight: 600,
            letterSpacing: ".1em", textTransform: "uppercase",
            color: "rgba(168,213,181,.6)", marginBottom: 12, textAlign: "center",
          }}>
            Question {depth + 1}
          </p>
          <h1 style={{
            fontSize: "1.5rem", fontWeight: 700,
            color: C.white, textAlign: "center",
            lineHeight: 1.3, marginBottom: node.sublabel ? 10 : 0,
          }}>
            {node.question}
          </h1>
          {node.sublabel && (
            <p style={{
              fontSize: ".85rem", color: "rgba(255,255,255,.45)",
              textAlign: "center", lineHeight: 1.5, marginTop: 8,
              fontStyle: "italic",
            }}>
              {node.sublabel}
            </p>
          )}
        </div>

        {/* Answer buttons */}
        <div key={node.id + "-btns"} className="q-anim" style={{
          display: "flex", flexDirection: "column", gap: 12, width: "100%",
          animation: "slideIn .22s cubic-bezier(.4,0,.2,1) .05s both",
        }}>
          <AnswerBtn label="Yes" variant="yes" onClick={() => handleAnswer(node.yes)} />
          <AnswerBtn label="No"  variant="no"  onClick={() => handleAnswer(node.no)}  />
        </div>

        {/* Outcome preview peek */}
        {depth >= 1 && (
          <p style={{
            marginTop: 28,
            fontSize: ".72rem", color: "rgba(255,255,255,.2)",
            textAlign: "center", lineHeight: 1.5,
          }}>
            Answers are recorded · you can go back
          </p>
        )}
      </div>
    </div>
  );
}
