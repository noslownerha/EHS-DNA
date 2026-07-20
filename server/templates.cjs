// ── Industry template packs ──────────────────────────────────────────────────
// Pre-built inspection checklists + training courses for a given industry, so a
// new tenant gets real, relevant content on day one instead of a blank builder.
// An operator applies a pack to a tenant; everything created is fully editable
// afterward (these are starting points, not locked content).
//
// Packs are intentionally plain data. Checklists become rows in `checklists`
// (items = JSON [{id,label}]); trainings become rows in `trainings` (kind cbt =
// self-serve acknowledgement course, in_person = sign-off). Nothing here is
// destructive — applying a pack only inserts, and skips names already present.

const PACKS = {
  distillery: {
    label: "Craft Beverage & Distilling",
    blurb: "DSP-aware: ethanol/flammables, bottling line, barrel warehouse, grain handling.",
    checklists: [
      { name: "Bottling Line Pre-Shift", freqDays: null, items: [
        "Guarding in place on all moving parts", "E-stops accessible and tested",
        "No glass/debris on the line", "Conveyor belts tracking correctly",
        "Filler nozzles clean, no drips", "Labeler and capper guards closed",
        "Floor dry, no slip hazards", "PPE available (eye, hearing, cut-resistant gloves)",
      ]},
      { name: "Barrel Warehouse Walkthrough", freqDays: 30, items: [
        "Rick/rack structure sound, no leaning", "No leaking barrels (evidence of seepage)",
        "Aisles clear for egress", "Fire suppression access unobstructed",
        "Ethanol vapor — no unusual odor pooling", "Ignition sources controlled",
        "Spill kit stocked and accessible", "Emergency exits marked and clear",
      ]},
      { name: "Still House / Ethanol Area", freqDays: 7, items: [
        "No visible ethanol leaks at seals/valves", "Bonding & grounding straps intact",
        "Flammable-rated fixtures and wiring intact", "Vapor ventilation running",
        "No unauthorized ignition sources", "Fire extinguisher present and charged",
        "Pressure gauges within range", "Emergency shutoff accessible and labeled",
      ]},
      { name: "Grain Handling & Milling", freqDays: 30, items: [
        "Dust accumulation controlled (no layers on surfaces)", "Dust collection running",
        "Bearings not overheating", "No smoldering odor", "Guards on augers/conveyors",
        "Housekeeping — no grain piles", "Bonding on transfer equipment",
      ]},
      { name: "Forklift / PIT Pre-Use", freqDays: null, items: [
        "Tires & forks in good condition", "Hydraulics — no leaks", "Horn and lights working",
        "Brakes and steering responsive", "Seatbelt functional", "Fuel/charge adequate", "Data plate legible",
      ]},
      { name: "Loading Dock Safety", freqDays: 30, items: [
        "Dock plates/levelers functional", "Trailer restraints/wheel chocks used",
        "Dock edge markings visible", "Lighting adequate", "No trip hazards in path",
        "Pedestrian/forklift separation maintained",
      ]},
    ],
    trainings: [
      { title: "Ethanol & Flammable Liquids Safety", kind: "cbt", freqMonths: 12 },
      { title: "Hot Work Awareness", kind: "cbt", freqMonths: 12 },
      { title: "Confined Space Awareness (Tanks & Vessels)", kind: "cbt", freqMonths: 12 },
      { title: "Forklift / Powered Industrial Truck", kind: "in_person", freqMonths: 36 },
      { title: "Lockout / Tagout Basics", kind: "cbt", freqMonths: 12 },
      { title: "Hearing Conservation (Bottling Line)", kind: "cbt", freqMonths: 12 },
      { title: "Chemical Handling & HazCom (Caustics, Sanitizers)", kind: "cbt", freqMonths: 12 },
      { title: "Emergency Evacuation & Assembly", kind: "in_person", freqMonths: 12 },
    ],
  },

  food_bev: {
    label: "Food & Beverage Manufacturing",
    blurb: "GMP-adjacent: sanitation, allergen zones, machine guarding, cold/hot work areas.",
    checklists: [
      { name: "Production Line Pre-Shift", freqDays: null, items: [
        "Machine guards in place", "E-stops tested", "No standing water / slip hazards",
        "Sanitation complete from prior shift", "PPE available", "Allergen zone signage correct",
        "Compressed air lines secure", "First-aid station stocked",
      ]},
      { name: "Sanitation / Washdown Area", freqDays: 7, items: [
        "GFCI protection on wet-area circuits", "Hoses stored off floor",
        "Chemical concentrations verified", "SDS accessible for all chemicals",
        "Drainage clear", "Non-slip footwear enforced", "Eyewash within reach",
      ]},
      { name: "Cold Storage / Freezer Check", freqDays: 30, items: [
        "Door releases work from inside", "No ice buildup on walkways",
        "Emergency alarm functional", "Lighting adequate", "PPE for cold available",
        "Refrigerant monitoring functional",
      ]},
      { name: "Forklift / PIT Pre-Use", freqDays: null, items: [
        "Tires & forks good", "Hydraulics no leaks", "Horn/lights working",
        "Brakes/steering responsive", "Seatbelt functional", "Fuel/charge adequate",
      ]},
    ],
    trainings: [
      { title: "Machine Guarding & Amputation Hazards", kind: "cbt", freqMonths: 12 },
      { title: "Lockout / Tagout Basics", kind: "cbt", freqMonths: 12 },
      { title: "Chemical Handling & HazCom", kind: "cbt", freqMonths: 12 },
      { title: "Forklift / Powered Industrial Truck", kind: "in_person", freqMonths: 36 },
      { title: "Slips, Trips & Falls Prevention", kind: "cbt", freqMonths: 12 },
      { title: "Emergency Evacuation & Assembly", kind: "in_person", freqMonths: 12 },
    ],
  },

  general_mfg: {
    label: "General Manufacturing",
    blurb: "Broad baseline: machine guarding, LOTO, PIT, PPE, emergency prep.",
    checklists: [
      { name: "General Shop Pre-Shift", freqDays: null, items: [
        "Machine guards in place", "E-stops accessible", "Aisles and exits clear",
        "No slip/trip hazards", "PPE available and worn", "Tools in good condition",
        "Fire extinguisher accessible", "Housekeeping acceptable",
      ]},
      { name: "Monthly Facility Safety Walk", freqDays: 30, items: [
        "Emergency exits marked and clear", "Fire extinguishers charged and tagged",
        "First-aid kits stocked", "Eyewash/shower functional", "Electrical panels unobstructed (36in)",
        "SDS accessible", "Spill kits stocked", "Lighting adequate throughout",
      ]},
      { name: "Forklift / PIT Pre-Use", freqDays: null, items: [
        "Tires & forks good", "Hydraulics no leaks", "Horn/lights working",
        "Brakes/steering responsive", "Seatbelt functional", "Fuel/charge adequate",
      ]},
      { name: "Fire Extinguisher Inspection", freqDays: 60, items: [
        "In designated location", "Access unobstructed", "Pressure gauge in green",
        "Pin and tamper seal intact", "Hose/nozzle undamaged", "Inspection tag current",
      ]},
    ],
    trainings: [
      { title: "Machine Guarding & Amputation Hazards", kind: "cbt", freqMonths: 12 },
      { title: "Lockout / Tagout Basics", kind: "cbt", freqMonths: 12 },
      { title: "Hazard Communication (HazCom / GHS)", kind: "cbt", freqMonths: 12 },
      { title: "Forklift / Powered Industrial Truck", kind: "in_person", freqMonths: 36 },
      { title: "PPE Selection & Use", kind: "cbt", freqMonths: 12 },
      { title: "Emergency Evacuation & Assembly", kind: "in_person", freqMonths: 12 },
    ],
  },
};

