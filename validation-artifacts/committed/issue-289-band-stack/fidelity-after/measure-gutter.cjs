// #289 fidelity follow-up — the audit-row annotation gutter, re-measured.
//
// The 197 px pin (check-list-grid.test.ts) was the natural width of the
// strip dropdown's "OSM GROUND-TRUTH (SOFT CHECK)", measured in s2-arc26.
// F5 removed that dropdown, so the pin's sizing case is gone.  This
// drives the REAL /sandbox to S5 (the probe's own route), opens every
// disclosure until nothing new opens, and for every rendered
// `.check-list-src` records its natural single-line width: a clone in the
// element's own computed font, white-space nowrap, off-screen.
// Output: gutter.json in AUDIT_OUT.

const path = require("path");
const fs = require("fs");
const { chromium } = require(
  "C:/Users/rtmak/Documents/traffic-control-tool/node_modules/playwright",
);
// #237: every band selection goes through the helper — zero matches throw.
const { hook, nonEmpty } = require("../live-check.cjs");

const SITE = process.env.AUDIT_SITE || "https://www.conestruct.com/sandbox";
const OUT = process.env.AUDIT_OUT || __dirname;
const PIN = { lat: "39.74020", lng: "-104.95600" };

async function toS5(page) {
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
  await page.waitForTimeout(1500);
  await (await hook(page, "kind-chip-shoulder")).click();
  await (await hook(page, "where-confirm")).click();
  await page.waitForTimeout(3000);
  await (await hook(page, "generate-plan")).click();
  await page.waitForSelector('[data-testid="fact-setup"]', { timeout: 120000 });
  // The working band's absence is the settle.
  for (let i = 0; i < 150; i += 1) {
    if ((await page.locator(".working-band").count()) === 0) break;
    await page.waitForTimeout(1000);
  }
  await page.waitForTimeout(2000);
}

async function openEverything(page) {
  for (let pass = 0; pass < 5; pass += 1) {
    const n = await page.evaluate(() => {
      let opened = 0;
      for (const b of document.querySelectorAll('button[aria-expanded="false"]')) {
        b.click();
        opened += 1;
      }
      for (const h of document.querySelectorAll(".audit-item:not(.open) .audit-head")) {
        h.click();
        opened += 1;
      }
      for (const d of document.querySelectorAll("details:not([open])")) {
        d.open = true;
        opened += 1;
      }
      return opened;
    });
    await page.waitForTimeout(800);
    if (n === 0) break;
  }
}

async function run(width, height) {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width, height } })).newPage();
  await toS5(page);
  await openEverything(page);
  const rows = await page.evaluate(() =>
    [...document.querySelectorAll(".check-list-src")].map((el) => {
      const cs = getComputedStyle(el);
      const probe = document.createElement("span");
      for (const p of ["font-family", "font-size", "font-weight", "letter-spacing", "text-transform"])
        probe.style.setProperty(p, cs.getPropertyValue(p));
      probe.style.cssText += ";position:absolute;left:-9999px;top:0;white-space:nowrap;";
      probe.textContent = el.textContent;
      document.body.appendChild(probe);
      const natural = probe.getBoundingClientRect().width;
      probe.remove();
      return {
        text: el.textContent,
        natural: Math.round(natural * 100) / 100,
        rendered: Math.round(el.getBoundingClientRect().width * 100) / 100,
        font: `${cs.fontFamily.split(",")[0]} ${cs.fontSize} ${cs.letterSpacing}`,
      };
    }),
  );
  await browser.close();
  return nonEmpty(rows, "audit-row annotations (.check-list-src)");
}

(async () => {
  const out = { site: SITE, ranAt: new Date().toISOString(), widths: {} };
  out.widths["1440"] = await run(1440, 1000);
  const rows = out.widths["1440"];
  const max = rows.reduce((m, r) => (r.natural > m.natural ? r : m), { natural: 0 });
  out.longest = max;
  fs.writeFileSync(path.join(OUT, "gutter.json"), JSON.stringify(out, null, 1));
  console.log(`${rows.length} annotations; longest "${max.text}" natural ${max.natural}px (${max.font})`);
  for (const r of [...rows].sort((a, z) => z.natural - a.natural).slice(0, 8))
    console.log(`  ${r.natural}px  rendered ${r.rendered}  ${r.text}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
