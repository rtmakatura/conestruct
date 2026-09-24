// #289 — the verdict strip's reserved height (--status-h), re-measured.
//
// --status-h is 70 px at <=480: "the strip's pill-state height at 380 —
// measured 69.19 (two text lines + the pill); pinned at the next whole
// pixel" (Issue 250, option f2) — measured on the strip BEFORE rule 165
// made it wrap.  This drives the real /sandbox along the audit rig's
// route and, every 100 ms, records the strip's NATURAL height — the
// reserve lifted (min-height 0 on the bar and the slot, restored at
// once) — per distinct strip text, at 380 and at 1440 for reference.
// Output: strip.json in AUDIT_OUT.

const path = require("path");
const fs = require("fs");
const { chromium } = require(
  "C:/Users/rtmak/Documents/traffic-control-tool/node_modules/playwright",
);

const SITE = process.env.AUDIT_SITE || "https://www.conestruct.com/sandbox";
const OUT = process.env.AUDIT_OUT || __dirname;
const PIN = { lat: "39.74020", lng: "-104.95600" };

async function sample(page, seen, stage) {
  const r = await page.evaluate(() => {
    const bar = document.querySelector(".status-slot .status-bar");
    const slot = document.querySelector(".status-slot");
    if (!bar || !slot) return null;
    const keep = [bar.style.minHeight, slot.style.minHeight];
    bar.style.minHeight = "0px";
    slot.style.minHeight = "0px";
    const natural = bar.getBoundingClientRect().height;
    bar.style.minHeight = keep[0];
    slot.style.minHeight = keep[1];
    return {
      text: bar.textContent.replace(/\s+/g, " ").trim(),
      cls: bar.className,
      natural: Math.round(natural * 100) / 100,
      rendered: Math.round(bar.getBoundingClientRect().height * 100) / 100,
      reserve: getComputedStyle(bar).minHeight,
    };
  });
  if (!r) return;
  const k = r.text;
  if (!seen.has(k) || seen.get(k).natural < r.natural) seen.set(k, { ...r, stage });
}

async function watch(page, seen, stage, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    await sample(page, seen, stage);
    await page.waitForTimeout(100);
  }
}

async function run(width, height) {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width, height } })).newPage();
  const seen = new Map();
  await page.goto(SITE, { waitUntil: "domcontentloaded" });
  await watch(page, seen, "S1", 4000);
  await page.getByRole("button", { name: /Pick on map|Pick Location on Map/ }).click();
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
  const len = page.locator("#band-worklen");
  await watch(page, seen, "S2", 3000);
  if (await len.count()) {
    await len.fill("1000");
    await len.blur();
  }
  await watch(page, seen, "S2", 1500);
  await page.locator('[data-testid="kind-chip-shoulder"]').click();
  await page.locator('[data-testid="where-confirm"]').click();
  await watch(page, seen, "S3", 20000);
  await page.getByRole("button", { name: /Generate plan/ }).click();
  await watch(page, seen, "S4-S5", 45000);
  await page.locator('[data-testid="setup-link-speed"]').click();
  await page.waitForSelector('[data-testid="revision-panel"]', { timeout: 15000 });
  await page.selectOption("#revise-speed", "35");
  await watch(page, seen, "S7", 6000);
  await browser.close();
  return [...seen.values()].sort((a, z) => z.natural - a.natural);
}

(async () => {
  const out = { site: SITE, ranAt: new Date().toISOString(), widths: {} };
  for (const [w, h] of [[380, 800], [1440, 1000]]) {
    out.widths[w] = await run(w, h);
    console.log(`@${w}`);
    for (const r of out.widths[w])
      console.log(`  ${r.natural}px natural · ${r.rendered} rendered · reserve ${r.reserve} · ${r.stage} · ${r.cls} · ${r.text.slice(0, 90)}`);
  }
  fs.writeFileSync(path.join(OUT, "strip.json"), JSON.stringify(out, null, 1));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
