// #479 walk: NEEDS YOU's Details closed and open, at 1440x900, 1198x930 and
// 390x844.  The flow to the settled results is scripts/verify-generate-cls.mjs's
// (pin 1600 E Colfax Ave, shoulder work, the first side, Generate), against
// the local site with Overpass stubbed (launch479.cjs) and /api/road-bearing
// answered from the recorded Colfax fixture (that script's roadAnswer, copied).
// Then it measures every results box with Details closed, opens Details,
// measures again (plus the panel: in view, on top, page width), runs axe and
// the 44 px list on section.needs-you in both states, presses Esc (focus back
// on the toggle), and takes crops.
// usage: node walk479.mjs <site> <out dir> [sizes]
// The gate token comes from GATE_BYPASS_TOKEN (set by the caller from the
// walk's own secrets file); scripts/gate.cjs sends it only to the site's own
// origin and keeps it out of every output.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const WT = "C:/Users/rtmak/Documents/traffic-control-tool/.claude/worktrees/issue-479";
const require = createRequire(`${WT}/scripts/verify-generate-cls.mjs`);
const { newGatedContext, guardOutput, oneLine } = require(`${WT}/scripts/gate.cjs`);
guardOutput();
const { chromium } = require("playwright");
const AXE = fs.readFileSync(`${WT}/conestruct/site/node_modules/axe-core/axe.min.js`, "utf8");

const [SITE, OUT, SIZES] = process.argv.slice(2);
const sizes = (SIZES || "1440x900,1198x930,390x844").split(",").map((s) => s.split("x").map(Number));
fs.mkdirSync(path.join(OUT, "crops"), { recursive: true });

const FIX = JSON.parse(fs.readFileSync(`${WT}/validation-artifacts/committed/ux-group3-where/evidence/overpass-fixture/c74c32bdc5114bff.json`, "utf8"));
const rad = (d) => (d * Math.PI) / 180;
const brg = (a, b) => {
  const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
};
const distM = (a, at) => Math.hypot((a.lat - at.lat) * 111320, (a.lon - at.lng) * 111320 * Math.cos(rad(at.lat)));
const COLFAX_WEST = [1547338997, 1547338998, 223788857, 600545918, 791808880];
function roadAnswer(at) {
  const g = [];
  for (const id of COLFAX_WEST) {
    for (const n of FIX.elements.find((e) => e.type === "way" && e.id === id).geometry) {
      const l = g[g.length - 1];
      if (!l || l.lat !== n.lat || l.lon !== n.lon) g.push(n);
    }
  }
  const w = FIX.elements.find((e) => e.type === "way" && e.id === COLFAX_WEST[0]);
  let i = 0;
  g.forEach((n, k) => { if (distM(n, at) < distM(g[i], at)) i = k; });
  const a = g[Math.max(0, Math.min(i, g.length - 2))], b = g[Math.max(1, Math.min(i + 1, g.length - 1))];
  const s = (k) => w.tags[k] ?? null;
  return JSON.stringify({
    scan_status: "ok", primary_index: 0, isUrban: true, placeName: "Denver",
    candidates: [{
      way_id: String(w.id), highway_class: w.tags.highway, name: w.tags.name, ref: s("ref"), bearing: +brg(a, b).toFixed(2),
      snap_distance_m: +distM(g[i], at).toFixed(2), snapped_lat: g[i].lat, snapped_lng: g[i].lon, signal_distance_m: null,
      tags: { oneway: s("oneway"), maxspeed: s("maxspeed"), lanes: s("lanes"), lanes_forward: s("lanes:forward"), lanes_backward: s("lanes:backward"),
        lanes_both_ways: s("lanes:both_ways"), turn_lanes: s("turn:lanes"), turn_lanes_forward: s("turn:lanes:forward"), turn_lanes_backward: s("turn:lanes:backward") },
      geometry: g.map((n) => [n.lat, n.lon]),
    }],
  });
}

