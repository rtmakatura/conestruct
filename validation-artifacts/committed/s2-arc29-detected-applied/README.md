# s2-arc29 — the detected-vs-applied block: #273 layout · #274 inferred vs measured · #275 stale lanes cell

GO ruled 2026-09-11 against the 📋 checkpoint of the same day. All six
checkpoint recommendations adopted plus two additions. Frontend-only, all
three issues: no wire field, no backend change, no snapshot or pin
re-baseline. Branch `issue-273-detected-applied` off `main` at `a0abc4d`
(`/healthz` sha `a0abc4d88fd77f3a2e4e7e1d450a9cf21ff78a25`, confirmed at the
start of the run and printed as the first line of every `out-*/log.txt`).

## The leg the audit could not take

`s2-audit-1/findings.md:196` files #235 Surface A under **"Could not
measure"**:

> **#235 Surface A (the detected/applied table):** pre-generate, inside the
> picker flow with a detected road; the manual-pin flow used here never
> mounts it. A follow-up leg through the picker with a real road detection
> is needed.

The reason is visible in that harness: `audit-walk.js:114-131` opens the
picker, measures the dialog, **cancels** it, and then pins through the
manual latitude/longitude fields (`audit-walk.js:56-61`, called at `:137`).
The block mounts only behind a confirmed road (`DetectedVsApplied.tsx:42-49`),
so it never rendered in that walk.

`s2a29-lc.js` and `s2a29-ink.js` drive the picker to a real detection on the
fixture the audit itself names — E Bayaud `39.71466, -104.94071`, way
`39508704`, detected 85°. Detection returned five candidates; the fixture way
was picked on both viewports; `Save & Close` enabled; the block mounted; zero
page errors.

```
node s2a29-lc.js  <outDir> <expectSha> [base]   # the walk + the #275 leg
node s2a29-ink.js <outDir> <expectSha> [base]   # ink rects + divergent tracks
```

## Three premise corrections, recorded because they change the acceptance

These are corrections to the issues as filed (and to the read-only sweep the
issues were written from). They are recorded here rather than quietly fixed.

### 1. The misregistration is in the ink, not the boxes

#273 says "a header and the values under it never share an edge". Measured
on unmodified `a0abc4d`, **the boxes do share an edge** — a grid item
stretches to its track, so the header span's right edge equals the value
span's right edge, delta **0.0 px on every row, both columns, both
viewports** (`outLocal-a0abc4d/log.txt`, rows `D1 header-right ==
value-right`).

What misregisters is the **text inside the box**: the header's ink is laid
out at the start of its track while the value's ink is laid out at its end.

| 1440×1000 | header ink right | value ink right | gap |
|---|---|---|---|
| DETECTED | 504.8 | 557.8 | **53.0 px** |
| APPLIED | 623.6 | 684.0 | **60.4 px** |

| 380×800 | header ink right | value ink right | gap |
|---|---|---|---|
| DETECTED | 183.6 | 215.2 | **31.6 px** |
| APPLIED | 281.0 | 320.0 | **39.0 px** |

The gap is constant per row, so this is a header-vs-column offset, not
raggedness.

**Consequence for the acceptance criterion.** #273 as filed asks for "header
`right` equals its column's value `right` (±1)". Measured against element
rects that **passes on unmodified main**, so the original criterion would
have certified the bug as fixed without a line changing. GO restated it
against ink (`Range.getBoundingClientRect`) on a divergent-value fixture;
that is the criterion used here.

### 2. The two value tracks coincide only on an identical-value fixture

The audit's fixture prints the same string in both columns on every row, so
the two `auto` tracks happen to match and the column-width defect cannot
appear. `s2a29-ink.js` re-measures with the applied road type set explicitly
to `freeway` so the columns diverge:

| | label / detected / applied |
|---|---|
| 1440, identical values | 225.6 / 112.2 / **112.2** |
| 1440, divergent values | 205.8 / 112.2 / **132.0** |
| 380, identical values | 50.4 / 90.8 / **90.8** |
| 380, divergent values | 50.4 / 87.5 / **94.1** |

