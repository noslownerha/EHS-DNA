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
  bandage: <><rect x="2.5" y="8" width="19" height="8" rx="4" transform="rotate(-45 12 12)" /><path d="M10 10h.01M14 14h.01M10 14h.01M14 10h.01" /></>,
  bulb: <><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z" /></>,
  thumb: <><path d="M7 11v9H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1z" /><path d="M7 11l4-8a2.5 2.5 0 0 1 2.5 2.5V9h5.2a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.5 20H7" /></>,
  camera: <><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13.5" r="3.5" /></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="9.5" r="1.8" /><path d="m21 16-5.5-5.5L5 20" /></>,
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>,
  pin: <><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>,
  map: <><path d="M9 4 3 6.5v13.5L9 17.5l6 2.5 6-2.5V4l-6 2.5z" /><path d="M9 4v13.5M15 6.5V20" /></>,
  upload: <><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" /><path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  checkCircle: <><circle cx="12" cy="12" r="8.5" /><path d="m8.5 12.2 2.4 2.4 4.6-4.8" /></>,
  lock: <><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6" /></>,
  laptop: <><rect x="4" y="5" width="16" height="11" rx="1.5" /><path d="M2 19h20" /></>,
  award: <><circle cx="12" cy="9" r="5.5" /><path d="m8.5 13.3-1.5 7.7 5-2.7 5 2.7-1.5-7.7" /></>,
  broom: <><path d="M16.5 3.5 11 9" /><path d="M7 9.5c2-1.5 5-1.5 7.5 1L13 20H4.5c0-4 .5-8 2.5-10.5z" /><path d="M8 20l1-4M11 20l.5-3" /></>,
  bolt: <path d="M13 2.5 4.5 13.5H12l-1 8 8.5-11H12z" />,
  walk: <><circle cx="13" cy="4.5" r="1.8" /><path d="m9 21 2.5-6.5L14 17v4M7.5 11.5l2.5-3.5 3.5 1 2.5 3.5M10 8l-1.5 6.5" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  shield: <><path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.3 7.5 9.5 4.3-1.2 7.5-4.9 7.5-9.5V6z" /><path d="m9 12 2 2 4-4" /></>,
  flame: <path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.6 2.7-5.6 3.6-9.3 2.1 1.6 3 3.4 3.2 5.2 1-.7 1.7-1.9 1.9-3.2 2.4 2.1 4.3 4.7 4.3 7.5 0 3.5-2.6 6-6.5 6z" />,
  flask: <><path d="M9 3h6M10 3v6L4.5 18.5A1.6 1.6 0 0 0 5.9 21h12.2a1.6 1.6 0 0 0 1.4-2.5L14 9V3" /><path d="M7 15h10" /></>,
  doc: <><path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>,
  posture: <><circle cx="12" cy="4.5" r="1.8" /><path d="M12 7v7l-3 7M12 14l3 7M7.5 10.5h9" /></>,
  x: <path d="m6 6 12 12M18 6 6 18" />,
  box: <><path d="M3 7.5 12 3l9 4.5v9L12 21l-3-1.5M3 7.5v9L9 19.5" /><path d="M3 7.5 12 12l9-4.5M12 12v9" /></>,
  truck: <><path d="M3 6h10v10H3zM13 10h4l3 3v3h-7" /><circle cx="7" cy="18" r="1.8" /><circle cx="17" cy="18" r="1.8" /></>,
  tank: <><ellipse cx="12" cy="5.5" rx="7" ry="2.5" /><path d="M5 5.5v13c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-13M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5" /></>,
  edit: <><path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z" /><path d="m14 7 3 3" /></>,
  chat: <path d="M5 5h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-8l-5 4v-4H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />,
  user: <><circle cx="12" cy="8" r="3.8" /><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" /></>,
  phone: <path d="M6.5 3.5h3l1.5 4-2 1.5a11 11 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2 2A16.5 16.5 0 0 1 4.5 5.5a2 2 0 0 1 2-2z" />,
  leaf: <><path d="M5 19c0-9 6-14 15-14 0 9-5 15-14 15" /><path d="M5 19 13 11" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4-4" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" /></>,
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
