// #557 walk: the collapsed rows' Change link, the small aerial's zoom, the
// hours link's focus ring, the "Default" links and the week columns' bottom.
// Local dev server of the issue worktree (next dev -p 3557 in
// conestruct/site), read-only, headless: nothing saved, no download, no
// sign-in.  It reuses item 1's helpers (../../issue-555/script/lib.mjs) and
// follows the before set's steps
// (validation-artifacts-extra/spacing-round-before/script/shots-page.mjs:
// untracked, main checkout, not committed).
//   WALK_SITE=http://localhost:3557 WALK_MODE=after node shots-557.mjs [labels]
// WALK_MODE=before (run on the base, c7fc482e, before the diff) writes
// measures-before-<label>.json and puts its crops in the extra folder;
// WALK_MODE=after writes measures-<label>.json and ../crops.
import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { open, pin, confirm, dates, times, lb, settled, small, SITE, W, D, MAIN, oneLine } from "../../issue-555/script/lib.mjs";

const EV = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MODE = process.env.WALK_MODE === "before" ? "before" : "after";
const EXTRA = path.join(MAIN, "validation-artifacts-extra/ux-spacing-round/issue-557");
const CROPS = MODE === "before" ? path.join(EXTRA, "before") : path.join(EV, "crops");
const AXE = createRequire(path.join(MAIN, "conestruct/site/package.json")).resolve("axe-core/axe.min.js");
const ONLY = process.argv[2];
const SIZES = [["1440", 1440, 900], ["1198", 1198, 930], ["390", 390, 844]].filter(([label]) => !ONLY || ONLY.split(",").includes(label));
fs.mkdirSync(CROPS, { recursive: true });
fs.mkdirSync(EXTRA, { recursive: true });
const WHERE = "[data-testid=band-where]";

