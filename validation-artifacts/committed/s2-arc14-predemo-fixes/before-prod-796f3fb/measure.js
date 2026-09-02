/* s2-arc14 INVESTIGATION measurements — READ-ONLY against prod.  No saves.
 * Measures: rail rows per kind × viewport (#233), rail-link scroll landing +
 * scrollY sampling (#231), frame overlap probes (#232), Generate landing (#231).
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const OUT = __dirname;
const SITE = "https://www.conestruct.com/sandbox";
const VIEWPORTS = [
  [1280, 720],
  [1440, 900],
  [1920, 1080],
  [1366, 650],
];
const KINDS = ["Shoulder work", "Flagger lane closure", "Lane closure near intersection"];
const lines = [];
function log(m) {
  lines.push(m);
  console.log(m);
}

async function railGeom(page) {
  return page.evaluate(() => {
    const r = (el) => {
      const b = el.getBoundingClientRect();
      return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
    };
    const rail = document.querySelector(".progress-rail");
    if (!rail) return null;
    const entries = Array.from(rail.querySelectorAll(".rail-entry")).map((e) => ({
      text: (e.textContent || "").replace(/\s+/g, " ").trim(),
      rect: r(e),
      spans: Array.from(e.children).map((c) => ({ cls: c.className, text: c.textContent, rect: r(c) })),
    }));
    const rows = new Set(entries.map((e) => e.rect.y));
    return { rail: r(rail), rows: rows.size, entries };
  });
}

async function frameProbe(page, label) {
  const g = await page.evaluate(() => {
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const f = document.querySelector(".workbench-frame");
    const fr = f ? f.getBoundingClientRect() : null;
    const nav = document.querySelector("nav.sticky");
    const navR = nav ? nav.getBoundingClientRect() : null;
    const rail = document.querySelector(".progress-rail");
    const railR = rail ? rail.getBoundingClientRect() : null;
    // what text sits under the bottom rule and the top rule?
    const under = (y) => {
      const hits = new Set();
      for (let x = 40; x < vw - 40; x += 60) {
        const els = document.elementsFromPoint(x, y).filter((e) => !e.closest(".workbench-frame"));
        const el = els[0];
        if (el && el.textContent && el.textContent.trim() && el.children.length === 0)
          hits.add(el.tagName + ":" + el.textContent.trim().slice(0, 30));
      }
      return Array.from(hits);
    };
    const bottomY = fr ? Math.round(fr.bottom) - 1 : vh - 9;
    const topY = fr ? Math.round(fr.top) : 8;
    return {
      vw, vh, scrollY: window.scrollY,
      frame: fr && { top: fr.top, bottom: fr.bottom, left: fr.left, right: fr.right },
      nav: navR && { top: navR.top, bottom: navR.bottom, z: getComputedStyle(nav).zIndex },
      rail: railR && { top: railR.top, bottom: railR.bottom, z: getComputedStyle(rail).zIndex },
      frameZ: f && getComputedStyle(f).zIndex,
      underBottomRule: under(bottomY),
      underTopRule: under(topY),
    };
  });
  log(`FRAME ${label}: ${JSON.stringify(g)}`);
  return g;
}

async function sampleScroll(page, ms = 900) {
  return page.evaluate(
    (ms) =>
      new Promise((res) => {
        const s = [];
        const t0 = performance.now();
        const tick = () => {
          s.push([Math.round(performance.now() - t0), Math.round(window.scrollY)]);
          if (performance.now() - t0 < ms) requestAnimationFrame(tick);
          else res(s);
        };
        tick();
      }),
    ms,
  );
}

(async () => {
  const browser = await chromium.launch();
  log(`run start ${new Date().toISOString()} site ${SITE}`);
  try {
    for (const [w, h] of VIEWPORTS) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      await page.goto(SITE, { waitUntil: "networkidle" });
      await page.waitForTimeout(800);
      for (const k of KINDS) {
        await page.getByText(k, { exact: false }).first().click();
        await page.waitForTimeout(500);
        const g = await railGeom(page);
        const tag = `${w}x${h}-${k.split(" ")[0].toLowerCase()}`;
        if (!g) { log(`RAIL ${tag}: no rail`); continue; }
        const multi = g.entries.filter((e) => e.spans.some((s) => s.rect.y !== e.spans[0].rect.y || s.rect.h > 16));
        log(`RAIL ${tag}: rail ${JSON.stringify(g.rail)} rows=${g.rows} entries=${g.entries.length} widths=${g.entries.map((e) => e.rect.w).join(",")} tops=${g.entries.map((e) => e.rect.y).join(",")} texts=${JSON.stringify(g.entries.map((e) => e.text))}`);
        if (multi.length) log(`RAIL ${tag}: entries with sublines on >1 line: ${JSON.stringify(multi.map((e) => ({ text: e.text, spans: e.spans.map((s) => [s.cls, s.rect.y, s.rect.h]) })))}`);
        const rr = g.rail;
        await page.screenshot({ path: path.join(OUT, `rail-${tag}.png`), clip: { x: Math.max(0, rr.x - 4), y: Math.max(0, rr.y - 4), width: Math.min(w, rr.w + 8), height: rr.h + 8 } });
      }
      // frame probes at top and mid-scroll (shoulder selected last? re-select shoulder)
      await page.getByText("Shoulder work", { exact: false }).first().click();
      await page.waitForTimeout(300);
      await frameProbe(page, `${w}x${h} top`);
      await page.screenshot({ path: path.join(OUT, `frame-${w}x${h}-top.png`) });
      await page.evaluate(() => window.scrollTo(0, 420));
      await page.waitForTimeout(400);
      await frameProbe(page, `${w}x${h} scrolled420`);
      await page.screenshot({ path: path.join(OUT, `frame-${w}x${h}-scrolled.png`) });
      // #231 rail jump: click "Work" entry
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(200);
      const [samples] = await Promise.all([
        sampleScroll(page, 900),
        page.locator(".progress-rail .rail-entry", { hasText: /Work/ }).first().click(),
      ]);
      const land = await page.evaluate(() => {
        const el = document.getElementById("rail-step-work");
        const nav = document.querySelector("nav.sticky");
        const rail = document.querySelector(".progress-rail");
        return {
          anchorTop: el && Math.round(el.getBoundingClientRect().top),
          navBottom: nav && Math.round(nav.getBoundingClientRect().bottom),
          railBottom: rail && Math.round(rail.getBoundingClientRect().bottom),
          focused: document.activeElement && document.activeElement.id,
          scrollY: Math.round(window.scrollY),
        };
      });
      log(`JUMP ${w}x${h} rail->Work: ${JSON.stringify(land)} scroll samples (t,ms→y): ${JSON.stringify(samples.filter((_, i) => i % 6 === 0))}`);
      await page.screenshot({ path: path.join(OUT, `jump-work-${w}x${h}.png`) });
      await page.close();
    }

    // Generate landing at 1440x900 — shoulder, manual coords via fill (single change event).
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(SITE, { waitUntil: "networkidle" });
    await page.getByText("Shoulder work", { exact: false }).first().click();
    await page.getByRole("button", { name: "Pick Location on Map" }).click();
    const dlg = page.getByRole("dialog").first();
    await dlg.waitFor();
    const toggle = page.getByText(/enter coordinates manually/i);
    if (await toggle.isVisible().catch(() => false)) await toggle.click();
    await page.getByLabel("Latitude").fill("39.739776");
    await page.getByLabel("Longitude").fill("-104.963483");
    for (let i = 0; i < 40; i++) {
      const t = ((await dlg.textContent().catch(() => "")) || "").replace(/\s+/g, " ");
      if (!/Detecting roads at pin|Classifying road/i.test(t)) break;
      await page.waitForTimeout(1000);
    }
    const colfax = page.locator("button", { hasText: /Colfax/ }).first();
    if (await colfax.isVisible().catch(() => false)) await colfax.click();
    await page.waitForTimeout(800);
    const save = dlg.getByRole("button", { name: "Save & Close" });
    for (let i = 0; i < 20 && (await save.isDisabled().catch(() => true)); i++) await page.waitForTimeout(500);
    log(`GEN: save enabled=${!(await save.isDisabled().catch(() => true))}`);
    await save.click();
    await page.waitForTimeout(1500);
    const gen = page.getByRole("button", { name: /^Generate/ }).first();
    for (let i = 0; i < 30 && (await gen.isDisabled().catch(() => true)); i++) await page.waitForTimeout(500);
    log(`GEN: generate enabled=${!(await gen.isDisabled().catch(() => true))} scrollY before=${await page.evaluate(() => window.scrollY)}`);
    await page.screenshot({ path: path.join(OUT, "gen-before.png") });
    // arm sampler for 6s starting at click
    const sampler = page.evaluate(
      () =>
        new Promise((res) => {
          const s = [];
          const t0 = performance.now();
          let last = null;
          const tick = () => {
            const y = Math.round(window.scrollY);
            if (y !== last) { s.push([Math.round(performance.now() - t0), y]); last = y; }
            if (performance.now() - t0 < 8000) requestAnimationFrame(tick);
            else res(s);
          };
          tick();
        }),
    );
    await gen.click();
    const samples = await sampler;
    await page.waitForFunction(() => Array.from(document.querySelectorAll("button")).some((b) => /Download PDF/.test(b.textContent || "")), null, { timeout: 120000 }).catch(() => log("GEN: Download PDF never appeared"));
    await page.waitForTimeout(500);
    const land = await page.evaluate(() => {
      const zones = Array.from(document.querySelectorAll("section.zone"));
      const res = zones[1];
      const head = res && res.querySelector(".zone-head");
      const title = res && res.querySelector(".zone-title");
      const nav = document.querySelector("nav.sticky");
      return {
        sectionTop: res && Math.round(res.getBoundingClientRect().top),
        headTop: head && Math.round(head.getBoundingClientRect().top),
        titleTop: title && Math.round(title.getBoundingClientRect().top),
        navBottom: nav && Math.round(nav.getBoundingClientRect().bottom),
        scrollY: Math.round(window.scrollY),
        docH: document.documentElement.scrollHeight,
        vh: window.innerHeight,
        focusedIsResults: document.activeElement === res,
      };
    });
    log(`GEN landing: ${JSON.stringify(land)}`);
    log(`GEN scrollY changes (t ms → y): ${JSON.stringify(samples)}`);
    await page.screenshot({ path: path.join(OUT, "gen-after.png") });
    await frameProbe(page, "post-generate 1440x900");
    await page.close();
  } catch (e) {
    log("CRASH: " + (e && e.stack ? e.stack : e));
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, "measure.log"), lines.join("\n") + "\n");
})();
