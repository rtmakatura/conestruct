# Arc 2 — live-site verification (#185, #192, #187, #196, #189-3, #197 instance)

Run 2026-08-01, headless Chromium (Playwright 1.62.1) against the
production sandbox `https://www.conestruct.com/sandbox`. Script:
`arc2-live-checks.js` (this directory).

**Read-only run:** no account created, no plan saved, nothing deleted.
Generate clicks are stateless POST `/api/render/*` calls (no DB writes).
The synthetic 400 for the OutputCards check was fulfilled by route
interception and never reached the server.

## Deployed-build confirmation (all three stamps agree)

| Surface | Evidence | Value |
|---|---|---|
| git | `git rev-parse origin/main` | `217a641758279ba0b6c9f08dcb4e04a7d10eaa46` |
| Backend | `GET /healthz` (Modal) | `{"status":"ok","sha":"217a641758279ba0b6c9f08dcb4e04a7d10eaa46"}` |
| Frontend | sha inlined in the served bundle (`/_next/static/chunks/720-30200acef50d41fb.js`, `829-9d79498013cb3037.js`, `main-app-8eda6752b31e45cc.js`) | same |

`217a641` is the Arc 2 evidence commit — the tip of the ten-commit arc
stack (`7fa7d14` idiom … `08a5d18` #189-3), fast-forwarded onto main by
ship.ps1.

## Method notes & deviations (report, not workaround)

- **#183 NOT attempted — BLOCKED as instructed**: the workbench dirty
  gate requires an existing saved plan row; creating one violates the
  read-only rule. Ryan decides whether to seed a throwaway plan.
- The E Colfax pin (39.73997, -104.96632) offered a single Colfax
  candidate this run: "East Colfax Avenue eastbound (primary, 90deg) -
  way 600545947" (the two-way/eastbound preference fell back to it). It
  still armed the multilane refusal — PLAN DECLINED with the
  "confirm the lane count" pointer and the "Road has one through lane in
  each direction" confirm row — which is the state checks #187/#196/#189-3
  need; noted rather than forced.
- The #192 refusal-over-COMPUTING branch capture uses the geometry
  taper-floor 400 (work zone 50 ft via the strip) in the post-generate
  context, because the COMPUTING branch only exists post-generate and
  post-generate location editing requires a full-setup reopen. The
  E Colfax #86 refusal itself is captured separately (pre-generate, where
  COMPUTING cannot fire; its absence during that window is asserted too).
- #196 window widened by throttling `/api/render/audit` +6 s;
  #192 in-flight windows by throttling `/api/render/device-breakdown`.
- XLSX capture: the page issued its own quote POST; the identical body
  was re-POSTed via the browser context to capture the served bytes
  (`quote-after-edit.xlsx`). `parse-quote-xlsx.py` compares its TOTAL
  ESTIMATE cell against the on-screen 2dp total (`screen-total.txt`).

## Results

**30/30 PASS** (27 in-page assertions in `assertions-raw.md`, verbatim
with timestamps, + the build gate + the XLSX agreement parse):

- **#185**: settings edit replaces all figures with "Inputs changed —
  preview again" (headline included); re-preview restores; **screen
  $1,124.64 == XLSX TOTAL ESTIMATE 1124.64 to the cent** — the
  screen/file-agreement acceptance, live.
- **#192**: post-generate edit dims in place under the recomputing
  ribbon (no unmount, hero holds the previous answer, marked); settle
  clears; a 400 settling mid-recompute renders **PLAN DECLINED over the
  still-in-flight ribbon** — COMPUTING never masks it.
- **#187**: under the declined banner: rows "L = -", "B = - ft",
  "VALUES UNAVAILABLE — THE AUDIT FOR THIS INPUT DID NOT SUCCEED", zero
  cited ft values, zero check glyphs, Audit PDF disabled
  (title "Unavailable — generation declined for this input").
- **#196**: settled refusal gates Generate; ticking the confirm row
  keeps it gated through the 6 s window with the "Re-checking the
  declined input" reason; settled verdict (VERIFIED) re-enables —
  CTA state matches the verdict.
- **#189-3**: Colfax save arms the relays (confirm affordance renders);
  the settled-null Cheesman save clears them (affordance gone, strip
  returns to VERIFIED — nothing detected, nothing to refuse).
- **#197 instance**: an intercepted download 400 renders its message +
  "Try again"; a scenario edit drops both.

## Screenshot index

| File | Shows |
|---|---|
| a-192-recomputing-dim.png | Post-generate edit: ribbon + dimmed prior hero, no empty-state |
| a-185-previewed.png | Previewed breakdown (overhead 10%) |
| a-185-inputs-changed.png | After the overhead edit: "Inputs changed", headline unset, no figures |
| a-185-repreviewed.png | Re-previewed figures at overhead 20% |
| a-192-declined-over-computing.png | **PLAN DECLINED banner above the in-flight Recomputing ribbon** |
| b-86-refusal-settled.png | E Colfax flagger refusal settled (PLAN DECLINED + pointer) |
| b-187-audit-declined-blank.png | Declined audit panel: "L = -" rows, stated reason, dimmed Audit PDF |
| b-196-window-gated.png | Mid-window: Generate gated + "Re-checking the declined input" |
| b-196-settled.png | Settled verdict; CTA matches |
| c-1893-relays-armed.png | Confirm affordance after the Colfax save (relays present) |
| c-1893-relays-cleared.png | After the settled-null Cheesman save: affordance gone |
| d-197-error-shown.png | Intercepted 400: message + "Try again" |
| d-197-error-cleared.png | After the edit: error gone |
