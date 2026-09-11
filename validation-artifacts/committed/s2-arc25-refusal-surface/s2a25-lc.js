// s2-arc25 live check — #258 the refusal surface, at 1440×1000 and 380×800.
//   node s2a25-lc.js <outDir> <expectSha> [base] [runsPerBranch]
// base defaults to prod; the local run passes http://localhost:3000 (the
// dev server proxies to the same Modal backend, so the healthz gate holds
// for both).  Legs, per viewport:
//   D0  natural: pin → Generate on the live backend.  A refusal here is
//       measured as a natural one (recorded which); a clean plan is the
//       sanity leg (hero, downloads, one announcement).
//   A×N breakdown-ready refusal (audit F-S5-1 #1): the Generate's audit
//       request is fulfilled with the captured 400 (refusal-replay.json —
//       the s2-audit-1 capture with the message updated to the 67bf9a0
//       constant); the breakdown runs for real.
//   B×N breakdown-400 refusal (F-S5-1 #2): both requests fulfilled with
//       the 400.  Run 1 recovers with "Generate anyway" (the proceed
//       path); the others with Retry.
//   Under declined (every A/B run and a natural refusal): no .hero, 0
//   download .dl-btn outside the container, sr-only "" , empty state "No
//   package yet" alone, no zone-note, the wire sentence once, PLAN
//   DECLINED once, the pill, the container inside [nav-h, innerH] after
//   the settle (the count per branch is the #250 measurement), both
//   actions .dl-btn on one edge / same border / same height, Retry ≥ 32
//   (1440) / ≥ 44 (380), no ISO in either container, the <time> title,
//   no band+refusal co-frame (spec 31), contrast pairs in the container,
//   axe against the arc-23 baseline (1440: 0; 380: the two named).
//   Recovery: Retry (or proceed) → clean settle → the container gone,
//   downloads back, hero back, "Plan generated — …" written exactly once.
const L = require("../s2-audit-1/audit-lib.js");
const { fs, path } = L;
const OUT = process.argv[2]; const EXPECT = process.argv[3];
const BASE = process.argv[4] || "https://www.conestruct.com";
const N = Number(process.argv[5] || 3);
const REPLAY = JSON.parse(fs.readFileSync(path.join(__dirname, "refusal-replay.json"), "utf-8"));
const SENTENCE = JSON.parse(REPLAY.body).detail.message;
const { log } = L.mkLog(OUT);
const results = [];
const check = (tag, id, ok, detail) => { results.push({ tag, id, ok, detail }); log(`[${tag}] ${ok ? "PASS" : "FAIL"} ${id} — ${detail}`); };
const info = (tag, id, detail) => { log(`[${tag}] info ${id} — ${detail}`); };
const SETTLED = /READY FOR TCS REVIEW|PLAN DECLINED|VERIFICATION UNAVAILABLE|REVIEW WARNINGS|REVIEW FLAGS|NEEDS ATTENTION|VERIFIED/;
// The 380 baseline under a DECLINED plan is the audit's own count on this
// surface (F-S5-10: `scrollable-region-focusable .gap-8` + `target-size` ×3
// — `Edit Lane W`, `Edit Work zone`, `.strip-edit-all`, all in the setup
// strip's 380 wrap, F-S3-7); the arc-23 "2 named" figure was a settled ok
// plan.  None is in the container; Retry at 44 retires none of them.
const AXE_NAMED = { "1440x1000": [], "380x800": ["scrollable-region-focusable", "target-size"] };
const AXE_TARGETS = { "1440x1000": [], "380x800": [".gap-8", 'button[aria-label="Edit Lane W"]', 'button[aria-label="Edit Work zone"]', ".strip-edit-all"] };
const AXE_BASELINE = { "1440x1000": 0, "380x800": 4 };

