// #288 Phase 1 CLOSE — THE FOUR-STATE PROD LEG, all ten acceptance lines,
// sha-gated at both ends.
//
// This is `i288-p1-probe-local.js` with the gate put back.  That file was
// the same suite pointed at a `next start` of the branch, and it replaced
// the sha gate with a statement of what it was measuring, because gating
// on prod's healthz would have asserted something true of a machine that
// run never touched.  The fixes are deployed now, so the substitution
// ends here: the gate is UNCONDITIONAL below, and a localhost BASE fails
// it rather than being excused.
//   node probe.js <outDir> <expectSha> [base]
//
// Builds on leg 3's harness and keeps its hard-won lessons:
//   · the CTA is `button.generate-btn` (the rail's `.rail-entry.st-generate`
//     is a READ and sorts first in the DOM);
//   · S6 is reached WITHOUT a generate — a declined audit gates the CTA
//     (#180), which is the product working, not a probe failure;
//   · the audit replay is armed BEFORE the form is filled, because the
//     audit fires on input change and the shell reuses that settled answer.
//
// NEW HERE: acceptance lines 6 and 7, which every prior leg deferred.
//   line 6 — the ribbon's contrast is measured on COMPOSITED PIXELS:
//            the viewport is screenshotted mid-flight, decoded in-page to
//            a canvas, and the ribbon's own rect sampled.  Not computed
//            from tokens — computing it is what made 2.39:1 invisible.
//   line 7 — the TARGETS probe over the whole page including the footer,
//            plus axe `target-size` at 380.
const ARC = "C:/Users/rtmak/Documents/traffic-control-tool/validation-artifacts/committed/issue-288-results-stack";
const L = require("C:/Users/rtmak/Documents/traffic-control-tool/validation-artifacts/committed/s2-audit-1/audit-lib.js");
const { attachErrorTaps, classify } = require(ARC + "/err-tap.js");
const { fs, path, chromium } = L;

const OUT = process.argv[2];
const EXPECT = process.argv[3];
const BASE = process.argv[4] || "https://www.conestruct.com";

// The pin every prior leg reached candidates on, at both widths.
const FIX = { lat: "39.71466", lng: "-104.94071", way: "39508704", label: "E Bayaud, Denver" };
// Candidates for S5-WITH-NONE: a clean plan is a property of a LOCATION,
// so the only honest way to reach that state is to find a corridor the
// scan finds nothing on.  Tried in order; the leg reports which (if any)
// produced a clean plan rather than faking one.
const CLEAN_CANDIDATES = [
  { lat: "39.0361", lng: "-102.2807", label: "US-40 near Cheyenne Wells, CO (eastern plains)" },
  { lat: "38.4783", lng: "-103.7930", label: "CO-71 south of Ordway, CO" },
  { lat: "40.4850", lng: "-107.9500", label: "US-40 west of Craig, CO" },
];

fs.mkdirSync(OUT, { recursive: true });
const { log } = L.mkLog(OUT);
const rows = [];
const rec = (o) => { rows.push(o); fs.writeFileSync(path.join(OUT, "rows.json"), JSON.stringify(rows, null, 1)); };
const check = (id, ok, d) => { rec({ id, ok, detail: d }); log(`${ok === null ? "INFO" : ok ? "PASS" : "FAIL"} ${id} — ${d}`); };

const pick = async (page, tag, fix) => {
  await page.getByRole("button", { name: "Pick Location on Map" }).click();
  await page.waitForSelector("[role=dialog]", { timeout: 15000 });
  const dlg = page.locator("[role=dialog]");
  const manual = dlg.getByRole("button", { name: /Or enter coordinates manually|Hide coordinate/i });
  if (await manual.count()) {
    const t = await manual.first().textContent();
    if (/Or enter/i.test(t || "")) await manual.first().click();
  }
  await dlg.getByLabel("Latitude").fill(fix.lat);
  await dlg.getByLabel("Longitude").fill(fix.lng);
  await dlg.getByLabel("Longitude").blur();
  let cands = [];
  for (let i = 0; i < 70; i++) {
    cands = await dlg.locator("button", { hasText: /way \d+/ }).allTextContents().catch(() => []);
    if (cands.length) break;
    await page.waitForTimeout(500);
  }
  check(`${tag}.pick`, cands.length > 0, `${fix.label}: ${cands.length} candidate(s)`);
  if (!cands.length) { await page.keyboard.press("Escape").catch(() => {}); return false; }
  const want = fix.way ? dlg.locator("button", { hasText: new RegExp(`way ${fix.way}`) }) : null;
  const target = want && (await want.count()) ? want.first() : dlg.locator("button", { hasText: /way \d+/ }).first();
  await target.click();
  await page.waitForTimeout(1500);
  const save = dlg.getByRole("button", { name: "Save & Close" });
  if (await save.isDisabled()) { check(`${tag}.pick.save`, false, "Save & Close stayed disabled"); return false; }
  await save.click();
  await page.waitForSelector("[role=dialog]", { state: "detached", timeout: 15000 });
  return true;
};

