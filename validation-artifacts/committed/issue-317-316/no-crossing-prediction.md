# Rule 5 prediction: `issue-317-no-crossing` (#317, R129 Q1–Q2)

Written 2026-10-11, before any code, off main `0fafcc7` plus the checkpoint (`4afebab`). Lane:
backend + frontend, `frontend-only: no`. Authority: `rulings.md` (R129), `checkpoint.md` §1–§2.

## Deliberate changes

1. **Geometry read:** a work-start `near_intersection` with no `meta.intersection` now answers 200
   instead of 422. The body is `status: "intersection_not_marked"` with `message` "Mark the cross
   street on the map to lay out the sides.". `side_options` are as built, and `work` and
   `coverage_*` are null even with a side stored.
2. **Aerial read:** the same scenario now answers `pin` with 200 PNG, and `work`/`laid_out` with
   409 `{"status": "intersection_not_marked", "message": …}`. Today it answers 422.
3. **The validator:** `_check_station_producer` skips the crossing check only under the reads'
   validation context. Every other path raises exactly as now.
4. **The side control:** on that status it shows "⚠ " + the message and **Mark on map**, with no
   chips (Q1). The click opens the picker ready to mark.
5. **The band's aerial:** shows the pin and the same message (Q2).

## Not changing

- **Deliverables:** every endpoint's answer to a scenario with no crossing stays today's 422, byte
  for byte. That covers audit, audit-pdf, pdf, xlsx, markdown, crew-pdf, quote, device-breakdown,
  quote-breakdown and replication-snapshot.
- **Other bodies:** every geometry and aerial response for any other body is byte-identical. That
  includes other bad bodies, which keep the same 422 shape.
- **No plan output changes.** No wire field is added to the scenario.

## Predicted churn

| Area | Files | Rough count |
|---|---|---|
| Backend existing | `test_work_start_near_intersection.py` (TypeAdapter, no context: still raises) | 0 |
| Backend new | `tests/test_no_crossing_marked.py` | ~10 |
| Frontend existing | `WhereBand.*`, `BandAerial.test`, `corridor-aerial.test`; no test pins "sides are unavailable" | 0–3 |
| Frontend new | the side control's line + button + click, the aerial note, the stage map | ~6 |

**Screenshots:** N Broadway SB at E 11th Ave (39.73370, -104.98753), near-intersection, at 1440 and
390, before and after marking the crossing.

## Outcome (after the build, `328c5a4`)

| Predicted | Actual |
|---|---|
| Backend existing: 0 | **0.** The full suite passed 2718 (2 skipped). One failure was in a case of my new file: `/render/replication-snapshot` wraps its body, so the bare scenario was refused for a missing key, not the crossing. Removed from the list. The changed files' suites pass 89/89 |
| Backend new: ~10 | 16 in `tests/test_no_crossing_marked.py`. They include byte-identity of the reads' 422 against `/render/audit`'s for a bad body |
| Frontend existing: 0–3 | **0.** 201 files, 2104 tests, all green |
| Frontend new: ~6 | 5 (`WhereBand.no-crossing` ×4, one `BandAerial` case) |
| **Not predicted** | The checkpoint said the rail "adds no second voice". It does: WHERE's own ledger row "Which side is occupied? · Say which side is occupied to lay out the work" (`rail.SIDE_BLOCKER`) still asks for the side while the side control asks for the crossing. It's visible in `before-390.png`. Not changed on this branch, because no ruling covers it; raised in the report |

**Evidence:** `no-crossing-328c5a4/`, on a local stack of `328c5a4`. N Broadway SB at E 11th Ave,
"Lane closure near intersection", at 1440 and 390.

- **`before-*`:**
  - the side control reads "⚠ Mark the cross street on the map to lay out the sides." with
    **Mark on map** and no chips;
  - the aerial is at the pin stage with the same line;
  - the side control's note ("the road's sides are unavailable") is absent.
- **`picker-*`:** Mark on map opens the picker armed, reading "Click the intersection on the map…".
- **`picker-marked-*`:** the crossing pin is on E 11th Ave at Broadway.
- **`after-*`:** after Save, the line and the button are gone, the chip "West side · southbound
  traffic" is offered, and the aerial asks for the side as before.
- No horizontal scroll, no page errors, and no token hits.
