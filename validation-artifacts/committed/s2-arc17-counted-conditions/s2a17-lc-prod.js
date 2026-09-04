// s2-arc17 live check — #224 phase 3, site conditions as counted tier facts.
//
// Two modes, picked from BASE (the s2a16 idiom):
//   prod   BASE=https://www.conestruct.com     → the deployed site; the
//          prologue quotes /healthz verbatim and GATES on healthz sha ==
//          origin/main.
//   local  BASE=http://localhost:3000           → `next dev` on the working
//          tree with MODAL_RENDER_URL pointed at a local uvicorn of the
//          same tree (HEALTHZ env, default http://127.0.0.1:8765/healthz).
// Every wire leg goes THROUGH the Next proxy routes (/api/render/*, body
// {scenario}); the browser legs drive the real /sandbox with Playwright.
// The served classifier line is computed by the repo's Python mirror
// (src/rendering/tier_ledger.py via the .venv) over the SERVED audit —
// the same function that prints the audit-PDF cover — so "screen ledger
// == PDF cover == classifier" is measured, not asserted.
//
// Legs:
//   A  scanned audit at the Lakewood control → ok (every keyed bucket on
//      the wire; each detected bucket's nearest_distance_ft equals its
//      metre value / 0.3048 to 0.1 ft — the rule-12 trace) or the coded
//      refusal, recorded verbatim, retried up to RETRIES times.
//   B  scanned audit PDF → the Site Conditions table names the five
//      rule-bearing conditions; its cover "Plan status" line equals the
//      classifier line over the audit the PDF's own scan produced (judged
//      by comparing the PDF's DETECTED set to leg A's; a different set
//      means a different container's scan — recorded INFO, never faked).
//   C  proceed-anyway plan sheet + crew narrative (workLen 1001, a fresh
//      memo key): if their scan failed → the sheet text and the markdown
//      carry the NOT-CHECKED sentence; if it succeeded → neither does
//      (rule 10's negative), INFO that the positive is proven at test level.
//   D  the retired proxy route answers 404.
//   E  browser: pre-generate the Setup step reads "Site conditions you
//      assert" with exactly two checkboxes and none of the five scanned
//      labels; Generate at Lakewood sends site_scan; the browser's OWN
//      served audit is captured; the on-screen ledger equals the Python
//      classifier line over that audit; section 03 shows, per that audit,
//      every absent condition as a ✓ "none along the corridor" row and
//      every detected one with "<count> found · nearest <ft> ft"; the
//      keyless buckets sit under "Site scan — measured, no rule applies".
//   F  browser, the refusal (if it lands naturally): Retry, proceed → the
//      NOT-CHECKED item is present AND counted: the ledger equals the
//      classifier line over the proceeded audit (attention includes it).
//   G  axe (wcag2a/aa/21aa/22aa) post-generate (+ proceeded if reached) ≤
//      the s2-arc11 prod baseline 2.
//   H  sizes.
//
// Usage: node s2a17-lc-prod.js [outDir]   (BASE, HEALTHZ, RETRIES env)

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { chromium } = require("playwright");

const BASE = (process.env.BASE || "https://www.conestruct.com").replace(/\/$/, "");
const PROD = /conestruct\.com/.test(BASE);
const HEALTHZ_PROD = "https://rtmakatura--conestruct-render-fastapi-app.modal.run/healthz";
const HEALTHZ = PROD ? HEALTHZ_PROD : process.env.HEALTHZ || "http://127.0.0.1:8765/healthz";
const OUT = process.argv[2] || (PROD ? "outS2A17Prod" : "outS2A17Local");
const RETRIES = Number(process.env.RETRIES || 3);
const REPO = execSync("git rev-parse --show-toplevel").toString().trim();
const PY = path.join(REPO, ".venv", "Scripts", "python.exe");
const AXE_SRC = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf-8");

