// s2-arc29 threshold probe — where must the block stack?
//
// GO ruling (a) fixes both value tracks to the domain's widest value; ruling
// (b) says that below some width the label takes its own row rather than the
// tracks shrinking.  The threshold is measured, not guessed: this walks the
// viewport width and records the block's CONTENT width (border-box minus
// padding) at each, so the breakpoint can be pinned to a real number.
//
//   node s2a29-threshold.js <outDir> <expectSha> [base]
const L = require("../s2-audit-1/audit-lib.js");
const { fs, path } = L;

const OUT = process.argv[2];
const EXPECT = process.argv[3];
const BASE = process.argv[4] || "http://localhost:3005";
const FIX = { lat: "39.71466", lng: "-104.94071", way: "39508704" };
const WIDTHS = [1440, 1280, 1100, 1000, 980, 960, 900, 820, 768, 640, 560, 481, 480, 430, 380, 360];

fs.mkdirSync(OUT, { recursive: true });
const { log } = L.mkLog(OUT);

const CONTENT = () => {
  const blk = document.querySelector(".dva");
  if (!blk) return null;
  const c = getComputedStyle(blk);
  const b = blk.getBoundingClientRect();
  return {
    border: Math.round(b.width * 10) / 10,
    content:
      Math.round(
        (b.width -
          parseFloat(c.paddingLeft) -
          parseFloat(c.paddingRight) -
          parseFloat(c.borderLeftWidth) -
          parseFloat(c.borderRightWidth)) *
          10,
      ) / 10,
    tracks: getComputedStyle(blk.querySelector(".dva-grid")).gridTemplateColumns,
  };
};

const drive = async (page) => {
  await page.getByRole("button", { name: "Pick Location on Map" }).click();
  await page.waitForSelector("[role=dialog]", { timeout: 10000 });
  const dlg = page.locator("[role=dialog]");
  const manual = dlg.getByRole("button", { name: /Or enter coordinates manually|Hide coordinate/i });
  if (await manual.count()) {
    const t = await manual.first().textContent();
    if (/Or enter/i.test(t || "")) await manual.first().click();
  }
  await dlg.getByLabel("Latitude").fill(FIX.lat);
  await dlg.getByLabel("Longitude").fill(FIX.lng);
  await dlg.getByLabel("Longitude").blur();
  for (let i = 0; i < 60; i++) {
    if (await dlg.locator("button", { hasText: new RegExp(`way ${FIX.way}`) }).count()) break;
    await page.waitForTimeout(500);
  }
  await dlg.locator("button", { hasText: new RegExp(`way ${FIX.way}`) }).first().click();
  await page.waitForTimeout(1200);
  await dlg.getByRole("button", { name: "Save & Close" }).click();
  await page.waitForSelector("[role=dialog]", { state: "detached", timeout: 10000 });
  await page.waitForTimeout(1000);
};

(async () => {
  await L.shaGate(log, EXPECT);
  const browser = await L.chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`${BASE}/sandbox`, { waitUntil: "networkidle" });
  await drive(page);

  // Two fixed 132 px value tracks + two 14 px gaps = 292 px; the label needs
  // a floor to stay readable.  Record what is left for the label at each
  // width so the breakpoint is chosen against a measured number.
  const NEED = 132 * 2 + 14 * 2;
  const out = [];
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: 1000 });
    await page.waitForTimeout(350);
    const m = await page.evaluate(CONTENT);
    if (!m) { log(`w=${w}: block absent`); continue; }
    const labelLeft = Math.round((m.content - NEED) * 10) / 10;
    out.push({ w, ...m, labelLeft });
    log(`w=${w}  block ${m.border}  content ${m.content}  label would get ${labelLeft}  tracks "${m.tracks}"`);
  }
  fs.writeFileSync(path.join(OUT, "rows.json"), JSON.stringify(out, null, 2));
  const ok = out.filter((r) => r.labelLeft >= 90);
  log(`\nwidths where a 90 px label floor still fits two 132 px tracks: ${ok.map((r) => r.w).join(", ") || "(none)"}`);
  const bad = out.filter((r) => r.labelLeft < 90);
  log(`widths that must stack: ${bad.map((r) => r.w).join(", ") || "(none)"}`);
  await browser.close();
})();
