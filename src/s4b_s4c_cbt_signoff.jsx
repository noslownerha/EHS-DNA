import { COLORS } from "./constants.js";
import { useState, useRef } from "react";
import { EHSHeader } from "./AppShell.jsx";

const C = { ...COLORS };


// ════════════════════════════════════════════════════════════════════════════
// S4b — CBT Player (mobile)
// ════════════════════════════════════════════════════════════════════════════
function SlideVideo({ url }) {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/);
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  const embed = yt ? `https://www.youtube.com/embed/${yt[1]}`
              : vimeo ? `https://player.vimeo.com/video/${vimeo[1]}` : null;
  return (
    <div style={{ marginBottom: 16, borderRadius: 10, overflow: "hidden", background: "#000" }}>
      {embed ? (
        <iframe src={embed} title="Training video" allowFullScreen
          style={{ width: "100%", aspectRatio: "16/9", border: "none", display: "block" }} />
      ) : (
        <video src={url} controls style={{ width: "100%", display: "block", maxHeight: 360 }} />
      )}
    </div>
  );
}

export function S4bCBTPlayer({ onHome, training, onComplete, onFail, onBack }) {
  const [slideIndex,   setSlideIndex]   = useState(0);
  const [answers,      setAnswers]      = useState({});   // slideId → selectedIndex
  const [revealed,     setRevealed]     = useState({});   // slideId → bool
  const [completed,    setCompleted]    = useState(false);
  const [score,        setScore]        = useState(null);
  const failLogged = useRef(false);

  // No training content to play — guard rather than render placeholder data.
  if (!training || !Array.isArray(training.slides) || training.slides.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: C.mist, fontFamily: "'DM Sans', sans-serif" }}>
        <p style={{ fontSize: "1rem", marginBottom: 16 }}>This training has no content to display yet.</p>
        <button onClick={onBack ?? onHome} style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: C.sage, color: "#fff", fontWeight: 700, cursor: "pointer" }}>Go back</button>
      </div>
    );
  }
  const slide      = training.slides[slideIndex];
  const total      = training.slides.length;
  const isLast     = slideIndex === total - 1;
  const isCheck    = slide.type === "knowledge_check";
  const answered   = answers[slide.id] !== undefined;
  const hasRevealed= revealed[slide.id];

  function handleAnswer(idx) {
    if (hasRevealed) return;
    setAnswers(a => ({ ...a, [slide.id]: idx }));
  }

  function handleReveal() {
    setRevealed(r => ({ ...r, [slide.id]: true }));
  }

  function handleNext() {
    if (isLast) {
      // Calculate score
      const checks = training.slides.filter(s => s.type === "knowledge_check");
      const correct = checks.filter(s => answers[s.id] === s.correctIndex).length;
      const pct = checks.length > 0 ? Math.round((correct / checks.length) * 100) : 100;
      setScore(pct);
      setCompleted(true);
      if (pct < training.passThreshold && !failLogged.current) {
        failLogged.current = true;
        onFail?.({ score: pct });
      }
    } else {
      setSlideIndex(i => i + 1);
    }
  }

  const canAdvance = !isCheck || hasRevealed;
  const pct        = Math.round(((slideIndex + 1) / total) * 100);

  // ── Completion screen ──
  if (completed) {
    const passed = score >= training.passThreshold;
    return (
      <div style={{ minHeight: "100vh", background: passed ? C.forest : "#2D1A1A", fontFamily: "'DM Sans', sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "28px 24px" }}>
        <style>{`
          @keyframes popIn { 0%{transform:scale(.8);opacity:0;} 60%{transform:scale(1.1);} 100%{transform:scale(1);opacity:1;} }
          * { box-sizing: border-box; margin: 0; padding: 0; }
        `}</style>
        <div style={{ fontSize: "3rem", marginBottom: 16, animation: "popIn .4s ease both" }}>{passed ? "🎉" : "📚"}</div>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: C.white, textAlign: "center", marginBottom: 8 }}>
          {passed ? "Training complete!" : "Review required"}
        </h1>
        <div style={{ fontSize: "2.5rem", fontWeight: 700, color: passed ? C.mint : "#F5A0A0", marginBottom: 8 }}>
          {score}%
        </div>
        <p style={{ fontSize: ".85rem", color: "rgba(255,255,255,.55)", textAlign: "center", marginBottom: 28, lineHeight: 1.5 }}>
          {passed
            ? `Passed (threshold: ${training.passThreshold}%). Your completion has been recorded.`
            : `Below the ${training.passThreshold}% pass threshold. Please retake the module.`
          }
        </p>
        <button onClick={() => passed ? onComplete?.({ score, passed }) : setCompleted(false)} style={{
          width: "100%", maxWidth: 340, padding: "14px",
          background: passed ? C.mint : "#F5A0A0",
          color: passed ? C.forest : "#5A1A1A",
          border: "none", borderRadius: 10,
          fontFamily: "'DM Sans', sans-serif",
          fontSize: ".95rem", fontWeight: 700, cursor: "pointer",
        }}>
          {passed ? "Done" : "Retake module"}
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: C.chalk, fontFamily: "'DM Sans', sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes slideIn { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:translateX(0); } }
        .slide-anim { animation: slideIn .2s ease both; }
        .option-row:hover { background: ${C.foam} !important; }
        .next-btn:hover:not(:disabled) { background: ${C.purple}cc !important; }
      `}</style>

      {/* Top bar with progress */}
      <div style={{ background: C.forest, padding: "12px 18px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: C.mint, fontSize: ".85rem", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>← Exit</button>
          <div style={{ fontWeight: 600, fontSize: ".82rem", color: C.white, textAlign: "center", flex: 1, padding: "0 10px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {training.title}
          </div>
          <div style={{ fontSize: ".78rem", color: C.mint, fontWeight: 600, flexShrink: 0 }}>{slideIndex + 1}/{total}</div>
        </div>
        <div style={{ height: 4, background: "rgba(255,255,255,.15)", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: C.mint, borderRadius: 2, transition: "width .3s ease" }} />
        </div>
      </div>

      {/* Slide content */}
      <div className="slide-anim" key={slide.id} style={{ flex: 1, padding: "18px 18px 100px", overflowY: "auto" }}>

        {/* Slide heading */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          marginBottom: 16,
        }}>
          {isCheck && <span style={{ fontSize: ".75rem", fontWeight: 600, background: C.purpleLt, color: C.purple, padding: "2px 9px", borderRadius: 20 }}>Knowledge check</span>}
        </div>

        <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: C.ink, marginBottom: 14, lineHeight: 1.3 }}>
          {slide.heading}
        </h2>

        {/* Content slide */}
        {slide.type === "content" && (
          <>
            {slide.videoUrl && <SlideVideo url={slide.videoUrl} />}
            {slide.body && <p style={{ fontSize: ".92rem", color: C.ink, lineHeight: 1.7, marginBottom: 16, whiteSpace: "pre-wrap" }}>{slide.body}</p>}

            {/* Spec: company-specific example callout on every CBT slide */}
            {slide.example && (
              <div style={{
                padding: "13px 16px",
                background: C.foam,
                borderLeft: `3px solid ${C.sage}`,
                borderRadius: 8,
                fontSize: ".85rem", color: C.pine, lineHeight: 1.6,
              }}>
                <div style={{ fontSize: ".68rem", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: C.sage, marginBottom: 5 }}>
                  WhistlePig example
                </div>
                {slide.example}
              </div>
            )}
          </>
        )}

        {/* Knowledge check */}
        {slide.type === "knowledge_check" && (
          <>
            <p style={{ fontSize: ".92rem", color: C.ink, lineHeight: 1.6, marginBottom: 18, fontWeight: 500 }}>
              {slide.question}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {slide.options.map((opt, idx) => {
                const selected  = answers[slide.id] === idx;
                const isCorrect = idx === slide.correctIndex;
                const showResult= hasRevealed;

                let bg    = C.white;
                let border= "#D0DEDB";
                let color = C.ink;

                if (showResult && isCorrect) { bg = C.foam; border = C.sage; color = C.pine; }
                else if (showResult && selected && !isCorrect) { bg = C.redLt; border = C.red; color = C.red; }
                else if (selected) { bg = C.purpleLt; border = C.purple; color = C.purple; }

                return (
                  <div
                    key={idx}
                    className="option-row"
                    onClick={() => handleAnswer(idx)}
                    style={{
                      padding: "12px 14px",
                      background: bg, border: `1.5px solid ${border}`,
                      borderRadius: 9, cursor: hasRevealed ? "default" : "pointer",
                      display: "flex", alignItems: "center", gap: 10,
                      transition: "all .15s",
                    }}
                  >
                    <div style={{
                      width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                      border: `2px solid ${selected || (showResult && isCorrect) ? border : "#D0DEDB"}`,
                      background: selected && !showResult ? C.purple : showResult && isCorrect ? C.sage : showResult && selected ? C.red : "none",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: ".65rem", color: C.white, fontWeight: 700,
                      transition: "all .15s",
                    }}>
                      {showResult && isCorrect ? "✓" : showResult && selected && !isCorrect ? "×" : ""}
                    </div>
                    <span style={{ fontSize: ".9rem", color, lineHeight: 1.4 }}>{opt}</span>
                  </div>
                );
              })}
            </div>

            {/* Reveal / explanation */}
            {answered && !hasRevealed && (
              <button onClick={handleReveal} style={{
                width: "100%", padding: "11px",
                background: C.purple, color: C.white,
                border: "none", borderRadius: 8,
                fontFamily: "'DM Sans', sans-serif", fontSize: ".9rem", fontWeight: 700,
                cursor: "pointer", marginBottom: 12,
              }}>Check answer</button>
            )}

            {hasRevealed && (
              <div style={{
                padding: "12px 14px",
                background: answers[slide.id] === slide.correctIndex ? C.foam : C.redLt,
                border: `1.5px solid ${answers[slide.id] === slide.correctIndex ? C.mint : "#F5C6C2"}`,
                borderRadius: 8, fontSize: ".85rem",
                color: answers[slide.id] === slide.correctIndex ? C.pine : C.red,
                lineHeight: 1.5, marginBottom: 12,
              }}>
                <strong>{answers[slide.id] === slide.correctIndex ? "Correct! " : "Incorrect. "}</strong>
                {slide.explanation}
              </div>
            )}
          </>
        )}
      </div>

      {/* Next button */}
      <div style={{ position: "fixed", bottom: 58, left: 0, right: 0, padding: "14px 18px", background: C.white, borderTop: "1px solid #E2EBE6", boxShadow: "0 -4px 20px rgba(0,0,0,.06)" }}>
        <button
          className="next-btn"
          onClick={handleNext}
          disabled={!canAdvance}
          style={{
            width: "100%", padding: "14px",
            background: canAdvance ? C.purple : "#B0B0C8",
            color: C.white, border: "none", borderRadius: 9,
            fontFamily: "'DM Sans', sans-serif", fontSize: ".95rem", fontWeight: 700,
            cursor: canAdvance ? "pointer" : "default", transition: "all .18s",
          }}
        >
          {isLast ? "Finish & submit" : "Next →"}
        </button>
      </div>
    </div>
  );
}


// ════════════════════════════════════════════════════════════════════════════
// S4c — In-Person Sign-Off (Trainer/Safety Officer mobile)
// Spec §14.2: role-gated — Trainer, Safety Officer, Site Manager, Company Admin
// Department Lead explicitly excluded.
// ════════════════════════════════════════════════════════════════════════════
const STAFF_LIST = [
  { id: 1,  first: "Sarah",  last: "Mitchell", dept: "Bottling & Packaging",    site: "Moriah"      },
  { id: 2,  first: "Jake",   last: "Larson",    dept: "Bottling & Packaging",    site: "Moriah"      },
  { id: 3,  first: "Beth",   last: "Torres",    dept: "Bottling & Packaging",    site: "Moriah"      },
  { id: 4,  first: "Marcus", last: "Webb",      dept: "Warehouse",               site: "Moriah"      },
  { id: 5,  first: "Carlos", last: "R.",        dept: "Warehouse",               site: "Moriah"      },
  { id: 6,  first: "Tom",    last: "Rivera",    dept: "Facility Maintenance",             site: "Shoreham"    },
  { id: 7,  first: "Dana",   last: "Kowalski",  dept: "Production / Distilling", site: "Middlebury"  },
];

const TRAINING_LIST = [
  { id: 1, title: "Bottling Line Safety Orientation",    type: "in_person" },
  { id: 2, title: "Forklift Operator Certification",     type: "in_person" },
  { id: 3, title: "First Aid & CPR",                     type: "in_person" },
  { id: 4, title: "Hazard Communication (HAZCOM)",       type: "in_person" },
];

export function S4cInPersonSignOff({ onHome,
  trainerRole = "trainer", // "trainer" | "safety" | "site_manager" | "admin"
  trainer = { name: "Trainer", site: "Moriah" },
  onBack,
  onComplete,
}) {
  const [selectedTraining, setSelectedTraining] = useState(null);
  const [selectedStaff,    setSelectedStaff]    = useState(null);
  const [notes,            setNotes]            = useState("");
  const [submitted,        setSubmitted]        = useState(false);
  const [notesFocused,     setNotesFocused]     = useState(false);

  // Spec: role gate — Department Lead excluded
  const BLOCKED_ROLES = ["dept_lead"];
  if (BLOCKED_ROLES.includes(trainerRole)) {
    return (
      <div style={{ minHeight: "100vh", background: C.chalk, fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ textAlign: "center", maxWidth: 300 }}>
          <div style={{ fontSize: "2rem", marginBottom: 12 }}>🔒</div>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: C.ink, marginBottom: 8 }}>Access restricted</h2>
          <p style={{ fontSize: ".85rem", color: C.mist, lineHeight: 1.5 }}>
            In-person sign-off requires Trainer, Safety Officer, Site Manager, or Company Admin role. Department Lead is excluded from this action.
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div style={{ minHeight: "100vh", background: C.forest, fontFamily: "'DM Sans', sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 28 }}>
        <div style={{ fontSize: "2.8rem", marginBottom: 14 }}>✅</div>
        <h1 style={{ fontSize: "1.3rem", fontWeight: 700, color: C.white, textAlign: "center", marginBottom: 8 }}>Completion recorded</h1>
        <p style={{ fontSize: ".85rem", color: "rgba(255,255,255,.55)", textAlign: "center", marginBottom: 24 }}>
          {selectedStaff?.first} {selectedStaff?.last} — {selectedTraining?.title}
        </p>
        <p style={{ fontSize: ".75rem", color: "rgba(255,255,255,.35)", textAlign: "center", marginBottom: 28 }}>
          Signed off by {trainer.name}
        </p>
        <button onClick={() => { setSubmitted(false); setSelectedTraining(null); setSelectedStaff(null); setNotes(""); }} style={{
          padding: "12px 28px", background: C.mint, color: C.forest,
          border: "none", borderRadius: 9, fontFamily: "'DM Sans', sans-serif",
          fontSize: ".95rem", fontWeight: 700, cursor: "pointer",
        }}>Sign off another →</button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: C.chalk, fontFamily: "'DM Sans', sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        textarea::placeholder { color: ${C.mist}; }
        .submit-btn:hover:not(:disabled) { background: ${C.pine} !important; }
      `}</style>

      <EHSHeader onHome={onHome} rightContent={<button onClick={onBack} style={{ background: "none", border: "none", color: C.mint, fontSize: ".85rem", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>← Back</button>} />

      <div style={{ flex: 1, padding: "18px 18px 100px", overflowY: "auto" }}>
        <h1 style={{ fontSize: "1.2rem", fontWeight: 700, color: C.ink, marginBottom: 4 }}>Sign off training</h1>
        <p style={{ fontSize: ".82rem", color: C.mist, marginBottom: 20 }}>Individual in-person completion — signed off as {trainer.name}</p>

        {/* Training selection */}
        <div style={{ background: C.white, borderRadius: 10, boxShadow: "0 1px 8px rgba(15,31,23,.06)", padding: 16, marginBottom: 14 }}>
          <div style={{ fontSize: ".7rem", fontWeight: 600, color: C.sage, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>Training</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {TRAINING_LIST.map(t => (
              <div key={t.id} onClick={() => setSelectedTraining(t)} style={{
                padding: "10px 12px",
                background: selectedTraining?.id === t.id ? C.foam : C.chalk,
                border: `1.5px solid ${selectedTraining?.id === t.id ? C.sage : "#E2EBE6"}`,
                borderRadius: 8, cursor: "pointer", fontSize: ".88rem",
                color: selectedTraining?.id === t.id ? C.pine : C.ink,
                fontWeight: selectedTraining?.id === t.id ? 600 : 400,
                transition: "all .15s",
              }}>👥 {t.title}</div>
            ))}
          </div>
        </div>

        {/* Staff selection */}
        <div style={{ background: C.white, borderRadius: 10, boxShadow: "0 1px 8px rgba(15,31,23,.06)", padding: 16, marginBottom: 14 }}>
          <div style={{ fontSize: ".7rem", fontWeight: 600, color: C.sage, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>Staff member</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {STAFF_LIST.map(p => (
              <div key={p.id} onClick={() => setSelectedStaff(p)} style={{
                padding: "10px 12px",
                background: selectedStaff?.id === p.id ? C.foam : C.chalk,
                border: `1.5px solid ${selectedStaff?.id === p.id ? C.sage : "#E2EBE6"}`,
                borderRadius: 8, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 10,
                transition: "all .15s",
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: selectedStaff?.id === p.id ? C.sage : C.mint,
                  color: selectedStaff?.id === p.id ? C.white : C.forest,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: ".65rem", fontWeight: 700, flexShrink: 0,
                }}>
                  {p.first[0]}{p.last[0]}
                </div>
                <div>
                  <div style={{ fontSize: ".88rem", fontWeight: 600, color: selectedStaff?.id === p.id ? C.pine : C.ink }}>
                    {p.first} {p.last}
                  </div>
                  <div style={{ fontSize: ".72rem", color: C.mist }}>{p.dept} · {p.site}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div style={{ background: C.white, borderRadius: 10, boxShadow: "0 1px 8px rgba(15,31,23,.06)", padding: 16 }}>
          <div style={{ fontSize: ".7rem", fontWeight: 600, color: C.sage, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>Notes (optional)</div>
          <textarea
            value={notes} onChange={e => setNotes(e.target.value)}
            onFocus={() => setNotesFocused(true)} onBlur={() => setNotesFocused(false)}
            placeholder="Any notes about this completion…" rows={2}
            style={{ width: "100%", padding: "9px 11px", border: `1.5px solid ${notesFocused ? C.sage : "#D0DEDB"}`, borderRadius: 8, fontFamily: "'DM Sans', sans-serif", fontSize: ".88rem", color: C.ink, outline: "none", resize: "none", lineHeight: 1.5, transition: "all .18s" }}
          />
        </div>
      </div>

      <div style={{ position: "fixed", bottom: 58, left: 0, right: 0, padding: "14px 18px", background: C.white, borderTop: "1px solid #E2EBE6", boxShadow: "0 -4px 20px rgba(0,0,0,.06)" }}>
        <button
          className="submit-btn"
          onClick={() => { setSubmitted(true); onComplete?.({ training: selectedTraining, staff: selectedStaff, trainer: trainer.name, notes }); }}
          disabled={!selectedTraining || !selectedStaff}
          style={{
            width: "100%", padding: "14px",
            background: selectedTraining && selectedStaff ? C.sage : "#B0C8BA",
            color: C.white, border: "none", borderRadius: 9,
            fontFamily: "'DM Sans', sans-serif", fontSize: ".95rem", fontWeight: 700,
            cursor: selectedTraining && selectedStaff ? "pointer" : "default",
            transition: "all .18s",
          }}
        >Sign off completion</button>
      </div>
    </div>
  );
}
