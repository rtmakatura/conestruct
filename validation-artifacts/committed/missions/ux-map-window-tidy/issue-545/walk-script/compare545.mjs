// #545: the attribution crops of the walk on 5737d8d2's code (before/)
// against the same crops of the walk on the fix (shots/), pixel by pixel.
//   node compare545.mjs <evidence dir>
// Each crop is the attribution's box with up to 16 px of map round it; the
// map differs from run to run, so pixels are counted twice: in the whole
// crop, and inside the attribution's own box with its rounded corners'
// squares left out (the box is opaque there).  The box's place and size in
// the crop come from each run's walk.json and must match between the runs.
// Writes compare.json beside the walks.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const [DIR] = process.argv.slice(2);
const { chromium } = createRequire("C:/Users/rtmak/Documents/traffic-control-tool/package.json")("playwright");
const read = (d) => JSON.parse(fs.readFileSync(path.join(DIR, d, "walk.json"), "utf8"));
const before = read("before");
const after = read("shots");
const b = await chromium.launch();
const out = [];
try {
  const page = await b.newPage();
  for (const rec of after) {
    const w = rec.size.split("x")[0];
    const was = before.find((r) => r.size === rec.size);
    for (const [state, key] of [["collapsed", "collapsed"], ["expanded", "expanded"], ["full-line", "asOpened"]]) {
      const name = `${w}-attrib-${state}.png`;
      const fa = path.join(DIR, "before", name);
      const fb = path.join(DIR, "shots", name);
      if (!fs.existsSync(fa) || !fs.existsSync(fb)) continue;
      const ca = was.attrib[key].container;
      const cb = rec.attrib[key].container;
      const radius = state === "full-line" ? 0 : Math.min(cb.h / 2, w === "390" ? 22 : 12);
      const r = await page.evaluate(async ([A, B, box]) => {
        const load = (s) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = `data:image/png;base64,${s}`; });
        const [ia, ib] = await Promise.all([load(A), load(B)]);
        if (ia.width !== ib.width || ia.height !== ib.height) return { sizeDiffers: `${ia.width}x${ia.height} vs ${ib.width}x${ib.height}` };
        const px = (i) => { const c = document.createElement("canvas"); c.width = i.width; c.height = i.height; const g = c.getContext("2d"); g.drawImage(i, 0, 0); return g.getImageData(0, 0, i.width, i.height).data; };
        const da = px(ia); const db = px(ib);
        const x1 = Math.ceil(box.x); const y1 = Math.ceil(box.y); const x2 = Math.floor(box.x + box.w); const y2 = Math.floor(box.y + box.h);
        const rad = Math.ceil(box.radius);
        let all = 0; let inBox = 0; let boxPixels = 0; let maxStepInBox = 0;
        for (let y = 0; y < ia.height; y += 1) {
          for (let x = 0; x < ia.width; x += 1) {
            const i = (y * ia.width + x) * 4;
            const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]), Math.abs(da[i + 3] - db[i + 3]));
            if (d) all += 1;
            const inside = x >= x1 && x < x2 && y >= y1 && y < y2;
            const corner = (x < x1 + rad || x >= x2 - rad) && (y < y1 + rad || y >= y2 - rad);
            if (inside && !corner) { boxPixels += 1; if (d) { inBox += 1; maxStepInBox = Math.max(maxStepInBox, d); } }
          }
        }
        return { crop: `${ia.width}x${ia.height}`, cropPixels: ia.width * ia.height, differInCrop: all, boxPixels, differInBox: inBox, maxStepInBox };
      }, [fs.readFileSync(fa).toString("base64"), fs.readFileSync(fb).toString("base64"), { x: 16, y: 16, w: cb.w, h: cb.h, radius }]);
      const row = { size: rec.size, state, file: name, boxBefore: `${ca.w}x${ca.h}`, boxAfter: `${cb.w}x${cb.h}`, cornerSquaresLeftOut: radius, ...r };
      out.push(row);
      console.log(`${rec.size} ${state}: box ${row.boxBefore} -> ${row.boxAfter} | ${r.sizeDiffers ? `crop sizes differ ${r.sizeDiffers}` : `inside the box ${r.differInBox}/${r.boxPixels} px differ (largest channel step ${r.maxStepInBox}); whole crop ${r.differInCrop}/${r.cropPixels}`}`);
    }
  }
} finally {
  await b.close();
}
fs.writeFileSync(path.join(DIR, "compare.json"), `${JSON.stringify(out, null, 1)}\n`, "utf8");
