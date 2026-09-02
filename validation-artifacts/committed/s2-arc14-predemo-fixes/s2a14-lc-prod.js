/** s2-arc14 live checks (Refs #230 #231 #232 #233) — READ-ONLY, sha-gated.
 *
 *  Prologue (s2-arc12 pattern): UTC timestamp, BASE, the live /healthz
 *  JSON verbatim, `git rev-parse origin/main` after a fetch, and the
 *  gate healthz sha == origin/main — the run ABORTS on a mismatch when
 *  BASE is production.  Against a local dev server (BASE=http://…) the
 *  prologue records healthz and `git rev-parse HEAD` instead and the
 *  served build is the working tree; the gate line says which mode ran.
 *
 *   A  #230  the picker's manual boxes typed KEY BY KEY (Playwright
 *            keyboard) hold what was typed; the last /api/road-bearing
 *            POST carries the full pair; the U+2212 pair pasted splits.
 *   B  #231  every rail entry's jump lands its anchor header below the
 *            nav (and within the rail's clearance band); the focused
 *            element after a jump is the anchor (#193); after a real
 *            Generate the results heading lands below the nav.
 *   C  #232  the rail, when stuck, sits at/below the nav's bottom edge;
 *            a scroll walk finds no leaf text under any frame edge.
 *   D  #233  the rail renders one row for shoulder / flagger /
 *            near-intersection, pre-pin and post-location.
 *
 *  Captures per viewport (rail per kind, jump landing, frame band) and
 *  the Generate landing land in <OUT_DIR>.  No saves, no DB writes.
 *  Run from anywhere:
 *    NODE_PATH=<repo>/node_modules node validation-artifacts/committed/s2-arc14-predemo-fixes/s2a14-lc-prod.js
 *  BASE defaults to https://www.conestruct.com; OUT_DIR to outS2A14Prod
 *  beside this file.
 */
const { chromium } = require("playwright");
const { execSync } = require("child_process");
const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..", "..");
const BASE = (process.env.BASE || "https://www.conestruct.com").replace(/\/$/, "");
const IS_PROD = /conestruct\.com/.test(BASE);
const OUT = path.join(__dirname, process.env.OUT_DIR || "outS2A14Prod");
fs.mkdirSync(OUT, { recursive: true });
const HEALTHZ = "https://rtmakatura--conestruct-render-fastapi-app.modal.run/healthz";
const VIEWPORTS = [
  [1280, 720],
  [1366, 650],
  [1440, 900],
  [1920, 1080],
];
const KINDS = [
  ["shoulder", "Shoulder work"],
  ["flagger", "Flagger lane closure"],
  ["ni", "Lane closure near intersection"],
];
const PIN = { lat: "39.739776", lng: "-104.963483" }; // Race ∩ Colfax, the arc11 pin

const lines = [];
let failures = 0;
function log(msg) {
  const stamp = new Date().toISOString();
  lines.push("- `" + stamp + "` " + msg);
  console.log(stamp + " " + msg);
}
function assert(name, cond, extra) {
  if (!cond) failures++;
  log((cond ? "**PASS**" : "**FAIL**") + " — " + name + (extra ? " (" + extra + ")" : ""));
}
function writeMd() {
  fs.writeFileSync(
    path.join(OUT, "s2a14-lc.md"),
    "# s2-arc14 live checks (Refs #230 #231 #232 #233)\n\n" + lines.join("\n") + "\n",
  );
}
function get(url) {
  return new Promise((resolve, reject) => {
    (url.startsWith("https") ? https : http)
      .get(url, (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString("utf8") }));
      })
      .on("error", reject);
  });
}
// A dev server recompiles on first hit per route; give it three tries.
async function gotoSandbox(page) {
  for (let i = 0; i < 3; i++) {
    try {
      await page.goto(BASE + "/sandbox", { waitUntil: "networkidle", timeout: 60000 });
      await page.waitForTimeout(600);
      return;
    } catch (e) {
      if (i === 2) throw e;
      log("goto retry " + (i + 1) + ": " + String(e).slice(0, 80));
    }
  }
}
async function shot(page, name, clip) {
  await page.screenshot({ path: path.join(OUT, name), clip });
}

const railGeom = (page) =>
  page.evaluate(() => {
    const r = (el) => {
      const b = el.getBoundingClientRect();
      return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
    };
    const rail = document.querySelector(".progress-rail");
    if (!rail) return null;
    const entries = Array.from(rail.querySelectorAll(".rail-entry")).map((e) => ({
      text: (e.textContent || "").replace(/\s+/g, " ").trim(),
      rect: r(e),
    }));
    return { rail: r(rail), rows: new Set(entries.map((e) => e.rect.y)).size, entries };
  });

