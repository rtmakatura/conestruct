# #507 local walk: the map window and the side question

Walked 2026-11-11 on `issue-507-map-window` (uncommitted work on `dc9fcba`), local site and stub backend, Overpass replayed, at 1440x900, 1198x930 and 390x844 (DPR 1, Chromium via Playwright, Inter loaded at every size: `document.fonts` reports an Inter face `loaded`). This is round 2, after the gate round 1 fixes (grouped summary with no direction before a side is picked, "Divided road", the picked-for-you row with its why-line and no Undo). Round 1's crops were moved, not deleted, to `validation-artifacts-extra/ux-group8-map-window/round1-committed/` and `round1-extra/`.

## How it was run

Helper scripts are in `walk-script/`. The walk script itself (`walk507.mjs`, 333 lines), the run logs, the recorded fixtures and the columns-check output are in `validation-artifacts-extra/ux-group8-map-window/walk-run/` and `columns-check-round2/` in the main checkout (untracked).

1. Backend: `walk-script/backend.ps1 -Record 0` runs `stub_backend.py`, which is `scripts/verify-generate-cls-stub.py` plus a third fixture folder. It sets `RENDER_API_SECRET` from the site's `MODAL_RENDER_SECRET` and `MAPBOX_TOKEN` from `NEXT_PUBLIC_MAPBOX_TOKEN`, read raw from the main checkout's `conestruct/site/.env.local` and never printed. Without `RENDER_API_SECRET` every `/api/render/*` call answers 503 "render service is not configured".
2. Site: `node walk-script/launch-site.cjs <worktree>/conestruct/site <main>/conestruct/site/.env.local walk-script/overpass-preload.cjs <fixture dir> 3000 replay`. That runs `next dev` with the same env (raw, no `$` expansion), `MODAL_RENDER_URL=http://127.0.0.1:8000`, and `NODE_OPTIONS=--require overpass-preload.cjs`. `/api/road-bearing` has no env override for its Overpass mirrors (`lib/road-detection/overpass.ts` hard-codes them), so the preload swaps the server's `fetch` for the two mirror hosts only. An ask saved under `sha256(query)[:16]` is replayed. Anything else answers 504, as if both mirrors were down. A query at lat `39.7501` always answers 504: that is the walk's failing point.
3. Fixtures: recorded once (`record` / `-Record 1`, one live ask per missing query), then every walk ran replay-only. Round 2 logs: Next 48 replays and 24 fail-point answers; backend 25 replays; 0 misses and 0 live asks.
4. Walk: `walk-script/run.ps1 walk507.mjs <worktree> <crops dir> <extra dir>` with `SIZES=1440x900,1198x930,390x844`, `ONEWAY_KIND=flagger_lane_closure`, `DIVIDED_KIND=shoulder` and `KEEP=<the crop names below>`. `run.ps1` puts the local gate token in the env, and `scripts/gate.cjs` sends it to the site's own origin only. Pins are placed with the window's coordinate entry, which doesn't zoom the map, so the window crops show the state-level map (existing behaviour). axe-core comes from the site's `node_modules`, run on `[role=dialog]` for the window and `[data-testid=band-where]` for the band.

