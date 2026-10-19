// Hero v2's browser run (light lane, cc-prompt-hero-3d-v2.md §5): `/` on
// the dev server.
//   - 1440, 1280, 1024, 390: status, sideways scroll, axe, target floors and
//     HTML contrast pairs in the hero, page errors, where the card sits.
//   - 1440x900: does the figure (card + scene + caption) fit the viewport,
//     at load and once scrolled to it; does the card cover any device,
//     sign, pin or label of the scene.
//   - Hover sweep at 1440: the pointer walks along the road (world y 20,
//     the shoulder) from 345 ft before the taper to G20-2 in 10 ft steps,
//     then off the svg.  At each step the scene's key must equal the
//     data-k of what is under the pointer (or none); every change is logged.
//     The points come from iso_hero.py's own projection.
//   - Card to scene: from each card button the pointer moves right across
//     the card edge into the scene; the key at each step is logged.
//   - Screenshots: rest at 1440x900 (at load and scrolled to the figure),
//     each key active (02-06), rest at 1280 / 1024 / 390.
//   - 390: the phone drawing's markup against main's HERO_NARROW.
//
//   AUDIT_OUT=<dir> node measure-v2.cjs <base> <main-sha>
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
const ROOT = path.join(__dirname, "..", "..", "..");

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

// sweep points in viewBox units, from the generator's projection
const SWEEP = JSON.parse(
  execFileSync(
    "python",
    [
      "-c",
      "import importlib.util,json,sys;s=importlib.util.spec_from_file_location('i',sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);" +
        "print(json.dumps([[ft]+list(m.P(m.F(ft),20,0)) for ft in range(-345,1431,10) if not (m.BRK0_FT<ft<m.BRK1_FT)]))",
      path.join(ROOT, "design", "landing-v2", "hero-3d", "iso_hero.py"),
    ],
    { encoding: "utf-8" },
  ),
);

const ZONES = [
  ["taper", '.hit[data-k="taper"]'],
  ["buffer", '.hit[data-k="buffer"]'],
  ["dev", '.hit[data-k="dev"]'], // the first one is the work zone
  ["int", '.fl[data-k="int"] rect'],
  ["walk", '.hit[data-k="walk"]'],
];
const REF = { taper: "02", buffer: "03", dev: "04", int: "05", walk: "06" };

const state = (page) =>
  page.evaluate(() => ({
    cls: document.querySelector("svg.hero-iso").getAttribute("class").replace("hero-iso", "").trim() || "none",
    on: [...document.querySelectorAll('aside button[data-on="1"]')].map((b) =>
      b.textContent.replace(/\s+/g, " ").trim().slice(0, 24),
    ),
  }));

