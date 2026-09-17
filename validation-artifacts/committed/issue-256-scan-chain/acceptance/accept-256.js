// #256 acceptance leg — ruling f, measured on prod AFTER fix 1 (5d569d7).
//
//   node accept-256.js <outDir> <expectSha> [cycles] [coldGapS]
//
// WHAT RULING f ASKS FOR, AND WHAT THIS IS.  "N = 20 cold runs per pin,
// spaced past the memo TTL, both pins, sha-gated, provenance showing the
// mirror index reached.  <= 1 refusal in 20 per pin."  One cycle here is
// four served audits — denver COLD, denver WARM, lakewood COLD, lakewood
// WARM — then a sleep past MEMO_TTL_S (120 s, site_scan.py) so the next
// cycle's first request finds the memo expired.  Twenty cycles gives the
// twenty cold runs per pin the ruling names.
//
// DELIBERATELY THE SAME SHAPE AS s2a31-prod.js.  This is the before/after
// pair for the same measurement, so the cycle structure, the pins, the
// bearing and the work length are unchanged from the investigate run.  A
// different shape would not be comparable, and comparability is the whole
// point of running it before the fold changes the query.
//
// WHAT IT ADDS.  The mirror INDEX (1/2/3 against OVERPASS_MIRRORS order),
// not just the URL, because "mirror 3 reached in production" is the claim
// fix 1 has to make good.  Before fix 1, arc-31 measured mirror 1 on 80 of
// 80 prod rows.
//
// !! WHAT THIS CANNOT PROVE !!  Overpass load is a property of the hour,
// not of this sha.  A clean run does not mean #256 is closed and a bad run
// does not mean fix 1 failed.  The comparable number is the rate across
// the run, stamped with its start time, against the arc-31 run of the same
// shape.  Both are reported, neither is asserted as the truth.
//
// !! AND WHAT A WARM ROW CANNOT PROVE !!  The memo is per CONTAINER
// (site_scan.py:71-76) over max_containers=8.  A WARM row with
// memo_hit=false is container fan-out, NOT a broken memo.  Reported as
// fan-out, under its own heading.
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const BASE = process.env.A31_BASE || "https://www.conestruct.com";
const HEALTHZ = "https://rtmakatura--conestruct-render-fastapi-app.modal.run/healthz";
const OUT = process.argv[2] || path.join(__dirname, "outAccept");
const EXPECT_SHA = process.argv[3] || "";
const CYCLES = Number(process.argv[4] || 20);
const COLD_GAP_S = Number(process.argv[5] || 130);

// src/rules/site_detection.py OVERPASS_MIRRORS, in order.  The index is
// what ruling f asks the provenance to show.
const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
];
const mirrorIndex = (url) => {
  if (!url) return null;
  const i = MIRRORS.indexOf(url);
  return i >= 0 ? i + 1 : "UNKNOWN:" + url;
};

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
  const residual_ms = sum.duration_ms != null ? wall - sum.duration_ms : null;
  const row = { cycle, pin: pin.name, leg, http: r ? r.status : null, wall_ms: wall,
                residual_ms, bytes: Buffer.byteLength(text), mirror_index: mirrorIndex(sum.mirror), ...sum };
  log("[c" + cycle + " " + pin.name + " " + leg + "] http=" + row.http + " wall=" + wall +
      "ms scan=" + row.duration_ms + " status=" + row.status + " memo=" + row.memo_hit +
      " corridor=" + row.corridor + " mirror#" + row.mirror_index +
      " elem=" + row.element_count + (row.error ? " error=" + row.error : ""));
  return row;
}

