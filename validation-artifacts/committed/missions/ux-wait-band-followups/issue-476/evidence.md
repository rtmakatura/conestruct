# #476 evidence: the permanent layout-shift check runs on production

Branch `issue-476-cls-prod-wait` on `issue-477-generate-wait-answers` `2c16bcc`. One file changed, `scripts/verify-generate-cls.mjs` (+19 / -2): the road-pick wait, one SKIPPED print, two header lines, and (R154 fold-in, repaired once) a WARN line when Colfax isn't the picked road.

## Red (cited, not re-run; rulings.md R145 self-ruled 4)
`../../ux-group6-wait-and-band/prod-check/cls-permanent-asis.txt`: production `750660c`, the unfixed script. All three widths end in `TimeoutError: locator.click` on a disabled Save & Close, exit 1. The wait it ran (`/PICK THE ROAD|Which road|Save & Close/` on the dialog text) is byte-identical on this branch's base; only its line moved, from 161 to 165.

## Green on production (`cls-prod-fixed.txt`)
Production is main `750660c` (healthz sha `750660c00c2ecb6c1338fea3ee00d3a51523c5cb` at the run). It does **not** carry #469's or #477's changes, so this run shows that the fixed wait reaches Generate on live road data. It doesn't show #477's layout on production. `HOLD_MS=0`, so the outline box check is skipped and now says so.

| width | Generate CLS | outline box check | outlines left |
|---|---|---|---|
| 1440x900 | 0 PASS | SKIPPED (HOLD_MS=0 < 2000) | 0 PASS |
| 1198x930 | 0 PASS | SKIPPED | 0 PASS |
| 390x844 | 0 PASS | SKIPPED | 0 PASS |

Exit 0. Gate token read from the main checkout's `conestruct/site/.env.local` into an env var in the same command, never printed; a search of the log for the token found 0 matches. `scripts/gate.cjs` adds the header only to requests whose host and scheme are `www.conestruct.com`'s (`isSiteRequest`), following redirects hop by hop. Nothing against production beyond the documented page loads and one Generate per width.

## Green locally, with #477's code (`cls-local-fixed.txt`)
`next dev` on this worktree (:3476) against `scripts/verify-generate-cls-stub.py` (:8476), Overpass replayed (`overpass-asks-local.log`: 8 asks, all `replay`), launched by `script/launch.cjs` and run by `script/run-verify.cjs` (copied forward from #477's; walk-only random gate and render secrets in the scratchpad, never printed). Default 4 s hold, default (full) scan.

| width | Generate CLS | outline box check | outlines left |
|---|---|---|---|
| 1440x900 | 0 PASS | PASS (NEEDS YOU +91 px reported, not failed) | 0 PASS |
| 1198x930 | 0 PASS | PASS (NEEDS YOU +91 px) | 0 PASS |
| 390x844 | 0 PASS | PASS (NEEDS YOU +53 px) | 0 PASS |

Exit 0. No `SKIPPED` line at a 4 s hold, as predicted.

## Rule 5: predicted vs actual
Predicted: one file, about 10 lines (wait line, comment, one `else` print, header's production line); everything measured byte-identical; local output unchanged; one new SKIPPED line per width at `HOLD_MS < 2000`. Actual: one file, +12 / -1 before the fold-in, +19 / -2 after the fold-in and its repair (the amended predictions in checkpoint.md: about 3, then about 4, more lines). The wait is split over 5 lines for reading, plus a 3-line comment. Measured logic, timeouts and walk steps untouched. Local output keeps the same line set as #477's run; production output gains the SKIPPED line. As predicted.

## Fold-in: WARN when Colfax isn't the picked road (R154, after both gates; repair 1)
After the pick, the script reads the dialog's road-picked row (`[role=dialog] [data-testid=road-picked] .road-picked-name`, `LocationPickerModal.tsx:2173`, `:2190`). A list pick shows that row (`:2150`), and so does a sole road, which the dialog adopts on its own (`:2069-2075`). If the name doesn't match /Colfax/, the width prints one of these (Rule 10) and walks on as before:
- `<w>x<h> WARN road pick: no Colfax option found; walking with "<name>" picked` (or `no road picked`);
- `<w>x<h> WARN road pick: Colfax option found but its click failed; walking with ...`.

The first fold-in tested only for a Colfax button. The local stub returns one road, which the dialog adopts and shows as the road-picked row with no Colfax button, so the first version printed a false WARN on every local run. Its `cls-local-fixed.txt` was run before the fold-in, so it doesn't show the WARN. Repair 1 decides from the road-picked row instead.

**Run after the repair (`cls-local-foldin.txt`):** the local stub, one road (default `STUB_ROAD=1`), 4 s hold. No WARN at any width. CLS 0 PASS, outline box check PASS, outlines left 0 PASS at 1440x900, 1198x930 and 390x844; exit 0. Every measured line equals `cls-local-fixed.txt`.

**The WARN-positive case** is reasoned from the code, not run. The script can't be made to show a non-Colfax road without editing the stub or the script: its road stub always answers with the Colfax fixture, and the replayed Overpass at 1600 E Colfax includes East Colfax Ave. The as-is production red (`cls-permanent-asis.txt`) is a real case of it: no Colfax option existed yet ("count 0") and nothing was picked. The repaired script would print `no Colfax option found; walking with no road picked` there. (That run then timed out on the disabled Save & Close; the fixed wait prevents that.)

**Not run on production's path:** the repaired road check has not been run on the several-road path production takes, because `cls-prod-fixed.txt` was run before the fold-in. Only code reasoning supports it there. A list pick collapses the card to the road-picked row (`LocationPickerModal.tsx:2104-2105`, `:2148-2150`), and the check reads that same row.

**The `STUB_ROAD=0` run:** I tried a one-width local run with `STUB_ROAD=0`, to go through the multi-road list. I deleted its log, so it can't be re-checked. It printed no WARN, which means the road-picked row named Colfax, so the pick likely worked and the plan was declined later, at render (DECLINED, SERVICE UNAVAILABLE). The cause is not known; the likely one is the stub backend on road data that isn't in the fixture. It's a follow-up, not covered here.

## Tests
No vitest or pytest covers the script, and no backend or site file changed, so no suite was run (mission brief). `node --check scripts/verify-generate-cls.mjs` OK.

## Lane
`python scripts/cosmetic_lane_check.py`: `OUT OF LANE: 1 of 122 paths fall outside` (`scripts/verify-generate-cls.mjs`, a script).
