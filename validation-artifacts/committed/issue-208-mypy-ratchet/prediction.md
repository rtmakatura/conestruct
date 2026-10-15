# Rule 5 prediction: issue-208-mypy-ratchet (written before any code)

Base: `main` at `4c52c49`. `mypy src` (pyproject `[tool.mypy]`): **Found 75 errors in 13 files (checked 48 source files)**. The full list is `mypy-before.txt`.

| file | errors | family |
|---|---|---|
| `src/api/render_api.py` | 20 | `params` typed `object` by `_placements_for`'s return annotation (13); `DeviceType \| None` (2); Sentry `before_send` signature (1); `tuple[float, ...]` vs a pair (1); misc |
| `src/export/quote_generator.py` | 16 | `DeviceType \| None` (5); one loop variable reused across `EquipmentLine` / `LaborLine` / `DeliveryLine` (11) |
| `src/narrative/crew_narrative.py` | 15 | the Anthropic SDK's content-block union read as `.text` (11); Optionals guaranteed on their branch (4) |
| `src/api/audit.py` | 9 | Optionals guaranteed on their branch (3); `object` indexing (3); a dict typed narrower than what's stored in it (2) |
| `src/rendering/plan_sheet.py` | 4 | Optionals; an `int` variable assigned a float |
| `src/rules/site_detection.py` | 3 | the `sorted` key over asyncio tasks; an Optional index |
| `src/export/device_list.py` | 3 | `DeviceType \| None` |
| `src/rules/corridor.py` | 2 | **strict-listed module**: `no-any-return`, `no-redef` |
| `src/api/site_scan.py` | 2 | `str` passed where a `Literal` is declared |
| `src/api/replication_snapshot.py` | 2 | `object` params |
| `src/rules/device_aggregation.py`, `src/api/schemas.py`, `src/api/app.py` | 1 each | Optional / tuple-shape |

## Predicted outcome

- **mypy:** `Success: no issues found in 48 source files`, so the baseline is 0.
- **Runtime behavior: unchanged.** Every fix is an annotation, a `cast` or narrowing to what the code already guarantees, or an `assert` naming an invariant enforced a few lines earlier (for example `build_audit_trail` already raises `ValueError` when a near-intersection plan has no `approaches`). No reachable path gains a branch or a different output.
- **Python suite:** same pass/skip counts as `main` (2854 passed, 2 skipped at `4c52c49`). No test or fixture changes, and no snapshot moves.
- **Wire, PDF, XLSX, crew sheet, audit:** byte-identical. No frontend file changes.
- **CI:** `.github/workflows/python-tests.yml` gains a `Mypy (src)` step, `uv run mypy`, after Ruff. From the next ship on, R50 stops a ship on any mypy error.
- **TYPES.md:** "35 known errors in 6 files (measured 2026-05-25)" becomes 0 errors (measured 2026-10-14), CI-enforced. The "Why not pre-commit" section stays, and its "manual / future server-side CI only" line becomes CI.
- **The ship:** backend-only (Modal redeploy). `/healthz` moves to the tip and the served frontend is unchanged.

If any site turns out to be a reachable bug, it goes into `outcome.md` as a finding with its own issue, and that site keeps today's behavior.
