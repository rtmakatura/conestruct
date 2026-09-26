const { chromium } = require("C:/Users/rtmak/Documents/traffic-control-tool/node_modules/playwright");
(async () => {
  const b = await chromium.launch();
  for (let run = 0; run < 3; run++) {
    const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    const msgs = [];
    p.on("console", (m) => { if (["error", "warning"].includes(m.type())) msgs.push(m.type() + ": " + m.text().slice(0, 160)); });
    await p.goto("http://localhost:3100/", { waitUntil: "domcontentloaded" });
    await p.waitForSelector(".cs-wide");
    await p.evaluate(() => { window.__tag = document.querySelector(".cs-wide"); });
    const samples = [];
    for (const t of [300, 1000, 2000, 3000, 4500]) {
      await p.waitForTimeout(t - (samples.length ? samples[samples.length - 1].t : 0));
      samples.push({ t, ...(await p.evaluate(() => {
        const svg = document.querySelector(".cs-wide");
        const work = svg.querySelectorAll(":scope > g.cs-fade")[1];
        const a = work.getAnimations()[0];
        return { same: window.__tag === svg, opacity: getComputedStyle(work).opacity, state: a ? a.playState : "none", cur: a ? Math.round(a.currentTime) : null };
      })) });
    }
    console.log("run", run, JSON.stringify(samples));
    console.log("console:", msgs.slice(0, 5));
  }
  await b.close();
})();