Points: E Colfax Ave at Williams St `39.73997,-104.96632` (E Colfax's two carriageways 600545936 eastbound and 1548771425 westbound, plus Williams St); N Lincoln St `39.7345,-104.9862` (a one-way street, no same-name opposite way); E Speer Blvd `39.7197,-104.97677` (one carriageway in reach, its twin 60.5 m off); failing point `39.7501,-104.9601`.

## States

All PASS at 1440, 1198 and 390.

| # | State | Crops |
|---|---|---|
| 1a | Grouped street listed once: "East Colfax Avenue · Traffic both ways · 1 m from your pin" (plus "Williams Street · Traffic both ways · 27 m") | w1-1440-grouped, w1-1198-grouped, w1-390-grouped |
| 1b | One-way street: "North Lincoln Street · One-way · 6 m from your pin" | w1-1440-lincoln, w1-1198-lincoln, w1-390-lincoln |
| 1c | Divided, one carriageway in reach: "East Speer Boulevard · Divided road · 0 m from your pin" | w1-1440-speer, w1-1198-speer, w1-390-speer |
| 2a | Grouped street, before a side is picked: the summary reads "East Colfax Avenue · starts 90 ft W of Williams Street · 1,000 ft (default)", with no direction. The question: "Which side of East Colfax Avenue is the work on?" with "South side / Next to eastbound traffic" and "North side / Next to westbound traffic" | w2-1440-grouped-side, w2-1198-grouped-side, w2-390-grouped-side, w2-390-grouped-summary |
| 2b | Twin pick. North side picked: the road swaps 600545936 → 1548771425 (bearing 90.21 → 270.12), the name stays "East Colfax Avenue", both sides are still offered, and the summary now reads "East Colfax Avenue westbound · …". Generate: no 4xx/5xx, strip "⚠ Plan ready. Answer 3 quick questions before you send it." | w2-1440-grouped-twin-picked, g-1440-twin-generated |
| 2c | One-way street (Lincoln, Lane closure with flaggers): one side offered ("East side · northbound traffic") and picked for you. The ✓ row reads "North Lincoln Street is one-way here, so the work is on the east side, next to its traffic." with no Undo in the row | w2-1440-lincoln-side, w2-1198-lincoln-side, w2-390-lincoln-side |
| 2d | Divided (Speer, Shoulder work): one side offered ("Northeast side · traffic heading northwest") and picked for you. The ✓ row reads "East Speer Boulevard is divided here, so the work is on the northeast side, next to the traffic on this side." with no Undo | w2-1440-speer-side, w2-1198-speer-side, w2-390-speer-side |
| 3a | Lookup failed: "We couldn't look up the roads here." / "The road data service didn't answer. Try again, or tell us which way the road runs and carry on." / Try again, four directions, hint; Save disabled | f1-1440-failed, f1-1198-failed, f1-390-failed |
| 3b | Try again re-runs the lookup: `/api/road-bearing` requests 1 → 2 | f1-1440-after-try-again |
| 3c | Each direction picked: one checked at a time, Save turns on. At 390 the crop scrolls the rail to "Which way does the road run?" | f1-{1440,1198,390}-{east-west,north-south,northeast-southwest,northwest-southeast} (12) |
| 3d | Sides after Northeast–southwest: two only, "Southeast side / Next to traffic heading northeast" and "Northwest side / Next to traffic heading southwest", with the line "You said the road runs northeast–southwest, so these are its two sides." | f2-1440-ne-sw-side, f2-1198-ne-sw-side, f2-390-ne-sw-side |
| 4 | Two roads, none ticked: Save disabled with the line "Pick a road, or a direction if the lookup failed." The 390 crop is cut from the road list down to the footer | w1-1440-grouped, w1-1198-grouped, s4-390-save-disabled |
| 5 | #506: a plan on E Colfax → Edit on map → pin moved to the failing point → failed panel, Save disabled with the line. A forced click on Save (DOM `click()` plus Enter) leaves the window open and saves nothing. North–south picked → Save on → saved. The band asks the side again with "You said the road runs north–south, so these are its two sides.", and the wire carries `roadAxis: north_south` with no road and no work | e506-{1440,1198,390}-{failed-save-disabled,direction-picked,after-save} (9) |

The per-state readings are in `walk-run/final-round2.log`. `w2-390-grouped-summary` was re-cropped in a one-flow rerun (`walk-run/rerun-390-summary.log`) because the first crop scrolled the summary under the header. That first crop was moved to `round2-superseded/`.

## axe

Window (`[role=dialog]`): 0 violations in all 36 window readings (12 per size: grouped none-ticked and ticked, Lincoln, Speer, failed, after Try again, the four directions, #506 failed and direction picked). Band (`[data-testid=band-where]`): 0 violations in all 18 side-question readings (6 per size). The walk had no errors.

## 44 px (every visible button, link, input and radio in the window)

- 390: 0 under 44 px in every state.
- 1440 and 1198: 2 under in every state, the coordinate inputs (D3): Latitude and Longitude are 385x43 at 1440 and 284x43 at 1198. `.tap-44` applies only at `max-width: 480px` (globals.css, R138 "Phone width only; the desk keeps rule 15"), so this predates the change. Ruling 1 asks for 44 px on the address field and Search only, and both measure at least 44.
- Excepted per #505: at 1440 "© Mapbox", "© OpenStreetMap", "Improve this map", "© Maxar" (14 px tall) and the Mapbox wordmark (88x23); at 1198 "Toggle attribution" (24x24) and the wordmark; at 390 the wordmark.

## Band height (#469) and columns (#490)

The walk's own reading (band `[data-testid=band-where]`, frame vs the right column's last box, as `verify-columns-end-together.mjs` reads them), 100% text:

| State | 1440 | 1198 | 390 (one column, not compared) |
|---|---|---|---|
| Grouped side question | 793 / 0 / 0 | 793 / 0 / 0 | 912 |
| Grouped, twin picked | 793 / 0 / 0 | 793 / 0 / 0 | 979 |
| Lincoln, side picked for you | 793 / 0 / 0 | 793 / 0 / 0 | 1007 |
| Speer, side picked for you | 793 / 0 / 0 | 793 / 0 / 0 | 1007 |
| F2 after NE–SW | 793 / 0 / 0 | 793 / 0 / 0 | 831 |
| #506 after save | 793 / 0 / 0 | 793 / 0 / 0 | 885 |

(band px / frame↔last px / column↔column px). The base number is 793.25 in every state at 1024, 1198 and 1440 (`missions/move-walk-side-line/issue-489/logs/verify-columns-end-together-states.txt`). The band height is unchanged and the columns end together in every new state.

## Permanent check: `scripts/verify-columns-end-together.mjs`

The Save label was patched to accept "Save and close". This round adds one change, so the existing states pass again. A lone offered side is now picked for you (R145-4), so the stub's one-carriageway Colfax never opened the side question. Every phase now walks with the two-side geometry answer (the script's existing mirrored-side variant, its label put in the backend's "South side · eastbound traffic" form). Diff of the file against HEAD: 14 insertions, 10 deletions (the label patch was 3/3).

Run against the stub at its usual sizes (`SIZES` and `ZOOMS` defaults: 1024x768, 1198x930 and 1440x900, at 100% and 200% text), with no `ONLY`. Output is in `validation-artifacts-extra/ux-group8-map-window/walk-run/cols-round2.log`, crops in `columns-check-round2/`.

- **RESULT PASS** (exit 0). 31 states x 6 size/zoom runs, largest aerial ↔ right column difference 0 px. Marks overlaps 0 and text past the band 0 (186 readings). Your plan and Downloads columns 0 px in 6 runs each.
- Band at 100% text: 793.25 in all 31 states at 1024, 1198 and 1440, the same as the #489 base (793.25).
- At 200% text the band is content-sized, as on the base, so its height follows the text. Against #489's 1440@200% log: +40.5 px in the kind and tap-question states, +115 to +196 px in the side states, edit-cancelled and edit-done-side-reasked; −37.5 to −182.5 px in the tap-failed, tap-none and tap-found states; 0 px in edit-panel, edit-length-typed, edit-moved, reopened-after-confirm and cancelled-after-confirm; −40.5 px in edit-after-confirm. All PASS. These come from this branch's content: the side question now has two options in every phase, plus the new copy. #469's one height is the 100% band, and that is unchanged.

## Round 1 findings, now

- **D1 (why-line not shown): fixed.** The picked-for-you row shows its why-line at all three sizes (2c, 2d), with no Undo in the row.
- **D2 (permanent check broken): fixed** for `verify-columns-end-together.mjs` (above). `scripts/verify-generate-cls.mjs`, `probe.cjs`, `sweep.cjs` and the other `scripts/` files changed in the worktree were not run here.
- **D3 (pre-existing, recorded):** the coordinate inputs are 43 px tall at desk widths.

**Observations (not defects):**
- After the twin pick, the option order flips: the picked carriageway's side moves to the top (North first, then South). Both stay offered.
- On a cardinal direction the fallback reads "Next to traffic heading north", while a detected cardinal road reads "Next to northbound traffic" (ruling 5's F2 wording in the axis branch).
- N Lincoln St with Shoulder work offers two sides (#300's left curb), so nothing is picked for you there, as R145-4 says.
- The no-road fallback's summary reads "1,000 ft (default)" (the band's length default; here the operator answered the direction).

## Gate round 3 (#511, #512, #513), walked 2026-11-11

Same local setup (stub backend running the worktree's `src`, so `/render/road-travel` is live; Overpass replayed, 0 live asks). The script was `walk507.mjs` plus a `reopen` flow; it and its logs are in `validation-artifacts-extra/ux-group8-map-window/round3/logs/` in the main checkout. Sizes 1440x900, 1198x930, 390x844.

| State | Reading | Crops |
|---|---|---|
| #512 rows, words from the backend | Lincoln: "One-way · 6 m from your pin"; Colfax: "Traffic both ways · 1 m from your pin", Williams "Traffic both ways · 27 m from your pin", byte for byte round 2's words, at all three sizes | (logs) |
| #511 picked tile | North–south picked: filled mark plus the ring; the other three show the empty mark. axe 0 in all 15 failed-panel readings | f1-1440-north-south, f1-1198-north-south, f1-390-north-south (replace round 2's) |
| #513 window reopened on a confirmed plan | Colfax, Shoulder work, side picked, then "Edit on map": the rail reads the road question with the row, "You'll pick the side of the road next, on the page.", and "Where the work starts". No Centerline row shows in this state (the preview shows it only once the kind is confirmed, which the walk didn't reach); its words are covered by the mounted `coverage` and `preview-refusal` tests (21 passed). axe 0, 44 px 0 under | r513-1440-reopened, r513-1198-reopened, r513-390-reopened |

Not new: Latitude and Longitude measure 43 px high at 1440 and 1198 in the failed panel, as in round 2 (`final-round2.log`, 12 readings). Not changed here.
