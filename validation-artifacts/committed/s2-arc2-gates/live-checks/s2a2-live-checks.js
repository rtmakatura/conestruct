/**
 * s2-arc2 live checks (Refs #173, #176) — production, headless,
 * READ-ONLY: transient picker/form state + compute-only renders, nothing
 * saved server-side.
 *
 * Scope (from the GO / plan):
 *   gate   — healthz == origin/main == served bundle
 *   P1–P6  — payload-level gate branches via the prod render proxy
 *   S1–S3  — shoulder browser flow on a REAL refusing pin (E Bayaud Ave:
 *            genuine OSM 2 ≠ 2+2 mismatch, signal 13.75 m): refusal
 *            surfaces, recovery via the lane edit, plan generates
 *   F1–F3  — flagger browser flow, same pin: refusal, the new
 *            "Lane count is right" confirm row, recovery
 *   N1     — #176 note renders on the served NI narrative
 *   AX     — axe rides the touched surfaces (refusal banner state,
 *            armed confirm-row state)
 *
 * Run from repo root:
 *   EXPECTED_SHA=$(git rev-parse origin/main) \
 *   NODE_PATH=conestruct/site/node_modules node s2a2-live-checks.js
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

const OUT = path.join(__dirname, "outS2A2");
fs.mkdirSync(OUT, { recursive: true });

const SITE = "https://www.conestruct.com/sandbox";
const EXPECTED_SHA = process.env.EXPECTED_SHA || "";

// The live refusing pin found by the corridor sweep (Overpass scan of
// fully-lane-tagged Denver ways -> our own detection API confirms):
// E Bayaud Ave way 39508704, lanes=2 / forward=2 / backward=2 (a genuine
// arithmetic mismatch OSM carries today — its turn:lanes tags show the
// turn-pocket double-counting the gate exists for), oneway=no, and a
// traffic signal 13.75 m from the snapped point.  Sweep record:
// outS2A2/corridor-sweep.md.
const BAYAUD = { lat: "39.71466", lng: "-104.94071" };

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
async function pickBayaudCandidate(page) {
  await waitDetection(page);
  // Pick the Bayaud row explicitly (snap 0.05 m makes it the top row,
  // but name-match rather than position-trust).
  const row = page
    .locator("button", { hasText: "m from pin" })
    .filter({ hasText: /Bayaud/i });
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
async function waitForText(page, re, tries = 30) {
  for (let i = 0; i < tries; i++) {
    const t = ((await page.textContent("body").catch(() => "")) ?? "").replace(/\s+/g, " ");
    if (re.test(t)) return true;
    await page.waitForTimeout(1000);
  }
  return false;
}
async function waitForTextGone(page, re, tries = 30) {
  for (let i = 0; i < tries; i++) {
    const t = ((await page.textContent("body").catch(() => "")) ?? "").replace(/\s+/g, " ");
    if (!re.test(t)) return true;
    await page.waitForTimeout(1000);
  }
  return false;
}
async function freshPage(ctx) {
  const page = await ctx.newPage();
  await page.goto(SITE, { waitUntil: "networkidle" });
  return page;
}

// The mirror pointers (frontend) and the backend sentence fragments.
const SHOULDER_POINTER =
  /lane counts contradict each other beside a signalized intersection — set Lanes per direction in the Road section/;
const FLAGGER_POINTER =
  /lane counts contradict each other beside a signalized intersection — confirm .Lane count is right. in the Road section/;
const BACKEND_SENTENCE = /A signalized intersection is about \d+ ft from this location/;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 2200 } });

  // ── Gate ──────────────────────────────────────────────────────────
  const gp = await ctx.newPage();
  const hz = await (
    await gp.request.get("https://rtmakatura--conestruct-render-fastapi-app.modal.run/healthz")
  ).json();
  log(`healthz sha: ${hz.sha}`);
  log(`expected (git rev-parse origin/main): ${EXPECTED_SHA}`);
  await gp.goto(SITE, { waitUntil: "networkidle" });
  const chunkUrls = await gp.evaluate(() =>
    Array.from(document.querySelectorAll("script[src]"))
      .map((s) => s.src)
      .filter((s) => s.includes("/_next/static")),
  );
  let servedSha = null;
  for (const u of chunkUrls) {
    const txt = await (await gp.request.get(u)).text();
    const m = txt.match(new RegExp(`${EXPECTED_SHA.slice(0, 7)}[0-9a-f]{33}`));
    if (m) {
      servedSha = m[0];
      break;
    }
  }
  log(`served bundle sha: ${servedSha}`);
  if (hz.sha !== EXPECTED_SHA || servedSha !== EXPECTED_SHA) {
    log("**ABORT** — build gate mismatch (runner: pause and retry if mid-propagation)");
    process.exit(2);
  }
  assert("gate. healthz == origin/main == served bundle", true, hz.sha.slice(0, 7));

  // ── P1–P6: payload-level gate branches via the prod proxy ─────────
  const SHOULDER_BODY = {
    kind: "shoulder",
    meta: { project: "s2a2 live check", address: "", lat: 39.71466, lng: -104.94071 },
    roadType: "urban_arterial", speed: 35, lanes: 2, laneWidth: 12, divided: false,
    workType: "utility_locate", duration: "short", workLen: 1000, night: false,
  };
  const FLAGGER_BODY = {
    kind: "flagger_lane_closure",
    meta: { project: "s2a2 live check", address: "", lat: 39.71466, lng: -104.94071 },
    roadType: "urban_arterial", speed: 35, laneWidth: 12,
    workType: "utility_cut", duration: "long", workLen: 400, night: false,
    pilotCar: false, afad: false, pedestrianAccess: false,
  };
  const MISMATCH = { detectedLanesTotal: 2, detectedLanesForward: 1, detectedLanesBackward: 2 };
  async function audit(scenario) {
    const r = await gp.request.post("https://www.conestruct.com/api/render/audit", {
      data: { scenario },
    });
    let detail = "";
    try {
      const j = await r.json();
      detail = typeof j === "string" ? j : j.error || j.detail || "";
    } catch {
      detail = await r.text().catch(() => "");
    }
    return { status: r.status(), detail: String(detail) };
  }
  const P = [
    ["P1. shoulder near-signal + mismatch refuses", { ...SHOULDER_BODY, ...MISMATCH, signalDistanceM: 26.84 }, 400, /about 88 ft .*set Lanes per direction in the Road section/s],
    ["P2. flagger near-signal + mismatch refuses", { ...FLAGGER_BODY, ...MISMATCH, signalDistanceM: 26.84 }, 400, /about 88 ft .*confirm .Lane count is right. in the Road section/s],
    ["P3. mismatch without the signal fact still renders", { ...SHOULDER_BODY, ...MISMATCH }, 200, null],
    ["P4. signal fact with clean relays renders", { ...SHOULDER_BODY, signalDistanceM: 26.84 }, 200, null],
    ["P5. boundary 30.00 m refuses (inclusive)", { ...SHOULDER_BODY, ...MISMATCH, signalDistanceM: 30.0 }, 400, /about 98 ft/],
    ["P6. boundary 30.01 m passes", { ...SHOULDER_BODY, ...MISMATCH, signalDistanceM: 30.01 }, 200, null],
  ];
  for (const [name, body, want, detailRe] of P) {
    const { status, detail } = await audit(body);
    const ok = status === want && (!detailRe || detailRe.test(detail));
    assert(name, ok, `HTTP ${status}${detail ? ` — ${detail.slice(0, 120)}…` : ""}`);
  }

  // ── S1–S3: shoulder browser flow on the real Bayaud pin ───────────
  {
    const page = await freshPage(ctx);
    await openPickerWithCoords(page, BAYAUD, /Pick Location on Map/);
    const picked = await pickBayaudCandidate(page);
    log(picked ? "Bayaud candidate picked (shoulder)" : "no candidate at Bayaud pin");
    const saved = await saveWhenReady(page);
    log(saved ? "picker saved (shoulder @ Bayaud)" : "save unavailable");

    assert(
      "S1. shoulder refusal surfaces on the real pin (mirror pointer)",
      await waitForText(page, SHOULDER_POINTER),
    );
    // #180 shortening measured live: when the mirror matches, the banner
    // shows the POINTER and not the raw 400 — the backend sentence (with
    // the measured distance) is the payload-level voice, asserted at P1.
    const bodyText = ((await page.textContent("body")) ?? "").replace(/\s+/g, " ");
    assert(
      "S2. banner is the shortened mirror pointer, not the raw 400 (#180)",
      !BACKEND_SENTENCE.test(bodyText),
    );
    await page.screenshot({ path: path.join(OUT, "01-shoulder-refusal.png") }).catch(() => {});
    {
      const ax = await runAxe(page, "axe-shoulder-refusal.json");
      assert(
        "AX1. axe zero violations — page in the refusal state",
        ax.length === 0,
        ax.length ? `${ax.length} finding(s) — axe-shoulder-refusal.json` : "0",
      );
    }

    // Recovery: the lane edit clears the relays; the refusal lifts and
    // the plan generates.
    const lanesField = page
      .locator("div", { hasText: /^Lanes per direction/ })
      .last()
      .locator("xpath=..");
    await page.getByRole("button", { name: "3", exact: true }).first().click();
    assert(
      "S3. lane edit lifts the refusal (plan regenerates, no 400 text)",
      await waitForTextGone(page, SHOULDER_POINTER),
    );
    await page.screenshot({ path: path.join(OUT, "02-shoulder-recovered.png") }).catch(() => {});
    await page.close();
  }

  // ── F1–F3: flagger browser flow, same pin ─────────────────────────
  {
    const page = await freshPage(ctx);
    await page.getByRole("button", { name: /Flagger lane closure/ }).click();
    await page.waitForTimeout(500);
    await openPickerWithCoords(page, BAYAUD, /Pick Location on Map/);
    const picked = await pickBayaudCandidate(page);
    log(picked ? "Bayaud candidate picked (flagger)" : "no candidate at Bayaud pin");
    const saved = await saveWhenReady(page);
    log(saved ? "picker saved (flagger @ Bayaud)" : "save unavailable");

    assert(
      "F1. flagger refusal surfaces on the real pin (mirror pointer)",
      await waitForText(page, FLAGGER_POINTER),
    );
    const row = page.getByRole("checkbox", { name: /Lane count is right/ });
    assert(
      "F2. the new confirm row is armed in the Road section",
      await row.isVisible().catch(() => false),
    );
    await page.screenshot({ path: path.join(OUT, "03-flagger-refusal-row-armed.png") }).catch(() => {});
    {
      const ax = await runAxe(page, "axe-flagger-armed-row.json");
      assert(
        "AX2. axe zero violations — armed confirm-row state",
        ax.length === 0,
        ax.length ? `${ax.length} finding(s) — axe-flagger-armed-row.json` : "0",
      );
    }

    await row.click();
    const lifted = await waitForTextGone(page, FLAGGER_POINTER);
    const checked = (await row.getAttribute("aria-checked").catch(() => null)) === "true";
    assert(
      "F3. tick lifts the refusal; the row stays, checked, describing the override",
      lifted && checked,
    );
    await page.screenshot({ path: path.join(OUT, "04-flagger-recovered.png") }).catch(() => {});
    await page.close();
  }

  // ── N1: the #176 note on the served NI narrative ──────────────────
  {
    const NI = {
      kind: "near_intersection",
      meta: { project: "s2a2 byte-compare", address: "", lat: 0, lng: 0 },
      roadType: "urban_arterial", speed: 35, lanes: 2, laneWidth: 12, divided: false,
      workType: "utility_cut", duration: "short", workLen: 500, night: false,
      approaches: [{
        id: "cross_a", speed: 30, roadType: "urban_arterial", lanesPerDirection: 1,
        laneWidth: 12, signalized: false, alongStationFt: -200,
      }],
    };
    const r = await gp.request.post("https://www.conestruct.com/api/render/markdown", {
      data: { scenario: NI },
    });
    const md = await r.text();
    assert(
      "N1. served NI narrative carries the rightmost-lane note (predicate single-sourced)",
      r.status() === 200 && /RIGHTMOST lane/.test(md) && /modeling assumption/.test(md),
    );
    fs.writeFileSync(path.join(OUT, "ni-narrative-served.md"), md);
  }

  await gp.close();
  await browser.close();

  fs.writeFileSync(
    path.join(OUT, "assertions-raw.md"),
    `# s2-arc2 live checks — raw log\n\n${lines.join("\n")}\n\nFailures: ${failures}\n`,
  );
  console.log(`\nDONE — failures: ${failures}`);
  process.exit(failures ? 1 : 0);
})();
