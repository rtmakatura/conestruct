// #346: each rendered email's HTML part in a 600 px window, once with images
// and once with images blocked (the way many inboxes open it).  Offline: the
// signature's https URL is answered from public/email-signature.png.
//   node shoot-emails.cjs [dir]   (writes <dir>/*.png beside the .html;
//   dir defaults to emails/, real-send/received/ holds the inbox's copies)
const { chromium } = require("../../../scripts/audit-lib.js");
const fs = require("fs");
const path = require("path");
(async () => {
  const dir = path.resolve(__dirname, process.argv[2] ?? "emails");
  const browser = await chromium.launch();
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith(".html"))) {
    for (const blocked of [false, true]) {
      const page = await browser.newPage({ viewport: { width: 600, height: 400 } });
      await page.route("https://www.conestruct.com/email-signature.png", (r) =>
        blocked ? r.abort() : r.fulfill({ path: path.join(__dirname, "../../../conestruct/site/public/email-signature.png") }),
      );
      await page.goto("file://" + path.join(dir, f));
      await page.waitForTimeout(300);
      const out = path.join(dir, f.replace(".html", blocked ? "-images-blocked.png" : ".png"));
      await page.screenshot({ path: out, fullPage: true });
      console.log(path.basename(out));
      await page.close();
    }
  }
  await browser.close();
})();
