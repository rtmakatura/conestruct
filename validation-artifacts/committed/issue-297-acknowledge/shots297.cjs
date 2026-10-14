// #297 / #284: screenshots at 1440 and 360 of the surfaces each step touches.
//
//   node shots297.cjs <outDir> <base> <mode> <pinId> [widths]
//     mode   chips    the WHERE band's kind chips once the road is confirmed (#284)
//            needsyou a generated plan's NEEDS YOU block (#297 steps 1 and 3)
//            ack      as needsyou, then press the first ACKNOWLEDGE and shoot again (#297 step 3)
//     pinId  one of PINS below
//
// Each run also writes rows.json: the chips' text and pressed state, and
// NEEDS YOU's rows (title, buttons, provenance), so a screenshot's claim can
// be checked as text.
const fs = require("fs");
const path = require("path");
const REPO = "C:/Users/rtmak/Documents/traffic-control-tool";
const { chromium } = require(`${REPO}/node_modules/playwright`);
const { hook } = require(`${REPO}/scripts/live-check.cjs`);
const { applyGate, gateHeaders } = require(`${REPO}/scripts/gate.cjs`);

const [, , OUT, BASE, MODE, PIN_ID, W] = process.argv;
const WIDTHS = (W || "1440,360").split(",").map(Number);
const PINS = {
  // S Wadsworth Blvd, Lakewood: Lakewood's deltas fire (attention rows).
  wadsworth: { lat: "39.67000", lng: "-105.08140", chip: "kind-chip-shoulder" },
  // N Broadway SB, Denver: a one-way multi-lane street.
  broadway: { lat: "39.73370", lng: "-104.98753", chip: "kind-chip-shoulder" },
  // Lafayette St, Denver: a two-way residential street.
  lafayette: { lat: "39.74362", lng: "-104.97070", chip: "kind-chip-shoulder" },
  // S Colorado Blvd at Evans: a multi-lane arterial.
  colorado: { lat: "39.67850", lng: "-104.94070", chip: "kind-chip-shoulder" },
  // S Santa Fe Dr: a divided trunk road, three lanes each way.
  santafe: { lat: "39.70000", lng: "-104.98770", chip: "kind-chip-shoulder" },
  // E Hampden Ave (US 285): a divided arterial.
  hampden: { lat: "39.65340", lng: "-104.94060", chip: "kind-chip-shoulder" },
  // One-lane one-way streets (OSM lanes=1, oneway=yes): Clarkson St
  // (tertiary, way 44932808) and Tremont Pl (residential, way 44959616).
  clarkson: { lat: "39.72547", lng: "-104.97757", chip: "kind-chip-shoulder" },
  tremont: { lat: "39.75474", lng: "-104.97466", chip: "kind-chip-shoulder" },
};
const PIN = PINS[PIN_ID];
fs.mkdirSync(OUT, { recursive: true });
const rows = [];
const log = (s) => { console.log(s); fs.appendFileSync(path.join(OUT, "log.txt"), s + "\n"); };

const CHIPS = () =>
  Array.from(document.querySelectorAll('[data-testid^="kind-chip-"]')).map((b) => ({
    id: b.getAttribute("data-testid"),
    pressed: b.getAttribute("aria-pressed"),
    text: (b.textContent || "").replace(/\s+/g, " ").trim(),
  }));
const NEEDS = () =>
  Array.from(document.querySelectorAll(".needs-you .ny-item")).map((r) => ({
    cls: r.className,
    text: (r.textContent || "").replace(/\s+/g, " ").trim().slice(0, 220),
    buttons: Array.from(r.querySelectorAll("button")).map((b) => (b.textContent || "").trim()),
  }));

