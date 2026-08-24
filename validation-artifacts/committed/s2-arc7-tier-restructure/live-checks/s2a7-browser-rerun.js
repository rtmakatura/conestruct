/** s2-arc7 browser checks — targeted rerun of the two open items.
 *  R1 (was B1-fail): ✓ expand with a settle + one retry — the first run
 *     clicked into a post-generate re-render window.
 *  R2 (was B3-fail): the schedule is SETUP-panel state — set it BEFORE
 *     Generate (post-generate the panel swaps to the strip), then assert
 *     the ⚠ tier auto-opens with the Denver conflict text, no clicks.
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const OUT = path.join(__dirname, "outS2A7");
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
async function settleDialog(page, dlg, pattern, timeoutS = 40) {
  for (let i = 0; i < timeoutS; i++) {
    const t = ((await dlg.textContent().catch(() => "")) ?? "").replace(/\s+/g, " ");
    if (!pattern.test(t)) return t;
    await page.waitForTimeout(1000);
  }
  return "";
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
  }
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
  if (await gen.isDisabled().catch(() => true)) {
    log("generate disabled: " + (await gen.getAttribute("title").catch(() => "?")));
    return false;
  }
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
  await page.waitForTimeout(3000);
  return true;
}
async function zoneText(page) {
  return page.evaluate(() => {
    const z3 = Array.from(document.querySelectorAll("section.zone")).find((z) =>
      (z.querySelector(".zone-tag")?.textContent ?? "").includes("Reference"),
    );
    return z3?.innerText ?? "";
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  // ── R1: control ✓ expand, settled + retried ─────────────────────
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
  assert("R1. control generates", await generateWait(p));
  await p.waitForTimeout(3000); // let post-generate refetches fully settle
  let ok = false;
  for (let attempt = 0; attempt < 8 && !ok; attempt++) {
    const head = p.getByRole("button", { name: /checked & passed/i }).first();
    if ((await head.getAttribute("aria-expanded").catch(() => "false")) !== "true") {
      await head.click().catch(() => {});
      await p.waitForTimeout(1000);
    }
    const t = await zoneText(p);
    // case-insensitive: the chrome renders uppercase via CSS and
    // Chromium innerText reflects text-transform.
    ok = /Taper length calculation/i.test(t) && /Audit PDF/i.test(t);
    if (!ok) await p.waitForTimeout(2000);
  }
  if (!ok) {
    const dump = await p.evaluate(() => {
      const z3 = Array.from(document.querySelectorAll("section.zone")).find((z) =>
        (z.querySelector(".zone-tag")?.textContent ?? "").includes("Reference"));
      const chip = Array.from(z3?.querySelectorAll(".refchip") ?? []).find((c) =>
        (c.querySelector(".label")?.textContent ?? "").includes("Checked"));
      return { cls: chip?.className, body: chip?.innerText?.slice(0, 600) };
    });
    log("R1 DIAG: " + JSON.stringify(dump));
  }
  assert("R1. ✓ expand reveals the trace heads + the Audit PDF download", ok);
  await p.screenshot({ path: path.join(OUT, "R1-control-checked-open.png"), fullPage: true });
  await ctx.close();

  // ── R2: Denver + outside schedule set BEFORE generate ───────────
  const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const q = await ctx2.newPage();
  await q.goto(SITE, { waitUntil: "networkidle" });
  // shoulder default kind is fine — the hours verdict is jurisdiction
  // machinery; Denver + a banned window drives it on any kind.
  await q.getByRole("button", { name: "Pick Location on Map" }).click();
  const dlg2 = q.getByRole("dialog").first();
  await dlg2.waitFor();
  await pickPin(q, dlg2, 39.739776, -104.963483); // Denver pin (E Colfax)
  await saveClose(q, dlg2);
  await q.locator("#jl-jurisdiction").selectOption({ label: "Denver" });
  await q.waitForTimeout(1500);
  // Denver's hours windows are street-class-scoped: without a class the
  // verdict is an honest UNKNOWN (the first run proved exactly that —
  // ◌ held it).  Set Arterial so the eval can fire.
  await q.getByRole("button", { name: "Arterial", exact: true }).first().click();
  await q.waitForTimeout(3000);
  const lw2 = q.getByLabel(/Lane width/).first();
  if (await lw2.isVisible().catch(() => false)) {
    await lw2.focus();
    for (let i = 0; i < 3; i++) await q.keyboard.press("ArrowLeft");
  }
  // Schedule (Setup panel, pre-generate): Single day + date + times.
  const single = q.getByRole("button", { name: /Single day/ }).first();
  assert("R2. schedule mode control present pre-generate", await single.isVisible().catch(() => false));
  await single.click();
  await q.waitForTimeout(600);
  const dateInput = q.locator('input[type="date"]').first();
  if (await dateInput.isVisible().catch(() => false)) await dateInput.fill("2026-08-26");
  const times = q.locator('input[type="time"]');
  const nTimes = await times.count();
  if (nTimes >= 2) {
    await times.nth(0).fill("06:00");
    await times.nth(1).fill("08:00");
    log("R2. schedule set: 2026-08-26 06:00–08:00 via time inputs");
  } else {
    // fall back: number/select-based time entry — log the inventory.
    const info = await q.evaluate(() => {
      const panel = document.querySelector(".setup-panel");
      return Array.from(panel?.querySelectorAll("input,select") ?? [])
        .map((e) => `${e.tagName}:${e.type ?? ""}:${e.id || e.name || ""}`)
        .join(" | ");
    });
    log("R2. no time inputs; controls: " + info.slice(0, 400));
    const selects = q.locator(".setup-panel select");
    const n = await selects.count();
    // try the last two selects as start/end hour pickers
    if (n >= 2) {
      await selects.nth(n - 2).selectOption({ label: "6:00 AM" }).catch(() => log("R2 start select failed"));
      await selects.nth(n - 1).selectOption({ label: "8:00 AM" }).catch(() => log("R2 end select failed"));
    }
  }
  await q.waitForTimeout(3000);
  // Pre-generate, the verdict should already ride the tiers (the strip
  // audit is live per input) — but assert post-generate for the scoped
  // check.
  assert("R2. generates with the schedule set", await generateWait(q));
  // The schedule-driven jurisdiction refetch settles after the
  // generate: poll until the (refreshing...) cue clears and the
  // conflict text lands (or 25 s).
  // up to 90 s: a Modal cold start ("waking the verification
  // server") outlasted the first poll; the tiers held the stale answer
  // under the (refreshing…) cue, which is the sanctioned presentation.
  for (let i = 0; i < 90; i++) {
    const t = await zoneText(q);
    if (/Schedule conflicts with|overlaps the|falls outside the permitted/.test(t)) break;
    await q.waitForTimeout(1000);
  }
  const st = await q.evaluate(() => {
    const z3 = Array.from(document.querySelectorAll("section.zone")).find((z) =>
      (z.querySelector(".zone-tag")?.textContent ?? "").includes("Reference"),
    );
    const chip = Array.from(z3?.querySelectorAll(".refchip") ?? []).find((c) =>
      (c.querySelector(".label")?.textContent ?? "").includes("Needs attention"),
    );
    return {
      open: chip?.classList.contains("open") ?? false,
      text: z3?.innerText ?? "",
      ledger: z3?.querySelector(".tier-ledger")?.textContent ?? "",
    };
  });
  assert(
    "R2. hours-outside: ⚠ auto-open with the Denver conflict text, no clicks",
    st.open && /Schedule conflicts with|overlaps the|falls outside the permitted/.test(st.text),
    `open=${st.open} · ledger=${st.ledger}`,
  );
  await q.screenshot({ path: path.join(OUT, "R2-hours-outside.png"), fullPage: true });
  await ctx2.close();

  fs.appendFileSync(path.join(OUT, "s2a7-browser-raw.md"), lines.join("\n") + "\n");
  await browser.close();
  console.log(`DONE — failures: ${failures}`);
  process.exit(failures ? 1 : 0);
})();
