// #290 checkpoint (k) commit 9 — the prod evidence sweep: every #290 state
// on https://www.conestruct.com/sandbox, at 1440 and at 380.
//
// One run = one plan walked through its states; each state saves a
// screenshot, the strip's text, the ledger's rows (label · value · word)
// and the CTA's reason to <out>/<run>-<width>-NN-<state>.{png,json}.
//
//   node sweep.cjs <run> <width>
//     run: shoulder  -- N Broadway SB: pin -> picker (pre-side sentence)
//                       -> save -> side (ledger split) -> kind -> verdict
//                       -> picker (work + approach) -> generate (+ PDF)
//          flagger   -- Lafayette St: kind BEFORE side (AWAITING OCCUPIED
//                       SIDE) -> side -> picker (both approaches) -> generate
//          noroad    -- a pin with no road detected: the four headings
//
// env: AUDIT_OUT (dir), AUDIT_SITE (default prod /sandbox).
const path = require("path");
const fs = require("fs");
const { chromium } = require("C:/Users/rtmak/Documents/traffic-control-tool/node_modules/playwright");

const SITE = process.env.AUDIT_SITE || "https://www.conestruct.com/sandbox";
const OUT = process.env.AUDIT_OUT;
const [RUN, WIDTH] = [process.argv[2], Number(process.argv[3])];
const PINS = {
  shoulder: { lat: "39.73370", lng: "-104.98753", kind: /shoulder/i },
  flagger: { lat: "39.74362", lng: "-104.97070", kind: /flagger/i },
  noroad: { lat: process.env.NOROAD_LAT || "39.74480", lng: process.env.NOROAD_LNG || "-104.95010", kind: /shoulder/i },
};
const pin = PINS[RUN];
const log = [];
let n = 0;

async function state(page, name, extra = {}) {
  n += 1;
  const id = `${RUN}-${WIDTH}-${String(n).padStart(2, "0")}-${name}`;
  await page.waitForTimeout(600);
  const facts = await page.evaluate(() => {
    const t = (sel) => document.querySelector(sel)?.textContent?.replace(/\s+/g, " ").trim() ?? null;
    return {
      strip: t(".status-bar"),
      cta: t('[data-testid="cta-reason"]'),
      generateDisabled: (() => {
        const b = Array.from(document.querySelectorAll("button")).find((x) => /Generate plan/.test(x.textContent || ""));
        return b ? b.disabled || b.getAttribute("aria-disabled") === "true" : null;
      })(),
      ledger: Array.from(document.querySelectorAll('[data-testid^="move-"]')).map((r) => ({
        id: r.getAttribute("data-testid"),
        state: r.getAttribute("data-move-state"),
        text: r.textContent.replace(/\s+/g, " ").trim(),
      })),
      sideOptions: Array.from(document.querySelectorAll('[data-testid="side-option"]')).map((b) => ({
        text: b.textContent.replace(/\s+/g, " ").trim(),
        checked: b.getAttribute("aria-checked"),
      })),
      picker: t('[role="dialog"]') ? {
        subtitle: t('[data-testid="picker-subtitle"]'),
        sideSentence: t('[data-testid="picker-side-sentence"]'),
        refused: t('[data-testid="picker-corridor-refused"]'),
      } : null,
      hScroll: document.documentElement.scrollWidth > window.innerWidth,
    };
  });
  const record = { id, ...facts, ...extra };
  fs.writeFileSync(path.join(OUT, `${id}.json`), JSON.stringify(record, null, 2));
  const dialog = await page.$('[role="dialog"]');
  await page.screenshot({ path: path.join(OUT, `${id}.png`), fullPage: !dialog });
  log.push(`${id}: strip=${JSON.stringify(facts.strip)} cta=${JSON.stringify(facts.cta)} hScroll=${facts.hScroll}`);
  return record;
}

