/**
 * EHS DNA — Database layer (SQLite via better-sqlite3)
 * Every domain table carries tenant_id from day one. Single tenant today
 * (WhistlePig = 1); multi-tenant later is a data change, not a schema change.
 */
const { open } = require("./sqlite.cjs");
const bcrypt = require("bcryptjs");
const path = require("path");

const DB_PATH = process.env.EHS_DB_PATH || path.join(__dirname, "..", "data", "ehs.db");
require("fs").mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = open(DB_PATH);
console.log("SQLite engine:", db.__engine);

db.exec(`
CREATE TABLE IF NOT EXISTS tenants (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  short_name TEXT,
  industry TEXT,
  tagline TEXT,
  triage_enabled INTEGER DEFAULT 1,
  triage_provider_name TEXT,
  triage_provider_phone TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sites (
  id INTEGER PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  location TEXT,
  floorplan TEXT,
  active INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  active INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','safety','site_manager','trainer','staff')),
  site_id INTEGER REFERENCES sites(id),
  department_id INTEGER REFERENCES departments(id),
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS incidents (
  id INTEGER PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  ref TEXT NOT NULL,                -- e.g. INC-2026-0001
  type TEXT NOT NULL,               -- injury | near_miss | property | spill | fire | security
  severity TEXT,                    -- minor | significant | serious | critical
  status TEXT DEFAULT 'open',       -- open | investigating | closed
  site_id INTEGER REFERENCES sites(id),
  description TEXT,
  location_detail TEXT,
  latitude REAL,                    -- GPS auto-captured at report time (optional)
  longitude REAL,
  involved TEXT,                    -- JSON array
  photos TEXT,                      -- JSON array of file refs
  reported_by INTEGER REFERENCES users(id),
  occurred_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS corrective_actions (
  id INTEGER PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  incident_id INTEGER REFERENCES incidents(id),
  finding_id INTEGER,
  title TEXT NOT NULL,
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'open',       -- open | in_progress | done | verified
  assignee_id INTEGER REFERENCES users(id),
  due_date TEXT,
  verified_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS checklists (
  id INTEGER PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  items TEXT NOT NULL,              -- JSON array of {id,label,category}
  site_id INTEGER REFERENCES sites(id),   -- null = available at all sites
  kind TEXT DEFAULT 'checklist',          -- checklist | gemba
  frequency_days INTEGER,                 -- null = on-demand only
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS inspections (
  id INTEGER PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  checklist_id INTEGER REFERENCES checklists(id),
  site_id INTEGER REFERENCES sites(id),
  inspector_id INTEGER REFERENCES users(id),
  status TEXT DEFAULT 'in_progress',-- in_progress | complete
  responses TEXT,                   -- JSON {itemId: pass|fail|na}
  started_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT
);
CREATE TABLE IF NOT EXISTS findings (
  id INTEGER PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  inspection_id INTEGER REFERENCES inspections(id),
  site_id INTEGER REFERENCES sites(id),
  severity TEXT DEFAULT 'low',
  description TEXT NOT NULL,
  status TEXT DEFAULT 'open',       -- open | resolved
  photos TEXT,
  resolution_action TEXT,
  resolution_notes TEXT,
  reported_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now')),
  resolved_at TEXT
);
CREATE TABLE IF NOT EXISTS trainings (
  id INTEGER PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  title TEXT NOT NULL,
  kind TEXT DEFAULT 'cbt',          -- cbt | in_person
  content TEXT,                     -- JSON (slides, quiz)
  frequency_months INTEGER,         -- recurrence; null = one-time
  required_roles TEXT,              -- JSON array of roles
  required_departments TEXT,        -- JSON array of department ids
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS training_completions (
  id INTEGER PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  training_id INTEGER NOT NULL REFERENCES trainings(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  session_id TEXT,                  -- shared for group sessions (audit trace)
  method TEXT DEFAULT 'cbt',        -- cbt | signoff | group
  score REAL,
  completed_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT
);
CREATE TABLE IF NOT EXISTS triage_records (
  id INTEGER PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  ref TEXT NOT NULL,                -- TRG-2026-0001
  responder_id INTEGER REFERENCES users(id),
  site_id INTEGER REFERENCES sites(id),
  outcome TEXT,                     -- emergency | triage | firstaid | none
  steps_completed TEXT,             -- JSON array
  notified TEXT,                    -- JSON array
  linked_incident_id INTEGER REFERENCES incidents(id),
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS billing_config (
  tenant_id INTEGER PRIMARY KEY REFERENCES tenants(id),
  base_price REAL DEFAULT 0,
  per_site REAL DEFAULT 0,
  per_user REAL DEFAULT 0,
  module_prices TEXT,               -- JSON { moduleKey: monthlyPrice } — per-enabled-module charges
  auto_approve INTEGER DEFAULT 0,
  billing_contact TEXT,
  notes TEXT
);
CREATE TABLE IF NOT EXISTS billing_adjustments (
  id INTEGER PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  kind TEXT NOT NULL CHECK (kind IN ('credit','discount_flat','discount_pct')),
  amount REAL NOT NULL,              -- dollars for credit/flat, percent for pct
  description TEXT,
  recurring INTEGER DEFAULT 0,       -- 1 = applies every invoice; 0 = consumed once
  consumed_invoice_id INTEGER,       -- set when a one-time adjustment is used
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  ref TEXT NOT NULL,                 -- INV-2026-07-001
  period TEXT NOT NULL,              -- YYYY-MM
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','approved','sent','paid','void')),
  line_items TEXT NOT NULL,          -- JSON [{label, qty, rate, amount}]
  subtotal REAL NOT NULL,
  adjustments TEXT DEFAULT '[]',     -- JSON [{label, amount}] (negative amounts)
  total REAL NOT NULL,
  generated_at TEXT DEFAULT (datetime('now')),
  approved_at TEXT, sent_at TEXT, paid_at TEXT,
  UNIQUE (tenant_id, period)
);
-- ── Equipment & Assets module ──────────────────────────────────────────────
-- Physical equipment/assets, each with a QR that deep-links to this record.
CREATE TABLE IF NOT EXISTS assets (
  id INTEGER PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  asset_tag TEXT,                   -- user-facing tag/number stencilled on the unit
  category TEXT,                    -- pump | forklift | tank | extinguisher | aed | ...
  site_id INTEGER REFERENCES sites(id),
  location TEXT,                    -- where within the site
  manufacturer TEXT,
  model TEXT,
  serial TEXT,
  status TEXT DEFAULT 'in_service', -- in_service | out_of_service | retired
  checklist_id INTEGER REFERENCES checklists(id), -- inspection template for this asset
  notes TEXT,
  photo TEXT,                       -- optional photo ref (JSON {id,name}) stored on disk
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
-- LOTO procedures and SOPs attached to an asset. Both share this table via kind.
CREATE TABLE IF NOT EXISTS asset_procedures (
  id INTEGER PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  asset_id INTEGER NOT NULL REFERENCES assets(id),
  kind TEXT NOT NULL,               -- loto | sop
  title TEXT NOT NULL,
  steps TEXT DEFAULT '[]',          -- JSON array of step strings (LOTO) or sections (SOP)
  body TEXT,                        -- freeform SOP text (alternative to steps)
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS notification_rules (
  id INTEGER PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  event TEXT NOT NULL,               -- incident_any | incident_injury | incident_critical
  recipient_roles TEXT DEFAULT '[]',
  recipient_users TEXT DEFAULT '[]',
  email INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  body TEXT,
  link_kind TEXT,
  link_ref TEXT,
  emailed INTEGER DEFAULT 0,
  read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(tenant_id, user_id, read);
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY,
  name TEXT, email TEXT NOT NULL, company TEXT, message TEXT,
  source TEXT DEFAULT 'marketing',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_incidents_tenant ON incidents(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_completions_user ON training_completions(tenant_id, user_id);
`);

