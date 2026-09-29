// R42's frame strip, reduced-motion shot and CLS for section.cs-sheet.
//
//   AUDIT_OUT=<dir> node frames.cjs <base>
//
// Frames are deterministic: after load every animation on the page is
// paused and its clock set to t (0 .. 2.5 s, 250 ms apart), so a frame
// shows exactly the sheet at t, whatever the machine's speed.  CLS is
// the sum of layout-shift entries (without recent input) from navigation
// to 3.5 s after load, with the animation running live.
const lib = require("../../../../scripts/audit-lib.js");
const { chromium, fs, path } = lib;

const BASE = process.argv[2] || "http://localhost:3100";
const OUT = process.env.AUDIT_OUT;
if (!OUT) throw new Error("AUDIT_OUT is required");
fs.mkdirSync(OUT, { recursive: true });
const log = (s) => {
  console.log(s);
  fs.appendFileSync(path.join(OUT, "frames-log.txt"), s + "\n");
};
const STEPS = Array.from({ length: 11 }, (_, i) => i * 250);

(async () => {
  const browser = await chromium.launch();
  log(`R42 frames · ${BASE}/ · ${new Date().toISOString()}`);
  for (const [w, h] of [
    [1440, 900],
    [390, 844],
  ]) {
    // 1. CLS, live.
    {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: "no-preference" });
      await ctx.addInitScript(() => {
        window.__cls = 0;
        new PerformanceObserver((l) => {
          for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
        }).observe({ type: "layout-shift", buffered: true });
      });
      const page = await ctx.newPage();
      await page.goto(BASE + "/", { waitUntil: "load" });
      await page.waitForTimeout(3500);
      const cls = await page.evaluate(() => window.__cls);
      const anims = await page.evaluate(() => document.getAnimations().length);
      log(`${w}: CLS ${cls.toFixed(4)} (live, load + 3.5 s) · ${anims} animations on the page`);
      await ctx.close();
    }
    // 2. The strip, live but slowed.  Pausing animations and setting their
    //    clock moves the HTML stamp but Chromium does not repaint the SVG
    //    marks, so the frames come from the real animation run at a tenth
    //    of its speed (DevTools' Animation.setPlaybackRate).  A frame is
    //    taken when the first road line's own clock (delay 0) reaches t,
    //    and the clock actually read is logged beside it.
    //    The viewport is tall enough to hold the whole sheet: a frame
    //    captured past the fold paints the SVG stale (the DOM's animation
    //    state was checked separately and is on time at 900 px too).
    {
      const ctx = await browser.newContext({ viewport: { width: w, height: 1300 }, reducedMotion: "no-preference" });
      const page = await ctx.newPage();
      const cdp = await ctx.newCDPSession(page);
      await cdp.send("Animation.enable");
      await cdp.send("Animation.setPlaybackRate", { playbackRate: 0.1 });
      await page.goto(BASE + "/", { waitUntil: "commit" });
      await page.waitForSelector("section.cs-sheet");
      const sheet = await page.$("section.cs-sheet");
      // The first road line's clock is read once, as soon as it runs; from
      // then on animation time advances at a tenth of wall time.  (A
      // finished animation's own clock is no guide past its end.)
      let base = null;
      while (base === null) {
        base = await page.evaluate(() => {
          const first = document.getAnimations().find((a) => a.effect && a.effect.target && a.effect.target.matches(".cs-draw"));
          return first && first.currentTime !== null ? first.currentTime : null;
        });
        if (base === null) await page.waitForTimeout(10);
      }
      const wall0 = Date.now();
      const clock = () => base + (Date.now() - wall0) * 0.1;
      const read = [];
      for (const t of STEPS) {
        let now = clock();
        while (now < t) {
          await page.waitForTimeout(10);
          now = clock();
        }
        await sheet.screenshot({ path: path.join(OUT, `frame-${w}-${String(t).padStart(4, "0")}ms.png`) });
        read.push(`${t}->${Math.round(now)}`);
      }
      log(`${w}: ${STEPS.length} frames at a tenth of speed, target->clock read (ms): ${read.join(" ")}`);
      await ctx.close();
    }
    // 3. Reduced motion: the end state, no animation.
    {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: "reduce" });
      const page = await ctx.newPage();
      await page.goto(BASE + "/", { waitUntil: "load" });
      await page.waitForTimeout(800);
      const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").length);
      await (await page.$("section.cs-sheet")).screenshot({ path: path.join(OUT, `reduced-${w}.png`) });
      const stamp = await page.evaluate(() => {
        const s = document.querySelector(".cs-stamp");
        if (!s) return null; // a build without R42's stamp
        const cs = getComputedStyle(s);
        return { opacity: cs.opacity, transform: cs.transform, color: cs.color };
      });
      log(`${w}: reduced motion · running animations ${running} · stamp ${JSON.stringify(stamp)}`);
      await ctx.close();
    }
  }
  await browser.close();
})();
