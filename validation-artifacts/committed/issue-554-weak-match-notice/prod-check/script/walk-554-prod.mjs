// #554 (with #553) production check on main 5d89bb5.
// The real site and backend, no stubs, read-only: nothing is saved ("Save
// and close" is never pressed); the search box and the pin change only the
// page's own state.  The sha gate, console, failed-request, axe and token
// code is validation-artifacts/committed/missions/coords-wrong-pin/
// issue-548/prod-check/script/walk-548-prod.mjs's.
//   node walk-554-prod.mjs <main checkout> <crops dir> <extra dir> <results json> <head sha>
// The gate token is read from <main>/conestruct/site/.env.local into
// GATE_BYPASS_TOKEN here and sent only by scripts/gate.cjs, to the site's
// own host; never printed, never written.
//
// Before any browser: backend healthz sha == <head sha>; the site's
// /api/version sha == <head sha> (polled up to 10 min).
// Per size, one browser, one window per text (opened with "Pick on map",
// closed with Escape, so every text starts with no pin):
//   weak      "39 N, 44.4", "105° W, 39.7401": one POST /api/geocode (200),
//             the "Closest match: <place>. Check the pin before you go on."
//             notice, no pin, no marker, no road lookup.
//   town      "Lafayette, CO": one geocode (200), the town notice, no pin.
//   address   "1437 Bannock St, Denver": one geocode (200), a pin, no notice.
//   pinned    "39.7401, -104.9811": no geocode request, the pin (control).
//   notpair   "39° 44.' N, 104° 58.' W" (#553): searched, not pinned at
//             39.7333, -104.9667.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const [MAIN, CROPS, EXTRA, RESULTS, HEAD_SHA] = process.argv.slice(2);
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
const PIN_TEXT = "Pin at 39.7401, -104.9811";
const NO_PIN_TEXT = "No pin yet";
const CHOICE = "Did you mean 39.7401, -104.9811?";
// The search box's own lines (#541), which a searched text must not get.
const PARSER_LINE = /must be between|Did you mean|Use decimal degrees/;
// kind, a short name, the text typed, and for a searched text the place the
// base (216a03b) pinned it or read it at.
const WEAK = (place) => `Closest match: ${place}. Check the pin before you go on.`;
const TOWN_NOTICE = "That search found a town or area. Tap the map on the road where the work starts.";
// kind, a short name, the text typed, and what the list must read.  The two
// places are the ones recorded in ../probe/mapbox-answers.json.
const TEXTS = [
  { kind: "weak", name: "weak-39n", text: "39 N, 44.4", notice: WEAK("39 North Main Street, Holly, Colorado 81047") },
  { kind: "weak", name: "weak-105w", text: "105° W, 39.7401", notice: WEAK("W Boulevard, Walsh, Kansas 81090") },
  { kind: "town", name: "town", text: "Lafayette, CO", notice: TOWN_NOTICE },
  { kind: "address", name: "address", text: "1437 Bannock St, Denver" },
  { kind: "pinned", name: "decimal-pair", text: "39.7401, -104.9811" },
  { kind: "notpair", name: "minutes-no-digit", text: "39° 44.' N, 104° 58.' W", wrong: [39.7333, -104.9667] },
];
const SEARCHED = ["weak", "town", "address", "notpair"];
fs.mkdirSync(CROPS, { recursive: true });
fs.mkdirSync(EXTRA, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const result = { ranAt: new Date().toISOString(), site: SITE, headSha: HEAD_SHA, sizes: [] };
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
    ok = sha === HEAD_SHA;
    if (!ok) await sleep(15000);
  }
  const last = polls[polls.length - 1];
  result.served = { route: "/api/version", polls: polls.length, status: last.status, sha: last.sha, isHead: last.sha === HEAD_SHA };
  console.log(`served /api/version sha ${String(last.sha).slice(0, 7)} after ${polls.length} poll(s): head ${result.served.isHead}`);
  if (!ok) { save(); throw new Error("the served frontend is not the shipped build"); }
}

