# L1 — light-lane copy round (mission site-walkthrough-audit, #396)

Branch `mission-swa-l1-copy` off `issue-396-walkthrough` (`a8b831b`). Copy only: no wire field, API route, middleware, gate, or scenario/audit/pricing logic.

## Baseline (before the diff)

`cd conestruct/site && npx vitest run --reporter=dot`: first, cold run 1 file / 9 tests failed (names not captured; the run was not saved before the re-run, a slip against the session-budget rule); two re-runs: `Test Files 239 passed | 1 skipped (240)`, `Tests 2548 passed | 1 skipped (2549)`. No Python touched, so pytest isn't run.

## Plan

1. **W6** `components/bands/WhatBand.tsx:393`: "the option you picked stands" → "the option shown stands". It names the value on screen, not who chose it, so it's true for a picked jurisdiction and one filled from the pin. No logic change.
2. **W7** `lib/scenarios/rail.ts:139` `REFUSAL_BLOCKER`: "Generation declined. See the notice below." → "Generation declined. The PLAN DECLINED notice says why." The Generate band sits at the bottom of the column and the notice is the verdict strip at the top (`StatusBar.tsx:313`, "PLAN DECLINED · …"), at 1440 and 390 alike; naming the notice is true wherever either shows.
3. **W20** `lib/scenarios/rail.ts:142-143` `LOCATION_BLOCKER`: "Set a location first: pick it on the map or enter it manually." → "Set a location first: use Pick on map to find the site." The band's controls are the address field and "Pick on map" (`WhereBand.tsx:598-626`); its "Enter manually" toggle renders only without a Mapbox token (`WhereBand.tsx:856`). The picker has search, the pin and coordinate entry in both cases. The string lives in `rail.ts`, not in `WhereBand.tsx:598-608` (the finding's source column cites the producer row it describes).
4. **Ryan's note** (`SIGNUP_LABELS`, `OutputCards.tsx:119-125`): no change. See R145-4.
5. Tests: update the string assertions listed below first (red on the base), then the source; full vitest run; before/after screenshots.

## Rule 5 churn prediction (written before the diff)

Source, 3 changed lines in 2 files:
- `components/bands/WhatBand.tsx`: 1 line (393).
- `lib/scenarios/rail.ts`: 2 lines (139, 143).

Tests, string updates only, no new tests:
- `components/WhatBand.declutter.test.tsx:287` (1 line).
- `lib/scenarios/provenance-marker.test.ts:50` (1 line; fixture string, passes either way, kept in step with the copy).
- `lib/scenarios/rail.test.ts:72, 77, 383` (3 lines).
- `components/GeneratorShell.input-gating.test.tsx:172` (1).
- `components/GeneratorShell.rail-single-source.test.tsx:88, 110, 112` (3).
- `components/GeneratorShell.refusal-voice.test.tsx:172` (1).
- `components/GeneratorShell.live-speakers.test.tsx:52` (1).
- `components/GeneratorShell.no-location.test.tsx:177` (1).

Expected: 7 test files, ~12 lines; test count unchanged (2548 passed, 1 skipped). Behavior change: none; three visible strings change (stated here, Rule 5).

## Calls (R145 self-ruled)

