// s2-arc16 live check — #224 phase 2, the honest Generate flow (+ #241 rider).
//
// Two modes, picked from BASE:
//   prod   BASE=https://www.conestruct.com     → the deployed site; the
//          s2-arc12 prologue quotes /healthz verbatim and GATES on
//          healthz sha == origin/main.
//   local  BASE=http://localhost:3000           → `next dev` on the working
//          tree with MODAL_RENDER_URL pointed at a local uvicorn of the
//          same tree (HEALTHZ env, default http://127.0.0.1:8765/healthz);
//          the prologue records `git rev-parse HEAD` and states that the
//          served build is the working tree, not a deploy.
// Every leg goes THROUGH the Next proxy routes (/api/render/*, body
// {scenario}) — the path the browser uses — and the browser legs drive
// the real /sandbox with Playwright (the s2a14 idiom).
//
// Legs (A–D wire, E–G browser, H sizes):
//   A  plain audit → sections.site_scan = not_run / not_requested (phase 1,
//      unchanged; Rule 10).
//   B  scanned audit at the Lakewood control → EITHER status ok with flags
//      OR the designed honest 400 (error site_scan_unavailable + provenance
//      + recovery).  Both are honest answers; a refusal is recorded
//      verbatim (the prod 28 % rate, s2-arc15) — never a silent pass.
//   C  proceed-anyway audit (site_scan.proceed_if_unavailable: true) → 200.
//      If the scan failed: proceeded_anyway true + the disclosure string
//      EXACT.  If it succeeded: the flag is inert (INFO — a live
//      proceed-anyway capture needs a live failure).
//   D  audit PDF with proceed → 200; text extracted with pypdfium2 (the
//      containment test's extractor, via the repo .venv).  If C proceeded:
//      the PDF carries "SITE CONDITIONS NOT CHECKED".  Else INFO.
//   E  browser: /sandbox pre-generate has NO detect button and the
//      provenance sentence; pinned at Lakewood the pre-generate requests
//      carry no site_scan; the Generate click sends site_scan on audit +
//      breakdown; during the wait the page names the scan (ribbon/strip
//      sampled); the strip settles (never a permanent VERIFYING).
//   F  browser, the refusal: if Generate settled REFUSED (.sys-event
//      .scan-refusal) → the container (message once, SERVICE UNAVAILABLE
//      pill, Retry, proceed) is captured; Retry once; if still refused →
//      proceed → the NOT-CHECKED disclosure on the panel (.site-not-checked)
//      and in section 03 (▲ NOT CHECKED) is captured.  A refusal cannot be
//      forced on prod read-only: up to RETRIES further Reopen→Generate
//      cycles wait for a natural one; if none lands this records INFO
//      "refusal not observed; test-level proof stands" (the s2a15 idiom),
//      never a fake.
//   G  axe (wcag2a/aa/21aa/22aa) on the post-generate state (+ the refused
//      state if observed) — baseline s2-arc11 prod: pinned 2 (label,
//      region).  Predicted unchanged; a rise is a FAIL.
//   H  response sizes: plain vs scanned audit bytes.
//
// Usage: node s2a16-lc-prod.js [outDir]   (BASE, HEALTHZ, RETRIES env)

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { chromium } = require("playwright");

const BASE = (process.env.BASE || "https://www.conestruct.com").replace(/\/$/, "");
const PROD = /conestruct\.com/.test(BASE);
const HEALTHZ_PROD = "https://rtmakatura--conestruct-render-fastapi-app.modal.run/healthz";
const HEALTHZ = PROD ? HEALTHZ_PROD : process.env.HEALTHZ || "http://127.0.0.1:8765/healthz";
const OUT = process.argv[2] || (PROD ? "outS2A16Prod" : "outS2A16Local");
const RETRIES = Number(process.env.RETRIES || 3);
const REPO = execSync("git rev-parse --show-toplevel").toString().trim();
const PY = path.join(REPO, ".venv", "Scripts", "python.exe");
const AXE_SRC = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf-8");

