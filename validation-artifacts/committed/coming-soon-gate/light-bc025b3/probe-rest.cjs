// R22 item 1: why is the plan card's settled (fanned) front sheet jagged?
//   node rest.cjs <base> <outdir>
const { chromium } = require("C:/Users/rtmak/Documents/traffic-control-tool/node_modules/playwright");
const fs = require("fs");
const [BASE, OUT] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch();
  for (const dpr of [1, 2]) {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: dpr });
    const p = await ctx.newPage();
    await p.goto(BASE + "/", { waitUntil: "networkidle" });
    await p.evaluate(() => document.querySelector(".cs-stacks").scrollIntoView({ block: "center" }));
    await p.waitForTimeout(1200);
    const cdp = await ctx.newCDPSession(p);
    await cdp.send("LayerTree.enable");
    let layers = [];
    cdp.on("LayerTree.layerTreeDidChange", (e) => { if (e.layers) layers = e.layers; });
    const card = (await p.$$(".cs-stack"))[0];
    const art = await (await card.$("svg")).boundingBox();
    const clip = { x: art.x + 10, y: art.y - 10, width: 170, height: 70 };
    await p.screenshot({ path: `${OUT}/rest-${dpr}x.png`, clip });
    await card.hover();
    await p.waitForTimeout(1500);
    await p.screenshot({ path: `${OUT}/settled-${dpr}x.png`, clip });
    const info = await p.evaluate(() => {
      const line = document.querySelector(".cs-stack .cs-s1 .cs-doc-title");
      const chain = [];
      for (let e = line; e; e = e.parentElement) {
        const cs = getComputedStyle(e);
        chain.push({ el: e.tagName.toLowerCase() + "." + String(e.className.baseVal ?? e.className).split(" ")[0], shape: cs.shapeRendering, will: cs.willChange, tf: cs.transform === "none" ? "" : cs.transform.slice(0, 40), filter: cs.filter, backface: cs.backfaceVisibility, contain: cs.contain });
        if (e.tagName === "BODY") break;
      }
      const props = [];
      for (const s of document.styleSheets) { try { for (const r of s.cssRules) if (r.constructor.name === "CSSPropertyRule") props.push(r.name); } catch {} }
      return { props, fan: getComputedStyle(document.querySelector(".cs-stack .cs-s1")).getPropertyValue("--fan"), chain: chain.slice(0, 6), interesting: chain.filter((c) => c.shape !== "auto" || c.will !== "auto" || c.filter !== "none" || c.backface !== "visible") };
    });
    const rotated = layers.filter((l) => l.transform && (Math.abs(l.transform[1]) > 1e-4 || Math.abs(l.transform[4]) > 1e-4)).map((l) => `${l.width}x${l.height}`);
    console.log(JSON.stringify({ BASE, dpr, layers: layers.length, rotated, ...info }));
    await ctx.close();
  }
  await b.close();
})();