// ── in-page probes ──
const SAMPLE = () => {
  const r = (sel) => { const el = document.querySelector(sel); if (!el) return null; const b = el.getBoundingClientRect(); return { vtop: Math.round(b.top), vbottom: Math.round(b.bottom), h: Math.round(b.height), text: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 140) }; };
  const band = document.querySelector(".working-band");
  const dl = Array.from(document.querySelectorAll(".dl-btn")).filter((b) => !b.closest(".scan-refusal"));
  const zones = document.querySelectorAll("section.zone");
  return {
    scrollY: Math.round(scrollY), innerH: innerHeight, navH: parseInt(getComputedStyle(document.querySelector(".workbench")).getPropertyValue("--nav-h"), 10) || 52,
    band: band ? { verb: band.querySelector(".wb-verb")?.textContent ?? null, object: band.querySelector(".wb-object")?.textContent ?? null } : null,
    strip: r(".status-bar"), refusal: r(".scan-refusal"), resultsTop: zones[1] ? Math.round(zones[1].getBoundingClientRect().top) : null,
    hero: !!document.querySelector(".hero"), dlAll: dl.length, dlOn: dl.filter((b) => !b.disabled && b.getAttribute("aria-disabled") !== "true").length,
    sr: document.querySelector("div[role=status].sr-only")?.textContent ?? null,
  };
};
const MEASURE = () => {
  const body = document.body.textContent || "";
  const count = (s) => body.split(s).length - 1;
  const c = document.querySelector(".scan-refusal");
  const cb = c ? c.getBoundingClientRect() : null;
  const btns = c ? Array.from(c.querySelectorAll("button")).map((x) => { const y = x.getBoundingClientRect(); const cs = getComputedStyle(x); return { name: x.textContent.trim().replace(/\s+/g, " ").slice(0, 30), cls: x.className, w: Math.round(y.width), h: Math.round(y.height), left: Math.round(y.left), right: Math.round(y.right), vtop: Math.round(y.top), border: `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}`, bg: cs.backgroundColor, fg: cs.color, font: `${cs.fontSize}/${cs.fontWeight}`, lines: Math.round((y.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - parseFloat(cs.borderTopWidth) - parseFloat(cs.borderBottomWidth)) / parseFloat(cs.lineHeight)), disabled: x.disabled }; }) : [];
  const dl = Array.from(document.querySelectorAll(".dl-btn")).filter((b) => !b.closest(".scan-refusal"));
  const zones = document.querySelectorAll("section.zone");
  const msg = c ? (c.querySelector(".flex.items-start > span:not(.sys-glyph)")?.textContent ?? "") : "";
  const prov = c ? Array.from(c.querySelectorAll(".tr-prov")).map((p) => p.textContent.trim().replace(/\s+/g, " ")) : [];
  const notChecked = document.querySelector(".site-not-checked");
  return {
    navH: parseInt(getComputedStyle(document.querySelector(".workbench")).getPropertyValue("--nav-h"), 10) || 52, innerH: innerHeight,
    container: cb ? { vtop: Math.round(cb.top), vbottom: Math.round(cb.bottom), h: Math.round(cb.height), w: Math.round(cb.width), left: Math.round(cb.left), role: c.getAttribute("role"), label: c.querySelector(".tr-section")?.textContent } : null,
    labelLeft: c ? Math.round(c.querySelector(".tr-section").getBoundingClientRect().left) : null,
    message: msg, messageCount: msg ? count(msg) : null, declinedCount: count("PLAN DECLINED"),
    strip: document.querySelector(".status-bar")?.textContent.trim().replace(/\s+/g, " ") ?? null, pill: document.querySelector(".status-bar .pill")?.textContent ?? null,
    hero: !!document.querySelector(".hero"), dlAll: dl.length, dlOn: dl.filter((b) => !b.disabled && b.getAttribute("aria-disabled") !== "true").length, dlCards: document.querySelectorAll(".dl-card").length,
    sr: document.querySelector("div[role=status].sr-only")?.textContent ?? null,
    empty: document.querySelector(".empty-state")?.textContent.trim().replace(/\s+/g, " ") ?? null, zoneNote: !!document.querySelector(".zone-note"), dominant: !!(zones[1] && zones[1].classList.contains("dominant")),
    ribbons: { failed: count("Device breakdown failed"), previous: count("Previous answer") },
    btns, prov, containerISO: c ? /\d{4}-\d\d-\d\dT/.test(c.textContent) : null, timeTitle: c ? (c.querySelector("time")?.getAttribute("title") ?? null) : null,
    notCheckedISO: notChecked ? /\d{4}-\d\d-\d\dT/.test(notChecked.textContent) : null,
    resultsTop: zones[1] ? Math.round(zones[1].getBoundingClientRect().top) : null, scrollY: Math.round(scrollY),
  };
};

