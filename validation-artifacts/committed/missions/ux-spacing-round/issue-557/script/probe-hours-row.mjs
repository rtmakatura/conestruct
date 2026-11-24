// #557 f: where the hours row's sentence, link and record line sit, at each
// size.  Local dev server, read-only, headless.  Run on the base
// (WALK_MODE=before) and on the final code (WALK_MODE=after); it writes
// ../hours-row-<mode>.json.
//   WALK_SITE=http://localhost:3557 WALK_MODE=after node probe-hours-row.mjs
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { open, pin, confirm, lb, settled, SITE, oneLine } from "../../issue-555/script/lib.mjs";

const EV = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MODE = process.env.WALK_MODE === "before" ? "before" : "after";
const out = { site: SITE, mode: MODE, sizes: {} };
for (const [label, w, h] of [["1440", 1440, 900], ["1198", 1198, 930], ["390", 390, 844]]) {
  const { b, p } = await open(w, h);
  try {
    await pin(p);
    await confirm(p);
    if (!(await p.getByTestId("what-hours-all").count())) {
      if (!(await p.locator("#what-jurisdiction").isVisible().catch(() => false))) await p.getByTestId("what-measured-toggle").click();
      await p.waitForTimeout(600);
      await lb(p, "what-jurisdiction", "denver");
      await settled(p);
    }
    out.sizes[label] = await p.evaluate(() => {
      const r2 = (n) => Math.round(n * 100) / 100;
      const row = document.querySelector("[data-testid=what-hours]");
      const rr = row.getBoundingClientRect();
      const rel = (e) => { const r = e.getBoundingClientRect(); return { l: r2(r.left - rr.left), t: r2(r.top - rr.top), w: r2(r.width), h: r2(r.height) }; };
      // The first line box of a text run, relative to the row.
      const ink = (e) => { const rg = document.createRange(); rg.selectNodeContents(e); const r = rg.getClientRects()[0]; return { t: r2(r.top - rr.top), b: r2(r.bottom - rr.top) }; };
      const text = row.querySelector(".w-hours-text");
      const link = row.querySelector("[data-testid=what-hours-all]");
      const slot = row.querySelector("[data-testid=what-hours-slot]");
      const band = document.querySelector("[data-testid=band-what]");
      return {
        row: { h: r2(rr.height), align: getComputedStyle(row).alignItems, padding: getComputedStyle(row).padding },
        sentence: { ...rel(text), ink: ink(text), text: text.textContent },
        link: { ...rel(link), ink: ink(link), marginTop: getComputedStyle(link).marginTop, text: link.textContent },
        slot: rel(slot),
        wrapped: ink(link).t >= ink(text).b,
        sentenceInkToLinkTop: r2(rel(link).t - ink(text).b),
        inkOffset: r2(ink(link).t - ink(text).t),
        bandHeight: r2(band.getBoundingClientRect().height),
      };
    });
  } catch (e) {
    out.sizes[label] = { error: oneLine(e).slice(0, 300) };
  } finally {
    await b.close();
  }
  console.log(label, MODE, JSON.stringify(out.sizes[label]));
}
fs.writeFileSync(path.join(EV, `hours-row-${MODE}.json`), JSON.stringify(out, null, 1));
