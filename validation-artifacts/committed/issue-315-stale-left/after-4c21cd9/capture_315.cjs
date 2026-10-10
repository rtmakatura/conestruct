// #315 build (R125): the Broadway repro on a local stack of this branch
// (AUDIT_SITE: next dev of the worktree, its backend on :8315).  The prod
// repro of issue-300-left-side-oneway/r120-prod/picker.cjs: N Broadway SB
// (39.73370, -104.98753), Shoulder work, East side (left), then the kind
// switched to Flagger lane closure.  At 1440 and 390, into AUDIT_OUT:
//   stale-<w>.png      the WHERE band after the switch: the side control
//                      (West offered, the backend's line behind ⚠) and the
//                      aerial (the pin picture)
//   picked-<w>.png     after picking West: the line gone
//   facts-<w>.json     the side control's options / line / note, the
//                      aerial's state, every corridor-geometry and
//                      corridor-map answer, scroll width, page errors
// Usage: GATE_BYPASS_TOKEN=... AUDIT_SITE=http://localhost:3315/sandbox
//        AUDIT_OUT=<dir> node capture_315.cjs
const path = require("path");
const fs = require("fs");
const REPO = "C:/Users/rtmak/Documents/traffic-control-tool";
const { chromium } = require(`${REPO}/node_modules/playwright`);
const { hook } = require(`${REPO}/scripts/live-check.cjs`);
const { applyGate, gateHeaders } = require(`${REPO}/scripts/gate.cjs`);

const SITE = process.env.AUDIT_SITE || "http://localhost:3315/sandbox";
const OUT = process.env.AUDIT_OUT;
if (!OUT) throw new Error("AUDIT_OUT is required");
fs.mkdirSync(OUT, { recursive: true });
gateHeaders(SITE);
const PIN = { lat: "39.73370", lng: "-104.98753" };

async function sideFacts(page) {
  return page.evaluate(() => ({
    options: [...document.querySelectorAll('[data-testid="side-option"]')].map((e) => [
      e.textContent,
      e.getAttribute("aria-checked"),
    ]),
    stale: document.querySelector('[data-testid="side-control-stale"]')?.textContent ?? null,
    note: document.querySelector('[data-testid="side-control-note"]')?.textContent ?? null,
    aerialImg: !!document.querySelector('[data-testid="band-aerial"] img'),
    aerialStage: document.querySelector('[data-testid="band-aerial"]')?.getAttribute("data-stage") ?? null,
    aerialText: document.querySelector('[data-testid="band-aerial"]')?.innerText ?? null,
    scroll: [document.documentElement.scrollWidth, innerWidth],
  }));
}

async function shotBand(page, file) {
  const ctl = page.locator('[data-testid="side-control"]').first();
  await ctl.scrollIntoViewIfNeeded();
  await page.mouse.move(1, 1);
  await page.waitForTimeout(500);
  // From the aerial (above the control) down through the kind chips.
  const top = page.locator('[data-testid="band-aerial"]').first();
  const a = (await top.count()) ? await top.boundingBox() : await ctl.boundingBox();
  const b = await ctl.boundingBox();
  const w = page.viewportSize().width;
  await top.scrollIntoViewIfNeeded().catch(() => {});
  const a2 = (await top.count()) ? await top.boundingBox() : a;
  const b2 = await ctl.boundingBox();
  const sy = await page.evaluate(() => scrollY);
  const y0 = Math.max(0, Math.min(a2.y, b2.y) + sy - 8);
  const y1 = Math.max(a2.y + a2.height, b2.y + b2.height) + sy + 8;
  await page.screenshot({
    path: path.join(OUT, file),
    clip: { x: 0, y: y0, width: w, height: Math.min(y1 - y0, 2400) },
    fullPage: true,
  });
  void b;
}

