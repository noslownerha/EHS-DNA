// EHS DNA – Shared constants & demo seed data
// Company: WhistlePig (Whiskey)
// Round 1 review applied: buckets 1–4

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
export const INCIDENT_TYPES = [
  { id: "injury",      label: "Injury / Illness",      icon: "🩹" },
  { id: "near_miss",   label: "Near Miss",             icon: "⚠️" },
  { id: "property",    label: "Property Damage",       icon: "🔧" },
  { id: "spill",       label: "Spill / Leak",          icon: "💧" },
  { id: "fire",        label: "Fire / Explosion Risk", icon: "🔥" },
  { id: "security",    label: "Security Event",        icon: "🔒" },
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