async function toConfirmedRoad(page) {
  await page.goto(`${BASE}/sandbox`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(8000);
  await (await hook(page, "where-open-picker")).click();
  await page.waitForTimeout(3500);
  await page.getByRole("button", { name: /enter coordinates manually/i }).click();
  await page.waitForTimeout(1200);
  await page.getByPlaceholder(/^Latitude/).fill(PIN.lat);
  await page.getByPlaceholder(/^Longitude/).fill(PIN.lng);
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
  await page.waitForTimeout(5000);
}

async function toGenerated(page) {
  await (await hook(page, PIN.chip)).click();
  await page.waitForTimeout(2500);
  const side = page.locator('[data-testid="side-option"]').first();
  for (let i = 0; i < 20 && (await side.count()) === 0; i += 1) await page.waitForTimeout(1000);
  if (await side.count()) await side.click();
  await page.waitForTimeout(2500);
  await (await hook(page, "where-confirm")).click();
  await page.waitForTimeout(9000);
  const gen = page.getByRole("button", { name: /Generate plan/ }).first();
  for (let i = 0; i < 120 && !(await gen.isEnabled()); i += 1) await page.waitForTimeout(1000);
  await gen.click({ timeout: 5000 });
  for (let i = 0; i < 120; i++) {
    if ((await page.locator(".needs-you").count()) && !(await page.locator(".working-band").count())) break;
    await page.waitForTimeout(1000);
  }
  await page.waitForTimeout(2000);
}

async function shoot(page, sel, name) {
  const el = page.locator(sel).first();
  if (await el.count()) {
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await el.screenshot({ path: path.join(OUT, `${name}.png`) });
  } else {
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  }
}

(async () => {
  gateHeaders(BASE);
  log(`base ${BASE} mode ${MODE} pin ${PIN_ID}`);
  const browser = await chromium.launch();
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: width >= 1440 ? 1000 : 800 }, deviceScaleFactor: 2 });
    await applyGate(ctx, BASE);
    const page = await ctx.newPage();
    try {
      await toConfirmedRoad(page);
      if (MODE === "accuracy") {
        // #284 accuracy: confirm each live kind in turn, each in a fresh
        // page (chip, side, Confirm), and record the backend's answer to
        // the audit that confirmation fires.  A proposal is accurate when
        // the proposed kind is answered and every other kind is refused.
        await page.waitForTimeout(3000);
        const proposed = await page.evaluate(() => {
          const m = document.querySelector('[data-testid="kind-proposed-mark"]');
          const b = m && m.closest("button");
          return b ? b.getAttribute("data-testid") : null;
        });
        const answers = {};
        for (const id of ["kind-chip-shoulder", "kind-chip-flagger_lane_closure", "kind-chip-near_intersection"]) {
          const p = await ctx.newPage();
          const audits = [];
          p.on("response", async (r) => {
            if (/\/api\/render\/audit$/.test(new URL(r.url()).pathname)) {
              const text = await r.text().catch(() => "");
              audits.push({ status: r.status(), text: text.slice(0, 220) });
            }
          });
          try {
            await toConfirmedRoad(p);
            await p.locator(`[data-testid="${id}"]`).click();
            await p.waitForTimeout(2500);
            const side = p.locator('[data-testid="side-option"]').first();
            for (let i = 0; i < 15 && (await side.count()) === 0; i += 1) await p.waitForTimeout(1000);
            if (await side.count()) await side.click();
            await p.waitForTimeout(1500);
            await (await hook(p, "where-confirm")).click().catch(() => {});
            for (let i = 0; i < 30 && audits.length === 0; i += 1) await p.waitForTimeout(500);
            await p.waitForTimeout(1500);
            const last = audits.slice(-1)[0] || null;
            const shown = await p.evaluate(() => (document.body.textContent || "").replace(/\s+/g, " "));
            const refusal = (shown.match(/(This road appears[^.]*\.|This looks like[^.]*\.|divided intersections[^.]*\.|Mark the cross street[^.]*\.)/) || [null])[0];
            answers[id] = last
              ? { status: last.status, text: last.text, refusal }
              : { status: null, text: "no audit fired", refusal };
          } catch (e) {
            answers[id] = { status: null, text: `CRASH ${String(e.message).split("\n")[0]}` };
          }
          await p.close();
        }
        rows.push({ width, proposed, answers });
        log(`${width}: proposed ${proposed}; ${Object.entries(answers).map(([k, v]) => `${k.replace("kind-chip-", "")}=${v.status}${v.status === 200 ? "" : " (" + v.text.replace(/\s+/g, " ").slice(0, 110) + ")"}`).join(" | ")}`);
      } else if (MODE === "chips") {
        await page.waitForTimeout(3000);
        const chips = await page.evaluate(CHIPS);
        rows.push({ width, chips });
        log(`${width}: chips ${JSON.stringify(chips)}`);
        await shoot(page, '[data-testid^="kind-chip-"] >> xpath=..', `${PIN_ID}-chips-${width}`);
        await page.screenshot({ path: path.join(OUT, `${PIN_ID}-chips-${width}-page.png`) });
      } else {
        await toGenerated(page);
        const before = await page.evaluate(NEEDS);
        rows.push({ width, needsYou: before });
        log(`${width}: ${before.length} NEEDS YOU rows: ${JSON.stringify(before.map((r) => [r.text.slice(0, 70), r.buttons]))}`);
        await shoot(page, ".needs-you", `${PIN_ID}-needsyou-${width}`);
        if (MODE === "ack") {
          // Capture what the regenerate after Apply sends and what the
          // audit answers: the payload-level proof (Rule 11).
          const wire = [];
          page.on("request", (rq) => {
            if (/\/api\/render\/audit$/.test(new URL(rq.url()).pathname)) {
              try {
                const s = JSON.parse(rq.postData() || "{}").scenario || {};
                wire.push({ sent: (s.meta || {}).acknowledged ?? null });
              } catch {}
            }
          });
          page.on("response", async (r) => {
            if (/\/api\/render\/audit$/.test(new URL(r.url()).pathname) && r.status() === 200) {
              const j = await r.json().catch(() => ({}));
              wire.push({ audit: j.acknowledged ?? null });
            }
          });
          const ack = page.locator(".needs-you button", { hasText: /^Acknowledge$/i }).first();
          if (await ack.count()) {
            await ack.click();
            await page.waitForTimeout(1500);
            const staged = await page.evaluate(NEEDS);
            rows.push({ width, staged });
            log(`${width}: staged: ${JSON.stringify(staged.map((r) => [r.text.slice(0, 110), r.buttons]))}`);
            await shoot(page, ".needs-you", `${PIN_ID}-staged-${width}`);
            const apply = page.locator(".needs-you button", { hasText: /^Apply .*acknowledgement/i }).first();
            await apply.click();
            for (let i = 0; i < 120; i++) {
              await page.waitForTimeout(1000);
              if (!(await page.locator(".working-band").count()) && !(await page.locator(".results-stale").count())) break;
            }
            await page.waitForTimeout(2500);
            const applied = await page.evaluate(NEEDS);
            rows.push({ width, applied, wire });
            log(`${width}: applied: ${JSON.stringify(applied.map((r) => [r.text.slice(0, 110), r.buttons]))}`);
            log(`${width}: wire: ${JSON.stringify(wire).slice(0, 700)}`);
            await shoot(page, ".needs-you", `${PIN_ID}-acknowledged-${width}`);
          } else {
            log(`${width}: no ACKNOWLEDGE button`);
          }
        }
      }
    } catch (e) {
      log(`${width}: CRASH ${String(e.message).split("\n")[0]}`);
      await page.screenshot({ path: path.join(OUT, `crash-${width}.png`), fullPage: true }).catch(() => {});
    }
    fs.writeFileSync(path.join(OUT, "rows.json"), JSON.stringify(rows, null, 1));
    await ctx.close();
  }
  await browser.close();
})();
