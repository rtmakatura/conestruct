// #561 walk: the key's "Not checked" entry and the "more below"
// fade.  Local dev server of the issue worktree (npx next dev -p 3561 in
// conestruct/site), read-only, headless.  Built on #556's round-2 walk
// (missions/ux-spacing-round/issue-556/script/shots-556-worst.mjs) and its
// helpers, with the same one browser edit for the no-street-class state:
// the road lookup's answer (/api/road-bearing) has every `highway_class`
// rewritten to "road", so the page sets no street class by itself and the
// real backend answers `missing: street_class`.  Nothing else is edited.
//   WALK_SITE=http://localhost:3561 node walk-561.mjs [labels]
// Crops go to ../crops, measures to ../measures-<class>-<label>.json.
import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { open, pin, confirm, dates, times, lb, settled, small, SITE, D, MAIN, oneLine, gateHeaders, isSiteRequest } from "../../missions/ux-spacing-round/issue-555/script/lib.mjs";

const EV = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CROPS = path.join(EV, "crops");
const EXTRA = path.join(MAIN, "validation-artifacts-extra/issue-561");
const AXE = createRequire(path.join(MAIN, "conestruct/site/package.json")).resolve("axe-core/axe.min.js");
const ONLY = process.argv[2];
const SIZES = [["390", 390, 844], ["390x600", 390, 600], ["390x480", 390, 480], ["1440", 1440, 900]]
  .filter(([label]) => !ONLY || ONLY.split(",").includes(label));
