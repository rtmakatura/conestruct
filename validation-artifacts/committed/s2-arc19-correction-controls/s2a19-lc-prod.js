// s2-arc19 live check — #245 (reason picker contrast) + #246 (correction
// controls reachable from the post-generate viewport).  Browser-only:
// the wire is unchanged (the pin fixtures, snapshots and the backend
// suite prove that at test level).
//
// Two modes, picked from BASE (the s2a16–s2a18 idiom):
//   prod   BASE=https://www.conestruct.com     → the deployed site; the
//          gate is healthz sha == origin/main, else abort.
//   local  BASE=http://localhost:3000           → `next dev` on the working
//          tree with MODAL_RENDER_URL pointed at a local uvicorn of the
//          same tree (HEALTHZ env, default http://127.0.0.1:8765/healthz).
//
// Legs, run at 1440×1000 and 380×800 (the arc-18 runs were 1440 only):
//   P1  Generate at Lakewood settles with an ok scan (through refusals).
//   P2  after the #152 E landing the results-head jump line ("Site
//       conditions — N detected · correct in setup ↑") lies inside the
//       viewport; the block itself is above the fold (logged).
//   P3  clicking the line brings the block inside the viewport.
//   P4  Dismiss on the sidewalk row opens the picker: four radios in the
//       DOM, no <select>, Confirm disabled.
//   P5  axe with the picker OPEN: zero color-contrast targets inside
//       .site-correction-picker; total ≤ the viewport's named baseline.
//   P6  measured pairs (computed styles): legend, chip unselected, chip
//       chosen, note input + placeholder — every ratio ≥ 4.5.
//   P7  choose a reason: the chosen chip carries ✓ + act; axe again.
//   P8  choose Other: the note input appears; type; axe again.
//   P9  Confirm: the next audit request carries the dismiss marker
//       (reason other + note) — the new control writes the same wire
//       marker; the plan re-generates; the × record shows.
//   P10 section 03: the tier rows carry "Correct in setup ↑" /
//       "Assert in setup ↑" LINKS (no button in a row); clicking one
//       brings the block inside the viewport.
//
// Usage: node s2a19-lc-prod.js [outDir]   (BASE, HEALTHZ, RETRIES env)

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { chromium } = require("playwright");

const BASE = (process.env.BASE || "https://www.conestruct.com").replace(/\/$/, "");
const PROD = /conestruct\.com/.test(BASE);
const HEALTHZ_PROD = "https://rtmakatura--conestruct-render-fastapi-app.modal.run/healthz";
const HEALTHZ = PROD ? HEALTHZ_PROD : process.env.HEALTHZ || "http://127.0.0.1:8765/healthz";
const OUT = path.resolve(process.argv[2] || (PROD ? "outS2A19Prod" : "outS2A19Local"));
const RETRIES = Number(process.env.RETRIES || 3);
const AXE_SRC = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf-8");

const LAT = "39.711300", LNG = "-105.081500", BEARING = "180", WORKLEN = "1000";
// Ruling d: 1440 stays 2; 380 is 2 with both pre-existing findings named
// (not this arc's — a11y pile).
const VIEWPORTS = [
  { width: 1440, height: 1000, axeBaseline: 2, named: [] },
  { width: 380, height: 800, axeBaseline: 2, named: ["scrollable-region-focusable", "target-size"] },
];
const NOTE = "construction fence";

const lines = [];
let pass = 0, fail = 0, info = 0;
const log = (s) => { lines.push(s); console.log(s); };
const ok = (cond, name, detail) => {
  if (cond) { pass++; log(`**PASS** — ${name}${detail ? " — " + detail : ""}`); }
  else { fail++; log(`**FAIL** — ${name}${detail ? " — " + detail : ""}`); }
  return cond;
};
const note = (name, detail) => { info++; log(`INFO — ${name}${detail ? " — " + detail : ""}`); };
const save = (name, data) => fs.writeFileSync(path.join(OUT, name), data);
const finish = (code) => { save("s2a19-lc.md", lines.join("\n") + "\n"); process.exit(code); };

fs.mkdirSync(OUT, { recursive: true });