// Idempotent migrations for databases created before these columns existed
["site_id INTEGER REFERENCES sites(id)", "kind TEXT DEFAULT 'checklist'", "frequency_days INTEGER"].forEach(col => {
  try { db.exec(`ALTER TABLE checklists ADD COLUMN ${col}`); } catch {}
});
try { db.exec("ALTER TABLE trainings ADD COLUMN required_users TEXT DEFAULT '[]'"); } catch {}
["resolution_action TEXT", "resolution_notes TEXT"].forEach(col => {
  try { db.exec(`ALTER TABLE findings ADD COLUMN ${col}`); } catch {}
});
try { db.exec("ALTER TABLE users ADD COLUMN is_operator INTEGER DEFAULT 0"); } catch {}
// Force a password change on any account still using a seeded/temp password.
try { db.exec("ALTER TABLE users ADD COLUMN must_change_password INTEGER DEFAULT 0"); } catch {}
try { db.exec("ALTER TABLE tenants ADD COLUMN active INTEGER DEFAULT 1"); } catch {}
try { db.exec("ALTER TABLE tenants ADD COLUMN suspension_reason TEXT"); } catch {}
try { db.exec("ALTER TABLE training_completions ADD COLUMN passed INTEGER DEFAULT 1"); } catch {}
try { db.exec("ALTER TABLE incidents ADD COLUMN department TEXT"); } catch {}
try { db.exec("ALTER TABLE incidents ADD COLUMN osha_classification TEXT"); } catch {}
// GPS coordinates auto-captured at report time (complements site + location text).
try { db.exec("ALTER TABLE incidents ADD COLUMN latitude REAL"); } catch {}
try { db.exec("ALTER TABLE incidents ADD COLUMN longitude REAL"); } catch {}
// Notification rules: move from discrete event strings to a category × severity
// matrix. category = injury|hazard|near_miss|property|security|engagement|any;
// min_severity = the lowest severity that triggers (any|significant|serious|critical).
// Backfill existing rules from their legacy `event` value so nothing is lost.
try { db.exec("ALTER TABLE notification_rules ADD COLUMN category TEXT DEFAULT 'any'"); } catch {}
try { db.exec("ALTER TABLE notification_rules ADD COLUMN min_severity TEXT DEFAULT 'any'"); } catch {}
try {
  const legacy = db.prepare("SELECT id, event, category FROM notification_rules").all();
  const setCat = db.prepare("UPDATE notification_rules SET category = ?, min_severity = ? WHERE id = ?");
  for (const r of legacy) {
    if (r.category && r.category !== "any") continue; // already migrated
    if (r.event === "incident_injury")        setCat.run("injury", "any", r.id);
    else if (r.event === "incident_critical") setCat.run("any", "serious", r.id);
    else if (r.event === "engagement_any")    setCat.run("engagement", "any", r.id);
    else if (r.event === "incident_any")      setCat.run("any", "any", r.id);
  }
} catch {}
// Idempotency for the offline queue: the client mints a UUID per report, so a
// retry after a flaky reconnect returns the existing incident instead of filing
// a duplicate. Unique per tenant; NULLs are allowed and don't collide in SQLite.
try { db.exec("ALTER TABLE incidents ADD COLUMN client_uuid TEXT"); } catch {}

