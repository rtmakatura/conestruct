// The 3D hero's browser run (light lane): `/` on the dev server at 1440,
// 1280 and 390.  Per width: status, sideways scroll, axe on the page,
// target floors and HTML contrast pairs in the hero, page errors, which
// hero drawing is visible, its role and aria-label.
//   - 1440 and 1280: the scene at rest, then each card button hovered and
//     each scene part pointed at (arrow board, a buffer cone, a sign, the
//     intersection pin, a barricade).  For each: the scene's class and the
//     card buttons showing data-on="1".  Screenshots of the hero at 1440
//     (every state) and 1280 (rest, one card state, one scene state).
//   - SVG labels: each label fill against the scene's lightest surface
//     (--iso-walk-top, #25384d), the worst case for the labels on it.
//   - 390: the phone drawing's markup against main's HERO_NARROW (the
//     ruling: unchanged), compared after the browser parses both.
//   - The inline scene's bytes (the page-weight line).
//
//   AUDIT_OUT=<dir> node measure.cjs <base> <main-sha>
const { execFileSync } = require("node:child_process");
const { chromium, fs, path, PAIRS, TARGETS, runAxe } = require("../../../scripts/audit-lib.js");

const [BASE = "http://localhost:3149", MAIN = "origin/main"] = process.argv.slice(2);
const OUT = process.env.AUDIT_OUT;
if (!OUT) throw new Error("AUDIT_OUT is required");
fs.mkdirSync(OUT, { recursive: true });
const log = (s) => {
  console.log(s);
  fs.appendFileSync(path.join(OUT, "log.txt"), s + "\n");
};
const aa = (p) => (p.size >= 24 || (p.size >= 18.66 && +p.weight >= 700) ? 3 : 4.5);

// main's phone drawing, from main's plan-art.ts
const artAt = (rev) => {
  const src = execFileSync("git", ["show", `${rev}:conestruct/site/components/landing/plan-art.ts`], { encoding: "utf-8" })
    .replace(/\r/g, "")
    .replace(/export interface[\s\S]*?\n\}\n/, "")
    .replace(/export const (\w+): PlanArt =/g, "exports.$1 =");
  const e = {};
  new Function("exports", src)(e);
  return e;
};
const MAIN_NARROW = artAt(MAIN).HERO_NARROW;
const HEAD_ISO = artAt("HEAD").HERO_ISO;

const CARD = [
  ["int", "Adjacent at-grade intersection"],
  ["walk", "Pedestrian sidewalks"],
  ["dev", "43"],
  ["taper", "50 ft"],
  ["buffer", "200 ft"],
];
// a painted child of each scene part, pointed at its centre
const PARTS = [
  ["arrow-board", "svg.hero-iso g.ab circle"],
  ["buffer-cone", 'svg.hero-iso g.cn.k-buffer path[fill^="url(#cg"]'],
  ["sign", "svg.hero-iso g.sg polygon:nth-of-type(2)"],
  ["intersection-pin", "svg.hero-iso g.fl.k-int rect"],
  ["barricade", 'svg.hero-iso g.k-walk:not(.walk):not(.fl) polygon[fill="var(--iso-rail)"]'],
];

const state = (page) =>
  page.evaluate(() => ({
    cls: document.querySelector("svg.hero-iso").getAttribute("class"),
    on: [...document.querySelectorAll('aside button[data-on="1"]')].map((b) =>
      b.textContent.replace(/\s+/g, " ").trim().slice(0, 32),
    ),
  }));

