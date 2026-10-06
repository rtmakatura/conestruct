// R96 -- today's three surfaces on prod /sandbox, at 1440 and 390.
// Follows scripts/probe.cjs's route (manual coordinates -> first candidate
// -> Save & Close -> Shoulder -> Confirm -> Generate), sends the gate's
// bypass header (scripts/gate.cjs), and screenshots:
//   what-<w>.png       the WHAT band, open, after Confirming the Denver
//                      suggestion (the "Confirmed Denver (was Not set). Undo" bar)
//   setup-<w>.png      the post-Generate results head (the Setup line)
//   needsyou-<w>.png   the NEEDS YOU block
//   page-<w>-S3/S5.png full pages, for context
// Usage: AUDIT_OUT=<dir> node capture_today.cjs
const path = require("path");
const fs = require("fs");
const REPO = "C:/Users/rtmak/Documents/traffic-control-tool";
const { chromium } = require(`${REPO}/node_modules/playwright`);
const { hook } = require(`${REPO}/scripts/live-check.cjs`);
const { applyGate, gateHeaders } = require(`${REPO}/scripts/gate.cjs`);

if (!process.env.GATE_BYPASS_TOKEN) {
  const env = fs.readFileSync(`${REPO}/conestruct/site/.env.local`, "utf-8");
  const m = env.match(/^GATE_BYPASS_TOKEN=\s*"?([^"\r\n]+)"?/m);
  if (m) process.env.GATE_BYPASS_TOKEN = m[1].trim();
}
const SITE = process.env.AUDIT_SITE || "https://www.conestruct.com/sandbox";
const OUT = process.env.AUDIT_OUT;
if (!OUT) throw new Error("AUDIT_OUT is required");
fs.mkdirSync(OUT, { recursive: true });
gateHeaders(SITE);
const PIN = { lat: "39.74020", lng: "-104.95600" }; // E Colfax, the arc's standing spot

async function shot(page, sel, file) {
  const el = page.locator(sel).first();
  if ((await el.count()) === 0) {
    console.log(`MISSING ${sel}`);
    return;
  }
  await el.scrollIntoViewIfNeeded();
  await el.screenshot({ path: path.join(OUT, file) });
  console.log(`wrote ${file}`);
}

async function run(width, height) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width, height } });
  await applyGate(ctx, SITE);
  const page = await ctx.newPage();
  await page.goto(SITE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
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
  await page.waitForTimeout(8000);
  // Confirm the Denver suggestion(s) so the confirmation bars render.
  const what = page.locator('[data-testid="band-what"]');
  if ((await what.innerText()).includes("nothing detected")) {
    await browser.close();
    return false;
  }
  await shot(page, '[data-testid="band-what"]', `what-${width}-suggested.png`);
  for (let i = 0; i < 2; i += 1) {
    const btn = what.getByRole("button", { name: /^Confirm /i }).first();
    if ((await btn.count()) === 0) break;
    await btn.click();
    await page.waitForTimeout(1500);
  }
  await page.screenshot({ path: path.join(OUT, `page-${width}-S3.png`), fullPage: true });
  await shot(page, '[data-testid="band-what"]', `what-${width}.png`);

  await (await hook(page, "generate-plan")).click();
  for (let i = 0; i < 150; i += 1) {
    await page.waitForTimeout(1000);
    if ((await page.locator(".working-band").count()) === 0 && (await page.locator('[data-testid="fact-setup"]').count()) > 0) break;
  }
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(OUT, `page-${width}-S5.png`), fullPage: true });
  await shot(page, ".results-head-slot", `setup-${width}.png`);
  await shot(page, "section.needs-you", `needsyou-${width}.png`);
  await browser.close();
  return true;
}

async function runUntilDetected(width, height) {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    if (await run(width, height)) return console.log(`${width}: detected on attempt ${attempt}`);
    console.log(`${width}: road not detected on attempt ${attempt}; retrying`);
  }
  throw new Error(`${width}: road never detected`);
}

(async () => {
  await runUntilDetected(1440, 1000);
  await runUntilDetected(390, 844);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
