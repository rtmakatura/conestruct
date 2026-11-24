// #555 walk, second part: the weekday ruler's end labels for the records
// whose allowed windows sit close together and that the jurisdiction list
// offers (Lakewood, Centennial), picked by hand as an operator can.  Loveland
// isn't in the list; E-470 is, but its windows are 4 hours apart and it
// wasn't walked.  The backend's real answers; local dev server, read-only,
// headless.
//   node shots-labels.mjs [widths]
// Crops go to ../crops, measures to ../measures-labels.json.
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { open, pin, confirm, dates, times, lb, settled, D, MAIN, oneLine } from "./lib.mjs";

const EV = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ONLY = process.argv[2];
const SIZES = [[1440, 900], [390, 844]].filter(([w]) => !ONLY || ONLY.split(",").includes(String(w)));
const out = {};
for (const [w, h] of SIZES) {
  const { b, p } = await open(w, h);
  const L = (out[w] = { errors: [] });
  try {
    await pin(p);
    await confirm(p);
    await dates(p, "2026-12-07", "2026-12-11");
    await times(p, "9", "15");
    for (const key of ["lakewood", "centennial"]) {
      if (!(await p.locator("#what-jurisdiction").isVisible().catch(() => false))) await p.getByTestId("what-measured-toggle").click();
      await p.waitForTimeout(600);
      await lb(p, "what-jurisdiction", key);
      await settled(p);
      await p.waitForTimeout(1500);
      if (!(await p.getByTestId("what-hours-all").count())) { L[key] = "no hours link"; continue; }
      await p.getByTestId("what-hours-all").click();
      await p.waitForSelector(D, { timeout: 10000 });
      await p.getByTestId("hours-view-day").click();
      await p.waitForTimeout(600);
      L[key] = await p.evaluate(() => {
        const r2 = (n) => Math.round(n * 100) / 100;
        const body = document.querySelector(".whd-body");
        const bb = body.getBoundingClientRect();
        const caps = [...document.querySelectorAll(".whd-cap")].map((e) => { const r = e.getBoundingClientRect(); return { text: e.textContent, left: r2(r.left - bb.left), right: r2(r.right - bb.left) }; }).sort((a, z) => a.left - z.left);
        return {
          title: document.querySelector(".whd-title").textContent,
          caps,
          gaps: caps.slice(1).map((c, i) => `${caps[i].text} | ${c.text}: ${r2(c.left - caps[i].right)} px`),
          insideBody: caps.every((c) => c.left >= -0.5 && c.right <= bb.width + 0.5),
          sideScroll: body.scrollWidth - body.clientWidth,
        };
      });
      await p.locator(D).screenshot({ path: path.join(EV, "crops", `555-labels-${key}-day-${w}.png`) });
      await p.keyboard.press("Escape");
      await p.waitForTimeout(600);
    }
  } catch (e) {
    L.errors.push(oneLine(e).slice(0, 400));
    await p.screenshot({ path: path.join(MAIN, "validation-artifacts-extra/ux-spacing-round/issue-555", `error-labels-${w}.png`) }).catch(() => {});
  } finally {
    await b.close();
  }
  console.log(w, Object.entries(L).filter(([k]) => k !== "errors").map(([k, v]) => `${k}: ${typeof v === "string" ? v : `${v.gaps.join("; ")}; inside ${v.insideBody}; side scroll ${v.sideScroll}`}`).join("\n  "), "errors:", L.errors.join(" | ") || "none");
}
fs.writeFileSync(path.join(EV, "measures-labels.json"), JSON.stringify(out, null, 1));
