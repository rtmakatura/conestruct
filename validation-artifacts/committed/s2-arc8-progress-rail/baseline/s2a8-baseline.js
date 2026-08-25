/**
 * s2-arc8 baseline (Refs #221/#222) — READ-ONLY against production at
 * 0fa328e.  Step 2 of the investigate-first prompt:
 *  P1  pre-pin census per enabled kind: full-render stall (S1) re-confirmed,
 *      step-order inversion recorded, per-kind cost material for Q2.
 *  P2  NI at Race∩Colfax: the S4 blocker↔CTA separation MEASURED at HEAD;
 *      the multi-blocker case (hold ⚠ + schedule ◌ + invalid input) with
 *      the invisible-queue proof (rank chain shows ONE reason at a time).
 * No saves, no DB writes; the "Lane count is right" click and the workLen
 * edit mutate client state only.
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "outS2A8");
fs.mkdirSync(OUT, { recursive: true });
const SITE = "https://www.conestruct.com/sandbox";

const lines = [];
function log(msg) {
  const stamp = new Date().toISOString();
  lines.push(`- \`${stamp}\` ${msg}`);
  console.log(`${stamp} ${msg}`);
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

// DOM-ordered section headers (label + STEP tag) inside the setup panel,
// plus enabled-control counts and the CTA state.
async function panelState(page) {
  return page.evaluate(() => {
    const p = document.querySelector(".setup-panel");
    if (!p) return null;
    // FieldGroup header rows: a row whose children are exactly the label
    // span + the STEP/OPTIONAL tag span (font-mono uppercase).  The
    // ScenarioPicker header shares the same structure.
    const headers = Array.from(p.querySelectorAll("div,summary"))
      .map((e) => {
        const kids = Array.from(e.children);
        if (kids.length !== 2) return null;
        const tag = kids[1].textContent ?? "";
        if (!/^(STEP \d|OPTIONAL$)/.test(tag)) return null;
        return {
          label: kids[0].textContent ?? "",
          tag,
          top: Math.round(e.getBoundingClientRect().top + window.scrollY),
        };
      })
      .filter(Boolean);
    const ctrls = Array.from(p.querySelectorAll("input,select,button"));
    const genBtn = ctrls.find((b) => /Generate plan/.test(b.textContent ?? ""));
    const reason = p.querySelector('[role="alert"]');
    return {
      headersInDomOrder: headers,
      interactive: ctrls.filter((c) => !c.disabled).length,
      inputs: p.querySelectorAll("input").length,
      selects: p.querySelectorAll("select").length,
      buttons: p.querySelectorAll("button").length,
      panelHeightPx: Math.round(p.getBoundingClientRect().height),
      generateDisabled: genBtn ? genBtn.disabled : null,
      ctaReason: reason ? reason.textContent : null,
      alerts: Array.from(p.querySelectorAll('[role="alert"]')).map((a) => ({
        text: (a.textContent ?? "").slice(0, 160),
        top: Math.round(a.getBoundingClientRect().top + window.scrollY),
      })),
      statusStrip:
        document.querySelector(".status-bar")?.textContent?.trim() ?? null,
    };
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  // ── P1: pre-pin census per enabled kind ─────────────────────────
  const KINDS = [
    ["shoulder", null], // default on load
    ["flagger", "Flagger"],
    ["near_intersection", "near intersection"],
  ];
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const p = await ctx.newPage();
  await p.goto(SITE, { waitUntil: "networkidle" });
  for (const [key, click] of KINDS) {
    if (click) {
      await p.locator(".setup-panel button", { hasText: new RegExp(click, "i") }).first().click();
      await p.waitForTimeout(1200);
    }
    const st = await panelState(p);
    log(`P1 ${key} pre-pin: ${JSON.stringify(st)}`);
    if (key === "near_intersection") await shot(p, "P1-ni-prepin.png");
  }
  await ctx.close();

  // ── P2: NI at Race∩Colfax — S4 + multi-blocker ──────────────────
  const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx2.newPage();
  await page.goto(SITE, { waitUntil: "networkidle" });
  await page.locator(".setup-panel button", { hasText: /near intersection/i }).first().click();
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Pick Location on Map" }).click();
  const dlg = page.getByRole("dialog").first();
  await dlg.waitFor();
  const toggle = page.getByText(/enter coordinates manually/i);
  if (await toggle.isVisible().catch(() => false)) await toggle.click();
  await page.getByLabel("Latitude").fill("39.739776");
  await page.getByLabel("Longitude").fill("-104.963483");
  await settleDialog(page, dlg, /Detecting roads at pin|Classifying road/i);
  const colfax = page.locator("button", { hasText: /Colfax/ }).first();
  if (await colfax.isVisible().catch(() => false)) {
    await colfax.click();
    await page.waitForTimeout(1200);
  } else log("P2 WARN: no Colfax candidate");

  // Mark the intersection (arc11 calibration, reused verbatim).
  const markerLookups = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && /road-bearing/.test(r.url())) {
      try { markerLookups.push(JSON.parse(r.postData() ?? "{}")); } catch {}
    }
  });
  const rc = dlg.getByRole("button", { name: "Recenter" });
  if (await rc.isVisible().catch(() => false)) await rc.click();
  await page.waitForTimeout(3500);
  await dlg.getByRole("button", { name: "Mark the intersection on the map" }).click();
  await page.waitForTimeout(300);
  const canvas = dlg.locator("canvas").first();
  const box = await canvas.boundingBox();
  const TARGET = { lat: 39.739776, lng: -104.963483 };
  const cx = box.width / 2, cy = box.height / 2;
  const armedClick = async (x, y) => {
    const rearm = dlg.getByRole("button", { name: "Move the intersection pin" });
    if (await rearm.isVisible().catch(() => false)) {
      await rearm.click();
      await page.waitForTimeout(300);
    }
    markerLookups.length = 0;
    await canvas.click({ position: { x, y }, force: true });
    await page.waitForTimeout(1500);
    const g = markerLookups[0];
    const tt = await settleDialog(page, dlg, /Looking up the cross street|Detecting/i);
    return { g, t: tt };
  };
  let crossSummary = "";
  const r0 = await armedClick(cx, cy);
  const r1 = await armedClick(cx + 40, cy);
  if (r0.g && r1.g) {
    const degPerPxLng = (r1.g.lng - r0.g.lng) / 40;
    const degPerPxLat = degPerPxLng * Math.cos((39.74 * Math.PI) / 180);
    const dx = (TARGET.lng - r0.g.lng) / degPerPxLng;
    const dy = -(TARGET.lat - r0.g.lat) / degPerPxLat;
    const r2 = await armedClick(cx + dx, cy + dy);
    const i0 = r2.t.indexOf("Cross street");
    crossSummary = r2.t.slice(i0, i0 + 260);
  }
  log(`P2 cross-street mark: ${crossSummary || "NOT DETECTED"}`);
  const save = dlg.getByRole("button", { name: "Save & Close" });
  for (let i = 0; i < 30 && !(await save.isEnabled().catch(() => false)); i++)
    await page.waitForTimeout(1000);
  await save.click();
  await page.waitForTimeout(2500);

  // Work zone clear of the crossing; both legs; signalized stays as
  // detected (signal detected at this pin).
  await page.getByLabel("Work zone length (ft)").first().fill("700");
  await page.waitForTimeout(800);
  const both = page.getByRole("button", { name: "Both", exact: true }).first();
  if (await both.isVisible().catch(() => false)) await both.click();
  await page.waitForTimeout(2000);

  // ── The multi-blocker before-state ──────────────────────────────
  const st1 = await panelState(page);
  log(`P2 multi-blocker state (hold pending + schedule unset): ${JSON.stringify(st1)}`);
  // S4: separation between the hold row (the alert inside Cross street)
  // and the CTA's reason line (the alert under Generate).
  const sep = await page.evaluate(() => {
    const p = document.querySelector(".setup-panel");
    const alerts = Array.from(p.querySelectorAll('[role="alert"]'));
    const hold = alerts.find((a) => /lane count|turn pocket|per-direction/i.test(a.textContent ?? ""));
    const cta = alerts.find((a) => /Confirm the cross-street/i.test(a.textContent ?? ""));
    if (!hold || !cta) return { hold: !!hold, cta: !!cta };
    return {
      holdTop: Math.round(hold.getBoundingClientRect().top + window.scrollY),
      ctaTop: Math.round(cta.getBoundingClientRect().top + window.scrollY),
      separationPx: Math.round(
        cta.getBoundingClientRect().top - hold.getBoundingClientRect().bottom,
      ),
      panelHeight: Math.round(p.getBoundingClientRect().height),
    };
  });
  log(`P2 S4 separation (hold row ↔ CTA reason): ${JSON.stringify(sep)}`);
  // Schedule state (unset ◌?)
  const schedTxt = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll(".setup-panel button"));
    const notSet = rows.find((b) => b.textContent === "Not set");
    return notSet ? { present: true, ariaOrClass: notSet.className.slice(0, 80) } : { present: false };
  });
  log(`P2 schedule "Not set" chip: ${JSON.stringify(schedTxt)}`);
  await shot(page, "P2-multidispute-before.png");

  // ── Invisible-queue proof: add an invalid input on top of the hold ──
  await page.getByLabel("Work zone length (ft)").first().fill("0");
  await page.locator("body").click(); // blur
  await page.waitForTimeout(1500);
  const st2 = await panelState(page);
  log(`P2 queue proof — wz=0 WITH hold still pending: ctaReason="${st2?.ctaReason}" alerts=${JSON.stringify(st2?.alerts)}`);
  await shot(page, "P2-queue-wz0.png");
  await page.getByLabel("Work zone length (ft)").first().fill("700");
  await page.waitForTimeout(1500);

  // ── Resolve the hold; observe the next state in the chain ───────
  const holdBtn = page.getByRole("button", { name: "Lane count is right" });
  if (await holdBtn.isVisible().catch(() => false)) {
    await holdBtn.click();
    await page.waitForTimeout(2500);
  }
  const st3 = await panelState(page);
  log(`P2 after hold confirm: generateDisabled=${st3?.generateDisabled} ctaReason="${st3?.ctaReason}" strip="${st3?.statusStrip}"`);
  await shot(page, "P2-after-confirm.png");

  fs.writeFileSync(path.join(OUT, "s2a8-baseline-raw.md"), lines.join("\n") + "\n");
  await browser.close();
  console.log("DONE");
})();
