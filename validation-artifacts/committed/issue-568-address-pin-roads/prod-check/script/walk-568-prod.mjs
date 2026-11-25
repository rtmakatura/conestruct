// #568 production check on main 4894ad1 (with #567 items 1 and 3).
// The real site and backend, read-only: nothing is saved ("Save and close"
// is never pressed); the search box and the pin change only the page's own
// state.  Nothing is stubbed.  The sha gate, gated context and token code
// follow validation-artifacts/committed/missions/ux-search-feedback-panel/
// prod-check/script/walk-565-prod.mjs.
//   node walk-568-prod.mjs <main checkout> <crops dir> <results json> <head sha>
// The gate token is read from <main>/conestruct/site/.env.local into
// GATE_BYPASS_TOKEN here and sent only by scripts/gate.cjs, to the site's
// own host; never printed, never written.
//
// Run 2.  Run 1 (run-1.log, results-run-1.json) passed at 1440 and 1198 and
// stopped at 390 on two faults of this script: the tap was aimed at a map
// scrolled off screen, and the failure line crashed on a missing value.
// Both are changed here; nothing else is.
//
// Per size, one browser, one window, in turn:
//   no-pin, town (the box), did-you-mean (the box, then the press),
//   address (1437 Bannock St, Denver: the nearest-only list), tap (the map's
//   centre, which is the address pin's point: a tapped pin there).
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const [MAIN, CROPS, RESULTS, HEAD_SHA] = process.argv.slice(2);
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
const START = "Search an address or tap the map to place your pin.";
const MOVE = "Tap the map to move it.";
const GONE = "Tap the map to find the roads.";
const TOWN = ["That search found a town or area, not a street.", "Tap the map on the road where the work starts. The roads near your tap show up here."];
const CHOICE = "Did you mean 39.7401, -104.9811?";
const NEAREST = ["No mapped road runs within 30 m of this address.", "These are the nearest. Pick one, or tap the map on the road where the work starts."];
const NONE_TITLE = "We didn't find a road at your pin.";
const ADDRESS = "1437 Bannock St, Denver";

fs.mkdirSync(CROPS, { recursive: true });
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
  const r = await fetch(`${SITE}/api/version`, { headers: gateHeaders(SITE), redirect: "manual", cache: "no-store" });
  const sha = r.ok ? ((await r.json()).sha ?? null) : null;
  result.served = { route: "/api/version", status: r.status, sha, isHead: sha === HEAD_SHA };
  console.log(`served /api/version HTTP ${r.status} sha ${String(sha).slice(0, 7)}: head ${result.served.isHead}`);
  if (!result.served.isHead) { save(); throw new Error("the served frontend is not the shipped build"); }
}

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

