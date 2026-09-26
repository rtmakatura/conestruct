// #301 piece 1 — the evidence sweep: every band-aerial state, at 1440 and
// 380, on prod after the ship (the local run was ruled out, 2026-09-26).
//
// One run = one plan walked through its states (and, once the band
// carries + / −, its zoom steps); each state saves a
// screenshot and the band aerial's facts — its stage, its note, its legend
// rows, the frame's box and the image's natural size (drawn @2x for that
// box), the modal's CORRIDOR EXTENT text when open, and whether the page
// scrolls sideways — to <out>/<run>-<width>-NN-<state>.{png,json}.
//
//   node sweep.cjs <run> <width>
//     run: shoulder -- N Broadway SB: pin (side owed) -> side (work only)
//                      -> kind (laid out) -> the picker (extent: coverage
//                      only, piece 2)
//          flagger  -- Lafayette St: kind first -> pin -> side (both
//                      approaches, the legend's sentence)
//          noroad   -- a pin with no road: the pin -> a heading -> kind
//
// env: AUDIT_OUT (dir), AUDIT_SITE (default prod /sandbox — Ryan, 2026-09-26:
// "run sweep.cjs against prod (headless browser only, no local backend or
// dev server)").
const path = require("path");
const fs = require("fs");
const { chromium } = require("C:/Users/rtmak/Documents/traffic-control-tool/node_modules/playwright");

const SITE = process.env.AUDIT_SITE || "https://www.conestruct.com/sandbox";
const OUT = process.env.AUDIT_OUT;
const [RUN, WIDTH] = [process.argv[2], Number(process.argv[3])];
const PINS = {
  shoulder: { lat: "39.73370", lng: "-104.98753", kind: /shoulder/i },
  flagger: { lat: "39.74362", lng: "-104.97070", kind: /flagger/i },
  noroad: { lat: "39.74480", lng: "-104.95010", kind: /shoulder/i },
};
const pin = PINS[RUN];
const log = [];
let n = 0;

async function aerialSettled(page) {
  const t0 = Date.now();
  while (Date.now() - t0 < 30000) {
    const s = await page.evaluate(() => {
      const a = document.querySelector('[data-testid="band-aerial"]');
      if (!a) return "absent";
      const note = a.querySelector('[data-testid="band-aerial-note"]')?.textContent || "";
      const img = a.querySelector("img");
      if (/Drawing the corridor/.test(note)) return "waiting";
      if (img && !img.complete) return "loading";
      return "settled";
    });
    if (s !== "waiting" && s !== "loading") return s;
    await page.waitForTimeout(500);
  }
  return "timeout";
}

