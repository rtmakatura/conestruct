/** s2-arc12 prod L2 re-run (Refs #213) — lake pin only, per Ryan's
 *  2026-09-01 disposition: re-run L2; if the transient recurs, wait
 *  60 s and retry once more; report both attempts.  READ-ONLY. */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "outS2A12LC-prod");
const BASE = "https://www.conestruct.com/sandbox";
const LAKE = { lat: "39.74810", lng: "-104.95610" };

const lines = [];
let failures = 0;
function log(msg) {
  const stamp = new Date().toISOString();
  lines.push(`- \`${stamp}\` ${msg}`);
  console.log(`${stamp} ${msg}`);
}
function assert(name, cond, extra = "") {
  if (!cond) failures++;
  log(`${cond ? "**PASS**" : "**FAIL**"} — ${name}${extra ? ` (${extra})` : ""}`);
}

async function openPickerWithCoords(page, pin) {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Pick Location on Map/i }).click();
  const toggle = page.getByRole("button", {
    name: /Or enter coordinates manually/i,
  });
  await page.getByLabel("Latitude", { exact: true }).or(toggle).first().waitFor();
  if (await toggle.count()) await toggle.click();
  await page.getByLabel("Latitude", { exact: true }).fill(pin.lat);
  await page.getByLabel("Longitude", { exact: true }).fill(pin.lng);
}

async function waitDetection(page) {
  await page.waitForFunction(
    () => {
      const t = document.body.textContent ?? "";
      return (
        /m from pin/.test(t) ||
        /No road detected within 30 m/.test(t) ||
        /Road detection is unavailable right now/.test(t)
      );
    },
    null,
    { timeout: 60000 },
  );
  return page.evaluate(() => document.body.textContent ?? "");
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  let settled = false;
  for (let attempt = 1; attempt <= 2 && !settled; attempt++) {
    log(`— L2 re-run, attempt ${attempt}: lake pin, real Overpass —`);
    await openPickerWithCoords(page, LAKE);
    const t = await waitDetection(page);
    const unavailable = /Road detection is unavailable right now/.test(t);
    if (unavailable && attempt === 1) {
      log(
        "attempt 1 hit the transient again (unavailable rendered honestly) — waiting 60 s per disposition",
      );
      await page.screenshot({
        path: path.join(OUT, "l2-rerun-attempt1-unavailable.png"),
        fullPage: true,
      });
      log("screenshot: l2-rerun-attempt1-unavailable.png");
      await new Promise((r) => setTimeout(r, 60000));
      continue;
    }
    settled = true;
    assert(
      `L2 (attempt ${attempt}) absence copy renders (a measurement)`,
      /No road detected within 30 m/.test(t),
    );
    assert(
      `L2 (attempt ${attempt}) never the unavailable copy`,
      !unavailable,
    );
    const shotName = `l2-rerun-attempt${attempt}-absence.png`;
    await page.screenshot({ path: path.join(OUT, shotName), fullPage: true });
    log(`screenshot: ${shotName}`);
  }

  log(failures === 0 ? "L2 RE-RUN PASS" : `${failures} FAILURE(S)`);
  fs.appendFileSync(
    path.join(OUT, "s2a12-live-checks.md"),
    `\n## L2 re-run (Ryan's disposition, 2026-09-01)\n\n${lines.join("\n")}\n`,
  );
  await browser.close();
  process.exit(failures === 0 ? 0 : 1);
})();
