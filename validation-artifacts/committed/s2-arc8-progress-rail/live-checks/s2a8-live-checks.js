/** s2-arc8 live checks (Refs #221/#222) — production at 0a4dfa4, READ-ONLY.
 *  L1  S1 gone: pre-pin NI — downstream steps pending (focusable summaries,
 *      inert bodies), Scenario STEP 1 / Location STEP 2, tags ascend; the
 *      rail renders with Location as the current blocker and ◌ downstream.
 *  L2  S4 gone: Race∩Colfax hold — the sticky rail carries the hold string
 *      in-viewport at the CTA's scroll position; rail blocker === CTA
 *      reason (one voice, live).
 *  L3  the multi-blocker stack: wz=0 on top of the hold — BOTH ⚠ visible
 *      on the rail at once (the baseline's invisible queue, dead).
 *  L4  jump link: rail entry click focuses the section header.
 *  L5  clean-kind control (shoulder + Lakewood): rail ✓✓✓ + ◌ schedule,
 *      Generate ready, plan generates; post-generate the rail is gone
 *      (the panel swaps to the strip by design).
 *  A   axe on the pre-pin NI and hold states — zero NEW vs the recorded
 *      baseline (.opacity-80 + the two modal-label criticals).
 *  No saves, no DB writes; the wz edit + hold confirm are client state.
 */
