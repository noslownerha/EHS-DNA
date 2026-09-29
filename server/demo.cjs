/**
 * Demo tenant for pitching — "Northfield Components", a fictional mid-size
 * metal fabrication & assembly manufacturer with three sites and a year of
 * realistic history. Reset from the operator console.
 *
 * Safety rails:
 *  - The demo tenant is flagged tenants.is_demo = 1. resetDemo() refuses to
 *    touch any tenant without that flag, so a bug can never wipe a customer.
 *  - Demo tenants are excluded from operator revenue/attention/analytics.
 *  - Generation is deterministic (seeded PRNG) and dated relative to "now",
 *    so every reset looks the same and never looks stale.
 */
const bcrypt = require("bcryptjs");

const DEMO_NAME = "Northfield Components (Demo)";
const DEMO_ADMIN = { email: "demo@ehsdna.com", name: "Dana Whitfield" };
const DEMO_WORKER = { email: "demo-worker@ehsdna.com", name: "Luis Ortega" };
const demoPassword = () => process.env.EHS_DEMO_PASSWORD || "DemoTour!2026";

// Deterministic PRNG (mulberry32) so every reset produces the same story.
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SITES = [
  { name: "Dayton Plant",             location: "Dayton, OH",     hours: 28000 },
  { name: "Greenville Plant",         location: "Greenville, SC", hours: 21000 },
  { name: "Reno Distribution Center", location: "Reno, NV",       hours: 9500  },
];
const DEPTS = ["Fabrication", "Welding", "Assembly", "Paint & Finishing", "Shipping & Receiving", "Maintenance", "Quality"];

// [name, role, siteIdx, dept]
const PEOPLE = [
  [DEMO_ADMIN.name, "admin", 0, null],
  ["Marcus Bell", "safety", 0, null],
  ["Priya Raman", "site_manager", 0, "Fabrication"],
  ["Tom Kowalski", "site_manager", 1, "Assembly"],
  ["Renee Castillo", "site_manager", 2, "Shipping & Receiving"],
  ["Jordan Hayes", "trainer", 0, "Quality"],
  [DEMO_WORKER.name, "staff", 0, "Welding"],
  ["Aisha Grant", "staff", 0, "Fabrication"], ["Ben Carter", "staff", 0, "Fabrication"],
  ["Chloe Nguyen", "staff", 0, "Paint & Finishing"], ["Derek Owens", "staff", 0, "Maintenance"],
  ["Elena Petrova", "staff", 0, "Welding"], ["Frank Morales", "staff", 1, "Assembly"],
  ["Grace Liu", "staff", 1, "Assembly"], ["Hector Diaz", "staff", 1, "Maintenance"],
  ["Imani Brooks", "staff", 1, "Quality"], ["Jake Sullivan", "staff", 1, "Paint & Finishing"],
  ["Kara Jensen", "staff", 2, "Shipping & Receiving"], ["Leo Martins", "staff", 2, "Shipping & Receiving"],
  ["Maya Patel", "staff", 2, "Shipping & Receiving"], ["Nate Fischer", "staff", 2, "Maintenance"],
];

