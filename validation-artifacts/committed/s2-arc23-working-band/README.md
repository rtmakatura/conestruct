# s2-arc23 — #252 the global working band

Branch `issue-252-working-band` off `main 00ecbf0`. Rulings: `GO-rulings-2026-09-07.md`
(Ryan's GO message, verbatim; it supersedes the issue body's "Known conflicts" where
they differ). Frontend-only: backend, wire, pin fixtures, snapshots, payload senders 0
at every commit.

## The defect

While a plan generates, re-generates after a correction, or a file renders (5–30 s),
"the system is busy" was scattered: the strip's COMPUTING / VERIFYING line at the
bottom of setup, the results-head wait line (#247), the greyed correction block
(#249 spec 34), per-button "Rendering…" words, the "Generating…" placeholder, the
ribbon's "⟳ Recomputing". The investigate run (`investigate/a23-out/log.txt`, prod
`00ecbf0`) measured the premise: during a correction re-generation from the block at
380, every one of those signals was OUT of the viewport for the whole 5 s flight.

## What shipped

| commit | what |
|---|---|
| `4802ffc` | **the band** — `components/WorkingBand.tsx` rendered verbatim from `lib/working-band.ts`; mounted iff `generated && (breakdown loading ‖ stamped audit loading)`; the strip's COMPUTING removed and VERIFYING nulled post-generate; wait line, placeholder, ribbon verb retired; one live region; tokens; band above the frame |
| `f8db7f9` | the GO rulings recorded (the verifier's QUESTION: the stage-line omission was ruled in chat, not in the issue) |
| `656b431` | **the write lock** — `WriteLockContext` / `useWriteLock()`; every write control `data-write` + `disabled`, every read `data-read`; one dim rule; the fail-by-name enumeration test |
| `b7198f4` | **RENDERING** — `RenderRequestContext.begin(label)/end()` around the zip, per-file renders, audit PDF, quote preview / XLSX; the per-button busy words retired |
| `69494d7` | **fix** — the band's 150 px room is a spacer sibling after the footer, not root padding (a scroll-anchoring suppression trigger; found by the local run) |

The band: `◌` (`--none`) · verb (`--act-bright`) · object (`--ink`, the user-named
part in sans) · `⚠ CONTROLS LOCKED` (`--warn`), on `--ws-surface` with an `--act`
border-top and the 2 px sweep track. No stage line, no CANCEL, no timer, no failure
state. The sentence is a diff of two wire objects (`lastSettledFor` vs the wire):

| state | object |
|---|---|
| GENERATING | `new plan · {meta.address}` or `new plan · pin {lat}, {lng}` (four decimals; never a placeholder) |
| RE-GENERATING | `after a correction to {condition}` · `after undoing the correction to {condition}` · `without the site check` · `after an edit to {speed \| lane width \| work zone length \| jurisdiction \| street class \| work date \| end date \| start time \| end time}` · `retrying the site scan` (the same object again) · `the plan` (an unnamed difference) |
| RENDERING | `plan sheet PDF` · `device list XLSX` · `crew instructions MD` · `crew instructions PDF` · `MHT package ZIP` · `audit PDF` · `quote preview` · `quote XLSX` |

## Declarations (rule 5)

- **Retired working voices:** the strip's COMPUTING (gone) and VERIFYING post-generate
  (renders nothing; pre-generate unchanged); the #247 wait line; "Generating…";
  the ribbon now reads "Previous answer — values below predate the request in flight."
  (the text channel of the results-stale dim, rule 13); "Rendering…" / "Bundling…" /
  "Calculating…" on the render buttons.
- **Spec A deviations, ruled:** stage line omitted (spec 15/16 — no stage events; the
  verb says it); CANCEL dropped (spec 28/38); ◌ in `--none` not `--act` (spec 19: one
  glyph, one meaning, one colour); the verb in `--act-bright` (`#a9dcf8` rejected in
  #249); band z-index 70 above the frame (spec 2 said 50: the frame's corner ticks drew
  over a z-50 band — `investigate/a23-out/1440-mockband-landing.png`); the 150 px room
  below the footer, as a spacer sibling (spec 4 said content-area padding: with it on
  `main` the footer sat under the band, with it on the root it suppressed scroll
  anchoring); RENDERING added to spec 14's three verbs; VERIFYING dropped (no wire
  referent: every post-generate request is the pair).
- **#247's acceptance restated:** "band rect within the viewport, bottom at
  `innerHeight`, top below the nav" — true by construction, measured anyway (B2).
- **Spec 31:** the refusal container renders once the pair has settled, never in a
  frame the band is up; the strip's PLAN DECLINED is unchanged and unmasked (#192).
- **Two consequences of the lock, built:** the strip's openers lock as
  `aria-disabled` (focusable, so an editor that commits under the lock can hand focus
  back to its opener); the work-zone editor commits on blur / Enter through a draft
  (per keystroke, the first digit would have disabled the field under the cursor).
- **`lastSettledFor`,** not the ruling's `lastReadyFor`: after a refused scan, Retry
  and proceed-anyway must diff against the refused scenario.
- **The landing under ruling f:** the verdict strip re-mounts at settle; when Chrome's
  scroll anchor node sits in the setup strip above it, that one mount is uncompensated
  and the results zone lands `98 + strip height + 24` (174 / 173 on the recorded runs)
  instead of 98 — in view, and inside #250's existing spread (prod pre-band measured
  82–103). A reserved-height slot (checkpoint option f2) would remove it; one rule.