// ── Corrective-action workflow ────────────────────────────────────────────────
// The CA table shipped with assignee_id/due_date/status/priority but no way to
// evolve a CA over its life. These columns + an activity log add the workflow:
// reassignment, notes, and a "capex_blocked" state that keeps a CA open (it is
// NOT done) without counting it as overdue — a budget-blocked fix can legitimately
// sit for a year awaiting approval and shouldn't read as a lingering failure.
try { db.exec("ALTER TABLE corrective_actions ADD COLUMN notes TEXT"); } catch {}
try { db.exec("ALTER TABLE corrective_actions ADD COLUMN blocked_reason TEXT"); } catch {}
try { db.exec("ALTER TABLE corrective_actions ADD COLUMN closed_at TEXT"); } catch {}
// Group assignment: a CA (or task) can go to a whole department instead of one
// person — e.g. "all of Bottling" for a tripping hazard, or "R&M at Moriah" for
// equipment. Everyone in the group sees it and is notified; any one of them can
// action or close it. assignee_dept_id + optional assignee_site_id define the
// group; when set, assignee_id (the individual) is typically null.
try { db.exec("ALTER TABLE corrective_actions ADD COLUMN assignee_dept_id INTEGER REFERENCES departments(id)"); } catch {}
try { db.exec("ALTER TABLE corrective_actions ADD COLUMN assignee_site_id INTEGER REFERENCES sites(id)"); } catch {}