So #273's second clause is true, but only when the values differ — which is
the block's entire reason to exist.

### 3. A value edit reflows the label column (not on any issue)

Falling out of the same measurement: widening the applied value takes width
from the `1fr` label track, so the label column shrinks **225.6 → 205.8 px at
1440** and every row label moves 19.8 px when a value changes. Content
dictating layout (P6) and movement with no user action on that element (P1).
This is why GO ruled the value tracks fixed to the **widest value in the
domain** rather than sized to current content.

### 4. #275's mechanism: the block never reads the relay

#275 is filed as "the relays are cleared but the cell keeps reporting". The
cell does keep reporting, but **not from the relay**. `DetectedVsApplied.tsx`
reads `cls.lanesPerDirection`; the gates read `detectedLanesTotal`. They are
different numbers by different arithmetic (`classify.ts:78-90`):
`detectedLanesTotal` is the raw `lanes` tag, while `lanesPerDirection`
prefers `lanes:forward` and otherwise halves and floors. On a `lanes=4`
two-way road the relay is 4 and the block shows 2.

"The relays were cleared" and "the block still shows an OSM count" are
therefore **two independent facts about two independent values**, and no
clear path touches `meta.confirmedRoad.classification`.

## Before-table — `a0abc4d`, 1440×1000, `.dva` 500 × 204.4 at 195,1100.2

Tracks `225.594px 112.203px 112.203px` · column-gap 14 · row-gap 3 ·
`align-items: baseline` · labels share one left edge (206).

| row | detected | applied | detected box | applied box |
|---|---|---|---|---|
| Bearing | 85° | 85° | 445.6–557.8 | 571.8–684 |
| Lanes per direction | 2 | 2 | 445.6–557.8 | 571.8–684 |
| Road type | Rural — undivided | Rural — undivided | 445.6–557.8 | 571.8–684 |
| Divided | Undivided | Undivided | 445.6–557.8 | 571.8–684 |

380×800: `.dva` 282 × 293.1, tracks `50.4062px 90.7969px 90.7969px`, labels
at 60.

**Speed limit does not render on this fixture.** E Bayaud carries no
`maxspeed` tag, so `cls.speedLimitMph` is undefined and the row is correctly
absent — Rule 10 honoured (absence renders as absence). The fixture exercises
four of the five possible rows; the speed row is covered by unit tests, not by
this leg, and that is stated rather than papered over.

**Type census before:** 5 distinct (size/weight/family/colour) tuples;
**8 of 13 text nodes carry no `tr-*` role** — every value span is ad-hoc
Tailwind. The block already carried a *declared* debt row for this at
`lib/design/type-exceptions.ts:320` under owner "later round — sandbox
components". This arc is that later round; commit 3 deletes the row.

**#214 contract before:** the disclosure sentence rendered byte-identical at
both viewports —
`road geometry governs the drawing — the typed bearing sets the travel-direction sign only`.

**#275 before:** applied 2 → 3 by a lanes chip; the Detected cell stayed `2`,
unmarked, at both viewports (`outLocal-a0abc4d/log.txt`, rows `L before` /
`L after`).

## Why only two rows carry the inferred marker (#274)

Ruled (d): mark `Road type` and `Divided` only. This is not a scoping
shortcut — it is structural.

`classify.ts` returns plain applied scalars at the top level and a parallel
`fields.*` bag where each field carries `method: "measured" | "inferred"`
(`types.ts:17-34`). Top-level `speedLimitMph` (`classify.ts:328`) and
`lanesPerDirection` (`:303`) are **measured by construction**: the class
fallback value lives only in `fields.speed.value` / `fields.lanes.value` and
never reaches the top level, so when those rows render at all they rendered
from a real OSM tag. Top-level `roadType` (`:300`) and `divided` (`:301`)
**always** have a value and may be pure inference — the terminal fallback at
`:166-171` returns a road type for any unlisted class, `residential` included.

So exactly two of the five rows can present a guess as a fact, and exactly
those two are marked. Bearing comes off the candidate geometry, not the
classifier, and carries no method at all.