// ---- browser helpers (the arc-18 idiom) ----
const strip = (page) => page.evaluate(() => document.querySelector(".status-bar")?.textContent ?? "");
const hasRefusal = (page) => page.evaluate(() => !!document.querySelector(".sys-event.scan-refusal"));
async function waitSettled(page, maxMs) {
  const t0 = Date.now();
  let settled = null;
  while (Date.now() - t0 < maxMs) {
    const s = await strip(page);
    if (/READY FOR TCS REVIEW|PLAN DECLINED|VERIFICATION UNAVAILABLE|NEEDS ATTENTION|VERIFIED/.test(s) && !/VERIFYING|COMPUTING/.test(s)) {
      settled = s; break;
    }
    await page.waitForTimeout(150);
  }
  return { settled, ms: Date.now() - t0 };
}
async function waitInFlightThenSettled(page, maxMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < 5000) {
    const s = await strip(page);
    if (/VERIFYING|COMPUTING/.test(s)) break;
    await page.waitForTimeout(50);
  }
  return waitSettled(page, maxMs);
}
async function generateThroughRefusals(page) {
  await page.getByRole("button", { name: /Generate plan/ }).click();
  let g = await waitSettled(page, 90000);
  let cycles = 0;
  while ((await hasRefusal(page)) && cycles < RETRIES) {
    cycles++;
    log(`browser refusal seen — Retry scan (${cycles})`);
    await page.getByRole("button", { name: /Retry scan/ }).click();
    g = await waitInFlightThenSettled(page, 90000);
  }
  // A breakdown-side refusal (the scan budget on the second fetch) shows
  // as the stale ribbon with the audit already ok; a fresh Generate
  // refires both (the scan memo answers) — the same retry, other door.
  while (!(await hasRefusal(page)) && (await page.locator(".stale-ribbon").count()) > 0 && cycles < RETRIES) {
    cycles++;
    log(`stale ribbon after settle (breakdown refused) — Generate again (${cycles})`);
    await page.getByRole("button", { name: /Generate plan/ }).click();
    g = await waitInFlightThenSettled(page, 90000);
    await page.waitForTimeout(800);
  }
  return { ...g, refused: await hasRefusal(page), stale: (await page.locator(".stale-ribbon").count()) > 0, cycles };
}
async function gotoSandbox(page) {
  for (let i = 0; i < 3; i++) {
    try {
      await page.goto(BASE + "/sandbox", { waitUntil: "networkidle", timeout: 60000 });
      await page.waitForTimeout(600);
      return;
    } catch (e) {
      if (i === 2) throw e;
      log("goto retry " + (i + 1) + ": " + String(e).slice(0, 80));
    }
  }
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
async function runAxe(page, outName) {
  await page.evaluate(AXE_SRC);
  const res = await page.evaluate(() =>
    window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } }),
  );
  const compact = res.violations.map((v) => ({
    id: v.id, impact: v.impact,
    targets: v.nodes.map((n) => n.target.join(" ")),
    data: v.nodes.map((n) => n.any?.[0]?.data ?? null),
  }));
  save(outName, JSON.stringify(compact, null, 2));
  return compact;
}
const pickerContrastTargets = (axe) =>
  axe.filter((v) => v.id === "color-contrast").flatMap((v) => v.targets.filter((t) => /site-correction/.test(t)));
