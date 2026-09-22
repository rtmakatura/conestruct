const ROOT = "C:/Users/rtmak/Documents/traffic-control-tool";
const { chromium } = require(ROOT + "/node_modules/playwright");
(async () => {
  const b = await chromium.launch();
  for (const vp of [{n:"1440",w:1440,h:1000,floor:32},{n:"380",w:380,h:800,floor:44}]) {
    const c = await b.newContext({ viewport:{width:vp.w,height:vp.h} });
    const p = await c.newPage();
    await p.goto("http://localhost:3999/sandbox", { waitUntil: "networkidle" });
    await p.waitForSelector('[data-testid="band-stack"]');
    const t = await p.$('text=Enter manually'); if (t) { await t.click(); await p.waitForTimeout(300); }
    const nums = await p.$$('input[type="number"][step="0.000001"]');
    if (nums.length>=2){ await nums[0].fill("39.71466"); await nums[1].fill("-104.94071"); await p.waitForTimeout(1500); }
    const small = await p.evaluate((floor) =>
      Array.from(document.querySelectorAll("button, a, select, input, [role=button]"))
        .map((e) => ({ b: e.getBoundingClientRect(), e }))
        .filter(({b}) => b.width>0 && b.height>0 && Math.min(b.width,b.height) < floor)
        .map(({b,e}) => ({ tag:e.tagName, id:e.id, cls:e.className.toString().slice(0,45),
          txt:(e.textContent||e.getAttribute("aria-label")||"").trim().slice(0,38),
          w:Math.round(b.width), h:Math.round(b.height) })), vp.floor);
    console.log(`[${vp.n}] floor ${vp.floor} — under: ${small.length}`);
    for (const s of small) console.log("   ", JSON.stringify(s));
    await c.close();
  }
  await b.close();
})();
