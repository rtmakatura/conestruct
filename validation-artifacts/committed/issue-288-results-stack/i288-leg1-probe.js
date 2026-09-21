// issue-288 leg 1 — what is actually live at e55b23a.
//   node probe.js <outDir> <expectSha> [base]
const ARC = "C:/Users/rtmak/Documents/traffic-control-tool/validation-artifacts/committed/issue-288-results-stack";
const L = require("C:/Users/rtmak/Documents/traffic-control-tool/validation-artifacts/committed/s2-audit-1/audit-lib.js");
const { attachErrorTaps, classify } = require(ARC + "/err-tap.js");
const { fs, path, chromium } = L;
const https = require("https");

const OUT = process.argv[2];
const EXPECT = process.argv[3];
const BASE = process.argv[4] || "https://www.conestruct.com";
fs.mkdirSync(OUT, { recursive: true });
const { log } = L.mkLog(OUT);
const rows = [];
const rec = (o) => { rows.push(o); fs.writeFileSync(path.join(OUT, "rows.json"), JSON.stringify(rows, null, 1)); };
const check = (id, ok, d) => { rec({ id, ok, detail: d }); log(`${ok === null ? "INFO" : ok ? "PASS" : "FAIL"} ${id} — ${d}`); };

const get = (url) => new Promise((res, rej) => {
  https.get(url, (r) => {
    if (r.statusCode !== 200) { r.resume(); return rej(new Error(`${r.statusCode} ${url}`)); }
    let b = ""; r.setEncoding("utf-8"); r.on("data", (d) => (b += d)); r.on("end", () => res(b));
  }).on("error", rej);
});

(async () => {
  // ── gate 1: backend sha ─────────────────────────────────────────
  await L.shaGate(log, EXPECT);
  check("gate.healthz", true, `healthz sha == ${EXPECT}`);

  // ── gate 2: the SERVED bundle ───────────────────────────────────
  const html = await get(`${BASE}/sandbox`);
  const chunkPaths = [...new Set([...html.matchAll(/src="(\/_next\/static\/chunks\/[^"]+)"/g)].map((m) => m[1]))];
  let js = "";
  for (const c of chunkPaths) { try { js += await get(BASE + c); } catch {} }
  const cssPaths = [...new Set([...html.matchAll(/href="(\/_next\/static\/css\/[^"]+)"/g)].map((m) => m[1]))];
  let css = "";
  for (const s of cssPaths) { try { css += await get(BASE + s); } catch {} }
  const blob = html + js + css;
  log(`served: ${html.length} B html · ${chunkPaths.length} chunks (${js.length} B) · ${cssPaths.length} sheets (${css.length} B)`);

  // what SHIPPED (the s8.32 removal) — absence plus two positive marks
  check("bundle.issued-gone", !/ISSUED/.test(html), `"ISSUED" in served /sandbox html: ${/ISSUED/.test(html)}`);
  check("bundle.strip-renders", /LOCATION/.test(html) && /AS NOTED/.test(html), `LOCATION ${/LOCATION/.test(html)} · AS NOTED ${/AS NOTED/.test(html)}`);
  check("bundle.no-iso-date", !/\b20\d{2}-\d{2}-\d{2}\b/.test(html), `any ISO date in html: ${/\b20\d{2}-\d{2}-\d{2}\b/.test(html)}`);

  // what the ruling asked me to poll for — measured, not assumed
  check("bundle.next-steps-strip-absent", !/ns-strip/.test(blob), `"ns-strip" in served bundle: ${/ns-strip/.test(blob)} (expected ABSENT if §8.29 had shipped)`);
  check("bundle.results-head-absent", !/results-head-slot/.test(blob), `"results-head-slot" in served bundle: ${/results-head-slot/.test(blob)}`);
  check("bundle.next-3-steps-absent", !/NEXT — 3 STEPS/.test(blob), `"NEXT — 3 STEPS" literal in served bundle: ${/NEXT — 3 STEPS/.test(blob)}`);
  for (const sel of ["needs-you", "stack-container", "verdict-strip", "counts-hero", "disclosure-row"]) {
    check(`bundle.stack-class.${sel}`, null, `"${sel}" in served bundle: ${new RegExp(sel).test(blob)}`);
  }

  // ── the browser legs ────────────────────────────────────────────
  const browser = await chromium.launch();
  for (const [vp, w, h] of [["1440", 1440, 1000], ["380", 380, 800]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    const early = attachErrorTaps(page, "early");          // BEFORE goto — the contract
    await page.goto(`${BASE}/sandbox`, { waitUntil: "networkidle", timeout: 60000 });
    const late = attachErrorTaps(page, "late");            // the control
    await page.waitForTimeout(3000);

    const e = early.report(), l = late.report();
    const ce = classify(e), cl = classify(l);
    check(`${vp}.pageerror-zero`, e.counts.pageerror === 0, `early tap: ${e.counts.pageerror} pageerror, ${e.counts.consoleError} console error(s)${e.counts.pageerror ? " | " + e.pageerrors.map((x) => x.message).join(" ¦ ") : ""}`);
    check(`${vp}.hydration-zero`, ce.hydration.length === 0, `hydration-shaped: ${ce.hydration.length}${ce.hydration.length ? " | " + ce.hydration.join(" ¦ ") : ""}`);
    check(`${vp}.tap-order-evidence`, null, `early ${ce.total} vs late ${cl.total} classified message(s) — both zero means the page is clean, early>late would demonstrate the ordering`);
    check(`${vp}.requests-ok`, e.counts.requestFailed === 0, `failed requests: ${e.counts.requestFailed}${e.counts.requestFailed ? " | " + e.requestFailures.map((x) => x.url).join(" ¦ ") : ""}`);

    const dom = await page.evaluate(() => ({
      nsStrip: !!document.querySelector(".ns-strip"),
      resultsHeadSlot: !!document.querySelector(".results-head-slot"),
      sheetMetaText: (document.body.textContent || "").includes("ISSUED"),
      isoOnPage: /\b20\d{2}-\d{2}-\d{2}\b/.test(document.body.textContent || ""),
      title: document.title,
    }));
    check(`${vp}.dom.issued-absent`, dom.sheetMetaText === false, `"ISSUED" text on the settled page: ${dom.sheetMetaText}`);
    check(`${vp}.dom.no-date-rendered`, dom.isoOnPage === false, `ISO date rendered anywhere on the settled page: ${dom.isoOnPage}`);
    check(`${vp}.dom.ns-strip`, null, `.ns-strip mounted: ${dom.nsStrip} · .results-head-slot mounted: ${dom.resultsHeadSlot} (pre-generate)`);

    fs.writeFileSync(path.join(OUT, `taps-${vp}.json`), JSON.stringify({ early: e, late: l, dom }, null, 1));
    await L.shot(page, OUT, `sandbox-${vp}`, true);
    await ctx.close();
  }
  await browser.close();

  // ── gate 3: sha, the other end ──────────────────────────────────
  await L.shaGate(log, EXPECT);
  check("gate.healthz-after", true, `healthz still ${EXPECT} at leg end`);
  const fails = rows.filter((r) => r.ok === false);
  log(`\nDONE — ${rows.length} rows, ${fails.length} FAIL`);
  process.exit(0);
})().catch((e) => { log("LEG CRASHED " + e.stack); process.exit(3); });