async function pin(page) {
  await page.goto(BASE + "/sandbox", { waitUntil: "networkidle", timeout: 90000 }); await page.waitForTimeout(600);
  await page.getByRole("button", { name: "Enter manually", exact: true }).click();
  const fill = async (l, v) => { await page.locator(`label:text-is("${l}")`).locator("xpath=following-sibling::input[1]").fill(v); };
  await fill("Latitude", "39.726900"); await page.getByRole("button", { name: "Edit manually", exact: true }).click();
  await fill("Longitude", "-104.987300"); await fill("Bearing (° from N)", "180"); await fill("Work zone (ft)", "1000");
  const t0 = Date.now(); while (Date.now() - t0 < 40000) { const s = await page.evaluate(SAMPLE); if (s.strip && !/VERIFYING/.test(s.strip.text)) break; await page.waitForTimeout(300); }
}
async function sampleUntilSettled(page, label, maxMs, requireBand = false) {
  const t0 = Date.now(); const samples = []; let seen = false, settledAt = null; const srWrites = [];
  while (Date.now() - t0 < maxMs) {
    const s = await page.evaluate(SAMPLE); s.t = Date.now() - t0; samples.push(s);
    if (s.band) seen = true;
    if (s.sr && srWrites[srWrites.length - 1] !== s.sr) srWrites.push(s.sr);
    // A Generate leg starts with no container: the container exists only
    // after the pair has settled (spec 31), so its presence settles the
    // sample on its own — a replayed pair answers inside one sampling
    // interval and the band can live and die between two samples.  A
    // recovery leg starts WITH the (stale) container in the first sample
    // and on the live backend, so it requires the band to have been seen
    // and gone.  A strip verdict counts only once the band has been seen
    // (the pre-generate verdict is not this request's settle).
    const settledNow = !s.band && ((!!s.refusal && (!requireBand || seen)) || (seen && SETTLED.test(s.strip?.text ?? "")));
    if (settledAt === null && settledNow) settledAt = s.t;
    if (settledAt !== null && Date.now() - t0 - settledAt > 1500) break;
    await page.waitForTimeout(100);
  }
  fs.writeFileSync(path.join(OUT, `${label}-samples.json`), JSON.stringify(samples));
  const coFrame = samples.filter((s) => s.band && s.refusal).length;
  return { samples, settledAt, seen, coFrame, srWrites, last: samples[samples.length - 1] };
}
function arm(page, which) {
  // one-shot fulfilment of the Generate's own request(s); the pre-generate
  // pair has already settled when this is armed, and the Retry's requests
  // go to the live backend.
  const state = { audit: false, breakdown: false };
  page.route("**/api/render/audit", async (route) => { if (which.audit && !state.audit) { state.audit = true; await route.fulfill({ status: REPLAY.status, headers: { "content-type": "application/json" }, body: REPLAY.body }); } else await route.continue(); });
  page.route("**/api/render/device-breakdown", async (route) => { if (which.breakdown && !state.breakdown) { state.breakdown = true; await route.fulfill({ status: REPLAY.status, headers: { "content-type": "application/json" }, body: REPLAY.body }); } else await route.continue(); });
  return state;
}

