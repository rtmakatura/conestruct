// #516 production check (mission ux-group7-what-section #518, main 197c608).
// Copied from validation-artifacts/committed/missions/ux-group8-map-window/
// prod-check/script/walk-507-prod.mjs (left as it was) and cut to #516's
// reproduction (the edit506 flow), with:
//   - every POST /api/render/corridor-geometry logged with the step it was
//     sent in, its status, and a compact form of its meta (road, roadAxis,
//     work, pin); the full request bodies go to logs/geometry-bodies-<w>.json.
//     The gate token travels in a header only (scripts/gate.cjs), never in a
//     body, so the bodies carry no token.
//   - after the side question is read, the first side answer is picked, so
//     the load-ahead and the answer's own geometry read are on the record.
//   node walk-516-prod.mjs <main checkout> <committed crops dir> <extra dir> <logs dir>
// Env: SIZES, KEEP, GATE_BYPASS_TOKEN.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const [MAIN, CROPS, EXTRA, LOGS] = process.argv.slice(2);
const WT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../../..");
const require = createRequire(path.join(MAIN, "package.json"));
if (!process.env.GATE_BYPASS_TOKEN) throw new Error("GATE_BYPASS_TOKEN not set");
const { newGatedContext, guardOutput, oneLine } = require(path.join(WT, "scripts/gate.cjs"));
guardOutput();
const { chromium } = require("playwright");
const AXE = fs.readFileSync(path.join(MAIN, "conestruct/site/node_modules/axe-core/axe.min.js"), "utf8");
const SITE = "https://www.conestruct.com";
const SIZES = (process.env.SIZES ?? "1440x900,1198x930,390x844").split(",").map((s) => s.split("x").map(Number));
const KEEP = new Set((process.env.KEEP ?? "").split(",").filter(Boolean));
for (const d of [CROPS, EXTRA, LOGS]) fs.mkdirSync(d, { recursive: true });
const PT = { colfax: [39.73997, -104.96632], fail: [39.7501, -104.9601] };
const log = (s) => console.log(s);

