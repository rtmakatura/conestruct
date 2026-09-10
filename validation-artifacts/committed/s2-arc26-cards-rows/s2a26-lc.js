// s2-arc26 live check — #261 the download cards, #225 the audit-row grid,
// #235-C the zone-3 heading / ledger, at 1440×1000 and 380×800.
//   node s2a26-lc.js <outDir> <expectBackendSha> <frontendSha> [base]
// base defaults to the local dev server (frontend-only arc: the dev server
// proxies to the deployed Modal backend, so the healthz gate names the
// backend the answers came from and <frontendSha> names the branch tip the
// page was served from).  Legs, per viewport:
//   C1  four cards, "MHT PACKAGE · 4 FILES", h3 titles, no h4
//   C2  one edge (P4): first-button tops and bottoms ±1 across the four
//       cards at 1440; stacked at 380 with every button ≥ 44 px (P10);
//       the crew card's two buttons side by side; .dl-actions last child
//   C3  the audit PDF through the card: band object "audit PDF" observed
//       in flight, a download received named *.audit.pdf
//   C4  zone 3: no heading inside the tiers, the tr-section label, no
//       ledger element / copy, the cue slot at its reserved height, empty
//   C5  axe: heading-order 0; the full wcag set against the arc-23/25
//       baseline (1440: 0; 380: the named four)
//   C6  .check-list-src right edge ±1 for every row of the strip's
//       plan-flags dropdown and of every section-03 list; the measured
//       scrollWidth of the longest annotation vs the 200 px gutter; at 380
//       the annotation sits under the label
//   C7  tr-section / tr-prov contrast on the zone-3 surface
//   C8  the #187 cue: an edit puts "◌ previous answer — refreshing…" in
//       the slot while the refetch is open; never "(refreshing…)"
const L = require(require("path").join(__dirname, "..", "s2-audit-1", "audit-lib.js"));
const { fs, path } = L;
const OUT = process.argv[2]; const EXPECT = process.argv[3]; const FRONT = process.argv[4];
const BASE = process.argv[5] || "http://localhost:3003";
const { log } = L.mkLog(OUT);
const results = [];
const check = (tag, id, ok, detail) => { results.push({ tag, id, ok, detail }); log(`[${tag}] ${ok ? "PASS" : "FAIL"} ${id} — ${detail}`); };
const info = (tag, id, detail) => { log(`[${tag}] info ${id} — ${detail}`); };
const SETTLED = /READY FOR TCS REVIEW|PLAN DECLINED|VERIFICATION UNAVAILABLE|REVIEW WARNINGS|REVIEW FLAGS|NEEDS ATTENTION|VERIFIED/;
const AXE_NAMED = { "1440x1000": [], "380x800": ["scrollable-region-focusable", "target-size"] };
const AXE_TARGETS = { "1440x1000": [], "380x800": [".gap-8", 'button[aria-label="Edit Lane W"]', 'button[aria-label="Edit Work zone"]', ".strip-edit-all"] };
const AXE_BASELINE = { "1440x1000": 0, "380x800": 4 };
const LONGEST = "OSM GROUND-TRUTH (SOFT CHECK)";
// Prod-run overrides (2026-09-10): VP=380 runs one viewport; PIN=lat,lng
// swaps the Denver pin (Lakewood 39.7113,-105.0815 when Denver refuses
// twice — the run says so in its log).
const VPS = [{ width: 1440, height: 1000 }, { width: 380, height: 800 }].filter((v) => !process.env.VP || String(v.width) === process.env.VP);
const PIN = (process.env.PIN || "39.745070,-104.963470").split(",");

