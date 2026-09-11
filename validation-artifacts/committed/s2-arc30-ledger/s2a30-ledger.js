// s2-arc30 live check — the detected-vs-applied block rebuilt as the
// applied-forward ledger (#273, folding #278).
//
//   node s2a30-ledger.js <outDir> <expectSha> [base]
//
// This re-verifies, against the REAL BUILD, every figure the arc was
// ruled on.  Those figures came from a prototype mounted inside the
// live block's container (the arc-30 checkpoint probes), which is
// stronger than a text probe and weaker than the build: if the build
// disagrees, THE BUILD WINS and the README records the correction.
//
// Legs, per viewport (1440x1000 and 380x900):
//   P   the picker driven to a real detection — E Bayaud
//       39.71466,-104.94071, way 39508704, detected 85°.  The block
//       mounts only behind a confirmed road, so no pick means no
//       figures (the leg the s2-audit-1 walk could not take).
//   A   per-row geometry: glyph char + resolved colour, label ink,
//       applied-value ink, clause text + line count, row height.
//   B   #273's OUTCOME: the applied values' ink RIGHT edges across
//       rows.  The old fixed tracks are gone; the axis must survive
//       anyway, because every row body spans the full width.
//   C   the reserve: every row in a viewport is the SAME height, and a
//       token appearing or disappearing does not change it (the lanes
//       edit in leg L is the state change).
//   D   the #214 caveat sentence, byte-exact.
//   E   the clause worst cases rendered in THIS build's own tr-prov:
//       worst MATCH and worst DIFFER, measured, against the width the
//       row body actually gives them at this viewport.
//   F   spec 2.8's line-1 wrap — the one case where a row can still
//       grow — reported as found on a real fixture rather than assumed.
//   G   axe on the mounted block.
//   L   the #275 leg: edit lanes in the form, re-read the row, and
//       compare every row's height before and after.
//
// Nothing here changes product code; this is measurement only.
const L = require("../s2-audit-1/audit-lib.js");
const { fs, path } = L;

const OUT = process.argv[2];
const EXPECT = process.argv[3];
const BASE = process.argv[4] || "http://localhost:3005";
const FIX = { lat: "39.71466", lng: "-104.94071", way: "39508704" };

fs.mkdirSync(OUT, { recursive: true });
const { log } = L.mkLog(OUT);
const rows = [];
const rec = (o) => {
  rows.push(o);
  fs.writeFileSync(path.join(OUT, "rows.json"), JSON.stringify(rows, null, 1));
};
const info = (t, id, d) => { rec({ tag: t, id, ok: null, detail: d }); log(`[${t}] info ${id} — ${d}`); };
const check = (t, id, ok, d) => { rec({ tag: t, id, ok, detail: d }); log(`[${t}] ${ok ? "PASS" : "FAIL"} ${id} — ${d}`); };