async function shot(p, name, scrollSel) {
  if (scrollSel) await p.locator(scrollSel).first().scrollIntoViewIfNeeded().catch(() => {});
  await p.waitForTimeout(400);
  const dir = KEEP.has(name) ? CROPS : EXTRA;
  await p.screenshot({ path: path.join(dir, `${name}.png`) });
  return `${KEEP.has(name) ? "crops/" : "extra/"}${name}.png`;
}
async function axeIn(p, sel) {
  if (!(await p.evaluate(() => !!window.axe))) await p.addScriptTag({ content: AXE });
  return p.evaluate(async (sel) => {
    const r = await window.axe.run({ include: [[sel]] }, { resultTypes: ["violations"] });
    return r.violations.map((v) => `${v.id}(${v.nodes.length}): ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`);
  }, sel);
}
// Every visible control in the window; Mapbox's logo and attribution are
// excepted (#505's ruling), and reported separately.
async function small(p, root = "[role=dialog]") {
  return p.evaluate((root) => {
    const d = document.querySelector(root);
    if (!d) return { checked: 0, under: [], excepted: [] };
    const els = [...d.querySelectorAll("button, a[href], input, select, textarea, [role=radio], [role=button], summary")];
    const vis = els.filter((e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none"; });
    const name = (e) => (e.getAttribute("aria-label") || e.innerText || e.getAttribute("title") || e.className || e.tagName).toString().replace(/\s+/g, " ").trim().slice(0, 40);
    const under = [], excepted = [];
    for (const e of vis) {
      const r = e.getBoundingClientRect();
      if (r.width >= 44 && r.height >= 44) continue;
      const rec = `${name(e)} ${Math.round(r.width)}x${Math.round(r.height)}`;
      if (e.closest(".mapboxgl-ctrl-attrib, .mapboxgl-ctrl-logo") || e.matches(".mapboxgl-ctrl-logo")) excepted.push(rec);
      else under.push(rec);
    }
    return { checked: vis.length, under, excepted };
  }, root);
}
async function measureWindow(p, tag, crop, scrollSel) {
  await shot(p, crop, scrollSel);
  const ax = await axeIn(p, "[role=dialog]");
  const s = await small(p);
  const save = await p.evaluate(() => {
    const b = [...document.querySelectorAll("[role=dialog] button")].find((x) => x.innerText.trim() === "Save and close");
    return { disabled: b?.disabled ?? null, line: document.querySelector("[data-testid=picker-save-blocked]")?.innerText ?? null };
  });
  const tiles = await p.evaluate(() => [...document.querySelectorAll("[data-testid=road-axis]")].map((t) => `${t.getAttribute("aria-checked") === "true" ? "[x]" : "[ ]"} ${t.innerText.replace(/\s+/g, " ").trim()}`));
  if (tiles.length) log(`     tiles: ${tiles.join(" || ")}`);
  log(`  ${tag}: axe ${ax.length} ${ax.join("; ")} | 44px checked ${s.checked}, under ${s.under.length} ${s.under.join("; ")} | excepted ${s.excepted.join("; ") || "-"} | save ${save.disabled ? "DISABLED" : "enabled"}${save.line ? ` "${save.line}"` : ""}`);
  return { ax, s, save };
}
async function sideQ(p, tag, crop) {
  const q = await p.evaluate(() => {
    const card = document.querySelector("[data-testid=where-questions] .nyq-card") ?? document.querySelector("[data-testid=where-questions]");
    const opts = [...document.querySelectorAll("[data-testid=where-questions] label.nyq-answer")].map((l) => ({ text: l.innerText.replace(/\n+/g, " / "), checked: !!l.querySelector("input:checked") }));
    return { text: (card?.innerText ?? "").replace(/\n+/g, " / ").slice(0, 500), opts,
      reask: /Your edit changed the road or the work start, so this is asked again\./.test(card?.innerText ?? "") };
  });
  await shot(p, crop, "[data-testid=where-questions]");
  const ax = await axeIn(p, "[data-testid=band-where]");
  log(`  ${tag}: ${q.text}`);
  log(`     options: ${q.opts.map((o) => `${o.checked ? "[x]" : "[ ]"} ${o.text}`).join(" || ")} | #488 re-ask line ${q.reask} | band axe ${ax.length} ${ax.join("; ")}`);
  return { ...q, ax };
}

const compact = (m) => {
  if (!m) return null;
  const c = m.confirmedRoad?.candidate;
  return { road: c ? { way: c.way_id, name: c.name } : (m.confirmedRoad ?? null), roadAxis: m.roadAxis ?? null, work: m.work ?? null, lat: m.lat, lng: m.lng };
};
async function setup(w, h) {
  const b = await chromium.launch();
  const ctx = await newGatedContext(b, SITE, { viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const net = { phase: "load", fail: false, forced: 0, roadBearing: 0, geo: [], bad: [], console: [], errors: [] };
  p.on("console", (m) => { if (m.type() === "error") net.console.push(m.text().slice(0, 200)); });
  p.on("pageerror", (e) => net.errors.push(String(e).slice(0, 200)));
  await p.route("**/api/road-bearing", async (route) => {
    if (net.fail && route.request().method() === "POST") {
      net.forced++;
      return route.fulfill({ status: 504, contentType: "application/json", body: JSON.stringify({ error: "forced by the walk" }) });
    }
    return route.fallback();
  });
  p.on("request", (r) => {
    if (r.url().includes("/api/road-bearing")) net.roadBearing++;
    if (r.url().includes("/api/render/corridor-geometry") && r.method() === "POST") {
      let body = null;
      try { body = JSON.parse(r.postData() ?? "null"); } catch {}
      const m = body?.meta ?? body?.scenario?.meta ?? null;
      const e = { n: net.geo.length + 1, phase: net.phase, req: r, status: "pending", meta: compact(m), body, answer: null };
      net.geo.push(e);
    }
  });
  p.on("requestfailed", (r) => { const e = net.geo.find((x) => x.req === r); if (e) e.status = `failed ${r.failure()?.errorText ?? ""}`; });
  p.on("response", async (r) => {
    if (r.url().startsWith(SITE) && r.status() >= 400) net.bad.push(`${r.status()} ${r.url().replace(SITE, "")}`);
    const e = net.geo.find((x) => x.req === r.request());
    if (e) {
      e.status = r.status();
      try { const t = await r.text(); e.answer = r.ok() ? { side_options: JSON.parse(t)?.side_options?.map((o) => o.label) ?? null } : t.slice(0, 300); } catch {}
    }
  });
  await p.goto(`${SITE}/sandbox`, { waitUntil: "networkidle", timeout: 240000 });
  await p.waitForSelector(".a-open .a-head", { timeout: 120000 });
  return { b, p, net };
}
async function openPicker(p, label = "Pick on map") {
  await p.getByRole("button", { name: label }).first().click();
  await p.waitForSelector("[role=dialog]", { timeout: 30000 });
  await p.waitForTimeout(1500);
}
async function pinAt(p, [lat, lng]) {
  const t = p.locator("[role=dialog] button", { hasText: "Or enter coordinates manually" });
  if (await t.count()) await t.click();
  await p.getByLabel("Latitude").fill(String(lat));
  await p.getByLabel("Longitude").fill(String(lng));
  await p.waitForFunction(() => {
    const d = document.querySelector("[role=dialog]");
    return d && !/Looking up the roads at your pin/.test(d.innerText) && (d.querySelector("[data-testid=road-pick-panel]") || d.querySelector("[data-testid=road-lookup-status]"));
  }, null, { timeout: 60000 });
  await p.waitForTimeout(2000);
}
async function saveWindow(p) {
  await p.getByRole("button", { name: "Save and close" }).click();
  await p.waitForSelector("[role=dialog]", { state: "detached", timeout: 15000 });
  await p.waitForTimeout(2500);
}
async function toSide(p, kind) {
  await p.waitForSelector("[data-testid^=kind-chip-]", { state: "attached", timeout: 60000 });
  await p.waitForTimeout(1500);
  await p.locator(`label.nyq-answer:has([data-testid=kind-chip-${kind}])`).click();
  await p.waitForTimeout(1200);
  const foot = p.locator("[data-testid=where-questions] .nyq-card .nyq-foot > button:last-child");
  const ft = (await foot.innerText().catch(() => "")).trim();
  if (!/Confirm and lay out/.test(ft)) await foot.click();
  await p.waitForSelector("[data-testid=side-option]", { state: "attached", timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(2500);
}

async function run516(p, net, sz) {
  net.phase = "1 pick on map (Colfax)";
  await openPicker(p);
  await pinAt(p, PT.colfax);
  await p.locator("[role=dialog] [role=radio]", { hasText: "East Colfax Avenue" }).click();
  await p.waitForTimeout(1500);
  await saveWindow(p);
  net.phase = "2 shoulder + side";
  await toSide(p, "shoulder");
  await p.locator("[data-testid=where-questions] label.nyq-answer").first().click();
  await p.waitForTimeout(2500);
  await shot(p, `e-${sz}-plan-with-road`, "[data-testid=band-where]");
  net.phase = "3 edit on map, pin moved, road-bearing 504";
  await openPicker(p, "Edit on map");
  net.fail = true;
  await pinAt(p, PT.fail);
  const st = await measureWindow(p, `${sz} Edit on map, pin moved to the failing point`, `e516-${sz}-failed-save-disabled`, ".mw-foot");
  net.phase = "3b forced Save with no answer";
  await p.evaluate(() => [...document.querySelectorAll("[role=dialog] button")].find((x) => x.innerText.trim() === "Save and close")?.click());
  await p.keyboard.press("Enter").catch(() => {});
  await p.waitForTimeout(1500);
  const stillOpen = await p.locator("[role=dialog]").count();
  log(`  ${sz} #506 forced Save with no answer: dialog ${stillOpen ? "STILL OPEN (nothing saved)" : "CLOSED (saved!)"}`);
  if (!stillOpen) return { st, stillOpen: false };
  net.phase = "4 North–south picked";
  await p.locator("[data-testid=road-axis]", { hasText: "North–south" }).click();
  await p.waitForTimeout(800);
  const st2 = await measureWindow(p, `${sz} North–south picked`, `e516-${sz}-direction-picked`, ".mw-foot");
  net.phase = "4b Save and close (direction)";
  await saveWindow(p);
  await p.waitForTimeout(2500);
  const q = await sideQ(p, `${sz} side question after save`, `e516-${sz}-after-save`);
  net.phase = "5 first side answer picked";
  await p.locator("[data-testid=where-questions] label.nyq-answer").first().click().catch(() => {});
  await p.waitForTimeout(3000);
  return { st, st2, q, stillOpen: true };
}

for (const [w, h] of SIZES) {
  const sz = String(w);
  log(`== ${w}x${h} #516 reproduction`);
  const { b, p, net } = await setup(w, h);
  try {
    await run516(p, net, sz);
    const pageAxe = await axeIn(p, "body");
    log(`  corridor-geometry requests: ${net.geo.length}`);
    for (const e of net.geo) log(`    #${e.n} [${e.phase}] ${e.status} sent ${JSON.stringify(e.meta)} | answer ${JSON.stringify(e.answer)}`);
    const roadless = net.geo.filter((e) => e.meta?.work?.travel !== undefined && !e.meta?.road);
    const heading = net.geo.filter((e) => e.meta?.work?.heading !== undefined);
    const pinModel = net.geo.filter((e) => typeof e.answer === "string" && /pin_model_input/.test(e.answer));
    log(`  READINGS ${sz}: road-less work.travel ${roadless.length} | 400 pin_model_input ${pinModel.length} | with work.heading ${heading.length} (${heading.map((e) => `#${e.n} ${e.status}`).join(", ")}) | statuses ${net.geo.map((e) => e.status).join(",")}`);
    log(`  ${sz} page axe ${pageAxe.length} ${pageAxe.join("; ")} | forced 504s ${net.forced} | console errors ${net.console.length} ${net.console.join(" | ").slice(0, 500)} | page errors ${net.errors.length} ${net.errors.join(" | ").slice(0, 200)} | site 4xx/5xx ${net.bad.join(", ") || "none"}`);
  } catch (e) {
    log(`  ERROR ${oneLine(e).slice(0, 300)}`);
    for (const x of net.geo) log(`    #${x.n} [${x.phase}] ${x.status} sent ${JSON.stringify(x.meta)}`);
    await p.screenshot({ path: path.join(EXTRA, `error-${sz}.png`) }).catch(() => {});
  } finally {
    fs.writeFileSync(path.join(LOGS, `geometry-bodies-${sz}.json`), JSON.stringify(net.geo.map(({ req, ...e }) => e), null, 1));
    await b.close();
  }
}