const fillForm = async (page, workLen) => {
  for (const name of [/^Arterial$/, /^2$/, /^Single day$/]) {
    try {
      const b = page.getByRole("button", { name }).first();
      if (await b.count()) { await b.click(); await page.waitForTimeout(350); }
    } catch {}
  }
  if (workLen != null) {
    for (const lbl of [/work.*length/i, /length/i]) {
      try {
        const f = page.getByLabel(lbl).first();
        if (await f.count()) { await f.fill(String(workLen)); await f.blur(); break; }
      } catch {}
    }
  }
  await page.waitForTimeout(1200);
};

const generate = async (page, tag) => {
  const gen = page.locator("button.generate-btn").first();
  const name = ((await gen.textContent({ timeout: 4000 }).catch(() => "")) || "").replace(/\s+/g, " ").trim();
  check(`${tag}.cta`, !/blocked/i.test(name), `"${name}"`);
  await gen.scrollIntoViewIfNeeded();
  try { await gen.click({ timeout: 15000 }); }
  catch (e) {
    check(`${tag}.cta.click`, false, `the CTA did not accept a click in 15 s: ${String(e.message).split("\n")[0].slice(0, 120)}`);
    return false;
  }
  for (let i = 0; i < 40; i++) {
    if (await page.locator(".results-head-slot").count()) break;
    await page.waitForTimeout(500);
  }
  for (let i = 0; i < 180; i++) {
    if (!(await page.locator(".working-band").count())) return true;
    await page.waitForTimeout(1000);
  }
  return false;
};

