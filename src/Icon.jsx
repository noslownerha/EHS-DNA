// One consistent line-icon set for the app. Replaces emoji, which render
// differently on every phone and can't take the brand colour. 24×24 grid,
// currentColor stroke, so an icon always matches the text beside it.
const PATHS = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  flag: <><path d="M5 21V4" /><path d="M5 4h12l-2.5 4L17 12H5" /></>,
  check: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1" /><path d="m9 13 2 2 4-4" /></>,
  cap: <><path d="M2 9.5 12 5l10 4.5L12 14z" /><path d="M6 11.5V16c3.5 2.5 8.5 2.5 12 0v-4.5" /></>,
  chart: <path d="M4 20V11M10 20V5M16 20v-7M21 20H3" />,
  bell: <><path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
  alert: <><path d="M12 4 2.5 20h19z" /><path d="M12 10v4" /><path d="M12 17h.01" /></>,
  medic: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5h6v2M12 10.5v6M9 13.5h6" /></>,
  building: <><path d="M4 21V5l8-2v18M12 8h8v13" /><path d="M8 8h.01M8 12h.01M8 16h.01M16 12h.01M16 16h.01" /></>,
  card: <><rect x="2.5" y="5" width="19" height="14" rx="2" /><path d="M2.5 10h19M6 15h4" /></>,
  back: <path d="m15 6-6 6 6 6" />,
  chev: <path d="m9 6 6 6-6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  qr: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3M21 14v7h-4M14 18v3" /></>,
  wrench: <path d="M14.5 6.5a4 4 0 0 0-5.3 5.3L3.5 17.5a1.8 1.8 0 0 0 2.5 2.5l5.7-5.7a4 4 0 0 0 5.3-5.3l-2.6 2.6-2.3-.5-.5-2.3z" />,
  star: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />,
};

export default function Icon({ name, size = 20, stroke = 1.8, style, title }) {
  const p = PATHS[name];
  if (!p) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}
         strokeLinecap="round" strokeLinejoin="round" style={style}
         role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      {p}
    </svg>
  );
}

// Logo: a helix inside a mint tile + wordmark. `onDark` for the petrol header.
export function Logo({ size = 28, onDark = true, wordmark = true }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="9" fill="#7FD1C3" />
        <path d="M11 7c0 6 10 6 10 12s-10 6-10 12M21 7c0 6-10 6-10 12" fill="none" stroke="#0B3F4C" strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="16" cy="13" r="1.6" fill="#0B3F4C" />
      </svg>
      {wordmark && (
        <span style={{ fontFamily: "'Bricolage Grotesque', 'DM Sans', sans-serif", fontWeight: 700, fontSize: size * 0.62,
                       letterSpacing: "-0.01em", color: onDark ? "#FFFFFF" : "#15212B", whiteSpace: "nowrap" }}>
          EHS <span style={{ color: onDark ? "#7FD1C3" : "#0E5566" }}>DNA</span>
        </span>
      )}
    </span>
  );
}
