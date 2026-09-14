# s2-triage-2 — rank and prioritize every open issue

**Prod sha `025aa13d11617e252af8f9c8225b73258b22e76e`.** `/healthz` returned
`025aa13d1161…` and `git rev-parse HEAD` returned the same at the start of this
pass and again as the first line of every probe log. 2026-09-14. No product
code changed on this branch; the two probe scripts and their outputs are the
only additions (#212's probe set the precedent — a probe is not product code).
Supersedes `s2-audit-1/findings.md` (2026-09-08) as the board order.

## How to read the evidence labels

Every row carries one of three states, and they are **not** interchangeable:

- **still present** — the defect is there now. Sub-labelled `(source)` for a
  static read with file:line, or `(prod)` for a measurement on
  www.conestruct.com at this sha.
- **stale** — later work fixed it; the issue is open only because nobody
  closed it.
- **not measured this pass** — Rule 10. Neither confirmed nor refuted here,
  with the reason stated. This is a real answer, not a gap to be filled with
  "probably still present".

Measurement scope was ruled before the pass: **source reads everywhere, plus a
targeted prod leg on the shoulder flow only** — that is where the
operator-frequency weight sits. Flagger and near-intersection are source reads
throughout and are labelled as such. Nothing below blurs the two.

## Harness

| file | what it does |
|---|---|
| `s2t2-shoulder.js` | the shoulder walk: #272 box-vs-ink, #264 target census, #262 editor height, #276 cell text, #277 mount, #256 settle, #212 baked date |
| `s2t2-staleribbon.js` | #259 against the persistent staged dim rather than the transient in-flight one |
| `audit-lib.js` | copied byte-identical from `s2-audit-1/` — same probes, same sha gate |

Raw rows: `out-025aa13/rows.json`, `out-ribbon-025aa13/`, `out-ribbon2-025aa13/`;
logs and screenshots beside them.

**Read `out-025aa13/log.txt` with this caveat.** It appends two runs. The
first used a settle gate that matched the status strip's text — but the strip
already reads "VERIFIED · READY FOR TCS REVIEW" *before* Generate, so that run
settled on the pre-generate state and its rows are invalid; its #256 wall
figures (26880 ms, 29622 ms) measure pinning, not a plan. The gate was
corrected to wait on the answer's own marks (an enabled download plus the
next-steps strip) and the run repeated. **Only the second run's rows are cited
above**, and `rows.json` holds only that run. The bad run is left in the log
rather than deleted — the archive is not amended.

**`s2t2-shoulder.js` says so when it cannot see #212.** A run on the deploy's
own UTC day cannot observe the hydration mismatch, because the baked prerender
date and the client's today are the same string. Today **is** `025aa13`'s
deploy day (commit `2026-09-14 09:27 -0600`), so the probe printed its loud
caveat above the results and the zero-page-errors line in both legs is **not**
evidence about #212. That is arc 30's lesson wired into the probe.

---

## Correcting the counts this pass was briefed with

The brief stated "nineteen issues have closed since and eleven have been
filed". Derived from gh instead:

| claim | briefed | measured (gh, sole authority) |
|---|---|---|
| closed since 2026-09-08 | 19 | **18** |
| filed since 2026-09-08 | 11 | **27 created, 14 still open** |
| filed after the audit's own batch (≥ 09-09) | — | 16 created, 10 still open |
| open now | — | **36** |

**Where "nineteen" came from, exactly.** `handoff.md`'s reconciliation line
lists 19 distinct closes. Two of them — **#270 and #271** — are **OPEN on gh**.
Handoff's union minus those two, plus #252 (closed but not in that line), is
18. So the briefed number is not a miscount of gh; it is handoff's own list,
and that list is wrong by exactly the two issues Part 1 flags as stale below.

"Eleven filed" is closest to handoff's own *Filed* list (#269–#280), which
holds **12**. No cut of gh produces 11.

---

## Part 1 — is each issue still real at `025aa13`?

### The two that are simply done