const BOXES = {
  needs: "section.needs-you", card: "section.needs-you .nyq-card", foot: "section.needs-you .nyq-foot",
  toggle: "section.needs-you .nyq-details-btn", rows: "section.needs-you .nyq-rows", other: "section.ny-other",
  plan: "[data-testid=your-plan]", downloads: "#downloads", refs: ".results-disc",
};
const measure = (p) => p.evaluate((sel) => {
  const out = {};
  for (const [k, s] of Object.entries(sel)) {
    const e = document.querySelector(s);
    if (!e) continue;
    const r = e.getBoundingClientRect();
    out[k] = { top: +(r.top + scrollY).toFixed(1), h: +r.height.toFixed(1), w: +r.width.toFixed(1) };
  }
  const t = document.querySelector("section.needs-you .nyq-details-btn");
  const panel = t ? document.getElementById(t.getAttribute("aria-controls")) : null;
  out.page = { scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth };
  out.inFlowDetails = document.querySelectorAll("section.needs-you .nyq-card > .nyq-details").length;
  if (panel && !panel.hidden) {
    const r = panel.getBoundingClientRect();
    const pts = [[r.left + r.width / 2, r.top + r.height / 2], [r.left + 4, r.top + 4], [r.right - 4, r.top + 4], [r.left + 4, r.bottom - 4], [r.right - 4, r.bottom - 4]];
    out.panel = {
      tag: panel.tagName, cls: panel.className, position: getComputedStyle(panel).position,
      left: +r.left.toFixed(1), right: +r.right.toFixed(1), top: +(r.top + scrollY).toFixed(1), h: +r.height.toFixed(1), w: +r.width.toFixed(1),
      inViewport: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight,
      onTop: pts.every(([x, y]) => { const e = document.elementFromPoint(x, y); return !!e && (e === panel || panel.contains(e)); }),
      text: panel.textContent,
      items: panel.children.length,
      lineRows: Math.round(r.height / parseFloat(getComputedStyle(panel).lineHeight || "0")) || null,
    };
  }
  return out;
}, BOXES);
async function axe(p) {
  await p.addScriptTag({ content: AXE });
  return p.evaluate(async () => {
    const r = await window.axe.run(document.querySelector("section.needs-you"), { resultTypes: ["violations"] });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, targets: v.nodes.slice(0, 4).map((n) => n.target.join(" ")) }));
  });
}
const small = (p) => p.evaluate(() => {
  const out = [];
  for (const e of document.querySelectorAll("section.needs-you button, section.needs-you a, section.needs-you label.nyq-answer")) {
    const r = e.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (getComputedStyle(e).visibility === "hidden") continue;
    if (r.width < 44 || r.height < 44) out.push({ text: (e.innerText || e.getAttribute("aria-label") || "").trim().slice(0, 40), w: +r.width.toFixed(1), h: +r.height.toFixed(1) });
  }
  return out;
});
// The viewport as it stands (the card's foot scrolled to the centre once,
// before the closed crop), so the closed and open crops line up pixel for
// pixel and the sticky bars sit where the operator sees them.
async function crop(p, file) {
  await p.screenshot({ path: path.join(OUT, "crops", file) });
}

