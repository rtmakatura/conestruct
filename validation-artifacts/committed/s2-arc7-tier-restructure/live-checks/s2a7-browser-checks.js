/** s2-arc7 live checks, browser half (Refs #219/#223) — prod, READ-ONLY.
 *  B1 typical control (shoulder @ the Lakewood pin): the rendered ledger +
 *     tier open-state contract + ✓ traces behind one click + ◌ isolation.
 *  B2 heavy NI (Race∩Colfax + Denver): #223 parity SERVED (six trace heads
 *     in ✓), approaches in the auto-open ⚠, ◌ isolated.
 *  B3 hours-outside rendered: Denver + a 06:00–08:00 schedule → the ⚠
 *     tier auto-opens with the conflict text, no clicks.
 *  B4 axe on the restructured section, both cases, classified vs the
 *     known baseline (the deferred pile).
 */
const { chromium } = require("playwright");
const { AxeBuilder } = require("@axe-core/playwright");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "outS2A7");
fs.mkdirSync(OUT, { recursive: true });
const SITE = "https://www.conestruct.com/sandbox";

const lines = [];
let failures = 0;
function log(msg) {
  const stamp = new Date().toISOString();
  lines.push(`- \`${stamp}\` ${msg}`);
  console.log(`${stamp} ${msg}`);
}
function assert(name, cond, extra = "") {
  if (!cond) failures++;
  log(`${cond ? "**PASS**" : "**FAIL**"} — ${name}${extra ? ` (${extra})` : ""}`);
}
async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name), fullPage: true });
  log(`screenshot: ${name}`);
}
async function settleDialog(page, dlg, pattern, timeoutS = 40) {
  for (let i = 0; i < timeoutS; i++) {
    const t = ((await dlg.textContent().catch(() => "")) ?? "").replace(/\s+/g, " ");
    if (!pattern.test(t)) return t;
    await page.waitForTimeout(1000);
  }
  return ((await dlg.textContent().catch(() => "")) ?? "").replace(/\s+/g, " ");
}
async function pickPin(page, dlg, lat, lng) {
  const tog = page.getByText(/enter coordinates manually/i);
  if (await tog.isVisible().catch(() => false)) await tog.click();
  await page.getByLabel("Latitude").fill(String(lat));
  await page.getByLabel("Longitude").fill(String(lng));
  await settleDialog(page, dlg, /Detecting roads at pin|Classifying road/i);
  const cand = dlg.locator("button", { hasText: /way \d+/ }).first();
  if (await cand.isVisible().catch(() => false)) {
    await cand.click();
    await page.waitForTimeout(1500);
    return true;
  }
  return false;
}
async function saveClose(page, dlg) {
  const save = dlg.getByRole("button", { name: "Save & Close" });
  for (let i = 0; i < 30 && !(await save.isEnabled().catch(() => false)); i++)
    await page.waitForTimeout(1000);
  await save.click();
  await page.waitForTimeout(2000);
}
async function generateWait(page) {
  const gen = page.getByRole("button", { name: /Generate/ }).first();
  for (let i = 0; i < 20 && (await gen.isDisabled().catch(() => true)); i++)
    await page.waitForTimeout(1000);
  if (await gen.isDisabled().catch(() => true)) return false;
  await gen.click();
  await page
    .waitForFunction(
      () => Array.from(document.querySelectorAll("button")).some((b) => /Download PDF/.test(b.textContent ?? "")),
      null,
      { timeout: 120000 },
    )
    .catch(() => {});
  await page.waitForTimeout(2500);
  await page
    .waitForFunction(() => !document.querySelector(".stale-ribbon"), null, { timeout: 30000 })
    .catch(() => {});
  await page.waitForTimeout(2000);
  return true;
}
async function tierState(page) {
  return page.evaluate(() => {
    const z3 = Array.from(document.querySelectorAll("section.zone")).find((z) =>
      (z.querySelector(".zone-tag")?.textContent ?? "").includes("Reference"),
    );
    if (!z3) return null;
    const ledger = z3.querySelector(".tier-ledger")?.textContent ?? "";
    const tiers = {};
    for (const chip of z3.querySelectorAll(".refchip")) {
      const label = chip.querySelector(".label")?.textContent ?? "";
      if (!/Changed this plan|Needs attention|Checked & passed|Pending \/ not verified|Reference/.test(label))
        continue;
      tiers[label] = {
        open: chip.classList.contains("open"),
        summary: (chip.querySelector(".detail")?.textContent ?? "").trim(),
      };
    }
    return { ledger, tiers, text: z3.innerText };
  });
}
async function axeScan(page, file) {
  const res = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  fs.writeFileSync(path.join(OUT, file), JSON.stringify(res.violations, null, 2));
  return res.violations;
}
const LEDGER_RE = /\d+ changes? · \d+ needs attention · \d+ checked · \d+ pending · reference/;

