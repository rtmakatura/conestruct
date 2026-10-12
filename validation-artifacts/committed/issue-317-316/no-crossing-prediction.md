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
| Backend existing: 0 | **1, missed and then fixed.** `test_vercel_env_check` failed: WhereBand's 41 new lines moved the `NEXT_PUBLIC_MAPBOX_TOKEN` line that `scripts/production-env.txt:26` cites (`:452` → `:490`). The same cite's `LocationPickerModal.tsx:367` had already drifted on main, now `:313`. My first report of the suite ("2718 passed, the one failure was my own case") was wrong: the verifier caught this failure (REPAIR). After the fix: **2721 passed, 2 skipped, 0 failed** |
| Backend new: ~10 | 18 in `tests/test_no_crossing_marked.py`, plus two cases added after the REPAIR. The reads' 422 matches `/render/audit`'s bytes for a bad scenario, a missing body and a text/plain body. The map read's non-object 422 is pinned to main's (`model_attributes_type`). Main and the branch were diffed on 12 odd bodies (missing, text/plain, a JSON string, a JSON list, bad JSON, `{}`) and are identical. That needed `from_attributes=True`, which FastAPI uses for body models; before it, the map read answered `model_type` for 3 of them |
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

## R131 (after `4cd3c3d`)

The "Not predicted" second voice is fixed per R131. The shell asks the geometry read once and hands
the answer to the band and to the rail. Until the crossing is marked, the side control, the aerial,
WHERE's "Which side is occupied?" row and the rail's side rank all read the backend's line. A stored
side doesn't tick the row until then.

- **Tests:** 3 new in `WhereBand.no-crossing.test.tsx` (the row and the control agree; the ledger
  and rail units).
- **Suites:** frontend 2107 passed; backend 2721 passed, 0 failed.
- **One more cite moved:** `production-env.txt:26` now points at `WhereBand.tsx:507`.

**Evidence:** `no-crossing-4cd3c3d/` (same capture, same stack setup).
- **`before-*`:** `sideRow` = `notMarked` (minus ⚠) = `aerialNote` = "Mark the cross street on the
  map to lay out the sides."; `pageHasSideSentence: false`.
- **`after-*`:** once marked, the row and the aerial read the side sentence, and the West chip is
  offered.