const CBT_CONTENT = {
  "Machine Guarding & Amputation Hazards": {
    passThreshold: 80,
    slides: [
      { heading: "Why guarding matters", body: "Moving machine parts cause thousands of amputations every year. Guards keep hands, hair and clothing out of the point of operation." },
      { heading: "Never bypass a guard", body: "If a guard is missing, damaged or stops you working, stop the machine and report it. Removing or defeating a guard is never acceptable." },
      { heading: "Before you clear a jam", body: "Stop, isolate and lock out the machine. Clearing jams with the machine energized is the #1 cause of amputations." },
    ],
    questions: [
      { q: "A guard slows you down. What do you do?", choices: ["Remove it carefully", "Stop and report it", "Work around it"], correctIndex: 1 },
      { q: "Before clearing a jam you must:", choices: ["Lock out the machine", "Slow the machine down", "Use a tool instead of your hand"], correctIndex: 0 },
    ],
  },
  "Lockout / Tagout Basics": {
    passThreshold: 100,
    slides: [
      { heading: "What LOTO protects against", body: "Unexpected startup or release of stored energy — electrical, hydraulic, pneumatic, gravity, thermal." },
      { heading: "The six steps", body: "Notify → shut down → isolate → lock & tag → release stored energy → verify zero energy (try to start it)." },
      { heading: "Your lock, your key", body: "Only the person who applied a lock removes it. Every worker in the danger zone applies their own lock." },
    ],
    questions: [
      { q: "The last step before starting work is:", choices: ["Apply your tag", "Verify zero energy", "Tell your supervisor"], correctIndex: 1 },
      { q: "Who may remove your lock?", choices: ["Your supervisor", "Only you", "Maintenance"], correctIndex: 1 },
    ],
  },
  "Hazard Communication (HazCom / GHS)": {
    passThreshold: 80,
    slides: [
      { heading: "Know what you're handling", body: "Every chemical container must be labeled, and a Safety Data Sheet (SDS) must be available for it." },
      { heading: "Reading a GHS label", body: "Signal word, pictograms, hazard statements and precautionary statements tell you the risk and how to protect yourself." },
    ],
    questions: [
      { q: "Where do you find full handling and first-aid information?", choices: ["The SDS", "The purchase order", "The container lid"], correctIndex: 0 },
    ],
  },
  "PPE Selection & Use": {
    passThreshold: 80,
    slides: [
      { heading: "PPE is the last line of defense", body: "Engineering controls come first; PPE protects you when a hazard can't be removed." },
      { heading: "Inspect before use", body: "Check gloves, glasses and respirators for damage before every shift. Damaged PPE is replaced, not worn." },
    ],
    questions: [
      { q: "Your safety glasses are cracked. You should:", choices: ["Tape them", "Replace them before working", "Finish the shift first"], correctIndex: 1 },
    ],
  },
};

const INCIDENTS = [
  // [daysAgo, type, severity, siteIdx, dept, description, osha, status]
  [350, "injury", "significant", 0, "Fabrication", "Operator's glove caught on press brake back-gauge; laceration to right index finger requiring sutures.", "Recordable – Medical treatment", "closed"],
  [320, "hazard", "minor", 1, "Assembly", "Air hose left across walkway between cells 3 and 4 — trip hazard.", null, "closed"],
  [301, "injury", "minor", 2, "Shipping & Receiving", "Pinched finger closing trailer door; ice and bandage on site.", "First aid only (non-recordable)", "closed"],
  [288, "property", "significant", 2, "Shipping & Receiving", "Forklift mast struck dock door header; door track bent.", null, "closed"],
  [270, "injury", "serious", 0, "Maintenance", "Technician strained lower back lifting gearbox without hoist; placed on restricted duty 5 days.", "Recordable – Restricted work", "closed"],
  [244, "positive", "minor", 1, "Quality", "Imani caught a mislabeled chemical drum before it reached the paint line.", null, "closed"],
  [231, "hazard", "significant", 0, "Welding", "Welding screen torn at booth 2; arc flash exposure to adjacent aisle.", null, "closed"],
  [205, "idea", "minor", 1, "Assembly", "Add color-coded floor tape for forklift-only lanes in Assembly.", null, "closed"],
  [190, "injury", "significant", 1, "Paint & Finishing", "Solvent splash to eye while changing paint line filters; flushed, clinic visit, prescription drops.", "Recordable – Medical treatment", "closed"],
  [172, "hazard", "minor", 2, "Shipping & Receiving", "Dock plate lip damaged at door 6.", null, "closed"],
  [150, "injury", "minor", 0, "Assembly", "Minor burn from hot part coming off the oven; first aid.", "First aid only (non-recordable)", "closed"],
  [131, "property", "minor", 0, "Maintenance", "Compressor #2 relief valve lifting repeatedly.", null, "closed"],
  [118, "positive", "minor", 0, "Welding", "Elena stopped a hot-work job when the fire watch stepped away.", null, "closed"],
  [96,  "injury", "serious", 2, "Shipping & Receiving", "Pallet fell from racking during put-away; worker's foot fractured. Days away from work.", "Recordable – Days away from work", "closed"],
  [81,  "hazard", "significant", 1, "Maintenance", "Mezzanine guardrail section loose near the stairs.", null, "open"],
  [64,  "idea", "minor", 2, "Shipping & Receiving", "Install convex mirrors at the blind corner by door 3.", null, "open"],
  [45,  "injury", "significant", 0, "Fabrication", "Sheet-metal edge cut through glove; stitches required.", "Recordable – Medical treatment", "open"],
  [30,  "hazard", "minor", 0, "Paint & Finishing", "Spill kit at paint booth missing absorbent pads.", null, "open"],
  [21,  "property", "significant", 1, "Assembly", "Robot cell light curtain intermittently faulting.", null, "open"],
  [12,  "injury", "minor", 1, "Assembly", "Worker bumped head on low conveyor crossover; no treatment needed.", "Review: likely recordable", "open"],
  [6,   "positive", "minor", 2, "Shipping & Receiving", "Kara organized a pre-shift stretch-and-flex that the whole crew now runs.", null, "open"],
  [2,   "hazard", "significant", 0, "Welding", "Cylinder cart chain missing — two oxygen cylinders unsecured.", null, "open"],
];