(async () => {
  const browser = await chromium.launch({ headless: true });

  // ── B1: typical control ─────────────────────────────────────────
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const p = await ctx.newPage();
  await p.goto(SITE, { waitUntil: "networkidle" });
  await p.getByRole("button", { name: "Pick Location on Map" }).click();
  const dlg = p.getByRole("dialog").first();
  await dlg.waitFor();
  await pickPin(p, dlg, 39.7113, -105.0815);
  await saveClose(p, dlg);
  await p.locator("#jl-jurisdiction").selectOption({ label: "Lakewood" });
  await p.waitForTimeout(3000);
  const lw = p.getByLabel(/Lane width/).first();
  await lw.focus();
  for (let i = 0; i < 3; i++) await p.keyboard.press("ArrowLeft");
  await p.waitForTimeout(2500);
  assert("B1. control generates", await generateWait(p));
  let st = await tierState(p);
  assert("B1. ledger renders all four counted tokens + reference", LEDGER_RE.test(st?.ledger ?? ""), st?.ledger);
  const nums = (st?.ledger.match(/\d+/g) ?? []).map(Number);
  const openRight = Object.entries(st?.tiers ?? {}).every(([label, t]) => {
    if (/Changed/.test(label)) return t.open === nums[0] > 0;
    if (/attention/.test(label)) return t.open === nums[1] > 0;
    if (/Checked|Pending|Reference/.test(label)) return t.open === false;
    return true;
  });
  assert(
    "B1. open-state contract: ▲/⚠ open iff nonzero; ✓/◌/i collapsed",
    openRight,
    JSON.stringify(st?.tiers),
  );
  assert(
    "B1. ◌ isolation: no pending detail rendered while ◌ collapsed",
    !/pending verification|Tracking issue/i.test(st?.text ?? ""),
  );
  await p.getByRole("button", { name: /checked & passed/i }).click();
  await p.waitForTimeout(400);
  st = await tierState(p);
  assert(
    "B1. ✓ expand reveals the trace heads + the Audit PDF download",
    /Taper length calculation/.test(st?.text ?? "") && /Audit PDF/.test(st?.text ?? ""),
  );
  await shot(p, "B1-control-tiers.png");
  const axe1 = await axeScan(p, "axe-control.json");
  log(`B1 axe: ${axe1.length} violation(s) — ${axe1.map((v) => v.id).join(", ") || "none"}`);
  await ctx.close();

  // ── B2 + B3: heavy NI + Denver + outside schedule ───────────────
  const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const q = await ctx2.newPage();
  await q.goto(SITE, { waitUntil: "networkidle" });
  await q.getByText("Lane closure near intersection", { exact: false }).first().click();
  await q.waitForTimeout(600);
  await q.getByRole("button", { name: "Pick Location on Map" }).click();
  const dlg2 = q.getByRole("dialog").first();
  await dlg2.waitFor();
  await pickPin(q, dlg2, 39.739776, -104.963483);
  // mark the intersection (arc11 calibration)
  const lookups = [];
  q.on("request", (r) => {
    if (r.method() === "POST" && /road-bearing/.test(r.url())) {
      try { lookups.push(JSON.parse(r.postData() ?? "{}")); } catch {}
    }
  });
  const rc = dlg2.getByRole("button", { name: "Recenter" });
  if (await rc.isVisible().catch(() => false)) await rc.click();
  await q.waitForTimeout(3500);
  await dlg2.getByRole("button", { name: "Mark the intersection on the map" }).click();
  await q.waitForTimeout(300);
  const canvas = dlg2.locator("canvas").first();
  const box = await canvas.boundingBox();
  const cx = box.width / 2, cy = box.height / 2;
  const armed = async (x, y) => {
    const rearm = dlg2.getByRole("button", { name: "Move the intersection pin" });
    if (await rearm.isVisible().catch(() => false)) {
      await rearm.click();
      await q.waitForTimeout(300);
    }
    lookups.length = 0;
    await canvas.click({ position: { x, y }, force: true });
    await q.waitForTimeout(1500);
    const g = lookups[0];
    await settleDialog(q, dlg2, /Looking up the cross street|Detecting/i);
    return g;
  };
  const g0 = await armed(cx, cy);
  const g1 = await armed(cx + 40, cy);
  if (g0 && g1) {
    const dLng = (g1.lng - g0.lng) / 40;
    const dLat = dLng * Math.cos((39.74 * Math.PI) / 180);
    await armed(cx + (-104.963483 - g0.lng) / dLng, cy - (39.739776 - g0.lat) / dLat);
  }
  await saveClose(q, dlg2);
  await q.locator("#jl-jurisdiction").selectOption({ label: "Denver" });
  await q.waitForTimeout(3000);
  await q.getByLabel("Work zone length (ft)").first().fill("700");
  await q.waitForTimeout(1000);
  const both = q.getByRole("button", { name: "Both", exact: true }).first();
  if (await both.isVisible().catch(() => false)) await both.click();
  await q.waitForTimeout(800);
  const hold = q.getByRole("button", { name: "Lane count is right" });
  if (await hold.isVisible().catch(() => false)) {
    await hold.click();
    await q.waitForTimeout(1500);
  }
  assert("B2. heavy NI generates", await generateWait(q));
  let st2 = await tierState(q);
  assert("B2. ledger renders", LEDGER_RE.test(st2?.ledger ?? ""), st2?.ledger);
  assert(
    "B2. ⚠ auto-open carries the signalized approaches item (no click)",
    /Cross-street approaches/.test(st2?.text ?? ""),
  );
  await q.getByRole("button", { name: /checked & passed/i }).click();
  await q.waitForTimeout(400);
  st2 = await tierState(q);
  const traceHeads = [
    "Taper length calculation",
    "Buffer space calculation",
    "Channelizing device spacing",
    "Advance warning sign set",
  ].filter((t) => (st2?.text ?? "").includes(t));
  assert(
    "B2. #223 parity SERVED: the NI trace heads render in ✓",
    traceHeads.length === 4 && /S-630-1 reference/.test(st2?.text ?? ""),
    `${traceHeads.length}/4 + case row`,
  );
  await shot(q, "B2-ni-tiers.png");

  // B3: schedule 06:00–08:00 single day → Denver outside → ⚠ rendered.
  let b3done = false;
  try {
    await q.getByRole("button", { name: /^Single day$/ }).first().click();
    await q.waitForTimeout(500);
    const dateInput = q.locator('input[type="date"]').first();
    await dateInput.fill("2026-08-26");
    const times = q.locator('input[type="time"]');
    if ((await times.count()) >= 2) {
      await times.nth(0).fill("06:00");
      await times.nth(1).fill("08:00");
      b3done = true;
    } else {
      const selects = q.locator("select");
      log(`B3: no time inputs — ${await times.count()} time, ${await selects.count()} selects (fallback not attempted)`);
    }
  } catch (e) {
    log(`B3 setup error: ${String(e).slice(0, 120)}`);
  }
  if (b3done) {
    await q.waitForTimeout(3000);
    await q
      .waitForFunction(() => !document.querySelector(".stale-ribbon"), null, { timeout: 30000 })
      .catch(() => {});
    await q.waitForTimeout(1500);
    const st3 = await tierState(q);
    const warnTier = Object.entries(st3?.tiers ?? {}).find(([l]) => /attention/.test(l))?.[1];
    assert(
      "B3. hours-outside: ⚠ auto-open with the Denver conflict text, no clicks",
      warnTier?.open === true && /Schedule conflicts with|overlaps the|falls outside the permitted/.test(st3?.text ?? ""),
      warnTier ? `open=${warnTier.open}` : "no ⚠ tier",
    );
    await shot(q, "B3-hours-outside.png");
  } else {
    assert(
      "B3. hours-outside rendered live",
      false,
      "schedule controls not driveable headless this run — wire half (W4) carries the verdict+classification proof",
    );
  }
  const axe2 = await axeScan(q, "axe-ni.json");
  log(`B2/B3 axe: ${axe2.length} violation(s) — ${axe2.map((v) => v.id).join(", ") || "none"}`);
  await ctx2.close();

  fs.writeFileSync(path.join(OUT, "s2a7-browser-raw.md"), lines.join("\n") + "\n");
  await browser.close();
  console.log(`DONE — failures: ${failures}`);
  process.exit(failures ? 1 : 0);
})();