const LAT = "39.711300", LNG = "-105.081500", BEARING = "180", WORKLEN = "1000";
const DISCLOSURE = "SITE CONDITIONS NOT CHECKED — service unavailable at generation.";
const CODE = "site_scan_unavailable";
const AXE_BASELINE = 2;
// Mirror of site_scan.DETECTION_TO_FLAG (bucket → panel label from
// SITE_ADJUSTMENT_DETAIL / the absent-row label) — read-only here.
const KEYED = [
  ["intersections", "Intersection within work zone", "Adjacent at-grade intersection"],
  ["interchanges", "Adjacent interchange (highway ramps)", "Adjacent interchange (highway ramps)"],
  ["sidewalks", "Pedestrian sidewalks present", "Pedestrian sidewalks present"],
  ["bike_facilities", "Bike lane / cycleway present", "Bike lane / cycleway present"],
  ["schools", "School zone nearby", "School zone nearby"],
];
const KEYLESS = ["railroad_crossings", "hospitals", "road_curvature"];

const lines = [];
let pass = 0, fail = 0, info = 0;
const log = (s) => { lines.push(s); console.log(s); };
const ok = (cond, name, detail) => {
  if (cond) { pass++; log(`**PASS** — ${name}${detail ? " — " + detail : ""}`); }
  else { fail++; log(`**FAIL** — ${name}${detail ? " — " + detail : ""}`); }
  return cond;
};
const note = (name, detail) => { info++; log(`INFO — ${name}${detail ? " — " + detail : ""}`); };
const save = (name, data) => fs.writeFileSync(path.join(OUT, name), data);

