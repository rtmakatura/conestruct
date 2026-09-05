// s2-arc20 investigate — measurement only (no assertions, no code change):
//   #247 — where the status line (COMPUTING / VERIFYING) and the wait
//          ribbon sit relative to the viewport while the scan runs, sampled
//          at 250 ms from the Generate click to settle, and again across a
//          correction click (Assert) from the block.
//   #248 — the scanned block's row geometry: per-row heights, every action
//          button's x/top vs its row's text, wrap detection; the open
//          picker's legend / chips / Confirm / Cancel rects.
// Sha-gated: healthz must equal argv[3] (origin/main).
const fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const BASE = process.env.A20_BASE || "https://www.conestruct.com";
const HEALTHZ = "https://rtmakatura--conestruct-render-fastapi-app.modal.run/healthz";
const OUT = process.argv[2] || path.join(__dirname, "a20-out");
const EXPECT_SHA = process.argv[3] || "";
fs.mkdirSync(OUT, { recursive: true });
// #247's repro coordinates (Denver).
const LAT = process.argv[4] || "39.726900", LNG = process.argv[5] || "-104.987300", BEARING = "180", WORKLEN = "1000";
const log = (s) => { console.log(s); fs.appendFileSync(path.join(OUT, "log.txt"), s + "\n"); };

