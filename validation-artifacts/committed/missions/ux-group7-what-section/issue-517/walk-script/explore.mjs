// Exploration only: reach the What band on E Colfax and dump it.
import { createRequire } from "node:module";
import path from "node:path";
const WT = "C:/Users/rtmak/Documents/traffic-control-tool/.claude/worktrees/issue-517";
const OUT = "C:/Users/rtmak/Documents/traffic-control-tool/validation-artifacts-extra/ux-group7-what-section/issue-517/extra-crops";
const require = createRequire(path.join(WT, "scripts", "gate.cjs"));
const { newGatedContext, guardOutput } = require("./gate.cjs");
guardOutput();
const { chromium } = require("playwright");
const SITE = "http://localhost:3000";
const b = await chromium.launch();
try {
  const ctx = await newGatedContext(b, SITE, { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.goto(`${SITE}/sandbox`, { waitUntil: "networkidle", timeout: 240000 });
  await p.waitForSelector(".a-open .a-head", { timeout: 120000 });
  await p.getByRole("button", { name: "Pick on map" }).first().click();
  await p.waitForSelector("[role=dialog]");
  await p.waitForTimeout(1500);
  const t = p.locator("[role=dialog] button", { hasText: "Or enter coordinates manually" });
  if (await t.count()) await t.click();
  await p.getByLabel("Latitude").fill("39.73997");
  await p.getByLabel("Longitude").fill("-104.96632");
  await p.waitForSelector("[data-testid=road-pick-panel]", { timeout: 60000 });
  await p.waitForTimeout(2000);
  await p.locator("[role=dialog] [role=radio]", { hasText: "East Colfax Avenue" }).click();
  await p.waitForTimeout(1500);
  await p.getByRole("button", { name: "Save and close" }).click();
  await p.waitForSelector("[role=dialog]", { state: "detached" });
  await p.waitForSelector("[data-testid^=kind-chip-]", { state: "attached", timeout: 60000 });
  await p.waitForTimeout(1500);
  await p.locator(`label.nyq-answer:has([data-testid=kind-chip-${process.env.KIND ?? "shoulder"}])`).click();
  await p.waitForTimeout(1200);
  const foot = p.locator("[data-testid=where-questions] .nyq-card .nyq-foot > button:last-child");
  if (!/Confirm and lay out/.test(await foot.innerText())) await foot.click();
  await p.waitForSelector("[data-testid=side-option]", { state: "attached", timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(2500);
  await p.locator("[data-testid=where-questions] label.nyq-answer").first().click();
  await p.waitForTimeout(2000);
  await p.locator("[data-testid=where-confirm]").click();
  await p.waitForSelector("[data-testid=band-what]", { timeout: 90000 });
  await p.waitForTimeout(4000);
  console.log(await p.locator("[data-testid=band-what]").innerText());
  console.log("STORAGE", await p.evaluate(() => Object.keys(localStorage).join(",") + " | " + Object.keys(sessionStorage).join(",")));
  await p.locator("[data-testid=band-what]").screenshot({ path: path.join(OUT, "explore-1440.png") });
} finally {
  await b.close();
}
