// #493 check 2b (approved by the coordinator 2026-11-10): ONE intersection
// NEEDS YOU map on the real sandbox pin, with the WHERE tap's record.
//
// Step 1, capture (no map render): drive /sandbox at 1440x900 as
// scripts/verify-generate-cls.mjs does (1600 E Colfax Ave, Denver; live road
// data; shoulder work, first side; Generate) and capture the body the page
// POSTs to /api/needs-you-map.  Every /api/needs-you-map and
// /api/corridor-map request in the browser is ABORTED, so the walk asks for
// no NEEDS YOU or corridor map image.
// Step 2, the one render: that body with flag adjacent_intersection, no
// soft, 846x423 (the page's two-column size), and meta.intersection = the
// committed tap record tests/fixtures/needs-you/colfax-franklin-tap.json
// (written by the real producer, cross-street-tap-record.test.ts), POSTed
// once to the site's /api/needs-you-map.  Prints x-map-cross-source,
// x-map-cross-street, x-map-subject, x-map-frame and the wall time.
//
// Usage (worktree root): GATE_BYPASS_TOKEN=... OUT=<dir> node <this file>
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../../..");
const require = createRequire(path.join(ROOT, "scripts", "verify-generate-cls.mjs"));
const { newGatedContext, gateHeaders, guardOutput, oneLine } = require("./gate.cjs");
guardOutput();
const { chromium } = require("playwright");

const SITE = "https://www.conestruct.com";
const OUT = process.env.OUT;
const TAP = JSON.parse(fs.readFileSync(path.join(ROOT, "tests/fixtures/needs-you/colfax-franklin-tap.json"), "utf8"));

let captured = null;
const b = await chromium.launch();
try {
  const ctx = await newGatedContext(b, SITE, { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.route("**/api/needs-you-map**", (r) => {
    if (!captured) captured = JSON.parse(r.request().postData() ?? "null");
    return r.abort();
  });
  await p.route("**/api/corridor-map**", (r) => r.abort());
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
  const picked = await p.locator("[role=dialog] [data-testid=road-picked] .road-picked-name").first().innerText({ timeout: 1000 }).catch(() => "");
  console.log(`road picked: ${picked || "none"}`);
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
  const until = Date.now() + 240000;
  while (!captured && Date.now() < until) await p.waitForTimeout(500);
} catch (e) {
  console.log(`walk error: ${oneLine(e)}`);
} finally {
  await b.close();
}

if (!captured) {
  console.log("RESULT not measured: no /api/needs-you-map body captured");
  process.exit(1);
}
const s = captured.scenario;
console.log(`captured: flag ${captured.flag}, ${captured.width}x${captured.height}, soft ${captured.soft ?? false}; kind ${s.kind}; pin ${s.meta.lat},${s.meta.lng}; road "${s.meta.roadName}"; centerline ${s.meta.centerline?.length ?? 0} pts; meta.intersection before ${s.meta.intersection ? JSON.stringify({ name: s.meta.intersection.name, lat: s.meta.intersection.lat, lng: s.meta.intersection.lng, geometry: s.meta.intersection.geometry?.length ?? 0 }) : "none"}`);

const body = { ...captured, flag: "adjacent_intersection", width: 846, height: 423 };
delete body.soft;
delete body.zoom;
body.scenario = { ...s, meta: { ...s.meta, intersection: TAP } };
if (OUT) fs.writeFileSync(path.join(OUT, "map-493b-body.json"), JSON.stringify(body, null, 1));

const url = `${SITE}/api/needs-you-map`;
const t0 = performance.now();
const r = await fetch(url, { method: "POST", headers: { ...gateHeaders(url), "content-type": "application/json" }, body: JSON.stringify(body) });
const bytes = Buffer.from(await r.arrayBuffer());
const wall = (performance.now() - t0) / 1000;
const h = (n) => r.headers.get(n);
const street = h("x-map-cross-street") ? decodeURIComponent(h("x-map-cross-street")) : null;
console.log(`render: status ${r.status}, ${bytes.length} bytes, wall ${wall.toFixed(2)} s`);
for (const n of ["x-map-cross-source", "x-map-subject", "x-map-cross-tag", "x-map-frame", "x-map-point"]) console.log(`  ${n}: ${h(n)}`);
console.log(`  x-map-cross-street: ${street}`);
if (OUT && r.ok) fs.writeFileSync(path.join(OUT, "needs-you-map-493b.png"), bytes);
const pass = r.status === 200 && h("x-map-cross-source") === "tap" && street === "Franklin Street" && h("x-map-subject") === "drawn";
console.log(`RESULT ${pass ? "PASS" : "FAIL"}: x-map-cross-source ${h("x-map-cross-source")}, cross street ${street ?? "none"}, subject ${h("x-map-subject")}, wall ${wall.toFixed(2)} s (n=1)`);
process.exit(pass ? 0 : 1);