## Tokens and pairs (measured, `outS2A23Local/pairs-assert-*.json`, `investigate/a23-pairs.txt`)

Added: `--ws-surface-rgb: 15 26 38` / `--ws-surface` (shared with #253 at `/ .97`),
`--z-strip 30` (the rail), `--z-nav 40` (AppNav off its Tailwind literal), `--z-frame
60`, `--z-band 70`. Reused: `--act`, `--act-bright`, `--ink`, `--ink-on-dark-faint`,
`--none`, `--warn`, `--rule`, `--act-glow` (the reduced-motion static track). Rejected:
`#a9dcf8`, `#5cbef0`, the shadow stays a literal in its one rule.

| pair on `#0f1a26` | ratio |
|---|---|
| glyph ◌ `--none #93a0b0` | 6.60 |
| verb `--act-bright #56bcf2` | 8.25 |
| object / named `--ink #eaf0f7` | 15.30 |
| lock notice `--warn #f4c020` | 10.37 |
| border-top `--act #34a9e8` (non-text) | 6.68 |
| surface vs `--canvas` (chrome reads from border + shadow) | 1.07 |
| locked writes at opacity .45 — inactive, WCAG 1.4.3 exempt; `disabled` / `aria-disabled` the second channel | 2.1–4.0 |

Spec 39's "4.6:1" for the stage line's `#93a0b0` was wrong for this surface: 6.60.

## Local run — ALL PASS 44/44 (+2 info) (`outS2A23Local/`)

Stack: the arc-20 stand-in (`../s2-arc20-scanned-block/local-stack/`: Overpass mock on
8766 held `A20_DELAY_S=8`, stubbed uvicorn on 8765 from the working tree, `next dev`
with `MODAL_RENDER_URL=http://127.0.0.1:8765`), Lakewood pin 39.7113 / −105.0815. The
harness holds the plan-sheet PDF response 3 s on the wire so B10 is observable (the
memoised local render answers inside one sample); a network delay, never a product
timer. Two earlier runs (not kept) found the root-padding suppression (results zone
411 px low → commit `69494d7`) and three harness defects (settle detection before the
band was seen; sampling after the download; the 1 px rounding on the shifted landing).
An 8 s × 3 request stand-in scan exceeds the 20 s budget on a cold memo: run 2 opened
with a local refusal, which exercised B3 across the refusal's arrival (0 co-frames)
and the Retry object ("retrying the site scan") before the memo warmed.

| leg | 1440×1000 | 380×800 |
|---|---|---|
| B1 band iff open (generate / assert / render) | 121 / 69 / 188 samples with the band, 0 gaps, lock ≡ band | 121 / 69 / 111 |
| B2 band within the viewport | 959..1000, 41 px, one line | 720..800 (80 px, GENERATING) · 701..800 (99 px, RE-GENERATING) · 738..800 (62 px, RENDERING) |
| B3 no band + refusal frame; no retired voice | 0 / 0 | 0 / 0 |
| verbs | GENERATING · new plan · pin 39.7113, -105.0815 · RE-GENERATING · after a correction to Adjacent interchange (highway ramps) · RENDERING · plan sheet PDF | same |
| B4 lock | 30 writes off at opacity .45, 9 reads on, 3/3 nav + footer links live, scroll moves, price-head toggles; 0 still off at settle | same |
| B5 footer at max scroll | bottom 850 vs band top 959 | 650 vs 701 |
| B6 landing | 174 (= 98 + strip + 24, see declarations) | 173 |
| B7 axe with the band up | 0 (baseline 0) | 2, the two named (`scrollable-region-focusable .gap-8`, `target-size .strip-edit-all`) |
| B8 pairs | 6.6 / 8.25 / 15.3 / 15.3 / 10.37 | same |
| B9 reduced motion | sweep → none, track `rgba(52,169,232,.32)` | same |
| B11 block under the lock | aria-busy, 5/5 off; at settle 1 record row, 0 off | same |
| A1 aria | 1 region of 3 carries the flight; row `role=status` polite; strip empty | same |

## Prod run

Pending the ship: `node s2a23-lc-prod.js outS2A23Prod <sha>` (sha-gated against
healthz), Denver 39.7269 / −104.9873. Recorded here when it lands.

## Rule 5 churn (predicted → actual)

| surface | predicted | actual |
|---|---|---|
| `StatusBar.test` | 2 rewritten | 2 rewritten + 1 (`bandVoice`) |
| `StatusBar.scan-copy.test` | deleted (4) | deleted (4) |
| regenerate-mounted · scan-wire · results-head · a11y-announce | 3 + 3 + 3 + 1 | 3 + 3 + 3 + 1, then (commit 2) the harnesses that edited mid-flight settle the pair first: a11y-focus 4, zone-staging 4, saved-dirty 2, bundle-settings 3, post-generate-scroll 3, AuditTrail.declined-stale 3, a11y-announce 5, regenerate-mounted 3 |
| `WorkingBand.test` (new) | +8 | +8 |
| write-lock honesty tests | +2 | +3 |
| tokens / CSS-rule test | +2 | +2 |
| RENDERING tests | +3 | +3 (+1 unit) |
| `OutputCards.test` | 0 | 1 rewritten ("Bundling…") |
| vitest | 946 → ~962 | 946 → **968** (132 files; `test-accounting.txt`) |
| pytest · snapshots · wire · pin fixtures · backend | 0 | 0 |
| axe 1440 / 380 | 0 → 0 · 2 → 2 named | 0 · 2 named |

## Findings for follow-up (recorded, not filed)

- The landing shift under ruling f (above): option f2 is one CSS rule.
- The stand-in's memo makes a cold local scan refuse at `A20_DELAY_S=8` (3 requests ×
  8 s > 20 s); a warm memo answers in one sample. `A20_DELAY_S=6` would keep both
  legs observable without a refusal.

