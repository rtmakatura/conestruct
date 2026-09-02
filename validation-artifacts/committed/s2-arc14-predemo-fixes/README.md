# s2-arc14 — pre-demo quartet: #230 #231 #232 #233

Branch `issue-230-233-predemo` on top of `796f3fb` (prod at branch time: healthz == origin/main == `796f3fb`).
Four independent frontend fixes, one branch, ship together, close separately. Backend untouched; no wire change.
Ryan's rulings (2026-09-02 checkpoint): all four as recommended — see each commit message.

## Commits
1. `3cd2548` test: red tests — `LocationPickerModal.manual-entry.test.tsx` (keystroke + paste, 5 red / 1 control green)
   and `shell-chrome.test.tsx` (style contracts, 9 red). `red-run-frontend.txt`: 14 failed, 1 passed.
2. `983b997` fix #230 — keystroke path never rewrites a focused box; normaliser (U+2212/U+2013, whitespace incl. NBSP);
   paste of a pair replaces both boxes from the paste event. Amended once before push: the normaliser's `\s` had
   been lost passing through a shell quote (it stripped the letter "s"); fixed, and the whitespace/NBSP paste case
   added to the suite in the same commit.
3. `81c9356` fix #231 — `--nav-h`/`--rail-h` tokens; nav height by token; `scroll-margin-top` on `.zone` + the
   FieldGroup anchor headers (`.jump-anchor`).
4. `733f801` fix #232 — rail sticks at `var(--nav-h)`; frame `border-bottom: none` (left/right rules + 4 ticks stay).
5. `64fe582` fix #233 — rail gap 16→10, padding 24→16; owning entry `flex: 1 1 0; min-width: 0`; blocker nowrap +
   ellipsis + `title`, itself shrinkable. Amended twice before push: the first local live check showed the
   near-intersection rail still wrapping — the blocker span kept its content min-width, and a wrapping flex row
   breaks lines on content size before any shrinking, so the entry needed a zero basis, not `auto`.
6. this folder.

## Root causes (measured, not assumed)
- **#230** — no breaking commit. The manual boxes apply the pin on every valid *prefix* of the second coordinate
  and `applyPinPosition` rewrote both boxes with `fmt4` (original picker `9f8ba85`, 2026-05-11). Typing
  `-105.0815` after a valid lat became `-1.0000` at the second key. Reproduced in `before-prod-796f3fb/
  LocationPickerModal.issue230-repro.test.tsx` (the investigation repro; the committed suite is its assertion form):
  box ends `-1.0002`, 8 detect calls. Never keystroke-tested (all 5 picker suites `fireEvent.change` a whole value).
  The sidebar's "Enter/Edit manually" is a different component (`ManualFallback`, number inputs, no rewrite) —
  why the 09-01 repro worked. ASCII paste into an empty box always worked; U+2212 pair did nothing, silently.
- **#231** — both scroll sites were already smooth + reduced-motion guarded; the offset was the missing
  `scroll-margin-top` under a 52px sticky nav + 38px sticky rail. Prod measurements (`before-prod-796f3fb/measure*.log`):
  rail jump → anchor top 0; Generate → results heading top 5. The *jarring* is two instant jumps from the DOM swap
  (sidebar unmount clamps scrollY 2512→172 at t=58 ms; results mount triggers scroll anchoring 172→998 at t=982 ms),
  then the smooth ease. Out of scope per ruling 1; follow-up issue: **(Ryan to post — number to be filled in here)**.
- **#232** — `.workbench-frame` is `position: fixed; inset: 8px; z-index: 60`, above all content. Bottom rule struck
  "LOCATION · STEP 2" at a 37px scroll (`before-prod-796f3fb/z-bottomrule-strike.png`); the rail at `top: 0` painted
  over the nav band boxed between the frame's top rule and its own border (`before-prod-796f3fb/gen-after.png`).
- **#233** — the rail is a fixed 1098px wrapping row (main's max-width, not the viewport). Pre-pin, Location owns the
  428px verbatim blocker; six entries need 1087px (flagger) / 1124px (NI) against 1050px usable → the last entries
  tumble to row 2 at every viewport. The #228 sentinel pins the blocker span inside its button, so it cannot be a
  sibling flex item; CSS elision is the only string-preserving fix.

## Green
- `green-run-frontend-full.txt` — full site suite after commit 5: 115 files, 863 tests (847 + 16 new). Sentinel,
  rail, picker state-contract, #189/#193/#198/#226/#227 suites unmodified.
- Rule 5 predicted-vs-actual: predicted four visible changes (headings land under the nav; three-sided frame + rail
  under nav; one-line rail with elided long blockers; typing works). Actual: the same four. One unpredicted
  *implementation* detail, not a visible change: the zero flex-basis (above). Test churn: zero existing tests.

## Live check
`s2a14-lc-prod.js` — s2-arc12 prologue (timestamp, BASE, healthz verbatim, `git rev-parse origin/main`, gate). In
prod mode the gate aborts on mismatch; in local mode (`BASE=http://…`) it records HEAD and states the served build
is the working tree. Assertions: A #230 typed by real keystrokes (box values, last detect POST = the pair, no error,
U+2212 pair pasted over prior text splits, Save enabled) · B #231 every rail entry's jump lands its anchor below
nav + rail with focus on the anchor, at 4 viewports; Generate landing below the nav; #193 focus on the results
zone · C #232 scroll-walk probe: no glyph box under any frame edge (Range rects, not element boxes), frame has no
bottom rule, stuck rail at/below the nav's bottom edge · D #233 rail one row × 3 kinds pre-pin (4 viewports) and
post-location.

- `outS2A14Local/` — run against `next dev` on the working tree at `64fe582`, 2026-09-02: **ALL PASS 56/56**
  (`s2a14-lc.md`, 28 captures: rail per kind, frame bands, jump landings, Generate landing).
- `before-prod-796f3fb/` — the investigation's read-only prod measurements at `796f3fb` (scripts, logs, and the
  captures the checkpoint cited). The same assertions fail there: rail 2 rows for flagger/NI, anchor top 0, results
  heading top 5, text under the bottom rule, typed lng `-1.0002`.
- Prod run post-ship: `outS2A14Prod/` — **not yet run** (this line is replaced by the definitive run's summary).

## Not run
- `next build` — same handle-locked SWC binary as s2-arc13 (recorded in handoff.md). All changes are CSS, one
  attribute, and handler logic that `tsc`/ESLint (pre-commit) and the dev server compiled.
- Ryan's original verification-doc screenshots are not in the repo; the captures here match the angles the issues
  describe (rail head, bottom rule over the panel, Generate landing, rail per kind).

## Follow-up candidates (no issue yet)
- #230 commit-on-blur/Enter for the manual boxes (the pin still follows valid prefixes: 10 detect POSTs for one
  typed pair in the live check) — ruling 4 kept this out of scope.
