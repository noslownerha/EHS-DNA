/* Smoke test — starts the API in-process, hits every endpoint group. */
process.env.EHS_DB_PATH = "/tmp/smoke.db";
const fs = require("fs");
["", "-wal", "-shm"].forEach(s => { try { fs.unlinkSync("/tmp/smoke.db" + s); } catch {} });
require("./index.cjs");

const B = "http://127.0.0.1:3001";
const j = (r) => r.json();
let TOKEN;
const H = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` });
const ok = (name, cond) => console.log(cond ? `PASS ${name}` : `FAIL ${name}`);

(async () => {
  await new Promise(r => setTimeout(r, 400));

  const login = await fetch(`${B}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "ahren@whistlepig.com", password: "ChangeMe!2026" }) }).then(j);
  TOKEN = login.token;
  ok("login", !!TOKEN && login.user.role === "admin");

  const bad = await fetch(`${B}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "ahren@whistlepig.com", password: "wrong" }) });
  ok("bad password rejected", bad.status === 401);

  const noTok = await fetch(`${B}/api/incidents`);
  ok("no-token rejected", noTok.status === 401);

  const cfg = await fetch(`${B}/api/config`, { headers: H() }).then(j);
  ok("config", cfg.company === "WhistlePig Whiskey" && cfg.sites.length === 4 && cfg.departments.length === 6);

  const inc = await fetch(`${B}/api/incidents`, { method: "POST", headers: H(),
    body: JSON.stringify({ type: "near_miss", severity: "minor", siteId: 1, description: "smoke" }) }).then(j);
  ok("incident create", inc.ref === `INC-${new Date().getFullYear()}-0001`);
  const incs = await fetch(`${B}/api/incidents`, { headers: H() }).then(j);
  ok("incident list", incs.length === 1);

  const staff = await fetch(`${B}/api/users`, { method: "POST", headers: H(),
    body: JSON.stringify({ email: "test.staff@whistlepig.com", name: "Test Staff", role: "staff", siteId: 1, password: "Staff!2026x" }) }).then(j);
  ok("user create", !!staff.id);
  const dup = await fetch(`${B}/api/users`, { method: "POST", headers: H(),
    body: JSON.stringify({ email: "test.staff@whistlepig.com", name: "Dup", role: "staff" }) });
  ok("duplicate email 409", dup.status === 409);

  const sLogin = await fetch(`${B}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "test.staff@whistlepig.com", password: "Staff!2026x" }) }).then(j);
  ok("staff login", sLogin.user.role === "staff" && sLogin.user.site === "Moriah");
  const sH = { "Content-Type": "application/json", Authorization: `Bearer ${sLogin.token}` };
  const forbidden = await fetch(`${B}/api/users`, { method: "POST", headers: sH,
    body: JSON.stringify({ email: "x@x.com", name: "X", role: "staff" }) });
  ok("staff cannot create users (403)", forbidden.status === 403);

  const tr = await fetch(`${B}/api/trainings`, { method: "POST", headers: H(),
    body: JSON.stringify({ title: "Forklift Safety", frequencyMonths: 12 }) }).then(j);
  const comp = await fetch(`${B}/api/completions`, { method: "POST", headers: H(),
    body: JSON.stringify({ trainingId: tr.id, userIds: [1, staff.id], method: "group" }) }).then(j);
  ok("group completion", comp.count === 2 && !!comp.sessionId);
  const staffComps = await fetch(`${B}/api/completions`, { headers: sH }).then(j);
  ok("staff sees only own completions", staffComps.length === 1 && staffComps[0].user_id === staff.id);
  ok("expiry set from frequency", !!staffComps[0].expires_at);

  const trg = await fetch(`${B}/api/triage`, { method: "POST", headers: sH,
    body: JSON.stringify({ siteId: 1, outcome: "firstaid", stepsCompleted: ["Assessed scene"] }) }).then(j);
  ok("triage record", trg.ref?.startsWith("TRG-"));

  const insp = await fetch(`${B}/api/inspections`, { method: "POST", headers: sH, body: JSON.stringify({ siteId: 1 }) }).then(j);
  const find = await fetch(`${B}/api/findings`, { method: "POST", headers: sH,
    body: JSON.stringify({ inspectionId: insp.id, siteId: 1, severity: "high", description: "Blocked exit" }) }).then(j);
  ok("inspection + finding", !!insp.id && !!find.id);

  const ca = await fetch(`${B}/api/cas`, { method: "POST", headers: H(),
    body: JSON.stringify({ findingId: find.id, title: "Clear exit route", priority: "high", dueDate: "2026-07-10" }) }).then(j);
  await fetch(`${B}/api/cas/${ca.id}`, { method: "PUT", headers: H(), body: JSON.stringify({ status: "done", verified: true }) });
  const cas = await fetch(`${B}/api/cas`, { headers: H() }).then(j);
  ok("CA lifecycle", cas[0].status === "done" && cas[0].verified_by === 1);

  await fetch(`${B}/api/config`, { method: "PUT", headers: H(), body: JSON.stringify({ tagline: "Test tagline" }) });
  const cfg2 = await fetch(`${B}/api/config`, { headers: H() }).then(j);
  ok("config edit", cfg2.tagline === "Test tagline");

  const summary = await fetch(`${B}/api/dashboard/summary`, { headers: H() }).then(j);
  ok("dashboard summary", Array.isArray(summary) && summary.length === 4 &&
     summary.find(s => s.name === "Moriah").openIncidents === 1);

  const compliance = await fetch(`${B}/api/dashboard/compliance`, { headers: H() }).then(j);
  const staffRow = compliance.find(c => c.id === staff.id);
  // 10 seeded trainings + 1 created in this test = 11 required; staff completed 1
  ok("compliance rollup", Array.isArray(compliance) && compliance.length === 2 &&
     staffRow && staffRow.current === 1 && staffRow.total === 11 && staffRow.compliance === Math.round(100 / 11));

  const lead = await fetch(`${B}/api/leads`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Test Lead", email: "lead@example.com", company: "Acme" }) }).then(j);
  const badLead = await fetch(`${B}/api/leads`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "not-an-email" }) });
  ok("lead capture + validation", lead.ok === true && badLead.status === 400);

  await fetch(`${B}/api/users/${staff.id}`, { method: "PUT", headers: H(), body: JSON.stringify({ active: 0 }) });
  const usersAfter = await fetch(`${B}/api/users`, { headers: H() }).then(j);
  ok("deactivate user", usersAfter.find(u => u.id === staff.id).active === 0);

  // Checklist schedule: 3 scheduled lists × 4 sites = 12 rows, all due-now (never run)
  const sched = await fetch(`${B}/api/checklists/schedule`, { headers: H() }).then(j);
  ok("schedule rollup", sched.length === 12 && sched.every(s => s.daysUntil <= 0 || s.dueSoon !== undefined));

  // Complete an extinguisher inspection at Moriah → its next due moves out ~60 days
  const lists = await fetch(`${B}/api/checklists`, { headers: H() }).then(j);
  const ext = lists.find(l => l.name.includes("Extinguisher"));
  const insp2 = await fetch(`${B}/api/inspections`, { method: "POST", headers: H(),
    body: JSON.stringify({ checklistId: ext.id, siteId: 1 }) }).then(j);
  await fetch(`${B}/api/inspections/${insp2.id}`, { method: "PUT", headers: H(),
    body: JSON.stringify({ responses: { i1: "pass" }, complete: true }) });
  const sched2 = await fetch(`${B}/api/checklists/schedule`, { headers: H() }).then(j);
  const row = sched2.find(s => s.checklistId === ext.id && s.siteId === 1);
  ok("schedule advances after run", row && row.lastRun && row.daysUntil >= 59 && !row.overdue);

  const editedCl = await fetch(`${B}/api/checklists/${ext.id}`, { method: "PUT", headers: H(),
    body: JSON.stringify({ frequencyDays: 30 }) });
  const sched3 = await fetch(`${B}/api/checklists/schedule`, { headers: H() }).then(j);
  ok("checklist edit", editedCl.ok && sched3.find(s => s.checklistId === ext.id && s.siteId === 1).frequencyDays === 30);

  console.log("SMOKE COMPLETE");
  process.exit(0);
})().catch(e => { console.error("SMOKE ERROR", e); process.exit(1); });
