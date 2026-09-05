// s2-arc20 live check — #248 (the scanned block's grid) + #247 (the
// results-head wait line).  Playwright + axe-core, two viewports.
//
//   node s2a20-lc-prod.js <outDir> <expectSha> [lat] [lng]
//     prod:  A20_BASE unset → https://www.conestruct.com, sha-gated on
//            healthz == <expectSha> (origin/main after the ship)
//     local: A20_BASE=http://localhost:3000 with <expectSha> "" — the
//            local stack (local-stack/) with the Overpass stand-in held
//            A20_DELAY_S seconds so the wait line is on screen to measure
//
// Legs, per viewport (1440×1000, 380×800):
//   W1  while the generated scenario's fetches are in flight, the wait
//       line is present and its rect lies within [nav-h, innerHeight]
//   W2  on settle the wait line is gone; the jump line is present iff the
//       settled scan detected ≥1 keyed condition
//   W3  wait line and jump line never co-present in any sample
//   R1  every action button in the block shares one right edge (±1 px)
//   R2  no action button sits below its row's text top (no wrap)
//   R3  detected and absent rows stand the same height
//   R4  picker open = exactly one extra row; Confirm in the picker row's
//       action cell, Cancel in the condition row's; edges still one
//   R5  details[0] is not printed in the block (no "from anchor" either)
//   R6  axe (wcag2a/aa/21aa/22aa) with the picker open, chosen, and
//       other+note: zero color-contrast nodes inside .site-corrections;
//       total ≤ the arc-19 baseline (1440: 2 · 380: 2, named)
//   R7  measured pairs ≥ 4.5:1 — ▲ (--dim), ✓ (--pass), evidence,
//       condition, legend, chip unselected, chip chosen, note ink
//   R8  after Assert the record row keeps the shared edge, its sentence
//       is one text node, Result reads ✓ asserted; Undo restores the row
// Prod: a refused scan is a finding first — recorded, then Retry scan is
// clicked through the refusal container (≤ 3 times) so the block renders.
const fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const BASE = process.env.A20_BASE || "https://www.conestruct.com";
const HEALTHZ = "https://rtmakatura--conestruct-render-fastapi-app.modal.run/healthz";
const OUT = process.argv[2] || path.join(__dirname, "outS2A20");
const EXPECT_SHA = process.argv[3] || "";
const LAT = process.argv[4] || "39.726900", LNG = process.argv[5] || "-104.987300", BEARING = "180", WORKLEN = "1000";
fs.mkdirSync(OUT, { recursive: true });
const AXE_SRC = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf-8");
const AXE_BASELINE = { "1440x1000": 2, "380x800": 2 };
const log = (s) => { console.log(s); fs.appendFileSync(path.join(OUT, "log.txt"), s + "\n"); };
const results = [];
const check = (tag, id, ok, detail) => { results.push({ tag, id, ok, detail }); log(`[${tag}] ${ok ? "PASS" : "FAIL"} ${id} — ${detail}`); };

