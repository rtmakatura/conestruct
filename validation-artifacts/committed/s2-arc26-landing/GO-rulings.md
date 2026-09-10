# s2-arc26-landing — the rulings this bucket builds on (record)

Transcribed verbatim from the s2-batch-1 build brief `GO.md` (Ryan's ruling, 2026-09-09; the brief's own title line: `s2-batch-1 GO — buckets A · B · C · D (Ryan's ruling, 2026-09-09)`), so the citations in code resolve to a tracked path (#160). The full GO.md joins this directory with the bucket's evidence commit.

## Cross-bucket rulings
1. **Post-generate landing target = 136 ±1** (`calc(var(--nav-h) + 8px + var(--status-h) + 24px)`), not 98. Reason: 98 puts the verdict strip at 22..74, under the nav. The #250 acceptance is restated to 136; the three live-check baselines (s2a23 B6, audit-walk S2-settle, s2a25 D4) re-baseline in B's evidence commit with the ruling quoted. Pre-generate stays 98.
2. **Chip 3 vs the OutputCards caption.** C keeps "MHT PACKAGE · 4 FILES" (true today, from `BUNDLE_PART_KINDS`). B's #253 commit 7 changes the caption to "MHT PACKAGE" (numeral dropped) in the same commit chip 3 lands — one voice, in shipping order. Declared in both READMEs.
3. **Build order and hand-offs.** A, C, D start now. B commits 1–5 start now; B leaves `SetupStrip.tsx:678` to A; B commits 6–7 (#253) start after A merges and consume `deriveCorrectionsStanding` + `stagedSentence` + the `staged` shell state. C's one-line `GeneratorShell.tsx` prop (`auditChecked`) is C's, and C rebases last if it collides. D's seven `#fff` literals outside its ranges are swapped by their owners (B :1452; C :2865; A :1894/:2673/:2710) — each owner cites `--ink-bright` from D, so **D's commit 5 (the token) ships first among the four**, or the owners add the token themselves with an identical line and D rebases. Choose the former: D ships commits 1–5 as a first slice.

## Bucket B's line from the same brief

- #250: f2 `.status-slot { min-height: var(--status-h) }` + `--status-h: 52px` (380 value measured, pinned in the ≤480 query); (c) `scroll-margin-top: calc(var(--nav-h) + var(--pin-h) + 8px)`, `--pin-h: var(--rail-h)` pre / `0px` post via `data-stage`; (a) `armLandingCheck()` — one `scrollend` (rAF-stable fallback) re-issue if `|top − margin| > 1`, disarmed by user scroll, also once at the pair's settle; c2 declined path measured too.
- #260: one live speaker for the location gate (CTA reason; strip → "AWAITING LOCATION · no site chosen"; rail blocker `aria-hidden`; `.jbar-suggest.quiet` drops `aria-live`; count test); `.status-bar` one height across pre-generate states; "None — baseline" → "Not set" at `JurisdictionSection.tsx:234, 376, 670` (**not** `SetupStrip.tsx:678` — A's).
- #240 = two reserved slots (status slot f2, results-head slot), one commit, no zone min-height.

## Rulings added at the bucket B build (Ryan, via the coordinator, 2026-09-09)
4. **380 landing = the formula's 154.** Ruling 1's formula `calc(var(--nav-h) + 8px + var(--status-h) + 24px)` resolves to 154 at 380 because `--status-h` is the measured 70 there (69.19 with the pill); the #250 acceptance is restated as **"136 at 1440 / 154 at 380"**, and the three live-check baselines (s2a23 B6, audit-walk S2-settle, s2a25 D4) re-baseline with that figure.
5. **Ruling 2 applied in commit 7:** the OutputCards caption "MHT PACKAGE · 4 FILES" → "MHT PACKAGE" (the numeral dropped; `OutputCards.test` line pinning it flips — declared) in the same commit chip 3 lands; the zip stays 4 files.
6. **The `.zone-title` hand-off:** `#fff` → `var(--ink-bright)` and B's row deleted from `CSS_OWNER_SWAPS` in `lib/design/ink-exceptions.ts` (red/green on `ink-literals.test.ts`).
7. **D's type census:** the `.ns-strip` sizes (spec 16-17: label 9.5, index 10, glyph 11, name 12, count 10.5) map to the `.tr-*` roles where they exist — label `tr-section`, index and count `tr-step`, name `tr-field`; the glyph's 11 is the one chosen size, declared as a `type-exceptions.ts` row in the same commit.

