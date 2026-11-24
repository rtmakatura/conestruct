// #557 e: the small aerial's zoom stack in its tallest state, the tap
// question (the bar across the top, "Edit on map" and the zoom under it,
// "Use the big map instead" in the foot) with Reset showing.  Local dev
// server, read-only, headless.  Every pair of controls and lines on the
// frame is checked for overlap (whole px; touching edges don't count).
//   WALK_SITE=http://localhost:3557 WALK_MODE=after node shots-557-tap.mjs [labels]
// Sizes: the three ruled ones, plus two between them where the band is one
// column and the frame is 300 px tall (CHOSEN: 768x900 and 600x900).
// WALK_MODE=before writes measures-tap-before.json and puts its crops in the
// extra folder; after writes measures-tap.json and ../crops.
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { open, pin, SITE, MAIN, oneLine } from "../../issue-555/script/lib.mjs";

const EV = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MODE = process.env.WALK_MODE === "before" ? "before" : "after";
const EXTRA = path.join(MAIN, "validation-artifacts-extra/ux-spacing-round/issue-557");
const CROPS = MODE === "before" ? path.join(EXTRA, "before") : path.join(EV, "crops");
const ONLY = process.argv[2];
const SIZES = [["1440", 1440, 900], ["1198", 1198, 930], ["768", 768, 900], ["600", 600, 900], ["390", 390, 844]].filter(([label]) => !ONLY || ONLY.split(",").includes(label));
fs.mkdirSync(CROPS, { recursive: true });
const out = { site: SITE, mode: MODE, sizes: {} };

const aerial = (p) => p.evaluate(() => {
  const frame = document.querySelector("[data-testid=band-aerial-frame]");
  const root = frame?.closest(".a-aerial") ?? frame?.parentElement;
  if (!frame || !root) return null;
  const shown = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden" && getComputedStyle(e).display !== "none"; };
  const fr = frame.getBoundingClientRect();
  const name = (e) => e.getAttribute("data-testid") ?? e.getAttribute("aria-label") ?? String(e.className).split(" ")[0];
  const things = [...root.querySelectorAll(".a-aerial-zbtn, .a-aerial-edit, .a-aerial-bar, .a-aerial-bigmap, .a-aerial-toggle, .a-aerial-held, .a-aerial-legend, .a-aerial-note, [data-testid=band-aerial-logo], [data-testid=band-aerial-attribution]")].filter(shown);
  const box = (e) => { const r = e.getBoundingClientRect(); return { name: name(e), l: Math.round(r.left - fr.left), t: Math.round(r.top - fr.top), r: Math.round(r.right - fr.left), b: Math.round(r.bottom - fr.top), w: Math.round(r.width * 100) / 100, h: Math.round(r.height * 100) / 100 }; };
  const bs = things.map(box);
  const overlaps = [];
  for (let i = 0; i < bs.length; i += 1) for (let j = i + 1; j < bs.length; j += 1) {
    const a = bs[i], c = bs[j];
    if (things[i].contains(things[j]) || things[j].contains(things[i])) continue;
    if (a.l < c.r && c.l < a.r && a.t < c.b && c.t < a.b) overlaps.push(`${a.name} x ${c.name}`);
  }
  const band = document.querySelector("[data-testid=band-where]");
  return { frame: { w: Math.round(fr.width * 100) / 100, h: Math.round(fr.height * 100) / 100 }, hasBar: frame.classList.contains("has-bar"), bar: root.querySelector(".a-aerial-bar")?.textContent.trim().replace(/\s+/g, " ") ?? null, boxes: bs, overlaps, bandHeight: band ? Math.round(band.getBoundingClientRect().height * 100) / 100 : null };
});

for (const [label, w, h] of SIZES) {
  const { b, p } = await open(w, h);
  const L = (out.sizes[label] = { viewport: [w, h], errors: [] });
  try {
    await pin(p);
    await p.locator("label.nyq-answer:has([data-testid=kind-chip-near_intersection])").first().click();
    await p.waitForTimeout(1500);
    await p.locator("[data-testid=where-questions] .nyq-card .nyq-foot > button:last-child").click();
    await p.waitForSelector("[data-testid=band-aerial-bar]", { timeout: 30000 });
    await p.waitForTimeout(2500);
    L.tapQuestion = await aerial(p);
    const zin = p.locator(".a-aerial-zbtn[aria-label='Zoom in']:visible");
    L.zoomShown = await zin.count();
    if (L.zoomShown) {
      await zin.click();
      await p.waitForTimeout(2500);
      L.tapQuestionReset = await aerial(p);
    }
    await p.evaluate(() => document.querySelector("[data-testid=band-aerial-frame]").scrollIntoView({ block: "center" }));
    await p.waitForTimeout(500);
    await p.locator("[data-testid=band-aerial-frame]").screenshot({ path: path.join(CROPS, `557-aerial-tap-reset-${label}.png`) });
  } catch (e) {
    L.errors.push(oneLine(e).slice(0, 300));
  } finally {
    await b.close();
  }
  const show = (x) => (x ? `frame ${x.frame.w}x${x.frame.h} bar ${x.hasBar} overlaps ${x.overlaps.length ? x.overlaps.join("; ") : 0} | ${x.boxes.map((y) => `${y.name}[${y.l},${y.t},${y.r},${y.b}]`).join(" ")}` : "not measured");
  console.log(label, MODE, "errors:", L.errors.length ? L.errors.join(" | ") : "none");
  console.log("  tap question:", show(L.tapQuestion));
  console.log("  with Reset:  ", show(L.tapQuestionReset));
}
fs.writeFileSync(path.join(EV, MODE === "before" ? "measures-tap-before.json" : "measures-tap.json"), JSON.stringify(out, null, 1).replace(/[\u0080-￿]/g, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`));
