// R33 Part A: the strings a screenshot can't show.  Each public page's
// <title>, meta and Open Graph description, the notify mail link, and a
// count of em dashes in the rendered text.
//
//   AUDIT_OUT=<dir> node probe-titles.cjs <base>
const lib = require("../../../../scripts/audit-lib.js");
const { chromium, fs, path } = lib;

const BASE = process.argv[2] || "http://localhost:3100";
const OUT = process.env.AUDIT_OUT;
if (!OUT) throw new Error("AUDIT_OUT is required");
const log = (s) => {
  console.log(s);
  fs.appendFileSync(path.join(OUT, "titles.txt"), s + "\n");
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  log(`title probe · ${BASE} · ${new Date().toISOString()}`);
  for (const p of ["/", "/404", "/terms", "/privacy"]) {
    await page.goto(BASE + p, { waitUntil: "networkidle" });
    const r = await page.evaluate(() => ({
      title: document.title,
      desc: document.querySelector('meta[name="description"]')?.content ?? null,
      og: document.querySelector('meta[property="og:description"]')?.content ?? null,
      mail: [...document.querySelectorAll('a[href^="mailto:"]')].map((a) => decodeURIComponent(a.href))[0] ?? null,
      emDashes: (document.body.innerText.match(/—/g) || []).length,
      svgEmDashes: [...document.querySelectorAll("svg text")].filter((t) => t.textContent.includes("—")).length,
    }));
    log(`${p}: title "${r.title}" · em dashes in text ${r.emDashes}, in svg text ${r.svgEmDashes}`);
    log(`  description: ${r.desc}`);
    log(`  og:description: ${r.og}`);
    if (r.mail) log(`  mail: ${r.mail}`);
  }
  await browser.close();
})();
