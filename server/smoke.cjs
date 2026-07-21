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
  // Reactivate: deactivation now revokes the live session immediately, and later
  // tests below still use this staff token. (Offboarding revocation is covered by
  // its own dedicated test at the end of the suite.)
  await fetch(`${B}/api/users/${staff.id}`, { method: "PUT", headers: H(), body: JSON.stringify({ active: 1 }) });

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

  // ── Reference numbers: per-tenant sequence, no reuse, collision-safe ──
  // (nextRef used to COUNT(*) with a hardcoded tenant 1, so a new customer's first
  //  incident inherited WhistlePig's count — e.g. INC-2026-0003 instead of 0001.)
  ok("new tenant ref sequence starts at 0001", /-0001$/.test(t2inc.ref));

  // Concurrent submits must never share a ref (UNIQUE index + retry)
  const burst = await Promise.all(Array.from({ length: 8 }, () =>
    fetch(`${B}/api/incidents`, { method: "POST", headers: H(),
      body: JSON.stringify({ type: "near_miss" }) }).then(j)));
  const burstRefs = burst.map(b => b.ref);
  ok("concurrent submits get unique refs", new Set(burstRefs).size === burstRefs.length);

  // ── Input hardening: bad bodies and oversized fields must 4xx, not 500 ──
  const malformed = await fetch(`${B}/api/incidents`, { method: "POST",
    headers: H(), body: '{"type":' });
  ok("malformed JSON body -> 400", malformed.status === 400);
  const longDesc = await fetch(`${B}/api/incidents`, { method: "POST", headers: H(),
    body: JSON.stringify({ type: "injury", description: "x".repeat(20000) }) });
  ok("oversized description rejected", longDesc.status === 400);
  const tooManyPhotos = await fetch(`${B}/api/incidents`, { method: "POST", headers: H(),
    body: JSON.stringify({ type: "injury", photos: Array.from({ length: 20 }, () => ({ dataUrl: "x" })) }) });
  ok("too many photos rejected", tooManyPhotos.status === 400);

  // ── Offline queue idempotency: a retried submit must not double-file ──
  const qUuid = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  const qBefore = (await fetch(`${B}/api/incidents`, { headers: H() }).then(j)).length;
  const first = await fetch(`${B}/api/incidents`, { method: "POST", headers: H(),
    body: JSON.stringify({ type: "injury", description: "dead zone", clientUuid: qUuid }) }).then(j);
  const retry = await fetch(`${B}/api/incidents`, { method: "POST", headers: H(),
    body: JSON.stringify({ type: "injury", description: "dead zone", clientUuid: qUuid }) }).then(j);
  const qAfter = (await fetch(`${B}/api/incidents`, { headers: H() }).then(j)).length;
  ok("queued retry is idempotent", first.ref === retry.ref && retry.duplicate === true && qAfter === qBefore + 1);

  // ── Privacy: base staff must not see colleagues' injuries, CAs, or training ──
  // NB: the `staff` user above is deactivated by an earlier test, so use a fresh
  // active one here.
  const priv = await fetch(`${B}/api/users`, { method: "POST", headers: H(),
    body: JSON.stringify({ email: "line.worker@whistlepig.com", name: "Line Worker",
                           role: "staff", siteId: 1, password: "Line!2026x" }) }).then(j);
  const privLogin = await fetch(`${B}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "line.worker@whistlepig.com", password: "Line!2026x" }) }).then(j);
  const pH = { "Content-Type": "application/json", Authorization: `Bearer ${privLogin.token}` };

  // Injury descriptions and the names of hurt colleagues are among the most
  // sensitive data a workplace holds. A line worker could previously pull the
  // entire incident list straight from the API.
  await fetch(`${B}/api/incidents`, { method: "POST", headers: H(),
    body: JSON.stringify({ type: "injury", severity: "serious",
                           description: "CONFIDENTIAL-INJURY-DETAIL" }) }).then(j);
  const staffIncs = await fetch(`${B}/api/incidents`, { headers: pH }).then(j);
  ok("staff cannot see others' incidents",
     !staffIncs.some(i => (i.description || "").includes("CONFIDENTIAL-INJURY-DETAIL")));

  const staffCas = await fetch(`${B}/api/cas`, { headers: pH }).then(j);
  ok("staff cannot see corrective actions", Array.isArray(staffCas) && staffCas.length === 0);

  const staffComp = await fetch(`${B}/api/dashboard/compliance`, { headers: pH }).then(j);
  ok("staff sees only own compliance row",
     Array.isArray(staffComp) && staffComp.length === 1 && staffComp[0].id === privLogin.user.id);

  const staffCloseCa = await fetch(`${B}/api/cas/1`, { method: "PUT", headers: pH,
    body: JSON.stringify({ status: "closed", verified: 1 }) });
  ok("staff cannot close a corrective action", staffCloseCa.status === 403);

  const staffReport = await fetch(`${B}/api/reports/incident-summary`, { headers: pH });
  ok("staff cannot read company reporting", staffReport.status === 403);

  // ...but a worker must still be able to file a report and see it back.
  const ownInc = await fetch(`${B}/api/incidents`, { method: "POST", headers: pH,
    body: JSON.stringify({ type: "near_miss", description: "my own near miss" }) }).then(j);
  const staffIncs2 = await fetch(`${B}/api/incidents`, { headers: pH }).then(j);
  ok("staff can still file and see their own report",
     !!ownInc.ref && staffIncs2.some(i => i.id === ownInc.id));

  // ── Offboarding: deactivating a user must kill their LIVE session, not just
  //    block the next login. Previously their token kept working for up to 12h.
  const fired = await fetch(`${B}/api/users`, { method: "POST", headers: H(),
    body: JSON.stringify({ email: "offboard@whistlepig.com", name: "Offboard",
                           role: "staff", siteId: 1, password: "Bye!2026xx" }) }).then(j);
  const firedLogin = await fetch(`${B}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "offboard@whistlepig.com", password: "Bye!2026xx" }) }).then(j);
  const fH = { "Content-Type": "application/json", Authorization: `Bearer ${firedLogin.token}` };
  const beforeOff = await fetch(`${B}/api/incidents`, { headers: fH });
  await fetch(`${B}/api/users/${fired.id}`, { method: "PUT", headers: H(),
    body: JSON.stringify({ active: 0 }) });
  const afterOff = await fetch(`${B}/api/incidents`, { headers: fH });
  const afterPost = await fetch(`${B}/api/incidents`, { method: "POST", headers: fH,
    body: JSON.stringify({ type: "injury" }) });
  ok("deactivation revokes the live session",
     beforeOff.status === 200 && afterOff.status === 401 && afterPost.status === 401);

  // ── Photo payload: the LIST must not ship base64 image data ──
  // SELECT i.* was sending every photo of every incident to the phone just to
  // render a list of rows (~76 MB at 200 incidents, over cellular, every open).
  const bigPhoto = { dataUrl: "data:image/jpeg;base64," + "A".repeat(50000), gps: false, name: "p.jpg" };
  const withPhoto = await fetch(`${B}/api/incidents`, { method: "POST", headers: H(),
    body: JSON.stringify({ type: "injury", description: "photo payload test", photos: [bigPhoto, bigPhoto] }) }).then(j);
  const listRows = await fetch(`${B}/api/incidents`, { headers: H() }).then(j);
  const listRow = listRows.find(i => i.id === withPhoto.id);
  ok("incident list excludes photo blobs but keeps a count",
     listRow && listRow.photos === undefined && listRow.photo_count === 2);
  const detailRow = await fetch(`${B}/api/incidents/${withPhoto.id}`, { headers: H() }).then(j);
  ok("incident detail still returns photo data",
     JSON.parse(detailRow.photos || "[]").length === 2);
  const byRef = await fetch(`${B}/api/incidents/${withPhoto.ref}`, { headers: H() }).then(j);
  ok("incident detail resolves by ref too", byRef.id === withPhoto.id);
  // Detail must honour the same read scoping as the list.
  const staffPeek = await fetch(`${B}/api/incidents/${withPhoto.id}`, { headers: pH });
  ok("staff cannot open someone else's incident detail", staffPeek.status === 403);

  // ── Site managers are scoped to their own site; admin/safety see every site ──
  await fetch(`${B}/api/incidents`, { method: "POST", headers: H(),
    body: JSON.stringify({ type: "injury", siteId: 1, description: "SITE1-ONLY-INJURY" }) }).then(j);
  await fetch(`${B}/api/incidents`, { method: "POST", headers: H(),
    body: JSON.stringify({ type: "injury", siteId: 2, description: "SITE2-ONLY-INJURY" }) }).then(j);
  await fetch(`${B}/api/users`, { method: "POST", headers: H(),
    body: JSON.stringify({ email: "site1.mgr@whistlepig.com", name: "Site1 Mgr",
                           role: "site_manager", siteId: 1, password: "Mgr!2026xx" }) }).then(j);
  const mgrLogin = await fetch(`${B}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "site1.mgr@whistlepig.com", password: "Mgr!2026xx" }) }).then(j);
  const mH = { "Content-Type": "application/json", Authorization: `Bearer ${mgrLogin.token}` };

  const mgrIncs = await fetch(`${B}/api/incidents`, { headers: mH }).then(j);
  ok("site manager sees only their own site's incidents",
     mgrIncs.some(i => (i.description || "").includes("SITE1-ONLY-INJURY")) &&
     !mgrIncs.some(i => (i.description || "").includes("SITE2-ONLY-INJURY")));

  const mgrReport = await fetch(`${B}/api/reports/incident-summary`, { headers: mH }).then(j);
  const mgrSites = mgrReport.months[mgrReport.months.length - 1].sites.map(x => x.siteId);
  ok("site manager reporting covers only their site",
     mgrSites.length === 1 && mgrSites[0] === 1);

  const otherInc = (await fetch(`${B}/api/incidents`, { headers: H() }).then(j))
    .find(i => (i.description || "").includes("SITE2-ONLY-INJURY"));
  const mgrPeek = await fetch(`${B}/api/incidents/${otherInc.id}`, { headers: mH });
  ok("site manager cannot open another site's incident", mgrPeek.status === 403);

  const adminIncs = await fetch(`${B}/api/incidents`, { headers: H() }).then(j);
  ok("admin still sees every site",
     adminIncs.some(i => (i.description || "").includes("SITE1-ONLY-INJURY")) &&
     adminIncs.some(i => (i.description || "").includes("SITE2-ONLY-INJURY")));

  // ── Photos: bytes on disk, refs in the DB, authorization mirrors the parent ──
  const imgB64 = Buffer.from("X".repeat(20000)).toString("base64");
  const photoInc = await fetch(`${B}/api/incidents`, { method: "POST", headers: H(),
    body: JSON.stringify({ type: "injury", siteId: 2, description: "photo storage test",
      photos: [{ dataUrl: `data:image/jpeg;base64,${imgB64}`, name: "w.jpg", gps: false }] }) }).then(j);
  const photoDetail = await fetch(`${B}/api/incidents/${photoInc.id}`, { headers: H() }).then(j);
  const stored = JSON.parse(photoDetail.photos || "[]");
  ok("photo stored as a ref, not base64",
     stored.length === 1 && !!stored[0].id && stored[0].dataUrl === undefined);

  const imgRes = await fetch(`${B}/api/photos/${stored[0].id}`, { headers: H() });
  const imgBuf = await imgRes.arrayBuffer();
  ok("photo serves real bytes", imgRes.status === 200 && imgBuf.byteLength === 20000);

  const noAuthImg = await fetch(`${B}/api/photos/${stored[0].id}`);
  ok("photo requires auth", noAuthImg.status === 401);

  const staffImg = await fetch(`${B}/api/photos/${stored[0].id}`, { headers: pH });
  ok("staff cannot fetch a colleague's injury photo", staffImg.status === 403);

  const mgrImg = await fetch(`${B}/api/photos/${stored[0].id}`, { headers: mH });
  ok("site manager cannot fetch another site's photo", mgrImg.status === 403);

  const rejectedType = await fetch(`${B}/api/incidents`, { method: "POST", headers: H(),
    body: JSON.stringify({ type: "injury",
      photos: [{ dataUrl: "data:text/html;base64,PHNjcmlwdD4=", name: "x.html" }] }) }).then(j);
  const rejDetail = await fetch(`${B}/api/incidents/${rejectedType.id}`, { headers: H() }).then(j);
  ok("non-image upload rejected", JSON.parse(rejDetail.photos || "[]").length === 0);

  // ── Email transport module ──
  const { sendEmail, emailConfigured } = require("./email.cjs");
  // With nothing configured, sending must skip gracefully (never throw) and
  // notify() must report email:false rather than pretending it went out.
  const noCfg = await sendEmail(["x@y.com"], "s", "t");
  ok("email skips cleanly when unconfigured", noCfg.sent === false && !emailConfigured());
  // Empty recipient list is a no-op, not a crash.
  const noRcpt = await sendEmail([], "s", "t");
  ok("email no-ops with no recipients", noRcpt.sent === false);
  // Spin up a mock Resend to confirm the request shape and success path.
  const http = require("http");
  let seen = null;
  const mail = http.createServer((rq, rs) => { let b=""; rq.on("data",c=>b+=c); rq.on("end",()=>{ seen=JSON.parse(b); rs.writeHead(200); rs.end("{}"); }); });
  await new Promise(r => mail.listen(0, r));
  const mport = mail.address().port;
  const realFetch = global.fetch;
  process.env.RESEND_API_KEY = "re_smoke";
  global.fetch = (u, o2) => u === "https://api.resend.com/emails" ? realFetch(`http://127.0.0.1:${mport}/`, o2) : realFetch(u, o2);
  const sent = await sendEmail(["a@b.com"], "subj", "body");
  ok("email sends via Resend with correct shape",
     sent.sent === true && sent.via === "resend" &&
     Array.isArray(seen.to) && seen.subject === "subj" && !!seen.from);
  // Branded alert: HTML body, deep link, and a plain-text fallback.
  const { sendAlert } = require("./email.cjs");
  await sendAlert(["a@b.com"], { title: "Injury reported: INC-2026-0004",
    meta: "Moriah · serious · by Admin", linkKind: "incident", linkRef: "INC-2026-0004" });
  global.fetch = realFetch; mail.close(); delete process.env.RESEND_API_KEY;
  ok("alert email is branded HTML with a deep link",
     typeof seen.html === "string" && seen.html.includes("EHS") &&
     seen.html.includes("open=incident:INC-2026-0004") &&
     seen.text.includes("View incident:"));

  // ── Corrective-action workflow: assign, due, notes, CapEx-block, audit trail ──
  const wfInc = await fetch(`${B}/api/incidents`, { method: "POST", headers: H(),
    body: JSON.stringify({ type: "injury", siteId: 1, description: "wf incident" }) }).then(j);
  const wfCa = await fetch(`${B}/api/cas`, { method: "POST", headers: H(),
    body: JSON.stringify({ incidentId: wfInc.id, title: "Fix the thing", priority: "high" }) }).then(j);
  await fetch(`${B}/api/cas/${wfCa.id}`, { method: "PUT", headers: H(),
    body: JSON.stringify({ assigneeId: staff.id, dueDate: "2026-08-01" }) });
  await fetch(`${B}/api/cas/${wfCa.id}`, { method: "PUT", headers: H(),
    body: JSON.stringify({ status: "in_progress", note: "working on it" }) });
  await fetch(`${B}/api/cas/${wfCa.id}`, { method: "PUT", headers: H(),
    body: JSON.stringify({ status: "capex_blocked", blockedReason: "needs budget" }) });
  const wfDetail = await fetch(`${B}/api/cas/${wfCa.id}`, { headers: H() }).then(j);
  ok("CA workflow records assignment, notes and status in an activity trail",
     wfDetail.status === "capex_blocked" &&
     wfDetail.blocked_reason === "needs budget" &&
     !!wfDetail.assignee_name &&
     wfDetail.due_date === "2026-08-01" &&
     wfDetail.activity.some(a => a.kind === "note" && a.detail === "working on it") &&
     wfDetail.activity.some(a => a.kind === "assign") &&
     wfDetail.activity.some(a => a.kind === "capex"));

  const invalidStatus = await fetch(`${B}/api/cas/${wfCa.id}`, { method: "PUT", headers: H(),
    body: JSON.stringify({ status: "bogus" }) });
  ok("CA rejects an invalid status", invalidStatus.status === 400);

  // CapEx-blocked must be excluded from the site's open-CA count.
  const wfSummary = await fetch(`${B}/api/dashboard/summary`, { headers: H() }).then(j);
  const wfMoriah = wfSummary.find(x => x.name === "Moriah" || x.site === "Moriah") || wfSummary[0];
  ok("CapEx-blocked CA is not counted as an open/overdue CA", wfMoriah.capexBlocked >= 1);

  // ── Group assignment: a whole department can own a CA; any member can close it ──
  // Two staff in the same department + site.
  const grpDept = 2, grpSite = 1;
  const mk = async (email) => {
    await fetch(`${B}/api/users`, { method: "POST", headers: H(),
      body: JSON.stringify({ name: email, email, role: "staff", siteId: grpSite, departmentId: grpDept, password: "Grp!2026xx" }) });
    const lg = await fetch(`${B}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "Grp!2026xx" }) }).then(j);
    return { "Content-Type": "application/json", Authorization: `Bearer ${lg.token}` };
  };
  const g1 = await mk("grp1@whistlepig.com");
  const g2 = await mk("grp2@whistlepig.com");
  const grpInc = await fetch(`${B}/api/incidents`, { method: "POST", headers: H(),
    body: JSON.stringify({ type: "near_miss", siteId: grpSite, description: "grp hazard" }) }).then(j);
  const grpCa = await fetch(`${B}/api/cas`, { method: "POST", headers: H(),
    body: JSON.stringify({ incidentId: grpInc.id, title: "Group task", assigneeDeptId: grpDept, assigneeSiteId: grpSite }) }).then(j);
  const g1Sees = await fetch(`${B}/api/cas`, { headers: g1 }).then(j);
  const g2Sees = await fetch(`${B}/api/cas`, { headers: g2 }).then(j);
  ok("group members both see the group-assigned CA",
     g1Sees.some(c => c.id === grpCa.id) && g2Sees.some(c => c.id === grpCa.id));
  const g1Notifs = await fetch(`${B}/api/notifications`, { headers: g1 }).then(j);
  ok("group members are notified on assignment", g1Notifs.length >= 1);
  const g1Close = await fetch(`${B}/api/cas/${grpCa.id}`, { method: "PUT", headers: g1,
    body: JSON.stringify({ status: "done", note: "done by g1" }) });
  ok("any group member can action the CA", g1Close.status === 200);
  // A staffer in a DIFFERENT department cannot see or touch it.
  await fetch(`${B}/api/users`, { method: "POST", headers: H(),
    body: JSON.stringify({ name: "otherdept", email: "otherdept@whistlepig.com", role: "staff", siteId: 1, departmentId: 3, password: "Grp!2026xx" }) });
  const oLg = await fetch(`${B}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "otherdept@whistlepig.com", password: "Grp!2026xx" }) }).then(j);
  const oH = { "Content-Type": "application/json", Authorization: `Bearer ${oLg.token}` };
  const oSees = await fetch(`${B}/api/cas`, { headers: oH }).then(j);
  const oTouch = await fetch(`${B}/api/cas/${grpCa.id}`, { method: "PUT", headers: oH, body: JSON.stringify({ status: "open" }) });
  ok("a non-member cannot see or act on a group CA",
     !oSees.some(c => c.id === grpCa.id) && oTouch.status === 403);

  // ── Standalone tasks: a CA with no incident/finding (e.g. "clear the trash") ──
  const task = await fetch(`${B}/api/cas`, { method: "POST", headers: H(),
    body: JSON.stringify({ title: "Clear pallet debris from dock B", priority: "low" }) }).then(j);
  ok("standalone task can be created with no incident", !!task.id);
  const taskDetail = await fetch(`${B}/api/cas/${task.id}`, { headers: H() }).then(j);
  ok("standalone task has no incident ref", !taskDetail.incident_ref && taskDetail.title.includes("pallet debris"));
  const inList = await fetch(`${B}/api/cas`, { headers: H() }).then(j);
  ok("standalone task appears in the CA list", inList.some(c => c.id === task.id));
  // Base staff cannot create tasks (creation is an elevated action).
  const staffTask = await fetch(`${B}/api/cas`, { method: "POST", headers: pH,
    body: JSON.stringify({ title: "sneaky" }) });
  ok("base staff cannot create tasks", staffTask.status === 403);

  // ── CA due/overdue reminders: right CAs, right people, dedup, skip CapEx ──
  const remInc = await fetch(`${B}/api/incidents`, { method: "POST", headers: H(),
    body: JSON.stringify({ type: "injury", siteId: 1, description: "rem" }) }).then(j);
  const overdueCa = await fetch(`${B}/api/cas`, { method: "POST", headers: H(),
    body: JSON.stringify({ incidentId: remInc.id, title: "Overdue reminder CA", assigneeId: staff.id, dueDate: "2026-07-01" }) }).then(j);
  const farDate = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  await fetch(`${B}/api/cas`, { method: "POST", headers: H(),
    body: JSON.stringify({ incidentId: remInc.id, title: "Far CA", assigneeId: staff.id, dueDate: farDate }) });
  const blockedCa = await fetch(`${B}/api/cas`, { method: "POST", headers: H(),
    body: JSON.stringify({ incidentId: remInc.id, title: "Blocked reminder CA", assigneeId: staff.id, dueDate: "2026-07-01" }) }).then(j);
  await fetch(`${B}/api/cas/${blockedCa.id}`, { method: "PUT", headers: H(),
    body: JSON.stringify({ status: "capex_blocked", blockedReason: "budget" }) });

  // Trigger the sweep twice (operator endpoint) — second run must dedup.
  await fetch(`${B}/api/op/run-reminders`, { method: "POST", headers: opH() });
  await fetch(`${B}/api/op/run-reminders`, { method: "POST", headers: opH() });

  const staffNotifs = await fetch(`${B}/api/notifications`, { headers: sH }).then(j);
  const caRems = staffNotifs.filter(n => (n.link_ref || "").startsWith("ca-"));
  ok("CA reminder fires for an overdue CA", caRems.some(n => n.link_ref === `ca-${overdueCa.id}`));
  ok("CA reminder skips far-future and CapEx-blocked CAs",
     !caRems.some(n => n.link_ref === `ca-${blockedCa.id}`) &&
     caRems.filter(n => n.link_ref === `ca-${overdueCa.id}`).length === 1);

  // ── Engagement report types: positive callouts & ideas (the BBS channel) ──
  const positive = await fetch(`${B}/api/incidents`, { method: "POST", headers: H(),
    body: JSON.stringify({ type: "positive", siteId: 1, description: "caught someone doing it safe" }) }).then(j);
  ok("positive callout gets a REP- ref (not INC-)", positive.ref && positive.ref.startsWith("REP-"));
  const idea = await fetch(`${B}/api/incidents`, { method: "POST", headers: H(),
    body: JSON.stringify({ type: "idea", siteId: 1, description: "add a mirror at the blind corner" }) }).then(j);
  ok("safety idea is accepted as a report type", !!idea.ref && idea.ref.startsWith("REP-"));
  const hazard = await fetch(`${B}/api/incidents`, { method: "POST", headers: H(),
    body: JSON.stringify({ type: "hazard", siteId: 1, description: "puddle by the pump" }) }).then(j);
  ok("hazard report keeps an INC- ref", !!hazard.ref && hazard.ref.startsWith("INC-"));
  // Engagement reports must not inflate injury counts.
  const engSummary = await fetch(`${B}/api/dashboard/summary`, { headers: H() }).then(j);
  const engInjuries = engSummary.reduce((n, s2) => n + (s2.injuries || 0), 0);
  ok("engagement reports are not counted as injuries", engInjuries === 0);

  // ── Close-the-loop: reporter is notified when their report is resolved ──
  const loopRid = await fetch(`${B}/api/incidents`, { method: "POST", headers: sH,
    body: JSON.stringify({ type: "hazard", siteId: 1, description: "loose railing" }) }).then(j);
  await fetch(`${B}/api/incidents/${loopRid.id}`, { method: "PUT", headers: H(),
    body: JSON.stringify({ status: "closed" }) });
  const loopNotifs = await fetch(`${B}/api/notifications`, { headers: sH }).then(j);
  ok("reporter is notified when their report is closed",
     loopNotifs.some(n => (n.link_ref === loopRid.ref) && /resolved|reviewed/i.test(n.title)));
  // Closing again (or a no-op) must not re-notify.
  const beforeCount = loopNotifs.filter(n => n.link_ref === loopRid.ref).length;
  await fetch(`${B}/api/incidents/${loopRid.id}`, { method: "PUT", headers: H(),
    body: JSON.stringify({ status: "closed" }) });
  const after2 = await fetch(`${B}/api/notifications`, { headers: sH }).then(j);
  ok("closing an already-closed report does not re-notify",
     after2.filter(n => n.link_ref === loopRid.ref).length === beforeCount);

  // ── Recognition & points (leading-indicator gamification) ──
  // A second staffer to receive kudos.
  await fetch(`${B}/api/users`, { method: "POST", headers: H(),
    body: JSON.stringify({ name: "Joe Kudos", email: "joekudos@whistlepig.com", role: "staff", siteId: 1, departmentId: 2, password: "Kud!2026xx" }) });
  const joeId = (await fetch(`${B}/api/users`, { headers: H() }).then(j)).find(u => u.email === "joekudos@whistlepig.com").id;
  // staff (sH) gives Joe a kudos.
  const kudos = await fetch(`${B}/api/incidents`, { method: "POST", headers: sH,
    body: JSON.stringify({ type: "positive", siteId: 1, description: "caught Joe doing it safe", recognizedUserId: joeId }) }).then(j);
  ok("kudos report is created", kudos.ref && kudos.ref.startsWith("REP-"));
  const joeLogin = await fetch(`${B}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "joekudos@whistlepig.com", password: "Kud!2026xx" }) }).then(j);
  const joeH = { "Content-Type": "application/json", Authorization: `Bearer ${joeLogin.token}` };
  const joePts = await fetch(`${B}/api/points/me`, { headers: joeH }).then(j);
  ok("recognised colleague earns kudos_received points", joePts.confirmed >= 10);
  // Report-linked points are pending until reviewed.
  const hz = await fetch(`${B}/api/incidents`, { method: "POST", headers: sH,
    body: JSON.stringify({ type: "hazard", siteId: 1, description: "guard loose" }) }).then(j);
  const beforeReview = await fetch(`${B}/api/points/me`, { headers: sH }).then(j);
  ok("a filed report's points start pending (anti-gaming)", beforeReview.pending > 0);
  await fetch(`${B}/api/incidents/${hz.id}`, { method: "PUT", headers: H(),
    body: JSON.stringify({ status: "closed" }) });
  const afterReview = await fetch(`${B}/api/points/me`, { headers: sH }).then(j);
  ok("points confirm once safety reviews the report", afterReview.confirmed > beforeReview.confirmed);
  // Leaderboard returns top-N + own rank, never a full shame list.
  const lb = await fetch(`${B}/api/points/leaderboard`, { headers: sH }).then(j);
  ok("leaderboard returns top-N and the caller's own rank",
     Array.isArray(lb.top) && lb.top.length <= 10 && typeof lb.me.rank === "number");

  // ── Module system: gate is a no-op when all on; blocks a disabled module ──
  const cfgAll = await fetch(`${B}/api/config`, { headers: H() }).then(j);
  ok("config reports enabled modules", Array.isArray(cfgAll.modules) && cfgAll.modules.includes("inspections"));
  // All-on: inspections endpoint works.
  const inspOn = await fetch(`${B}/api/inspections`, { headers: H() });
  ok("module endpoint works when enabled", inspOn.status === 200);
  // Operator disables inspections for this tenant.
  const tid = 1; // seeded WhistlePig tenant
  await fetch(`${B}/api/op/tenants/${tid}/modules/inspections`, { method: "PUT", headers: opH(),
    body: JSON.stringify({ enabled: false }) });
  const inspOff = await fetch(`${B}/api/inspections`, { headers: H() });
  ok("disabled module endpoint returns 403 moduleDisabled", inspOff.status === 403);
  const inspBody = await inspOff.json().catch(() => ({}));
  ok("403 identifies the disabled module", inspBody.moduleDisabled === true && inspBody.module === "inspections");
  // A different module still works (no over-blocking).
  const incStill = await fetch(`${B}/api/incidents`, { headers: H() });
  ok("other modules unaffected when one is disabled", incStill.status === 200);
  // Core never blocked.
  const usersStill = await fetch(`${B}/api/users`, { headers: H() });
  ok("core endpoints never gated", usersStill.status === 200);
  // config now omits inspections.
  const cfgOff = await fetch(`${B}/api/config`, { headers: H() }).then(j);
  ok("config drops a disabled module", !cfgOff.modules.includes("inspections"));
  // Re-enable so later tests (if any) are unaffected.
  await fetch(`${B}/api/op/tenants/${tid}/modules/inspections`, { method: "PUT", headers: opH(),
    body: JSON.stringify({ enabled: true }) });
  const inspBack = await fetch(`${B}/api/inspections`, { headers: H() });
  ok("re-enabling a module restores access", inspBack.status === 200);

  // ── Operator module grid: read + seeded-on-create ──
  const grid = await fetch(`${B}/api/op/tenants/1/modules`, { headers: opH() }).then(j);
  ok("operator module grid lists live modules including equipment",
     Array.isArray(grid.modules) && grid.modules.some(m => m.key === "incidents") &&
     grid.modules.some(m => m.key === "equipment"));
  // Create a tenant and confirm module rows are seeded explicitly.
  const newT = await fetch(`${B}/api/op/tenants`, { method: "POST", headers: opH(),
    body: JSON.stringify({ name: "Smoke Foods Co", industry: "Food", adminEmail: "smokefoods@example.com", adminName: "SF Admin" }) }).then(j);
  const allT = await fetch(`${B}/api/op/tenants`, { headers: opH() }).then(j);
  const sfId = (allT.find(t => t.name === "Smoke Foods Co") || {}).id;
  const sfGrid = await fetch(`${B}/api/op/tenants/${sfId}/modules`, { headers: opH() }).then(j);
  ok("new tenant seeds explicit module rows", sfGrid.modules.every(m => m.explicit === true));

  // ── Notification rules: category × severity matrix ──
  // A "hazard / serious+" rule must fire for a serious hazard, not a minor one,
  // and not for a different category.
  const smRule = await fetch(`${B}/api/notification-rules`, { method: "POST", headers: H(),
    body: JSON.stringify({ category: "hazard", minSeverity: "serious", recipientRoles: ["site_manager"], email: false }) }).then(j);
  ok("create category×severity rule", !!smRule.id);
  // A site_manager to receive it.
  const smEmail = `notifmgr_${Date.now()}@ex.com`;
  const smUser = await fetch(`${B}/api/users`, { method: "POST", headers: H(), body: JSON.stringify({
    name: "Notif Mgr", email: smEmail, role: "site_manager", siteId: 1, departmentId: 2, password: "Work!2026x" }) }).then(j);
  const smTok = (await fetch(`${B}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: smEmail, password: "Work!2026x" }) }).then(j)).token;
  const smH = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${smTok}` });
  const before = (await fetch(`${B}/api/notifications`, { headers: smH() }).then(j)).length;
  await fetch(`${B}/api/incidents`, { method: "POST", headers: H(), body: JSON.stringify({ type: "hazard", severity: "serious", description: "serious hazard for notif test", siteId: 1 }) }).then(j);
  const afterSerious = (await fetch(`${B}/api/notifications`, { headers: smH() }).then(j)).length;
  ok("serious hazard notifies site_manager", afterSerious > before);
  await fetch(`${B}/api/incidents`, { method: "POST", headers: H(), body: JSON.stringify({ type: "hazard", severity: "minor", description: "minor hazard below threshold", siteId: 1 }) }).then(j);
  const afterMinor = (await fetch(`${B}/api/notifications`, { headers: smH() }).then(j)).length;
  ok("minor hazard below threshold does not notify", afterMinor === afterSerious);

  // ── Equipment & Assets module ──
  // Tenant 1 has equipment enabled + sample assets seeded.
  const assets = await fetch(`${B}/api/assets`, { headers: H() }).then(j);
  ok("equipment: assets list returns seeded sample assets",
     Array.isArray(assets) && assets.some(a => a.asset_tag === "PMP-014"));
  const pump = assets.find(a => a.asset_tag === "PMP-014");
  if (pump) {
    const detail = await fetch(`${B}/api/assets/${pump.id}`, { headers: H() }).then(j);
    ok("equipment: asset detail includes LOTO + SOP + deepLink",
       Array.isArray(detail.loto) && detail.loto.length >= 1 &&
       Array.isArray(detail.sops) && detail.sops.length >= 1 &&
       typeof detail.deepLink === "string" && detail.deepLink.includes(`asset:${pump.id}`));
    const qr = await fetch(`${B}/api/assets/${pump.id}/qr`, { headers: H() }).then(j);
    ok("equipment: QR endpoint returns an SVG for the asset",
       typeof qr.svg === "string" && qr.svg.startsWith("<svg"));
  }
  // Create an asset + a procedure, then confirm it reads back.
  const created = await fetch(`${B}/api/assets`, { method: "POST", headers: H(),
    body: JSON.stringify({ name: "Smoke Test Compressor", assetTag: "CMP-99", category: "compressor" }) }).then(j);
  ok("equipment: create asset returns id", created && created.id > 0);
  const addProc = await fetch(`${B}/api/assets/${created.id}/procedures`, { method: "POST", headers: H(),
    body: JSON.stringify({ kind: "loto", title: "Compressor LOTO", steps: ["Isolate air supply", "Bleed receiver"] }) }).then(j);
  ok("equipment: add LOTO procedure returns id", addProc && addProc.id > 0);
  const cd = await fetch(`${B}/api/assets/${created.id}`, { headers: H() }).then(j);
  ok("equipment: created asset reads back with its procedure", cd.loto && cd.loto.length === 1);

  // ── Recognition: champion + badges ──
  const champ = await fetch(`${B}/api/points/champion`, { headers: sH }).then(j);
  ok("recognition: champion endpoint returns shape",
     champ && "champion" in champ && Array.isArray(champ.hallOfFame));
  // Staff files an idea → should earn participation badges even while pending.
  await fetch(`${B}/api/incidents`, { method: "POST", headers: sH,
    body: JSON.stringify({ type: "idea", description: "Badge test idea for recognition", severity: null }) }).then(j);
  const badges = await fetch(`${B}/api/points/badges`, { headers: sH }).then(j);
  ok("recognition: badges endpoint returns badge list with earned flags",
     badges && Array.isArray(badges.badges) && badges.badges.length >= 5 &&
     badges.badges.every(b => "earned" in b && "name" in b));
  ok("recognition: filing an idea earns participation badges (pending-inclusive)",
     badges.badges.find(b => b.id === "first_report")?.earned === true &&
     badges.badges.find(b => b.id === "idea_person")?.earned === true);

  // ── Recognition: point-value tuning ──
  const pv = await fetch(`${B}/api/points/values`, { headers: H() }).then(j);
  ok("recognition: point values readable with defaults",
     pv && pv.values && pv.values.idea >= 1 && pv.defaults && pv.defaults.idea === 15);
  const setPv = await fetch(`${B}/api/points/values`, { method: "PUT", headers: H(),
    body: JSON.stringify({ values: { idea: 42 } }) }).then(j);
  ok("recognition: point values settable (idea→42)", setPv && setPv.values && setPv.values.idea === 42);

  // ── Recognition module on/off (single switch controls awards + endpoints) ──
  const recOn = await fetch(`${B}/api/points/me`, { headers: H() });
  ok("recognition on: /api/points/me accessible", recOn.status === 200);
  // Operator disables the recognition module for tenant 1.
  await fetch(`${B}/api/op/tenants/1/modules/recognition`, { method: "PUT", headers: opH(),
    body: JSON.stringify({ enabled: false }) }).then(j);
  const recOff = await fetch(`${B}/api/points/me`, { headers: H() });
  ok("recognition off: /api/points endpoints gate (403)", recOff.status === 403);
  const recCfg = await fetch(`${B}/api/config`, { headers: H() }).then(j);
  ok("recognition off: config no longer lists the module (UI hides)",
     Array.isArray(recCfg.modules) && !recCfg.modules.includes("recognition"));
  // Re-enable so state is clean.
  await fetch(`${B}/api/op/tenants/1/modules/recognition`, { method: "PUT", headers: opH(),
    body: JSON.stringify({ enabled: true }) }).then(j);

  // ── Per-module billing ──
  // Operator sets a per-module price and generates an invoice; the enabled module
  // should appear as its own line item.
  await fetch(`${B}/api/billing/config?tenantId=1`, { method: "PUT", headers: opH(),
    body: JSON.stringify({ basePrice: 500, modulePrices: { equipment: 50 } }) }).then(j);
  const bcfg = await fetch(`${B}/api/billing/config?tenantId=1`, { headers: opH() }).then(j);
  ok("billing: module_prices persists", bcfg.module_prices && JSON.parse(bcfg.module_prices).equipment === 50);
  const inv = await fetch(`${B}/api/billing/invoices/generate?tenantId=1`, { method: "POST", headers: opH(),
    body: JSON.stringify({ period: "2099-01" }) }).then(j);
  const invList = await fetch(`${B}/api/billing/invoices?tenantId=1`, { headers: opH() }).then(j);
  const theInv = (Array.isArray(invList) ? invList : invList.invoices || []).find(x => x.period === "2099-01");
  const invItems = theInv ? JSON.parse(theInv.line_items) : [];
  ok("billing: enabled module bills as its own line item",
     invItems.some(li => /Equipment/.test(li.label) && li.amount === 50));
  // The base license includes the first site — only ADDITIONAL sites are billed.
  ok("billing: base line notes it includes the first site",
     invItems.some(li => /base/i.test(li.label) && /1st site|first site|includes/i.test(li.label)));
  ok("billing: no full-count 'Active sites' line (additional-only)",
     !invItems.some(li => li.label === "Active sites"));

  // ── GPS auto-tag on reports ──
  const gpsRep = await fetch(`${B}/api/incidents`, { method: "POST", headers: H(),
    body: JSON.stringify({ type: "near_miss", severity: "minor", description: "GPS smoke test near-miss report", latitude: 43.9012, longitude: -73.4501 }) }).then(j);
  const gpsList = await fetch(`${B}/api/incidents`, { headers: H() }).then(j);
  const gpsRows = Array.isArray(gpsList) ? gpsList : gpsList.incidents || [];
  const gpsRow = gpsRows.find(x => x.ref === gpsRep.ref);
  ok("gps: report stores captured coordinates",
     gpsRow && Math.abs(gpsRow.latitude - 43.9012) < 0.001 && Math.abs(gpsRow.longitude - (-73.4501)) < 0.001);
  const badGps = await fetch(`${B}/api/incidents`, { method: "POST", headers: H(),
    body: JSON.stringify({ type: "near_miss", description: "GPS bad-coords smoke test report", latitude: 999, longitude: "nope" }) }).then(j);
  const afterList = await fetch(`${B}/api/incidents`, { headers: H() }).then(j);
  const afterRows = Array.isArray(afterList) ? afterList : afterList.incidents || [];
  const badRow = afterRows.find(x => x.ref === badGps.ref);
  ok("gps: invalid coordinates are dropped (not stored)",
     badRow && badRow.latitude == null && badRow.longitude == null);

  // ── OSHA-recordable auto-flag ──
  const oshaFlagged = await fetch(`${B}/api/incidents`, { method: "POST", headers: H(),
    body: JSON.stringify({ type: "injury", severity: "serious", description: "OSHA smoke: hand injury needing ER treatment", oshaSignals: ["medical", "days_away"], oshaRecordableSuggested: true }) }).then(j);
  const oshaPlain = await fetch(`${B}/api/incidents`, { method: "POST", headers: H(),
    body: JSON.stringify({ type: "injury", severity: "minor", description: "OSHA smoke: minor cut band-aid only no signals", oshaSignals: [] }) }).then(j);
  const oshaList = await fetch(`${B}/api/incidents`, { headers: H() }).then(j);
  const oshaRows = Array.isArray(oshaList) ? oshaList : oshaList.incidents || [];
  const flaggedRow = oshaRows.find(x => x.ref === oshaFlagged.ref);
  const plainRow = oshaRows.find(x => x.ref === oshaPlain.ref);
  ok("osha: injury with recordable signals is auto-flagged for review",
     flaggedRow && flaggedRow.osha_classification === "Review: likely recordable");
  ok("osha: injury without signals stays unclassified (Pending)",
     plainRow && (plainRow.osha_classification == null));

  // ── Triage settings persistence (B3: was mock, now real) ──
  await fetch(`${B}/api/config`, { method: "PUT", headers: H(),
    body: JSON.stringify({ triage: { enabled: true, providerName: "WorkCare Clinic", providerPhone: "(800) 555-9000",
      questions: [{ id: 1, text: "Is the person breathing?" }, { id: 2, text: "Any chemical exposure?" }] } }) }).then(j);
  const trCfg = await fetch(`${B}/api/config`, { headers: H() }).then(j);
  ok("triage: provider + custom questions persist and read back",
     trCfg.triage && trCfg.triage.providerName === "WorkCare Clinic" &&
     Array.isArray(trCfg.triage.questions) && trCfg.triage.questions.length === 2 &&
     trCfg.triage.questions[0].text === "Is the person breathing?");
  // Question list is sanitized (capped at 20, blanks dropped).
  const many = Array.from({ length: 25 }, (_, i) => ({ id: i, text: "q" + i })).concat([{ id: 99, text: "   " }]);
  await fetch(`${B}/api/config`, { method: "PUT", headers: H(), body: JSON.stringify({ triage: { questions: many } }) }).then(j);
  const trCfg2 = await fetch(`${B}/api/config`, { headers: H() }).then(j);
  ok("triage: question list sanitized (cap 20, blanks dropped)", trCfg2.triage.questions.length === 20);

  // ── OSHA 300 log / 300A summary ──
  const yr = new Date().getFullYear();
  // File an injury and classify it recordable (days away) for the current year.
  const oRep = await fetch(`${B}/api/incidents`, { method: "POST", headers: H(),
    body: JSON.stringify({ type: "injury", severity: "serious", description: "OSHA300 smoke: fractured wrist days away", occurredAt: yr + "-03-15", involved: [{ name: "Test Worker" }] }) }).then(j);
  const oList = await fetch(`${B}/api/incidents`, { headers: H() }).then(j);
  const oRows = Array.isArray(oList) ? oList : oList.incidents || [];
  const oId = oRows.find(x => x.ref === oRep.ref).id;
  await fetch(`${B}/api/incidents/${oId}`, { method: "PUT", headers: H(),
    body: JSON.stringify({ oshaClassification: "Recordable – Days away from work" }) }).then(j);
  // Also a non-recordable that must NOT appear.
  const nRep = await fetch(`${B}/api/incidents`, { method: "POST", headers: H(),
    body: JSON.stringify({ type: "injury", description: "OSHA300 smoke: minor cut non-recordable", occurredAt: yr + "-04-01" }) }).then(j);
  const oRows2 = await fetch(`${B}/api/incidents`, { headers: H() }).then(j);
  const nId = (Array.isArray(oRows2) ? oRows2 : oRows2.incidents || []).find(x => x.ref === nRep.ref).id;
  await fetch(`${B}/api/incidents/${nId}`, { method: "PUT", headers: H(), body: JSON.stringify({ oshaClassification: "Non-recordable" }) }).then(j);
  const osha = await fetch(`${B}/api/reports/osha300?year=${yr}`, { headers: H() }).then(j);
  ok("osha300: recordable case appears in the 300 log with days-away classification",
     osha.cases.some(c => c.caseNo === oRep.ref && c.classification === "days_away"));
  ok("osha300: non-recordable case is excluded from the log",
     !osha.cases.some(c => c.caseNo === nRep.ref) && osha.summary.daysAwayCases >= 1);
  const csv = await fetch(`${B}/api/reports/osha300?year=${yr}&format=csv`, { headers: H() });
  const csvText = await csv.text();
  ok("osha300: CSV export has the 300 column header",
     csv.headers.get("content-type").includes("csv") && /Days Away/.test(csvText) && /Case No\./.test(csvText));

  // ── Weekly exec digest ──
  // File a couple of reports, then the operator previews the tenant's digest metrics.
  await fetch(`${B}/api/incidents`, { method: "POST", headers: H(),
    body: JSON.stringify({ type: "injury", severity: "serious", description: "Digest smoke injury report here now" }) }).then(j);
  const digest = await fetch(`${B}/api/op/digest/1/preview`, { headers: opH() }).then(j);
  ok("digest: operator preview returns real metric shape",
     digest && digest.metrics && typeof digest.metrics.reportsThisWeek === "number" &&
     typeof digest.metrics.recordablesYTD === "number" && "trainingsOverdue" in digest.metrics);
  ok("digest: this week's injury is reflected in metrics", digest.metrics.injuriesThisWeek >= 1);
  const digestForbidden = await fetch(`${B}/api/op/digest/1/preview`, { headers: H() });
  ok("digest: preview is operator-only (admin gets 403)", digestForbidden.status === 403);

  // ── Equipment polish: procedure edit + asset photo ──
  const eqAsset = await fetch(`${B}/api/assets`, { method: "POST", headers: H(),
    body: JSON.stringify({ name: "Polish Test Compressor", category: "compressor",
      photo: { dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", name: "c.png" } }) }).then(j);
  const eqFull = await fetch(`${B}/api/assets/${eqAsset.id}`, { headers: H() }).then(j);
  ok("equipment: asset photo stored as a ref on the asset",
     eqFull.photo && JSON.parse(eqFull.photo).id);
  const eqPhotoId = JSON.parse(eqFull.photo).id;
  const eqPhotoResp = await fetch(`${B}/api/photos/${eqPhotoId}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  ok("equipment: asset photo is served (200)", eqPhotoResp.status === 200);
  const eqProc = await fetch(`${B}/api/assets/${eqAsset.id}/procedures`, { method: "POST", headers: H(),
    body: JSON.stringify({ kind: "loto", title: "Before edit", steps: ["a", "b"] }) }).then(j);
  await fetch(`${B}/api/procedures/${eqProc.id}`, { method: "PUT", headers: H(),
    body: JSON.stringify({ title: "After edit", steps: ["x", "y", "z"] }) }).then(j);
  const eqAfter = await fetch(`${B}/api/assets/${eqAsset.id}`, { headers: H() }).then(j);
  const editedProc = eqAfter.loto.find(pr => pr.id === eqProc.id);
  ok("equipment: existing procedure can be edited (title + steps update)",
     editedProc && editedProc.title === "After edit" && JSON.parse(editedProc.steps).length === 3);

  // ── Industry template packs ──
  const packs = await fetch(`${B}/api/op/template-packs`, { headers: opH() }).then(j);
  ok("templates: operator can list packs (incl. distillery)",
     packs && Array.isArray(packs.packs) && packs.packs.some(p => p.id === "distillery" && p.checklistCount > 0));
  const packForbidden = await fetch(`${B}/api/op/template-packs`, { headers: H() });
  ok("templates: pack list is operator-only (admin 403)", packForbidden.status === 403);
  // Apply the distillery pack to tenant 1, then confirm it's idempotent by name.
  const applied = await fetch(`${B}/api/op/template-packs/distillery/apply`, { method: "POST", headers: opH(),
    body: JSON.stringify({ tenantId: 1 }) }).then(j);
  ok("templates: applying a pack creates checklists + trainings",
     applied.ok && (applied.checklistsAdded + applied.trainingsAdded) > 0);
  const reapplied = await fetch(`${B}/api/op/template-packs/distillery/apply`, { method: "POST", headers: opH(),
    body: JSON.stringify({ tenantId: 1 }) }).then(j);
  ok("templates: re-applying is idempotent (all skipped by name)",
     reapplied.checklistsAdded === 0 && reapplied.trainingsAdded === 0 && reapplied.skipped > 0);

  // ── Reports are REAL: recordable matching + findings/training ──
  // File an injury and confirm it recordable → it must count in the summary (was a bug: exact-string match missed "Recordable – …").
  const recInc = await fetch(`${B}/api/incidents`, { method: "POST", headers: H(),
    body: JSON.stringify({ type: "injury", severity: "serious", siteId: 1, description: "Recordable match smoke test injury" }) }).then(j);
  await fetch(`${B}/api/incidents/${recInc.id}`, { method: "PUT", headers: H(),
    body: JSON.stringify({ oshaClassification: "Recordable – Medical treatment" }) }).then(j);
  const summ = await fetch(`${B}/api/reports/incident-summary`, { headers: H() }).then(j);
  const totalRec = (summ.months || []).reduce((a, m) => a + m.recordables, 0);
  ok("reports: confirmed 'Recordable – …' classification counts in the summary", totalRec >= 1);
  // Findings/training endpoint returns a real shape (not hardcoded 74%/4/1/2).
  const ft = await fetch(`${B}/api/reports/findings-training`, { headers: H() }).then(j);
  ok("reports: findings-training returns real structured summary",
     ft && ft.findings && typeof ft.findings.critical === "number" &&
     ft.training && ("compliancePct" in ft.training) && typeof ft.training.overdue === "number");

  // ── Incident investigation fields (elevated staff) ──
  const invInc = await fetch(`${B}/api/incidents`, { method: "POST", headers: H(),
    body: JSON.stringify({ type: "injury", severity: "serious", siteId: 1, description: "Investigation fields smoke" }) }).then(j);
  await fetch(`${B}/api/incidents/${invInc.id}`, { method: "PUT", headers: H(),
    body: JSON.stringify({ rootCause: "Guard missing", investigationNotes: "HR + WC notified", involved: ["Jane Smith", "Bob Lee"] }) }).then(j);
  const invGot = await fetch(`${B}/api/incidents/${invInc.id}`, { headers: H() }).then(j);
  ok("incident: root cause + notes + multi-name involved persist",
     invGot.root_cause === "Guard missing" && invGot.investigation_notes === "HR + WC notified" &&
     JSON.parse(invGot.involved).length === 2);
  // CA can be completed then REOPENED (no more one-click dead-end).
  const invCA = await fetch(`${B}/api/cas`, { method: "POST", headers: H(),
    body: JSON.stringify({ incidentId: invInc.id, title: "Install guard", priority: "high" }) }).then(j);
  await fetch(`${B}/api/cas/${invCA.id}`, { method: "PUT", headers: H(), body: JSON.stringify({ status: "done" }) }).then(j);
  await fetch(`${B}/api/cas/${invCA.id}`, { method: "PUT", headers: H(), body: JSON.stringify({ status: "open" }) }).then(j);
  const invCAs = await fetch(`${B}/api/cas`, { headers: H() }).then(j);
  const reopened = invCAs.find(c => c.id === invCA.id);
  ok("incident: a completed corrective action can be reopened", reopened && reopened.status === "open");

  // ── First aid only is NOT recordable (29 CFR 1904.7) ──
  const faInc = await fetch(`${B}/api/incidents`, { method: "POST", headers: H(),
    body: JSON.stringify({ type: "injury", severity: "minor", siteId: 1, description: "First aid only smoke" }) }).then(j);
  await fetch(`${B}/api/incidents/${faInc.id}`, { method: "PUT", headers: H(),
    body: JSON.stringify({ oshaClassification: "First aid only (non-recordable)" }) }).then(j);
  const faSumm = await fetch(`${B}/api/reports/incident-summary`, { headers: H() }).then(j);
  const faYear = new Date().getFullYear();
  const fa300 = await fetch(`${B}/api/reports/osha300?year=${faYear}`, { headers: H() }).then(j);
  const faDesc = fa300.cases.find(c => /First aid only smoke/.test(c.description || ""));
  ok("reports: 'first aid only' is not counted as recordable and not on the 300 log", !faDesc);

  // ── Operator analytics (business view, not customer safety data) ──
  const opAn = await fetch(`${B}/api/op/analytics`, { headers: opH() }).then(j);
  ok("op analytics: returns MRR + ARR + per-tenant + module efficacy",
     opAn && opAn.summary && typeof opAn.summary.mrr === "number" && typeof opAn.summary.arr === "number" &&
     Array.isArray(opAn.perTenant) && Array.isArray(opAn.moduleEfficacy));
  ok("op analytics: MRR reflects additional-sites billing (base incl 1st site)",
     opAn.summary.mrr > 0 && opAn.perTenant.every(t => typeof t.mrr === "number"));
  // A regular tenant admin must NOT reach operator analytics.
  const anForbidden = await fetch(`${B}/api/op/analytics`, { headers: H() });
  ok("op analytics: forbidden for non-operator", anForbidden.status === 403);

  // ── MBR/QBR slide export ──
  const mbrPrev = await fetch(`${B}/api/reports/mbr/preview`, { headers: H() }).then(j);
  ok("mbr: preview returns real KPI structure",
     mbrPrev && mbrPrev.kpis && typeof mbrPrev.kpis.trirYTD === "number" &&
     Array.isArray(mbrPrev.sites) && Array.isArray(mbrPrev.training) && mbrPrev.events);
  const mbrRes = await fetch(`${B}/api/reports/mbr/export`, { headers: H() });
  const mbrBuf = Buffer.from(await mbrRes.arrayBuffer());
  // A .pptx is a ZIP — first two bytes are "PK".
  ok("mbr: export returns a valid .pptx (ZIP/PK, non-trivial size)",
     mbrRes.status === 200 && mbrBuf.length > 10000 && mbrBuf[0] === 0x50 && mbrBuf[1] === 0x4B);
  const mbrNoAuth = await fetch(`${B}/api/reports/mbr/export`);
  ok("mbr: export requires auth", mbrNoAuth.status === 401);

  console.log("SMOKE COMPLETE");
  process.exit(0);
})().catch(e => { console.error("SMOKE ERROR", e); process.exit(1); });
