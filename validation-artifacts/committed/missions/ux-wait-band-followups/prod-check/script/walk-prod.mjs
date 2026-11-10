// Mission ux-wait-band-followups (#478) production check: one walk per width
// on https://www.conestruct.com/sandbox (1600 E Colfax Ave, Denver; live road
// data, no road stub).  Read-only page loads plus one Generate.
//   #469: the WHERE kind question's band height with Details closed, open,
//         closed again; the floating panel's position and whether it is on
//         top; Esc closes it and returns focus to the toggle.
//   #477: the audit answer is held 16 s in the browser (Playwright route,
//         the site's own request re-sent with the gate header) so the wait
//         is seen: at 1.2 s (step text, no bar, no "Step N of M"), at 14.5 s
//         (the slow line, byte for byte).  /api/needs-you-map is held 4 s so
//         the frame's stand-in is seen before the map loads.
//   axe (whole document) and visible controls under 44 px, at the kind
//   question and once the results settle; console errors and page errors
//   for the whole walk.
// usage: SITE=https://www.conestruct.com GATE_BYPASS_TOKEN=... node walk-prod.mjs <outdir> [sizes]
// The gate header rides only the site's own origin (scripts/gate.cjs).
import { createRequire } from "node:module";
import fs from "node:fs";
const WT = "C:/Users/rtmak/Documents/traffic-control-tool/.claude/worktrees/mission-478-prod-check";
const require = createRequire("C:/Users/rtmak/Documents/traffic-control-tool/package.json");
const { chromium } = require("playwright");
const { newGatedContext, gateHeaders, isSiteRequest } = require(`${WT}/scripts/gate.cjs`);
const AXE = fs.readFileSync("C:/Users/rtmak/Documents/traffic-control-tool/conestruct/site/node_modules/axe-core/axe.min.js", "utf8");
const SITE = process.env.SITE ?? "https://www.conestruct.com";
const [OUT, SIZES] = process.argv.slice(2);
const sizes = (SIZES || "1440x900,1198x930,390x844").split(",").map((s) => s.split("x").map(Number));
const HOLD = 16000, MAP_HOLD = 4000;
const SLOW = "This is taking longer than usual. The first plan after a quiet spell can take up to 30 seconds.";
fs.mkdirSync(`${OUT}/crops`, { recursive: true });
fs.mkdirSync(`${OUT}/walk`, { recursive: true });

const axe = async (p) => {
  await p.addScriptTag({ content: AXE });
  return p.evaluate(async () => (await window.axe.run(document, { resultTypes: ["violations"] })).violations.map((v) => ({ id: v.id, nodes: v.nodes.length, targets: v.nodes.slice(0, 4).map((n) => n.target.join(" ")) })));
};
const small = (p, root) => p.evaluate((root) => {
  const r0 = document.querySelector(root) ?? document.body;
  const out = [];
  for (const e of r0.querySelectorAll("button, a, label.nyq-answer, summary, [role=button]")) {
    const r = e.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    const cs = getComputedStyle(e);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    if (r.width < 44 || r.height < 44) out.push(`${(e.innerText || e.getAttribute("aria-label") || "").trim().slice(0, 30)} ${r.width.toFixed(0)}x${r.height.toFixed(0)}`);
  }
  return out;
}, root);
const band = (p) => p.evaluate(() => {
  const q = (s) => document.querySelector(s);
  const bx = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return { top: +(r.top + scrollY).toFixed(1), h: +r.height.toFixed(1) }; };
  const d = q("[data-testid=where-questions] .nyq-details");
  let panel = null;
  if (d && !d.hidden) {
    d.scrollIntoView({ block: "nearest" });
    const r = d.getBoundingClientRect();
    const pts = [[r.left + r.width / 2, r.top + r.height / 2], [r.left + 4, r.top + 4], [r.right - 4, r.top + 4], [r.left + 4, r.bottom - 4], [r.right - 4, r.bottom - 4]];
    panel = { position: getComputedStyle(d).position, onTop: pts.every(([x, y]) => { const e = document.elementFromPoint(x, y); return !!e && d.contains(e); }),
      inViewport: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth, top: +(r.top + scrollY).toFixed(1), h: +r.height.toFixed(1), w: +r.width.toFixed(1) };
  }
  return { band: bx(q("[data-testid=band-where]")), q: (q("[data-testid=where-questions] .nyq-q")?.innerText ?? "").trim().slice(0, 50), panel };
});

