// #489 probe (read-only): pin, Edit -> Move -> search, then record what the
// dialog holds over time and what the check's own click hits.
// It runs the check's old search() (before #489's fix); log logs/probe-move-pick-before.txt.
// usage: SITE=https://www.conestruct.com GATE_BYPASS_TOKEN=... [OUT=<dir>] node probe-move-pick.mjs
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../../../scripts/x.mjs"));
const { newGatedContext, guardOutput, oneLine } = require("./gate.cjs");
guardOutput();
const { chromium } = require("playwright");
const SITE = process.env.SITE ?? "https://www.conestruct.com";
const OUT = process.env.OUT;
const [w, h] = [1198, 930];

const snap = (p) => p.evaluate(() => {
  const d = document.querySelector("[role=dialog]");
  if (!d) return { dialog: false };
  const btns = [...d.querySelectorAll("button")].filter((b) => /Colfax/.test(b.innerText || b.textContent));
  const save = [...d.querySelectorAll("button")].find((x) => /Save & Close/.test(x.innerText));
  return {
    dialog: true,
    head: (d.innerText.match(/PICK THE ROAD · \d+ FOUND/) || [null])[0],
    picked: !!d.querySelector("[data-testid=road-picked]"),
    saveDisabled: save ? save.disabled : null,
    colfaxButtons: btns.map((b) => ({ role: b.getAttribute("role"), checked: b.getAttribute("aria-checked"), cls: b.className.slice(0, 40), text: (b.innerText || "").replace(/\s+/g, " ").slice(0, 60), w: Math.round(b.getBoundingClientRect().width) })),
    searchVal: d.querySelector("input[aria-label='Address or intersection search']")?.value ?? null,
  };
});

const b = await chromium.launch();
try {
  const ctx = await newGatedContext(b, SITE, { viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const log = (...a) => console.log(...a);
  p.on("request", (r) => { if (/road-bearing|geocod|search/i.test(r.url())) log(`  t=${Date.now() - T0} req ${r.method()} ${new URL(r.url()).pathname}`); });
  p.on("response", (r) => { if (/road-bearing/i.test(r.url())) log(`  t=${Date.now() - T0} resp ${r.status()} ${new URL(r.url()).pathname}`); });
  let T0 = Date.now();
  await p.goto(`${SITE}/sandbox`, { waitUntil: "networkidle", timeout: 240000 });
  await p.waitForSelector(".a-open .a-head", { timeout: 120000 });
  await p.getByRole("button", { name: "Pick on map" }).click();
  await p.waitForTimeout(1500);
  await p.getByLabel("Address or intersection search").fill("1550 E Colfax Ave, Denver");
  await p.getByRole("button", { name: "SEARCH" }).click();
  await p.waitForFunction(() => /PICK THE ROAD · \d+ FOUND/.test(document.querySelector("[role=dialog]")?.innerText ?? ""), null, { timeout: 90000 });
  await p.waitForTimeout(1500);
  log("first pin:", JSON.stringify(await snap(p)));
  await p.getByRole("dialog").getByRole("radio", { name: /East Colfax Avenue/ }).first().click();
  await p.waitForTimeout(1000);
  log("first pin after radio click:", JSON.stringify(await snap(p)));
  await p.getByRole("button", { name: "Save & Close" }).click();
  await p.waitForSelector("[role=dialog]", { state: "detached", timeout: 30000 });
  await p.waitForSelector("[data-testid^=kind-chip-]", { state: "attached", timeout: 60000 });
  await p.waitForTimeout(2500);
  await p.locator("[data-testid=where-edit]").click();
  await p.locator("[data-testid=move-action-start]").click();
  T0 = Date.now();
  log("--- Move opened");
  // The check's own search(), instrumented.
  await p.waitForTimeout(1500);
  log(`t=${Date.now() - T0} before search:`, JSON.stringify(await snap(p)));
  await p.getByLabel("Address or intersection search").fill("1600 E Colfax Ave, Denver");
  await p.getByRole("button", { name: "SEARCH" }).click();
  log(`t=${Date.now() - T0} search clicked:`, JSON.stringify(await snap(p)));
  await p.waitForFunction(() => {
    const d = document.querySelector("[role=dialog]");
    const save = [...(d?.querySelectorAll("button") ?? [])].find((x) => /Save & Close/.test(x.innerText));
    return /PICK THE ROAD · \d+ FOUND|Which road/i.test(d?.innerText ?? "") || (save && !save.disabled);
  }, null, { timeout: 90000 });
  log(`t=${Date.now() - T0} check's wait returned:`, JSON.stringify(await snap(p)));
  await p.waitForTimeout(1500);
  const want = p.getByRole("dialog").locator("button", { hasText: /Colfax/ });
  log(`t=${Date.now() - T0} check's locator count=${await want.count()}`, JSON.stringify(await snap(p)));
  if (await want.count()) {
    try { await want.first().click({ timeout: 10000 }); log("  check's click: ok"); } catch (e) { log("  check's click threw:", oneLine(e).slice(0, 300)); }
  }
  for (let i = 0; i < 12; i++) {
    await p.waitForTimeout(1000);
    log(`t=${Date.now() - T0}`, JSON.stringify(await snap(p)));
  }
  if (OUT) await p.screenshot({ path: `${OUT}/probe-1198-after.png` });
  await ctx.close();
} finally {
  await b.close();
}
