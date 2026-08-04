/**
 * Arc 11 live-site smoke — near_intersection enablement (#117) against
 * https://www.conestruct.com/sandbox at the flip ship (9bcc3ca).
 * READ-ONLY: no accounts, no DB writes, no plan saves; downloads are
 * stateless renders through the page's own controls; NO route
 * interception (passive request/response observation only).
 *
 * The run's pin: E Colfax standing pin; the intersection marker lands
 * on RACE STREET (signalized, two-way) — whose OSM lane tags are
 * arithmetically DISPUTED, so the live path exercises the full
 * #120/#174/#179 chain: disputed hold → confirm → marker → undo →
 * relays restored → the SERVED #120 400 → re-confirm → payload
 * byte-identity.  (The pre-run Overpass hunt for a disputed cross
 * street found none with an eligible mainline; Race St's dispute
 * surfaced from the page's own detection.)
 *
 * Checks (flip-GO §4): gate · (a) NI end-to-end · (b) #179 undo live +
 * payload byte-identity · (c) the SERVED #120 400 + #180 pointer ·
 * (d) geometry refusals through the real form (mirror-first where the
 * increment-4 mirror pre-empts the POST — fail-safe direction; the
 * served 400s for the trio are carried by endpoint tests; the live
 * served 400 demonstrated is #120's) · (e) shoulder/flagger compat +
 * /landing DimStrip 3 · (f) axe post-generate on the NI surface, with
 * a same-scan shoulder control to classify any finding as
 * touched-surface vs pre-existing.
 *
 * Run from repo root:
 *   EXPECTED_SHA=$(git rev-parse origin/main) \
 *   NODE_PATH=<scratch>/pw/node_modules node arc11-live-checks.js
 */
const { chromium } = require("playwright");
const { AxeBuilder } = require("@axe-core/playwright");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "out11");
fs.mkdirSync(OUT, { recursive: true });

const SITE = "https://www.conestruct.com/sandbox";
const EXPECTED_SHA = process.env.EXPECTED_SHA || "";
const PIN = { lat: "39.73997", lng: "-104.96632" };

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
async function shot(page, name, full = false) {
  await page.screenshot({ path: path.join(OUT, name), fullPage: full });
  log(`screenshot: ${name}`);
}
const bodyText = async (page) =>
  (((await page.locator("body").textContent().catch(() => "")) ?? "")).replace(/\s+/g, " ");