async function run(browser, width, height) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  await applyGate(ctx, SITE);
  const page = await ctx.newPage();
  const errors = [];
  const answers = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
  page.on("response", async (r) => {
    const u = r.url();
    if (!u.includes("/api/render/corridor-geometry") && !u.includes("/api/corridor-map")) return;
    let side = null;
    try {
      const body = JSON.parse(r.request().postData());
      side = (body.scenario ?? body).meta?.work?.side ?? null;
    } catch {}
    const ct = r.headers()["content-type"] ?? "";
    let summary = ct;
    if (ct.includes("json")) {
      try {
        const j = await r.json();
        summary = {
          status: j.status,
          side_options: (j.side_options ?? []).map((o) => o.label),
          side_refused: j.side_refused ?? undefined,
          detail: j.detail ?? undefined,
        };
      } catch {}
    }
    answers.push({ url: u.includes("corridor-map") ? "corridor-map" : "corridor-geometry", http: r.status(), side, summary });
  });

  await page.goto(SITE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(8000);
  await (await hook(page, "where-open-picker")).click();
  await page.waitForTimeout(3500);
  await page.getByRole("button", { name: /enter coordinates manually/i }).click();
  await page.waitForTimeout(1200);
  await page.getByPlaceholder(/^Latitude/).fill(PIN.lat);
  await page.getByPlaceholder(/^Longitude/).fill(PIN.lng);
  const save = page.getByRole("button", { name: /Save & Close/ });
  const candidate = page
    .locator("button")
    .filter({ hasText: /\((primary|secondary|tertiary|residential|trunk|motorway)/ })
    .first();
  for (let i = 0; i < 90; i += 1) {
    if ((await candidate.count()) > 0 || (await save.isEnabled())) break;
    await page.waitForTimeout(1000);
  }
  for (let t = 0; t < 4 && (await candidate.count()) === 0 && (await page.getByText(/DETECTION SERVICE UNAVAILABLE/i).count()) > 0; t += 1) {
    await page.waitForTimeout(20000);
    await page.getByRole("button", { name: /Re-detect roads/i }).click();
    for (let i = 0; i < 60 && (await candidate.count()) === 0; i += 1) await page.waitForTimeout(1000);
  }
  if ((await candidate.count()) > 0) {
    await candidate.click();
    await page.waitForTimeout(3000);
  }
  for (let i = 0; i < 60 && !(await save.isEnabled()); i += 1) await page.waitForTimeout(1000);
  await save.click();
  await page.waitForTimeout(4000);
  await (await hook(page, "kind-chip-shoulder")).click();
  const opt = page.locator('[data-testid="side-option"]');
  for (let i = 0; i < 60 && (await opt.count()) < 2; i += 1) await page.waitForTimeout(1000);
  await opt.filter({ hasText: /East side/ }).first().click();
  await page.waitForTimeout(4000);
  if ((await page.locator('[data-testid="kind-chip-flagger_lane_closure"]').count()) === 0) {
    try { await (await hook(page, "where-open-band")).click(); } catch {}
    await page.waitForTimeout(2000);
  }
  const before = await sideFacts(page);
  await (await hook(page, "kind-chip-flagger_lane_closure")).click();
  // The geometry read (300 ms debounce) and the aerial's picture.
  for (let i = 0; i < 40; i += 1) {
    await page.waitForTimeout(1000);
    const f = await sideFacts(page);
    if (f.stale && f.aerialImg) break;
  }
  await page.waitForTimeout(1500);
  const stale = await sideFacts(page);
  await shotBand(page, `stale-${width}.png`);
  const west = page.locator('[data-testid="side-option"]').filter({ hasText: /West side/ }).first();
  await west.click();
  await page.waitForTimeout(5000);
  if ((await page.locator('[data-testid="side-control"]').count()) === 0) {
    try { await (await hook(page, "where-open-band")).click(); } catch {}
    await page.waitForTimeout(3000);
  }
  const picked = await sideFacts(page);
  await shotBand(page, `picked-${width}.png`);
  const facts = { site: SITE, width, before, stale, picked, answers, errors };
  fs.writeFileSync(path.join(OUT, `facts-${width}.json`), JSON.stringify(facts, null, 2));
  console.log(width, JSON.stringify({ stale, picked: { options: picked.options, stale: picked.stale }, errors }));
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  await run(browser, 1440, 1000);
  await run(browser, 390, 844);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
