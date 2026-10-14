// #295 — every text node under `.results-stale`, measured INSIDE the dim.
//
//   node probe295.js <outDir> [base] [widths]
//     base   default https://www.conestruct.com (a `next start` of the
//            branch when measuring before ship)
//     widths default 1440,380
//
// The inverse of #288 leg 6's `380.axe.settled`: this probe audits the
// dim on purpose, in both states that mount the wrapper —
//   flight  — a refetch provoked by a setup-strip edit, the audit and
//             breakdown responses held 60 s so the window can be read;
//   staged  — a NEEDS YOU "Assert" clicked and left unapplied
//             (`stagedDisclose`, no request in flight; the state that
//             persists longest).
// In each: (1) every visible element under the wrapper that owns a text
// node is screenshotted and its contrast read off COMPOSITED PIXELS (the
// background is the rect's modal colour, the text the highest-contrast
// colour holding >= 6 px), against the floor its own size sets (3:1 at
// >= 24 px, or >= 18.66 px bold; 4.5:1 otherwise); (2) axe's
// color-contrast rule, scoped to the wrapper.  Computing contrast from
// tokens is what let 2.39:1 ship through #259, so the pass/fail here
// reads pixels; the declared colour is recorded beside it only so a
// reading can be audited.
const L = require("C:/Users/rtmak/Documents/traffic-control-tool/validation-artifacts/committed/s2-audit-1/audit-lib.js");
const { fs, path, chromium } = L;

const OUT = process.argv[2];
const BASE = process.argv[3] || "https://www.conestruct.com";
const WIDTHS = (process.argv[4] || "1440,380").split(",").map(Number);

fs.mkdirSync(OUT, { recursive: true });
const { log } = L.mkLog(OUT);
const rows = [];
const rec = (o) => { rows.push(o); fs.writeFileSync(path.join(OUT, "rows.json"), JSON.stringify(rows, null, 1)); };
const check = (id, ok, d) => { rec({ id, ok, detail: d }); log(`${ok === null ? "INFO" : ok ? "PASS" : "FAIL"} ${id} — ${d}`); };

const REPO = "C:/Users/rtmak/Documents/traffic-control-tool";
const { hook } = require(`${REPO}/scripts/live-check.cjs`);
const { applyGate, gateHeaders } = require(`${REPO}/scripts/gate.cjs`);
// The shoulder plan the #286 calc-row probe used: N Broadway SB, 30 mph.
const PLAN = { lat: "39.73370", lng: "-104.98753", chip: "kind-chip-shoulder", speed: "30", other: "35" };