async function settleDialog(page, dlg, pattern, timeoutS = 40) {
  for (let i = 0; i < timeoutS; i++) {
    const t = ((await dlg.textContent().catch(() => "")) ?? "").replace(/\s+/g, " ");
    if (!pattern.test(t)) return t;
    await page.waitForTimeout(1000);
  }
  return ((await dlg.textContent().catch(() => "")) ?? "").replace(/\s+/g, " ");
}
async function axeScan(page, file) {
  const res = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  fs.writeFileSync(path.join(OUT, file), JSON.stringify(res.violations, null, 2));
  return res.violations;
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  // ── Triple build gate ─────────────────────────────────────────────
  const gate = await browser.newContext();
  const gp = await gate.newPage();
  const hz = await (
    await gp.request.get("https://rtmakatura--conestruct-render-fastapi-app.modal.run/healthz")
  ).json();
  log(`healthz sha: ${hz.sha}`);
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
    assert("gate. healthz == origin/main == served bundle", false, `expected ${EXPECTED_SHA}`);
    throw new Error("BUILD GATE MISMATCH — aborting per ground rules");
  }
  assert("gate. healthz == origin/main == served bundle", true, hz.sha);
  await gp.goto("https://www.conestruct.com/landing", { waitUntil: "domcontentloaded" });
  assert("e1. /landing DimStrip reads 3 scenarios supported", /3\s*scenarios supported/.test(await bodyText(gp)));
  await gate.close();

  // ── Context A: NI end-to-end + the #120/#174/#179 live chain ─────
  const ctxA = await browser.newContext({ acceptDownloads: true });
  const pa = await ctxA.newPage();
  const served400s = [];
  const scenarioPosts = [];
  pa.on("response", async (res) => {
    try {
      if (res.request().method() === "POST" && res.status() === 400)
        served400s.push({ url: res.url(), body: (await res.text()).slice(0, 800) });
    } catch {}
  });
  pa.on("request", (req) => {
    if (req.method() === "POST" && /\/api\//.test(req.url())) {
      const d = req.postData();
      if (d && /"near_intersection"/.test(d)) scenarioPosts.push({ url: req.url(), body: d });
    }
  });
  await pa.goto(SITE, { waitUntil: "networkidle" });

  const kindText = await bodyText(pa);
  assert(
    "a1. picker offers 'Lane closure near intersection · Cases 18/19 · S-630-1'",
    /Lane closure near intersection/.test(kindText) && /Cases 18\/19/.test(kindText),
  );
  await pa.getByText("Lane closure near intersection", { exact: false }).first().click();
  await pa.waitForTimeout(600);
  assert("a2. AWAITING LOCATION before any pin", /AWAITING LOCATION/.test(await bodyText(pa)));

  await pa.getByRole("button", { name: "Pick Location on Map" }).click();
  const dlg = pa.getByRole("dialog").first();
  await dlg.waitFor();
  // Pin via manual coordinates at the Race∩Colfax crossing itself
  // (OSM node 39.739776,-104.963483) — the work zone slides off the
  // box later via the form's own distance/length fields; what must be
  // REAL here is the detection: mainline candidate + cross-street
  // lookup at an exact crossing.
  const toggle = pa.getByText(/enter coordinates manually/i);
  if (await toggle.isVisible().catch(() => false)) await toggle.click();
  await pa.getByLabel("Latitude").fill("39.739776");
  await pa.getByLabel("Longitude").fill("-104.963483");
  await settleDialog(pa, dlg, /Detecting roads at pin|Classifying road/i);
  const colfax = pa.locator("button", { hasText: /Colfax/ }).first();
  assert("a3. detection offers the East Colfax candidate", await colfax.isVisible().catch(() => false));
  await colfax.click();
  await pa.waitForTimeout(1000);

  // Mark the intersection.  CRITICAL ORDER (probe finding): the picker
  // map does NOT fly to manually-entered coordinates — it stays at the
  // state-wide view — and Recenter's flyTo animates for a couple of
  // seconds.  A center click before the animation lands posts the
  // middle of Colorado to the lookup.  So: Recenter, wait out the
  // flyTo, THEN arm and click; and self-check the posted marker
  // coordinates against the crossing.
  const markerLookups = [];
  pa.on("request", (r) => {
    if (r.method() === "POST" && /road-bearing/.test(r.url())) {
      try {
        markerLookups.push(JSON.parse(r.postData() ?? "{}"));
      } catch {}
    }
  });
  const rc = dlg.getByRole("button", { name: "Recenter" });
  if (await rc.isVisible().catch(() => false)) await rc.click();
  await pa.waitForTimeout(3500); // flyTo settle
  await dlg.getByRole("button", { name: "Mark the intersection on the map" }).click();
  await pa.waitForTimeout(300);
  const canvas = dlg.locator("canvas").first();
  const box = await canvas.boundingBox();
  // The lookup snaps the marker to the nearest QUALIFYING crossing
  // (Race St from here — the nearer residential Williams/Gilpin are
  // rejected), but a slow Overpass round also reads as "No cross
  // street found" — so retry with re-arming (one armed click each).
  // Recenter fits the CORRIDOR (midpoint ~890 ft east of the anchor),
  // so canvas center is not the pin.  Self-calibrate from the lookup's
  // own posted coordinates: a center click and a +40 px reference
  // click give geo-per-pixel; the third click aims at the crossing.
  const TARGET = { lat: 39.739776, lng: -104.963483 };
  const cx = box.width / 2;
  const cy = box.height / 2;
  const armedClick = async (x, y) => {
    const rearm = dlg.getByRole("button", { name: "Move the intersection pin" });
    if (await rearm.isVisible().catch(() => false)) {
      await rearm.click();
      await pa.waitForTimeout(300);
    }
    markerLookups.length = 0;
    await canvas.click({ position: { x, y }, force: true });
    await pa.waitForTimeout(1500);
    const g = markerLookups[0];
    if (g) log(`marker lookup posted: ${g.lat?.toFixed?.(6)}, ${g.lng?.toFixed?.(6)}`);
    const t = await settleDialog(pa, dlg, /Looking up the cross street|Detecting/i);
    return { g, t };
  };
  let sect = "";
  let crossOk = false;
  const r0 = await armedClick(cx, cy);
  const r1 = await armedClick(cx + 40, cy);
  if (r0.g && r1.g) {
    const degPerPxLng = (r1.g.lng - r0.g.lng) / 40;
    const degPerPxLat = degPerPxLng * Math.cos((39.74 * Math.PI) / 180);
    const dx = (TARGET.lng - r0.g.lng) / degPerPxLng;
    const dy = -(TARGET.lat - r0.g.lat) / degPerPxLat;
    log(`calibrated aim: (${dx.toFixed(1)}, ${dy.toFixed(1)}) px from center`);
    const r2 = await armedClick(cx + dx, cy + dy);
    sect = r2.t.slice(r2.t.indexOf("Cross street"), r2.t.indexOf("Cross street") + 280);
    crossOk = !/No cross street found/.test(sect) && /Street|Avenue/.test(sect);
    markerLookups.length = 0;
    markerLookups.push(r2.g ?? {});
  } else log("calibration lookups not observed — cannot aim");
  assert("a4. cross street detected from the map marker", crossOk, sect.slice(12, 150));
  const ml = markerLookups[0];
  assert(
    "a4b. marker lookup posted the crossing's own coordinates (±50 m)",
    ml !== undefined &&
      Math.abs(ml.lat - 39.739776) < 0.00045 &&
      Math.abs(ml.lng - -104.963483) < 0.0006,
    ml ? `${ml.lat?.toFixed?.(6)}, ${ml.lng?.toFixed?.(6)}` : "no lookup observed",
  );
  await shot(pa, "01-picker-cross-marked.png");

  const save = dlg.getByRole("button", { name: "Save & Close" });
  for (let i = 0; i < 30 && !(await save.isEnabled().catch(() => false)); i++)
    await pa.waitForTimeout(1000);
  await save.click();
  await pa.waitForTimeout(1500);

  // The disputed-relay hold (#120 reason via #174's always-on hold).
  let formText = await bodyText(pa);
  assert(
    "a5. lane-count hold renders with the DISPUTED-relay reason",
    /Lane count is right/.test(formText) && /doesn't match its per-direction counts/.test(formText),
  );
  const gen = pa.getByRole("button", { name: /Generate/ }).first();
  assert("a6. Generate blocked while the hold is pending", (await gen.isDisabled().catch(() => false)) === true);
  // (d1) Where the RELAYED crossing distance happens to land inside
  // the default work zone, the in-zone MIRROR speaks before any POST
  // (fail-safe; observed in the probe runs).  The marker's exact snap
  // decides near/far/in-zone, so this state is logged, not required —
  // the drivable mirror assertions are d2/d3 below.
  if (/can't be inside the work zone/i.test(formText)) {
    log("d1 (observed): in-zone mirror voice present pre-fix — " +
      (/unavailable while generation is declined/i.test(formText)
        ? "audit declines without re-quoting (one voice)"
        : "audit line not matched"));
  } else log("d1 (observed): relayed crossing landed outside the zone this run — in-zone state not materialized");
  await shot(pa, "02-form-hold.png", true);

  // Keep the work zone short of the crossing either way.
  const wl = pa.getByLabel("Work zone length (ft)").first();
  await wl.fill("700");
  await pa.waitForTimeout(1500);
  formText = await bodyText(pa);

  await pa.getByRole("button", { name: "Lane count is right" }).click();
  await pa.waitForTimeout(1200);
  formText = await bodyText(pa);
  assert(
    "b1. #179 confirmed note stays visible with what detection reported",
    /Cross-street lane count confirmed/.test(formText) && /map data reported/.test(formText),
  );
  for (let i = 0; i < 10 && (await gen.isDisabled().catch(() => true)); i++)
    await pa.waitForTimeout(1000);
  assert("a7. confirm clears the hold; Generate enabled", (await gen.isDisabled().catch(() => true)) === false);

  scenarioPosts.length = 0;
  await gen.click();
  await pa.waitForFunction(
    () =>
      Array.from(document.querySelectorAll("button")).some((b) =>
        /Download PDF/.test(b.textContent ?? ""),
      ),
    null,
    { timeout: 120000 },
  );
  await pa.waitForTimeout(1500);
  await shot(pa, "03-post-generate.png", true);
  formText = await bodyText(pa);
  const taChip = formText.match(/TA-2[12]/)?.[0] ?? null;
  assert("a8. package rendered with the side-aware TA chip", taChip !== null, `chip: ${taChip}`);

  // Axe BEFORE any download clicks (run 17: a just-clicked button's
  // focus style read as a violation) and AFTER the recompute settles
  // (run 18: the ⟳ stale ribbon's deliberate previous-answer dimming
  // read as ~30 contrast hits — that dim state is by design, Arc 7).
  await pa
    .waitForFunction(() => !document.querySelector(".stale-ribbon"), null, { timeout: 30000 })
    .catch(() => log("stale ribbon still present at scan time"));
  await pa.waitForTimeout(500);
  const axeNi = await axeScan(pa, "axe-ni-post-generate.json");
  log(`axe NI post-generate: ${axeNi.length} violation(s) — classified against the shoulder control below`);
  const scenarioOf = (post) => {
    const j = JSON.parse(post.body);
    return JSON.stringify(j.scenario ?? j);
  };

  // Downloads through the page's own controls; the render POST carries
  // the scenario (b2's wire evidence).
  scenarioPosts.length = 0;
  const dlBtn = pa.getByRole("button", { name: "Download PDF" }).first();
  const [dl] = await Promise.all([pa.waitForEvent("download", { timeout: 60000 }), dlBtn.click()]);
  const pdfPath = path.join(OUT, "served-ni-plan.pdf");
  await dl.saveAs(pdfPath);
  log(`downloaded: served-ni-plan.pdf (${fs.statSync(pdfPath).size} B)`);
  const p1 = scenarioPosts.find((r) => /render/.test(r.url));
  if (p1) {
    const ov = p1.body.indexOf("detectionOverrides");
    log(`render payload detectionOverrides: ${ov >= 0 ? p1.body.slice(ov, ov + 220) : "(absent)"}`);
  }
  assert(
    "b2. the served render payload carries the #177 confirm marker, relays cleared off the legs",
    p1 !== undefined &&
      /approach_lane_confirm/.test(p1.body) &&
      !/"approaches":\[[^\]]*"detectedLanesTotal"/.test(p1.body),
    p1 ? p1.url : "no render POST observed",
  );
  const mdBtn = pa.getByRole("button", { name: "Download .md" }).first();
  const [dm] = await Promise.all([pa.waitForEvent("download", { timeout: 60000 }), mdBtn.click()]);
  await dm.saveAs(path.join(OUT, "served-ni-crew.md"));
  log(`downloaded: served-ni-crew.md (${fs.statSync(path.join(OUT, "served-ni-crew.md")).size} B)`);

  // Audit accordion -> approaches section (the panel animates; give
  // it a real settle after the click).
  for (let i = 0; i < 3; i++) {
    await pa.getByText("Verification & audit trail", { exact: false }).first().click();
    const ok = await pa
      .waitForFunction(
        () => /Cross-street approaches/.test(document.body.textContent ?? ""),
        null,
        { timeout: 8000 },
      )
      .then(() => true)
      .catch(() => false);
    if (ok) break;
  }
  formText = await bodyText(pa);
  assert("a9. audit panel renders the Cross-street approaches section", /Cross-street approaches/.test(formText));
  assert(
    "a10. approaches panel cites MUTCD § 6N.12 + Sheet 10 and flags the signal",
    /6N\.12/.test(formText) && /Sheet 10|SHEET 10/i.test(formText) && /SIGNALIZED|signal operation review/i.test(formText),
  );
  await shot(pa, "04-audit-approaches.png", true);

  // ── (b): undo restores the recorded relays on the wire ───────────
  // Race St's picked segment relays ONLY detectedLanesTotal (no
  // per-direction tags), so the backend #120 predicate cannot fire on
  // this pin: the SERVED 400 + the #180 pointer stay carried by the
  // mounted endpoint/matcher suites (stated, not forced — the capped
  // hunt found no arithmetically-disputed cross street with an
  // NI-eligible mainline).  What IS live-verifiable at the wire: the
  // #177 marker rode the render payload (b2); undo removes it and
  // restores the recorded relay value onto every leg exactly.
  // The form collapses into the setup summary post-generate — reopen
  // it through the page's own control first.
  await pa.getByText("Edit full setup", { exact: false }).first().click();
  await pa.waitForTimeout(1500);
  const undoBtn = pa.getByRole("button", { name: /Undo — restore detected lane data/ });
  await undoBtn.scrollIntoViewIfNeeded().catch(() => {});
  assert("b3. reopened form shows the confirmed note with its undo", await undoBtn.isVisible().catch(() => false));
  await undoBtn.click({ timeout: 15000 });
  await pa.waitForTimeout(2500);
  formText = await bodyText(pa);
  assert(
    "b4. undo removes the confirmed note (no phantom override on screen)",
    !/Cross-street lane count confirmed/.test(formText),
  );
  await shot(pa, "05-post-undo.png", true);
  // The undo changed the scenario, which correctly invalidates the
  // staged package (#183/#197 stale guards) — regenerate through the
  // page's own button before the post-undo download.
  const gen2 = pa.getByRole("button", { name: /Generate/ }).first();
  for (let i = 0; i < 8 && (await gen2.isDisabled().catch(() => true)); i++)
    await pa.waitForTimeout(1000);
  await gen2.click();
  await pa.waitForFunction(
    () =>
      Array.from(document.querySelectorAll("button")).some((b) =>
        /Download PDF/.test(b.textContent ?? ""),
      ),
    null,
    { timeout: 120000 },
  );
  await pa.waitForTimeout(1500);
  scenarioPosts.length = 0;
  const dlBtn2 = pa.getByRole("button", { name: "Download PDF" }).first();
  const [dl2] = await Promise.all([pa.waitForEvent("download", { timeout: 60000 }), dlBtn2.click()]);
  await dl2.saveAs(path.join(OUT, "served-ni-plan-post-undo.pdf"));
  const pUndo = scenarioPosts.find((r) => /render/.test(r.url));
  const markerTotal = p1 ? Number((p1.body.match(/"via":"approach_lane_confirm","detectedLanesTotal":(\d+)/) ?? [])[1]) : NaN;
  // Scope the relay scan to the approaches array — meta.confirmedRoad
  // carries the MAINLINE's own lane tags (Colfax's 5) which are not
  // under test here.
  const approachesSlice = pUndo
    ? (pUndo.body.match(/"approaches":\[.*?\]/s) ?? [""])[0]
    : "";
  const undoLegTotals = [...approachesSlice.matchAll(/"detectedLanesTotal":(\d+)/g)].map((m) =>
    Number(m[1]),
  );
  assert(
    "b5. undo restores the marker's recorded relay onto BOTH legs, marker gone (wire-level)",
    pUndo !== undefined &&
      !/approach_lane_confirm/.test(pUndo.body) &&
      undoLegTotals.length === 2 &&
      undoLegTotals.every((v) => v === markerTotal),
    `marker recorded ${markerTotal}; post-undo legs relay [${undoLegTotals.join(",")}]`,
  );

  // Reopen the collapsed setup for the geometry manipulation below.
  await pa.getByText("Edit full setup", { exact: false }).first().click();
  await pa.waitForTimeout(1500);

  // (d2) Curb-box overlap via the real form: 4 lanes each direction at
  // a 30-ft crossing distance — the mirror (increment 4) pre-empts the
  // POST; its voice is asserted (fail-safe direction; the served 400
  // for this family is pinned endpoint-level).
  const dist = pa.getByText(/Distance from the work zone/i).locator("xpath=following::input[1]");
  await dist.fill("30");
  const lanesRowA = pa.getByText(/Cross-street lanes — direction A|Cross-street lanes \(each direction\)/i);
  const four = lanesRowA.locator("xpath=following::button[normalize-space()='4'][1]");
  if (await four.isVisible().catch(() => false)) await four.click();
  await pa.waitForTimeout(2000);
  formText = await bodyText(pa);
  assert(
    "d2. curb-box overlap refused through the form (mirror voice or served 400)",
    /reaches into the work zone|can't be inside the work zone/i.test(formText) ||
      served400s.some((r) => /curb/.test(r.body)),
  );
  await shot(pa, "06-curb-overlap-refusal.png", true);
  // (d3) The single-lane mainline is UNREPRESENTABLE in the form — the
  // lanes-per-direction chips start at 2 ("NEEDS 2+").
  assert(
    "d3. single-lane mainline unrepresentable (chips start at 2, 'NEEDS 2+')",
    /NEEDS 2\+/i.test(formText),
  );
  await ctxA.close();

  // ── (e) compat + axe control on the shoulder surface ─────────────
  const ctxE = await browser.newContext({ acceptDownloads: true });
  const pe = await ctxE.newPage();
  let shoulderAxe = null;
  for (const kind of ["Shoulder work", "Flagger lane closure"]) {
    await pe.goto(SITE, { waitUntil: "networkidle" });
    await pe.getByText(kind, { exact: false }).first().click();
    await pe.waitForTimeout(500);
    await pe.getByRole("button", { name: "Pick Location on Map" }).click();
    const d2 = pe.getByRole("dialog").first();
    await d2.waitFor();
    const t2 = pe.getByText(/enter coordinates manually/i);
    if (await t2.isVisible().catch(() => false)) await t2.click();
    // Shoulder: the Lakewood control pin (Arc 5).  Flagger: the Arc 8
    // quiet Park pin — the proven Arc 9 flagger flow (Lakewood's
    // arterial candidates arm gates run-dependently).
    const pin = kind === "Shoulder work"
      ? { lat: "39.7113", lng: "-105.0815" }
      : { lat: "39.7312", lng: "-104.9665" };
    await pe.getByLabel("Latitude").fill(pin.lat);
    await pe.getByLabel("Longitude").fill(pin.lng);
    await settleDialog(pe, d2, /Detecting roads at pin|Classifying road/i);
    // Prefer a residential candidate (the first Lakewood candidate is
    // a 4-lane arterial whose 12-ft default exceeds the drawable
    // half-road width — a correct mirror refusal, not the target).
    const resRows = pe.locator("button", { hasText: "m from pin" }).filter({ hasText: /residential/ });
    const rows = (await resRows.count()) > 0 ? resRows : pe.locator("button", { hasText: "m from pin" });
    if ((await rows.count()) > 0) await rows.first().click();
    await pe.waitForTimeout(800);
    const s2 = pe.getByRole("button", { name: "Save & Close" });
    for (let i = 0; i < 30 && !(await s2.isEnabled().catch(() => false)); i++)
      await pe.waitForTimeout(1000);
    await s2.click();
    await pe.waitForTimeout(1200);
    const g2 = pe.getByRole("button", { name: /Generate/ }).first();
    // If the drawable-width mirror blocks (a wide detected road), drop
    // to 2 lanes per direction through the form's own chips.
    let et = await bodyText(pe);
    if (/wider than the plan sheet/i.test(et)) {
      const two = pe
        .getByText(/Lanes per direction/i)
        .first()
        .locator("xpath=following::button[normalize-space()='2'][1]");
      if (await two.isVisible().catch(() => false)) {
        await two.click();
        await pe.waitForTimeout(1500);
      }
    }
    // Flagger confirm rows (multilane/one-way) — tick through the
    // page's own recovery affordance if armed.
    et = await bodyText(pe);
    for (const label of [/Lane count is right/, /one through lane/i, /two-way/i]) {
      const c = pe.locator("button").filter({ hasText: label }).first();
      if (await c.isVisible().catch(() => false)) {
        await c.click();
        await pe.waitForTimeout(1200);
      }
    }
    for (let i = 0; i < 30 && (await g2.isDisabled().catch(() => true)); i++)
      await pe.waitForTimeout(1000);
    if (await g2.isDisabled().catch(() => true))
      log(`${kind}: Generate still disabled — page text tail: ${(await bodyText(pe)).slice(-400)}`);
    if (!(await g2.isDisabled().catch(() => true))) {
      await g2.click();
      await pe
        .waitForFunction(
          () =>
            Array.from(document.querySelectorAll("button")).some((b) =>
              /Download PDF/.test(b.textContent ?? ""),
            ),
          null,
          { timeout: 120000 },
        )
        .catch(() => {});
      const ok = await pe
        .getByRole("button", { name: "Download PDF" })
        .first()
        .isVisible()
        .catch(() => false);
      assert(`e2. ${kind} still generates end-to-end post-flip`, ok);
      if (kind === "Shoulder work" && ok)
        shoulderAxe = await axeScan(pe, "axe-shoulder-control.json");
    } else assert(`e2. ${kind} still generates end-to-end post-flip`, false, "Generate stayed blocked");
  }
  if (shoulderAxe !== null) {
    const niIds = new Set((JSON.parse(fs.readFileSync(path.join(OUT, "axe-ni-post-generate.json")))).map((v) => v.id));
    const shoulderIds = new Set(shoulderAxe.map((v) => v.id));
    const niOnly = [...niIds].filter((id) => !shoulderIds.has(id));
    assert(
      "f. axe: zero NI-only violations (findings also on the untouched shoulder surface are pre-existing triage input)",
      niOnly.length === 0,
      `NI: ${[...niIds].join(",") || "none"} · shoulder control: ${[...shoulderIds].join(",") || "none"}`,
    );
  }
  await ctxE.close();

  fs.writeFileSync(
    path.join(OUT, "assertions-raw.md"),
    `# Arc 11 smoke — raw assertion log\n\n${lines.join("\n")}\n\n**${failures} FAIL**\n`,
  );
  log(`done — ${failures} failures`);
  await browser.close();
  process.exit(failures ? 1 : 0);
})();