/** The whole stack, read off the settled DOM in one pass. */
const READ = () => {
  const q = (s) => document.querySelector(s);
  const all = (s) => Array.from(document.querySelectorAll(s));
  const ny = q(".needs-you");
  const txt = document.body.textContent || "";
  const discRows = all(".disc").map((d) => ({
    name: d.querySelector(".disc-name") ? d.querySelector(".disc-name").textContent : null,
    count: d.querySelector(".disc-count") ? d.querySelector(".disc-count").textContent : null,
    open: d.querySelector(".disc-head") ? d.querySelector(".disc-head").getAttribute("aria-expanded") : null,
    read: d.querySelector(".disc-head") ? d.querySelector(".disc-head").hasAttribute("data-read") : null,
    write: d.querySelector(".disc-head") ? d.querySelector(".disc-head").hasAttribute("data-write") : null,
    panel: !!d.querySelector(".disc-panel"),
    nameSize: d.querySelector(".disc-name") ? getComputedStyle(d.querySelector(".disc-name")).fontSize : null,
  }));
  const hero = q(".hero");
  const num = q(".hero-cell .num");
  const zip = Array.from(document.querySelectorAll("button")).find((b) => /All \(\.zip\)/.test(b.textContent || ""));
  return {
    needsYou: !!ny,
    nyCount: ny && q(".ny-count") ? q(".ny-count").textContent : null,
    nyTierRows: all(".ny-item.is-changed, .ny-item.is-attention").length,
    nyChanged: all(".ny-item.is-changed").length,
    nyAttention: all(".ny-item.is-attention").length,
    nyCondRows: all(".ny-item.ny-cond").length,
    nyManualRows: all(".site-condition-manual").length,
    nyApplyRow: !!q(".ny-apply"),
    nyApplyLabel: q(".ny-apply button") ? q(".ny-apply button").textContent.replace(/\s+/g, " ").trim() : null,
    nyApplyDisabled: q(".ny-apply button") ? q(".ny-apply button").disabled : null,
    nyStanding: q(".sc-apply-text") ? q(".sc-apply-text").textContent.replace(/\s+/g, " ").trim() : null,
    nySub: q(".ny-sub") ? q(".ny-sub").textContent.replace(/\s+/g, " ").trim() : null,
    nyCaretInHead: q(".ny-head") ? q(".ny-head").textContent.indexOf("\u203a") !== -1 : null,
    nyOwnsPrimary: ny ? ny.classList.contains("owns-primary") : null,
    // clause 3 — the one primary
    priCount: all("button.pri").length,
    filledActions: all(".needs-you .act.is-on").length,
    zipPresent: !!zip,
    zipClass: zip ? zip.className : null,
    fileCountEls: all(".dl-all-count").map((e) => e.textContent),
    fileCountMatches: (txt.match(/\d+ files/gi) || []),
    dlCards: all(".dls .dl-card").length,
    // clause 4 — the rows
    discRows,
    // fix 3 — the four rows are ONE group, and the draft notice is last
    groupNames: all(".results-disc .disc-name").map((n) => n.textContent),
    strayRows: all(".disc-name").length - all(".results-disc .disc-name").length,
    refAnchor: !!q("#reference"),
    refInGroup: !!q(".results-disc #reference"),
    draftAfterGroup: (() => {
      const m = q("main"); if (!m) return null;
      const els = Array.from(m.querySelectorAll("*"));
      const g = q(".results-disc");
      const d = els.find((e) => (e.textContent || "").trim() === "Draft — not a sealed plan");
      return g && d ? els.indexOf(d) > els.indexOf(g) : null;
    })(),
    // fix 2 — the bar is gone, its facts ride the Reference summary
    jbar: !!q(".jbar-readonly"),
    refSummary: (() => {
      const r = all(".disc").find((d) => d.querySelector(".disc-name") && d.querySelector(".disc-name").textContent === "Reference");
      return r && r.querySelector(".disc-prov") ? r.querySelector(".disc-prov").textContent : null;
    })(),
    // fix 4 — the count describes what is above the sub-header
    subhead: !!q(".ny-subhead"),
    rowsAboveSubhead: (() => {
      const items = all(".needs-you .ny-item");
      const i = items.findIndex((r) => r.classList.contains("ny-subhead"));
      return i < 0 ? null : items.slice(0, i).length;
    })(),
    tierRowsAboveSubhead: (() => {
      const items = all(".needs-you .ny-item");
      const i = items.findIndex((r) => r.classList.contains("ny-subhead"));
      return i < 0 ? null : items.slice(0, i).filter((r) => /is-(changed|attention)/.test(r.className)).length;
    })(),
    // clause 2 — the hero
    heroPresent: !!hero,
    heroTracks: hero ? getComputedStyle(hero).gridTemplateColumns : null,
    heroTicks: hero ? hero.querySelectorAll(".tick").length : null,
    numSize: num ? getComputedStyle(num).fontSize : null,
    numWeight: num ? getComputedStyle(num).fontWeight : null,
    geomRows: all(".hero-meta .row").length,
    // clause 5 — headings and intro
    headingMHT: /MHT package/.test(txt),
    headingRules: /Rules, permit & audit/.test(txt),
    introText: /Generate a CDOT-compliant MHT package/.test(txt),
    zoneTags: all(".zone-tag").map((t) => t.textContent.replace(/\s+/g, " ").trim()),
    stackNamed: !!q("section.results-stack"),
    // clause 6 — the ribbon
    ribbonCount: all(".stale-ribbon").length,
    ribbonInDim: all(".stale-ribbon").filter((r) => r.closest(".results-stale")).length,
    dimPresent: !!q(".results-stale"),
    // rule 28
    slotH: q(".results-head-slot") ? Math.round(q(".results-head-slot").getBoundingClientRect().height) : null,
    stackTop: q("section.results-stack") ? Math.round(q("section.results-stack").getBoundingClientRect().top + scrollY) : null,
    // nav citation (line 8's second half)
    // The TA/sheet citation is a bare <span> in the nav — there is no
    // .nav-right class.  Reading a selector that matches nothing and
    // calling the resulting null "no date" would be a vacuous pass, so
    // the whole nav's text is captured and asserted against.
    navText: q("nav") ? q("nav").textContent.replace(/\s+/g, " ").trim() : null,
    refusal: !!q(".scan-refusal") || /PLAN DECLINED/i.test(txt),
    nsStrip: !!q(".ns-strip"),
    draftNotice: /Draft — not a sealed plan/.test(txt),
  };
};

/** Line 6 — contrast measured on COMPOSITED PIXELS.
 *  The viewport screenshot is decoded in-page onto a canvas and the
 *  ribbon's own rect sampled.  Computing this from tokens is exactly
 *  what let 2.39:1 ship, so nothing here reads a token. */
