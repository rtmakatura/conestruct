// #346's browser run, on the dev server at 1440 and 390.  The landing
// light run's page checks (status, sideways scroll, axe, target floors,
// contrast pairs, page errors), then each form in each state the route
// can put it in:
//   - refused (/api/contact answers 502 in the browser): the inline error,
//     its contrast and targets, axe on it;
//   - sent (answers 200): the confirmation in place, and focus on it;
// then one real POST through the real middleware with no session, to show
// the gate passes /api/contact and the route refuses honestly without its
// config (the dev server has no RESEND_API_KEY and no Upstash).
//
//   AUDIT_OUT=<dir> node measure.cjs <base>
const lib = require("../../../scripts/audit-lib.js");
const { chromium, fs, path, PAIRS, TARGETS, runAxe } = lib;

const [BASE = "http://localhost:3100"] = process.argv.slice(2);
const OUT = process.env.AUDIT_OUT;
if (!OUT) throw new Error("AUDIT_OUT is required");
fs.mkdirSync(OUT, { recursive: true });
const log = (s) => {
  console.log(s);
  fs.appendFileSync(path.join(OUT, "log.txt"), s + "\n");
};
const shot = async (page, el, name, w) => {
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const box = await el.boundingBox();
  await page.screenshot({
    path: path.join(OUT, `${name}-${w}.png`),
    clip: { x: Math.max(0, box.x - 8), y: Math.max(0, box.y - 8), width: Math.min(box.width + 16, w), height: box.height + 16 },
  });
};
const aa = (p) => (p.size >= 24 || (p.size >= 18.66 && +p.weight >= 700) ? 3 : 4.5);

async function checks(page, w, scope, label) {
  const floor = w <= 480 ? 44 : 32;
  const small = (await page.evaluate(TARGETS, scope)).filter((t) => Math.min(t.w, t.h) < floor);
  const pairs = await page.evaluate(PAIRS, scope);
  const low = pairs.filter((p) => p.ratio < aa(p));
  const lowest = pairs.map((p) => p.ratio).sort((a, b) => a - b)[0];
  const axe = await runAxe(page, OUT, `${label}-${w}`);
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
  return (
    `scroll ${m.sw}/${m.iw} ${m.sw > m.iw ? "SIDEWAYS" : "ok"} · axe ${axe.length ? axe.map((v) => `${v.id}(${v.nodes.length})`).join(",") : "0"}` +
    ` · targets under ${floor}: ${small.length ? small.map((t) => `${t.name} ${t.w}x${t.h}`).join("; ") : "none"}` +
    ` · contrast lowest ${lowest}, below AA: ${low.length ? low.map((p) => `"${p.text}" ${p.ratio}`).join("; ") : "none"}`
  );
}

async function fillJob(page) {
  await page.fill("#c-name", "Dana Ortiz");
  await page.fill("#c-company", "Front Range Traffic");
  await page.fill("#c-email", "dana@frtraffic.com");
  await page.fill("#c-where", "E Colfax Ave & N Race St");
  await page.fill("#c-city", "Denver");
  await page.click("label.lv-opt:has-text('Shoulder work')");
  await page.fill("#c-side", "South side, eastbound");
  await page.fill("#c-length", "1,000");
  await page.click("label.lv-seg:has-text('Daytime')");
}

(async () => {
  const browser = await chromium.launch();
  log(`#346 check · ${BASE}/ · ${new Date().toISOString()}`);
  for (const [w, h] of [
    [1440, 900],
    [390, 844],
  ]) {
    for (const status of [502, 200]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h } });
      const page = await ctx.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
      const posts = [];
      await page.route("**/api/contact", async (route) => {
        posts.push(JSON.parse(route.request().postData() ?? "{}"));
        await route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ ok: status === 200 }) });
      });
      const resp = await page.goto(BASE + "/", { waitUntil: "networkidle" });
      await page.waitForTimeout(1500);
      if (status === 502) log(`${w}: idle · status ${resp.status()} · ${await checks(page, w, "body", "idle")}`);

      await fillJob(page);
      await page.click("form.lv-form button[type=submit]");
      await page.fill("#w-email", "pat@example.com");
      await page.click("form#join button[type=submit]");
      await page.waitForTimeout(800);

      const sent = posts.map((p) => `${p.type}(elapsed ${p.elapsed_ms} ms, keys ${Object.keys(p).length})`).join(", ");
      if (status === 502) {
        const alerts = await page.$$eval("[role=alert]", (a) => a.map((x) => x.textContent));
        log(`${w}: refused (502) · posts ${sent} · alerts ${JSON.stringify(alerts)} · ${await checks(page, w, "#pilot, form.lv-form", "refused")}`);
        await shot(page, await page.$("form.lv-form .lv-submit"), "job-refused", w);
        await shot(page, await page.$("form#join"), "waitlist-refused", w);
      } else {
        const state = await page.evaluate(() => ({
          job: document.querySelector(".lv-form.lv-sent")?.textContent ?? null,
          join: document.querySelector("#join.lv-sent")?.textContent ?? null,
          forms: document.querySelectorAll("form").length,
          focus: document.activeElement?.className ?? "",
        }));
        log(`${w}: sent (200) · posts ${sent} · ${JSON.stringify(state)} · ${await checks(page, w, "body", "sent")}`);
        await shot(page, await page.$(".lv-form.lv-sent"), "job-sent", w);
        await shot(page, await page.$("#join.lv-sent"), "waitlist-sent", w);
      }
      log(`${w}: page errors ${errors.length ? errors.join(" | ") : "none"}`);
      await ctx.close();
    }
  }

  // The real route, through the real middleware, no session or bypass header.
  const ctx = await browser.newContext();
  const body = {
    type: "waitlist",
    website: "",
    elapsed_ms: 5000,
    email: "pat@example.com",
  };
  const r = await ctx.request.post(BASE + "/api/contact", { data: body, maxRedirects: 0 });
  log(`real POST /api/contact (no session): ${r.status()} ${await r.text()}`);
  const g = await ctx.request.get(BASE + "/api/contact", { maxRedirects: 0 });
  log(`real GET /api/contact (no session): ${g.status()}`);
  const near = await ctx.request.post(BASE + "/api/contacts", { data: body, maxRedirects: 0 });
  log(`real POST /api/contacts (near miss, no session): ${near.status()}`);
  await ctx.close();
  await browser.close();
})();