// ── in-page probes ──
const SAMPLE = () => {
  const band = document.querySelector(".working-band");
  const cue = document.querySelector(".tier-cue");
  return {
    band: band ? { verb: band.querySelector(".wb-verb")?.textContent ?? null, object: band.querySelector(".wb-object")?.textContent ?? null } : null,
    strip: document.querySelector(".status-bar")?.textContent.trim().replace(/\s+/g, " ") ?? null,
    refusal: !!document.querySelector(".scan-refusal"),
    hero: !!document.querySelector(".hero"),
    cards: document.querySelectorAll(".dl-card").length,
    cue: cue ? cue.textContent.trim() : null,
    body: document.body.textContent,
  };
};
const CARDS = () => {
  const r = (el) => { const b = el.getBoundingClientRect(); return { top: Math.round(b.top + scrollY), bottom: Math.round(b.bottom + scrollY), left: Math.round(b.left), right: Math.round(b.right), w: Math.round(b.width), h: Math.round(b.height) }; };
  const cards = Array.from(document.querySelectorAll(".dl-card")).map((c) => {
    const btns = Array.from(c.querySelectorAll(".dl-btn"));
    const row = c.querySelector(":scope > .dl-actions");
    return {
      title: c.querySelector(".top > h3")?.textContent ?? null, h4: !!c.querySelector("h4"),
      rect: r(c), row: row ? r(row) : null, rowLast: !!row && c.lastElementChild === row,
      qty: c.querySelector(".desc .qty")?.textContent ?? null,
      btns: btns.map((b) => ({ ...r(b), name: b.textContent.trim().replace(/\s+/g, " "), disabled: b.disabled, cls: b.className })),
    };
  });
  const header = Array.from(document.querySelectorAll("div")).map((d) => d.textContent.trim()).find((t) => /^MHT PACKAGE · \d+ FILES$/.test(t)) ?? null;
  return { cards, header, h4s: document.querySelectorAll(".dl-card h4").length, h3s: document.querySelectorAll(".dl-card h3").length };
};
const ZONE3 = () => {
  const z = document.querySelector('[aria-label="Plan reference tiers"]'); if (!z) return null;
  const cue = z.querySelector(".tier-cue"); const cs = cue ? getComputedStyle(cue) : null;
  const zone = z.closest("section.zone");
  return {
    headingsInside: z.querySelectorAll("h1,h2,h3,h4,h5,h6").length,
    zoneH2: zone ? Array.from(zone.querySelectorAll("h2")).map((h) => h.textContent.trim()) : [],
    section: z.querySelector(".tr-section")?.textContent ?? null, sectionTag: z.querySelector(".tr-section")?.tagName ?? null,
    prov: z.querySelector("p.tr-prov")?.textContent ?? null,
    ledger: !!document.querySelector("[data-testid=tier-ledger], .tier-ledger"),
    ledgerCopy: /\d+ changes? · \d+ needs attention · \d+ checked · \d+ pending · reference/.test(z.textContent),
    checking: z.textContent.includes("checking against the updated inputs"), refreshingSuffix: z.textContent.includes("(refreshing…)"),
    cue: cue ? { text: cue.textContent.trim(), h: Math.round(cue.getBoundingClientRect().height), minH: cs.minHeight, lh: cs.lineHeight } : null,
    chips: Array.from(z.querySelectorAll(".refchip .chip-sum")).map((b) => ({ label: b.querySelector(".label")?.textContent, n: b.querySelector(".detail b")?.textContent ?? null, open: b.getAttribute("aria-expanded") })),
    auditLink: Array.from(z.querySelectorAll("button, a")).some((b) => /Audit PDF/i.test(b.textContent)),
  };
};
const SRC = (rootSel) => {
  // every .check-list under root: per list, the annotations' right edges,
  // scrollWidths, and whether the annotation sits under the label (380)
  const lists = Array.from(document.querySelectorAll(rootSel + " .check-list")).filter((l) => l.querySelector(".check-list-item"));
  return lists.map((l) => {
    const rows = Array.from(l.querySelectorAll(":scope > .check-list-item, :scope > * > .check-list-item"));
    const lb = l.getBoundingClientRect();
    return {
      list: Math.round(lb.width), listRight: Math.round(lb.right),
      rows: rows.map((row) => {
        const src = row.querySelector(".check-list-src"); const lbl = row.querySelector(".check-list-lbl");
        const s = src.getBoundingClientRect(); const t = lbl.getBoundingClientRect();
        const cs = getComputedStyle(row);
        return { text: src.textContent, right: Math.round(s.right), left: Math.round(s.left), w: Math.round(s.width), scrollW: src.scrollWidth, srcTop: Math.round(s.top), lblTop: Math.round(t.top), lblRight: Math.round(t.right), cols: cs.gridTemplateColumns, lines: Math.round(t.height / parseFloat(getComputedStyle(lbl).lineHeight)) };
      }),
    };
  });
};
const LONGEST_W = (text) => {
  // the longest annotation's natural width under the real .check-list-src
  // style, measured in an offscreen row of the same list
  const host = document.querySelector(".check-list") || document.body;
  const row = document.createElement("div"); row.className = "check-list-item"; row.style.position = "absolute"; row.style.left = "-9999px"; row.style.visibility = "hidden";
  const src = document.createElement("span"); src.className = "check-list-src"; src.style.whiteSpace = "nowrap"; src.textContent = text;
  row.appendChild(document.createElement("span")); row.appendChild(document.createElement("span")); row.appendChild(src); host.appendChild(row);
  const w = src.scrollWidth; const b = Math.round(src.getBoundingClientRect().width); row.remove();
  return { scrollW: w, w: b, font: getComputedStyle(document.querySelector(".check-list-src") || src).fontSize };
};

