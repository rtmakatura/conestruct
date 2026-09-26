// coming-soon-gate Arc 2 — the browser leg for the Plan Sheet at `/`.
// Measures what happy-dom cannot: sideways scroll, hit targets (rule 15 /
// P10: 32 px at desktop, 44 px both dimensions at <=480), contrast per
// pair (P12, Rule 13), axe WCAG 2.2 AA, the page's edges (P4), rendered
// type sizes against the artboards (R7, A2-T), R10's animation under
// both motion settings, and P1 (no box moves while it runs).
//
//   AUDIT_OUT=<dir> node measure.cjs [base]      (base default http://localhost:3100)
//
// `/` is public (R1.2), so no bypass header is needed; for any other
// path on prod the caller would use scripts/gate.cjs.
const lib = require("../../../../scripts/audit-lib.js");
const { chromium, fs, path, RECTS, PAIRS, TARGETS, TYPE, runAxe, shot, diffRects } = lib;

const BASE = process.argv[2] || "http://localhost:3100";
const OUT = process.env.AUDIT_OUT;
if (!OUT) throw new Error("AUDIT_OUT is required (write evidence outside scripts/)");
fs.mkdirSync(OUT, { recursive: true });
const log = (s) => { console.log(s); fs.appendFileSync(path.join(OUT, "log.txt"), s + "\n"); };

const WIDTHS = [
  [1440, 900],
  [1024, 800],
  [768, 900],
  [390, 844],
  [380, 800],
];
const EDGE_SELS = [".cs-sheet", ".cs-section", ".cs-close", ".cs-head"];

