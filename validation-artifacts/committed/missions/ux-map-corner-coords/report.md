# Mission ux-map-corner-coords — report

Tracking issue #539. Prompt: `docs/prompts/cc-prompt-ux-map-corner-coords.md` (Ryan's rulings of 2026-11-12, boards `Corner3` N2 and `Ideas2` S2). Run 2026-11-19.

## Questions for Ryan

1. **The coordinates bar's labels on a phone (#537, call 6, R145 self-ruled).** The ruling names the labels "Latitude" and "Longitude". The labels show "Lat" and "Long" when the bar is under 480 px wide, so "-104.9811" fits at 390. Screen readers still hear "Latitude" and "Longitude". The independent reviewer flagged it (medium): it changes ruled words on screen, and "Long" alone can be misread. You can see it in `issue-537/shots/390-editing.png`. **Recommendation:** keep it for your preview check. If you want the full words, the fix is a narrower box or a two-line label, as its own issue.

No item parked.

## Ready to ship

Top branch **`issue-538-typed-coords-zoom`** at `25cc504`, CI green (Python and Frontend). The chain, bottom to top:

| sha | branch | what |
|---|---|---|
| `fb86902` | `issue-535-prod-check` | #535's production-check evidence (ships with this chain) |
| `bed68a4` | `prompt-ux-map-corner-coords` | the prompt, committed (the untracked copy moved to `validation-artifacts-extra/ux-map-corner-coords/cc-prompt-untracked-copy.md`) |
| `26df927` | `issue-536-corner-in-title` | #536 |
| `b621c72` | `issue-537-coords-bar` | #537 |
| `cb850bf` | `issue-538-typed-coords-zoom` | #538 |
| `25cc504` | `issue-538-typed-coords-zoom` | #537's CI fix (tap-target test) |
| this commit | `issue-538-typed-coords-zoom` | this report |

`issue-537-coords-bar` on its own (`b621c72`) is red in CI on `tap-targets.test.ts`. The fix is `25cc504`, on the top branch. Ship only the top branch.

## Filed

- #536 https://github.com/rtmakatura/conestruct/issues/536 — corner in the row title (N2)
- #537 https://github.com/rtmakatura/conestruct/issues/537 — fixed 44 px coordinates bar (S2)
- #538 https://github.com/rtmakatura/conestruct/issues/538 — typed coordinates zoom the map to the pin
- #539 https://github.com/rtmakatura/conestruct/issues/539 — tracking
- #540 https://github.com/rtmakatura/conestruct/issues/540 — follow-up: "Enter coordinates" jumps from the right edge to the left when a no-pin entry errors

## Calls I made

All recorded as "R145 self-ruled" in each item's `rulings.md`.

- **#536:** " at <cross street>" is an inline span inside the street-name line, so it wraps with the name; no new type-exceptions entry (the span declares no size).
- **#537:**
  1. With no Mapbox token, the bar opens straight into editing and its no-pin line drops "tap the map".
  2. The error is its own state, in the hint's place.
  3. Save is off while the boxes hold numbers that differ from the pin, and the footer says "Press Go to use the coordinates you typed." (Rule 10).
  4. Esc in the bar uses `stopImmediatePropagation`, so the window doesn't close too.
  5. "Lat"/"Long" under 480 px (Question 1).
  6. The bar's Cancel is named "Cancel coordinate entry" for screen readers.
  7. The bar ground is `--da-ground` and the dashed outline is `--ink-faint` (CHOSEN, from the S2 drawing).
  8. In the pin state the hint reads "Tap the numbers to change them", from the S2 drawing.
  9. Behaviour change: typing no longer moves the pin on each keystroke; Go or Enter applies once.
- **#538:** Go with unchanged numbers still centres the map but leaves the pin, the lookup and the road pick alone. Zoom is "16 or closer, never further out", matching search.
- **Orchestrator:**
  - Two of #537's review findings were folded into #538 (R154 fold test: same file, no ruling, small): Go with the pin's own numbers re-ran the lookup and threw away the road pick, and a Save test only proved the rule while Save was shut for another reason.
  - One finding was filed as #540.
  - The CI failure was fixed as #537's gate round 2, in a new commit on the top branch, not by rewriting the pushed chain.

## Flakes