## Contracts

- Rule 10 — band iff open, read off the requests (`WorkingBand.test`: held 2.5 s past the
  shell's only threshold; no clock in either module; B1 0 gaps); no band + refusal
  frame (unit + B3); every object a true statement of the two wire objects
  (`lib/working-band.test`, 9 cases).
- Rule 3 — lookups, comparisons, `toFixed(4)`; no arithmetic.
- Rule 13 — glyph + word every state; pairs measured on the band surface (B8).
- Rule 5 — every retired signal declared; #247 restated.
- #198 — `.sys-event` strings untouched (the ribbon is `.stale-ribbon`); verifier-confirmed at each commit.
- #228 — rail untouched; the band is chrome.
- Suggest-never-set — the lock writes nothing (WriteLock.test: locked clicks open no request); the work-zone draft writes only a changed value.
- Citation counter 19, unchanged.
- `getByText` direct text nodes — every assertion.
- Backend / wire 0 — `lastSettledFor` and `openRenders` are client state.

## Files

- `s2a23-lc-prod.js` — the live check (legs B1–B11, A1 in the header).
- `outS2A23Local/` — log, samples per leg, axe, pairs, screenshots.
- `investigate/` — the checkpoint's prod measurement (`a23-measure.js`, `a23-out/`), the pair figures.
- `red-run-c1-band.txt` (15 failed | 60), `red-run-c2-lock.txt` (4 | 4), `red-run-c3-rendering.txt` (12 | 10), `red-run-c4-spacer.txt` (2 | 9); `vitest-c1..c4.txt`; `test-accounting.txt`.
- `GO-rulings-2026-09-07.md` — the rulings, verbatim.
