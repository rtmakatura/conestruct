// R123 Q4 (light lane): issue-301-cross-street-entry on its preview
// (AUDIT_SITE).  N Broadway SB, near-intersection work with no crossing
// marked: the form's "Where is the intersection?" line with its new
// "Mark on map" button, then the picker opened from it, armed.  At 1440 and
// 390: status, sideways scroll, axe, target floors, contrast pairs, page
// errors (handoff.md § Light lane step 5), and crops of the changed region.
const REPO = "C:/Users/rtmak/Documents/traffic-control-tool";
const lib = require(`${REPO}/scripts/audit-lib.js`);
const { chromium, fs, path, PAIRS, TARGETS, runAxe } = lib;
const { hook } = require(`${REPO}/scripts/live-check.cjs`);
const { applyGate, gateHeaders } = require(`${REPO}/scripts/gate.cjs`);

const SITE = process.env.AUDIT_SITE;
const OUT = process.env.AUDIT_OUT;
if (!SITE || !OUT) throw new Error("AUDIT_SITE and AUDIT_OUT are required");
fs.mkdirSync(OUT, { recursive: true });
gateHeaders(SITE);
const log = (s) => {
  console.log(s);
  fs.appendFileSync(path.join(OUT, "log.txt"), s + "\n");
};

async function checks(page, width, tag, resp, errors) {
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
  const floor = width <= 480 ? 44 : 32;
  const small = (await page.evaluate(TARGETS, "body")).filter((t) => Math.min(t.w, t.h) < floor);
  const pairs = (await page.evaluate(PAIRS, "body")).filter((p) => p.opacity >= 0.2);
  const aa = (p) => (p.size >= 24 || (p.size >= 18.66 && +p.weight >= 700) ? 3 : 4.5);
  const low = pairs.filter((p) => p.ratio < aa(p));
  const lowest = pairs.map((p) => p.ratio).sort((x, y) => x - y)[0];
  const axe = await runAxe(page, OUT, `${width}-${tag}`);
  log(
    `${width} ${tag}: status ${resp.status()} · scroll ${m.sw}/${m.iw} ${m.sw > m.iw ? "SIDEWAYS" : "ok"} · axe ${
      axe.length ? axe.map((v) => `${v.id}(${v.nodes.length})`).join(",") : "0"
    } · targets under ${floor}: ${small.length ? small.map((t) => `${t.name} ${t.w}x${t.h}`).join("; ") : "none"} · contrast lowest ${lowest}, below AA: ${
      low.length ? low.map((p) => `"${p.text}" ${p.ratio}`).join("; ") : "none"
    } · page errors ${errors.length ? errors.join(" | ") : "none"}`,
  );
}

async function run(browser, width, height) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  await applyGate(ctx, SITE);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
  const resp = await page.goto(SITE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);
  await (await hook(page, "where-open-picker")).click();
  await page.waitForTimeout(3500);
  await page.getByRole("button", { name: /enter coordinates manually/i }).click();
  await page.waitForTimeout(1200);
  await page.getByPlaceholder(/^Latitude/).fill("39.73370");
  await page.getByPlaceholder(/^Longitude/).fill("-104.98753");
  const save = page.getByRole("button", { name: /Save & Close/ });
  const candidate = page.locator("button").filter({ hasText: /\((primary|secondary|tertiary|residential|trunk|motorway)/ }).first();
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
  await page.waitForTimeout(4000);
  await (await hook(page, "kind-chip-near_intersection")).click();
  await page.waitForTimeout(3000);
  // Reach the form's line: open WHAT by its band head (the fact line).
  let btn = page.locator('[data-testid="ni-mark-on-map"]');
  if ((await btn.count()) === 0) {
    const what = page.getByText(/What's the job\?/).first();
    if (await what.count()) {
      await what.click();
      await page.waitForTimeout(3000);
    }
  }
  btn = page.locator('[data-testid="ni-mark-on-map"]');
  const reached = (await btn.count()) > 0;
  log(`${width} reached the line: ${reached}`);
  if (!reached) {
    await page.screenshot({ path: path.join(OUT, `unreached-${width}.png`), fullPage: true });
    await ctx.close();
    return;
  }
  const field = page.locator('[data-testid="ni-placed-by-plan"]').locator("xpath=..");
  await field.scrollIntoViewIfNeeded();
  await page.mouse.move(1, 1);
  await page.waitForTimeout(400);
  await field.screenshot({ path: path.join(OUT, `line-${width}.png`) });
  const box = await btn.boundingBox();
  log(`${width} line: "${await page.locator('[data-testid="ni-placed-by-plan"]').textContent()}" · button ${Math.round(box.width)}x${Math.round(box.height)}`);
  await checks(page, width, "what", resp, errors);
  await btn.click();
  await page.waitForTimeout(4000);
  const armed = (await page.getByText(/Click the intersection on the map…/).count()) > 0;
  log(`${width} picker opened armed: ${armed}`);
  await page.screenshot({ path: path.join(OUT, `picker-armed-${width}.png`) });
  await ctx.close();
}

(async () => {
  fs.writeFileSync(path.join(OUT, "log.txt"), `R123 Q4 light check · ${SITE} · ${new Date().toISOString()}\n`);
  const browser = await chromium.launch();
  await run(browser, 1440, 1000);
  await run(browser, 390, 844);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
