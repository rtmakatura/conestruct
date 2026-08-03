/**
 * Arc 8 live-site verification — #179 against
 * https://www.conestruct.com/sandbox.  READ-ONLY: no accounts, no DB
 * writes, no plan saves; the only route interception is a delay throttle
 * on the page's own audit POST (to widen the in-flight windows) — every
 * response is the real backend's.
 *
 * Live-data notes (run 2 findings):
 * - The standing E Colfax pin's candidate is now named "East Colfax
 *   Avenue eastbound" (way 600545947) — the NAME says eastbound but the
 *   way is tagged both-directions (3 forward, 2 backward, no blocking
 *   oneway), so it arms the #86 multilane row only, exactly the GO's
 *   E Colfax expectation.  The two-way Colfax candidate of the Arc 2
 *   era is gone (OSM drift, disclosed).
 * - The #158 one-way loop therefore runs at Lincoln St (one-way
 *   northbound; Ryan's candidate), Broadway fallback, with a co-armed
 *   guard (a one-way road's lane count can arm #86 simultaneously).
 *
 * Checks (per the GO): 1 armed refusal at E Colfax; 2 tick renders the
 * row checked in place with the marker-built description (actual
 * values), refusal clears, Generate enables, payload carries the
 * override; 3 untick gates the CTA through the throttled in-flight
 * window, strip goes VERIFYING then the original refusal returns, row
 * re-arms, payload byte-identical to pre-tick; 4 keyboard + focus
 * retention through both (the toggles run via keyboard Space);
 * 5 tick-untick-tick → exactly one override; 6 the #158 loop with the
 * recorded oneway value; 7 single-lane best-effort (one pin);
 * 8 supersession — re-pin removes confirmed row and marker together.
 *
 * Run: EXPECTED_SHA=$(git rev-parse origin/main) \
 *      NODE_PATH=<scratch>/pw/node_modules node arc8-live-checks.js
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "out8");
fs.mkdirSync(OUT, { recursive: true });

const SITE = "https://www.conestruct.com/sandbox";
const EXPECTED_SHA = process.env.EXPECTED_SHA || "";

const COLFAX = { lat: "39.73997", lng: "-104.96632" }; // standing #86 spot
const PARK = { lat: "39.7312", lng: "-104.9665" }; // quiet re-pin target
const LINCOLN = { lat: "39.73310", lng: "-104.98630" }; // one-way northbound
const BROADWAY = { lat: "39.73310", lng: "-104.98770" }; // one-way fallback
const ALLEY = { lat: "39.75151", lng: "-104.99801" }; // single-lane attempt

const lines = [];
let failures = 0;
function log(msg) {
  const stamp = new Date().toISOString();
  lines.push(`- \`${stamp}\` ${msg}`);
  console.log(`${stamp} ${msg}`);
}
function assert(name, cond, extra = "") {
  if (cond) log(`**PASS** — ${name}${extra ? ` (${extra})` : ""}`);
  else {
    failures++;
    log(`**FAIL** — ${name}${extra ? ` (${extra})` : ""}`);
  }
}
async function shot(page, name, full = false) {
  await page.screenshot({ path: path.join(OUT, name), fullPage: full });
  log(`screenshot: ${name}`);
}

const strip = async (page) =>
  (await page.locator(".status-bar").first().textContent().catch(() => "")) ?? "";
const declinedRe = /PLAN DECLINED/;
async function waitSettled(page, timeout = 90000) {
  await page.waitForFunction(
    () => {
      const s = document.querySelector(".status-bar")?.textContent ?? "";
      return !/VERIFYING|COMPUTING/.test(s);
    },
    null,
    { timeout },
  );
}
// After a tick/untick: past the 350 ms debounce (so the refetch is in
// flight), then wait for the settled verdict.
async function settleAfterEdit(page) {
  await page.waitForTimeout(700);
  await waitSettled(page);
}
async function waitDeclined(page, timeout) {
  await page.waitForFunction(
    () =>
      /PLAN DECLINED|INVALID INPUT/.test(
        document.querySelector(".status-bar")?.textContent ?? "",
      ),
    null,
    { timeout },
  );
}

async function openPickerWithCoords(page, coords, reopen = false) {
  const btn = reopen
    ? page.getByRole("button", { name: /Edit Location & Corridor/ })
    : page.getByRole("button", { name: "Pick Location on Map" });
  await btn.click();
  await page.getByRole("dialog", { name: "Define work zone" }).waitFor();
  const toggle = page.getByText(/enter coordinates manually/i);
  if (await toggle.isVisible().catch(() => false)) await toggle.click();
  await page.getByLabel("Latitude").fill(coords.lat);
  await page.getByLabel("Longitude").fill(coords.lng);
}
const saveBtn = (page) => page.getByRole("button", { name: "Save & Close" });
async function saveWhenReady(page) {
  const save = saveBtn(page);
  for (let i = 0; i < 30 && !(await save.isEnabled().catch(() => false)); i++) {
    await page.waitForTimeout(1000);
  }
  if (!(await save.isEnabled().catch(() => false))) return false;
  await save.click();
  await page.waitForTimeout(800);
  return true;
}

// Candidate picking at a pin.  Waits out "Detecting roads at pin…",
// then: no candidate list means the single candidate auto-picked
// (returns "(auto)"); a list picks the first row matching `prefer`,
// else the first row.
async function pickCandidate(page, prefer) {
  for (let i = 0; i < 40; i++) {
    const t = (
      (await page.getByRole("dialog").textContent().catch(() => "")) ?? ""
    ).replace(/\s+/g, " ");
    if (!/Detecting roads at pin|Classifying road/i.test(t)) break;
    await page.waitForTimeout(1000);
  }
  const rows = page.locator("button", { hasText: "m from pin" });
  const n = await rows.count();
  if (n === 0) return "(auto)";
  let target = null;
  let label = null;
  for (let i = 0; i < n; i++) {
    const t = ((await rows.nth(i).textContent()) ?? "").replace(/\s+/g, " ");
    if (prefer && !prefer.test(t)) continue;
    target = rows.nth(i);
    label = t.trim();
    break;
  }
  if (!target) {
    target = rows.first();
    label = ((await target.textContent()) ?? "").trim();
  }
  await target.click();
  log(`candidate picked: "${label}"`);
  return label;
}

const MULTILANE_RE = /Road has one through lane in each direction/;
const SINGLELANE_RE = /Road has one lane in each direction/;
const TWOWAY_RE = /Road carries two-way traffic/;

const confirmRowLoc = (page, nameRe) =>
  page.getByRole("checkbox", { name: nameRe });
async function rowState(page, nameRe) {
  const row = confirmRowLoc(page, nameRe);
  if ((await row.count()) === 0) return { present: false, checked: false };
  return {
    present: true,
    checked: (await row.first().getAttribute("aria-checked")) === "true",
    text: ((await row.first().textContent()) ?? "").replace(/\s+/g, " ").trim(),
  };
}
async function activeDesc(page) {
  return page.evaluate(() => {
    const el = document.activeElement;
    return {
      tag: el ? el.tagName : null,
      role: el && el.getAttribute ? el.getAttribute("role") : null,
      text: el ? (el.textContent || "").replace(/\s+/g, " ").slice(0, 60) : "",
      isBody: el === document.body,
    };
  });
}
async function keyToggle(page, nameRe) {
  const el = confirmRowLoc(page, nameRe).first();
  await el.focus();
  await page.keyboard.press("Space");
  await page.waitForTimeout(200);
}
const overridesOf = (body) => JSON.parse(body).scenario.detectionOverrides;

// Route capture + optional delay throttle, one per context.
async function auditTap(page) {
  const state = { bodies: [], delay: 0 };
  await page.route("**/api/render/audit", async (route) => {
    state.bodies.push(route.request().postData() ?? "");
    if (state.delay > 0) {
      log(`intercepted audit — delaying ${state.delay} ms`);
      await new Promise((r) => setTimeout(r, state.delay));
    }
    await route.continue();
  });
  return state;
}
const lastBody = (tap) => tap.bodies[tap.bodies.length - 1];