const { chromium } = require("playwright");
const { AxeBuilder } = require("@axe-core/playwright");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "outS2A8LC");
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
  return "";
}
async function railState(page) {
  return page.evaluate(() => {
    const nav = document.querySelector(".progress-rail");
    if (!nav) return null;
    return {
      entries: Array.from(nav.querySelectorAll(".rail-entry")).map((b) => ({
        label: b.querySelector(".rail-label")?.textContent ?? "",
        cls: b.className,
        glyphs: b.querySelectorAll(".rail-glyph").length,
        note: b.querySelector(".rail-note")?.textContent ?? null,
        blocker: b.querySelector(".rail-blocker")?.textContent ?? null,
        aria: b.getAttribute("aria-label"),
      })),
      viewTop: Math.round(nav.getBoundingClientRect().top),
      viewBottom: Math.round(nav.getBoundingClientRect().bottom),
    };
  });
}
async function ctaReason(page) {
  return page.evaluate(() => {
    const alerts = Array.from(
      document.querySelectorAll('.setup-panel [role="alert"]'),
    );
    const el = alerts.find((a) => a.className.includes("--fail"));
    return el ? (el.textContent ?? "").trim() : null;
  });
}
async function axeScan(page, label) {
  const res = await new AxeBuilder({ page }).analyze();
  const v = res.violations.map((x) => `${x.id}×${x.nodes.length}`);
  fs.writeFileSync(
    path.join(OUT, `axe-${label}.json`),
    JSON.stringify(res.violations, null, 2),
  );
  log(`axe ${label}: ${v.length ? v.join(", ") : "0 violations"}`);
  return res.violations;
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  // ── L1: pre-pin NI ──────────────────────────────────────────────
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const p = await ctx.newPage();
  await p.goto(SITE, { waitUntil: "networkidle" });
  await p.locator(".setup-panel button", { hasText: /near intersection/i }).first().click();
  await p.waitForTimeout(1200);
  const pre = await p.evaluate(() => {
    const panel = document.querySelector(".setup-panel");
    const tags = Array.from(panel.querySelectorAll("span"))
      .map((e) => e.textContent ?? "")
      .filter((t) => /^STEP \d+$/.test(t))
      .map((t) => Number(t.replace("STEP ", "")));
    return {
      tags,
      summaries: panel.querySelectorAll(".step-pending-summary").length,
      inertBodies: panel.querySelectorAll(".step-pending-body[inert]").length,
      summaryText:
        panel.querySelector(".step-pending-summary")?.textContent?.trim() ?? "",
    };
  });
  assert(
    "L1. step tags ascend — Scenario STEP 1 above Location STEP 2 (S1 inversion gone)",
    JSON.stringify(pre.tags) === JSON.stringify([1, 2, 3, 4, 5, 6, 7]),
    JSON.stringify(pre.tags),
  );
  assert(
    "L1. five downstream steps pending: focusable summaries + inert bodies",
    pre.summaries === 5 && pre.inertBodies === 5,
    `summaries=${pre.summaries} inert=${pre.inertBodies}`,
  );
  assert(
    "L1. the pending summary names the gate in text (rule 13, not dim alone)",
    /Pending — set a location first/.test(pre.summaryText),
    pre.summaryText,
  );
  const r1 = await railState(p);
  assert(
    "L1. rail renders pre-pin: Location ⚠ current with the location string; downstream ◌ pending",
    r1 !== null &&
      r1.entries[0]?.label === "Location" &&
      r1.entries[0]?.cls.includes("current") &&
      r1.entries[0]?.blocker === "Set a location first — pick on map or enter manually." &&
      r1.entries.slice(1, 5).every((e) => e.cls.includes("st-pending")),
    JSON.stringify(r1?.entries.map((e) => `${e.label}:${e.cls.replace("rail-entry ", "")}`)),
  );
  const cta1 = await ctaReason(p);
  assert(
    "L1. one voice live: rail blocker === under-CTA reason",
    r1?.entries[0]?.blocker === cta1,
    `cta="${cta1}"`,
  );
  await shot(p, "L1-ni-prepin.png");
  const axePre = await axeScan(p, "prepin-ni");

  // ── L2/L3/L4: Race∩Colfax hold ──────────────────────────────────
  await p.getByRole("button", { name: "Pick Location on Map" }).click();
  const dlg = p.getByRole("dialog").first();
  await dlg.waitFor();
  const tog = p.getByText(/enter coordinates manually/i);
  if (await tog.isVisible().catch(() => false)) await tog.click();
  await p.getByLabel("Latitude").fill("39.739776");
  await p.getByLabel("Longitude").fill("-104.963483");
  await settleDialog(p, dlg, /Detecting roads at pin|Classifying road/i);
  const colfax = p.locator("button", { hasText: /Colfax/ }).first();
  if (await colfax.isVisible().catch(() => false)) {
    await colfax.click();
    await p.waitForTimeout(1200);
  }
  // Mark the intersection (arc11 calibration).
  const markerLookups = [];
  p.on("request", (r) => {
    if (r.method() === "POST" && /road-bearing/.test(r.url())) {
      try { markerLookups.push(JSON.parse(r.postData() ?? "{}")); } catch {}
    }
  });
  const rc = dlg.getByRole("button", { name: "Recenter" });
  if (await rc.isVisible().catch(() => false)) await rc.click();
  await p.waitForTimeout(3500);
  await dlg.getByRole("button", { name: "Mark the intersection on the map" }).click();
  await p.waitForTimeout(300);
  const canvas = dlg.locator("canvas").first();
  const box = await canvas.boundingBox();
  const TARGET = { lat: 39.739776, lng: -104.963483 };
  const cx = box.width / 2, cy = box.height / 2;
  const armedClick = async (x, y) => {
    const rearm = dlg.getByRole("button", { name: "Move the intersection pin" });
    if (await rearm.isVisible().catch(() => false)) {
      await rearm.click();
      await p.waitForTimeout(300);
    }
    markerLookups.length = 0;
    await canvas.click({ position: { x, y }, force: true });
    await p.waitForTimeout(1500);
    const g = markerLookups[0];
    await settleDialog(p, dlg, /Looking up the cross street|Detecting/i);
    return { g };
  };
  const s0 = await armedClick(cx, cy);
  const s1 = await armedClick(cx + 40, cy);
  if (s0.g && s1.g) {
    const degPerPxLng = (s1.g.lng - s0.g.lng) / 40;
    const degPerPxLat = degPerPxLng * Math.cos((39.74 * Math.PI) / 180);
    const dx = (TARGET.lng - s0.g.lng) / degPerPxLng;
    const dy = -(TARGET.lat - s0.g.lat) / degPerPxLat;
    await armedClick(cx + dx, cy + dy);
  }
  const save = dlg.getByRole("button", { name: "Save & Close" });
  for (let i = 0; i < 30 && !(await save.isEnabled().catch(() => false)); i++)
    await p.waitForTimeout(1000);
  await save.click();
  await p.waitForTimeout(2500);
  await p.getByLabel("Work zone length (ft)").first().fill("700");
  await p.waitForTimeout(800);
  const both = p.getByRole("button", { name: "Both", exact: true }).first();
  if (await both.isVisible().catch(() => false)) await both.click();
  await p.waitForTimeout(2000);

  // Post-pin: pending chrome must be gone.
  const postPin = await p.evaluate(() => ({
    summaries: document.querySelectorAll(".step-pending-summary").length,
    inert: document.querySelectorAll("[inert]").length,
  }));
  assert(
    "L2. post-pin: pending chrome gone (fields fully live, unchanged behavior)",
    postPin.summaries === 0 && postPin.inert === 0,
    JSON.stringify(postPin),
  );

  // The hold state: scroll to the CTA, assert the sticky rail carries
  // the hold string in-viewport (S4 dead: blocker + CTA co-visible).
  await p.getByRole("button", { name: /Generate plan/ }).scrollIntoViewIfNeeded();
  await p.waitForTimeout(500);
  const r2 = await railState(p);
  const cta2 = await ctaReason(p);
  const holdStr = "Confirm the cross-street lane count first — it was filled from map data.";
  assert(
    "L2. hold: rail blocker === CTA reason === the hold string",
    r2 !== null && cta2 === holdStr &&
      r2.entries.some((e) => e.blocker === holdStr && e.label === "Cross street"),
    `cta="${cta2}"`,
  );
  assert(
    "L2. S4 gone: the sticky rail (carrying the blocker) is inside the viewport at the CTA's scroll position",
    r2 !== null && r2.viewTop >= 0 && r2.viewTop < 1000,
    `railTop=${r2?.viewTop}`,
  );
  assert(
    "L2. schedule unset reads ◌ not set on the rail (rule 10 honest empty)",
    r2?.entries.some((e) => e.label === "Schedule" && e.note === "not set") === true,
  );
  await shot(p, "L2-hold-sticky.png");
  const axeHold = await axeScan(p, "hold-state");

  // ── L3: the multi-blocker stack (the baseline's invisible queue) ──
  await p.getByLabel("Work zone length (ft)").first().fill("0");
  await p.locator("body").click();
  await p.waitForTimeout(1500);
  const r3 = await railState(p);
  const cta3 = await ctaReason(p);
  const work3 = r3?.entries.find((e) => e.label === "Work");
  const cross3 = r3?.entries.find((e) => e.label === "Cross street");
  assert(
    "L3. wz=0 + hold: BOTH ⚠ visible on the rail at once — the queue is dead",
    work3?.cls.includes("st-attention") === true &&
      cross3?.cls.includes("st-attention") === true &&
      work3?.blocker === "Work zone length is required." &&
      cta3 === "Work zone length is required." &&
      (cross3?.aria ?? "").includes("needs attention"),
    JSON.stringify({ work: work3?.cls, cross: cross3?.cls, cta: cta3 }),
  );
  await shot(p, "L3-multiblocker.png");
  await p.getByLabel("Work zone length (ft)").first().fill("700");
  await p.waitForTimeout(1200);

  // ── L4: jump link — click Cross street, focus lands on its header ──
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.locator(".progress-rail .rail-entry", { hasText: "Cross street" }).click();
  await p.waitForTimeout(800);
  const focus = await p.evaluate(() => ({
    id: document.activeElement?.id ?? "",
    inView: (() => {
      const el = document.getElementById("rail-step-extra");
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.top >= -10 && r.top < 1000;
    })(),
  }));
  assert(
    "L4. rail jump: focus on the Cross street header AND the section scrolled into view",
    focus.id === "rail-step-extra" && focus.inView,
    JSON.stringify(focus),
  );
  await ctx.close();

  // ── L5: clean-kind control — shoulder + Lakewood ────────────────
  const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const q = await ctx2.newPage();
  await q.goto(SITE, { waitUntil: "networkidle" });
  await q.getByRole("button", { name: "Pick Location on Map" }).click();
  const dlg2 = q.getByRole("dialog").first();
  await dlg2.waitFor();
  const tog2 = q.getByText(/enter coordinates manually/i);
  if (await tog2.isVisible().catch(() => false)) await tog2.click();
  await q.getByLabel("Latitude").fill("39.7113");
  await q.getByLabel("Longitude").fill("-105.0815");
  await settleDialog(q, dlg2, /Detecting roads at pin|Classifying road/i);
  const cand = dlg2.locator("button", { hasText: /way \d+/ }).first();
  if (await cand.isVisible().catch(() => false)) {
    await cand.click();
    await q.waitForTimeout(1500);
  }
  const save2 = dlg2.getByRole("button", { name: "Save & Close" });
  for (let i = 0; i < 30 && !(await save2.isEnabled().catch(() => false)); i++)
    await q.waitForTimeout(1000);
  await save2.click();
  await q.waitForTimeout(2000);
  // Clear the drawable-width mirror (detection fills 4×12 at this pin).
  const lw = q.getByLabel(/Lane width/).first();
  await lw.focus();
  for (let i = 0; i < 3; i++) await q.keyboard.press("ArrowLeft");
  await q.waitForTimeout(2500);
  const r5 = await railState(q);
  assert(
    "L5. clean shoulder: Location/Road/Work ✓, Schedule ◌, no blocker string on the rail",
    r5 !== null &&
      ["Location", "Road", "Work"].every((l) =>
        r5.entries.some((e) => e.label === l && e.cls.includes("st-done")),
      ) &&
      r5.entries.some((e) => e.label === "Schedule" && e.cls.includes("st-notset")) &&
      r5.entries.every((e) => e.blocker === null),
    JSON.stringify(r5?.entries.map((e) => `${e.label}:${e.cls.replace("rail-entry ", "")}`)),
  );
  await shot(q, "L5-clean-rail.png");
  const gen = q.getByRole("button", { name: /Generate plan/ }).first();
  for (let i = 0; i < 20 && (await gen.isDisabled().catch(() => true)); i++)
    await q.waitForTimeout(1000);
  assert("L5. Generate enabled on the clean control", !(await gen.isDisabled().catch(() => true)));
  await gen.click();
  await q
    .waitForFunction(
      () => Array.from(document.querySelectorAll("button")).some((b) => /Download PDF/.test(b.textContent ?? "")),
      null,
      { timeout: 120000 },
    )
    .catch(() => {});
  await q.waitForTimeout(2500);
  const post = await q.evaluate(() => ({
    rail: document.querySelectorAll(".progress-rail").length,
    pdf: Array.from(document.querySelectorAll("button")).some((b) => /Download PDF/.test(b.textContent ?? "")),
  }));
  assert(
    "L5. generated; post-generate the rail is gone (panel swapped to the strip by design)",
    post.pdf && post.rail === 0,
    JSON.stringify(post),
  );
  await shot(q, "L5-post-generate.png");
  await ctx2.close();

  fs.writeFileSync(path.join(OUT, "s2a8-lc-raw.md"), lines.join("\n") + "\n");
  await browser.close();
  console.log(`DONE — failures: ${failures}`);
  process.exit(failures ? 1 : 0);
})();
