// #556 walk, round 2: the worst-case wordings, and the no-street-class state
// with its real subtitle.  Local dev server of the issue worktree (npx next
// dev -p 3556 in conestruct/site), read-only, headless.
//
// Browser edit for the no-street-class state: the road lookup's answer
// (/api/road-bearing) has every `highway_class` rewritten to "road", a class
// the page has no street-class guess for.  The page then never sets a street
// class, so its own subtitle reads "Street class not set, …", its own hours
// request carries no street class, and the real backend answers
// `missing: street_class`.  Nothing else is edited.
//   WALK_SITE=http://localhost:3556 node shots-556-worst.mjs [labels]
// Crops go to ../crops, measures to ../measures-worst-<label>.json.
import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { open, pin, confirm, dates, times, lb, settled, small, SITE, D, MAIN, oneLine, gateHeaders, isSiteRequest } from "../../issue-555/script/lib.mjs";

const EV = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CROPS = path.join(EV, "crops");
const EXTRA = path.join(MAIN, "validation-artifacts-extra/ux-spacing-round/issue-556");
const AXE = createRequire(path.join(MAIN, "conestruct/site/package.json")).resolve("axe-core/axe.min.js");
const ONLY = process.argv[2];
const SIZES = [["390", 390, 844], ["390x667", 390, 667], ["390x600", 390, 600], ["1440", 1440, 900]]
  .filter(([label]) => !ONLY || ONLY.split(",").includes(label));
fs.mkdirSync(EXTRA, { recursive: true });

