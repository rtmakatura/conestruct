// coming-soon-gate R21 — the browser leg for 02's four hover moves.
// At 1440 × 900, 1x and 2x device pixel ratio, for each card:
//   - mid-move and settled crops (a real-speed frame, and a frame from a
//     run slowed 10x so "mid" is unambiguous);
//   - the compositor layer tree during the move: any layer carrying a
//     rotation is the pixelation's cause (rasterised then rotated);
//   - P1: no box outside the hovered card moves (document-relative);
// plus touch (static), reduced motion (no animation, every mark at rest)
// and axe WCAG 2.2 AA.
//
//   AUDIT_OUT=<dir> node measure.cjs [base]      (base default http://localhost:3100)
const lib = require("../../../../scripts/audit-lib.js");
const { chromium, fs, path, runAxe } = lib;

const BASE = process.argv[2] || "http://localhost:3100";
const OUT = process.env.AUDIT_OUT;
if (!OUT) throw new Error("AUDIT_OUT is required (write evidence outside scripts/)");
fs.mkdirSync(OUT, { recursive: true });
const log = (s) => {
  console.log(s);
  fs.appendFileSync(path.join(OUT, "log.txt"), s + "\n");
};
const MOVES = ["plan", "quote", "audit", "crew"];
const SLOW =
  ".workbench .cs-s1,.workbench .cs-s2,.workbench .cs-s3{transition-duration:3.5s !important}" +
  ".workbench .cs-stack.is-fanned .cs-seq{animation-duration:3.5s !important;animation-delay:calc(var(--i) * 400ms) !important}";

// Every box on the page that could move, keyed by selector and index
// (never by class name: the hovered card's class changes), including
// the hovered card's own box, its text and its drawing's box.
const BOXES = () =>
  [".cs-section", ".cs-head", ".cs-stack", ".cs-stack-text", ".cs-stack-art"].flatMap((sel) =>
    [...document.querySelectorAll(sel)].map((e, i) => {
      const b = e.getBoundingClientRect();
      return `${sel}[${i}]|${Math.round(b.left + scrollX)},${Math.round(b.top + scrollY)},${Math.round(b.width)}x${Math.round(b.height)}`;
    }),
  );

const STATE = (k) => {
  const s = document.querySelector(`.cs-stack[data-move="${k}"]`);
  return {
    fanned: s.classList.contains("is-fanned"),
    running: document.getAnimations().filter((a) => a.effect?.target && s.contains(a.effect.target) && a.playState === "running").length,
    fan: getComputedStyle(s.querySelector(".cs-s1")).getPropertyValue("--fan").trim(),
    marksAtRest: [...s.querySelectorAll(".cs-seq")].every((m) => getComputedStyle(m).getPropertyValue("--k").trim() === "1"),
  };
};

async function rotatedLayers(cdp) {
  const { layers } = await new Promise((res) => {
    const h = (e) => { if (e.layers) { cdp.off("LayerTree.layerTreeDidChange", h); res(e); } };
    cdp.on("LayerTree.layerTreeDidChange", h);
  });
  return layers.filter((l) => l.transform && (Math.abs(l.transform[1]) > 1e-4 || Math.abs(l.transform[4]) > 1e-4)).map((l) => `${l.width}x${l.height}`);
}

