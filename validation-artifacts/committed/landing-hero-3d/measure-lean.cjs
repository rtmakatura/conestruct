// The lean page's browser run (light lane, cc-prompt-lean-page.md §6): `/`
// on the dev server.
//   - 1440: full page once every section has played (height, visible words,
//     screenshot), axe, target floors, contrast pairs over the whole page,
//     page errors, sideways scroll.
//   - Motion: "How it works" frozen at 0.3, 0.9, 1.5, 2.2, 3.1 and 4.3 s
//     after it gets `go` (the Web Animations clock, so the frames are exact,
//     not screenshot-timed); each section plays once (scroll away and back:
//     no new animation, `go` added once); a section on screen at load plays
//     at once; reduced motion shows the finished state with no `go`; with
//     JS off everything is visible.
//   - Links: each nav and in-page link lands its target at the top (or in
//     view for #join).
//   - 390: no sideways scroll, grids one column, form fields stacked, axe,
//     44 px floors, the phone hero's markup unchanged.
//
//   AUDIT_OUT=<dir> node measure-lean.cjs <base>
const { chromium, fs, path, PAIRS, TARGETS, runAxe } = require("../../../scripts/audit-lib.js");

const [BASE = "http://localhost:3149"] = process.argv.slice(2);
const OUT = process.env.AUDIT_OUT;
if (!OUT) throw new Error("AUDIT_OUT is required");
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "log.txt"), "");
const log = (s) => {
  console.log(s);
  fs.appendFileSync(path.join(OUT, "log.txt"), s + "\n");
};
const aa = (p) => (p.size >= 24 || (p.size >= 18.66 && +p.weight >= 700) ? 3 : 4.5);

async function open(browser, opts, w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, ...opts });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const res = await page.goto(BASE + "/", { waitUntil: "networkidle" });
  return { ctx, page, errors, status: res.status() };
}

// scroll the whole page a screen at a time so every section gets its `go`
async function scrollThrough(page) {
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y <= h; y += 300) {
    await page.evaluate((y) => window.scrollTo(0, y), y);
    await page.waitForTimeout(60);
  }
}

const visible = () =>
  [...document.querySelectorAll(".an .rv, .an [class^='a-'], .an [class*=' a-']")].filter(
    (e) => getComputedStyle(e).opacity !== "1",
  ).length;