for (const [w, h] of SIZES) {
  const rec = { size: `${w}x${h}`, checks: [], roads: [], geocodes: [], console: [], failed: [], tokenChecks: 0, tokenHits: 0, step: "" };
  result.sizes.push(rec);
  const check = (name, pass, got) => {
    rec.checks.push({ name, pass: !!pass, ...(pass ? {} : { got }) });
    if (!pass) console.log(`  ${w} FAIL ${name}: ${String(JSON.stringify(got)).slice(0, 300)}`);
  };
  const b = await chromium.launch();
  try {
    const ctx = await newGatedContext(b, SITE, { viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    p.on("response", (r) => {
      const u = new URL(r.url());
      if (r.request().method() !== "POST") return;
      if (u.pathname.includes("/api/road-bearing")) {
        const step = rec.step;
        let sent = null;
        try { sent = JSON.parse(r.request().postData() ?? "null"); } catch { sent = null; }
        const entry = { step, status: r.status(), sent };
        rec.roads.push(entry);
        entry.done = r.json().then((j) => {
          entry.scan_status = j?.scan_status ?? null;
          entry.nearest_only = j && "nearest_only" in j ? j.nearest_only : "absent";
          entry.candidates = Array.isArray(j?.candidates) ? j.candidates.map((c) => ({ name: c.name, m: c.snap_distance_m })) : null;
        }, () => {});
      }
      if (u.pathname.includes("/api/geocode")) rec.geocodes.push({ step: rec.step, status: r.status() });
    });
    p.on("console", (msg) => { if (msg.type() === "error") rec.console.push({ step: rec.step, text: msg.text().slice(0, 160) }); });
    p.on("pageerror", (e) => { rec.console.push({ step: rec.step, text: `pageerror: ${oneLine(e).slice(0, 160)}` }); });
    p.on("requestfailed", (r) => { rec.failed.push(`${rec.step}: ${new URL(r.url()).host} ${r.failure()?.errorText ?? ""}`); });

    const dlg = p.locator("[role=dialog]");
    const input = dlg.getByLabel("Address, intersection or coordinates search");
    const bar = dlg.locator("[data-testid=coords-bar]");
    const fb = dlg.locator("[data-testid=search-feedback]");
    // The right panel's lines that say to tap the map, outside the box.
    const tapLines = () => p.evaluate(() => {
      const rail = document.querySelector("[role=dialog] .mw-rail");
      const box = rail.querySelector("[data-testid=search-feedback]");
      return Array.from(rail.querySelectorAll("p"))
        .filter((e) => !box.contains(e) && /tap the map/i.test(e.textContent ?? "") && e.getClientRects().length > 0)
        .map((e) => e.textContent);
    });
    const railText = () => dlg.locator(".mw-rail").innerText();
    const boxLines = () => fb.locator(":scope > *").allTextContents();
    const tokenCheck = async () => {
      const stored = await p.evaluate(() => JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage), document.cookie]));
      const hay = [await p.content(), await p.evaluate(() => document.body.innerText), stored, JSON.stringify(await ctx.cookies())];
      rec.tokenChecks += 1;
      for (const t of hay) if (t.includes(TOKEN) || t.toLowerCase().includes(GATE_HEADER)) rec.tokenHits += 1;
    };
    const axe = async () => {
      if (!(await p.evaluate(() => !!window.axe))) await p.addScriptTag({ content: AXE });
      return p.evaluate(async () => {
        const r = await window.axe.run({ include: [["[role=dialog]"]] }, { resultTypes: ["violations"] });
        return r.violations.map((v) => `${v.id}(${v.nodes.length})`);
      });
    };
    const roadsAfter = async (n) => {
      await p.waitForFunction((k) => true, n).catch(() => {});
      const t0 = Date.now();
      while (rec.roads.length <= n && Date.now() - t0 < 45000) await p.waitForTimeout(250);
      const e = rec.roads[n];
      if (e) await e.done;
      await p.waitForTimeout(1500);
      return e ?? null;
    };

    rec.step = "open";
    await p.goto(`${SITE}/sandbox`, { waitUntil: "networkidle", timeout: 240000 });
    await p.waitForSelector(".a-open .a-head", { timeout: 120000 });
    await p.getByRole("button", { name: "Pick on map" }).first().click();
    await p.waitForSelector("[role=dialog] [data-testid=coords-bar]", { timeout: 30000 });
    await p.waitForFunction(() => document.querySelector("[role=dialog] .picker-map canvas"), null, { timeout: 60000 });
    await p.waitForTimeout(2500);

    rec.step = "no-pin";
    check("no-pin: the two work-start lines show", eq(await tapLines(), [START, MOVE]), await tapLines());
    check("no-pin: the box is empty", eq(await boxLines(), []), await boxLines());

    rec.step = "town";
    await input.fill("Lafayette, CO");
    await Promise.all([
      p.waitForResponse((r) => new URL(r.url()).pathname.includes("/api/geocode"), { timeout: 30000 }).catch(() => null),
      input.press("Enter"),
    ]);
    await fb.locator(":scope > *").first().waitFor({ timeout: 30000 }).catch(() => {});
    await p.waitForTimeout(2500);
    check("town: the box's two lines", eq(await boxLines(), TOWN), await boxLines());
    check("town: no other 'tap the map' line", eq(await tapLines(), []), await tapLines());
    check("town: 'Tap the map to find the roads.' is gone", !(await railText()).includes(GONE), "present");
    check("town: no road lookup", rec.roads.length === 0, rec.roads.length);
    await dlg.locator(".mw-rail").screenshot({ path: path.join(CROPS, `prod-${w}-town.png`) });
    await p.evaluate(() => { document.querySelector("[role=dialog] .mw-map-col").parentElement.scrollTop = 0; });

    rec.step = "did-you-mean";
    await input.fill("-104.9811, 39.7401");
    await input.press("Enter");
    const choice = fb.getByRole("button", { name: CHOICE });
    await choice.waitFor({ timeout: 10000 });
    check("did-you-mean: no other 'tap the map' line", eq(await tapLines(), []), await tapLines());
    let n = rec.roads.length;
    await choice.click();
    const focused = await p.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.tagName);
    check("did-you-mean: focus is in the search box after the press", focused === "Address, intersection or coordinates search", focused);
    let road = await roadsAfter(n);
    check("pair pin: the lookup's body has no reach", road && eq(road.sent, { lat: 39.7401, lng: -104.9811 }), road?.sent);
    check("pair pin: roads listed, no nearest_only", road && road.candidates?.length > 0 && road.nearest_only === "absent", road);
    check("pair pin: no nearest-only lines", (await dlg.locator("[data-testid=road-nearest-only]").count()) === 0, "present");
    check("pair pin: the bar", (await bar.innerText()).trim() === "Pin at 39.7401, -104.9811", await bar.innerText());
    check("pair pin: 'Tap the map to move it.' shows again", eq(await tapLines(), [MOVE]), await tapLines());

    rec.step = "address";
    n = rec.roads.length;
    await input.fill(ADDRESS);
    await Promise.all([
      p.waitForResponse((r) => new URL(r.url()).pathname.includes("/api/geocode"), { timeout: 30000 }).catch(() => null),
      input.press("Enter"),
    ]);
    road = await roadsAfter(n);
    check("address: the lookup's body carries reach: address", road?.sent?.reach === "address", road?.sent);
    check("address: HTTP 200, scan ok, nearest_only true", road && road.status === 200 && road.scan_status === "ok" && road.nearest_only === true, road);
    check("address: Cherokee Street first, every road past 30 m and within 100 m", road?.candidates?.[0]?.name === "Cherokee Street" && road.candidates.every((c) => c.m > 30 && c.m <= 100), road?.candidates);
    const note = dlg.locator("[data-testid=road-nearest-only]");
    await note.waitFor({ timeout: 20000 }).catch(() => {});
    const noteLines = (await note.count()) ? await note.locator(":scope > *").allTextContents() : [];
    check("address: the two nearest-only lines", eq(noteLines, NEAREST), noteLines);
    const rows = dlg.locator("[data-testid=road-pick-panel] [role=radio]");
    const rowTexts = await rows.allTextContents();
    check("address: the first row is Cherokee Street with its distance", /^Cherokee Street/.test(rowTexts[0] ?? "") && /\d+ m from your pin/.test(rowTexts[0] ?? ""), rowTexts);
    check("address: the rows are the lookup's roads", rowTexts.length === (road?.candidates?.length ?? -1), rowTexts.length);
    const checked = await rows.evaluateAll((els) => els.filter((e) => e.getAttribute("aria-checked") === "true").length);
    check("address: no road is picked", checked === 0, checked);
    check("address: not the no-road message", !(await railText()).includes(NONE_TITLE), "present");
    check("address: the bar", (await bar.innerText()).trim() === "Pin at 39.7392, -104.9910", await bar.innerText());
    check("address: the box is empty", eq(await boxLines(), []), await boxLines());
    const viol = await axe();
    check("address: axe on the window", viol.length === 0, viol);
    await tokenCheck();
    rec.addressRows = rowTexts;
    await dlg.locator(".mw-rail").screenshot({ path: path.join(CROPS, `prod-${w}-address-nearest.png`) });
    await p.evaluate(() => { document.querySelector("[role=dialog] .mw-map-col").parentElement.scrollTop = 0; });

    // Pick the first road: it is taken.
    await rows.first().click();
    await p.waitForTimeout(800);
    check("address: a pressed row is picked", (await rows.first().getAttribute("aria-checked")) === "true", await rows.first().getAttribute("aria-checked"));

    rec.step = "tap";
    // The map is centred on the address pin; a tap there is a tapped pin at
    // the same point.
    await p.waitForTimeout(3500);
    n = rec.roads.length;
    // Run 2: below md the window's body scrolls, and the row press above
    // leaves the map off screen at 390, so run 1's tap there hit nothing.
    await p.evaluate(() => { document.querySelector("[role=dialog] .mw-map-col").parentElement.scrollTop = 0; });
    await p.waitForTimeout(400);
    const box = await dlg.locator(".picker-map canvas").first().boundingBox();
    await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    road = await roadsAfter(n);
    check("tap: the lookup's body has no reach", road && road.sent && !("reach" in road.sent), road?.sent);
    check("tap: near the address pin", road && Math.abs(road.sent.lat - 39.739247) < 0.0003 && Math.abs(road.sent.lng + 104.99097) < 0.0003, road?.sent);
    check("tap: 0 roads, no nearest_only, as before", road && road.status === 200 && road.scan_status === "ok" && road.candidates?.length === 0 && road.nearest_only === "absent", road);
    check("tap: the no-road message", (await railText()).includes(NONE_TITLE), "absent");
    check("tap: no nearest-only lines", (await dlg.locator("[data-testid=road-nearest-only]").count()) === 0, "present");

    check("no console errors", rec.console.length === 0, rec.console);
    check("no token in the page", rec.tokenHits === 0, rec.tokenHits);
  } catch (e) {
    rec.error = oneLine(e).slice(0, 300);
    console.log(`  ${w} ERROR at ${rec.step}: ${rec.error}`);
  } finally {
    await b.close();
  }
  for (const r of rec.roads) delete r.done;
  const failed = rec.checks.filter((c) => !c.pass).length;
  console.log(`${rec.size}: ${rec.checks.length} checks, ${failed} failed${rec.error ? ", stopped on an error" : ""}`);
  save();
}
save();