const ASSETS = [
  // [name, tag, category, siteIdx, location, manufacturer, model, checklistName|null]
  ["Press Brake #1", "PB-101", "press", 0, "Fabrication — Bay A", "Amada", "HG-1303", "General Shop Pre-Shift"],
  ["Laser Cutter", "LC-201", "machine", 0, "Fabrication — Bay B", "Trumpf", "TruLaser 3030", "General Shop Pre-Shift"],
  ["Robotic Weld Cell 2", "RW-302", "robot", 0, "Welding — Cell 2", "FANUC", "ARC Mate 100iD", null],
  ["Paint Line Oven", "OV-401", "oven", 1, "Paint & Finishing", "Wisconsin Oven", "Batch 8x10", null],
  ["Air Compressor #2", "CP-502", "compressor", 0, "Maintenance — Compressor Room", "Atlas Copco", "GA 37", null],
  ["Forklift 07", "FL-007", "forklift", 2, "Reno — Dock Area", "Toyota", "8FGCU25", "Forklift / PIT Pre-Use"],
  ["Forklift 11", "FL-011", "forklift", 1, "Greenville — Warehouse", "Crown", "RC 5500", "Forklift / PIT Pre-Use"],
  ["Overhead Crane 5T", "CR-005", "crane", 1, "Assembly — High Bay", "Demag", "EKDR 5", null],
];
const LOTO = {
  "PB-101": ["Notify operators in Bay A", "Stop the ram at bottom dead center", "Open main disconnect DS-14 and apply lock", "Bleed hydraulic pressure at valve HV-2", "Place ram blocks", "Verify zero energy: attempt start from both palm buttons"],
  "RW-302": ["Place robot in teach mode and stop program", "Open cell disconnect and apply lock", "Close shielding-gas valve and tag", "Verify zero energy at teach pendant"],
  "CP-502": ["Stop compressor from local panel", "Open breaker CB-7 and apply lock", "Close outlet isolation valve", "Bleed receiver tank to 0 psi", "Verify gauge reads 0 and attempt start"],
  "CR-005": ["Lower load and park hook", "Open runway disconnect and apply lock", "Tag pendant 'DO NOT OPERATE'", "Verify: press UP on pendant, confirm no motion"],
};

function iso(daysAgo, hour = 9) {
  const d = new Date(Date.now() - daysAgo * 86400000);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString().replace("T", " ").slice(0, 19);
}
const day = daysAgo => iso(daysAgo).slice(0, 10);

