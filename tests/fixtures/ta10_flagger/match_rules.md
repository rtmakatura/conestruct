# Match rules for TA-10 flagger validation

Drafted during Phase 1 fixture extraction (June 10 2026); decisions below
locked June 11 2026 with the PR 2 Phase B approval. Open questions retain
their OQ numbers for traceability to
`validation-artifacts/ta10_flagger/phase1_findings.md` (gitignored).

## Locked decisions (PR 2 Phase B, June 11 2026)

- **OQ-1 (Fines Double)**: RESOLVED by the Item 3 retroactive correction
  (PR 1, commit 66770f5) — the envelope IS required for reduced-speed
  flagger lane closures; PR 2 adds generator emission.
- **OQ-2 (W3-4)**: emit by default. Case 42 includes it (▲), MUTCD note 4
  permits it, and BE PREPARED TO STOP is the most operationally relevant
  warning for a stop-controlled closure. Series: W20-1 → W20-4 → W3-4 →
  W20-7 with gaps C / C / B / A.
- **OQ-3 (short-duration omission)**: always emit W20-1 + G20-1/G20-2 in
  V1. Note 3 is an Option; CDOT typicals always show W20-1.
- **OQ-5 (R4-1 DO NOT PASS)**: deferred, documented omission (Case 42
  pilot-car only; absent from Case 17; no passing-zone input exists).
- **Taper**: one-lane two-way taper fixed at **100 ft** (max of the
  §6B.08 ¶14 50–100 band — max driver visibility), devices at 20 ft.
  Q1's "~200 ft" resolved: that figure is the opposing-flagger /
  pilot-turnaround standoff, not the taper (re-verification finding).
- **Flagger positions**: approach flagger at **taper start + 100 ft**
  (MUTCD 50–100 band, max picked); opposing flagger at **300 ft from the
  work-area end** (CDOT Case 17 "200' TO 300'" band, max picked; Case 42
  reuses the value as pilot turnaround space).
- **Mirroring**: full per-direction chains (Case 42 both chains verified
  independently; Case 17 states it). Each direction gets its own approach
  series + envelope entry/exit on its side; NOT same-station left/right
  pairs (that is the divided-highway convention).
- **Envelope geometry (Q8)**: Case-42 chain insertion, not the Case-11
  generic formula — R2-10 sits 260 ft upstream of W20-4 with W20-1 pushed
  to R2-10 + C; exit per Case 17: downstream-taper end → 500 ft → R2-11 →
  500 ft → restoration R2-1. The Case-11 generic (wz_start + 500) would
  collide with the corrected flagger station and violate Sheet 12 note
  4's 250-ft sign spacing. The S-630-1 match_rules "Case 11 generic"
  lock remains scoped to shoulder / lane-closure-divided.
- **W3-5 (Q4)**: emitted for flagger per CO Supplement §2B.13(A) (no
  road-class scoping), per-direction sets at R2-10 + 530·k, mirroring the
  shoulder stepped-sequence formula.
- **G20-4**: vehicle-mounted per Sheet 26 — never a roadside placement;
  pilot-car runs list it as field equipment in the crew narrative.

## Case routing (the S1 two-routing pattern)

- **V1 routing: `flagger_basic`** — MUTCD 11th Ed. Figure 6P-10 core +
  CDOT overlay (A/B/C key, device-spacing notes, fines/speed regulatory
  cluster per the locked OQ-1 resolution). One flagger station per
  approach, straight road, single work zone. Fixture:
  `ta10_basic_flagger.json`.
- **Deferred (V1.1+):**
  - `flagger_curve` (CDOT Case 17) — needs curve geometry the form does
    not capture. Fixture extracted: `cdot_case17_curve.json`.
  - `flagger_pilot_car` (CDOT Case 42) — `pilotCar` flag exists on the
    form; full dimension chain extracted: `cdot_case42_pilot_car.json`.
  - `single_flagger_low_volume` (TA-10 note 2) — low-volume short zones,
    one flagger visible to both directions. No fixture; form has no
    volume input.
  - `afad` (TA-10 note 5 / CDOT Sheet 2 note 20) — `afad` flag exists;
    validation deferred with the variant.
  - `yield_control_low_volume` (TA-11) — alternate to TA-10 without
    flaggers; different scenario kind entirely, out of scope.
  - Intersection flagger setups (CDOT Cases 18/19) — V1.1+ candidates
    for the small-jobs pivot; not extracted this phase.
  - Pedestrian-impacting variants — `pedestrianAccess` flag exists; no
    TA-10/CDOT flagger typical dimensions pedestrian routing, so V1
    treats R9-9 emission as informational (see below).

## Exact-match dimensions (assert verbatim)

- Advance series sign codes and order, per direction, driver order:
  **W20-1 → W20-4 → W20-7** (B-11 resolution: W20-4 at B is the diagram
  standard; W3-4 does not replace it).
- W3-4 is emitted by default (locked OQ-2) and its position must be
  **between W20-4 and W20-7** (Fig. 6P-10 note 8). Conestruct series:
  W20-1 –C– W20-4 –C– W3-4 –B– W20-7 –A– (gap structure preserves every
  letter-coded minimum; mirrors Case 42's full-gap structure with the
  deferred R4-1 / in-chain assembly slots collapsed).
- Two flagger stations, one per approach, on the closed-lane side.
- Advance series mirrored for the opposing direction.
- A/B/C gap values from the CDOT key (Sheet 9/25) by road type:
  100/100/100 (urban ≤40), 350/350/350 (urban ≥45), 500/500/500 (rural),
  1000/1500/2640 (expressway/freeway — unlikely for a 2-lane road; keep
  for completeness).
