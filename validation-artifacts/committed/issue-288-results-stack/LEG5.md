# issue-288 leg 5 — the four hand-check fixes, on a LOCAL BUILD of `i288-p1-handcheck`

**Run:** 2026-09-22. **Target:** `http://localhost:3123` — `next build && next start` of this
branch. **NOT PROD, NOT SHA-GATED.** **Output:** `%TEMP%\i288p1`, outside the repo, copied
here. **Probe:** `i288-p1-probe-local.js`.

**130 rows across both widths · 4 FAIL, all four the S5-with-none pin attempts.** Every
acceptance line and every one of the four fixes reads green at 1440×1000 and 380×800.

## Why this leg is not on prod, stated first

Prod is `f44377e` — the build Ryan hand-checked. These four fixes are not deployed, so a prod
leg would measure the build that produced the findings, not the fixes for them. The ruling
asked for the leg *before* the ship line, and the only honest way to measure unshipped code
is to build and serve it.

So the sha gate is **replaced, not skipped**: gating on prod's `healthz` here would assert
something true of a machine this run never touches. The probe states what the run is instead
(`gate.local-build`), and every row below is a reading of this branch's own production build.
**A prod leg still has to follow the ship**, and it is the one that closes acceptance line 7
against a deployed sha.

## The four fixes, measured

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

Fix 4's row is the one worth reading twice: the header's number and the count of rows above
the sub-header are the same number, and every one of those rows is a ▲/⚠ tier row. That is
the defect stated as an invariant rather than as a screenshot.

## Acceptance, re-measured on this branch

| # | verdict |
|---|---|
| 1 | **PASS** for S5-with-items, S6, S8; S5-with-none still not reached |
| 2 | **PASS** — one primary per state, both widths |
| 3 | **PASS** — always expanded, header = tier rows |
| 4 | **PASS** — `"4 files"` exactly once |
| 5 | **CHANGED BY FIX 1** — the reserve is retired, and the row reads `null`. Recorded as a Phase 1 deviation from rule 28, not as a pass |
| 6 | **PASS — 11.16:1** at both widths, text confirmed as `--ink-on-dark` |
| 7 | **PASS at both widths — 0 targets under the floor, 0 axe `target-size`** |
| 8 | **PASS** — 0 pageerror, 0 hydration, no date in the nav |
| 9 | **PASS** |
| 10 | Ryan's, again, after the ship |

**Line 7 closes on this branch.** Leg 4 measured 2 targets under 44 px at 380 and one axe
`target-size` violation; both fixes rode the evidence branch and both are confirmed here —
`0 under 44px`, `axe target-size violations: 0`, footer links `44 × 44`.

**Line 5 is not a pass and is not a failure.** Fix 1 retired the thing line 5 measured. The
row reports what is true — the slot renders nothing — and the deviation is recorded against
rule 28 with its reason. Phase 2 restores the reserve when it builds the occupant.

## A probe defect that produced 29 plausible violations

The 380 axe run first reported **29 `color-contrast` violations**, `serious`, against the
counts hero and half the stack. The foreground colours it measured were `#54606f` and
`#8a552e` — which are `--mut` (`#93a0b0`) and `--dim` (`#ff8a2e`) *after* `.results-stale`'s
`opacity: .5` and `grayscale(.4)`.

**axe was auditing the dim.** The line-6 block provokes a refetch on purpose, and the audit
landed inside that window. Acceptance line 7 is about the settled page, so the probe now
waits for `.results-stale` to clear and asserts it has (`380.axe.settled`) before auditing.
Settled, the violations are `region` and `scrollable-region-focusable` — identical to legs 3
and 4, and both outside clause 7.

This is the third measurement this arc has had to correct for reading the wrong pixels, after
the ribbon's border and the share threshold. The pattern is now explicit enough to name: **a
measurement of a page with states needs to say which state it measured**, and a probe that
does not wait will eventually catch a transient and report it with full confidence.

## A REAL finding the artefact uncovered — recorded, not fixed

The dim reading was an artefact of *when* axe ran. What it measured was not fiction: body
text inside `.results-stale` really does sit at about **2.6:1**.

Rule 13 is explicit about this case:

> 13. Contrast floor. Body text ≥ 4.5:1 against its own ground … **Any text inside a dimmed
> region must clear the floor AFTER the dim (rule 122).**

So the stale-results wash is in conflict with rule 13 as written. `.results-stale`
(`opacity: .5; filter: grayscale(.4)`) predates this arc — it is #192/#252's stale-answer
treatment — and none of the seven Phase 1 items or the four hand-check fixes touched it.
Clause 6 moved the *ribbon* out of the dim precisely because the ribbon's own label was
unreadable inside it (#259, 2.39:1); what this leg shows is that the same objection applies
to everything else the dim covers.

**Not fixed here**, because it is not one of the four fixes and changing the wash is a design
decision about how a stale answer should read — not a defect to patch mid-arc. Recorded so it
is not lost: it wants its own issue, and the obvious candidates are a lighter dim, a dim that
carries its own ink, or the clause-6 answer generalised (the things that must stay legible
move out of the wash).

## S5 with none — still not reached, same three pins

Unchanged from leg 4, and unchanged in kind: two candidate corridors offer no OSM way the
picker will take, the third generates with 2 tier rows. Covered at the mount by
`GeneratorShell.needs-you.test.tsx` and `GeneratorShell.primary.test.tsx`'s
`AUDIT_CLEAN_SCANNED` case. Not faked.

## What this leg cannot tell you

It ran against a local production build. It proves the four fixes behave as built, at both
widths, against the real backend. It does **not** prove Vercel serves what was built, which
is what a bundle poll and a sha-gated prod leg exist for — and those follow the ship.