// ── Recognition & points (safety engagement gamification) ─────────────────────
// Deliberately designed around what the research says actually works — and avoids
// the ways safety gamification backfires:
//   * We reward LEADING indicators only (reporting a hazard, giving a peer kudos,
//     submitting an idea, completing training) — NEVER lagging ones like "days
//     without injury", which literally pay people to hide injuries.
//   * Points on a report are awarded when safety REVIEWS/accepts it (status set on
//     the ledger row), not on raw submission — this blunts spam/gaming.
//   * Peer kudos name a recipient, so BOTH the reporter and the recognised person
//     earn — the social proof is the point.
// The ledger is append-only; balances and leaderboards are computed from it.
db.exec(`CREATE TABLE IF NOT EXISTS points_ledger (
  id INTEGER PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  user_id INTEGER NOT NULL REFERENCES users(id),      -- who earns the points
  points INTEGER NOT NULL,
  reason TEXT NOT NULL,          -- report_reviewed | kudos_given | kudos_received | idea | training | manual
  source_type TEXT,              -- incident | training | manual
  source_id INTEGER,             -- id of the originating record, when applicable
  awarded_by INTEGER REFERENCES users(id),            -- null for automatic awards
  period TEXT NOT NULL,          -- 'YYYY-MM' bucket for monthly contests/resets
  status TEXT NOT NULL DEFAULT 'confirmed', -- confirmed | pending (report awaits review)
  note TEXT,
  created_at TEXT DEFAULT (datetime('now'))
)`);
try { db.exec("CREATE INDEX IF NOT EXISTS idx_points_user ON points_ledger(tenant_id, user_id, period)"); } catch {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_points_source ON points_ledger(tenant_id, source_type, source_id)"); } catch {}

// A "positive" report can name the person being recognised (the kudos recipient).
try { db.exec("ALTER TABLE incidents ADD COLUMN recognized_user_id INTEGER REFERENCES users(id)"); } catch {}
// Per-tenant toggle for the whole recognition feature (off by default until set up).
try { db.exec("ALTER TABLE tenants ADD COLUMN recognition_enabled INTEGER DEFAULT 1"); } catch {}
// Per-enabled-module billing: JSON map { moduleKey: monthlyPrice }.
try { db.exec("ALTER TABLE billing_config ADD COLUMN module_prices TEXT"); } catch {}
// Per-tenant point values (JSON) — admins can tune what each action is worth.
try { db.exec("ALTER TABLE tenants ADD COLUMN point_values TEXT"); } catch {}
// Custom triage decision-tree questions (JSON array of {id,text}); null → use defaults.
try { db.exec("ALTER TABLE tenants ADD COLUMN triage_questions TEXT"); } catch {}
// Optional asset photo (JSON ref {id,name}); image bytes live on disk in photo_files.
try { db.exec("ALTER TABLE assets ADD COLUMN photo TEXT"); } catch {}

// Per-tenant module enablement. A row = an explicit on/off for that tenant;
// absence = "use the module's default". Lets the operator sell modules piecemeal
// (incidents-only rollout, upsell corrective_actions later). The module gate reads
// this; when a tenant has everything on, the gate is a no-op.
db.exec(`CREATE TABLE IF NOT EXISTS tenant_modules (
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  module TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (tenant_id, module)
)`);
// status now also allows 'capex_blocked' alongside open|in_progress|done|verified.

db.exec(`CREATE TABLE IF NOT EXISTS ca_activity (
  id INTEGER PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  ca_id INTEGER NOT NULL REFERENCES corrective_actions(id),
  actor_id INTEGER REFERENCES users(id),
  kind TEXT NOT NULL,               -- note | status | assign | due | created | capex
  detail TEXT,                      -- human-readable summary of what changed
  created_at TEXT DEFAULT (datetime('now'))
)`);
try { db.exec("CREATE INDEX IF NOT EXISTS idx_ca_activity ON ca_activity(tenant_id, ca_id, created_at)"); } catch {}

// ── Photo storage ────────────────────────────────────────────────────────────
// Photos used to be stored as base64 INSIDE the incidents/findings rows. A single
// photo-heavy incident is ~4 MB, so the DB — and the whole-file nightly backup that
// gets uploaded to immutable 365-day B2 retention — grew without bound, and every
// query dragged the blobs around. Bytes now live on disk; the DB keeps only refs.
db.exec(`CREATE TABLE IF NOT EXISTS photo_files (
  id TEXT PRIMARY KEY,                       -- uuid, also the filename
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  owner_type TEXT NOT NULL,                  -- 'incident' | 'finding'
  owner_id INTEGER,                          -- set once the parent row exists
  mime TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  name TEXT,
  gps INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
)`);
try { db.exec("CREATE INDEX IF NOT EXISTS idx_photo_owner ON photo_files(tenant_id, owner_type, owner_id)"); } catch {}
try {
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_incidents_client_uuid ON incidents(tenant_id, client_uuid) WHERE client_uuid IS NOT NULL");
} catch (e) {
  console.error("WARN: could not create unique index on incidents(client_uuid) —", e.message);
}

// Reference numbers must be unique per tenant. These indexes turn a concurrent
// double-submit into a catchable UNIQUE error (which refInsert() retries) rather
// than two records silently sharing a ref. Wrapped in try/catch: if a database
// somehow already contains a duplicate, the index creation fails harmlessly and
// the app still starts — we log it instead of refusing to boot on live data.
try {
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_incidents_tenant_ref ON incidents(tenant_id, ref)");
} catch (e) {
  console.error("WARN: could not create unique index on incidents(tenant_id, ref) —",
                "existing duplicate refs? Refs will still be generated, but uniqueness is not enforced.", e.message);
}
try {
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_triage_tenant_ref ON triage_records(tenant_id, ref)");
} catch (e) {
  console.error("WARN: could not create unique index on triage_records(tenant_id, ref) —", e.message);
}
try { db.exec("ALTER TABLE incidents ADD COLUMN response_progress TEXT DEFAULT '[]'"); } catch {}
try { db.exec("ALTER TABLE sites ADD COLUMN floorplan TEXT"); } catch {}
try { db.exec("ALTER TABLE incidents ADD COLUMN floor_pos TEXT"); } catch {}
try { db.exec("ALTER TABLE tenants ADD COLUMN active INTEGER DEFAULT 1"); } catch {}
db.exec(`CREATE TABLE IF NOT EXISTS response_checklists (
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  incident_type TEXT NOT NULL,
  items TEXT NOT NULL,
  PRIMARY KEY (tenant_id, incident_type)
)`);

db.exec(`CREATE TABLE IF NOT EXISTS labor_hours (
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  site_id INTEGER NOT NULL REFERENCES sites(id),
  month TEXT NOT NULL,              -- 'YYYY-MM'
  hours REAL NOT NULL,
  updated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (tenant_id, site_id, month)
)`);

// Backfill: give the "Ethanol & Flammable Liquids Safety" CBT real content if it
// exists without any (e.g. on a DB seeded before the sample course was added), so
// the self-serve training flow is testable on existing installs. Idempotent — only
// fills when content is null/empty.
try {
  const sample = JSON.stringify({
    passThreshold: 100,
    slides: [
      { heading: "Why ethanol demands respect",
        body: "Ethanol vapor is heavier than air, spreads along the floor, and ignites from a spark, static, or hot surface — often with a nearly invisible flame. Keep ignition sources away from any area where you can smell it." },
      { heading: "Your part in preventing a fire",
        body: "Bond and ground containers when transferring. Clean spills immediately. Never use a phone or non-rated equipment in a classified area. If you smell a strong ethanol odor where you shouldn't, stop work and tell your supervisor." },
    ],
    questions: [
      { q: "Should you keep sparks, flames, and hot surfaces away from areas where ethanol vapor may be present?",
        choices: ["Yes", "No"], correctIndex: 0,
        explanation: "Ethanol vapor ignites easily — ignition sources must be kept away." },
      { q: "If you notice a strong ethanol smell where there shouldn't be one, should you stop and report it?",
        choices: ["Yes", "No"], correctIndex: 0,
        explanation: "An unexpected strong odor can mean a leak or spill — stop work and report it." },
    ],
  });
  db.prepare(`UPDATE trainings SET content = ?, kind = 'cbt'
              WHERE title = 'Ethanol & Flammable Liquids Safety'
                AND (content IS NULL OR content = '')`).run(sample);
} catch (e) { /* backfill is best-effort */ }

// ── Seed: WhistlePig as tenant 1 ─────────────────────────────────────────────
function seed() {
  const t = db.prepare("SELECT id FROM tenants WHERE id = 1").get();
  if (t) return; // already seeded

  const seedTx = db.transaction(() => {
    db.prepare(`INSERT INTO tenants (id, name, short_name, industry, tagline, triage_enabled, triage_provider_name, triage_provider_phone)
                VALUES (1, 'WhistlePig Whiskey', 'WhistlePig', 'Spirits / Distilling',
                        'Safety & Operations Management', 1, 'Concentra', '(800) 555-0147')`).run();

    const siteStmt = db.prepare("INSERT INTO sites (tenant_id, name, location) VALUES (1, ?, ?)");
    siteStmt.run("Moriah", "Moriah, NY");
    siteStmt.run("Middlebury", "Middlebury, VT");
    siteStmt.run("Shoreham", "Shoreham, VT");
    siteStmt.run("Brandenburg", "Brandenburg, KY");

    const deptStmt = db.prepare("INSERT INTO departments (tenant_id, name) VALUES (1, ?)");
    ["Distillation", "Bottling & Packaging", "Warehouse & Barrel Ops",
     "Maintenance", "Quality", "Shipping & Receiving"].forEach(d => deptStmt.run(d));

    // Initial admin — password must be changed on first real use
    const usingDefaultAdminPw = !process.env.EHS_ADMIN_PASSWORD;
    const hash = bcrypt.hashSync(process.env.EHS_ADMIN_PASSWORD || "ChangeMe!2026", 10);
    db.prepare(`INSERT INTO users (tenant_id, email, password_hash, name, role, site_id, must_change_password)
                VALUES (1, 'ahren@whistlepig.com', ?, 'Ahren', 'admin', 1, ?)`).run(hash, usingDefaultAdminPw ? 1 : 0);

    // Starter training catalog — standard distillery/manufacturing EHS set.
    // All editable/deactivatable through the training library.
    const trStmt = db.prepare(`INSERT INTO trainings (tenant_id, title, kind, content, frequency_months, required_roles, required_departments)
                               VALUES (1, ?, ?, ?, ?, '[]', '[]')`);
    // A ready-to-take sample CBT so the self-serve flow can be tested end to end:
    // two short content slides, then two yes/no questions. Correct answer to both
    // is "Yes" (index 0); passThreshold 100 means BOTH must be Yes to pass — any
    // other combination fails.
    const ethanolContent = JSON.stringify({
      passThreshold: 100,
      slides: [
        { heading: "Why ethanol demands respect",
          body: "Ethanol vapor is heavier than air, spreads along the floor, and ignites from a spark, static, or hot surface — often with a nearly invisible flame. Keep ignition sources away from any area where you can smell it." },
        { heading: "Your part in preventing a fire",
          body: "Bond and ground containers when transferring. Clean spills immediately. Never use a phone or non-rated equipment in a classified area. If you smell a strong ethanol odor where you shouldn't, stop work and tell your supervisor." },
      ],
      questions: [
        { q: "Should you keep sparks, flames, and hot surfaces away from areas where ethanol vapor may be present?",
          choices: ["Yes", "No"], correctIndex: 0,
          explanation: "Ethanol vapor ignites easily — ignition sources must be kept away." },
        { q: "If you notice a strong ethanol smell where there shouldn't be one, should you stop and report it?",
          choices: ["Yes", "No"], correctIndex: 0,
          explanation: "An unexpected strong odor can mean a leak or spill — stop work and report it." },
      ],
    });
    [
      ["New Hire Safety Orientation",        "in_person", null, null],
      ["Hazard Communication (HazCom/GHS)",  "cbt",       12,   null],
      ["Lockout/Tagout (LOTO) Awareness",    "cbt",       12,   null],
      ["Forklift / PIT Operator",            "in_person", 36,   null],
      ["PPE Selection & Use",                "cbt",       12,   null],
      ["Emergency Action Plan & Evacuation", "cbt",       12,   null],
      ["Fire Extinguisher Use",              "in_person", 12,   null],
      ["Confined Space Awareness",           "cbt",       12,   null],
      ["Hot Work Awareness",                 "cbt",       12,   null],
      ["Ethanol & Flammable Liquids Safety", "cbt",       12,   ethanolContent],
    ].forEach(([title, kind, freq, content]) => trStmt.run(title, kind, content, freq));
    // Starter inspection checklists — editable in the builder; per-site schedules
    const clStmt = db.prepare(`INSERT INTO checklists (tenant_id, name, items, kind, frequency_days)
                               VALUES (1, ?, ?, ?, ?)`);
    const items = arr => JSON.stringify(arr.map((label, i) => ({ id: `i${i + 1}`, label })));
    clStmt.run("Forklift / PIT Pre-Use", items([
      "Tires & wheels in good condition", "Forks not bent or cracked", "Hydraulics — no leaks",
      "Horn and lights working", "Brakes and steering responsive", "Seatbelt functional",
      "Battery/fuel level adequate", "Data plate legible",
    ]), "checklist", null);
    clStmt.run("Fire Extinguisher Inspection", items([
      "Extinguisher in designated location", "Access unobstructed", "Pressure gauge in green",
      "Pin and tamper seal intact", "Hose/nozzle free of damage", "Inspection tag current",
    ]), "checklist", 60);
    clStmt.run("Eyewash Station Check", items([
      "Station accessible and marked", "Flushing fluid flows from both heads", "Caps in place",
      "Water clear (no discoloration)", "Activation within 1 second", "Inspection tag updated",
    ]), "checklist", 180);
    clStmt.run("AED Readiness Check", items([
      "Status indicator shows ready", "Battery within expiry", "Pads sealed and within expiry",
      "Case and signage intact", "Rescue kit present",
    ]), "checklist", 30);
    clStmt.run("Gemba Walk", items([
      "Housekeeping / 5S condition", "PPE compliance observed", "Blocked exits or egress issues",
      "Equipment guarding in place", "Spill or leak evidence", "Staff safety feedback collected",
    ]), "gemba", null);

    db.prepare(`INSERT INTO billing_config (tenant_id, base_price, per_site, per_user, auto_approve, billing_contact)
                VALUES (1, 250, 75, 8, 0, 'ap@whistlepigrye.com')`).run();
  });
  seedTx();
  console.log("Seeded tenant: WhistlePig Whiskey (4 sites, 6 departments, 1 admin)");
}
seed();

// ── Backfill: add later-added defaults to databases created before they existed ─
function ensureDefaults() {
  const t1 = db.prepare("SELECT id FROM tenants WHERE id = 1").get();
  if (!t1) return;

  if (!db.prepare("SELECT tenant_id FROM billing_config WHERE tenant_id = 1").get()) {
    db.prepare(`INSERT INTO billing_config (tenant_id, base_price, per_site, per_user, auto_approve, billing_contact)
                VALUES (1, 250, 75, 8, 0, 'ap@whistlepigrye.com')`).run();
    console.log("Backfilled: billing_config defaults");
  }

  if (db.prepare("SELECT COUNT(*) n FROM checklists WHERE tenant_id = 1").get().n === 0) {
    const clStmt = db.prepare(`INSERT INTO checklists (tenant_id, name, items, kind, frequency_days)
                               VALUES (1, ?, ?, ?, ?)`);
    const items = arr => JSON.stringify(arr.map((label, i) => ({ id: `i${i + 1}`, label })));
    clStmt.run("Forklift / PIT Pre-Use", items([
      "Tires & wheels in good condition", "Forks not bent or cracked", "Hydraulics — no leaks",
      "Horn and lights working", "Brakes and steering responsive", "Seatbelt functional",
      "Battery/fuel level adequate", "Data plate legible"]), "checklist", null);
    clStmt.run("Fire Extinguisher Inspection", items([
      "Extinguisher in designated location", "Access unobstructed", "Pressure gauge in green",
      "Pin and tamper seal intact", "Hose/nozzle free of damage", "Inspection tag current"]), "checklist", 60);
    clStmt.run("Eyewash Station Check", items([
      "Station accessible and marked", "Flushing fluid flows from both heads", "Caps in place",
      "Water clear (no discoloration)", "Activation within 1 second", "Inspection tag updated"]), "checklist", 180);
    clStmt.run("AED Readiness Check", items([
      "Status indicator shows ready", "Battery within expiry", "Pads sealed and within expiry",
      "Case and signage intact", "Rescue kit present"]), "checklist", 30);
    clStmt.run("Gemba Walk", items([
      "Housekeeping / 5S condition", "PPE compliance observed", "Blocked exits or egress issues",
      "Equipment guarding in place", "Spill or leak evidence", "Staff safety feedback collected"]), "gemba", null);
    console.log("Backfilled: starter checklist catalog");
  }

  if (!db.prepare("SELECT id FROM users WHERE email = 'ahrenwolson@gmail.com'").get()) {
    const bcrypt2 = require("bcryptjs");
    db.prepare(`INSERT INTO users (tenant_id, email, password_hash, name, role, is_operator, must_change_password)
                VALUES (1, 'ahrenwolson@gmail.com', ?, 'EHS DNA Admin', 'admin', 1, ?)`)
      .run(bcrypt2.hashSync(process.env.EHS_OPERATOR_PASSWORD || "ChangeMe!2026", 10),
           process.env.EHS_OPERATOR_PASSWORD ? 0 : 1);
    console.log("Backfilled: operator account ahrenwolson@gmail.com");
  }

  if (db.prepare("SELECT COUNT(*) n FROM response_checklists WHERE tenant_id = 1").get().n === 0) {
    const rc = db.prepare("INSERT INTO response_checklists (tenant_id, incident_type, items) VALUES (1, ?, ?)");
    rc.run("injury", JSON.stringify(["Complete first aid log", "Notify shift supervisor",
      "Preserve scene — don't move anything until photos are done", "Secure the area if hazard still present",
      "Check in with the injured person within 24 hours"]));
    rc.run("near_miss", JSON.stringify(["Notify shift supervisor", "Secure the area if hazard still present",
      "Identify what prevented harm", "Share learning at next toolbox talk"]));
    rc.run("property", JSON.stringify(["Notify shift supervisor", "Isolate damaged equipment / tag out",
      "Photograph damage before cleanup", "Assess production impact"]));
    rc.run("security", JSON.stringify(["Notify site manager immediately", "Preserve any camera footage",
      "Do not confront individuals — document only", "Contact authorities if warranted"]));
    console.log("Backfilled: response checklists");
  }

  const hasRulesTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='notification_rules'").get();
  if (hasRulesTable && db.prepare("SELECT COUNT(*) n FROM notification_rules WHERE tenant_id = 1").get().n === 0) {
    db.prepare(`INSERT INTO notification_rules (tenant_id, event, category, min_severity, recipient_roles, email)
                VALUES (1, 'incident_injury', 'injury', 'any', '["admin","safety"]', 1)`).run();
    console.log("Backfilled: default injury notification rule");
  }

  // Enable the Equipment & Assets module for WhistlePig (tenant 1) — it defaults
  // off (opt-in), but the pilot gets it on. Idempotent.
  const hasModTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tenant_modules'").get();
  if (hasModTable && !db.prepare("SELECT 1 FROM tenant_modules WHERE tenant_id = 1 AND module = 'equipment'").get()) {
    db.prepare("INSERT INTO tenant_modules (tenant_id, module, enabled) VALUES (1, 'equipment', 1)").run();
    console.log("Backfilled: enabled equipment module for tenant 1");
  }

  // Seed a couple of sample assets (with a LOTO procedure + SOP) so the module is
  // demoable out of the box. Only if the tenant has no assets yet.
  const hasAssetTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='assets'").get();
  if (hasAssetTable && db.prepare("SELECT COUNT(*) n FROM assets WHERE tenant_id = 1").get().n === 0) {
    const moriah = db.prepare("SELECT id FROM sites WHERE tenant_id = 1 ORDER BY id LIMIT 1").get()?.id ?? null;
    const insAsset = db.prepare(`INSERT INTO assets (tenant_id, name, asset_tag, category, site_id, location, manufacturer, model, status)
                                 VALUES (1, ?, ?, ?, ?, ?, ?, ?, 'in_service')`);
    const a1 = insAsset.run("Bottling Line Transfer Pump", "PMP-014", "pump", moriah, "Bottling Hall — Line 2", "Grundfos", "CR 15-3").lastInsertRowid;
    insAsset.run("Warehouse Forklift #3", "FLT-03", "forklift", moriah, "Warehouse — Bay D", "Toyota", "8FGCU25");
    const insProc = db.prepare(`INSERT INTO asset_procedures (tenant_id, asset_id, kind, title, steps, body) VALUES (1, ?, ?, ?, ?, ?)`);
    insProc.run(a1, "loto", "Transfer Pump LOTO", JSON.stringify([
      "Notify affected operators that the pump is being locked out.",
      "Stop the pump at the local control and switch the disconnect to OFF.",
      "Apply your personal lock and tag to the disconnect.",
      "Bleed line pressure at the downstream drain valve.",
      "Verify zero energy: attempt a restart at the control (it must not start).",
    ]), null);
    insProc.run(a1, "sop", "Daily Pump Start-Up Check", JSON.stringify([]),
      "Before starting: confirm suction and discharge valves are open, check seal reservoir level, and verify no visible leaks at the mechanical seal. Log the start time and any abnormal noise or vibration in the shift sheet.");
    console.log("Backfilled: sample equipment assets for tenant 1");
  }
}
ensureDefaults();

module.exports = db;
