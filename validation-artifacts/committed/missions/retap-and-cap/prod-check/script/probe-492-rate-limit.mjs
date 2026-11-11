// #492 production probe: 41 POSTs to /api/needs-you-map inside one fixed
// 60 s window, each with an out-of-range zoom (99) so the route answers 400
// at validation and never calls the backend or Mapbox.  The rate limit runs
// first in the route (app/api/needs-you-map/route.ts: rateLimitOr429 before
// req.json() and every check), so each request spends one count.
//
// The limiter is Upstash fixedWindow(40, "60 s"): the burst starts just after
// a minute boundary so all 41 land in one window.
//
// Usage: GATE_BYPASS_TOKEN=... node probe-492-rate-limit.mjs
// The token is read from the environment, sent only to the site through
// scripts/gate.cjs, never printed.
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { gateHeaders } = require(path.resolve(here, "../../../../../../scripts/gate.cjs"));

const SITE = process.env.SITE ?? "https://www.conestruct.com";
const url = `${SITE}/api/needs-you-map`;
const body = JSON.stringify({
  scenario: { kind: "probe-492" },
  flag: "adjacent_intersection",
  width: 800,
  height: 400,
  zoom: 99,
});

// Start 1 s after the next minute boundary.
const now = Date.now();
const start = Math.ceil(now / 60000) * 60000 + 1000;
await new Promise((r) => setTimeout(r, start - now));

const rows = [];
for (let i = 1; i <= 41; i++) {
  const t0 = Date.now();
  const r = await fetch(url, {
    method: "POST",
    headers: { ...gateHeaders(url), "content-type": "application/json" },
    body,
  });
  const text = (await r.text()).slice(0, 60).replace(/\s+/g, " ");
  rows.push({ i, status: r.status, ms: Date.now() - t0, body: text, at: new Date(t0).toISOString() });
}
for (const row of rows) console.log(`${row.i}\t${row.status}\t${row.ms} ms\t${row.at}\t${row.body}`);
const first40 = rows.slice(0, 40);
const any429 = first40.filter((r) => r.status === 429).length;
const last = rows[40];
const elapsed = Date.parse(last.at) - Date.parse(rows[0].at);
console.log(`window start ${new Date(start).toISOString()}, last request sent ${elapsed} ms after the first`);
const pass = any429 === 0 && last.status === 429;
console.log(
  `RESULT ${pass ? "PASS" : "FAIL"}: requests 1-40 -> ${[...new Set(first40.map((r) => r.status))].join("/")} (429s: ${any429}); request 41 -> ${last.status}`,
);
process.exit(pass ? 0 : 1);