async function axeDialog(p) {
  if (!(await p.evaluate(() => !!window.axe))) await p.addScriptTag({ content: AXE });
  return p.evaluate(async () => {
    const r = await window.axe.run({ include: [["[role=dialog]"]] }, { resultTypes: ["violations"] });
    return r.violations.map((v) => `${v.id}(${v.nodes.length})`);
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

// "Pin at 39.7401, -104.9811" -> [39.7401, -104.9811]; anything else null.
function pinOf(barText) {
  const m = /^Pin at (-?\d+(?:\.\d+)?), (-?\d+(?:\.\d+)?)/.exec(barText);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

for (const [w, h] of SIZES) {
  const rec = { size: `${w}x${h}`, step: "", console: [], failed: [], chunkShas: [], nonGet: [], tokenChecks: 0, tokenHits: 0, texts: [] };
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
    const scripts = [];
    p.on("response", (r) => {
      const u = new URL(r.url());
      if (r.status() === 429) rec.failed.push(`${u.host} HTTP 429 ${u.pathname.slice(0, 40)}`);
      if (u.host !== new URL(SITE).host || !/^\/_next\/.*\.js$/.test(u.pathname)) return;
      scripts.push(r.text().then((t) => {
        for (const s of [HEAD_SHA, HEAD_SHA.slice(0, 7)]) if (t.includes(s) && !rec.chunkShas.includes(s)) rec.chunkShas.push(s);
        // The new notice's words: in no script of the base build.
        return { read: true, closestMatch: t.includes("Closest match: "), didYouMean: t.includes("Did you mean") };
      }, () => ({ read: false })));
    });
    p.on("console", (msg) => { if (msg.type() === "error") rec.console.push({ step: rec.step, text: msg.text().slice(0, 160), url: (msg.location()?.url ?? "").split("?")[0].slice(0, 120) }); });
    p.on("pageerror", (e) => { rec.console.push({ step: rec.step, text: `pageerror: ${oneLine(e).slice(0, 160)}`, url: "" }); });
    p.on("requestfailed", (r) => { rec.failed.push(`${new URL(r.url()).host} ${r.failure()?.errorText ?? ""}`); });
    const dlg = p.locator("[role=dialog]");
    const box = dlg.getByLabel("Address, intersection or coordinates search");
    const bar = dlg.locator("[data-testid=coords-bar]");
    const list = dlg.locator("[data-testid=search-list]");
    const markers = () => p.locator("[role=dialog] .picker-map .mapboxgl-marker").count();
    const tokenCheck = async () => {
      const stored = await p.evaluate(() => JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage), document.cookie]));
      const cookies = JSON.stringify(await ctx.cookies());
      const hay = [await p.content(), await p.evaluate(() => document.body.innerText), stored, cookies];
      rec.tokenChecks += 1;
      for (const t of hay) if (t.includes(TOKEN) || t.toLowerCase().includes(GATE_HEADER)) rec.tokenHits += 1;
    };
    const shootSearch = async (dir, name) => {
      const s = await dlg.locator(".mw-search").boundingBox();
      await p.screenshot({ path: path.join(dir, `prod-${w}-${name}.png`), clip: { x: Math.max(0, s.x), y: Math.max(0, s.y), width: Math.min(s.width, w - s.x), height: s.height + 150 } });
    };
    const shootWindow = async (name) => {
      const d = await dlg.boundingBox();
      await p.screenshot({ path: path.join(EXTRA, `prod-${w}-${name}-window.png`), clip: { x: Math.max(0, d.x), y: Math.max(0, d.y), width: Math.min(d.width, w - d.x), height: Math.min(d.height, h - d.y) } });
    };
    const openWindow = async () => {
      await p.getByRole("button", { name: "Pick on map" }).first().click();
      await p.waitForSelector("[role=dialog] [data-testid=coords-bar]", { timeout: 30000 });
      await p.waitForFunction(() => document.querySelector("[role=dialog] .picker-map canvas"), null, { timeout: 60000 });
      await settled(p);
      await p.waitForTimeout(1000);
    };

    rec.step = "0 open";
    await p.goto(`${SITE}/sandbox`, { waitUntil: "networkidle", timeout: 240000 });
    rec.landedOn = new URL(p.url()).pathname;
    await p.waitForSelector(".a-open .a-head", { timeout: 120000 });

    for (const t of TEXTS) {
      rec.step = `${t.kind} ${t.name}`;
      const row = { kind: t.kind, name: t.name, typed: t.text };
      rec.texts.push(row);
      await openWindow();
      row.barBefore = await bar.textContent();
      row.markersBefore = await markers();
      const g0 = posts.geocode;
      const r0 = posts.roads;
      await box.fill(t.text);
      row.boxValue = await box.inputValue();
      if (SEARCHED.includes(t.kind)) {
        const [resp] = await Promise.all([
          p.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname.includes("/api/geocode"), { timeout: 30000 }).catch(() => null),
          box.press("Enter"),
        ]);
        row.geocodeStatus = resp ? resp.status() : null;
        await settled(p);
        await p.waitForTimeout(2500);
      } else {
        await box.press("Enter");
        await bar.getByText("Pin at").waitFor({ timeout: 15000 }).catch(() => {});
        await settled(p);
        await p.waitForTimeout(2500);
      }
      row.geocodeRequests = posts.geocode - g0;
      row.roadLookups = posts.roads - r0;
      row.barText = await bar.textContent();
      row.pin = pinOf(row.barText);
      row.markers = await markers();
      row.listText = (await list.innerText()).trim();
      row.failLine = (await list.locator(".mw-note-fail").count()) > 0;
      row.choiceShown = (await dlg.getByRole("button", { name: CHOICE }).count()) > 0;
      row.axe = await axeDialog(p);
      await tokenCheck();
      const nothingMoved = row.barText === NO_PIN_TEXT && row.markers === 0 && row.roadLookups === 0;
      if (t.kind === "weak" || t.kind === "town") {
        // The notice, word for word, and nothing placed.  A town recentres
        // the map (#513); the camera is not measured here.
        row.ok = row.geocodeRequests === 1 && row.geocodeStatus === 200 && row.listText === t.notice && !row.failLine && nothingMoved;
      } else if (t.kind === "address") {
        row.ok = row.geocodeRequests === 1 && row.geocodeStatus === 200 && row.pin !== null && row.markers === 1 && row.listText === "";
      } else if (t.kind === "pinned") {
        row.ok = row.geocodeRequests === 0 && row.barText === PIN_TEXT && row.markers === 1 && !row.failLine;
      } else {
        // #553: searched, whatever the geocoder then says, and no pin at
        // the place the old parser read.
        row.pinAtWrongPlace = !!(row.pin && Math.abs(row.pin[0] - t.wrong[0]) < 0.01 && Math.abs(row.pin[1] - t.wrong[1]) < 0.01);
        row.parserLine = PARSER_LINE.test(row.listText);
        row.ok = row.geocodeRequests === 1 && [200, 404, 422].includes(row.geocodeStatus) && !row.pinAtWrongPlace && !row.parserLine;
      }
      await shootSearch(["weak-39n", "weak-105w"].includes(t.name) ? CROPS : EXTRA, t.name);
      await shootWindow(t.name);
      await p.keyboard.press("Escape");
      await dlg.waitFor({ state: "detached", timeout: 15000 });
    }

    rec.step = "done";
    const read = await Promise.all(scripts);
    rec.posts = posts;
    rec.scripts = { loaded: read.length, read: read.filter((r) => r.read).length, closestMatch: read.filter((r) => r.closestMatch).length, didYouMean: read.filter((r) => r.didYouMean).length };
  } catch (e) {
    rec.error = `at step ${rec.step}: ${oneLine(e).slice(0, 300)}`;
  } finally {
    await b.close();
  }
  rec.consoleErrors = rec.console.length;
  rec.consoleTelemetry = rec.console.filter((c) => /events\.mapbox\.com/.test(`${c.text} ${c.url}`)).length;
  // Chromium logs a 404 or 422 answer as a console error; the geocoder's
  // own "no match" and "outside Colorado" answers are those.
  rec.consoleGeocodeAnswers = rec.console.filter((c) => /status of (404|422)/.test(c.text) && c.url.endsWith("/api/geocode")).length;
  rec.http429 = rec.failed.filter((f) => / HTTP 429 /.test(f)).length;
  const failedBy = {};
  for (const f of rec.failed) failedBy[f] = (failedBy[f] ?? 0) + 1;
  rec.failedCounts = failedBy;
  delete rec.failed;
  const all = rec.texts.length === TEXTS.length && rec.texts.every((r) => "ok" in r);
  const of = (kind) => rec.texts.filter((r) => r.kind === kind);
  rec.verdict = {
    ran: !rec.error && all,
    landedOnSandbox: rec.landedOn === "/sandbox",
    servedChunkCarriesSha: rec.chunkShas.length > 0,
    everyWindowOpenedWithNoPin: all && rec.texts.every((r) => r.barBefore === NO_PIN_TEXT && r.markersBefore === 0),
    weakMatchesGetTheNoticeAndNothingMoves: all && of("weak").length === 2 && of("weak").every((r) => r.ok),
    townKeepsTheTownNoticeAndNoPin: all && of("town").every((r) => r.ok),
    streetAddressPinsWithNoNotice: all && of("address").every((r) => r.ok),
    pairPinnedWithNoGeocode: all && of("pinned").every((r) => r.ok),
    minutesWithNoDigitAreSearched: all && of("notpair").every((r) => r.ok),
    noticeWordsInAScript: (rec.scripts?.closestMatch ?? 0) > 0,
    axeZero: all && rec.texts.every((r) => r.axe.length === 0),
    noConsoleErrorsBesidesGeocoderAnswers: rec.consoleErrors - rec.consoleTelemetry - rec.consoleGeocodeAnswers === 0,
    geocoderAnswerErrorsMatchStatuses: rec.consoleGeocodeAnswers === rec.texts.filter((r) => SEARCHED.includes(r.kind) && r.geocodeStatus !== 200).length,
    no429: rec.http429 === 0,
    geocodePostsEqualSearchedTexts: rec.posts?.geocode === rec.texts.filter((r) => SEARCHED.includes(r.kind)).length,
    onlyReadPosts: rec.nonGet.every((n) => n.method === "POST" && ["/api/geocode", "/api/road-bearing", "/api/render/corridor-geometry"].includes(n.path)),
    tokenNotInPage: rec.tokenChecks === TEXTS.length && rec.tokenHits === 0,
  };
  const failedChecks = Object.entries(rec.verdict).filter(([, v]) => !v).map(([k]) => k);
  console.log(`${rec.size}: ${rec.error ?? "ok"} | ${failedChecks.length ? `FAILED CHECKS ${failedChecks.join(", ")}` : "every check passed"}`);
  for (const r of rec.texts) console.log(`  ${r.kind} [${r.typed}]: geocode ${r.geocodeRequests}${r.geocodeStatus ? ` (HTTP ${r.geocodeStatus})` : ""} roads ${r.roadLookups} | bar "${r.barText}" markers ${r.markers} | list "${(r.listText ?? "").replace(/\s+/g, " ").slice(0, 110)}" | choice ${r.choiceShown} fail line ${r.failLine} | axe ${r.axe?.length ? r.axe.join(",") : 0} | ${r.ok ? "ok" : "NOT OK"}`);
  console.log(`  scripts ${JSON.stringify(rec.scripts)} chunk shas ${rec.chunkShas.map((s) => s.slice(0, 7)).join(",") || "none"} | posts ${JSON.stringify(rec.posts)} nonGet ${rec.nonGet.length} | console errors ${rec.consoleErrors} (mapbox telemetry ${rec.consoleTelemetry}, geocoder 404/422 answers ${rec.consoleGeocodeAnswers}) | failed ${JSON.stringify(rec.failedCounts)} | token checks ${rec.tokenChecks} hits ${rec.tokenHits}`);
  for (const c of rec.console) console.log(`    console [${c.step}] ${c.text} ${c.url}`);
  save();
}
result.finishedAt = new Date().toISOString();
result.pass = result.sizes.length === SIZES.length && result.sizes.every((r) => Object.values(r.verdict).every(Boolean));
save();
console.log(`overall: ${result.pass ? "PASS" : "FAIL"}`);
