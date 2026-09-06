// s2-arc21 live check — #249 the variation-4 ledger + the results-head
// lockup + the in-flight disable, on a real browser against the deployed
// /sandbox (or the local stack with A21_BASE=http://localhost:3000).
// From the arc-20 script (s2a20-lc-prod.js): same harness, the legs
// re-pointed at the ledger and the lockup.
//
//   node s2a21-lc-prod.js <outDir> <expectSha> [lat lng]
//
// Legs, per viewport (1440×1000, 380×800):
//   W1  while the generated scenario's fetches are in flight, the wait
//       line is present and its rect lies within [nav-h, innerHeight]
//   W2  on settle the wait line is gone and the lockup is present (the
//       scan ran)
//   W3  wait line and lockup never co-present in any sample
//   L3  the lockup figure equals the detected rows; "of N checked" N
//       equals the rows the block renders (the keyed buckets served)
//   R1  every ACTION-column button (Dismiss / Assert / Cancel / Undo)
//       shares one right edge (±1 px) in every state
//   R2  no action button sits below its row's text top (no wrap)
//   R3  row heights: identical at 1440 (one line each); at 380 reported
//       (spec 68–72: the ledger line wraps, nothing hidden)
//   L1  leader dots: present (display ≠ none, width > 0) at 1440, hidden
//       at 380 (the container query on the block's own width)
//   L2  the right group is one line-box at 1440 (spec 8); reported at 380
//   R4  picker open = exactly one extra row; Confirm LAST in the picker
//       row's flex line (not in an action cell); Cancel in the condition
//       row's action cell; edges still one
//   R5  details[0] is not printed in the block (no "from anchor" either);
//       no "within N ft" / "in scan" / "ft corridor" (GO ruling b)
//   L5  footer: "scan" label, leader, "corridor scan · d mon · hh:mm utc ·
//       a correction re-generates the plan"; the <time> title is the ISO
//       stamp and its text is that stamp's own day/month/hh:mm
//   R6  axe (wcag2a/aa/21aa/22aa) with the picker open, chosen, and
//       other+note: zero color-contrast nodes inside the block or the
//       lockup; total ≤ the arc-19 baseline (1440: 2 · 380: 2, named)
//   R7  measured pairs ≥ 4.5:1 — figure, lockup lines, link, ▲ / ✓,
//       detected word, none word, evidence, name, legend, chips, note,
//       Confirm, ghost, Cancel; leader reported (decoration, exempt)
//   L4  after Assert, while the re-generation is in flight: the block is
//       mounted, aria-busy, EVERY button disabled, the wait line up, no
//       lockup; on settle: not busy, nothing disabled
//   R8  after Assert the record row keeps the shared edge, its sentence
//       is one text node with no result word; Undo restores the row
// Prod: a refused scan is a finding first — recorded, then Retry scan is
// clicked through the refusal container (≤ 3 times) so the block renders.
const fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const BASE = process.env.A21_BASE || "https://www.conestruct.com";
const HEALTHZ = "https://rtmakatura--conestruct-render-fastapi-app.modal.run/healthz";
const OUT = process.argv[2] || path.join(__dirname, "outS2A21");
const EXPECT_SHA = process.argv[3] || "";
const LAT = process.argv[4] || "39.726900", LNG = process.argv[5] || "-104.987300", BEARING = "180", WORKLEN = "1000";
fs.mkdirSync(OUT, { recursive: true });
const AXE_SRC = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf-8");
const AXE_BASELINE = { "1440x1000": 2, "380x800": 2 };
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const log = (s) => { console.log(s); fs.appendFileSync(path.join(OUT, "log.txt"), s + "\n"); };
const results = [];
const check = (tag, id, ok, detail) => { results.push({ tag, id, ok, detail }); log(`[${tag}] ${ok ? "PASS" : "FAIL"} ${id} — ${detail}`); };
const info = (tag, id, detail) => { results.push({ tag, id, ok: true, info: true, detail }); log(`[${tag}] INFO ${id} — ${detail}`); };

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
  const blk = document.querySelector(".site-corrections");
  const btns = blk ? Array.from(blk.querySelectorAll("button")) : [];
  return {
    scrollY: Math.round(window.scrollY), innerH: window.innerHeight, navH: parseInt(cs.getPropertyValue("--nav-h"), 10),
    statusBar: r(".status-bar"), wait: r(".results-head-wait"), lockup: r(".results-head-lockup"), block: r(".site-corrections"),
    busy: blk ? blk.getAttribute("aria-busy") : null, buttons: btns.length, disabled: btns.filter((b) => b.disabled).length,
  };
};
async function sampleUntilSettled(page, label, maxMs) {
  const t0 = Date.now(); const samples = []; let settledAt = null; let shot = false;
  while (Date.now() - t0 < maxMs) {
    const s = await page.evaluate(SAMPLE); s.t = Date.now() - t0; samples.push(s);
    if (!shot && s.wait && s.wait.top > s.navH && s.wait.bottom < s.innerH && s.t > 300) { shot = true; await page.screenshot({ path: path.join(OUT, `wait-${label}.png`) }); }
    const st = s.statusBar?.text ?? "";
    if (settledAt === null && SETTLED.test(st) && !/VERIFYING|COMPUTING/.test(st)) settledAt = s.t;
    if (settledAt !== null && Date.now() - t0 - settledAt > 1200) break;
    await page.waitForTimeout(100);
  }
  fs.writeFileSync(path.join(OUT, `${label}-samples.json`), JSON.stringify(samples, null, 1));
  return { samples, settledAt };
}
function waitLegs(tag, label, samples) {
  const pending = samples.filter((s) => /VERIFYING|COMPUTING/.test(s.statusBar?.text ?? ""));
  const withWait = pending.filter((s) => s.wait);
  const inView = withWait.filter((s) => s.wait.top >= s.navH && s.wait.bottom <= s.innerH);
  const late = withWait.filter((s) => s.t > 600);
  const lateIn = late.filter((s) => s.wait.top >= s.navH && s.wait.bottom <= s.innerH);
  check(tag, `W1 ${label}`, pending.length > 0 && withWait.length > 0 && late.length > 0 && lateIn.length === late.length,
    `${pending.length} pending samples, ${withWait.length} with the wait line, ${inView.length} in view; after 600 ms ${lateIn.length}/${late.length} in view; first ${withWait[0] ? `${withWait[0].wait.top}..${withWait[0].wait.bottom}` : "—"} (nav ${samples[0]?.navH}, innerH ${samples[0]?.innerH})`);
  const settled = samples.filter((s) => SETTLED.test(s.statusBar?.text ?? "") && !/VERIFYING|COMPUTING/.test(s.statusBar?.text ?? ""));
  const last = settled[settled.length - 1];
  check(tag, `W2 ${label}`, !!last && last.wait === null && !!last.lockup, last ? `settled: wait ${last.wait ? "PRESENT" : "gone"}, lockup ${last.lockup ? `"${last.lockup.text}"` : "ABSENT"}` : "never settled");
  const both = samples.filter((s) => s.wait && s.lockup);
  check(tag, `W3 ${label}`, both.length === 0, `${both.length} samples with both states (of ${samples.length})`);
  return last;
}
const BLOCK_GEOM = () => {
  const blk = document.querySelector(".site-corrections"); if (!blk) return null;
  const R = (el) => { const b = el.getBoundingClientRect(); return { left: Math.round(b.left), right: Math.round(b.right), top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height), w: Math.round(b.width) }; };
  const rows = Array.from(blk.querySelectorAll(".sc-grid > .sc-row"));
  const lk = document.querySelector(".results-head-lockup");
  const foot = blk.querySelector(".sc-foot");
  const time = foot?.querySelector("time");
  return {
    text: blk.textContent, block: R(blk), busy: blk.getAttribute("aria-busy"),
    lockup: lk ? { figure: lk.querySelector(".rh-figure")?.textContent ?? null, line1: lk.querySelector(".rh-line1")?.textContent ?? null, line2: lk.querySelector(".rh-line2")?.textContent ?? null, link: lk.querySelector(".rh-link")?.textContent ?? null, ...R(lk) } : null,
    foot: foot ? { text: foot.textContent, label: foot.querySelector(".sc-foot-label")?.textContent ?? null, leader: !!foot.querySelector(".sc-leader"), time: time ? { text: time.textContent, title: time.getAttribute("title"), datetime: time.getAttribute("datetime") } : null } : null,
    rows: rows.map((row) => {
      const name = row.querySelector(".sc-name, legend, .sc-disclosure");
      const btns = Array.from(row.querySelectorAll("button")).map((b) => ({ txt: b.textContent.trim(), ...R(b), inAction: !!b.closest(".sc-action"), disabled: b.disabled }));
      const leader = row.querySelector(".sc-lead > .sc-leader");
      const right = row.querySelector(".sc-right");
      const disc = row.querySelector(".sc-disclosure");
      return {
        cls: row.className, ...R(row), textTop: name ? R(name).top : null, buttons: btns,
        result: row.querySelector(".sc-result")?.textContent ?? null,
        evidence: row.querySelector(".sc-evidence")?.textContent ?? null,
        leader: leader ? { display: getComputedStyle(leader).display, w: Math.round(leader.getBoundingClientRect().width), color: getComputedStyle(leader).borderBottomColor } : null,
        rightLines: right ? right.getClientRects().length : null, rightH: right ? Math.round(right.getBoundingClientRect().height) : null,
        nameLines: name && name.classList.contains("sc-name") ? Math.round(name.getBoundingClientRect().height) : null,
        disclosureNodes: disc ? disc.childNodes.length : null,
        detected: !!row.querySelector(".sc-glyph.sc-detected"), absent: !!row.querySelector(".sc-glyph.sc-absent"),
        record: row.classList.contains("sc-record"), picker: row.classList.contains("site-correction-picker"),
      };
    }),
  };
};
function edgeLegs(tag, label, g) {
  const btns = g.rows.flatMap((r) => r.buttons.filter((b) => b.inAction));
  const rights = [...new Set(btns.map((b) => b.right))].sort((a, b) => a - b);
  check(tag, `R1 ${label}`, rights.length > 0 && rights[rights.length - 1] - rights[0] <= 1,
    `right edges ${rights.join("/")} across ${btns.length} action buttons (${btns.map((b) => b.txt).join(", ")})`);
  const wrapped = g.rows.flatMap((r) => r.buttons.filter((b) => b.inAction && r.textTop !== null && b.top > r.textTop + 8).map((b) => `${b.txt}@row"${r.result ?? "record"}"`));
  check(tag, `R2 ${label}`, wrapped.length === 0, wrapped.length ? `wrapped: ${wrapped.join(", ")}` : "no action below its row's text");
}
async function measureBlock(page, tag, name) {
  const g = await page.evaluate(BLOCK_GEOM);
  if (!g) { check(tag, `block ${name}`, false, "no .site-corrections block"); return null; }
  fs.writeFileSync(path.join(OUT, `${name}-${tag}.json`), JSON.stringify(g, null, 1));
  await page.locator(".site-corrections").scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  await page.locator(".site-corrections").screenshot({ path: path.join(OUT, `${name}-${tag}.png`) });
  log(`[${tag}] ${name} (block w${g.block.w}): ${g.rows.map((r) => `h${r.h}${r.record ? " REC" : r.picker ? " PICKER" : r.detected ? " det" : " abs"}[${r.buttons.map((b) => b.txt).join("+")}]`).join(" ")}`);
  return g;
}
async function runAxe(page, tag, name) {
  await page.evaluate(AXE_SRC);
  const res = await page.evaluate(() => window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } }));
  const compact = res.violations.map((v) => ({ id: v.id, impact: v.impact, targets: v.nodes.map((n) => n.target.join(" ")), data: v.nodes.map((n) => n.any?.[0]?.data ?? null) }));
  fs.writeFileSync(path.join(OUT, `axe-${name}-${tag}.json`), JSON.stringify(compact, null, 2));
  const inBlock = compact.filter((v) => v.id === "color-contrast").flatMap((v) => v.targets).filter((t) => /site-correction|sc-|reason-chip|results-head|rh-/.test(t));
  const total = compact.reduce((n, v) => n + v.targets.length, 0);
  check(tag, `R6 axe ${name}`, inBlock.length === 0 && total <= AXE_BASELINE[tag],
    `color-contrast in the block/lockup: ${inBlock.length}; total nodes ${total} (baseline ${AXE_BASELINE[tag]}): ${compact.map((v) => `${v.id}[${v.targets.join(",")}]`).join(" ; ") || "none"}`);
}
const PAIRS = () => {
  const lum = (hex) => { const c = hex.match(/\w\w/g).map((h) => parseInt(h, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const parse = (rgb) => { const m = rgb.match(/\d+(\.\d+)?/g); if (!m) return null; return { r: +m[0], g: +m[1], b: +m[2], a: m[3] === undefined ? 1 : +m[3] }; };
  const hex = (c) => "#" + [c.r, c.g, c.b].map((n) => Math.round(n).toString(16).padStart(2, "0")).join("");
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]; return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100; };
  // Effective background: composite translucent layers (the chip wash) over the first opaque ancestor.
  const effBg = (el) => { const layers = []; let e = el; while (e) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { layers.unshift(c); if (c.a >= 1) break; } e = e.parentElement; } let out = { r: 255, g: 255, b: 255 }; for (const l of layers) out = { r: l.r * l.a + out.r * (1 - l.a), g: l.g * l.a + out.g * (1 - l.a), b: l.b * l.a + out.b * (1 - l.a) }; return hex(out); };
  const pair = (name, sel, prop = "color") => { const el = document.querySelector(sel); if (!el) return { name, missing: sel }; const fg = hex(parse(getComputedStyle(el)[prop])); const bg = effBg(el); return { name, fg, bg, ratio: ratio(fg, bg) }; };
  return [
    pair("lockup figure", ".results-head-lockup .rh-figure"),
    pair("lockup line 1 (tr-field)", ".results-head-lockup .rh-line1"),
    pair("lockup line 2 (tr-step)", ".results-head-lockup .rh-line2"),
    pair("lockup link (tr-signpost)", ".results-head-lockup .rh-link"),
    pair("▲ detected symbol (--dim)", ".sc-glyph.sc-detected"),
    pair("✓ absent symbol (--pass)", ".sc-glyph.sc-absent"),
    pair("detected word (--dim)", ".sc-result.sc-detected"),
    pair("none word (body ink)", ".sc-result:not(.sc-detected)"),
    pair("evidence (faint)", ".sc-row:not(.sc-record) .sc-evidence"),
    pair("condition name (tr-field)", ".sc-name"),
    pair("legend", ".site-correction-reasons legend"),
    pair("chip unselected", ".reason-chip:not(.chosen) .reason-text"),
    pair("chip chosen on the wash", ".reason-chip.chosen .reason-text"),
    pair("note ink", ".site-correction-note"),
    pair("Confirm on the wash", ".sc-picker button.confirm"),
    pair("ghost button", ".sc-row button.ghost:not(.sc-text-btn)"),
    pair("Cancel (text button)", ".sc-row button.sc-text-btn"),
    pair("footer label", ".sc-foot .sc-foot-label"),
    pair("footer stamp", ".sc-foot time"),
    pair("leader (decoration, exempt)", ".sc-lead > .sc-leader", "borderBottomColor"),
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
    const wide = vp.width > 480;
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
    waitLegs(tag, "generate", g1.samples);
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT, `landed-${tag}.png`) });
    if ((await page.locator(".results-head-lockup").count()) > 0) await page.locator(".results-head-lockup").screenshot({ path: path.join(OUT, `lockup-${tag}.png`) });
    const rows = await measureBlock(page, tag, "rows");
    if (!rows) { await page.close(); continue; }
    const scanRows = rows.rows.filter((r) => !r.record && !r.picker);
    const detectedRows = scanRows.filter((r) => r.detected), absentRows = scanRows.filter((r) => r.absent);
    // L3 — the lockup's numbers are the block's numbers.
    const lk = rows.lockup;
    const total = rows.rows.filter((r) => !r.picker).length;
    check(tag, "L3 lockup", !!lk && lk.figure === String(detectedRows.length) && lk.line2 === `of ${total} checked` && lk.line1 === (detectedRows.length > 0 ? "Site conditions detected" : "No site conditions detected") && lk.link === "correct in setup ↑",
      lk ? `figure "${lk.figure}" (detected rows ${detectedRows.length}), "${lk.line1}", "${lk.line2}" (rows ${total}), link "${lk.link}"` : "no lockup");
    edgeLegs(tag, "rows", rows);
    const hs = [...new Set(scanRows.map((r) => r.h))];
    if (wide) check(tag, "R3 rows", hs.length === 1, `row heights ${scanRows.map((r) => r.h).join("/")} (${detectedRows.length} detected, ${absentRows.length} absent)`);
    else info(tag, "R3 rows", `row heights ${scanRows.map((r) => r.h).join("/")} (${detectedRows.length} detected, ${absentRows.length} absent) — the ledger line wraps at this width (spec 68)`);
    // L1 / L2 — leader and right group.
    const leaders = scanRows.map((r) => r.leader);
    if (wide) check(tag, "L1 leader", leaders.every((l) => l && l.display !== "none" && l.w > 0), `leader display ${[...new Set(leaders.map((l) => l?.display))].join("/")}, widths ${leaders.map((l) => l?.w).join("/")}, color ${leaders[0]?.color}`);
    else check(tag, "L1 leader", leaders.every((l) => l && l.display === "none"), `leader display ${[...new Set(leaders.map((l) => l?.display))].join("/")} (block w${rows.block.w} ≤ 420 → hidden)`);
    if (wide) check(tag, "L2 right group", scanRows.every((r) => r.rightLines === 1 && r.rightH <= 20), `right-group line boxes ${scanRows.map((r) => r.rightLines).join("/")}, heights ${scanRows.map((r) => r.rightH).join("/")}`);
    else info(tag, "L2 right group", `right-group line boxes ${scanRows.map((r) => r.rightLines).join("/")}, heights ${scanRows.map((r) => r.rightH).join("/")}, name heights ${scanRows.map((r) => r.nameLines).join("/")}`);
    check(tag, "R5 details", !/from anchor|within \d+ ft|in scan|ft corridor/.test(rows.text) && !rows.rows.some((r) => /\[|@ /.test(r.evidence ?? "")), `no "from anchor" / details fragment / radius phrase in the block text`);
    // L5 — the footer.
    const f = rows.foot;
    let footOk = false, footDetail = "no footer";
    if (f && f.time) {
      const t = f.time.title || "";
      const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(t);
      const expected = m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} · ${m[4]}:${m[5]} utc` : null;
      footOk = f.label === "scan" && f.leader && expected !== null && f.time.text === expected && f.time.datetime === t && /^corridor scan · .+ · a correction re-generates the plan$/.test(f.text.replace(/^scan/, "").trim());
      footDetail = `label "${f.label}", leader ${f.leader}, time "${f.time.text}" (title ${t}), text "${f.text}"`;
    }
    check(tag, "L5 footer", footOk, footDetail);
    // R4, R6, R7 with the picker.
    const detRow = page.locator(".site-correction-row", { has: page.locator(".sc-glyph.sc-detected") }).first();
    if ((await detRow.count()) === 0) { check(tag, "R4", false, "no detected row to open the picker on"); await page.close(); continue; }
    await detRow.getByRole("button", { name: "Dismiss" }).click();
    await page.waitForTimeout(200);
    const open = await measureBlock(page, tag, "picker-open");
    const pickerRows = open.rows.filter((r) => r.picker);
    const condRow = open.rows[open.rows.findIndex((r) => r.picker) - 1];
    const pb = pickerRows[0]?.buttons ?? [];
    check(tag, "R4 picker", open.rows.length === rows.rows.length + 1 && pickerRows.length === 1 && pb.length === 1 && pb[0].txt === "Confirm dismiss" && !pb[0].inAction && condRow?.buttons.map((b) => b.txt).join() === "Cancel" && condRow.buttons[0].inAction,
      `rows ${rows.rows.length} → ${open.rows.length}; picker row buttons [${pb.map((b) => `${b.txt}${b.inAction ? "(action cell)" : "(flex line)"}`).join(",")}]; condition row buttons [${condRow?.buttons.map((b) => b.txt).join(",")}]`);
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
    const graded = pairs.filter((p) => !/exempt/.test(p.name));
    const bad = graded.filter((p) => p.missing || p.ratio < 4.5);
    check(tag, "R7 pairs", bad.length === 0, pairs.map((p) => p.missing ? `${p.name}: MISSING ${p.missing}` : `${p.name} ${p.fg} on ${p.bg} = ${p.ratio}`).join(" · "));
    await measureBlock(page, tag, "picker-other");
    await runAxe(page, tag, "picker-other-note");
    await page.getByRole("button", { name: "Cancel" }).click();
    await page.waitForTimeout(150);
    // L4 + R8 — Assert from the block: in flight, then the record row, then Undo.
    const absRow = page.locator(".site-correction-row", { has: page.locator(".sc-glyph.sc-absent") }).first();
    if ((await absRow.count()) === 0) { check(tag, "R8", false, "no absent row to Assert"); await page.close(); continue; }
    await absRow.scrollIntoViewIfNeeded();
    await absRow.getByRole("button", { name: "Assert" }).click();
    const g2 = await sampleUntilSettled(page, `assert-${tag}`, 90000);
    log(`[${tag}] assert settled at t=${g2.settledAt} ms; strip: ${(await strip(page)).slice(0, 70)}`);
    const pend = g2.samples.filter((s) => /VERIFYING|COMPUTING/.test(s.statusBar?.text ?? ""));
    const held = pend.filter((s) => s.block && s.busy === "true" && s.buttons > 0 && s.disabled === s.buttons && s.wait && !s.lockup);
    const unheld = pend.filter((s) => !s.block);
    check(tag, "L4 in-flight disable", pend.length > 0 && held.length === pend.length && unheld.length === 0,
      `${pend.length} pending samples; ${held.length} with the block mounted + aria-busy + ${pend[0]?.disabled ?? "?"}/${pend[0]?.buttons ?? "?"} buttons disabled + wait line, no lockup; ${unheld.length} with the block unmounted`);
    const shot = g2.samples.find((s) => s.busy === "true");
    if (shot) log(`[${tag}] in-flight first seen at t=${shot.t} ms`);
    // W1 on the Assert re-generation: at 1440 graded as on Generate.  At
    // 380 REPORTED, not graded — spec 34 keeps the block mounted, so the
    // page no longer collapses under the operator (arc-20's block
    // unmounted and the wait line scrolled up into view); the in-view
    // in-flight signal is the busy block itself, the status bar and the
    // wait line sit below the fold.  Recorded as a finding for ruling.
    if (wide) waitLegs(tag, "assert", g2.samples);
    else {
      const mid = pend[Math.floor(pend.length / 2)];
      info(tag, "W1 assert (FINDING)", mid ? `mid-flight t=${mid.t}: block ${mid.block?.top}..${mid.block?.bottom} (in view, busy, ${mid.disabled}/${mid.buttons} disabled); status bar ${mid.statusBar?.top}..${mid.statusBar?.bottom}; wait line ${mid.wait?.top}..${mid.wait?.bottom}; innerH ${mid.innerH} — the wait line is BELOW the fold while the block is held` : "no pending samples");
      const settled = g2.samples.filter((s) => SETTLED.test(s.statusBar?.text ?? "") && !/VERIFYING|COMPUTING/.test(s.statusBar?.text ?? ""));
      const last = settled[settled.length - 1];
      check(tag, "W2 assert", !!last && last.wait === null && !!last.lockup, last ? `settled: wait ${last.wait ? "PRESENT" : "gone"}, lockup ${last.lockup ? "present" : "ABSENT"}` : "never settled");
      check(tag, "W3 assert", g2.samples.filter((s) => s.wait && s.lockup).length === 0, `0 samples with both states (of ${g2.samples.length})`);
    }
    await page.waitForTimeout(600);
    const rec = await measureBlock(page, tag, "record");
    const recRow = rec?.rows.find((r) => r.record);
    check(tag, "L4 settled", !!rec && rec.busy === null && rec.rows.every((r) => r.buttons.every((b) => !b.disabled)), rec ? `aria-busy ${rec.busy}, disabled buttons ${rec.rows.flatMap((r) => r.buttons).filter((b) => b.disabled).length}` : "no block");
    check(tag, "R8 record", !!recRow && recRow.disclosureNodes === 1 && recRow.result === null && recRow.leader === null && recRow.buttons.map((b) => b.txt).join() === "Undo" && recRow.buttons[0].inAction,
      recRow ? `record: sentence nodes ${recRow.disclosureNodes}, result word ${recRow.result === null ? "none" : `"${recRow.result}"`}, leader ${recRow.leader ? "present" : "none"}, buttons [${recRow.buttons.map((b) => b.txt).join(",")}]` : "no record row");
    if (rec) edgeLegs(tag, "record", rec);
    const recPair = await page.evaluate(() => { const el = document.querySelector(".sc-disclosure"); if (!el) return null; const cs = getComputedStyle(el); return { font: cs.fontFamily.slice(0, 40), size: cs.fontSize, color: cs.color }; });
    info(tag, "R8 sentence face", recPair ? `${recPair.font} ${recPair.size} ${recPair.color}` : "no sentence");
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
  const graded = results.filter((r) => !r.info);
  log(`\n${fails.length === 0 ? "ALL PASS" : "FAIL"} ${graded.length - fails.length}/${graded.length} (+${results.length - graded.length} info)${fails.length ? " — " + fails.map((f) => `[${f.tag}] ${f.id}`).join(", ") : ""}`);
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 1));
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { log("ERR " + e.stack); process.exit(1); });