const strip = (page) => page.evaluate(() => document.querySelector(".status-bar")?.textContent ?? "");
async function waitSettled(page, maxMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const s = await strip(page);
    if (/READY FOR TCS REVIEW|PLAN DECLINED|VERIFICATION UNAVAILABLE|NEEDS ATTENTION|VERIFIED/.test(s) && !/VERIFYING|COMPUTING/.test(s)) return s;
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
// One sample of the wait surfaces vs the viewport.
const SAMPLE = () => {
  const r = (sel) => { const el = document.querySelector(sel); if (!el) return null; const b = el.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height), text: (el.textContent || "").trim().slice(0, 70) }; };
  const res = document.querySelectorAll("section.zone")[1];
  return {
    scrollY: Math.round(window.scrollY), docH: document.documentElement.scrollHeight, innerH: window.innerHeight,
    statusBar: r(".status-bar"), ribbon: r(".stale-ribbon"), empty: r(".empty-state"),
    resultsTop: res ? Math.round(res.getBoundingClientRect().top) : null,
    resultsHeadBottom: res ? Math.round(res.querySelector(".zone-head").getBoundingClientRect().bottom) : null,
    siteJump: r(".site-jump"), waitLine: r(".results-head-wait"), block: r(".site-corrections"), hero: r(".hero"),
  };
};
async function sampleUntilSettled(page, label, maxMs) {
  const t0 = Date.now(); const samples = []; let settledAt = null; let lastKey = "";
  while (Date.now() - t0 < maxMs) {
    const s = await page.evaluate(SAMPLE); s.t = Date.now() - t0;
    const key = JSON.stringify([s.scrollY, s.statusBar?.text, s.ribbon?.text, s.empty?.text, s.resultsTop]);
    if (key !== lastKey) { samples.push(s); lastKey = key; }
    if (s.waitLine && s.waitLine.top > 60 && s.waitLine.bottom < s.innerH && !sampleUntilSettled.shot?.[label]) { (sampleUntilSettled.shot ??= {})[label] = true; await page.screenshot({ path: path.join(OUT, `wait-${label}.png`) }); }
    const st = s.statusBar?.text ?? "";
    if (settledAt === null && /READY FOR TCS REVIEW|PLAN DECLINED|VERIFICATION UNAVAILABLE|NEEDS ATTENTION|VERIFIED/.test(st) && !/VERIFYING|COMPUTING/.test(st)) settledAt = s.t;
    if (settledAt !== null && Date.now() - t0 - settledAt > 1800) break;
    await page.waitForTimeout(250);
  }
  fs.writeFileSync(path.join(OUT, `${label}-samples.json`), JSON.stringify(samples, null, 1));
  const inView = (rc, innerH) => rc && rc.bottom > 0 && rc.top < innerH;
  for (const s of samples) {
    log(`  [${label}] t=${String(s.t).padStart(5)}  scrollY=${s.scrollY} docH=${s.docH} | status ${s.statusBar ? `${s.statusBar.top}..${s.statusBar.bottom} ${inView(s.statusBar, s.innerH) ? "IN" : "OUT"} "${s.statusBar.text.slice(0, 48)}"` : "—"} | ribbon ${s.ribbon ? `${s.ribbon.top}..${s.ribbon.bottom} ${inView(s.ribbon, s.innerH) ? "IN" : "OUT"}` : "—"} | empty ${s.empty ? `${s.empty.top}..${s.empty.bottom} ${inView(s.empty, s.innerH) ? "IN" : "OUT"}` : "—"} | wait ${s.waitLine ? `${s.waitLine.top}..${s.waitLine.bottom} ${inView(s.waitLine, s.innerH) ? "IN" : "OUT"}` : "—"} | resultsTop ${s.resultsTop} | block ${s.block ? `${s.block.top}..${s.block.bottom}` : "—"}`);
  }
  return { samples, settledAt };
}
// #248 — the block's row geometry.
const BLOCK_GEOM = () => {
  const blk = document.querySelector(".site-corrections"); if (!blk) return null;
  const R = (el) => { const b = el.getBoundingClientRect(); return { left: Math.round(b.left), right: Math.round(b.right), top: Math.round(b.top), bottom: Math.round(b.bottom), w: Math.round(b.width), h: Math.round(b.height) }; };
  const rows = Array.from(blk.querySelectorAll(":scope > .sugg-row, :scope > .sys-event, .sc-grid > .sc-row:not(.sc-head)"));
  return {
    block: R(blk), blockW: Math.round(blk.clientWidth),
    rows: rows.map((row) => {
      const textEl = row.querySelector("span, legend");
      const btns = Array.from(row.querySelectorAll("button, .reason-chip")).map((b) => ({ txt: (b.textContent || "").trim().slice(0, 24), ...R(b) }));
      const tr = textEl ? R(textEl) : null;
      return {
        cls: row.className.replace(/\s+/g, " ").slice(0, 60), ...R(row), text: (row.textContent || "").trim().slice(0, 60),
        textTop: tr?.top, textRight: tr?.right,
        buttons: btns,
        wrapped: tr ? btns.filter((b) => b.top >= tr.top + 8).map((b) => b.txt) : [],
      };
    }),
  };
};
async function measureBlock(page, tag, name) {
  const g = await page.evaluate(BLOCK_GEOM);
  if (!g) { log(`[${tag}] ${name}: no block`); return null; }
  log(`[${tag}] ${name}: block ${g.block.left}..${g.block.right} (w ${g.blockW}) top ${g.block.top} h ${g.block.h}`);
  const xs = new Set();
  for (const r of g.rows) {
    log(`    row h=${String(r.h).padStart(3)} ${r.cls.padEnd(44)} textTop=${r.textTop} btns=${r.buttons.map((b) => `${b.txt}@x${b.left}-${b.right},y${b.top}`).join(" ")}${r.wrapped.length ? "  WRAPPED:" + r.wrapped.join(",") : ""}`);
    for (const b of r.buttons) if (/Dismiss|Assert|Undo|Confirm|Cancel/.test(b.txt)) xs.add(b.left);
  }
  log(`    action-button distinct x-lefts: ${[...xs].sort((a, b) => a - b).join(", ")} (${xs.size})`);
  fs.writeFileSync(path.join(OUT, `${name}-${tag}.json`), JSON.stringify(g, null, 1));
  await page.locator(".site-corrections").scrollIntoViewIfNeeded();
  await page.locator(".site-corrections").screenshot({ path: path.join(OUT, `${name}-${tag}.png`) });
  return g;
}