| # | state | evidence |
|---|---|---|
| **#270** | **STALE — fixed, never closed** | s2-arc27 shipped it: Confirm moved into the row's action cell, picker rows 71 px for every condition name. `handoff.md` arc-27 record, tip `0da8f4d`, evidence `49273e4`. gh still OPEN. |
| **#271** | **STALE — fixed, never closed** | s2-arc28 shipped it: settle-plus-tolerance terminal signal, counted cap, 4 s deadline. Prod 34 counted landings all at target, 793 nowhere. `handoff.md` arc-28 record, tip `22f2f81`, evidence `9b975b9`. gh still OPEN. |

These two are the whole discrepancy between handoff's board and gh. They need
close comments, not engineering.

### Wrong about their own mechanism

| # | what the body says | what is measured |
|---|---|---|
| **#272** | "the sticky strip's own horizontal padding applying to the chip row but not the label", acceptance `label.left === chipRow.left (±1)` | `.ns-strip` has `padding: 9px 0` — **no horizontal padding** (`globals.css:1491-1493`). Prod: **BOX delta 0.0 px** at 1440 (`label.left=170 chips.left=170`) and at 380 (`24 / 24`). **The issue's acceptance criterion already passes on prod.** The real defect is one row down: the chip's own `border 1px + padding-left 10px` insets its ink, so label ink sits **−11.0 px** left of the first chip's ink at both viewports. Fixing the stated cause changes nothing; certifying against the stated criterion would close the bug without a line changing. |
| **#280** | "costing +16 px per row (**+80 px** on a five-row shoulder plan, 405 → ~485 px)" | Arc 30 disproved that figure three days after #280 was filed: the +80 compared a **five-row prototype against a four-row block**; like-for-like the ledger is **16.3 px shorter at 380** (`s2-arc30-ledger/README.md:99-105`). The **reserve itself is still real** — worst DIFFER clause 332.8 px against 236 px available, two lines inside the reserve (same README's table). So the defect stands and its stated cost does not. |

#272 is the arc-29 failure mode repeating: arc 29 found #273's acceptance
criterion passed on unmodified main because it was written against element
rects while the defect lived in the ink. #272 is that same trap, still open.

### Partly overtaken

| # | state | evidence |
|---|---|---|
| **#264** | **still present (prod), 2 of 10 rows stale** | Prod 1440, settled page: **9 enabled controls under the 32 px floor** — signposts "Correct in setup ↑" 119×13 (×2), Terms 35×16, Privacy 49×16, Dismiss 72×28 (×4), Assert 64×28. `.rail-entry` still has `padding: 2px 0` and no `min-height` (`globals.css:2921-2927`). **Stale rows:** "↻ Retry scan" is now `className="dl-btn"` (`GeneratorShell.tsx:1626`, #258) and "↓ Audit PDF" moved out of the tier body into a real download card (`OutputCards.tsx:211`, #261). Neither appeared in the prod census. |
| **#235** | **still present, surface A largely overtaken** | The 2026-09-10 re-scope comment left A (road-section/detected-vs-applied alignment), B (footnotes), D (density), C's type folds. Arcs 29 **and** 30 then rebuilt surface A entirely — the two-column table is gone, replaced by the applied-forward ledger. What remains of A is whatever the ledger did not answer, and the issue does not say. **Needs a re-scope before it can be ranked honestly.** |
| **#259** | **still present (source), scope grew** | The ribbon is lexically inside the `.results-stale` wrapper — `GeneratorShell.tsx:1653` opens the wrapper, the ribbons are at `:1670`, `:1679`, `:1687`. There are now **three**: the `genState === "error"` ribbon, the `regenerating` ribbon the issue names, and a third `stagedDisclose` ribbon added by #254. The issue describes one. |

### Still present — verified in source, not measured on prod

