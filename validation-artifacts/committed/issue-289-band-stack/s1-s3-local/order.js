// Column order, measured: is the verdict strip above the band stack, and
// is the WHERE fact line visible above the open band (§1.2, rule 26)?
const ROOT = "C:/Users/rtmak/Documents/traffic-control-tool";
const { chromium } = require(ROOT + "/node_modules/playwright");
(async () => {
  const b = await chromium.launch();
  for (const vp of [{n:"1440",w:1440,h:1000},{n:"380",w:380,h:800}]) {
    const c = await b.newContext({ viewport:{width:vp.w,height:vp.h} });
    const p = await c.newPage();
    await p.goto("http://localhost:3999/sandbox", { waitUntil: "networkidle" });
    await p.waitForSelector('[data-testid="band-stack"]');
    const t = await p.$('text=Enter manually'); if (t) { await t.click(); await p.waitForTimeout(300); }
    const nums = await p.$$('input[type="number"][step="0.000001"]');
    if (nums.length>=2){ await nums[0].fill("39.71466"); await nums[1].fill("-104.94071"); await p.waitForTimeout(1500); }
    const o = await p.evaluate(() => {
      const top = (s) => { const e=document.querySelector(s); if(!e) return null;
        const r=e.getBoundingClientRect(); return {top:Math.round(r.top+scrollY), h:Math.round(r.height)}; };
      const nav = document.querySelector(".app-nav, nav, header");
      return {
        nav: nav ? Math.round(nav.getBoundingClientRect().height) : null,
        strip: top(".status-slot"),
        stack: top('[data-testid="band-stack"]'),
        whereFact: top('[data-testid="fact-where"]'),
        openBand: top(".a-open"),
        stepTags: Array.from(document.querySelectorAll(".tr-step")).map(e=>e.textContent),
      };
    });
    console.log(`[${vp.n}]`, JSON.stringify(o));
    await c.close();
  }
  await b.close();
})();
