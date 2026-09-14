// s2-arc30 prod build gate, second leg — is www.conestruct.com serving
// the 12 px applied value yet?
//   node prod-build-gate-30b.js [base] [maxMinutes]
//
// Same shape as prod-build-gate-30.js, which stays as the record of the
// ledger's own gate.  This one exists because the ledger's signature
// (`dva-glyph`, `.dva-row{column-gap:6px}`) is ALREADY on prod at
// 2a67d2f and would read PASS against the build this leg must not
// measure.  So the signature is what the ruling changed:
//
//   JS    the class string `dva-val tr-field` — the value carrying the
//         label's role.  NEW: no build before this one has it.
//   CSS   a `.dva-val{` rule that carries `font-family:var(--font-mono)`
//         (so it IS the value rule and the sheet IS the ledger) and
//         does NOT carry `font-size` — the register is gone, not
//         re-pointed.  The absence is the proof: a 14 px sheet still
//         carries `font-size:14px` inside that rule.
//
// JS and CSS are read from DIFFERENT files, so a half-deployed build
// (new chunk, stale stylesheet, or the reverse) cannot read as PASS.
const https = require("https");

const BASE = process.argv[2] || "https://www.conestruct.com";
const MAX_MIN = Number(process.argv[3] || 25);

const JS_SIG = /dva-val tr-field/;
const CSS_VAL_RULE = /\.dva-val\{[^}]*\}/;
const CSS_VAL_IS_MONO = /font-family:\s*var\(--font-mono\)/;
const CSS_VAL_SIZE = /font-size/;

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

  let cssHost = null, valRule = null, mono = false, sizeless = false;
  for (const s of sheets) {
    let css;
    try { css = await get(BASE + s); } catch { continue; }
    if (!/\.dva/.test(css)) continue;
    cssHost = s;
    const m = css.match(CSS_VAL_RULE);
    valRule = m ? m[0] : null;
    mono = !!valRule && CSS_VAL_IS_MONO.test(valRule);
    sizeless = !!valRule && !CSS_VAL_SIZE.test(valRule);
    break;
  }
  return { jsHost, cssHost, valRule, mono, sizeless, chunks: chunks.length, sheets: sheets.length };
}

(async () => {
  log(`gate: polling ${BASE} for the 12 px applied value's signature, up to ${MAX_MIN} min`);
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
      `chunks ${r.chunks} · sheets ${r.sheets} · "dva-val tr-field" ${r.jsHost ? `PRESENT in ${r.jsHost}` : "absent"}` +
      ` · css ${r.cssHost || "(none carrying .dva)"} · .dva-val rule ${r.valRule ? "found" : "MISSING"} · mono ${r.mono} · no font-size ${r.sizeless}` +
      (r.valRule ? ` · rule: ${r.valRule}` : "");
    if (line !== last) { log(line); last = line; }
    if (r.jsHost && r.mono && r.sizeless) {
      log(`GATE PASS after ${Math.round((Date.now() - t0) / 1000)} s — the served bundle carries the role on the value AND the served sheet's value rule declares no size; legs may run`);
      process.exit(0);
    }
    await new Promise((s) => setTimeout(s, 30000));
  }
  log(`GATE FAIL — the signature never appeared in ${MAX_MIN} min; the served frontend is still the 14 px build. No leg was run.`);
  process.exit(2);
})();