| # | file:line | note |
|---|---|---|
| **#277** | `ShoulderForm.tsx:83`, `FlaggerForm.tsx:108`, `NearIntersectionForm.tsx:230` | `DetectedVsApplied` mounts in exactly three forms — the same three, unchanged through arc 30's rebuild. |
| **#276** | `SetupStrip.tsx:693-697` | `jurisdiction?.name ?? JURISDICTION_OPTIONS.find(…)?.label ?? jurisdictionKey` — one `??` chain, no loading and no errored state. |
| **#243** | `src/api/audit.py:855-868` | Counts every `SIGN_GENERIC` on the mainline by offset sign; nothing excludes site-adjustment devices. The R9-9 pair at `site_adjustments.py:171-172` is placed at a single `offset`, which is exactly the asymmetry the check reads as a violation. |
| **#265** | `plan_sheet.py:3168`, `base.md.j2:128`, `data/jurisdictions/denver.json:11` | Both literals present and different; Denver still pins `"MUTCD 2009 R2 (pinned)"` while both deliverables cite the 11th. All three legs confirmed. |
| **#266** | `src/rendering/audit_blocks.py:216` | `Heading(2, _cell("Colorado Requirements (CDOT S-630-1)"))`, unconditional. |
| **#267** | `render-proxy.ts` `CorridorSpecRequestBody`; `render_api.py:888-889` | Body carries `kind / speed / roadType` only — its own comment says the widths "ride the backend defaults". Defaults are `laneWidth 12.0`, `shoulderWidth 10.0`. |
| **#244** | `DebugSnapshotButton.tsx:289` | `JSON.stringify({ scenario, settings })` — still the raw scenario. |
| **#212** | `AppSheetMeta.tsx:21` | `new Date().toISOString().slice(0, 10)` at render, unchanged. **Not measurable on prod today** — see the caveat above. |
| **#204** | `feature-flags.ts:11-12` | `AUTH_UI_ENABLED = process.env.NEXT_PUBLIC_AUTH_UI === "true"`, unset. The whole launch-held cluster still hangs off this. |
| **#153** | `scripts/verify-jbar-stability.mjs:32` | Still `for (const width of [1440, 1100])`. The 2026-07-30 ruling (option a — declare a floor, extend this script to it, honest below-floor message) is **unimplemented**; no declared floor found in `DESIGN-SPACING.md`. |
| **#239** | `app/(archived)/landing/page.tsx` | Archived, unreachable, copy unchanged. Launch-held. |

### Still present — measured on prod

| # | measurement at `025aa13` |
|---|---|
| **#262** | 380×800: `.setup-strip` **210.8 → 254.8 px** with the Speed editor open — **+44.0 px**, matching the issue's 211→255 exactly. 1440: **0 px**, also as filed. **Escape does not close the editor** at either viewport (`escapeClosedEditor=false`, both legs). |
| **#272** | box delta 0.0, ink delta −11.0 — see "wrong about their own mechanism". |
| **#264** | 9 enabled controls under 32 px at 1440 — see "partly overtaken". |
| **#256** | **Reproduced twice.** Six Generate attempts on the Denver demo pin (39.7269, −104.9873) under a corrected settle gate: 3 settled, **2 returned `PLAN DECLINED · … SERVICE UNAVAILABLE`**, 1 never reached a downloadable state in 80 s. `out-ribbon-025aa13/log.txt`, `out-ribbon2-025aa13/log.txt`. This is **not** a controlled cold-memo rate and does not confirm the issue's "3 of 8" — but the failure class is live at this sha, on exactly the demo corridor. |

### Not measured this pass — with the reason

