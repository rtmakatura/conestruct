/* s2-arc14 INVESTIGATION run 2 — READ-ONLY against prod.  The real
 * "Generate plan" button (run 1 hit the rail's Generate entry — the
 * demo-prep harness trap), rail rows per kind AFTER a location is set,
 * and 2x zoomed crops of the top band and the bottom rule. */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const OUT = __dirname;
const SITE = "https://www.conestruct.com/sandbox";
const lines = [];
function log(m) { lines.push(m); console.log(m); }

async function railGeom(page) {
  return page.evaluate(() => {
    const r = (el) => { const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
    const rail = document.querySelector(".progress-rail");
    if (!rail) return null;
    const entries = Array.from(rail.querySelectorAll(".rail-entry")).map((e) => ({ text: (e.textContent || "").replace(/\s+/g, " ").trim(), rect: r(e) }));
    const cs = getComputedStyle(rail);
    return { rail: r(rail), pad: cs.paddingLeft + "/" + cs.paddingRight, gap: cs.columnGap, rows: new Set(entries.map((e) => e.rect.y)).size, entries };
  });
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  log(`run2 start ${new Date().toISOString()}`);
  try {
    await page.goto(SITE, { waitUntil: "networkidle" });
    await page.getByText("Shoulder work", { exact: false }).first().click();
    // zoomed top band, pre-pin, rail stuck (scroll 420)
    await page.evaluate(() => window.scrollTo(0, 420));
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, "z-topband-prepin-stuck.png"), clip: { x: 0, y: 0, width: 1440, height: 70 } });
    // bottom rule over text: scan scroll positions until a text element sits under the rule
    for (let y = 0; y < 2400; y += 37) {
      await page.evaluate((y) => window.scrollTo(0, y), y);
      await page.waitForTimeout(60);
      const hit = await page.evaluate(() => {
        const f = document.querySelector(".workbench-frame").getBoundingClientRect();
        const yy = Math.round(f.bottom) - 1;
        for (let x = 60; x < innerWidth - 60; x += 40) {
          const el = document.elementsFromPoint(x, yy).filter((e) => !e.closest(".workbench-frame"))[0];
          if (el && el.children.length === 0 && el.textContent && el.textContent.trim()) return { x, text: el.textContent.trim().slice(0, 40), tag: el.tagName };
        }
        return null;
      });
      if (hit) {
        log(`BOTTOM RULE over text at scrollY ${y}: ${JSON.stringify(hit)}`);
        await page.screenshot({ path: path.join(OUT, "z-bottomrule-strike.png"), clip: { x: 0, y: 900 - 60, width: 1440, height: 60 } });
        await page.screenshot({ path: path.join(OUT, "bottomrule-strike-full.png") });
        break;
      }
    }
    await page.evaluate(() => window.scrollTo(0, 0));

    // set a location (manual fill = whole-value change event)
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
    await save.click();
    await page.waitForTimeout(1500);

    // rail per kind, post-location
    for (const k of ["Shoulder work", "Flagger lane closure", "Lane closure near intersection"]) {
      await page.getByText(k, { exact: false }).first().click();
      await page.waitForTimeout(700);
      const g = await railGeom(page);
      const tag = k.split(" ")[0].toLowerCase();
      log(`RAIL post-location ${tag}: rail ${JSON.stringify(g.rail)} pad=${g.pad} gap=${g.gap} rows=${g.rows} widths=${g.entries.map((e) => e.rect.w).join(",")} sum=${g.entries.reduce((a, e) => a + e.rect.w, 0)} tops=${g.entries.map((e) => e.rect.y).join(",")} texts=${JSON.stringify(g.entries.map((e) => e.text))}`);
      await page.screenshot({ path: path.join(OUT, `z-rail-postloc-${tag}.png`), clip: { x: g.rail.x - 2, y: Math.max(0, g.rail.y - 2), width: g.rail.w + 4, height: g.rail.h + 4 } });
    }
    await page.getByText("Shoulder work", { exact: false }).first().click();
    await page.waitForTimeout(500);

    // the REAL Generate plan button
    const gen = page.getByRole("button", { name: "Generate plan" }).first();
    log(`GEN2: button found=${await gen.count()} disabled=${await gen.isDisabled().catch(() => "n/a")}`);
    await gen.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const before = await page.evaluate(() => ({ scrollY: Math.round(window.scrollY), docH: document.documentElement.scrollHeight }));
    const sampler = page.evaluate(() => new Promise((res) => {
      const s = []; const t0 = performance.now(); let last = null;
      const tick = () => {
        const y = Math.round(window.scrollY); const h = document.documentElement.scrollHeight;
        if (y !== last) { s.push([Math.round(performance.now() - t0), y, h]); last = y; }
        if (performance.now() - t0 < 15000) requestAnimationFrame(tick); else res(s);
      };
      tick();
    }));
    await gen.click();
    const samples = await sampler;
    await page.waitForFunction(() => Array.from(document.querySelectorAll("button")).some((b) => /Download PDF/.test(b.textContent || "")), null, { timeout: 120000 }).catch(() => log("GEN2: Download PDF never appeared"));
    await page.waitForTimeout(800);
    const land = await page.evaluate(() => {
      const res = document.querySelectorAll("section.zone")[1];
      const head = res && res.querySelector(".zone-head");
      const nav = document.querySelector("nav.sticky");
      const rail = document.querySelector(".progress-rail");
      return {
        sectionTop: res && Math.round(res.getBoundingClientRect().top),
        headTop: head && Math.round(head.getBoundingClientRect().top),
        headBottom: head && Math.round(head.getBoundingClientRect().bottom),
        navBottom: nav && Math.round(nav.getBoundingClientRect().bottom),
        railPresent: !!rail,
        scrollY: Math.round(window.scrollY), docH: document.documentElement.scrollHeight, vh: innerHeight,
        focusedIsResults: document.activeElement === res,
        focusedTag: document.activeElement && document.activeElement.tagName + "." + document.activeElement.className,
      };
    });
    log(`GEN2 before: ${JSON.stringify(before)}`);
    log(`GEN2 landing: ${JSON.stringify(land)}`);
    log(`GEN2 scrollY changes (t ms, y, docH): ${JSON.stringify(samples)}`);
    await page.screenshot({ path: path.join(OUT, "gen2-after.png") });
    await page.screenshot({ path: path.join(OUT, "z-gen2-topband.png"), clip: { x: 0, y: 0, width: 1440, height: 120 } });
  } catch (e) {
    log("CRASH: " + (e && e.stack ? e.stack : e));
    await page.screenshot({ path: path.join(OUT, "crash2.png") }).catch(() => {});
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, "measure2.log"), lines.join("\n") + "\n");
})();