None. One real CI failure on the first push, run 44571788768 on `cb850bf`:
- Test: `components/tap-targets.test.ts > R138 tap targets > every picker control the census found under 44 carries tap-44`, `expected 7 to be 10`.
- The test name was saved before the re-run, and the test also failed when run on its own: `issue-537/ci-failures.md`.
- Cause: #537 removed three `tap-44` controls, and this source-text test wasn't among the "changed files" tests that the item and the verifier ran.

## Items

### #536 — the corner in the row title (`26df927`)

- **Change:** a row with `cross_street` reads "<street> at <cross street>" (600 `--ink` / 400 `--ink-mute`, one line); the second line drops " · at …". Rows without a cross street are unchanged.
- **Tests:** red proof 2 failed | 10 passed; after, 4 files / 71 passed; `tsc` clean. Walk at 1440, 1198x930 and 390: axe 0 in 9 runs.
- **Gates, round 1:**
  - diff-verifier: "VERDICT: PASS" (marker `21f520766c0f`)
  - reviewer: "REVIEW: PASS"
- **Write-up fix after PASS:** `rulings.md` now records the missed churn line. The shorter rows move the hint below about 24 px up at 1440.

### #537 — the coordinates bar (`b621c72`, CI fix `25cc504`)

- **Change:** the "Or enter coordinates manually" link and its 43 px boxes are gone. A 44 px bar under the map has four states: no pin, pin, editing and error. Enter applies, Esc cancels, and a pasted "lat, long" fills both boxes.
- **Size check:** the map and the panel moved 0 px in every state at 1440, 1198x930 and 390. Every control is at least 44 x 44, and axe found 0 violations in 15 runs.
- **Tests:** red proof 12 failed (12); after, 15 files / 161 passed. The verifier re-ran 16 files / 163 passed. `tsc` clean.
- **Gates, round 1:**
  - diff-verifier: "VERDICT: PASS" (marker `2f46ba7b1bfc`)
  - reviewer: "REVIEW: PASS", with findings:
    - "Lat"/"Long" (medium, Question 1);
    - two lows folded into #538;
    - the jumping button, filed as #540;
    - one walk.md wording fix.
- **Gates, round 2 (CI fix, `tap-targets.test.ts` only):**
  - diff-verifier: "VERDICT: PASS" (marker `3510c38f7cc3`)
  - reviewer: "REVIEW: PASS"
  - Tests: 2 files / 23 passed, plus 6 files / 63 passed.
- **Write-up fixes after PASS:**
  - `walk.md` says why `walk.json` reads `railMoves: 1` at 390 (the panel's height grows; its x, y and width don't).
  - The CI-fix commit message and `ci-failures.md` say the 479 px rules change no control's size (padding, gap and the hidden "itude" suffix).
  - The test's own comment ("change padding and gaps only") is left as it is, because editing it would change the marker's code hash.

### #538 — typed coordinates zoom (`cb850bf`)

- **Root cause:** `applyTypedCoords` flew only when the point was off screen. The opening view covers Colorado, so it never moved, and it passed no `targetZoom`.
- **Change:** applying coordinates always flies to the pin at `PIN_ZOOM` (16), never zooming out, through a new `flyToPin` helper. Fold-ins (a) and (b) are as listed under Calls.
- **Walk:** zoom 6 at [-105.5, 39] became zoom 16 at [-104.9811, 39.7401], at all three sizes.
- **Tests:** red proof 3 failed | 14 passed; after, 12 files / 107 passed. The verifier re-ran 13 files / 108 passed. `tsc` clean.
- **Gates, round 1:**
  - diff-verifier: "VERDICT: PASS" (marker `9ed42e2dd85b`)
  - reviewer: "REVIEW: PASS"
  - The reviewer's lows are not changed: the 4-place compare in fold-in (a) is accepted (R145 call), and the rest are info.
- **Write-up fix after PASS:** two line cites in `rulings.md` (`:997-998`, `:1044-1047`).

## Local checks before the push

ruff clean; mypy "Success: no issues found in 49 source files". CI on `25cc504`: Python tests success, Frontend tests success.

## After the ship

Production check on a new evidence branch on top of the shipped main, read-only, at 1440, 1198x930 and 390:
- the road list at Colfax and Pennsylvania (39.7401, -104.9811) and a pin with no cross street;
- the bar's four states, with the map and panel moving 0 px, axe 0, and every control 44 px;
- applying 39.7401, -104.9811 zooms to the pin.

Close #536, #537, #538 and #539 with the evidence. Ryan's browser check: the map window (visible design), including Question 1.
