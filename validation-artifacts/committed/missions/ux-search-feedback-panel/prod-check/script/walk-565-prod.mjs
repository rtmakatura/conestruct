// #565 production check on main fb23505 (mission #566, ux-search-feedback-panel).
// The real site and backend, read-only: nothing is saved ("Save and close"
// is never pressed); the search box and the pin change only the page's own
// state.  The measure, axe and 44 px code is ../../issue-565/walk-script/
// walk565.mjs's; the sha gate, console, failed-request and token code is
// validation-artifacts/committed/issue-554-weak-match-notice/prod-check/
// script/walk-554-prod.mjs's.
//   node walk-565-prod.mjs <main checkout> <crops dir> <extra dir> <results json> <head sha>
// The gate token is read from <main>/conestruct/site/.env.local into
// GATE_BYPASS_TOKEN here and sent only by scripts/gate.cjs, to the site's
// own host; never printed, never written.
//
// Before any browser: backend healthz sha == <head sha>; the site's
// /api/version sha == <head sha>.  In each browser, once the window is open:
// a served /_next/ script holds "mw-feedback" and none holds
// "mw-search-list" (else the size stops).
//
// Per size, one browser, one window, these states in turn, each a real
// search against the live geocoder:
//   no-pin (the window as it opens), town, weak-match, out-of-range,
//   did-you-mean, no-match, outside-colorado, pin-address (a street
//   address), pin (the pair 39.7401, -104.9811: no geocoder).
// The pin at the pair is placed at 1440 by typing the pair swapped and
// pressing "Did you mean" (the one press), at the other sizes by typing it.
//
// Run 2.  Run 1 (run-1.log, results-run-1.json) had two faults of this
// script: it compared the no-match box with one line and the live box has
// two ("No match in Colorado for that address." / "Check the spelling."),
// so it stubbed a state that needed no stub; and it took the pin from the
// street address, where the live road lookup found no road, so no road rows
// were there to check.  Both are changed here; nothing else is.
//
// The one stub: for no-match and outside-colorado, if the live geocoder's
// answer does not put the expected line in the box, what it gave is recorded
// (`live`) and the same text is searched once more with /api/geocode
// answered in the browser (404 "no match" / 422 "outside colorado");
// `stubbed: true` marks that state.
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
const CHOICE = "Did you mean 39.7401, -104.9811?";
const PIN_TEXT = "Pin at 39.7401, -104.9811";
const NO_PIN_TEXT = "No pin yet";
const ROADS_NO_PIN = "Tap the map to find the roads.";
const QUESTION = "Which road is the work on?";

// name, typed text, whether it reaches the geocoder, what the box's lines
// must be (a string: equal; a RegExp: the first line matches), the stub
// allowed when the live answer differs.
const MESSAGES = [
  { name: "town", text: "Lafayette, CO", geocode: true, lines: ["That search found a town or area, not a street.", "Tap the map on the road where the work starts. The roads near your tap show up here."] },
  { name: "weak-match", text: "39 N, 44.4", geocode: true, lines: [/^Closest match: .+\.$/, "Check the pin before you go on."] },
  { name: "out-of-range", text: "95.5, -104.9811", geocode: false, lines: ["Latitude must be between -90 and 90"] },
  { name: "did-you-mean", text: "-104.9811, 39.7401", geocode: false, lines: [CHOICE] },
  { name: "no-match", text: "zzqxv 99999 nowhere st", geocode: true, lines: [/^No match/], stub: { status: 404, text: "no match" } },
  { name: "outside-colorado", text: "1600 Pennsylvania Ave, Washington, DC", geocode: true, lines: ["Plans cover Colorado roads only."], stub: { status: 422, text: "outside colorado" } },
];
const PIN_SEARCH = "1437 Bannock St, Denver";
fs.mkdirSync(CROPS, { recursive: true });
fs.mkdirSync(EXTRA, { recursive: true });
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
  let sha = null;
  let status = 0;
  try {
    const r = await fetch(`${SITE}/api/version`, { headers: gateHeaders(SITE), redirect: "manual", cache: "no-store" });
    status = r.status;
    if (r.ok) sha = (await r.json()).sha ?? null;
  } catch (e) {
    status = -1;
  }
  result.served = { route: "/api/version", status, sha, isHead: sha === HEAD_SHA };
  console.log(`served /api/version HTTP ${status} sha ${String(sha).slice(0, 7)}: head ${result.served.isHead}`);
  if (!result.served.isHead) { save(); throw new Error("the served frontend is not the shipped build"); }
}

