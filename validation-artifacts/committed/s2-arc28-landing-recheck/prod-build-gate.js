// s2-arc28 prod build gate — is www.conestruct.com actually serving #271 yet?
//   node prod-build-gate.js [base] [maxMinutes]
//
// Modal deploys in seconds; Vercel is minutes behind, and that lag bit
// arc 26 (a leg measured a stale frontend against a fresh healthz).  The
// healthz gate proves the BACKEND sha; nothing in it proves the bundle
// the browser downloads.  So before any leg runs, poll the served
// chunks for a signature that exists only after #271 and log the moment
// it appears.
//
// The signature is the landing check's re-issue.  Before #271:
//     e.scrollIntoView({behavior:t,block:"start"})          // one latch
// After #271 (finding 4, the instant post-settle correction):
//     e.scrollIntoView({behavior:d?"auto":t,block:"start"}) // settled ? auto : arming
// The ternary must have an IDENTIFIER on its right arm — the two call
// sites in the shell read ``n?"auto":"smooth"`` (prefers-reduced-motion)
// and have looked like that since #152, so a literal right arm proves
// nothing.  Two corroborating marks are checked and logged alongside:
// the re-issue cap as a COUNT (``>=2``, not a boolean latch) and the
// 4000 ms whole-check deadline, which minifies to 4e3.
const https = require("https");
const BASE = process.argv[2] || "https://www.conestruct.com";
const MAX_MIN = Number(process.argv[3] || 25);
const SIG = /scrollIntoView\(\{behavior:\w+\?"auto":\w+,block:"start"\}/;
const CAP = /(>=2|2<=)/;          // the counted cap, corroborating only
const DEADLINE = /4e3/;           // LANDING_DEADLINE_MS, corroborating only

const get = (url) =>
  new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) { res.resume(); return reject(new Error(`${res.statusCode} ${url}`)); }
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
  const chunks = [...new Set([...html.matchAll(/src="(\/_next\/static\/chunks\/[^"]+)"/g)].map((m) => m[1]))];
  // Every chunk is read, not just the first that mentions ``scrollend``
  // — a vendor chunk can name the event without being the shell (one
  // does), and latching onto it would report "absent" forever.  The
  // landing helper is the chunk that carries BOTH the scrollend listener
  // and a scrollIntoView with block:"start".
  let host = null, found = false, cap = false, deadline = false, shapes = [];
  for (const c of chunks) {
    let js;
    try { js = await get(BASE + c); } catch (e) { continue; }
    const mine = [...new Set([...js.matchAll(/scrollIntoView\(\{behavior:[^}]*\}/g)].map((m) => m[0]))];
    if (!js.includes("scrollend") || mine.length === 0) continue;
    host = c; shapes = mine;
    found = SIG.test(js); cap = CAP.test(js); deadline = DEADLINE.test(js);
    break;
  }
  return { chunk: host, found, cap, deadline, shapes, chunks: chunks.length };
}

(async () => {
  log(`gate: polling ${BASE} for the #271 landing-check signature, up to ${MAX_MIN} min`);
  const t0 = Date.now();
  let last = "";
  while (Date.now() - t0 < MAX_MIN * 60000) {
    let r;
    try { r = await poll(); } catch (e) { log(`poll error ${e.message}`); await new Promise((s) => setTimeout(s, 30000)); continue; }
    const line = `chunk ${r.chunk} · signature ${r.found ? "PRESENT" : "absent"} · counted-cap ${r.cap} · 4e3 deadline ${r.deadline} · scrollIntoView shapes: ${r.shapes.join(" | ")}`;
    if (line !== last) { log(line); last = line; }
    if (r.found) {
      log(`GATE PASS after ${Math.round((Date.now() - t0) / 1000)} s — the served bundle carries #271; legs may run`);
      process.exit(0);
    }
    await new Promise((s) => setTimeout(s, 30000));
  }
  log(`GATE FAIL — the signature never appeared in ${MAX_MIN} min; the served frontend is still the pre-#271 build. No leg was run.`);
  process.exit(2);
})();
