// node zoom.cjs out.png scale a.png b.png ... — nearest-neighbour enlargements side by side, labelled.
const { chromium } = require("C:/Users/rtmak/Documents/traffic-control-tool/node_modules/playwright");
const fs = require("fs");
const [out, scale, ...files] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const imgs = files.map((f) => ({ name: f.split(/[\\/]/).pop(), data: "data:image/png;base64," + fs.readFileSync(f).toString("base64") }));
  await p.setContent(`<body style="margin:0;background:#000;color:#fff;font:12px monospace"><div id=w style="display:flex;gap:12px;flex-wrap:wrap;padding:8px"></div></body>`);
  const size = await p.evaluate(async ({ imgs, s }) => {
    const w = document.getElementById("w");
    for (const im of imgs) {
      const i = new Image(); i.src = im.data; await i.decode();
      const c = document.createElement("canvas"); c.width = i.width * s; c.height = i.height * s;
      const x = c.getContext("2d"); x.imageSmoothingEnabled = false; x.drawImage(i, 0, 0, c.width, c.height);
      const d = document.createElement("div"); d.textContent = im.name; d.appendChild(document.createElement("br")); d.appendChild(c); w.appendChild(d);
    }
    const r = w.getBoundingClientRect(); return { w: Math.ceil(r.width), h: Math.ceil(r.height) };
  }, { imgs, s: +scale });
  await p.setViewportSize({ width: Math.max(400, size.w + 16), height: size.h + 16 });
  await p.screenshot({ path: out, fullPage: true });
  await b.close();
})();
