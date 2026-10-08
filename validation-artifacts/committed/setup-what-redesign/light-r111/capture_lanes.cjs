// R111 (light lane) — the Setup box's Lanes cell after Generate, at 1440
// and 390, on a local build of the branch (AUDIT_SITE).  The route is
// build-2/capture_setup.cjs's (E Colfax, 1,000 ft shoulder work), then
// GENERATE PLAN.  Then handoff.md § Light lane step 5's checks on that
// page: status, sideways scroll, axe, target floors, contrast pairs, page
// errors.  Writes:
//   log.txt                 one line of checks per width + the Lanes measure
//   lanes-<w>.json          the pair: each button's box, each value's ink
//                           box, and the gap between "2 ×" and "12 ft"
//   setup-<w>.png           the Setup box at rest
//   lanes-<w>-hover-<k>.png the Lanes cell with each half hovered (the
//                           label must stay drawn over the width's fill)
// Usage: GATE_BYPASS_TOKEN=... AUDIT_SITE=http://localhost:3108/sandbox
//        AUDIT_OUT=<dir> node capture_lanes.cjs
const REPO = "C:/Users/rtmak/Documents/traffic-control-tool";
const lib = require(`${REPO}/scripts/audit-lib.js`);
const { chromium, fs, path, PAIRS, TARGETS, runAxe } = lib;
const { hook } = require(`${REPO}/scripts/live-check.cjs`);
const { applyGate, gateHeaders } = require(`${REPO}/scripts/gate.cjs`);

const SITE = process.env.AUDIT_SITE || "http://localhost:3108/sandbox";
const OUT = process.env.AUDIT_OUT;
if (!OUT) throw new Error("AUDIT_OUT is required");
fs.mkdirSync(OUT, { recursive: true });
gateHeaders(SITE);
const log = (s) => {
  console.log(s);
  fs.appendFileSync(path.join(OUT, "log.txt"), s + "\n");
};
const PIN = { lat: "39.74020", lng: "-104.95600" };