| # | why not |
|---|---|
| **#259** | Two attempts failed. The in-flight dim settles faster than a 100 ms sampler with a warm memo; the persistent staged dim then needs a Dismiss **plus a reason plus Confirm** (`SetupStrip.tsx:209-241`), which the probe did not drive. A third attempt was spent on the non-unique-`Dismiss` trap handoff warns about. The source nesting is unambiguous, so the defect is confirmed — the **contrast number is not re-measured**; the audit's 2.39:1 stands, taken at `2e0b25e`. |
| **#279** | Needs the picker flow to a real detection on the E Bayaud fixture. The shoulder leg pins manually and so carries no `confirmedRoad` — the same limitation arc 29 documented for the audit walk. `classify.ts:130-144` read only. |
| **#277** | `.dva count=0` on both prod legs, but that is the manual-pin limitation above, **not** evidence about #277. Source read is the evidence. |
| **#276** | Prod cell read `"Not set"` on the happy path. The defect is the **errored/absent** fallback, which needs the jurisdiction evaluate call intercepted. |
| **#208** | mypy is not installed in this environment. `TYPES.md:62-63` still claims "35 known errors in 6 files"; the drift to 63/10 is **unverified**. |
| **#242** | No deploy-window stale-tab test run. |
| **#234**, **#209** | Near-intersection / picker flows — source reads only by the ruled scope. |
| **#215**, **#237**, **#236**, **#205**, **#202**, **#194**, **#195**, **#203** | Not driven. The launch cluster is flag-dormant; #237/#236 are harness tooling. |
| **#146**, **#128**, **#28** | Not started; no defect to verify. |

---

## Part 2 — the ranked list

Ranked by: (1) the screen or a deliverable states something false — a wrong
value reaching a plan outranks a wrong value on screen, which outranks a
missing signal; (2) operator frequency on the flows we ship, shoulder dominant;
(3) whether it blocks or corrupts other work; (4) layout stability (P1/P4/P6)
then polish (P5/P11/P12); (5) mobile-only last. Backend and UI on one list.

| rank | issue | one line | breaks | state |
|---|---|---|---|---|
| — | **#270** | fixed by arc 27; needs a close comment, not work | — | **stale** |
| — | **#271** | fixed by arc 28; needs a close comment, not work | — | **stale** |
| 1 | **#279** | a Denver primary arterial classifies **Rural — undivided**; road type selects buffer tables and device spacing, so a wrong value reaches the plan itself | Rule 12, P2 | not measured this pass (source read) |
| 2 | **#243** | a red ✗ on a **correct** plan whenever the scan detects a sidewalk or bike facility; `is_clean` goes false and the audit-PDF cover counts a failure a TCS will chase | Rule 3, P2, P12 | still present (source) |
| 3 | **#256** | the demo corridor refuses; **measured refusing twice in six attempts at this sha**, and it blocked two of this pass's own measurement legs | Rule 10 (honest, but costly) | **still present (prod)** |
| 4 | **#265** | plan PDF and crew PDF print the edition two different ways, and Denver's record pins a third — two deliverables of one plan disagree | P2, P11, Rule 9 | still present (source) |
| 5 | **#276** | a failed jurisdiction evaluation renders as a confident jurisdiction name — absence rendered as a value, on every shoulder plan | Rule 10, P2, P16 | still present (source) |
| 6 | **#212** | every visitor on every day after a ship gets a stale ISSUED date plus five hydration errors; **structurally invisible to any ship-day check** | P16, P8, Rule 10 | still present (source); not measurable today |
| 7 | **#267** | the picker preview's taper is drawn at default widths, so preview ≠ applied on any non-12 ft or undivided road | P2, P7 | still present (source) |
| 8 | **#266** | the audit PDF and the plan sheet of one plan cite different standard sheets on divided kinds | P2 | still present (source) |
| 9 | **#259** | the label that explains the dim is the least legible text on the page — and there are now **three** such ribbons, not the one filed | P9, P16 | still present (source); contrast not re-measured |
| 10 | **#277** | four of seven kinds carry a detection and show no ledger; three are gated, so this is partly a Rule 8 enablement question | P2, P14, Rule 8 | still present (source) |
| 11 | **#262** | no close affordance, **Escape does nothing** (measured), commit-on-blur with no Apply; +44 px strip growth at 380 | P3, P7, P1 | **still present (prod)** |
| 12 | **#272** | label and chip ink misalign by 11 px — **and the issue's acceptance criterion already passes**, so it must be rewritten before anyone works it | P4, P12 | **still present (prod)** |
| 13 | **#235** | design-round remainder; surface A was overtaken by arcs 29–30 and the issue does not yet say what is left | P5, P2, P11, P4, P13 | still present, needs re-scope |
| 14 | **#215** | window boundaries the crew schedules against are in the data and not printed | P14, P9, P1 | not measured this pass |
| 15 | **#264** | 9 enabled controls under the 32 px desk floor, measured; 2 of the issue's 10 rows are stale | P10 | **still present (prod)** |
| 16 | **#280** | a shorter domain label may remove the 380 two-line reserve — the reserve is real, the **+80 px cost it cites is not** | P6 | still present, magnitude wrong |
| 17 | **#234** | picker forgets the intersection marker the scenario still holds | P15, P14 | not measured this pass |
| 18 | **#242** | a tab open across a deploy runs the old bundle with no affordance | P8, P16, P1 | not measured this pass |
| 19 | **#209** | editors offered for values the seam discards; lanes input accepts 6 against a domain max of 4 | P13, P9 | not measured this pass |
| 20 | **#244** | debug-only snapshot always projects `not_run`; no operator cost | P2 (debug) | still present (source) |
| 21 | **#153** | ruled 2026-07-30 (option a) and **never implemented** — the script still tests `[1440, 1100]` and no floor is declared | P10, P1, P6, P3 | still present (source) |
| 22 | **#205** | four authored jurisdictions unreachable — **and its verification authority is missing from the tree** (Part 4, finding 1) | — | blocked |
| 23 | **#208** | ratchet baseline says 35/6; the drift is **unverified** (mypy unavailable here) | — | not measured this pass |
| 24 | **#237** · **#236** | harness and hook tooling; not operator surfaces | — | not measured this pass |
| 25 | **#204** → **#202** → **#194** → **#203** → **#195** · **#239** | launch-prep cluster, in its own dependency order, all behind the unset flag | P16, P2, P8, P11 | held |
| 26 | **#128** · **#146** · **#28** | endeavours, not defects; nothing to verify | — | not started |