async function run(w, h) {
  const tag = `${w}x${h}`;
  const out = { size: tag, console: [], pageerrors: [], where: {}, wait: {}, settled: {} };
  const b = await chromium.launch();
  try {
    const ctx = await newGatedContext(b, SITE, { viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    p.on("console", (m) => { if (m.type() === "error") out.console.push(m.text().slice(0, 200)); });
    p.on("pageerror", (e) => out.pageerrors.push(String(e).slice(0, 200)));
    let hold = 0, mapHold = 0;
    await p.route("**/api/render/audit", async (r) => {
      if (hold === 0) return r.fallback();
      const own = isSiteRequest(r.request().url(), SITE) ? gateHeaders(SITE) : {};
      const t = Date.now();
      const resp = await r.fetch({ headers: { ...r.request().headers(), ...own } });
      out.wait.auditMs = Date.now() - t;
      const body = await resp.body();
      await new Promise((res) => setTimeout(res, Math.max(0, hold - (Date.now() - t))));
      return r.fulfill({ status: resp.status(), headers: resp.headers(), body });
    });
    await p.route("**/api/needs-you-map**", async (r) => { if (mapHold) await new Promise((res) => setTimeout(res, mapHold)); return r.fallback(); });

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
    if (await want.count()) await want.first().click().catch(() => {});
    await p.waitForTimeout(2000);
    out.roadPicked = await p.locator("[role=dialog] [data-testid=road-picked] .road-picked-name").first().innerText({ timeout: 1000 }).catch(() => "");
    await p.getByRole("button", { name: "Save & Close" }).click();
    await p.waitForSelector("[data-testid^=kind-chip-]", { state: "attached", timeout: 60000 });
    await p.waitForSelector("[data-testid=band-aerial-img]", { timeout: 60000 }).catch(() => {});
    await p.waitForTimeout(2500);

    // #469: the kind question, Details closed / open / closed / open + Esc.
    const toggle = p.locator("[data-testid=where-questions] .nyq-details-btn").first();
    out.where.closed1 = await band(p);
    out.where.axeKind = await axe(p);
    out.where.smallBand = await small(p, "[data-testid=band-where]");
    await toggle.click(); await p.waitForTimeout(800);
    out.where.open = await band(p);
    out.where.axeOpen = await axe(p);
    out.where.smallOpen = await small(p, "[data-testid=band-where]");
    if (w === 1440 || w === 390) {
      const o = out.where.open;
      const top = o.band.top, bottom = Math.max(o.band.top + o.band.h, o.panel ? o.panel.top + o.panel.h : 0) + 16;
      await p.screenshot({ path: `${OUT}/crops/${tag}-details-open.png`, fullPage: true, clip: { x: 0, y: top, width: w, height: bottom - top } });
    }
    await toggle.click(); await p.waitForTimeout(800);
    out.where.closed2 = await band(p);
    await toggle.click(); await p.waitForTimeout(800);
    out.where.open2 = await band(p);
    await p.keyboard.press("Escape"); await p.waitForTimeout(800);
    out.where.escFocusOnToggle = await p.evaluate(() => document.activeElement?.classList.contains("nyq-details-btn") ?? false);
    out.where.afterEsc = await band(p);

    // Through WHERE to Generate (the permanent check's steps).
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

    // #477: the wait.
    hold = HOLD; mapHold = MAP_HOLD;
    const waitRead = () => p.evaluate(() => {
      const slot = document.querySelector(".status-slot");
      const line = document.querySelector(".status-slot .wait-line");
      const ol = document.querySelector("[data-outline=needs]");
      const body = document.body.innerText;
      return {
        slotText: (slot?.innerText ?? "").replace(/\s+/g, " ").trim(),
        lineText: line ? line.querySelector(".wait-step")?.textContent ?? null : null,
        lineClass: line?.className ?? null,
        bars: document.querySelectorAll("[role=progressbar], progress, .wait-bar, .status-slot [class*=bar-fill], .status-slot [class*=progress]").length,
        stepNofM: /Step \d+ of \d+/i.test(body),
        stepWordInSlot: /\bStep\b/.test(slot?.innerText ?? ""),
        outline: !!document.querySelector("[data-testid=results-outline]"),
        needsOutline: ol ? { top: Math.round(ol.getBoundingClientRect().top + scrollY), h: Math.round(ol.getBoundingClientRect().height) } : null,
      };
    });
    await p.getByTestId("generate-plan").click();
    await p.waitForTimeout(1200);
    out.wait.at1200 = await waitRead();
    await p.locator(".status-slot").screenshot({ path: `${OUT}/crops/${tag}-wait-strip-1s.png` }).catch(() => {});
    await p.waitForTimeout(14500 - 1200);
    out.wait.at14500 = await waitRead();
    out.wait.slowByteEqual = out.wait.at14500.lineText === SLOW;
    await p.locator(".status-slot").screenshot({ path: `${OUT}/crops/${tag}-14s-strip.png` }).catch(() => {});
    await p.waitForFunction(() => !document.querySelector("[data-testid=results-outline]"), null, { timeout: 240000 });
    out.wait.swap = await p.evaluate(() => {
      const f = document.querySelector("section.needs-you .nyq-map-frame");
      if (!f) return { frame: false };
      const st = f.querySelector("[data-testid=needs-you-map-standin]");
      const img = st?.querySelector("img");
      return { frame: true, standin: !!st, standinImg: !!img, standinImgLoaded: img ? img.complete && img.naturalWidth > 0 : false, standinOpacity: img ? getComputedStyle(img).opacity : null,
        greyBlock: !!st?.querySelector(".ro-block"), mapImg: !!f.querySelector("[data-testid=needs-you-map-img]"), frameH: Math.round(f.getBoundingClientRect().height) };
    });
    if (out.wait.swap.frame) {
      await p.locator("section.needs-you .nyq-map-frame").scrollIntoViewIfNeeded().catch(() => {});
      await p.locator("section.needs-you .nyq-map-frame").screenshot({ path: `${OUT}/crops/${tag}-frame-standin.png` }).catch(() => {});
    }
    await p.waitForFunction(() => {
      const s = document.querySelector(".status-slot")?.innerText ?? "";
      return /Plan ready|VERIFIED|UNAVAILABLE|DECLINED/i.test(s) && !document.querySelector("[data-testid=results-outline]") && document.querySelector(".ref-sections");
    }, null, { timeout: 240000 });
    hold = 0;
    await p.waitForTimeout(MAP_HOLD + 2500);
    mapHold = 0;
    out.settled = await p.evaluate(() => {
      const ny = document.querySelector("section.needs-you");
      return {
        strip: (document.querySelector(".status-slot")?.innerText ?? "").replace(/\s+/g, " ").trim().slice(0, 120),
        needsYou: ny ? { top: Math.round(ny.getBoundingClientRect().top + scrollY), h: Math.round(ny.getBoundingClientRect().height) } : null,
        cards: document.querySelectorAll("section.needs-you .nyq-card").length,
        nyText: (ny?.innerText ?? "").replace(/\s+/g, " ").slice(0, 160),
        outlinesLeft: document.querySelectorAll("[data-outline]").length,
        mapImg: !!document.querySelector("section.needs-you [data-testid=needs-you-map-img]"),
        standinLeft: !!document.querySelector("[data-testid=needs-you-map-standin]"),
      };
    });
    out.settled.axe = await axe(p);
    out.settled.small = await small(p, "section.results");
  } catch (e) {
    // First line only: a Playwright call log lists request headers (the gate header too).
    out.error = String(e?.message ?? e).split("\n")[0].slice(0, 300);
  } finally {
    await b.close();
  }
  fs.writeFileSync(`${OUT}/walk/${tag}.json`, JSON.stringify(out, null, 1));
  const W = out.where, A = out.wait, S = out.settled;
  const hs = [W.closed1, W.open, W.closed2, W.open2, W.afterEsc].map((x) => x?.band?.h);
  console.log(`${tag} road "${out.roadPicked}" | WHERE q "${W.closed1?.q}" band h closed/open/closed/open/esc ${hs.join("/")} spread ${(Math.max(...hs) - Math.min(...hs)).toFixed(1)} | panel ${W.open?.panel ? `${W.open.panel.position} onTop=${W.open.panel.onTop} inView=${W.open.panel.inViewport}` : "none"} | Esc focus on toggle ${W.escFocusOnToggle} | axe kind ${W.axeKind?.length} open ${W.axeOpen?.length} | <44 band ${W.smallBand?.length} open ${W.smallOpen?.length}`);
  console.log(`${tag} wait 1.2s: "${A.at1200?.slotText}" bars ${A.at1200?.bars} StepNofM ${A.at1200?.stepNofM} needs outline ${JSON.stringify(A.at1200?.needsOutline)}`);
  console.log(`${tag} wait 14.5s: class "${A.at14500?.lineClass}" byte-equal ${A.slowByteEqual} bars ${A.at14500?.bars} StepNofM ${A.at14500?.stepNofM} | audit answered in ${A.auditMs} ms`);
  console.log(`${tag} swap: ${JSON.stringify(A.swap)}`);
  console.log(`${tag} settled: strip "${S.strip}" | NEEDS YOU ${JSON.stringify(S.needsYou)} cards ${S.cards} | outlines left ${S.outlinesLeft} | map img ${S.mapImg} standin left ${S.standinLeft} | axe ${S.axe?.length} [${(S.axe ?? []).map((v) => `${v.id}:${v.nodes}`).join(", ")}] | <44 ${S.small?.length} [${(S.small ?? []).join("; ")}]`);
  console.log(`${tag} console errors ${out.console.length}${out.console.length ? " [" + out.console.join(" | ") + "]" : ""} | page errors ${out.pageerrors.length}${out.error ? " | WALK ERROR " + out.error : ""}`);
}
for (const [w, h] of sizes) await run(w, h);
