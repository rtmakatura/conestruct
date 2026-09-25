// #290 hand-check, item 1: after the side is chosen, does the picker draw?
// Picker -> manual lat/lng -> road candidate -> Save -> kind -> Confirm ->
// the WHERE band's side control -> reopen "Edit on map".  Every
// /api/render/corridor-geometry request and response is logged (what the
// modal sent, and what the backend answered), then the dialog's text and a
// screenshot of the reopened picker.
//
// env: AUDIT_OUT (dir), AUDIT_SITE (default prod /sandbox), PIN_LAT/PIN_LNG
// (default N Broadway southbound), AUDIT_TAG, AUDIT_KIND (chip text regex,
// default "shoulder"), AUDIT_SIDE (side-option text regex; default first
// built option).
const path = require("path");
const fs = require("fs");
const { chromium } = require("C:/Users/rtmak/Documents/traffic-control-tool/node_modules/playwright");
const SITE = process.env.AUDIT_SITE || "https://www.conestruct.com/sandbox";
const OUT = process.env.AUDIT_OUT;
const PIN = { lat: process.env.PIN_LAT || "39.73370", lng: process.env.PIN_LNG || "-104.98753" };
const TAG = process.env.AUDIT_TAG || "broadway";
const KIND = new RegExp(process.env.AUDIT_KIND || "shoulder", "i");
const SIDE = process.env.AUDIT_SIDE ? new RegExp(process.env.AUDIT_SIDE, "i") : null;
const buttons = (page) => page.$$eval("button", (bs) => bs.filter((b) => b.offsetParent).map((b) => b.textContent.trim().replace(/\s+/g, " ")).filter(Boolean));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const log = [`site ${SITE}`, `pin ${PIN.lat},${PIN.lng}`, `ranAt ${new Date().toISOString()}`];
  const geo = [];
  page.on("request", (r) => {
    if (!r.url().includes("/api/render/corridor-geometry")) return;
    let s = null;
    try { s = JSON.parse(r.postData() || "{}").scenario; } catch { /* */ }
    // The last sided request, verbatim — the reproduction input.
    if (s?.meta?.work) fs.writeFileSync(path.join(OUT, `${TAG}-sided-request.json`), r.postData() || "");
    geo.push({
      phase: log.at(-1),
      kind: s?.kind,
      pinModel: s?.meta?.pinModel,
      lat: s?.meta?.lat, lng: s?.meta?.lng,
      work: s?.meta?.work ?? null,
      road: s?.meta?.confirmedRoad ? {
        way: s.meta.confirmedRoad.candidate?.way_id,
        pinLat: s.meta.confirmedRoad.pinLat, pinLng: s.meta.confirmedRoad.pinLng,
        hasGeometry: Array.isArray(s.meta.confirmedRoad.candidate?.geometry),
      } : s?.meta?.confirmedRoad ?? "absent",
      workLen: s?.workLen,
    });
  });
  page.on("response", async (r) => {
    if (!r.url().includes("/api/render/corridor-geometry")) return;
    let body = null;
    try { body = await r.json(); } catch { body = await r.text().catch(() => null); }
    geo.push({
      status: r.status(),
      answer: body && typeof body === "object" ? {
        status: body.status, message: body.message, detail: body.detail,
        work: body.work ? { length_ft: body.work.length_ft, n: body.work.points?.length } : null,
        approaches: (body.approaches || []).map((a) => ({ id: a.id, travel: a.travel_bearing_deg, zones: a.zones.map((z) => `${z.zone}:${z.length_ft}`) })),
        side_options: (body.side_options || []).map((o) => `${o.label}${o.built ? "" : " (not built)"}`),
        travel: body.travel_bearing_deg,
      } : body,
    });
  });

  await page.goto(SITE, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(800);
  log.push("open picker");
  await page.getByRole("button", { name: /Pick on map/ }).first().click();
  await page.waitForTimeout(2500);
  await page.getByText(/Or enter coordinates manually/i).first().click();
  await page.getByLabel("Latitude", { exact: true }).fill(PIN.lat);
  await page.getByLabel("Longitude", { exact: true }).fill(PIN.lng);
  await page.keyboard.press("Tab");
  log.push("pin typed");
  const tc = Date.now();
  while (Date.now() - tc < 60000) {
    const c = page.getByText(/SOUTHBOUND|NORTHBOUND|EASTBOUND|WESTBOUND/i).first();
    const save = page.getByRole("button", { name: "Save & Close" });
    if (await c.count()) {
      await page.waitForTimeout(500);
      const txt = await c.innerText();
      await c.click().catch(() => {});
      log.push("picked candidate: " + txt);
      break;
    }
    if ((await save.count()) && (await save.isEnabled()) && Date.now() - tc > 15000) { log.push("no candidate label; save enabled"); break; }
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(4000);
  fs.writeFileSync(path.join(OUT, `${TAG}-1-picker-before-side.txt`), (await page.evaluate(() => document.querySelector('[role="dialog"]')?.innerText)) || "");
  await page.screenshot({ path: path.join(OUT, `${TAG}-1-picker-before-side.png`) });
  log.push("save");
  await page.getByRole("button", { name: "Save & Close" }).click();
  await page.waitForTimeout(1500);
  const kind = page.getByRole("button", { name: KIND }).first();
  if (await kind.count()) { await kind.click(); await page.waitForTimeout(800); }
  const confirm = page.getByRole("button", { name: /^Confirm/ }).first();
  if (await confirm.count()) { await confirm.click(); await page.waitForTimeout(1500); }
  log.push("after confirm buttons: " + JSON.stringify(await buttons(page)));
  if (!(await page.locator('[data-testid="side-option"]').count())) {
    const where = page.locator('[data-testid="fact-link-where"]').first();
    if (await where.count()) { await where.click(); await page.waitForTimeout(1200); }
  }
  const t1 = Date.now();
  while (Date.now() - t1 < 20000 && !(await page.locator('[data-testid="side-option"]').count())) await page.waitForTimeout(400);
  const opts = await page.$$eval('[data-testid="side-option"]', (bs) => bs.map((b) => `${b.textContent.trim()} [disabled=${b.getAttribute("aria-disabled")}]`));
  log.push("side options: " + JSON.stringify(opts));
  const option = SIDE
    ? page.locator('[data-testid="side-option"]', { hasText: SIDE }).first()
    : page.locator('[data-testid="side-option"]:not([aria-disabled="true"])').first();
  log.push("choose side");
  await option.click();
  await page.waitForTimeout(2500);
  fs.writeFileSync(path.join(OUT, `${TAG}-2-band-after-side.txt`), (await page.evaluate(() => document.body.innerText)) || "");
  await page.screenshot({ path: path.join(OUT, `${TAG}-2-band-after-side.png`), fullPage: true });
  log.push("reopen picker");
  await page.getByRole("button", { name: /on map/i }).first().click({ timeout: 5000 });
  await page.waitForTimeout(12000);
  fs.writeFileSync(path.join(OUT, `${TAG}-3-picker-after-side.txt`), (await page.evaluate(() => document.querySelector('[role="dialog"]')?.innerText)) || "");
  await page.screenshot({ path: path.join(OUT, `${TAG}-3-picker-after-side.png`) });
  log.push("done");
  fs.writeFileSync(path.join(OUT, `${TAG}-log.txt`), log.join("\n") + "\n\nGEOMETRY\n" + geo.map((g) => JSON.stringify(g)).join("\n"));
  console.log(log.join("\n"));
  console.log("GEOMETRY");
  for (const g of geo) console.log(JSON.stringify(g));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