(async () => {
  const browser = await chromium.launch();
  log(`3D hero check · ${BASE}/ · main ${MAIN} · ${new Date().toISOString()}`);
  log(`inline scene: HERO_ISO inner ${Buffer.byteLength(HEAD_ISO.inner)} bytes (the hero-plan.svg drawing it replaces is gone from the page)`);
  for (const [w, h] of [
    [1440, 900],
    [1280, 800],
    [390, 844],
  ]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
    const resp = await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const facts = await page.evaluate(() => {
      const vis = [...document.querySelectorAll(".lv-hero-fig svg")].filter((e) => e.getBoundingClientRect().width > 0);
      const svg = vis[0];
      const r = svg.getBoundingClientRect();
      return {
        visible: vis.map((e) => e.getAttribute("class")).join(" | "),
        role: svg.getAttribute("role"),
        label: (svg.getAttribute("aria-label") || "").slice(0, 48),
        size: `${Math.round(r.width)}x${Math.round(r.height)}`,
        caption: [...document.querySelectorAll(".lv-figcap span")]
          .filter((s) => s.getBoundingClientRect().width > 0)
          .map((s) => s.textContent)
          .join(" | "),
        sw: document.documentElement.scrollWidth,
        iw: innerWidth,
      };
    });
    const floor = w <= 480 ? 44 : 32;
    const small = (await page.evaluate(TARGETS, ".lv-hero")).filter((t) => Math.min(t.w, t.h) < floor);
    const pairs = (await page.evaluate(PAIRS, ".lv-hero")).filter((p) => !/^(text|tspan)/.test(p.sel));
    const low = pairs.filter((p) => p.ratio < aa(p));
    const axe = await runAxe(page, OUT, `page-${w}`);
    log(
      `${w}: status ${resp.status()} · scroll ${facts.sw}/${facts.iw} ${facts.sw > facts.iw ? "SIDEWAYS" : "ok"}` +
        ` · visible "${facts.visible}" ${facts.size} · role ${facts.role} · aria-label "${facts.label}…"` +
        ` · caption "${facts.caption}"` +
        ` · axe ${axe.length ? axe.map((v) => `${v.id}(${v.nodes.length})`).join(",") : "0"}` +
        ` · targets under ${floor}: ${small.length ? small.map((t) => `${t.name} ${t.w}x${t.h}`).join("; ") : "none"}` +
        ` · contrast below AA: ${low.length ? low.map((p) => `"${p.text}" ${p.ratio}`).join("; ") : "none"} (${pairs.length} pairs)`,
    );
    const hero = await page.$(".lv-hero");
    // the hero is taller than the viewport: clip it from the full page
    const snap = async (name) => {
      const box = await hero.boundingBox();
      const top = await page.evaluate(() => scrollY);
      await page.screenshot({
        path: path.join(OUT, `${name}.png`),
        fullPage: true,
        clip: { x: 0, y: box.y + top, width: w, height: box.height },
      });
    };

    if (w === 390) {
      const same = await page.evaluate((art) => {
        const live = document.querySelector(".lv-illus-narrow svg");
        const ref = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        ref.innerHTML = art.inner;
        return {
          inner: live.innerHTML === ref.innerHTML,
          viewBox: live.getAttribute("viewBox") === art.viewBox,
          label: live.getAttribute("aria-label") === art.label,
          cls: live.getAttribute("class"),
        };
      }, MAIN_NARROW);
      log(`390: phone drawing vs main's HERO_NARROW · markup ${same.inner} · viewBox ${same.viewBox} · aria-label ${same.label} · class "${same.cls}"`);
      await snap("hero-390");
    } else {
      await hero.scrollIntoViewIfNeeded();
      const labels = await page.evaluate(() => {
        const lum = (c) => {
          const v = c.match(/\d+/g).slice(0, 3).map((n) => n / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
          return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
        };
        const bg = lum("rgb(37,56,77)");
        const seen = new Map();
        for (const t of document.querySelectorAll("svg.hero-iso text, svg.hero-iso tspan")) {
          const fill = getComputedStyle(t).fill;
          // a <text> whose ink is all in its <tspan>s has no fill of its own
        if (!fill.startsWith("rgb") || seen.has(fill) || !t.childNodes[0] || t.childNodes[0].nodeType !== 3) continue;
          const l = lum(fill);
          seen.set(fill, Math.round(((Math.max(l, bg) + 0.05) / (Math.min(l, bg) + 0.05)) * 100) / 100);
        }
        const r = document.querySelector("svg.hero-iso").getBoundingClientRect();
        const px = [...document.querySelectorAll("svg.hero-iso text")].map((t) => (Number(t.getAttribute("font-size")) * r.width) / 1200);
        return { fills: [...seen].map(([f, x]) => `${f} ${x}`).join("; "), minPx: Math.min(...px).toFixed(1) };
      });
      log(`${w}: SVG label fills vs #25384d: ${labels.fills} · smallest label ${labels.minPx} px`);
      if (w === 1440) await snap("rest-1440");
      else await snap("rest-1280");
      for (const [key, text] of CARD) {
        const b = page.locator("aside button", { hasText: text }).first();
        await b.hover();
        await page.waitForTimeout(350);
        const s = await state(page);
        log(`${w}: card "${text}" → scene "${s.cls}" · lit [${s.on.join(", ")}] ${s.cls === `hero-iso f-${key}` && s.on.length === 1 ? "ok" : "MISMATCH"}`);
        if (w === 1440 || key === "taper") await snap(`card-${key}-${w}`);
        await page.mouse.move(2, 2);
        await page.waitForTimeout(300);
      }
      for (const [name, sel] of PARTS) {
        const el = page.locator(sel).first();
        await el.scrollIntoViewIfNeeded();
        const box = await el.boundingBox();
        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;
        await page.mouse.move(x, y);
        await page.waitForTimeout(350);
        const s = await state(page);
        const want = await el.evaluate((e) => e.closest("[data-k]")?.getAttribute("data-k"));
        log(`${w}: scene ${name} (data-k ${want}) → scene "${s.cls}" · lit [${s.on.join(", ")}] ${s.cls === `hero-iso f-${want}` && s.on.length === 1 ? "ok" : "MISMATCH"}`);
        if (w === 1440 || name === "barricade") await snap(`scene-${name}-${w}`);
        await page.mouse.move(2, 2);
        await page.waitForTimeout(300);
        const after = await state(page);
        if (after.cls !== "hero-iso" || after.on.length) log(`${w}: after leaving ${name}: "${after.cls}" [${after.on.join(", ")}] NOT CLEARED`);
      }
    }
    log(`${w}: page errors ${errors.length ? errors.join(" | ") : "none"}`);
    await page.close();
  }
  await browser.close();
})();