const chrome = (page) =>
  page.evaluate(() => {
    const nav = document.querySelector("nav.sticky");
    const rail = document.querySelector(".progress-rail");
    const f = document.querySelector(".workbench-frame");
    const b = (el) => (el ? el.getBoundingClientRect() : null);
    return {
      navBottom: nav ? Math.round(b(nav).bottom) : null,
      railTop: rail ? Math.round(b(rail).top) : null,
      railBottom: rail ? Math.round(b(rail).bottom) : null,
      frame: f ? { top: b(f).top, bottom: b(f).bottom, left: b(f).left, right: b(f).right, borderBottom: getComputedStyle(f).borderBottomStyle } : null,
      scrollY: Math.round(window.scrollY),
    };
  });

// Leaf text under a frame edge, sampled along it.
const textUnderEdges = (page) =>
  page.evaluate(() => {
    const f = document.querySelector(".workbench-frame").getBoundingClientRect();
    const cs = getComputedStyle(document.querySelector(".workbench-frame"));
    const hits = [];
    // A hit is the GLYPH box (Range rect of the text node), not the
    // element box — a nav span stretched to the nav's height has its
    // text centred well below the top rule.
    const probe = (x, y, edge) => {
      const el = document.elementsFromPoint(x, y).filter((e) => !e.closest(".workbench-frame"))[0];
      if (!(el && el.children.length === 0 && el.textContent && el.textContent.trim())) return;
      const range = document.createRange();
      range.selectNodeContents(el);
      const glyphs = Array.from(range.getClientRects());
      if (glyphs.some((g) => x >= g.left && x <= g.right && y >= g.top && y <= g.bottom))
        hits.push(edge + "@" + Math.round(x) + "," + Math.round(y) + ":" + el.textContent.trim().slice(0, 30));
    };
    for (let x = f.left + 4; x < f.right - 4; x += 24) {
      probe(x, Math.round(f.top), "top");
      if (cs.borderBottomStyle !== "none") probe(x, Math.round(f.bottom) - 1, "bottom");
    }
    for (let y = f.top + 4; y < f.bottom - 4; y += 24) {
      probe(Math.round(f.left), y, "left");
      probe(Math.round(f.right) - 1, y, "right");
    }
    return hits;
  });

async function pinViaKeystrokes(page) {
  // A — #230.  Real keystrokes into the picker's manual boxes.
  const posts = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && /road-bearing/.test(r.url())) {
      try {
        posts.push(JSON.parse(r.postData() || "{}"));
      } catch (e) {
        /* ignore */
      }
    }
  });
  await page.getByRole("button", { name: "Pick Location on Map" }).click();
  const dlg = page.getByRole("dialog").first();
  await dlg.waitFor();
  const toggle = page.getByText(/enter coordinates manually/i);
  if (await toggle.isVisible().catch(() => false)) await toggle.click();
  const lat = page.getByLabel("Latitude");
  const lng = page.getByLabel("Longitude");
  await lat.click();
  await page.keyboard.type(PIN.lat, { delay: 40 });
  await lng.click();
  await page.keyboard.type(PIN.lng, { delay: 40 });
  await page.waitForTimeout(800);
  const latV = await lat.inputValue();
  const lngV = await lng.inputValue();
  assert("A1. #230 typed lat box holds what was typed", latV === PIN.lat, JSON.stringify(latV));
  assert("A2. #230 typed lng box holds what was typed", lngV === PIN.lng, JSON.stringify(lngV));
  const lastPost = posts[posts.length - 1];
  assert(
    "A3. #230 the last detect POST carries the full typed pair",
    !!lastPost && Math.abs(lastPost.lat - +PIN.lat) < 1e-9 && Math.abs(lastPost.lng - +PIN.lng) < 1e-9,
    JSON.stringify(lastPost) + " after " + posts.length + " POSTs",
  );
  const errs = await dlg.locator(".text-\\[color\\:var\\(--fail\\)\\]").allTextContents();
  assert("A4. #230 no field error after typing", errs.filter((t) => /Invalid|must be/.test(t)).length === 0, JSON.stringify(errs));
  // U+2212 pair pasted over the typed values
  await lat.click();
  await page.evaluate(async (txt) => {
    const el = document.activeElement;
    const dt = new DataTransfer();
    dt.setData("text/plain", txt);
    el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  }, "39.739776, −104.963483");
  await page.waitForTimeout(500);
  assert(
    "A5. #230 the U+2212 pair pasted over prior text splits into both boxes",
    (await lat.inputValue()) === "39.7398" && (await lng.inputValue()) === "-104.9635",
    JSON.stringify([await lat.inputValue(), await lng.inputValue()]),
  );
  // settle detection, pick Colfax, save
  for (let i = 0; i < 40; i++) {
    const t = ((await dlg.textContent().catch(() => "")) || "").replace(/\s+/g, " ");
    if (!/Detecting roads at pin|Classifying road/i.test(t)) break;
    await page.waitForTimeout(1000);
  }
  const colfax = page.locator("button", { hasText: /Colfax/ }).first();
  if (await colfax.isVisible().catch(() => false)) await colfax.click();
  await page.waitForTimeout(800);
  const save = dlg.getByRole("button", { name: "Save & Close" });
  for (let i = 0; i < 20 && (await save.isDisabled().catch(() => true)); i++) await page.waitForTimeout(500);
  assert("A6. #230 the typed location saves (Save & Close enabled)", !(await save.isDisabled().catch(() => true)));
  await save.click();
  await page.waitForTimeout(1500);
}