const axeSummary = (axe) => axe.map((x) => `${x.id} ${x.targets.join(",").slice(0, 60)}`).join("; ") || "none";
const rect = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s);
  if (!el) return null;
  const b = el.getBoundingClientRect();
  return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: window.innerHeight, scrollY: Math.round(window.scrollY) };
}, sel);
const inView = (r) => r !== null && r.top >= 0 && r.bottom <= r.h;
const fmt = (r) => (r ? `top ${r.top} bottom ${r.bottom} of ${r.h} (scrollY ${r.scrollY})` : "absent");
// Computed-style pairs with the WCAG ratio, walking up for the effective background.
const measurePairs = (page) => page.evaluate(() => {
  const lum = (hex) => { const c = hex.match(/\w\w/g).map((h) => parseInt(h, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const toHex = (rgb) => { const m = rgb.match(/\d+(\.\d+)?/g); if (!m) return null; if (m[3] !== undefined && Number(m[3]) === 0) return null; return "#" + m.slice(0, 3).map((n) => Number(n).toString(16).padStart(2, "0")).join(""); };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]; return Number(((hi + 0.05) / (lo + 0.05)).toFixed(2)); };
  const effBg = (el) => { let e = el; while (e) { const h = toHex(getComputedStyle(e).backgroundColor); if (h) return h; e = e.parentElement; } return "#ffffff"; };
  const pair = (el, fgProp = "color") => { if (!el) return null; const fg = toHex(getComputedStyle(el)[fgProp]); const bg = effBg(el); return { fg, bg, ratio: ratio(fg, bg) }; };
  const picker = document.querySelector(".site-correction-picker");
  const out = {};
  out.legend = pair(picker.querySelector("legend"));
  out.chipUnselected = pair(picker.querySelector(".reason-chip:not(.chosen)"));
  out.chipChosen = pair(picker.querySelector(".reason-chip.chosen"));
  const noteEl = picker.querySelector(".site-correction-note");
  out.note = pair(noteEl);
  if (noteEl) {
    // ::placeholder color, via the pseudo-element's computed style.
    const ph = toHex(getComputedStyle(noteEl, "::placeholder").color);
    out.notePlaceholder = ph ? { fg: ph, bg: effBg(noteEl), ratio: ratio(ph, effBg(noteEl)) } : null;
  }
  out.selectPresent = !!picker.querySelector("select");
  return out;
});

async function viewportRun(browser, vp) {
  const tag = `${vp.width}x${vp.height}`;
  const P = (n) => `[${tag}] ${n}`;
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  const requests = [];
  page.on("request", (req) => {
    const u = req.url();
    if (/\/api\/render\/(audit|device-breakdown)$/.test(u) && req.method() === "POST") {
      let scen = null;
      try { scen = JSON.parse(req.postData() || "{}").scenario; } catch { /* ignore */ }
      requests.push({ url: u.replace(BASE, ""), meta: scen?.meta ?? null, t: Date.now() });
    }
  });
  try {
    await gotoSandbox(page);
    await pinManually(page);
    await waitSettled(page, 60000);
    const gen = await generateThroughRefusals(page);
    ok(gen.settled !== null && !gen.refused && !gen.stale, P("P1 Generate at Lakewood settles with an ok scan and a live breakdown"), `${gen.ms} ms — ${gen.settled?.slice(0, 70)}${gen.cycles ? ` (after ${gen.cycles} retry)` : ""}${gen.stale ? " — STALE ribbon still up" : ""}`);
    if (gen.refused) { await page.close(); return; }
    await page.waitForTimeout(1500); // the smooth landing
    await page.screenshot({ path: path.join(OUT, `post-generate-${tag}.png`) });
    const line = await rect(page, ".site-jump");
    const lineText = await page.evaluate(() => document.querySelector(".site-jump")?.textContent ?? "");
    const blockBefore = await rect(page, ".site-corrections");
    ok(inView(line) && /Site conditions — \d+ detected · correct in setup ↑/.test(lineText),
      P("P2 the results-head jump line is inside the post-generate viewport"), `${fmt(line)} — "${lineText.trim()}"`);
    note(P("the block itself after the landing"), `${fmt(blockBefore)}${blockBefore && blockBefore.bottom < 0 ? " — above the fold, as measured on ed878cf" : ""}`);
    await page.locator(".site-jump a.tr-signpost").click();
    await page.waitForTimeout(1200);
    const blockAfter = await rect(page, ".site-corrections");
    ok(inView(blockAfter), P("P3 clicking the line brings the block inside the viewport"), fmt(blockAfter));
    ok(await page.evaluate(() => document.activeElement?.id === "site-corrections"), P("P3b focus moved to the block (jumpToAnchor)"));
    await page.screenshot({ path: path.join(OUT, `after-jump-${tag}.png`) });

    // ---- the picker ----
    const row = page.locator(".site-correction-row", { hasText: "Pedestrian sidewalks" }).first();
    if ((await row.count()) === 0) {
      ok(false, P("P4 the sidewalk row exists (Lakewood detects sidewalks)"), "no row");
      await page.close(); return;
    }
    await row.getByRole("button", { name: "Dismiss" }).click();
    await page.waitForTimeout(250);
    const radios = await page.locator(".site-correction-picker input[type=radio]").evaluateAll((els) => els.map((e) => e.value));
    const confirmBtn = page.getByRole("button", { name: "Confirm dismiss" });
    ok(radios.join(",") === "fenced,removed,not_in_work_zone,other" && !(await page.locator(".site-correction-picker select").count()) && (await confirmBtn.isDisabled()),
      P("P4 Dismiss opens the picker: four radios in the DOM, no <select>, Confirm disabled"), radios.join(","));
    await page.locator(".site-correction-picker").scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(OUT, `picker-open-${tag}.png`) });
    const axeOpen = await runAxe(page, `axe-picker-open-${tag}.json`);
    ok(pickerContrastTargets(axeOpen).length === 0, P("P5 axe, picker open: zero color-contrast targets in the picker"), axeSummary(axeOpen));
    ok(axeOpen.length <= vp.axeBaseline,
      P(`P5b axe total ${axeOpen.length} ≤ baseline ${vp.axeBaseline}${vp.named.length ? ` (named: ${vp.named.join(", ")})` : ""}`), axeSummary(axeOpen));
    // Measured pairs, unchosen.
    let m = await measurePairs(page);
    ok(m.legend && m.legend.ratio >= 4.5 && m.chipUnselected && m.chipUnselected.ratio >= 4.5,
      P("P6 measured: legend and unselected chip ≥ 4.5:1"), `legend ${JSON.stringify(m.legend)}; chip ${JSON.stringify(m.chipUnselected)}`);
    // Choose a reason.
    // A user clicks the chip (the radio is the 1px visually-hidden control inside it).
    await page.locator(".site-correction-picker .reason-chip", { hasText: "Fenced off" }).click();
    await page.waitForTimeout(150);
    const chosen = await page.evaluate(() => {
      const c = document.querySelector(".site-correction-picker .reason-chip.chosen");
      return c ? { glyph: c.querySelector(".reason-glyph")?.textContent, text: c.querySelector(".reason-text")?.textContent, checked: c.querySelector("input")?.checked } : null;
    });
    m = await measurePairs(page);
    ok(chosen && chosen.glyph === "✓" && chosen.text === "Fenced off" && chosen.checked === true && m.chipChosen && m.chipChosen.ratio >= 4.5 && !(await confirmBtn.isDisabled()),
      P("P7 chosen chip: ✓ glyph + text + :checked, act pair ≥ 4.5:1; Confirm enabled"), `${JSON.stringify(chosen)}; chip ${JSON.stringify(m.chipChosen)}`);
    await page.screenshot({ path: path.join(OUT, `picker-chosen-${tag}.png`) });
    const axeChosen = await runAxe(page, `axe-picker-chosen-${tag}.json`);
    ok(pickerContrastTargets(axeChosen).length === 0 && axeChosen.length <= vp.axeBaseline, P("P7b axe, reason chosen: zero picker color-contrast; total ≤ baseline"), axeSummary(axeChosen));
    // Other + note.
    await page.locator(".site-correction-picker .reason-chip", { hasText: "Other (say what)" }).click();
    await page.waitForTimeout(150);
    ok(await confirmBtn.isDisabled(), P("P8 Other without a note keeps Confirm disabled"));
    m = await measurePairs(page);
    ok(m.note && m.note.ratio >= 4.5 && m.notePlaceholder && m.notePlaceholder.ratio >= 4.5,
      P("P8b measured: note input ink and placeholder ≥ 4.5:1"), `note ${JSON.stringify(m.note)}; placeholder ${JSON.stringify(m.notePlaceholder)}`);
    await page.getByLabel("Say what", { exact: true }).fill(NOTE); // exact: the Other chip's label contains "say what" too
    await page.waitForTimeout(100);
    await page.screenshot({ path: path.join(OUT, `picker-other-${tag}.png`) });
    const axeOther = await runAxe(page, `axe-picker-other-${tag}.json`);
    ok(pickerContrastTargets(axeOther).length === 0 && axeOther.length <= vp.axeBaseline, P("P8c axe, other + note: zero picker color-contrast; total ≤ baseline"), axeSummary(axeOther));
    // Confirm → the wire marker.
    const mark = requests.length;
    await confirmBtn.click();
    let gd = await waitInFlightThenSettled(page, 90000);
    // The corrected re-generate re-scans; a refusal here is the same
    // recovery as at Generate — Retry scan through the container.
    let rc = 0;
    while ((await hasRefusal(page)) && rc < RETRIES) {
      rc++;
      log(`refusal on the corrected re-generate — Retry scan (${rc})`);
      await page.getByRole("button", { name: /Retry scan/ }).click();
      gd = await waitInFlightThenSettled(page, 90000);
    }
    if (rc) note(P("the corrected re-generate refused before settling"), `${rc} Retry scan click(s)`);
    const sent = requests.slice(mark).filter((r) => /audit$/.test(r.url)).pop();
    const o = sent?.meta?.siteConditionOverrides;
    ok(Array.isArray(o) && o.length === 1 && o[0].flag === "pedestrian_facility" && o[0].action === "dismiss" && o[0].reason === "other" && o[0].note === NOTE,
      P("P9 the next audit request carries the dismiss marker (reason other + note) — same wire marker as before"), JSON.stringify(o ?? null));
    ok(gd.settled !== null && (await page.locator(".site-correction.dismissed").count()) === 1,
      P("P9b the plan re-generates and the × record shows"), `${gd.ms} ms — ${gd.settled?.slice(0, 60)}`);

    // ---- section 03 signposts ----
    const tiers = page.locator('[aria-label="Plan reference tiers"]');
    for (const label of ["Changed this plan", "Needs attention", "Checked & passed", "Pending / not verified", "Reference"]) {
      const sum = tiers.locator(".chip-sum", { hasText: label }).first();
      if ((await sum.count()) > 0 && (await sum.getAttribute("aria-expanded")) !== "true") { await sum.click(); await page.waitForTimeout(150); }
    }
    const sp = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll(".check-list-item"));
      const correct = items.filter((i) => i.querySelector("a.tr-signpost")?.textContent === "Correct in setup ↑").length;
      const assert = items.filter((i) => i.querySelector("a.tr-signpost")?.textContent === "Assert in setup ↑").length;
      const buttonsInSignpostRows = items.filter((i) => i.querySelector("a.tr-signpost") && i.querySelector("button")).length;
      return { correct, assert, buttonsInSignpostRows };
    });
    ok(sp.correct >= 1 && sp.assert >= 1 && sp.buttonsInSignpostRows === 0,
      P("P10 section 03 rows carry Correct / Assert in setup LINKS, no button in a row"), JSON.stringify(sp));
    const link = page.locator('a.tr-signpost:text-is("Assert in setup ↑")').first();
    if ((await link.count()) === 0) {
      ok(false, P("P10b a section 03 signpost brings the block inside the viewport"), "no signpost to click");
    } else {
      await link.scrollIntoViewIfNeeded();
      await link.click();
      await page.waitForTimeout(1200);
      const blockAfter03 = await rect(page, ".site-corrections");
      ok(inView(blockAfter03), P("P10b a section 03 signpost brings the block inside the viewport"), fmt(blockAfter03));
    }
    await page.screenshot({ path: path.join(OUT, `after-signpost-${tag}.png`) });
  } finally {
    await page.close();
  }
}

