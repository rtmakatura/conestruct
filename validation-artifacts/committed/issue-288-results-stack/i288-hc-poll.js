// #288 Phase 1 CLOSE — the seven-item push AND the four hand-check fixes,
// in the bundle Vercel actually serves.
//
// A copy of `i288-p1-poll.js` rather than an edit of it: leg 4 quotes that
// file's 25 markers by count, and a file that changes under a finished
// report makes the report unreadable.  Every Phase 1 marker below is
// byte-identical to that file's; the HAND-CHECK block at the end is new.
//
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
    // ---- the four hand-check fixes (2026-09-22) ----
    // fix 1 — the reserve renders nothing; the TOKEN stays for Phase 2.
    "results-head-slot (fix 1, retired — ABSENT)": [/results-head-slot/, false],
    // fix 2 — the jurisdiction context bar is gone, its facts ride the row.
    "jbar-readonly (fix 2, dropped bar — ABSENT)": [/jbar-readonly/, false],
    // PRESENT, and that is a finding rather than a failure.  Fix 2 deleted
    // the bar's COMPONENT and its own `.jbar-readonly` rule (absent above),
    // but left `.jbar-main` / `.jbar-cell` / `.jbar-slot-*` in the sheet
    // with no renderer.  The served blob includes globals.css whole, so a
    // dead rule is served exactly like a live one.  The expectation states
    // what the shipped build contains; that the rules are orphaned is
    // recorded in LEG6.md and is not something this poll can see.
    "jbar-slot-hint (fix 2 leftover — DEAD CSS, present)": [/jbar-slot-hint/, true],
    // The minifier re-encodes § as a § ESCAPE in the JS chunk, so a
    // literal-§ grep reports ABSENT on a build that serves the string.
    // The marker is encoding-agnostic instead: "CDOT Specs", one to five
    // non-space characters, "630" — true of the literal and of every
    // escape form, and still false if the link is missing or renamed.
    // The first draft of this marker was the arc's fourth measurement to
    // read the wrong bytes, and the only one that read a build.
    "CDOT Specs §630 (fix 2, the baseline chain)": [/CDOT Specs \S{1,5}630/, true],
    "MUTCD 11th \+ CO Suppl. (fix 2, the baseline chain)": [/MUTCD 11th \+ CO Suppl\./, true],
    // fix 3 — the Reference row joined the disclosure group.
    "Reference (fix 3, the promoted row name)": [/"Reference"|>Reference</, true],
    // fix 4 — the sub-header above the condition rows.
    "ny-subhead (fix 4, the sub-header class)": [/ny-subhead/, true],
    "Site conditions — scanned (fix 4, its text)": [/Site conditions — scanned/, true],
  };
  let fail = 0;
  for (const [k, [re, expected]] of Object.entries(want)) {
    const got = re.test(blob);
    const ok = got === expected;
    if (!ok) fail += 1;
    console.log(`  ${ok ? "OK  " : "FAIL"}  ${got ? "PRESENT" : "absent "}  ${k}`);
  }
  console.log(fail === 0 ? "\nBUNDLE: the Phase 1 push and the four hand-check fixes are served." : `\nBUNDLE: ${fail} marker(s) wrong — NOT the expected build.`);
  process.exit(fail === 0 ? 0 : 4);
})().catch(e => { console.log("POLL FAILED", e.message); process.exit(3); });