const landings = {};
async function declinedLegs(page, tag, label, settle) {
  const m = await page.evaluate(MEASURE);
  fs.writeFileSync(path.join(OUT, `${label}-measure.json`), JSON.stringify(m, null, 1));
  const sh = await L.shot(page, OUT, `${label}-declined`);
  if (!m.container) { check(tag, `${label} container`, false, `no .scan-refusal after settle; strip "${m.strip}"`); return m; }
  check(tag, `${label} D1 no plan`, !m.hero && m.dlAll === 0 && m.dlCards === 0 && m.sr === "" && !m.zoneNote && !m.dominant && m.ribbons.failed === 0 && m.ribbons.previous === 0,
    `hero ${m.hero}; download .dl-btn ${m.dlAll} (${m.dlOn} on); cards ${m.dlCards}; sr "${m.sr}"; zone-note ${m.zoneNote}; dominant ${m.dominant}; ribbons failed ${m.ribbons.failed} / previous ${m.ribbons.previous} | ${sh}`);
  check(tag, `${label} D2 empty state`, m.empty === "No package yet", `empty state "${m.empty}"`);
  check(tag, `${label} D3 one voice`, m.messageCount === 1 && m.declinedCount === 1 && /see the notice in the Results zone\./.test(m.strip) && !/could not complete/.test(m.strip) && m.pill === "SERVICE UNAVAILABLE" && m.message === SENTENCE,
    `sentence ×${m.messageCount}; PLAN DECLINED ×${m.declinedCount}; strip "${m.strip}"; pill "${m.pill}"`);
  const inView = m.container.vtop >= m.navH && m.container.vbottom <= m.innerH;
  landings[tag] = landings[tag] || {}; landings[tag][label.replace(/\d+$/, "")] = landings[tag][label.replace(/\d+$/, "")] || { inView: 0, runs: 0 };
  const lk = landings[tag][label.replace(/\d+$/, "")]; lk.runs++; if (inView) lk.inView++;
  check(tag, `${label} D4 landing`, inView, `container ${m.container.vtop}..${m.container.vbottom} (h ${m.container.h}) vs nav-h ${m.navH}, innerH ${m.innerH}; results top ${m.resultsTop}; scrollY ${m.scrollY}; settled ${settle.settledAt} ms`);
  const [a, b] = m.btns;
  // One edge (P4): stacked (380) — the same left AND right; in a row
  // (1440) — the same top with the same height, the row starting on the
  // section label's left edge (asserted below).
  const oneEdge = a && b && ((Math.abs(a.left - b.left) <= 1 && Math.abs(a.right - b.right) <= 1) || (Math.abs(a.vtop - b.vtop) <= 1 && Math.abs(a.h - b.h) <= 1));
  const same = a && b && a.border === b.border && Math.abs(a.h - b.h) <= 1 && a.cls === b.cls && a.font === b.font;
  const minH = tag.startsWith("380") ? 44 : 32;
  check(tag, `${label} D5 actions`, m.btns.length === 2 && /Retry scan/.test(a.name) && b.name === "Generate anyway" && same && oneEdge && a.h >= minH && b.h >= minH && a.lines === 1 && b.lines === 1 && Math.abs(a.left - m.labelLeft) <= 1,
    m.btns.map((x) => `"${x.name}" ${x.w}×${x.h} at ${x.left}..${x.right},${x.vtop} border ${x.border} lines ${x.lines} ${x.cls}`).join(" ; ") + `; label left ${m.labelLeft}; min ${minH}`);
  check(tag, `${label} D6 consequence`, m.prov.some((p) => p === "tries the scan once more · the plan says whether it ran"), `prov lines: ${m.prov.map((p) => `"${p}"`).join(" / ")}`);
  check(tag, `${label} D7 stamp`, m.containerISO === false && /attempted \d{1,2} [a-z]{3} · \d\d:\d\d utc/.test(m.prov[0] || "") && !!m.timeTitle && /^\d{4}-\d\d-\d\dT/.test(m.timeTitle),
    `ISO on the surface ${m.containerISO}; prov "${m.prov[0]}"; <time title> "${m.timeTitle}"`);
  check(tag, `${label} D8 co-frame`, settle.coFrame === 0, `${settle.coFrame} samples with band + refusal of ${settle.samples.length}; band seen ${settle.seen} (a replayed pair can settle inside one 100 ms interval)`);
  const pairs = await page.evaluate(L.PAIRS, ".scan-refusal"); fs.writeFileSync(path.join(OUT, `${label}-pairs.json`), JSON.stringify(pairs, null, 1));
  const low = pairs.filter((p) => p.ratio < 4.5);
  check(tag, `${label} D9 contrast`, pairs.length >= 5 && low.length === 0, `${pairs.length} pairs; lowest ${Math.min(...pairs.map((p) => p.ratio))}; buttons ${pairs.filter((p) => /dl-btn/.test(p.sel)).map((p) => `${p.fg}/${p.bg} ${p.ratio}`).join(", ")}${low.length ? "; LOW " + low.map((p) => `${p.sel} ${p.ratio}`).join(", ") : ""}`);
  const targets = await page.evaluate(L.TARGETS, ".scan-refusal");
  check(tag, `${label} D10 targets`, targets.length === 2 && targets.every((t) => t.h >= minH), targets.map((t) => `"${t.name}" ${t.w}×${t.h}`).join(" ; "));
  const axe = await L.runAxe(page, OUT, `${label}-axe`);
  const wcag = axe.filter((v) => v.tags.some((t) => /wcag2a$|wcag2aa$|wcag21aa$|wcag22aa$/.test(t)));
  const nodes = wcag.flatMap((v) => v.nodes.map((n) => ({ id: v.id, t: n.target })));
  const unexpected = nodes.filter((n) => !AXE_NAMED[tag].includes(n.id) || !AXE_TARGETS[tag].includes(n.t) || /scan-refusal|scan-actions/.test(n.t));
  check(tag, `${label} D11 axe`, nodes.length <= AXE_BASELINE[tag] && unexpected.length === 0, `${nodes.length} wcag node(s) (baseline ${AXE_BASELINE[tag]}): ${nodes.map((n) => `${n.id}[${n.t}]`).join(" ; ") || "none"}`);
  const live = await page.evaluate(L.LIVE);
  info(tag, `${label} live regions`, live.map((l) => `${l.sel} role=${l.role} live=${l.live} "${l.text.slice(0, 60)}"`).join(" | "));
  return m;
}
async function recoveryLeg(page, tag, label, how) {
  // how: "retry" | "proceed" — click, settle on the live backend (a natural
  // refusal on the way is recorded and retried ≤ 3×).
  let s; let clicks = 0;
  for (let i = 0; i < 4; i++) {
    const name = how === "proceed" && i === 0 ? "Generate anyway" : "↻ Retry scan";
    await page.getByRole("button", { name, exact: true }).click(); clicks++;
    s = await sampleUntilSettled(page, `${label}-${how}${i + 1}`, 90000, true);
    if (how === "proceed" && i === 0) { const b = s.samples.find((x) => x.band); check(tag, `${label} R0 band`, !!b && b.band.verb === "RE-GENERATING" && b.band.object === "without the site check", b ? `"${b.band.verb}" · "${b.band.object}"` : "no band sample"); }
    if (!s.last.refusal) break;
    info(tag, `${label} ${how}`, `natural refusal on the live backend after ${name} (${i + 1}) — "${s.last.refusal.text.slice(0, 80)}"`);
  }
  const m = await page.evaluate(MEASURE);
  const sh = await L.shot(page, OUT, `${label}-recovered`);
  const announced = s.srWrites.filter((w) => /^Plan generated/.test(w));
  check(tag, `${label} R1 recovered`, !m.container && m.hero && m.dlAll > 0 && m.dlOn === m.dlAll && !m.empty && SETTLED.test(m.strip) && !/PLAN DECLINED/.test(m.strip),
    `container ${!!m.container}; hero ${m.hero}; downloads ${m.dlOn}/${m.dlAll} on; empty "${m.empty}"; strip "${m.strip}"; ${clicks} click(s) | ${sh}`);
  check(tag, `${label} R2 announced once`, announced.length === 1 && s.srWrites.length === announced.length && /^Plan generated — \d+ devices, \d+ types\.$/.test(announced[0]), `sr writes during the settle: ${s.srWrites.map((w) => `"${w}"`).join(", ") || "none"}`);
  check(tag, `${label} R3 co-frame`, s.coFrame === 0, `${s.coFrame} samples with band + refusal`);
  if (how === "proceed") { const nc = await page.evaluate(() => { const n = document.querySelector(".site-not-checked"); return n ? { text: n.textContent.trim().replace(/\s+/g, " ").slice(0, 200), iso: /\d{4}-\d\d-\d\dT/.test(n.textContent), title: n.querySelector("time")?.getAttribute("title") ?? null } : null; }); info(tag, `${label} NOT-CHECKED container`, nc ? `present; ISO on surface ${nc.iso}; <time title> "${nc.title}"; "${nc.text}"` : "absent — the re-run scan succeeded (F-S5-7's honest outcome; the label promised nothing)"); if (nc) check(tag, `${label} R4 not-checked stamp`, nc.iso === false && !!nc.title, `ISO ${nc.iso}; title "${nc.title}"`); }
}

