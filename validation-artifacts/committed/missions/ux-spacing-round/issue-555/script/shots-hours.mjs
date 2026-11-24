// #555 walk: the work-hours window on the 6 am to 6 am scale.  Local dev
// server of the issue worktree, read-only, headless (nothing saved, no
// download, no sign-in).  Adapted from
// validation-artifacts-extra/spacing-round-before/script/shots-page.mjs
// (untracked, main checkout, not committed)
// (the work-hours part; the same two browser-only edits for the states real
// data can't reach).
//   node shots-hours.mjs [widths]      e.g. node shots-hours.mjs 390
// Crops go to ../crops, measures to ../measures-<width>.json.
import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { open, pin, confirm, dates, times, lb, settled, small, SITE, W, D, MAIN, oneLine, gateHeaders, isSiteRequest } from "./lib.mjs";

const EV = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CROPS = path.join(EV, "crops");
const AXE = createRequire(path.join(MAIN, "conestruct/site/package.json")).resolve("axe-core/axe.min.js");
const ONLY = process.argv[2];
const SIZES = [[1440, 900], [1198, 930], [390, 844]].filter(([w]) => !ONLY || ONLY.split(",").includes(String(w)));

for (const [w, h] of SIZES) {
  const { b, p } = await open(w, h);
  const L = { site: SITE, viewport: [w, h], errors: [], states: {} };
  const mode = { dropClass: false, closures: false };
  const file = (name) => path.join(CROPS, `${name}-${w}.png`);
  const hoursWindow = async (view) => {
    if (!(await p.locator(D).count())) {
      await p.getByTestId("what-hours-all").click();
      await p.waitForSelector(D, { timeout: 10000 });
    }
    await p.getByTestId(`hours-view-${view}`).click();
    await p.waitForTimeout(600);
  };
  const closeWindow = async () => { await p.keyboard.press("Escape"); await p.waitForTimeout(600); };
  // What the chart draws, read from the page.
  const chart = () => p.evaluate(() => {
    const r2 = (n) => Math.round(n * 100) / 100;
    const body = document.querySelector(".whd-body");
    const bb = body.getBoundingClientRect();
    const dlg = document.querySelector("[data-testid=hours-dialog]");
    const box = (e) => { const r = e.getBoundingClientRect(); return { x: r2(r.left - bb.left), y: r2(r.top - bb.top), w: r2(r.width), h: r2(r.height) }; };
    const within = (e) => { const r = e.getBoundingClientRect(); return r.left >= bb.left - 0.5 && r.right <= bb.right + 0.5; };
    const all = (s) => [...dlg.querySelectorAll(s)];
    const text = (e) => { const c = getComputedStyle(e); return { text: e.textContent, ...box(e), within: within(e), color: c.color, weight: c.fontWeight, size: c.fontSize, family: c.fontFamily.split(",")[0].trim() }; };
    const scale = dlg.querySelector(".whd-track") ?? dlg.querySelector(".whd-col");
    const days = all("[data-testid=hours-week-day]");
    const bar = (e) => ({ cls: e.className, bg: getComputedStyle(e).backgroundColor, border: getComputedStyle(e).borderTopStyle, ...box(e) });
    return {
      dialog: { w: r2(dlg.getBoundingClientRect().width), h: r2(dlg.getBoundingClientRect().height) },
      body: { scrollWidth: body.scrollWidth, clientWidth: body.clientWidth, scrollHeight: body.scrollHeight, clientHeight: body.clientHeight },
      scale: scale ? box(scale) : null,
      ticks: all(".whd-tick, .whd-vticks span").map(text),
      caps: all(".whd-cap").map(text),
      midnight: all(".whd-midnight").map((e) => { const c = getComputedStyle(e); return { ...box(e), line: e.classList.contains("is-v") ? `${c.borderTopWidth} ${c.borderTopStyle} ${c.borderTopColor}` : `${c.borderLeftWidth} ${c.borderLeftStyle} ${c.borderLeftColor}` }; }),
      clipMarks: all(".whd-clip").length,
      ruler: dlg.querySelector(".whd-track") ? { bands: all(".whd-track .whd-band").map(bar), yours: all(".whd-track .whd-yours").map(bar) } : null,
      week: days.map((d) => ({
        name: d.querySelector(".whd-dayname").textContent,
        cls: d.className,
        col: box(d.querySelector(".whd-col")),
        bands: [...d.querySelectorAll(".whd-band")].map(bar),
        yours: [...d.querySelectorAll(".whd-yours")].map(bar),
        sr: d.querySelector(".sr-only")?.textContent ?? "",
      })),
      families: [...new Set(all("*").filter((e) => e.childNodes.length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())).map((e) => getComputedStyle(e).fontFamily.split(",")[0].trim()))],
      verdict: dlg.querySelector("[data-testid=hours-verdict]")?.textContent ?? null,
      sub: dlg.querySelector("[data-testid=hours-dialog-sub]")?.textContent ?? null,
      legend: dlg.querySelector(".whd-legend")?.innerText.replace(/\s+/g, " ") ?? null,
    };
  });
  const axe = async () => {
    if (!(await p.evaluate(() => typeof window.axe !== "undefined"))) await p.addScriptTag({ path: AXE });
    return p.evaluate(async (sel) => (await window.axe.run(document.querySelector(sel))).violations.map((v) => ({ id: v.id, nodes: v.nodes.length })), D);
  };
  // One state in both views: crops, the chart's measures, axe, the 44 px measure.
  const state = async (name, { shoot = true } = {}) => {
    const out = {};
    for (const view of ["day", "week"]) {
      await hoursWindow(view);
      out[view] = { chart: await chart(), axe: await axe(), under44: await small(p, D) };
      if (shoot) await p.locator(D).screenshot({ path: file(`${name}-${view}`) });
    }
    L.states[name] = out;
    return out;
  };
  try {
    for (const route of ["**/api/render/device-breakdown**", "**/api/render/audit"]) {
      await p.route(route, async (r) => {
        if (!mode.dropClass && !mode.closures) return r.fallback();
        try {
          const own = isSiteRequest(r.request().url(), SITE) ? gateHeaders(SITE) : {};
          const opts = { headers: { ...r.request().headers(), ...own } };
          if (mode.dropClass) {
            const strip = (o) => {
              if (o && typeof o === "object") { delete o.street_class; Object.values(o).forEach(strip); }
              return o;
            };
            opts.postData = JSON.stringify(strip(JSON.parse(r.request().postData() ?? "{}")));
          }
          const resp = await r.fetch(opts);
          const body = await resp.json();
          const j = body?.breakdown?.jurisdiction ?? body?.jurisdiction;
          if (mode.closures && j?.hours_days?.kinds?.weekday) {
            j.hours_days.kinds.weekend = { ...j.hours_days.kinds.weekday, allowed: [], no_closures: true, status: "outside", outside: [[9, 15]], fix: null };
            j.hours_days.status = "outside";
          }
          const headers = { ...resp.headers() };
          delete headers["content-length"];
          delete headers["content-encoding"];
          return await r.fulfill({ status: resp.status(), headers, body: JSON.stringify(body) });
        } catch { return r.abort().catch(() => {}); }
      });
    }
    await pin(p);
    await confirm(p);
    L.jurisdictionByHand = false;
    if (!(await p.getByTestId("what-hours-all").count())) {
      if (!(await p.locator("#what-jurisdiction").isVisible().catch(() => false))) await p.getByTestId("what-measured-toggle").click();
      await p.waitForTimeout(600);
      await lb(p, "what-jurisdiction", "denver");
      await settled(p);
      L.jurisdictionByHand = true;
    }
    const bandHeight = () => p.evaluate((s) => Math.round(document.querySelector(s).getBoundingClientRect().height * 100) / 100, W);

    // ---- Night shift, 8 pm to 5 am, Mon Dec 7 to Sun Dec 13 --------------
    await dates(p, "2026-12-07", "2026-12-13");
    await times(p, "20", "5");
    L.bandHeightClosed = await bandHeight();
    await state("555-night");
    {
      // The bottom of the columns, where the old scale left only ▾ marks.
      const c = await p.evaluate(() => {
        const rs = [...document.querySelectorAll(".whd-col")].map((e) => e.getBoundingClientRect());
        return { x: Math.min(...rs.map((r) => r.left)), r: Math.max(...rs.map((r) => r.right)), b: Math.max(...rs.map((r) => r.bottom)) };
      });
      const x = Math.max(0, c.x - 60);
      await p.screenshot({ path: file("555-night-week-bottom"), clip: { x, y: c.b - 110, width: Math.min(w - x, c.r - x + 12), height: 134 } });
    }
    await closeWindow();
    L.bandHeightAfterClose = await bandHeight();

    // ---- Day shift, 9 am to 3 pm, Mon Dec 7 to Fri Dec 11 -----------------
    await dates(p, "2026-12-07", "2026-12-11");
    await times(p, "9", "15");
    await state("555-day");
    await closeWindow();

    // ---- Outside what's allowed, 7 am to 5 pm (the inside/outside split) --
    await times(p, "7", "17");
    await state("555-outside");
    await closeWindow();

    // ---- The 6 am edge: an early start, 4 am to 2 pm (rulings.md S2) ------
    await times(p, "4", "14");
    await state("555-early-start");
    await closeWindow();

    // ---- The "before" set's two browser-edit states, for the matching
    //      "after" crops (1440 and 390, as the before set) ------------------
    if (w !== 1198) {
      await dates(p, "2026-12-07", "2026-12-13");
      mode.closures = true;
      await times(p, "9", "15");
      await hoursWindow("week");
      L.states["535-no-closures"] = { week: { chart: await chart(), axe: await axe() } };
      await p.locator(D).screenshot({ path: file("535-no-closures-week") });
      await closeWindow();
      mode.closures = false;
      mode.dropClass = true;
      await times(p, "9", "14");
      await state("535-class-unset");
      await closeWindow();
      mode.dropClass = false;
    }
  } catch (e) {
    L.errors.push(oneLine(e).slice(0, 400));
    await p.screenshot({ path: path.join(MAIN, "validation-artifacts-extra/ux-spacing-round/issue-555", `error-page-${w}.png`) }).catch(() => {});
  } finally {
    await b.close();
  }
  fs.writeFileSync(path.join(EV, `measures-${w}.json`), JSON.stringify(L, null, 1));
  console.log(w, "states:", Object.keys(L.states).join(", "), "errors:", L.errors.length ? L.errors.join(" | ") : "none");
}