The marker reuses the picker's existing producer and vocabulary —
`OSM · measured` / `OSM · inferred` from `LocationPickerModal.tsx:2543-2546`
— so there is one string and one tone for this fact across both surfaces. No
glyph: `◌` is ruled out by `DESIGN-SPACING.md:98-115` ("unevaluated / not set
/ pending — never a verdict") and by the prior double-duty ruling recorded at
`DESIGN-PRINCIPLES.md:63`. An inferred value **was** evaluated.

Observed on the fixture and worth naming: the block printed
**"Rural — undivided" for a `primary` arterial in central Denver**, which per
`classify.ts:130-144` means `isUrban` resolved false. That is #279, filed and
explicitly out of scope here; `classify.ts`'s predicate is not touched by this
arc, and the divergent-value fixture sets the road type explicitly rather than
relying on the classifier being right.

## #275 — the disputed / undisputed split, from the backend evidence

`ShoulderForm.tsx:148-155` records a `DetectionOverride` marker **only when
disputed** (detected total === 1, or an arithmetic mismatch). An ordinary
edit clears the relays and records nothing — pinned today by a test named
exactly that ("an undisputed edit clears the relays but records nothing
(#112 convention)").

| after a lanes edit | relays on the wire | marker | backend decision | printed output |
|---|---|---|---|---|
| disputed | absent | rides the wire | none | **yes** — the `detection_overridden` audit item reprints the detected numbers |
| undisputed | absent | absent | none | **nowhere** |

Every gate short-circuits on the cleared relays (`render_api.py:190-253`,
`:325-418`; the non-blocking caution at `:1326`), and `schemas.py:224-226`
states the marker is informational — the backend never re-blocks a confirmed
payload.

Hence the ruled rendering: **disputed → show both, marked as an override**
(consistent with what the deliverables already print); **undisputed → withdraw
the detected cell**, because the value participates in nothing anywhere. The
cell carries an honest word, never a blank.

**Sibling forms.** `NearIntersectionForm.tsx:100-131` uses the same
disputed-only rule (`approach_lane_edit`), applying the clear to every leg.
`FlaggerForm.tsx` diverges: it has no lanes input, and each of its four
confirm rows writes a marker **unconditionally** — the disputed-only guard is
enforced by the row's mount condition instead of by an `if`, and each row has
an untick that restores the recorded relays. So flagger never reaches the
undisputed state, and its lanes row does not render in this block at all.
Shoulder's and NI's lane edits have no undo; flagger's confirms do.

## Records fix — committed harnesses must use repo-relative requires

Three committed harnesses required `audit-lib.js` through **worktree paths
that janitorial has since deleted**, so the committed record could not be
re-run:

| file | was | now |
|---|---|---|
| `s2-arc25-refusal-surface/s2a25-lc.js:27` | `…/.claude/worktrees/issue-258-refusal-surface/…` | `../s2-audit-1/audit-lib.js` |
| `s2-arc26-batch-block/s2a26-lc.js:29` | `…/.claude/worktrees/batch-a-block/…` | `../s2-audit-1/audit-lib.js` |
| `s2-arc27-picker-confirm/s2a27-lc.js:35` | `…/.claude/worktrees/batch-a-block/…` | `../s2-audit-1/audit-lib.js` |

One line each, no behaviour change; each verified to resolve and export from
its own directory. **Caution for the handoff (to be pasted by Ryan — this
arc does not edit `handoff.md`): committed harnesses use repo-relative
requires, never worktree paths; a worktree path dies at the next janitorial
and takes the re-runnability of the record with it.**

Noted and **not** changed: `s2-audit-1/audit-lib.js:5-7` holds an absolute
`ROOT` pointing at the main checkout for its `playwright` and `axe-core`
dependencies. That is a stable path (the main checkout, not a worktree), so it
survives janitorial; changing it is outside this arc's ruling.

## Out-of-scope collisions, for whoever takes them next

- **#277** (block absent on four kinds) touches the same three mount lines —
  `ShoulderForm.tsx:83`, `FlaggerForm.tsx:108`, `NearIntersectionForm.tsx:230`
  — and collides with commit 2.
- **#278** (no one-way row) touches the row builder
  `DetectedVsApplied.tsx:55-91` and collides with commits 4 and 5.
- **#276** (strip jurisdiction fallback, `SetupStrip.tsx:692-700`) is disjoint.
- **#279** is `classify.ts`'s `isUrban` predicate, not this block.

---

## After — the same leg, at `4552569`

Frontend tip `4552569`; the backend is unchanged at `a0abc4d` and every run
is gated on it (this arc is frontend-only, so a moving backend sha would
mean something went wrong, not right).

### #273 geometry — the acceptance, measured against ink

`outLocal-ink-after-4552569/` — **16 of 16, 0 fail**, on BOTH the
identical-value and the divergent-value fixture:

| | 1440×1000 | 380×800 |
|---|---|---|
| DETECTED header ink right vs each value | **0, 0, 0, 0 px** | **0, 0, 0, 0 px** |
| APPLIED header ink right vs each value | **0, 0, 0, 0 px** | **0, 0, 0, 0 px** |
| value tracks | 132 / 132 | 123 / 123 (stacked halves) |

Before, the same measurement read 53.0 / 60.4 px at 1440 and 31.6 / 39.0 at
380, and the divergent fixture split the tracks 112.2 vs 132.0.

**Label-edge stability.** The resolved tracks are `186px 132px 132px` on the
identical-value fixture *and* on the divergent one — the label column no
longer moves when a value changes. Before: `225.594px 112.203px 112.203px`
→ `205.797px 112.203px 132px`, a 19.8 px shift of every row label.

**The 520 px stack, pinned — measured, and the measurement beats the GO's
480 (ruled 2026-09-11).** `s2a29-threshold.js` walked sixteen widths.
The block's content width is `(viewport − 120)` px in the narrow regime, so
two 132 px tracks plus two 14 px gaps plus a 90 px label floor needs
≥ 502 px. Pinned at 520 with margin; the existing 480 breakpoint would
leave the label 68 px. At 380 the grid becomes one column (`260px`), each
row wrapper pairs its own two equal cells, and the label takes the row
above them. Nothing truncates.

Note the block width is NOT monotonic in viewport width — at 980 px the
sidebar goes full-width and the block jumps 410 → 850 px — so the stack
threshold only governs the narrow regime, which is why it is measured
rather than derived.

### #273 register

5 type tuples in the block, unchanged from before; the two value columns
render 11px/400 mono at `rgb(147,160,176)` and `rgb(255,255,255)` exactly as
they did. Only the class names moved: two inline utilities became one
declared register, and `text-white` became the `--ink-bright` token that
resolves to the same white.

**The #263 debt is retired outright — ruled 2026-09-11.** The Tailwind row
is gone (`tsxUses 322 → 320`, `tsxSites 107 → 106`, `tsxFiles 37 → 36`) and
the register's one remaining declaration is a **named exception**, not debt
and not a fifth `tr-*` role.

The ruling's reason, recorded because it governs the next surface that asks
the same question: #226's four `tr-*` roles are a **label** vocabulary. A
value register is not a label, and widening that table would weaken what the
four roles mean. So the exception set gains `11px` with its owner and
reason, and this block carries no declared debt.

Two alternatives were measured and rejected on the way there. Dropping the
declaration entirely so the register inherits: it then renders at the
**16px body default**, larger than its own 12px labels and wide enough to
break the track fit — a worse defect than the one being fixed. Adding a
fifth role: rejected by the ruling above.

`cssDeclarations 102 → 103`; `cssSizes` stays 19 because 11px was already in
the sheet. The census asserts in both directions, so it fails if the debt
row lingers *or* the exception is missing — `type-census.test.ts` carries
the widened ruled set (`76/60, 28, 20/17, 16, 14, 11, 9`) with the date and
the reason in its name.

### #274 — measured on the audit's own fixture

Way `39508704` is a `primary` in central Denver and the block called it
**"Rural — undivided"**. It now renders that value with **`OSM · inferred`**
beneath it, and `Divided` likewise. `Bearing` and `Lanes per direction`
carry no marker, because they cannot guess (see "Why only two rows" above).

Why the classifier answers *rural* on a Denver arterial is **#279**, filed
and out of scope: this arc makes the guess legible, it does not change the
guess. `classify.ts`'s predicate is untouched.

### #275 — measured, and which path the fixture exercises

Before: applied `2 → 3`, Detected stayed `2`, unmarked. After: Detected
reads **`2` + `overridden`** at both viewports.

**Which path each layer covers, stated plainly (ruled 2026-09-11).**

- **The live leg exercises the DISPUTED path only.** The fixture's tags say
  why: way `39508704` is tagged `lanes=2` with `lanes:forward=2` **and**
  `lanes:backward=2` — 2 + 2 ≠ 2, an arithmetic mismatch, so the erasure is
  disputed by construction and a `DetectionOverride` marker is recorded.
- **The UNDISPUTED path — the detected cell withdrawing its figure — is
  covered by the mounted suite only** (`DetectedVsApplied.lanes.test.tsx`,
  "UNDISPUTED edit — relays cleared, nothing recorded: the detection is
  withdrawn", plus the case proving a marker from another surface does not
  make a lanes edit look disputed).
- **Why it is not in the live leg:** way `39508704` *cannot* produce an
  undisputed erasure — its own tags are self-inconsistent, so every lanes
  edit on it is disputed. Inventing a second fixture to force the path
  would be weaker evidence than saying so: it would prove the harness can
  construct a state, not that the product reaches it. Whoever next needs
  the undisputed path measured should pick a road whose `lanes`,
  `lanes:forward` and `lanes:backward` agree.

### Contracts, proved

| contract | evidence |
|---|---|
| #214 sentence byte-identical | live leg, both viewports: `road geometry governs the drawing — the typed bearing sets the travel-direction sign only`; plus `DetectedVsApplied.test.tsx` unmodified |
| #198 / #177 / #179 machinery | read-only; no writer touched. `lib/scenarios/**` diff is empty |
| #226 four roles | `type-roles.test.ts` 13/13 unmodified; no fifth role added |
| #263 census + ink | green, with the Tailwind row deleted and the residual owned |
| rail (#228) | `lib/scenarios/rail.ts` diff empty |
| payload senders | **0** — the diff touches no wire field; all three issues are frontend-only |
| snapshots / expectation-JSON / containment | 0 |
| three mount points | one component, one props shape; they differ only in which rows the kind carries (flagger has no lanes/divided row) |
| full frontend suite | **1109/1109**, 144 files |
| page errors | 0 in every run |

### A record fix, and what it deliberately does NOT touch

The `L` check's printed detail was phrased for the failure case, so on a
PASS it read `(unchanged + unmarked = the #275 defect)` — backwards, and
exactly the kind of string a later reader would take at face value. Ruled
2026-09-11 as a record fix: `s2a29-lc.js:286` now prints
`(PASS = the cell changed or carries a mark; FAIL = unchanged and unmarked,
which is the #275 defect)`. The check's logic is unchanged — only what it
says about itself.

**The already-recorded logs keep the old wording, on purpose.** Rewriting a
committed `out-*` directory would amend a historical archive, which this
project does not do: those files are what the run actually printed on the
sha they name. So `outLocal-a0abc4d/log.txt` and
`outLocal-after-4552569/log.txt` still carry the backwards phrasing beside
their (correct) PASS/FAIL verdicts. Read them with this note. Every run
from here prints the corrected wording.

### A harness defect this arc caused and caught

Moving the headers into `.dva-head` made the probes' old head/row filter
return an **empty head list**, which silently skipped the ink assertion —
the one measurement the leg exists for — and the run still reported "4
pass". Separately, the `.tr-prov` markers added by #274/#275 made an
index-based selector pick a marker instead of the #214 sentence, failing a
contract check that was in fact intact.

Both probes now resolve either markup shape, scope the block's own
provenance lines with `:scope >`, and **fail loudly** when a header is
missing rather than skipping. A green run with a silently-skipped assertion
is worse than a red one.
