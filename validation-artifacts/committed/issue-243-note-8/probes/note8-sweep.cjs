// #243 investigate: what prod shows today for CDOT S-630-1 Sheet 2 Note 8
// ("Signs on both sides of divided highway"), and the exact scenario the
// site sends, so the per-side sign lists can be replayed read-only
// (note8_probe.py).
//
// One run = one pin driven through /sandbox: the picker (manual lat/lng)
// -> the first road candidate -> Save -> kind -> Confirm -> the first
// built side -> Generate plan.  Saved to <out>/<tag>-*:
//   audit-request.json   the /api/render/audit POST body, verbatim
//   audit-response.json  what the backend answered
//   page.txt             the page's text after the plan settles
//   page.png             a full-page screenshot
//   log.txt              the steps, and every /api/render/* call
//
//   node note8-sweep.cjs
// env: AUDIT_OUT (dir), AUDIT_SITE (default prod /sandbox), PIN_LAT,
// PIN_LNG, AUDIT_TAG, AUDIT_KIND (kind chip regex, default "shoulder"),
// AUDIT_ROAD (candidate text regex; default the first candidate).
const path = require("path");
const fs = require("fs");
const { chromium } = require("C:/Users/rtmak/Documents/traffic-control-tool/node_modules/playwright");

const SITE = process.env.AUDIT_SITE || "https://www.conestruct.com/sandbox";
const OUT = process.env.AUDIT_OUT;
const PIN = { lat: process.env.PIN_LAT, lng: process.env.PIN_LNG };
const TAG = process.env.AUDIT_TAG;
const KIND = new RegExp(process.env.AUDIT_KIND || "shoulder", "i");
const ROAD = new RegExp(process.env.AUDIT_ROAD || "SOUTHBOUND|NORTHBOUND|EASTBOUND|WESTBOUND", "i");

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const log = [`site ${SITE}`, `pin ${PIN.lat},${PIN.lng}`, `ranAt ${new Date().toISOString()}`];
  let auditDone = false;
  page.on("request", (r) => {
    if (!r.url().includes("/api/render/")) return;
    log.push(`REQ ${r.method()} ${new URL(r.url()).pathname}`);
    if (r.url().includes("/api/render/audit") && !r.url().includes("audit-pdf")) {
      fs.writeFileSync(path.join(OUT, `${TAG}-audit-request.json`), r.postData() || "");
    }
  });
  page.on("response", async (r) => {
    if (!r.url().includes("/api/render/")) return;
    log.push(`RES ${r.status()} ${new URL(r.url()).pathname}`);
    if (r.url().includes("/api/render/audit") && !r.url().includes("audit-pdf")) {
      const body = await r.text().catch(() => "");
      fs.writeFileSync(path.join(OUT, `${TAG}-audit-response.json`), body);
      auditDone = true;
    }
  });

  await page.goto(SITE, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(1000);
  await page.getByTestId("where-open-picker").first().click();
  await page.waitForTimeout(2500);
  await page.getByText(/Or enter coordinates manually/i).first().click();
  await page.getByLabel("Latitude", { exact: true }).fill(PIN.lat);
  await page.getByLabel("Longitude", { exact: true }).fill(PIN.lng);
  await page.keyboard.press("Tab");
  const t0 = Date.now();
  while (Date.now() - t0 < 60000) {
    const c = page.getByText(ROAD).first();
    if (await c.count()) {
      await page.waitForTimeout(500);
      log.push("picked candidate: " + (await c.innerText()));
      await c.click().catch(() => {});
      break;
    }
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(4000);
  await page.getByRole("button", { name: "Save & Close" }).click();
  await page.waitForTimeout(2000);
  const openWhere = async () => {
    if (await page.locator('[data-testid="side-option"]').count()) return;
    const w = page.getByTestId("fact-link-where").first();
    if (await w.count()) { await w.click(); await page.waitForTimeout(1200); }
  };
  await openWhere();
  await page.getByRole("button", { name: KIND }).first().click();
  await page.waitForTimeout(500);
  await page.getByTestId("where-confirm").click();
  await page.waitForTimeout(1500);
  await openWhere();
  const t1 = Date.now();
  while (Date.now() - t1 < 20000 && !(await page.locator('[data-testid="side-option"]').count())) await page.waitForTimeout(400);
  const opts = await page.$$eval('[data-testid="side-option"]', (bs) => bs.map((b) => `${b.textContent.trim()} [disabled=${b.getAttribute("aria-disabled")}]`));
  log.push("side options: " + JSON.stringify(opts));
  const side = page.locator('[data-testid="side-option"]:not([aria-disabled="true"])').first();
  log.push("chose side: " + (await side.innerText()));
  await side.click();
  await page.waitForTimeout(2000);
  log.push("generate");
  const gen = page.getByRole("button", { name: "Generate plan" }).first();
  if (await gen.isDisabled()) {
    // Declined before any plan: record why (the notice) and stop.
    log.push(`generate disabled: ${await gen.getAttribute("title")}`);
    fs.writeFileSync(path.join(OUT, `${TAG}-page.txt`), (await page.evaluate(() => document.body.innerText)) || "");
    await page.screenshot({ path: path.join(OUT, `${TAG}-page.png`), fullPage: true });
    fs.writeFileSync(path.join(OUT, `${TAG}-log.txt`), log.join("\n") + "\n");
    console.log(log.join("\n"));
    await browser.close();
    return;
  }
  await gen.click();
  const t2 = Date.now();
  while (Date.now() - t2 < 180000 && !auditDone) await page.waitForTimeout(500);
  await page.waitForTimeout(6000);
  fs.writeFileSync(path.join(OUT, `${TAG}-page.txt`), (await page.evaluate(() => document.body.innerText)) || "");
  await page.screenshot({ path: path.join(OUT, `${TAG}-page.png`), fullPage: true });
  log.push(`audit answered: ${auditDone}`);
  fs.writeFileSync(path.join(OUT, `${TAG}-log.txt`), log.join("\n") + "\n");
  console.log(log.join("\n"));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
