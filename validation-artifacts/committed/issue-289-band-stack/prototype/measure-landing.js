// s2-arc34 · #289 Phase 2 · checkpoint probe for question (f).
//
// Measures, at 1440x1000 and 380x800, on band-stack.html (the spec's own
// numbers — see that file's header):
//
//   1. the DISPLACEMENT every band transition produces: how far the top of
//      the next thing in the column moves between the two states, which is
//      what ruling 184 accepts as user-initiated and what the landing has to
//      absorb;
//   2. the LANDING RESIDUAL: after scrollIntoView with the band stack's own
//      scroll-margin-top (--nav-h + 8, globals.css:1454), how far the target
//      sits from its computed spot.  Ruling 184 wants a computed spot per
//      transition; arc-28's tolerance is 1 px.
//   3. the open-band and fact-line heights each state produces, because the
//      displacement is the difference between them and a reader should not
//      have to subtract to check the arithmetic.
//
// Not a product test.  No product code is loaded, so there is no sha gate:
// the subject is a local file, and saying "gated" about it would be the
// thing this arc keeps catching.  Output is written beside this file.
//
// Run:  node measure-landing.js

const fs = require("fs");
const path = require("path");
const ROOT = "C:/Users/rtmak/Documents/traffic-control-tool";
const { chromium } = require(ROOT + "/node_modules/playwright");

const PAGE = "file:///" + path.resolve(__dirname, "band-stack.html").replace(/\\/g, "/");
const OUT = __dirname;

// The transitions ruling 184 names, in the order a session walks them.
// `target` is what the landing aims at after the transition — the thing the
// user is now being asked to answer.
const TRANSITIONS = [
  { from: "s1", to: "s2", target: ".a-open", note: "WHERE grows: aerial + ledger + chips replace field + hint" },
  { from: "s2", to: "s3", target: ".a-open", note: "WHERE collapses to a fact line; WHAT opens" },
  { from: "s3", to: "s4", target: ".ph", note: "both setup bands collapse and lock; the placeholder mounts" },
  { from: "s4", to: "s5", target: ".results", note: "the settle: the results stack forms" },
  { from: "s5", to: "s7", target: ".a-open.rev", note: "CHANGE ONE THING re-opens one band in place" },
  { from: "s7", to: "s5", target: ".a-fact", note: "DISCARD/APPLY re-collapses the band" },
];

// What we sample in every state: the top of every column child, in document
// coords, plus the heights the transition arithmetic needs.
const SAMPLE = () => {
  const r = (el) => {
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return {
      top: Math.round(b.top + scrollY),
      bottom: Math.round(b.bottom + scrollY),
      h: Math.round(b.height),
    };
  };
  const q = (s) => r(document.querySelector(s));
  return {
    docH: document.documentElement.scrollHeight,
    vd: q("#vd"),
    stack: q("#stack"),
    band: q(".a-open"),
    firstFact: q(".a-fact"),
    lastStackChild: r(document.getElementById("stack").lastElementChild),
    draft: q(".draft"),
    results: q(".results"),
    placeholder: q(".ph"),
    factHeights: Array.from(document.querySelectorAll(".a-fact")).map(
      (e) => Math.round(e.getBoundingClientRect().height),
    ),
    questionPx: (() => {
      const e = document.querySelector(".tr-question");
      return e ? getComputedStyle(e).fontSize : null;
    })(),
  };
};

(async () => {
  const browser = await chromium.launch();
  const rows = [];
  const log = (s) => {
    console.log(s);
    fs.appendFileSync(path.join(OUT, "landing.txt"), s + "\n");
  };
  try {
    fs.writeFileSync(path.join(OUT, "landing.txt"), "");
    for (const vp of [
      { name: "1440", width: 1440, height: 1000 },
      { name: "380", width: 380, height: 800 },
    ]) {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();
      const errs = [];
      page.on("pageerror", (e) => errs.push(String(e)));
      await page.goto(PAGE);

      log(`\n=== ${vp.name} (${vp.width}x${vp.height}) ===`);

      // Per-state geometry first, so the transition numbers can be checked.
      for (const st of ["s1", "s2", "s3", "s4", "s5", "s7"]) {
        await page.evaluate((s) => window.setState(s), st);
        await page.evaluate(() => window.scrollTo(0, 0));
        const g = await page.evaluate(SAMPLE);
        log(
          `state ${st}  docH ${g.docH}  band.h ${g.band ? g.band.h : "-"}  ` +
            `facts ${JSON.stringify(g.factHeights)}  question ${g.questionPx}`,
        );
        rows.push({ vp: vp.name, kind: "state", state: st, g });
      }

      // Transitions: sample before, switch, sample after, then land.
      for (const t of TRANSITIONS) {
        await page.evaluate((s) => window.setState(s), t.from);
        await page.evaluate(() => window.scrollTo(0, 0));
        const before = await page.evaluate(SAMPLE);
        await page.evaluate((s) => window.setState(s), t.to);
        const after = await page.evaluate(SAMPLE);

        // The displacement ruling 184 accepts: how far the bottom of the band
        // stack (and therefore everything under it) moved.
        const stackShift =
          after.lastStackChild && before.lastStackChild
            ? after.lastStackChild.bottom - before.lastStackChild.bottom
            : null;
        const draftShift =
          after.draft && before.draft ? after.draft.top - before.draft.top : null;

        const residual = await page.evaluate((sel) => window.landOn(sel), t.target);
        const scrollY = await page.evaluate(() => Math.round(window.scrollY));

        log(
          `${t.from} -> ${t.to}  stackShift ${stackShift}px  draftShift ${draftShift}px  ` +
            `land(${t.target}) residual ${residual}px  scrollY ${scrollY}  — ${t.note}`,
        );
        rows.push({
          vp: vp.name,
          kind: "transition",
          from: t.from,
          to: t.to,
          target: t.target,
          stackShift,
          draftShift,
          residual,
          scrollY,
          note: t.note,
        });
      }

      // Screenshots of the two states the checkpoint quotes numbers from.
      for (const st of ["s3", "s7"]) {
        await page.evaluate((s) => window.setState(s), st);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
          path: path.join(OUT, `proto-${st}-${vp.name}.png`),
          fullPage: true,
        });
      }

      log(`pageerrors: ${errs.length}${errs.length ? " — " + errs.join(" | ") : ""}`);
      rows.push({ vp: vp.name, kind: "pageerrors", count: errs.length, errs });
      await ctx.close();
    }
  } finally {
    await browser.close();
    fs.writeFileSync(path.join(OUT, "landing.json"), JSON.stringify(rows, null, 1));
  }
})();
