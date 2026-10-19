// landing-form-polish browser run (cc-prompt-form-polish.md "Checks").
//   - The send section at 1440, 1280 and 390: screenshot, Kind of work's
//     row count and room left at the row's end, the Hours control's outer
//     height beside Side of the road and Length, sideways scroll.
//   - Hours at 1440 in four states (rest, hover, selected, keyboard
//     focus), cropped at device scale 1 and 1.25.
//   - The top edge at device scale 1, 1.25 and 1.5 over eight scroll
//     offsets: the colour of the rows at the Hours control's top edge and
//     at Length's (the reference border).  Headless screenshots at a
//     fractional scale resample, so read Hours against Length there, not
//     against the rule colour (rulings.md P2).
// The basics (axe, contrast, targets, page errors) are measure-lean.cjs.
//
//   AUDIT_OUT=<dir> node measure-form.cjs <base>
const { chromium, fs, path } = require("../../../scripts/audit-lib.js");

const [BASE = "http://localhost:3149"] = process.argv.slice(2);
const OUT = process.env.AUDIT_OUT;
if (!OUT) throw new Error("AUDIT_OUT is required");
fs.mkdirSync(OUT, { recursive: true });
const log = (s) => {
  console.log(s);
  fs.appendFileSync(path.join(OUT, "form.txt"), s + "\n");
};
fs.writeFileSync(path.join(OUT, "form.txt"), "");

// Colours of a 1 px column through a screenshot, top to bottom.
async function column(decoder, buf) {
  return decoder.evaluate(async (b64) => {
    const bmp = await createImageBitmap(await (await fetch("data:image/png;base64," + b64)).blob());
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const g = c.getContext("2d");
    g.drawImage(bmp, 0, 0);
    const d = g.getImageData(1, 0, 1, bmp.height).data;
    const out = [];
    for (let i = 0; i < d.length; i += 4) out.push(((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]).toString(16).padStart(6, "0"));
    return out.join(" ");
  }, buf.toString("base64"));
}

async function toSend(p) {
  await p.goto(BASE + "/", { waitUntil: "networkidle" });
  await (await p.$("#send")).scrollIntoViewIfNeeded();
  await p.waitForTimeout(2500); // the section's scroll-in
}

(async () => {
  const browser = await chromium.launch();
  const decoder = await browser.newPage();

  for (const w of [1440, 1280, 390]) {
    const p = await browser.newPage({ viewport: { width: w, height: 900 } });
    await toSend(p);
    const m = await p.evaluate(() => {
      const r = (s) => document.querySelector(s).getBoundingClientRect();
      const opts = [...document.querySelectorAll(".lv-opt")].map((o) => o.getBoundingClientRect());
      const box = r(".lv-opts");
      return {
        rows: new Set(opts.map((o) => Math.round(o.top))).size,
        room: +(box.right - Math.max(...opts.map((o) => o.right))).toFixed(1),
        optH: opts.map((o) => o.height),
        labels: [...document.querySelectorAll(".lv-opt-title")].map((t) => t.textContent),
        font: getComputedStyle(document.querySelector(".lv-opt-title")).fontSize,
        form: +r(".lv-form").width.toFixed(1),
        aside: +r(".lv-compare-aside").width.toFixed(1),
        hours: r(".lv-segs").height,
        side: r("#c-side").height,
        length: r("#c-length").height,
        hoursTop: +r(".lv-segs").top.toFixed(2),
        sideTop: +r("#c-side").top.toFixed(2),
        overflow: [...document.querySelectorAll("#send *")].filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== "visible").map((e) => e.id || e.className),
        scrollW: document.documentElement.scrollWidth,
      };
    });
    log(`${w}: Kind of work rows ${m.rows} · room at the row's end ${m.room} px · option heights ${m.optH.join("/")} · label font ${m.font} · labels ${JSON.stringify(m.labels)} · form ${m.form} · aside ${m.aside} · Hours ${m.hours} px (top ${m.hoursTop}) · Side ${m.side} px (top ${m.sideTop}) · Length ${m.length} px · clipped overflow ${JSON.stringify(m.overflow)} · scroll width ${m.scrollW}`);
    await (await p.$("#send")).screenshot({ path: path.join(OUT, `form-${w}.png`) });
    await p.close();
  }

  for (const dsf of [1, 1.25]) {
    const p = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: dsf });
    await toSend(p);
    const segs = await p.$(".lv-segs");
    const shot = async (state) => {
      const b = await segs.boundingBox();
      await p.screenshot({ path: path.join(OUT, `hours-${state}-${dsf}x.png`), clip: { x: b.x - 8, y: b.y - 30, width: b.width + 16, height: b.height + 38 } });
    };
    await shot("1-rest");
    await p.hover(".lv-seg:nth-child(2)");
    await shot("2-hover-night");
    await p.mouse.move(0, 0);
    await p.click(".lv-seg:nth-child(1)");
    await p.mouse.move(0, 0);
    await p.evaluate(() => document.activeElement.blur());
    await shot("3-selected-daytime");
    await p.evaluate(() => document.querySelectorAll("input[name=hours]").forEach((i) => (i.checked = false)));
    await p.focus("#c-length");
    await p.keyboard.press("Tab");
    const f = await p.evaluate(() => `${document.activeElement.name}=${document.activeElement.value} focus-visible ${document.activeElement.matches(":focus-visible")}`);
    await shot("4-keyboard-focus");
    log(`hours states at ${dsf}x: rest, hover (Night), selected (Daytime), keyboard focus (${f})`);
    await p.close();
  }

  for (const dsf of [1, 1.25, 1.5]) {
    const p = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: dsf });
    await toSend(p);
    for (const dy of [0, 0.25, 0.5, 0.75, 3, 7, 11, 13]) {
      await p.evaluate((dy) => window.scrollTo(0, document.querySelector(".lv-segs").getBoundingClientRect().top + scrollY - 400 + dy), dy);
      await p.waitForTimeout(300);
      const cols = [];
      for (const sel of [".lv-segs", "#c-length"]) {
        const b = await (await p.$(sel)).boundingBox();
        cols.push(await column(decoder, await p.screenshot({ clip: { x: b.x + 20, y: b.y - 3, width: 4, height: 7 } })));
      }
      log(`edge ${dsf}x scroll+${dy}: Hours [${cols[0]}] · Length [${cols[1]}]`);
    }
    await p.close();
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