async function toWhat(page) {
  const resp = await page.goto(SITE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);
  await (await hook(page, "where-open-picker")).click();
  await page.waitForTimeout(3500);
  await page.getByRole("button", { name: /enter coordinates manually/i }).click();
  await page.waitForTimeout(1200);
  await page.getByPlaceholder(/^Latitude/).fill(PIN.lat);
  await page.getByPlaceholder(/^Longitude/).fill(PIN.lng);
  await page.waitForTimeout(2500);
  const save = page.getByRole("button", { name: /Save & Close/ });
  const candidate = page
    .locator("button")
    .filter({ hasText: /\((primary|secondary|tertiary|residential|trunk|motorway)/ })
    .first();
  for (let i = 0; i < 90; i += 1) {
    if ((await candidate.count()) > 0 || (await save.isEnabled())) break;
    await page.waitForTimeout(1000);
  }
  if ((await candidate.count()) > 0) {
    await candidate.click();
    await page.waitForTimeout(2500);
  }
  for (let i = 0; i < 60 && !(await save.isEnabled()); i += 1) await page.waitForTimeout(1000);
  await save.click();
  await page.waitForTimeout(3000);
  const len = page.locator("#band-worklen");
  if (await len.count()) {
    await len.fill("1000");
    await len.blur();
  }
  await (await hook(page, "kind-chip-shoulder")).click();
  const side = page.locator('[data-testid="side-option"]').first();
  for (let i = 0; i < 60 && (await side.count()) === 0; i += 1) await page.waitForTimeout(1000);
  await side.click();
  await page.waitForTimeout(2500);
  await (await hook(page, "where-confirm")).click();
  await page.waitForTimeout(9000);
  return resp;
}

async function run(browser, width, height) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  await applyGate(ctx, SITE);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
  const resp = await toWhat(page);
  await (await hook(page, "generate-plan")).click();
  for (let i = 0; i < 150; i += 1) {
    await page.waitForTimeout(1000);
    if (
      (await page.locator(".working-band").count()) === 0 &&
      (await page.locator('[data-testid="fact-setup"]').count()) > 0
    )
      break;
  }
  await page.waitForTimeout(3000);
  await page.mouse.move(1, 1);

  // The pair.  The ink box of each value is its text's range rect, not
  // the span (a span in a flex column stretches no wider than its text,
  // but the range is the honest measure either way).
  const lanes = await page.evaluate(() => {
    const ink = (el) => {
      const r = document.createRange();
      r.selectNodeContents(el);
      const b = r.getBoundingClientRect();
      return { x: +b.x.toFixed(2), right: +b.right.toFixed(2), w: +b.width.toFixed(2) };
    };
    const box = (el) => {
      const b = el.getBoundingClientRect();
      return { x: +b.x.toFixed(2), w: +b.width.toFixed(2), h: +b.height.toFixed(2) };
    };
    const a = document.querySelector('[data-testid="setup-link-lanes"]');
    const b = document.querySelector('[data-testid="setup-link-laneWidth"]');
    const cell = a.parentElement;
    const av = a.querySelector(".a-setup-v");
    const bv = b.querySelector(".a-setup-v");
    const label = a.querySelector(".a-setup-k");
    const space = (() => {
      // One space in the value's own font: the "normal spacing" yardstick.
      const s = document.createElement("span");
      s.className = "a-setup-v";
      s.style.whiteSpace = "pre";
      s.textContent = " ";
      av.parentElement.appendChild(s);
      const w = s.getBoundingClientRect().width;
      s.remove();
      return +w.toFixed(2);
    })();
    return {
      text: `${av.textContent} | ${bv.textContent}`,
      cell: box(cell),
      lanesButton: box(a),
      widthButton: box(b),
      label: { text: label.textContent, ...ink(label) },
      lanesInk: ink(av),
      widthInk: ink(bv),
      gapPx: +(ink(bv).x - ink(av).right).toFixed(2),
      oneSpacePx: space,
    };
  });
  fs.writeFileSync(path.join(OUT, `lanes-${width}.json`), JSON.stringify(lanes, null, 2));

  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
  const floor = width <= 480 ? 44 : 32;
  const small = (await page.evaluate(TARGETS, "body")).filter((t) => Math.min(t.w, t.h) < floor);
  const pairs = (await page.evaluate(PAIRS, "body")).filter((p) => p.opacity >= 0.2);
  const aa = (p) => (p.size >= 24 || (p.size >= 18.66 && +p.weight >= 700) ? 3 : 4.5);
  const low = pairs.filter((p) => p.ratio < aa(p));
  const lowest = pairs.map((p) => p.ratio).sort((x, y) => x - y)[0];
  const axe = await runAxe(page, OUT, `${width}`);
  log(
    `${width}: status ${resp.status()} · scroll ${m.sw}/${m.iw} ${m.sw > m.iw ? "SIDEWAYS" : "ok"} · axe ${
      axe.length ? axe.map((v) => `${v.id}(${v.nodes.length})`).join(",") : "0"
    } · targets under ${floor}: ${small.length ? small.map((t) => `${t.name} ${t.w}x${t.h}`).join("; ") : "none"} · contrast lowest ${lowest}, below AA: ${
      low.length ? low.map((p) => `"${p.text}" ${p.ratio}`).join("; ") : "none"
    } · page errors ${errors.length ? errors.join(" | ") : "none"}`,
  );
  log(
    `${width} lanes: "${lanes.text}" · gap "2 ×"→"12 ft" ${lanes.gapPx} px (one space ${lanes.oneSpacePx} px) · buttons ${lanes.lanesButton.w}x${lanes.lanesButton.h} + ${lanes.widthButton.w}x${lanes.widthButton.h} in a ${lanes.cell.w} px cell · label "${lanes.label.text}" ink ${lanes.label.w} px`,
  );

  const slot = page.locator('[data-testid="fact-setup"]').first();
  await slot.scrollIntoViewIfNeeded();
  await page.mouse.move(1, 1);
  await page.waitForTimeout(300);
  await slot.screenshot({ path: path.join(OUT, `setup-${width}.png`) });
  const cell = page.locator('[data-testid="setup-link-lanes"]').locator("..");
  for (const k of ["lanes", "laneWidth"]) {
    await page.locator(`[data-testid="setup-link-${k}"]`).hover();
    await page.waitForTimeout(400);
    await cell.screenshot({ path: path.join(OUT, `lanes-${width}-hover-${k}.png`) });
  }
  await page.mouse.move(1, 1);
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  log(`R111 light check · ${SITE} · ${new Date().toISOString()}`);
  await run(browser, 1440, 1000);
  await run(browser, 390, 844);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
