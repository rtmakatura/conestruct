// #526 production check (main 6b6a850).  The real site and the real
// backend, no stubs, read-only (nothing is saved; the fix and Undo change
// only the page's own state).  Flow from the item's crop walk
// (validation-artifacts-extra/.../issue-526/walk526.mjs): pin 1550 E Colfax
// Ave by search, Shoulder, the first side, confirm; then in the What
// section: dates Mon Nov 16 to Sun Nov 22 2026, hours 9 am to 3 pm, the
// work-hours window (day and whole week), then 7 am to 5 pm (outside), the
// fix, a hand edit (P15: the record stays), and Undo.
//   node walk-526-prod.mjs <main checkout> <committed crops dir>
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
    const pick = (testid) => p.locator(`label.nyq-answer:has([data-testid=${testid}])`).first().click();
    const nextBtn = () => p.locator("[data-testid=where-questions] .nyq-card .nyq-foot > button:last-child").click();

    // Pin by search, as the crop walk does.
    await p.goto(`${SITE}/sandbox`, { waitUntil: "networkidle", timeout: 240000 });
    await p.waitForSelector(".a-open .a-head", { timeout: 120000 });
    r.inter = await p.evaluate(async () => { await document.fonts.ready; return [...document.fonts].some((f) => /inter/i.test(f.family) && f.status === "loaded"); });
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

    // Dates Mon Nov 16 to Sun Nov 22, hours 9 am to 3 pm.
    await p.locator("#what-date").click();
    await p.waitForSelector("[data-testid=date-picker]");
    await p.locator("[data-testid=date-picker] [data-date='2026-11-16']").click();
    await p.waitForTimeout(400);
    await p.locator("[data-testid=date-picker] [data-date='2026-11-22']").click();
    await p.waitForTimeout(400);
    if (await p.locator("[data-testid=date-picker]").count()) await p.keyboard.press("Escape");
    await p.waitForTimeout(1000);
    await times("9", "15");
    await shot("dates-week", "[data-testid=cell-work-dates]");
    await shot("hours-row", "[data-testid=what-hours]");

    // The window: day, then the whole week, with the caption measured.
    await p.getByTestId("what-hours-all").click();
    await p.waitForSelector(D, { timeout: 10000 });
    await shot("dialog-day", D);
    await p.getByTestId("hours-view-week").click();
    await shot("dialog-week", D);
    r.caption = await p.evaluate(() => {
      const dlg = document.querySelector("[data-testid=hours-dialog]").getBoundingClientRect();
      const cs = [...document.querySelectorAll("[data-testid=hours-week-no-record]")];
      const rs = cs.map((c) => c.getBoundingClientRect());
      return {
        n: cs.length,
        text: cs.map((c) => c.textContent),
        widths: rs.map((x) => Math.round(x.width)),
        fits: cs.every((c) => c.scrollWidth <= c.clientWidth + 0.5),
        inside: rs.every((x) => x.left >= dlg.left - 0.5 && x.right <= dlg.right + 0.5),
        overlap: rs.some((a, i) => rs.some((c, k) => k > i && a.left < c.right && c.left < a.right && a.top < c.bottom && c.top < a.bottom)),
        unchecked: document.querySelectorAll("[data-testid=hours-week-day][data-record=none] .whd-yours.is-unchecked").length,
        inkOnNone: document.querySelectorAll("[data-testid=hours-week-day][data-record=none] .whd-yours:not(.is-out):not(.is-unchecked)").length,
        sr: [...document.querySelectorAll("[data-testid=hours-week-day] .sr-only")].map((s) => s.textContent),
      };
    });
    if (!(await p.evaluate(() => !!window.axe))) await p.addScriptTag({ content: AXE });
    r.axe = await p.evaluate(async () => {
      const x = await window.axe.run({ include: [["[data-testid=hours-dialog]"]] }, { resultTypes: ["violations"] });
      return x.violations.map((v) => `${v.id}(${v.nodes.length})`);
    });
    await p.keyboard.press("Escape");
    await p.waitForTimeout(600);
    r.focusBack = await p.evaluate(() => document.activeElement?.getAttribute("data-testid"));

    // Outside (7 am to 5 pm), the fix, a hand edit (P15), Undo.
    await times("7", "17");
    await shot("dates-outside", "[data-testid=cell-work-dates]");
    r.nbsp = await p.evaluate(() => /\d (am|pm)/.test(document.querySelector("[data-testid=cell-work-dates]")?.textContent ?? ""));
    await p.getByTestId("what-hours-all").click();
    await p.waitForSelector(D, { timeout: 10000 });
    await p.getByTestId("hours-view-week").click();
    await p.waitForTimeout(400);
    r.srOutside = await p.evaluate(() => [...document.querySelectorAll("[data-testid=hours-week-day][data-in-job] .sr-only")].map((s) => s.textContent).filter((t) => /Outside:/.test(t)).length);
    await p.getByTestId("hours-view-day").click();
    const fixBtn = p.getByTestId("hours-fix");
    r.fixOffered = (await fixBtn.count()) ? await fixBtn.innerText() : null;
    if (r.fixOffered) {
      await fixBtn.click();
      await p.waitForTimeout(1500);
      await p.keyboard.press("Escape");
      await p.waitForTimeout(800);
      await settled();
      await shot("hours-row-fixed", "[data-testid=what-hours]");
      const fixedStart = await text("#sched-start");
      await lb("sched-start", "9");
      await settled();
      r.recordAfterHandEdit = await text("[data-testid=what-hours-record]");
      await p.getByTestId("what-hours-undo").click();
      await p.waitForTimeout(1500);
      await settled();
      r.afterUndo = { start: await text("#sched-start"), end: await text("#sched-end"), record: await p.getByTestId("what-hours-record").count(), fixedStart };
    }
    r.console_errors = consoleErrors.length;
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
