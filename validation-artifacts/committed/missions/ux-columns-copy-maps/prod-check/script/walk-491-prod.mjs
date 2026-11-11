// #494 prod check (2026-11-10): #491's two failure lines, live on production.
// Live E Colfax; one failure forced per context by a page route (client side
// only, never a backend change): /api/corridor-map 500 (the WHERE aerial's
// line) or /api/render/corridor-geometry 500 (the side question's line).
// Reads each line's text byte for byte, its class and computed font family.
// Read-only: no Generate, nothing saved.  The gate header goes only to the
// site (gate.cjs, copied beside this script at run time).
// usage: SITE=https://www.conestruct.com OUT=<dir> GATE_BYPASS_TOKEN=... node walk-491-prod.mjs
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(import.meta.url);
const { newGatedContext, guardOutput, oneLine } = require("./gate.cjs");
guardOutput();
const { chromium } = require("playwright");
const SITE = process.env.SITE ?? "http://localhost:3000";
const OUT = process.env.OUT ?? null;
const WANT = {
  aerial: "The map didn't load. Edit on map opens the big map at your pin.",
  sides: "We couldn't load this road's sides.",
};
const ROUTE = { aerial: "**/api/corridor-map**", sides: "**/api/render/corridor-geometry**" };
const b = await chromium.launch();
let fails = 0;
for (const [w, h] of [[1440, 900], [390, 844]]) {
  for (const phase of ["aerial", "sides"]) {
    const ctx = await newGatedContext(b, SITE, { viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    const errs = [];
    p.on("pageerror", (e) => errs.push(oneLine(e).slice(0, 160)));
    await p.route(ROUTE[phase], (r) => r.fulfill({ status: 500, contentType: "application/json", body: '{"error":"check: forced failure"}' }));
    try {
      await p.goto(`${SITE}/sandbox`, { waitUntil: "networkidle", timeout: 240000 });
      await p.waitForSelector(".a-open .a-head", { timeout: 120000 });
      await p.getByRole("button", { name: "Pick on map" }).click();
      await p.waitForTimeout(1500);
      await p.getByLabel("Address or intersection search").fill("1600 E Colfax Ave, Denver");
      await p.getByRole("button", { name: "SEARCH" }).click();
      await p.waitForFunction(() => {
        const d = document.querySelector("[role=dialog]");
        const save = [...(d?.querySelectorAll("button") ?? [])].find((x) => /Save & Close/.test(x.innerText));
        return /PICK THE ROAD · \d+ FOUND|Which road/i.test(d?.innerText ?? "") || (save && !save.disabled);
      }, null, { timeout: 90000 });
      await p.waitForTimeout(1500);
      const want = p.getByRole("dialog").locator("button", { hasText: /Colfax/ });
      if (await want.count()) await want.first().click().catch(() => {});
      await p.waitForTimeout(2000);
      const picked = await p.locator("[role=dialog] [data-testid=road-picked] .road-picked-name").first().innerText({ timeout: 1000 }).catch(() => "");
      await p.getByRole("button", { name: "Save & Close" }).click();
      await p.waitForSelector("[data-testid^=kind-chip-]", { state: "attached", timeout: 60000 });
      await p.waitForTimeout(2500);
      if (phase === "sides") {
        await p.locator("label.nyq-answer:has([data-testid=kind-chip-shoulder])").click();
        await p.waitForTimeout(1200);
        await p.locator("[data-testid=where-questions] .nyq-card .nyq-foot > button:last-child").click();
      }
      const text = WANT[phase];
      await p.waitForFunction((t) => document.body.innerText.includes(t), text, { timeout: 30000 }).catch(() => {});
      const got = await p.evaluate((t) => {
        const all = [...document.querySelectorAll("body *")].filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.includes(t.slice(0, 20))));
        const e = all[0];
        if (!e) return null;
        const cs = getComputedStyle(e);
        return { text: e.textContent.trim(), cls: e.className, font: cs.fontFamily.split(",")[0], size: cs.fontSize, visible: e.getBoundingClientRect().height > 0 };
      }, text);
      const ok = !!got && got.text === text && got.visible;
      if (!ok) fails++;
      console.log(`${w}x${h} ${phase}: ${ok ? "PASS" : "FAIL"} road "${picked}" text ${got ? JSON.stringify(got.text) : "MISSING"} class "${got?.cls ?? ""}" font ${got?.font ?? ""} ${got?.size ?? ""}; page errors ${errs.length}`);
      if (OUT && got) await p.screenshot({ path: path.join(OUT, `${w}x${h}-491-${phase}.png`) });
    } catch (e) {
      fails++;
      console.log(`${w}x${h} ${phase}: FAIL ${oneLine(e).slice(0, 200)}`);
    }
    await ctx.close();
  }
}
await b.close();
console.log(fails ? `walk-491: ${fails} FAIL` : "walk-491: all PASS");
process.exit(fails ? 1 : 0);
