# #374 rulings: a flagger plan's AFADs carry one name on every surface

Issue: https://github.com/rtmakatura/conestruct/issues/374 (G4 of #370). Branch `issue-374-afad-name`, built on the #375 evidence branch `issue-375-prod-check` (`7838a76`), so #375's production check ships with this fix.

## Sources
- MUTCD 11th Ed. Fig 6P-10 Note 5 (Option), p. 878, as quoted in `validation-artifacts/committed/audit-lane/oracle-sources.md` § L18 (AFAD): "Automated Flagger Assistance Devices (see Section 6L.02) may be used in situations where there is only one lane of approaching traffic in the direction to be controlled."
- S-630-1 Sheet 2, General Note 20, same file, § L18: "Flagger station shall comprise of either a flagger or an automated flagger assistance device (AFAD)."
- The layout places an AFAD as a `TEMPORARY_SIGNAL` labeled `AFAD_1`/`AFAD_2` (`src/generation/layout.py`, the flagger generator's `afad` branch). Nothing else in `src/` places a `TEMPORARY_SIGNAL`.

## R1 (R145 self-ruled): the name is "Automated Flagger Assistance Device (AFAD)"
The issue proposes naming the device AFAD on every surface, from one helper. The full name is MUTCD's term in the singular, and the abbreviation is S-630-1's. Both are quoted above, so the name needs no new source.
- `src/rules/devices.py` holds `AFAD_NAME` and `is_afad(device_type, label)`, the same pattern as `cone_display_name`.
- Page 1's device summary, the device XLSX, the quote XLSX and JSON, and the breakdown (screen and audit) name a row AFAD when its representative placement is an AFAD. The crew sheet's equipment list and the PDF legend do so when every temporary signal on the plan is an AFAD. The layout never mixes AFADs with other temporary signals, so the two rules can't disagree today. If a mix ever appeared, the row surfaces would follow their lowest-station member while the crew sheet and the legend kept their old names. The fix then would be a separate row per kind (CHOSEN to leave for that day, since no plan can produce a mix).
- Any other temporary signal keeps each surface's current name, and so does a jurisdiction-added signal with no placement. The catalog description, pay item (630-86810), unit and price don't change.
- The breakdown's function label stays "Traffic control". The audit's station line ("2 AFAD") already used the abbreviation and is unchanged.

## Rule 5 churn (predicted before the diff)
- Changes, AFAD plans only: the name text in page 1's device summary and legend, the device XLSX `Description`, the quote XLSX and quote JSON `description`, the breakdown `device` (screen and audit), and the crew sheet's equipment bullet.
- Byte-identical: every plan without an AFAD, on every surface (checked on the flagger, flagger-with-pilot-car and shoulder bodies against the base; the spreadsheets differ only in their generated-at timestamps). On an AFAD plan, all quantities, pay items, units, prices, totals, the signs (W20-7a AFAD AHEAD), the crew steps and the audit's flagger section stay the same; the markdown and PDF text equal the base once the name is swapped.
- Not regenerated: the committed audit-lane run `runs/F16/` is the evidence of the three old names and stays as recorded.