function report(rows, startedAt, hzStart, hzEnd) {
  const L = [];
  const p = (s) => { L.push(s); log(s); };
  p("");
  p("=====================================================================");
  p("#256 ACCEPTANCE LEG — ruling f");
  p("=====================================================================");
  p("started " + startedAt + "  finished " + new Date().toISOString());
  p("healthz at start " + hzStart + "   at end " + hzEnd +
    (hzStart === hzEnd ? "   (no deploy mid-run)" : "   !! SHA MOVED MID-RUN — rows are not one build !!"));
  p("");
  for (const pin of PINS) {
    const cold = rows.filter((r) => r.pin === pin.name && r.leg === "cold");
    const refused = cold.filter((r) => r.http !== 200);
    const ok = cold.filter((r) => r.http === 200);
    p("-- " + pin.name + " / cold, n=" + cold.length + " --");
    p("   refusals: " + refused.length + "/" + cold.length +
      "   (ruling f bar: <= 1 in 20)  " + (refused.length <= 1 ? "PASS" : "FAIL"));
    const dist = {};
    for (const r of cold) { const k = String(r.mirror_index); dist[k] = (dist[k] || 0) + 1; }
    p("   mirror index reached: " + JSON.stringify(dist));
    const cu = ok.filter((r) => String(r.corridor).includes("check_unavailable"));
    p("   corridor check_unavailable on ok rows: " + cu.length + "/" + ok.length +
      (ok.length ? "  (" + Math.round((100 * cu.length) / ok.length) + " %)" : "") +
      "   (ruling f bar: <= 1 in 20)  " + (cu.length <= 1 ? "PASS" : "FAIL"));
    const durs = ok.map((r) => r.duration_ms).filter((v) => typeof v === "number").sort((a, b) => a - b);
    if (durs.length) {
      const q = (f) => durs[Math.min(durs.length - 1, Math.floor(f * durs.length))];
      p("   scan duration_ms (ok): n=" + durs.length + " min=" + durs[0] + " median=" + q(0.5) +
        " p90=" + q(0.9) + " max=" + durs[durs.length - 1]);
    }
    // #256 ruling c — the fold's own signal, and the only one this probe
    // can see.  `residual = wall - scan duration` is everything the request
    // did EXCEPT the site scan: layout, plus — before the fold — the
    // corridor bearing check's SEPARATE round trip on its own 20 s budget.
    // Two trips put that second wait in here; one trip cannot.  So a
    // residual that collapses between an unfolded build and a folded one is
    // the fold, measured rather than asserted.
    const res = ok.map((r) => r.residual_ms).filter((v) => typeof v === "number").sort((a, b) => a - b);
    if (res.length) {
      const q = (f) => res[Math.min(res.length - 1, Math.floor(f * res.length))];
      p("   residual_ms (ok, = layout + any second trip): n=" + res.length +
        " min=" + res[0] + " median=" + q(0.5) + " p90=" + q(0.9) + " max=" + res[res.length - 1]);
    }
    const warm = rows.filter((r) => r.pin === pin.name && r.leg === "warm" && r.http === 200);
    const warmMiss = warm.filter((r) => r.memo_hit === false);
    p("   warm rows with memo_hit=false: " + warmMiss.length + "/" + warm.length +
      "  — container fan-out, NOT a memo defect");
    p("");
  }
  const all = rows.filter((r) => r.leg === "cold");
  const reachedLater = all.filter((r) => r.mirror_index === 2 || r.mirror_index === 3);
  p("-- the claim fix 1 has to make good --");
  p("   cold rows reaching mirror 2 or 3: " + reachedLater.length + "/" + all.length);
  p("   (arc-31, before fix 1: 0 of 80 prod rows — every one read mirror 1)");
  p("=====================================================================");
  fs.writeFileSync(path.join(OUT, "REPORT.txt"), L.join("\n") + "\n");
}

(async () => {
  const hzStart = (await (await fetch(HEALTHZ)).json()).sha;
  log("healthz sha " + hzStart + " expect " + EXPECT_SHA);
  if (EXPECT_SHA && hzStart !== EXPECT_SHA) { log("SHA GATE FAILED"); process.exit(2); }
  const startedAt = new Date().toISOString();
  log("base " + BASE + " cycles=" + CYCLES + " coldGap=" + COLD_GAP_S + "s started " + startedAt);
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
  // Re-gate at the end: a deploy mid-run would mean the rows are not one build.
  const hzEnd = (await (await fetch(HEALTHZ)).json()).sha;
  report(rows, startedAt, hzStart, hzEnd);
  log("DONE " + rows.length + " rows " + new Date().toISOString());
})();
