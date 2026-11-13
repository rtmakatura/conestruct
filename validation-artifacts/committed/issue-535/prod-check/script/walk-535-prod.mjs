// #535 production check (main af6fc7b).  The real site and the real
// backend, no stubs, read-only (nothing is saved; the fix and Undo change
// only the page's own state).  Flow from #526's prod walk
// (validation-artifacts/committed/missions/ux-group7b-guesses-hours/issue-526/
// prod-check/script/walk-526-prod.mjs): pin 1550 E Colfax Ave by search,
// Shoulder, the first side, confirm; dates Mon Nov 16 to Sun Nov 22 2026,
// hours 7 am to 5 pm (outside).  Then: the fix; a hand edit back outside
// (R2: the fix shows again under the record); a date change to Nov 23-27;
// Undo (R1: the times go back, the dates stay).
//   node walk-535-prod.mjs <main checkout> <committed crops dir>
// Env: GATE_BYPASS_TOKEN (sent as a header by scripts/gate.cjs only).
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const [MAIN, CROPS] = process.argv.slice(2);
const require = createRequire(path.join(MAIN, "package.json"));
if (!process.env.GATE_BYPASS_TOKEN) throw new Error("GATE_BYPASS_TOKEN not set");
const { newGatedContext, guardOutput, oneLine } = require(path.join(MAIN, "scripts/gate.cjs"));
guardOutput();
const { chromium } = require("playwright");
const AXE = fs.readFileSync(path.join(MAIN, "conestruct/site/node_modules/axe-core/axe.min.js"), "utf8");
const SITE = "https://www.conestruct.com";
const SIZES = [[1440, 900], [1198, 930], [390, 844]];
const W = "[data-testid=band-what]";
const D = "[data-testid=hours-dialog]";
fs.mkdirSync(CROPS, { recursive: true });
const out = [];