/** Pin, kind, confirm, generate; true once the hero has settled. */
async function toResults(page, tag) {
  await page.goto(`${BASE}/sandbox`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(8000);
  await (await hook(page, "where-open-picker")).click();
  await page.waitForTimeout(3500);
  await page.getByRole("button", { name: /enter coordinates manually/i }).click();
  await page.waitForTimeout(1200);
  await page.getByPlaceholder(/^Latitude/).fill(PLAN.lat);
  await page.getByPlaceholder(/^Longitude/).fill(PLAN.lng);
  const card = page.getByText(/Road detected · 1 match|Which road\?|No road|No roads detected/).first();
  for (let i = 0; i < 90 && (await card.count()) === 0; i += 1) await page.waitForTimeout(1000);
  const cand = page.locator("button").filter({ hasText: /\((primary|secondary|tertiary|residential|trunk|motorway)/ }).first();
  if ((await page.getByText(/Which road\?/).count()) > 0 && (await cand.count()) > 0) {
    await cand.scrollIntoViewIfNeeded();
    await cand.click();
  }
  await page.waitForTimeout(2500);
  const save = page.getByRole("button", { name: /Save & Close/ });
  for (let i = 0; i < 60 && !(await save.isEnabled()); i += 1) await page.waitForTimeout(1000);
  await save.click();
  await page.waitForTimeout(4000);
  await (await hook(page, PLAN.chip)).click();
  await page.waitForTimeout(2500);
  const side = page.locator('[data-testid="side-option"]').first();
  for (let i = 0; i < 20 && (await side.count()) === 0; i += 1) await page.waitForTimeout(1000);
  if (await side.count()) await side.click();
  await page.waitForTimeout(2500);
  await (await hook(page, "where-confirm")).click();
  await page.waitForTimeout(9000);
  const gen = page.getByRole("button", { name: /Generate plan/ }).first();
  for (let i = 0; i < 120 && !(await gen.isEnabled()); i += 1) {
    const sp = page.locator("#what-speed");
    if (i % 5 === 0 && (await sp.count()) && (await sp.inputValue().catch(() => "x")) === "") {
      await sp.selectOption(PLAN.speed).catch(() => {});
    }
    await page.waitForTimeout(1000);
  }
  if (!(await gen.isEnabled())) {
    check(`${tag}.generate`, null, `Generate stayed disabled: "${await gen.getAttribute("title")}"`);
    return false;
  }
  await gen.click({ timeout: 5000 });
  for (let i = 0; i < 180; i++) {
    if ((await page.locator(".hero").count()) && !(await page.locator(".working-band").count()) && !(await page.locator(".results-stale").count())) {
      check(`${tag}.settle`, true, "the answer settled");
      return true;
    }
    await page.waitForTimeout(1000);
  }
  check(`${tag}.settle`, false, "the answer never settled in 180 s");
  return false;
}

/** Staged: the SPEED setup cell opens its field; a new value is a staged
 *  field edit (`stagedDisclose`), with no request in flight. */
async function stageSpeed(page) {
  const cell = page.locator('[data-testid="setup-link-speed"]').first();
  if (!(await cell.count())) return "no SPEED setup link";
  await cell.click();
  await page.waitForTimeout(1500);
  const sp = page.locator("#revise-speed, #what-speed").first();
  if (!(await sp.count())) {
    await L.shot(page, OUT, "debug-after-speed-link", false);
    const dom = await page.evaluate(() => ({
      selects: Array.from(document.querySelectorAll("select")).map((e) => `${e.id}|${e.name}|${e.getAttribute("aria-label")}|${e.value}`),
      inputs: Array.from(document.querySelectorAll("input")).filter((e) => e.offsetParent).map((e) => `${e.id}|${e.type}|${e.getAttribute("aria-label")}|${e.value}`).slice(0, 20),
      buttons: Array.from(document.querySelectorAll("button")).filter((e) => e.offsetParent).map((e) => (e.getAttribute("aria-label") || e.textContent || "").replace(/\s+/g, " ").trim().slice(0, 30)).slice(0, 60),
    }));
    return "no speed select after the setup link: " + JSON.stringify(dom);
  }
  const cur = await sp.inputValue().catch(() => "");
  await sp.selectOption(cur === PLAN.other ? PLAN.speed : PLAN.other);
  await page.waitForTimeout(2000);
  return null;
}

/** Flight: Apply the staged edit; the held requests keep the previous
 *  answer up under the dim. */
async function applyStaged(page) {
  const apply = page.getByRole("button", { name: /^Apply\b/i }).first();
  if (!(await apply.count())) return "no Apply button";
  await apply.scrollIntoViewIfNeeded();
  await apply.click({ timeout: 5000 });
  return null;
}

/** Every visible element under the wrapper that owns a non-blank text
 *  node: a stable label, its declared colour and size, and a page rect. */
const INVENTORY = (settled) => {
  const hero = document.querySelector(".hero");
  const w = settled ? hero && hero.closest('div[class=""]') : document.querySelector(".results-stale");
  if (!w) return null;
  document.querySelectorAll("[data-probe-root]").forEach((e) => e.removeAttribute("data-probe-root"));
  w.setAttribute("data-probe-root", "");
  const out = [];
  const seen = new Set();
  for (const el of w.querySelectorAll("*")) {
    const own = Array.from(el.childNodes).filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join(" ");
    if (!own) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    const b = el.getBoundingClientRect();
    if (b.width < 2 || b.height < 2) continue;
    // Hidden inside a closed disclosure or clipped to nothing.
    if (el.closest("[hidden]")) continue;
    const cls = (el.className && el.className.toString ? el.className.toString() : "").trim().split(/\s+/).filter(Boolean).slice(0, 3).join(".");
    const par = el.parentElement;
    const pcls = par && par.className && par.className.toString ? par.className.toString().trim().split(/\s+/).filter(Boolean).slice(0, 2).join(".") : "";
    const label = `${pcls ? "." + pcls + " > " : ""}${el.tagName.toLowerCase()}${cls ? "." + cls : ""}`;
    const key = `${label}|${cs.color}|${cs.fontSize}`;
    const dup = seen.has(key);
    seen.add(key);
    out.push({
      label, text: own.replace(/\s+/g, " ").slice(0, 40), color: cs.color, size: parseFloat(cs.fontSize),
      weight: parseInt(cs.fontWeight, 10) || 400, dup,
      // WCAG 1.4.3 exempts inactive controls (axe skips them too).
      disabled: !!el.closest("button:disabled, [aria-disabled='true']"),
      x: b.left + scrollX, y: b.top + scrollY, w: b.width, h: b.height,
    });
  }
  return out;
};

/** Contrast of one element off composited pixels. */
async function sample(page, it, OUTP) {
  await page.evaluate(({ x, y, h }) => window.scrollTo(0, Math.max(0, y - innerHeight / 2 + h / 2)), it);
  await page.waitForTimeout(120);
  const vp = page.viewportSize();
  const sy = await page.evaluate(() => scrollY);
  const clip = { x: Math.max(0, Math.round(it.x)), y: Math.max(0, Math.round(it.y - sy)), width: Math.round(it.w), height: Math.round(it.h) };
  clip.width = Math.min(clip.width, vp.width - clip.x);
  clip.height = Math.min(clip.height, vp.height - clip.y);
  if (clip.width < 2 || clip.height < 2) return null;
  const png = (await page.screenshot({ clip })).toString("base64");
  if (OUTP) fs.writeFileSync(OUTP, Buffer.from(png, "base64"));
  return page.evaluate(async (b64) => {
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
    const sorted = [...tally.entries()].sort((a, b) => b[1] - a[1]);
    const lum = (k) => {
      const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      const [r, g, bl] = k.split(",").map(Number);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(bl);
    };
    const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
    const bg = sorted[0][0];
    let best = null;
    for (const [k, n] of sorted) {
      if (k === bg || n < 6) continue;
      const r = ratio(k, bg);
      if (!best || r > best.ratio) best = { colour: k, n, ratio: r };
    }
    return { bg, ink: best ? best.colour : null, ratio: best ? +best.ratio.toFixed(2) : null, px: d.length / 4 };
  }, png);
}

async function measure(page, vp, st) {
  const settled = st === "settled";
  const inv = await page.evaluate(INVENTORY, settled);
  if (!inv) { check(`${vp}.${st}.wrapper`, false, settled ? "the results wrapper was not found" : ".results-stale is not mounted"); return; }
  check(`${vp}.${st}.wrapper`, true, `${inv.length} text element(s) under .results-stale (${inv.filter((i) => !i.dup).length} distinct label/colour/size)`);
  const dir = path.join(OUT, `${vp}-${st}`);
  fs.mkdirSync(dir, { recursive: true });
  const table = [];
  let i = 0;
  for (const it of inv) {
    i++;
    // Must still be in the dim when sampled: a settle mid-run would
    // measure the undimmed page and pass vacuously.
    if (!settled && !(await page.locator(".results-stale").count())) {
      check(`${vp}.${st}.held`, false, `the dim cleared after ${i - 1} of ${inv.length} samples`);
      break;
    }
    const s = await sample(page, it, it.dup ? null : path.join(dir, `${String(i).padStart(3, "0")}.png`));
    const large = it.size >= 24 || (it.size >= 18.66 && it.weight >= 700);
    const floor = large ? 3 : 4.5;
    table.push({ ...it, floor, ...(s || {}) });
  }
  fs.writeFileSync(path.join(dir, "samples.json"), JSON.stringify(table, null, 1));
  const exempt = table.filter((t) => t.disabled);
  const measured = table.filter((t) => t.ratio != null && !t.disabled);
  const fails = measured.filter((t) => t.ratio < t.floor);
  const unread = table.filter((t) => t.ratio == null);
  const worst = [...measured].sort((a, b) => a.ratio / a.floor - b.ratio / b.floor).slice(0, 6);
  check(`${vp}.${st}.pixels`, fails.length === 0 && measured.length > 0,
    `${measured.length} sampled, ${fails.length} under their floor, ${unread.length} unreadable, ${exempt.length} disabled (exempt); nearest the floor: ${worst.map((t) => `${t.label} "${t.text}" ${t.ratio}:1/${t.floor}`).join(" · ")}`);
  for (const f of fails.slice(0, 20)) check(`${vp}.${st}.pixels.fail`, false, `${f.label} "${f.text}" ${f.size}px: ${f.ratio}:1 < ${f.floor} (ink rgb(${f.ink}) on rgb(${f.bg}); declared ${f.color})`);

  await page.addScriptTag({ path: "C:/Users/rtmak/Documents/traffic-control-tool/conestruct/site/node_modules/axe-core/axe.min.js" });
  const ax = await page.evaluate(async () => {
    const r = await window.axe.run({ include: ["[data-probe-root]"] }, { runOnly: { type: "rule", values: ["color-contrast"] } });
    return { violations: r.violations.flatMap((v) => v.nodes.map((n) => ({ target: n.target.join(" "), summary: (n.failureSummary || "").replace(/\s+/g, " ").slice(0, 200) }))), passes: r.passes.reduce((s, v) => s + v.nodes.length, 0), incomplete: r.incomplete.reduce((s, v) => s + v.nodes.length, 0) };
  });
  fs.writeFileSync(path.join(dir, "axe.json"), JSON.stringify(ax, null, 1));
  check(`${vp}.${st}.axe`, ax.violations.length === 0,
    `color-contrast inside the dim: ${ax.violations.length} violation(s), ${ax.passes} pass, ${ax.incomplete} incomplete${ax.violations.length ? " — " + ax.violations.slice(0, 4).map((v) => v.target + ": " + v.summary).join(" | ") : ""}`);
  if (settled) {
    // Calibration: the same sampler on the undimmed answer, where #288 leg 6
    // measured 0 colour-contrast violations.  A reading under the floor
    // here is the sampler's error, not the page's.
    return;
  }
  check(`${vp}.${st}.still-dimmed`, (await page.locator(".results-stale").count()) > 0, "the wrapper was still mounted when axe finished");
  const treat = await page.evaluate(() => {
    const w = document.querySelector(".results-stale");
    const cs = getComputedStyle(w);
    const rib = Array.from(document.querySelectorAll(".stale-ribbon"));
    return { opacity: cs.opacity, filter: cs.filter, ribbons: rib.length, ribbonsInDim: rib.filter((r) => r.closest(".results-stale")).length, ribbonText: rib.map((r) => r.textContent.replace(/\s+/g, " ").trim().slice(0, 90)) };
  });
  check(`${vp}.${st}.treatment`, treat.ribbons > 0 && treat.ribbonsInDim === 0,
    `wrapper opacity ${treat.opacity}, filter ${treat.filter}; ${treat.ribbons} ribbon(s), ${treat.ribbonsInDim} inside the dim: ${JSON.stringify(treat.ribbonText)}`);
  await page.evaluate(() => document.querySelector(".results-stale").scrollIntoView({ block: "start" }));
  await page.evaluate(() => window.scrollBy(0, -120));
  await L.shot(page, OUT, `${vp}-${st}`, false);
}

(async () => {
  gateHeaders(BASE);
  check("base", null, BASE);
  const browser = await chromium.launch();
  for (const width of WIDTHS) {
    const vp = String(width);
    // Device scale 2: at 1, a 10 px glyph's strokes rarely reach their
    // declared colour, so the highest-contrast pixel under-reads the ink.
    const ctx = await browser.newContext({ viewport: { width, height: width >= 1440 ? 1000 : 800 }, deviceScaleFactor: 2 });
    await applyGate(ctx, BASE);
    const page = await ctx.newPage();
    let ok = false;
    for (let t = 1; t <= 3 && !ok; t++) ok = await toResults(page, `${vp}.try${t}`);
    if (!ok) { await ctx.close(); continue; }
    await L.shot(page, OUT, `${vp}-settled`, false);
    await measure(page, vp, "settled");

    // ── staged ──
    const why = await stageSpeed(page);
    let st = !why && (await page.locator(".results-stale").count()) > 0;
    check(`${vp}.staged.provoked`, st, st ? "a SPEED edit staged, not applied; the dim is up with no request in flight" : `staging did not mount the dim: ${why || "no wrapper"}`);
    if (st) await measure(page, vp, "staged");

    // ── flight ──
    const HOLD = (u) => /\/api\/render\/(audit|device-breakdown)/i.test(u.toString());
    await page.route(HOLD, async (route) => { await new Promise((r) => setTimeout(r, 60000)); await route.continue().catch(() => {}); });
    const why2 = st ? await applyStaged(page) : "nothing staged";
    let up = false;
    for (let i = 0; i < 40 && !why2; i++) {
      if ((await page.locator(".results-stale").count()) && (await page.getByText(/predate the request in flight/).count())) { up = true; break; }
      await page.waitForTimeout(250);
    }
    check(`${vp}.flight.provoked`, up, up ? "Apply sent; the dim is up with the request held" : `no flight: ${why2 || "the in-flight ribbon never showed"}`);
    if (up) await measure(page, vp, "flight");
    await page.unroute(HOLD);
    await ctx.close();
  }
  await browser.close();
  log("done");
})().catch((e) => { log("CRASH " + (e && e.stack || e)); process.exit(1); });