### Where this disagrees with the audit and the board — Ryan rules

- **#279 to rank 1, over the board's 3.** The board leads with #276 and #277,
  both of which are screen defects. #279 puts a wrong *value* into the plan —
  road type feeds buffer tables and spacing. Criterion 1 says a wrong value
  reaching a deliverable outranks a wrong value on screen.
- **#256 to rank 3, from the board's 6.** Not a re-weighting on taste: it
  refused twice in six attempts *during this pass*, and it is why #259's prod
  leg has no number. An issue that makes other issues unmeasurable ranks up by
  criterion 3. It is also the demo corridor.
- **#243 to rank 2, from the audit's 3** — same reason as #279: it reaches the
  audit PDF cover, not just the screen.
- **#264 held low (15) against the audit's 18** — roughly agreed; noted only
  because two of its rows are now stale and it should be trimmed before work.
- **#272 and #280 carry a precondition.** Both need their bodies corrected
  before anyone implements them. Working #272 against its current acceptance
  criterion would produce a green branch and an unchanged screen.
- **#153's ruling is unimplemented.** The board parks it; the 2026-07-30
  comment ruled option (a) and scoped "one doc, one test extension, one guard
  message". It is a small arc that has been treated as a blocked endeavour for
  six weeks. Worth a ruling on whether the ruling still stands.

---

## Part 3 — batches, sequences, ride-alongs

### Must be sequenced (one changes what another measures)

1. **#279 → #277 → #280.** Road type must be *right* before the ledger's
   display of it is extended to four more kinds, and before its label is
   shortened. Shortening `ROAD_TYPE_LABELS` while `isUrban` mis-resolves would
   make a wrong value shorter, not better.
2. **#256 → any arc with a prod leg on the Denver pin.** Proven this pass:
   two legs died on refusals. Until the scan budget is fixed, every prod
   measurement on that corridor is a coin flip, and evidence branches will
   carry "not measured" rows for reasons that have nothing to do with the arc.
3. **#212 → any claim that a live check certifies a page-error-free load.**
   Every ship-day run certifies this as fixed while it is not. Until #212
   lands, a clean `Z-page-errors` on a deploy-day run means nothing, and the
   probe committed here is the only thing that says so out loud.