(async () => {
  log("run start (UTC): " + new Date().toISOString());
  log("BASE: " + BASE + (IS_PROD ? " (production)" : " (local dev server — served build is the working tree)"));
  const hz = await get(HEALTHZ);
  const hzText = hz.body.trim();
  log("healthz (HTTP " + hz.status + "): " + hzText);
  execSync("git fetch --quiet", { cwd: ROOT });
  const om = execSync("git rev-parse origin/main", { cwd: ROOT }).toString().trim();
  const head = execSync("git rev-parse HEAD", { cwd: ROOT }).toString().trim();
  log("git rev-parse origin/main: " + om);
  log("git rev-parse HEAD: " + head);
  const hzSha = JSON.parse(hzText).sha;
  if (IS_PROD) {
    assert("GATE — healthz sha == origin/main", hzSha === om, hzSha + " vs " + om);
    if (hzSha !== om) {
      log("ABORT: gate failed");
      writeMd();
      process.exit(2);
    }
  } else {
    log("GATE — local mode: served build = working tree at HEAD " + head + " (healthz " + hzSha + " is the backend the proxies call)");
  }

  const browser = await chromium.launch();
  try {
    // ---- per viewport: D pre-pin rail rows, C frame, B rail jumps ----
    for (const [w, h] of VIEWPORTS) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      await gotoSandbox(page);
      await page.waitForTimeout(600);
      for (const [key, label] of KINDS) {
        await page.getByText(label, { exact: false }).first().click();
        await page.waitForTimeout(400);
        const g = await railGeom(page);
        assert(
          `D. #233 ${w}x${h} pre-pin ${key}: rail is one row`,
          g !== null && g.rows === 1,
          g ? `rows=${g.rows} entries=${g.entries.length} widths=${g.entries.map((e) => e.rect.w).join(",")}` : "no rail",
        );
        if (g) await shot(page, `rail-prepin-${key}-${w}x${h}.png`, { x: Math.max(0, g.rail.x - 2), y: Math.max(0, g.rail.y - 2), width: Math.min(w, g.rail.w + 4), height: g.rail.h + 4 });
      }
      await page.getByText("Shoulder work", { exact: false }).first().click();
      await page.waitForTimeout(300);

      // C — frame edges over a scroll walk; rail position when stuck
      let edgeHits = [];
      let railBelowNav = true;
      let railStuckSeen = false;
      const docH = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < docH; y += 41) {
        await page.evaluate((y) => window.scrollTo(0, y), y);
        await page.waitForTimeout(40);
        const hits = await textUnderEdges(page);
        if (hits.length) edgeHits.push(`scrollY ${y}: ${hits.slice(0, 3).join(" | ")}`);
        const c = await chrome(page);
        if (c.railTop !== null && c.navBottom !== null && c.railTop <= c.navBottom + 1) {
          railStuckSeen = true;
          if (c.railTop < c.navBottom) railBelowNav = false;
        }
      }
      assert(`C1. #232 ${w}x${h} no leaf text under any frame edge across the scroll walk`, edgeHits.length === 0, edgeHits.slice(0, 2).join(" ; ") || "0 hits");
      const c0 = await chrome(page);
      assert(`C2. #232 ${w}x${h} frame has no bottom rule`, c0.frame && c0.frame.borderBottom === "none", c0.frame && c0.frame.borderBottom);
      assert(`C3. #232 ${w}x${h} the stuck rail sits at/below the nav's bottom edge`, railStuckSeen && railBelowNav, `stuckSeen=${railStuckSeen}`);
      await page.evaluate(() => window.scrollTo(0, 420));
      await page.waitForTimeout(300);
      await shot(page, `frame-band-top-${w}x${h}.png`, { x: 0, y: 0, width: w, height: 110 });
      await shot(page, `frame-band-bottom-${w}x${h}.png`, { x: 0, y: h - 60, width: w, height: 60 });

      // B — rail jumps
      const entries = await page.locator(".progress-rail .rail-entry").all();
      for (let i = 0; i < entries.length; i++) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(150);
        const label = ((await entries[i].getAttribute("aria-label")) || "").split(" — ")[0];
        await entries[i].click();
        await page.waitForTimeout(1100);
        const land = await page.evaluate(() => {
          const el = document.activeElement;
          const nav = document.querySelector("nav.sticky");
          const rail = document.querySelector(".progress-rail");
          return {
            focusedId: el && el.id,
            top: el ? Math.round(el.getBoundingClientRect().top) : null,
            navBottom: Math.round(nav.getBoundingClientRect().bottom),
            railBottom: rail ? Math.round(rail.getBoundingClientRect().bottom) : null,
            maxScrolled: Math.round(window.scrollY) >= document.documentElement.scrollHeight - innerHeight - 1,
          };
        });
        const clear = land.top !== null && land.top >= land.navBottom && land.top >= (land.railBottom || 0);
        assert(
          `B1. #231 ${w}x${h} jump "${label}": anchor lands below nav + rail, focus on the anchor`,
          (clear || land.maxScrolled) && !!land.focusedId,
          JSON.stringify(land),
        );
        if (i === 2) await shot(page, `jump-work-${w}x${h}.png`);
      }
      await page.close();
    }

    // ---- 1440x900: A typed pin, D post-location rows, B Generate landing ----
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await gotoSandbox(page);
    await page.getByText("Shoulder work", { exact: false }).first().click();
    await pinViaKeystrokes(page);
    for (const [key, label] of KINDS) {
      await page.getByText(label, { exact: false }).first().click();
      await page.waitForTimeout(700);
      const g = await railGeom(page);
      assert(
        `D. #233 1440x900 post-location ${key}: rail is one row`,
        g !== null && g.rows === 1,
        g ? `rows=${g.rows} widths=${g.entries.map((e) => e.rect.w).join(",")} texts=${JSON.stringify(g.entries.map((e) => e.text))}` : "no rail",
      );
      if (g) await shot(page, `rail-postloc-${key}-1440x900.png`, { x: g.rail.x - 2, y: Math.max(0, g.rail.y - 2), width: g.rail.w + 4, height: g.rail.h + 4 });
    }
    await page.getByText("Shoulder work", { exact: false }).first().click();
    await page.waitForTimeout(500);
    const gen = page.getByRole("button", { name: "Generate plan" }).first();
    for (let i = 0; i < 30 && (await gen.isDisabled().catch(() => true)); i++) await page.waitForTimeout(500);
    assert("B2. #231 Generate plan enabled from the typed location", !(await gen.isDisabled().catch(() => true)));
    await gen.scrollIntoViewIfNeeded();
    const sampler = page.evaluate(
      () =>
        new Promise((res) => {
          const s = [];
          const t0 = performance.now();
          let last = null;
          const tick = () => {
            const y = Math.round(window.scrollY);
            if (y !== last) {
              s.push([Math.round(performance.now() - t0), y, document.documentElement.scrollHeight]);
              last = y;
            }
            if (performance.now() - t0 < 12000) requestAnimationFrame(tick);
            else res(s);
          };
          tick();
        }),
    );
    await gen.click();
    const samples = await sampler;
    await page
      .waitForFunction(() => Array.from(document.querySelectorAll("button")).some((b) => /Download PDF/.test(b.textContent || "")), null, { timeout: 120000 })
      .catch(() => log("Generate: Download PDF never appeared"));
    await page.waitForTimeout(800);
    const land = await page.evaluate(() => {
      const res = document.querySelectorAll("section.zone")[1];
      const head = res && res.querySelector(".zone-head");
      const nav = document.querySelector("nav.sticky");
      return {
        headTop: head ? Math.round(head.getBoundingClientRect().top) : null,
        navBottom: Math.round(nav.getBoundingClientRect().bottom),
        focusedIsResults: document.activeElement === res,
        scrollY: Math.round(window.scrollY),
      };
    });
    assert("B3. #231 after Generate the results heading lands below the nav", land.headTop !== null && land.headTop >= land.navBottom && land.headTop < land.navBottom + 120, JSON.stringify(land));
    assert("B4. #193 focus lands on the results zone after Generate", land.focusedIsResults === true);
    log("Generate scrollY changes (t ms, y, docH): " + JSON.stringify(samples));
    await shot(page, "gen-landing-1440x900.png");
    await page.close();
  } catch (e) {
    log("CRASH: " + (e && e.stack ? e.stack : e));
    failures++;
  }
  await browser.close();
  log(failures === 0 ? "ALL PASS" : "DONE — failures: " + failures);
  writeMd();
  process.exit(failures === 0 ? 0 : 1);
})();
