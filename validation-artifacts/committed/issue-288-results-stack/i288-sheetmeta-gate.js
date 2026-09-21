// issue-288 — the served-bundle gate for the s8.32 date removal.
//
//   node i288-sheetmeta-gate.js [base] [maxMinutes]
//
// healthz proves the BACKEND sha and nothing else.  Vercel runs minutes
// behind Modal, and that lag already bit arc 26 (a leg measured a stale
// frontend against a fresh healthz), so the frontend gets its own gate.
//
// This arc's first product change is an ABSENCE — the ISSUED field is
// gone from the sheet-meta strip — and an absence is a weak signature on
// its own: a 500 page, a redirect, or a strip that failed to render all
// read as "ISSUED not present".  So the gate requires the absence AND two
// positive marks from the SAME strip, which prove it rendered:
//
//   ABSENT   `ISSUED:`   — the removed field
//   PRESENT  `LOCATION:` — the field that replaced BY, still rendered
//   PRESENT  `SCALE:`    — the strip's last field, still rendered
//
// A half-deployed or broken page cannot satisfy all three.
const https = require("https");
const BASE = process.argv[2] || "https://www.conestruct.com";
const MAX_MIN = Number(process.argv[3] || 25);

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

// The strip is server-rendered, so all three marks are decidable from the
// document itself — no browser needed for the gate.
async function poll() {
  const html = await get(`${BASE}/sandbox`);
  return {
    bytes: html.length,
    issued: /ISSUED\s*:/.test(html) || html.includes("ISSUED"),
    location: html.includes("LOCATION"),
    scale: html.includes("AS NOTED"),
    isoDate: /\b20\d{2}-\d{2}-\d{2}\b/.test(html),
  };
}

(async () => {
  log(`gate: polling ${BASE}/sandbox for the s8.32 removal, up to ${MAX_MIN} min`);
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
      `bytes ${r.bytes} · ISSUED ${r.issued ? "PRESENT (stale build)" : "absent"}` +
      ` · LOCATION ${r.location} · SCALE ${r.scale} · any-iso-date ${r.isoDate}`;
    if (line !== last) { log(line); last = line; }
    if (!r.issued && r.location && r.scale) {
      log(
        `GATE PASS after ${Math.round((Date.now() - t0) / 1000)} s — ISSUED is gone and the strip still renders; legs may run` +
        (r.isoDate ? " | NOTE: an ISO date remains elsewhere in the document — not this strip's, but record where" : ""),
      );
      process.exit(0);
    }
    await new Promise((s) => setTimeout(s, 30000));
  }
  log(`GATE FAIL — the served bundle never showed the removal in ${MAX_MIN} min. No leg was run.`);
  process.exit(2);
})();