const LAT = "39.711300", LNG = "-105.081500", BEARING = "180", WORKLEN = "1000";
const DISCLOSURE = "SITE CONDITIONS NOT CHECKED — service unavailable at generation.";
const CODE = "site_scan_unavailable";
const AXE_BASELINE = 2;

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
    meta: { project: "s2a16 live check", address: "", lat: Number(LAT), lng: Number(LNG), bearingDeg: Number(BEARING) },
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
async function waitSettled(page, maxMs) {
  // Sample the wait copy while the strip is not settled; settled = a
  // verdict, PLAN DECLINED, or VERIFICATION UNAVAILABLE.
  const t0 = Date.now();
  const samples = new Set();
  let settled = null;
  while (Date.now() - t0 < maxMs) {
    const s = await strip(page);
    const b = await bodyText(page);
    if (/scanning site conditions/i.test(s)) samples.add("strip");
    if (/Recomputing — scanning site conditions/.test(b)) samples.add("ribbon");
    if (/Scanning site conditions along the corridor \(OpenStreetMap, up to 20 s\), then computing/.test(b)) samples.add("empty-state");
    if (/READY FOR TCS REVIEW|PLAN DECLINED|VERIFICATION UNAVAILABLE|NEEDS ATTENTION|VERIFIED/.test(s) && !/VERIFYING|COMPUTING/.test(s)) {
      settled = s; break;
    }
    await page.waitForTimeout(150);
  }
  return { settled, ms: Date.now() - t0, samples: Array.from(samples) };
}
// After Retry / proceed the previous verdict stays on screen until the
// refetch flips the strip: wait for the in-flight state first, then the
// settle — otherwise an 8 ms "settle" reads the old answer as new.
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

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  log(`# s2a16 live check — ${PROD ? "PRODUCTION" : "LOCAL"}`);
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
      save("s2a16-lc.md", lines.join("\n") + "\n");
      process.exit(2);
    }
  } else {
    const head = execSync("git rev-parse HEAD").toString().trim();
    log(`git rev-parse HEAD: ${head} — local mode: the served build is this working tree (next dev + uvicorn at ${HEALTHZ}), not a deploy.`);
  }
  log("");

  // ---- A ----
  const a = await post("audit", scenario());
  save("A-plain-audit.json", a.text);
  const aScan = a.json?.sections?.site_scan;
  ok(a.status === 200 && aScan?.status === "not_run" && aScan?.reason === "not_requested",
    "A1 plain audit carries sections.site_scan = not_run / not_requested", `HTTP ${a.status}, ${a.ms} ms`);

  // ---- B ----
  const b = await post("audit", scenario({ site_scan: {} }));
  save("B-scanned-audit.json", b.text);
  const bScan = b.status === 200 ? b.json?.sections?.site_scan : b.json?.detail?.site_scan;
  const bRefused = b.status === 400 && b.json?.detail?.error === CODE;
  ok((b.status === 200 && bScan?.status === "ok") || bRefused,
    "B1 scanned audit answers honestly: ok, or the coded refusal",
    `HTTP ${b.status}, ${b.ms} ms, status=${bScan?.status}, error=${bScan?.error ?? "—"}`);
  if (bRefused) {
    note("B2 wire refusal observed (the designed 400)", `${b.text.slice(0, 220)}…`);
    ok(b.json.detail.recovery?.proceed_field === "site_scan.proceed_if_unavailable" && typeof b.json.detail.message === "string",
      "B3 refusal carries message + recovery pointer");
  } else {
    ok(Object.keys(bScan?.flags ?? {}).length > 0, "B2 the Lakewood control detects flags", JSON.stringify(bScan?.flags));
  }

  // ---- C ----
  const c = await post("audit", scenario({ workLen: 1001, site_scan: { proceed_if_unavailable: true } }));
  save("C-proceed-audit.json", c.text);
  const cScan = c.json?.sections?.site_scan;
  ok(c.status === 200 && cScan && (cScan.status === "ok" || cScan.status === "unavailable"),
    "C1 proceed-anyway audit always completes (200)", `HTTP ${c.status}, ${c.ms} ms, status=${cScan?.status}`);
  const cProceeded = cScan?.status === "unavailable" && cScan?.proceeded_anyway === true;
  if (cProceeded) {
    ok(cScan.disclosure === DISCLOSURE, "C2 proceeded: the disclosure string is exact on the wire", cScan.disclosure);
  } else {
    note("C2 the scan succeeded, so proceed_if_unavailable was inert (proceeded_anyway false, disclosure null) — a live proceed-anyway capture needs a live failure",
      `proceeded_anyway=${cScan?.proceeded_anyway} disclosure=${cScan?.disclosure}`);
  }

  // ---- D ----
  const d = await post("audit-pdf", scenario({ workLen: 1001, site_scan: { proceed_if_unavailable: true } }));
  ok(d.status === 200 && d.bytes > 1000, "D1 proceed-anyway audit PDF renders", `HTTP ${d.status}, ${d.bytes} B, ${d.ms} ms`);
  if (d.status === 200) {
    const pdfPath = path.join(OUT, "D-proceed-audit.pdf");
    save("D-proceed-audit.pdf", d.buf);
    let text = "";
    try { text = pdfText(pdfPath); } catch (e) { log("pdf text extraction failed: " + String(e).slice(0, 120)); }
    // Judge the PDF by ITS OWN scan outcome, not leg C's: a refused scan
    // is never memoised, so the PDF's request may land on another
    // container whose scan succeeds (prod runs up to 8).  The PDF shows
    // which happened — the disclosure block, or the scanned Site
    // Adjustments rows (sidewalk / bike detour at the Lakewood control).
    const disclosed = /SITE CONDITIONS NOT CHECKED/.test(text) && /service unavailable at generation/.test(text);
    const scannedRows = /Site Adjustments/.test(text) && /(SIDEWALK|BIKE DETOUR)/.test(text);
    if (disclosed) ok(true, "D2 the audit PDF carries the NOT-CHECKED disclosure (its scan was refused; proceeded)");
    else if (scannedRows) note("D2 the PDF's own scan succeeded (scanned Site Adjustments rows present; a refused scan is never memoised, so leg C's refusal did not carry over) — no disclosure expected; the block is pinned at test level (tests/test_audit_blocks_site_scan.py) and captured live in outS2A16Local", `${text.length} chars extracted`);
    else ok(false, "D2 the audit PDF shows neither the disclosure nor the scanned rows", `${text.length} chars extracted`);
  }

  // ---- E / F / G — browser ----
  const browser = await chromium.launch();
  let axeCounts = {};
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const requests = [];
    page.on("request", (req) => {
      const u = req.url();
      if (/\/api\/render\/(audit|device-breakdown)$/.test(u) && req.method() === "POST") {
        let scen = null;
        try { scen = JSON.parse(req.postData() || "{}").scenario; } catch { /* ignore */ }
        requests.push({ url: u.replace(BASE, ""), site_scan: scen?.site_scan ?? null, t: Date.now() });
      }
    });
    await gotoSandbox(page);
    const pre = await bodyText(page);
    ok(!/Detect nearby site conditions/.test(pre) && !/Scanning OpenStreetMap/.test(pre),
      "E1 pre-generate: the manual detect button is gone");
    ok(/Site conditions are scanned along the corridor when you generate \(OpenStreetMap\)\./.test(pre),
      "E2 pre-generate: the provenance sentence is the section's only scan copy");
    await pinManually(page);
    const pinned = await waitSettled(page, 60000);
    ok(pinned.settled !== null, "E3 pinned at Lakewood: the strip settles pre-generate", `${pinned.ms} ms — ${pinned.settled?.slice(0, 60)}`);
    const preGen = requests.slice();
    ok(preGen.length > 0 && preGen.every((r) => r.site_scan === null),
      "E4 every pre-generate request is scan-free", `${preGen.length} requests`);
    await page.screenshot({ path: path.join(OUT, "E-pre-generate.png"), fullPage: true });

    const mark = requests.length;
    const gen = await generateAndWait(page);
    const postGen = requests.slice(mark);
    ok(postGen.length >= 2 && postGen.every((r) => r.site_scan && r.site_scan.proceed_if_unavailable === false),
      "E5 the Generate click sends site_scan {proceed_if_unavailable:false} on audit + breakdown",
      postGen.map((r) => `${r.url}:${JSON.stringify(r.site_scan)}`).join(" "));
    ok(gen.settled !== null, "E6 the strip settles after Generate — never a permanent VERIFYING", `${gen.ms} ms — ${gen.settled?.slice(0, 70)}`);
    if (gen.samples.length > 0) ok(true, "E7 the wait names the scan", `seen on: ${gen.samples.join(", ")}`);
    else if (gen.ms < 1500) note("E7 the scan settled in under 1.5 s (memo hit) — the wait copy had no frame to be sampled", `${gen.ms} ms`);
    else ok(false, "E7 the wait names the scan", `no scan copy sampled in ${gen.ms} ms`);
    await page.screenshot({ path: path.join(OUT, "E-post-generate.png"), fullPage: true });
    axeCounts.post = await runAxe(page, "axe-post-generate.json");

    // ---- F ----
    let refusedSeen = await hasRefusal(page);
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
      const s = await strip(page);
      const b = await bodyText(page);
      const msgOnce = await page.evaluate(() => {
        const el = document.querySelector(".sys-event.scan-refusal");
        const msg = el?.querySelector(".flex.items-start > span:last-child")?.textContent ?? "";
        return { msg, count: msg ? (document.body.textContent ?? "").split(msg).length - 1 : 0 };
      });
      ok(/PLAN DECLINED/.test(s) && /SERVICE UNAVAILABLE/.test(s), "F1 refused: the strip says PLAN DECLINED · SERVICE UNAVAILABLE", s.slice(0, 120));
      ok(msgOnce.count === 1 && /Site scan unavailable/.test(msgOnce.msg), "F2 the backend message renders exactly once, in the container", msgOnce.msg.slice(0, 80));
      ok(!/Device breakdown failed/.test(b), "F3 the generic breakdown-failed ribbon does not also render");
      const retryBtn = page.getByRole("button", { name: /Retry scan/ });
      const proceedBtn = page.getByRole("button", { name: /Generate without site check/ });
      ok((await retryBtn.count()) === 1 && (await proceedBtn.count()) === 1, "F4 Retry and the consequence-stating proceed-anyway are both offered");
      axeCounts.refused = await runAxe(page, "axe-refused.json");
      await retryBtn.click();
      const r1 = await waitInFlightThenSettled(page, 90000);
      log(`F retry: settled in ${r1.ms} ms — ${r1.settled?.slice(0, 60)}`);
      if (await hasRefusal(page)) {
        await proceedBtn.click();
        const p1 = await waitInFlightThenSettled(page, 90000);
        const reqs = requests.slice(-2);
        ok(reqs.every((r) => r.site_scan?.proceed_if_unavailable === true), "F5 proceed sends the acknowledgement on both fetches", JSON.stringify(reqs.map((r) => r.site_scan)));
        ok(p1.settled !== null && !(await hasRefusal(page)), "F6 the proceeded plan renders; the container clears", `${p1.ms} ms — ${p1.settled?.slice(0, 60)}`);
        const panel = await page.evaluate(() => document.querySelector(".sys-event.site-not-checked")?.textContent ?? "");
        ok(panel.includes(DISCLOSURE), "F7 the Setup panel prints the disclosure verbatim", panel.slice(0, 120));
        // The attention tier auto-expands for the item (rule 10); open
        // the item row inside section 03 to read its body.
        const tiers = page.locator('[aria-label="Plan reference tiers"]');
        const item = tiers.getByText("Site conditions", { exact: true }).first();
        if ((await item.count()) > 0) await item.click();
        await page.waitForTimeout(300);
        const b2 = await bodyText(page);
        ok(/▲ NOT CHECKED/.test(b2) && b2.split(DISCLOSURE).length - 1 >= 2, "F8 section 03 shows ▲ NOT CHECKED with the disclosure", `disclosure occurrences: ${b2.split(DISCLOSURE).length - 1}`);
        await page.screenshot({ path: path.join(OUT, "F-proceeded.png"), fullPage: true });
        axeCounts.proceeded = await runAxe(page, "axe-proceeded.json");
      } else {
        note("F5–F8 the retry succeeded, so the proceed-anyway flow had no live refusal to act on — proven at test level (GeneratorShell.scan-refusal / scan-disclosure)");
      }
    } else {
      note(`F refusal not observed in ${1 + cycles} Generate cycle(s) on this run — the refusal container, proceed-anyway and the three disclosures are proven at test level (GeneratorShell.scan-refusal, scan-disclosure, SetupStrip.disclosure, TieredReference.site-scan, test_audit_blocks_site_scan); never faked here`);
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
  log(`SIZE — plain audit ${a.bytes} B; scanned audit ${b.bytes} B (HTTP ${b.status}); growth ${b.bytes - a.bytes} B`);
  log("");
  log(`RESULT: ${fail === 0 ? "ALL PASS" : "FAILURES"} ${pass}/${pass + fail} (+${info} INFO)`);
  save("s2a16-lc.md", lines.join("\n") + "\n");
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => {
  log("SCRIPT ERROR: " + String(e && e.stack ? e.stack : e));
  save("s2a16-lc.md", lines.join("\n") + "\n");
  process.exit(3);
});
