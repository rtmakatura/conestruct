// #507 production check (mission ux-group8-map-window, main eb7cfb9).
// Copied from the local walk (validation-artifacts-extra/ux-group8-map-window/
// walk-run/walk507.mjs, left as it was) and changed for production:
//   - the live site, the gate header on the site's own requests only
//     (scripts/gate.cjs newGatedContext); playwright and axe-core come from
//     the main checkout.
//   - the lookup failure (F1, #506) is forced in the browser: while
//     net.fail is on, POST /api/road-bearing answers 504, the same !r.ok
//     path as a real Overpass outage (LocationPickerModal.tsx:768).
//   - the road list's words are read from [data-testid=road-pick-panel]
//     (#512: Colfax "Traffic both ways", Lincoln "One-way", Speer "Divided road").
//   - console errors and page errors are kept per flow; Generate is not run.
//   node walk-507-prod.mjs <main checkout> <committed crops dir> <extra dir>
// Env: SIZES, FLOWS (grouped,oneway,divided,failed,edit506), GATE_BYPASS_TOKEN.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const [MAIN, CROPS, EXTRA] = process.argv.slice(2);
const WT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../../..");
const require = createRequire(path.join(MAIN, "package.json"));
if (!process.env.GATE_BYPASS_TOKEN) throw new Error("GATE_BYPASS_TOKEN not set");
const { newGatedContext, guardOutput, oneLine } = require(path.join(WT, "scripts/gate.cjs"));
guardOutput();
const { chromium } = require("playwright");
const AXE = fs.readFileSync(path.join(MAIN, "conestruct/site/node_modules/axe-core/axe.min.js"), "utf8");
const SITE = "https://www.conestruct.com";
const SIZES = (process.env.SIZES ?? "1440x900,1198x930,390x844").split(",").map((s) => s.split("x").map(Number));
const FLOWS = (process.env.FLOWS ?? "grouped,oneway,divided,failed,edit506").split(",");
const KEEP = new Set((process.env.KEEP ?? "").split(",").filter(Boolean));
fs.mkdirSync(CROPS, { recursive: true });
fs.mkdirSync(EXTRA, { recursive: true });
const PT = {
  colfax: [39.73997, -104.96632], lincoln: [39.7345, -104.9862], speer: [39.7197, -104.97677], fail: [39.7501, -104.9601],
};
const R = { states: [] };
const log = (s) => console.log(s);