const geo = [];
async function openPickerAndPin(page) {
  await page.getByTestId("where-open-picker").first().click();
  await page.waitForTimeout(2500);
  await page.getByText(/Or enter coordinates manually/i).first().click();
  await page.getByLabel("Latitude", { exact: true }).fill(pin.lat);
  await page.getByLabel("Longitude", { exact: true }).fill(pin.lng);
  await page.keyboard.press("Tab");
  const t0 = Date.now();
  while (Date.now() - t0 < 60000) {
    const c = page.getByText(/SOUTHBOUND|NORTHBOUND|EASTBOUND|WESTBOUND/i).first();
    const none = page.getByText(/no road|set road properties manually/i).first();
    if (await c.count()) { await page.waitForTimeout(400); await c.click().catch(() => {}); break; }
    if (await none.count()) break;
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(4000);
}
async function save(page) {
  await page.getByRole("button", { name: "Save & Close" }).click();
  await page.waitForTimeout(2000);
}
async function openWhere(page) {
  if (await page.locator('[data-testid="side-option"]').count()) return;
  const w = page.getByTestId("fact-link-where").first();
  if (await w.count()) { await w.click(); await page.waitForTimeout(1200); }
}
async function chooseSide(page) {
  await openWhere(page);
  const t0 = Date.now();
  while (Date.now() - t0 < 20000 && !(await page.locator('[data-testid="side-option"]').count())) await page.waitForTimeout(400);
  await page.locator('[data-testid="side-option"]').first().click();
  await page.waitForTimeout(2500);
}
async function confirmKind(page) {
  await openWhere(page);
  await page.getByRole("button", { name: pin.kind }).first().click();
  await page.waitForTimeout(500);
  await page.getByTestId("where-confirm").click();
  await page.waitForTimeout(2500);
}
async function settleVerdict(page) {
  const t0 = Date.now();
  while (Date.now() - t0 < 60000) {
    const s = await page.evaluate(() => document.querySelector(".status-bar")?.textContent || "");
    if (!/VERIFYING|WAKING/i.test(s)) return;
    await page.waitForTimeout(1000);
  }
}
async function reopenPicker(page) {
  const b = page.getByRole("button", { name: /Edit on map/i }).first();
  if (!(await b.count())) {
    const w = page.getByTestId("fact-link-where").first();
    if (await w.count()) { await w.click(); await page.waitForTimeout(1000); }
  }
  await page.getByRole("button", { name: /Edit on map/i }).first().click();
  await page.waitForTimeout(12000);
}
async function closePicker(page) {
  await page.getByRole("button", { name: "Cancel" }).first().click().catch(() => {});
  await page.waitForTimeout(1200);
}
async function generate(page) {
  await page.getByRole("button", { name: /Generate plan/ }).first().click();
  const t0 = Date.now();
  while (Date.now() - t0 < 120000) {
    const busy = await page.evaluate(() => !!document.querySelector(".workbench.ws-locked"));
    if (!busy && Date.now() - t0 > 5000) break;
    await page.waitForTimeout(1500);
  }
  await page.waitForTimeout(2000);
}
async function downloadPdf(page) {
  const buttons = await page.$$eval("button, a", (bs) => bs.filter((b) => b.offsetParent).map((b) => b.textContent.replace(/\s+/g, " ").trim()));
  const pdfButton = page.locator("button, a").filter({ hasText: /plan sheet|\bPDF\b/i }).first();
  if (!(await pdfButton.count())) return { pdf: null, buttons };
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 120000 }), pdfButton.click()]);
  const file = path.join(OUT, `${RUN}-${WIDTH}-plan.pdf`);
  await dl.saveAs(file);
  return { pdf: file, buttons };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
  const page = await browser.newPage({ viewport: { width: WIDTH, height: WIDTH < 500 ? 820 : 1000 }, acceptDownloads: true });
  page.on("response", async (r) => {
    if (!r.url().includes("/api/render/corridor-geometry")) return;
    try {
      const b = await r.json();
      geo.push({ status: b.status, approaches: (b.approaches || []).map((a) => [a.id, a.travel_bearing_deg]), sides: (b.side_options || []).map((o) => o.label), message: b.message });
    } catch { /* */ }
  });
  await page.goto(SITE, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(1000);
  await state(page, "fresh");
  await openPickerAndPin(page);
  await state(page, "picker-before-side");
  await save(page);
  await state(page, "located");
  if (RUN === "shoulder") {
    await chooseSide(page);
    await state(page, "side-chosen-kind-owed");
    await confirmKind(page);
    await settleVerdict(page);
    await state(page, "both-answered");
    await reopenPicker(page);
    await state(page, "picker-laid-out");
    await closePicker(page);
  } else if (RUN === "flagger") {
    await confirmKind(page);
    await state(page, "kind-confirmed-side-owed");
    await chooseSide(page);
    await settleVerdict(page);
    await state(page, "both-answered");
    await reopenPicker(page);
    await state(page, "picker-both-approaches");
    await closePicker(page);
  } else {
    await openWhere(page);
    await page.waitForTimeout(3000);
    await state(page, "no-road-side-control");
    await chooseSide(page);
    await confirmKind(page);
    await settleVerdict(page);
    await state(page, "both-answered");
  }
  if (RUN !== "noroad") {
    await generate(page);
    await state(page, "generated");
    if (WIDTH >= 1000) {
      const r = await downloadPdf(page);
      log.push(`pdf: ${r.pdf} buttons=${JSON.stringify(r.buttons).slice(0, 600)}`);
    }
  }
  log.push("GEOMETRY");
  for (const g of geo) log.push(JSON.stringify(g));
  fs.writeFileSync(path.join(OUT, `${RUN}-${WIDTH}-log.txt`), log.join("\n") + "\n");
  console.log(log.join("\n"));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