(async () => {
  log(`# s2a19 live check — ${PROD ? "PRODUCTION" : "LOCAL"}`);
  log(`UTC: ${new Date().toISOString()}`);
  log(`BASE: ${BASE}`);
  const h = await fetch(HEALTHZ);
  const hz = await h.text();
  log(`healthz (HTTP ${h.status}): ${hz}`);
  if (PROD) {
    const sha = (() => { try { return JSON.parse(hz).sha; } catch { return null; } })();
    const om = execSync("git rev-parse origin/main").toString().trim();
    log(`git rev-parse origin/main: ${om}`);
    if (!ok(sha === om, "GATE — healthz sha == origin/main", `${sha} vs ${om}`)) {
      log("GATE FAILED — aborting; nothing below was run.");
      finish(2);
    }
  } else {
    const head = execSync("git rev-parse HEAD").toString().trim();
    log(`git rev-parse HEAD: ${head} — local mode: the served build is this working tree (next dev + uvicorn at ${HEALTHZ}), not a deploy.`);
  }
  log("");
  const browser = await chromium.launch();
  try {
    for (const vp of VIEWPORTS) {
      log(`## ${vp.width}×${vp.height}`);
      await viewportRun(browser, vp);
      log("");
    }
  } finally {
    await browser.close();
  }
  log(`RESULT: ${fail === 0 ? "ALL PASS" : "FAILURES"} ${pass}/${pass + fail} (+${info} INFO)`);
  finish(fail === 0 ? 0 : 1);
})().catch((e) => {
  log("SCRIPT ERROR: " + String(e && e.stack ? e.stack : e));
  finish(3);
});