- **R145-1 (W6 wording).** "the option shown stands" over "the jurisdiction above stands": the line sits under the select at both widths, so "above" would be another direction claim (the W7 failure). R145 self-ruled.
- **R145-2 (W6 red).** The red stays. `is-error` is the "check didn't answer" state ruled under R108/P3 (`WhatBand.tsx:386-389`): the line stays on show, and its text ("not evaluated: …") is the second channel Rule 13 asks for. What's wrong is that a plan decline (a 400 on the breakdown) lands in the same state as a failed check, because `jurisdictionErrored` is `deviceBreakdown.state === "error"` (`GeneratorShell.tsx:1874`). Telling the two apart is state logic, outside the light lane, so it is filed (see Filed). R145 self-ruled.
- **R145-3 (W20 control name).** Name "Pick on map", the band's button label before a pin (the blocker only shows before one). R145 self-ruled.
- **R145-4 (Ryan's note, no change).** The premise doesn't hold in the code. With `mode.kind === "saved" && !mode.planId` the card renders ONE `<Link>` (`OutputCards.tsx:509-514`, `labelFor(card.kind)`), not the shared two-button row, so the crew card shows a single "Sign up to download PDF" link at full card width (`:only-child`, no 4 px trim, `globals.css:3614-3627`); the existing test pins four links, one per card (`OutputCards.test.tsx:280-294`). That state is also only reachable signed in: saved mode is `mode="workbench"` (`GeneratorShell.tsx:2218-2220`), served from `/app/plans/new` and `/app/plans/[id]`, which need a session (`middleware.ts`) and redirect to `/` while `NEXT_PUBLIC_AUTH_UI` is off (#195). So no signed-out user sees it, and a signed-in one would be told to "Sign up". That label is #204's flag-flip work (the affordance #195 parked there), not a label-table choice; noted on #204 instead of changing it here. R145 self-ruled.

## Filed

- #406, "After a plan decline, the Jurisdiction row reads as a failed check, in red" (R145-2): https://github.com/rtmakatura/conestruct/issues/406
- Comment on #204 adding the workbench's "Sign up to download" labels to the flip checklist (R145-4): https://github.com/rtmakatura/conestruct/issues/204#issuecomment-6401931642

## Actual churn vs prediction

- Source: 3 lines in 2 files, as predicted (`WhatBand.tsx:393`, `rail.ts:139, 143`).
- Tests: 12 lines in 8 files. The lines and files match the list above; the "7 test files" total in the prediction was a miscount of its own 8-item list.
- `git diff --stat`: 10 files, 15 insertions, 15 deletions (3 source + 12 test lines).
- Test count unchanged: `Test Files 239 passed | 1 skipped (240)`, `Tests 2548 passed | 1 skipped (2549)`.

## Red proof

The 12 updated assertions against the unchanged source: `red-proof.txt`, 9 failed / 89 passed in the 8 files (7 failing files; `provenance-marker.test.ts` passes either way, as predicted).

## Contrast (Rule 13, measured)

The W6 line's red: `rgb(255, 122, 122)` on `rgb(16, 28, 41)` (computed styles, Chromium, 1440 and 390) = 6.8:1, above AA 4.5:1. Text second channel: the line's words.

## Screenshots

Local `next dev` of this worktree, Chromium, 1440×900 and 390×844 (DPR 2). `before/` is the base `a8b831b`, `after/` this diff; same flow.

- `{before,after}/{1440,390}-w6-jurisdiction-after-decline.png`: The job column after the one-way decline.
- `{before,after}/{1440,390}-w7-generate-reason-viewport.png`: the Generate band's reason in the viewport.
- `{before,after}/{1440,390}-w7-declined-fullpage.png`: whole page; the PLAN DECLINED strip at y 78 (1440) / 68 (390), the reason at y 1405 / 2444, both `position: static`.
- `{before,after}/{1440,390}-w20-no-location-fullpage.png`: fresh `/sandbox`, the Generate band's "Set a location first: …".
- Ryan's note: none. The state is signed-in only and has no shared row (R145-4).

How the decline was reached: Overpass was timing out on 2026-10-25 (production `/api/road-bearing` also returned `scan_status: "unavailable"`), so the browser's `/api/road-bearing` call was stubbed with one candidate for `200 E 14th Ave, Denver` (`highway=secondary`, `oneway=yes`, `maxspeed=30 mph`, bearing 270). Everything after that is live: geocode, the jurisdiction from the pin (Denver), and the backend's one-way flagger 400. Locally the gate ran with a throwaway token in an untracked `.env.development.local`, because Next's env expansion mangles the real token's `$` (deleted afterwards, with the copied `.env.local`).
