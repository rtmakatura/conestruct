// #212 probe — is the /sandbox hydration mismatch timezone-dependent, and
// what is the served HTML's cache state and baked ISSUED date?
//   node hydration-tz-probe.js [base] [outFile]
//
// WHEN THIS REPRODUCES.  Only on a UTC day AFTER the last deploy.  The
// defect is a prerendered date compared against the client's today, so
// a run within hours of a ship sees zero errors no matter what — see
// the three committed runs in this directory (outProd-30ef02a PASS on
// its deploy day, outProd-before-2a67d2f FAIL three days later,
// outProd-928ccac PASS minutes after its own ship).  A clean result
// from this script is therefore NOT evidence the defect is fixed; it is
// evidence about which day you ran it.  Check `issued` against `today`
// in the output before reading anything into the error count.
//
// WHAT IT ANSWERS.  Three browser contexts — the runner's default, UTC,
// and America/Denver — load the same served HTML.  If the client's own
// timezone moved the boundary, the three would disagree.  They do not:
// `toISOString()` yields a UTC date string on both the prerender and
// the client, so every visitor flips at one global instant rather than
// at their own local midnight.  The header block is captured in the
// same run so the cache state and the baked date are read from the
// same response the browsers saw.
const ROOT = "C:/Users/rtmak/Documents/traffic-control-tool";
const { chromium } = require(ROOT + "/node_modules/playwright");
const https = require("https");
const fs = require("fs");

const BASE = process.argv[2] || "https://www.conestruct.com";
const OUT = process.argv[3] || null;

const lines = [];
const log = (s) => { console.log(s); lines.push(s); };

const head = (url) =>
  new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let b = "";
        res.setEncoding("utf-8");
        res.on("data", (d) => (b += d));
        res.on("end", () => resolve({ headers: res.headers, body: b }));
      })
      .on("error", reject);
  });

(async () => {
  log(`probe ${BASE}/sandbox at ${new Date().toISOString()}`);

  const r = await head(`${BASE}/sandbox`);
  const h = r.headers;
  const issued = (r.body.match(/ISSUED[\s\S]{0,200}?(\d{4}-\d{2}-\d{2})/) || [])[1] || "(not found)";
  const today = new Date().toISOString().slice(0, 10);
  log(
    `served HTML — x-vercel-cache ${h["x-vercel-cache"] || "(none)"} · age ${h["age"] || "(none)"}` +
      ` · cache-control ${h["cache-control"] || "(none)"} · date ${h["date"] || "(none)"}`,
  );
  log(`baked ISSUED ${issued} · client today (UTC) ${today} · MISMATCH ${issued !== today}`);
  if (issued === today) {
    log(
      "NOTE: the baked date equals today, so this run is on the deploy's own UTC day" +
        " and CANNOT observe the defect.  Zero errors below proves nothing.",
    );
  }

  const b = await chromium.launch();
  for (const tz of [null, "UTC", "America/Denver"]) {
    const ctx = await b.newContext(tz ? { timezoneId: tz } : {});
    const page = await ctx.newPage();
    const errs = [];
    page.on("pageerror", (e) => errs.push(String(e.message).split(";")[0]));
    await page.goto(`${BASE}/sandbox`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(2500);
    const clock = await page.evaluate(() => ({
      local: new Date().toString().slice(0, 24),
      utcDate: new Date().toISOString().slice(0, 10),
    }));
    log(
      `tz ${tz || "(runner default)"} · local ${clock.local} · utc-date ${clock.utcDate}` +
        ` · ${errs.length} pageerror(s)${errs.length ? ": " + errs.join(" | ") : ""}`,
    );
    await ctx.close();
  }
  await b.close();

  if (OUT) {
    fs.writeFileSync(OUT, lines.join("\n") + "\n");
    log(`written ${OUT}`);
  }
})();