async function axeDialog(p) {
  if (!(await p.evaluate(() => !!window.axe))) await p.addScriptTag({ content: AXE });
  return p.evaluate(async () => {
    const r = await window.axe.run({ include: [["[role=dialog]"]] }, { resultTypes: ["violations"] });
    return r.violations.map((v) => `${v.id}(${v.nodes.length})`);
  });
}

// Boxes in the dialog's own frame: viewport rect plus the body scroller's
// scrollTop for what is inside the scroller (below md the body scrolls).
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
      const inScroller = scroller.contains(el);
      return { x: r2(r.left - d.left), y: r2(r.top - d.top + (inScroller ? scroller.scrollTop : 0)), w: r2(r.width), h: r2(r.height) };
    };
    const map = dlg.querySelector(".picker-map, .mw-map-off");
    const fb = dlg.querySelector("[data-testid=search-feedback]");
    const fs_ = fb ? getComputedStyle(fb) : null;
    const shown = !!fb && fs_.display !== "none";
    const mapRect = map.getBoundingClientRect();
    const foot = dlg.querySelector(".mw-foot");
    const overlap = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    const visible = (e) => {
      const s = getComputedStyle(e);
      const r = e.getBoundingClientRect();
      return s.display !== "none" && s.visibility !== "hidden" && r.width > 0 && r.height > 0;
    };
    // Anything that is not the map's own, drawn over the map: every element
    // of the dialog with position absolute or fixed that overlaps it.
    const overMap = [...dlg.querySelectorAll("*")].filter((e) => {
      if (map.contains(e)) return false;
      const s = getComputedStyle(e);
      if (s.position !== "absolute" && s.position !== "fixed") return false;
      if (s.display === "none" || s.visibility === "hidden") return false;
      return overlap(e.getBoundingClientRect(), mapRect) > 0;
    }).map((e) => String(e.className || e.tagName));
    // Every message element of the window (a live region, an alert, the
    // box, the old list) and its overlap with the map.
    const messageEls = [...dlg.querySelectorAll("[role=status], [role=alert], [aria-live], .mw-feedback, [data-testid=search-list], .mw-search-list")].filter(visible);
    const messageOverlap = messageEls.map((e) => ({ what: String(e.getAttribute("data-testid") || e.className || e.tagName).slice(0, 40), inMap: map.contains(e), px2: r2(overlap(e.getBoundingClientRect(), mapRect)) }));
    const controls = [...dlg.querySelectorAll("button, input, a[href], [role=radio]")].filter((c) => {
      const r = c.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && !map.contains(c);
    }).map((c) => {
      const r = c.getBoundingClientRect();
      return { what: c.tagName === "INPUT" ? "search box" : `"${(c.getAttribute("aria-label") || c.textContent).trim().slice(0, 40)}"`, w: r2(r.width), h: r2(r.height) };
    });
    // Mapbox's own marks inside the map (#505's open question): recorded,
    // not counted.
    const mapControls = [...map.querySelectorAll("button, a[href]")].filter(visible).map((c) => {
      const r = c.getBoundingClientRect();
      return { what: `map ${c.tagName.toLowerCase()} "${(c.getAttribute("aria-label") || c.title || c.textContent || c.className).trim().slice(0, 40)}"`, w: r2(r.width), h: r2(r.height) };
    });
    const section = dlg.querySelector("[data-testid=road-section]");
    const question = section ? section.querySelector("h3") : null;
    const rail = dlg.querySelector(".mw-rail");
    let feedback = null;
    if (shown) {
      const f = fb.getBoundingClientRect();
      const q = question ? question.getBoundingClientRect() : null;
      const rl = rail.getBoundingClientRect();
      let next = fb.nextElementSibling;
      while (next && !visible(next)) next = next.nextElementSibling;
      const n = next ? next.getBoundingClientRect() : null;
      feedback = {
        ...box(fb),
        role: fb.getAttribute("role"),
        inRail: !!fb.closest(".mw-rail"),
        insideRailBox: f.left >= rl.left - 0.5 && f.right <= rl.right + 0.5 && f.top >= rl.top - 0.5 && f.bottom <= rl.bottom + 0.5,
        questionText: question ? question.textContent : null,
        underQuestionPx: q ? r2(f.top - q.bottom) : null,
        nextText: next ? next.textContent.slice(0, 60) : null,
        nextClass: next ? String(next.className).split(" ")[0] : null,
        aboveNextPx: n ? r2(n.top - f.bottom) : null,
        overlapsMapPx2: r2(overlap(f, mapRect)),
        lines: [...fb.children].map((e) => ({ text: e.textContent, tag: e.tagName.toLowerCase(), w: r2(e.getBoundingClientRect().width), h: r2(e.getBoundingClientRect().height) })),
      };
    }
    return {
      map: box(map),
      search: box(dlg.querySelector(".mw-search")),
      bar: box(dlg.querySelector("[data-testid=coords-bar]")),
      foot: box(foot),
      head: box(dlg.querySelector(".mw-head")),
      rail: box(rail),
      column: box(col),
      dialog: { x: 0, y: 0, w: r2(d.width), h: r2(d.height) },
      barText: dlg.querySelector("[data-testid=coords-bar]").textContent,
      statusInColumn: col.querySelectorAll("[role=status]").length,
      oldList: dlg.querySelectorAll("[data-testid=search-list], .mw-search-list").length,
      overMap,
      messageOverlap,
      feedbackMounted: !!fb,
      feedback,
      section: section ? [...section.children].filter((e) => getComputedStyle(e).display !== "none").map((e) => `${e.tagName.toLowerCase()}.${String(e.className).split(" ")[0]}: ${e.textContent.slice(0, 40)}`) : null,
      roadPanel: dlg.querySelectorAll("[data-testid=road-pick-panel]").length,
      roadRows: dlg.querySelectorAll("[data-testid=road-pick-panel] [role=radio], [data-testid=road-pick-panel] button").length,
      markers: dlg.querySelectorAll(".picker-map .mapboxgl-marker").length,
      controls,
      mapControls,
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
// A one-line RegExp expectation reads the first line only (the no-match box
// has one or two lines, by the geocoder's reason).
const linesOk = (got, want) => (want.length === 1 && want[0] instanceof RegExp
  ? got.length >= 1 && want[0].test(got[0])
  : got.length === want.length && want.every((wv, i) => (wv instanceof RegExp ? wv.test(got[i]) : wv === got[i])));

for (const [w, h] of SIZES) {
  const rec = { size: `${w}x${h}`, step: "", console: [], failed: [], chunkShas: [], nonGet: [], geocodeAnswers: [], roadAnswers: [], tokenChecks: 0, tokenHits: 0, states: {} };
  result.sizes.push(rec);
  const b = await chromium.launch();
  try {
    const ctx = await newGatedContext(b, SITE, { viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    const posts = { geocode: 0, roads: 0 };
    let stubOn = false;
    p.on("request", (r) => {
      const u = new URL(r.url());
      if (r.method() === "POST" && u.pathname.includes("/api/geocode")) posts.geocode += 1;
      if (r.method() === "POST" && u.pathname.includes("/api/road-bearing")) posts.roads += 1;
      if (r.method() !== "GET" && u.host === new URL(SITE).host) rec.nonGet.push({ step: rec.step, method: r.method(), path: u.pathname, stubbed: stubOn && u.pathname.includes("/api/geocode") });
    });
    const scripts = [];
    p.on("response", (r) => {
      const u = new URL(r.url());
if (r.request().method() === "POST" && u.pathname.includes("/api/road-bearing")) {
        const step = rec.step;
        const status = r.status();
        r.json().then((j) => rec.roadAnswers.push({ step, status, scan_status: j?.scan_status ?? null, candidates: Array.isArray(j?.candidates) ? j.candidates.length : null }), () => rec.roadAnswers.push({ step, status }));
      }
      if (r.status() === 429) rec.failed.push(`${u.host} HTTP 429 ${u.pathname.slice(0, 40)}`);
      if (u.host !== new URL(SITE).host || !/^\/_next\/.*\.js$/.test(u.pathname)) return;
      scripts.push(r.text().then((t) => {
        for (const s of [HEAD_SHA, HEAD_SHA.slice(0, 7)]) if (t.includes(s) && !rec.chunkShas.includes(s)) rec.chunkShas.push(s);
        return { read: true, feedback: t.includes("mw-feedback"), oldList: t.includes("mw-search-list") };
      }, () => ({ read: false })));
    });
    p.on("console", (msg) => { if (msg.type() === "error") rec.console.push({ step: rec.step, text: msg.text().slice(0, 160), url: (msg.location()?.url ?? "").split("?")[0].slice(0, 120) }); });
    p.on("pageerror", (e) => { rec.console.push({ step: rec.step, text: `pageerror: ${oneLine(e).slice(0, 160)}`, url: "" }); });
    p.on("requestfailed", (r) => { rec.failed.push(`${new URL(r.url()).host} ${r.failure()?.errorText ?? ""}`); });
    const dlg = p.locator("[role=dialog]");
    const input = dlg.getByLabel("Address, intersection or coordinates search");
    const bar = dlg.locator("[data-testid=coords-bar]");
    const fb = dlg.locator("[data-testid=search-feedback]");
    const tokenCheck = async () => {
      const stored = await p.evaluate(() => JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage), document.cookie]));
      const cookies = JSON.stringify(await ctx.cookies());
      const hay = [await p.content(), await p.evaluate(() => document.body.innerText), stored, cookies];
      rec.tokenChecks += 1;
      for (const t of hay) if (t.includes(TOKEN) || t.toLowerCase().includes(GATE_HEADER)) rec.tokenHits += 1;
    };
    const shoot = async (name) => {
      // The whole window as it is on screen (extra), then the right panel
      // alone (committed).  The panel's shot may scroll the body at 390, so
      // the scroll is put back.
      await p.screenshot({ path: path.join(EXTRA, `prod-${w}-${name}-window.png`) });
      await dlg.locator(".mw-rail").screenshot({ path: path.join(CROPS, `prod-${w}-${name}.png`) });
      await p.evaluate(() => { document.querySelector("[role=dialog] .mw-map-col").parentElement.scrollTop = 0; });
    };
    // Type, press Enter, and for a searched text wait for the geocoder's
    // answer.  Returns its HTTP status and body (a refusal's reason).
    const search = async (text, searched) => {
      await input.fill(text);
      if (!searched) { await input.press("Enter"); return null; }
      const [resp] = await Promise.all([
        p.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname.includes("/api/geocode"), { timeout: 30000 }).catch(() => null),
        input.press("Enter"),
      ]);
      if (!resp) return { status: null };
      const status = resp.status();
      const body = status === 200 ? null : (await resp.text().catch(() => "")).slice(0, 60);
      return { status, ...(body === null ? {} : { reason: body }) };
    };
    const take = async (name, extra = {}) => {
      rec.states[name] = { ...(await measure(p)), axe: await axeDialog(p), ...extra };
      await tokenCheck();
      await shoot(name);
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

    // The served-build gate: the map window's script is the #565 one.
    {
      const read = await Promise.all(scripts.slice());
      rec.scriptsAtOpen = { loaded: read.length, read: read.filter((r) => r.read).length, withFeedback: read.filter((r) => r.feedback).length, withOldList: read.filter((r) => r.oldList).length };
      if (rec.scriptsAtOpen.withFeedback === 0 || rec.scriptsAtOpen.withOldList > 0) throw new Error("the served map-window script is not the #565 build");
    }

    rec.step = "no-pin";
    await take("no-pin");

    for (const m of MESSAGES) {
      rec.step = m.name;
      const g0 = posts.geocode;
      const r0 = posts.roads;
      let answer = await search(m.text, m.geocode);
      if (m.geocode) rec.geocodeAnswers.push({ step: m.name, ...answer, stubbed: false });
      await fb.locator(":scope > *").first().waitFor({ timeout: 30000 }).catch(() => {});
      await settled(p);
      await p.waitForTimeout(m.name === "town" ? 2500 : 1200);
      let got = await fb.locator(":scope > *").allTextContents();
      const extra = { typed: m.text, stubbed: false };
      if (m.stub && !linesOk(got, m.lines)) {
        // The live geocoder gave something else: record it, then answer the
        // same search in the browser with the shape the code expects.
        extra.live = { answer, lines: got, barText: await bar.textContent() };
        await p.screenshot({ path: path.join(EXTRA, `prod-${w}-${m.name}-live-answer-window.png`) });
        stubOn = true;
        await p.route("**/api/geocode", (route) => route.fulfill({ status: m.stub.status, contentType: "text/plain", body: m.stub.text }));
        answer = await search(m.text, true);
        rec.geocodeAnswers.push({ step: m.name, ...answer, stubbed: true });
        await p.waitForTimeout(1200);
        await p.unroute("**/api/geocode");
        stubOn = false;
        extra.stubbed = true;
        extra.stub = m.stub;
        got = await fb.locator(":scope > *").allTextContents();
      }
      extra.geocode = answer;
      extra.geocodePosts = posts.geocode - g0;
      extra.roadLookups = posts.roads - r0;
      extra.textOk = linesOk(got, m.lines);
      if (m.name === "did-you-mean") {
        const c = await fb.getByRole("button", { name: CHOICE }).boundingBox().catch(() => null);
        extra.choiceButton = c ? { w: Math.round(c.width * 100) / 100, h: Math.round(c.height * 100) / 100 } : null;
      }
      await take(m.name, extra);
      if (m.name === "town") {
        const d = await dlg.boundingBox();
        await p.screenshot({ path: path.join(CROPS, `prod-${w}-town-window.png`), clip: { x: Math.max(0, d.x), y: Math.max(0, d.y), width: Math.min(d.width, w - d.x), height: Math.min(d.height, h - d.y) } });
      }
    }

    // A pin from a street address.  The box goes.  What the live road
    // lookup finds there is recorded, not checked.
    rec.step = "pin-address";
    {
      const g0 = posts.geocode;
      const r0 = posts.roads;
      const answer = await search(PIN_SEARCH, true);
      rec.geocodeAnswers.push({ step: "pin-address", ...answer, stubbed: false });
      await bar.getByText("Pin at").waitFor({ timeout: 20000 }).catch(() => {});
      await dlg.locator("[data-testid=road-pick-panel], [data-testid=road-lookup-status]").first().waitFor({ timeout: 45000 }).catch(() => {});
      await settled(p);
      await p.waitForTimeout(2500);
      await take("pin-address", { typed: PIN_SEARCH, stubbed: false, geocode: answer, geocodePosts: posts.geocode - g0, roadLookups: posts.roads - r0 });
    }

    // A pin at the pair 39.7401, -104.9811 (no geocoder).  At the first
    // size it is placed by pressing "Did you mean" (a real button, pressed
    // once in the run); at the others the pair is typed.
    rec.step = "pin";
    {
      const g0 = posts.geocode;
      const r0 = posts.roads;
      let typed = "39.7401, -104.9811";
      if (w === 1440) {
        typed = "-104.9811, 39.7401, then the choice pressed";
        await search("-104.9811, 39.7401", false);
        const choice = fb.getByRole("button", { name: CHOICE });
        await choice.waitFor({ timeout: 15000 });
        const shown = await measure(p);
        await choice.click();
        await bar.getByText(PIN_TEXT).waitFor({ timeout: 15000 }).catch(() => {});
        rec.choiceTaken = { barBefore: shown.barText, boxBefore: shown.feedback ? shown.feedback.lines.map((l) => l.text) : null };
      } else {
        await search(typed, false);
        await bar.getByText(PIN_TEXT).waitFor({ timeout: 15000 }).catch(() => {});
      }
      await dlg.locator("[data-testid=road-pick-panel], [data-testid=road-lookup-status]").first().waitFor({ timeout: 45000 }).catch(() => {});
      await settled(p);
      await p.waitForTimeout(2500);
      await take("pin", { typed, stubbed: false, geocodePosts: posts.geocode - g0, roadLookups: posts.roads - r0 });
      if (rec.choiceTaken) {
        const after = rec.states.pin;
        Object.assign(rec.choiceTaken, { barText: after.barText, pinAtThePair: after.barText.startsWith(PIN_TEXT), boxGone: after.feedback === null, markers: after.markers, geocodePosts: posts.geocode - g0, roadPanel: after.roadPanel });
      }
    }

    rec.step = "done";
    const read = await Promise.all(scripts);
    rec.posts = posts;
    rec.scripts = { loaded: read.length, read: read.filter((r) => r.read).length, withFeedback: read.filter((r) => r.feedback).length, withOldList: read.filter((r) => r.oldList).length };
  } catch (e) {
    rec.error = `at step ${rec.step}: ${oneLine(e).slice(0, 300)}`;
  } finally {
    await b.close();
  }

  // ---- The checks -------------------------------------------------------
  const S = rec.states;
  const keys = Object.keys(S);
  const ALL = ["no-pin", ...MESSAGES.map((m) => m.name), "pin-address", "pin"];
  const all = !rec.error && ALL.every((k) => k in S);
  const msgKeys = MESSAGES.map((m) => m.name).filter((k) => k in S);
  const FIXED = ["map", "search", "bar", "foot", "head", "column", "dialog"];
  const moved = (k) => (keys.length ? Math.max(...["x", "y", "w", "h"].map((f) => {
    const vs = keys.map((s) => S[s][k][f]);
    return Math.round((Math.max(...vs) - Math.min(...vs)) * 100) / 100;
  })) : null);
  rec.movedPx = Object.fromEntries(FIXED.concat(["rail"]).map((k) => [k, moved(k)]));
  rec.boxes = keys.length ? Object.fromEntries(["map", "search", "bar", "foot"].map((k) => [k, S[keys[0]][k]])) : null;
  const ctl = keys.flatMap((s) => S[s].controls.map((c) => ({ ...c, state: s })));
  rec.under44 = ctl.filter((c) => c.w < 44 || c.h < 44).map((c) => `${c.state}: ${c.what} ${c.w}x${c.h}`).filter((v, i, a) => a.indexOf(v) === i);
  rec.minControl = ctl.length ? { w: Math.min(...ctl.map((c) => c.w)), h: Math.min(...ctl.map((c) => c.h)) } : null;
  rec.controlsMeasured = ctl.length;
  rec.mapControls = [...new Map(keys.flatMap((s) => S[s].mapControls).map((c) => [`${c.what} ${c.w}x${c.h}`, c])).values()];
  rec.consoleErrors = rec.console.length;
  rec.consoleTelemetry = rec.console.filter((c) => /events\.mapbox\.com/.test(`${c.text} ${c.url}`)).length;
  // Chromium logs a 404 or 422 answer as a console error; the geocoder's
  // own "no match" and "outside Colorado" answers (and the stub's) are those.
  rec.consoleGeocodeAnswers = rec.console.filter((c) => /status of (404|422)/.test(c.text) && c.url.endsWith("/api/geocode")).length;
  rec.http429 = rec.failed.filter((f) => / HTTP 429 /.test(f)).length;
  const failedBy = {};
  for (const f of rec.failed) failedBy[f] = (failedBy[f] ?? 0) + 1;
  rec.failedCounts = failedBy;
  delete rec.failed;
  rec.stubbedStates = keys.filter((k) => S[k].stubbed);
  const fbOf = (k) => S[k]?.feedback ?? null;
  const pin = S.pin;
  rec.verdict = {
    ran: all,
    landedOnSandbox: rec.landedOn === "/sandbox",
    servedScriptHasFeedbackAndNoOldList: (rec.scripts?.withFeedback ?? 0) > 0 && rec.scripts?.withOldList === 0,
    windowOpensWithNoPinAndNoBox: all && S["no-pin"].barText === NO_PIN_TEXT && S["no-pin"].feedback === null && S["no-pin"].markers === 0,
    townText: all && S.town.textOk,
    weakMatchTextAndNoPin: all && S["weak-match"].textOk && S["weak-match"].barText === NO_PIN_TEXT && S["weak-match"].markers === 0,
    outOfRangeTextAndNoGeocode: all && S["out-of-range"].textOk && S["out-of-range"].geocodePosts === 0,
    didYouMeanButton44: all && S["did-you-mean"].textOk && !!S["did-you-mean"].choiceButton && S["did-you-mean"].choiceButton.h >= 44 && S["did-you-mean"].choiceButton.w >= 44 && S["did-you-mean"].geocodePosts === 0,
    noMatchText: all && S["no-match"].textOk,
    outsideColoradoText: all && S["outside-colorado"].textOk,
    addressPinBoxGone: all && S["pin-address"].feedback === null && S["pin-address"].barText.startsWith("Pin at") && S["pin-address"].markers === 1,
    pinBoxGoneRoadsListed: all && pin.feedback === null && pin.barText.startsWith(PIN_TEXT) && pin.markers === 1 && pin.roadPanel === 1 && pin.roadRows > 0,
    ...(w === 1440 ? { choicePressedPinsThePairAndBoxGone: !!rec.choiceTaken && rec.choiceTaken.pinAtThePair && rec.choiceTaken.boxGone && rec.choiceTaken.markers === 1 && rec.choiceTaken.geocodePosts === 0 } : {}),
    mapSearchBarFooterMoved0: all && ["map", "search", "bar", "foot"].every((k) => rec.movedPx[k] === 0),
    headColumnDialogMoved0: all && ["head", "column", "dialog"].every((k) => rec.movedPx[k] === 0),
    noMessageOverTheMap: all && keys.every((s) => S[s].overMap.length === 0 && S[s].statusInColumn === 0 && S[s].oldList === 0 && S[s].messageOverlap.every((m) => m.px2 === 0)),
    boxInRightPanelUnderQuestion: all && msgKeys.every((k) => { const f = fbOf(k); return !!f && f.role === "status" && f.inRail && f.insideRailBox && f.questionText === QUESTION && f.underQuestionPx >= 0 && f.overlapsMapPx2 === 0; }),
    boxAboveTapTheMapLine: all && msgKeys.every((k) => { const f = fbOf(k); return !!f && f.nextText === ROADS_NO_PIN && f.aboveNextPx >= 0; }),
    axeZero: all && keys.every((s) => S[s].axe.length === 0),
    everyControl44: all && rec.under44.length === 0,
    noConsoleErrorsBesidesGeocoderAnswers: rec.consoleErrors - rec.consoleTelemetry - rec.consoleGeocodeAnswers === 0,
    geocoderAnswerErrorsMatchStatuses: rec.consoleGeocodeAnswers === rec.geocodeAnswers.filter((a) => a.status !== 200 && a.status !== null).length,
    no429: rec.http429 === 0,
    onlyReadPosts: rec.nonGet.every((n) => n.method === "POST" && ["/api/geocode", "/api/road-bearing", "/api/render/corridor-geometry"].includes(n.path)),
    tokenNotInPage: rec.tokenChecks === ALL.length && rec.tokenHits === 0,
  };
  const failedChecks = Object.entries(rec.verdict).filter(([, v]) => !v).map(([k]) => k);
  rec.checksRun = Object.keys(rec.verdict).length;
  rec.checksFailed = failedChecks;
  console.log(`${rec.size}: ${rec.error ?? "ok"} | checks ${rec.checksRun}, failed ${failedChecks.length}${failedChecks.length ? ` (${failedChecks.join(", ")})` : ""}`);
  console.log(`  moved px across ${keys.length} states: ${FIXED.concat(["rail"]).map((k) => `${k} ${rec.movedPx[k]}`).join(" ")}`);
  for (const k of keys) {
    const s = S[k];
    console.log(`  ${k}${s.typed ? ` [${s.typed}]` : ""}: geocode ${s.geocodePosts ?? 0}${s.geocode?.status ? ` (HTTP ${s.geocode.status}${s.geocode.reason ? ` "${s.geocode.reason}"` : ""})` : ""}${s.stubbed ? " STUBBED" : ""} roads ${s.roadLookups ?? 0} | bar "${s.barText}" markers ${s.markers} road rows ${s.roadRows} | box ${s.feedback ? `${s.feedback.w}x${s.feedback.h} under question ${s.feedback.underQuestionPx} above next ${s.feedback.aboveNextPx} map overlap ${s.feedback.overlapsMapPx2} ${JSON.stringify(s.feedback.lines.map((l) => l.text))}` : "none"} | over map ${s.overMap.length} | axe ${s.axe.length ? s.axe.join(",") : 0}${"textOk" in s ? ` | text ${s.textOk ? "ok" : "NOT OK"}` : ""}${s.live ? ` | live gave ${JSON.stringify(s.live)}` : ""}${s.choiceButton ? ` | choice ${s.choiceButton.w}x${s.choiceButton.h}` : ""}`);
  }
  if (rec.choiceTaken) console.log(`  choice taken: ${JSON.stringify(rec.choiceTaken)}`);
  console.log(`  road lookups: ${JSON.stringify(rec.roadAnswers)}`);
  console.log(`  controls ${rec.controlsMeasured} measured, under 44: ${rec.under44.length ? rec.under44.join("; ") : "none"}, smallest ${JSON.stringify(rec.minControl)} | map's own: ${rec.mapControls.map((c) => `${c.what} ${c.w}x${c.h}`).join(", ")}`);
  console.log(`  scripts ${JSON.stringify(rec.scripts)} chunk shas ${rec.chunkShas.map((s) => s.slice(0, 7)).join(",") || "none"} | posts ${JSON.stringify(rec.posts)} nonGet ${rec.nonGet.length} | console errors ${rec.consoleErrors} (mapbox telemetry ${rec.consoleTelemetry}, geocoder 404/422 answers ${rec.consoleGeocodeAnswers}) | failed ${JSON.stringify(rec.failedCounts)} | token checks ${rec.tokenChecks} hits ${rec.tokenHits}`);
  for (const c of rec.console) console.log(`    console [${c.step}] ${c.text} ${c.url}`);
  save();
}
result.finishedAt = new Date().toISOString();
result.pass = result.sizes.length === SIZES.length && result.sizes.every((r) => Object.values(r.verdict).every(Boolean));
save();
console.log(`overall: ${result.pass ? "PASS" : "FAIL"}`);