(async () => {
  if (EXPECT_SHA) {
    const hz = await (await fetch(HEALTHZ)).json();
    log(`healthz sha ${hz.sha} expect ${EXPECT_SHA}`);
    if (hz.sha !== EXPECT_SHA) { log("SHA GATE FAILED"); process.exit(2); }
  } else log(`local run against ${BASE} — no sha gate`);
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
    const pre = await page.evaluate(SAMPLE);
    log(`[${tag}] before click: scrollY=${pre.scrollY} docH=${pre.docH} innerH=${pre.innerH} status ${pre.statusBar?.top}..${pre.statusBar?.bottom}`);
    await gen.click();
    log(`[${tag}] --- Generate clicked; sampling to settle ---`);
    let g1 = await sampleUntilSettled(page, `generate-${tag}`, 90000);
    log(`[${tag}] settled at t=${g1.settledAt} ms; strip: ${(await strip(page)).slice(0, 70)}`);
    // A refused scan (prod Overpass budget) is a finding, not a script
    // bug: record it, then Retry through the refusal container so the
    // block can render (arc-19 run-2 idiom), up to three times.
    for (let attempt = 1; attempt <= 3 && /PLAN DECLINED/.test(await strip(page)); attempt++) {
      const retry = page.getByRole("button", { name: /Retry scan/ });
      if ((await retry.count()) === 0) break;
      log(`[${tag}] refusal #${attempt} — clicking Retry scan`);
      await retry.click();
      g1 = await sampleUntilSettled(page, `retry${attempt}-${tag}`, 90000);
      log(`[${tag}] retry ${attempt} settled at t=${g1.settledAt} ms; strip: ${(await strip(page)).slice(0, 70)}`);
    }
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT, `landed-${tag}.png`) });
    const post = await page.evaluate(SAMPLE);
    log(`[${tag}] landed: scrollY=${post.scrollY} status ${post.statusBar?.top}..${post.statusBar?.bottom} siteJump ${JSON.stringify(post.siteJump)} block ${post.block?.top}..${post.block?.bottom}`);
    // #248 rows as rendered.
    await measureBlock(page, tag, "rows");
    // The picker open on a detected row.
    const rowEl = page.locator(".site-correction-row", { hasText: /Pedestrian sidewalks|Adjacent at-grade/ }).first();
    if ((await rowEl.count()) > 0) {
      await rowEl.getByRole("button", { name: "Dismiss" }).click();
      await page.waitForTimeout(200);
      await measureBlock(page, tag, "picker-open");
      await page.locator(".reason-chip", { hasText: "Other (say what)" }).click();
      await page.waitForTimeout(150);
      await measureBlock(page, tag, "picker-other");
      await page.getByRole("button", { name: "Cancel" }).click();
    } else log(`[${tag}] no detected row to open the picker on`);
    // #247 second scenario — a correction click from the block: where is
    // the wait surface while the corrected plan re-generates?
    const schoolRow = page.locator(".site-correction-row", { hasText: "School zone" }).first();
    if ((await schoolRow.count()) > 0) {
      await schoolRow.scrollIntoViewIfNeeded();
      await schoolRow.getByRole("button", { name: "Assert" }).click();
      log(`[${tag}] --- Assert clicked from the block; sampling to settle ---`);
      const g2 = await sampleUntilSettled(page, `assert-${tag}`, 90000);
      log(`[${tag}] settled at t=${g2.settledAt} ms; strip: ${(await strip(page)).slice(0, 70)}`);
      await page.waitForTimeout(800);
      await measureBlock(page, tag, "record");
      const undo = page.locator(".site-corrections").getByRole("button", { name: "Undo" }).first();
      if ((await undo.count()) > 0) { await undo.click(); await waitSettled(page, 90000); log(`[${tag}] undone`); }
    }
    await page.close();
  }
  await browser.close();
})().catch((e) => { log("ERR " + e.stack); process.exit(1); });
