# #373 rulings: the pilot car is listed on every surface that lists equipment

Issue: https://github.com/rtmakatura/conestruct/issues/373 (G3 of #370). Branch `issue-373-pilot-car`, built on the #372 evidence branch `issue-372-prod-check` (`2a5a7fd`), so #372's production check ships with this fix.

## Sources
- S-630-1 Sheet 26, as quoted in `src/generation/layout.py` (flagger branch, the `pilot_car` comment): the G20-4 "SHALL BE MOUNTED IN A CONSPICUOUS POSITION ON THE REAR OF A VEHICLE". The crew sheet already prints this cite ("S-630-1 Sheet 26: vehicle-mounted, not a roadside placement"). This arc reuses it and adds no new source claim.
- The issue cites MUTCD §6E.04 ¶03–¶04, p. 787 for the pilot car. This arc quotes nothing from it.

## R1 (R145 self-ruled): its own equipment row, not a new DeviceType
The issue asked the fix to choose between the device set and an equipment line of its own, and to say which. Answer: an equipment line. `DeviceType` is the drawn 15-class taxonomy. `devices.py` (`get_field_only_devices`) says field-only items "(work vehicles, pilot cars, PPE) are not in the 15-class taxonomy". Adding a member would move `test_rules.py`'s every-type-is-drawn check, the device-order table and the sprite paths, all for a vehicle that is never drawn.
So the shared aggregation (`aggregate_device_rows_with_deltas`, the one entry point page 1, the device XLSX, the quote and the breakdown already call) takes `pilot_car` and appends one row: `device_aggregation.pilot_car_row()`, with `device_type=None`, `display_override=PILOT_CAR_NAME` and a new `equipment_note`. `pilotCar` is a raw scenario fact (not a ScenarioParams field, per #319), so each call site passes it the way the crew sheet and the audit already get it.

## R2 (R145 self-ruled): one name
`PILOT_CAR_NAME` = `Pilot car with G20-4 "PILOT CAR/FOLLOW ME" sign` (`src/rules/device_aggregation.py`). Page 1, the device XLSX (type and description), the quote (device and description) and the breakdown print it. The crew sheet's bullet now builds from the same constant; its text is byte-identical.

## R3 (R145 self-ruled): the quote lists it unpriced
No daily rate for a pilot car is on file (`EQUIPMENT_DAILY_RATES` has none), and inventing one would be an unsourced number (Rule 12). The line follows the 2026-07-22 #151/#154 ruling for an unmapped jurisdiction device: 0.0 for the math, excluded from the total, "—" in the rate and extended cells, and a note saying it isn't in the total and should be priced separately. `EquipmentLine.unpriced` marks it. The quote JSON carries `"unpriced": true` only on that line, so every other line's JSON is unchanged.
No pay item either. The device XLSX prints "—" in the pay-item column (no CDOT pay item is on file for it) rather than "TODO" or an invented number.
**Flag for Ryan:** the quote has no pilot-car driver labor line either. Adding one would be a money decision, so it isn't in this arc.

## R4 (R145 self-ruled, folded per R154): the quote panel shows "—", not $0.00
`QuotePanel.tsx` printed `fmtCurrency(daily_rate)` for every line, so an unpriced line showed $0.00. The pilot car would have read as free on screen, and so did any unmapped jurisdiction line already. The panel now shows "—" when `unpriced` or `jurisdiction_unmapped` is set. The fold fits R154: the change is in a file the fix has to touch for the pilot car anyway, it needs no new ruling (#151/#154 already say "never $0.00"), and it's 10 lines. It's in the churn prediction below.

## R5 (R145 self-ruled): function label "Traffic control"
In the breakdown, the pilot car's function reads "Traffic control", the label the flagger station and the temporary signal already use (`_NON_SIGN_DISPLAY`), because it guides traffic through the one open lane with the flaggers. It isn't "Jurisdiction-required" (no rule adds it).

## Rule 5 churn (predicted before the diff, measured after)
Predicted:
- Flagger plans with `pilotCar` change on page 1, the device XLSX (one row, Summary total +1, types +1), the quote XLSX (one "—" line, money totals unchanged), the quote JSON (one line with `unpriced`), and the breakdown (screen panel and audit `include_breakdown`; `total_devices` +1).
- Byte-identical: the crew sheet (same text), the plain audit (`pilot_car_text` was already there), the drawing, and every plan without the pilot car on every backend surface.
- Screen: an unmapped jurisdiction quote line now shows "—" in place of $0.00 (R4).

Measured (`churn.py` run on a `git archive` of `2a5a7fd` and on the branch; `churn.json`; XLSX and PDF timestamps masked): flagger with `pilotCar` (no jurisdiction, Denver, Greeley arterial) changed page1, xlsx, quote, quote_json, breakdown, audit+breakdown. md and the plain audit were identical. Every flagger plan without the pilot car, shoulder (none, Denver, Greeley) and near-intersection Denver (Broadway) were identical on all eight surfaces. This matches the prediction.

## Evidence
- `tests/test_pilot_car_surfaces.py`: 11 tests through the real endpoints. On `2a5a7fd` the 5 new-behavior tests fail, and the 6 guards pass (page 1 total = XLSX total, crew sheet name, 4 no-pilot-car surfaces).
- `conestruct/site/components/QuotePanel.unpriced.test.tsx`: 1 test. It fails against the base `QuotePanel.tsx` and passes on the branch.
- `page1-device-summary-denver-flagger-pilot-car.png`: page 1's summary on a Denver flagger plan with the pilot car. The full name fits on one line beside #379's arrow board, with no overflow line. Total 44.
- F12 (the #370 row) needs a live site scan, so the production check covers it after the ship.