function ensureDemoTenant(db) {
  try { db.exec("ALTER TABLE tenants ADD COLUMN is_demo INTEGER DEFAULT 0"); } catch {}
  let t = db.prepare("SELECT id FROM tenants WHERE is_demo = 1").get();
  if (!t) {
    const r = db.prepare(`INSERT INTO tenants (name, short_name, industry, tagline, active, is_demo)
                          VALUES (?, 'Northfield', 'General Manufacturing', 'Built safe. Built right.', 1, 1)`).run(DEMO_NAME);
    t = { id: Number(r.lastInsertRowid) };
  }
  return t.id;
}

function wipeTenant(db, tenantId) {
  const row = db.prepare("SELECT is_demo FROM tenants WHERE id = ?").get(tenantId);
  if (!row || row.is_demo !== 1) throw new Error("Refusing to wipe a tenant that is not flagged as demo");
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(r => r.name)
    .filter(n => db.prepare(`PRAGMA table_info(${n})`).all().some(c => c.name === "tenant_id"));
  const emails = db.prepare("SELECT email FROM users WHERE tenant_id = ?").all(tenantId).map(r => r.email);
  const uids = db.prepare("SELECT id FROM users WHERE tenant_id = ?").all(tenantId).map(r => r.id);
  for (const uid of uids) { try { db.prepare("DELETE FROM password_resets WHERE user_id = ?").run(uid); } catch {} }
  for (const e of emails) { try { db.prepare("DELETE FROM login_failures WHERE email = ?").run(e); } catch {} }
  // children before parents
  const order = ["ca_activity", "finding_activity", "asset_procedures", "training_completions", "points_ledger",
                 "notifications", "corrective_actions", "findings", "inspections", "photo_files"];
  for (const t of [...order, ...tables.filter(t => !order.includes(t) && t !== "users" && t !== "sites" && t !== "departments"), "users", "departments", "sites"]) {
    if (tables.includes(t)) db.prepare(`DELETE FROM ${t} WHERE tenant_id = ?`).run(tenantId);
  }
}