async function basics(page, w, errors, resp) {
  const facts = await page.evaluate(() => {
    const vis = [...document.querySelectorAll(".lv-hero-fig svg")].filter((e) => e.getBoundingClientRect().width > 0);
    const svg = vis[0];
    const card = document.querySelector(".lv-needs").getBoundingClientRect();
    const frame = document.querySelector(".lv-frame").getBoundingClientRect();
    return {
      visible: vis.map((e) => e.getAttribute("class")).join(" | "),
      role: svg.getAttribute("role"),
      label: !!svg.getAttribute("aria-label"),
      card:
        card.top >= frame.top && card.bottom <= frame.bottom && card.left >= frame.left
          ? `inside the figure at ${Math.round(card.left - frame.left)},${Math.round(card.top - frame.top)} ${Math.round(card.width)}x${Math.round(card.height)}`
          : `above the drawing ${Math.round(card.width)}x${Math.round(card.height)}`,
      caption: [...document.querySelectorAll(".lv-figcap > span")]
        .filter((s) => s.getBoundingClientRect().width > 0)
        .map((s) => s.innerText.replace(/\s+/g, " ").trim())
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
      ` · visible "${facts.visible}" · role ${facts.role} · aria-label ${facts.label} · card ${facts.card}` +
      ` · caption "${facts.caption}"` +
      ` · axe ${axe.length ? axe.map((v) => `${v.id}(${v.nodes.length})`).join(",") : "0"}` +
      ` · targets under ${floor}: ${small.length ? small.map((t) => `${t.name} ${t.w}x${t.h}`).join("; ") : "none"}` +
      ` · contrast below AA: ${low.length ? low.map((p) => `"${p.text}" ${p.ratio}`).join("; ") : "none"} (${pairs.length} pairs)` +
      ` · page errors ${errors.length ? errors.join(" | ") : "none"}`,
  );
}

(async () => {
  const browser = await chromium.launch();
  log(`hero v2 check · ${BASE}/ · main ${MAIN} · ${new Date().toISOString()}`);
  for (const [w, h] of [
    [1440, 900],
    [1280, 800],
    [1024, 768],
    [390, 844],
  ]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
    const resp = await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await basics(page, w, errors, resp);

    if (w === 390) {
      const same = await page.evaluate((art) => {
        const live = document.querySelector(".lv-illus-narrow svg");
        const ref = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        ref.innerHTML = art.inner;
        return { inner: live.innerHTML === ref.innerHTML, viewBox: live.getAttribute("viewBox") === art.viewBox, label: live.getAttribute("aria-label") === art.label, cls: live.getAttribute("class") };
      }, MAIN_NARROW);
      log(`390: phone drawing vs main's HERO_NARROW · markup ${same.inner} · viewBox ${same.viewBox} · aria-label ${same.label} · class "${same.cls}"`);
      await page.screenshot({ path: path.join(OUT, "hero-390.png"), fullPage: true, clip: { x: 0, y: 0, width: w, height: 1700 } });
      await page.close();
      continue;
    }
    if (w !== 1440) {
      await page.screenshot({ path: path.join(OUT, `rest-${w}.png`) });
      await page.close();
      continue;
    }

    // 1440x900: the fit, and what the card covers
    const fit = await page.evaluate(() => {
      const fig = document.querySelector(".lv-hero-fig").getBoundingClientRect();
      const card = document.querySelector(".lv-needs").getBoundingClientRect();
      const hits = [...document.querySelectorAll("svg.hero-iso .cn, svg.hero-iso .ab, svg.hero-iso .sg, svg.hero-iso .fl, svg.hero-iso text")]
        .map((e) => [e, e.getBoundingClientRect()])
        .filter(([, r]) => r.width > 0 && r.left < card.right && r.right > card.left && r.top < card.bottom && r.bottom > card.top)
        .map(([e]) => (e.tagName === "text" ? `text "${e.textContent}"` : e.getAttribute("class")));
      return { top: Math.round(fig.top + scrollY), bottom: Math.round(fig.bottom + scrollY), height: Math.round(fig.height), vh: innerHeight, covered: hits };
    });
    log(
      `1440x900 fit: figure (card, scene, caption) at page y ${fit.top}-${fit.bottom}, ${fit.height} px tall · ` +
        `at load ${fit.bottom <= fit.vh ? "fully visible" : `bottom edge ${fit.bottom - fit.vh} px below the fold`} · ` +
        `scrolled to it ${fit.height <= fit.vh ? "fits in one screen" : "TALLER THAN THE SCREEN"} · ` +
        `scene parts under the card: ${fit.covered.length ? fit.covered.join(", ") : "none"}`,
    );
    await page.screenshot({ path: path.join(OUT, "01-rest-1440x900-at-load.png") });
    await page.evaluate((y) => scrollTo(0, y), Math.max(0, fit.bottom - fit.vh + 8));
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, "01-rest-1440x900-scrolled.png") });

    // hover sweep along the road
    const pts = await page.evaluate((sweep) => {
      const svg = document.querySelector("svg.hero-iso");
      const m = svg.getScreenCTM();
      return sweep.map(([ft, x, y]) => {
        const p = new DOMPoint(x, y).matrixTransform(m);
        return [ft, p.x, p.y];
      });
    }, SWEEP);
    let prev = null;
    let bad = 0;
    const trail = [];
    for (const [ft, x, y] of pts) {
      await page.mouse.move(x, y, { steps: 2 });
      await page.waitForTimeout(40);
      const want = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest("[data-k]")?.getAttribute("data-k") ?? "none", [x, y]);
      const s = await state(page);
      const got = s.cls.replace("f-", "");
      if (got !== want) {
        bad++;
        log(`sweep ${ft} ft: under the pointer ${want}, scene ${got} MISMATCH`);
      }
      if (got !== prev) trail.push(`${ft} ft ${got}${s.on.length ? ` [${s.on.join(", ")}]` : ""}`);
      prev = got;
    }
    const fig = await page.locator(".lv-hero-fig").boundingBox();
    await page.mouse.move(fig.x + fig.width / 2, fig.y + fig.height + 40, { steps: 4 });
    await page.waitForTimeout(100);
    const off = await state(page);
    log(`sweep 1440 along the road, ${pts.length} steps (10 ft, the cut skipped): ${trail.join(" → ")}`);
    log(`sweep 1440: off the svg → scene ${off.cls} · lit [${off.on.join(", ")}] · steps where the scene disagreed with the pointer: ${bad}`);

    // card rows and numbers across to the scene
    for (const label of ["Adjacent at-grade intersection", "Pedestrian sidewalks", "43", "50 ft", "200 ft"]) {
      const b = await page.locator("aside button", { hasText: label }).first().boundingBox();
      const y = b.y + b.height / 2;
      const seq = [];
      let last = null;
      for (let x = b.x + b.width / 2; x <= b.x + b.width + 160; x += 8) {
        await page.mouse.move(x, y, { steps: 2 });
        await page.waitForTimeout(40);
        const s = await state(page);
        const k = s.cls.replace("f-", "");
        if (k !== last) seq.push(`${Math.round(x - b.x - b.width)}px ${k}`);
        last = k;
      }
      await page.mouse.move(fig.x + fig.width / 2, fig.y + fig.height + 40, { steps: 4 });
      await page.waitForTimeout(80);
      const off2 = await state(page);
      log(`card "${label}" → right across the card edge (px past it): ${seq.join(" → ")} · then off: ${off2.cls}`);
    }

    // each key active, as in ref-v2/02-06
    for (const [key, sel] of ZONES) {
      const el = page.locator(`svg.hero-iso ${sel}`).first();
      const box = await el.boundingBox();
      const pt = await el.evaluate((e, k) => {
        // a point inside the zone that is really its own (the hit hull's centre can sit on a neighbour)
        const r = e.getBoundingClientRect();
        for (let i = 0; i < 400; i++) {
          const x = r.left + r.width * (0.2 + 0.6 * ((i * 37) % 100) / 100);
          const y = r.top + r.height * (0.2 + 0.6 * ((i * 61) % 100) / 100);
          if (document.elementFromPoint(x, y)?.closest("[data-k]")?.getAttribute("data-k") === k) return [x, y];
        }
        return null;
      }, key);
      await page.mouse.move(...(pt ?? [box.x + box.width / 2, box.y + box.height / 2]), { steps: 3 });
      await page.waitForTimeout(350);
      const s = await state(page);
      log(`key ${key} → scene ${s.cls} · lit [${s.on.join(", ")}] ${s.cls === `f-${key}` && s.on.length === 1 ? "ok" : "MISMATCH"}`);
      await page.screenshot({ path: path.join(OUT, `${REF[key]}-${key}.png`) });
    }
    await page.mouse.move(2, 2);
    await page.close();
  }
  await browser.close();
})();
