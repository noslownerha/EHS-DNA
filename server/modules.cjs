/**
 * MODULE REGISTRY — the single source of truth for EHS DNA's feature modules.
 *
 * A "module" is a sellable/toggleable slice of the product (incident reporting,
 * corrective actions, inspections, LMS, …). This file declares every module, the
 * API path-prefixes it owns, the nav tabs it powers, and its soft dependencies.
 *
 * Design rules that keep the module system from becoming a tangle:
 *  1. CORE is never a module — auth/users/sites/config/notifications/op are
 *     infrastructure every tenant has. They are never gated.
 *  2. Modules SOFTEN, they don't hard-require. `softDeps` documents that a module
 *     is richer when another is on (e.g. corrective_actions accepts sources from
 *     incidents and inspections) but it must still function alone. The gate never
 *     blocks a module because a softDep is off.
 *  3. Every new endpoint and dashboard card declares its module (see moduleForPath
 *     + the DASHBOARD_CARDS map). Tag-as-you-go: a feature is born tagged, so we
 *     never have to retro-tag 40 endpoints later.
 *  4. Reserve keys for planned-but-unbuilt modules (e.g. `equipment`) so they slot
 *     into the same gate/nav/pricing grid the day they're built.
 *
 * Nothing here changes behavior while a tenant has all modules enabled — the gate
 * is a no-op in that case. Enablement lives per-tenant in the tenant_modules table.
 */

// key → definition. `core: true` means always-on infrastructure (never gated,
// never sold). `default` is the on/off state a brand-new tenant starts with.
const MODULES = {
  // ── Core infrastructure (never gated) ──────────────────────────────────────
  core: {
    core: true,
    label: "Core",
    // Path prefixes that must always work regardless of enabled modules.
    paths: ["auth", "users", "sites", "departments", "config", "health", "op",
            "notifications", "notification-rules", "leads", "labor-hours", "photos"],
    tabs: ["home"],
  },

  // ── Feature modules (toggleable, sellable) ─────────────────────────────────
  incidents: {
    label: "Incident & Hazard Reporting",
    blurb: "Report injuries, near misses, hazards, and observations; triage and investigate.",
    paths: ["incidents", "triage", "response-checklists"],
    tabs: ["flag", "triage"],
    default: true,
  },
  corrective_actions: {
    label: "Corrective Actions",
    blurb: "Assign, track, and close corrective actions and standalone tasks.",
    paths: ["cas"],
    tabs: [],                       // surfaced inside flag/reports, no dedicated tab today
    softDeps: ["incidents", "inspections"], // CAs can originate from either — or stand alone
    default: true,
  },
  inspections: {
    label: "Inspections & Audits",
    blurb: "Checklist-driven inspections and audits with findings.",
    paths: ["inspections", "checklists", "findings"],
    tabs: ["inspect"],
    default: true,
  },
  lms: {
    label: "Training & LMS",
    blurb: "Assign training, run CBTs and sign-offs, track compliance.",
    paths: ["trainings", "completions"],
    tabs: ["training"],
    default: true,
  },
  reporting: {
    label: "Reporting & Analytics",
    blurb: "OSHA logs, dashboards, and trend analytics.",
    paths: ["reports", "dashboard"],
    tabs: ["reports"],
    default: true,
  },
  recognition: {
    label: "Recognition & Engagement",
    blurb: "Peer kudos, points, and monthly leaderboards.",
    paths: ["points"],
    tabs: ["recognition"],
    softDeps: ["incidents", "lms"], // earns from reports/kudos and training, but works standalone
    default: true,
  },

  // ── Reserved for planned modules (declared now so they slot in cleanly) ─────
  equipment: {
    label: "Equipment & Assets",
    blurb: "Asset registry with QR codes linking to LOTO procedures, SOPs, and equipment inspections.",
    paths: ["assets", "sops", "loto"],   // not built yet — reserved
    tabs: [],
    softDeps: ["inspections"],
    default: false,                       // off until the module ships
    reserved: true,                       // flag: not yet implemented
  },
};

// Reverse index: API path-prefix → module key. Built once from MODULES.paths.
const PATH_TO_MODULE = {};
for (const [key, def] of Object.entries(MODULES)) {
  for (const p of def.paths || []) PATH_TO_MODULE[p] = key;
}

// Reverse index: nav tab → module key.
const TAB_TO_MODULE = {};
for (const [key, def] of Object.entries(MODULES)) {
  for (const t of def.tabs || []) TAB_TO_MODULE[t] = key;
}

/** The first path segment after /api/ — e.g. "/api/cas/12" → "cas". */
function pathPrefix(urlPath) {
  const m = /^\/api\/([a-z0-9-]+)/i.exec(urlPath || "");
  return m ? m[1].toLowerCase() : null;
}

/**
 * Which module owns a request path? Returns the module key, or "core" for
 * infrastructure, or null if the path isn't recognized (unrecognized = allowed;
 * the gate only blocks paths it can positively attribute to a disabled module).
 */
function moduleForPath(urlPath) {
  const prefix = pathPrefix(urlPath);
  if (!prefix) return null;
  return PATH_TO_MODULE[prefix] ?? null;
}

// Feature module keys (everything sellable — excludes core).
const FEATURE_MODULES = Object.keys(MODULES).filter(k => !MODULES[k].core);

// Live (implemented) feature modules — excludes reserved-but-unbuilt.
const LIVE_MODULES = FEATURE_MODULES.filter(k => !MODULES[k].reserved);

module.exports = {
  MODULES, FEATURE_MODULES, LIVE_MODULES,
  PATH_TO_MODULE, TAB_TO_MODULE,
  pathPrefix, moduleForPath,
};
