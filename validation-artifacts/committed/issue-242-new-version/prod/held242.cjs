// #242 prod proof: tabs opened on the build #242 ships, held across the next
// frontend deploy.  Every 20 s each tab is told it became visible (the
// hook's on-visible check); once a newer build is live the nav must show
// "New version. Reload".  Then: the nav still 52 px, no sideways scroll at
// 360, the button >= 44 px tall; pressing it reloads onto the new build and
// the line is gone.   node held242.cjs <base> <outJson> <maxMinutes>
const fs = require("fs");
const REPO = "C:/Users/rtmak/Documents/traffic-control-tool";
const { chromium } = require(`${REPO}/node_modules/playwright`);
const { applyGate, gateHeaders } = require(`${REPO}/scripts/gate.cjs`);

const [, , BASE, OUT, MAXMIN] = process.argv;
const result = { startedAt: new Date().toISOString(), widths: {} };
const save = () => fs.writeFileSync(OUT, JSON.stringify(result, null, 1));

async function served(page) {
  return page.evaluate(async () => (await (await fetch("/api/version", { cache: "no-store" })).json()).sha);
}

(async () => {
  gateHeaders(BASE);
  const browser = await chromium.launch();
  const tabs = [];
  for (const [w, h] of [[1440, 1000], [360, 800]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    await applyGate(ctx, BASE);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/sandbox`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(6000);
    result.widths[w] = { builtSha: await served(page), noticeAtOpen: await page.getByTestId("nav-new-version").count() };
    tabs.push({ w, page });
  }
  save();
  const deadline = Date.now() + Number(MAXMIN) * 60000;
  const pending = new Set(tabs.map((t) => t.w));
  while (pending.size && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 20000));
    for (const { w, page } of tabs) {
      if (!pending.has(w)) continue;
      await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
      await page.waitForTimeout(1500);
      if ((await page.getByTestId("nav-new-version").count()) === 0) continue;
      pending.delete(w);
      const nav = await page.locator("nav").first().boundingBox();
      const btn = await page.getByTestId("nav-new-version").boundingBox();
      const r = result.widths[w];
      r.noticeAt = new Date().toISOString();
      r.liveSha = await served(page);
      r.text = (await page.getByTestId("nav-new-version").textContent()).trim();
      r.navHeight = nav && Math.round(nav.height);
      r.buttonHeight = btn && Math.round(btn.height);
      r.scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      await page.screenshot({ path: OUT.replace(/\.json$/, `-${w}.png`), clip: { x: 0, y: 0, width: w, height: 80 } });
      await page.getByTestId("nav-new-version").click();
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(6000);
      r.afterReload = { noticeCount: await page.getByTestId("nav-new-version").count() };
      save();
    }
  }
  result.endedAt = new Date().toISOString();
  result.timedOut = pending.size > 0;
  save();
  await browser.close();
})().catch((e) => { result.error = String(e).slice(0, 300); save(); process.exit(1); });
