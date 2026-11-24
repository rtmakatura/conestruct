// Mission ux-spacing-round (#555, #556, #557; tracking #558): production
// check on main ab73b3b.  The real site and backend, headless, signed out.
// Nothing is saved to an account, no download, no sign-in.  The map window's
// "Save and close" only puts the pin in the page's own state (as in
// ../../../ux-group7b-guesses-hours/issue-526/prod-check/script/walk-526-prod.mjs).
// The steps and selectors are the item walks' (../issue-555/script/lib.mjs,
// shots-hours.mjs; ../issue-556/script/shots-556.mjs;
// ../issue-557/script/shots-557.mjs); the sha gate, console, request and
// token code is issue-554-weak-match-notice/prod-check/script/walk-554-prod.mjs's.
//   node walk-558-prod.mjs <main checkout> <crops dir> <extra dir> <results json> <head sha> [widths]
// The gate token is read from <main>/conestruct/site/.env.local into
// GATE_BYPASS_TOKEN here and sent only by scripts/gate.cjs, to the site's own
// host; never printed, never written.
//
// Two parts per size, in one browser:
//   A  unmodified production data: no request or answer is touched (no route
//      is installed until part A is done).
//   B  two browser-side edits, as in the item walks: (1) the answer's weekend
//      is rewritten in the browser to "no closures"; (2) street_class is
//      taken out of the request the browser sends, so the real backend
//      answers `allowed: null`.  Each reading records its part.
//   A2 after part B: the routes are removed, the hours are set once more
//      (an unedited answer), then Where is reopened to read the collapsed
//      What row (and, at 390, the aerial's zoom, which shows only there).
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const [MAIN, CROPS, EXTRA, RESULTS, HEAD_SHA, ONLY] = process.argv.slice(2);
const envText = fs.readFileSync(path.join(MAIN, "conestruct/site/.env.local"), "utf8");
const tm = envText.match(/^\s*GATE_BYPASS_TOKEN\s*=\s*["']?([^"'\r\n]*)["']?\s*$/m);
if (!tm) throw new Error("GATE_BYPASS_TOKEN not in .env.local");
process.env.GATE_BYPASS_TOKEN = tm[1];
const TOKEN = tm[1];
const require = createRequire(path.join(MAIN, "package.json"));
const { newGatedContext, guardOutput, oneLine, gateHeaders, isSiteRequest, GATE_HEADER } = require(path.join(MAIN, "scripts/gate.cjs"));
guardOutput();
const { chromium } = require("playwright");
const AXE = fs.readFileSync(path.join(MAIN, "conestruct/site/node_modules/axe-core/axe.min.js"), "utf8");
const SITE = "https://www.conestruct.com";
const HEALTHZ = "https://rtmakatura--conestruct-render-fastapi-app.modal.run/healthz";
const SIZES = [[1440, 900], [1198, 930], [390, 844]].filter(([w]) => !ONLY || ONLY.split(",").includes(String(w)));
const W = "[data-testid=band-what]";
const D = "[data-testid=hours-dialog]";
const WHERE = "[data-testid=band-where]";
const TICKS = ["6 am", "noon", "6 pm", "midnight", "6 am"];
fs.mkdirSync(CROPS, { recursive: true });
fs.mkdirSync(EXTRA, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const prior = ONLY && fs.existsSync(RESULTS) ? JSON.parse(fs.readFileSync(RESULTS, "utf8")) : null;
const result = prior ?? { ranAt: new Date().toISOString(), site: SITE, headSha: HEAD_SHA, sizes: [] };
const save = () => {
  const ascii = JSON.stringify(result, null, 1).replace(/[\u0080-￿]/g, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`);
  fs.writeFileSync(RESULTS, `${ascii}\n`, "utf8");
};

// ---- The sha gate -------------------------------------------------------
{
  const hz = await (await fetch(HEALTHZ)).json();
  result.healthz = { status: hz.status, sha: hz.sha, equalsHead: hz.sha === HEAD_SHA };
  console.log(`healthz sha ${String(hz.sha)} equals head: ${result.healthz.equalsHead}`);
  if (!result.healthz.equalsHead) { save(); throw new Error("healthz sha is not the shipped main"); }
  const polls = [];
  let ok = false;
  for (let i = 0; i < 40 && !ok; i += 1) {
    let sha = null;
    let status = 0;
    try {
      const r = await fetch(`${SITE}/api/version`, { headers: gateHeaders(SITE), redirect: "manual", cache: "no-store" });
      status = r.status;
      if (r.ok) sha = (await r.json()).sha ?? null;
    } catch { status = -1; }
    polls.push({ status, sha });
    ok = sha === HEAD_SHA;
    if (!ok) await sleep(15000);
  }
  const last = polls[polls.length - 1];
  result.served = { route: "/api/version", polls: polls.length, status: last.status, sha: last.sha, isHead: last.sha === HEAD_SHA };
  console.log(`served /api/version sha ${String(last.sha)} after ${polls.length} poll(s): head ${result.served.isHead}`);
  if (!ok) { save(); throw new Error("the served frontend is not the shipped build"); }
}

for (const [w, h] of SIZES) {
  const rec = { size: `${w}x${h}`, step: "", part: "A", console: [], failed: [], chunkShas: [], nonGet: [], tokenChecks: 0, tokenHits: 0, errors: [], A: {}, B: {} };
  result.sizes = result.sizes.filter((s) => s.size !== rec.size);
  result.sizes.push(rec);
  const b = await chromium.launch();
  try {
    const ctx = await newGatedContext(b, SITE, { viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    p.on("request", (r) => {
      const u = new URL(r.url());
      if (r.method() !== "GET" && u.host === new URL(SITE).host) rec.nonGet.push({ part: rec.part, step: rec.step, method: r.method(), path: u.pathname });
    });
    const scripts = [];
    p.on("response", (r) => {
      const u = new URL(r.url());
      if (r.status() === 429) rec.failed.push(`${u.host} HTTP 429 ${u.pathname.slice(0, 40)}`);
      if (u.host !== new URL(SITE).host || !/^\/_next\/.*\.js$/.test(u.pathname)) return;
      scripts.push(r.text().then((t) => {
        for (const s of [HEAD_SHA, HEAD_SHA.slice(0, 7)]) if (t.includes(s) && !rec.chunkShas.includes(s)) rec.chunkShas.push(s);
        return true;
      }, () => false));
    });
    p.on("console", (msg) => { if (msg.type() === "error") rec.console.push({ step: rec.step, text: msg.text().slice(0, 160), url: (msg.location()?.url ?? "").split("?")[0].slice(0, 120) }); });
    p.on("pageerror", (e) => { rec.console.push({ step: rec.step, text: `pageerror: ${oneLine(e).slice(0, 160)}`, url: "" }); });
    p.on("requestfailed", (r) => { rec.failed.push(`${new URL(r.url()).host} ${r.failure()?.errorText ?? ""}`); });
    const tokenCheck = async () => {
      const stored = await p.evaluate(() => JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage), document.cookie]));
      const cookies = JSON.stringify(await ctx.cookies());
      const hay = [await p.content(), await p.evaluate(() => document.body.innerText), stored, cookies];
      rec.tokenChecks += 1;
      for (const t of hay) if (t.includes(TOKEN) || t.toLowerCase().includes(GATE_HEADER)) rec.tokenHits += 1;
    };
    const file = (dir, name) => path.join(dir, `prod-${w}-${name}.png`);
    const around = async (dir, name, sel, pad = 12) => {
      await p.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: "center" }), sel);
      await p.waitForTimeout(500);
      const r = await p.locator(sel).first().boundingBox();
      const x = Math.max(0, r.x - pad);
      const y = Math.max(0, r.y - pad);
      await p.screenshot({ path: file(dir, name), clip: { x, y, width: Math.min(w - x, r.width + 2 * pad), height: Math.min(h - y, r.height + 2 * pad) } });
    };
    const axe = async (sel) => {
      if (!(await p.evaluate(() => typeof window.axe !== "undefined"))) await p.addScriptTag({ content: AXE });
      return p.evaluate(async (s) => (await window.axe.run(document.querySelector(s))).violations.map((v) => `${v.id}(${v.nodes.length})`), sel);
    };
    // ---- The item walks' helpers (issue-555/script/lib.mjs) ----------------
    const settled = () => p.waitForFunction((sel) => {
      const t = document.querySelector(sel)?.innerText ?? "";
      return t && !/Checking/.test(t);
    }, W, { timeout: 90000 }).catch(() => {});
    const lb = async (id, value) => {
      await p.locator(`#${id}`).click();
      await p.waitForSelector("[role=listbox]", { timeout: 5000 });
      await p.locator(`[role=listbox] [role=option][data-value="${value}"]`).first().click();
      await p.waitForTimeout(1500);
    };
    const dates = async (a, z) => {
      await p.locator("#what-date").click();
      await p.waitForSelector("[data-testid=date-picker]");
      for (const d of [a, z]) {
        for (let i = 0; i < 3 && !(await p.locator(`[data-testid=date-picker] [data-date='${d}']`).count()); i += 1) {
          await p.locator("[data-testid=date-picker]").getByRole("button", { name: "Next month" }).click();
          await p.waitForTimeout(400);
        }
        await p.locator(`[data-testid=date-picker] [data-date='${d}']`).click();
        await p.waitForTimeout(400);
      }
      if (await p.locator("[data-testid=date-picker]").count()) await p.keyboard.press("Escape");
      await p.waitForTimeout(1000);
    };
    const times = async (a, z) => { await lb("sched-start", a); await lb("sched-end", z); await settled(); await p.waitForTimeout(2500); };
    const hoursWindow = async (view) => {
      if (!(await p.locator(D).count())) {
        await p.getByTestId("what-hours-all").click();
        await p.waitForSelector(D, { timeout: 10000 });
      }
      await p.getByTestId(`hours-view-${view}`).click();
      await p.waitForTimeout(700);
    };
    const closeWindow = async () => { await p.keyboard.press("Escape"); await p.waitForTimeout(700); };
    const small = (root) => p.evaluate((root) => {
      const r2 = (n) => Math.round(n * 100) / 100;
      return [...document.querySelectorAll(`${root} button, ${root} a[href], ${root} input, ${root} select, ${root} [role=radio], ${root} [role=button], ${root} summary, ${root} label.nyq-answer`)]
        .map((c) => ({ c, r: c.getBoundingClientRect() }))
        .filter(({ r }) => r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44))
        .map(({ c, r }) => `${(c.getAttribute("aria-label") || c.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40)} ${r2(r.width)}x${r2(r.height)}`);
    }, root);

    // ---- What the hours window draws, read from the page -------------------
    const chart = () => p.evaluate((sel) => {
      const r2 = (n) => Math.round(n * 100) / 100;
      const dlg = document.querySelector(sel);
      const body = dlg.querySelector(".whd-body");
      const bb = body.getBoundingClientRect();
      const all = (s) => [...dlg.querySelectorAll(s)];
      const isWeek = !dlg.querySelector(".whd-track");
      const css = (e) => { const c = getComputedStyle(e); return { cls: e.className, bg: c.backgroundColor, border: `${c.borderTopWidth} ${c.borderTopStyle}` }; };
      // A bar's start and length along the time scale, in px and as a share
      // of its track (ruler) or column (week), and whether the midnight line
      // of the same track or column falls inside it.
      const span = (bar, scale) => {
        const r = bar.getBoundingClientRect();
        const s = scale.getBoundingClientRect();
        const mid = scale.querySelector(".whd-midnight")?.getBoundingClientRect() ?? null;
        const a = isWeek ? r.top : r.left;
        const z = isWeek ? r.bottom : r.right;
        const s0 = isWeek ? s.top : s.left;
        const len = isWeek ? s.height : s.width;
        const m = mid ? (isWeek ? mid.top : mid.left) : null;
        return { ...css(bar), startPx: r2(a - s0), lengthPx: r2(z - a), startPct: r2(((a - s0) / len) * 100), lengthPct: r2(((z - a) / len) * 100), midnightPx: m === null ? null : r2(m - s0), crossesMidnight: m === null ? null : a < m - 0.5 && z > m + 0.5 };
      };
      const lines = (e) => {
        const range = document.createRange();
        range.selectNodeContents(e);
        const out = [];
        for (const r of range.getClientRects()) {
          const last = out[out.length - 1];
          if (last && Math.abs(last.top - r.top) < 2) last.bottom = Math.max(last.bottom, r.bottom); else out.push({ top: r.top, bottom: r.bottom, left: r.left, right: r.right });
        }
        return out;
      };
      const noteEl = dlg.querySelector("[data-testid=hours-week-note]");
      let note = null;
      if (noteEl) {
        const ls = lines(noteEl);
        const last = ls[ls.length - 1];
        const nb = noteEl.getBoundingClientRect();
        const dr = dlg.getBoundingClientRect();
        note = {
          text: noteEl.textContent,
          size: getComputedStyle(noteEl).fontSize,
          lines: ls.length,
          lastLine: { top: r2(last.top - bb.top), bottom: r2(last.bottom - bb.top) },
          box: { top: r2(nb.top - bb.top), bottom: r2(nb.bottom - bb.top), left: r2(nb.left - bb.left), right: r2(nb.right - bb.left) },
          bodyHeight: r2(bb.height),
          bodyWidth: r2(bb.width),
          // Whole = every line inside the body's box, the body inside the
          // window, the window inside the screen, and no sideways overflow.
          everyLineInsideBody: ls.every((l) => l.top >= bb.top - 0.01 && l.bottom <= bb.bottom + 0.01 && l.left >= bb.left - 0.01 && l.right <= bb.right + 0.01),
          bodyInsideWindow: bb.bottom <= dr.bottom + 0.01,
          windowInsideScreen: dr.top >= -0.01 && dr.bottom <= window.innerHeight + 0.01 && dr.left >= -0.01 && dr.right <= window.innerWidth + 0.01,
          noSidewaysOverflow: noteEl.scrollWidth <= noteEl.clientWidth && body.scrollWidth <= body.clientWidth,
          bodyScrolls: body.scrollHeight > body.clientHeight,
        };
      }
      const notice = dlg.querySelector("[data-testid=hours-class-notice]");
      const key = dlg.querySelector("[data-testid=hours-key-no-closures]");
      const swatch = key?.querySelector(".whd-key");
      const ruler = dlg.querySelector(".whd-track");
      const days = all("[data-testid=hours-week-day]");
      const firstBarTop = Math.min(...all(".whd-yours").map((e) => e.getBoundingClientRect().top));
      return {
        view: isWeek ? "week" : "day",
        dialog: { w: r2(dlg.getBoundingClientRect().width), h: r2(dlg.getBoundingClientRect().height) },
        body: { scrollWidth: body.scrollWidth, clientWidth: body.clientWidth, scrollHeight: body.scrollHeight, clientHeight: body.clientHeight },
        sub: dlg.querySelector("[data-testid=hours-dialog-sub]")?.textContent ?? null,
        verdict: dlg.querySelector("[data-testid=hours-verdict]")?.textContent ?? null,
        // The page may write "6 am" with a no-break space; it is read here as a plain space.
        ticks: all(".whd-tick, .whd-vticks span").map((e) => e.textContent.replace(/\s+/g, " ").trim()),
        ticksHaveNoBreakSpace: all(".whd-tick, .whd-vticks span").some((e) => e.textContent.includes(String.fromCharCode(160))),
        tickAt: all(".whd-tick, .whd-vticks span").map((e) => { const r = e.getBoundingClientRect(); return isWeek ? r2(r.top - bb.top) : r2(r.left - bb.left); }),
        midnightLines: all(".whd-midnight").length,
        clipElements: all(".whd-clip").length,
        arrows: (dlg.textContent.match(/[◂▸▴▾]/g) ?? []).length,
        ruler: ruler ? { track: { w: r2(ruler.getBoundingClientRect().width), h: r2(ruler.getBoundingClientRect().height) }, yours: [...ruler.querySelectorAll(".whd-yours")].map((e) => span(e, ruler)), bands: ruler.querySelectorAll(".whd-band").length } : null,
        week: days.map((d) => ({ name: d.querySelector(".whd-dayname")?.textContent ?? "", cls: d.className, colH: r2(d.querySelector(".whd-col").getBoundingClientRect().height), striped: d.querySelectorAll(".whd-closed").length, bands: d.querySelectorAll(".whd-band").length, yours: [...d.querySelectorAll(".whd-yours")].map((e) => span(e, d.querySelector(".whd-col"))) })),
        legend: all(".whd-legend li").map((li) => li.textContent.trim()),
        keyNoClosures: key ? { text: key.textContent.trim(), w: r2(key.getBoundingClientRect().width), h: r2(key.getBoundingClientRect().height), swatch: swatch ? { w: r2(swatch.getBoundingClientRect().width), h: r2(swatch.getBoundingClientRect().height), backgroundImage: getComputedStyle(swatch).backgroundImage.slice(0, 160), border: `${getComputedStyle(swatch).borderTopWidth} ${getComputedStyle(swatch).borderTopStyle}` } : null } : null,
        stripedDays: all(".whd-closed").length,
        notice: notice ? { text: notice.textContent, firstInBody: body.firstElementChild === notice, top: r2(notice.getBoundingClientRect().top - bb.top), bottom: r2(notice.getBoundingClientRect().bottom - bb.top), firstBarTop: r2(firstBarTop - bb.top), aboveBars: notice.getBoundingClientRect().bottom <= firstBarTop } : null,
        note,
      };
    }, D);
    // One state in both views.  `crops` names the views to keep in the
    // committed folder; the rest go to the extra folder.
    const state = async (part, name, crops = []) => {
      const out = {};
      for (const view of ["day", "week"]) {
        await hoursWindow(view);
        out[view] = { ...(await chart()), axe: await axe(D), under44: await small(D) };
        await p.locator(D).screenshot({ path: file(crops.includes(view) ? CROPS : EXTRA, `${name}-${view}`) });
      }
      rec[part][name] = out;
      await tokenCheck();
      await closeWindow();
      return out;
    };
    const step = async (name, fn) => {
      rec.step = name;
      try { await fn(); } catch (e) {
        rec.errors.push(`${name}: ${oneLine(e).slice(0, 300)}`);
        await p.screenshot({ path: file(EXTRA, `error-${name}`) }).catch(() => {});
        if (await p.locator(D).count()) await closeWindow().catch(() => {});
      }
    };
    // ---- #557's readers (issue-557/script/shots-557.mjs) -------------------
    const aerial = () => p.evaluate(() => {
      const frame = document.querySelector("[data-testid=band-aerial-frame]");
      if (!frame) return null;
      const fr = frame.getBoundingClientRect();
      const r2 = (n) => Math.round(n * 100) / 100;
      const zoom = [...document.querySelectorAll(".a-aerial-zbtn")].map((e) => { const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return { name: e.getAttribute("aria-label") ?? e.textContent.trim(), text: e.textContent.trim(), w: r2(r.width), h: r2(r.height), left: r2(r.left - fr.left), top: r2(r.top - fr.top), shown: r.width > 0 && r.height > 0 && c.visibility !== "hidden" && c.display !== "none" }; });
      return { frame: { w: r2(fr.width), h: r2(fr.height) }, zoom };
    });
    const factRow = (id) => p.evaluate((id) => {
      const r2 = (n) => Math.round(n * 100) / 100;
      const row = document.querySelector(`[data-testid=fact-${id}]`);
      const lk = document.querySelector(`[data-testid=fact-link-${id}]`);
      if (!row || !lk) return null;
      const rr = row.getBoundingClientRect();
      const lr = lk.getBoundingClientRect();
      const s = getComputedStyle(lk);
      return { row: { w: r2(rr.width), h: r2(rr.height) }, link: { textContent: lk.textContent, innerText: lk.innerText, name: lk.getAttribute("aria-label") ?? lk.textContent, w: r2(lr.width), h: r2(lr.height), family: s.fontFamily.split(",")[0].replace(/["']/g, "").trim(), size: s.fontSize, weight: s.fontWeight, color: s.color, transform: s.textTransform, tracking: s.letterSpacing } };
    }, id);
    const defaults = () => p.evaluate((root) => {
      const r2 = (n) => Math.round(n * 100) / 100;
      return [...document.querySelectorAll(`${root} .w-src[data-source=default]`)].filter((e) => e.getBoundingClientRect().width > 0).map((e) => {
        const r = e.getBoundingClientRect();
        const wr = e.querySelector(".w-src-word").getBoundingClientRect();
        return { testid: e.getAttribute("data-testid"), word: e.querySelector(".w-src-word").textContent, w: r2(r.width), h: r2(r.height), wordW: r2(wr.width) };
      });
    }, W);
    const hoursRow = () => p.evaluate(() => {
      const r2 = (n) => Math.round(n * 100) / 100;
      const row = document.querySelector("[data-testid=what-hours]");
      const lk = document.querySelector("[data-testid=what-hours-all]");
      if (!row || !lk) return null;
      // The lowest text above the link: in the grid above the row, and in the
      // row itself above the link's box (at 390 the link wraps under the
      // row's own sentence).
      const lr = lk.getBoundingClientRect();
      const inkOf = (root, skip) => {
        let ink = -Infinity;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        for (let t = walker.nextNode(); t; t = walker.nextNode()) {
          if (!t.textContent.trim() || (skip && skip.contains(t))) continue;
          const cs = getComputedStyle(t.parentElement);
          if (cs.visibility === "hidden" || cs.display === "none" || t.parentElement.closest(".sr-only")) continue;
          const rg = document.createRange();
          rg.selectNodeContents(t);
          for (const r of rg.getClientRects()) if (r.height > 0 && r.bottom <= lr.top + 12 && r.right > lr.left - 4 && r.left < lr.right + 4) ink = Math.max(ink, r.bottom);
        }
        return ink;
      };
      const s = getComputedStyle(lk);
      const ring = parseFloat(s.outlineWidth) + parseFloat(s.outlineOffset);
      const gridInk = inkOf(row.previousElementSibling, null);
      const rowInk = inkOf(row, lk);
      const focused = document.activeElement === lk && lk.matches(":focus-visible");
      const gap = (ink) => (Number.isFinite(ink) ? r2(lr.top - ring - ink) : "no text above the link here");
      return {
        row: { h: r2(row.getBoundingClientRect().height) },
        link: { w: r2(lr.width), h: r2(lr.height), text: lk.textContent, marginTop: s.marginTop },
        focused,
        outline: `${s.outlineWidth} ${s.outlineStyle} offset ${s.outlineOffset}`,
        ringTopToGridTextAbove: focused ? gap(gridInk) : "not measured",
        ringTopToRowSentenceAbove: focused ? gap(rowInk) : "not measured",
        record: document.querySelector("[data-testid=what-hours-record]")?.textContent ?? null,
      };
    });
    const focusByKeyboard = async (loc) => {
      await loc.focus();
      await p.keyboard.press("Shift+Tab");
      await p.keyboard.press("Tab");
      await p.waitForTimeout(300);
    };

    // =================== Part A: unmodified production data ===================
    rec.step = "open";
    await p.goto(`${SITE}/sandbox`, { waitUntil: "networkidle", timeout: 240000 });
    rec.landedOn = new URL(p.url()).pathname;
    await p.waitForSelector(".a-open .a-head", { timeout: 120000 });
    await p.evaluate(() => document.fonts.ready);

    rec.step = "pin";
    await p.getByRole("button", { name: /Pick on map|Edit on map/ }).first().click();
    await p.waitForSelector("[role=dialog] [data-testid=coords-bar]", { timeout: 30000 });
    await p.waitForFunction(() => document.querySelector("[role=dialog] .picker-map canvas"), null, { timeout: 60000 });
    await p.waitForTimeout(3000);
    const box = p.locator("[role=dialog]").getByLabel("Address, intersection or coordinates search");
    await box.fill("1550 E Colfax Ave, Denver");
    await box.press("Enter");
    await p.locator("[role=dialog] [data-testid=coords-bar]").getByText("Pin at").waitFor({ timeout: 45000 });
    {
      const panel = p.locator("[role=dialog] [data-testid=road-pick-panel]");
      const again = p.locator("[role=dialog] [data-testid=road-lookup-status]").getByRole("button", { name: "Try again" });
      for (let i = 0; ; i += 1) {
        await panel.or(again).first().waitFor({ timeout: 120000 });
        if ((await panel.count()) > 0 || i >= 4) break;
        await p.waitForTimeout(4000);
        await again.click();
        await p.waitForTimeout(500);
      }
    }
    await p.waitForTimeout(2500);
    const want = p.getByRole("dialog").getByRole("radio", { name: /Colfax/ });
    if (await want.count()) await want.first().click();
    await p.waitForTimeout(2000);
    await p.getByRole("button", { name: /Save (&|and) [Cc]lose/ }).click();
    await p.waitForSelector("[role=dialog]", { state: "detached", timeout: 30000 }).catch(() => {});
    await p.waitForSelector("[data-testid^=kind-chip-]", { state: "attached", timeout: 60000 });
    await p.waitForTimeout(2500);

    // ---- #557 e: the small aerial's +, - and Reset ---------------------------
    await step("aerial", async () => {
      await p.waitForSelector(".a-aerial-zbtn", { timeout: 30000 }).catch(() => {});
      await p.waitForTimeout(2500);
      const A = rec.A.aerial = { pinned: await aerial() };
      A.zoomShownPinned = await p.locator(".a-aerial-zbtn:visible").count();
      if (A.zoomShownPinned) {
        await p.locator(".a-aerial-zbtn[aria-label='Zoom in']").click();
        await p.waitForTimeout(2500);
        A.zoomedIn = await aerial();
        await p.locator("[data-testid=band-aerial-frame]").screenshot({ path: file(CROPS, "557-aerial-zoom-reset") });
        await p.locator(".a-aerial-reset").click();
        await p.waitForTimeout(2000);
      }
      A.under44Where = await small(WHERE);
      A.axeWhere = await axe(WHERE);
    });

    rec.step = "confirm";
    {
      const pick = (testid) => p.locator(`label.nyq-answer:has([data-testid=${testid}])`).first().click();
      await pick("kind-chip-shoulder");
      await p.waitForTimeout(1200);
      await p.locator("[data-testid=where-questions] .nyq-card .nyq-foot > button:last-child").click();
      await p.waitForSelector("[data-testid=side-option]", { state: "attached", timeout: 60000 });
      await p.waitForTimeout(1200);
      await pick("side-option");
      await p.waitForTimeout(1500);
      await p.locator("[data-testid=where-confirm]").click();
      await p.waitForSelector(W, { timeout: 120000 });
      await settled();
      await p.waitForTimeout(2000);
    }

    // ---- #557 d: "Change" on the collapsed Where row -------------------------
    await step("fact-where", async () => {
      rec.A.factWhere = await factRow("where");
      await around(CROPS, "557-where-row-change", "[data-testid=fact-where]", 12);
    });
    rec.jurisdictionByHand = false;
    if (!(await p.getByTestId("what-hours-all").count())) {
      if (!(await p.locator("#what-jurisdiction").isVisible().catch(() => false))) await p.getByTestId("what-measured-toggle").click();
      await p.waitForTimeout(600);
      await lb("what-jurisdiction", "denver");
      await settled();
      rec.jurisdictionByHand = true;
    }

    // ---- #557 g: the "Default" links -----------------------------------------
    await step("defaults", async () => {
      rec.A.defaults = await defaults();
      rec.A.under44What = await small(W);
      rec.A.axeWhat = await axe(W);
      if (rec.A.defaults.length) {
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
        await p.screenshot({ path: file(EXTRA, "557-default-links"), clip: { x, y, width: Math.min(w - x, r.r - r.x + 24), height: Math.min(h - y, r.b - r.y + 24) } });
      }
    });

    // ---- #555 and #556: Mon Dec 7 to Fri Dec 11, 9 am to 3 pm ----------------
    await step("day-9-15", async () => {
      await dates("2026-12-07", "2026-12-11");
      await times("9", "15");
      await state("A", "day-9-15", w === 390 ? ["week"] : []);
    });
    // ---- #556: the same dates, 7 am to 5 pm; #557 f: the hours link's ring ---
    await step("day-7-17", async () => {
      await times("7", "17");
      await focusByKeyboard(p.getByTestId("what-hours-all"));
      rec.A.hoursRing = { outside: await hoursRow() };
      await around(CROPS, "557-hours-link-ring", "[data-testid=what-hours]", 28);
      await p.evaluate(() => document.activeElement?.blur());
      await state("A", "day-7-17", w === 390 ? ["week"] : []);
    });
    // ---- #555 and #557: Mon Dec 7 to Sun Dec 13, 8 pm to 5 am ----------------
    await step("night-20-5", async () => {
      await dates("2026-12-07", "2026-12-13");
      await times("20", "5");
      await state("A", "night-20-5", ["day", "week"]);
    });
    // =================== Part B: browser-side edits ===========================
    rec.part = "B";
    const mode = { dropClass: false, closures: false };
    rec.B.edits = { closuresAnswersRewritten: 0, classRequestsStripped: 0 };
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
            rec.B.edits.classRequestsStripped += 1;
          }
          const resp = await r.fetch(opts);
          const body = await resp.json();
          const j = body?.breakdown?.jurisdiction ?? body?.jurisdiction;
          if (mode.closures && j?.hours_days?.kinds?.weekday) {
            j.hours_days.kinds.weekend = { ...j.hours_days.kinds.weekday, allowed: [], no_closures: true, status: "outside", outside: [[9, 15]], fix: null };
            j.hours_days.status = "outside";
            rec.B.edits.closuresAnswersRewritten += 1;
          }
          if (mode.dropClass && j?.hours_days) {
            rec.B.classUnsetAnswer = { missing: j.hours_days.missing, status: j.hours_days.status, kinds: Object.fromEntries(Object.entries(j.hours_days.kinds ?? {}).map(([k, v]) => [k, { allowed: v.allowed, record: v.record, no_closures: v.no_closures, status: v.status }])) };
          }
          const headers = { ...resp.headers() };
          delete headers["content-length"];
          delete headers["content-encoding"];
          return await r.fulfill({ status: resp.status(), headers, body: JSON.stringify(body) });
        } catch { return r.abort().catch(() => {}); }
      });
    }
    // ---- Edit 1: a no-closures weekend, Dec 7 to Dec 13, 9 am to 3 pm --------
    await step("no-closures", async () => {
      mode.closures = true;
      await times("9", "15");
      await hoursWindow("week");
      await p.locator(`${D} .whd-foot`).screenshot({ path: file(CROPS, "556-key-no-closures") }).catch(() => {});
      await state("B", "no-closures", ["week"]);
    });
    mode.closures = false;
    // ---- Edit 2: no street class, Dec 7 to Dec 13, 9 am to 2 pm --------------
    await step("class-unset", async () => {
      mode.dropClass = true;
      await times("9", "14");
      await state("B", "class-unset", ["day", "week"]);
    });
    mode.dropClass = false;

    // ---- #557 d: "Change" on the collapsed What row (Where reopened) ---------
    // Part B's two edits are switched off and their routes removed first, and
    // the hours are set once more so the page holds an unedited answer.
    await p.unrouteAll({ behavior: "wait" });
    rec.part = "A2";
    await step("fact-what", async () => {
      await times("9", "15");
      await p.evaluate(() => window.scrollTo(0, 0));
      await p.getByTestId("fact-link-where").click();
      await p.waitForTimeout(2500);
      rec.A.factWhat = await factRow("what");
      if (rec.A.factWhat) await around(CROPS, "557-what-row-change", "[data-testid=fact-what]", 12);
      rec.A.aerial.reopened = await aerial();
      rec.A.aerial.zoomShownReopened = await p.locator(".a-aerial-zbtn:visible").count();
      if (rec.A.aerial.zoomShownReopened && !rec.A.aerial.zoomedIn) {
        // 390: the zoom shows only here.  Zoom in once so Reset shows too.
        await p.locator(".a-aerial-zbtn[aria-label='Zoom in']").click();
        await p.waitForTimeout(2500);
        rec.A.aerial.zoomedIn = await aerial();
        await p.locator("[data-testid=band-aerial-frame]").screenshot({ path: file(CROPS, "557-aerial-zoom-reset") });
        await p.locator(".a-aerial-reset").click();
        await p.waitForTimeout(2000);
      }
      rec.A.under44Reopened = await small(".workbench");
      await tokenCheck();
    });

    rec.step = "done";
    const read = await Promise.all(scripts);
    rec.scripts = { loaded: read.length, read: read.filter(Boolean).length };
  } catch (e) {
    rec.errors.push(`at step ${rec.step}: ${oneLine(e).slice(0, 300)}`);
  } finally {
    await b.close();
  }
  rec.consoleErrors = rec.console.length;
  rec.http429 = rec.failed.filter((f) => / HTTP 429 /.test(f)).length;
  const failedBy = {};
  for (const f of rec.failed) failedBy[f] = (failedBy[f] ?? 0) + 1;
  rec.failedCounts = failedBy;
  delete rec.failed;
  const nonGetBy = {};
  for (const n of rec.nonGet) { const k = `${n.part} ${n.method} ${n.path}`; nonGetBy[k] = (nonGetBy[k] ?? 0) + 1; }
  rec.nonGetCounts = nonGetBy;
  delete rec.nonGet;

  // ---- The verdict: one named check per line of the brief -------------------
  const A = rec.A;
  const B = rec.B;
  const views = (s) => (s ? [s.day, s.week] : []);
  const sameTicks = (v) => !!v && JSON.stringify(v.ticks) === JSON.stringify(TICKS);
  const nightWeek = A["night-20-5"]?.week;
  const nightDay = A["night-20-5"]?.day;
  const dayWeek = A["day-9-15"]?.week;
  const dayDay = A["day-9-15"]?.day;
  const zoomNow = (A.aerial?.zoomedIn?.zoom ?? []).filter((z) => z.shown);
  const partAStates = ["day-9-15", "day-7-17", "night-20-5"];
  rec.verdict = {
    ran: rec.errors.length === 0,
    landedOnSandbox: rec.landedOn === "/sandbox",
    servedChunkCarriesSha: rec.chunkShas.length > 0,
    "555 five ticks, both views, 8 pm to 5 am": views(A["night-20-5"]).length === 2 && views(A["night-20-5"]).every(sameTicks),
    "555 five ticks, both views, 9 am to 3 pm": views(A["day-9-15"]).length === 2 && views(A["day-9-15"]).every(sameTicks),
    "555 night week: 7 days, one bar each, each across midnight": !!nightWeek && nightWeek.week.length === 7 && nightWeek.week.every((d) => d.yours.length === 1 && d.yours[0].crossesMidnight === true),
    "555 night ruler: one bar, across midnight": !!nightDay && nightDay.ruler?.yours.length === 1 && nightDay.ruler.yours[0].crossesMidnight === true,
    "555 day week: 5 days with one bar each, none across midnight": !!dayWeek && dayWeek.week.filter((d) => d.yours.length === 1).length === 5 && dayWeek.week.every((d) => d.yours.length <= 1 && d.yours.every((y) => y.crossesMidnight === false)),
    "555 day ruler: one bar, not across midnight": !!dayDay && dayDay.ruler?.yours.length === 1 && dayDay.ruler.yours[0].crossesMidnight === false,
    "555 axe 0 in the window, every part A reading": partAStates.every((s) => views(A[s]).length === 2 && views(A[s]).every((v) => v.axe.length === 0)),
    "556 week note whole, 9 am to 3 pm": !!dayWeek?.note && dayWeek.note.everyLineInsideBody && dayWeek.note.bodyInsideWindow && dayWeek.note.windowInsideScreen && dayWeek.note.noSidewaysOverflow,
    "556 week note whole, 7 am to 5 pm": (() => { const n = A["day-7-17"]?.week?.note; return !!n && n.everyLineInsideBody && n.bodyInsideWindow && n.windowInsideScreen && n.noSidewaysOverflow; })(),
    "556 (edit) key reads No closures allowed with a striped swatch, days striped": !!B["no-closures"]?.week?.keyNoClosures && B["no-closures"].week.keyNoClosures.text === "No closures allowed" && /repeating-linear-gradient/.test(B["no-closures"].week.keyNoClosures.swatch?.backgroundImage ?? "") && B["no-closures"].week.stripedDays > 0 && B.edits.closuresAnswersRewritten > 0,
    "556 no key entry for No closures on unmodified data": partAStates.every((s) => views(A[s]).every((v) => v.keyNoClosures === null && v.stripedDays === 0)),
    "556 (edit) no street class: notice first, bars hollow and dashed, both views": (() => {
      const s = B["class-unset"];
      if (!s || B.edits.classRequestsStripped === 0) return false;
      const bars = [...(s.day.ruler?.yours ?? []), ...s.week.week.flatMap((d) => d.yours)];
      return views(s).every((v) => v.notice && v.notice.firstInBody && v.notice.aboveBars) && bars.length > 0 && bars.every((y) => /is-unchecked/.test(y.cls) && y.bg === "rgba(0, 0, 0, 0)" && /dashed/.test(y.border));
    })(),
    "556 axe 0 in the window, both edits": ["no-closures", "class-unset"].every((s) => views(B[s]).length === 2 && views(B[s]).every((v) => v.axe.length === 0)),
    "557 Change on the Where row": !!A.factWhere && A.factWhere.link.innerText === "Change" && A.factWhere.link.transform === "none" && A.factWhere.link.h >= 44 && A.factWhere.link.w >= 44,
    "557 Change on the What row": !!A.factWhat && A.factWhat.link.innerText === "Change" && A.factWhat.link.transform === "none" && A.factWhat.link.h >= 44 && A.factWhat.link.w >= 44,
    "557 aerial +, - and Reset shown, each 44 px or more both ways": zoomNow.length === 3 && zoomNow.every((z) => z.w >= 44 && z.h >= 44),
    "557 hours link ring clear of the text above": !!A.hoursRing?.outside?.focused && [A.hoursRing.outside.ringTopToGridTextAbove, A.hoursRing.outside.ringTopToRowSentenceAbove].filter((g) => typeof g === "number").length > 0 && [A.hoursRing.outside.ringTopToGridTextAbove, A.hoursRing.outside.ringTopToRowSentenceAbove].filter((g) => typeof g === "number").every((g) => g > 0),
    "557 Default links 44 px or wider": (A.defaults ?? []).length > 0 && A.defaults.every((d) => d.w >= 44 && d.h >= 44),
    "557 no clip arrows, night week and ruler": !!nightWeek && !!nightDay && [nightWeek, nightDay].every((v) => v.arrows === 0 && v.clipElements === 0),
    no429: rec.http429 === 0,
    tokenNotInPage: rec.tokenChecks > 0 && rec.tokenHits === 0,
  };
  const failedChecks = Object.entries(rec.verdict).filter(([, v]) => !v).map(([k]) => k);
  console.log(`${rec.size}: ${rec.errors.length ? rec.errors.join(" | ") : "no errors"} | ${failedChecks.length ? `FAILED CHECKS ${failedChecks.join("; ")}` : "every check passed"}`);
  console.log(`  console errors ${rec.consoleErrors} | 429s ${rec.http429} | non-GET ${JSON.stringify(rec.nonGetCounts)} | chunk shas ${rec.chunkShas.map((s) => s.slice(0, 7)).join(",") || "none"} | token checks ${rec.tokenChecks} hits ${rec.tokenHits} | jurisdiction by hand ${rec.jurisdictionByHand}`);
  save();
}
result.finishedAt = new Date().toISOString();
result.pass = result.sizes.length === 3 && result.sizes.every((r) => Object.values(r.verdict).every(Boolean));
save();
console.log(`overall: ${result.pass ? "PASS" : "FAIL"}`);
