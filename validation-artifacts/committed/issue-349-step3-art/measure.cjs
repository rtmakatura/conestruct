// #349's browser run: step 3's new drawing on the dev server at 1440 and
// 390.  Per width: status, sideways scroll, axe on step 3, target floors
// and contrast pairs in step 3, page errors, what step 3 holds (an <svg>,
// no <img>, no MEDIAN / DIVIDED text) and its rendered size, plus a
// screenshot of the step 3 sheet.
//
//   AUDIT_OUT=<dir> node measure.cjs <base>
const { chromium, fs, path, PAIRS, TARGETS, runAxe } = require("../../../scripts/audit-lib.js");

const [BASE = "http://localhost:3149"] = process.argv.slice(2);
const OUT = process.env.AUDIT_OUT;
if (!OUT) throw new Error("AUDIT_OUT is required");
fs.mkdirSync(OUT, { recursive: true });
const log = (s) => {
  console.log(s);
  fs.appendFileSync(path.join(OUT, "log.txt"), s + "\n");
};
const aa = (p) => (p.size >= 24 || (p.size >= 18.66 && +p.weight >= 700) ? 3 : 4.5);

(async () => {
  const browser = await chromium.launch();
  log(`#349 check · ${BASE}/ · ${new Date().toISOString()}`);
  for (const [w, h] of [
    [1440, 900],
    [390, 844],
  ]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
    const resp = await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const sheet = await page.$(".lv-step3 .lv-sheet");
    await sheet.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    const facts = await page.evaluate(() => {
      const s = document.querySelector(".lv-step3 .lv-sheet");
      const svg = s.querySelector("svg.lv-sheet-img");
      const r = svg.getBoundingClientRect();
      return {
        imgs: s.querySelectorAll("img").length,
        svg: !!svg,
        viewBox: svg?.getAttribute("viewBox"),
        size: `${Math.round(r.width)}x${Math.round(r.height)}`,
        medianText: /MEDIAN|DIVIDED/i.test(svg?.textContent ?? ""),
        sw: document.documentElement.scrollWidth,
        iw: innerWidth,
      };
    });
    const floor = w <= 480 ? 44 : 32;
    const small = (await page.evaluate(TARGETS, ".lv-step3")).filter((t) => Math.min(t.w, t.h) < floor);
    const pairs = await page.evaluate(PAIRS, ".lv-step3");
    const low = pairs.filter((p) => p.ratio < aa(p));
    const axe = await runAxe(page, OUT, `step3-${w}`);
    log(
      `${w}: status ${resp.status()} · scroll ${facts.sw}/${facts.iw} ${facts.sw > facts.iw ? "SIDEWAYS" : "ok"}` +
        ` · step3 svg ${facts.svg} viewBox "${facts.viewBox}" ${facts.size} · img ${facts.imgs} · MEDIAN/DIVIDED text ${facts.medianText}` +
        ` · axe ${axe.length ? axe.map((v) => `${v.id}(${v.nodes.length})`).join(",") : "0"}` +
        ` · targets under ${floor}: ${small.length ? small.map((t) => `${t.name} ${t.w}x${t.h}`).join("; ") : "none"}` +
        ` · contrast below AA: ${low.length ? low.map((p) => `"${p.text}" ${p.ratio}`).join("; ") : "none"}` +
        ` · page errors ${errors.length ? errors.join(" | ") : "none"}`,
    );
    const box = await sheet.boundingBox();
    await page.screenshot({
      path: path.join(OUT, `step3-${w}.png`),
      clip: { x: Math.max(0, box.x - 8), y: Math.max(0, box.y - 8), width: Math.min(box.width + 16, w), height: box.height + 16 },
    });
    await page.close();
  }
  await browser.close();
})();
