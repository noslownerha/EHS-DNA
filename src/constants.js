// ── Canonical color tokens — edit here to rebrand the entire app ─────────────
// ── Brand palette (THE rebrand surface) ───────────────────────────────────────
// These seven values ARE the brand. To rebrand EHS DNA, change them here and the
// whole app follows — COLORS.forest/pine/sage/mint/foam/ink/chalk derive from
// these, and the components reference those tokens (not raw hex). Semantic colours
// (red = danger, gold = warning, etc.) live in COLORS below and DON'T change on a
// rebrand. NOTE: email (server/email.cjs), the PWA manifest, and index.html each
// carry their own copy of the primary colour because they run outside the JS
// bundle — keep them in sync with `primary` when rebranding.
export const BRAND_COLORS = {
  primary:   "#1C3A2A",   // forest — headers, primary surfaces
  primary2:  "#2D5A3D",   // pine — gradients, hover
  accent:    "#4A8C5C",   // sage — buttons, links, active
  accentSoft:"#A8D5B5",   // mint — soft accents
  wash:      "#E8F5EC",   // foam — tinted backgrounds
  textDark:  "#0F1F17",   // ink — primary text on light
  surface:   "#F4F7F5",   // chalk — app background
};

export const COLORS = {
  // Brand tokens — derived from BRAND_COLORS so there is ONE source of truth.
  forest: BRAND_COLORS.primary,
  pine:   BRAND_COLORS.primary2,
  sage:   BRAND_COLORS.accent,
  mint:   BRAND_COLORS.accentSoft,
  foam:   BRAND_COLORS.wash,
  ink:    BRAND_COLORS.textDark,
  chalk:  BRAND_COLORS.surface,
  // Semantic / neutral tokens — constant across any rebrand.
  slate: "#4A5568",
  mist: "#8FA3A0",
  white: "#FFFFFF",
  dark: "#1A1A2E",
  mid: "#16213E",
  gold: "#C8922A",
  goldLt: "#FDF3E3",
  red: "#C0392B",
  redLt: "#FDECEA",
  alarm: "#B91C1C",
  alarmLt: "#FEF2F2",
  orange: "#D4622A",
  orangeLt: "#FEF0E7",
  green: "#2EC4B6",
  greenLt: "#E8FAF9",
  navy: "#1F4E79",
  navyLt: "#D6E4F0",
  purple: "#6B3FA0",
  purpleLt: "#F3F0F9",
  teal: "#00B4D8",
  tealLt: "#E0F7FC",
};

// EHS DNA – Shared constants & demo seed data
// Company: WhistlePig (Whiskey)
// Round 1 review applied: buckets 1–4

// ── Brand identity ────────────────────────────────────────────────────────────
export const BRAND = {
  name:     "EHS DNA",
  tagline:  "Keeping the right eyes on what matters.",
  company:  "WhistlePig",
  industry: "Distilled Spirits / Food & Beverage",
  blsRate:  3.2, // placeholder – configurable in settings
};

export const SITES = [
  { id: "moriah",      name: "Moriah",      location: "Moriah, NY",       staff: 22, depts: 6 },
  { id: "shoreham",    name: "Shoreham",    location: "Shoreham, VT",     staff: 17, depts: 6 },
  { id: "middlebury",  name: "Middlebury",  location: "Middlebury, VT",   staff: 15, depts: 6 },
  { id: "brandenburg", name: "Brandenburg", location: "Brandenburg, KY",  staff: 20, depts: 6 },
];

export const DEPARTMENTS = [
  "Bottling",
  "Warehouse",
  "Bulk Spirits",
  "Distillery",
  "Quality Control",
  "Facility Maintenance",
];

export const STAFF = [
  { id: "u1",  first: "Jordan",  last: "Ellis",   role: "admin",        site: "Moriah",      dept: "Quality Control",      email: "jellis@whistlepig.com"  },
  { id: "u2",  first: "Taylor",  last: "Marsh",   role: "safety",       site: "Moriah",      dept: "Quality Control",      email: "tmarsh@whistlepig.com"  },
  { id: "u3",  first: "Morgan",  last: "Reyes",   role: "site_manager", site: "Moriah",      dept: "Bottling",             email: "mreyes@whistlepig.com"  },
  { id: "u4",  first: "Casey",   last: "Nguyen",  role: "site_manager", site: "Brandenburg", dept: "Bottling",             email: "cnguyen@whistlepig.com" },
  { id: "u5",  first: "Alex",    last: "Torres",  role: "staff",        site: "Moriah",      dept: "Distillery",           email: "atorres@whistlepig.com" },
  { id: "u6",  first: "Sam",     last: "Kim",     role: "staff",        site: "Moriah",      dept: "Warehouse",            email: "skim@whistlepig.com"    },
  { id: "u7",  first: "Riley",   last: "Patel",   role: "staff",        site: "Moriah",      dept: "Facility Maintenance", email: "rpatel@whistlepig.com"  },
  { id: "u8",  first: "Quinn",   last: "Okafor",  role: "staff",        site: "Brandenburg", dept: "Distillery",           email: "qokafor@whistlepig.com" },
  { id: "u9",  first: "Drew",    last: "Santos",  role: "staff",        site: "Brandenburg", dept: "Warehouse",            email: "dsantos@whistlepig.com" },
  { id: "u10", first: "Avery",   last: "Chen",    role: "trainer",      site: "Moriah",      dept: "Quality Control",      email: "achen@whistlepig.com"   },
];