for (const [w, h] of SIZES) {
  const b = await chromium.launch();
  const r = { size: `${w}x${h}`, steps: {}, errors: [] };
  try {
    const ctx = await newGatedContext(b, SITE, { viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    const consoleErrors = [];
    p.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 120)); });
    const text = async (sel) => ((await p.locator(sel).first().innerText().catch(() => "")) || "").replace(/\s+/g, " ").trim();
    const shot = async (name, sel) => {
      const loc = p.locator(sel).first();
      await loc.scrollIntoViewIfNeeded().catch(() => {});
      await p.waitForTimeout(400);
      await loc.screenshot({ path: path.join(CROPS, `prod-${name}-${w}.png`) });
      r.steps[name] = await text(sel);
    };
    const settled = () => p.waitForFunction((sel) => {
      const t = document.querySelector(sel)?.innerText ?? "";
      return t && !/Checking/.test(t);
    }, W, { timeout: 90000 }).catch(() => {});
    const lb = async (id, value) => {
      await p.locator(`#${id}`).click();
      await p.waitForSelector("[role=listbox]", { timeout: 5000 });
      await p.locator(`[role=listbox] [role=option][data-value="${value}"]`).first().click();
      await p.waitForTimeout(1500);
    };
    const times = async (a, z) => { await lb("sched-start", a); await lb("sched-end", z); await settled(); await p.waitForTimeout(1500); };
    const dates = async (a, z) => {
      await p.locator("#what-date").click();
      await p.waitForSelector("[data-testid=date-picker]");
      await p.locator(`[data-testid=date-picker] [data-date='${a}']`).click();
      await p.waitForTimeout(400);
      await p.locator(`[data-testid=date-picker] [data-date='${z}']`).click();
      await p.waitForTimeout(400);
      if (await p.locator("[data-testid=date-picker]").count()) await p.keyboard.press("Escape");
      await p.waitForTimeout(1000);
      await settled();
    };
    const state = async () => ({
      date: await text("#what-date"),
      start: await text("#sched-start"),
      end: await text("#sched-end"),
      record: (await p.getByTestId("what-hours-record").count()) ? await text("[data-testid=what-hours-record]") : null,
    });
    const pick = (testid) => p.locator(`label.nyq-answer:has([data-testid=${testid}])`).first().click();
    const nextBtn = () => p.locator("[data-testid=where-questions] .nyq-card .nyq-foot > button:last-child").click();

    // Pin by search, as #526's walk does.
    await p.goto(`${SITE}/sandbox`, { waitUntil: "networkidle", timeout: 240000 });
    await p.waitForSelector(".a-open .a-head", { timeout: 120000 });
    await p.getByRole("button", { name: "Pick on map" }).first().click();
    await p.waitForTimeout(1500);
    await p.getByLabel("Address or intersection search").fill("1550 E Colfax Ave, Denver");
    const roads = p.waitForResponse((x) => x.url().includes("/api/road-bearing"), { timeout: 90000 });
    await p.getByRole("button", { name: "SEARCH" }).click();
    await roads;
    await p.waitForFunction(() => {
      const d = document.querySelector("[role=dialog]");
      const save = [...(d?.querySelectorAll("button") ?? [])].find((x) => /Save (&|and) [Cc]lose/.test(x.innerText));
      return /PICK THE ROAD|Which road/i.test(d?.innerText ?? "") || (save && !save.disabled);
    }, null, { timeout: 90000 });
    await p.waitForTimeout(2000);
    const want = p.getByRole("dialog").getByRole("radio", { name: /Colfax/ });
    if (await want.count()) await want.first().click();
    await p.waitForTimeout(2000);
    await p.getByRole("button", { name: /Save (&|and) [Cc]lose/ }).click();
    await p.waitForSelector("[role=dialog]", { state: "detached", timeout: 30000 }).catch(() => {});
    await p.waitForSelector("[data-testid^=kind-chip-]", { state: "attached", timeout: 60000 });
    await p.waitForTimeout(2500);
    await pick("kind-chip-shoulder");
    await p.waitForTimeout(1200);
    await nextBtn();
    await p.waitForSelector("[data-testid=side-option]", { state: "attached", timeout: 60000 });
    await p.waitForTimeout(1200);
    await pick("side-option");
    await p.waitForTimeout(1500);
    await p.locator("[data-testid=where-confirm]").click();
    await p.waitForSelector(W, { timeout: 120000 });
    await settled();
    await p.waitForTimeout(2000);

    // Mon Nov 16 to Sun Nov 22, 7 am to 5 pm (outside).
    await dates("2026-11-16", "2026-11-22");
    await times("7", "17");
    r.before = await state();

    // The fix.
    await p.getByTestId("what-hours-all").click();
    await p.waitForSelector(D, { timeout: 10000 });
    r.fixOffered = (await p.getByTestId("hours-fix").count()) ? await text("[data-testid=hours-fix]") : null;
    await p.getByTestId("hours-fix").click();
    await p.waitForTimeout(1500);
    await p.keyboard.press("Escape");
    await p.waitForTimeout(800);
    await settled();
    r.afterFix = await state();

    // R2: a hand edit back outside; the window shows the record and the fix.
    await lb("sched-start", "7");
    await settled();
    await p.waitForTimeout(1500);
    await p.getByTestId("what-hours-all").click();
    await p.waitForSelector(D, { timeout: 10000 });
    await p.waitForTimeout(600);
    await shot("dialog-record-and-fix", D);
    r.r2 = await p.evaluate(() => {
      const rec = document.querySelector("[data-testid=hours-fix-record]");
      const fix = document.querySelector("[data-testid=hours-fix]");
      const a = rec?.getBoundingClientRect();
      const z = fix?.getBoundingClientRect();
      return {
        record: rec?.textContent ?? null,
        fix: fix?.textContent ?? null,
        fixBelowRecord: !!(a && z && z.top >= a.bottom - 0.5),
        overlap: !!(a && z && a.left < z.right && z.left < a.right && a.top < z.bottom && z.top < a.bottom),
      };
    });
    if (!(await p.evaluate(() => !!window.axe))) await p.addScriptTag({ content: AXE });
    r.axe = await p.evaluate(async () => {
      const x = await window.axe.run({ include: [["[data-testid=hours-dialog]"]] }, { resultTypes: ["violations"] });
      return x.violations.map((v) => `${v.id}(${v.nodes.length})`);
    });
    await p.keyboard.press("Escape");
    await p.waitForTimeout(800);

    // R1: change the dates, then Undo; the times go back, the dates stay.
    await dates("2026-11-23", "2026-11-27");
    r.afterDateChange = await state();
    await shot("hours-row-before-undo", "[data-testid=what-hours]");
    await p.getByTestId("what-hours-undo").click();
    await p.waitForTimeout(1500);
    await settled();
    r.afterUndo = await state();
    await shot("after-undo", "[data-testid=cell-work-dates]");
    r.console_errors = consoleErrors.length;
    r.console_messages = consoleErrors;
  } catch (e) {
    r.errors.push(oneLine(e).slice(0, 300));
  } finally {
    await b.close();
  }
  out.push(r);
  console.log(`${r.size}: ${JSON.stringify(r)}`);
}
// ASCII-only JSON (non-ASCII as \u escapes), so no reader's code page can mis-decode it.
const ascii = JSON.stringify(out, null, 1).replace(/[\u0080-￿]/g, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`);
fs.writeFileSync(path.join(CROPS, "prod-walk.json"), `${ascii}\n`, "utf8");
