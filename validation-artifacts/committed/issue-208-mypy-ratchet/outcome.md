# Rule 5 outcome: issue-208-mypy-ratchet

Prediction: `prediction.md`, committed in `51fd8ab` before any code. Base: `main` at `4c52c49`.

## mypy

| | errors | files |
|---|---|---|
| before (`mypy-before.txt`) | 75 | 13 |
| after (`mypy-after.txt`) | 0 | 0: `Success: no issues found in 48 source files` |

Matches the prediction. One thing the prediction table already showed is worth calling out: `src/rules/corridor.py` is on the strict list and still had 2 errors, so the drift reached the strict modules too.

## What each fix is

None of the 75 sites was a reachable bug, so none is recorded as a finding.

| family | sites | fix |
|---|---|---|
| `params` typed `object` | `render_api.py` `_placements_for` return and `_render_with`'s `write` callback (12 call sites), `replication_snapshot.py` (2) | the annotation says `ScenarioParams`, which is what `_placements_for` returns |
| `DeviceType \| None` on an aggregated row | `quote_generator.py`, `device_list.py`, `plan_sheet.py` `_device_summary_cells`, `render_api.py` `_format_breakdown_row` | `assert` after the `display_override` branch. A row lacks a type only on a delta-only add, which returns earlier. Before, a None would already have crashed (`.value` / `KeyError`) |
| the aggregation sort key | `device_aggregation.py` | sort `counts.items()` by the same key before building the rows, while the type is still the placement's non-optional `DeviceType`. Same key and the same stable input order, so the same output order |
| Optionals guaranteed on their branch | `audit.py` and `crew_narrative.py` (`wz_speed` under `is_reduced`; `approaches` under the near-intersection kind, already enforced by a `ValueError`; `ni` on the near-intersection branch), `plan_sheet.py` (`taper_label` off the mobile/off-road branch) | `assert`, or `and approaches` in a conditional whose other side already raised |
| one variable, two types | `quote_generator.py` debug print (`line` reused across three line classes), `plan_sheet.py` (`lane` int vs float), `corridor.py` (`corners` declared twice), `app.py` (`det_key`) | renames, or dropping the duplicate annotation |
| shapes | `schemas.py` and `render_api.py` centerline `tuple(tuple(p))` → `(p[0], p[1])`. `ScenarioMeta.centerline` is `list[tuple[float, float]]` (`schemas.py:252`), so each `p` is already a validated pair and the result is equal |
| library types | Sentry `before_send` takes `sentry_sdk.types.Event` / `Hint`; the Anthropic content block is read as `cast(Any, block).text` behind the same `type == "text"` check; `_has_coords` is a `TypeGuard` (same body) | |
| annotations | `audit.py` `co_checks: list[dict[str, Any]]`, `flagger_section: dict[str, Any]`; `corridor.py` `_frame_cache`; `site_detection.py` mirror `tasks: list[asyncio.Future[Any]]`; `site_scan.py` the correction's `Literal`s | |

## Behavior: parity on every deliverable route

`parity208.py` posts every corpus case (`tests/corpus/manifest.py`, 98 cases including boundaries), plus the R117 near-intersection N Broadway bodies (two-way and one-way), in-process to nine routes: `/render/audit`, `/render/device-breakdown`, `/render/quote-breakdown`, `/render/xlsx`, `/render/quote`, `/render/markdown`, `/render/pdf`, `/render/crew-pdf`, `/render/audit-pdf`. It hashes each response's status plus its content (JSON keys sorted, every xlsx cell, every PDF page's text), with render dates masked.

The network is blocked the way the corpus conftest blocks it, and `MAPBOX_TOKEN` is unset, so neither side depends on the wire or on which checkout's `.env` it found. Before ran in a detached worktree at `4c52c49`, after on this branch.

| | scenarios | responses | answered 200 |
|---|---|---|---|
| `parity-before.json` | 100 | 900 | 837 |
| `parity-after.json` | 100 | 900 | 837 |

**The two files are byte-identical** (`cmp`). The 63 non-200 responses are the boundary cases' expected 422/400 refusals, and their bodies are identical too.

The first run differed on every `/render/xlsx`. The cause was the workbook's "Generated" cell, a datetime of the render (23:09:45 vs 23:09:47), so the harness now masks datetime cells. The first run also sent the quote routes a bare scenario; they take `{scenario, settings}`, so it now wraps the body.

## CI and TYPES.md

- `.github/workflows/python-tests.yml` gains `Mypy (src, the ratchet at 0)`: `uv run mypy`, after Ruff. The lock pins mypy 2.1.0, which is also the local version.
- TYPES.md: the ratchet is 0 errors (2026-10-14), CI-enforced, with the 35 → 75 drift recorded.

## Suite

`pytest -q`: **2854 passed, 2 skipped**, the same counts as `main` at `4c52c49`. No test or fixture file changed, and no snapshot moved.

## Prediction vs. outcome

| Predicted | Outcome |
|---|---|
| mypy 75 / 13 → 0 | 0 (`Success: no issues found in 48 source files`) |
| runtime behavior unchanged | 900 responses on nine routes identical before and after |
| suite counts unchanged, no fixture changes | 2854 passed, 2 skipped; no test file in the diff |
| CI step after Ruff | added |
| TYPES.md restated at 0, CI-enforced | done |
| backend-only ship, frontend unchanged | no file under `conestruct/site/` in the diff |