export const DEMO_USERS = [
  {
    id: "demo_admin", label: "Admin / Safety Officer",
    sublabel: "Cross-site view · full access", emoji: "🔴", color: "#1C3A2A",
    user: STAFF[0], dashboard: "admin",
  },
  {
    id: "demo_manager", label: "Site Manager",
    sublabel: "Moriah site · elevated access", emoji: "🟠", color: "#2C4A3A",
    user: STAFF[2], dashboard: "manager",
  },
  {
    id: "demo_staff", label: "Floor Staff",
    sublabel: "Moriah · Distillery", emoji: "🟡", color: "#3A5A2A",
    user: STAFF[4], dashboard: "staff",
  },
];

// ── Incident types (Round 1: Environmental Release & Vehicle Incident removed) ─
// What the worker sees when they flag something. Deliberately plain-language, not
// EHS jargon — "near miss" and "observation" mean nothing to most floor workers,
// and the classification is the safety team's job, not theirs. Each prompt maps to
// an underlying type the system uses for routing/OSHA; safety can always re-triage.
// `group` splits the picker into "Something's wrong" (may need a response) and
// "Speak up" (the engagement channels that build safety culture — most EHS tools
// have none of these, and they're where frontline buy-in comes from).
export const INCIDENT_TYPES = [
  { id: "injury",    label: "Someone got hurt",        sub: "Injury or illness",            icon: "🩹", color: "#C0392B", bg: "#FDECEA", group: "wrong" },
  { id: "near_miss", label: "Something almost happened", sub: "Close call — no one hurt",    icon: "😮‍💨", color: "#C8922A", bg: "#FDF3E3", group: "wrong" },
  { id: "hazard",    label: "I spotted a hazard",      sub: "Something unsafe to fix",       icon: "⚠️", color: "#D4622A", bg: "#FEF0E7", group: "wrong" },
  { id: "property",  label: "Something got damaged",   sub: "Equipment or property",         icon: "🔧", color: "#8A5A00", bg: "#FEF0E7", group: "wrong" },
  { id: "security",  label: "Security concern",        sub: "Theft, trespass, threat",       icon: "🔒", color: "#4A5568", bg: "#EEF2F0", group: "wrong" },
  { id: "positive",  label: "Something went right",    sub: "Caught someone doing it safe",  icon: "👍", color: "#4A8C5C", bg: "#E8F5EC", group: "speak" },
  { id: "idea",      label: "I have an idea",          sub: "A way to make things safer",     icon: "💡", color: "#2D7D9A", bg: "#E0F2F7", group: "speak" },
];

// ── Bottom nav tab definitions ─────────────────────────────────────────────────
export const TAB_CONFIG = {
  home:     { icon: "🏠", label: "Home"     },
  flag:     { icon: "🚩", label: "Flag Issue" },
  triage:   { icon: "⛑️", label: "Triage"   },
  inspect:  { icon: "📋", label: "Inspect"  },
  training: { icon: "🎓", label: "Training" },
  reports:  { icon: "📊", label: "Reports"  },
};

// Which module powers each nav tab. Mirrors server/modules.cjs (keep in sync).
// Tabs with no module here (e.g. home) are core and always shown. A tab is shown
// only if its module is in the tenant's enabled set.
export const TAB_MODULE = {
  flag:    "incidents",
  triage:  "incidents",
  inspect: "inspections",
  training: "lms",
  reports: "reporting",
  recognition: "recognition",
};

// Intersect a role's tabs with the tenant's enabled modules. When modules is
// null/undefined (config not loaded yet, or older server), everything shows —
// so this is a safe no-op until the server actually reports modules.
export function visibleTabs(roleTabs, enabledModules) {
  if (!Array.isArray(enabledModules)) return roleTabs;
  const on = new Set(enabledModules);
  return roleTabs.filter(t => {
    const mod = TAB_MODULE[t];
    return !mod || on.has(mod);
  });
}

// Is a given feature module enabled for the current tenant? Reads BRAND.modules
// (populated from /api/config). Returns true when modules aren't loaded yet, so
// dashboard cards don't flicker-hide before config arrives — a safe default given
// the server-side gate is the real enforcement. Dashboard cards use this to avoid
// showing a metric (e.g. "Open CAs: 0") for a module the tenant doesn't have,
// which would misleadingly read as "all clear".
export function moduleEnabled(moduleKey) {
  if (!Array.isArray(BRAND.modules)) return true;
  return BRAND.modules.includes(moduleKey);
}

// ── Role permissions & tab access ──────────────────────────────────────────────
// Reports restricted to Site Manager and above (Round 1 decision).
// Triage accessible to all roles.
export const ROLE_PERMS = {
  admin:        { dashboard: "admin",   seeCAs: true,  tabs: ["home", "flag", "triage", "inspect", "training", "reports"] },
  safety:       { dashboard: "admin",   seeCAs: true,  tabs: ["home", "flag", "triage", "inspect", "training", "reports"] },
  site_manager: { dashboard: "manager", seeCAs: true,  tabs: ["home", "flag", "triage", "inspect", "training", "reports"] },
  trainer:      { dashboard: "staff",   seeCAs: false, tabs: ["home", "flag", "triage", "inspect", "training"] },
  staff:        { dashboard: "staff",   seeCAs: false, tabs: ["home", "flag", "triage", "inspect", "training"] },
};
