// Scan-refusal investigation, side finding: does the picker's road lookup
// (conestruct/site/app/api/road-bearing/route.ts) survive the fallback
// mirror's corrupt answer?  Read-only; no network: global fetch is stubbed to
// return one real capture (tests/fixtures/site_scan/, #304) for every call.
// The capture is the backend's folded answer, not this route's own query, but
// it carries the same stray way (42125193, null points at 15 and 39) beside
// the real Federal roads.  Control: the primary mirror's capture.
//
//   npx vite-node --config vitest.config.ts <this file>   (run from the main checkout's conestruct/site)
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { POST } from "@/app/api/road-bearing/route";

const FIX = resolve(process.cwd(), "../../tests/fixtures/site_scan");
const PIN = { lat: 39.7342642691076, lng: -105.02504468168067 };

async function run(name: string, file: string) {
  const payload = readFileSync(resolve(FIX, file), "utf-8");
  globalThis.fetch = (async () =>
    new Response(payload, { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch;
  const req = new Request("http://local/api/road-bearing", { method: "POST", body: JSON.stringify(PIN) });
  try {
    const r = await POST(req as never);
    const text = await r.text();
    console.log(`${name}: HTTP ${r.status} ${text.slice(0, 160)}`);
  } catch (err) {
    console.log(`${name}: THREW ${(err as Error).name}: ${(err as Error).message}`);
  }
}

await run("primary (overpass-api.de)", "federal_primary.json");
await run("fallback (overpass.openstreetmap.fr)", "federal_fallback_null_points.json");
