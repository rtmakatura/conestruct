// s2-arc22 investigate — #251 item 1: measure the served audit N times per pin.
// Step 1: drive the real /sandbox once per pin (arc-21 pin idiom), capture the
//         exact wire body the browser POSTs to /api/render/audit on Generate
//         (the one carrying site_scan).
// Step 2: replay that byte-identical body N times, spaced ≥ SPACING_S, and
//         record sections.site_scan (status, memo_hit, duration_ms, measured_at,
//         buckets[*].count/detected), the corridor check, the Note 8 row,
//         response bytes and wall ms.  Every served audit is written to OUT.
// Usage: node s2a22-runs.js <outDir> <expectSha> [N] [spacingS]
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const BASE = process.env.A22_BASE || "https://www.conestruct.com";
const HEALTHZ = "https://rtmakatura--conestruct-render-fastapi-app.modal.run/healthz";
const OUT = process.argv[2] || path.join(__dirname, "outS2A22");
const EXPECT_SHA = process.argv[3] || "";
const N = Number(process.argv[4] || 10);
const SPACING_S = Number(process.argv[5] || 31);
const PINS = [
  { name: "denver", lat: "39.726900", lng: "-104.987300" },
  { name: "lakewood", lat: "39.711300", lng: "-105.081500" },
];
const BEARING = "180", WORKLEN = "1000";
fs.mkdirSync(OUT, { recursive: true });
const log = (s) => { console.log(s); fs.appendFileSync(path.join(OUT, "log.txt"), s + "\n"); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function pinManually(page, pin) {
  await page.getByRole("button", { name: "Enter manually", exact: true }).click();
  const fill = async (labelText, value) => {
    const input = page.locator(`label:text-is("${labelText}")`).locator("xpath=following-sibling::input[1]");
    await input.fill(value);
  };
  await fill("Latitude", pin.lat);
  await page.getByRole("button", { name: "Edit manually", exact: true }).click();
  await fill("Longitude", pin.lng);
  await fill("Bearing (° from N)", BEARING);
  await fill("Work zone (ft)", WORKLEN);
  await page.waitForTimeout(400);
}

function findAll(obj, pred, acc = []) {
  if (Array.isArray(obj)) obj.forEach((v) => findAll(v, pred, acc));
  else if (obj && typeof obj === "object") {
    if (pred(obj)) acc.push(obj);
    Object.values(obj).forEach((v) => findAll(v, pred, acc));
  }
  return acc;
}

function summarize(json) {
  const scan = json?.sections?.site_scan ?? null;
  const buckets = scan?.buckets ?? {};
  const counts = {};
  for (const [k, b] of Object.entries(buckets)) counts[k] = `${b.detected ? "D" : "-"}${b.count}`;
  const note8 = findAll(json, (o) => o.label === "Signs on both sides of divided highway")[0] ?? null;
  const cv = findAll(json, (o) => typeof o.checked === "boolean" && ("warnings" in o || "reason" in o))[0] ?? null;
  return {
    status: scan?.status, memo_hit: scan?.memo_hit, duration_ms: scan?.duration_ms, measured_at: scan?.measured_at,
    error: scan?.error ?? null, counts,
    flags: scan?.flags ?? null,
    // #251 commit 2: which server said what (null before cc837f9).
    mirror: scan?.mirror ?? null, remark: scan?.overpass_remark ?? null,
    response_bytes: scan?.response_bytes ?? null, element_count: scan?.element_count ?? null,
    corridor: cv ? `${cv.checked ? "checked" : "not-checked"}${cv.reason ? "/" + cv.reason : ""}` : "?",
    note8: note8 ? `${note8.pass ? "PASS" : "FAIL"} (${note8.detail})` : "absent",
  };
}

(async () => {
  const hz = await (await fetch(HEALTHZ)).json();
  log(`healthz sha ${hz.sha} expect ${EXPECT_SHA}`);
  if (EXPECT_SHA && hz.sha !== EXPECT_SHA) { log("SHA GATE FAILED"); process.exit(2); }
  const browser = await chromium.launch();
  const bodies = {};
  for (const pin of PINS) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const captured = [];
    page.on("request", (req) => {
      if (req.method() === "POST" && /\/api\/render\/audit$/.test(req.url())) captured.push(req.postData());
    });
    await page.goto(BASE + "/sandbox", { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(600);
    await pinManually(page, pin);
    await page.waitForTimeout(3000);
    await page.getByRole("button", { name: /Generate plan/ }).click();
    const t0 = Date.now();
    while (Date.now() - t0 < 90000 && !captured.some((b) => b && b.includes('"site_scan"'))) await page.waitForTimeout(200);
    const body = captured.find((b) => b && b.includes('"site_scan"'));
    if (!body) { log(`[${pin.name}] no scanned audit request captured`); process.exit(3); }
    bodies[pin.name] = body;
    fs.writeFileSync(path.join(OUT, `wire-${pin.name}.json`), body);
    const s = JSON.parse(body).scenario;
    log(`[${pin.name}] captured wire: kind=${s.kind} roadType=${s.roadType} divided=${s.divided} speed=${s.speed} lanes=${s.lanes} bearing=${s.meta.bearingDeg} centerline=${s.meta.centerline ? s.meta.centerline.length : "none"} site_scan=${JSON.stringify(s.site_scan)}`);
    await page.close();
  }
  await browser.close();

  const rows = [];
  for (let i = 1; i <= N; i++) {
    for (const pin of PINS) {
      const t0 = Date.now();
      const r = await fetch(BASE + "/api/render/audit", { method: "POST", headers: { "content-type": "application/json" }, body: bodies[pin.name] });
      const text = await r.text();
      const ms = Date.now() - t0;
      let json = null; try { json = JSON.parse(text); } catch {}
      fs.writeFileSync(path.join(OUT, `audit-${pin.name}-${String(i).padStart(2, "0")}.json`), text);
      const refused = json?.detail?.site_scan ?? {};
      const sum = r.status === 200 ? summarize(json) : {
        status: `HTTP ${r.status}`, error: `${json?.detail?.error ?? text.slice(0, 120)} | ${refused.error ?? ""}`, counts: {},
        duration_ms: refused.duration_ms, measured_at: refused.measured_at,
        mirror: refused.mirror ?? null, remark: refused.overpass_remark ?? null,
        response_bytes: refused.response_bytes ?? null, element_count: refused.element_count ?? null,
      };
      const row = { run: i, pin: pin.name, http: r.status, bytes: Buffer.byteLength(text), ms, ...sum };
      rows.push(row);
      log(`[${pin.name} #${i}] http=${r.status} ${ms}ms ${row.bytes}B status=${row.status} memo=${row.memo_hit} dur=${row.duration_ms} at=${row.measured_at} counts=${JSON.stringify(row.counts)} corridor=${row.corridor} note8=${row.note8}${row.error ? " error=" + row.error : ""} mirror=${row.mirror} remark=${row.remark} bytes=${row.response_bytes} elements=${row.element_count}`);
    }
    if (i < N) await sleep(SPACING_S * 1000);
  }
  fs.writeFileSync(path.join(OUT, "rows.json"), JSON.stringify(rows, null, 2));
  log("DONE");
})();
