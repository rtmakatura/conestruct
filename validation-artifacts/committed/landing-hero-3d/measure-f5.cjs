// F5: where the hero figure (card, scene, caption) sits at 1440x900 at
// load.  Logs its top, bottom and the overflow past the fold (negative =
// that many px of room left), and saves the at-load screenshot.
//
//   AUDIT_OUT=<dir> node measure-f5.cjs <base> <label>
const { chromium, fs, path } = require("../../../scripts/audit-lib.js");

const [BASE = "http://localhost:3149", LABEL = "now"] = process.argv.slice(2);
const OUT = process.env.AUDIT_OUT;
if (!OUT) throw new Error("AUDIT_OUT is required");
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const m = await page.evaluate(() => {
    const b = document.querySelector(".lv-hero-fig").getBoundingClientRect();
    const pad = getComputedStyle(document.querySelector(".lv-hero")).paddingTop;
    return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height), pad };
  });
  await page.screenshot({ path: path.join(OUT, `f5-1440x900-at-load-${LABEL}.png`) });
  const line = `F5 ${LABEL}: hero top padding ${m.pad} · figure y ${m.top}-${m.bottom} (${m.h} px) · overflow past the 900 px fold ${m.bottom - 900} px`;
  console.log(line);
  fs.appendFileSync(path.join(OUT, "f5.txt"), line + "\n");
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
