// #556 walk: the work-hours window's key, the no-street-class state and the
// week note.  Local dev server of the issue worktree (npx next dev -p 3556
// in conestruct/site), read-only, headless: nothing saved, no download, no
// sign-in.  It reuses item 1's helpers (../../issue-555/script/lib.mjs) and
// the same two browser-only edits as the before set
// (validation-artifacts-extra/spacing-round-before/script/shots-page.mjs:
// untracked, main checkout, not committed) for the states real data can't
// reach.
//   WALK_SITE=http://localhost:3556 node shots-556.mjs [labels]
//   e.g. node shots-556.mjs 390,390x600
// Crops go to ../crops, measures to ../measures-<label>.json.
import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { open, pin, confirm, dates, times, lb, settled, small, SITE, W, D, MAIN, oneLine, gateHeaders, isSiteRequest } from "../../issue-555/script/lib.mjs";

const EV = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CROPS = path.join(EV, "crops");
const EXTRA = path.join(MAIN, "validation-artifacts-extra/ux-spacing-round/issue-556");
const AXE = createRequire(path.join(MAIN, "conestruct/site/package.json")).resolve("axe-core/axe.min.js");
const ONLY = process.argv[2];
// Two shorter screens, the fits state only.  390x667 is a small phone: the
// window is 100vh - 32 px there.  390x600 is short enough that the body
// scrolls (the ruling's "when it still runs long").
const SHORT = ["390x667", "390x600"];
const SIZES = [["1440", 1440, 900], ["1198", 1198, 930], ["390", 390, 844], ["390x667", 390, 667], ["390x600", 390, 600]]
  .filter(([label]) => !ONLY || ONLY.split(",").includes(label));
fs.mkdirSync(CROPS, { recursive: true });
fs.mkdirSync(EXTRA, { recursive: true });

