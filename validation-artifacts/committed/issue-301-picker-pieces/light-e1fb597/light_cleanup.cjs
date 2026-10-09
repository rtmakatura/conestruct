// R123 branch 1 (light lane): issue-301-modal-cleanup on its Vercel preview
// (AUDIT_SITE).  The cleanup is behaviour-preserving, so the run checks the
// surface it touched still works: N Broadway SB (39.73370, -104.98753) typed
// into the picker, the road picked, the modal's "Which road?" caption (the one
// rendered component the diff edited) cropped, then Save & Close, shoulder
// work, a side, Confirm.  handoff.md § Light lane step 5's checks on the modal
// page and on the band after Confirm: status, sideways scroll, axe, target
// floors, contrast pairs, page errors.  Writes:
//   log.txt                  one line of checks per width and page
//   modal-<w>.png            the modal with the road picked
//   caption-<w>.png          the "Which road?" card (the changed region)
//   band-<w>.png             the WHERE band after Confirm
// Usage: GATE_BYPASS_TOKEN=... AUDIT_SITE=<preview>/sandbox AUDIT_OUT=<dir>
//        node light_cleanup.cjs
const REPO = "C:/Users/rtmak/Documents/traffic-control-tool";
const lib = require(`${REPO}/scripts/audit-lib.js`);
const { chromium, fs, path, PAIRS, TARGETS, runAxe } = lib;
const { hook } = require(`${REPO}/scripts/live-check.cjs`);
const { applyGate, gateHeaders } = require(`${REPO}/scripts/gate.cjs`);

const SITE = process.env.AUDIT_SITE;
const OUT = process.env.AUDIT_OUT;
if (!SITE || !OUT) throw new Error("AUDIT_SITE and AUDIT_OUT are required");
fs.mkdirSync(OUT, { recursive: true });
gateHeaders(SITE);
const log = (s) => {
  console.log(s);
  fs.appendFileSync(path.join(OUT, "log.txt"), s + "\n");
};
const PIN = { lat: "39.73370", lng: "-104.98753" };

async function checks(page, width, tag, resp, errors) {
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
  const floor = width <= 480 ? 44 : 32;
  const small = (await page.evaluate(TARGETS, "body")).filter((t) => Math.min(t.w, t.h) < floor);
  const pairs = (await page.evaluate(PAIRS, "body")).filter((p) => p.opacity >= 0.2);
  const aa = (p) => (p.size >= 24 || (p.size >= 18.66 && +p.weight >= 700) ? 3 : 4.5);
  const low = pairs.filter((p) => p.ratio < aa(p));
  const lowest = pairs.map((p) => p.ratio).sort((x, y) => x - y)[0];
  const axe = await runAxe(page, OUT, `${width}-${tag}`);
  log(
    `${width} ${tag}: status ${resp.status()} · scroll ${m.sw}/${m.iw} ${m.sw > m.iw ? "SIDEWAYS" : "ok"} · axe ${
      axe.length ? axe.map((v) => `${v.id}(${v.nodes.length})`).join(",") : "0"
    } · targets under ${floor}: ${small.length ? small.map((t) => `${t.name} ${t.w}x${t.h}`).join("; ") : "none"} · contrast lowest ${lowest}, below AA: ${
      low.length ? low.map((p) => `"${p.text}" ${p.ratio}`).join("; ") : "none"
    } · page errors ${errors.length ? errors.join(" | ") : "none"}`,
  );
}

async function run(browser, width, height) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  await applyGate(ctx, SITE);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
  const resp = await page.goto(SITE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);
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
  if ((await candidate.count()) > 0) {
    await candidate.click();
    await page.waitForTimeout(3000);
  }
  for (let i = 0; i < 60 && !(await save.isEnabled()); i += 1) await page.waitForTimeout(1000);
  await page.mouse.move(1, 1);
  await page.screenshot({ path: path.join(OUT, `modal-${width}.png`) });
  const caption = page.getByText(/Detected from OSM:/).first();
  const cap = (await caption.count()) ? (await caption.textContent()).trim() : "(no caption)";
  if (await caption.count()) {
    const card = caption.locator("xpath=ancestor::div[1]/..");
    await card.screenshot({ path: path.join(OUT, `caption-${width}.png`) });
  }
  log(`${width} caption: "${cap}"`);
  await checks(page, width, "modal", resp, errors);
  await save.click();
  await page.waitForTimeout(4000);
  await (await hook(page, "kind-chip-shoulder")).click();
  const side = page.locator('[data-testid="side-option"]').first();
  for (let i = 0; i < 60 && (await side.count()) === 0; i += 1) await page.waitForTimeout(1000);
  await side.click();
  await page.waitForTimeout(2500);
  await (await hook(page, "where-confirm")).click();
  await page.waitForTimeout(9000);
  await page.mouse.move(1, 1);
  await page.screenshot({ path: path.join(OUT, `band-${width}.png`) });
  await checks(page, width, "band", resp, errors);
  await ctx.close();
}

(async () => {
  fs.writeFileSync(
    path.join(OUT, "log.txt"),
    `R123 branch 1 light check · ${SITE} · ${new Date().toISOString()}\n`,
  );
  const browser = await chromium.launch();
  await run(browser, 1440, 1000);
  await run(browser, 390, 844);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