(async () => {
  const browser = await chromium.launch();
  const result = { base: BASE, at: new Date().toISOString(), widths: {} };
  for (const [w, h] of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: "no-preference" });
    const page = await ctx.newPage();
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    // P1 during R10: rects just after first paint and after the animation ends.
    await page.waitForSelector(".cs-sheet");
    const early = await page.evaluate(RECTS, [...EDGE_SELS, ".cs-drawing", ".cs-lower", "h1", ".pri", ".cs-legend"]);
    const earlyFade = await page.evaluate(() => {
      const el = [...document.querySelectorAll(".cs-fade")].find((e) => getComputedStyle(e).display !== "none" && e.getBoundingClientRect().width > 0);
      return el ? { opacity: getComputedStyle(el).opacity, anim: getComputedStyle(el).animationName } : null;
    });
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2200);
    const late = await page.evaluate(RECTS, [...EDGE_SELS, ".cs-drawing", ".cs-lower", "h1", ".pri", ".cs-legend"]);
    const moved = diffRects(early, late).filter((d) => d.sel);

    const m = await page.evaluate(() => {
      const px = (sel) => { const e = document.querySelector(sel); return e ? getComputedStyle(e).fontSize : null; };
      const visible = (e) => getComputedStyle(e).display !== "none" && e.getBoundingClientRect().width > 0;
      const svgText = [...document.querySelectorAll(".cs-drawing-art svg text, .cs-step-art text")]
        .filter((t) => t.getBoundingClientRect().width > 0)
        .map((t) => ({ text: t.textContent, size: getComputedStyle(t).fontSize, rendered: Math.round(t.getBoundingClientRect().height * 10) / 10 }));
      return {
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        h1: px("h1"),
        wordmark: px(".cs-wordmark"),
        body: px(".cs-body"),
        drawing: [...document.querySelectorAll(".cs-drawing-art > svg")].filter(visible).map((s) => s.getAttribute("class")),
        svgText,
        edges: [...document.querySelectorAll(".cs-sheet, .cs-section, .cs-close")].map((e) => { const b = e.getBoundingClientRect(); return { cls: e.className.split(" ")[0], left: Math.round(b.left), right: Math.round(b.right) }; }),
        tbLabelLefts: [...document.querySelectorAll(".cs-tb-k")].map((e) => Math.round(e.getBoundingClientRect().left)),
        tbRowHeights: [...document.querySelectorAll(".cs-tb-row")].map((e) => Math.round(e.getBoundingClientRect().height)),
        mail: [...document.querySelectorAll("a[href^='mailto:']")].filter(visible).map((a) => a.textContent),
      };
    });
    const targets = await page.evaluate(TARGETS, "body");
    const floor = w <= 480 ? 44 : 32;
    const small = targets.filter((t) => Math.min(t.w, t.h) < floor);
    const pairs = await page.evaluate(PAIRS, "body");
    const lowContrast = pairs.filter((p) => p.ratio < (p.size >= 24 || (p.size >= 18.66 && +p.weight >= 700) ? 3 : 4.5));
    const pairSet = [...new Map(pairs.map((p) => [`${p.fg} on ${p.bg}`, { fg: p.fg, bg: p.bg, ratio: p.ratio }])).values()].sort((a, b) => a.ratio - b.ratio);
    const type = await page.evaluate(TYPE, "body");
    const axe = await runAxe(page, OUT, `${w}`);
    // The first screen as the no-preference reader sees it once the
    // animation has finished.  The FULL-page capture is taken in the
    // reduced-motion context below: Playwright's full-page capture in this
    // Chromium caught the drawing back at its first frames (road stubs, no
    // devices) although document.getAnimations() reported every animation
    // "finished" — a capture artifact, so the static end state is the
    // honest full-page record.
    const png = await shot(page, OUT, `plan-sheet-${w}-first-screen`);

    // R10's other path: reduced motion -> static at first paint.
    const rctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: "reduce" });
    const rpage = await rctx.newPage();
    await rpage.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    await rpage.waitForSelector(".cs-sheet");
    const reduced = await rpage.evaluate(() => {
      const els = [...document.querySelectorAll(".cs-fade, .cs-draw")];
      return {
        n: els.length,
        animated: els.filter((e) => getComputedStyle(e).animationName !== "none").length,
        notOpaque: els.filter((e) => getComputedStyle(e).opacity !== "1").length,
        transformed: els.filter((e) => getComputedStyle(e).transform !== "none").length,
      };
    });
    await shot(rpage, OUT, `plan-sheet-${w}-full`, true);
    await rctx.close();

    result.widths[w] = { m, earlyFade, moved, targets: targets.length, small, lowContrast, pairSet, type, axe: axe.map((v) => `${v.id} (${v.nodes.length})`), reduced, png };
    log(`\n== ${w}x${h} ==`);
    log(`scroll ${m.scrollWidth}/${m.innerWidth} ${m.scrollWidth > m.innerWidth ? "SIDEWAYS SCROLL" : "ok"} · drawing ${m.drawing.join(",")} · h1 ${m.h1} · wordmark ${m.wordmark} · body ${m.body}`);
    log(`svg text: ${m.svgText.map((t) => `"${t.text.slice(0, 24)}" ${t.size}`).join(" | ")}`);
    log(`edges: ${m.edges.map((e) => `${e.cls} ${e.left}-${e.right}`).join(" | ")}`);
    log(`title block: label lefts ${[...new Set(m.tbLabelLefts)].join(",")} · row heights ${[...new Set(m.tbRowHeights)].join(",")}`);
    log(`mail links visible: ${m.mail.length} (${m.mail.join(" / ")})`);
    log(`targets ${targets.length}, under ${floor}px: ${small.length ? small.map((t) => `${t.name} ${t.w}x${t.h}`).join("; ") : "none"}`);
    log(`contrast pairs (lowest first): ${pairSet.slice(0, 6).map((p) => `${p.fg}/${p.bg} ${p.ratio}`).join(" · ")} · below AA: ${lowContrast.length ? lowContrast.map((p) => `${p.text} ${p.ratio}`).join("; ") : "none"}`);
    log(`axe: ${axe.length ? axe.map((v) => `${v.id} (${v.nodes.length})`).join(", ") : "0 violations"}`);
    log(`R10 no-preference: first fade at paint ${JSON.stringify(earlyFade)} · rects moved during animation: ${moved.length ? JSON.stringify(moved) : "none"}`);
    log(`R10 reduce: ${JSON.stringify(reduced)}`);
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, "measure.json"), JSON.stringify(result, null, 1));
  await browser.close();
})();