async function measureRibbonContrast(page, tag) {
  // Scroll it into view FIRST: getBoundingClientRect is viewport-relative,
  // and the ribbon sits well down the column, so an unscrolled rect has a
  // y outside the screenshot and the clip fails.
  await page.evaluate(() => {
    const r = document.querySelector(".stale-ribbon");
    if (r) r.scrollIntoView({ block: "center" });
  });
  await page.waitForTimeout(500);
  const rect = await page.evaluate(() => {
    const r = document.querySelector(".stale-ribbon");
    if (!r) return null;
    const b = r.getBoundingClientRect();
    if (b.top < 0 || b.bottom > innerHeight || b.width < 10) return null;
    // INSET past the 1px border and the padding's inner edge.  The
    // border is --rule on --da-ground at 1.57:1, and on a wide, short
    // ribbon it covers MORE pixels than the antialiased glyphs do — so
    // an un-inset sample reports the border's ratio as if it were the
    // text's.  That is what the first version of this probe did at 1440.
    const pad = 4;
    return {
      x: Math.round(b.left) + pad, y: Math.round(b.top) + pad,
      width: Math.round(b.width) - 2 * pad, height: Math.round(b.height) - 2 * pad,
    };
  });
  if (!rect || rect.width < 10 || rect.height < 10) return { ok: null, detail: "the ribbon could not be brought fully into the viewport to sample" };
  const png = (await page.screenshot({ clip: rect })).toString("base64");
  const res = await page.evaluate(async (b64) => {
    const img = new Image();
    await new Promise((r, j) => { img.onload = r; img.onerror = j; img.src = "data:image/png;base64," + b64; });
    const c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const tally = new Map();
    for (let i = 0; i < d.length; i += 4) {
      const k = `${d[i]},${d[i + 1]},${d[i + 2]}`;
      tally.set(k, (tally.get(k) || 0) + 1);
    }
    const total = d.length / 4;
    const sorted = [...tally.entries()].sort((a, b2) => b2[1] - a[1]);
    const lum = (k) => {
      const [r, g, bl] = k.split(",").map(Number);
      const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(bl);
    };
    const ratio = (a, b2) => { const l1 = lum(a), l2 = lum(b2); const hi = Math.max(l1, l2), lo = Math.min(l1, l2); return (hi + 0.05) / (lo + 0.05); };
    const bg = sorted[0][0];
    // The TEXT pixel: the colour furthest from the background that still
    // occupies a real share of the box (>=0.25%), so antialiasing fringe
    // and stray 1-pixel colours cannot masquerade as the glyph body.
    // The threshold is 0.05%, not 0.25%: a 12.5px line of glyphs in a
    // 48,000px box is a fraction of a percent once antialiasing spreads
    // it, and the higher threshold silently excluded the text.  The top
    // candidates are reported so the reading can be audited rather than
    // taken on trust.
    const cands = [];
    for (const [k, n] of sorted) {
      if (k === bg) continue;
      if (n / total < 0.0005) continue;
      cands.push({ colour: k, n, share: +(100 * n / total).toFixed(3), ratio: +ratio(k, bg).toFixed(2) });
    }
    cands.sort((a, b2) => b2.ratio - a.ratio);
    // RULE 12, applied to a measurement: the winning colour must BE a
    // declared token, or the reading is not confirmed.  The tokens are
    // read off the live .workbench at runtime rather than hard-coded, so
    // this allowlist cannot go stale against the sheet.
    //
    // This is the check that would have caught the border defect on the
    // first run without any threshold tuning: --rule and --ink-on-dark
    // are different declared tokens, and a sampler that reports the
    // border is reporting --rule.  After two confident wrong numbers on
    // this one measurement, "plausible" is not a standard.
    const wb = document.querySelector(".workbench") || document.documentElement;
    const cs = getComputedStyle(wb);
    const NAMES = ["--ink", "--ink-bright", "--ink-on-dark", "--ink-on-dark-faint",
      "--body", "--mut", "--dim", "--warn", "--fail", "--pass", "--act", "--act-bright", "--none"];
    const toRGB = (v) => {
      const t = document.createElement("span");
      t.style.color = v; t.style.display = "none";
      document.body.appendChild(t);
      const out = getComputedStyle(t).color;
      t.remove();
      const m = out.match(/(\d+),\s*(\d+),\s*(\d+)/);
      return m ? `${m[1]},${m[2]},${m[3]}` : null;
    };
    const tokens = {};
    for (const n of NAMES) {
      const raw = cs.getPropertyValue(n).trim();
      if (!raw) continue;
      const rgb = toRGB(raw);
      if (rgb) tokens[rgb] = n;
    }
    const winner = cands[0] || null;
    const token = winner ? tokens[winner.colour] || null : null;
    return {
      bg, bgShare: +(100 * sorted[0][1] / total).toFixed(2),
      text: winner, token, tokenCount: Object.keys(tokens).length,
      top: cands.slice(0, 5), distinct: sorted.length, px: total,
    };
  }, png);
  fs.writeFileSync(path.join(OUT, `ribbon-${tag}.png`), Buffer.from(png, "base64"));
  return { ok: true, detail: res, rect };
}

async function state(page, tag, opts) {
  await page.goto(`${BASE}/sandbox`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);
  if (!(await pick(page, tag, opts.fix || FIX))) return null;
  if (opts.beforeGenerate) await opts.beforeGenerate();
  await fillForm(page, opts.workLen);
  if (opts.skipGenerate) {
    await page.waitForTimeout(3000);
    const gated = await page.locator("button.generate-btn").first().isDisabled().catch(() => null);
    check(`${tag}.cta-gated`, gated !== false, `Generate disabled under the declined audit: ${gated} (#180)`);
    const rr = await page.evaluate(READ);
    await L.shot(page, OUT, tag, true);
    return rr;
  }
  const settled = await generate(page, tag);
  check(`${tag}.settle`, settled, settled ? "the pair settled" : "the band never cleared in 180 s");
  if (!settled) return null;
  const r = await page.evaluate(READ);
  await L.shot(page, OUT, tag, true);
  return r;
}