- One-lane, two-way taper length **50–100 ft** (assert
  `50 <= taper_len <= 100`), devices at ~20 ft spacing (assert spacing
  ≤ 25 ft; "approximately 20" per 6B.08 ¶14).
- Downstream taper 50–100 ft, ~20 ft spacing (same tolerance).
- Flagger station 50–100 ft upstream of taper start (assert the band).
- G20-1/G20-2 pairing per direction if emitted (presence optional per
  TA-10 note 3; G20-2 is "(optional)" on the figure — see OQ-3).

## Tolerance dimensions

- Computed stations (sign placements from A/B/C accumulation): ±10 ft
  absolute (same convention as S-630-1 rules).
- Taper/downstream device counts: derived from length and ~20 ft
  spacing → expect 3–6 devices per taper; assert count ≥
  `ceil(taper_len / 25) + 1` rather than a fixed number.
- Tangent (work-area centerline) device spacing: ≤ 2 × speed (CDOT
  Sheet 2 note 18b). Count informational; spacing asserted.

## Informational-only (never asserted)

- Diagram device counts in any figure (illustrative).
- Pilot-car staging position (Case 42 icon placement).
- W16-2P "XX FEET" plaque under W20-7 — "(optional)" on Fig. 6P-10;
  document Conestruct's choice in Phase 4, don't assert.
- R9-9 pedestrian signs (Conestruct extension; no TA-10/CDOT flagger
  basis to validate against).
- Arrow board / attenuator symbols on CDOT diagrams (triangle-marked
  optional).
- Sheet 25 SPEED REDUCTION CHART (adjacency suggests Case 41 chip-seal
  scope; not established for flagger).

## Buffer space

- MUTCD Fig. 6P-10 shows no dimensioned buffer; note 6 guidance ties
  buffer extension to flagger sight distance at curves.
- CDOT Sheet 2 **General Note 24**: buffer optional, engineer-determined
  (note: Sheet 25 legend's "general note 23" pointer is stale).
- Conestruct currently inserts the Table 6C-2 buffer between work zone
  and taper. Proposed rule: **accept as a documented conservative
  inclusion** — assert the audit trail discloses that CDOT makes buffer
  optional for this scenario class and that the plan includes it by
  policy (mirrors the B-05 disclosure pattern). OQ-4 confirms wording.

## D-05 flagger advance-warning table (PDF) — Phase 3 target

When the flagger branch of `_build_advance_warning_table` goes
placement-driven (D-05), the off-page ADVANCE WARNING SIGNS table for
`flagger_basic` should list, per the partition convention (signs with
station > station_max_visible), closest-first:

| # | CODE  | DESCRIPTION            | DIST FROM TAPER |
|---|-------|------------------------|-----------------|
| 1 | W20-7 | FLAGGER AHEAD          | A               |
| 2 | W3-4  | BE PREPARED TO STOP    | A + B (only if emitted) |
| 3 | W20-4 | ONE LANE ROAD AHEAD    | A + B (+gap)    |
| 4 | W20-1 | ROAD WORK AHEAD        | A + B + C       |

The opposing-direction set needs no table rows: negative-station signs
satisfy `station <= station_max_visible` and are drawn on the schematic
(OQ-6 dissolved — see dispositions). Today's static 3-row list
(W20-7/W3-4/W20-1) drops W20-4 — the bug class D-05 exists to fix.
With reduction, R2-10 (at W20-4 + 260) and the W3-5 set (R2-10 + 530·k)
join the table when beyond `station_max_visible`, and W20-1 moves to
R2-10 + C per the locked Q8 chain-insertion geometry.

## Acceptable variances Conestruct may exhibit

- Buffer inclusion (above) — conservative, disclosed.
- G20-1 BEGIN ROAD WORK emission (§6F.55 pairing) — neither TA-10 nor
  CDOT flagger cases show G20-1; pairing with G20-2 is a Conestruct
  policy. Acceptable if disclosed; not asserted from fixtures.
- G20-5P CONSTRUCTION ZONE plaques inside the work zone — CDOT general
  practice, not on the flagger typicals; informational.
- Speed snap/clamp (B-04): flagger schema caps at 55 mph — fixtures are
  speed-generic, so no conflict.

## Out of scope (V1 validation)

- Grade-crossing provisions (TA-10 notes 9–13).
- Night flagger-station illumination devices (CDOT Sheet 2 note 22) —
  BOM/equipment concern, not layout; revisit with night-work features.
- TA-11 yield control, TA-12+ signals.
- Queue-length / sight-distance engineering checks (note 6 guidance) —
  needs geometry inputs that don't exist.

## Open question dispositions (June 11 2026)

- **OQ-1**: resolved — see Locked decisions (Item 3 retroactive
  correction; envelope required, PR 2 emits).
- **OQ-2 / OQ-3 / OQ-5**: resolved — see Locked decisions (W3-4 on;
  always emit W20-1/G20-2; R4-1 deferred).
- **OQ-4** (buffer disclosure wording): still open — the audit-trail
  buffer disclosure for the CDOT-optional buffer is a small follow-up,
  not blocking PR 2 (the buffer itself stays in the layout).
- **OQ-6**: dissolved — opposing-direction negative-station signs are
  drawn on the schematic (`station <= station_max_visible` holds for
  them; pinned by the T-04 partition tests), so the off-page table only
  carries far-upstream positive-direction signs. No new convention
  needed.
- **OQ-7**: resolved — see Locked decisions Q8 (Case-42 chain insertion
  for flagger; Case-11 generic stays scoped to shoulder/lane-divided).
