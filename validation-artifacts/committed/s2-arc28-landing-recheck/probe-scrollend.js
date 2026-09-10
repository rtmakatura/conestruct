// s2-arc28 probe — WHY the landing check is spent at ~70 ms (#271).
//   node probe-scrollend.js [base]
// One Generate at 380x800 against the local dev server, with every
// scrollIntoView, every scrollend, and the first moment scrollY is
// stable across six frames (the check's rAF fallback) time-stamped from
// the click.  It answers the question the ruled fix turned on: is the
// pair's settle really the first thing to reach the check?  It is not —
// a scrollend fires ~3 ms after the landing scroll is issued, with the
// zone still 1939 px from its margin, and that is what spends the one
// shot.  Output: probe-scrollend.out.txt.
const L = require("../s2-audit-1/audit-lib.js");
const BASE = process.argv[2] || "http://localhost:3005";
const INST = () => {
  window.__ev = [];
  const t0 = () => performance.now();
  window.__mark = (k, x) => window.__ev.push({ t: Math.round(t0()), k, x });
  const orig = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = function (a) { window.__mark("scrollIntoView", (a && a.behavior) + " " + String(this.className).slice(0, 30) + " top=" + Math.round(this.getBoundingClientRect().top)); return orig.apply(this, arguments); };
  addEventListener("scrollend", () => window.__mark("scrollend", "scrollY=" + Math.round(scrollY)), true);
  let f = 0, last = -1, stable = 0;
  const tick = () => { f++; const y = Math.round(scrollY); stable = y === last ? stable + 1 : 0; last = y; if (stable === 6) window.__mark("rAF-6stable", "frame " + f + " y=" + y); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
};
const SAMPLE = () => ({ ns: !!document.querySelector(".ns-strip"), band: !!document.querySelector(".working-band"), refusal: !!document.querySelector(".scan-refusal"), strip: document.querySelector(".status-bar")?.textContent || "" });
(async () => {
  const b = await L.chromium.launch();
  const page = await b.newPage({ viewport: { width: 380, height: 800 } });
  await page.addInitScript(INST);
  await page.goto(BASE + "/sandbox", { waitUntil: "networkidle", timeout: 120000 }); await page.waitForTimeout(600);
  await page.getByRole("button", { name: "Enter manually", exact: true }).click();
  const fill = async (l, v) => { await page.locator(`label:text-is("${l}")`).locator("xpath=following-sibling::input[1]").fill(v); };
  await fill("Latitude", "39.726900"); await page.getByRole("button", { name: "Edit manually", exact: true }).click();
  await fill("Longitude", "-104.987300"); await fill("Bearing (° from N)", "180"); await fill("Work zone (ft)", "1000");
  const t0 = Date.now(); while (Date.now() - t0 < 40000) { const s = await page.evaluate(SAMPLE); if (s.strip && !/VERIFYING|AWAITING/.test(s.strip)) break; await page.waitForTimeout(300); }
  await page.evaluate(() => { window.__ev = []; window.__mark("CLICK", ""); });
  await page.getByRole("button", { name: /Generate plan/ }).click();
  await page.waitForTimeout(12000);
  const ev = await page.evaluate(() => window.__ev);
  const base = ev[0].t;
  console.log(ev.map((e) => `${e.t - base} ms  ${e.k}  ${e.x}`).join("\n"));
  await b.close();
})();
