// coming-soon-gate Arc 3 — the browser leg for the full page at `/` and
// the 404.  Measures what happy-dom cannot, at 1440 / 1024 / 768 / 390 /
// 380: sideways scroll, hit targets (32 px desktop, 44 px both
// dimensions at <=480), contrast per pair, axe WCAG 2.2 AA, rendered SVG
// text sizes, and the rulings' motion:
//   R13  the road beside 01 → close from 980 px: the highlight follows
//        the scroll and ends exactly at the road's end at the bottom of
//        the page; the fade recedes; reduced motion = fully drawn, static.
//   R14  the marker per stretch (and under reduced motion, A3-Q3).
//   R15  02's fan on hover.
//   P1   no box on the page moves while scrolling or fanning.
//   R19  /404 at every width; an unknown path goes to `/` (A3-Q2).
//
//   AUDIT_OUT=<dir> node measure.cjs [base]      (base default http://localhost:3100)
//
// `/` and `/404` are public (R1.2, A3-Q2): no bypass header is needed.
const lib = require("../../../../scripts/audit-lib.js");
const { chromium, fs, path, PAIRS, TARGETS, runAxe, shot } = lib;

const BASE = process.argv[2] || "http://localhost:3100";
const OUT = process.env.AUDIT_OUT;
if (!OUT) throw new Error("AUDIT_OUT is required (write evidence outside scripts/)");
fs.mkdirSync(OUT, { recursive: true });
const log = (s) => {
  console.log(s);
  fs.appendFileSync(path.join(OUT, "log.txt"), s + "\n");
};

const WIDTHS = [
  [1440, 900],
  [1024, 800],
  [768, 900],
  [390, 844],
  [380, 800],
];
const BOXES = [".cs-sheet", ".cs-section", ".cs-close", ".cs-head", ".cs-stack", ".cs-stack-text"];

// Document-relative rects, so a scroll alone is not "movement".
const DOC_RECTS = (sels) =>
  sels.flatMap((sel) =>
    [...document.querySelectorAll(sel)].map((e, i) => {
      const b = e.getBoundingClientRect();
      return { sel: `${sel}[${i}]`, x: Math.round(b.left + scrollX), y: Math.round(b.top + scrollY), w: Math.round(b.width), h: Math.round(b.height) };
    }),
  );
const moved = (a, b) =>
  a.filter((r, i) => { const s = b[i]; return !s || s.sel !== r.sel || s.x !== r.x || s.y !== r.y || s.w !== r.w || s.h !== r.h; }).map((r) => r.sel);

const ROAD = () => {
  const svg = document.querySelector(".cs-road-svg");
  const vis = !!svg && getComputedStyle(svg).display !== "none";
  const reveal = document.querySelector(".cs-road-reveal");
  const fade = document.querySelector("#cs-road-fade");
  const mp = document.querySelector(".cs-mp");
  return {
    shown: vis,
    h: svg ? Number(svg.getAttribute("height")) : null,
    reveal: reveal ? Number(reveal.getAttribute("height")) : null,
    fadeY1: fade ? Number(fade.getAttribute("y1")) : null,
    marker: mp && getComputedStyle(mp).display !== "none" ? mp.textContent : null,
    // 01's milepost (road px) and 01's header top (road px): the post sits
    // 6 px above the header, and the road begins 40 px above the post.
    post01: (() => { const b = document.querySelector(".cs-road-lit .cs-post-box"); return b ? Number(b.getAttribute("y")) : null; })(),
    head01: (() => { const w = document.querySelector(".cs-road-wrap"), s = document.querySelector("[data-milepost='0']"); return w && s ? Math.round(s.getBoundingClientRect().top - w.getBoundingClientRect().top) : null; })(),
    scrollY: Math.round(scrollY),
    max: document.documentElement.scrollHeight - innerHeight,
  };
};

async function settle(page, ms = 1200) {
  await page.waitForTimeout(ms);
}