4. **#235 re-scope → #235 work.** Arcs 29–30 rebuilt surface A underneath it.

### Batchable — s2-batch-1 pattern (parallel worktrees, rebased one at a time before each ship)

| bucket | issues | shared files |
|---|---|---|
| **A — deliverable honesty** | **#265** + **#266** | `src/rendering/plan_sheet.py`, `src/rendering/audit_blocks.py`, `src/narrative/templates/base.md.j2`, `data/jurisdictions/denver.json`. Both are "one producer per printed fact", the #257 idiom. #265 carries a Rule 9 *ruling* (which edition a jurisdiction that pins another is printed under) — that ruling gates the bucket. |
| **B — setup strip** | **#276** + **#262** | `SetupStrip.tsx` (one file), `globals.css` `.setup-strip` / `.sv-editor`. #276 is the cell's derivation, #262 the editor's lifecycle — adjacent, non-overlapping. |
| **C — results head + targets** | **#272** + **#264** | `ResultsHead.tsx`, `globals.css` (`.ns-*`, `.rail-entry`, footer, signposts). Both are padding/inset work with rect tables; one live check serves both. **#272's body must be corrected first.** |
| **D — the dim** | **#259** | `GeneratorShell.tsx:1653-1690`, `globals.css:3653-3661`. Single-file, but it must move **three** ribbons, not one. |

Four buckets, which is exactly the s2-batch-1 shape. A/B/C/D touch disjoint
files, so parallel worktrees are safe; C and D both touch `globals.css` and so
must rebase in a fixed order — C then D.

### Single-arc, not batchable

- **#279** — investigation-first; the rate across the reference pins has to be
  measured before anything is changed, and the fix may be in the Next
  road-bearing route rather than `classify()`.
- **#256** — backend performance with Rule 12 on every constant; its acceptance
  is a measured rate over 20 cold runs.
- **#277** — needs a Rule 8 enablement ruling per gated kind before code.
- **#243** — backend-owned (Rule 3), with its own fixture set.
- **#235** — a design round, once re-scoped.

### Small enough to ride along

- **#244** — one line (`DebugSnapshotButton.tsx:289`) plus its sender-enumeration
  test. Rides any frontend arc; do not give it an arc.
- **#266** rides **#265** (same bucket, one producer).
- **#264's remaining rows** ride bucket C — they are `min-height` on selectors
  that arc is already editing.
- **#280** rides **#277** *if* #279 landed first — same component, same
  measurement table. Re-scope its magnitude when it is picked up.
- **#209's `max={4}`** is a one-attribute change; rides any picker arc (#234).

---

## Part 4 — broken, dishonest or unfinished, with no open issue

Eight, stated as findings with their evidence. Not drafted as issues.

1. **`02-JURISDICTION-DATA.md` does not exist in the tree or in git history.**
   `CLAUDE.md:6` names it "the fact authority for all jurisdiction claims";
   the standing conventions say "Never invent jurisdiction facts — quote
   02-JURISDICTION-DATA with its citation or don't state it"; `memory.md:43`
   and **#205's acceptance criterion** both depend on it. `find` returns
   nothing, `git log --all` returns nothing, and it is not in `.gitignore`'s
   confidential list (which names `/CLAUDE.md`, `/memory.md`, `/handoff.md` at
   `.gitignore:79-81`). Working tree is clean, so it is not present-untracked.
   **Consequence:** the quote-or-don't-state rule is currently unsatisfiable,
   and #205 cannot be executed as written.

2. **`execution-sequence.md` does not exist either.** `CLAUDE.md`'s session
   protocol lists it fourth in the required read order and calls it "the
   working order — supersedes the deleted issue-backlog-triage.md"; the
   Pointers section names it again. Same three checks, same result. The board
   in `handoff.md` is doing that file's job.

3. **`handoff.md`'s board records #270 and #271 as closed; gh has both open.**
   `handoff.md` "Records reconciliation" lists them under **CLOSED**, and both
   arcs shipped with evidence. gh is the sole count authority and says OPEN.
   This single discrepancy is the entire source of the briefed "nineteen
   closed" (correct figure: 18).

