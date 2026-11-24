// Shared helpers for the spacing-round walk, copied from
// validation-artifacts-extra/spacing-round-before/script/lib.mjs (untracked, main checkout, not committed; only SITE
// differs).  Local dev server,
// read-only: nothing is saved, no download, no sign-in.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

export const MAIN = "C:/Users/rtmak/Documents/traffic-control-tool";
const envText = fs.readFileSync(path.join(MAIN, "conestruct/site/.env.local"), "utf8");
const tm = envText.match(/^\s*GATE_BYPASS_TOKEN\s*=\s*["']?([^"'\r\n]*)["']?\s*$/m);
if (!tm) throw new Error("GATE_BYPASS_TOKEN not in .env.local");
process.env.GATE_BYPASS_TOKEN = tm[1];
const require = createRequire(path.join(MAIN, "package.json"));
export const { newGatedContext, guardOutput, oneLine, gateHeaders, isSiteRequest } = require(path.join(MAIN, "scripts/gate.cjs"));
guardOutput();
export const { chromium } = require("playwright");
// #555: the "after" walk runs against a local dev server of the issue worktree
// (npx next dev -p 3555 in conestruct/site), read-only, headless.
export const SITE = process.env.WALK_SITE ?? "http://localhost:3555";
export const W = "[data-testid=band-what]";
export const D = "[data-testid=hours-dialog]";

export async function open(w, h) {
  const b = await chromium.launch();
  const ctx = await newGatedContext(b, SITE, { viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  return { b, ctx, p };
}
export async function loadPage(p) {
  await p.goto(`${SITE}/sandbox`, { waitUntil: "networkidle", timeout: 240000 });
  await p.waitForSelector(".a-open .a-head", { timeout: 120000 });
  await p.evaluate(() => document.fonts.ready);
}
export async function openWindow(p) {
  await p.getByRole("button", { name: /Pick on map|Edit on map/ }).first().click();
  await p.waitForSelector("[role=dialog] [data-testid=coords-bar]", { timeout: 30000 });
  await p.waitForFunction(() => document.querySelector("[role=dialog] .picker-map canvas"), null, { timeout: 60000 });
  await p.waitForTimeout(3000);
}
export const searchBox = (p) => p.locator("[role=dialog]").getByLabel("Address, intersection or coordinates search");
// The road list, or the road service's "Try again" (pressed up to 4 times).
export async function roadList(p) {
  const panel = p.locator("[role=dialog] [data-testid=road-pick-panel]");
  const again = p.locator("[role=dialog] [data-testid=road-lookup-status]").getByRole("button", { name: "Try again" });
  for (let i = 0; ; i += 1) {
    await panel.or(again).first().waitFor({ timeout: 120000 });
    if ((await panel.count()) > 0 || i >= 4) break;
    await p.waitForTimeout(4000);
    await again.click();
    await p.waitForTimeout(500);
  }
}
export const settled = (p) => p.waitForFunction((sel) => {
  const t = document.querySelector(sel)?.innerText ?? "";
  return t && !/Checking/.test(t);
}, W, { timeout: 90000 }).catch(() => {});
export async function lb(p, id, value) {
  await p.locator(`#${id}`).click();
  await p.waitForSelector("[role=listbox]", { timeout: 5000 });
  await p.locator(`[role=listbox] [role=option][data-value="${value}"]`).first().click();
  await p.waitForTimeout(1500);
}
// Pin 1550 E Colfax Ave by search, Shoulder, the first side, confirm.
export async function pinAndConfirm(p, address = "1550 E Colfax Ave, Denver") {
  await pin(p, address);
  await confirm(p);
}
export async function pin(p, address = "1550 E Colfax Ave, Denver") {
  await loadPage(p);
  await openWindow(p);
  await searchBox(p).fill(address);
  await searchBox(p).press("Enter");
  await p.locator("[role=dialog] [data-testid=coords-bar]").getByText("Pin at").waitFor({ timeout: 45000 });
  await roadList(p);
  await p.waitForTimeout(2500);
  const want = p.getByRole("dialog").getByRole("radio", { name: /Colfax/ });
  if (await want.count()) await want.first().click();
  await p.waitForTimeout(2000);
  await p.getByRole("button", { name: /Save (&|and) [Cc]lose/ }).click();
  await p.waitForSelector("[role=dialog]", { state: "detached", timeout: 30000 }).catch(() => {});
  await p.waitForSelector("[data-testid^=kind-chip-]", { state: "attached", timeout: 60000 });
  await p.waitForTimeout(2500);
}
export async function confirm(p) {
  const pick = (testid) => p.locator(`label.nyq-answer:has([data-testid=${testid}])`).first().click();
  const nextBtn = () => p.locator("[data-testid=where-questions] .nyq-card .nyq-foot > button:last-child").click();
  await pick("kind-chip-shoulder");
  await p.waitForTimeout(1200);
  await nextBtn();
  await p.waitForSelector("[data-testid=side-option]", { state: "attached", timeout: 60000 });
  await p.waitForTimeout(1200);
  await pick("side-option");
  await p.waitForTimeout(1500);
  await p.locator("[data-testid=where-confirm]").click();
  await p.waitForSelector(W, { timeout: 120000 });
  await settled(p);
  await p.waitForTimeout(2000);
}
// Visible controls under 44 px on either side, inside `root`.
export const small = (p, root) => p.evaluate((root) => {
  const r2 = (n) => Math.round(n * 100) / 100;
  return [...document.querySelectorAll(`${root} button, ${root} a[href], ${root} input, ${root} select, ${root} [role=radio], ${root} [role=button], ${root} summary, ${root} label.nyq-answer`)]
    .map((c) => ({ c, r: c.getBoundingClientRect() }))
    .filter(({ r }) => r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44))
    .map(({ c, r }) => ({ tag: c.tagName.toLowerCase(), cls: String(c.className).slice(0, 50), testid: c.getAttribute("data-testid"), label: (c.getAttribute("aria-label") || c.textContent || "").trim().replace(/\s+/g, " ").slice(0, 50), w: r2(r.width), h: r2(r.height) }));
}, root);

export async function dates(p, a, b) {
  await p.locator("#what-date").click();
  await p.waitForSelector("[data-testid=date-picker]");
  for (const d of [a, b]) {
    for (let i = 0; i < 3 && !(await p.locator(`[data-testid=date-picker] [data-date='${d}']`).count()); i += 1) {
      await p.locator("[data-testid=date-picker]").getByRole("button", { name: "Next month" }).click();
      await p.waitForTimeout(400);
    }
    await p.locator(`[data-testid=date-picker] [data-date='${d}']`).click();
    await p.waitForTimeout(400);
  }
  if (await p.locator("[data-testid=date-picker]").count()) await p.keyboard.press("Escape");
  await p.waitForTimeout(1000);
}
export async function times(p, a, z) { await lb(p, "sched-start", a); await lb(p, "sched-end", z); await settled(p); await p.waitForTimeout(1500); }
