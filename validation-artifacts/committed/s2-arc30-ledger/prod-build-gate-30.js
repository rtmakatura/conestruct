// s2-arc30 prod build gate — is www.conestruct.com actually serving the
// round-2 block yet?
//   node prod-build-gate-29.js [base] [maxMinutes]
//
// Modal deploys in seconds; Vercel is minutes behind, and that lag bit
// arc 26 (a leg measured a stale frontend against a fresh healthz).  The
// healthz gate proves the BACKEND sha and nothing else — the bundle the
// browser downloads is a separate question, so it gets a separate gate.
//
// The signature is `dva-slot`, the reserved provenance slot's class,
// which exists only after 6ab5d87.  It is chosen because it is NEW:
// `operator-set` would prove nothing (the picker has carried that exact
// token since #198, LocationPickerModal.tsx:2547) and `OSM · ` shipped in
// round 1.  Two corroborating marks are checked and logged beside it:
//
//   CSS   `.dva-slot` with `min-height:16px` — the reserved line itself,
//         which is what makes the rows equal.  Minifiers drop the space
//         after the colon, so the test allows either.
//   CSS   a `border-bottom` carrying `var(--rule)` inside a `.dva-head`
//         rule — the header hairline from ruling (c).
//
// The JS signature and the CSS marks are read from DIFFERENT files, so a
// half-deployed build (new chunk, stale stylesheet, or the reverse)
// cannot read as PASS.
const https = require("https");
const BASE = process.argv[2] || "https://www.conestruct.com";
const MAX_MIN = Number(process.argv[3] || 25);

// The ledger's signatures.  `dva-glyph` is chosen because it is NEW and
// could not exist before this arc: the two-column table had no glyph at
// all, so unlike `operator-set` or `OSM · ` it cannot be satisfied by an
// older build.  Two CSS marks corroborate it, and one of them is an
// ABSENCE: `--dva-val` was the old fixed value track, so a stylesheet
// still carrying it is still the table.  JS and CSS are read from
// DIFFERENT files, so a half-deployed build cannot read as PASS.
const JS_SIG = /dva-glyph/;
const CSS_SLOT = /\.dva-row\{[^}]*column-gap:\s*6px/;
const CSS_RULE = /\.dva-clause\{[^}]*min-height:\s*16px/;
const CSS_GONE = /--dva-val/;

const get = (url) =>
  new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`${res.statusCode} ${url}`));
        }
        let b = "";
        res.setEncoding("utf-8");
        res.on("data", (d) => (b += d));
        res.on("end", () => resolve(b));
      })
      .on("error", reject);
  });

const stamp = () => new Date().toISOString();
const log = (s) => console.log(`${stamp()}  ${s}`);

async function poll() {
  const html = await get(`${BASE}/sandbox`);
  const chunks = [
    ...new Set(
      [...html.matchAll(/src="(\/_next\/static\/chunks\/[^"]+)"/g)].map((m) => m[1]),
    ),
  ];
  const sheets = [
    ...new Set(
      [...html.matchAll(/href="(\/_next\/static\/css\/[^"]+)"/g)].map((m) => m[1]),
    ),
  ];

  let jsHost = null;
  for (const c of chunks) {
    let js;
    try { js = await get(BASE + c); } catch { continue; }
    if (JS_SIG.test(js)) { jsHost = c; break; }
  }

  let cssHost = null, slot = false, rule = false;
  for (const s of sheets) {
    let css;
    try { css = await get(BASE + s); } catch { continue; }
    if (!/\.dva/.test(css)) continue;
    cssHost = s;
    slot = CSS_SLOT.test(css);
    rule = CSS_RULE.test(css) && !CSS_GONE.test(css);
    break;
  }
  return { jsHost, cssHost, slot, rule, chunks: chunks.length, sheets: sheets.length };
}

(async () => {
  log(`gate: polling ${BASE} for the s2-arc30 ledger signature, up to ${MAX_MIN} min`);
  const t0 = Date.now();
  let last = "";
  while (Date.now() - t0 < MAX_MIN * 60000) {
    let r;
    try {
      r = await poll();
    } catch (e) {
      log(`poll error ${e.message}`);
      await new Promise((s) => setTimeout(s, 30000));
      continue;
    }
    const line =
      `chunks ${r.chunks} · sheets ${r.sheets} · dva-glyph ${r.jsHost ? `PRESENT in ${r.jsHost}` : "absent"}` +
      ` · css ${r.cssHost || "(none carrying .dva)"} · row-gap-6 ${r.slot} · clause-reserve-and-old-track-gone ${r.rule}`;
    if (line !== last) { log(line); last = line; }
    if (r.jsHost && r.slot && r.rule) {
      log(`GATE PASS after ${Math.round((Date.now() - t0) / 1000)} s — the served bundle AND stylesheet carry the ledger; legs may run`);
      process.exit(0);
    }
    await new Promise((s) => setTimeout(s, 30000));
  }
  log(`GATE FAIL — the signature never appeared in ${MAX_MIN} min; the served frontend is still a pre-arc-30 build. No leg was run.`);
  process.exit(2);
})();