function seedDemo(db, tenantId) {
  const R = rng(20260929);
  const pick = arr => arr[Math.floor(R() * arr.length)];
  const T = tenantId;
  const PACKS = require("./templates.cjs").PACKS;
  const pack = PACKS.general_mfg;

  const siteIds = SITES.map(s => Number(db.prepare("INSERT INTO sites (tenant_id, name, location, active) VALUES (?,?,?,1)").run(T, s.name, s.location).lastInsertRowid));
  const deptIds = Object.fromEntries(DEPTS.map(d => [d, Number(db.prepare("INSERT INTO departments (tenant_id, name, active) VALUES (?,?,1)").run(T, d).lastInsertRowid)]));

  const pw = bcrypt.hashSync(demoPassword(), 10);
  const lockedPw = bcrypt.hashSync(Math.random().toString(36) + Date.now(), 4);   // non-login demo people
  const users = PEOPLE.map(([name, role, si, dept], i) => {
    const email = name === DEMO_ADMIN.name ? DEMO_ADMIN.email : name === DEMO_WORKER.name ? DEMO_WORKER.email
      : `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@northfield-demo.invalid`;
    const canLogin = email === DEMO_ADMIN.email || email === DEMO_WORKER.email;
    db.prepare("DELETE FROM users WHERE email = ? AND tenant_id != ?").run(email, T);   // stale demo login from an older demo tenant
    const id = Number(db.prepare(`INSERT INTO users (tenant_id, email, password_hash, name, role, site_id, department_id, active, is_operator, must_change_password, created_at)
                                  VALUES (?,?,?,?,?,?,?,1,0,0,?)`)
      .run(T, email, canLogin ? pw : lockedPw, name, role, siteIds[si], dept ? deptIds[dept] : null, iso(400 - i)).lastInsertRowid);
    return { id, name, role, email, site: siteIds[si], dept };
  });
  const admin = users[0], safety = users[1];
  const bySite = si => users.filter(u => u.site === siteIds[si]);

  // Modules: all on
  for (const m of ["incidents", "inspections", "lms", "corrective_actions", "recognition", "equipment", "reporting"]) {
    try { db.prepare("INSERT OR REPLACE INTO tenant_modules (tenant_id, module, enabled) VALUES (?,?,1)").run(T, m); } catch {}
  }

  // Checklists from the General Manufacturing pack
  const items = arr => JSON.stringify(arr.map((label, i) => ({ id: `i${i + 1}`, label })));
  const checklists = pack.checklists.map(c => ({ name: c.name, items: c.items,
    id: Number(db.prepare("INSERT INTO checklists (tenant_id, name, items, kind, frequency_days, active) VALUES (?,?,?,'checklist',?,1)")
      .run(T, c.name, items(c.items), c.freqDays ?? null).lastInsertRowid) }));
  const clByName = Object.fromEntries(checklists.map(c => [c.name, c.id]));

  // Trainings (CBTs get real content) + completions giving ~85% compliance
  const trainings = pack.trainings.map(tr => ({ ...tr,
    id: Number(db.prepare(`INSERT INTO trainings (tenant_id, title, kind, content, frequency_months, required_roles, required_departments, required_users, active, created_at)
                           VALUES (?,?,?,?,?,'[]','[]','[]',1,?)`)
      .run(T, tr.title, tr.kind, CBT_CONTENT[tr.title] ? JSON.stringify(CBT_CONTENT[tr.title]) : null, tr.freqMonths, iso(380)).lastInsertRowid) }));
  const insComp = db.prepare(`INSERT INTO training_completions (tenant_id, training_id, user_id, session_id, method, score, completed_at, expires_at, passed)
                              VALUES (?,?,?,?,?,?,?,?,1)`);
  // Exactly who is behind is scripted, not random, so every reset tells the same
  // story: ~80% of staff fully current, Reno below the 80% line.
  const BEHIND = { "Aisha Grant": [3], "Kara Jensen": [5], "Leo Martins": [2] };
  for (const u of users) {
    const isWorker = u.email === DEMO_WORKER.email;   // the worker login keeps open training to demo
    for (const [ti, tr] of trainings.entries()) {
      const roll = R();
      if (isWorker ? ti % 2 === 1 : (BEHIND[u.name] || []).includes(ti)) continue;   // never done → overdue
      const ago = roll < 0.14 ? tr.freqMonths * 30 - 12 : Math.floor(20 + R() * 200);   // some expiring soon
      const exp = new Date(Date.now() - ago * 86400000 + tr.freqMonths * 30 * 86400000).toISOString();
      insComp.run(T, tr.id, u.id, `DEMO-${tr.id}-${u.id}`, tr.kind === "cbt" ? "cbt" : "in_person", 100, iso(ago), exp);
    }
  }

  // Incidents
  let seq = 0;
  const incIds = INCIDENTS.map(([ago, type, sev, si, dept, desc, osha, status]) => {
    const reporter = pick(bySite(si));
    const involved = type === "injury" ? JSON.stringify([{ kind: "staff", id: pick(bySite(si)).id }]) : "[]";
    const ref = `INC-${iso(ago).slice(0, 4)}-${String(++seq).padStart(4, "0")}`;
    return Number(db.prepare(`INSERT INTO incidents (tenant_id, ref, type, severity, status, site_id, description, involved, photos, reported_by,
                                                     occurred_at, created_at, updated_at, department, osha_classification, root_cause)
                              VALUES (?,?,?,?,?,?,?,?, '[]', ?, ?, ?, ?, ?, ?, ?)`)
      .run(T, ref, type, sev, status, siteIds[si], desc, involved, reporter.id, iso(ago, 7 + Math.floor(R() * 9)), iso(ago), iso(Math.max(0, ago - 3)),
           dept, osha, status === "closed" && type === "injury" ? "Task performed without the control that was designed for it; pre-task check not completed." : null).lastInsertRowid);
  });

  // Corrective actions — a realistic mix of every state
  const insCA = db.prepare(`INSERT INTO corrective_actions (tenant_id, incident_id, finding_id, title, priority, status, assignee_id, due_date, verified_by,
                                                           created_at, updated_at, blocked_reason, closed_at)
                            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const CAS = [
    [0, "Install secondary guard on press brake back-gauge", "high", "verified", 340, 310],
    [4, "Add hoist and two-person lift rule for gearbox changes", "high", "verified", 260, 230],
    [6, "Replace torn welding screens; add inspection to weekly walk", "medium", "done", 225, 200],
    [8, "Add face-shield requirement to paint filter change SOP", "high", "verified", 185, 160],
    [13, "Re-train put-away crew; install rack-end load signage", "high", "done", 90, 60],
    [14, "Repair mezzanine guardrail section near stairs", "high", "blocked", 80, 70, "Waiting on structural engineer sign-off for new anchor points"],
    [16, "Issue cut-level A4 gloves for sheet handling", "high", "in_progress", 40, 7],
    [18, "Replace robot cell light curtain", "high", "capex_blocked", 20, 45, "Quote $18,400 — submitted for FY27 capital"],
    [17, "Restock paint booth spill kit; add to monthly walk", "low", "open", 28, -5],
    [21, "Replace cylinder cart restraint chain", "high", "open", 2, 1],
    [15, "Install convex mirror at door 3 corner", "low", "open", 60, 20],
  ];
  for (const [inc, title, pri, status, createdAgo, dueAgo, reason] of CAS) {
    const site = INCIDENTS[inc][3];
    const assignee = pick(bySite(site).filter(u => u.role !== "staff")) || safety;
    const closed = ["done", "verified"].includes(status);
    insCA.run(T, incIds[inc], null, title, pri, status, assignee.id, day(dueAgo), status === "verified" ? safety.id : null,
              iso(createdAgo), iso(Math.max(0, closed ? dueAgo : 1)), reason ?? null, closed ? iso(Math.max(0, dueAgo + 2)) : null);
  }

  // Inspections + findings over the year
  const insInsp = db.prepare(`INSERT INTO inspections (tenant_id, checklist_id, site_id, inspector_id, status, responses, started_at, completed_at)
                              VALUES (?,?,?,?, 'complete', ?, ?, ?)`);
  const insFind = db.prepare(`INSERT INTO findings (tenant_id, inspection_id, site_id, severity, description, status, photos, reported_by, created_at, resolved_at,
                                                    category, assignee, due_date, capex, capex_notes, safety_relevant, resolution_action)
                              VALUES (?,?,?,?,?,?, '[]', ?,?,?,?,?,?,?,?,?,?)`);
  const FINDINGS = [
    ["critical", "Emergency exit blocked by pallet of finished goods", "Egress", 1, false],
    ["high", "E-stop on laser cutter not latching", "Machine guarding", 1, false],
    ["high", "Fire extinguisher pressure gauge in red — Assembly column C4", "Fire safety", 1, false],
    ["medium", "SDS binder missing two new paint thinners", "HazCom", 1, false],
    ["medium", "Eyewash station flow weak at paint booth", "First aid", 1, false],
    ["low", "Floor marking faded at forklift crossing", "Traffic", 1, false],
    ["medium", "Electrical panel access partially blocked by carts", "Electrical", 1, false],
    ["low", "Dusty light fixtures in Shipping office", "Housekeeping", 0, false],
    ["low", "Break room fridge needs cleaning", "Housekeeping", 0, false],
    ["high", "Mezzanine guardrail requires re-engineering", "Fall protection", 1, true],
  ];
  let fi = 0;
  for (let k = 0; k < 26; k++) {
    const ago = Math.floor(360 - k * 13.5);
    const si = k % 3, cl = pick(checklists), insp = pick(bySite(si));
    const resp = JSON.stringify(Object.fromEntries(cl.items.map((_, i) => [`i${i + 1}`, R() < 0.9 ? "pass" : "fail"])));
    const inspId = Number(insInsp.run(T, cl.id, siteIds[si], insp.id, resp, iso(ago, 8), iso(ago, 9)).lastInsertRowid);
    if (R() < 0.55) {
      const [sev, desc, cat, safe, capex] = FINDINGS[fi++ % FINDINGS.length];
      const open = ago < 60 || capex;
      insFind.run(T, inspId, siteIds[si], sev, desc, open ? "open" : "resolved", insp.id, iso(ago, 9), open ? null : iso(Math.max(0, ago - 6)),
                  cat, pick(["Site Manager", "Facility Maintenance", "Department Lead"]), day(ago - 7), capex ? 1 : 0,
                  capex ? "Engineering redesign quoted at $32k — FY27 capital request" : null, safe, open ? null : "Corrected on the spot");
    }
  }

  // Assets + LOTO procedures
  for (const [name, tag, cat, si, loc, mfr, model, clName] of ASSETS) {
    const aid = Number(db.prepare(`INSERT INTO assets (tenant_id, name, asset_tag, category, site_id, location, manufacturer, model, serial, status, checklist_id, active, created_at)
                                   VALUES (?,?,?,?,?,?,?,?,?, 'in_service', ?, 1, ?)`)
      .run(T, name, tag, cat, siteIds[si], loc, mfr, model, `SN-${tag}-${1000 + Math.floor(R() * 8999)}`, clName ? clByName[clName] : null, iso(390)).lastInsertRowid);
    if (LOTO[tag]) db.prepare("INSERT INTO asset_procedures (tenant_id, asset_id, kind, title, steps, body, active) VALUES (?,?, 'loto', ?, ?, NULL, 1)")
      .run(T, aid, `${name} — energy isolation`, JSON.stringify(LOTO[tag]));
  }

  // Payroll hours → realistic TRIR (~1.0)
  for (let m = 0; m < 12; m++) {
    const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - m);
    const ym = d.toISOString().slice(0, 7);
    SITES.forEach((s, si) => db.prepare("INSERT OR REPLACE INTO labor_hours (tenant_id, site_id, month, hours) VALUES (?,?,?,?)")
      .run(T, siteIds[si], ym, Math.round(s.hours * (0.92 + R() * 0.16))));
  }

  // Recognition points
  const insPts = db.prepare(`INSERT INTO points_ledger (tenant_id, user_id, points, reason, source_type, awarded_by, period, status, created_at)
                             VALUES (?,?,?,?, 'demo', ?, ?, 'approved', ?)`);
  for (let k = 0; k < 40; k++) {
    const u = pick(users.slice(6)), ago = Math.floor(R() * 150);
    insPts.run(T, u.id, pick([10, 10, 15, 25]), pick(["Hazard reported", "Near-miss reported", "Peer shout-out", "Training completed on time"]),
               admin.id, iso(ago).slice(0, 7), iso(ago));
  }
  return { users: users.length, incidents: incIds.length, assets: ASSETS.length, trainings: trainings.length };
}

function resetDemo(db) {
  const tenantId = ensureDemoTenant(db);
  // FK enforcement can't be toggled inside a transaction, and a hand-kept
  // delete order breaks whenever a table is added. So: suspend enforcement,
  // rebuild, then run a full foreign_key_check and roll back on ANY violation.
  const fkWasOn = db.prepare("PRAGMA foreign_keys").get()?.foreign_keys === 1;
  if (fkWasOn) db.exec("PRAGMA foreign_keys = OFF");
  db.exec("BEGIN");
  try {
    wipeTenant(db, tenantId);
    const counts = seedDemo(db, tenantId);
    const bad = db.prepare("PRAGMA foreign_key_check").all();
    if (bad.length) throw new Error(`integrity check failed (${bad.length} dangling reference(s), first in ${bad[0].table})`);
    db.exec("COMMIT");
    if (fkWasOn) db.exec("PRAGMA foreign_keys = ON");
    return { tenantId, name: DEMO_NAME, counts,
             logins: [{ role: "Admin", email: DEMO_ADMIN.email, password: demoPassword() },
                      { role: "Worker (phone view)", email: DEMO_WORKER.email, password: demoPassword() }] };
  } catch (e) {
    db.exec("ROLLBACK");
    if (fkWasOn) db.exec("PRAGMA foreign_keys = ON");
    throw e;
  }
}

module.exports = { resetDemo, ensureDemoTenant, wipeTenant, DEMO_NAME };
