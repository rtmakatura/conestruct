// Backlog-arc prod check (824840f): /landing and /app/plans/new redirects;
// /sandbox Generate, the plan PDF downloads, the quote panel's eight fields
// and flagger caption.   node prodbatch.cjs <base> <outPdf>
const fs = require("fs");
const REPO = "C:/Users/rtmak/Documents/traffic-control-tool";
const { chromium } = require(`${REPO}/node_modules/playwright`);
const { hook } = require(`${REPO}/scripts/live-check.cjs`);
const { applyGate, gateHeaders } = require(`${REPO}/scripts/gate.cjs`);

const [, , BASE, OUT] = process.argv;
const out = {};

(async () => {
  gateHeaders(BASE);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  await applyGate(ctx, BASE);
  const page = await ctx.newPage();
  const errors = [];
  const pdfReq = [];
  page.on("request", (r) => { const u = new URL(r.url()); if (u.pathname === "/api/render/pdf" && r.method() === "POST") { let t = null; try { t = !!JSON.parse(r.postData()).scenario.site_scan.token; } catch {} pdfReq.push({ tokenSent: t }); } });
  page.on("response", (r) => { const u = new URL(r.url()); if (u.pathname === "/api/render/pdf") pdfReq.push({ status: r.status(), source: r.headers()["x-site-scan-source"] || null }); });
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 120)));

  for (const p of ["/landing", "/app/plans/new"]) {
    const r = await page.goto(`${BASE}${p}`, { waitUntil: "domcontentloaded" });
    out[p] = { finalPath: new URL(page.url()).pathname, status: r ? r.status() : null };
  }

  await page.goto(`${BASE}/sandbox`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(8000);
  await (await hook(page, "where-open-picker")).click();
  await page.waitForTimeout(3500);
  await page.getByRole("button", { name: /enter coordinates manually/i }).click();
  await page.waitForTimeout(1200);
  await page.getByPlaceholder(/^Latitude/).fill("39.73370");
  await page.getByPlaceholder(/^Longitude/).fill("-104.98753");
  const card = page.getByText(/Road detected · 1 match|Which road\?|No road|No roads detected/).first();
  for (let i = 0; i < 90 && (await card.count()) === 0; i += 1) await page.waitForTimeout(1000);
  const cand = page.locator("button").filter({ hasText: /\((primary|secondary|tertiary|residential|trunk|motorway)/ }).first();
  if ((await page.getByText(/Which road\?/).count()) > 0 && (await cand.count()) > 0) await cand.click();
  await page.waitForTimeout(2500);
  const save = page.getByRole("button", { name: /Save & Close/ });
  for (let i = 0; i < 60 && !(await save.isEnabled()); i += 1) await page.waitForTimeout(1000);
  await save.click();
  await page.waitForTimeout(5000);
  await (await hook(page, "kind-chip-shoulder")).click();
  await page.waitForTimeout(2500);
  const side = page.locator('[data-testid="side-option"]').first();
  for (let i = 0; i < 20 && (await side.count()) === 0; i += 1) await page.waitForTimeout(1000);
  if (await side.count()) await side.click();
  await page.waitForTimeout(2000);
  await (await hook(page, "where-confirm")).click();
  await page.waitForTimeout(9000);
  const gen = page.getByRole("button", { name: /Generate plan/ }).first();
  for (let i = 0; i < 120 && !(await gen.isEnabled()); i += 1) await page.waitForTimeout(1000);
  await gen.click({ timeout: 5000 });
  for (let i = 0; i < 150; i++) {
    if ((await page.locator(".dls").count()) && !(await page.locator(".working-band").count()) && !(await page.locator(".results-stale").count())) break;
    await page.waitForTimeout(1000);
  }
  await page.waitForTimeout(3000);

  const planCard = page.locator(".dl-card").filter({ has: page.locator("h3", { hasText: /^Plan sheet$/ }) }).first();
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 120000 }),
    planCard.getByRole("button", { name: /Download PDF/ }).click(),
  ]);
  await dl.saveAs(OUT);
  out.planPdf = { bytes: fs.statSync(OUT).size, name: dl.suggestedFilename() };

  const pricing = page.getByRole("button", { name: /Pricing quote/ }).first();
  if (await pricing.count()) await pricing.click();
  await page.waitForTimeout(1500);
  const q = page.locator("body");
  out.quote = {
    spinbuttons: await page.getByRole("spinbutton").count(),
    flaggerCaption: (await q.innerText()).match(/Auto · \d+ from layout/i)?.[0] ?? null,
    flaggerCaptionText: (await q.textContent()).match(/Auto · \d+ from layout/)?.[0] ?? null,
    savedDefaultsLine: await page.locator('[data-testid="quote-saved-defaults"]').count(),
    downloadQuote: await page.getByRole("button", { name: /Download Quote \(XLSX\)/ }).count(),
  };
  out.pdfDownload = pdfReq;
  out.pageErrors = errors;
  console.log(JSON.stringify(out));
  await browser.close();
})().catch((e) => { console.error(String(e).slice(0, 400)); process.exit(1); });
