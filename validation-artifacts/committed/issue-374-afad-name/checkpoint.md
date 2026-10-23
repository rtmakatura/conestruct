# #374 checkpoint (plan, 2026-10-23)

1. **Problem:** an AFAD flagger plan's signal goes by three names, from separate tables: `src/rules/devices.py:299` (the catalog description: page 1, device XLSX, quote), `src/narrative/crew_narrative.py:104` (crew sheet), `src/api/render_api.py:2015` (breakdown, screen and audit). The PDF legend `src/rendering/plan_sheet.py:1147` is a fourth table. The layout places an AFAD as a `TEMPORARY_SIGNAL` labeled `AFAD_1`/`AFAD_2` (`layout.py`'s `afad` branch).
2. **Rulings:** none before this arc. P2 (one voice per fact). R1 (R145 self-ruled, `rulings.md`): the name is "Automated Flagger Assistance Device (AFAD)", MUTCD Fig 6P-10 Note 5's term plus S-630-1 Sheet 2 Note 20's abbreviation.
3. **Change:** one `AFAD_NAME` and `is_afad()` in `devices.py` (the `cone_display_name` pattern); the six naming sites use it when the signal is an AFAD and keep their current names otherwise.
4. **Rule 5 churn:** AFAD plans change name text only; every plan without an AFAD is byte-identical; no quantity, pay item, unit or price changes. Detail in `rulings.md`.
5. **Proof:** `tests/test_afad_name.py` (payload level through the real API, red on the base), then a production check of F16 and a control after the ship, committed under `prod-check/` here.

Proceeded under R145; no stop reason applied (sourced name, no number, no design direction, no scope change).
