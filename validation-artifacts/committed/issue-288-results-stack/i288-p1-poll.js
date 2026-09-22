// #288 Phase 1 — is the whole seven-item push in the served bundle?
// Measurement, not assumption: the sha gate proves the BACKEND only.
const https = require("https");
const BASE = "https://www.conestruct.com";
const get = (u) => new Promise((res, rej) => {
  https.get(u, (r) => {
    if (r.statusCode !== 200) { r.resume(); return rej(new Error(`${r.statusCode} ${u}`)); }
    let b = ""; r.setEncoding("utf-8"); r.on("data", d => b += d); r.on("end", () => res(b));
  }).on("error", rej);
});
(async () => {
  const hz = JSON.parse(await get("https://rtmakatura--conestruct-render-fastapi-app.modal.run/healthz"));
  console.log("healthz sha:", hz.sha);
  const html = await get(`${BASE}/sandbox`);
  const chunks = [...new Set([...html.matchAll(/src="(\/_next\/static\/chunks\/[^"]+)"/g)].map(m => m[1]))];
  const sheets = [...new Set([...html.matchAll(/href="(\/_next\/static\/css\/[^"]+)"/g)].map(m => m[1]))];
  let js = "", css = "";
  for (const c of chunks) { try { js += await get(BASE + c); } catch {} }
  for (const s of sheets) { try { css += await get(BASE + s); } catch {} }
  const blob = html + js + css;
  console.log(`served: ${html.length} B html · ${chunks.length} chunks (${js.length} B) · ${sheets.length} sheets (${css.length} B)`);
  const want = {
    // clause 1 — the corrections block moved into NEEDS YOU
    "ny-cond (clause 1 rows)": [/ny-cond/, true],
    "ny-apply (rule 78 Apply row)": [/ny-apply/, true],
    "site-condition-manual (§8.25 keys)": [/site-condition-manual/, true],
    "staging costs nothing (rule 78 sentence)": [/staging costs nothing/, true],
    "sc-grid (retired ledger — ABSENT)": [/sc-grid/, false],
    "sc-leader (retired — ABSENT)": [/sc-leader/, false],
    // clause 2 — counts hero
    "--fs-hero-numeral (rule 81 token)": [/--fs-hero-numeral/, true],
    "62px (rule 81 numeral)": [/62px/, true],
    // Quoted: bare /tick tl/ also matches the workbench FRAME's
    // "ftick tl" corner ticks, which are a different element and stay.
    "hero .tick (retired — ABSENT)": [/"tick tl"/, false],
    // clause 3 — the primary and the file count
    ".pri (rule 130)": [/\.pri\b|"pri"/, true],
    "--fs-primary (rule 130 token)": [/--fs-primary/, true],
    "dl-all-count (the file count, once)": [/dl-all-count/, true],
    // clause 4 — the disclosure rows
    "results-disc (the row stack)": [/results-disc/, true],
    "Checked & passed (promoted row)": [/Checked &amp; passed|Checked & passed/, true],
    "Pending \/ not verified (promoted row)": [/Pending \/ not verified/, true],
    "quote-total (§8.11 row)": [/quote-total/, true],
    "price-head (retired — ABSENT)": [/price-head/, false],
    // clause 5 — headings and intro dropped
    "results-stack (named target)": [/results-stack/, true],
    // The zone HEADINGS cannot be checked from a static bundle: "MHT
    // package" also appears in the working band's render label and the
    // sr-only announcement, which legitimately remain.  Clause 5's claim
    // is about the RENDERED page, so the leg asserts it on the DOM.
    "zone-title (the heading class — still used by Setup)": [/zone-title/, true],
    "CDOT-compliant MHT package (intro — ABSENT)": [/Generate a CDOT-compliant/, false],
    "zone-note (retired — ABSENT)": [/zone-note/, false],
    // clause 6 — the ribbon
    "stale-ribbon (present)": [/stale-ribbon/, true],
    // clause 7 — hit targets
    "min-h-\[32px\] (rule 15 floors)": [/min-h-\[32px\]/, true],
    // rule 28's reserve, from the earlier ships
    "--fact-h (rule 28 reserve)": [/--fact-h/, true],
    "ns-strip (retired — ABSENT)": [/ns-strip/, false],
  };
  let fail = 0;
  for (const [k, [re, expected]] of Object.entries(want)) {
    const got = re.test(blob);
    const ok = got === expected;
    if (!ok) fail += 1;
    console.log(`  ${ok ? "OK  " : "FAIL"}  ${got ? "PRESENT" : "absent "}  ${k}`);
  }
  console.log(fail === 0 ? "\nBUNDLE: the Phase 1 push is served." : `\nBUNDLE: ${fail} marker(s) wrong — NOT the expected build.`);
  process.exit(fail === 0 ? 0 : 4);
})().catch(e => { console.log("POLL FAILED", e.message); process.exit(3); });
