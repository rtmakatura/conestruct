// s2-arc24 live check, browser leg — the deployed /sandbox at the Denver pin.
// Legs: B1 healthz == expected sha (gate) · B2 pin → sidebar corridor block
// (Downstream / Total) · B3 picker legend (Downstream / Total) · B4 fact-strip
// and setup-strip jurisdiction cells with no key, then after Confirm.
// node s2a24-lc-prod.js <outDir> <expectSha>
const L = require("C:/Users/rtmak/Documents/traffic-control-tool/validation-artifacts/committed/s2-audit-1/audit-lib.js");
const BASE = "https://www.conestruct.com";
const [OUT, EXPECT] = process.argv.slice(2);
const { log } = L.mkLog(OUT);
const PIN = { lat: "39.7269", lng: "-104.9873" };

(async () => {
  const sha = await L.shaGate(log, EXPECT);
  log(`B1 healthz sha ${sha} == expected ${EXPECT}: ${sha === EXPECT ? "PASS" : "FAIL"}`);
  if (sha !== EXPECT) process.exit(2);
  const browser = await L.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/sandbox", { waitUntil: "networkidle", timeout: 60000 });
  const fill = async (labelText, value) => {
    const input = page.locator(`label:text-is("${labelText}")`).locator("xpath=following-sibling::input[1]");
    await input.fill(value);
  };
  const cell = async (label) => {
    // fact strip: <FactCell label value> — the label's sibling value node.
    const t = await page.locator(".fact-strip").innerText().catch(() => "");
    // the label renders uppercase (CSS text-transform reaches innerText)
    const m = new RegExp(`${label}\\s*\\n?\\s*([^\\n]+)`, "i").exec(t);
    return m ? m[1].trim() : null;
  };
  const stripCell = async () => {
    const el = page.getByLabel("Edit Jurisdiction");
    return (await el.count()) ? (await el.first().innerText()).replace(/\s+/g, " ").trim() : null;
  };

  // B2 — pin (no key), the audit walk's manual-pin sequence
  await page.getByRole("button", { name: "Enter manually", exact: true }).click();
  await fill("Latitude", PIN.lat);
  await page.getByRole("button", { name: "Edit manually", exact: true }).click();
  await fill("Longitude", PIN.lng);
  await fill("Bearing (° from N)", "180");
  await fill("Work zone (ft)", "1000");
  await page.waitForTimeout(5000);
  const side = await page.locator(".setup-panel").innerText().catch(() => "");
  const ds = /Downstream\s*\n?\s*([\d,]+) ft/.exec(side);
  const tot = /Total\s*\n?\s*([\d,]+) ft/.exec(side);
  log(`B2 sidebar corridor block: Downstream ${ds ? ds[1] : "?"} ft · Total ${tot ? tot[1] : "?"} ft — ${ds && ds[1] === "50" && tot && tot[1] === "3,412" ? "PASS" : "FAIL"}`);
  log(`B4a no key: fact-strip Jurisdiction "${await cell("Jurisdiction")}" · setup-strip cell "${await stripCell()}" (setup-strip cell mounts post-generate — not observed here; "None — baseline" on main today, "Not set" once f36960d deploys)`);
  log(`  shot ${await L.shot(page, OUT, "b2-pinned", true)}`);

  // B3 — picker legend
  await page.getByRole("button", { name: /Pick Location on Map|Edit location|Change location/i }).first().click().catch(async () => {
    await page.getByRole("button", { name: /location/i }).first().click();
  });
  await page.waitForTimeout(3000);
  const dlg = page.locator("[role=dialog]");
  const dt = (await dlg.count()) ? await dlg.first().innerText() : "";
  const lds = /Downstream\s*\n?\s*([\d,]+) ft/.exec(dt);
  const ltot = /Total\s*\n?\s*([\d,]+) ft/.exec(dt);
  log(`B3 picker legend: Downstream ${lds ? lds[1] : "?"} ft · Total ${ltot ? ltot[1] : "?"} ft — ${lds && lds[1] === "50" ? "PASS" : "FAIL"}`);
  log(`  shot ${await L.shot(page, OUT, "b3-picker", false)}`);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(800);

  // B4b — confirm the Denver suggestion, read the cells
  const confirm = page.locator(".jctl-band button", { hasText: /Confirm/ });
  await confirm.first().waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
  if (await confirm.count()) {
    await confirm.first().click();
    await page.waitForTimeout(3000);
    log(`B4b confirmed: fact-strip Jurisdiction "${await cell("Jurisdiction")}" · setup-strip cell "${await stripCell()}" — ${(await cell("Jurisdiction")) === "Denver" ? "PASS" : "FAIL"}`);
    log(`  shot ${await L.shot(page, OUT, "b4-confirmed", true)}`);
  } else log("B4b no suggestion Confirm found in the band");
  await browser.close();
  log("done");
})().catch((e) => { log("ERROR " + (e && e.stack || e)); process.exit(1); });