async function shot(p, name, scrollSel) {
  if (scrollSel) await p.locator(scrollSel).first().scrollIntoViewIfNeeded().catch(() => {});
  await p.waitForTimeout(400);
  const dir = KEEP.has(name) ? CROPS : EXTRA;
  await p.screenshot({ path: path.join(dir, `${name}.png`) });
  return `${KEEP.has(name) ? "crops/" : "extra/"}${name}.png`;
}
async function axeDialog(p) {
  if (!(await p.evaluate(() => !!window.axe))) await p.addScriptTag({ content: AXE });
  return p.evaluate(async () => {
    const r = await window.axe.run({ include: [["[role=dialog]"]] }, { resultTypes: ["violations"] });
    return r.violations.map((v) => `${v.id}(${v.nodes.length}): ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`);
  });
}
async function axePage(p, sel) {
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
const fontsOk = (p) => p.evaluate(async () => { await document.fonts.ready; return [...document.fonts].some((f) => /inter/i.test(f.family) && f.status === "loaded"); });
async function measureWindow(p, tag, crop, scrollSel) {
  const file = await shot(p, crop, scrollSel);
  const ax = await axeDialog(p);
  const s = await small(p);
  const save = await p.evaluate(() => {
    const b = [...document.querySelectorAll("[role=dialog] button")].find((x) => x.innerText.trim() === "Save and close");
    return { exists: !!b, disabled: b?.disabled ?? null, line: document.querySelector("[data-testid=picker-save-blocked]")?.innerText ?? null };
  });
  const text = await p.evaluate(() => (document.querySelector("[role=dialog] .mw-rail")?.innerText ?? "").replace(/\n+/g, " / ").slice(0, 400));
  const rows = await p.evaluate(() => [...document.querySelectorAll("[data-testid=road-pick-panel] [role=radio]")].map((r) => `${r.getAttribute("aria-checked") === "true" ? "[x]" : "[ ]"} ${r.innerText.replace(/\s*\n+\s*/g, " / ")}`));
  const tiles = await p.evaluate(() => [...document.querySelectorAll("[data-testid=road-axis]")].map((t) => {
    const cs = getComputedStyle(t);
    const on = t.getAttribute("aria-checked");
    // #511: the mark (.road-pick-mark, the road rows' own) and the ring.
    const m = t.querySelector(".road-pick-mark");
    const mc = m ? getComputedStyle(m) : null, ma = m ? getComputedStyle(m, "::after") : null;
    const mark = m ? `${Math.round(m.getBoundingClientRect().width)}px border ${mc.borderTopWidth} ${mc.borderTopColor} bg ${mc.backgroundColor} after ${ma.content}/${ma.display}/${ma.backgroundColor}` : "none";
    return `${on === "true" ? "[x]" : "[ ]"} ${t.innerText.replace(/\s+/g, " ").trim()} | ${t.className} | outline ${cs.outlineStyle} ${cs.outlineWidth} | border ${cs.borderTopWidth} ${cs.borderTopColor} | shadow ${cs.boxShadow} | mark ${mark}`;
  }));
  if (rows.length) log(`     road rows: ${rows.join(" || ")}`);
  if (tiles.length) log(`     tiles: ${tiles.join(" || ")}`);
  const st = { tag, file, axe: ax, small: s, save, rail: text, rows, tiles };
  R.states.push(st);
  log(`  ${tag}: axe ${ax.length} ${ax.join("; ")} | 44px checked ${s.checked}, under ${s.under.length} ${s.under.join("; ")} | excepted ${s.excepted.join("; ") || "-"} | save ${save.disabled ? "DISABLED" : "enabled"}${save.line ? ` "${save.line}"` : ""}`);
  log(`     rail: ${text}`);
  return st;
}
// #469 band height and #490 columns, as scripts/verify-columns-end-together.mjs reads them.
async function band(p, tag) {
  const b = await p.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const shown = (e) => { if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden"; };
    const bx = (e) => (shown(e) ? e.getBoundingClientRect() : null);
    const frame = bx(q("[data-testid=band-aerial-frame]")), sideEl = q(".wq-stack > .wq-side"), side = bx(sideEl);
    const last = sideEl ? [...sideEl.children].filter(shown).pop() : null, l = bx(last);
    const aerial = bx(q(".wq-stack > .a-aerial")) ?? frame;
    const twoCol = !!(aerial && side && side.left >= aerial.right - 1);
    return { band: Math.round(bx(q("[data-testid=band-where]"))?.height ?? 0), twoCol,
      frameVsLast: frame && l ? Math.round(frame.bottom - l.bottom) : null, colVsCol: aerial && side ? Math.round(aerial.bottom - side.bottom) : null };
  });
  log(`  ${tag} band ${b.band} px | two columns ${b.twoCol} | frame↔last ${b.frameVsLast} px | column↔column ${b.colVsCol} px`);
  R.states.push({ tag: `${tag}-band`, ...b });
  return b;
}
async function sideQ(p, tag, crop) {
  const q = await p.evaluate(() => {
    const card = document.querySelector("[data-testid=where-questions] .nyq-card") ?? document.querySelector("[data-testid=where-questions]");
    const opts = [...document.querySelectorAll("[data-testid=where-questions] label.nyq-answer")].map((l) => ({ text: l.innerText.replace(/\n+/g, " / "), checked: !!l.querySelector("input:checked") }));
    const rows = [...document.querySelectorAll("[data-testid=where-questions] *")].filter((e) => e.children.length === 0 && /Which side/.test(e.textContent ?? "")).map((e) => e.textContent.trim()).slice(0, 3);
    return { text: (card?.innerText ?? "").replace(/\n+/g, " / ").slice(0, 500), opts, sideRows: rows,
      whyOnScreen: /is (one-way|divided) here|Only the \w+ side can be laid out/.test(document.body.innerText),
      whyInDom: /is (one-way|divided) here|Only the \w+ side can be laid out/.test(document.body.textContent),
      summary: (document.querySelector("[data-testid=where-summary-text]")?.innerText ?? "").replace(/\s+/g, " ") };
  });
  const file = await shot(p, crop, "[data-testid=where-questions]");
  const ax = await axePage(p, "[data-testid=band-where]");
  log(`  ${tag}: ${q.text}`);
  log(`     options: ${q.opts.map((o) => `${o.checked ? "[x]" : "[ ]"} ${o.text}`).join(" || ")} | band axe ${ax.length} ${ax.join("; ")}`);
  log(`     side rows: ${JSON.stringify(q.sideRows)} | why-line on screen ${q.whyOnScreen}, in DOM ${q.whyInDom} | summary "${q.summary}"`);
  R.states.push({ tag, file, ...q, axe: ax });
  return q;
}