async function state(page, name) {
  n += 1;
  const id = `${RUN}-${WIDTH}-${String(n).padStart(2, "0")}-${name}`;
  const settled = await aerialSettled(page);
  await page.waitForTimeout(500);
  const facts = await page.evaluate(() => {
    const t = (el) => el?.textContent?.replace(/\s+/g, " ").trim() ?? null;
    const a = document.querySelector('[data-testid="band-aerial"]');
    const frame = a?.querySelector(".a-aerial-frame");
    const img = a?.querySelector("img");
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), w: Math.round(r.width), h: Math.round(r.height) };
    };
    return {
      strip: t(document.querySelector(".status-bar")),
      openBand: document.querySelector('[data-testid="band-stack"]')?.getAttribute("data-open-band"),
      aerial: a
        ? {
            stage: a.getAttribute("data-stage"),
            zoomStep: a.querySelector('[data-testid="band-aerial-zoom"]')?.getAttribute("data-step") ?? null,
            dataRead: a.hasAttribute("data-read"),
            note: t(a.querySelector('[data-testid="band-aerial-note"]')),
            legendRows: Array.from(a.querySelectorAll(".a-aerial-row")).map((r) => t(r)),
            legendLines: Array.from(a.querySelectorAll(".a-aerial-line")).map((r) => t(r)),
            alt: img?.getAttribute("alt") ?? null,
            frame: box(frame),
            legend: box(a.querySelector(".a-aerial-legend")),
            imgNatural: img ? [img.naturalWidth, img.naturalHeight] : null,
          }
        : null,
      ledger: Array.from(document.querySelectorAll('[data-testid^="move-"]')).map((r) => t(r)),
      pickerExtent: document.querySelector('[role="dialog"]')
        ? t(Array.from(document.querySelectorAll('[role="dialog"] div')).find((d) => /^Corridor extent/i.test(d.textContent || ""))?.parentElement)
        : null,
      viewport: window.innerWidth,
      hScroll: document.documentElement.scrollWidth > window.innerWidth,
    };
  });
  const record = { id, settled, ...facts };
  fs.writeFileSync(path.join(OUT, `${id}.json`), JSON.stringify(record, null, 2));
  const dialog = await page.$('[role="dialog"]');
  const aerial = await page.$('[data-testid="band-aerial"]');
  if (aerial && !dialog) await aerial.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(OUT, `${id}.png`), fullPage: false });
  log.push(`${id}: settled=${settled} stage=${facts.aerial?.stage ?? "-"} note=${JSON.stringify(facts.aerial?.note ?? null)} rows=${JSON.stringify(facts.aerial?.legendRows ?? [])} lines=${JSON.stringify(facts.aerial?.legendLines ?? [])} frame=${JSON.stringify(facts.aerial?.frame ?? null)} img=${JSON.stringify(facts.aerial?.imgNatural ?? null)} hScroll=${facts.hScroll}`);
  return record;
}

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
  await page.waitForTimeout(1500);
}
async function confirmKind(page) {
  await openWhere(page);
  await page.getByRole("button", { name: pin.kind }).first().click();
  await page.waitForTimeout(500);
  await page.getByTestId("where-confirm").click();
  await page.waitForTimeout(1500);
}
async function reopenPicker(page) {
  const b = page.getByRole("button", { name: /Edit on map/i }).first();
  if (!(await b.count())) await openWhere(page);
  await page.getByRole("button", { name: /Edit on map/i }).first().click();
  await page.waitForTimeout(12000);
}
async function closePicker(page) {
  await page.getByRole("button", { name: "Cancel" }).first().click().catch(() => {});
  await page.waitForTimeout(1200);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
  const page = await browser.newPage({ viewport: { width: WIDTH, height: WIDTH < 500 ? 820 : 1000 } });
  const pictures = [];
  page.on("request", (r) => {
    if (!r.url().includes("/api/corridor-map")) return;
    try {
      const b = JSON.parse(r.postData() || "{}");
      pictures.push({ stage: b.stage, width: b.width, height: b.height });
    } catch { /* */ }
  });
  await page.goto(SITE, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(1000);
  await state(page, "fresh-no-aerial");
  if (RUN === "flagger") {
    await openPickerAndPin(page);
    await save(page);
    await confirmKind(page);
    await state(page, "kind-confirmed-side-owed-pin");
    await chooseSide(page);
    await openWhere(page);
    await state(page, "both-answered-two-approaches");
  } else {
    await openPickerAndPin(page);
    await save(page);
    await openWhere(page);
    await state(page, "located-side-owed-pin");
    await chooseSide(page);
    await openWhere(page);
    await state(page, "side-chosen-kind-owed-work");
    await confirmKind(page);
    await openWhere(page);
    await state(page, "both-answered-laid-out");
    // The zoom ruling (2026-09-26): when the band carries + / − (after it
    // ships), step in to the limit, out once, and Reset.
    if (await page.locator('[data-testid="band-aerial-zoom"]').count()) {
      const zbtn = (label) => page.locator(`[data-testid="band-aerial-zoom"] [aria-label="${label}"]`);
      for (let i = 1; i <= 3; i++) {
        await zbtn("Zoom in").click();
        await state(page, `zoom-in-${i}`);
      }
      await zbtn("Reset to the whole corridor").click();
      await zbtn("Zoom out").click();
      await state(page, "zoom-out-1");
      await zbtn("Reset to the whole corridor").click();
      await state(page, "zoom-reset");
    }
    if (RUN === "shoulder") {
      await reopenPicker(page);
      await state(page, "picker-extent-coverage-only");
      await closePicker(page);
    }
  }
  log.push("PICTURES REQUESTED");
  for (const p of pictures) log.push(JSON.stringify(p));
  fs.writeFileSync(path.join(OUT, `${RUN}-${WIDTH}-log.txt`), log.join("\n") + "\n");
  console.log(log.join("\n"));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
