// #569 production check on main 029b982.
// The real site and backend, read-only: nothing is saved ("Save and close"
// is never pressed, only read); nothing is stubbed.  The sha gate, gated
// context and token code are walk-568-prod.mjs's (validation-artifacts/
// committed/issue-568-address-pin-roads/prod-check/script/).
//   node walk-569-prod.mjs <main checkout> <crops dir> <results json> <head sha>
// The gate token is read from <main>/conestruct/site/.env.local into
// GATE_BYPASS_TOKEN here and sent only by scripts/gate.cjs, to the site's
// own host; never printed, never written.
//
// Per size, one browser, one window, in turn:
//   address (1437 Bannock St, Denver: the 30 m notice's box, the hint
//   hidden), pick (a road picked, Save open), town (Lafayette, CO: only the
//   town notice is left), address again then a refused pair (cleared too),
//   a typed pair (its own roads; the hint back), the same pair again
//   (nothing moves), address again then a tap at the same point (the
//   lookup's own message; the hint hidden).
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

    const saveBtn = dlg.getByRole("button", { name: "Save and close" });
    const note = dlg.locator("[data-testid=road-nearest-only]");
    const rows = dlg.locator("[data-testid=road-pick-panel] [role=radio]");
    const markers = () => dlg.locator(".picker-map .mapboxgl-marker").count();
    const moveShown = () => p.evaluate((t) => Array.from(document.querySelectorAll("[role=dialog] .mw-rail p")).some((e) => e.textContent === t && e.getClientRects().length > 0), MOVE);
    const boxStyle = (sel) => p.evaluate((s) => {
      const e = document.querySelector("[role=dialog] " + s);
      if (!e || !e.children[0]) return null;
      const c = getComputedStyle(e);
      return { bg: c.backgroundColor, border: c.borderTopWidth, first: getComputedStyle(e.children[0]).fontWeight };
    }, sel);
    const priOff = await p.evaluate(() => {
      const d = document.createElement("div");
      d.style.background = "var(--pri-off)";
      document.querySelector("[role=dialog]").appendChild(d);
      const v = getComputedStyle(d).backgroundColor;
      d.remove();
      return v;
    });
    rec.priOff = priOff;
    const toTop = () => p.evaluate(() => { document.querySelector("[role=dialog] .mw-map-col").parentElement.scrollTop = 0; });
    const search = async (text, geocode = true) => {
      await toTop();
      await input.fill(text);
      await Promise.all([
        geocode ? p.waitForResponse((r) => new URL(r.url()).pathname.includes("/api/geocode"), { timeout: 30000 }).catch(() => null) : Promise.resolve(),
        input.press("Enter"),
      ]);
    };
    const bannock = async (label) => {
      const n0 = rec.roads.length;
      await search(ADDRESS);
      const r0 = await roadsAfter(n0);
      await note.waitFor({ timeout: 20000 }).catch(() => {});
      check(label + ": the 30 m notice over the lookup's roads", r0?.nearest_only === true && (await rows.count()) === (r0?.candidates?.length ?? -1) && (await note.count()) === 1, { r0, rows: await rows.count() });
      check(label + ": the bar", (await bar.innerText()).trim() === "Pin at 39.7392, -104.9910", await bar.innerText());
    };
    const noPinLeft = async (label) => {
      check(label + ": the bar reads 'No pin yet'", (await bar.innerText()).trim() === "No pin yet", await bar.innerText());
      check(label + ": no 30 m notice", (await note.count()) === 0, "present");
      check(label + ": no road rows", (await dlg.locator(".mw-rail [role=radio]").count()) === 0, await dlg.locator(".mw-rail [role=radio]").count());
      check(label + ": 'At your pin.' is gone", !(await railText()).includes("At your pin."), "present");
      check(label + ": Save is disabled", await saveBtn.isDisabled(), "enabled");
      check(label + ": no map marker", (await markers()) === 0, await markers());
    };

    rec.step = "address";
    await bannock("address");
    const noteLines = await note.locator(":scope > *").allTextContents();
    check("address: the two lines", eq(noteLines, NEAREST), noteLines);
    const ns = await boxStyle("[data-testid=road-nearest-only]");
    rec.noticeStyle = ns;
    check("address: the notice is on --pri-off with no border", ns && ns.bg === priOff && ns.border === "0px", ns);
    check("address: 'Tap the map to move it.' is not shown beside the notice", !(await moveShown()), "shown");
    check("address: one map marker", (await markers()) === 1, await markers());
    let viol = await axe();
    check("address: axe on the window", viol.length === 0, viol);
    await dlg.locator(".mw-rail").screenshot({ path: path.join(CROPS, "prod-" + w + "-1-bannock.png") });

    rec.step = "pick";
    await rows.first().click();
    await p.waitForTimeout(2500);
    check("pick: the first road is picked and Save is open", (await rows.first().getAttribute("aria-checked")) === "true" && !(await saveBtn.isDisabled()), await rows.first().getAttribute("aria-checked"));

    rec.step = "town";
    let n = rec.roads.length;
    await search("Lafayette, CO");
    await fb.locator(":scope > *").first().waitFor({ timeout: 30000 }).catch(() => {});
    await p.waitForTimeout(2500);
    check("town: the box's two lines", eq(await boxLines(), TOWN), await boxLines());
    await noPinLeft("town");
    check("town: no road lookup for the town", rec.roads.length === n, rec.roads.length - n);
    check("town: no 'tap the map' line outside the box", eq(await tapLines(), []), await tapLines());
    const ts = await boxStyle("[data-testid=search-feedback]");
    rec.townStyle = ts;
    check("town: the town box and the 30 m notice are the same box", ts && ns && ts.bg === ns.bg && ts.border === ns.border && ts.first === ns.first, { ts, ns });
    viol = await axe();
    check("town: axe on the window", viol.length === 0, viol);
    await tokenCheck();
    await dlg.locator(".mw-rail").screenshot({ path: path.join(CROPS, "prod-" + w + "-2-lafayette.png") });
    await toTop();
    await p.screenshot({ path: path.join(CROPS, "prod-" + w + "-2-lafayette-window.png") });

    rec.step = "refused";
    await bannock("refused, before");
    await search("139.7401, -104.9811", false);
    await p.waitForTimeout(800);
    check("refused: the box has its line", (await boxLines()).length === 1 && /Latitude/.test((await boxLines())[0]), await boxLines());
    await noPinLeft("refused");

    rec.step = "pair";
    n = rec.roads.length;
    await search("39.7401, -104.9811", false);
    let road = await roadsAfter(n);
    check("pair: its own roads, no 30 m notice", road && road.candidates?.length > 0 && road.nearest_only === "absent" && (await note.count()) === 0 && (await rows.count()) === road.candidates.length, road);
    check("pair: the bar", (await bar.innerText()).trim() === "Pin at 39.7401, -104.9811", await bar.innerText());
    check("pair: the box is empty", eq(await boxLines(), []), await boxLines());
    check("pair: 'Tap the map to move it.' shows (no message box)", await moveShown(), "hidden");
    if ((await rows.count()) > 1) await rows.nth(1).click();
    await p.waitForTimeout(1500);

    rec.step = "same-pair";
    n = rec.roads.length;
    await search("39.7401, -104.9811", false);
    await p.waitForTimeout(3000);
    check("same pair: no new lookup, the pin stays", rec.roads.length === n && (await bar.innerText()).trim() === "Pin at 39.7401, -104.9811", rec.roads.length - n);
    check("same pair: the pick stays", (await rows.count()) < 2 || (await rows.nth(1).getAttribute("aria-checked")) === "true", "not picked");

    rec.step = "tap";
    await bannock("tap, before");
    await p.waitForTimeout(3500);
    n = rec.roads.length;
    await toTop();
    await p.waitForTimeout(400);
    const box = await dlg.locator(".picker-map canvas").first().boundingBox();
    await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    road = await roadsAfter(n);
    check("tap: 0 roads and the lookup's own message", road && road.candidates?.length === 0 && (await dlg.locator("[data-testid=road-lookup-status]").count()) === 1, road);
    check("tap: 'Tap the map to move it.' is not shown beside the message", !(await moveShown()), "shown");
    check("tap: 'At your pin.' shows", (await railText()).includes("At your pin."), "absent");

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