async function setup(w, h) {
  const b = await chromium.launch();
  const ctx = await newGatedContext(b, SITE, { viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const net = { roadBearing: 0, bad: [], bodies: [], geo: [], fail: false, forced: 0, console: [], errors: [] };
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
    if (/\/api\/render\/(corridor-geometry|audit)/.test(r.url()) && r.method() === "POST") {
      try { const j = JSON.parse(r.postData() ?? "null"); const m = j?.meta ?? j?.scenario?.meta; net.bodies.push({ url: r.url().replace(SITE, ""), m }); } catch {}
    }
  });
  p.on("response", async (r) => {
    if (r.url().startsWith(SITE) && r.status() >= 400) {
      net.bad.push(`${r.status()} ${r.url().replace(SITE, "")}`);
      // The answer's body and what was sent (meta only), for a 4xx the walk didn't force.
      if (r.status() !== 504) {
        let body = "", sent = "";
        try { body = (await r.text()).slice(0, 300); } catch {}
        try { const j = JSON.parse(r.request().postData() ?? "null"); const m = j?.meta ?? j?.scenario?.meta ?? j; sent = JSON.stringify({ road: m?.confirmedRoad?.candidate?.name ?? null, roadAxis: m?.roadAxis ?? null, work: m?.work ?? null, keys: Object.keys(m ?? {}).slice(0, 20) }).slice(0, 400); } catch {}
        log(`     ${r.status()} ${r.url().replace(SITE, "")} body ${body} | sent ${sent}`);
      }
    }
    if (r.url().includes("/api/render/corridor-geometry") && r.ok()) { try { net.geo.push(await r.json()); } catch {} }
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
  const sideShown = await p.locator("[data-testid=side-option]").count();
  log(`     after kind: footer button "${ft}", side options on screen ${sideShown}`);
  if (!/Confirm and lay out/.test(ft)) await foot.click();
  await p.waitForSelector("[data-testid=side-option]", { state: "attached", timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(2500);
}
const wire = (net) => {
  const m = net.bodies.at(-1)?.m;
  if (!m) return "no wire body";
  const c = m.confirmedRoad?.candidate;
  return JSON.stringify({ road: c ? { way: c.way_id, name: c.name, bearing: c.bearing, oneway: c.tags?.oneway } : null,
    twin: c?.twin ? { way: c.twin.way_id, bearing: c.twin.bearing } : null, work: m.work ?? null, roadAxis: m.roadAxis ?? null });
};

// ── the flows ─────────────────────────────────────────────────────────────
async function grouped(p, net, sz) {
  await openPicker(p);
  await pinAt(p, PT.colfax);
  await measureWindow(p, `${sz} W1 grouped list + S4 none ticked`, `w1-${sz}-grouped`, "[data-testid=road-pick-panel]");
  // S4: the road list (none ticked) down to the disabled Save and its line.
  {
    await p.locator("[data-testid=road-pick-panel]").scrollIntoViewIfNeeded();
    await p.waitForTimeout(400);
    const a = await p.locator("[data-testid=road-pick-panel]").boundingBox();
    const f = await p.locator(".mw-foot").boundingBox();
    const y = Math.max(0, Math.min(a.y, f.y) - 8), x = Math.min(a.x, f.x) - 8;
    const name = `s4-${sz}-save-disabled`;
    await p.screenshot({ path: path.join(KEEP.has(name) ? CROPS : EXTRA, `${name}.png`),
      clip: { x: Math.max(0, x), y, width: Math.min(sz === "390" ? 390 : 1e4, Math.max(a.x + a.width, f.x + f.width) - Math.max(0, x) + 8), height: f.y + f.height - y } });
  }
  await p.locator("[role=dialog] [role=radio]", { hasText: "East Colfax Avenue" }).click();
  await p.waitForTimeout(2500);
  await measureWindow(p, `${sz} W1 grouped Colfax ticked`, `w1-${sz}-grouped-ticked`, "[data-testid=road-pick-panel]");
  await saveWindow(p);
  await toSide(p, "shoulder");
  await p.evaluate(() => document.querySelector("[data-testid=where-summary-text]")?.scrollIntoView({ block: "center" }));
  await shot(p, `w2-${sz}-grouped-summary`);
  await sideQ(p, `${sz} W2 grouped side question`, `w2-${sz}-grouped-side`);
  await band(p, `${sz} W2 grouped side`);
  const lead = wire(net);
  const geo0 = net.geo.at(-1)?.side_options?.map((o) => `${o.label}${o.carriageway ? ` [${o.carriageway}]` : ""}`);
  log(`     wire before pick: ${lead} | side_options: ${JSON.stringify(geo0)}`);
  // Prod: no twin pick and no Generate (not part of this check).
}
async function single(p, net, sz, key, kind) {
  await openPicker(p);
  await pinAt(p, PT[key]);
  await measureWindow(p, `${sz} W1 ${key}`, `w1-${sz}-${key}`, "[data-testid=road-pick-panel]");
  const enabled = await p.evaluate(() => !([...document.querySelectorAll("[role=dialog] button")].find((x) => x.innerText.trim() === "Save and close")?.disabled));
  if (!enabled) await p.locator("[role=dialog] [role=radio]").first().click();
  await saveWindow(p);
  await toSide(p, kind);
  await sideQ(p, `${sz} W2 ${key} side (${kind})`, `w2-${sz}-${key}-side`);
  log(`     wire: ${wire(net)} | side_options: ${JSON.stringify(net.geo.at(-1)?.side_options?.map((o) => o.label))}`);
  await band(p, `${sz} W2 ${key}`);
  // Round 2: the picked-for-you side row carries its why-line and no Undo.
  const row = await p.evaluate(() => {
    const b = [...document.querySelectorAll("[data-testid=where-questions] *")].filter((e) => /is (one-way|divided) here|Only the \w+ side can be laid out/.test(e.textContent ?? "")).pop();
    const r = b?.closest(".nyq-answered, li, [class*=row]") ?? b?.parentElement;
    return { row: (r?.innerText ?? "").replace(/\n+/g, " / "), undo: !!r && [...r.querySelectorAll("button")].some((x) => /Undo/.test(x.innerText)) };
  });
  log(`     picked-for-you row: "${row.row}" | Undo in the row: ${row.undo}`);
  R.states.push({ tag: `${sz} ${key} row`, ...row });
}
const AXES = ["East–west", "North–south", "Northeast–southwest", "Northwest–southeast"];
async function failed(p, net, sz) {
  await openPicker(p);
  net.fail = true;
  await pinAt(p, PT.fail);
  const n0 = net.roadBearing;
  await measureWindow(p, `${sz} F1 lookup failed`, `f1-${sz}-failed`, "[data-testid=road-lookup-status]");
  await p.getByTestId("picker-redetect").click();
  await p.waitForTimeout(500);
  await p.waitForFunction(() => !/Looking up the roads at your pin/.test(document.querySelector("[role=dialog]")?.innerText ?? ""), null, { timeout: 60000 });
  await p.waitForTimeout(1500);
  log(`  ${sz} F1 Try again: /api/road-bearing requests ${n0} -> ${net.roadBearing} (${net.roadBearing - n0} new)`);
  R.states.push({ tag: `${sz} F1 try again`, before: n0, after: net.roadBearing });
  await measureWindow(p, `${sz} F1 after Try again`, `f1-${sz}-after-try-again`, "[data-testid=road-lookup-status]");
  for (const a of AXES) {
    await p.locator("[data-testid=road-axis]", { hasText: a }).click();
    await p.waitForTimeout(800);
    const slug = a.toLowerCase().replace(/–/g, "-");
    await measureWindow(p, `${sz} F1 picked ${a}`, `f1-${sz}-${slug}`, ".mw-fieldset");
  }
  await p.locator("[data-testid=road-axis]", { hasText: "Northeast–southwest" }).click();
  await p.waitForTimeout(800);
  await saveWindow(p);
  await toSide(p, "shoulder");
  await sideQ(p, `${sz} F2 sides after NE–SW`, `f2-${sz}-ne-sw-side`);
  log(`     wire: ${wire(net)}`);
  await band(p, `${sz} F2 after NE–SW`);
}
async function edit506(p, net, sz) {
  await openPicker(p);
  await pinAt(p, PT.colfax);
  await p.locator("[role=dialog] [role=radio]", { hasText: "East Colfax Avenue" }).click();
  await p.waitForTimeout(1500);
  await saveWindow(p);
  await toSide(p, "shoulder");
  await p.locator("[data-testid=where-questions] label.nyq-answer").first().click();
  await p.waitForTimeout(2000);
  await shot(p, `e-${sz}-plan-with-road`, "[data-testid=band-where]");
  await openPicker(p, "Edit on map");
  net.fail = true;
  await pinAt(p, PT.fail);
  const st = await measureWindow(p, `${sz} #506 Edit on map, pin moved to the failing point`, `e506-${sz}-failed-save-disabled`, ".mw-foot");
  // Save never saves with no answer: force a click on the disabled button.
  await p.evaluate(() => [...document.querySelectorAll("[role=dialog] button")].find((x) => x.innerText.trim() === "Save and close")?.click());
  await p.keyboard.press("Enter").catch(() => {});
  await p.waitForTimeout(1500);
  const stillOpen = await p.locator("[role=dialog]").count();
  log(`  ${sz} #506 forced Save with no answer: dialog ${stillOpen ? "STILL OPEN (nothing saved)" : "CLOSED (saved!)"}`);
  R.states.push({ tag: `${sz} 506 forced save`, stillOpen: !!stillOpen, disabledBefore: st.save.disabled });
  if (!stillOpen) return;
  await p.locator("[data-testid=road-axis]", { hasText: "North–south" }).click();
  await p.waitForTimeout(800);
  await measureWindow(p, `${sz} #506 direction picked`, `e506-${sz}-direction-picked`, ".mw-foot");
  await saveWindow(p);
  await p.waitForTimeout(2500);
  await sideQ(p, `${sz} #506 after save`, `e506-${sz}-after-save`);
  log(`     wire: ${wire(net)}`);
  await band(p, `${sz} #506 after save`);
}

const FN = { grouped, oneway: (p, n, s) => single(p, n, s, "lincoln", process.env.ONEWAY_KIND ?? "shoulder"), divided: (p, n, s) => single(p, n, s, "speer", process.env.DIVIDED_KIND ?? "shoulder"), failed, edit506 };
for (const [w, h] of SIZES) {
  const sz = String(w);
  for (const f of FLOWS) {
    log(`== ${w}x${h} ${f}`);
    const { b, p, net } = await setup(w, h);
    try {
      log(`  Inter loaded: ${await fontsOk(p)}`);
      await FN[f](p, net, sz);
      const pageAxe = await axePage(p, "body");
      log(`  ${sz} ${f} page axe ${pageAxe.length} ${pageAxe.join("; ")} | forced 504s ${net.forced} | console errors ${net.console.length} ${net.console.join(" | ").slice(0, 400)} | page errors ${net.errors.length} ${net.errors.join(" | ").slice(0, 200)} | site 4xx/5xx ${net.bad.join(", ") || "none"}`);
      R.states.push({ tag: `${sz} ${f} end`, pageAxe, forced: net.forced, console: net.console, errors: net.errors, bad: net.bad });
    } catch (e) {
      log(`  ${f} ERROR ${oneLine(e).slice(0, 300)}`);
      R.states.push({ tag: `${sz} ${f} ERROR`, error: oneLine(e).slice(0, 300) });
      await p.screenshot({ path: path.join(EXTRA, `error-${sz}-${f}.png`) }).catch(() => {});
    } finally {
      await b.close();
    }
  }
}
fs.writeFileSync(path.join(EXTRA, `walk-${Date.now()}.json`), JSON.stringify(R, null, 1));
