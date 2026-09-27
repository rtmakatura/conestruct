// Why do 02's sheets pixelate while fanning?  Mid-transition vs settled,
// zoomed, at 1x and 2x; the compositor layer tree during the transition;
// and variants to isolate the cause.
//   node pix.cjs <outdir> [variant]
const { chromium } = require("C:/Users/rtmak/Documents/traffic-control-tool/node_modules/playwright");
const fs = require("fs");
const OUT = process.argv[2];
const VARIANT = process.argv[3] || "baseline";
fs.mkdirSync(OUT, { recursive: true });
const CSS = {
  baseline: "",
  // slow the transition so a mid frame is easy to catch
  slow: ".workbench .cs-s1,.workbench .cs-s2,.workbench .cs-s3{transition-duration:4s !important}",
  "slow+geo": ".workbench .cs-s1,.workbench .cs-s2,.workbench .cs-s3{transition-duration:4s !important} .cs-stack-art{shape-rendering:geometricPrecision}",
  "slow+noFillBox": ".workbench .cs-s1,.workbench .cs-s2,.workbench .cs-s3{transition-duration:4s !important; transform-box:view-box !important}",
  "slow+fix": `@property --fan { syntax: "<number>"; inherits: true; initial-value: 0; }
    .workbench .cs-s1,.workbench .cs-s2,.workbench .cs-s3{transition: --fan 4s ease-out !important}
    .workbench .cs-stack.is-fanned .cs-s1,.workbench .cs-stack.is-fanned .cs-s2,.workbench .cs-stack.is-fanned .cs-s3{--fan:1}
    .workbench .cs-stack .cs-s3{transform: translate(calc(var(--fan)*26px), calc(var(--fan)*-6px)) rotate(calc(var(--fan)*7deg)) !important}
    .workbench .cs-stack .cs-s2{transform: translate(calc(var(--fan)*12px), calc(var(--fan)*-3px)) rotate(calc(var(--fan)*3deg)) !important}
    .workbench .cs-stack .cs-s1{transform: translate(calc(var(--fan)*-10px), calc(var(--fan)*-2px)) rotate(calc(var(--fan)*-3deg)) !important}`,
  "slow+willchange": ".workbench .cs-s1,.workbench .cs-s2,.workbench .cs-s3{transition-duration:4s !important; will-change:transform}",
};
(async () => {
  const b = await chromium.launch();
  for (const dpr of [1, 2]) {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: dpr, reducedMotion: "no-preference" });
    const p = await ctx.newPage();
    await p.goto("http://localhost:3100/", { waitUntil: "networkidle" });
    await p.addStyleTag({ content: CSS[VARIANT] || "" });
    await p.evaluate(() => document.querySelectorAll(".cs-stack")[0].scrollIntoView({ block: "center" }));
    await p.waitForTimeout(800);
    const cdp = await ctx.newCDPSession(p);
    await cdp.send("LayerTree.enable");
    let layers = [];
    cdp.on("LayerTree.layerTreeDidChange", (e) => { if (e.layers) layers = e.layers; });
    const stack = (await p.$$(".cs-stack"))[0];
    const box = await (await stack.$("svg")).boundingBox();
    const clip = { x: box.x + 10, y: box.y - 20, width: 150, height: 90 };
    await p.screenshot({ path: `${OUT}/${VARIANT}-${dpr}x-rest.png`, clip });
    const before = layers.length;
    await stack.hover();
    await p.waitForTimeout(VARIANT === "baseline" ? 120 : 1800);
    const during = layers.length;
    const anims = await p.evaluate(() => document.getAnimations().filter((a) => a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest(".cs-stack")).map((a) => ({ state: a.playState, t: Math.round(a.currentTime) })));
    const svgLayers = layers.filter((l) => /svg|g\b|cs-s|stack/i.test((l.nodeId ? "" : "") + (l.layerId || ""))).length;
    await p.screenshot({ path: `${OUT}/${VARIANT}-${dpr}x-mid.png`, clip });
    // Layers with a transform animation, big enough to be the sheet
    const moving = layers.filter((l) => l.width > 100 && l.height > 100 && l.transform && l.transform.some((v, i) => (i === 1 || i === 4) && Math.abs(v) > 0.001));
    await p.waitForTimeout(VARIANT === "baseline" ? 600 : 4500);
    await p.screenshot({ path: `${OUT}/${VARIANT}-${dpr}x-settled.png`, clip });
    console.log(JSON.stringify({ VARIANT, dpr, layersBefore: before, layersDuring: during, rotatedLayers: moving.map((l) => ({ w: l.width, h: l.height, draws: l.drawsContent })), anims: anims.slice(0, 3) }));
    await ctx.close();
  }
  await b.close();
})();
