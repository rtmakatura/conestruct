// #285: the nearest-cross-street tag in the WHERE band, driven in a browser.
//
//   node tag285.cjs <outDir> [base] [widths]
//
// For each pin: open /sandbox, pin it, take the road, pick the shoulder
// kind and a side, then read the "Work starts" row (move-start), the WHERE
// provenance line and, after Confirm, the WHERE fact line.  The backend's
// own answer is captured off the network, so the printed words can be
// checked against it.
const fs = require("fs");
const path = require("path");
const REPO = "C:/Users/rtmak/Documents/traffic-control-tool";
const { chromium } = require(`${REPO}/node_modules/playwright`);
const { hook } = require(`${REPO}/scripts/live-check.cjs`);
const { applyGate, gateHeaders } = require(`${REPO}/scripts/gate.cjs`);

const OUT = process.argv[2];
const BASE = process.argv[3] || "https://www.conestruct.com";
const WIDTHS = (process.argv[4] || "1440,380").split(",").map(Number);
fs.mkdirSync(OUT, { recursive: true });
const PINS = [
  { id: "broadway", label: "N Broadway SB, Denver", lat: "39.73370", lng: "-104.98753" },
  { id: "lafayette", label: "Lafayette St, Denver", lat: "39.74362", lng: "-104.97070" },
];
const rows = [];
const log = (s) => { console.log(s); fs.appendFileSync(path.join(OUT, "log.txt"), s + "\n"); };

async function run(browser, pin, width) {
  const ctx = await browser.newContext({ viewport: { width, height: width >= 1440 ? 1000 : 800 }, deviceScaleFactor: 2 });
  await applyGate(ctx, BASE);
  const page = await ctx.newPage();
  const answers = [];
  page.on("response", async (r) => {
    if (/\/api\/render\/nearest-intersection/.test(r.url())) {
      answers.push({ status: r.status(), body: await r.json().catch(() => null) });
    }
  });
  await page.goto(`${BASE}/sandbox`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(8000);
  await (await hook(page, "where-open-picker")).click();
  await page.waitForTimeout(3500);
  await page.getByRole("button", { name: /enter coordinates manually/i }).click();
  await page.waitForTimeout(1200);
  await page.getByPlaceholder(/^Latitude/).fill(pin.lat);
  await page.getByPlaceholder(/^Longitude/).fill(pin.lng);
  const card = page.getByText(/Road detected · 1 match|Which road\?|No road|No roads detected/).first();
  for (let i = 0; i < 90 && (await card.count()) === 0; i += 1) await page.waitForTimeout(1000);
  const cand = page.locator("button").filter({ hasText: /\((primary|secondary|tertiary|residential|trunk|motorway)/ }).first();
  if ((await page.getByText(/Which road\?/).count()) > 0 && (await cand.count()) > 0) {
    await cand.scrollIntoViewIfNeeded();
    await cand.click();
  }
  await page.waitForTimeout(2500);
  const save = page.getByRole("button", { name: /Save & Close/ });
  for (let i = 0; i < 60 && !(await save.isEnabled()); i += 1) await page.waitForTimeout(1000);
  await save.click();
  await page.waitForTimeout(4000);
  await (await hook(page, "kind-chip-shoulder")).click();
  await page.waitForTimeout(2500);
  const side = page.locator('[data-testid="side-option"]').first();
  for (let i = 0; i < 20 && (await side.count()) === 0; i += 1) await page.waitForTimeout(1000);
  if (await side.count()) await side.click();
  // The read answers in a second or two; give it the backend's budget.
  for (let i = 0; i < 15 && !answers.some((a) => a.body); i += 1) await page.waitForTimeout(1000);
  await page.waitForTimeout(800);
  const open = await page.evaluate(() => {
    const t = (s) => { const e = document.querySelector(s); return e ? e.textContent.replace(/\s+/g, " ").trim() : null; };
    const start = document.querySelector('[data-testid="move-start"]');
    return {
      start: start ? (start.querySelector(".a-val") || start).textContent.replace(/\s+/g, " ").trim() : null,
      provenance: Array.from(document.querySelectorAll("*")).map((e) => e.childElementCount === 0 ? (e.textContent || "") : "").find((s) => /OSM detection · way/.test(s)) || null,
    };
  });
  const startRow = page.locator('[data-testid="move-start"]');
  if (await startRow.count()) await startRow.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(OUT, `${pin.id}-${width}-open.png`) });
  await (await hook(page, "where-confirm")).click().catch(() => {});
  await page.waitForTimeout(2500);
  const fact = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll("*")).filter((e) => e.childElementCount === 0);
    const hit = all.map((e) => (e.textContent || "").replace(/\s+/g, " ").trim()).find((s) => /·.*\d[\d,]* ft/.test(s) && /Broadway|Lafayette|Street|Avenue/.test(s));
    return hit || null;
  });
  await page.screenshot({ path: path.join(OUT, `${pin.id}-${width}-confirmed.png`) });
  const answer = answers.filter((a) => a.body).slice(-1)[0] || null;
  const row = { pin: pin.label, width, answer, start: open.start, provenance: open.provenance, fact };
  rows.push(row);
  fs.writeFileSync(path.join(OUT, "rows.json"), JSON.stringify(rows, null, 1));
  const want = answer && answer.body && answer.body.status === "found" ? answer.body.text : null;
  log(`${pin.id} @${width}: answer ${answer ? answer.status + " " + JSON.stringify(answer.body && { status: answer.body.status, text: answer.body.text }) : "none captured"}`);
  log(`   Work starts: "${open.start}"  ${want ? (open.start === want ? "PASS (= the backend's text)" : "FAIL") : ""}`);
  log(`   provenance: "${open.provenance}"  ${want ? (open.provenance && open.provenance.includes(answer.body.provenance_text) ? "PASS" : "FAIL") : ""}`);
  log(`   fact line: "${fact}"  ${want ? (fact && fact.includes(want) ? "PASS" : "FAIL") : ""}`);
  await ctx.close();
}

(async () => {
  gateHeaders(BASE);
  log(`base ${BASE}`);
  const browser = await chromium.launch();
  for (const width of WIDTHS) {
    for (const pin of PINS) {
      try { await run(browser, pin, width); }
      catch (e) { log(`${pin.id} @${width}: CRASH ${String(e.message).split("\n")[0]}`); }
    }
  }
  await browser.close();
})();
