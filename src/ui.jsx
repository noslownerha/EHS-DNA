// Shared building blocks for the "Clarity with character" design. Status colours
// follow visual-management convention and every text/tint pair meets WCAG AA.
import { COLORS as C, FONTS } from "./constants.js";

const TONES = {
  green: { fg: C.green, bg: C.greenLt, fill: C.green },    // on track
  amber: { fg: C.gold,  bg: C.goldLt,  fill: C.amberGfx }, // watch
  red:   { fg: C.red,   bg: C.redLt,   fill: C.red },      // act now
  blue:  { fg: C.navy,  bg: C.navyLt,  fill: C.navy },     // in progress / info
  gray:  { fg: C.slate, bg: "#EEEBE4", fill: C.slate },
};

// Status badge: colour + a leading dot + the words, so status is never colour-only.
export function StatusChip({ tone = "gray", children, solid = false }) {
  const t = TONES[tone] || TONES.gray;
  const style = solid && tone === "amber"
    ? { background: C.amberFill, color: C.ink }
    : solid ? { background: t.fill, color: "#fff" } : { background: t.bg, color: t.fg };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 24, padding: "0 10px", borderRadius: 12,
                   fontSize: ".78rem", fontWeight: 700, whiteSpace: "nowrap", ...style }}>
      <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: "50%", background: "currentColor", opacity: .9 }} />
      {children}
    </span>
  );
}

export function Card({ children, style }) {
  return <section style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 16, overflow: "hidden", ...style }}>{children}</section>;
}

export function CardHeader({ title, right }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "14px 16px 10px" }}>
      <h2 style={{ margin: 0, fontFamily: FONTS.display, fontSize: "1.05rem", fontWeight: 700, color: C.ink }}>{title}</h2>
      {right}
    </div>
  );
}

// Tappable list row: tinted icon tile, title + meta, status on the right.
export function Row({ icon, tone = "blue", title, meta, status, onClick }) {
  const t = TONES[tone] || TONES.blue;
  return (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "12px 16px", border: "none",
                                       borderTop: `1px solid ${C.line}`, background: "transparent", textAlign: "left", cursor: onClick ? "pointer" : "default",
                                       fontFamily: FONTS.body, color: C.ink }}>
      {icon && <span style={{ width: 36, height: 36, borderRadius: 10, background: t.bg, color: t.fg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</span>}
      <span style={{ flex: 1, minWidth: 0 }}>
        {/* Wrap to two lines rather than cutting a course name to "Lockout /…" */}
        <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                       fontSize: ".95rem", fontWeight: 600, lineHeight: 1.3 }}>{title}</span>
        {meta && <span style={{ display: "block", fontSize: ".8rem", color: C.slate, marginTop: 1 }}>{meta}</span>}
      </span>
      {status}
    </button>
  );
}

export function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 12 ? "Morning" : h < 17 ? "Afternoon" : "Evening";
}
