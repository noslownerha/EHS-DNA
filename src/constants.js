// EHS DNA — Shared constants & demo seed data
// Company: Summit Operations Co. (generic demo)
// Round 1 review applied: buckets 1–4

export const BRAND = {
  name:     "EHS DNA",
  tagline:  "Keeping the right eyes on what matters.",
  company:  "Summit Operations Co.",
  industry: "Manufacturing / General Industry",
  blsRate:  3.2, // placeholder — configurable in settings
};

export const SITES = [
  { id: "riverside", name: "Riverside", location: "Portland, OR",  staff: 22, depts: 4 },
  { id: "highland",  name: "Highland",  location: "Denver, CO",    staff: 17, depts: 3 },
];

export const DEPARTMENTS = [
  "Production",
  "Warehouse & Logistics",
  "Maintenance",
  "Quality & Safety",
  "Administration",
];

export const STAFF = [
  { id: "u1",  first: "Jordan",  last: "Ellis",   role: "admin",        site: "Riverside", dept: "Administration",        email: "jellis@summitops.com"  },
  { id: "u2",  first: "Taylor",  last: "Marsh",   role: "safety",       site: "Riverside", dept: "Quality & Safety",      email: "tmarsh@summitops.com"  },
  { id: "u3",  first: "Morgan",  last: "Reyes",   role: "site_manager", site: "Riverside", dept: "Administration",        email: "mreyes@summitops.com"  },
  { id: "u4",  first: "Casey",   last: "Nguyen",  role: "site_manager", site: "Highland",  dept: "Administration",        email: "cnguyen@summitops.com" },
  { id: "u5",  first: "Alex",    last: "Torres",  role: "staff",        site: "Riverside", dept: "Production",            email: "atorres@summitops.com" },
  { id: "u6",  first: "Sam",     last: "Kim",     role: "staff",        site: "Riverside", dept: "Warehouse & Logistics", email: "skim@summitops.com"    },
  { id: "u7",  first: "Riley",   last: "Patel",   role: "staff",        site: "Riverside", dept: "Maintenance",           email: "rpatel@summitops.com"  },
  { id: "u8",  first: "Quinn",   last: "Okafor",  role: "staff",        site: "Highland",  dept: "Production",            email: "qokafor@summitops.com" },
  { id: "u9",  first: "Drew",    last: "Santos",  role: "staff",        site: "Highland",  dept: "Warehouse & Logistics", email: "dsantos@summitops.com" },
  { id: "u10", first: "Avery",   last: "Chen",    role: "trainer",      site: "Riverside", dept: "Quality & Safety",      email: "achen@summitops.com"   },
];

export const DEMO_USERS = [
  {
    id: "demo_admin", label: "Admin / Safety Officer",
    sublabel: "Cross-site view · full access", emoji: "🛡", color: "#1C3A2A",
    user: STAFF[0], dashboard: "admin",
  },
  {
    id: "demo_manager", label: "Site Manager",
    sublabel: "Riverside site · elevated access", emoji: "📍", color: "#2D5A3D",
    user: STAFF[2], dashboard: "site_manager",
  },
  {
    id: "demo_staff", label: "Staff",
    sublabel: "Riverside · Production", emoji: "👷", color: "#4A5568",
    user: STAFF[4], dashboard: "staff",
  },
];

// Role permissions — Bucket 3+4 applied:
// - team & sites tabs removed (4.1, 4.2)
// - triage on all roles
// - reports restricted to site_manager and above
// - inspect on all roles
export const ROLE_PERMS = {
  admin: {
    tabs:         ["home", "flag", "inspect", "training", "triage", "reports"],
    dashboard:    "admin",
    seeAllSites:  true,
    seeCAs:       true,
    seeRootCause: true,
    canEditRoles: true,
  },
  safety: {
    tabs:         ["home", "flag", "inspect", "training", "triage", "reports"],
    dashboard:    "admin",
    seeAllSites:  true,
    seeCAs:       true,
    seeRootCause: true,
    canEditRoles: true,
  },
  site_manager: {
    tabs:         ["home", "flag", "inspect", "training", "triage", "reports"],
    dashboard:    "site_manager",
    seeAllSites:  false,
    seeCAs:       true,
    seeRootCause: true,
    canEditRoles: true,
  },
  trainer: {
    tabs:         ["home", "flag", "inspect", "training", "triage"],
    dashboard:    "staff",
    seeAllSites:  false,
    seeCAs:       false,
    seeRootCause: false,
    canEditRoles: false,
  },
  staff: {
    tabs:         ["home", "flag", "inspect", "training", "triage"],
    dashboard:    "staff",
    seeAllSites:  false,
    seeCAs:       false,
    seeRootCause: false,
    canEditRoles: false,
  },
};

// Tab config — "inspect" replaces "inspections" key
export const TAB_CONFIG = {
  home:     { label: "Home",     icon: "⌂"  },
  flag:     { label: "Flag",     icon: "🚩" },
  inspect:  { label: "Inspect",  icon: "🔍" },
  training: { label: "Training", icon: "📚" },
  triage:   { label: "Triage",   icon: "🚨" },
  reports:  { label: "Reports",  icon: "📊" },
};

// Incident types — Bucket 3: Environmental Release + Vehicle Incident removed
export const INCIDENT_TYPES = [
  { id: "injury",    label: "Injury",          emoji: "🩹", color: "#B91C1C", bg: "#FEF2F2" },
  { id: "near_miss", label: "Near Miss",       emoji: "⚠️", color: "#C8922A", bg: "#FDF3E3" },
  { id: "property",  label: "Property Damage", emoji: "🏗",  color: "#4A5568", bg: "#EEF1F0" },
  { id: "security",  label: "Security Event",  emoji: "🔒", color: "#6D28D9", bg: "#F5F3FF" },
];