fs.mkdirSync(EXTRA, { recursive: true });
fs.mkdirSync(CROPS, { recursive: true });

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
    // One reading of the window as it stands (no scrolling here).
    const read = () => p.evaluate(() => {
      const r2 = (n) => Math.round(n * 100) / 100;
      const dlg = document.querySelector("[data-testid=hours-dialog]");
      const body = dlg.querySelector(".whd-body");
      const bb = body.getBoundingClientRect();
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
      const all = (s) => [...dlg.querySelectorAll(s)];
      const uniq = (xs) => [...new Map(xs.map((x) => [JSON.stringify(x), x])).values()];
      const noteEl = dlg.querySelector("[data-testid=hours-week-note]");
      const more = body.hasAttribute("data-more");
      // The fade: the note's ::before in the whole week, the foot's ::before
      // in the weekday view (drawn up over the body's bottom edge).
      // `content: none` means it isn't drawn.
      const foot = dlg.querySelector(".whd-foot");
      const pseudo = getComputedStyle(noteEl ?? foot, "::before");
      // Where it ends, against the body's bottom edge (0 = at the edge) or
      // the note's top edge: `bottom` is measured from the host's own box.
      const hostTop = (noteEl ?? foot).getBoundingClientRect().top;
      const fadeBottom = hostTop - (parseFloat(pseudo.bottom) - (noteEl ?? foot).getBoundingClientRect().height);
      const fade = pseudo.content === "none" ? null : {
        on: noteEl ? "note::before" : "foot::before",
        height: pseudo.height, position: pseudo.position, image: pseudo.backgroundImage,
        endsAboveEdgeBy: r2((noteEl ? noteEl.getBoundingClientRect().top : bb.bottom) - fadeBottom), pointerEvents: pseudo.pointerEvents,
      };
      let note = null;
      if (noteEl) {
        const ls = lines(noteEl);
        const nb = noteEl.getBoundingClientRect();
        const week = dlg.querySelector(".whd-week").getBoundingClientRect();
        note = {
          lines: ls.length, boxTop: r2(nb.top - bb.top), boxBottom: r2(nb.bottom - bb.top),
          whole: ls.every((r) => r.top >= bb.top - 0.01 && r.bottom <= bb.bottom + 0.01),
          onTop: ls.every((r) => document.elementFromPoint(nb.left + 4, (r.top + r.bottom) / 2) === noteEl),
          coversChartBy: r2(Math.max(0, week.bottom - nb.top)),
        };
      }
      const sw = dlg.querySelector(".whd-key.is-unchecked");
      const swc = sw && getComputedStyle(sw);
      const sub = dlg.querySelector("[data-testid=hours-dialog-sub]");
      const texts = all("*").filter((e) => !e.classList.contains("sr-only") && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
      return {
        dialog: { w: r2(dlg.getBoundingClientRect().width), h: r2(dlg.getBoundingClientRect().height) },
        body: { clientHeight: body.clientHeight, scrollHeight: body.scrollHeight, scrollTop: r2(body.scrollTop), below: r2(body.scrollHeight - body.scrollTop - body.clientHeight), scrollWidth: body.scrollWidth, clientWidth: body.clientWidth },
        more, fade, note,
        sub: { text: sub.textContent, lines: lines(sub).length },
        legend: all(".whd-legend li").map((li) => li.textContent),
        legendLines: uniq(all(".whd-legend li").map((li) => Math.round(li.getBoundingClientRect().top))).length,
        footHeight: r2(dlg.querySelector(".whd-foot").getBoundingClientRect().height),
        hollowBars: all(".whd-yours.is-unchecked").length,
        solidBars: all(".whd-yours:not(.is-unchecked):not(.is-out)").length,
        swatch: sw ? { w: r2(sw.getBoundingClientRect().width), h: r2(sw.getBoundingClientRect().height), border: `${swc.borderTopWidth} ${swc.borderTopStyle} ${swc.borderTopColor}`, bg: swc.backgroundColor } : null,
        bar: uniq(all(".whd-yours.is-unchecked").map((e) => { const c = getComputedStyle(e); return `${c.borderTopWidth} ${c.borderTopStyle} ${c.borderTopColor}`; })),
        ground: getComputedStyle(dlg).backgroundColor,
        families: [...new Set(texts.map((e) => getComputedStyle(e).fontFamily.split(",")[0].trim()))],
        sizes: [...new Set(texts.map((e) => getComputedStyle(e).fontSize))].sort(),
      };
    });
    const axe = async () => {
      if (!(await p.evaluate(() => typeof window.axe !== "undefined"))) await p.addScriptTag({ path: AXE });
      return p.evaluate(async (sel) => (await window.axe.run(document.querySelector(sel))).violations.map((v) => ({ id: v.id, nodes: v.nodes.length })), D);
    };
    const scrollBody = async (to) => {
      await p.evaluate((to) => { const bd = document.querySelector(".whd-body"); bd.scrollTop = to === "end" ? bd.scrollHeight : to; }, to);
      await p.waitForTimeout(400);
    };
    const state = async (name, crop) => {
      for (const v of ["day", "week"]) {
        await hoursWindow(v);
        const atRest = { ...(await read()), axe: await axe(), under44: await small(p, D) };
        const S = ((L.states[name] ??= {})[v] = { atRest });
        if (crop) await p.locator(D).screenshot({ path: file(`${name}-${v}`) });
        if (atRest.body.below > 0) {
          await scrollBody("end");
          S.atEnd = await read();
          if (crop) await p.locator(D).screenshot({ path: file(`${name}-${v}-end`) });
          await scrollBody(0);
          S.backAtRest = await read();
        }
      }
      await closeWindow();
    };
    const step = async (name, fn) => {
      try { await fn(); } catch (e) {
        L.errors.push(`${name}: ${oneLine(e).slice(0, 300)}`);
        await p.screenshot({ path: path.join(EXTRA, `error-${klass}-${name}-${label}.png`) }).catch(() => {});
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
      const name = (s) => `561-class-${klass}-${s}`;
      // Mon to Sun, a night shift: with a class the weekend's bars are hollow
      // (no record); with none every bar is.  #556's worst-case subtitle.
      await step("night", async () => {
        await dates(p, "2026-12-07", "2026-12-13");
        await times(p, "20.5", "5.5");
        await state(name("night"), true);
      });
      // Mon to Fri, a day shift: with a class no bar is hollow, so no entry.
      await step("weekdays", async () => {
        await dates(p, "2026-12-07", "2026-12-11");
        await times(p, "9", "15");
        await state(name("weekdays"), klass === "set" && label !== "1440");
      });
    } catch (e) {
      L.errors.push(oneLine(e).slice(0, 400));
      await p.screenshot({ path: path.join(EXTRA, `error-${klass}-${label}.png`) }).catch(() => {});
    } finally {
      await b.close();
    }
    fs.writeFileSync(path.join(EV, `measures-${klass}-${label}.json`), JSON.stringify(L, null, 1));
    console.log(label, klass, "states:", Object.keys(L.states).join(", "), "errors:", L.errors.length ? L.errors.join(" | ") : "none");
  }
}
