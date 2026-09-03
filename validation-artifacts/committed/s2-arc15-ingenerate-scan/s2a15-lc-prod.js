// s2-arc15 live check — #224 phase 1, the in-generate site scan (wire level).
//
// Two modes, picked from BASE:
//   prod   BASE=https://www.conestruct.com   → through the Next proxy routes
//          (/api/render/audit etc., body {scenario}); the s2-arc12 prologue
//          quotes /healthz verbatim and GATES on healthz sha == origin/main.
//   local  BASE=http://127.0.0.1:8765         → the FastAPI app directly
//          (/render/audit, bare scenario, bearer RENDER_API_SECRET); the
//          prologue records `git rev-parse HEAD` and states that the served
//          build is the working tree.
//
// Assertions (wire data only — nothing renders this phase, ruling 7):
//   A  plain audit → sections.site_scan is PRESENT with status not_run /
//      reason not_requested (ruling 6; Rule 10: absence is never "not run").
//   B  audit with site_scan at the Lakewood control → status ok, mode
//      corridor, inputs echo the plan's own params (closure shoulder,
//      road_type urban_high, shoulder 10 ft), the flags are exactly the
//      detected buckets mapped, sections.site_adjustments fires one record
//      per flag, measured_at/duration_ms present.  If Overpass is down at
//      run time this reports FAIL (environmental) — re-run; never a pass.
//   C  live parity: /render/detect-site with the SAME corridor inputs →
//      button-rule flags → audit with those manual flags; site_adjustments
//      byte-equal to B's, device-breakdown rows equal.  (Two live scans
//      seconds apart; a mismatch names the mirror and is environmental
//      until reproduced — the fixture-level parity proof is the test.)
//   D  memo: a second scanned audit within the TTL carries the SAME
//      measured_at and memo_hit true (ruling 2).  Prod caveat: Modal runs
//      up to 8 containers; a different container is a legitimate miss —
//      reported as INFO, not FAIL, when memo_hit is false with a later
//      measured_at.
//   E  no bearing → not_run / no_bearing (ruling 5); no coords → no_coords.
//   F  forced failure: NOT possible against real Overpass on demand — the
//      honest-400 shape (error site_scan_unavailable + provenance +
//      recovery) is proven at test level
//      (tests/test_site_scan_ingenerate.py); stated here, not faked.
//   G  response size: the scanned audit body vs the plain one, in bytes.
//
// Usage: node s2a15-lc-prod.js [outDir]        (BASE, RENDER_API_SECRET env)

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const BASE = (process.env.BASE || "https://www.conestruct.com").replace(/\/$/, "");
const PROD = /conestruct\.com/.test(BASE);
const HEALTHZ = "https://rtmakatura--conestruct-render-fastapi-app.modal.run/healthz";
const OUT = process.argv[2] || (PROD ? "outS2A15Prod" : "outS2A15Local");
const SECRET = process.env.RENDER_API_SECRET || "";

const LAT = 39.7113, LNG = -105.0815, BEARING = 180.0;
const lines = [];
let pass = 0, fail = 0, info = 0;
const log = (s) => { lines.push(s); console.log(s); };
const ok = (cond, name, detail) => {
  if (cond) { pass++; log(`**PASS** — ${name}${detail ? " — " + detail : ""}`); }
  else { fail++; log(`**FAIL** — ${name}${detail ? " — " + detail : ""}`); }
  return cond;
};
const note = (name, detail) => { info++; log(`INFO — ${name}${detail ? " — " + detail : ""}`); };

function scenario(over = {}, meta = {}) {
  const base = {
    kind: "shoulder",
    meta: { project: "s2a15 live check", address: "", lat: LAT, lng: LNG, bearingDeg: BEARING, ...meta },
    roadType: "urban_arterial", speed: 45, lanes: 2, laneWidth: 12, divided: true,
    workType: "utility_locate", duration: "short", workLen: 1000, night: false,
  };
  return { ...base, ...over };
}

async function post(endpoint, body) {
  // endpoint: "audit" | "device-breakdown" | "detect-site"
  const url = PROD ? `${BASE}/api/render/${endpoint}` : `${BASE}/render/${endpoint}`;
  const wire = endpoint === "detect-site" ? body : PROD ? { scenario: body } : body;
  const headers = { "content-type": "application/json" };
  if (!PROD) headers.authorization = `Bearer ${SECRET}`;
  const t0 = Date.now();
  const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(wire) });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON body */ }
  return { status: r.status, text, json, bytes: Buffer.byteLength(text), ms: Date.now() - t0 };
}

