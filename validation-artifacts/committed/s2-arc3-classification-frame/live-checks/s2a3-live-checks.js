/**
 * s2-arc3 live checks, round 1 (Refs #207) — production at 71a1144,
 * headless, READ-ONLY: transient picker/form state + compute-only
 * detect calls, nothing saved server-side.
 *
 * Scope (plan + the finding this round surfaced):
 *   gate — healthz == origin/main == served bundle
 *   D1   — corridor-mode detect without a centerline still serves
 *          (the pre-#207 body, byte-compatible)
 *   D2   — THE FINDING: a relay-bearing detect (the committed Lookout
 *          fixture's 166-vertex geometry) must reach the backend.
 *          Expected to FAIL at 71a1144: the proxy's 1 KB body cap
 *          413's it (fix on issue-207-proxy-relay, awaiting ship).
 *   D3   — the silent-strip proof: a sub-1 KB body with a sharply BENT
 *          3-vertex centerline returns byte-identical classifications
 *          to the no-centerline body — the allowlist re-constructor
 *          drops the field before Modal sees it.  (Post-fix this
 *          comparison MUST differ; asserted inverted then.)
 *   B1-B3— browser flow on the Lakewood control pin: confirm the road,
 *          click Detect, and assert the POSTed body carries the
 *          centerline (the shipped frontend relay is live) — then that
 *          the 413 surfaces as an honest visible error, not silence.
 *   AX1  — axe on the post-detect-error state.
 *
 * The plan's curved-pin drawn-vs-classified consistency and the
 * straight-control ±0.2 ft A/B are BLOCKED by the D2 finding (the road
 * frame is unreachable through the served proxy) — they run in round 2
 * after the fix ships.
 *
 * Run from repo root:
 *   EXPECTED_SHA=$(git rev-parse origin/main) \
 *   NODE_PATH=conestruct/site/node_modules node s2a3-live-checks.js
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const AXE_SRC = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf-8");
async function runAxe(page, outName) {
  await page.evaluate(AXE_SRC);
  const res = await page.evaluate(() =>
    window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] },
    }),
  );
  const compact = res.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    targets: v.nodes.map((n) => n.target.join(" ")),
  }));
  fs.writeFileSync(path.join(OUT, outName), JSON.stringify(compact, null, 2));
  return compact;
}

const OUT = path.join(__dirname, "outS2A3");
fs.mkdirSync(OUT, { recursive: true });

const BASE = "https://www.conestruct.com";
const SITE = `${BASE}/sandbox`;
const EXPECTED_SHA = process.env.EXPECTED_SHA || "";

// Committed fixture — the arc's curved road (no network needed for the
// geometry itself).
const FIX = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "../../../../tests/fixtures/centerline/lookout_mountain_road.json"),
    "utf-8",
  ),
);
// Lakewood control pin (the arcs-12..16 straight control).
const LAKEWOOD = { lat: "39.7113", lng: "-105.0815" };

const lines = [];
let failures = 0;
function log(msg) {
  const stamp = new Date().toISOString();
  lines.push(`- \`${stamp}\` ${msg}`);
  console.log(`${stamp} ${msg}`);
}
function assert(name, cond, extra = "") {
  if (cond) log(`**PASS** — ${name}${extra ? ` (${extra})` : ""}`);
  else {
    failures++;
    log(`**FAIL** — ${name}${extra ? ` (${extra})` : ""}`);
  }
}

async function post(pathname, body) {
  const r = await fetch(BASE + pathname, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON (e.g. the 413 text) */
  }
  return { status: r.status, json, text };
}

// Strip per-call jitter before comparing two detect responses: distance
// roundings are stable, but Overpass element order within a bucket can
// vary — compare a canonicalized shape.
function canonical(json) {
  const out = {};
  for (const [k, v] of Object.entries(json)) {
    if (v && typeof v === "object" && Array.isArray(v.features)) {
      out[k] = {
        detected: v.detected,
        count: v.count,
        features: [...v.features].sort((a, b) =>
          String(a.label).localeCompare(String(b.label)),
        ),
      };
    }
  }
  return JSON.stringify(out);
}