for (const [label, w, h] of SIZES) {
  const { b, p } = await open(w, h);
  const L = { site: SITE, viewport: [w, h], errors: [], states: {} };
  const mode = { dropClass: false, closures: false };
  const file = (name) => path.join(CROPS, `${name}-${label}.png`);
  const hoursWindow = async (view) => {
    if (!(await p.locator(D).count())) {
      await p.getByTestId("what-hours-all").click();
      await p.waitForSelector(D, { timeout: 10000 });
    }
    await p.getByTestId(`hours-view-${view}`).click();
    await p.waitForTimeout(600);
  };
  const closeWindow = async () => { await p.keyboard.press("Escape"); await p.waitForTimeout(600); };
  // What the window draws, read from the page.
  const read = () => p.evaluate(() => {
    const r2 = (n) => Math.round(n * 100) / 100;
    const dlg = document.querySelector("[data-testid=hours-dialog]");
    const body = dlg.querySelector(".whd-body");
    const bb = body.getBoundingClientRect();
    // The body's visible box is its padding box (it has no border).
    const all = (s) => [...dlg.querySelectorAll(s)];
    const rel = (r) => ({ top: r2(r.top - bb.top), bottom: r2(r.bottom - bb.top) });
    const lines = (e) => {
      const range = document.createRange();
      range.selectNodeContents(e);
      const out = [];
      for (const r of range.getClientRects()) {
        const last = out[out.length - 1];
        if (last && Math.abs(last.top - r.top) < 2) { last.bottom = Math.max(last.bottom, r.bottom); } else out.push({ top: r.top, bottom: r.bottom });
      }
      return out;
    };
    const inside = (r) => r.top >= bb.top - 0.01 && r.bottom <= bb.bottom + 0.01;
    const noteEl = dlg.querySelector("[data-testid=hours-week-note]");
    const noteAt = () => {
      if (!noteEl) return null;
      const ls = lines(noteEl);
      const last = ls[ls.length - 1];
      const box = noteEl.getBoundingClientRect();
      return {
        scrollTop: r2(body.scrollTop),
        lines: ls.length,
        lastLine: rel(last),
        lastLineInside: inside(last),
        box: rel(box),
        boxInside: inside(box),
      };
    };
    const atRest = noteAt();
    let atEnd = null;
    const scrolls = body.scrollHeight > body.clientHeight;
    if (noteEl && scrolls) {
      const was = body.scrollTop;
      body.scrollTop = body.scrollHeight;
      atEnd = noteAt();
      body.scrollTop = was;
    }
    const bar = (e) => {
      const c = getComputedStyle(e);
      return { cls: e.className, bg: c.backgroundColor, border: `${c.borderTopWidth} ${c.borderTopStyle} ${c.borderTopColor}` };
    };
    const uniq = (xs) => [...new Map(xs.map((x) => [JSON.stringify(x), x])).values()];
    // Text a reader sees; the screen-reader sentences (.sr-only) are listed apart.
    const texts = all("*").filter((e) => !e.classList.contains("sr-only") && e.childNodes.length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
    const notice = dlg.querySelector("[data-testid=hours-class-notice]");
    const key = dlg.querySelector("[data-testid=hours-key-no-closures]");
    const swatch = key?.querySelector(".whd-key");
    const closed = dlg.querySelector(".whd-closed");
    const css = (e) => { const c = getComputedStyle(e); const r = e.getBoundingClientRect(); return { w: r2(r.width), h: r2(r.height), backgroundImage: c.backgroundImage, border: `${c.borderTopWidth} ${c.borderTopStyle} ${c.borderTopColor}` }; };
    return {
      dialog: { w: r2(dlg.getBoundingClientRect().width), h: r2(dlg.getBoundingClientRect().height) },
      body: { scrollWidth: body.scrollWidth, clientWidth: body.clientWidth, scrollHeight: body.scrollHeight, clientHeight: body.clientHeight, scrolls, overflowY: getComputedStyle(body).overflowY, tabindex: body.getAttribute("tabindex") },
      sub: dlg.querySelector("[data-testid=hours-dialog-sub]")?.textContent ?? null,
      verdict: dlg.querySelector("[data-testid=hours-verdict]")?.textContent ?? null,
      notice: notice ? { text: notice.textContent, firstInBody: body.firstElementChild === notice, ...rel(notice.getBoundingClientRect()), size: getComputedStyle(notice).fontSize, color: getComputedStyle(notice).color } : null,
      legend: all(".whd-legend li").map((li) => li.textContent),
      legendLines: uniq(all(".whd-legend li").map((li) => Math.round(li.getBoundingClientRect().top))).length,
      keyNoClosures: key ? { text: key.textContent, size: getComputedStyle(key).fontSize, swatch: css(swatch), days: closed ? css(closed) : null, stripedDays: all(".whd-closed").length } : null,
      stripedDays: all(".whd-closed").length,
      note: noteEl ? { text: noteEl.textContent, size: getComputedStyle(noteEl).fontSize, atRest, atEnd } : null,
      yours: uniq(all(".whd-yours").map(bar)),
      yoursCount: all(".whd-yours").length,
      bands: all(".whd-band").length,
      ground: getComputedStyle(dlg).backgroundColor,
      track: dlg.querySelector(".whd-track") ? r2(dlg.querySelector(".whd-track").getBoundingClientRect().height) : null,
      cols: uniq(all(".whd-col").map((e) => r2(e.getBoundingClientRect().height))),
      weekRows: dlg.querySelector(".whd-week") ? getComputedStyle(dlg.querySelector(".whd-week")).gridTemplateRows : null,
      sr: all("[data-testid=hours-week-day] .sr-only").map((e) => e.textContent),
      families: [...new Set(texts.map((e) => getComputedStyle(e).fontFamily.split(",")[0].trim()))],
      sizes: [...new Set(texts.map((e) => getComputedStyle(e).fontSize))].sort(),
      srSizes: [...new Set(all(".sr-only").map((e) => getComputedStyle(e).fontSize))],
    };
  });
  const axe = async () => {
    if (!(await p.evaluate(() => typeof window.axe !== "undefined"))) await p.addScriptTag({ path: AXE });
    return p.evaluate(async (sel) => (await window.axe.run(document.querySelector(sel))).violations.map((v) => ({ id: v.id, nodes: v.nodes.length })), D);
  };
  // One view of one state: the crop, the readings, axe, the 44 px measure.
  const view = async (state, v, crop) => {
    await hoursWindow(v);
    const r = { ...(await read()), axe: await axe(), under44: await small(p, D) };
    (L.states[state] ??= {})[v] = r;
    if (crop) await p.locator(D).screenshot({ path: file(crop) });
    return r;
  };
  // The same view scrolled to the end, when it scrolls.
  const endCrop = async (state, v, crop) => {
    const r = L.states[state][v];
    if (!r.body.scrolls) return;
    await p.evaluate(() => { const b = document.querySelector(".whd-body"); b.scrollTop = b.scrollHeight; });
    await p.waitForTimeout(300);
    await p.locator(D).screenshot({ path: file(crop) });
    await p.evaluate(() => { document.querySelector(".whd-body").scrollTop = 0; });
  };
  const step = async (name, fn) => {
    try { await fn(); } catch (e) {
      L.errors.push(`${name}: ${oneLine(e).slice(0, 300)}`);
      await p.screenshot({ path: path.join(EXTRA, `error-${name}-${label}.png`) }).catch(() => {});
      if (await p.locator(D).count()) await closeWindow().catch(() => {});
    }
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
          if (mode.dropClass && j?.hours_days) {
            L.classUnsetAnswer = { missing: j.hours_days.missing, status: j.hours_days.status, kinds: Object.fromEntries(Object.entries(j.hours_days.kinds ?? {}).map(([k, v]) => [k, { allowed: v.allowed, record: v.record, no_closures: v.no_closures, status: v.status, outside: v.outside }])) };
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

    // ---- The week note, hours that fit: Mon Dec 7 to Fri Dec 11, 9 to 3 ---
    await step("fits", async () => {
      await dates(p, "2026-12-07", "2026-12-11");
      await times(p, "9", "15");
      L.bandHeightClosed = await bandHeight();
      await view("534-week-note-fits", "day", null);
      await view("534-week-note-fits", "week", "534-week-note-fits");
      await endCrop("534-week-note-fits", "week", "534-week-note-fits-end");
      await closeWindow();
      L.bandHeightAfterClose = await bandHeight();
    });
    if (!SHORT.includes(label)) {
      // ---- The same with hours outside what's allowed, 7 am to 5 pm -------
      await step("outside", async () => {
        await times(p, "7", "17");
        await view("534-week-note-outside", "day", null);
        await view("534-week-note-outside", "week", "534-week-note-outside");
        await endCrop("534-week-note-outside", "week", "534-week-note-outside-end");
        await closeWindow();
      });
      // ---- Browser edit: a no-closures weekend, Dec 7 to Dec 13, 9 to 3 ---
      await step("no-closures", async () => {
        await dates(p, "2026-12-07", "2026-12-13");
        mode.closures = true;
        await times(p, "9", "15");
        await view("535-no-closures", "day", null);
        await view("535-no-closures", "week", "535-no-closures-week");
        await p.locator(`${D} .whd-foot`).screenshot({ path: file("556-key-no-closures") });
        await endCrop("535-no-closures", "week", "535-no-closures-week-end");
        await closeWindow();
      });
      mode.closures = false;
      // ---- Browser edit: no street class, Dec 7 to Dec 13, 9 to 2 ---------
      await step("class-unset", async () => {
        mode.dropClass = true;
        await times(p, "9", "14");
        await view("535-class-unset", "day", "535-class-unset-day");
        await view("535-class-unset", "week", "535-class-unset-week");
        await endCrop("535-class-unset", "week", "535-class-unset-week-end");
        await closeWindow();
      });
      mode.dropClass = false;
      // ---- The note's other two sentences ----------------------------------
      await step("multi-week", async () => {
        await dates(p, "2026-12-07", "2026-12-23");
        await times(p, "9", "15");
        await view("556-note-multi-week", "week", "556-note-multi-week");
        await endCrop("556-note-multi-week", "week", "556-note-multi-week-end");
        await closeWindow();
      });
      await step("one-day", async () => {
        await dates(p, "2026-12-09", "2026-12-09");
        await times(p, "8", "15");
        await view("556-note-one-day", "week", "556-note-one-day");
        await endCrop("556-note-one-day", "week", "556-note-one-day-end");
        await closeWindow();
      });
    }
  } catch (e) {
    L.errors.push(oneLine(e).slice(0, 400));
    await p.screenshot({ path: path.join(EXTRA, `error-page-${label}.png`) }).catch(() => {});
  } finally {
    await b.close();
  }
  fs.writeFileSync(path.join(EV, `measures-${label}.json`), JSON.stringify(L, null, 1));
  console.log(label, "states:", Object.keys(L.states).join(", "), "errors:", L.errors.length ? L.errors.join(" | ") : "none");
}