(async () => {
  const browser = await chromium.launch({ headless: true });

  // ── Build gate ────────────────────────────────────────────────────────
  const gate = await browser.newContext();
  const gp = await gate.newPage();
  const hz = await (
    await gp.request.get(
      "https://rtmakatura--conestruct-render-fastapi-app.modal.run/healthz",
    )
  ).json();
  log(`healthz sha: ${hz.sha}`);
  log(`expected (git rev-parse origin/main): ${EXPECTED_SHA}`);
  await gp.goto(SITE, { waitUntil: "networkidle" });
  const chunkUrls = await gp.evaluate(() =>
    Array.from(document.querySelectorAll("script[src]"))
      .map((s) => s.src)
      .filter((s) => s.includes("/_next/static")),
  );
  let servedSha = null;
  for (const u of chunkUrls) {
    const txt = await (await gp.request.get(u)).text();
    const m = txt.match(new RegExp(`${EXPECTED_SHA.slice(0, 7)}[0-9a-f]{33}`));
    if (m) {
      servedSha = m[0];
      break;
    }
  }
  log(`served bundle sha: ${servedSha}`);
  if (hz.sha !== EXPECTED_SHA || servedSha !== EXPECTED_SHA) {
    log("**ABORT** — build gate mismatch");
    console.log("GATE MISMATCH — aborting");
    process.exit(2);
  }
  assert("gate. healthz == origin/main == served bundle", true, hz.sha);
  await gate.close();

  // ── Context A — the full #86 loop at E Colfax ─────────────────────────
  lines.push("\n## Context A — #86 multilane loop at E Colfax\n");
  {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 1400 },
    });
    const page = await ctx.newPage();
    const tap = await auditTap(page);
    await page.goto(SITE, { waitUntil: "domcontentloaded" });
    await page.getByText("Flagger lane closure", { exact: true }).click();
    log("kind: flagger lane closure");

    await openPickerWithCoords(page, COLFAX);
    const picked = await pickCandidate(page, /colfax/i);
    assert("A-0. Colfax candidate offered and picked", /colfax/i.test(picked ?? ""), picked ?? "");
    await saveWhenReady(page);
    await waitDeclined(page, 60000);
    await waitSettled(page);

    // Check 1 — refusal + armed row.
    let ml = await rowState(page, MULTILANE_RE);
    assert(
      "1a. the E Colfax relays arm the #86 refusal (PLAN DECLINED)",
      declinedRe.test(await strip(page)),
    );
    assert(
      "1b. armed confirm row on screen, unchecked",
      ml.present && !ml.checked,
      ml.text ?? "",
    );
    await shot(page, "01-armed-refusal.png", true);
    const preTickBody = lastBody(tap);

    // Check 2 — tick via keyboard.
    await keyToggle(page, MULTILANE_RE);
    ml = await rowState(page, MULTILANE_RE);
    assert(
      "2a. row stays mounted and renders checked",
      ml.present && ml.checked,
      ml.text ?? "",
    );
    assert(
      "2b. marker-built description with actual detected values",
      /Map data reported \d+ total lanes( \([^)]+\))? — untick to restore detection/.test(
        ml.text ?? "",
      ),
      ml.text ?? "",
    );
    let d = await activeDesc(page);
    assert(
      "4a. focus stays on the row through the tick",
      d.role === "checkbox" && MULTILANE_RE.test(d.text),
      JSON.stringify(d),
    );
    await settleAfterEdit(page);
    assert(
      "2c. refusal clears at settle; Generate enables",
      !declinedRe.test(await strip(page)) &&
        !(await page.getByRole("button", { name: "Generate plan" }).isDisabled()),
      `strip: "${(await strip(page)).slice(0, 60)}"`,
    );
    const postTickSc = JSON.parse(lastBody(tap)).scenario;
    assert(
      "2d. post-tick payload: override riding, scenario relays absent",
      (postTickSc.detectionOverrides ?? []).length === 1 &&
        postTickSc.detectionOverrides[0].via === "flagger_multilane_confirm" &&
        postTickSc.detectedLanesTotal === undefined,
      JSON.stringify(postTickSc.detectionOverrides),
    );
    await shot(page, "02-ticked-checked.png", true);

    // Check 3 — untick via keyboard, window widened by the throttle.
    tap.delay = 5000;
    await keyToggle(page, MULTILANE_RE);
    ml = await rowState(page, MULTILANE_RE);
    assert(
      "3a. untick re-arms the row unchecked immediately",
      ml.present && !ml.checked,
      ml.text ?? "",
    );
    d = await activeDesc(page);
    assert(
      "4b. focus stays on the row through the untick",
      d.role === "checkbox" && MULTILANE_RE.test(d.text),
      JSON.stringify(d),
    );
    await page.waitForTimeout(900); // past the debounce, inside the window
    assert(
      "3b. THE mirror window — CTA gated while the untick's verdict is in flight",
      await page.getByRole("button", { name: "Generate plan" }).isDisabled(),
    );
    assert(
      "3c. the gate names itself (Re-checking the declined input)",
      (await page.getByText(/Re-checking the declined input/).count()) > 0,
    );
    await shot(page, "03-untick-window-gated.png");
    tap.delay = 0;
    await waitSettled(page);
    assert(
      "3d. the original refusal returns at settle (honestly re-derived)",
      declinedRe.test(await strip(page)) &&
        (await page.getByRole("button", { name: "Generate plan" }).isDisabled()),
      `strip: "${(await strip(page)).slice(0, 80)}"`,
    );
    assert(
      "3e. post-untick payload byte-identical to pre-tick",
      lastBody(tap) === preTickBody,
      `pre ${preTickBody.length}B vs post ${lastBody(tap).length}B`,
    );
    await shot(page, "04-refusal-returned.png", true);

    // Check 5 — tick-untick-tick: exactly one override, no accumulation.
    await keyToggle(page, MULTILANE_RE);
    await settleAfterEdit(page);
    const finalOverrides = overridesOf(lastBody(tap)) ?? [];
    assert(
      "5. tick-untick-tick: exactly one override in the payload",
      finalOverrides.length === 1 &&
        finalOverrides[0].via === "flagger_multilane_confirm",
      JSON.stringify(finalOverrides),
    );

    // Check 8 — supersession: re-pin while the row is confirmed.
    await openPickerWithCoords(page, PARK, true);
    await pickCandidate(page, null);
    const savedRepin = await saveWhenReady(page);
    assert("8a. re-pin save completed", savedRepin);
    await settleAfterEdit(page);
    const checkedRows = await page
      .locator('[role="checkbox"][aria-checked="true"]')
      .filter({ hasText: /Map data reported/ })
      .count();
    const scAfterRepin = JSON.parse(lastBody(tap)).scenario;
    assert(
      "8b. supersession removes the confirmed row and its marker together",
      checkedRows === 0 && scAfterRepin.detectionOverrides === undefined,
      `checked rows: ${checkedRows}; overrides: ${JSON.stringify(scAfterRepin.detectionOverrides)}`,
    );
    await shot(page, "05-supersession.png", true);
    await ctx.close();
  }

  // ── Context B — the #158 one-way loop (Lincoln St, Broadway fallback) ─
  lines.push("\n## Context B — #158 one-way loop\n");
  {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 1400 },
    });
    const page = await ctx.newPage();
    const tap = await auditTap(page);
    await page.goto(SITE, { waitUntil: "domcontentloaded" });
    await page.getByText("Flagger lane closure", { exact: true }).click();

    // The armed two-way row rendering IS the verification that detection
    // returned a blocking oneway value — it renders on nothing else.
    let ow = { present: false, checked: false };
    for (const [name, pin, re] of [
      ["Lincoln St", LINCOLN, /lincoln/i],
      ["Broadway", BROADWAY, /broadway/i],
    ]) {
      const reopen = (await page.getByRole("button", { name: /Edit Location & Corridor/ }).count()) > 0;
      await openPickerWithCoords(page, pin, reopen);
      const picked = await pickCandidate(page, re);
      log(`${name} pick: ${picked}`);
      const saved = await saveWhenReady(page);
      if (!saved) {
        await page.getByRole("button", { name: "Cancel" }).click().catch(() => {});
        continue;
      }
      await settleAfterEdit(page);
      ow = await rowState(page, TWOWAY_RE);
      if (ow.present) {
        log(`one-way relay armed at ${name}`);
        break;
      }
      log(`no one-way relay at ${name} — trying next spot`);
    }
    assert(
      "6a. a one-way spot arms the two-way confirm row, unchecked",
      ow.present && !ow.checked,
      ow.text ?? "",
    );
    if (ow.present) {
      // A one-way road's lane count can co-arm #86 — confirm it first so
      // the one-way gate is the remaining refusal (gate order #86 → #158).
      const ml = await rowState(page, MULTILANE_RE);
      if (ml.present && !ml.checked) {
        await keyToggle(page, MULTILANE_RE);
        await settleAfterEdit(page);
        log("co-armed #86 row confirmed first");
      }
      const preOneWayBody = lastBody(tap);
      await shot(page, "06-oneway-armed.png", true);

      await keyToggle(page, TWOWAY_RE);
      ow = await rowState(page, TWOWAY_RE);
      assert(
        "6c. tick: checked with the recorded oneway value in the description",
        ow.present &&
          ow.checked &&
          /Map data reported .*a one-way road \(oneway=[^)]+\) — untick to restore detection/.test(
            ow.text ?? "",
          ),
        ow.text ?? "",
      );
      await settleAfterEdit(page);
      assert(
        "6d. refusal clears once every armed row is confirmed",
        !declinedRe.test(await strip(page)),
        `strip: "${(await strip(page)).slice(0, 60)}"`,
      );
      await shot(page, "07-oneway-ticked.png", true);

      await keyToggle(page, TWOWAY_RE);
      await settleAfterEdit(page);
      ow = await rowState(page, TWOWAY_RE);
      assert(
        "6e. untick: the one-way refusal returns; row re-arms unchecked",
        declinedRe.test(await strip(page)) && ow.present && !ow.checked,
        `strip: "${(await strip(page)).slice(0, 80)}"`,
      );
      const sc = JSON.parse(lastBody(tap)).scenario;
      assert(
        "6f. post-untick payload: oneway restored, its marker gone (byte-identical to pre-tick)",
        typeof sc.oneway === "string" &&
          !(sc.detectionOverrides ?? []).some(
            (m) => m.via === "flagger_twoway_confirm",
          ) &&
          lastBody(tap) === preOneWayBody,
        `oneway=${sc.oneway}`,
      );
      await shot(page, "08-oneway-refusal-returned.png", true);
    }
    await ctx.close();
  }

  // ── Context C — #136 single-lane, best-effort (one pin only) ─────────
  lines.push("\n## Context C — #136 single-lane (best-effort)\n");
  {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 1400 },
    });
    const page = await ctx.newPage();
    await page.goto(SITE, { waitUntil: "domcontentloaded" });
    await page.getByText("Flagger lane closure", { exact: true }).click();
    await openPickerWithCoords(page, ALLEY);
    await pickCandidate(page, null);
    const saved = await saveWhenReady(page);
    let found = false;
    if (saved) {
      await settleAfterEdit(page).catch(() => {});
      const sl = await rowState(page, SINGLELANE_RE);
      if (sl.present) {
        found = true;
        await keyToggle(page, SINGLELANE_RE);
        const ticked = await rowState(page, SINGLELANE_RE);
        assert(
          "7a. single-lane tick: checked with the recorded value",
          ticked.checked &&
            /Map data reported 1 total lane/.test(ticked.text ?? ""),
          ticked.text ?? "",
        );
        await settleAfterEdit(page);
        await keyToggle(page, SINGLELANE_RE);
        await settleAfterEdit(page);
        const back = await rowState(page, SINGLELANE_RE);
        assert(
          "7b. single-lane untick: refusal returns, row re-arms",
          declinedRe.test(await strip(page)) && back.present && !back.checked,
        );
        await shot(page, "09-single-lane-loop.png", true);
      }
    }
    if (!found) {
      log(
        "7. single-lane spot NOT found at the one attempted pin (best-effort per the GO) — the #136 loop rests on the mounted round-trip in GeneratorForms.confirm-undo.test.tsx",
      );
    }
    await ctx.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT, "assertions-raw.md"), lines.join("\n"));
  console.log(`DONE — failures: ${failures}`);
  process.exit(failures === 0 ? 0 : 1);
})();
