// Loaded into the Next dev server with NODE_OPTIONS=--require <this file>.
// Replaces the server's fetch for the two Overpass mirrors only: an ask whose
// answer is saved under sha256(query)[:16] in OVERPASS_FIX_DIR is replayed; a
// miss answers 504 (as if every mirror were down), unless OVERPASS_RECORD=1,
// when the live mirror is asked once and the answer saved.  Every ask is
// logged (key, replay|miss|record) to OVERPASS_FIX_DIR/asks.log.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const DIR = process.env.OVERPASS_FIX_DIR;
const RECORD = process.env.OVERPASS_RECORD === "1";
const real = globalThis.fetch;
const HOSTS = ["overpass-api.de", "overpass.openstreetmap.fr"];

if (DIR && real) {
  fs.mkdirSync(DIR, { recursive: true });
  globalThis.fetch = async function stubbed(input, init) {
    const url = typeof input === "string" ? input : input?.url ?? String(input);
    let host = "";
    try { host = new URL(url).host; } catch {}
    if (!HOSTS.includes(host)) return real(input, init);
    const body = String(init?.body ?? "");
    const q = decodeURIComponent(body.replace(/^data=/, ""));
    const key = crypto.createHash("sha256").update(q).digest("hex").slice(0, 16);
    const f = path.join(DIR, `${key}.json`);
    const log = (what) => fs.appendFileSync(path.join(DIR, "asks.log"), `${new Date().toISOString()} ${host} ${key} ${what}\n`);
    // The walk's failing point (lat 39.7501…): the lookup always fails there.
    if (/around:\d+,39\.7501/.test(q)) {
      log("fail-point");
      return new Response("stubbed: failing point", { status: 504 });
    }
    if (fs.existsSync(f)) {
      log("replay");
      return new Response(fs.readFileSync(f), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (RECORD) {
      const r = await real(input, init);
      const text = await r.text();
      if (r.ok) {
        fs.writeFileSync(f, text);
        fs.writeFileSync(path.join(DIR, `${key}.query.txt`), q);
        log("record");
      } else log(`record-failed ${r.status}`);
      return new Response(text, { status: r.status, headers: { "content-type": "application/json" } });
    }
    log("miss");
    return new Response("stubbed: no recorded answer", { status: 504 });
  };
}
