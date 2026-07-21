// MBR/QBR slide export — generates a WhistlePig-style Environmental Health &
// Safety review slide (.pptx) from REAL tenant data, so the monthly/quarterly
// deck slide is a one-click export instead of a manual re-key every period.
//
// Mounted from index.cjs: require("./mbr.cjs")(app, db, auth, requireRole, deps)
// where deps = { isRecordableClass, staffCompliance, CAN_SEE_ALL_INCIDENTS, siteScope }.

const pptxgen = require("pptxgenjs");

module.exports = function mountMbr(app, db, auth, requireRole, deps) {
  const { isRecordableClass, staffCompliance, CAN_SEE_ALL_INCIDENTS } = deps;

  // NAICS 312 (Beverage & Tobacco Mfg) BLS benchmarks — the same reference the
  // WhistlePig deck cites. Stored here so the slide can show "vs industry avg".
  const BENCH = { dart: 2.5, trir: 4.1, naics: "312" };

  // ── Gather real metrics for a period ("YYYY-MM" monthly, or a year for YTD) ──
  function gatherMbr(tenantId, period) {
    const tenant = db.prepare("SELECT name FROM tenants WHERE id = ?").get(tenantId);
    const sites = db.prepare("SELECT id, name FROM sites WHERE tenant_id = ? AND active = 1 ORDER BY id").all(tenantId);
    const now = period && /^\d{4}-\d{2}$/.test(period) ? new Date(period + "-15") : new Date();
    const year = now.getFullYear();
    const prevYear = year - 1;
    const yearStart = `${year}-01-01`;
    const prevStart = `${prevYear}-01-01`, prevEnd = `${prevYear}-12-31`;
    const periodLabel = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });

    // Recordable helper as SQL-side filter is awkward with the canonical fn, so
    // pull classifications and count in JS with the shared isRecordableClass.
    const inRange = (start, end) => {
      const rows = db.prepare(`SELECT osha_classification c, type, site_id,
                                      COALESCE(occurred_at, created_at) AS at
                               FROM incidents WHERE tenant_id = ?
                                 AND COALESCE(occurred_at, created_at) >= ?
                                 AND COALESCE(occurred_at, created_at) <= ?`)
        .all(tenantId, start, end + " 23:59:59");
      return rows;
    };
    const ytdRows = inRange(yearStart, `${year}-12-31`);
    const prevRows = inRange(prevStart, prevEnd);

    const countRecordable = rows => rows.filter(r => isRecordableClass(r.c)).length;
    const countLostTime = rows => rows.filter(r =>
      r.c === "Recordable – Days away from work" || r.c === "Recordable – Restricted work").length;

    // Hours worked YTD (actual payroll where entered, else headcount×160/mo).
    const monthsElapsed = year === new Date().getFullYear() ? (new Date().getMonth() + 1) : 12;
    const actualRows = db.prepare("SELECT site_id, month, hours FROM labor_hours WHERE tenant_id = ?").all(tenantId);
    const actualByKey = {}; actualRows.forEach(r => { actualByKey[`${r.site_id}|${r.month}`] = r.hours; });
    const hoursFor = (siteId, yr, months) => {
      const hc = db.prepare("SELECT COUNT(*) n FROM users WHERE tenant_id = ? AND site_id = ? AND active = 1 AND is_operator = 0").get(tenantId, siteId).n;
      let total = 0;
      for (let m = 1; m <= months; m++) {
        const ym = `${yr}-${String(m).padStart(2, "0")}`;
        const a = actualByKey[`${siteId}|${ym}`];
        total += a !== undefined ? a : hc * 160;
      }
      return total;
    };
    const trir = (rec, hrs) => hrs > 0 ? +((rec * 200000) / hrs).toFixed(1) : 0.0;
    const dart = (lt, hrs) => hrs > 0 ? +((lt * 200000) / hrs).toFixed(1) : 0.0;

    // Company-wide YTD hours (all sites), current vs prior year.
    const ytdHours = sites.reduce((s, st) => s + hoursFor(st.id, year, monthsElapsed), 0);
    const prevHours = sites.reduce((s, st) => s + hoursFor(st.id, prevYear, 12), 0);
    const recYTD = countRecordable(ytdRows), recPrev = countRecordable(prevRows);
    const ltYTD = countLostTime(ytdRows), ltPrev = countLostTime(prevRows);

    // Per-site: TRIR (month + YTD) and findings + % closed.
    const perSite = sites.map(st => {
      const siteYtd = ytdRows.filter(r => r.site_id === st.id);
      const siteHoursYtd = hoursFor(st.id, year, monthsElapsed);
      const monthKey = period && /^\d{4}-\d{2}$/.test(period) ? period : now.toISOString().slice(0, 7);
      const monthRows = siteYtd.filter(r => String(r.at).slice(0, 7) === monthKey);
      const monthHours = (() => {
        const a = actualByKey[`${st.id}|${monthKey}`];
        if (a !== undefined) return a;
        const hc = db.prepare("SELECT COUNT(*) n FROM users WHERE tenant_id = ? AND site_id = ? AND active = 1 AND is_operator = 0").get(tenantId, st.id).n;
        return hc * 160;
      })();
      const findings = db.prepare("SELECT COUNT(*) n FROM findings WHERE tenant_id = ? AND site_id = ?").get(tenantId, st.id).n;
      const closed = db.prepare("SELECT COUNT(*) n FROM findings WHERE tenant_id = ? AND site_id = ? AND status = 'resolved'").get(tenantId, st.id).n;
      return {
        name: st.name,
        trirMonth: trir(countRecordable(monthRows), monthHours),
        trirYTD: trir(countRecordable(siteYtd), siteHoursYtd),
        findings,
        closedPct: findings > 0 ? Math.round((closed / findings) * 100) : 0,
      };
    });

    // Training compliance by module: % of assigned staff current (not expired) per training.
    const trainings = db.prepare("SELECT id, title FROM trainings WHERE tenant_id = ? AND active = 1 ORDER BY id").all(tenantId);
    const training = trainings.map(tr => {
      const latest = db.prepare(`SELECT tc.user_id, tc.passed, tc.expires_at FROM training_completions tc
          JOIN users u ON u.id = tc.user_id AND u.active = 1 AND u.is_operator = 0
          WHERE tc.tenant_id = ? AND tc.training_id = ?
            AND tc.id IN (SELECT MAX(id) FROM training_completions WHERE training_id = tc.training_id GROUP BY user_id)`)
        .all(tenantId, tr.id);
      const current = latest.filter(r => r.passed !== 0 && (!r.expires_at || r.expires_at >= new Date().toISOString())).length;
      const pct = latest.length > 0 ? Math.round((current / latest.length) * 100) : null;
      return { module: tr.title, pct };
    }).filter(t => t.pct !== null).slice(0, 6);

    // Significant events: serious incidents (critical/serious injuries YTD) and
    // near-misses this period; plus the most recent investigation notes as
    // "achievements / risks / decisions" seed lines.
    const seriousIncidents = ytdRows.filter(r => r.type === "injury" && isRecordableClass(r.c)).length;
    const monthKey = period && /^\d{4}-\d{2}$/.test(period) ? period : now.toISOString().slice(0, 7);
    const nearMisses = db.prepare(`SELECT COUNT(*) n FROM incidents WHERE tenant_id = ? AND type = 'near_miss'
        AND strftime('%Y-%m', COALESCE(occurred_at, created_at)) = ?`).get(tenantId, monthKey).n;
    const highlightRows = db.prepare(`SELECT investigation_notes FROM incidents
        WHERE tenant_id = ? AND investigation_notes IS NOT NULL AND TRIM(investigation_notes) != ''
        ORDER BY updated_at DESC LIMIT 3`).all(tenantId);
    const highlights = highlightRows.map(r => r.investigation_notes.slice(0, 180));

    return {
      company: tenant?.name ?? "Company", periodLabel, cadence: "Monthly", year, prevYear, naics: BENCH.naics,
      benchmarks: { dart: BENCH.dart, trir: BENCH.trir },
      kpis: {
        recordablesYTD: recYTD, recordablesPrevYear: recPrev,
        lostTimeYTD: ltYTD, lostTimePrevYear: ltPrev,
        dartYTD: dart(ltYTD, ytdHours), dartPrevYear: dart(ltPrev, prevHours),
        trirYTD: trir(recYTD, ytdHours), trirPrevYear: trir(recPrev, prevHours),
      },
      sites: perSite,
      training,
      events: { seriousIncidents, nearMisses, highlights },
    };
  }

  // ── Build the .pptx from a gathered payload; returns a Node Buffer ──
  async function buildDeck(D) {
    const MAROON = "6E1423", INK = "222222", SLATE = "5A5A5A", MIST = "8A8A8A",
          LINE = "E3E3E3", WASH = "F5F1F2", GREEN = "2E7D32", AMBER = "B7791F", RED = "B3261E", WHITE = "FFFFFF";
    const pres = new pptxgen();
    pres.defineLayout({ name: "W", width: 13.333, height: 7.5 });
    pres.layout = "W";
    const slide = pres.addSlide();
    slide.background = { color: WHITE };
    const arrow = (cur, prev) => {
      if (cur === prev) return { sym: "→", col: MIST };
      const down = cur < prev;
      return { sym: down ? "▼" : "▲", col: down ? GREEN : RED };
    };

    slide.addText("Environmental Health & Safety", { x: 0.55, y: 0.35, w: 8.8, h: 0.5, fontFace: "Cambria", fontSize: 30, bold: true, color: MAROON });
    slide.addText(`${D.cadence} Business Review  ·  ${D.periodLabel}`, { x: 0.57, y: 0.9, w: 8.8, h: 0.32, fontFace: "Calibri", fontSize: 13, color: SLATE });
    slide.addText("WHISTLEPIG", { x: 9.9, y: 0.42, w: 2.9, h: 0.34, align: "right", fontFace: "Cambria", fontSize: 19, bold: true, color: INK, charSpacing: 2 });
    slide.addText("— RYE WHISKEY —", { x: 9.9, y: 0.78, w: 2.9, h: 0.22, align: "right", fontFace: "Calibri", fontSize: 9, color: MIST, charSpacing: 2 });

    const kpiY = 1.5, kpiH = 1.35, kpiW = 2.92, kpiGap = 0.16, kpiX0 = 0.55, K = D.kpis;
    const kpis = [
      { label: "Recordable Injuries", cur: K.recordablesYTD, prev: K.recordablesPrevYear, sub: `${K.recordablesPrevYear} in ${D.prevYear}` },
      { label: "Lost-Time / Restricted", cur: K.lostTimeYTD, prev: K.lostTimePrevYear, sub: `${K.lostTimePrevYear} in ${D.prevYear}` },
      { label: "DART Rate", cur: K.dartYTD, prev: K.dartPrevYear, sub: `NAICS ${D.naics} avg ${D.benchmarks.dart}`, decimal: true },
      { label: "TRIR", cur: K.trirYTD, prev: K.trirPrevYear, sub: `NAICS ${D.naics} avg ${D.benchmarks.trir}`, decimal: true },
    ];
    kpis.forEach((k, i) => {
      const x = kpiX0 + i * (kpiW + kpiGap);
      slide.addShape(pres.ShapeType.roundRect, { x, y: kpiY, w: kpiW, h: kpiH, rectRadius: 0.08, fill: { color: WASH }, line: { color: LINE, width: 1 } });
      const a = arrow(k.cur, k.prev);
      const val = k.decimal ? k.cur.toFixed(1) : String(k.cur);
      slide.addText(val, { x: x + 0.02, y: kpiY + 0.12, w: kpiW - 1.05, h: 0.7, align: "left", valign: "middle", fontFace: "Cambria", fontSize: 40, bold: true, color: MAROON, margin: 0 });
      const delta = k.decimal ? Math.abs(k.cur - k.prev).toFixed(1) : Math.abs(k.cur - k.prev);
      slide.addText(`${a.sym} ${delta}`, { x: x + kpiW - 1.0, y: kpiY + 0.26, w: 0.88, h: 0.32, align: "right", valign: "middle", fontFace: "Calibri", fontSize: 12, bold: true, color: a.col, margin: 0 });
      slide.addText(k.label, { x: x + 0.05, y: kpiY + 0.82, w: kpiW - 0.15, h: 0.3, align: "left", fontFace: "Calibri", fontSize: 13, bold: true, color: INK, margin: 0 });
      slide.addText(k.sub, { x: x + 0.05, y: kpiY + 1.06, w: kpiW - 0.15, h: 0.24, align: "left", fontFace: "Calibri", fontSize: 10, color: MIST, margin: 0 });
    });

    const secY = 3.15;
    slide.addText("Site Performance", { x: 0.55, y: secY, w: 6, h: 0.3, fontFace: "Cambria", fontSize: 15, bold: true, color: INK });
    const hdr = txt => ({ text: txt, options: { bold: true, color: WHITE, fill: { color: MAROON }, align: txt === "Site" ? "left" : "center" } });
    const siteRows = [
      [hdr("Site"), hdr("TRIR (mo)"), hdr("TRIR (YTD)"), hdr("Findings"), hdr("% Closed")],
      ...D.sites.map((s, i) => {
        const zebra = i % 2 ? WHITE : WASH;
        const cc = s.closedPct >= 80 ? GREEN : s.closedPct >= 60 ? AMBER : RED;
        const cell = (text, opts = {}) => ({ text, options: { align: "center", color: SLATE, fill: { color: zebra }, ...opts } });
        return [
          cell(s.name, { align: "left", color: INK }),
          cell(s.trirMonth.toFixed(1)), cell(s.trirYTD.toFixed(1)), cell(String(s.findings)),
          cell(`${s.closedPct}%`, { color: cc, bold: true }),
        ];
      }),
    ];
    slide.addTable(siteRows, { x: 0.55, y: secY + 0.38, w: 6.0, colW: [1.8, 1.05, 1.1, 1.0, 1.05], rowH: 0.34, fontFace: "Calibri", fontSize: 11, border: { type: "solid", color: LINE, pt: 0.5 }, valign: "middle" });

    const trainX = 7.0;
    slide.addText("Training Compliance", { x: trainX, y: secY, w: 3.0, h: 0.3, fontFace: "Cambria", fontSize: 15, bold: true, color: INK });
    if (D.training.length === 0) {
      slide.addText("No training records yet.", { x: trainX, y: secY + 0.45, w: 3, h: 0.3, fontFace: "Calibri", fontSize: 10, italic: true, color: MIST });
    }
    const barY0 = secY + 0.42, barH = 0.24, barGap = 0.395, barW = 2.75, barX = trainX + 2.15;
    D.training.forEach((t, i) => {
      const y = barY0 + i * barGap;
      slide.addText(t.module, { x: trainX - 0.03, y: y - 0.02, w: 2.15, h: barH + 0.05, align: "left", valign: "middle", fontFace: "Calibri", fontSize: 8.5, color: SLATE, margin: 0 });
      slide.addShape(pres.ShapeType.roundRect, { x: barX, y, w: barW, h: barH, rectRadius: 0.03, fill: { color: "EDEDED" }, line: { type: "none" } });
      const col = t.pct >= 80 ? GREEN : t.pct >= 50 ? AMBER : RED;
      slide.addShape(pres.ShapeType.roundRect, { x: barX, y, w: Math.max(0.05, barW * t.pct / 100), h: barH, rectRadius: 0.03, fill: { color: col }, line: { type: "none" } });
      slide.addText(`${t.pct}%`, { x: barX + barW + 0.05, y: y - 0.02, w: 0.6, h: barH + 0.05, align: "left", valign: "middle", fontFace: "Calibri", fontSize: 9, bold: true, color: INK, margin: 0 });
    });

    const panelX = 10.15, panelW = 2.65;
    slide.addShape(pres.ShapeType.roundRect, { x: panelX, y: secY, w: panelW, h: 3.85, rectRadius: 0.06, fill: { color: WASH }, line: { color: LINE, width: 1 } });
    const zeroInjuries = D.kpis.recordablesYTD === 0 && D.events.seriousIncidents === 0;
    slide.addText(zeroInjuries ? `YTD: 0 Recordable & Serious Injuries` : `YTD: ${D.kpis.recordablesYTD} Recordable · ${D.events.seriousIncidents} Serious`, {
      x: panelX + 0.15, y: secY + 0.12, w: panelW - 0.3, h: 0.35, fontFace: "Calibri", fontSize: 10.5, bold: true, color: zeroInjuries ? GREEN : INK, align: "left", margin: 0,
    });
    slide.addText("Significant Events", { x: panelX + 0.15, y: secY + 0.5, w: panelW - 0.3, h: 0.26, fontFace: "Cambria", fontSize: 12, bold: true, color: MAROON, margin: 0 });
    slide.addText([
      { text: `Serious incidents: ${D.events.seriousIncidents}`, options: { breakLine: true } },
      { text: `Near misses (this period): ${D.events.nearMisses}`, options: { breakLine: true } },
    ], { x: panelX + 0.15, y: secY + 0.78, w: panelW - 0.3, h: 0.5, fontFace: "Calibri", fontSize: 10, color: SLATE, margin: 0, paraSpaceAfter: 2 });
    slide.addText("Achievements / Risks / Decisions", { x: panelX + 0.15, y: secY + 1.3, w: panelW - 0.3, h: 0.26, fontFace: "Cambria", fontSize: 12, bold: true, color: MAROON, margin: 0 });
    const bullets = (D.events.highlights.length ? D.events.highlights : ["Add investigation notes to incidents to populate this section."])
      .map(h => ({ text: h, options: { bullet: { code: "2022" }, breakLine: true, paraSpaceAfter: 6 } }));
    slide.addText(bullets, { x: panelX + 0.15, y: secY + 1.58, w: panelW - 0.3, h: 2.2, fontFace: "Calibri", fontSize: 9, color: SLATE, margin: 0, valign: "top" });

    slide.addText(`Generated from EHS DNA · ${D.company} · ${D.periodLabel} · TRIR = (recordables × 200,000) ÷ hours worked`, {
      x: 0.55, y: 7.12, w: 12.2, h: 0.25, fontFace: "Calibri", fontSize: 8, color: MIST, align: "left",
    });

    return pres.write("nodebuffer");
  }

  // ── Endpoints ──
  // JSON preview of the numbers (for a live on-screen preview before export).
  app.get("/api/reports/mbr/preview", auth, requireRole(...CAN_SEE_ALL_INCIDENTS), (req, res) => {
    try { res.json(gatherMbr(req.auth.tenant, req.query.period)); }
    catch (e) { console.error("MBR preview failed:", e.message); res.status(500).json({ error: "Failed to compute MBR metrics" }); }
  });

  // The .pptx download.
  app.get("/api/reports/mbr/export", auth, requireRole(...CAN_SEE_ALL_INCIDENTS), async (req, res) => {
    try {
      const data = gatherMbr(req.auth.tenant, req.query.period);
      const buf = await buildDeck(data);
      const safe = (data.periodLabel || "period").replace(/[^A-Za-z0-9]+/g, "-");
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
      res.setHeader("Content-Disposition", `attachment; filename="EHS-MBR-${safe}.pptx"`);
      res.send(Buffer.from(buf));
    } catch (e) {
      console.error("MBR export failed:", e.message);
      res.status(500).json({ error: "Failed to generate MBR slide" });
    }
  });
};
