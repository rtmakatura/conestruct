// R123 branch 2 (issue-301-road-properties), on a local stack of the branch
// (AUDIT_SITE: next dev of the worktree, its backend on :8301).  The pin is
// North Cherry Street in Hilltop, Denver (39.71740, -104.93380): a
// residential way with no maxspeed tag, so its class estimates 25 mph.
// At 1440 and 390, into AUDIT_OUT:
//   modal-<w>.png       the picker with the road picked: no road-properties
//                       panel, the Which road? card, Re-detect
//   speed-<w>.png       WHAT's Speed row: the ⚠ estimate and Use 25 mph
//   speed-used-<w>.png  the row after the click
//   facts-<w>.json      the modal's text, the row's lines before and after,
//                       the scenario speed the band shows, scroll width,
//                       page errors, axe ids
// Usage: GATE_BYPASS_TOKEN=... AUDIT_SITE=http://localhost:3301/sandbox
//        AUDIT_OUT=<dir> node capture_rp.cjs
const REPO = "C:/Users/rtmak/Documents/traffic-control-tool";
const lib = require(`${REPO}/scripts/audit-lib.js`);
const { chromium, fs, path, runAxe } = lib;
const { hook } = require(`${REPO}/scripts/live-check.cjs`);
const { applyGate, gateHeaders } = require(`${REPO}/scripts/gate.cjs`);

const SITE = process.env.AUDIT_SITE || "http://localhost:3301/sandbox";
const OUT = process.env.AUDIT_OUT;
if (!OUT) throw new Error("AUDIT_OUT is required");
fs.mkdirSync(OUT, { recursive: true });
gateHeaders(SITE);
const PIN = { lat: "39.71740", lng: "-104.93380" };

async function run(browser, width, height) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  await applyGate(ctx, SITE);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
  await page.goto(SITE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(8000);
  await (await hook(page, "where-open-picker")).click();
  await page.waitForTimeout(3500);
  await page.getByRole("button", { name: /enter coordinates manually/i }).click();
  await page.waitForTimeout(1200);
  await page.getByPlaceholder(/^Latitude/).fill(PIN.lat);
  await page.getByPlaceholder(/^Longitude/).fill(PIN.lng);
  const save = page.getByRole("button", { name: /Save & Close/ });
  const card = page.getByText(/Road detected · 1 match|Which road\?/).first();
  for (let i = 0; i < 90 && (await card.count()) === 0; i += 1) await page.waitForTimeout(1000);
  const pick = page.locator("button").filter({ hasText: /\((primary|secondary|tertiary|residential|trunk|motorway)/ }).first();
  if ((await page.getByText(/Which road\?/).count()) > 0 && (await pick.count()) > 0) {
    await pick.click();
  }
  await page.waitForTimeout(3000);
  await page.mouse.move(1, 1);
  await page.screenshot({ path: path.join(OUT, `modal-${width}.png`) });
  const modalText = await page.evaluate(() => (document.querySelector('[role="dialog"]') || document.body).innerText);
  for (let i = 0; i < 60 && !(await save.isEnabled()); i += 1) await page.waitForTimeout(1000);
  await save.click();
  await page.waitForTimeout(4000);
  await (await hook(page, "kind-chip-shoulder")).click();
  const side = page.locator('[data-testid="side-option"]').first();
  for (let i = 0; i < 60 && (await side.count()) === 0; i += 1) await page.waitForTimeout(1000);
  await side.click();
  await page.waitForTimeout(2500);
  await (await hook(page, "where-confirm")).click();
  await page.waitForTimeout(8000);
  const cell = page.locator('[data-testid="speed-estimate"]');
  for (let i = 0; i < 20 && (await cell.count()) === 0; i += 1) await page.waitForTimeout(1000);
  const row = page.locator("#what-speed").locator("xpath=ancestor::div[contains(@class,'a-cell')][1]");
  await row.scrollIntoViewIfNeeded();
  await page.mouse.move(1, 1);
  await page.waitForTimeout(500);
  const shotRow = async (file) => {
    const b = await row.boundingBox();
    const sy = await page.evaluate(() => scrollY);
    await page.screenshot({
      path: path.join(OUT, file),
      clip: { x: Math.max(0, b.x - 12), y: b.y + sy - 12, width: Math.min(b.width + 24, width), height: b.height + 24 },
      fullPage: true,
    });
  };
  await shotRow(`speed-${width}.png`);
  const before = await page.evaluate(() => ({
    estimate: document.querySelector('[data-testid="speed-estimate"]')?.textContent ?? null,
    prov: document.querySelector('[data-testid="prov-speed"]')?.textContent ?? null,
    speed: document.querySelector("#what-speed")?.value ?? null,
  }));
  const axe = await runAxe(page, OUT, `${width}-what`);
  const use = page.locator('[data-testid="speed-estimate-use"]');
  let after = null;
  if (await use.count()) {
    const btn = await use.boundingBox();
    await use.click();
    await page.waitForTimeout(1500);
    await page.mouse.move(1, 1);
    await shotRow(`speed-used-${width}.png`);
    after = await page.evaluate(() => ({
      estimate: document.querySelector('[data-testid="speed-estimate"]')?.textContent ?? null,
      prov: document.querySelector('[data-testid="prov-speed"]')?.textContent ?? null,
      speed: document.querySelector("#what-speed")?.value ?? null,
    }));
    after.buttonBox = btn && [Math.round(btn.width), Math.round(btn.height)];
  }
  const scroll = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  const facts = {
    site: SITE,
    width,
    modalText,
    before,
    after,
    scroll,
    axe: axe.map((v) => `${v.id}(${v.nodes.length})`),
    errors,
  };
  fs.writeFileSync(path.join(OUT, `facts-${width}.json`), JSON.stringify(facts, null, 2));
  console.log(width, JSON.stringify({ before, after, scroll, axe: facts.axe, errors }));
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  await run(browser, 1440, 1000);
  await run(browser, 390, 844);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
