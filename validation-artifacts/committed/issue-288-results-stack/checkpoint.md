# s2-arc33 / #288 — the checkpoint, RE-DERIVED 2026-09-21

> **This is a re-derivation, not the original.** The checkpoint Ryan's rulings a–h answer was
> never produced. This document is a second pass over the same committed prompt
> (`prompt.md`), against the same codebase, and it may differ from the report he ruled on.
> **Read the divergences section before treating any ruling clause as satisfied.**

## Why a re-derivation — the recovery attempt, in full

Searched all **168** transcripts under `~/.claude/projects/` for `value→wire`,
`ACKNOWLEDGE`, `reserved first row`, `NEEDS YOU`, `counts hero`, `disclosure row`,
`landing target`, `churn table`, `Principles table`.

**The arc-33 session exists and is empty of a report.**
`c--Users-rtmak-Documents-traffic-control-tool/98188f83-0184-40b4-a620-0abc62b2f8db.jsonl`,
70 lines total:

| line | timestamp (UTC) | what |
|---|---|---|
| 8 | `2026-09-17T17:47:56.605Z` | the investigate prompt, 8,399 chars — recovered verbatim as `prompt.md` |
| 25 | `2026-09-17T17:47:58` | "I'll start by orienting: reading the session protocol files…" |
| 40 | `2026-09-17T18:13:34` | healthz confirmed at `018165e` |
| 48–52 | `2026-09-17T18:13:39` | reads the protocol files |
| 63 | `2026-09-17T18:14:00` | "Protocol files read… Now pulling the design authorities" |
| 64–65 | `2026-09-17T18:14:02` | two `Bash` calls — **no results, the file ends** |

The session was interrupted **26 minutes in, during the design-authority reads**, before any
analysis. It contains **zero assistant text blocks over 1,200 characters**. There is no
checkpoint in it to recover.

Across every other transcript, exactly one assistant block over 1,500 chars carries several
of these markers: `…issue-279-classifier/b31f20b2….jsonl` line 702, `2026-09-16T15:33:27`,
85,901 chars — *"Re-verification against the completed #281"*. That is a **#281** verification
dated the day **before** the arc-33 prompt was delivered, carrying 3 of 9 markers. It is not
this checkpoint. Every other hit is my own output in this session (2026-09-21).

**Conclusion: the checkpoint was never written.** The ruling of 2026-09-21 adopting it
"as you mapped / as tabled / accepted" was given against a document that does not exist and
never did.

---

## a. The value→wire map

Every value the stack renders, against the field that carries it today. Verified by opening
the file named; `PARTIAL` marks a row this pass located but did not trace end to end.

| stack value | wire / derivation | verified at |
|---|---|---|
| verdict word + pill | derived, precedence order, not a wire field | `components/StatusBar.tsx:1-45` — invalid input → plan declined → awaiting location → 429 → verdict branches |
| NEEDS YOU ▲/⚠ items | `assignTiers()` over `jurisdiction` + `audit`, mirrored by `src/rendering/tier_ledger.py` | `lib/tiering.ts:160`, model at `:1-40` |
| the five condition rows | `siteScan.corrections[]`, filtered by `isScannedFlag` | `components/SetupStrip.tsx:222-225` |
| the two manual keys | the staging map in the same block | `components/SetupStrip.tsx:202, 228` |
| counts — device total | `DeviceBreakdownData.total_devices` | `components/DeviceBreakdown.tsx:23-25` |
| counts — rows / jurisdiction extras | `DeviceBreakdownRow.jurisdiction_required`, `jurisdiction_source` | `components/DeviceBreakdown.tsx:5-13` |
| cell 3 geometry (4 rows) | `ZoneGeometry` — `taper_l_ft`, `buffer_b_ft`, `device_spacing_ft`, `work_len_ft` | `components/DeviceBreakdown.tsx:16-21` |
| the four cards | `BUNDLE_PART_KINDS = ["pdf","xlsx","markdown","quote"]` | `lib/render-types.ts:22` |
| passed / pending / reference tiers | the ✓ ◌ i tiers of the same `assignTiers` | `lib/tiering.ts` |
| the quote panel | the `quote` member of `BUNDLE_PART_KINDS` | `lib/render-types.ts:22` — **PARTIAL**, panel-level fields not traced this pass |