(async () => {
  const browser = await chromium.launch();
  const result = {};
  for (const dpr of [1, 2]) {
    for (const speed of ["real", "slow"]) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: dpr, reducedMotion: "no-preference" });
      const page = await ctx.newPage();
      await page.goto(BASE + "/", { waitUntil: "networkidle" });
      if (speed === "slow") await page.addStyleTag({ content: SLOW });
      await page.evaluate(() => document.querySelector(".cs-stacks").scrollIntoView({ block: "center" }));
      await page.waitForTimeout(1500);
      const cdp = await ctx.newCDPSession(page);
      await cdp.send("LayerTree.enable");
      for (const k of MOVES) {
        const card = await page.$(`.cs-stack[data-move="${k}"]`);
        const art = await (await card.$("svg")).boundingBox();
        const clip = { x: art.x - 16, y: art.y - 16, width: art.width + 48, height: art.height + 32 };
        const before = await page.evaluate(BOXES);
        const layerWatch = rotatedLayers(cdp);
        await card.hover();
        await page.waitForTimeout(speed === "slow" ? 1400 : 120);
        const mid = await page.evaluate(STATE, k);
        await page.screenshot({ path: path.join(OUT, `${k}-${dpr}x-${speed}-mid.png`), clip });
        const rotated = await Promise.race([layerWatch, new Promise((r) => setTimeout(() => r("no layer change"), 800))]);
        await page.waitForTimeout(speed === "slow" ? 4200 : 700);
        const settled = await page.evaluate(STATE, k);
        await page.screenshot({ path: path.join(OUT, `${k}-${dpr}x-${speed}-settled.png`), clip });
        const after = await page.evaluate(BOXES);
        const moved = before.filter((b, i) => b !== after[i]);
        await page.mouse.move(5, 5);
        await page.waitForTimeout(speed === "slow" ? 4200 : 700);
        const back = await page.evaluate(STATE, k);
        result[`${k}-${dpr}x-${speed}`] = { mid, settled, back, rotated, moved };
        log(`${k} ${dpr}x ${speed}: mid ${JSON.stringify(mid)} · rotated compositor layers during: ${Array.isArray(rotated) ? (rotated.length ? rotated.join(",") : "none") : rotated} · settled fan ${settled.fan} · after leave fan ${back.fan} marks at rest ${back.marksAtRest} · P1 boxes moved: ${moved.length ? moved.join(" ; ") : "none"}`);
      }
      if (dpr === 1 && speed === "real") {
        const axe = await runAxe(page, OUT, "home-1440");
        log(`axe: ${axe.length ? axe.map((v) => `${v.id} (${v.nodes.length})`).join(", ") : "0 violations"}`);
      }
      await ctx.close();
    }
  }
  // Touch: a tap shows the static stack.
  const tctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, hasTouch: true, reducedMotion: "no-preference" });
  const tpage = await tctx.newPage();
  await tpage.goto(BASE + "/", { waitUntil: "networkidle" });
  await tpage.evaluate(() => document.querySelector(".cs-stacks").scrollIntoView({ block: "center" }));
  await tpage.waitForTimeout(1000);
  for (const k of MOVES) {
    await tpage.tap(`.cs-stack[data-move="${k}"] svg`);
    await tpage.waitForTimeout(200);
    const s = await tpage.evaluate(STATE, k);
    result[`${k}-touch`] = s;
    log(`${k} touch: ${JSON.stringify(s)}`);
  }
  await tctx.close();
  // Reduced motion: the sheets change place, nothing animates, marks at rest.
  const rctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const rpage = await rctx.newPage();
  await rpage.goto(BASE + "/", { waitUntil: "networkidle" });
  await rpage.evaluate(() => document.querySelector(".cs-stacks").scrollIntoView({ block: "center" }));
  await rpage.waitForTimeout(1000);
  for (const k of MOVES) {
    await rpage.hover(`.cs-stack[data-move="${k}"]`);
    await rpage.waitForTimeout(30);
    const s = await rpage.evaluate(STATE, k);
    const t = await rpage.evaluate((m) => getComputedStyle(document.querySelector(`.cs-stack[data-move="${m}"] .cs-s1`)).transitionDuration, k);
    result[`${k}-reduce`] = { ...s, transition: t };
    log(`${k} reduce: ${JSON.stringify({ ...s, transition: t })}`);
  }
  await rctx.close();
  fs.writeFileSync(path.join(OUT, "measure.json"), JSON.stringify(result, null, 1));
  await browser.close();
})();