const BUTTON_MAP = {
  intersections: "adjacent_intersection", interchanges: "adjacent_interchange",
  sidewalks: "pedestrian_facility", bike_facilities: "bicycle_facility", schools: "school_zone",
};
function buttonFlags(det) {
  const out = {};
  for (const [k, flag] of Object.entries(BUTTON_MAP)) {
    const b = det[k];
    if (b && typeof b === "object" && b.detected) out[flag] = true;
  }
  return out;
}
const sortedJson = (v) => JSON.stringify(sortKeys(v));
function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])]));
  return v;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  log(`# s2a15 live check — ${PROD ? "PRODUCTION" : "LOCAL"}`);
  log(`UTC: ${new Date().toISOString()}`);
  log(`BASE: ${BASE}`);
  if (PROD) {
    const h = await fetch(HEALTHZ);
    const hz = await h.text();
    log(`healthz (HTTP ${h.status}): ${hz}`);
    const sha = (() => { try { return JSON.parse(hz).sha; } catch { return null; } })();
    const om = execSync("git rev-parse origin/main").toString().trim();
    log(`git rev-parse origin/main: ${om}`);
    if (!ok(sha === om, "GATE — healthz sha == origin/main", `${sha} vs ${om}`)) {
      log("GATE FAILED — aborting; nothing below was run.");
      fs.writeFileSync(path.join(OUT, "s2a15-lc.md"), lines.join("\n") + "\n");
      process.exit(2);
    }
  } else {
    const head = execSync("git rev-parse HEAD").toString().trim();
    log(`git rev-parse HEAD: ${head} — local mode: the served build is this working tree (uvicorn), not a deploy.`);
    const h = await fetch(`${BASE}/healthz`);
    log(`local healthz (HTTP ${h.status}): ${await h.text()}`);
  }
  log("");

  // A — always-present default
  const a = await post("audit", scenario());
  fs.writeFileSync(path.join(OUT, "A-plain-audit.json"), a.text);
  const aScan = a.json?.sections?.site_scan;
  ok(a.status === 200 && aScan && aScan.status === "not_run" && aScan.reason === "not_requested",
    "A1 plain audit carries sections.site_scan = not_run / not_requested", `HTTP ${a.status}, ${a.ms} ms`);
  ok(aScan && aScan.buckets && Object.keys(aScan.buckets).length === 0 && Object.keys(aScan.flags || {}).length === 0,
    "A2 not_run claims nothing (no buckets, no flags)");

  // B — the scan at the Lakewood control
  const b = await post("audit", scenario({ site_scan: {} }));
  fs.writeFileSync(path.join(OUT, "B-scanned-audit.json"), b.text);
  const bScan = b.json?.sections?.site_scan;
  const bStatus = bScan?.status;
  ok(b.status === 200 && bStatus === "ok", "B1 scanned audit → status ok",
    `HTTP ${b.status}, status=${bStatus}${bScan?.error ? ", error=" + bScan.error : ""}, ${b.ms} ms, duration_ms=${bScan?.duration_ms}`);
  if (bStatus !== "ok") log("  (environmental if Overpass was unreachable — re-run; the honest-unavailable path is what fired)");
  ok(bScan?.mode === "corridor" && !!bScan?.measured_at, "B2 mode corridor, measured_at present", `${bScan?.measured_at}`);
  const inp = bScan?.inputs || {};
  ok(inp.closure_type === "shoulder" && inp.road_type === "urban_high" && inp.shoulder_width_ft === 10 && inp.speed_mph === 45 && inp.work_zone_ft === 1000,
    "B3 inputs echo the plan's own params (ruling 3)", JSON.stringify(inp));
  const expected = buttonFlags(bScan?.buckets || {});
  ok(sortedJson(bScan?.flags || {}) === sortedJson(expected), "B4 flags == detected buckets mapped", JSON.stringify(bScan?.flags));
  const adj = b.json?.sections?.site_adjustments || [];
  ok(Object.keys(expected).length === 0 ? adj.length === 0 : adj.map((r) => r.flag).sort().join() === Object.keys(expected).sort().join(),
    "B5 site_adjustments fires one record per applied flag", adj.map((r) => r.flag).join(", ") || "(none)");
  ok(bScan?.disclosure === null && bScan?.proceeded_anyway === false, "B6 no disclosure on an ok scan");

  // C — live parity against the manual path with the same inputs
  const det = await post("detect-site", {
    lat: LAT, lng: LNG, radius_m: 500, bearing_deg: BEARING, speed_mph: 45, work_zone_ft: 1000.0,
    closure_type: "shoulder", road_type: "urban_arterial", lane_width_ft: 12.0,
  });
  fs.writeFileSync(path.join(OUT, "C-detect-site.json"), det.text);
  const detOk = det.status === 200 && det.json && !det.json.error && det.json.mode === "corridor";
  ok(detOk, "C1 manual detect-site (same corridor inputs) answered in corridor mode", `HTTP ${det.status}, ${det.ms} ms${det.json?.error ? ", error=" + det.json.error : ""}`);
  const manualFlags = detOk ? buttonFlags(det.json) : {};
  const cA = await post("audit", scenario({}, { siteConditions: manualFlags }));
  const cB = await post("device-breakdown", scenario({}, { siteConditions: manualFlags }));
  const bB = await post("device-breakdown", scenario({ site_scan: {} }));
  fs.writeFileSync(path.join(OUT, "C-manual-audit.json"), cA.text);
  ok(detOk && sortedJson(cA.json?.sections?.site_adjustments || []) === sortedJson(adj),
    "C2 parity: manual-then-generate site_adjustments == auto-scan site_adjustments",
    `manual flags ${JSON.stringify(manualFlags)} vs scan flags ${JSON.stringify(bScan?.flags)}`);
  ok(detOk && cB.status === 200 && bB.status === 200 && sortedJson(cB.json?.devices) === sortedJson(bB.json?.devices),
    "C3 parity: device rows equal", `${cB.json?.total_devices} vs ${bB.json?.total_devices} devices`);

  // D — the memo
  const d = await post("audit", scenario({ site_scan: {} }));
  const dScan = d.json?.sections?.site_scan;
  if (dScan?.memo_hit === true && dScan.measured_at === bScan?.measured_at) {
    ok(true, "D1 second scanned audit is a memo hit with the same measured_at", `${dScan.measured_at}, ${d.ms} ms`);
  } else if (PROD && dScan?.status === "ok") {
    note("D1 memo miss on prod", `memo_hit=${dScan?.memo_hit}, measured_at ${dScan?.measured_at} vs ${bScan?.measured_at} — a different Modal container is a legitimate miss (max_containers=8); the memo itself is test-proven`);
  } else {
    ok(false, "D1 memo hit", `memo_hit=${dScan?.memo_hit}, status=${dScan?.status}`);
  }

  // E — honest not_run reasons
  const noBearing = scenario({ site_scan: {} });
  delete noBearing.meta.bearingDeg;
  const e1 = await post("audit", noBearing);
  ok(e1.json?.sections?.site_scan?.status === "not_run" && e1.json?.sections?.site_scan?.reason === "no_bearing",
    "E1 no bearing → not_run / no_bearing (no point-mode fallback)");
  const e2 = await post("audit", scenario({ site_scan: {} }, { lat: 0, lng: 0 }));
  ok(e2.json?.sections?.site_scan?.status === "not_run" && e2.json?.sections?.site_scan?.reason === "no_coords",
    "E2 no coords → not_run / no_coords");

  // F — stated, not faked
  note("F forced failure not run", "Overpass cannot be downed on demand against a real backend; the honest-400 shape (error site_scan_unavailable + provenance + recovery pointer) and proceed-anyway are proven in tests/test_site_scan_ingenerate.py");

  // G — size
  log(`SIZE — plain audit ${a.bytes} B; scanned audit ${b.bytes} B; growth ${b.bytes - a.bytes} B`);
  log(`TIMING — plain audit ${a.ms} ms; first scanned audit ${b.ms} ms; second (memo) ${d.ms} ms; manual detect-site ${det.ms} ms`);

  log("");
  log(`RESULT: ${fail === 0 ? "ALL PASS" : "FAILURES"} ${pass}/${pass + fail}${info ? ` (+${info} INFO)` : ""}`);
  fs.writeFileSync(path.join(OUT, "s2a15-lc.md"), lines.join("\n") + "\n");
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { log(`CRASH — ${e.stack || e}`); fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, "s2a15-lc.md"), lines.join("\n") + "\n"); process.exit(3); });
