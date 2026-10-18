// Landing v2's light-lane browser run (handoff.md § Light lane, step 5):
// one run on the final commit, at 1440 and 390.  The coming-soon run's
// checks (status, sideways scroll, axe, target floors, contrast pairs, page
// errors) plus what this page's prompt asks to see:
//   - the hero, full viewport;
//   - the form with a "Kind of work" tile and an "Hours" segment chosen;
//   - the hero with the intersection row focused from the keyboard, and the
//     drawing's class it sets;
//   - the whole page;
//   - under reduced motion, the count of running animations (want 0).
//
//   AUDIT_OUT=<dir> node measure.cjs <base>
const lib = require("../../../../scripts/audit-lib.js");
const { chromium, fs, path, PAIRS, TARGETS, runAxe } = lib;

const [BASE = "http://localhost:3100"] = process.argv.slice(2);
const OUT = process.env.AUDIT_OUT;
if (!OUT) throw new Error("AUDIT_OUT is required");
fs.mkdirSync(OUT, { recursive: true });
const log = (s) => {
  console.log(s);
  fs.appendFileSync(path.join(OUT, "log.txt"), s + "\n");
};
const shot = async (page, el, name, w) => {
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const box = await el.boundingBox();
  await page.screenshot({
    path: path.join(OUT, `${name}-${w}.png`),
    clip: { x: Math.max(0, box.x - 8), y: Math.max(0, box.y - 8), width: Math.min(box.width + 16, w), height: box.height + 16 },
  });
};

(async () => {
  const browser = await chromium.launch();
  log(`light check · ${BASE}/ · ${new Date().toISOString()}`);
  for (const [w, h] of [
    [1440, 900],
    [390, 844],
  ]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: "no-preference" });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
    const resp = await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT, `hero-${w}.png`) });

    const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
    const floor = w <= 480 ? 44 : 32;
    const small = (await page.evaluate(TARGETS, "body")).filter((t) => Math.min(t.w, t.h) < floor);
    const pairs = await page.evaluate(PAIRS, "body");
    const aa = (p) => (p.size >= 24 || (p.size >= 18.66 && +p.weight >= 700) ? 3 : 4.5);
    const low = pairs.filter((p) => p.ratio < aa(p));
    const lowest = pairs.map((p) => p.ratio).sort((a, b) => a - b)[0];
    const axe = await runAxe(page, OUT, `${w}`);
    const shown = await page.evaluate(() =>
      [...document.querySelectorAll("svg.plan")].map((s) => getComputedStyle(s.parentElement).display).join("/"),
    );
    log(
      `${w}: status ${resp.status()} · scroll ${m.sw}/${m.iw} ${m.sw > m.iw ? "SIDEWAYS" : "ok"} · axe ${axe.length ? axe.map((v) => `${v.id}(${v.nodes.length})`).join(",") : "0"} · targets under ${floor}: ${small.length ? small.map((t) => `${t.name} ${t.w}x${t.h}`).join("; ") : "none"} · contrast lowest ${lowest}, below AA: ${low.length ? low.map((p) => `"${p.text}" ${p.ratio}`).join("; ") : "none"} · page errors ${errors.length ? errors.join(" | ") : "none"} · hero wide/narrow display ${shown}`,
    );

    // The intersection row, focused from the keyboard (focus-visible).
    let tabs = 0;
    for (; tabs < 30; tabs++) {
      await page.keyboard.press("Tab");
      const t = await page.evaluate(() => document.activeElement?.textContent ?? "");
      if (t.includes("Adjacent at-grade intersection")) break;
    }
    await page.waitForTimeout(700);
    const focus = await page.evaluate(() => ({
      cls: [...document.querySelectorAll("svg.plan")].map((s) => s.getAttribute("class")).join(" | "),
      ring: getComputedStyle(document.activeElement).outlineStyle + " " + getComputedStyle(document.activeElement).outlineColor,
    }));
    log(`${w}: intersection row focused after ${tabs + 1} Tab · drawing class "${focus.cls}" · outline ${focus.ring}`);
    await shot(page, await page.$("section.lv-hero"), "hero-intersection-focused", w);
    await page.evaluate(() => document.activeElement.blur());
    const cleared = await page.evaluate(() => [...document.querySelectorAll("svg.plan")].map((s) => s.getAttribute("class")).join(" | "));
    log(`${w}: after blur, drawing class "${cleared}"`);

    // The form with a tile and Hours chosen.
    await page.click("label.lv-opt:has-text('Shoulder work')");
    await page.click("label.lv-seg:has-text('Daytime')");
    const chosen = await page.evaluate(() =>
      [...document.querySelectorAll("form input[type=radio]:checked")].map((i) => i.value).join(", "),
    );
    log(`${w}: checked radios: ${chosen}`);
    await shot(page, await page.$("form.lv-form"), "form-chosen", w);

    await page.screenshot({ path: path.join(OUT, `page-full-${w}.png`), fullPage: true });
    await ctx.close();

    // Reduced motion: nothing runs.
    const rctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: "reduce" });
    const rpage = await rctx.newPage();
    await rpage.goto(BASE + "/", { waitUntil: "networkidle" });
    await rpage.waitForTimeout(800);
    const running = await rpage.evaluate(() => document.getAnimations().length);
    const noPref = await (async () => {
      const c = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: "no-preference" });
      const p = await c.newPage();
      await p.goto(BASE + "/", { waitUntil: "networkidle" });
      await p.waitForTimeout(800);
      const n = await p.evaluate(() => document.getAnimations().length);
      await c.close();
      return n;
    })();
    log(`${w}: running animations · reduced motion ${running} · no preference ${noPref}`);
    await rctx.close();
  }
  await browser.close();
})();