async function pin(page, lat, lng) {
  await page.goto(BASE + "/sandbox", { waitUntil: "networkidle", timeout: 120000 }); await page.waitForTimeout(600);
  await page.getByRole("button", { name: "Enter manually", exact: true }).click();
  const fill = async (l, v) => { await page.locator(`label:text-is("${l}")`).locator("xpath=following-sibling::input[1]").fill(v); };
  await fill("Latitude", lat); await page.getByRole("button", { name: "Edit manually", exact: true }).click();
  await fill("Longitude", lng); await fill("Bearing (° from N)", "180"); await fill("Work zone (ft)", "1000");
  const t0 = Date.now(); while (Date.now() - t0 < 40000) { const s = await page.evaluate(SAMPLE); if (s.strip && !/VERIFYING/.test(s.strip)) break; await page.waitForTimeout(300); }
}
async function sampleUntilSettled(page, label, maxMs) {
  const t0 = Date.now(); const samples = []; let seen = false, settledAt = null; const objects = new Set(); const cues = new Set();
  while (Date.now() - t0 < maxMs) {
    const s = await page.evaluate(SAMPLE); s.t = Date.now() - t0; delete s.body; samples.push(s);
    if (s.band) { seen = true; if (s.band.object) objects.add(s.band.object); }
    if (s.cue) cues.add(s.cue);
    const settledNow = !s.band && seen && (s.refusal || SETTLED.test(s.strip ?? ""));
    if (settledAt === null && settledNow) settledAt = s.t;
    if (settledAt !== null && Date.now() - t0 - settledAt > 1500) break;
    await page.waitForTimeout(100);
  }
  fs.writeFileSync(path.join(OUT, `${label}-samples.json`), JSON.stringify(samples));
  return { samples, settledAt, seen, objects: [...objects], cues: [...cues], last: samples[samples.length - 1] };
}
async function generate(page, tag) {
  // Generate; a Denver refusal (#256) is retried once; the outcome is reported.
  await page.getByRole("button", { name: /Generate plan/ }).click();
  let s = await sampleUntilSettled(page, `${tag}-gen`, 120000);
  if (s.last.refusal) {
    info(tag, "generate", `natural refusal on the first Generate (#256) — retrying once`);
    await page.getByRole("button", { name: "↻ Retry scan", exact: true }).click();
    s = await sampleUntilSettled(page, `${tag}-gen-retry`, 120000);
  }
  return s;
}