(async () => {
  const browser = await chromium.launch();

  // ---- 1440: full page, a11y, words ------------------------------------
  {
    const { ctx, page, errors, status } = await open(browser, {}, 1440, 900);
    const atLoad = await page.evaluate(() => [...document.querySelectorAll(".an")].map((s) => s.classList.contains("go")));
    await scrollThrough(page);
    await page.waitForTimeout(5000);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    const m = await page.evaluate(() => {
      const words = (t) => (t.match(/[A-Za-z0-9][^\s]*/g) || []).length;
      const main = document.querySelector(".lv-outer");
      // the hero scene's labels are inside an svg role=img; innerText skips svg text
      return {
        height: document.documentElement.scrollHeight,
        scrollW: document.documentElement.scrollWidth,
        words: words(main.innerText),
        wordsNoHero: words(main.innerText) - words(document.querySelector(".lv-hero").innerText),
        go: [...document.querySelectorAll(".an")].map((s) => s.classList.contains("go")),
        jsAnim: document.querySelector(".lv-outer").classList.contains("js-anim"),
      };
    });
    const hidden = await page.evaluate(visible);
    await page.screenshot({ path: path.join(OUT, "01-lean-full-1440.png"), fullPage: true });
    const axe = await runAxe(page, OUT, "page-1440");
    const pairs = await page.evaluate(PAIRS, ".lv-outer");
    const low = pairs.filter((p) => p.ratio < aa(p));
    const small = (await page.evaluate(TARGETS, ".lv-outer")).filter((t) => t.h < 32 || t.w < 32);
    log(
      `1440: status ${status} · page height ${m.height} px · scroll width ${m.scrollW} · visible words ${m.words} (below the hero ${m.wordsNoHero})` +
        ` · on screen at load (go at once): [${atLoad}] · after the scroll: go [${m.go}] · js-anim ${m.jsAnim} · elements not at opacity 1: ${hidden}` +
        ` · axe ${axe.length}${axe.length ? " " + axe.map((v) => v.id).join(",") : ""}` +
        ` · targets under 32: ${small.length ? small.map((t) => `${t.name} ${t.w}x${t.h}`).join("; ") : "none"}` +
        ` · contrast below AA: ${low.length ? low.map((p) => `"${p.text}" ${p.ratio}`).join("; ") : "none"} (${pairs.length} pairs)` +
        ` · page errors ${errors.length ? errors.join(" | ") : "none"}`,
    );
    // the open form: phone and note shown, for the record
    await page.click('button[aria-controls="c-more"]');
    const more = await page.evaluate(() => ({
      expanded: document.querySelector('button[aria-controls="c-more"]').getAttribute("aria-expanded"),
      phone: !!document.querySelector("#c-phone").offsetParent,
      notes: !!document.querySelector("#c-notes").offsetParent,
    }));
    await page.locator("#send").screenshot({ path: path.join(OUT, "05-send-open-1440.png") });
    log(`1440 form: "+ Add a phone number or a note" → aria-expanded ${more.expanded} · phone shown ${more.phone} · note shown ${more.notes}`);
    await ctx.close();
  }

  // ---- motion: How it works frames, play once ---------------------------
  {
    const { ctx, page } = await open(browser, {}, 1440, 900);
    const how = page.locator("#how");
    await how.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector("#how").classList.contains("go"));
    // freeze every animation in the section and step its clock
    await page.evaluate(() => document.querySelector("#how").getAnimations({ subtree: true }).forEach((a) => a.pause()));
    const n = await page.evaluate(() => document.querySelector("#how").getAnimations({ subtree: true }).length);
    const frames = [];
    for (const t of [0.3, 0.9, 1.5, 2.2, 3.1, 4.3]) {
      await page.evaluate((ms) => document.querySelector("#how").getAnimations({ subtree: true }).forEach((a) => (a.currentTime = ms)), t * 1000);
      await page.waitForTimeout(50);
      const f = `02-how-${t.toFixed(1)}s.png`;
      await how.screenshot({ path: path.join(OUT, f) });
      const shown = await page.evaluate(() =>
        [...document.querySelectorAll("#how .lv-step")].map((s) => +getComputedStyle(s).opacity),
      );
      frames.push(`${t}s cols [${shown.map((o) => o.toFixed(2))}]`);
    }
    log(`motion · How it works: ${n} animations frozen and stepped · ${frames.join(" · ")}`);
    // let it finish, then scroll away and back: no replay
    await page.evaluate(() => document.querySelector("#how").getAnimations({ subtree: true }).forEach((a) => a.finish()));
    const before = await page.evaluate(() => {
      window.__mut = 0;
      new MutationObserver((l) => (window.__mut += l.length)).observe(document.querySelector("#how"), { attributes: true, attributeFilter: ["class"] });
      return document.querySelector("#how").getAnimations({ subtree: true }).map((a) => a.playState);
    });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
    await how.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    const after = await page.evaluate(() => ({
      states: document.querySelector("#how").getAnimations({ subtree: true }).map((a) => a.playState),
      classChanges: window.__mut,
      cls: document.querySelector("#how").className,
    }));
    const running = after.states.filter((s) => s === "running").length;
    log(
      `motion · play once: before ${before.length} animations, all ${[...new Set(before)]} · after scrolling away and back: running ${running}, class changes ${after.classChanges}, class "${after.cls}"`,
    );
    // a section already on screen at load plays at once: load scrolled to #files
    await page.goto(BASE + "/#files", { waitUntil: "networkidle" });
    await page.waitForTimeout(200);
    const files = await page.evaluate(() => ({
      go: document.querySelector("#files").classList.contains("go"),
      top: Math.round(document.querySelector("#files").getBoundingClientRect().top),
    }));
    log(`motion · loaded at /#files (top ${files.top}): #files has go at once ${files.go}`);
    await ctx.close();
  }

  // ---- reduced motion ---------------------------------------------------
  {
    const { ctx, page, errors } = await open(browser, { reducedMotion: "reduce" }, 1440, 900);
    await scrollThrough(page);
    await page.locator("#how").scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => ({
      go: document.querySelectorAll(".go").length,
      jsAnim: document.querySelector(".lv-outer").classList.contains("js-anim"),
      anims: document.getAnimations().filter((a) => a.effect?.target?.closest?.(".an")).length,
    }));
    const hidden = await page.evaluate(visible);
    await page.locator("#how").screenshot({ path: path.join(OUT, "03-how-reduced-motion.png") });
    log(`reduced motion: go ${r.go} · js-anim ${r.jsAnim} · animations in the sections ${r.anims} · elements not at opacity 1: ${hidden} · page errors ${errors.length || "none"}`);
    await ctx.close();
  }

  // ---- JS off -----------------------------------------------------------
  {
    const { ctx, page, status } = await open(browser, { javaScriptEnabled: false }, 1440, 900);
    const hidden = await page.evaluate(visible);
    const go = await page.evaluate(() => document.querySelectorAll(".go").length);
    await page.screenshot({ path: path.join(OUT, "04-no-js-full-1440.png"), fullPage: true });
    log(`JS off: status ${status} · go ${go} · elements not at opacity 1: ${hidden}`);
    await ctx.close();
  }

  // ---- links -----------------------------------------------------------
  {
    const { ctx, page } = await open(browser, {}, 1440, 900);
    const out = [];
    for (const [sel, target] of [
      ['.lv-nav-links a[href="#how"]', "#how"],
      ['.lv-nav-links a[href="#files"]', "#files"],
      [".lv-nav-cta", "#send"],
      ['.lv-hero a[href="#send"]', "#send"],
      ['.lv-hero a[href="#join"]', "#join"],
      ['.lv-wordmark', "#top"],
    ]) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(150);
      await page.click(sel);
      await page.waitForTimeout(900);
      const r = await page.evaluate((t) => {
        const b = document.querySelector(t).getBoundingClientRect();
        return { top: Math.round(b.top), bottom: Math.round(b.bottom), hash: location.hash };
      }, target);
      const ok = target === "#join" ? r.top >= 0 && r.bottom <= 900 : Math.abs(r.top) <= 2;
      out.push(`${sel} → ${target} top ${r.top} ${ok ? "ok" : "MISS"}`);
    }
    const pilot = await page.getAttribute(".lv-aside-links a", "href");
    log(`links: ${out.join(" · ")} · pilot link ${pilot}`);
    await ctx.close();
  }

  // ---- 390 -------------------------------------------------------------
  {
    const { ctx, page, errors, status } = await open(browser, { isMobile: true, hasTouch: true }, 390, 844);
    await scrollThrough(page);
    await page.waitForTimeout(5000);
    await page.click('button[aria-controls="c-more"]');
    const m = await page.evaluate(() => {
      const cols = (sel) => getComputedStyle(document.querySelector(sel)).gridTemplateColumns.split(" ").length;
      const lefts = [...document.querySelectorAll(".lv-form .lv-field, .lv-form fieldset")].map((e) => Math.round(e.getBoundingClientRect().left));
      return {
        scrollW: document.documentElement.scrollWidth,
        cols3: cols(".lv-cols3"),
        cols4: cols(".lv-cols4"),
        compare: cols(".lv-compare"),
        trust: cols(".lv-trust"),
        fieldLefts: [...new Set(lefts)],
        heroClass: document.querySelector("svg.plan")?.getAttribute("class"),
        heroShown: !!document.querySelector(".lv-illus-narrow svg.plan")?.getBoundingClientRect().width,
        height: document.documentElement.scrollHeight,
      };
    });
    const axe = await runAxe(page, OUT, "page-390");
    const pairs = await page.evaluate(PAIRS, ".lv-outer");
    const low = pairs.filter((p) => p.ratio < aa(p));
    const small = (await page.evaluate(TARGETS, ".lv-outer")).filter((t) => t.h < 44 || t.w < 44);
    await page.screenshot({ path: path.join(OUT, "06-lean-full-390.png"), fullPage: true });
    log(
      `390: status ${status} · scroll width ${m.scrollW} · height ${m.height} · columns: steps ${m.cols3}, files ${m.cols4}, send ${m.compare}, trust ${m.trust}` +
        ` · form field left edges ${JSON.stringify(m.fieldLefts)} · phone hero "${m.heroClass}" shown ${m.heroShown}` +
        ` · axe ${axe.length}${axe.length ? " " + axe.map((v) => v.id).join(",") : ""}` +
        ` · targets under 44: ${small.length ? small.map((t) => `${t.name} ${t.w}x${t.h}`).join("; ") : "none"}` +
        ` · contrast below AA: ${low.length ? low.map((p) => `"${p.text}" ${p.ratio}`).join("; ") : "none"} (${pairs.length} pairs)` +
        ` · page errors ${errors.length ? errors.join(" | ") : "none"}`,
    );
    await ctx.close();
  }

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
