// #290 checkpoint probe: what the shipped picker overlay draws at a one-way pin.
// Picker -> manual lat/lng -> detection auto-adopts the candidate bearing ->
// Save -> kind Shoulder -> reopen "Edit on map" -> the corridor overlay drawn
// -> screenshot + the dialog's text (legend, extent, direction field).
const path = require("path");
const fs = require("fs");
const { chromium } = require("C:/Users/rtmak/Documents/traffic-control-tool/node_modules/playwright");
const SITE = process.env.AUDIT_SITE || "https://www.conestruct.com/sandbox";
const OUT = process.env.AUDIT_OUT;
const PIN = { lat: process.env.PIN_LAT || "39.73370", lng: process.env.PIN_LNG || "-104.98753" };
const TAG = process.env.AUDIT_TAG || "broadway";
const dirField = (page) => page.evaluate(() => document.querySelector('input[aria-label="Direction of travel in degrees"]')?.value ?? null);
const buttons = (page) => page.$$eval("button", (bs) => bs.filter((b) => b.offsetParent).map((b) => b.textContent.trim().replace(/\s+/g, " ")).filter(Boolean));
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const log = [`site ${SITE}`, `pin ${PIN.lat},${PIN.lng}`, `ranAt ${new Date().toISOString()}`];
  await page.goto(SITE, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: /Pick on map/ }).first().click();
  await page.waitForTimeout(2500);
  await page.getByText(/Or enter coordinates manually/i).first().click();
  await page.getByLabel("Latitude", { exact: true }).fill(PIN.lat);
  await page.getByLabel("Longitude", { exact: true }).fill(PIN.lng);
  await page.keyboard.press("Tab");
  const tc = Date.now();
  while (Date.now() - tc < 60000) {
    const c = page.getByText(/SOUTHBOUND|NORTHBOUND|EASTBOUND|WESTBOUND/i).first();
    if (await c.count()) { await page.waitForTimeout(500); await c.click(); log.push("picked candidate: " + (await c.innerText())); break; }
    await page.waitForTimeout(500);
  }
  const t0 = Date.now();
  while (Date.now() - t0 < 60000) {
    const v = await dirField(page);
    const save = page.getByRole("button", { name: "Save & Close" });
    if (v && (await save.isEnabled())) break;
    await page.waitForTimeout(500);
  }
  log.push(`detected direction field after ${Date.now() - t0} ms: ${await dirField(page)}`);
  fs.writeFileSync(path.join(OUT, `overlay-${TAG}-1-detected.txt`), (await page.evaluate(() => document.querySelector('[role="dialog"]')?.innerText)) || "");
  await page.screenshot({ path: path.join(OUT, `overlay-${TAG}-1-detected.png`) });
  await page.getByRole("button", { name: "Save & Close" }).click();
  await page.waitForTimeout(1500);
  log.push("after save buttons: " + JSON.stringify(await buttons(page)));
  const shoulder = page.getByRole("button", { name: /shoulder/i }).first();
  if (await shoulder.count()) { await shoulder.click(); await page.waitForTimeout(800); }
  log.push("after kind buttons: " + JSON.stringify(await buttons(page)));
  const confirm = page.getByRole("button", { name: /^Confirm/ }).first();
  if (await confirm.count()) { await confirm.click(); await page.waitForTimeout(1500); }
  log.push("after confirm buttons: " + JSON.stringify(await buttons(page)));
  if (!(await page.getByRole("button", { name: /on map/i }).count())) {
    await page.getByRole("button", { name: "CHANGE", exact: true }).first().click();
    await page.waitForTimeout(1200);
    log.push("after CHANGE buttons: " + JSON.stringify(await buttons(page)));
  }
  const reopen = page.getByRole("button", { name: /on map/i }).first();
  log.push("reopen count " + (await reopen.count()));
  fs.writeFileSync(path.join(OUT, `overlay-${TAG}-log.txt`), log.join("\n"));
  await page.screenshot({ path: path.join(OUT, `overlay-${TAG}-1b-saved.png`), fullPage: true });
  await reopen.click({ timeout: 5000 });
  await page.waitForTimeout(10000);
  log.push("reopened direction field: " + (await dirField(page)));
  fs.writeFileSync(path.join(OUT, `overlay-${TAG}-2-corridor.txt`), (await page.evaluate(() => document.querySelector('[role="dialog"]')?.innerText)) || "");
  await page.screenshot({ path: path.join(OUT, `overlay-${TAG}-2-corridor.png`) });
  fs.writeFileSync(path.join(OUT, `overlay-${TAG}-log.txt`), log.join("\n"));
  console.log(log.join("\n"));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
