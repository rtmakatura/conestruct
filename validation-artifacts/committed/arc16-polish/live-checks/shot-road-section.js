// Close-comment screenshot: the Flagger Road section at the Lakewood
// pin — the armed multilane confirm row sits between Road-type and
// Speed-limit, so the #200 junction (12px symmetric re-entry) is live
// in the shot.  Read-only; nothing saved.
const { chromium } = require("playwright");
const path = require("path");
const OUT = path.join(__dirname, "out16");
const SITE = "https://www.conestruct.com/sandbox";
const LAKEWOOD = { lat: "39.7113", lng: "-105.0815" };

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await (
    await browser.newContext({ viewport: { width: 1440, height: 2000 } })
  ).newPage();
  await page.goto(SITE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page.getByRole("button", { name: "Pick Location on Map" }).click();
  await page.getByRole("dialog", { name: "Define work zone" }).waitFor();
  const toggle = page.getByText(/enter coordinates manually/i);
  if (await toggle.isVisible().catch(() => false)) await toggle.click();
  await page.getByLabel("Latitude").fill(LAKEWOOD.lat);
  await page.getByLabel("Longitude").fill(LAKEWOOD.lng);
  await page.waitForTimeout(1500);
  for (let i = 0; i < 40; i++) {
    const t = ((await page.getByRole("dialog").textContent().catch(() => "")) ?? "").replace(/\s+/g, " ");
    if (!/Detecting roads at pin|Classifying road/i.test(t)) break;
    await page.waitForTimeout(1000);
  }
  const rows = page.locator("button", { hasText: "m from pin" });
  if ((await rows.count()) > 0) await rows.first().click();
  const save = page.getByRole("button", { name: "Save & Close" });
  for (let i = 0; i < 30 && !(await save.isEnabled().catch(() => false)); i++)
    await page.waitForTimeout(1000);
  await save.click();
  await page.waitForTimeout(1000);
  await page.getByText("Flagger lane closure", { exact: false }).first().click();
  await page.waitForTimeout(1500);
  const road = page
    .locator("div")
    .filter({ has: page.getByText("Road type", { exact: true }) })
    .filter({ has: page.getByLabel("Speed limit") })
    .last();
  const target = (await road.count()) ? road : page.locator("body");
  await target.screenshot({
    path: path.join(OUT, "05-flagger-road-section-junction.png"),
  });
  console.log("saved 05-flagger-road-section-junction.png");
  await browser.close();
})();