(async () => {
  const sha = await L.shaGate(log, EXPECT);
  log(`B1 healthz ${sha} == ${EXPECT}: PASS · base ${BASE} · ${N} run(s) per replay branch`);
  const browser = await L.chromium.launch();
  for (const vp of [{ width: 1440, height: 1000 }, { width: 380, height: 800 }]) {
    const tag = `${vp.width}x${vp.height}`;
    // D0 — natural
    {
      const page = await browser.newPage({ viewport: vp });
      await pin(page);
      await page.getByRole("button", { name: /Generate plan/ }).click();
      const s = await sampleUntilSettled(page, `${tag}-D0`, 120000);
      if (s.last.refusal) {
        const kind = s.last.hero ? "breakdown-ready" : "breakdown-400";
        info(tag, "D0", `NATURAL refusal (${kind} by the settle sample) — measured as a declined plan`);
        await declinedLegs(page, tag, `${tag}-D0natural`, s);
        await recoveryLeg(page, tag, `${tag}-D0natural`, "retry");
      } else {
        const m = await page.evaluate(MEASURE);
        const announced = s.srWrites.filter((w) => /^Plan generated/.test(w));
        check(tag, "D0 clean plan (no natural refusal)", m.hero && m.dlAll > 0 && m.dlOn === m.dlAll && !m.container && announced.length === 1 && s.srWrites.length === 1,
          `hero ${m.hero}; downloads ${m.dlOn}/${m.dlAll}; strip "${m.strip}"; sr writes ${s.srWrites.map((w) => `"${w}"`).join(", ")}; settled ${s.settledAt} ms`);
      }
      await page.close();
    }
    // A×N — breakdown-ready; B×N — breakdown-400
    for (const br of ["A", "B"]) {
      for (let i = 1; i <= N; i++) {
        const label = `${tag}-${br}${i}`;
        const page = await browser.newPage({ viewport: vp });
        await pin(page);
        const st = arm(page, { audit: true, breakdown: br === "B" });
        await page.getByRole("button", { name: /Generate plan/ }).click();
        const s = await sampleUntilSettled(page, label, 120000);
        info(tag, `${label} replay`, `audit fulfilled ${st.audit}; breakdown fulfilled ${st.breakdown}; breakdown ${br === "A" ? (s.last.hero ? "answered (hero held)" : "answered or refused — the settle sample carries no hero either way") : "replayed"}; settled ${s.settledAt} ms`);
        await declinedLegs(page, tag, label, s);
        await recoveryLeg(page, tag, label, br === "B" && i === 1 ? "proceed" : "retry");
        await page.close();
      }
    }
  }
  await browser.close();
  for (const tag of Object.keys(landings)) for (const br of Object.keys(landings[tag])) log(`[${tag}] landing ${br}: container inside [nav-h, innerH] on ${landings[tag][br].inView} of ${landings[tag][br].runs}`);
  const fails = results.filter((r) => !r.ok);
  log(`RESULT ${fails.length === 0 ? "ALL PASS" : "FAIL"} ${results.length - fails.length}/${results.length}${fails.length ? " — " + fails.map((f) => `[${f.tag}] ${f.id}`).join(", ") : ""}`);
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 1));
})().catch((e) => { log("ERR " + e.stack); process.exit(1); });
