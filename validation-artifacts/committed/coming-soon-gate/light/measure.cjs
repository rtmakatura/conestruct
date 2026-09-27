// The light-lane browser check (handoff.md § Light lane, step 5): one run
// on the final commit, at 1440 and 390.  Status, sideways scroll, axe,
// target floors, contrast pairs, page errors, and crops of the changed
// regions (named on the command line as label=selector, optionally with
// "@hover" to hover it first, "@mid" to capture 120 ms into the hover,
// "@2x" to also capture at device pixel ratio 2).
//
//   AUDIT_OUT=<dir> node measure.cjs <base> [path] [label=selector[@hover][@mid][@2x] ...]
const lib = require("../../../../scripts/audit-lib.js");
const { chromium, fs, path, PAIRS, TARGETS, runAxe } = lib;

const [BASE = "http://localhost:3100", PAGE = "/", ...CROPS] = process.argv.slice(2);
const OUT = process.env.AUDIT_OUT;
if (!OUT) throw new Error("AUDIT_OUT is required");
fs.mkdirSync(OUT, { recursive: true });
const log = (s) => {
  console.log(s);
  fs.appendFileSync(path.join(OUT, "log.txt"), s + "\n");
};
const crops = CROPS.map((c) => {
  const i = c.indexOf("=");
  const [label, rest] = [c.slice(0, i), c.slice(i + 1)];
  const [sel, ...flags] = rest.split("@");
  return { label, sel, hover: flags.includes("hover") || flags.includes("mid"), mid: flags.includes("mid"), hi: flags.includes("2x") };
});

(async () => {
  const browser = await chromium.launch();
  log(`light check · ${BASE}${PAGE} · ${new Date().toISOString()}`);
  for (const [w, h] of [
    [1440, 900],
    [390, 844],
  ]) {
    for (const dpr of [1, 2]) {
      if (dpr === 2 && !crops.some((c) => c.hi)) continue;
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, reducedMotion: "no-preference" });
      const page = await ctx.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
      const resp = await page.goto(BASE + PAGE, { waitUntil: "networkidle" });
      await page.waitForTimeout(2500);
      if (dpr === 1) {
        const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
        const floor = w <= 480 ? 44 : 32;
        const small = (await page.evaluate(TARGETS, "body")).filter((t) => Math.min(t.w, t.h) < floor);
        // The road's faint "ahead" copy (R13) renders below 0.2 opacity by ruling; not reading text.
        const pairs = (await page.evaluate(PAIRS, "body")).filter((p) => p.opacity >= 0.2);
        const aa = (p) => (p.size >= 24 || (p.size >= 18.66 && +p.weight >= 700) ? 3 : 4.5);
        const low = pairs.filter((p) => p.ratio < aa(p));
        const lowest = pairs.map((p) => p.ratio).sort((a, b) => a - b)[0];
        const axe = await runAxe(page, OUT, `${w}`);
        log(`${w}: status ${resp.status()} · scroll ${m.sw}/${m.iw} ${m.sw > m.iw ? "SIDEWAYS" : "ok"} · axe ${axe.length ? axe.map((v) => `${v.id}(${v.nodes.length})`).join(",") : "0"} · targets under ${floor}: ${small.length ? small.map((t) => `${t.name} ${t.w}x${t.h}`).join("; ") : "none"} · contrast lowest ${lowest}, below AA: ${low.length ? low.map((p) => `"${p.text}" ${p.ratio}`).join("; ") : "none"} · page errors ${errors.length ? errors.join(" | ") : "none"}`);
      }
      for (const c of crops) {
        if (dpr === 2 && !c.hi) continue;
        const el = await page.$(c.sel);
        if (!el) { log(`${w} ${dpr}x ${c.label}: no element ${c.sel}`); continue; }
        await el.scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        if (c.hover) {
          await el.hover();
          await page.waitForTimeout(c.mid ? 120 : 900);
        }
        const box = await el.boundingBox();
        if (!box || box.width === 0) { log(`${w} ${dpr}x ${c.label}: not visible`); continue; }
        await page.screenshot({ path: path.join(OUT, `${c.label}-${w}-${dpr}x.png`), clip: { x: Math.max(0, box.x - 8), y: Math.max(0, box.y - 8), width: Math.min(box.width + 16, w), height: box.height + 16 } });
        if (c.hover) await page.mouse.move(2, 2);
      }
      await ctx.close();
    }
  }
  await browser.close();
})();
