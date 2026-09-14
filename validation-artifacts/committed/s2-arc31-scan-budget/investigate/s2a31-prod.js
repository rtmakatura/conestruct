// s2-arc31 investigate — #256: the shape of the failure, measured on prod.
//
//   node s2a31-prod.js <outDir> <expectSha> [cycles] [coldGapS]
//
// WHAT THIS MEASURES.  One cycle = four served audits: denver COLD,
// denver WARM (fired immediately after, same key), lakewood COLD,
// lakewood WARM.  Between cycles it sleeps `coldGapS` so the next
// cycle's first request finds the memo expired (MEMO_TTL_S = 120 s,
// site_scan.py:76) — the default 130 s clears it with margin.
//
// WHY N = 20 CYCLES.  #256's acceptance is "<= 1 refusal in 20 cold
// runs".  Twenty cold Denver runs is the smallest N that can be
// compared to that bar without arithmetic.  It is not enough to put a
// tight confidence interval on a ~30 % rate; it IS enough to tell
// 1-in-3 from 1-in-20, which is the decision in front of us.  The
// distribution is reported, not just the mean — the tail is the defect.
//
// !! WHAT A "WARM" ROW CANNOT PROVE !!  The memo is per CONTAINER
// (site_scan.py:71-76) and Modal fans out over several.  A WARM row
// that reports memo_hit=false is NOT evidence the memo is broken — it
// is evidence the request landed on a different container.  The
// warm-miss RATE is therefore a measurement of container fan-out, and
// is reported as that and not as a memo defect.
//
// !! AND WHAT THE WHOLE RUN CANNOT PROVE !!  Overpass load is a
// property of the hour, not of this sha.  A clean run does not mean
// #256 is fixed and a bad run does not mean it got worse; the number
// that matters is the rate across the run, stamped with its start time,
// and it is comparable only to another run of the same shape.
//
// WALL DECOMPOSITION.  `wall` is the whole proxy round trip; `scan` is
// site_scan.duration_ms (the Overpass site-scan trip only).  The
// remainder is layout + the corridor bearing check, which has its OWN
// 20 s budget and no memo (site_detection.py:44, audit.py:1356).  When
// the corridor column reads check_unavailable and wall-minus-scan is
// near 20 s, that residual IS the corridor check spending its budget.
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const BASE = process.env.A31_BASE || "https://www.conestruct.com";
const HEALTHZ = "https://rtmakatura--conestruct-render-fastapi-app.modal.run/healthz";
const OUT = process.argv[2] || path.join(__dirname, "outS2A31");
const EXPECT_SHA = process.argv[3] || "";
const CYCLES = Number(process.argv[4] || 20);
const COLD_GAP_S = Number(process.argv[5] || 130);
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
  const cv = findAll(json, (o) => typeof o.checked === "boolean" && ("warnings" in o || "reason" in o))[0] ?? null;
  return {
    status: scan?.status, memo_hit: scan?.memo_hit, duration_ms: scan?.duration_ms,
    measured_at: scan?.measured_at, error: scan?.error ?? null,
    mirror: scan?.mirror ?? null, remark: scan?.overpass_remark ?? null,
    response_bytes: scan?.response_bytes ?? null, element_count: scan?.element_count ?? null,
    corridor: cv ? `${cv.checked ? "checked" : "not-checked"}${cv.reason ? "/" + cv.reason : ""}` : "?",
    corridor_error: cv?.error ?? null,
  };
}

async function fire(bodies, pin, cycle, leg) {
  const t0 = Date.now();
  let r = null, text = "", err = null;
  try {
    r = await fetch(BASE + "/api/render/audit", {
      method: "POST", headers: { "content-type": "application/json" }, body: bodies[pin.name],
    });
    text = await r.text();
  } catch (e) { err = e.name + ": " + e.message; }
  const wall = Date.now() - t0;
  let json = null; try { json = JSON.parse(text); } catch {}
  fs.writeFileSync(path.join(OUT, "audit-" + pin.name + "-" + leg + "-" + String(cycle).padStart(2, "0") + ".json"), text);
  const refused = json?.detail?.site_scan ?? {};
  const sum = (r && r.status === 200) ? summarize(json) : {
    status: err ? "FETCH " + err : "HTTP " + (r ? r.status : "?"),
    error: (json?.detail?.error ?? text.slice(0, 120)) + " | " + (refused.error ?? ""),
    memo_hit: refused.memo_hit ?? null, duration_ms: refused.duration_ms ?? null,
    measured_at: refused.measured_at ?? null, mirror: refused.mirror ?? null,
    remark: refused.overpass_remark ?? null, response_bytes: refused.response_bytes ?? null,
    element_count: refused.element_count ?? null, corridor: "n/a", corridor_error: null,
  };
  // The residual is layout + the corridor check's own budget.
  const residual_ms = sum.duration_ms != null ? wall - sum.duration_ms : null;
  const row = { cycle, pin: pin.name, leg, http: r ? r.status : null, wall_ms: wall,
                residual_ms, bytes: Buffer.byteLength(text), ...sum };
  log("[c" + cycle + " " + pin.name + " " + leg + "] http=" + row.http + " wall=" + wall +
      "ms scan=" + row.duration_ms + " residual=" + residual_ms + " status=" + row.status +
      " memo=" + row.memo_hit + " corridor=" + row.corridor + " mirror=" + row.mirror +
      " remark=" + row.remark + " elem=" + row.element_count + " bytes=" + row.response_bytes +
      (row.error ? " error=" + row.error : ""));
  return row;
}

(async () => {
  const hz = await (await fetch(HEALTHZ)).json();
  log("healthz sha " + hz.sha + " expect " + EXPECT_SHA);
  if (EXPECT_SHA && hz.sha !== EXPECT_SHA) { log("SHA GATE FAILED"); process.exit(2); }
  log("base " + BASE + " cycles=" + CYCLES + " coldGap=" + COLD_GAP_S + "s started " + new Date().toISOString());
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
    while (Date.now() - t0 < 120000 && !captured.some((b) => b && b.includes('"site_scan"'))) await page.waitForTimeout(200);
    const body = captured.find((b) => b && b.includes('"site_scan"'));
    if (!body) { log("[" + pin.name + "] no scanned audit request captured — cannot replay"); process.exit(3); }
    bodies[pin.name] = body;
    fs.writeFileSync(path.join(OUT, "wire-" + pin.name + ".json"), body);
    const s = JSON.parse(body).scenario;
    log("[" + pin.name + "] wire: kind=" + s.kind + " roadType=" + s.roadType + " divided=" + s.divided +
        " speed=" + s.speed + " lanes=" + s.lanes + " bearing=" + s.meta.bearingDeg +
        " centerline=" + (s.meta.centerline ? s.meta.centerline.length : "none"));
    await page.close();
  }
  await browser.close();

  const rows = [];
  for (let c = 1; c <= CYCLES; c++) {
    for (const pin of PINS) {
      rows.push(await fire(bodies, pin, c, "cold"));
      rows.push(await fire(bodies, pin, c, "warm"));
    }
    fs.writeFileSync(path.join(OUT, "rows.json"), JSON.stringify(rows, null, 1));
    if (c < CYCLES) { log("-- cycle " + c + " done, sleeping " + COLD_GAP_S + "s to expire the memo --"); await sleep(COLD_GAP_S * 1000); }
  }
  fs.writeFileSync(path.join(OUT, "rows.json"), JSON.stringify(rows, null, 1));
  log("DONE " + rows.length + " rows " + new Date().toISOString());
})();
