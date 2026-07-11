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
try { db.exec("ALTER TABLE tenants ADD COLUMN active INTEGER DEFAULT 1"); } catch {}
try { db.exec("ALTER TABLE tenants ADD COLUMN suspension_reason TEXT"); } catch {}
try { db.exec("ALTER TABLE training_completions ADD COLUMN passed INTEGER DEFAULT 1"); } catch {}
try { db.exec("ALTER TABLE incidents ADD COLUMN department TEXT"); } catch {}
try { db.exec("ALTER TABLE incidents ADD COLUMN osha_classification TEXT"); } catch {}
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
    const hash = bcrypt.hashSync(process.env.EHS_ADMIN_PASSWORD || "ChangeMe!2026", 10);
    db.prepare(`INSERT INTO users (tenant_id, email, password_hash, name, role, site_id)
                VALUES (1, 'ahren@whistlepig.com', ?, 'Ahren', 'admin', 1)`).run(hash);

    // Starter training catalog — standard distillery/manufacturing EHS set.
    // All editable/deactivatable through the training library.
    const trStmt = db.prepare(`INSERT INTO trainings (tenant_id, title, kind, frequency_months, required_roles, required_departments)
                               VALUES (1, ?, ?, ?, '[]', '[]')`);
    [
      ["New Hire Safety Orientation",        "in_person", null],
      ["Hazard Communication (HazCom/GHS)",  "cbt",       12],
      ["Lockout/Tagout (LOTO) Awareness",    "cbt",       12],
      ["Forklift / PIT Operator",            "in_person", 36],
      ["PPE Selection & Use",                "cbt",       12],
      ["Emergency Action Plan & Evacuation", "cbt",       12],
      ["Fire Extinguisher Use",              "in_person", 12],
      ["Confined Space Awareness",           "cbt",       12],
      ["Hot Work Awareness",                 "cbt",       12],
      ["Ethanol & Flammable Liquids Safety", "cbt",       12],
    ].forEach(([title, kind, freq]) => trStmt.run(title, kind, freq));
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
    db.prepare(`INSERT INTO users (tenant_id, email, password_hash, name, role, is_operator)
                VALUES (1, 'ahrenwolson@gmail.com', ?, 'EHS DNA Admin', 'admin', 1)`)
      .run(bcrypt2.hashSync(process.env.EHS_OPERATOR_PASSWORD || "ChangeMe!2026", 10));
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
    db.prepare(`INSERT INTO notification_rules (tenant_id, event, recipient_roles, email)
                VALUES (1, 'incident_injury', '["admin","safety"]', 1)`).run();
    console.log("Backfilled: default injury notification rule");
  }
}
ensureDefaults();

module.exports = db;
