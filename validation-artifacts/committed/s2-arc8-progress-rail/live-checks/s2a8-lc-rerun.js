/** s2-arc8 live checks — targeted rerun of L3 (Refs #221).
 *  First-pass FAIL was a RUNNER defect: the reason-picker took the first
 *  .--fail role=alert on the page, which in the wz=0 state is the INLINE
 *  field error ("⚠ Work zone length is required." — glyph-prefixed) and
 *  not the under-CTA reason.  The rail state in the diagnostic was
 *  already correct (Work ⚠ current + Cross street ⚠ both rendered).
 *  Fix: read the CTA reason from the Generate footer's own alert
 *  (#rail-step-generate [role=alert]).
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const OUT = path.join(__dirname, "outS2A8LC");
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

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const p = await ctx.newPage();
  await p.goto(SITE, { waitUntil: "networkidle" });
  await p.locator(".setup-panel button", { hasText: /near intersection/i }).first().click();
  await p.waitForTimeout(1000);
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
    await armedClick(cx + (TARGET.lng - s0.g.lng) / degPerPxLng, cy - (TARGET.lat - s0.g.lat) / degPerPxLat);
  }
  const save = dlg.getByRole("button", { name: "Save & Close" });
  for (let i = 0; i < 30 && !(await save.isEnabled().catch(() => false)); i++)
    await p.waitForTimeout(1000);
  await save.click();
  await p.waitForTimeout(2500);
  await p.getByLabel("Work zone length (ft)").first().fill("0");
  await p.locator("body").click();
  await p.waitForTimeout(1500);
  const st = await p.evaluate(() => {
    const nav = document.querySelector(".progress-rail");
    const entries = Array.from(nav?.querySelectorAll(".rail-entry") ?? []).map((b) => ({
      label: b.querySelector(".rail-label")?.textContent ?? "",
      cls: b.className,
      blocker: b.querySelector(".rail-blocker")?.textContent ?? null,
      aria: b.getAttribute("aria-label"),
    }));
    const cta =
      document
        .querySelector("#rail-step-generate [role='alert']")
        ?.textContent?.trim() ?? null;
    return { entries, cta };
  });
  const work = st.entries.find((e) => e.label === "Work");
  const cross = st.entries.find((e) => e.label === "Cross street");
  assert(
    "R-L3. wz=0 + hold: BOTH ⚠ visible on the rail at once — the queue is dead",
    work?.cls.includes("st-attention") === true &&
      cross?.cls.includes("st-attention") === true &&
      work?.blocker === "Work zone length is required." &&
      st.cta === "Work zone length is required." &&
      (cross?.aria ?? "").includes("needs attention"),
    JSON.stringify({ work: work?.cls, cross: cross?.cls, cta: st.cta, crossAria: cross?.aria }),
  );
  await p.screenshot({ path: path.join(OUT, "R-L3-multiblocker.png"), fullPage: true });
  log("screenshot: R-L3-multiblocker.png");
  fs.appendFileSync(path.join(OUT, "s2a8-lc-raw.md"), lines.join("\n") + "\n");
  await browser.close();
  console.log(`DONE — failures: ${failures}`);
  process.exit(failures ? 1 : 0);
})();