// ── the probe, run inside the page ──────────────────────────────────
const PROBE = () => {
  const blk = document.querySelector(".dva");
  if (!blk) return null;
  const rd = (n) => Math.round(n * 10) / 10;

  // Ink of an element's OWN text nodes only — never a descendant's — so
  // a clause can never be mistaken for the value above it.  (The arc-29
  // round-1 ink probe measured the whole cell and had to be corrected;
  // this is that correction, carried forward.)
  const ownInk = (el) => {
    if (!el) return null;
    const own = Array.from(el.childNodes).filter(
      (n) => n.nodeType === 3 && n.textContent.trim(),
    );
    if (!own.length) return null;
    const r = document.createRange();
    r.setStart(own[0], 0);
    r.setEnd(own[own.length - 1], own[own.length - 1].textContent.length);
    const q = r.getBoundingClientRect();
    return { l: rd(q.left), r: rd(q.right), w: rd(q.width) };
  };

  const cs = getComputedStyle(blk);
  const rect = blk.getBoundingClientRect();
  const content = rd(
    rect.width -
      parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) -
      parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth),
  );
  const glyphCell = parseFloat(cs.getPropertyValue("--glyph-cell")) || 16;

  const rowEls = Array.from(blk.querySelectorAll(".dva-row"));
  const out = rowEls.map((el) => {
    const label = el.querySelector(".tr-field");
    const val = el.querySelector(".dva-val");
    const glyph = el.querySelector(".dva-glyph");
    const clause = el.querySelector(".dva-clause .tr-prov");
    const slot = el.querySelector(".dva-clause");
    const line1 = el.querySelector(".dva-line1");
    const gcs = glyph ? getComputedStyle(glyph) : null;
    const ccs = clause ? getComputedStyle(clause) : null;
    const lh = ccs ? parseFloat(ccs.lineHeight) || 16 : 16;
    const clauseH = clause ? clause.getBoundingClientRect().height : 0;
    return {
      label: label ? label.textContent.trim() : null,
      applied: val ? val.textContent.trim() : null,
      appliedInk: ownInk(val),
      appliedFamily: val ? getComputedStyle(val).fontFamily.split(",")[0] : null,
      appliedSize: val ? getComputedStyle(val).fontSize : null,
      appliedWeight: val ? getComputedStyle(val).fontWeight : null,
      glyph: glyph ? glyph.textContent.trim() : null,
      glyphClass: glyph ? glyph.className : null,
      glyphColor: gcs ? gcs.color : null,
      clause: clause ? clause.textContent.trim() : null,
      clauseColor: ccs ? ccs.color : null,
      clauseSize: ccs ? ccs.fontSize : null,
      clauseLines: clause ? Math.max(1, Math.round(clauseH / lh)) : 0,
      clauseW: clause ? rd(clause.getBoundingClientRect().width) : null,
      slotH: slot ? rd(slot.getBoundingClientRect().height) : null,
      slotMinH: slot ? getComputedStyle(slot).minHeight : null,
      line1H: line1 ? rd(line1.getBoundingClientRect().height) : null,
      rowH: rd(el.getBoundingClientRect().height),
      rowTop: rd(el.getBoundingClientRect().top),
    };
  });

  // The worst cases, rendered in THIS build's own provenance role.
  const host = document.createElement("div");
  host.className = "workbench";
  host.style.cssText = "position:absolute;left:-9999px;top:0;";
  document.body.appendChild(host);
  const probe = document.createElement("span");
  probe.className = "tr-prov";
  probe.style.cssText = "position:absolute;white-space:pre;visibility:hidden;";
  host.appendChild(probe);
  const wOf = (s) => { probe.textContent = s; return rd(probe.getBoundingClientRect().width); };
  const pcs = getComputedStyle(probe);
  const worst = {
    role: `${pcs.fontSize}/${pcs.lineHeight} w${pcs.fontWeight} track ${pcs.letterSpacing}`,
    match: wOf("OSM · Freeway / interstate · inferred"),
    differ: wOf("OSM · Freeway / interstate · inferred · operator-set"),
  };
  host.remove();

  const bodyW = rowEls.length
    ? rd(rowEls[0].querySelector(".dva-clause").getBoundingClientRect().width)
    : null;

  return {
    blockW: rd(rect.width),
    blockH: rd(rect.height),
    content,
    glyphCell,
    bodyW,
    padding: `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`,
    caveat: blk.querySelector(".dva-caveat")
      ? blk.querySelector(".dva-caveat").textContent
      : null,
    sourceLine: blk.querySelector(".tr-prov")
      ? blk.querySelector(".tr-prov").textContent.trim()
      : null,
    worst,
    rows: out,
    docW: document.documentElement.scrollWidth,
    winW: window.innerWidth,
  };
};

const CAVEAT =
  "road geometry governs the drawing — the typed bearing sets the travel-direction sign only";

const drive = async (page, vp) => {
  await page.getByRole("button", { name: "Pick Location on Map" }).click();
  await page.waitForSelector("[role=dialog]", { timeout: 20000 });
  const dlg = page.locator("[role=dialog]");
  const manual = dlg.getByRole("button", {
    name: /Or enter coordinates manually|Hide coordinate/i,
  });
  if (await manual.count()) {
    const t = await manual.first().textContent();
    if (/Or enter/i.test(t || "")) await manual.first().click();
  }
  await dlg.getByLabel("Latitude").fill(FIX.lat);
  await dlg.getByLabel("Longitude").fill(FIX.lng);
  await dlg.getByLabel("Longitude").blur();
  let found = false;
  for (let i = 0; i < 60; i++) {
    if (await dlg.locator("button", { hasText: new RegExp(`way ${FIX.way}`) }).count()) {
      found = true;
      break;
    }
    await page.waitForTimeout(500);
  }
  check(vp, "P-detect", found, `way ${FIX.way} offered by detection`);
  if (!found) return false;
  await dlg.locator("button", { hasText: new RegExp(`way ${FIX.way}`) }).first().click();
  await page.waitForTimeout(1400);
  await dlg.getByRole("button", { name: "Save & Close" }).click();
  await page.waitForSelector("[role=dialog]", { state: "detached", timeout: 20000 });
  await page.waitForTimeout(1200);
  return true;
};

