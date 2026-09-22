# issue-288 leg 6 — Phase 1 CLOSED on prod at `97faeae`, sha-gated both ends

**Run:** 2026-09-22. **Base:** `https://www.conestruct.com`. **Sha-gated both ends** —
`healthz` = `97faeaefbe00ddd064f6af730a977ca24748d299` = `origin/main`, checked before the
first row and again after the last. **Output:** `%TEMP%\i288close`, outside the repo, copied
to `outProd-97faeae/`. **Probe:** `i288-p1-probe-close.js`. **Poll:** `i288-hc-poll.js`.

**131 rows across both widths · 4 FAIL, all four the S5-with-none pin attempts.** Every
acceptance line this harness can close is green at 1440×1000 and 380×800, and the four
hand-check fixes hold on the deployed build.

## The gate, restored

Leg 5 measured a `next start` of the branch and said so: it replaced the sha gate with
`gate.local-build`, because gating on prod's `healthz` would have asserted something true of
a machine that run never touched. The fixes are deployed now, so the substitution ends.
`i288-p1-probe-close.js` is leg 5's probe with the gate put back **unconditionally** — a
localhost base now fails `gate.base` rather than being excused:

```
PASS gate.healthz       — healthz == 97faeaefbe00ddd064f6af730a977ca24748d299
PASS gate.base          — base is https://www.conestruct.com
PASS gate.healthz-after — healthz still 97faeaefbe00ddd064f6af730a977ca24748d299
```

It is a copy rather than an edit because leg 5 quotes that file's behaviour; a file that
changes under a finished report makes the report unreadable.

## The bundle poll — 33 markers, 0 wrong

`i288-hc-poll.js` carries `i288-p1-poll.js`'s 25 Phase 1 markers byte-identical, plus 8 for
the hand-check. Every Phase 1 marker still reads as leg 4 left it; the eight new ones read:

