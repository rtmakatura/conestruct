# R116 item 1 build (R117 Q1a-d, R118): a jurisdiction rule in plain words, and only "changed" when it changed something

Rulings: `../rulings.md` (R116, R117, R118). Checkpoint: `../checkpoint.md` item 1.

## What changed

**Backend (Rule 3: the facts and the device's words are the backend's).**
- `src/rules/jurisdiction.py`:
  - `annotate_count_effects(applied_deltas, placements)` adds `raised` to each fired count add-device rule (did it add to a count on this plan?) and `device_label` to each rule naming a device.
  - `raised` comes from the same walk the device list, the XLSX and the on-sheet summary apply (`_apply_count_deltas`, the body `apply_count_deltas_structured` now calls), so the words can't disagree with the counts. The input is not mutated, and rules that change no count carry no `raised`.
  - `device_label()` is the existing display name in sentence case ("Arrow board", "Arrow board (Type C)").
- `src/rules/device_aggregation.py`: `AggregatedDeviceRow.jurisdiction_added` records how many of a row's quantity the rules added (0 when the layout already carried enough).
- `src/api/render_api.py`:
  - `_jurisdiction_eval(..., placements)` annotates when given placements. The breakdown payload and the audit PDF pass them; the count-only callers (plan sheet, XLSX, quote) don't need `raised`.
  - Breakdown rows carry `jurisdiction_added` on jurisdiction-required rows.
- `src/rendering/tier_ledger.py` (the audit PDF's ledger): a rule with `raised: false` is checked (R118). Absent `raised` keeps its tier.

**Frontend.**
- `lib/delta-words.ts` is one producer of a rule's words, for every surface:
  - **Title:** "{Device} required" or "{Device} added" (Q1a), "Swapped to {device}", the rule's own note, or "{Jurisdiction} work-method rule" (Q1c).
  - **Detail, one line:** "required by Denver · the plan already places it" or "… · added to the plan".
  - **Citation:** `source.doc` (+ `§ section`), never the rule's sentence (Q1d; the sourced data is untouched).
  - **No raw key, ever:** an older wire without `device_label` gets the id read as words.
- `lib/tiering.ts` (the screen ledger, mirroring `tier_ledger.py`): `raised: false` is checked (R118).
- `lib/tier-sources.ts`: `deltasChanged` drops met rules, a new `deltasMet` group holds them, and `jurisdictionName` is passed through.
- `lib/needs-you-items.ts` uses `delta-words` for its ▲ and ⚠ rule rows. The raw-key join is gone.
- `components/TieredReference.tsx`: a met rule is a "Checked & passed" `CheckRow` with the same words.
- `components/ResultsHero.tsx`: "+N jurisdiction-required" and "N from {jurisdiction}" count `jurisdiction_added` (Q1b), not the flag.
- `components/JurisdictionSection.tsx`: Plan reference's swap unit uses the label, not the raw key.

## Evidence (`capture_ny.cjs`)

A local build of this branch: `next dev` talking to this branch's backend (`uvicorn`, `MODAL_RENDER_URL`), so the new wire fields are real. The plan is `../capture_r116.cjs`'s (N Broadway SB, Denver). Results at 1440 and 390:

| | before (`../shots/`, main `4c1a324`) | after (`build-1/`) |
|---|---|---|
| NEEDS YOU | "add_device 1 arrow_board", Denver's sentence over it, one word per line; "1 changed this plan · 2 site conditions", count 3 | the rule isn't there (it changed nothing); "2 site conditions", count 2 (`needs-you-<w>.png`) |
| counts hero | "54 on the plan sheet · incl. +1 jurisdiction-required"; "1 from Denver" | "54 on the plan sheet"; no "from Denver" (`hero-<w>.png`) |
| Checked & passed | 16 | 17, the first row "✓ Arrow board required: required by Denver · the plan already places it · DOTI PT-116.1" (`checked-<w>.png`) |
| raw keys on the page | `add_device`, `arrow_board` | none (`facts-<w>.json`: `rawKeysAnywhere: false`) |

The device count is unchanged at 54: the board was always in the layout, and only the claim changed.

## Rule 5

- **Wire:**
  - jurisdiction-required breakdown rows gain `jurisdiction_added`;
  - applied deltas gain `device_label` (rules naming a device) and `raised` (fired count adds), on `/render/device-breakdown` and the audit's opt-in breakdown.
- **Tier:** a fired count rule the layout already meets moves from ▲ changed to ✓ checked, on screen and on the audit PDF's cover ledger. On every Denver lane-closure plan whose layout places an arrow board, NEEDS YOU loses that row and its "1 changed this plan", and Checked & passed gains it. When nothing else in NEEDS YOU changed the plan, R103 moves the primary button off NEEDS YOU.
- **Hero:** "+N jurisdiction-required" / "N from …" appear only when a rule added a device.
- **Recordings:** `../rerecord_r117.py` (output `../rerecord_r117.txt`) recomputes each tiering fixture through the real API path and writes only the new leaves:
  - `adv-ni-denver`: `raised: false`, `device_label`, `jurisdiction_added: 0`;
  - the five Lakewood fixtures: `device_label` only.

  Every other leaf is as recorded. The shared pin `tiering-expectations.json` moves `adv-ni-denver`'s `jur:delta:0` from changed to checked (ledger 3/4/12/4 to 2/4/13/4), with the reason added to its `_provenance`.
- **Unchanged:** device counts, the plan sheet, the XLSX, the quote, and Plan reference's rule sentence (sourced data, Q1d).

## Tests

- **New, backend:** `tests/test_r117_jurisdiction_raised.py` (9). Covers met / added / topped-up, only fired count adds carrying `raised`, no mutation, sentence-case labels, the Broadway Denver breakdown, the audit PDF ledger counting the met rule as checked, and the ledger routing by `raised`.
- **New, frontend:**
  - `lib/delta-words.test.ts` (9);
  - `components/TieredReference.r117.test.tsx` (2, mounted on the re-recorded `adv-ni-denver`);
  - R118 in `lib/tiering.test.ts`;
  - two R117 Q1b cases in `components/ResultsHero.test.tsx`.
- **Changed:**
  - `lib/needs-you-items.test.ts`: the made-up delta fixture (a short cite in `rule`, the shape that hid this) is replaced by the real Denver rule, the raw-title pins by the plain titles, and a no-raw-key check is added.
  - Two hero fixtures (`ResultsHero.test.tsx`, `severity-ramp.test.tsx`) gain `jurisdiction_added: 1`, the wire's new field, so their "+1" still means a device was added.
- **Watched red before the code (the expected failures):** the import errors, raw titles, `changed` instead of `checked`, and the hero counting flags. `test_audit_pdf_cover_carries_the_screen_ledger[adv-ni-denver]` failed on the old pin, as predicted, until the re-record.
- **Full suites:** backend 2619 passed, 2 skipped. Frontend 194 files, 2055 passed. `tsc` clean.
