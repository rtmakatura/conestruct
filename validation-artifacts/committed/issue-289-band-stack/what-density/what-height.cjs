// #289 WHAT density (Ryan: "WAY too busy", P19) — the WHAT band's height
// at 1440, before and after.
//
// The same S1 → S3 route as fidelity-audit/probe.cjs (E Colfax, the arc's
// standing spot, manual coordinates, the first detected candidate,
// shoulder work, Confirm), then the open WHAT band measured off the live
// page once the checks settle: the band, each grid, each cell.  One
// method for both runs, so before and after compare like with like.
//
//   AUDIT_SITE  the /sandbox URL (default prod)
//   AUDIT_OUT   where the JSON and the screenshot go
//   AUDIT_TAG   a name for this run (before / after)

const path = require("path");
const fs = require("fs");
const { chromium } = require(
  "C:/Users/rtmak/Documents/traffic-control-tool/node_modules/playwright",
);
const { hook } = require("../live-check.cjs");

const SITE = process.env.AUDIT_SITE || "https://www.conestruct.com/sandbox";
const OUT = process.env.AUDIT_OUT || __dirname;
const TAG = process.env.AUDIT_TAG || "run";
// The viewport width: 1440 by default, 380 for the phone layout.
const W = Number(process.env.AUDIT_W || 1440);
const H = W <= 480 ? 800 : 1000;
const PIN = { lat: "39.74020", lng: "-104.95600" };

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: W, height: H } })).newPage();
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
  // The checks settle: no VERIFYING strip, the jurisdiction suggestion
  // answered (its "Checking boundary data…" state gone).
  let settled = false;
  for (let t = 0; t < 90; t += 1) {
    await page.waitForTimeout(1000);
    const busy = await page.evaluate(
      () =>
        !!document.querySelector(".status-bar.verifying") ||
        /Checking boundary data/.test(document.body.textContent || ""),
    );
    if (!busy) {
      settled = true;
      break;
    }
  }
  await page.mouse.move(W - 2, Math.round(H / 2));
  await page.waitForTimeout(1500);

  const m = await page.evaluate(() => {
    const band = document.querySelector('[data-testid="band-what"]');
    if (!band) return null;
    const h = (el) => Math.round(el.getBoundingClientRect().height * 100) / 100;
    return {
      band: h(band),
      grids: [...band.querySelectorAll(".a-grid")].map(h),
      cells: Object.fromEntries(
        [...band.querySelectorAll("[data-testid^='cell-']")].map((c) => [
          c.getAttribute("data-testid"),
          h(c),
        ]),
      ),
      toggles: band.querySelectorAll(".a-info-toggle").length,
      // The suggestion rows at rest (outside the details panels): the
      // row, and each part's width — what "one line" has to fit.
      suggRows: [...band.querySelectorAll(".sugg-row")]
        .filter((r) => !r.closest(".a-info"))
        .map((r) => ({
          cell: r.closest("[data-testid^='cell-']")?.getAttribute("data-testid"),
          rowW: Math.round(r.getBoundingClientRect().width * 100) / 100,
          rowH: h(r),
          parts: [...r.children].map((c) => ({
            tag: c.tagName.toLowerCase() + (c.className ? "." + c.className : ""),
            text: (c.textContent || "").trim(),
            w: Math.round(c.getBoundingClientRect().width * 100) / 100,
            h: h(c),
          })),
        })),
      // #276's states, each measured in place: a clone of the line, in
      // the same parent (so the same width and type), its reserve
      // switched off, carrying each state's words in turn.  The words
      // are WhatBand's own `jurisdictionProv` strings; the evaluated one
      // at its longest authority / term (data/jurisdictions: E-470's
      // toll_authority, "MHT").
      reserveStates: (() => {
        const p = band.querySelector('[data-testid="prov-jurisdiction"]');
        if (!p) return null;
        const states = {
          unset: "MUTCD + Colorado Supplement only",
          evaluating: "evaluating — the option you picked, not yet confirmed for this plan",
          evaluated: "evaluated · toll & authority · calls this plan a MHT",
          "not-evaluated": "not evaluated — the check did not answer; the option you picked stands",
        };
        const out = {};
        for (const [k, text] of Object.entries(states)) {
          const c = p.cloneNode(false);
          c.removeAttribute("data-testid");
          c.style.minHeight = "0";
          c.textContent = text;
          p.parentElement.insertBefore(c, p);
          out[k] = h(c);
          c.remove();
        }
        return out;
      })(),
      // #276's reserve on the jurisdiction line.
      provJurisdiction: (() => {
        const p = band.querySelector('[data-testid="prov-jurisdiction"]');
        if (!p) return null;
        const cs = getComputedStyle(p);
        return {
          text: (p.textContent || "").trim(),
          h: h(p),
          minHeight: cs.minHeight,
          lineHeight: cs.lineHeight,
          fontSize: cs.fontSize,
          w: Math.round(p.getBoundingClientRect().width * 100) / 100,
        };
      })(),
    };
  });
  if (!m) throw new Error("WHAT band not open");
  const out = { site: SITE, tag: TAG, ranAt: new Date().toISOString(), settled, ...m };
  fs.writeFileSync(path.join(OUT, `what-height-${TAG}.json`), JSON.stringify(out, null, 2) + "\n");
  await (await page.$('[data-testid="band-what"]')).screenshot({
    path: path.join(OUT, `what-${TAG}.png`),
  });
  console.log(`${TAG}: band ${m.band} px · grids ${m.grids.join(" / ")} · settled ${settled}`);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
