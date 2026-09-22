// #289 Phase 2 — the S1–S3 ship, on a local build, at both widths.
//
// A PROBE, not the evidence leg.  Ryan's commit order puts evidence
// after S7; this exists because the ruling says "that ship changes the
// screen and I want to see it before revision is built on it", and a
// screenshot is the honest way to show a screen.
//
// Local `next dev`, NOT prod: the branch is not shipped, so a sha gate
// would assert something true of a machine this run never touched —
// leg 5's lesson from #288, applied.  The banner in the log says so.

const path = require("path");
const ROOT = "C:/Users/rtmak/Documents/traffic-control-tool";
const { chromium } = require(ROOT + "/node_modules/playwright");
const OUT = process.argv[2];
const BASE = "http://localhost:3999";

const PIN = { lat: 39.71466, lng: -104.94071 };

(async () => {
  const browser = await chromium.launch();
  const rows = [];
  const log = (s) => console.log(s);
  log(`LOCAL BUILD, NOT PROD — base ${BASE}; no sha gate, deliberately.`);
  try {
    for (const vp of [
      { name: "1440", width: 1440, height: 1000 },
      { name: "380", width: 380, height: 800 },
    ]) {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();
      const errs = [];
      page.on("pageerror", (e) => errs.push(String(e)));
      await page.goto(`${BASE}/sandbox`, { waitUntil: "networkidle" });
      await page.waitForSelector('[data-testid="band-stack"]', { timeout: 20000 });

      // S1 — no pin.
      await page.screenshot({ path: path.join(OUT, `s1-${vp.name}.png`), fullPage: true });
      const s1 = await page.evaluate(() => ({
        open: document.querySelector('[data-testid="band-stack"]').getAttribute("data-open-band"),
        step: document.querySelector(".tr-step")?.textContent,
        question: document.querySelector(".tr-question")?.textContent,
        questionPx: getComputedStyle(document.querySelector(".tr-question")).fontSize,
        facts: Array.from(document.querySelectorAll(".a-fact")).map((e) => ({
          id: e.dataset.testid,
          state: e.dataset.factState,
          h: Math.round(e.getBoundingClientRect().height * 100) / 100,
          text: e.textContent.trim().replace(/\s+/g, " "),
        })),
        chips: Array.from(document.querySelectorAll(".a-chip")).length,
        gateNote: document.querySelector('[data-testid="kind-gate-note"]')?.textContent?.trim().replace(/\s+/g, " "),
        ctaReason: document.querySelector('[data-testid="cta-reason"]')?.textContent?.trim(),
        zoneTags: Array.from(document.querySelectorAll(".zone-tag")).map((e) => e.textContent),
      }));
      log(`[${vp.name}] S1 ${JSON.stringify(s1)}`);
      rows.push({ vp: vp.name, state: "s1", ...s1 });

      // Type a pin through the manual fallback (no Mapbox token locally,
      // so the fallback is already open — the same path #260's suite uses).
      // The manual fallback is collapsed when a Mapbox token is present
      // (dev has one); open it the way an operator would.
      const toggle = await page.$('text=Enter manually');
      if (toggle) { await toggle.click(); await page.waitForTimeout(300); }
      const nums = await page.$$('input[type="number"][step="0.000001"]');
      log(`[${vp.name}] manual inputs found: ${nums.length}`);
      if (nums.length >= 2) {
        await nums[0].fill(String(PIN.lat));
        await nums[1].fill(String(PIN.lng));
        await page.waitForTimeout(1500);
      }
      await page.waitForTimeout(800);

      const s3 = await page.evaluate(() => ({
        open: document.querySelector('[data-testid="band-stack"]').getAttribute("data-open-band"),
        step: document.querySelector(".a-open .tr-step")?.textContent,
        question: document.querySelector(".tr-question")?.textContent,
        facts: Array.from(document.querySelectorAll(".a-fact")).map((e) => ({
          id: e.dataset.testid,
          state: e.dataset.factState,
          h: Math.round(e.getBoundingClientRect().height * 100) / 100,
          text: e.textContent.trim().replace(/\s+/g, " "),
        })),
        cells: Array.from(document.querySelectorAll(".a-cell")).map((e) => ({
          label: e.querySelector(".tr-field")?.textContent,
          prov: e.querySelector(".tr-prov")?.textContent?.trim().replace(/\s+/g, " "),
        })),
        fieldHeights: Array.from(document.querySelectorAll(".a-fld")).map(
          (e) => Math.round(e.getBoundingClientRect().height),
        ),
        // Rule 15's floors, the way LEG6 measured them.
        under32: Array.from(document.querySelectorAll("button, a, select, input")).filter((e) => {
          const b = e.getBoundingClientRect();
          return b.width > 0 && b.height > 0 && Math.min(b.width, b.height) < 32;
        }).length,
        under44: Array.from(document.querySelectorAll("button, a, select, input")).filter((e) => {
          const b = e.getBoundingClientRect();
          return b.width > 0 && b.height > 0 && Math.min(b.width, b.height) < 44;
        }).length,
      }));
      log(`[${vp.name}] S3 ${JSON.stringify(s3)}`);
      rows.push({ vp: vp.name, state: "s3", ...s3 });
      await page.screenshot({ path: path.join(OUT, `s3-${vp.name}.png`), fullPage: true });

      log(`[${vp.name}] pageerrors ${errs.length}${errs.length ? " — " + errs.join(" | ") : ""}`);
      rows.push({ vp: vp.name, pageerrors: errs.length, errs });
      await ctx.close();
    }
  } finally {
    await browser.close();
    require("fs").writeFileSync(path.join(OUT, "rows.json"), JSON.stringify(rows, null, 1));
  }
})();