function scenario(over = {}) {
  return {
    kind: "shoulder",
    meta: { project: "s2a17 live check", address: "", lat: Number(LAT), lng: Number(LNG), bearingDeg: Number(BEARING) },
    roadType: "urban_arterial", speed: 45, lanes: 2, laneWidth: 12, divided: true,
    workType: "utility_locate", duration: "short", workLen: Number(WORKLEN), night: false,
    ...over,
  };
}
async function post(endpoint, body) {
  const t0 = Date.now();
  const r = await fetch(`${BASE}/api/render/${endpoint}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scenario: body }),
  });
  const buf = Buffer.from(await r.arrayBuffer());
  const text = buf.toString("utf8");
  let json = null;
  try { json = JSON.parse(text); } catch { /* binary or non-JSON */ }
  return { status: r.status, text, json, buf, bytes: buf.length, ms: Date.now() - t0 };
}
function pdfText(file) {
  const code = "import pypdfium2 as p,sys;d=p.PdfDocument(sys.argv[1]);print(' '.join(pg.get_textpage().get_text_bounded() for pg in d))";
  return execSync(`"${PY}" -c "${code}" "${file}"`, { env: { ...process.env, PYTHONUTF8: "1" } }).toString("utf8");
}
// The served classifier line — the Python mirror over a served audit
// (jurisdiction null: the live check confirms no jurisdiction).
function ledgerLineOf(auditJsonPath) {
  const code = "import json,sys;from src.rendering.tier_ledger import tier_ledger,ledger_line;a=json.load(open(sys.argv[1],encoding='utf-8'));print(ledger_line(tier_ledger(a,None)))";
  return execSync(`"${PY}" -c "${code}" "${auditJsonPath}"`, { cwd: REPO, env: { ...process.env, PYTHONUTF8: "1" } }).toString("utf8").trim();
}
const detectedSet = (scan) => Object.entries(scan?.buckets ?? {}).filter(([, b]) => b?.detected === true).map(([k]) => k).sort().join(",");
async function runAxe(page, outName) {
  await page.evaluate(AXE_SRC);
  const res = await page.evaluate(() =>
    window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } }),
  );
  const compact = res.violations.map((v) => ({ id: v.id, impact: v.impact, targets: v.nodes.map((n) => n.target.join(" ")) }));
  save(outName, JSON.stringify(compact, null, 2));
  return compact;
}
async function gotoSandbox(page) {
  for (let i = 0; i < 3; i++) {
    try {
      await page.goto(BASE + "/sandbox", { waitUntil: "networkidle", timeout: 60000 });
      await page.waitForTimeout(600);
      return;
    } catch (e) {
      if (i === 2) throw e;
      log("goto retry " + (i + 1) + ": " + String(e).slice(0, 80));
    }
  }
}
async function pinManually(page) {
  await page.getByRole("button", { name: "Enter manually", exact: true }).click();
  const fill = async (labelText, value) => {
    const input = page.locator(`label:text-is("${labelText}")`).locator("xpath=following-sibling::input[1]");
    await input.fill(value);
  };
  await fill("Latitude", LAT);
  await page.getByRole("button", { name: "Edit manually", exact: true }).click();
  await fill("Longitude", LNG);
  await fill("Bearing (° from N)", BEARING);
  await fill("Work zone (ft)", WORKLEN);
  await page.waitForTimeout(400);
}
const strip = (page) => page.evaluate(() => document.querySelector(".status-bar")?.textContent ?? "");
const bodyText = (page) => page.evaluate(() => document.body.textContent ?? "");
const hasRefusal = (page) => page.evaluate(() => !!document.querySelector(".sys-event.scan-refusal"));
const ledgerText = (page) => page.evaluate(() => document.querySelector('[data-testid="tier-ledger"]')?.textContent ?? "");
async function waitSettled(page, maxMs) {
  const t0 = Date.now();
  let settled = null;
  while (Date.now() - t0 < maxMs) {
    const s = await strip(page);
    if (/READY FOR TCS REVIEW|PLAN DECLINED|VERIFICATION UNAVAILABLE|NEEDS ATTENTION|VERIFIED/.test(s) && !/VERIFYING|COMPUTING/.test(s)) {
      settled = s; break;
    }
    await page.waitForTimeout(150);
  }
  return { settled, ms: Date.now() - t0 };
}
async function waitInFlightThenSettled(page, maxMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < 5000) {
    const s = await strip(page);
    if (/VERIFYING|COMPUTING/.test(s)) break;
    await page.waitForTimeout(50);
  }
  return waitSettled(page, maxMs);
}
async function generateAndWait(page) {
  await page.getByRole("button", { name: /Generate plan/ }).click();
  return waitSettled(page, 90000);
}
// Open every tier chip so section 03's rows are readable, then return
// the tiers region's text.
async function openTiersAndRead(page) {
  const tiers = page.locator('[aria-label="Plan reference tiers"]');
  for (const label of ["Changed this plan", "Needs attention", "Checked & passed", "Reference"]) {
    const sum = tiers.locator(".chip-sum", { hasText: label }).first();
    if ((await sum.count()) > 0 && (await sum.getAttribute("aria-expanded")) !== "true") {
      await sum.click();
      await page.waitForTimeout(150);
    }
  }
  return tiers.evaluate((el) => el.textContent ?? "");
}
// Section-03 expectations for a served ok scan, read from the wire.
function judgeRows(text, scan, tag) {
  const buckets = scan.buckets ?? {};
  const misses = [];
  for (const [bucket, detectedLabel, absentLabel] of KEYED) {
    const b = buckets[bucket];
    if (!b) { misses.push(`${bucket}: not on the wire`); continue; }
    if (b.detected === true) {
      const ev = `${b.count} found · nearest ${b.nearest_distance_ft} ft from anchor`;
      if (!text.includes(detectedLabel) || !text.includes(ev)) misses.push(`${bucket}: expected "${detectedLabel}" + "${ev}"`);
    } else if (!text.includes(absentLabel) || !text.includes("none along the corridor")) {
      misses.push(`${bucket}: expected "${absentLabel}" + "none along the corridor"`);
    }
  }
  const keylessOnWire = KEYLESS.filter((k) => buckets[k]);
  if (keylessOnWire.length > 0 && !text.includes("Site scan — measured, no rule applies")) misses.push("reference group missing");
  return ok(misses.length === 0, `${tag} section 03 names every scanned condition per the served audit (detected: ${detectedSet(scan) || "none"})`, misses.join("; ") || "all rows present");
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  log(`# s2a17 live check — ${PROD ? "PRODUCTION" : "LOCAL"}`);
  log(`UTC: ${new Date().toISOString()}`);
  log(`BASE: ${BASE}`);
  const h = await fetch(HEALTHZ);
  const hz = await h.text();
  log(`healthz (HTTP ${h.status}): ${hz}`);
  if (PROD) {
    const sha = (() => { try { return JSON.parse(hz).sha; } catch { return null; } })();
    const om = execSync("git rev-parse origin/main").toString().trim();
    log(`git rev-parse origin/main: ${om}`);
    if (!ok(sha === om, "GATE — healthz sha == origin/main", `${sha} vs ${om}`)) {
      log("GATE FAILED — aborting; nothing below was run.");
      save("s2a17-lc.md", lines.join("\n") + "\n");
      process.exit(2);
    }
  } else {
    const head = execSync("git rev-parse HEAD").toString().trim();
    log(`git rev-parse HEAD: ${head} — local mode: the served build is this working tree (next dev + uvicorn at ${HEALTHZ}), not a deploy.`);
  }
  log("");

  // ---- A ----
  let a = null, aScan = null;
  for (let i = 0; i <= RETRIES; i++) {
    a = await post("audit", scenario({ site_scan: {} }));
    aScan = a.status === 200 ? a.json?.sections?.site_scan : a.json?.detail?.site_scan;
    if (a.status === 200 && aScan?.status === "ok") break;
    const refused = a.status === 400 && a.json?.detail?.error === CODE;
    log(`A attempt ${i + 1}: HTTP ${a.status}, ${a.ms} ms, ${refused ? "refused (" + aScan?.error + ")" : "unexpected"}`);
    if (!refused) break;
  }
  save("A-scanned-audit.json", a.text);
  const aOk = a.status === 200 && aScan?.status === "ok";
  const aRefused = a.status === 400 && a.json?.detail?.error === CODE;
  ok(aOk || aRefused, "A1 scanned audit answers honestly: ok, or the coded refusal", `HTTP ${a.status}, ${a.ms} ms, status=${aScan?.status}`);
  if (aOk) {
    const buckets = aScan.buckets ?? {};
    const missing = KEYED.map(([k]) => k).filter((k) => !buckets[k]);
    ok(missing.length === 0, "A2 every rule-bearing bucket is on the wire", missing.join(", ") || KEYED.map(([k]) => k).join(", "));
    const bad = [];
    for (const [k, b] of Object.entries(buckets)) {
      if (b?.detected !== true) continue;
      if (typeof b.nearest_distance_m !== "number") { if (b.nearest_distance_ft != null) bad.push(`${k}: ft without m`); continue; }
      const want = Math.round((b.nearest_distance_m / 0.3048) * 10) / 10;
      if (b.nearest_distance_ft !== want) bad.push(`${k}: ${b.nearest_distance_ft} vs ${want}`);
    }
    ok(bad.length === 0, "A3 each detected bucket's nearest_distance_ft equals its metre value / 0.3048 to 0.1 ft", bad.join("; ") || Object.entries(buckets).filter(([, b]) => b?.detected).map(([k, b]) => `${k}: ${b.nearest_distance_m} m → ${b.nearest_distance_ft} ft`).join(", "));
    log(`A detected: ${detectedSet(aScan) || "none"}; flags ${JSON.stringify(aScan.flags)}`);
  } else if (aRefused) {
    note(`A2/A3 the scan was refused on every attempt (${RETRIES + 1}); the bucket legs need an ok scan — proven at test level (test_site_scan_ingenerate, tiering fixtures)`);
  }

  // ---- B ----
  const bpdf = await post("audit-pdf", scenario({ site_scan: {} }));
  ok(bpdf.status === 200 && bpdf.bytes > 1000, "B1 scanned audit PDF renders", `HTTP ${bpdf.status}, ${bpdf.bytes} B, ${bpdf.ms} ms`);
  if (bpdf.status === 200) {
    save("B-scanned-audit.pdf", bpdf.buf);
    let text = "";
    try { text = pdfText(path.join(OUT, "B-scanned-audit.pdf")); } catch (e) { log("pdf text extraction failed: " + String(e).slice(0, 120)); }
    const labels = ["Adjacent at-grade", "Adjacent interchange", "Pedestrian sidewalks", "Bike lane", "School zone"];
    const missing = labels.filter((l) => !text.includes(l));
    ok(missing.length === 0 && /Site Conditions/.test(text), "B2 the audit PDF's Site Conditions table names the five rule-bearing conditions", missing.join(", ") || "all five");
    const cover = (text.match(/Plan status\s+([^\r\n]*?reference)/) || [])[1] ?? "";
    if (aOk) {
      const wantLine = ledgerLineOf(path.join(OUT, "A-scanned-audit.json"));
      // Compare the PDF's own DETECTED set to A's: same set ⇒ same
      // classifier input ⇒ the cover must equal the served line.
      // The PDF's own row labels (audit_blocks._SCAN_CONDITION_ROWS), each
      // distinct so no label's regex can match another's row.
      const PDF_LABELS = ["Adjacent at-grade", "Adjacent interchange", "Pedestrian sidewalks", "Bike lane", "School zone"];
      const pdfDetected = PDF_LABELS.filter((l) => new RegExp(l + "[^\\n]{0,80}DETECTED").test(text)).length;
      const aDetected = detectedSet(aScan).split(",").filter(Boolean).length;
      // The corridor check is the other per-request fact that moves the
      // ledger (checked-and-clean ⇒ audit:corridor:clean ✓; #241's
      // budget ⇒ check_unavailable ⇒ no fact).  The prod run-1 lesson:
      // same detected set but a different corridor outcome is a
      // different classifier input, not a parity defect.
      const aCv = a.json?.sections?.corridor_validation ?? {};
      const aClean = aCv.checked === true && (aCv.warnings ?? []).length === 0;
      const pdfClean = /corridor check ran with no warnings/.test(text);
      if (pdfDetected === aDetected && pdfClean === aClean) ok(cover === wantLine, "B3 the audit-PDF cover line equals the classifier line over the served audit (screen == PDF == classifier)", `cover "${cover}" vs served "${wantLine}"`);
      else note("B3 the PDF's own request differs from leg A's in a per-request fact (detected set or corridor-check outcome — another container / the #241 budget), so the two are different classifier inputs; cover/classifier parity on ONE audit is pinned at test level (test_tier_ledger PDF-cover test) and measured live in E6", `pdf detected ${pdfDetected} vs A ${aDetected}; pdf corridor clean ${pdfClean} vs A ${aClean}; cover "${cover}"`);
    }
  }

  // ---- C ----
  const cpdf = await post("pdf", scenario({ workLen: 1001, site_scan: { proceed_if_unavailable: true } }));
  const cmd = await post("markdown", scenario({ workLen: 1001, site_scan: { proceed_if_unavailable: true } }));
  ok(cpdf.status === 200 && cmd.status === 200, "C1 proceed-anyway plan sheet + narrative render (200)", `sheet HTTP ${cpdf.status} ${cpdf.ms} ms · md HTTP ${cmd.status} ${cmd.ms} ms`);
  if (cpdf.status === 200 && cmd.status === 200) {
    save("C-proceed-sheet.pdf", cpdf.buf);
    save("C-proceed-narrative.md", cmd.text);
    let sheet = "";
    try { sheet = pdfText(path.join(OUT, "C-proceed-sheet.pdf")); } catch (e) { log("pdf text extraction failed: " + String(e).slice(0, 120)); }
    const sheetHas = /SITE CONDITIONS NOT CHECKED/.test(sheet);
    const mdHas = cmd.text.includes("## Site Conditions") && cmd.text.includes(DISCLOSURE);
    if (sheetHas || mdHas) {
      ok(sheetHas && mdHas, "C2 the proceeded plan's sheet AND narrative carry the NOT-CHECKED sentence (their scan failed)", `sheet ${sheetHas}, md ${mdHas}`);
    } else {
      note("C2 both scans succeeded, so neither surface prints the disclosure — the positive is proven at test level (test_site_scan_disclosure_surfaces through the real routes)");
      ok(!/NOT CHECKED/.test(sheet) && !cmd.text.includes("NOT CHECKED"), "C3 an ok scan prints no NOT-CHECKED anywhere (rule 10's negative)");
    }
  }

  // ---- D ----
  const dr = await fetch(`${BASE}/api/render/detect-site`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lat: 39.7, lng: -105 }) });
  ok(dr.status === 404 || dr.status === 405, "D1 the retired /api/render/detect-site proxy route is gone", `HTTP ${dr.status}`);

  // ---- E / F / G — browser ----
  const browser = await chromium.launch();
  const axeCounts = {};
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const requests = [];
    const audits = [];
    page.on("request", (req) => {
      const u = req.url();
      if (/\/api\/render\/(audit|device-breakdown)$/.test(u) && req.method() === "POST") {
        let scen = null;
        try { scen = JSON.parse(req.postData() || "{}").scenario; } catch { /* ignore */ }
        requests.push({ url: u.replace(BASE, ""), site_scan: scen?.site_scan ?? null, t: Date.now() });
      }
    });
    page.on("response", async (res) => {
      if (/\/api\/render\/audit$/.test(res.url()) && res.request().method() === "POST") {
        try { audits.push({ status: res.status(), json: await res.json(), t: Date.now() }); } catch { /* not json */ }
      }
    });
    await gotoSandbox(page);
    const pre = await bodyText(page);
    ok(/Site conditions you assert/.test(pre), "E1 pre-generate: the Setup step is the slim control — \"Site conditions you assert\"");
    const setupBoxes = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll(".setup-panel [role=checkbox]"));
      return nodes.map((n) => n.textContent?.trim().slice(0, 40) ?? "");
    });
    const scannedLabels = ["Pedestrian sidewalks present", "Bike lane / cycleway present", "School zone nearby", "Adjacent at-grade intersection", "Adjacent interchange (highway ramps)"];
    ok(setupBoxes.filter((t) => /Limited sight distance|Driveways present/.test(t)).length === 2 && !scannedLabels.some((l) => pre.includes(l)),
      "E2 pre-generate: exactly the two manual-only checkboxes; none of the five scanned labels is offered", `checkboxes: ${setupBoxes.join(" | ")}`);
    await pinManually(page);
    const pinned = await waitSettled(page, 60000);
    ok(pinned.settled !== null, "E3 pinned at Lakewood: the strip settles pre-generate", `${pinned.ms} ms — ${pinned.settled?.slice(0, 60)}`);
    await page.screenshot({ path: path.join(OUT, "E-pre-generate.png"), fullPage: true });

    const mark = requests.length;
    const gen = await generateAndWait(page);
    const postGen = requests.slice(mark);
    ok(postGen.length >= 2 && postGen.every((r) => r.site_scan && r.site_scan.proceed_if_unavailable === false),
      "E4 the Generate click sends site_scan on audit + breakdown", postGen.map((r) => `${r.url}:${JSON.stringify(r.site_scan)}`).join(" "));
    ok(gen.settled !== null, "E5 the strip settles after Generate", `${gen.ms} ms — ${gen.settled?.slice(0, 70)}`);
    await page.screenshot({ path: path.join(OUT, "E-post-generate.png"), fullPage: true });

    let refusedSeen = await hasRefusal(page);
    if (!refusedSeen) {
      const served = audits.filter((x) => x.status === 200 && x.json?.sections?.site_scan?.status === "ok").pop();
      if (served) {
        save("E-browser-served-audit.json", JSON.stringify(served.json));
        const wantLine = ledgerLineOf(path.join(OUT, "E-browser-served-audit.json"));
        const shown = await ledgerText(page);
        ok(shown.includes(wantLine), "E6 the on-screen ledger equals the classifier line over the browser's own served audit", `screen "${shown.trim()}" vs classifier "${wantLine}"`);
        const text = await openTiersAndRead(page);
        judgeRows(text, served.json.sections.site_scan, "E7");
        await page.screenshot({ path: path.join(OUT, "E-section03-open.png"), fullPage: true });
      } else {
        ok(false, "E6 no ok scanned audit was captured from the browser's own fetches", `${audits.length} audit responses seen`);
      }
      axeCounts.post = await runAxe(page, "axe-post-generate.json");
    }

    // ---- F ----
    let cycles = 0;
    while (!refusedSeen && cycles < RETRIES) {
      cycles++;
      await page.getByRole("button", { name: /Edit full setup/ }).click();
      await page.waitForTimeout(500);
      await waitSettled(page, 60000);
      const g = await generateAndWait(page);
      log(`F cycle ${cycles}: settled in ${g.ms} ms — ${g.settled?.slice(0, 60)}`);
      refusedSeen = await hasRefusal(page);
    }
    if (refusedSeen) {
      await page.screenshot({ path: path.join(OUT, "F-refused.png"), fullPage: true });
      ok(/PLAN DECLINED/.test(await strip(page)), "F1 refused: PLAN DECLINED on the strip (phase 2, unchanged)");
      await page.getByRole("button", { name: /Retry scan/ }).click();
      const r1 = await waitInFlightThenSettled(page, 90000);
      log(`F retry: settled in ${r1.ms} ms — ${r1.settled?.slice(0, 60)}`);
      if (await hasRefusal(page)) {
        await page.getByRole("button", { name: /Generate without site check/ }).click();
        const p1 = await waitInFlightThenSettled(page, 90000);
        ok(p1.settled !== null && !(await hasRefusal(page)), "F2 the proceeded plan renders", `${p1.ms} ms`);
        const served = audits.filter((x) => x.status === 200 && x.json?.sections?.site_scan?.proceeded_anyway === true).pop();
        if (served) {
          save("F-browser-proceeded-audit.json", JSON.stringify(served.json));
          const wantLine = ledgerLineOf(path.join(OUT, "F-browser-proceeded-audit.json"));
          const shown = await ledgerText(page);
          ok(shown.includes(wantLine) && /needs attention/.test(wantLine) && !/ 0 needs attention/.test(wantLine),
            "F3 NOT-CHECKED is counted: the on-screen ledger equals the classifier line over the proceeded audit, attention ≥ 1", `screen "${shown.trim()}" vs classifier "${wantLine}"`);
          const text = await openTiersAndRead(page);
          ok(/▲ NOT CHECKED/.test(text) && !/none along the corridor/.test(text) && !/ft from anchor/.test(text),
            "F4 section 03 shows the one ▲ NOT CHECKED item and no scan rows (the five keys collapse into it)");
          await page.screenshot({ path: path.join(OUT, "F-proceeded.png"), fullPage: true });
          axeCounts.proceeded = await runAxe(page, "axe-proceeded.json");
        } else ok(false, "F3 no proceeded audit captured from the browser");
      } else {
        // The retry succeeded: judge the ok flow now.
        const served = audits.filter((x) => x.status === 200 && x.json?.sections?.site_scan?.status === "ok").pop();
        if (served) {
          save("E-browser-served-audit.json", JSON.stringify(served.json));
          const wantLine = ledgerLineOf(path.join(OUT, "E-browser-served-audit.json"));
          ok((await ledgerText(page)).includes(wantLine), "E6 (after retry) the on-screen ledger equals the classifier line over the served audit", wantLine);
          judgeRows(await openTiersAndRead(page), served.json.sections.site_scan, "E7 (after retry)");
        }
        note("F2–F4 the retry succeeded — the counted NOT-CHECKED item is proven at test level (TieredReference.scan-rows on the scanned-not-checked recording)");
        axeCounts.post = await runAxe(page, "axe-post-generate.json");
      }
    } else if (cycles > 0) {
      note(`F refusal not observed in ${1 + cycles} Generate cycle(s) — the counted NOT-CHECKED item is proven at test level (TieredReference.scan-rows, test_tier_ledger on scanned-not-checked); never faked here`);
    } else {
      note("F refusal not observed on the first Generate; no further cycles requested (RETRIES=0)");
    }
    await page.close();
  } finally {
    await browser.close();
  }

  // ---- G ----
  for (const [state, v] of Object.entries(axeCounts)) {
    ok(v.length <= AXE_BASELINE, `G axe ${state}: ${v.length} violation(s) ≤ baseline ${AXE_BASELINE}`, v.map((x) => x.id).join(", ") || "none");
  }

  // ---- H ----
  log(`SIZE — scanned audit ${a.bytes} B (HTTP ${a.status}); scanned audit PDF ${bpdf.bytes} B`);
  log("");
  log(`RESULT: ${fail === 0 ? "ALL PASS" : "FAILURES"} ${pass}/${pass + fail} (+${info} INFO)`);
  save("s2a17-lc.md", lines.join("\n") + "\n");
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => {
  log("SCRIPT ERROR: " + String(e && e.stack ? e.stack : e));
  save("s2a17-lc.md", lines.join("\n") + "\n");
  process.exit(3);
});