(async () => {
  // The real gate, unconditional: shaGate throws unless healthz equals
  // EXPECT, so every row below is a reading of the deployed commit.
  await L.shaGate(log, EXPECT);
  check("gate.healthz", true, `healthz == ${EXPECT}`);
  check("gate.base", !/localhost|127\.0\.0\.1/.test(BASE), `base is ${BASE}`);
  const browser = await chromium.launch();

  const ONLY = process.argv[5] || "";
  const VPS = [["1440", 1440, 1000], ["380", 380, 800]].filter(([v]) => !ONLY || ONLY.split(",").includes(v));
  for (const [vp, width, height] of VPS) {
    const floor = width >= 1440 ? 32 : 44;
    const ctx = await browser.newContext({ viewport: { width, height } });
    const page = await ctx.newPage();
    const early = attachErrorTaps(page, "early");

    // ───────── S5 WITH ITEMS ─────────
    const s5 = await state(page, `${vp}.S5items`, { workLen: 200 });
    if (s5) {
      check(`${vp}.L1.S5items`, s5.needsYou, `NEEDS YOU present: ${s5.needsYou}`);
      check(`${vp}.L5.reserve-retired`, s5.slotH === null,
        `fix 1: the reserved row renders nothing (slot height ${s5.slotH}) — a Phase 1 deviation from rule 28, because Phase 1 never builds its occupant`);
      check(`${vp}.strip-absent`, !s5.nsStrip, `.ns-strip: ${s5.nsStrip}`);
      // clause 1
      check(`${vp}.C1.cond-rows`, s5.nyCondRows > 0, `${s5.nyCondRows} condition row(s) inside the block`);
      check(`${vp}.C1.manual-keys`, s5.nyManualRows === 2, `${s5.nyManualRows} manual key row(s) (§8.25)`);
      check(`${vp}.C1.apply-row`, s5.nyApplyRow, `Apply row present: ${s5.nyApplyRow} — "${s5.nyApplyLabel}", disabled ${s5.nyApplyDisabled}`);
      check(`${vp}.C1.standing`, /staging costs nothing/.test(s5.nyStanding || ""), `standing sentence: "${s5.nyStanding}"`);
      // line 3
      check(`${vp}.L3.always-expanded`, s5.nyCaretInHead === false, `caret in the header: ${s5.nyCaretInHead}`);
      check(`${vp}.L3.count-is-sum`, String(s5.nyTierRows) === s5.nyCount, `header "${s5.nyCount}" vs ${s5.nyTierRows} tier rows (ruling 185)`);
      check(`${vp}.L3.decomposition`, !!s5.nySub, `${s5.nySub}`);
      // line 2 — one primary
      check(`${vp}.L2.one-primary`, s5.priCount + s5.filledActions <= 1,
        `rule-130 primaries ${s5.priCount} + filled actions ${s5.filledActions}; NEEDS YOU owns: ${s5.nyOwnsPrimary}; zip class "${s5.zipClass}"`);
      check(`${vp}.L2.zip-both-widths`, s5.zipPresent, `the zip renders: ${s5.zipPresent} (ruling 183, settled by clause 3)`);
      check(`${vp}.L2.cards-flat`, s5.dlCards === 4, `${s5.dlCards} download cards (ruling 182)`);
      // line 4 — the file count, once
      check(`${vp}.L4.count-once`, s5.fileCountMatches.length === 1,
        `"N files" appears ${s5.fileCountMatches.length}x: ${JSON.stringify(s5.fileCountMatches)}; el: ${JSON.stringify(s5.fileCountEls)}`);
      // clause 2 — the hero
      check(`${vp}.C2.hero-numeral`, s5.numSize === "62px" || s5.numSize === "42px",
        `numeral ${s5.numSize} / weight ${s5.numWeight}; tracks "${s5.heroTracks}"`);
      check(`${vp}.C2.ticks-gone`, s5.heroTicks === 0, `${s5.heroTicks} corner tick(s)`);
      check(`${vp}.C2.geometry-rows`, s5.geomRows > 0, `${s5.geomRows} geometry row(s) — rule 169 deviation: the cell RENDERS at both widths`);
      // clause 5 — headings and intro
      check(`${vp}.L?.C5.no-results-heading`, !s5.headingMHT, `"MHT package" heading on the page: ${s5.headingMHT}`);
      check(`${vp}.C5.no-reference-heading`, !s5.headingRules, `"Rules, permit & audit" heading: ${s5.headingRules}`);
      check(`${vp}.C5.no-intro`, !s5.introText, `the intro paragraph: ${s5.introText}`);
      check(`${vp}.C5.zone-tags`, !s5.zoneTags.some((t) => /02|03/.test(t)), `zone tags: ${JSON.stringify(s5.zoneTags)}`);
      check(`${vp}.C5.stack-named`, s5.stackNamed, `section.results-stack: ${s5.stackNamed}`);
      check(`${vp}.C5.draft-notice-kept`, s5.draftNotice, `§8.12 draft notice: ${s5.draftNotice}`);
      // clause 4 — the disclosure rows
      const names = s5.discRows.map((d) => d.name);
      check(`${vp}.C4.row-order`, JSON.stringify(names) === JSON.stringify(["Pricing quote", "Checked & passed", "Pending / not verified", "Reference"]),
        `rows: ${JSON.stringify(names)}`);
      const counted = s5.discRows.filter((d) => d.count !== null).map((d) => `${d.name}=${d.count}`);
      const uncounted = s5.discRows.filter((d) => d.count === null).map((d) => d.name);
      check(`${vp}.C4.rule-89-counts`, true, `counted: ${JSON.stringify(counted)}; uncounted: ${JSON.stringify(uncounted)}`);
      check(`${vp}.C4.rule-129-reads`, s5.discRows.every((d) => d.read === true && d.write === false),
        `every row data-read, none data-write`);
      check(`${vp}.C4.closed-in-S5`, s5.discRows.every((d) => d.open === "false"), `open states: ${JSON.stringify(s5.discRows.map((d) => d.open))}`);
      check(`${vp}.C4.rule-88-name`, s5.discRows.every((d) => d.nameSize === "13px"), `name sizes: ${JSON.stringify(s5.discRows.map((d) => d.nameSize))}`);
      // ─── the four hand-check fixes ───
      check(`${vp}.F1.no-empty-reserve`, s5.slotH === null, `results-head-slot height: ${s5.slotH}`);
      check(`${vp}.F2.bar-gone`, !s5.jbar, `.jbar-readonly present: ${s5.jbar}`);
      check(`${vp}.F2.summary`, !!s5.refSummary && /·/.test(s5.refSummary),
        `Reference summary: "${s5.refSummary}"`);
      check(`${vp}.F3.one-group`,
        JSON.stringify(s5.groupNames) === JSON.stringify(["Pricing quote", "Checked & passed", "Pending / not verified", "Reference"]) && s5.strayRows === 0,
        `group: ${JSON.stringify(s5.groupNames)}; rows outside it: ${s5.strayRows}`);
      check(`${vp}.F3.anchor-kept`, s5.refAnchor && s5.refInGroup, `#reference present ${s5.refAnchor}, inside the group ${s5.refInGroup}`);
      check(`${vp}.F3.draft-last`, s5.draftAfterGroup === true, `the draft notice follows the group: ${s5.draftAfterGroup}`);
      check(`${vp}.F4.subheader`, s5.subhead, `SITE CONDITIONS sub-header present: ${s5.subhead}`);
      check(`${vp}.F4.count-agrees`,
        s5.rowsAboveSubhead !== null && String(s5.rowsAboveSubhead) === s5.nyCount && s5.rowsAboveSubhead === s5.tierRowsAboveSubhead,
        `header "${s5.nyCount}" vs ${s5.rowsAboveSubhead} row(s) above the sub-header, all tier rows: ${s5.rowsAboveSubhead === s5.tierRowsAboveSubhead}`);
      // line 8's second half — the nav citation carries no date
      // The citation is a bare <span> in the nav — there is no
      // .nav-right class.  The first version of this check read that
      // missing selector, got undefined, and PASSED on it: a vacuous
      // pass is worse than a failure, so the nav's own text is captured
      // and the check refuses to run on an empty string.
      check(`${vp}.L8.nav-present`, !!s5.navText && s5.navText.length > 10, `nav text: "${s5.navText}"`);
      check(`${vp}.L8.nav-no-date`,
        !!s5.navText &&
          !/\d{4}-\d{2}-\d{2}|\b\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(s5.navText),
        `§8.32 — no rendered date in the nav: "${s5.navText}"`);

      // ───────── S8 — the reference open ─────────
      const refIdx = s5.discRows.findIndex((d) => d.name === "Reference");
      if (refIdx >= 0) {
        const before = s5.nyTierRows;
        await page.locator(".disc").nth(refIdx).locator(".disc-head").click();
        await page.waitForTimeout(900);
        const s8 = await page.evaluate(READ);
        const ref = s8.discRows[refIdx];
        check(`${vp}.L1.S8`, ref.open === "true" && ref.panel, `Reference aria-expanded ${ref.open} · panel ${ref.panel}`);
        check(`${vp}.S8.nothing-above-moves`, s8.nyTierRows === before, `NEEDS YOU tier rows ${before} -> ${s8.nyTierRows}`);
        check(`${vp}.S8.uncounted`, ref.count === null, `a numeral on the uncounted tier: ${ref.count}`);
        await L.shot(page, OUT, `${vp}.S8-open`, true);
      }

      // ───────── line 7 — TARGETS, page-wide, footer included ─────────
      const targets = await page.evaluate(L.TARGETS, "body");
      const under = targets.filter((t) => Math.min(t.w, t.h) < floor);
      fs.writeFileSync(path.join(OUT, `targets-${vp}.json`), JSON.stringify({ floor, total: targets.length, under }, null, 1));
      const inFooter = await page.evaluate(() => Array.from(document.querySelectorAll("footer a, footer button")).map((e) => {
        const b = e.getBoundingClientRect();
        return { name: (e.textContent || "").trim(), w: Math.round(b.width), h: Math.round(b.height) };
      }));
      check(`${vp}.L7.targets`, under.length === 0,
        `${targets.length} interactive, ${under.length} under ${floor}px: ${JSON.stringify(under.map((u) => `${u.tag}.${u.cls}|${u.name}|${u.w}x${u.h}`)).slice(0, 400)}`);
      check(`${vp}.L7.footer`, inFooter.every((f) => Math.min(f.w, f.h) >= floor),
        `footer: ${JSON.stringify(inFooter)}`);

      // ───────── line 6 — the ribbon, measured mid-flight ─────────
      // A refetch is provoked by a strip edit and the audit/breakdown
      // responses are DELAYED so the in-flight window is long enough to
      // screenshot.  The delay is instrumentation of TIMING only: the
      // pixels sampled are the ones the page actually composited.
      await page.route((u) => /\/api\/render\/(audit|device-breakdown)/i.test(u.toString()), async (route) => {
        await new Promise((r) => setTimeout(r, 9000));
        await route.continue();
      });
      let ribbonSeen = false;
      try {
        const edit = page.getByRole("button", { name: /Edit Speed/i }).first();
        if (await edit.count()) {
          await edit.click();
          await page.waitForTimeout(400);
          const sel = page.locator(".setup-strip select, .setup-strip input").first();
          if (await sel.count()) {
            const tag = await sel.evaluate((e) => e.tagName.toLowerCase());
            if (tag === "select") {
              const opts = await sel.locator("option").allTextContents();
              const other = opts.find((o) => /\d/.test(o) && !/65/.test(o));
              if (other) await sel.selectOption({ label: other });
            } else {
              await sel.fill("45");
              await sel.blur();
            }
          }
        }
        for (let i = 0; i < 40; i++) {
          if (await page.locator(".stale-ribbon").count()) { ribbonSeen = true; break; }
          await page.waitForTimeout(400);
        }
      } catch (e) {
        check(`${vp}.L6.provoke`, null, `could not provoke a refetch: ${String(e.message).split("\n")[0].slice(0, 120)}`);
      }
      if (ribbonSeen) {
        const mid = await page.evaluate(() => {
          const r = document.querySelector(".stale-ribbon");
          return { inDim: !!(r && r.closest(".results-stale")), dim: !!document.querySelector(".results-stale"), text: r ? r.textContent.replace(/\s+/g, " ").trim().slice(0, 80) : null };
        });
        check(`${vp}.L6.not-dimmed`, mid.inDim === false, `the ribbon is inside .results-stale: ${mid.inDim} (dim present: ${mid.dim}) — "${mid.text}"`);
        const m = await measureRibbonContrast(page, vp);
        if (m.ok && m.detail.text && !m.detail.token) {
          // Not a failure of the RIBBON — a failure to confirm what was
          // sampled.  Reported as unconfirmed rather than passed, which
          // is the whole point of the allowlist.
          check(`${vp}.L6.contrast`, null,
            `UNCONFIRMED — the sampled colour rgb(${m.detail.text.colour}) at ${m.detail.text.ratio}:1 matches no declared token (${m.detail.tokenCount} tokens read from .workbench). The reading is not trusted.`);
        } else if (m.ok && m.detail.text) {
          check(`${vp}.L6.contrast`, m.detail.text.ratio >= 4.5,
            `COMPOSITED ${m.detail.text.ratio}:1 — text rgb(${m.detail.text.colour}) = ${m.detail.token} ${m.detail.text.share}% on bg rgb(${m.detail.bg}) ${m.detail.bgShare}% (${m.detail.px} px, border inset out); top: ${m.detail.top.map((c) => `${c.ratio}:1@${c.share}%`).join(" ")}`);
        } else {
          check(`${vp}.L6.contrast`, null, `could not sample: ${JSON.stringify(m.detail)}`);
        }
        await L.shot(page, OUT, `${vp}.midflight`, false);
      } else {
        check(`${vp}.L6.contrast`, null, "no ribbon appeared — the refetch could not be provoked at this width");
      }
      await page.unroute((u) => /\/api\/render\/(audit|device-breakdown)/i.test(u.toString()));
      await page.waitForTimeout(12000);

      // ───────── line 7 — axe at 380 ─────────
      if (vp === "380") {
        // WAIT FOR THE DIM TO CLEAR before auditing.  The line-6 block
        // above provokes a refetch on purpose, and `.results-stale`
        // applies opacity .5 + grayscale — so an axe run that lands
        // inside that window measures the WASH, not the page: it
        // reported --mut as #54606f and --dim as #8a552e and raised 29
        // colour-contrast violations that are artefacts of the dim.
        // Acceptance line 7 is about the settled page, so that is what
        // is audited.
        for (let i = 0; i < 60; i++) {
          if (!(await page.locator(".results-stale").count())) break;
          await page.waitForTimeout(1000);
        }
        const dimStill = await page.locator(".results-stale").count();
        check(`380.axe.settled`, dimStill === 0,
          `the page is settled before axe runs (.results-stale present: ${dimStill > 0})`);
        const ax = await L.runAxe(page, OUT, `380`);
        const ts = ax.filter((v) => v.id === "target-size");
        check(`380.L7.axe-target-size`, ts.length === 0,
          `axe target-size violations: ${ts.length}${ts.length ? " — " + JSON.stringify(ts[0].nodes.slice(0, 3)) : ""}; other violations: ${ax.filter((v) => v.id !== "target-size").map((v) => v.id).join(", ") || "none"}`);
      }
    }

    // ───────── S5 WITH NONE — a genuinely clean corridor ─────────
    let cleanFound = null;
    for (const cand of CLEAN_CANDIDATES) {
      const r = await state(page, `${vp}.S5none[${cand.label.slice(0, 22)}]`, { workLen: 200, fix: cand });
      if (!r) continue;
      if (!r.needsYou || r.nyTierRows === 0) { cleanFound = { cand, r }; break; }
      check(`${vp}.S5none.try`, null, `${cand.label}: ${r.nyTierRows} tier row(s) — not clean, trying the next pin`);
    }
    if (cleanFound) {
      const { cand, r } = cleanFound;
      check(`${vp}.L1.S5none`, true, `${cand.label}: NEEDS YOU present ${r.needsYou}, tier rows ${r.nyTierRows}`);
      check(`${vp}.L2.S5none-primary`, r.priCount === 1 && r.filledActions === 0,
        `rule-130 primaries ${r.priCount}, filled actions ${r.filledActions}; zip class "${r.zipClass}" (clause 3: count 0 -> the zip IS the primary)`);
      check(`${vp}.L4.S5none-count-once`, r.fileCountMatches.length === 1, `"N files" x${r.fileCountMatches.length}`);
      check(`${vp}.L5.S5none-reserve`, r.slotH === 44, `reserved row ${r.slotH}px`);
    } else {
      check(`${vp}.L1.S5none`, null,
        `NOT REACHED on prod: none of the ${CLEAN_CANDIDATES.length} candidate corridors produced a clean plan. Covered at the mount by GeneratorShell.needs-you.test.tsx; not faked here.`);
    }

    // ───────── S6 DECLINED, by replay ─────────
    const REFUSAL = "Work zone geometry refused: taper length below the MUTCD floor for the posted speed.";
    const s6 = await state(page, `${vp}.S6`, {
      workLen: 200,
      skipGenerate: true,
      beforeGenerate: async () => {
        await page.route((u) => /audit/i.test(u.toString()), async (route) => {
          await route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ detail: REFUSAL }) });
        });
        check(`${vp}.S6.replay-armed`, null, "the AUDIT call is answered with a real-shaped 400 — a REPLAY, labelled: this measures the frontend, not the backend");
      },
    });
    await page.unroute((u) => /audit/i.test(u.toString()));
    if (s6) {
      check(`${vp}.L1.S6`, s6.refusal, `a refusal is on screen: ${s6.refusal}`);
      check(`${vp}.S6.no-needs-you`, !s6.needsYou, `NEEDS YOU beside the refusal: ${s6.needsYou} (spec 31, rule 10)`);
      check(`${vp}.S6.no-ribbon`, s6.ribbonCount === 0, `${s6.ribbonCount} ribbon(s) under a decline (#258)`);
    }

    const e = early.report(); const ce = classify(e);
    check(`${vp}.L8.pageerror-zero`, e.counts.pageerror === 0, `${e.counts.pageerror} pageerror, ${e.counts.consoleError} console error(s)`);
    check(`${vp}.L8.hydration-zero`, ce.hydration.length === 0, `hydration-shaped: ${ce.hydration.length}`);
    fs.writeFileSync(path.join(OUT, `taps-${vp}.json`), JSON.stringify(e, null, 1));
    await ctx.close();
  }

  await browser.close();
  await L.shaGate(log, EXPECT);
  check("gate.healthz-after", true, `healthz still ${EXPECT}`);
  log(`\nDONE — ${rows.length} rows, ${rows.filter((r) => r.ok === false).length} FAIL`);
})().catch((e) => { log("LEG CRASHED " + e.stack); process.exit(3); });
