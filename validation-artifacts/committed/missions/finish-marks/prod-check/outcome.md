# #397 production check (mission finish-marks, tracking #417)

- Served sha checked: `579405692e8e97ea34d03cd2751e79a848e8970a`. The backend `/healthz` returns it, and the ship verified the served frontend at the same sha. The worktree HEAD is the same commit.
- Checked on 2026-10-26 against https://www.conestruct.com/sandbox, headless Chromium, DPR 2, at 1440x900 and 390x844.
- Real interaction throughout, with the live road lookup and no stubs or injected DOM. Three sites:
  - **Colfax**: an address search for "1600 E Colfax Ave, Denver". The operator picks the Colfax road, the first side option ("South side · eastbound traffic") and the "Shoulder work" kind chip. The length is shot untouched, then 800 is typed and Enter pressed, and the length is shot again. Work type is shot in a second fresh session on the same steps with no length typed, after Confirm.
  - **Wadsworth**: "Wadsworth Blvd & W 10th Ave, Lakewood, CO", the site #397's evidence used. The operator picks Wadsworth Boulevard northbound, the first side option and the near-intersection kind chip (`kind-chip-near_intersection`), types a length of 500 (as #397's script did) and confirms. Lanes is never touched.
  - **No road**: a pin typed in the coordinate boxes at 39.7495, −105.0475, the middle of Sloan's Lake in Denver. The picker reads "No road detected". After the first side option, the "Shoulder work" kind chip and Confirm, the pin's jurisdiction guess is the only ⚠. The operator re-selects its value, as #397's script did, so the header can show its nothing-guessed line.
- The untouched-claims scan opens every row's details (`info-toggle-*`) and counts "✓ yours", "operator-set" and "· typed" in the page text. On Wadsworth it leaves out the length cell, since the length there was typed.
- The script is `prodcheck397.mjs`. It reads the gate token from `conestruct/site/.env.local` at run time, sends it as `x-conestruct-gate`, and never prints or writes it. The raw text of every shot is in `text-prod.json`.

| # | Assertion | Width | Live reading | Result |
|---|---|---|---|---|
| 1 | Untouched length reads "default"; it becomes "typed" / "✓ yours" only after an edit | 1440 | Untouched: ledger "Extent 1,000 ft · default", field marker plain "default" (no ✓). After typing 800: "Extent 800 ft · typed", marker "✓ yours" with "your answer · the extent the plan is built for" | PASS |
| 1 | same | 390 | same strings | PASS |
| 2 | Untouched Work type reads plain "default" | 1440 | "Work type default" on Utility locate (no ✓) | PASS |
| 2 | same | 390 | same | PASS |
| 3 | Near-intersection Lanes (Wadsworth): marker plain "default"; details "default · set the real count" and the amber "⚠ not confirmed · the map reads N per side, but turn lanes can inflate counts near an intersection"; header guess count as #397 states | 1440 | Marker "default"; details "default · set the real count", "Lane width · default · …", amber "⚠ not confirmed · the map reads 4 per side, but turn lanes can inflate counts near an intersection"; header "2 guesses marked ⚠ · change any that are wrong" (the ⚠ markers shown: "⚠ from the road" ×2). This matches `../../form-marks/397/shots/text-after-cycle4.json` exactly | PASS |
| 3 | same | 390 | same strings, header "2 guesses marked ⚠" | PASS |
| 4 | No-detection pin: header "nothing detected; set what the plan needs" | 1440 | Picker "No road detected". Before the re-select the header reads "1 guess marked ⚠" ("⚠ from the pin"); after it, "nothing detected; set what the plan needs". The Lanes row reads "default" with details "default · set the real count" | PASS |
| 4 | same | 390 | same | PASS |
| 5 | No "✓ yours" / "operator-set" on any untouched value | 1440 | Colfax step 1 untouched: 0 / 0 (and 0 "· typed"). Colfax step 2 untouched: 0 / 0. No road: 0 / 0. Wadsworth outside the length cell: 0 "✓ yours", 1 "operator-set" (see note) | PASS |
| 5 | same | 390 | same counts | PASS |

**Counts: 10 PASS, 0 FAIL, 0 N/A.**

Note on assertion 5: the one "operator-set" on Wadsworth is the Cross-street speed field's line "not set · operator-set when picked". The field reads "◌ not set" and the line says what happens once a speed is picked. It claims no value as the operator's, so it doesn't break the assertion. It is older than #397 and outside #397's rows, and it is recorded here as found.

Note on the ledger's ✓: the Extent row's leading ✓ is the move's done state, not a provenance mark (R145-12 in `../../form-marks/397/rulings.md`). It is unchanged and isn't scored here.

Shots (22 files): `prod-<width>-a1-{ledger,length}-{untouched,typed}.png`, `prod-<width>-a2-work-type-untouched.png`, `prod-<width>-a3-{what-header,lanes}-near-intersection.png`, `prod-<width>-a4-what-header-no-detection{,-before-confirm}.png`, `prod-<width>-a4-lanes-no-detection.png`, and `prod-<width>-a5-colfax-what-header.png` (the Colfax step 2 header, "3 guesses marked ⚠", for the record). Assertion 5's counts are in `text-prod.json` under `*Claims*`, with the context around each match.