// Public catalog (no bulky item/training arrays) for the operator UI to list.
function packCatalog() {
  return Object.entries(PACKS).map(([id, p]) => ({
    id, label: p.label, blurb: p.blurb,
    checklistCount: p.checklists.length, trainingCount: p.trainings.length,
  }));
}

module.exports = function mountTemplates(app, db, auth, requireOperator) {
  // List available packs.
  app.get("/api/op/template-packs", auth, requireOperator, (req, res) => {
    res.json({ packs: packCatalog() });
  });

  // Apply a pack to a tenant. Idempotent by name: skips a checklist/training whose
  // name already exists for the tenant, so re-applying won't create duplicates.
  app.post("/api/op/template-packs/:packId/apply", auth, requireOperator, (req, res) => {
    const pack = PACKS[req.params.packId];
    if (!pack) return res.status(404).json({ error: "Unknown pack" });
    const tenantId = parseInt(req.body?.tenantId, 10);
    if (!tenantId) return res.status(400).json({ error: "tenantId required" });
    const tenant = db.prepare("SELECT id FROM tenants WHERE id = ?").get(tenantId);
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });

    const haveChecklist = db.prepare("SELECT 1 FROM checklists WHERE tenant_id = ? AND name = ? AND active = 1");
    const haveTraining = db.prepare("SELECT 1 FROM trainings WHERE tenant_id = ? AND title = ? AND active = 1");
    const insChecklist = db.prepare(`INSERT INTO checklists (tenant_id, name, items, kind, frequency_days)
                                     VALUES (?, ?, ?, 'checklist', ?)`);
    const insTraining = db.prepare(`INSERT INTO trainings (tenant_id, title, kind, frequency_months)
                                    VALUES (?, ?, ?, ?)`);
    const items = arr => JSON.stringify(arr.map((label, i) => ({ id: `i${i + 1}`, label })));

    let checklistsAdded = 0, trainingsAdded = 0, skipped = 0;
    const tx = db.transaction(() => {
      for (const c of pack.checklists) {
        if (haveChecklist.get(tenantId, c.name)) { skipped++; continue; }
        insChecklist.run(tenantId, c.name, items(c.items), c.freqDays ?? null);
        checklistsAdded++;
      }
      for (const t of pack.trainings) {
        if (haveTraining.get(tenantId, t.title)) { skipped++; continue; }
        insTraining.run(tenantId, t.title, t.kind, t.freqMonths ?? null);
        trainingsAdded++;
      }
    });
    tx();
    res.json({ ok: true, pack: pack.label, checklistsAdded, trainingsAdded, skipped });
  });
};

module.exports.PACKS = PACKS;
module.exports.packCatalog = packCatalog;
