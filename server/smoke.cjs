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
  // Seeded admin ships flagged (default password) — first boot must force a change.
  ok("seeded admin must change password", login.user.mustChangePassword === true);
  // Complete the forced change, then set it back so the rest of the suite (and the
  // operator/rate-limit tests below) can keep using the known password.
  await fetch(`${B}/api/auth/change-password`, { method: "POST", headers: H(),
    body: JSON.stringify({ current: "ChangeMe!2026", next: "TempRotate!1" }) }).then(j);
  await fetch(`${B}/api/auth/change-password`, { method: "POST", headers: H(),
    body: JSON.stringify({ current: "TempRotate!1", next: "ChangeMe!2026" }) }).then(j);
  const pwUnblocked = await fetch(`${B}/api/config`, { headers: H() });
  ok("forced change unblocks admin", pwUnblocked.status === 200);

  const bad = await fetch(`${B}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "ahren@whistlepig.com", password: "wrong" }) });
  ok("bad password rejected", bad.status === 401);

  const noTok = await fetch(`${B}/api/incidents`);
  ok("no-token rejected", noTok.status === 401);

  // Rate limiting: hammer a throwaway email; burst cap (10) must eventually 429.
  let got429 = false;
  for (let i = 0; i < 14; i++) {
    const r = await fetch(`${B}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "attacker@nowhere.test", password: "guess" + i }) });
    if (r.status === 429) { got429 = true; break; }
  }
  ok("login rate limit trips", got429);


  const cfg = await fetch(`${B}/api/config`, { headers: H() }).then(j);
  ok("config", cfg.company === "WhistlePig Whiskey" && cfg.sites.length === 4 && cfg.departments.length === 6);

  const inc = await fetch(`${B}/api/incidents`, { method: "POST", headers: H(),
    body: JSON.stringify({ type: "near_miss", severity: "minor", siteId: 1, description: "smoke" }) }).then(j);
  ok("incident create", inc.ref === `INC-${new Date().getFullYear()}-0001`);
  const incs = await fetch(`${B}/api/incidents`, { headers: H() }).then(j);
  ok("incident list", incs.length === 1);

  // Empty-string edit must CLEAR a field (COALESCE bug regression guard)
  await fetch(`${B}/api/incidents/${inc.id}`, { method: "PUT", headers: H(),
    body: JSON.stringify({ description: "" }) }).then(j);
  const cleared = await fetch(`${B}/api/incidents`, { headers: H() }).then(j);
  ok("empty-string clears field", cleared[0].description === "");
  // Omitted key must leave field untouched
  await fetch(`${B}/api/incidents/${inc.id}`, { method: "PUT", headers: H(),
    body: JSON.stringify({ status: "closed" }) }).then(j);
  const untouched = await fetch(`${B}/api/incidents`, { headers: H() }).then(j);
  ok("omitted key untouched", untouched[0].location_detail === incs[0].location_detail && untouched[0].status === "closed");
  // Restore open state so downstream dashboard-summary counts are unaffected
  await fetch(`${B}/api/incidents/${inc.id}`, { method: "PUT", headers: H(),
    body: JSON.stringify({ status: "open" }) }).then(j);

  // Healthcheck (no auth)
  const health = await fetch(`${B}/api/health`).then(j);
  ok("healthcheck ok", health.status === "ok");

  // TRIR report: mark our incident Recordable, confirm it surfaces in the summary's recordables count
  await fetch(`${B}/api/incidents/${inc.id}`, { method: "PUT", headers: H(),
    body: JSON.stringify({ oshaClassification: "Recordable" }) }).then(j);
  const trirSummary = await fetch(`${B}/api/reports/incident-summary`, { headers: H() }).then(j);
  const totalRecordables = (trirSummary.months ?? []).reduce((n, m) => n + (m.recordables ?? 0), 0);
  ok("report summary counts recordables", trirSummary.months?.length === 24 && totalRecordables >= 1);

  // Labor hours: entering actual hours overrides the headcount estimate for that site+month
  const anyMonth = trirSummary.months[trirSummary.months.length - 1].month;
  await fetch(`${B}/api/labor-hours`, { method: "PUT", headers: H(),
    body: JSON.stringify({ siteId: 1, month: anyMonth, hours: 12345 }) }).then(j);
  const withHours = await fetch(`${B}/api/reports/incident-summary`, { headers: H() }).then(j);
  const site1 = withHours.months.find(m => m.month === anyMonth).sites.find(s => s.siteId === 1);
  ok("actual hours override estimate", site1.estHours === 12345 && site1.hoursActual === true);
  const lh = await fetch(`${B}/api/labor-hours`, { headers: H() }).then(j);
  ok("labor hours persisted", lh.some(r => r.site_id === 1 && r.month === anyMonth && r.hours === 12345));
  // Entering 0 clears back to estimate
  await fetch(`${B}/api/labor-hours`, { method: "PUT", headers: H(),
    body: JSON.stringify({ siteId: 1, month: anyMonth, hours: 0 }) }).then(j);
  const hoursCleared = await fetch(`${B}/api/reports/incident-summary`, { headers: H() }).then(j);
  const site1c = hoursCleared.months.find(m => m.month === anyMonth).sites.find(s => s.siteId === 1);
  ok("zero hours reverts to estimate", site1c.hoursActual === false);

  // Bulk hours: multiple site/month entries in one call, invalid entries skipped
  const bmonth = trirSummary.months[trirSummary.months.length - 2].month;
  const bulk = await fetch(`${B}/api/labor-hours/bulk`, { method: "PUT", headers: H(),
    body: JSON.stringify({ entries: [
      { siteId: 1, month: bmonth, hours: 5000 },
      { siteId: 2, month: bmonth, hours: 6000 },
      { siteId: 1, month: "bad-month", hours: 100 },   // should skip
    ] }) }).then(j);
  ok("bulk applies and skips", bulk.applied === 2 && bulk.skipped === 1);
  const afterBulk = await fetch(`${B}/api/labor-hours`, { headers: H() }).then(j);
  ok("bulk persisted both", afterBulk.some(r => r.site_id === 1 && r.month === bmonth && r.hours === 5000)
                          && afterBulk.some(r => r.site_id === 2 && r.month === bmonth && r.hours === 6000));

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

  // Failed attempt: logged for audit, passed=0, no expiry, excluded from compliance
  const failTr = await fetch(`${B}/api/trainings`, { method: "POST", headers: H(),
    body: JSON.stringify({ title: "Lockout/Tagout", frequencyMonths: 12 }) }).then(j);
  await fetch(`${B}/api/completions`, { method: "POST", headers: sH,
    body: JSON.stringify({ trainingId: failTr.id, method: "cbt", score: 40, passed: false }) }).then(j);
  const afterFail = await fetch(`${B}/api/completions`, { headers: sH }).then(j);
  const failRow = afterFail.find(c => c.training_id === failTr.id);
  ok("failed attempt logged", !!failRow && failRow.passed === 0);
  ok("failed attempt has no expiry", !!failRow && !failRow.expires_at);

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
  // 10 seeded + "Forklift Safety" + "Lockout/Tagout" = 12 required; staff passed 1, failed 1.
  // current must stay 1 — the failed Lockout attempt is logged but does NOT satisfy compliance.
  ok("compliance rollup", Array.isArray(compliance) && compliance.length === 2 &&
     staffRow && staffRow.current === 1 && staffRow.total === 12 && staffRow.compliance === Math.round(100 / 12));

  // Site rollup must use the same expiry-aware definition: staff is 1/12 current, so their
  // site cannot read 100% compliant (old proxy would have, off a single recent completion).
  const staffSite = staffRow.site;
  const siteSummary = summary.find(s => s.name === staffSite);
  ok("site rollup expiry-aware", siteSummary && siteSummary.compliance < 100);

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

  // Notifications: injury incident triggers default rule → admin gets in-app notif
  await fetch(`${B}/api/incidents`, { method: "POST", headers: H(),
    body: JSON.stringify({ type: "injury", severity: "serious", siteId: 1, description: "notif test" }) }).then(j);
  const notifs = await fetch(`${B}/api/notifications`, { headers: H() }).then(j);
  ok("injury notification", notifs.length >= 1 && notifs[0].title.includes("Injury") && notifs[0].emailed === 1);
  const sNotifs = await fetch(`${B}/api/notifications`, { headers: sH }).then(j);
  ok("staff not notified", sNotifs.length === 0);
  await fetch(`${B}/api/notifications/read`, { method: "PUT", headers: H(), body: JSON.stringify({}) });
  const after = await fetch(`${B}/api/notifications`, { headers: H() }).then(j);
  ok("mark read", after.every(n => n.read === 1));
  const rules = await fetch(`${B}/api/notification-rules`, { headers: H() }).then(j);
  ok("default rule seeded", rules.length === 1 && rules[0].event === "incident_injury");

  // ── Bulk imports (run last: they change site/user counts) ──
  const ub = await fetch(`${B}/api/users/bulk`, { method: "POST", headers: H(),
    body: JSON.stringify({ rows: [
      { name: "Bulk One", email: "bulk1@whistlepig.com", role: "staff", site: "Moriah" },
      { name: "Bulk Two", email: "bulk2@whistlepig.com", role: "trainer" },
      { name: "Dupe", email: "test.staff@whistlepig.com", role: "staff" },  // existing → skip
      { name: "NoEmail", email: "", role: "staff" },                        // invalid → skip
    ] }) }).then(j);
  ok("bulk users adds + skips", ub.created === 2 && ub.failed === 2);
  // The dupe row must not have overwritten the existing user's record.
  const dupeResult = ub.results.find(r => r.email === "test.staff@whistlepig.com");
  ok("bulk did not overwrite existing user", dupeResult && dupeResult.error === "Email already exists");

  const sb = await fetch(`${B}/api/sites/bulk`, { method: "POST", headers: H(),
    body: JSON.stringify({ rows: [
      { name: "New Depot", location: "Albany, NY" },
      { name: "Moriah", location: "should be skipped" },  // existing → skip
      { name: "", location: "x" },                         // invalid → skip
    ] }) }).then(j);
  ok("bulk sites adds + skips", sb.created === 1 && sb.failed === 2);
  const sitesNow = await fetch(`${B}/api/config`, { headers: H() }).then(j);
  const moriah = (sitesNow.sites ?? []).find(s => s.name === "Moriah");
  ok("bulk did not overwrite existing site", moriah && moriah.location === "Moriah, NY");

  // Operator billing pause: pausing a tenant locks its team out with the AP/billing message
  const opLogin = await fetch(`${B}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "ahrenwolson@gmail.com", password: process.env.EHS_OPERATOR_PASSWORD || "ChangeMe!2026" }) }).then(j);
  const opH = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${opLogin.token}` });
  ok("operator login", !!opLogin.token && opLogin.user.isOperator === true);
  // Operator seeds with the default password too — clear its forced change, then restore.
  if (opLogin.user.mustChangePassword) {
    const opPw = process.env.EHS_OPERATOR_PASSWORD || "ChangeMe!2026";
    await fetch(`${B}/api/auth/change-password`, { method: "POST", headers: opH(),
      body: JSON.stringify({ current: opPw, next: "OpRotate!1" }) }).then(j);
    await fetch(`${B}/api/auth/change-password`, { method: "POST", headers: opH(),
      body: JSON.stringify({ current: "OpRotate!1", next: opPw }) }).then(j);
  }

  await fetch(`${B}/api/op/tenants/1/status`, { method: "PUT", headers: opH(),
    body: JSON.stringify({ active: false, reason: "billing" }) }).then(j);
  // A tenant user can no longer log in, and gets the billing-specific message
  const blocked = await fetch(`${B}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "ahren@whistlepig.com", password: "ChangeMe!2026" }) });
  const blockedBody = await blocked.json().catch(() => ({}));
  ok("billing pause blocks tenant login", blocked.status === 403 && blockedBody.reason === "billing"
     && /Accounts Payable/i.test(blockedBody.error));
  // A live token is rejected mid-session too
  const midSession = await fetch(`${B}/api/incidents`, { headers: H() });
  ok("billing pause blocks live token", midSession.status === 403);
  // Operator is NOT locked out
  const opStill = await fetch(`${B}/api/op/tenants`, { headers: opH() });
  ok("operator bypasses pause", opStill.status === 200);
  // Reactivate clears the reason and restores access
  await fetch(`${B}/api/op/tenants/1/status`, { method: "PUT", headers: opH(),
    body: JSON.stringify({ active: true }) }).then(j);
  const restored = await fetch(`${B}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "ahren@whistlepig.com", password: "ChangeMe!2026" }) });
  ok("reactivate restores access", restored.status === 200);

  // ── Cross-tenant isolation: tenant 1 must never see or touch tenant 2's data ──
  // Provision a 2nd tenant via the operator API, then attack it with tenant 1's admin token.
  const t2 = await fetch(`${B}/api/op/tenants`, { method: "POST", headers: opH(),
    body: JSON.stringify({ name: "Acme Distilling", industry: "Spirits", adminEmail: "admin@acme.test", adminName: "Acme Admin" }) }).then(j);
  const t2Login = await fetch(`${B}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@acme.test", password: t2.tempPassword }) }).then(j);
  const t2H = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${t2Login.token}` });
  // New tenant admin ships on a temp password — clear the forced change first.
  await fetch(`${B}/api/auth/change-password`, { method: "POST", headers: t2H(),
    body: JSON.stringify({ current: t2.tempPassword, next: "AcmeSecure!1" }) }).then(j);
  // Tenant 2 creates an incident
  const t2inc = await fetch(`${B}/api/incidents`, { method: "POST", headers: t2H(),
    body: JSON.stringify({ type: "injury", severity: "serious", description: "ACME-SECRET-INJURY" }) }).then(j);
  ok("2nd tenant provisioned + can create", !!t2Login.token && !!t2inc.id);
  // Tenant 1 lists incidents — must NOT contain tenant 2's record
  const t1incs = await fetch(`${B}/api/incidents`, { headers: H() }).then(j);
  ok("tenant 1 cannot see tenant 2 incidents", !t1incs.some(i => i.description === "ACME-SECRET-INJURY"));
  // Tenant 1 tries to MODIFY tenant 2's incident by id — write must not land
  await fetch(`${B}/api/incidents/${t2inc.id}`, { method: "PUT", headers: H(),
    body: JSON.stringify({ description: "HACKED BY TENANT 1" }) });
  const t2incAfter = await fetch(`${B}/api/incidents`, { headers: t2H() }).then(j);
  const stillSafe = t2incAfter.find(i => i.id === t2inc.id);
  ok("tenant 1 cannot modify tenant 2 incident", stillSafe && stillSafe.description === "ACME-SECRET-INJURY");
  // Tenant 1 cannot see tenant 2 users
  const t1users = await fetch(`${B}/api/users`, { headers: H() }).then(j);
  ok("tenant 1 cannot see tenant 2 users", !t1users.some(u => u.email === "admin@acme.test"));

  // ── Forced password change on seeded/temp passwords ──
  // Create a user (gets a temp password + must_change_password=1)
  const fp = await fetch(`${B}/api/users`, { method: "POST", headers: H(),
    body: JSON.stringify({ name: "Temp Pw User", email: "temppw@whistlepig.com", role: "staff" }) }).then(j);
  const fpLogin = await fetch(`${B}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "temppw@whistlepig.com", password: fp.tempPassword }) }).then(j);
  const fpH = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${fpLogin.token}` });
  ok("temp-pw user flagged at login", fpLogin.user.mustChangePassword === true);
  // Blocked from every other endpoint until changed
  const blockedCall = await fetch(`${B}/api/incidents`, { headers: fpH() });
  const blockedJson = await blockedCall.json().catch(() => ({}));
  ok("temp-pw user blocked from API", blockedCall.status === 403 && blockedJson.mustChangePassword === true);
  // Cannot reuse the same password
  const same = await fetch(`${B}/api/auth/change-password`, { method: "POST", headers: fpH(),
    body: JSON.stringify({ current: fp.tempPassword, next: fp.tempPassword }) });
  ok("cannot reuse temp password", same.status === 400);
  // Change it → flag clears, API opens up
  const changed = await fetch(`${B}/api/auth/change-password`, { method: "POST", headers: fpH(),
    body: JSON.stringify({ current: fp.tempPassword, next: "BrandNewPw!99" }) });
  ok("password change succeeds", changed.status === 200);
  const afterChange = await fetch(`${B}/api/incidents`, { headers: fpH() });
  ok("API unblocked after change", afterChange.status === 200);
  const reLogin = await fetch(`${B}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "temppw@whistlepig.com", password: "BrandNewPw!99" }) }).then(j);
  ok("flag cleared on re-login", reLogin.user.mustChangePassword === false);

  // ── Operator impersonation (support tool — was silently broken by a duplicate route) ──
  const imp = await fetch(`${B}/api/op/impersonate`, { method: "POST", headers: opH(),
    body: JSON.stringify({ tenantId: 1 }) }).then(j);
  ok("impersonate returns token AND user", !!imp.token && !!imp.user && imp.user.isOperator === true
     && imp.user.supportTenant === "WhistlePig Whiskey");
  // The impersonation token must actually work against tenant data
  const impH = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${imp.token}` });
  const impIncs = await fetch(`${B}/api/incidents`, { headers: impH() });
  ok("impersonation token can read tenant data", impIncs.status === 200);
  // Impersonating a non-existent tenant must 404
  const impBad = await fetch(`${B}/api/op/impersonate`, { method: "POST", headers: opH(),
    body: JSON.stringify({ tenantId: 99999 }) });
  ok("impersonate unknown tenant 404s", impBad.status === 404);

  // ── forgot-password: must never reveal whether an account exists ──
  const fgReal = await fetch(`${B}/api/auth/forgot`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "ahren@whistlepig.com" }) });
  const fgFake = await fetch(`${B}/api/auth/forgot`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "nobody@nowhere.test" }) });
  ok("forgot-password does not enumerate accounts",
     fgReal.status === fgFake.status && JSON.stringify(await fgReal.json()) === JSON.stringify(await fgFake.json()));

  // ── departments + response checklists + directory (previously untested) ──
  const dept = await fetch(`${B}/api/departments`, { method: "POST", headers: H(),
    body: JSON.stringify({ name: "Cooperage" }) }).then(j);
  ok("department create", !!dept.id);
  const deptUpd = await fetch(`${B}/api/departments/${dept.id}`, { method: "PUT", headers: H(),
    body: JSON.stringify({ name: "Cooperage & Barrels" }) });
  ok("department update", deptUpd.status === 200);

  const rcPut = await fetch(`${B}/api/response-checklists/spill`, { method: "PUT", headers: H(),
    body: JSON.stringify({ items: ["Contain the spill", "Ventilate", ""] }) });
  const rcGet = await fetch(`${B}/api/response-checklists`, { headers: H() }).then(j);
  ok("response checklist upsert + blank filtered",
     rcPut.status === 200 && Array.isArray(rcGet.spill) && rcGet.spill.length === 2);

  const dir = await fetch(`${B}/api/users/directory`, { headers: sH }).then(j);
  ok("staff can read user directory", Array.isArray(dir) && dir.length > 0);

  // ── Input validation (invalid enums used to be silently accepted; bad FK leaked a stack trace) ──
  const badType = await fetch(`${B}/api/incidents`, { method: "POST", headers: H(),
    body: JSON.stringify({ type: "NOT_A_REAL_TYPE" }) });
  ok("invalid incident type rejected", badType.status === 400);
  const badSev = await fetch(`${B}/api/incidents`, { method: "POST", headers: H(),
    body: JSON.stringify({ type: "injury", severity: "BOGUS" }) });
  ok("invalid severity rejected", badSev.status === 400);
  const badSite = await fetch(`${B}/api/incidents`, { method: "POST", headers: H(),
    body: JSON.stringify({ type: "injury", siteId: 99999 }) });
  const badSiteBody = await badSite.json().catch(() => ({}));
  ok("cross-tenant siteId rejected cleanly (no stack trace)",
     badSite.status === 400 && !/at Object|\.cjs:/.test(JSON.stringify(badSiteBody)));
  const badStatus = await fetch(`${B}/api/incidents/${inc.id}`, { method: "PUT", headers: H(),
    body: JSON.stringify({ status: "NONSENSE" }) });
  ok("invalid status rejected on update", badStatus.status === 400);
  const noRoute = await fetch(`${B}/api/definitely-not-a-route`, { headers: H() });
  const noRouteCt = noRoute.headers.get("content-type") || "";
  ok("unknown API route returns JSON 404", noRoute.status === 404 && noRouteCt.includes("json"));

  console.log("SMOKE COMPLETE");
  process.exit(0);
})().catch(e => { console.error("SMOKE ERROR", e); process.exit(1); });