(async () => {
  const sha = await L.shaGate(log, EXPECT);
  log(`B1 healthz ${sha} == ${EXPECT}: PASS · base ${BASE} · frontend ${FRONT}`);
  const browser = await L.chromium.launch();
  log(`pin ${PIN.join(", ")} · viewports ${VPS.map((v) => v.width).join("/")}`);
  for (const vp of VPS) {
    const tag = `${vp.width}x${vp.height}`;
    const page = await browser.newPage({ viewport: vp, acceptDownloads: true });
    // the #225 reproduction pin: ~50 m off a classified road → the OSM soft check
    await pin(page, PIN[0], PIN[1]);
    const gen = await generate(page, tag);
    const settled = await page.evaluate(SAMPLE);
    if (settled.refusal || !settled.hero) {
      const bd = await page.evaluate(() => ({ ribbon: document.querySelector(".stale-ribbon")?.textContent.trim() ?? null, qty: Array.from(document.querySelectorAll(".dl-card .desc .qty")).map((q) => q.textContent), disabled: Array.from(document.querySelectorAll(".dl-card .dl-btn")).map((b) => b.disabled) }));
      check(tag, "C0 plan", false, `no plan after Generate (+1 retry): refusal ${settled.refusal}, hero ${settled.hero}, strip "${settled.strip}"; ribbon "${bd.ribbon}"; card qty ${JSON.stringify(bd.qty)}; buttons disabled ${JSON.stringify(bd.disabled)} — the legs below need a plan`);
      await L.shot(page, OUT, `${tag}-declined`); await page.close(); continue;
    }
    info(tag, "C0 plan", `strip "${settled.strip}"; settled ${gen.settledAt} ms; band objects ${JSON.stringify(gen.objects)}`);

    // ── C1 / C2 the cards ──
    const c = await page.evaluate(CARDS); fs.writeFileSync(path.join(OUT, `${tag}-cards.json`), JSON.stringify(c, null, 1));
    await page.evaluate(() => document.querySelector(".dls")?.scrollIntoView({ block: "center" }));
    const shot1 = await L.shot(page, OUT, `${tag}-cards`);
    check(tag, "C1 four cards", c.cards.length === 4 && c.header === "MHT PACKAGE · 4 FILES" && c.h3s === 4 && c.h4s === 0 && c.cards.map((x) => x.title).join("|") === "Plan sheet|Device list|Crew instructions|Audit trail",
      `${c.cards.length} cards [${c.cards.map((x) => x.title).join(", ")}]; header "${c.header}"; h3 ${c.h3s}, h4 ${c.h4s}; qty [${c.cards.map((x) => `"${x.qty}"`).join(", ")}] | ${shot1}`);
    const firsts = c.cards.map((x) => x.btns[0]);
    const tops = firsts.map((b) => b.top), bottoms = firsts.map((b) => b.bottom);
    const spread = (a) => Math.max(...a) - Math.min(...a);
    const rowsLast = c.cards.every((x) => x.rowLast);
    const rowBottoms = c.cards.map((x) => x.row.bottom);
    const crew = c.cards[2];
    const sideBySide = crew.btns.length === 2 && Math.abs(crew.btns[0].top - crew.btns[1].top) <= 1 && crew.btns[1].left > crew.btns[0].right;
    const minH = vp.width <= 480 ? 44 : 32;
    const allH = c.cards.flatMap((x) => x.btns.map((b) => b.h));
    if (vp.width > 980) {
      const cardTops = c.cards.map((x) => x.rect.top);
      check(tag, "C2 one edge", spread(tops) <= 1 && spread(bottoms) <= 1 && spread(rowBottoms) <= 1 && rowsLast && sideBySide && allH.every((h) => h >= minH) && spread(cardTops) <= 1,
        `first-button tops [${tops.join(", ")}] spread ${spread(tops)}; bottoms [${bottoms.join(", ")}] spread ${spread(bottoms)}; row bottoms spread ${spread(rowBottoms)}; rows last ${rowsLast}; crew side by side ${sideBySide} (${crew.btns.map((b) => `${b.left}..${b.right}@${b.top}`).join(" / ")}); heights [${allH.join(", ")}] ≥ ${minH}; card widths [${c.cards.map((x) => x.rect.w).join(", ")}]`);
    } else {
      const stacked = c.cards.every((x, i) => i === 0 || x.rect.top >= c.cards[i - 1].rect.bottom - 1);
      const anchored = c.cards.every((x) => Math.abs(x.rect.bottom - 16 - x.row.bottom) <= 1);
      const lefts = c.cards.map((x) => x.rect.left);
      check(tag, "C2 stacked, 44 px", stacked && anchored && rowsLast && sideBySide && allH.every((h) => h >= minH) && spread(lefts) <= 1,
        `stacked ${stacked}; row bottom-anchored ${anchored} (card bottom − 16 vs row bottom: ${c.cards.map((x) => `${x.rect.bottom - 16}/${x.row.bottom}`).join(", ")}); rows last ${rowsLast}; crew side by side ${sideBySide}; heights [${allH.join(", ")}] ≥ ${minH}; widths [${c.cards.map((x) => x.rect.w).join(", ")}]`);
    }
    check(tag, "C2 buttons live", c.cards.every((x) => x.btns.every((b) => !b.disabled)) && c.cards.every((x) => x.btns.every((b) => b.cls === "dl-btn")),
      `disabled: ${c.cards.map((x) => x.btns.map((b) => b.disabled).join("/")).join(", ")}; classes one: ${c.cards.every((x) => x.btns.every((b) => b.cls === "dl-btn"))}`);

    // ── C3 the audit PDF through the card ──
    {
      const dlP = page.waitForEvent("download", { timeout: 90000 }).catch(() => null);
      await page.locator(".dl-card").nth(3).locator(".dl-btn").click();
      const flight = await sampleUntilSettled(page, `${tag}-audit`, 90000);
      const dl = await dlP;
      const name = dl ? dl.suggestedFilename() : null;
      if (dl) { const p = path.join(OUT, `${tag}-${name}`); await dl.saveAs(p); }
      const after = await page.evaluate(CARDS);
      check(tag, "C3 audit PDF via the card", !!dl && /\.audit\.pdf$/.test(name || "") && flight.objects.includes("audit PDF") && flight.objects.every((o) => o === "audit PDF") && after.cards[3].btns[0].disabled === false,
        `download ${dl ? `"${name}"` : "NONE"}; band objects in flight ${JSON.stringify(flight.objects)} (band seen ${flight.seen}); button live after ${after.cards[3].btns[0].disabled === false}`);
    }

    // ── C4 zone 3 ──
    const z = await page.evaluate(ZONE3); fs.writeFileSync(path.join(OUT, `${tag}-zone3.json`), JSON.stringify(z, null, 1));
    await page.evaluate(() => document.querySelector('[aria-label="Plan reference tiers"]')?.scrollIntoView({ block: "start" }));
    const shot3 = await L.shot(page, OUT, `${tag}-zone3`);
    check(tag, "C4 one heading, no ledger", !!z && z.headingsInside === 0 && z.zoneH2.length === 1 && z.zoneH2[0] === "Rules, permit & audit" && z.sectionTag === "DIV" && /— jurisdiction rules$|^Plan reference$/.test(z.section || "") && !z.ledger && !z.ledgerCopy && !z.checking && !z.refreshingSuffix && !!z.cue && z.cue.text === "" && z.cue.h === 15 && !z.auditLink && z.prov === "informational · sourced corpus · never blocks generation",
      z ? `headings inside ${z.headingsInside}; zone h2 ${JSON.stringify(z.zoneH2)}; section <${z.sectionTag}> "${z.section}"; ledger el ${z.ledger} copy ${z.ledgerCopy} checking ${z.checking} suffix ${z.refreshingSuffix}; cue "${z.cue?.text}" h ${z.cue?.h} (min ${z.cue?.minH}, lh ${z.cue?.lh}); audit link in tier ${z.auditLink}; chips ${z.chips.map((k) => `${k.label}=${k.n}`).join(", ")} | ${shot3}` : "no zone 3");

    // ── C7 contrast on the zone-3 surface ──
    {
      const pairs = await page.evaluate(L.PAIRS, '[aria-label="Plan reference tiers"]'); fs.writeFileSync(path.join(OUT, `${tag}-zone3-pairs.json`), JSON.stringify(pairs, null, 1));
      const sec = pairs.find((p) => /tr-section/.test(p.sel)); const prov = pairs.find((p) => /p\.tr-prov/.test(p.sel));
      check(tag, "C7 contrast", !!sec && sec.ratio >= 4.5 && !!prov && prov.ratio >= 4.5, `tr-section ${sec ? `${sec.fg}/${sec.bg} ${sec.ratio} ${sec.size}px/${sec.weight}` : "none"}; tr-prov ${prov ? `${prov.fg}/${prov.bg} ${prov.ratio} ${prov.size}px` : "none"}`);
    }

    // ── C5 axe ──
    {
      const axe = await L.runAxe(page, OUT, `${tag}-axe`);
      const heading = axe.filter((v) => v.id === "heading-order").flatMap((v) => v.nodes.map((n) => n.target));
      const wcag = axe.filter((v) => v.tags.some((t) => /wcag2a$|wcag2aa$|wcag21aa$|wcag22aa$/.test(t)));
      const nodes = wcag.flatMap((v) => v.nodes.map((n) => ({ id: v.id, t: n.target })));
      const unexpected = nodes.filter((n) => !AXE_NAMED[tag].includes(n.id) || !AXE_TARGETS[tag].includes(n.t));
      check(tag, "C5 axe heading-order", heading.length === 0, `heading-order nodes: ${heading.join(" ; ") || "none"}`);
      check(tag, "C5 axe baseline", nodes.length <= AXE_BASELINE[tag] && unexpected.length === 0, `${nodes.length} wcag node(s) (baseline ${AXE_BASELINE[tag]}): ${nodes.map((n) => `${n.id}[${n.t}]`).join(" ; ") || "none"}`);
    }

    // ── C6 the audit-row grid ──
    {
      // the strip's plan-flags dropdown
      const openers = page.locator("details.status-details > summary");
      const nOpen = await openers.count();
      if (nOpen > 0) { await openers.first().click(); await page.waitForTimeout(300); }
      const strip = await page.evaluate(SRC, "details.status-details"); fs.writeFileSync(path.join(OUT, `${tag}-strip-src.json`), JSON.stringify(strip, null, 1));
      await page.evaluate(() => document.querySelector("details.status-details")?.scrollIntoView({ block: "start" }));
      const shot6 = await L.shot(page, OUT, `${tag}-flags`);
      const stripRows = strip.flatMap((l) => l.rows);
      if (vp.width > 480) {
        const rights = stripRows.map((r) => r.right);
        check(tag, "C6 strip rows one right edge", stripRows.length > 0 && Math.max(...rights) - Math.min(...rights) <= 1 && stripRows.every((r) => r.scrollW <= 200) && stripRows.every((r) => r.cols.split(" ").length === 3),
          `${stripRows.length} row(s): ${stripRows.map((r) => `"${r.text}" right ${r.right} w ${r.w} scrollW ${r.scrollW} lines ${r.lines}`).join(" ; ")}; list width ${strip.map((l) => l.list).join("/")}; cols "${stripRows[0]?.cols}" | ${shot6}`);
      } else {
        check(tag, "C6 strip rows wrap under the label", stripRows.length > 0 && stripRows.every((r) => r.srcTop > r.lblTop && r.cols.split(" ").length === 2),
          `${stripRows.length} row(s): ${stripRows.map((r) => `"${r.text}" srcTop ${r.srcTop} lblTop ${r.lblTop} cols "${r.cols}"`).join(" ; ")} | ${shot6}`);
      }
      const longest = await page.evaluate(LONGEST_W, LONGEST);
      check(tag, "C6 longest annotation equals the 197 px gutter", longest.scrollW <= 197, `"${LONGEST}" natural width ${longest.scrollW} px (rect ${longest.w}) at ${longest.font} — gutter 197 px, pinned at the measurement by ruling`);
      // section 03: open every chip, measure every list
      const sums = page.locator('[aria-label="Plan reference tiers"] .refchip > .chip-sum[aria-expanded="false"]');
      const n = await sums.count();
      for (let i = 0; i < n; i++) { await page.locator('[aria-label="Plan reference tiers"] .refchip > .chip-sum[aria-expanded="false"]').first().click(); await page.waitForTimeout(150); }
      // and every accordion row that hides a check-list
      const accs = page.locator('[aria-label="Plan reference tiers"] button[aria-expanded="false"]');
      const na = await accs.count();
      for (let i = 0; i < Math.min(na, 40); i++) { const b = page.locator('[aria-label="Plan reference tiers"] button[aria-expanded="false"]').first(); if (await b.count() === 0) break; await b.click(); await page.waitForTimeout(80); }
      const s3 = await page.evaluate(SRC, '[aria-label="Plan reference tiers"]'); fs.writeFileSync(path.join(OUT, `${tag}-s3-src.json`), JSON.stringify(s3, null, 1));
      const shot7 = await L.shot(page, OUT, `${tag}-s3-rows`, true);
      const lists = s3.filter((l) => l.rows.length > 0);
      const rowsAll = lists.flatMap((l) => l.rows);
      if (vp.width > 480) {
        const perList = lists.map((l) => { const r = l.rows.map((x) => x.right); return { n: l.rows.length, spread: Math.max(...r) - Math.min(...r), right: Math.max(...r), listRight: l.listRight }; });
        const maxScroll = Math.max(...rowsAll.map((r) => r.scrollW));
        check(tag, "C6 section-03 rows one right edge per list", lists.length > 0 && perList.every((p) => p.spread <= 1) && rowsAll.every((r) => r.scrollW <= 200),
          `${lists.length} list(s), ${rowsAll.length} row(s); per list [${perList.map((p) => `${p.n} rows spread ${p.spread} right ${p.right} (list right ${p.listRight})`).join("; ")}]; max annotation scrollWidth ${maxScroll} ("${rowsAll.find((r) => r.scrollW === maxScroll)?.text}") | ${shot7}`);
      } else {
        check(tag, "C6 section-03 rows wrap under the label", lists.length > 0 && rowsAll.every((r) => r.srcTop > r.lblTop),
          `${lists.length} list(s), ${rowsAll.length} row(s); under-label ${rowsAll.filter((r) => r.srcTop > r.lblTop).length}/${rowsAll.length} | ${shot7}`);
      }
    }

    // ── C8 the #187 cue on an edit ──
    {
      await page.evaluate(() => scrollTo(0, 0));
      const edit = page.getByRole("button", { name: /Edit Speed/i });
      if (await edit.count() > 0) {
        await edit.first().click();
        const sel = page.getByLabel("Speed");
        const t0 = Date.now(); let flight;
        await sel.selectOption("35");
        flight = await sampleUntilSettled(page, `${tag}-edit`, 90000);
        const cueSeen = flight.cues.includes("◌ previous answer — refreshing…");
        const badCopy = flight.samples.some((s) => s.cue && /\(refreshing…\)|checking against/.test(s.cue));
        const after = await page.evaluate(ZONE3);
        check(tag, "C8 refresh cue", cueSeen && !badCopy && !!after && after.cue.text === "" && after.cue.h === 15,
          `cues seen in flight ${JSON.stringify(flight.cues)}; band objects ${JSON.stringify(flight.objects)}; settled ${flight.settledAt} ms (${Date.now() - t0} ms total); after: cue "${after?.cue?.text}" h ${after?.cue?.h}`);
      } else {
        info(tag, "C8 refresh cue", "no Edit Speed control on this strip — leg not run");
      }
    }
    await page.close();
  }
  await browser.close();
  const fails = results.filter((r) => !r.ok);
  log(`RESULT ${fails.length === 0 ? "ALL PASS" : "FAIL"} ${results.length - fails.length}/${results.length}${fails.length ? " — " + fails.map((f) => `[${f.tag}] ${f.id}`).join(", ") : ""}`);
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 1));
})().catch((e) => { log("ERR " + e.stack); process.exit(1); });
