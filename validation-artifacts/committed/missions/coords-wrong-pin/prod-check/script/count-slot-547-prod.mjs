// Mission coords-wrong-pin (#549) production check, second read: which
// build the served map-window script is, told by a string a production
// build keeps.  The deleted bearing-note slot was
//   {bearingWarning && <p className="mw-note mw-search-line">...</p>}
// and the coarse-match notice beside it has the same class string, so
// LocationPickerModal.tsx holds "mw-note mw-search-line" twice before #547
// (e51cda0~1) and once at e51cda0.  (The two refusal lines read
// "mw-note mw-note-fail mw-search-line", a different string.)
//   node count-slot-547-prod.mjs <main checkout> <out json>
// One browser at 1440x900: open /sandbox and "Pick on map", no search (no
// geocode request), read every script the page loaded from the site's
// /_next/ and count the string.  Read-only.  The gate token is read from
// .env.local and sent only by scripts/gate.cjs; never printed or written.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const [MAIN, OUT] = process.argv.slice(2);
const tm = fs.readFileSync(path.join(MAIN, "conestruct/site/.env.local"), "utf8").match(/^\s*GATE_BYPASS_TOKEN\s*=\s*["']?([^"'\r\n]*)["']?\s*$/m);
if (!tm) throw new Error("GATE_BYPASS_TOKEN not in .env.local");
process.env.GATE_BYPASS_TOKEN = tm[1];
const require = createRequire(path.join(MAIN, "package.json"));
const { newGatedContext, guardOutput, oneLine } = require(path.join(MAIN, "scripts/gate.cjs"));
guardOutput();
const { chromium } = require("playwright");
const SITE = "https://www.conestruct.com";
const SLOT = "mw-note mw-search-line";
const NOTICE = "That search found a town or area";
const count = (t, s) => t.split(s).length - 1;
const result = { ranAt: new Date().toISOString(), site: SITE, size: "1440x900", string: SLOT };
const b = await chromium.launch();
try {
  const ctx = await newGatedContext(b, SITE, { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const scripts = [];
  let nonGet = 0;
  p.on("request", (r) => { if (r.method() !== "GET" && new URL(r.url()).host === new URL(SITE).host) nonGet += 1; });
  p.on("response", (r) => {
    const u = new URL(r.url());
    if (u.host !== new URL(SITE).host || !/^\/_next\/.*\.js$/.test(u.pathname)) return;
    scripts.push(r.text().then((t) => ({ read: true, slot: count(t, SLOT), notice: count(t, NOTICE) }), () => ({ read: false, slot: 0, notice: 0 })));
  });
  await p.goto(`${SITE}/sandbox`, { waitUntil: "networkidle", timeout: 240000 });
  await p.waitForSelector(".a-open .a-head", { timeout: 120000 });
  await p.getByRole("button", { name: "Pick on map" }).first().click();
  await p.waitForSelector("[role=dialog] [data-testid=coords-bar]", { timeout: 30000 });
  await p.waitForTimeout(3000);
  const read = await Promise.all(scripts);
  const withNotice = read.filter((r) => r.notice > 0);
  result.scriptsLoaded = read.length;
  result.scriptsRead = read.filter((r) => r.read).length;
  result.scriptsHoldingTheNoticeText = withNotice.length;
  result.stringCountInThoseScripts = withNotice.map((r) => r.slot);
  result.stringCountInAllScripts = read.reduce((n, r) => n + r.slot, 0);
  result.nonGetRequestsToTheSite = nonGet;
} catch (e) {
  result.error = oneLine(e).slice(0, 300);
} finally {
  await b.close();
}
result.finishedAt = new Date().toISOString();
fs.writeFileSync(OUT, `${JSON.stringify(result, null, 1)}\n`, "utf8");
console.log(JSON.stringify(result));