async function openPickerWithCoords(page, coords, buttonRe) {
  await page.getByRole("button", { name: buttonRe }).click();
  await page.getByRole("dialog", { name: "Define work zone" }).waitFor();
  const toggle = page.getByText(/enter coordinates manually/i);
  if (await toggle.isVisible().catch(() => false)) await toggle.click();
  await page.getByLabel("Latitude").fill(coords.lat);
  await page.getByLabel("Longitude").fill(coords.lng);
}
async function waitDetection(page) {
  for (let i = 0; i < 40; i++) {
    const t = (
      (await page.getByRole("dialog").textContent().catch(() => "")) ?? ""
    ).replace(/\s+/g, " ");
    if (!/Detecting roads at pin|Classifying road/i.test(t)) return t;
    await page.waitForTimeout(1000);
  }
  return "";
}
async function pickCandidate(page, nameRe) {
  await waitDetection(page);
  const row = page
    .locator("button", { hasText: "m from pin" })
    .filter({ hasText: nameRe });
  if ((await row.count()) > 0) {
    await row.first().click();
    await page.waitForTimeout(1000);
    return true;
  }
  const any = page.locator("button", { hasText: "m from pin" });
  if ((await any.count()) > 0) {
    await any.first().click();
    await page.waitForTimeout(1000);
    return true;
  }
  return false;
}
async function saveWhenReady(page) {
  const save = page.getByRole("button", { name: "Save & Close" });
  for (let i = 0; i < 30 && !(await save.isEnabled().catch(() => false)); i++) {
    await page.waitForTimeout(1000);
  }
  if (!(await save.isEnabled().catch(() => false))) return false;
  await save.click();
  await page.waitForTimeout(800);
  return true;
}