| marker | served |
|---|---|
| `results-head-slot` (fix 1, retired) | **absent** |
| `jbar-readonly` (fix 2, the dropped bar) | **absent** |
| `jbar-slot-hint` (fix 2 leftover) | **present — dead CSS, see findings** |
| `CDOT Specs §630`, `MUTCD 11th + CO Suppl.` (fix 2's baseline chain) | present |
| `Reference` (fix 3's promoted row) | present |
| `ny-subhead`, `Site conditions — scanned` (fix 4) | present |

Two markers were wrong on the first run and both are recorded, because one of them was the
arc's fourth measurement to read the wrong bytes:

1. **`CDOT Specs §630` reported ABSENT on a build that serves it.** The minifier re-encodes
   `§` as a `\xa7` escape in the JS chunk, so a literal-`§` grep misses it. The served text is
   `["MUTCD 11th + CO Suppl.","CDOT Specs \xa7630"]`, which is `BASELINE_CHAIN_DISPLAY`
   exactly. The marker is encoding-agnostic now.
2. **`jbar-slot-hint` reported PRESENT, and that one is true.** See the findings section: the
   expectation was wrong, not the build.

## The four fixes, measured on the deployed build

| fix | 1440 | 380 |
|---|---|---|
| **1** — no empty reserve | slot height `null` | `null` |
| **2** — the bar is gone | `.jbar-readonly` absent | absent |
| **2** — its facts ride the row | `Not set · Arterial · MUTCD 11th + CO Suppl. › CDOT Specs §630` | same |
| **3** — one disclosure group | `["Pricing quote","Checked & passed","Pending / not verified","Reference"]`, **0 rows outside it** | same |
| **3** — the anchor survived | `#reference` present, inside the group | same |
| **3** — the draft notice is last | follows the group | follows the group |
| **4** — the sub-header | present | present |
| **4** — count agrees with rows | header `"3"` = **3 rows above the sub-header, all tier rows** | same |

Identical to leg 5's readings, now on the build Ryan will open rather than on a local one.

## #288's acceptance, all ten lines, at `97faeae`

| # | line | verdict |
|---|---|---|
| 1 | Every S5/S6/S8 state at both widths | **PASS for S5-with-items, S6, S8**; S5-with-none still not reached on prod (below) |
| 2 | One primary per state at both widths | **PASS** — 0 rule-130 primaries + 1 filled action, NEEDS YOU owns it; the zip renders at both widths (ruling 183) |
| 3 | NEEDS YOU always expanded; ledger the only sorter | **PASS** — header `"3"` = 3 tier rows, and under fix 4 the rows it counts are the rows above the sub-header |
| 4 | File count stated once, from the served bundle | **PASS** — `"4 files"` exactly once at both widths |
| 5 | Reserved first row holds at the settle | **RETIRED BY FIX 1** — the row reads `null` at both widths. A Phase 1 deviation from rule 28, recorded with its reason; not a pass and not a failure |
| 6 | Ribbon ≥ 4.5:1 mid-flight on the composited surface | **PASS — 11.16:1** at both widths, the sampled colour confirmed against the declared-token allowlist as `--ink-on-dark` |
| 7 | Left edges ±1; TARGETS 0 under 32/44; axe `target-size` 0 at 380 | **PASS at both widths** — 38 interactive, `under: []` at the 32 floor and at the 44 floor; `axe target-size violations: 0` |
| 8 | Zero `pageerror`; nav citation carries no date | **PASS** — 0 `pageerror`, 0 hydration-shaped at both widths; nav reads `TA-3 · S-630-1 · MUTCD 2023 · CDOT` |
| 9 | Nothing in §8 KEPT changes behaviour | **PASS** — the draft notice, the refusal container, the announcement region and the four download cards all present and unchanged |
| 10 | Ryan hand-check on a hard-refreshed tab | **YOURS** |

**Nine of ten closed on prod**, against eight at leg 4. Line 7 was leg 4's only product
failure and it closes here on the deployed build: the two fixes that rode the evidence branch
(`min-w` on the footer links, `.strip-edit-all` in the ≤480 floor block) measure
`Terms 44 × 44` and `Privacy 44 × 44` at 380, where leg 4 measured `35 × 44` and one axe
`target-size` violation.

Line 5 is the one row that is neither pass nor fail. Fix 1 retired the thing line 5 measured,
so the leg reports what is true — the slot renders nothing — and the deviation is recorded
against rule 28 in `rulings.md`. Phase 2 restores the reserve when it builds the occupant.

## Line 6, and what the settled page says about the dim

**11.16:1 at both widths**, sampled off composited pixels with the 4 px border inset and the
0.05 % share floor, and the winner asserted against the tokens declared on the live
`.workbench`:

```
1440  rgb(200,209,221) = --ink-on-dark  0.293% on rgb(16,28,41) 94.52%
 380  rgb(200,209,221) = --ink-on-dark  0.612% on rgb(16,28,41) 88.17%
```

The axe run at 380 reports **`region` and `scrollable-region-focusable` only** — and, in
particular, **zero `color-contrast` violations**, because `380.axe.settled` waits for
`.results-stale` to clear and asserts it has before auditing. Leg 5's 29 `color-contrast`
violations were the same page audited *inside* the dim. Both readings are true of the same
build; they differ in which state was measured. That is the dimmed-results question, and it
is its own issue, not a Phase 1 line — and #259 already measured it (56 of 59 pairs) and
scoped it out deliberately when it fixed the ribbon.

## A finding: fix 2 left its CSS behind

Fix 2 deleted `JurisdictionContextBar` and its own `.jbar-readonly` rule — the poll confirms
both absent from the served bundle. It did **not** delete the rules the bar was the only
renderer of. These selectors now match nothing in the DOM, at any state, at either width:

- `conestruct/site/app/globals.css:1582` — `.workbench .jbar`, under a comment that still
  describes the surface as "Persistent jurisdiction bar … the reserved Endeavor-B slot"
- `:1587` and `:1595` (inside the `≤980px` query) — `.workbench .jbar-main`
- `:1601` — the `.workbench .jbar-cell .k` half of a rule it shares with `.jctl-field .k`,
  which stays live
- `:1612`, `:1628` — `.workbench .jbar select`, `.jbar select:focus`; both need a `.jbar`
  ancestor
- `:1790`, `:1795`, `:1805` — `.jbar-slot-auth`, `.jbar-slot-hint`, `.jbar-slot-chain`, with
  the 36 px / 34 px / 108 px reservations measured for a bar that no longer renders

`.jbar-auth`, `.jbar-skel-line` and `.jbar-suggest` are **live** — `JurisdictionSection`
renders all three, and that is Phase 2's surface, untouched. The distinction matters: a
blanket `jbar` deletion would take the picker's chrome with it.

**Not fixed here**, for the same reason leg 5 did not fix the dim: this leg is evidence, and a
stylesheet deletion is a code change that needs its own verified commit and its own ship. It
is dead weight, not a defect — nothing renders wrong because of it. Recorded so the next
person reading `:1781`'s "jbar geometric stability" block does not re-measure a bar that is
no longer there.

## S5 with none — still not reached, same three pins

The ruling asked for a clean pin if one could be found. The same three were tried at both
widths, with the same results as leg 4:

| pin | result |
|---|---|
| US-40 near Cheyenne Wells, CO (39.0361, −102.2807) | **0 candidates** |
| CO-71 south of Ordway, CO (38.4783, −103.7930) | **0 candidates** |
| US-40 west of Craig, CO (40.4850, −107.9500) | 1 candidate, plan generated — **2 tier rows, not clean** |

Those four FAIL rows (two pins × two widths) are the leg's only failures, and they are
failures to *reach a state*, not failures of the build. A clean plan is a property of a
corridor; suppressing rows to manufacture one would measure the probe. The state is covered
at the mount by `GeneratorShell.needs-you.test.tsx` and by `GeneratorShell.primary.test.tsx`'s
`AUDIT_CLEAN_SCANNED` case — count 0 with the block still mounted for its condition rows,
which is the only state where two primaries could appear. Unreached on prod for the third leg
running; recorded as the one acceptance gap trying harder has not closed.

## S6, by replay — labelled

`1440.S6.replay-armed` and `380.S6.replay-armed` are `INFO`, not `PASS`, and say why: the
audit call is answered with a real-shaped 400, which measures the frontend's refusal path and
not the backend's. Under it, the refusal container renders, the CTA is gated (#180), NEEDS
YOU is correctly absent beside the refusal (spec 31, rule 10), and **0 ribbons** appear under
a decline (#258).

## The console errors, accounted for

`pageerror` is 0 at both widths, which is what line 8 asserts. The console *errors* are 4 at
1440 and 7 at 380, and every one is a 400:

- four at each width at t ≈ 261–268 s are the **S6 replay's own injected refusals** — the
  probe caused them;
- three more at 380 at t ≈ 32.8–33.3 s are **live 400s from the backend during S5's
  form-fill**, with `ERR_ABORTED` on the requests that superseded them. The audit fires on
  input change, so a partially-filled form asks a question the backend correctly declines.
  Known behaviour, not new, and not a `pageerror`.

## What this leg does not close

Line 10 is Ryan's, on a hard-refreshed tab. Line 1's S5-with-none remains unmeasured on prod.
Neither is something this harness can close by running again.