(async () => {
  const browser = await chromium.launch();
  const result = { base: BASE, at: new Date().toISOString(), widths: {} };
  for (const [w, h] of WIDTHS) {
    const r = {};
    // ── `/`, no preference ─────────────────────────────────────────────
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: "no-preference" });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await page.waitForSelector(".cs-close");
    await settle(page, 2400);
    const boxes0 = await page.evaluate(DOC_RECTS, BOXES);
    r.scroll = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth }));
    r.top = await page.evaluate(ROAD);

    // Scroll the page in steps; at each, let the ease settle.
    const max = r.top.max;
    r.steps = [];
    for (const f of [0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1]) {
      await page.evaluate((y) => window.scrollTo(0, y), Math.round(max * f));
      await settle(page);
      r.steps.push(await page.evaluate(ROAD));
      if (w === 1440 && (f === 0.45 || f === 1)) await shot(page, OUT, `full-${w}-scrolled-${Math.round(f * 100)}`);
    }
    // Mid-ease sample: jump from the top to the bottom and read one frame in.
    await page.evaluate(() => window.scrollTo(0, 0));
    await settle(page);
    await page.evaluate((y) => window.scrollTo(0, y), max);
    await page.waitForTimeout(50);
    r.midEase = await page.evaluate(ROAD);
    await settle(page, 2000);
    r.end = await page.evaluate(ROAD);
    const boxes1 = await page.evaluate(DOC_RECTS, BOXES);
    r.movedWhileScrolling = moved(boxes0, boxes1);

    // R15: the fan, at widths with a mouse (hover), measured in place.
    await page.evaluate(() => document.querySelectorAll(".cs-stack")[1].scrollIntoView({ block: "center" }));
    await settle(page, 600);
    const beforeFan = await page.evaluate(DOC_RECTS, BOXES);
    const s1 = await page.$$(".cs-stack");
    await s1[1].hover();
    await page.waitForTimeout(400);
    r.fan = await page.evaluate(() => {
      const st = document.querySelectorAll(".cs-stack")[1];
      return {
        fanned: st.classList.contains("is-fanned"),
        s3: getComputedStyle(st.querySelector(".cs-s3")).transform,
        transition: getComputedStyle(st.querySelector(".cs-s3")).transitionDuration,
      };
    });
    const afterFan = await page.evaluate(DOC_RECTS, BOXES);
    r.movedWhileFanning = moved(beforeFan, afterFan);
    if (w === 1440) await shot(page, OUT, `full-${w}-02-fanned`);
    await page.mouse.move(0, 0);

    // Type in the drawings: every visible SVG text at its role's size.
    r.svgText = await page.evaluate(() =>
      [...new Set([...document.querySelectorAll("svg text")]
        .filter((t) => t.getBoundingClientRect().width > 0 && !t.closest(".cs-road-ahead"))
        .map((t) => getComputedStyle(t).fontSize))].sort(),
    );
    const targets = await page.evaluate(TARGETS, "body");
    const floor = w <= 480 ? 44 : 32;
    r.small = targets.filter((t) => Math.min(t.w, t.h) < floor).map((t) => `${t.name} ${t.w}x${t.h}`);
    // The road's "ahead" copy renders at 0.7 x 0.18 opacity (R13: the faint,
    // fading road the highlight has not reached); every other text is at
    // 0.7 or more.  It is counted on its own line, not scored as reading text.
    const pairs = await page.evaluate(PAIRS, "body");
    const litOnly = pairs.filter((p) => p.opacity >= 0.2);
    const aheadPairs = pairs.length - litOnly.length;
    const aa = (p) => (p.size >= 24 || (p.size >= 18.66 && +p.weight >= 700) ? 3 : 4.5);
    r.lowContrast = litOnly.filter((p) => p.ratio < aa(p)).map((p) => `${p.sel} "${p.text}" ${p.fg}/${p.bg} ${p.ratio}`);
    r.pairSet = [...new Map(litOnly.map((p) => [`${p.fg} on ${p.bg}`, { fg: p.fg, bg: p.bg, ratio: p.ratio }])).values()].sort((a, b) => a.ratio - b.ratio);
    r.aheadCopy = { texts: aheadPairs };
    r.axe = (await runAxe(page, OUT, `home-${w}`)).map((v) => `${v.id} (${v.nodes.length})`);
    await page.evaluate(() => window.scrollTo(0, 0));
    await settle(page, 800);
    await shot(page, OUT, `home-${w}-first-screen`);
    r.errors = errors;
    await ctx.close();

    // ── `/`, reduced motion (R13 static, A3-Q3 marker) ─────────────────
    const rctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: "reduce" });
    const rpage = await rctx.newPage();
    await rpage.goto(BASE + "/", { waitUntil: "networkidle" });
    await rpage.waitForSelector(".cs-close");
    await settle(rpage, 1500);
    r.reduced = { top: await rpage.evaluate(ROAD) };
    await rpage.evaluate(() => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * 0.5));
    await rpage.waitForTimeout(100);
    r.reduced.mid = await rpage.evaluate(ROAD);
    r.reduced.fanTransition = await rpage.evaluate(() => getComputedStyle(document.querySelector(".cs-s3")).transitionDuration);
    await shot(rpage, OUT, `home-${w}-full`, true);
    await rctx.close();

    // ── /404 ──────────────────────────────────────────────────────────
    const nctx = await browser.newContext({ viewport: { width: w, height: h } });
    const npage = await nctx.newPage();
    const resp = await npage.goto(BASE + "/404", { waitUntil: "networkidle" });
    await npage.waitForSelector(".cs-nf-art");
    r.nf = await npage.evaluate(() => ({
      h1: document.querySelector("h1")?.textContent,
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth,
      home: document.querySelector(".cs-nf-foot .pri")?.getAttribute("href"),
      svgText: [...new Set([...document.querySelectorAll(".cs-nf-art text")].map((t) => getComputedStyle(t).fontSize))],
    }));
    r.nf.status = resp.status();
    const ntargets = await npage.evaluate(TARGETS, "body");
    r.nf.small = ntargets.filter((t) => Math.min(t.w, t.h) < floor).map((t) => `${t.name} ${t.w}x${t.h}`);
    const npairs = await npage.evaluate(PAIRS, "body");
    r.nf.lowContrast = npairs.filter((p) => p.ratio < aa(p)).map((p) => `${p.sel} "${p.text}" ${p.fg}/${p.bg} ${p.ratio}`);
    r.nf.lowest = npairs.map((p) => p.ratio).sort((a, b) => a - b)[0];
    r.nf.axe = (await runAxe(npage, OUT, `404-${w}`)).map((v) => `${v.id} (${v.nodes.length})`);
    await shot(npage, OUT, `404-${w}`, true);
    const unk = await npage.request.get(BASE + "/no-such-page", { maxRedirects: 0 });
    r.nf.unknown = `${unk.status()} -> ${unk.headers()["location"]}`;
    await nctx.close();

    result.widths[w] = r;
    const st = r.steps.map((s) => `${s.reveal}/${s.h}${s.marker ? " " + s.marker.replace("MILEPOST", "MP ") : ""}`).join(" · ");
    log(`\n== ${w}x${h} ==`);
    log(`/: scroll ${r.scroll.scrollWidth}/${r.scroll.innerWidth} ${r.scroll.scrollWidth > r.scroll.innerWidth ? "SIDEWAYS SCROLL" : "ok"} · road shown ${r.top.shown} · page errors ${r.errors.length}`);
    log(`R13 at top: reveal ${r.top.reveal} of ${r.top.h}, marker ${r.top.marker} · 01 header at ${r.top.head01}, 01 milepost at ${r.top.post01}`);
    log(`R13/R14 scroll steps (reveal/h marker): ${st}`);
    log(`R13 ease: one frame after a jump to the bottom reveal=${r.midEase.reveal}; settled reveal=${r.end.reveal} of ${r.end.h} at scrollY ${r.end.scrollY}/${r.end.max}; fade y1 ${r.end.fadeY1}`);
    log(`P1 moved while scrolling: ${r.movedWhileScrolling.length ? r.movedWhileScrolling.join(", ") : "none"} · while fanning: ${r.movedWhileFanning.length ? r.movedWhileFanning.join(", ") : "none"}`);
    log(`R15 fan on hover: ${JSON.stringify(r.fan)}`);
    log(`svg text sizes: ${r.svgText.join(", ")}`);
    log(`targets under ${floor}px: ${r.small.length ? r.small.join("; ") : "none"}`);
    log(`contrast lowest pairs: ${r.pairSet.slice(0, 5).map((p) => `${p.fg}/${p.bg} ${p.ratio}`).join(" · ")} · below AA: ${r.lowContrast.length ? r.lowContrast.join("; ") : "none"}`);
    log(`road "ahead" copy (R13's faint, fading road, excluded above): ${r.aheadCopy.texts} texts`);
    log(`axe /: ${r.axe.length ? r.axe.join(", ") : "0 violations"}`);
    log(`reduce: top reveal ${r.reduced.top.reveal}/${r.reduced.top.h} fade y1 ${r.reduced.top.fadeY1} marker ${r.reduced.top.marker} · mid reveal ${r.reduced.mid.reveal} marker ${r.reduced.mid.marker} · fan transition ${r.reduced.fanTransition}`);
    log(`/404: ${r.nf.status} "${r.nf.h1}" home ${r.nf.home} · scroll ${r.nf.scrollWidth}/${r.nf.innerWidth} · svg text ${r.nf.svgText.join(",")} · targets under ${floor}: ${r.nf.small.length ? r.nf.small.join("; ") : "none"} · lowest contrast ${r.nf.lowest} · below AA: ${r.nf.lowContrast.length ? r.nf.lowContrast.join("; ") : "none"} · axe ${r.nf.axe.length ? r.nf.axe.join(", ") : "0 violations"}`);
    log(`unknown path (anonymous): ${r.nf.unknown}`);
  }
  fs.writeFileSync(path.join(OUT, "measure.json"), JSON.stringify(result, null, 1));
  await browser.close();
})();