for (const [label, w, h] of SIZES) {
  for (const klass of ["set", "unset"]) {
    const { b, p } = await open(w, h);
    const L = { site: SITE, viewport: [w, h], streetClass: klass, errors: [], states: {} };
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
    const read = () => p.evaluate(() => {
      const r2 = (n) => Math.round(n * 100) / 100;
      const dlg = document.querySelector("[data-testid=hours-dialog]");
      const body = dlg.querySelector(".whd-body");
      const lines = (e) => {
        const range = document.createRange();
        range.selectNodeContents(e);
        const out = [];
        for (const r of range.getClientRects()) {
          const last = out[out.length - 1];
          if (last && Math.abs(last.top - r.top) < 2) last.bottom = Math.max(last.bottom, r.bottom); else out.push({ top: r.top, bottom: r.bottom });
        }
        return out;
      };
      const noteEl = dlg.querySelector("[data-testid=hours-week-note]");
      // Every line of the note against the body's visible box, and what is
      // painted at the middle of each line (the note itself, or something over it).
      const noteAt = () => {
        const bb = body.getBoundingClientRect();
        const ls = lines(noteEl);
        const nb = noteEl.getBoundingClientRect();
        const whole = ls.every((r) => r.top >= bb.top - 0.01 && r.bottom <= bb.bottom + 0.01);
        const onTop = ls.every((r) => { const e = document.elementFromPoint(nb.left + 4, (r.top + r.bottom) / 2); return e === noteEl; });
        const week = dlg.querySelector(".whd-week").getBoundingClientRect();
        return {
          scrollTop: r2(body.scrollTop), lines: ls.length,
          firstLineTop: r2(ls[0].top - bb.top), lastLineBottom: r2(ls[ls.length - 1].bottom - bb.top),
          boxTop: r2(nb.top - bb.top), boxBottom: r2(nb.bottom - bb.top),
          whole, onTop, coversChartBy: r2(Math.max(0, week.bottom - nb.top)),
        };
      };
      const scrolls = body.scrollHeight > body.clientHeight;
      let note = null;
      if (noteEl) {
        const atRest = noteAt();
        let atEnd = null;
        if (scrolls) { const was = body.scrollTop; body.scrollTop = body.scrollHeight; atEnd = noteAt(); body.scrollTop = was; }
        const c = getComputedStyle(noteEl);
        note = { text: noteEl.textContent, position: c.position, background: c.backgroundColor, atRest, atEnd };
      }
      const uniq = (xs) => [...new Map(xs.map((x) => [JSON.stringify(x), x])).values()];
      const all = (s) => [...dlg.querySelectorAll(s)];
      const sub = dlg.querySelector("[data-testid=hours-dialog-sub]");
      const texts = all("*").filter((e) => !e.classList.contains("sr-only") && e.childNodes.length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
      return {
        dialog: { w: r2(dlg.getBoundingClientRect().width), h: r2(dlg.getBoundingClientRect().height) },
        body: { clientHeight: body.clientHeight, scrollHeight: body.scrollHeight, scrolls, scrollWidth: body.scrollWidth, clientWidth: body.clientWidth },
        sub: { text: sub.textContent, lines: lines(sub).length },
        notice: dlg.querySelector("[data-testid=hours-class-notice]")?.textContent ?? null,
        legend: all(".whd-legend li").map((li) => li.textContent),
        legendLines: uniq(all(".whd-legend li").map((li) => Math.round(li.getBoundingClientRect().top))).length,
        source: dlg.querySelector("[data-testid=hours-dialog-source]")?.textContent ?? null,
        note,
        yours: uniq(all(".whd-yours").map((e) => { const c = getComputedStyle(e); return { cls: e.className, bg: c.backgroundColor, border: `${c.borderTopWidth} ${c.borderTopStyle}` }; })),
        families: [...new Set(texts.map((e) => getComputedStyle(e).fontFamily.split(",")[0].trim()))],
        sizes: [...new Set(texts.map((e) => getComputedStyle(e).fontSize))].sort(),
      };
    });
    const axe = async () => {
      if (!(await p.evaluate(() => typeof window.axe !== "undefined"))) await p.addScriptTag({ path: AXE });
      return p.evaluate(async (sel) => (await window.axe.run(document.querySelector(sel))).violations.map((v) => ({ id: v.id, nodes: v.nodes.length })), D);
    };
    const state = async (name, crop) => {
      for (const v of ["day", "week"]) {
        await hoursWindow(v);
        (L.states[name] ??= {})[v] = { ...(await read()), axe: await axe(), under44: await small(p, D) };
        if (crop) await p.locator(D).screenshot({ path: file(`${name}-${v}`) });
      }
      if (crop && L.states[name].week.body.scrolls) {
        await p.evaluate(() => { const bd = document.querySelector(".whd-body"); bd.scrollTop = bd.scrollHeight; });
        await p.waitForTimeout(300);
        await p.locator(D).screenshot({ path: file(`${name}-week-end`) });
      }
      await closeWindow();
    };
    const step = async (name, fn) => {
      try { await fn(); } catch (e) {
        L.errors.push(`${name}: ${oneLine(e).slice(0, 300)}`);
        await p.screenshot({ path: path.join(EXTRA, `error-worst-${klass}-${name}-${label}.png`) }).catch(() => {});
        if (await p.locator(D).count()) await closeWindow().catch(() => {});
      }
    };
    try {
      if (klass === "unset") {
        await p.route("**/api/road-bearing**", async (r) => {
          try {
            const own = isSiteRequest(r.request().url(), SITE) ? gateHeaders(SITE) : {};
            const resp = await r.fetch({ headers: { ...r.request().headers(), ...own } });
            const body = await resp.json();
            const edit = (o) => {
              if (o && typeof o === "object") { if (typeof o.highway_class === "string") o.highway_class = "road"; Object.values(o).forEach(edit); }
              return o;
            };
            const headers = { ...resp.headers() };
            delete headers["content-length"];
            delete headers["content-encoding"];
            return await r.fulfill({ status: resp.status(), headers, body: JSON.stringify(edit(body)) });
          } catch { return r.abort().catch(() => {}); }
        });
        p.on("request", (q) => {
          if (!/\/api\/render\/(device-breakdown|audit)/.test(q.url())) return;
          try { const s = JSON.stringify(JSON.parse(q.postData() ?? "{}")); const m = /"street_class":("[^"]*"|null)/.exec(s); L.hoursRequestStreetClass = m ? m[1] : "absent"; } catch { /* not JSON */ }
        });
        p.on("response", async (q) => {
          if (!/\/api\/render\/(device-breakdown|audit)/.test(q.url())) return;
          try { const j = await q.json(); const hd = (j?.breakdown?.jurisdiction ?? j?.jurisdiction)?.hours_days; if (hd) L.backendAnswer = { missing: hd.missing, status: hd.status, weekdayAllowed: hd.kinds?.weekday?.allowed ?? null, weekdayOutside: hd.kinds?.weekday?.outside, weekendRecord: hd.kinds?.weekend?.record }; } catch { /* not JSON */ }
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
      const name = (s) => `556-worst-class-${klass}-${s}`;
      // The longest subtitle: a night shift on the half hour.  The whole week.
      await step("night", async () => {
        await dates(p, "2026-12-07", "2026-12-13");
        await times(p, "20.5", "5.5");
        await state(name("night"), label !== "390x667");
      });
      // The longest one-week note: Thu and Fri ("Mon to Wed, Sat and Sun aren't in them.").
      await step("thu-fri", async () => {
        await dates(p, "2026-12-10", "2026-12-11");
        await state(name("thu-fri"), label !== "390x667");
      });
      // The longest note of all: more than one week.
      await step("multi-week", async () => {
        await dates(p, "2026-12-10", "2026-12-23");
        await times(p, "9.5", "14.5");
        await state(name("multi-week"), false);
      });
    } catch (e) {
      L.errors.push(oneLine(e).slice(0, 400));
      await p.screenshot({ path: path.join(EXTRA, `error-worst-${klass}-${label}.png`) }).catch(() => {});
    } finally {
      await b.close();
    }
    fs.writeFileSync(path.join(EV, `measures-worst-${klass}-${label}.json`), JSON.stringify(L, null, 1));
    console.log(label, klass, "states:", Object.keys(L.states).join(", "), "errors:", L.errors.length ? L.errors.join(" | ") : "none");
  }
}
