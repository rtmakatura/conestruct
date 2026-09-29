// R37 Part B, local end to end: the worktree's backend (uvicorn :8100) behind
// its frontend (next dev :3100).  Shoulder run on N Broadway (sweep.cjs's
// helpers): pin -> side -> kind -> Generate -> results.  At each state it
// records the page text and every em dash in it; after Generate it lists
// the site-adjustment citation chips.
const fs = require("fs");
const path = require("path");
const { chromium } = require("C:/Users/rtmak/Documents/traffic-control-tool/node_modules/playwright");
const { applyGate } = require("C:/Users/rtmak/Documents/traffic-control-tool/.claude/worktrees/unslop-public-copy/scripts/gate.cjs");

const SITE = "http://localhost:3100/sandbox";
const OUT = process.env.AUDIT_OUT;
const pin = { lat: "39.73370", lng: "-104.98753", kind: /shoulder/i };
fs.mkdirSync(OUT, { recursive: true });
const log = (s) => { console.log(s); fs.appendFileSync(path.join(OUT, "log.txt"), s + "\n"); };

async function openPickerAndPin(page) {
  await page.getByTestId("where-open-picker").first().click();
  await page.waitForTimeout(2500);
  await page.getByText(/Or enter coordinates manually/i).first().click();
  await page.getByLabel("Latitude", { exact: true }).fill(pin.lat);
  await page.getByLabel("Longitude", { exact: true }).fill(pin.lng);
  await page.keyboard.press("Tab");
  const t0 = Date.now();
  while (Date.now() - t0 < 60000) {
    const c = page.getByText(/SOUTHBOUND|NORTHBOUND|EASTBOUND|WESTBOUND/i).first();
    const none = page.getByText(/no road|set road properties manually/i).first();
    if (await c.count()) { await page.waitForTimeout(400); await c.click().catch(() => {}); break; }
    if (await none.count()) break;
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(4000);
}
async function openWhere(page) {
  if (await page.locator('[data-testid="side-option"]').count()) return;
  const w = page.getByTestId("fact-link-where").first();
  if (await w.count()) { await w.click(); await page.waitForTimeout(1200); }
}

// Every em dash in the visible text, minus a lone "—" (a missing value, R38 Q3).
async function dashes(page) {
  return page.evaluate(() => {
    const out = [];
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walk.nextNode())) {
      const t = n.textContent || "";
      if (!t.includes("\u2014")) continue;
      const el = n.parentElement;
      if (!el || el.closest("script,style,noscript")) continue;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      const trimmed = t.trim();
      out.push({ text: trimmed.slice(0, 160), lone: /^[—\s]*$/.test(trimmed) || /^\(?—\)?$/.test(trimmed) });
    }
    for (const a of document.querySelectorAll("[aria-label],[title],[placeholder],img[alt]")) {
      for (const k of ["aria-label", "title", "placeholder", "alt"]) {
        const v = a.getAttribute(k);
        if (v && v.includes("\u2014")) out.push({ text: `[${k}] ${v.slice(0, 160)}`, lone: /^[—\s]*$/.test(v.trim()) });
      }
    }
    return out;
  });
}
async function state(page, tag, name) {
  await page.waitForTimeout(800);
  const d = await dashes(page);
  const prose = d.filter((x) => !x.lone);
  await page.screenshot({ path: path.join(OUT, `${tag}-${name}.png`), fullPage: true });
  fs.writeFileSync(path.join(OUT, `${tag}-${name}.txt`), await page.evaluate(() => document.body.innerText));
  log(`${tag} ${name}: em dashes in prose ${prose.length}, lone missing-value "—" ${d.length - prose.length}`);
  for (const p of prose) log(`   ! ${p.text}`);
}

(async () => {
  const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
  for (const width of [1440, 390]) {
    const tag = `w${width}`;
    const page = await browser.newPage({ viewport: { width, height: width < 500 ? 820 : 1000 } });
    await applyGate(page, SITE);
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
    await page.goto(SITE, { waitUntil: "networkidle", timeout: 180000 });
    await state(page, tag, "1-fresh");
    await openPickerAndPin(page);
    await state(page, tag, "2-picker-pinned");
    await page.getByRole("button", { name: "Save & Close" }).click();
    await page.waitForTimeout(2000);
    await openWhere(page);
    await state(page, tag, "3-located-side-owed");
    const t0 = Date.now();
    while (Date.now() - t0 < 20000 && !(await page.locator('[data-testid="side-option"]').count())) await page.waitForTimeout(400);
    await page.locator('[data-testid="side-option"]').first().click();
    await page.waitForTimeout(1500);
    await openWhere(page);
    await page.getByRole("button", { name: pin.kind }).first().click();
    await page.waitForTimeout(500);
    await page.getByTestId("where-confirm").click();
    await page.waitForTimeout(2500);
    await state(page, tag, "4-laid-out");
    const gen = page.getByRole("button", { name: /^Generate plan$/ }).first();
    await gen.click({ timeout: 60000 });
    // Results: wait for the audit / device breakdown to settle.
    const t1 = Date.now();
    while (Date.now() - t1 < 180000) {
      const txt = await page.evaluate(() => document.body.innerText);
      if (/Plan generated|device schedule|Audit trail|AUDIT/i.test(txt) && !/Generating/i.test(txt)) break;
      await page.waitForTimeout(1500);
    }
    await page.waitForTimeout(6000);
    await state(page, tag, "5-generated");
    const chips = await page.evaluate(() => {
      const t = document.body.innerText;
      return [...new Set((t.match(/MUTCD § ?\d[\w.]*( p\. \d+)?/g) || []))].slice(0, 20);
    });
    log(`${tag} citation-like text after generate: ${JSON.stringify(chips)}`);
    log(`${tag} page errors: ${errors.length ? errors.join(" | ") : "none"}`);
    await page.close();
  }
  await browser.close();
})().catch((e) => { log("E2E ERROR: " + String(e).slice(0, 400)); process.exit(1); });