const strip = (page) => page.evaluate(() => document.querySelector(".status-bar")?.textContent ?? "");
const SETTLED = /READY FOR TCS REVIEW|PLAN DECLINED|VERIFICATION UNAVAILABLE|NEEDS ATTENTION|VERIFIED/;
async function waitSettled(page, maxMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const s = await strip(page);
    if (SETTLED.test(s) && !/VERIFYING|COMPUTING/.test(s)) return s;
    await page.waitForTimeout(150);
  }
  return null;
}
async function pinManually(page) {
  await page.getByRole("button", { name: "Enter manually", exact: true }).click();
  const fill = async (labelText, value) => {
    const input = page.locator(`label:text-is("${labelText}")`).locator("xpath=following-sibling::input[1]");
    await input.fill(value);
  };
  await fill("Latitude", LAT);
  await page.getByRole("button", { name: "Edit manually", exact: true }).click();
  await fill("Longitude", LNG);
  await fill("Bearing (° from N)", BEARING);
  await fill("Work zone (ft)", WORKLEN);
  await page.waitForTimeout(400);
}
const SAMPLE = () => {
  const r = (sel) => { const el = document.querySelector(sel); if (!el) return null; const b = el.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), text: (el.textContent || "").trim().slice(0, 90) }; };
  const cs = getComputedStyle(document.querySelector(".workbench"));
  return {
    scrollY: Math.round(window.scrollY), innerH: window.innerHeight, navH: parseInt(cs.getPropertyValue("--nav-h"), 10),
    statusBar: r(".status-bar"), wait: r(".results-head-wait"), jump: r(".site-jump:not(.results-head-wait)"), block: r(".site-corrections"),
  };
};
// Sample from a click to settle; returns samples + the settle time.
async function sampleUntilSettled(page, label, maxMs) {
  const t0 = Date.now(); const samples = []; let settledAt = null; let shot = false;
  while (Date.now() - t0 < maxMs) {
    const s = await page.evaluate(SAMPLE); s.t = Date.now() - t0; samples.push(s);
    if (!shot && s.wait && s.wait.top > s.navH && s.wait.bottom < s.innerH && s.t > 300) { shot = true; await page.screenshot({ path: path.join(OUT, `wait-${label}.png`) }); }
    const st = s.statusBar?.text ?? "";
    if (settledAt === null && SETTLED.test(st) && !/VERIFYING|COMPUTING/.test(st)) settledAt = s.t;
    if (settledAt !== null && Date.now() - t0 - settledAt > 1200) break;
    await page.waitForTimeout(200);
  }
  fs.writeFileSync(path.join(OUT, `${label}-samples.json`), JSON.stringify(samples, null, 1));
  return { samples, settledAt };
}
function waitLegs(tag, label, samples) {
  const pending = samples.filter((s) => /VERIFYING|COMPUTING/.test(s.statusBar?.text ?? ""));
  const withWait = pending.filter((s) => s.wait);
  const inView = withWait.filter((s) => s.wait.top >= s.navH && s.wait.bottom <= s.innerH);
  const late = withWait.filter((s) => s.t > 600); // after the DOM-swap scroll anchoring settles (#240)
  const lateIn = late.filter((s) => s.wait.top >= s.navH && s.wait.bottom <= s.innerH);
  check(tag, `W1 ${label}`, pending.length > 0 && withWait.length > 0 && late.length > 0 && lateIn.length === late.length,
    `${pending.length} pending samples, ${withWait.length} with the wait line, ${inView.length} in view; after 600 ms ${lateIn.length}/${late.length} in view; first ${withWait[0] ? `${withWait[0].wait.top}..${withWait[0].wait.bottom}` : "—"} (nav ${samples[0]?.navH}, innerH ${samples[0]?.innerH})`);
  const settled = samples.filter((s) => SETTLED.test(s.statusBar?.text ?? "") && !/VERIFYING|COMPUTING/.test(s.statusBar?.text ?? ""));
  const last = settled[settled.length - 1];
  check(tag, `W2 ${label}`, !!last && last.wait === null, last ? `settled: wait ${last.wait ? "PRESENT" : "gone"}, jump ${last.jump ? `"${last.jump.text}"` : "absent"}` : "never settled");
  const both = samples.filter((s) => s.wait && s.jump);
  check(tag, `W3 ${label}`, both.length === 0, `${both.length} samples with both lines (of ${samples.length})`);
  return last;
}
const BLOCK_GEOM = () => {
  const blk = document.querySelector(".site-corrections"); if (!blk) return null;
  const R = (el) => { const b = el.getBoundingClientRect(); return { left: Math.round(b.left), right: Math.round(b.right), top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height) }; };
  const rows = Array.from(blk.querySelectorAll(".sc-grid > .sc-row:not(.sc-head)"));
  return {
    text: blk.textContent,
    rows: rows.map((row) => {
      const cond = row.querySelector(".sc-cond, legend");
      const btns = Array.from(row.querySelectorAll("button")).map((b) => ({ txt: b.textContent.trim(), ...R(b), inAction: !!b.closest(".sc-action") }));
      const ev = row.querySelector(".sc-evidence");
      return {
        cls: row.className, ...R(row), textTop: cond ? R(cond).top : null, buttons: btns,
        result: row.querySelector(".sc-result")?.textContent ?? null,
        evidenceNodes: ev ? ev.childNodes.length : null,
        detected: !!row.querySelector(".sc-glyph.sc-detected"), absent: !!row.querySelector(".sc-glyph.sc-absent"),
        record: row.classList.contains("sc-record"), picker: row.classList.contains("site-correction-picker"),
      };
    }),
  };
};
function edgeLegs(tag, label, g) {
  const btns = g.rows.flatMap((r) => r.buttons);
  const rights = [...new Set(btns.map((b) => b.right))].sort((a, b) => a - b);
  check(tag, `R1 ${label}`, rights.length > 0 && rights[rights.length - 1] - rights[0] <= 1 && btns.every((b) => b.inAction),
    `right edges ${rights.join("/")} across ${btns.length} buttons (${btns.map((b) => b.txt).join(", ")}); all in .sc-action: ${btns.every((b) => b.inAction)}`);
  const wrapped = g.rows.flatMap((r) => r.buttons.filter((b) => r.textTop !== null && b.top > r.textTop + 8).map((b) => `${b.txt}@row"${r.result}"`));
  check(tag, `R2 ${label}`, wrapped.length === 0, wrapped.length ? `wrapped: ${wrapped.join(", ")}` : "no action below its row's text");
}
async function measureBlock(page, tag, name) {
  const g = await page.evaluate(BLOCK_GEOM);
  if (!g) { check(tag, `block ${name}`, false, "no .site-corrections block"); return null; }
  fs.writeFileSync(path.join(OUT, `${name}-${tag}.json`), JSON.stringify(g, null, 1));
  await page.locator(".site-corrections").scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  await page.locator(".site-corrections").screenshot({ path: path.join(OUT, `${name}-${tag}.png`) });
  log(`[${tag}] ${name}: ${g.rows.map((r) => `h${r.h}${r.record ? " REC" : r.picker ? " PICKER" : r.detected ? " det" : " abs"}[${r.buttons.map((b) => b.txt).join("+")}]`).join(" ")}`);
  return g;
}
async function runAxe(page, tag, name) {
  await page.evaluate(AXE_SRC);
  const res = await page.evaluate(() => window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } }));
  const compact = res.violations.map((v) => ({ id: v.id, impact: v.impact, targets: v.nodes.map((n) => n.target.join(" ")), data: v.nodes.map((n) => n.any?.[0]?.data ?? null) }));
  fs.writeFileSync(path.join(OUT, `axe-${name}-${tag}.json`), JSON.stringify(compact, null, 2));
  const inBlock = compact.filter((v) => v.id === "color-contrast").flatMap((v) => v.targets).filter((t) => /site-correction|sc-|reason-chip/.test(t));
  const total = compact.reduce((n, v) => n + v.targets.length, 0);
  check(tag, `R6 axe ${name}`, inBlock.length === 0 && total <= AXE_BASELINE[tag],
    `color-contrast in the block: ${inBlock.length}; total nodes ${total} (baseline ${AXE_BASELINE[tag]}): ${compact.map((v) => `${v.id}[${v.targets.join(",")}]`).join(" ; ") || "none"}`);
}
const PAIRS = () => {
  const lum = (hex) => { const c = hex.match(/\w\w/g).map((h) => parseInt(h, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const toHex = (rgb) => { const m = rgb.match(/\d+(\.\d+)?/g); if (!m) return null; if (m[3] !== undefined && Number(m[3]) === 0) return null; return "#" + m.slice(0, 3).map((n) => Number(n).toString(16).padStart(2, "0")).join(""); };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]; return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100; };
  const effBg = (el) => { let e = el; while (e) { const bg = toHex(getComputedStyle(e).backgroundColor); if (bg) return bg; e = e.parentElement; } return "#ffffff"; };
  const pair = (name, sel) => { const el = document.querySelector(sel); if (!el) return { name, missing: sel }; const fg = toHex(getComputedStyle(el).color); const bg = effBg(el); return { name, fg, bg, ratio: ratio(fg, bg) }; };
  return [
    pair("▲ detected glyph (--dim)", ".sc-glyph.sc-detected"),
    pair("✓ absent glyph (--pass)", ".sc-glyph.sc-absent"),
    pair("Result word", ".sc-row:not(.sc-record) .sc-result"),
    pair("Evidence (faint)", ".sc-row:not(.sc-record) .sc-evidence"),
    pair("Condition (tr-field)", ".sc-cond"),
    pair("Column head (tr-step)", ".sc-head .tr-step"),
    pair("legend", ".site-correction-reasons legend"),
    pair("chip unselected", ".reason-chip:not(.chosen) .reason-text"),
    pair("chip chosen", ".reason-chip.chosen .reason-text"),
    pair("note ink", ".site-correction-note"),
    pair("Confirm (act)", ".sc-sub button.confirm"),
    pair("ghost button", ".sc-row button.ghost"),
  ];
};

(async () => {
  if (EXPECT_SHA) {
    const hz = await (await fetch(HEALTHZ)).json();
    log(`healthz sha ${hz.sha} expect ${EXPECT_SHA}`);
    if (hz.sha !== EXPECT_SHA) { log("SHA GATE FAILED"); process.exit(2); }
  } else log(`local run against ${BASE} — no sha gate (A20_DELAY_S=${process.env.A20_DELAY_S ?? "?"} on the stand-in)`);
  const browser = await chromium.launch();
  for (const vp of [{ width: 1440, height: 1000 }, { width: 380, height: 800 }]) {
    const tag = `${vp.width}x${vp.height}`;
    const page = await browser.newPage({ viewport: vp });
    await page.goto(BASE + "/sandbox", { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(600);
    await pinManually(page);
    log(`[${tag}] pre settle: ${(await waitSettled(page, 60000))?.slice(0, 60)}`);
    const gen = page.getByRole("button", { name: /Generate plan/ });
    await gen.scrollIntoViewIfNeeded();
    await gen.click();
    let g1 = await sampleUntilSettled(page, `generate-${tag}`, 90000);
    log(`[${tag}] generate settled at t=${g1.settledAt} ms; strip: ${(await strip(page)).slice(0, 70)}`);
    for (let attempt = 1; attempt <= 3 && /PLAN DECLINED/.test(await strip(page)); attempt++) {
      const retry = page.getByRole("button", { name: /Retry scan/ });
      if ((await retry.count()) === 0) break;
      log(`[${tag}] FINDING: scan refused on Generate (attempt ${attempt}) — clicking Retry scan`);
      await retry.click();
      g1 = await sampleUntilSettled(page, `retry${attempt}-${tag}`, 90000);
      log(`[${tag}] retry ${attempt} settled at t=${g1.settledAt} ms; strip: ${(await strip(page)).slice(0, 70)}`);
    }
    const last = waitLegs(tag, "generate", g1.samples);
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT, `landed-${tag}.png`) });
    // R1–R3, R5 on the rows as rendered.
    const rows = await measureBlock(page, tag, "rows");
    if (!rows) { await page.close(); continue; }
    const detectedRows = rows.rows.filter((r) => r.detected), absentRows = rows.rows.filter((r) => r.absent);
    check(tag, "W2b jump iff detected", (detectedRows.length > 0) === !!last?.jump, `${detectedRows.length} detected rows; jump line ${last?.jump ? "present" : "absent"}`);
    edgeLegs(tag, "rows", rows);
    const hs = [...new Set(rows.rows.filter((r) => !r.record && !r.picker).map((r) => r.h))];
    check(tag, "R3 rows", hs.length === 1, `row heights ${rows.rows.filter((r) => !r.record && !r.picker).map((r) => r.h).join("/")} (${detectedRows.length} detected, ${absentRows.length} absent)`);
    check(tag, "R5 details", !/from anchor/.test(rows.text) && !rows.rows.some((r) => /\[|@ /.test(r.result ?? "")), `block text has no "from anchor" / details fragment: ${!/from anchor/.test(rows.text)}`);
    // R4, R6, R7 with the picker.
    const detRow = page.locator(".site-correction-row", { has: page.locator(".sc-glyph.sc-detected") }).first();
    if ((await detRow.count()) === 0) { check(tag, "R4", false, "no detected row to open the picker on"); await page.close(); continue; }
    await detRow.getByRole("button", { name: "Dismiss" }).click();
    await page.waitForTimeout(200);
    const open = await measureBlock(page, tag, "picker-open");
    const pickerRows = open.rows.filter((r) => r.picker);
    const condRow = open.rows[open.rows.findIndex((r) => r.picker) - 1];
    check(tag, "R4 picker", open.rows.length === rows.rows.length + 1 && pickerRows.length === 1 && pickerRows[0].buttons.map((b) => b.txt).join() === "Confirm dismiss" && condRow?.buttons.map((b) => b.txt).join() === "Cancel",
      `rows ${rows.rows.length} → ${open.rows.length}; picker row buttons [${pickerRows[0]?.buttons.map((b) => b.txt).join(",")}]; condition row buttons [${condRow?.buttons.map((b) => b.txt).join(",")}]`);
    edgeLegs(tag, "picker-open", open);
    await runAxe(page, tag, "picker-open");
    await page.locator(".reason-chip", { hasText: "Removed" }).click();
    await page.waitForTimeout(150);
    await runAxe(page, tag, "picker-chosen");
    await page.locator(".reason-chip", { hasText: "Other (say what)" }).click();
    await page.getByLabel("Say what", { exact: true }).fill("temporary fence around the span");
    await page.waitForTimeout(150);
    const pairs = await page.evaluate(PAIRS);
    fs.writeFileSync(path.join(OUT, `pairs-${tag}.json`), JSON.stringify(pairs, null, 1));
    const bad = pairs.filter((p) => p.missing || p.ratio < 4.5);
    check(tag, "R7 pairs", bad.length === 0, pairs.map((p) => p.missing ? `${p.name}: MISSING ${p.missing}` : `${p.name} ${p.fg} on ${p.bg} = ${p.ratio}`).join(" · "));
    await measureBlock(page, tag, "picker-other");
    await runAxe(page, tag, "picker-other-note");
    await page.getByRole("button", { name: "Cancel" }).click();
    await page.waitForTimeout(150);
    // R8 — Assert from the block, the record row, then Undo.
    const absRow = page.locator(".site-correction-row", { has: page.locator(".sc-glyph.sc-absent") }).first();
    if ((await absRow.count()) === 0) { check(tag, "R8", false, "no absent row to Assert"); await page.close(); continue; }
    await absRow.scrollIntoViewIfNeeded();
    await absRow.getByRole("button", { name: "Assert" }).click();
    const g2 = await sampleUntilSettled(page, `assert-${tag}`, 90000);
    log(`[${tag}] assert settled at t=${g2.settledAt} ms; strip: ${(await strip(page)).slice(0, 70)}`);
    waitLegs(tag, "assert", g2.samples);
    await page.waitForTimeout(600);
    const rec = await measureBlock(page, tag, "record");
    const recRow = rec?.rows.find((r) => r.record);
    check(tag, "R8 record", !!recRow && recRow.evidenceNodes === 1 && recRow.result === "✓asserted" && recRow.buttons.map((b) => b.txt).join() === "Undo",
      recRow ? `record: result "${recRow.result}", sentence nodes ${recRow.evidenceNodes}, buttons [${recRow.buttons.map((b) => b.txt).join(",")}]` : "no record row");
    if (rec) edgeLegs(tag, "record", rec);
    const undo = page.locator(".site-corrections").getByRole("button", { name: "Undo" }).first();
    if ((await undo.count()) > 0) {
      await undo.click();
      await waitSettled(page, 90000);
      await page.waitForTimeout(600);
      const after = await page.evaluate(BLOCK_GEOM);
      check(tag, "R8 undo", !!after && !after.rows.some((r) => r.record) && after.rows.length === rows.rows.length, after ? `${after.rows.length} rows, records ${after.rows.filter((r) => r.record).length}` : "no block after undo");
    }
    await page.close();
  }
  await browser.close();
  const fails = results.filter((r) => !r.ok);
  log(`\n${fails.length === 0 ? "ALL PASS" : "FAIL"} ${results.length - fails.length}/${results.length}${fails.length ? " — " + fails.map((f) => `[${f.tag}] ${f.id}`).join(", ") : ""}`);
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 1));
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { log("ERR " + e.stack); process.exit(1); });