async function run(w, h) {
  const b = await chromium.launch();
  try {
    const ctx = await newGatedContext(b, SITE, { viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await ctx.addInitScript(() => {
      window.__ls = [];
      try {
        new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__ls.push({ v: e.value, r: e.hadRecentInput, t: e.startTime }); })
          .observe({ type: "layout-shift", buffered: true });
      } catch {}
    });
    const p = await ctx.newPage();
    await p.route("**/api/road-bearing**", (r) => {
      const asked = JSON.parse(r.request().postData() ?? "null");
      return r.fulfill({ status: 200, contentType: "application/json", body: roadAnswer({ lat: asked.lat, lng: asked.lng }) });
    });
    await p.goto(`${SITE}/sandbox`, { waitUntil: "networkidle", timeout: 240000 });
    await p.waitForSelector(".a-open .a-head", { timeout: 120000 });
    await p.getByRole("button", { name: "Pick on map" }).click();
    await p.waitForTimeout(1500);
    await p.getByLabel("Address or intersection search").fill("1600 E Colfax Ave, Denver");
    await p.getByRole("button", { name: "SEARCH" }).click();
    await p.waitForFunction(() => {
      const d = document.querySelector("[role=dialog]");
      const save = [...(d?.querySelectorAll("button") ?? [])].find((x) => /Save & Close/.test(x.innerText));
      return /PICK THE ROAD · \d+ FOUND|Which road/i.test(d?.innerText ?? "") || (save && !save.disabled);
    }, null, { timeout: 90000 });
    await p.waitForTimeout(1500);
    const want = p.getByRole("dialog").locator("button", { hasText: /Colfax/ });
    if ((await want.count()) > 0) await want.first().click().catch(() => {});
    await p.waitForTimeout(2000);
    await p.getByRole("button", { name: "Save & Close" }).click();
    await p.waitForSelector("[data-testid^=kind-chip-]", { state: "attached", timeout: 60000 });
    await p.waitForTimeout(2500);
    await p.locator("label.nyq-answer:has([data-testid=kind-chip-shoulder])").click();
    await p.waitForTimeout(1200);
    await p.locator("[data-testid=where-questions] .nyq-card .nyq-foot > button:last-child").click();
    await p.waitForSelector("[data-testid=side-option]", { state: "attached", timeout: 30000 });
    await p.waitForTimeout(1200);
    await p.locator("[data-testid=where-questions] label.nyq-answer").first().click();
    await p.waitForTimeout(1500);
    await p.locator("[data-testid=where-confirm]").click();
    await p.waitForSelector("[data-testid=cell-work-type]", { timeout: 90000 });
    await p.waitForTimeout(3000);
    const oneWay = p.getByRole("button", { name: /^One-way$/ });
    if (await oneWay.count()) { await oneWay.first().click(); await p.waitForTimeout(3000); }
    const laneOk = p.getByRole("button", { name: "Lane count is right" });
    if (await laneOk.count()) { await laneOk.first().click(); await p.waitForTimeout(3000); }
    await p.waitForFunction(() => { const g = document.querySelector("[data-testid=generate-plan]"); return g && !g.disabled; }, null, { timeout: 120000 });
    await p.waitForTimeout(1500);
    await p.getByTestId("generate-plan").click();
    await p.waitForFunction(() => {
      const s = document.querySelector(".status-slot")?.innerText ?? "";
      return /Plan ready|VERIFIED|UNAVAILABLE|DECLINED/i.test(s) && !document.querySelector("[data-testid=results-outline]") && document.querySelector(".ref-sections");
    }, null, { timeout: 240000 });
    await p.waitForSelector("section.needs-you .nyq-details-btn", { timeout: 60000 });
    await p.waitForTimeout(3000);
    // Bring the card's foot into view and let anything sticky settle.
    await p.evaluate(() => document.querySelector("section.needs-you .nyq-foot").scrollIntoView({ block: "center" }));
    await p.waitForTimeout(1200);
    const s = { size: `${w}x${h}` };
    s.question = (await p.locator("section.needs-you .nyq-q").first().innerText()).trim();
    s.closed = await measure(p);
    s.axeClosed = await axe(p);
    s.smallClosed = await small(p);
    await crop(p, `${w}x${h}-details-closed.png`);
    const t0 = await p.evaluate(() => performance.now());
    await p.locator("section.needs-you .nyq-details-btn").click();
    await p.waitForTimeout(800);
    s.open = await measure(p);
    s.shiftsOnOpen = await p.evaluate((t0) => (window.__ls ?? []).filter((e) => e.t >= t0).map((e) => ({ v: +e.v.toFixed(4), recentInput: e.r })), t0);
    s.axeOpen = await axe(p);
    s.smallOpen = await small(p);
    await crop(p, `${w}x${h}-details-open.png`);
    await p.keyboard.press("Escape");
    await p.waitForTimeout(300);
    s.afterEsc = await measure(p);
    s.escFocusOnToggle = await p.evaluate(() => document.activeElement?.classList.contains("nyq-details-btn") && !!document.activeElement.closest("section.needs-you"));
    s.escClosed = !s.afterEsc.panel;
    const diff = {};
    for (const k of Object.keys(BOXES)) {
      const a = s.closed[k], o = s.open[k];
      if (a && o) diff[k] = { top: +(o.top - a.top).toFixed(1), h: +(o.h - a.h).toFixed(1) };
    }
    s.openMinusClosed = diff;
    return s;
  } finally {
    await b.close();
  }
}

const all = [];
for (const [w, h] of sizes) {
  try {
    const s = await run(w, h);
    all.push(s);
    fs.writeFileSync(path.join(OUT, `walk-${w}x${h}.json`), JSON.stringify(s, null, 2));
    const moved = Object.entries(s.openMinusClosed).filter(([, d]) => d.top !== 0 || d.h !== 0).map(([k, d]) => `${k} ${d.top}/${d.h}`);
    const pn = s.open.panel;
    console.log(`${s.size} | q "${s.question.slice(0, 40)}" | NEEDS YOU h ${s.closed.needs?.h} -> ${s.open.needs?.h} | card h ${s.closed.card?.h} -> ${s.open.card?.h} | moved: ${moved.length ? moved.join(", ") : "none"} | in-flow details ${s.open.inFlowDetails}`);
    console.log(`   panel ${pn ? `${pn.tag} ${pn.position} x ${pn.left}-${pn.right} w ${pn.w} h ${pn.h} inView=${pn.inViewport} onTop=${pn.onTop} items=${pn.items}` : "NOT OPEN"} | page scrollW ${s.open.page.scrollW} / clientW ${s.open.page.clientW} (closed ${s.closed.page.scrollW})`);
    console.log(`   shifts on open: ${JSON.stringify(s.shiftsOnOpen)} | axe closed ${s.axeClosed.length} open ${s.axeOpen.length} | <44px closed ${JSON.stringify(s.smallClosed)} open ${JSON.stringify(s.smallOpen)} | toggle ${s.closed.toggle?.w}x${s.closed.toggle?.h} | Esc closed=${s.escClosed} focus on toggle=${s.escFocusOnToggle}`);
  } catch (e) {
    console.log(`${w}x${h} ERROR ${oneLine(e).slice(0, 200)}`);
  }
}