for (const [label, w, h] of SIZES) {
  const { b, p } = await open(w, h);
  const L = { site: SITE, mode: MODE, viewport: [w, h], errors: [] };
  const file = (name) => path.join(CROPS, `${name}-${label}.png`);
  const around = async (name, sel, pad = 12) => {
    await p.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: "center" }), sel);
    await p.waitForTimeout(500);
    const r = await p.locator(sel).first().boundingBox();
    const x = Math.max(0, r.x - pad);
    const y = Math.max(0, r.y - pad);
    await p.screenshot({ path: file(name), clip: { x, y, width: Math.min(w - x, r.width + 2 * pad), height: Math.min(h - y, r.height + 2 * pad) } });
  };
  // Boxes in page coordinates (scroll added), so readings compare across scrolls.
  const boxes = (sel) => p.evaluate((s) => [...document.querySelectorAll(s)].map((e) => {
    const r = e.getBoundingClientRect();
    const r2 = (n) => Math.round(n * 100) / 100;
    return { testid: e.getAttribute("data-testid"), cls: String(e.className).slice(0, 40), text: (e.getAttribute("aria-label") || e.textContent || "").trim().replace(/\s+/g, " ").slice(0, 50), x: r2(r.left + window.scrollX), y: r2(r.top + window.scrollY), w: r2(r.width), h: r2(r.height) };
  }).filter((x) => x.w > 0 && x.h > 0), sel);
  const axe = async (sel) => {
    if (!(await p.evaluate(() => typeof window.axe !== "undefined"))) await p.addScriptTag({ path: AXE });
    return p.evaluate(async (s) => (await window.axe.run(document.querySelector(s))).violations.map((v) => ({ id: v.id, nodes: v.nodes.length, first: v.nodes[0]?.target?.join(" ") })), sel);
  };
  // The aerial frame: every control and line on it, and each pair that overlaps
  // (whole px; touching edges don't count).
  const aerial = () => p.evaluate(() => {
    const frame = document.querySelector("[data-testid=band-aerial-frame]");
    const root = frame?.closest(".a-aerial") ?? frame?.parentElement;
    if (!frame || !root) return null;
    const shown = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden" && getComputedStyle(e).display !== "none"; };
    const fr = frame.getBoundingClientRect();
    const name = (e) => e.getAttribute("data-testid") ?? e.getAttribute("aria-label") ?? String(e.className).split(" ")[0];
    const things = [...root.querySelectorAll(".a-aerial-zbtn, .a-aerial-edit, .a-aerial-bar, .a-aerial-bigmap, .a-aerial-toggle, .a-aerial-held, .a-aerial-legend, .a-aerial-note, [data-testid=band-aerial-logo], [data-testid=band-aerial-attribution]")].filter(shown);
    const box = (e) => { const r = e.getBoundingClientRect(); return { name: name(e), l: Math.round(r.left - fr.left), t: Math.round(r.top - fr.top), r: Math.round(r.right - fr.left), b: Math.round(r.bottom - fr.top), w: Math.round(r.width * 100) / 100, h: Math.round(r.height * 100) / 100 }; };
    const bs = things.map(box);
    const overlaps = [];
    for (let i = 0; i < bs.length; i += 1) for (let j = i + 1; j < bs.length; j += 1) {
      const a = bs[i], c = bs[j];
      if (things[i].contains(things[j]) || things[j].contains(things[i])) continue;
      if (a.l < c.r && c.l < a.r && a.t < c.b && c.t < a.b) overlaps.push(`${a.name} x ${c.name}`);
    }
    const outside = bs.filter((x) => x.name !== "band-aerial-attribution" && (x.t < 0 || x.l < 0 || x.r > Math.round(fr.width) || x.b > Math.round(fr.height))).map((x) => x.name);
    return { frame: { w: Math.round(fr.width * 100) / 100, h: Math.round(fr.height * 100) / 100 }, hasBar: frame.classList.contains("has-bar"), boxes: bs, overlaps, outsideFrame: outside };
  });
  const height = (sel) => p.evaluate((s) => { const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().height * 100) / 100 : null; }, sel);
  // A collapsed row: its box, its link's box and type, and where its words sit.
  const factRow = (id) => p.evaluate((id) => {
    const r2 = (n) => Math.round(n * 100) / 100;
    const row = document.querySelector(`[data-testid=fact-${id}]`);
    const lk = document.querySelector(`[data-testid=fact-link-${id}]`);
    if (!row || !lk) return null;
    const rr = row.getBoundingClientRect();
    const rel = (e) => { const r = e.getBoundingClientRect(); return { l: r2(r.left - rr.left), t: r2(r.top - rr.top), w: r2(r.width), h: r2(r.height) }; };
    const s = getComputedStyle(lk);
    const rg = document.createRange();
    rg.selectNodeContents(lk);
    const tr = rg.getBoundingClientRect();
    return {
      row: { w: r2(rr.width), h: r2(rr.height) },
      link: { ...rel(lk), text: lk.textContent, name: lk.getAttribute("aria-label") ?? lk.textContent, family: s.fontFamily.split(",")[0].replace(/["']/g, "").trim(), size: s.fontSize, weight: s.fontWeight, color: s.color, transform: s.textTransform, tracking: s.letterSpacing, decoration: s.textDecorationLine, borderBottom: `${s.borderBottomWidth} ${s.borderBottomStyle}` },
      linkText: { l: r2(tr.left - rr.left), t: r2(tr.top - rr.top), w: r2(tr.width), h: r2(tr.height) },
      label: rel(row.querySelector(".tr-field")),
      value: row.querySelector(".a-val") ? rel(row.querySelector(".a-val")) : null,
      act: getComputedStyle(document.querySelector(".workbench")).getPropertyValue("--act").trim(),
    };
  }, id);
  // The What section: every cell, label, source line and control, in page
  // coordinates; and each "Default" link's box and its word's box.
  const whatBoxes = () => p.evaluate((root) => {
    const r2 = (n) => Math.round(n * 100) / 100;
    const band = document.querySelector(root);
    const at = (e) => { const r = e.getBoundingClientRect(); return [r2(r.left + window.scrollX), r2(r.top + window.scrollY), r2(r.width), r2(r.height)]; };
    const out = {};
    let n = 0;
    for (const e of band.querySelectorAll(".a-cell, .w-label, .w-src-word, .a-cell-ctl > *, .w-row, .w-box, .w-hours-row, .w-sec-head, .w-box-head")) {
      const r = e.getBoundingClientRect();
      if (!(r.width > 0 && r.height > 0)) continue;
      out[`${n}:${e.tagName.toLowerCase()}.${String(e.className).split(" ")[0]}${e.getAttribute("data-testid") ? `#${e.getAttribute("data-testid")}` : ""}`] = at(e);
      n += 1;
    }
    const defaults = [...band.querySelectorAll(".w-src[data-source=default]")].filter((e) => e.getBoundingClientRect().width > 0).map((e) => {
      const s = getComputedStyle(e);
      return { testid: e.getAttribute("data-testid"), word: e.querySelector(".w-src-word").textContent, box: at(e), wordBox: at(e.querySelector(".w-src-word")), padding: `${s.paddingLeft} ${s.paddingRight}`, margin: `${s.marginLeft} ${s.marginRight}`, family: s.fontFamily.split(",")[0].replace(/["']/g, "").trim(), size: s.fontSize };
    });
    return { band: at(band), boxes: out, defaults };
  }, W);
  // The hours row: its box, the link's, the lowest ink of the grid above it,
  // and how far the focus ring's top edge is from that ink.
  const hoursRow = () => p.evaluate(() => {
    const r2 = (n) => Math.round(n * 100) / 100;
    const row = document.querySelector("[data-testid=what-hours]");
    const lk = document.querySelector("[data-testid=what-hours-all]");
    if (!row || !lk) return null;
    const above = row.previousElementSibling;
    let ink = -Infinity;
    const walker = document.createTreeWalker(above, NodeFilter.SHOW_TEXT);
    for (let t = walker.nextNode(); t; t = walker.nextNode()) {
      if (!t.textContent.trim()) continue;
      const cs = getComputedStyle(t.parentElement);
      if (cs.visibility === "hidden" || cs.display === "none" || t.parentElement.closest(".sr-only")) continue;
      const rg = document.createRange();
      rg.selectNodeContents(t);
      for (const r of rg.getClientRects()) if (r.height > 0) ink = Math.max(ink, r.bottom);
    }
    const s = getComputedStyle(lk);
    const rr = row.getBoundingClientRect();
    const lr = lk.getBoundingClientRect();
    const ring = parseFloat(s.outlineWidth) + parseFloat(s.outlineOffset);
    const cell = document.querySelector("[data-testid=cell-work-dates]");
    return {
      row: { y: r2(rr.top + window.scrollY), h: r2(rr.height), padding: getComputedStyle(row).padding },
      link: { y: r2(lr.top + window.scrollY), w: r2(lr.width), h: r2(lr.height), text: lk.textContent },
      aboveBottom: r2(above.getBoundingClientRect().bottom + window.scrollY),
      aboveInkBottom: r2(ink + window.scrollY),
      focused: document.activeElement === lk && lk.matches(":focus-visible"),
      outline: `${s.outlineWidth} ${s.outlineStyle} offset ${s.outlineOffset}`,
      ringTopToInk: document.activeElement === lk ? r2(lr.top - ring - ink) : "not measured",
      workDatesCell: cell ? { y: r2(cell.getBoundingClientRect().top + window.scrollY), h: r2(cell.getBoundingClientRect().height) } : null,
      record: document.querySelector("[data-testid=what-hours-record]")?.textContent ?? null,
    };
  });
  const hoursWindow = async (view) => {
    if (!(await p.locator(D).count())) {
      await p.getByTestId("what-hours-all").click();
      await p.waitForSelector(D, { timeout: 10000 });
    }
    await p.getByTestId(`hours-view-${view}`).click();
    await p.waitForTimeout(600);
  };
  const closeWindow = async () => { await p.keyboard.press("Escape"); await p.waitForTimeout(600); };
  try {
    // ---- e. The small aerial, pinned, before the questions are answered ----
    await pin(p);
    await p.waitForSelector(".a-aerial-zbtn", { timeout: 30000 }).catch(() => {});
    await p.waitForTimeout(2500);
    L.aerial = { pinned: await aerial() };
    L.whereHeightPinned = await height(WHERE);
    // Shown buttons only: in the phone's strip the zoom is display: none.
    L.zoomShown = await p.locator(".a-aerial-zbtn:visible").count();
    if (L.zoomShown) await around("439-aerial-zoom", ".a-aerial-zbtn", 44);
    else await around("439-aerial-zoom", "[data-testid=where-open-picker]", 70);
    await p.locator("[data-testid=band-aerial-frame]").screenshot({ path: file("557-aerial-frame") }).catch(() => {});
    if (L.zoomShown) {
      // Zoom in once: Reset joins the stack (its tallest state).
      await p.locator(".a-aerial-zbtn[aria-label='Zoom in']").click();
      await p.waitForTimeout(2500);
      L.aerial.zoomedIn = await aerial();
      await p.locator("[data-testid=band-aerial-frame]").screenshot({ path: file("557-aerial-frame-reset") });
      L.whereHeightZoomed = await height(WHERE);
      await p.locator(".a-aerial-reset").click();
      await p.waitForTimeout(2000);
    }
    L.axePinned = await axe(WHERE);
    L.under44Pinned = await small(p, WHERE);
    // The Edit panel (the before set's 439-edit-change-move-default).
    await p.locator("[data-testid=where-edit]").click();
    await p.waitForTimeout(1200);
    L.aerial.editPanel = await aerial();
    L.editPanel = await boxes("[data-testid=where-edit-panel] button, [data-testid=where-edit-panel] input");
    await around("439-edit-change-move-default", "[data-testid=where-edit-panel]", 8);
    await p.locator("[data-testid=where-edit-cancel]").click();
    await p.waitForTimeout(800);

    // ---- d. The closed Where row -----------------------------------------
    await confirm(p);
    L.factWhere = await factRow("where");
    await around("439-where-row-change", "[data-testid=fact-where]", 12);
    await p.getByTestId("fact-link-where").focus();
    await p.keyboard.press("Shift+Tab");
    await p.keyboard.press("Tab");
    await around("557-where-row-change-focus", "[data-testid=fact-where]", 12);
    await p.evaluate(() => document.activeElement?.blur());
    L.jurisdictionByHand = false;
    if (!(await p.getByTestId("what-hours-all").count())) {
      if (!(await p.locator("#what-jurisdiction").isVisible().catch(() => false))) await p.getByTestId("what-measured-toggle").click();
      await p.waitForTimeout(600);
      await lb(p, "what-jurisdiction", "denver");
      await settled(p);
      L.jurisdictionByHand = true;
    }

    // ---- g. The "Default" links in About the work -------------------------
    L.what = await whatBoxes();
    L.axeWhat = await axe(W);
    L.under44What = await small(p, W);
    if (L.what.defaults.length) {
      // The middle one's cell to the centre of the screen (the page's own
      // scroller, as `around` does), so all three are in view at 390 too.
      await p.evaluate(() => {
        const cells = [...document.querySelectorAll("[data-testid=band-what] .w-src[data-source=default]")].map((e) => e.closest(".a-cell"));
        cells[Math.floor(cells.length / 2)].scrollIntoView({ block: "center" });
      });
      await p.waitForTimeout(500);
      const r = await p.evaluate(() => {
        const rs = [...document.querySelectorAll("[data-testid=band-what] .w-src[data-source=default]")].map((e) => e.closest(".a-cell").getBoundingClientRect());
        return { x: Math.min(...rs.map((r) => r.left)), y: Math.min(...rs.map((r) => r.top)), r: Math.max(...rs.map((r) => r.right)), b: Math.max(...rs.map((r) => r.bottom)) };
      });
      const x = Math.max(0, r.x - 12);
      const y = Math.max(0, r.y - 12);
      await p.screenshot({ path: file("557-default-links"), clip: { x, y, width: Math.min(w - x, r.r - r.x + 24), height: Math.min(h - y, r.b - r.y + 24) } });
      // One of them with the keyboard's ring.
      await p.locator("[data-testid=band-what] .w-src[data-source=default]").first().focus();
      await p.keyboard.press("Shift+Tab");
      await p.keyboard.press("Tab");
      await p.waitForTimeout(300);
      const f = await p.evaluate(() => { const r = document.activeElement.closest(".a-cell").getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, src: document.activeElement.getAttribute("data-source") }; });
      L.defaultFocus = f.src;
      await p.screenshot({ path: file("557-default-link-focus"), clip: { x: Math.max(0, f.x - 12), y: Math.max(0, f.y - 12), width: Math.min(w - Math.max(0, f.x - 12), f.w + 24), height: Math.min(h - Math.max(0, f.y - 12), f.h + 24) } });
      await p.evaluate(() => document.activeElement?.blur());
    }

    // ---- f. The hours link ---------------------------------------------------
    await dates(p, "2026-12-07", "2026-12-11");
    await times(p, "7", "17");
    L.hours = { outside: await hoursRow() };
    await hoursWindow("day");
    const fix = p.getByTestId("hours-fix");
    L.fixOffered = (await fix.count()) ? await fix.innerText() : null;
    if (L.fixOffered) { await fix.click(); await p.waitForTimeout(1500); }
    await closeWindow();
    await settled(p);
    await p.getByTestId("what-hours-all").focus();
    await p.keyboard.press("Shift+Tab");
    await p.keyboard.press("Tab");
    await p.waitForTimeout(300);
    L.hours.withRecord = await hoursRow();
    await around("534-hours-link-focus-ring", "[data-testid=what-hours]", 28);
    L.whatWithRecord = await whatBoxes();
    L.axeWhatRecord = await axe(W);
    L.under44WhatRecord = await small(p, W);
    if (await p.getByTestId("what-hours-undo").count()) {
      await p.getByTestId("what-hours-undo").click();
      await p.waitForTimeout(1500);
      await settled(p);
    }
    L.hours.afterUndo = await hoursRow();

    // ---- The week columns' bottom, night work (8 pm to 5 am) ---------------
    await dates(p, "2026-12-07", "2026-12-13");
    await times(p, "20", "5");
    await hoursWindow("week");
    L.night = await p.evaluate((sel) => {
      const dlg = document.querySelector(sel);
      const cols = [...dlg.querySelectorAll(".whd-col")];
      return {
        arrows: (dlg.textContent.match(/[◂▸▴▾]/g) ?? []).length,
        clipElements: dlg.querySelectorAll(".whd-clip").length,
        columns: [...new Set(cols.map((c) => Math.round(c.getBoundingClientRect().height * 100) / 100))],
        yourBars: dlg.querySelectorAll(".whd-yours").length,
        window: [Math.round(dlg.getBoundingClientRect().width), Math.round(dlg.getBoundingClientRect().height)],
      };
    }, D);
    L.axeNightWeek = await axe(D);
    L.under44NightWeek = await small(p, D);
    await p.locator(D).screenshot({ path: file("535-night-week") });
    {
      const c = await p.evaluate(() => {
        const rs = [...document.querySelectorAll(".whd-col")].map((e) => e.getBoundingClientRect());
        return { x: Math.min(...rs.map((r) => r.left)), r: Math.max(...rs.map((r) => r.right)), b: Math.max(...rs.map((r) => r.bottom)) };
      });
      const x = Math.max(0, c.x - 12);
      await p.screenshot({ path: file("535-night-week-bottom-marks"), clip: { x, y: c.b - 48, width: Math.min(w - x, c.r - c.x + 24), height: 72 } });
    }
    await hoursWindow("day");
    L.nightDay = await p.evaluate((sel) => ({ arrows: (document.querySelector(sel).textContent.match(/[◂▸▴▾]/g) ?? []).length, clipElements: document.querySelector(sel).querySelectorAll(".whd-clip").length }), D);
    L.axeNightDay = await axe(D);
    await closeWindow();

    // ---- S2: the closed "What's the job?" row (Where reopened) -------------
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.getByTestId("fact-link-where").click();
    await p.waitForTimeout(2500);
    L.factWhat = await factRow("what");
    if (L.factWhat) await around("557-what-row-change", "[data-testid=fact-what]", 12);
    L.aerial.reopened = await aerial();
    L.axeReopened = await axe(".workbench");
    L.under44Reopened = await small(p, ".workbench");
  } catch (e) {
    L.errors.push(oneLine(e).slice(0, 400));
    await p.screenshot({ path: path.join(EXTRA, `error-${MODE}-${label}.png`) }).catch(() => {});
  } finally {
    await b.close();
  }
  fs.writeFileSync(path.join(EV, MODE === "before" ? `measures-before-${label}.json` : `measures-${label}.json`), JSON.stringify(L, null, 1).replace(/[\u0080-￿]/g, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`));
  console.log(label, MODE, "errors:", L.errors.length ? L.errors.join(" | ") : "none");
}
