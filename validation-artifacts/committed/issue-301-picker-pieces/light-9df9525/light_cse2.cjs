// R123 Q4 (light lane), the reachable path: issue-301-cross-street-entry on
// its preview.  The near-intersection plan of r116's capture (N Broadway SB,
// the cross street marked at E 12th Ave, a side, Confirm, Generate), then the
// crossing cleared in the picker and saved — the state where the form reads
// "not marked. Mark the cross street on the map".  The new "Mark on map"
// opens the picker armed.  At 1440 and 390, with the light checks.
const REPO = "C:/Users/rtmak/Documents/traffic-control-tool";
const lib = require(`${REPO}/scripts/audit-lib.js`);
const { chromium, fs, path, PAIRS, TARGETS, runAxe } = lib;
const { applyGate, gateHeaders } = require(`${REPO}/scripts/gate.cjs`);
const { hook } = require(`${REPO}/scripts/live-check.cjs`);
const { toPlan } = require(`${REPO}/validation-artifacts/committed/r116-ni-polish/capture_r116.cjs`);

const SITE = process.env.AUDIT_SITE;
const OUT = process.env.LIGHT_OUT;
fs.mkdirSync(OUT, { recursive: true });
gateHeaders(SITE);
const log = (s) => {
  console.log(s);
  fs.appendFileSync(path.join(OUT, "log.txt"), s + "\n");
};

async function checks(page, width, tag, errors) {
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
  const floor = width <= 480 ? 44 : 32;
  const small = (await page.evaluate(TARGETS, "body")).filter((t) => Math.min(t.w, t.h) < floor);
  const pairs = (await page.evaluate(PAIRS, "body")).filter((p) => p.opacity >= 0.2);
  const aa = (p) => (p.size >= 24 || (p.size >= 18.66 && +p.weight >= 700) ? 3 : 4.5);
  const low = pairs.filter((p) => p.ratio < aa(p));
  const axe = await runAxe(page, OUT, `${width}-${tag}`);
  log(
    `${width} ${tag}: scroll ${m.sw}/${m.iw} ${m.sw > m.iw ? "SIDEWAYS" : "ok"} · axe ${
      axe.length ? axe.map((v) => `${v.id}(${v.nodes.length})`).join(",") : "0"
    } · targets under ${floor}: ${small.length ? small.map((t) => `${t.name} ${t.w}x${t.h}`).join("; ") : "none"} · below AA: ${
      low.length ? low.map((p) => `"${p.text}" ${p.ratio}`).join("; ") : "none"
    } · page errors ${errors.length ? errors.join(" | ") : "none"}`,
  );
}

async function run(browser, w, h) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await applyGate(ctx, SITE);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
  await toPlan(page);
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(1500);
  // Clear the crossing in the picker and save.
  // After Generate the WHERE band is closed: the Setup box's extent link
  // reopens it (r116 build-2's route).
  if ((await page.locator('[data-testid="where-open-picker"]').count()) === 0) {
    await (await hook(page, "setup-link-extent")).click();
    await page.waitForTimeout(4000);
  }
  await (await hook(page, "where-open-picker")).click();
  await page.waitForTimeout(5000);
  await page.getByRole("button", { name: "Clear" }).click();
  await page.waitForTimeout(1500);
  const save = page.getByRole("button", { name: /Save & Close/ });
  for (let i = 0; i < 60 && !(await save.isEnabled()); i += 1) await page.waitForTimeout(1000);
  await save.click();
  await page.waitForTimeout(5000);
  let btn = page.locator('[data-testid="ni-mark-on-map"]');
  if ((await btn.count()) === 0) {
    // WHERE reopened in edit mode holds the column: confirm it first.
    if ((await page.locator('[data-testid="where-confirm"]').count()) > 0) {
      await page.locator('[data-testid="where-confirm"]').click();
      await page.waitForTimeout(4000);
    }
    // The closed WHAT band's fact line: its CHANGE link reopens it.
    const row = page.locator("div", { hasText: "What's the job?" }).last();
    const change = row.getByText("CHANGE", { exact: true });
    if (await change.count()) {
      await change.first().click();
      await page.waitForTimeout(3000);
    }
  }
  btn = page.locator('[data-testid="ni-mark-on-map"]');
  const reached = (await btn.count()) > 0;
  log(`${w} reached the line after clearing the crossing: ${reached}`);
  if (!reached) {
    await page.screenshot({ path: path.join(OUT, `unreached-${w}.png`), fullPage: true });
    await ctx.close();
    return;
  }
  const field = page.locator('[data-testid="ni-placed-by-plan"]').locator("xpath=..");
  await field.scrollIntoViewIfNeeded();
  await page.mouse.move(1, 1);
  await page.waitForTimeout(400);
  await field.screenshot({ path: path.join(OUT, `line-${w}.png`) });
  const box = await btn.boundingBox();
  log(`${w} line: "${await page.locator('[data-testid="ni-placed-by-plan"]').textContent()}" · button ${Math.round(box.width)}x${Math.round(box.height)}`);
  await checks(page, w, "what", errors);
  await btn.click();
  await page.waitForTimeout(5000);
  const armed = (await page.getByText(/Click the intersection on the map…/).count()) > 0;
  log(`${w} picker opened armed: ${armed}`);
  await page.screenshot({ path: path.join(OUT, `picker-armed-${w}.png`) });
  await ctx.close();
}

(async () => {
  fs.writeFileSync(path.join(OUT, "log.txt"), `R123 Q4 light check (cleared crossing) · ${SITE} · ${new Date().toISOString()}\n`);
  const browser = await chromium.launch();
  await run(browser, 1440, 1000);
  await run(browser, 390, 844);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
