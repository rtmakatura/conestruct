// Mission coords-wrong-pin (#549) production check: #547 on main db810a0.
// The real site and backend, no stubs, read-only: nothing is saved ("Save
// and close" is never pressed); the search box changes only the page's own
// state.  Built from the local walk (../../issue-547/walk-script/
// walk547.mjs: the same measure, axe and crop code, the same three states)
// and the previous production check (../../../ux-map-window-tidy/prod-check/
// script/walk-546-prod.mjs: the live site, the sha gate, console and failed
// requests, the token in the page).
//   node walk-547-prod.mjs <main checkout> <crops dir> <extra dir> <results json> <head sha> <feat sha> <local walk.json>
// <head sha> is the shipped main; <feat sha> is the last site commit under
// it (#547's; the commits after it are docs only).
// The gate token is read from <main>/conestruct/site/.env.local into
// GATE_BYPASS_TOKEN here and sent only by scripts/gate.cjs, to the site's
// own host; never printed, never written.
//
// Before any browser: backend healthz sha == <head sha>; the site's
// /api/version sha is <head sha> or <feat sha> (polled up to 10 min).
// Per size, one browser, one window, three states: open /sandbox and "Pick
// on map" (no line) -> search "Lafayette, CO" (the coarse-match notice) ->
// search "139.7401, -104.9811" (latitude out of range, the refusal line).
// Each state is compared with the local walk's numbers for the same size.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const [MAIN, CROPS, EXTRA, RESULTS, HEAD_SHA, FEAT_SHA, LOCAL] = process.argv.slice(2);
const envText = fs.readFileSync(path.join(MAIN, "conestruct/site/.env.local"), "utf8");
const tm = envText.match(/^\s*GATE_BYPASS_TOKEN\s*=\s*["']?([^"'\r\n]*)["']?\s*$/m);
if (!tm) throw new Error("GATE_BYPASS_TOKEN not in .env.local");
process.env.GATE_BYPASS_TOKEN = tm[1];
const TOKEN = tm[1];
const require = createRequire(path.join(MAIN, "package.json"));
const { newGatedContext, guardOutput, oneLine, gateHeaders, GATE_HEADER } = require(path.join(MAIN, "scripts/gate.cjs"));
guardOutput();
const { chromium } = require("playwright");
const AXE = fs.readFileSync(path.join(MAIN, "conestruct/site/node_modules/axe-core/axe.min.js"), "utf8");
const SITE = "https://www.conestruct.com";
const HEALTHZ = "https://rtmakatura--conestruct-render-fastapi-app.modal.run/healthz";
const SIZES = [[1440, 900], [1198, 930], [390, 844]];
const STATES = ["noPin", "coarse", "outOfRange"];
const BOXES = ["map", "search", "rail", "bar", "column", "dialog", "list"];
const COARSE = "That search found a town or area. Tap the map on the road where the work starts.";
// What the served scripts are searched for.  A production build renames
// local variables, so the two state names are expected in 0 scripts whatever
// the build; the two string literals are the controls that the window's
// script was among those read.
const NEEDLES = { bearingWarning: "bearingWarning", coarseNotice: "coarseNotice", noticeText: "That search found a town or area", listClass: "mw-search-list" };
const local = JSON.parse(fs.readFileSync(LOCAL, "utf8"));
fs.mkdirSync(CROPS, { recursive: true });
fs.mkdirSync(EXTRA, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const result = { ranAt: new Date().toISOString(), site: SITE, headSha: HEAD_SHA, featSha: FEAT_SHA, sizes: [] };
const save = () => {
  const ascii = JSON.stringify(result, null, 1).replace(/[\u0080-￿]/g, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`);
  fs.writeFileSync(RESULTS, `${ascii}\n`, "utf8");
};

// ---- The sha gate -------------------------------------------------------
{
  const hz = await (await fetch(HEALTHZ)).json();
  result.healthz = { status: hz.status, sha: hz.sha, equalsHead: hz.sha === HEAD_SHA };
  console.log(`healthz sha ${String(hz.sha).slice(0, 7)} equals head: ${result.healthz.equalsHead}`);
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
    } catch (e) {
      status = -1;
    }
    polls.push({ status, sha });
    ok = sha === HEAD_SHA || sha === FEAT_SHA;
    if (!ok) await sleep(15000);
  }
  const last = polls[polls.length - 1];
  result.served = { route: "/api/version", polls: polls.length, status: last.status, sha: last.sha, isHead: last.sha === HEAD_SHA, isFeat: last.sha === FEAT_SHA };
  console.log(`served /api/version sha ${String(last.sha).slice(0, 7)} after ${polls.length} poll(s): head ${result.served.isHead} feat ${result.served.isFeat}`);
  if (!ok) { save(); throw new Error("the served frontend is not the shipped build"); }
}

async function axeDialog(p) {
  if (!(await p.evaluate(() => !!window.axe))) await p.addScriptTag({ content: AXE });
  return p.evaluate(async () => {
    const r = await window.axe.run({ include: [["[role=dialog]"]] }, { resultTypes: ["violations"] });
    return r.violations.map((v) => `${v.id}(${v.nodes.length})`);
  });
}

// walk547's measure, unchanged: boxes in the dialog's own frame (viewport
// rect plus the body scroller's scrollTop).
async function measure(p) {
  return p.evaluate(() => {
    const dlg = document.querySelector("[data-testid=coords-bar]").closest("[role=dialog]");
    const col = dlg.querySelector(".mw-map-col");
    const scroller = col.parentElement;
    const d = dlg.getBoundingClientRect();
    const r2 = (n) => Math.round(n * 100) / 100;
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r2(r.left - d.left), y: r2(r.top - d.top + scroller.scrollTop), w: r2(r.width), h: r2(r.height) };
    };
    const bar = dlg.querySelector("[data-testid=coords-bar]");
    const list = dlg.querySelector("[data-testid=search-list]");
    const ls = getComputedStyle(list);
    return {
      map: box(dlg.querySelector(".picker-map, .mw-map-off")),
      search: box(dlg.querySelector(".mw-search")),
      rail: box(dlg.querySelector(".mw-rail")),
      bar: box(bar),
      column: box(col),
      dialog: { w: r2(d.width), h: r2(d.height) },
      list: ls.display === "none" ? null : box(list),
      listDisplay: ls.display,
      listHtml: list.outerHTML,
      listChildren: list.children.length,
      scrollHeight: scroller.scrollHeight,
      barText: bar.textContent,
      flow: [...col.children].map((e) => e.className.split(" ")[0]),
    };
  });
}

// The window's map, found through React's fiber tree from its container.
function mapMoving(p) {
  return p.evaluate(() => {
    const el = document.querySelector("[role=dialog] .picker-map");
    if (!el) return false;
    const key = Object.keys(el).find((k) => k.startsWith("__reactFiber$"));
    let f = key ? el[key] : null;
    for (; f; f = f.return) {
      for (let h = f.memoizedState; h && typeof h === "object" && "next" in h; h = h.next) {
        const m = h.memoizedState?.current;
        if (m && typeof m.getZoom === "function" && typeof m.isMoving === "function") return m.isMoving();
      }
    }
    return false;
  });
}
async function settled(p) {
  for (let i = 0; i < 60; i += 1) {
    await p.waitForTimeout(250);
    if (!(await mapMoving(p))) return;
  }
}

// The search row, its list and 150 px of what is under them.
async function shootSearch(p, dir, w, name) {
  const s = await p.locator("[role=dialog] .mw-search").boundingBox();
  const vw = p.viewportSize().width;
  await p.screenshot({ path: path.join(dir, `prod-${w}-${name}.png`), clip: { x: Math.max(0, s.x), y: Math.max(0, s.y), width: Math.min(s.width, vw - s.x), height: s.height + 150 } });
}

// walk547 --compare, one state against the local walk's same state.
function compare(mine, theirs) {
  const diffs = [];
  let px = 0;
  for (const k of BOXES) {
    const x = theirs[k];
    const y = mine[k];
    if (!x !== !y) { px = Infinity; diffs.push(`${k}: shown in one run only`); continue; }
    if (!x) continue;
    for (const f of ["x", "y", "w", "h"]) {
      const d = Math.abs((x[f] ?? 0) - (y[f] ?? 0));
      if (d > 0) diffs.push(`${k}.${f}: local ${x[f]} prod ${y[f]}`);
      px = Math.max(px, d);
    }
  }
  const sh = Math.abs(theirs.scrollHeight - mine.scrollHeight);
  if (sh > 0) diffs.push(`scrollHeight: local ${theirs.scrollHeight} prod ${mine.scrollHeight}`);
  px = Math.max(px, sh);
  const strip = (s) => { const { axe, ...rest } = s; return rest; };
  return {
    largestPx: px === Infinity ? "a box shown in one run only" : Math.round(px * 100) / 100,
    diffs,
    listHtmlSame: theirs.listHtml === mine.listHtml && theirs.listDisplay === mine.listDisplay,
    barTextSame: theirs.barText === mine.barText,
    flowSame: JSON.stringify(theirs.flow) === JSON.stringify(mine.flow),
    everyValueSame: JSON.stringify(strip(theirs)) === JSON.stringify(strip(mine)),
  };
}

for (const [w, h] of SIZES) {
  const rec = { size: `${w}x${h}`, step: "", console: [], failed: [], chunkShas: [], nonGet: [], tokenChecks: 0, tokenHits: 0, states: {}, vsLocal: {} };
  result.sizes.push(rec);
  const b = await chromium.launch();
  try {
    const ctx = await newGatedContext(b, SITE, { viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    const posts = { geocode: 0, roads: 0 };
    p.on("request", (r) => {
      const u = new URL(r.url());
      if (r.method() === "POST" && u.pathname.includes("/api/geocode")) posts.geocode += 1;
      if (r.method() === "POST" && u.pathname.includes("/api/road-bearing")) posts.roads += 1;
      if (r.method() !== "GET" && u.host === new URL(SITE).host) rec.nonGet.push({ step: rec.step, method: r.method(), path: u.pathname });
    });
    // Every script the page loads from the site's /_next/: the shas it
    // carries and the names and strings it holds.
    const scripts = [];
    p.on("response", (r) => {
      const u = new URL(r.url());
      if (r.status() === 429) rec.failed.push(`${u.host} HTTP 429 ${u.pathname.slice(0, 40)}`);
      if (u.host !== new URL(SITE).host || !/^\/_next\/.*\.js$/.test(u.pathname)) return;
      scripts.push(r.text().then((t) => {
        for (const s of [HEAD_SHA, FEAT_SHA, HEAD_SHA.slice(0, 7), FEAT_SHA.slice(0, 7)]) if (t.includes(s) && !rec.chunkShas.includes(s)) rec.chunkShas.push(s);
        return { read: true, ...Object.fromEntries(Object.entries(NEEDLES).map(([k, v]) => [k, t.includes(v)])) };
      }, () => ({ read: false })));
    });
    p.on("console", (msg) => { if (msg.type() === "error") rec.console.push({ step: rec.step, text: msg.text().slice(0, 160), url: (msg.location()?.url ?? "").split("?")[0].slice(0, 120) }); });
    p.on("pageerror", (e) => { rec.console.push({ step: rec.step, text: `pageerror: ${oneLine(e).slice(0, 160)}`, url: "" }); });
    p.on("requestfailed", (r) => { rec.failed.push(`${new URL(r.url()).host} ${r.failure()?.errorText ?? ""}`); });
    const dlg = p.locator("[role=dialog]");
    const box = dlg.getByLabel("Address, intersection or coordinates search");
    // The token in the page: its HTML, its text, what it stored, its cookies.
    // Compared here, in Node; only the count is kept.
    const tokenCheck = async () => {
      const stored = await p.evaluate(() => JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage), document.cookie]));
      const cookies = JSON.stringify(await ctx.cookies());
      const hay = [await p.content(), await p.evaluate(() => document.body.innerText), stored, cookies];
      rec.tokenChecks += 1;
      for (const t of hay) if (t.includes(TOKEN) || t.toLowerCase().includes(GATE_HEADER)) rec.tokenHits += 1;
    };
    const state = async (name) => {
      rec.states[name] = { ...(await measure(p)), axe: await axeDialog(p) };
      await tokenCheck();
    };

    rec.step = "0 open";
    await p.goto(`${SITE}/sandbox`, { waitUntil: "networkidle", timeout: 240000 });
    rec.landedOn = new URL(p.url()).pathname;
    await p.waitForSelector(".a-open .a-head", { timeout: 120000 });
    await p.getByRole("button", { name: "Pick on map" }).first().click();
    await p.waitForSelector("[role=dialog] [data-testid=coords-bar]", { timeout: 30000 });
    await p.waitForFunction(() => document.querySelector("[role=dialog] .picker-map canvas"), null, { timeout: 60000 });
    await settled(p);
    await p.waitForTimeout(1500);
    rec.inter = await p.evaluate(async () => { await document.fonts.ready; return [...document.fonts].some((f) => /inter/i.test(f.family) && f.status === "loaded"); });

    rec.step = "1 no pin";
    await state("noPin");
    await shootSearch(p, EXTRA, w, "no-line");

    rec.step = "2 coarse search";
    await box.fill("Lafayette, CO");
    await box.press("Enter");
    await dlg.getByText(COARSE).waitFor({ timeout: 30000 });
    await settled(p);
    await p.waitForTimeout(2000); // tiles at the town's zoom
    await state("coarse");
    await shootSearch(p, CROPS, w, "coarse-notice");

    rec.step = "3 out of range";
    await box.fill("139.7401, -104.9811");
    await box.press("Enter");
    await dlg.locator("[data-testid=search-list] .mw-note-fail").waitFor({ timeout: 15000 });
    await p.waitForTimeout(500);
    await state("outOfRange");
    rec.outOfRangeText = await dlg.locator("[data-testid=search-list]").innerText();
    await shootSearch(p, CROPS, w, "out-of-range");

    rec.step = "4 done";
    const read = await Promise.all(scripts);
    rec.posts = posts;
    rec.scripts = { loaded: read.length, read: read.filter((r) => r.read).length, ...Object.fromEntries(Object.keys(NEEDLES).map((k) => [k, read.filter((r) => r[k]).length])) };
  } catch (e) {
    rec.error = `at step ${rec.step}: ${oneLine(e).slice(0, 300)}`;
  } finally {
    await b.close();
  }
  const loc = local.find((r) => r.size === rec.size);
  for (const s of STATES) if (rec.states[s] && loc?.states[s]) rec.vsLocal[s] = compare(rec.states[s], loc.states[s]);
  rec.consoleErrors = rec.console.length;
  rec.consoleTelemetry = rec.console.filter((c) => /events\.mapbox\.com/.test(`${c.text} ${c.url}`)).length;
  rec.http429 = rec.failed.filter((f) => / HTTP 429 /.test(f)).length;
  const failedBy = {};
  for (const f of rec.failed) failedBy[f] = (failedBy[f] ?? 0) + 1;
  rec.failedCounts = failedBy;
  delete rec.failed;
  const all = STATES.every((s) => rec.states[s]);
  rec.verdict = {
    ran: !rec.error && all,
    landedOnSandbox: rec.landedOn === "/sandbox",
    servedChunkCarriesSha: rec.chunkShas.length > 0,
    noLineListHiddenAndEmpty: all && rec.states.noPin.listDisplay === "none" && rec.states.noPin.listChildren === 0,
    noticeIsOneChild: all && rec.states.coarse.listChildren === 1 && rec.states.coarse.listHtml.includes(COARSE),
    outOfRangeIsOneChild: all && rec.states.outOfRange.listChildren === 1,
    pxVsLocalZero: all && STATES.every((s) => rec.vsLocal[s]?.largestPx === 0),
    listHtmlVsLocalSame: all && STATES.every((s) => rec.vsLocal[s]?.listHtmlSame),
    mapAndBarSameInAllStates: all && STATES.every((s) => ["map", "search", "rail", "bar"].every((k) => JSON.stringify(rec.states[s][k]) === JSON.stringify(rec.states.noPin[k]))),
    noScriptNamesBearingWarning: rec.scripts?.bearingWarning === 0,
    controlStringFound: (rec.scripts?.noticeText ?? 0) > 0,
    axeZero: all && STATES.every((s) => rec.states[s].axe.length === 0),
    noConsoleErrorsBesidesMapboxTelemetry: rec.consoleErrors - rec.consoleTelemetry === 0,
    no429: rec.http429 === 0,
    oneGeocodePostNoRoadPost: rec.posts?.geocode === 1 && rec.posts?.roads === 0,
    onlyGeocodeNonGet: rec.nonGet.every((n) => n.method === "POST" && n.path === "/api/geocode"),
    tokenNotInPage: rec.tokenChecks === 3 && rec.tokenHits === 0,
  };
  const failedChecks = Object.entries(rec.verdict).filter(([, v]) => !v).map(([k]) => k);
  console.log(`${rec.size}: ${rec.error ?? "ok"} | ${failedChecks.length ? `FAILED CHECKS ${failedChecks.join(", ")}` : "every check passed"}`);
  console.log(`  Inter ${rec.inter} | ${STATES.map((s) => (rec.states[s] ? `${s}: list ${rec.states[s].list ? `${rec.states[s].list.w}x${rec.states[s].list.h} at ${rec.states[s].list.x},${rec.states[s].list.y}` : rec.states[s].listDisplay} children ${rec.states[s].listChildren} map ${rec.states[s].map.y},${rec.states[s].map.h} bar ${rec.states[s].bar.y} axe ${rec.states[s].axe.length ? rec.states[s].axe.join(",") : 0} | vs local px ${rec.vsLocal[s]?.largestPx} html same ${rec.vsLocal[s]?.listHtmlSame} all same ${rec.vsLocal[s]?.everyValueSame}${rec.vsLocal[s]?.diffs.length ? ` [${rec.vsLocal[s].diffs.join("; ")}]` : ""}` : `${s}: not reached`)).join("\n  ")}`);
  console.log(`  scripts ${JSON.stringify(rec.scripts)} chunk shas ${rec.chunkShas.map((s) => s.slice(0, 7)).join(",") || "none"} | posts ${JSON.stringify(rec.posts)} nonGet ${rec.nonGet.length} | console errors ${rec.consoleErrors} (mapbox telemetry ${rec.consoleTelemetry}) | failed ${JSON.stringify(rec.failedCounts)} | token checks ${rec.tokenChecks} hits ${rec.tokenHits}`);
  for (const c of rec.console) console.log(`    console [${c.step}] ${c.text} ${c.url}`);
  save();
}
result.finishedAt = new Date().toISOString();
result.pass = result.sizes.length === SIZES.length && result.sizes.every((r) => Object.values(r.verdict).every(Boolean));
save();
console.log(`overall: ${result.pass ? "PASS" : "FAIL"}`);