4. **#272's acceptance criterion would certify the bug fixed without a line
   changing** — measured, box delta 0.0 px at both viewports. This is the
   arc-29 #273 trap, alive on an open issue. Nothing records it except this
   file.

5. **#280's stated magnitude was disproved before anyone re-read it.** The
   +80 px it cites as its whole justification was withdrawn by arc 30
   (`s2-arc30-ledger/README.md:99-105`) three days after #280 was filed. The
   issue still carries it.

6. **#259's scope grew silently from one ribbon to three.** #254 added a
   `stagedDisclose` ribbon inside the same `.results-stale` wrapper
   (`GeneratorShell.tsx:1687`) and #258's error ribbon is there too
   (`:1670`). The issue names only the `regenerating` one, so a fix scoped to
   its text would move one of three.

7. **Arc 28's "forced-leg gate hypothesis" is still unmeasured.** Recorded in
   `handoff.md` under "Carried" and in the arc-28 README as "To measure on the
   next live run": the window gate reads the same smooth run the jump leg
   does, so the anchor amendment may have moved it. The six runs that would
   settle it returned before the census was written. No issue, and nothing
   asserted — but it is a harness whose verdict is not fully trusted.

8. **#212's acceptance criterion has no scheduled way to be satisfied.** It
   requires "a page built the previous UTC day", and every live check in this
   project runs within hours of its own ship — measured three ways in the
   arc-30 comment. The defect has an issue; **the verification gap does not**.
   Nothing in the repo schedules a non-deploy-day check, so #212 could be
   "verified fixed" by a normal run and still be broken.

### The launch-prep cluster

`#204 → #202 → #194 → #203 → #195` (+ `#239`, + the QuotePanel caption).
Trigger is the `NEXT_PUBLIC_AUTH_UI` flip, which `#204` ties to launch prep and
memory ties to "before first paid pilot". **Not near:** the flag is unset in
prod and `.env.local` (`feature-flags.ts:11-12`), prod DB is ~empty and saved
mode dormant (`handoff.md` deploy state). Nothing in this pass moves it. Leave
held, in that order — #202 (persistence) genuinely precedes #194 (the panel),
and #204 precedes both.

### "Deprioritized standing" items that have quietly become real

- **02's 19→26 sheet count** — promoted from a docs nit to finding 1: the file
  that would carry the fix is absent. `memory.md:43` and `CLAUDE.md:6` both
  still carry the note; `ARCHITECTURE.md:526` already says 26.
- **repo eslint `components lib` glob** — **not measured.** `.eslintrc.json`
  holds only `{"extends": "next/core-web-vitals"}` with no `ignorePatterns`,
  and `"lint": "next lint"` takes no `--dir`; whether that misses
  `components`/`lib` was not determined here and is not asserted.
- The remaining standing items (setback pass, `jurisdiction-demo.json`,
  wandering flake, G20-1/W16-2P, confirm-hold copy) were **not examined** this
  pass.

---

## What I would do first, and why

**Close #270 and #271.** They are done, they are inflating the board, and one
of them is the reason the briefed close-count was wrong. Two comments.

**Then #256, before anything else that needs a prod leg.** It is the only
ranked item this pass measured failing at `025aa13` — twice in six attempts, on
the demo corridor — and it is the reason #259 has no prod number here. Every
arc that follows wants a prod leg on that pin, and until the budget is fixed
each one pays the same tax. Fixing it first makes the next several arcs
cheaper and their evidence trustworthy.

**#279 is the highest-ranked defect, but it is not the first thing to do**,
because it is investigation-first and its blast radius is unknown until the
rate across the reference pins is measured. It should be the first *arc*
after #256 — and its investigation is exactly the kind of prod work #256
currently makes unreliable.

**Before any of that, two bodies need correcting** (#272's acceptance criterion
and #280's magnitude) and two need re-scoping (#235, #259's three ribbons).
Those are comments, not code, and they stop the next arc from shipping a green
branch that changes nothing.
