// Orientation probe on prod (one pin + Generate per viewport): why #reference lands at 67/62 — scroll clamp at the document end?
const L = require("C:/Users/rtmak/Documents/traffic-control-tool/validation-artifacts/committed/s2-audit-1/audit-lib.js");
const BASE = "https://www.conestruct.com";
(async () => {
  const browser = await L.chromium.launch();
  for (const vp of [{ width: 1440, height: 1000 }, { width: 380, height: 800 }]) {
    const page = await browser.newPage({ viewport: vp });
    await page.goto(BASE + "/sandbox", { waitUntil: "networkidle", timeout: 120000 }); await page.waitForTimeout(600);
    await page.getByRole("button", { name: "Enter manually", exact: true }).click();
    const fill = async (l, v) => { await page.locator(`label:text-is("${l}")`).locator("xpath=following-sibling::input[1]").fill(v); };
    await fill("Latitude", "39.726900"); await page.getByRole("button", { name: "Edit manually", exact: true }).click();
    await fill("Longitude", "-104.987300"); await fill("Bearing (° from N)", "180"); await fill("Work zone (ft)", "1000");
    await page.waitForTimeout(4000);
    await page.getByRole("button", { name: /Generate plan/ }).click();
    const t0 = Date.now(); while (Date.now() - t0 < 90000) { const ok = await page.evaluate(() => !document.querySelector(".working-band") && !!document.querySelector(".ns-strip")); if (ok) break; await page.waitForTimeout(200); }
    await page.waitForTimeout(1500);
    await page.evaluate(() => document.querySelectorAll(".ns-strip .ns-chip")[1].click()); await page.waitForTimeout(1500);
    const m = await page.evaluate(() => { const el = document.getElementById("reference"); const b = el.getBoundingClientRect(); return { top: Math.round(b.top * 100) / 100, docTop: Math.round((b.top + scrollY) * 100) / 100, margin: parseFloat(getComputedStyle(el).scrollMarginTop), scrollY: Math.round(scrollY), docH: document.documentElement.scrollHeight, innerH: innerHeight, maxScroll: document.documentElement.scrollHeight - innerHeight, zoneH: Math.round(b.height), footerH: Math.round(document.querySelector("footer")?.getBoundingClientRect().height ?? 0) }; });
    m.clamped = m.scrollY >= m.maxScroll - 1;
    console.log(JSON.stringify({ vp: `${vp.width}x${vp.height}`, ...m }));
    await page.close();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
