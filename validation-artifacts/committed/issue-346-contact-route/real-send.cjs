// #346's real send: the two landing forms, filled and submitted in a real
// browser on a preview deployment that has the Resend and Upstash env, so
// /api/contact sends through Resend for real.  One job, one waitlist.  The
// test inbox is Ryan's own, by plus-address, so each email is told apart.
// Logs each POST's status and body; the received emails are checked in the
// inbox afterwards (README.md in real-send/).
//
//   AUDIT_OUT=<dir> node real-send.cjs <base>
const lib = require("../../../scripts/audit-lib.js");
const { chromium, fs, path } = lib;

const [BASE] = process.argv.slice(2);
const OUT = process.env.AUDIT_OUT;
if (!BASE || !OUT) throw new Error("usage: AUDIT_OUT=<dir> node real-send.cjs <base>");
fs.mkdirSync(OUT, { recursive: true });
const log = (s) => {
  console.log(s);
  fs.appendFileSync(path.join(OUT, "log.txt"), s + "\n");
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  log(`#346 real send · ${BASE}/ · ${new Date().toISOString()}`);
  page.on("response", async (r) => {
    if (r.url().endsWith("/api/contact")) log(`POST /api/contact -> ${r.status()} ${await r.text()}`);
  });
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(4000); // past the 3-second floor

  await page.fill("#c-name", "Dana Ortiz (#346 test)");
  await page.fill("#c-company", "Front Range Traffic");
  await page.fill("#c-email", "ryan+346job@conestruct.com");
  await page.fill("#c-where", "E Colfax Ave & N Race St");
  await page.fill("#c-city", "Denver");
  await page.click("label.lv-opt:has-text('Shoulder work')");
  await page.fill("#c-side", "South side, eastbound");
  await page.fill("#c-length", "1,000");
  await page.click("label.lv-seg:has-text('Daytime')");
  await page.fill("#c-notes", "Test submission for #346.\nSecond line.");
  await page.click("form.lv-form button[type=submit]");
  await page.waitForSelector(".lv-form.lv-sent, .lv-send-error", { timeout: 20000 });
  log(`job form: ${await page.evaluate(() => (document.querySelector(".lv-form.lv-sent") ?? document.querySelector(".lv-send-error"))?.textContent)}`);

  await page.fill("#w-email", "ryan+346wait@conestruct.com");
  await page.click("form#join button[type=submit]");
  await page.waitForSelector("#join.lv-sent, #join .lv-send-error", { timeout: 20000 });
  log(`waitlist form: ${await page.evaluate(() => (document.querySelector("#join.lv-sent") ?? document.querySelector("#join .lv-send-error"))?.textContent)}`);
  await page.waitForTimeout(1000);
  await browser.close();
})();