(async () => {
  // ---- gate ---------------------------------------------------------------
  const hz = await (
    await fetch("https://rtmakatura--conestruct-render-fastapi-app.modal.run/healthz")
  ).json();
  log(`healthz sha: ${hz.sha}`);
  log(`expected (git rev-parse origin/main): ${EXPECTED_SHA}`);
  let bundleSha = "";
  {
    const html = await (await fetch(SITE)).text();
    const chunks = [...html.matchAll(/\/_next\/static\/chunks\/[a-zA-Z0-9._-]+\.js/g)].map(
      (m) => m[0],
    );
    for (const c of [...new Set(chunks)]) {
      const js = await (await fetch(BASE + c)).text();
      if (EXPECTED_SHA && js.includes(EXPECTED_SHA)) {
        bundleSha = EXPECTED_SHA;
        log(`served bundle sha found in ${c}`);
        break;
      }
    }
  }
  assert(
    "gate. healthz == origin/main == served bundle",
    hz.sha === EXPECTED_SHA && bundleSha === EXPECTED_SHA,
    hz.sha.slice(0, 7),
  );

  // ---- D-series: the served proxy ----------------------------------------
  const corridorBody = {
    lat: FIX.anchor[0],
    lng: FIX.anchor[1],
    radius_m: 500,
    bearing_deg: FIX.bearing_deg,
    speed_mph: 40,
    work_zone_ft: 800.0,
    closure_type: "shoulder",
    road_type: "rural_undivided",
    lane_width_ft: 12.0,
  };

  const d1 = await post("/api/render/detect-site", corridorBody);
  assert(
    "D1. corridor-mode detect without a centerline serves",
    d1.status === 200 && d1.json && d1.json.mode === "corridor",
    `HTTP ${d1.status}`,
  );
  fs.writeFileSync(path.join(OUT, "d1-no-centerline.json"), JSON.stringify(d1.json, null, 2));

  const d2 = await post("/api/render/detect-site", {
    ...corridorBody,
    centerline: FIX.centerline,
  });
  assert(
    "D2. relay-bearing detect (166-vertex fixture geometry) reaches the backend",
    d2.status === 200 && d2.json && d2.json.mode === "corridor",
    `HTTP ${d2.status}${d2.json ? "" : ` — ${d2.text.slice(0, 60)}`}`,
  );
  fs.writeFileSync(
    path.join(OUT, "d2-with-centerline.txt"),
    `HTTP ${d2.status}\n${d2.text.slice(0, 2000)}`,
  );

  // A sharply bent synthetic centerline through the anchor, small enough
  // to clear even the old 1 KB cap.  If the proxy passes it, the
  // corridor bbox + stations change materially; if the proxy strips it,
  // the response canonicalizes identically to D1.
  const bent = [
    [FIX.anchor[0], FIX.anchor[1]],
    [FIX.anchor[0] - 0.004, FIX.anchor[1] + 0.001],
    [FIX.anchor[0] - 0.005, FIX.anchor[1] + 0.008],
  ];
  const d3 = await post("/api/render/detect-site", {
    ...corridorBody,
    centerline: bent,
  });
  const stripped =
    d3.status === 200 && d3.json && canonical(d3.json) === canonical(d1.json || {});
  assert(
    "D3. a sub-1 KB bent centerline changes the classification (not silently stripped)",
    d3.status === 200 && d3.json && !stripped,
    stripped
      ? "response canonically identical to D1 — the allowlist dropped the field"
      : `HTTP ${d3.status}`,
  );
  fs.writeFileSync(path.join(OUT, "d3-bent-small.json"), JSON.stringify(d3.json, null, 2));

  // ---- B-series: the browser flow on the Lakewood control -----------------
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  let detectRequestBody = null;
  let detectResponseStatus = null;
  page.on("request", (req) => {
    if (req.url().includes("/api/render/detect-site") && req.method() === "POST") {
      try {
        detectRequestBody = JSON.parse(req.postData() || "null");
      } catch {
        detectRequestBody = null;
      }
    }
  });
  page.on("response", (res) => {
    if (res.url().includes("/api/render/detect-site")) detectResponseStatus = res.status();
  });

  await page.goto(SITE, { waitUntil: "networkidle" });
  await openPickerWithCoords(page, LAKEWOOD, /Pick Location on Map/);
  const picked = await pickCandidate(page, /Wadsworth/i);
  log(picked ? "Lakewood candidate picked (Wadsworth)" : "no candidate row found");
  const saved = await saveWhenReady(page);
  log(saved ? "picker saved (Lakewood)" : "Save & Close never enabled");

  await page
    .getByRole("button", { name: /detect nearby site conditions/i })
    .click()
    .catch(() => {});
  for (let i = 0; i < 30 && detectResponseStatus === null; i++) {
    await page.waitForTimeout(1000);
  }

  assert(
    "B1. the browser's detect body carries the confirmed road's centerline",
    !!(
      detectRequestBody &&
      Array.isArray(detectRequestBody.centerline) &&
      detectRequestBody.centerline.length >= 2
    ),
    detectRequestBody && detectRequestBody.centerline
      ? `${detectRequestBody.centerline.length} vertices`
      : "no centerline in the POSTed body",
  );
  fs.writeFileSync(
    path.join(OUT, "b1-browser-detect-body.json"),
    JSON.stringify(detectRequestBody, null, 2),
  );

  assert(
    "B2. the relay-bearing browser detect succeeds end-to-end",
    detectResponseStatus === 200,
    `HTTP ${detectResponseStatus}`,
  );

  const bodyText = ((await page.textContent("body").catch(() => "")) ?? "").replace(
    /\s+/g,
    " ",
  );
  const surfaced =
    /Detection failed \(\d+\)/i.test(bodyText) || /flag\(s\) auto-checked/i.test(bodyText);
  assert(
    "B3. the outcome is surfaced honestly (result count or a visible error, never silence)",
    surfaced,
    /Detection failed/i.test(bodyText) ? "error surfaced" : "result surfaced",
  );
  await page.screenshot({ path: path.join(OUT, "01-post-detect-state.png"), fullPage: true });

  const ax = await runAxe(page, "axe-post-detect.json");
  assert("AX1. axe zero violations — post-detect state", ax.length === 0, `${ax.length} finding(s)`);

  await browser.close();

  fs.writeFileSync(path.join(OUT, "assertions-raw.md"), lines.join("\n") + "\n");
  console.log(`\nDONE — failures: ${failures}`);
  process.exit(failures > 0 ? 1 : 0);
})();