**Values with no wire field — this phase mints none, so each renders nothing (Rule 10):**

1. **ACKNOWLEDGE has nothing to write.** Grepping `acknowledge` across `*.ts`/`*.tsx` returns
   `app/terms/page.tsx:26` (prose) and the **scan proceed-anyway** acknowledgement
   (`GeneratorShell.tsx:492-494`, a per-input stamp for a refused scan) — a different fact
   entirely. There is no ledger-item acknowledge write anywhere in the codebase.
2. **TRACE's formula fields** — `#286`, backend-first, not this phase's (clause f).

The five-tier ledger is the **one** sorter: `assignTiers` is the only classifier, and lifting
▲/⚠ into NEEDS YOU re-groups its output without re-deciding it (P2).

## b. The rule → component plan

| Part 2 rule | component | disposition |
|---|---|---|
| 50–55 verdict strip | `StatusBar.tsx` | **carries over** — behaviour unchanged (§8.2); rule 55's S7 clause is Phase 2's |
| 72–79 NEEDS YOU | `SetupStrip.tsx`'s corrections block | **restructures** — the staging contract moves whole (§8.5), gains ▲/⚠ item rows |
| 80–83 counts hero | `DeviceBreakdown.tsx` | **carries over** (§8.7) |
| 84–86 cards | the bundle card row | **carries over**, except rule 86 → rulings 182/183 |
| 87–89 disclosure row | — | **NEW** |
| 100–102 ribbons | the stale ribbons | **carries over**; rule 102 is the #259 fix |
| 27–28 stack container + reserved first row | `ResultsHead.tsx:41` `results-head-slot` | **the slot survives, the strip inside it dies** (§8.29) |
| 119/120/125–129 S5/S6/S8 | `TieredReference.tsx` (744 lines) | **retires as a shape**; its five tiers and disclose-never-writes contract transfer |
| 114, 117 S1/S4 | verdict slot | carries over |

**New:** the stack container, the NEEDS YOU shell, the disclosure row. **Retiring:**
`ResultsHead.tsx`'s `<nav className="ns-strip">` (`:47`) and `TieredReference`'s shape.

Rule 7's **type role 5 is not used in this phase** — role 5 is `tr-question`, the step
question, and the results stack asks no step question.

## c. The primary derivation

One derivation, read by both widths (rulings 182/183, overriding rule 86 / §8.6 / 7.5):

```
NEEDS YOU count > 0  ->  NEEDS YOU's actions are primary
otherwise            ->  "All (.zip)" is primary
S6 declined          ->  Retry is primary, nothing else renders  (#258, unchanged)
```

CSS: the primary is `.pri` (rule 130 — full width, 56 px, `#34a9e8` on `#0c1622`); ledger
actions are `.act` (rule 133 — min-height 32 px, **44 px at 380 per rule 15**). Existing
derivation home: `lib/next-steps.ts` (131 lines), whose `{ kind: "ready", n:
BUNDLE_PART_KINDS.length }` at `:87` is the shape the new one replaces. **One function, one
test, both surfaces** — same at 380.

## d. ACKNOWLEDGE

**A finding, exactly as ruled.** Nothing on the wire accepts it (see a.1). Per ruling d the
item renders with its provenance and **no button**; recorded as a finding for #289, where
revision mode may give it a real home. This re-derivation reaches the same conclusion the
ruling did, independently.

## e. The landing and the reserved row

**The formula is already in the stylesheet and already names the verdict strip:**

```
app/globals.css:1459   scroll-margin-top: calc(var(--nav-h) + 8px + var(--status-h) + 24px);
app/globals.css:755    --status-h: 52px;          (3472: 70px at the 380 breakpoint)
app/globals.css:1077,1088   min-height: var(--status-h);   <- the verdict strip
```