(async () => {
  if (EXPECT) await L.shaGate(log, EXPECT);
  log(`base ${BASE}`);
  const b = await L.chromium.launch();

  for (const vp of [
    { width: 1440, height: 1000 },
    { width: 380, height: 900 },
  ]) {
    const tag = `${vp.width}x${vp.height}`;
    const page = await b.newPage({ viewport: vp });
    const errs = [];
    page.on("pageerror", (e) => errs.push(String(e)));
    await page.goto(`${BASE}/sandbox`, { waitUntil: "networkidle" });
    if (!(await drive(page, tag))) { await page.close(); continue; }

    const r = await page.evaluate(PROBE);
    if (!r) { check(tag, "P-mount", false, "the block did not mount"); await page.close(); continue; }
    check(tag, "P-mount", true, `block ${r.blockW}x${r.blockH} px, ${r.rows.length} rows, padding ${r.padding}`);
    await L.shot(page, OUT, `${tag}-as-found`);
    // the block itself, scrolled to and shot as an element: a viewport
    // screenshot of /sandbox does not contain it (the Road step sits
    // below the fold), and evidence that does not show the thing is not
    // evidence of the thing.
    const blkLoc = page.locator(".dva").first();
    await blkLoc.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await blkLoc.screenshot({ path: `${OUT}/${tag}-block.png` });

    info(tag, "A-geom", `content ${r.content} · gutter ${r.glyphCell} · row body ${r.bodyW} · prov role ${r.worst.role}`);
    for (const row of r.rows) {
      info(
        tag,
        `A-row-${row.label}`,
        `applied "${row.applied}" (${row.appliedFamily} ${row.appliedSize}/${row.appliedWeight}) · glyph "${row.glyph}" ${row.glyphColor} [${row.glyphClass}] · clause "${row.clause}" ${row.clauseW}px ${row.clauseLines}ln ${row.clauseColor} · line1 ${row.line1H} · slot ${row.slotH} (min ${row.slotMinH}) · row ${row.rowH}`,
      );
    }

    // A2 — every row has exactly one glyph and one clause (spec 4.6)
    const paired = r.rows.every((x) => x.glyph && x.clause && x.clause.length > 0);
    check(tag, "A-pairing", paired, "every row renders one glyph AND one clause");

    // B — #273's outcome: the applied values share one right edge
    const rights = r.rows.map((x) => x.appliedInk).filter(Boolean).map((x) => x.r);
    const spread = Math.round((Math.max(...rights) - Math.min(...rights)) * 10) / 10;
    check(
      tag,
      "B-right-axis",
      spread <= 1,
      `applied-value ink right spread across ${rights.length} rows = ${spread} px (the old fixed tracks are gone; the axis comes from the row body's full width)`,
    );

    // C — the reserve: one row height per viewport.  The LAST row is
    // 1 px shorter by design: ruling 7 drops its border-bottom so the
    // caveat's own hairline is not doubled.  So the invariant is
    // measured on the bordered rows, and the last is checked against
    // them minus exactly that hairline.
    const bordered = r.rows.slice(0, -1).map((x) => x.rowH);
    const last = r.rows[r.rows.length - 1].rowH;
    const heights = [...new Set(bordered)];
    check(
      tag,
      "C-equal-rows",
      heights.length <= 1,
      `bordered row heights ${bordered.join(", ")} — distinct: ${heights.join(", ")}`,
    );
    check(
      tag,
      "C-last-row-hairline",
      bordered.length === 0 || Math.abs(bordered[0] - last - 1) < 0.2,
      `last row ${last} px against ${bordered[0]} px — the difference is its dropped hairline (ruling 7), and nothing else`,
    );
    info(tag, "C-reserve", `clause slot min-height ${r.rows[0].slotMinH} (ruled: 16px at/above 520, 32px below)`);

    // D — the #214 sentence, byte-exact
    check(tag, "D-caveat", r.caveat === CAVEAT, `caveat === contract (${JSON.stringify(r.caveat)})`);

    // E — the worst clauses in this build, against the width the row gives them
    const fitsMatch = r.worst.match <= r.bodyW;
    info(
      tag,
      "E-worst",
      `worst MATCH ${r.worst.match} px, worst DIFFER ${r.worst.differ} px against a ${r.bodyW} px row body — MATCH ${fitsMatch ? "fits" : "WRAPS"}, DIFFER ${r.worst.differ <= r.bodyW ? "fits" : "wraps"}`,
    );
    const reserveLines = vp.width < 520 ? 2 : 1;
    const worstLines = Math.ceil(r.worst.differ / r.bodyW);
    check(
      tag,
      "E-reserve-sufficient",
      worstLines <= reserveLines,
      `worst DIFFER needs ${worstLines} line(s); the reserve here is ${reserveLines}`,
    );

    // F — spec 2.8's line-1 wrap, as found
    const wrapped = r.rows.filter((x) => x.line1H > 24).map((x) => x.label);
    info(tag, "F-line1-wrap", wrapped.length ? `line 1 wrapped on: ${wrapped.join(", ")}` : "no row's line 1 wrapped on this fixture");

    // no horizontal scroll at any width
    check(tag, "F-no-hscroll", r.docW <= r.winW + 1, `document ${r.docW} px vs viewport ${r.winW} px`);

    // G — axe
    // The `region` violation ("some page content is not contained by
    // landmarks", target `.gap-8`) is PRE-EXISTING and page-level, not
    // this block's: it is byte-identical to the recorded prod baseline
    // at b2a325a (s2-arc29-detected-applied/outProd-b2a325a/geometry/
    // axe-1440x1000-axe.json).  The gate is therefore "no violation
    // this block introduced", which is the honest form of it — zero
    // would fail on main too.
    // Recorded at prod b2a325a by the arc-29 evidence run (commit
    // 3504ba6, which sits on the UNMERGED s2-arc29-prod branch and is
    // not reachable from here) — so the two files are copied verbatim
    // into this arc's own directory, where the citation can be
    // followed: baseline-axe-1440-b2a325a.json = [region];
    // baseline-axe-380-b2a325a.json = [region,
    // scrollable-region-focusable].  Both name `.gap-8`, a page-level
    // container, not this block.
    const BASELINE = vp.width < 520 ? ["region", "scrollable-region-focusable"] : ["region"];
    const violations = await L.runAxe(page, OUT, tag);
    const introduced = violations.filter((v) => !BASELINE.includes(v.id));
    check(
      tag,
      "G-axe",
      introduced.length === 0,
      `${violations.length} violation(s), ${introduced.length} outside the recorded baseline [${BASELINE.join(", ")}] — see axe-${tag}.json`,
    );
    const touchesBlock = violations.some((v) =>
      v.nodes.some((n) => /dva/.test(n.target)),
    );
    check(tag, "G-axe-block", !touchesBlock, "no axe violation names a node inside .dva");

    // L — the #275 leg: a lanes edit must not resize any row
    // the shoulder form's lanes control is a row of chips, not an input
    // (the arc-29 harness found the same, s2a29-lc.js:273)
    const chips = page
      .locator("#rail-step-road, .setup-panel")
      .getByRole("button", { name: /^[1-4]$/ });
    const lanesRowNow = r.rows.find((x) => x.label === "Lanes per direction");
    if ((await chips.count()) && lanesRowNow) {
      const before = r.rows.map((x) => ({ label: x.label, h: x.rowH }));
      const cur = lanesRowNow.applied.trim();
      const want = cur === "2" ? "3" : "2";
      const target = chips.filter({ hasText: new RegExp(`^${want}$`) }).first();
      if (!(await target.count())) {
        info(tag, "L-lanes", `no lanes chip for ${want} — leg skipped`);
        await page.close();
        continue;
      }
      info(tag, "L-before", `lanes ${cur} → clicking ${want}`);
      await target.click();
      await page.waitForTimeout(1200);
      const after = await page.evaluate(PROBE);
      await L.shot(page, OUT, `${tag}-after-lane-edit`);
      const blkAfter = page.locator(".dva").first();
      await blkAfter.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      await blkAfter.screenshot({ path: `${OUT}/${tag}-block-after-lane-edit.png` });
      const moved = after.rows
        .map((x, i) => ({ label: x.label, before: before[i] ? before[i].h : null, after: x.rowH }))
        .filter((x) => x.before !== null && Math.abs(x.after - x.before) > 0.5);
      check(
        tag,
        "L-row-height-invariant",
        moved.length === 0,
        moved.length
          ? `rows changed height on a lanes edit: ${moved.map((m) => `${m.label} ${m.before}→${m.after}`).join(", ")}`
          : "no row changed height when the lanes relay cleared and a token appeared",
      );
      const lanesRow = after.rows.find((x) => x.label === "Lanes per direction");
      if (lanesRow) {
        info(tag, "L-lanes-clause", `"${lanesRow.clause}" · applied "${lanesRow.applied}" · glyph "${lanesRow.glyph}"`);
        check(
          tag,
          "L-no-stale-number",
          !/OSM · 2 · withdrawn/.test(lanesRow.clause),
          "a withdrawn detection does not print the cleared relay's number",
        );
      }
    } else {
      info(tag, "L-lanes", "no lanes chips or no lanes row in this state — leg skipped");
    }

    check(tag, "Z-page-errors", errs.length === 0, errs.length ? errs.join(" | ") : "no page errors");
    await page.close();
  }

  await b.close();
  const fails = rows.filter((x) => x.ok === false);
  log(`\n${rows.filter((x) => x.ok === true).length} pass, ${fails.length} fail, ${rows.filter((x) => x.ok === null).length} info`);
  if (fails.length) { for (const f of fails) log(`FAIL ${f.tag} ${f.id} — ${f.detail}`); process.exit(1); }
})();