So `status-h` **does** still name the verdict strip — confirmed, not assumed. The landing
machinery (`armLandingCheck`, `GeneratorShell.tsx:157`) measures against
`getComputedStyle(el).scrollMarginTop` (`:179`), so **the target needs no code change when
the results head goes** — only the element carrying the class must survive, which rule 28
requires anyway.

**arc-28 legs that re-point:** `validation-artifacts/committed/s2-arc28-landing-recheck/` —
`s2a28-lr.js` and `probe-scrollend.js`, the two files matching `results-head|ns-strip`. Per
#237's rule a suite matching zero nodes must fail loudly, not pass silently.

## f. What TRACE renders before #286

Exactly what the audit carries today, labelled. No formula fields, no authored math in the
frontend (Rule 3). The rows widen when #286 lands. Nothing invented meanwhile.

## g. Churn

| retires | transforms | re-points |
|---|---|---|
| `ResultsHead.tsx` `ns-strip` (`:47`) and its tests | `TieredReference.tsx`'s five tiers → disclosure rows | `s2a28-lr.js`, `probe-scrollend.js` |
| `GeneratorShell.next-steps.test.tsx` | `SetupStrip.corrections*.test.tsx` → NEEDS YOU | arc-19/20/23/25 live-check legs (not enumerated this pass — **gap**) |
| `components/ns-strip-tokens.test.tsx` | `TieredReference.*.test.tsx` (6 files) | |

### ⚠ The two 380 axe findings do **not** retire under rule 15

The committed 380 baseline `s2-arc30-ledger/baseline-axe-380-b2a325a.json` carries exactly
two violations:

| id | impact | nodes |
|---|---|---|
| `region` | moderate | 1 |
| `scrollable-region-focusable` | serious | 1 |

**Neither is a hit-target finding.** Rule 15 is hit targets — "every interactive element
≥ 32 px in its smaller dimension at 1440 px, ≥ 44 px at 380 px" (Part 2, rule 15). It has no
bearing on landmark regions or on a focusable scroll container. Ruling g said "retire under
rule 15 **or you say why not**" — this is the why not. `region` is a landmark-structure
finding and `scrollable-region-focusable` is rule 32's territory (the page is the only scroll
container), not rule 15's. Both remain open against the new stack and must be measured, not
assumed retired.

**This does not change a #281 rule** — rule 15 stands as written — so per the second ruling
it is recorded and the build continues.

## h. Principles table

| surface | FLOW.md step | user | principles |
|---|---|---|---|
| verdict strip | 5 · read the answer | field rep | P2 one voice per fact · P13 no signal by hue alone · P16 one busy signal |
| NEEDS YOU | 5 · act on what it wants | field rep | P18 one question per step · P19 the 80% default · P1 nothing moves unasked |
| counts hero | 5 · price it | office estimator | P12 no cheap motion · P5 type discipline |
| download cards | 5 · take the files | both | P20 zones by the user's question |
| quote | 5 · price it | office estimator | P20 |
| disclosures (S8) | 5 · check the work | office estimator | P8 honesty · P21 model matches mental model |
| reserved first row | 5 · the settle | both | P1 · P12 |

## Divergences from the rulings, and gaps in this pass

**Reproduced independently:** clause **c** (the derivation), clause **d** (ACKNOWLEDGE is a
finding), clause **e** (the formula, and `status-h` naming the verdict strip), clause **b**'s
new/carried/retired split.

**Diverges:** clause **g** — the two 380 axe findings cannot retire under rule 15, because
neither is a hit-target finding. Ruling g anticipated this possibility explicitly.

**Gaps this pass did not close, and does not pretend to:**

1. The quote panel's own wire fields — located, not traced.
2. The arc-19/20/23/25 live-check legs — not enumerated.
3. Rules 114/117/119/120/125–129's state-by-state component mapping — read, not tabulated
   per state.
4. Every text node's `tr-*` role — the prompt requires this and it was not done.

Those four are why this document is a **re-derivation to be ruled on, not a substitute for
the original**. Clauses a, b, e, g and h were adopted against tables that differed from these
in unknown ways.
