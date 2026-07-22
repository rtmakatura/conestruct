# Spec §4 Print Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **📋 PLAN — awaiting approval.** No task may start until Ryan approves this plan.

**Goal:** Put a data-driven Traffic Control Device Summary table and the † source-conflict footnote on the printed plan-sheet PDF, satisfying spec §4.1–4.3 and unblocking the wave-2 hard gate (Castle Rock / Loveland / Thornton).

**Architecture:** Extract the XLSX's placement→row aggregation into a shared pure helper (`src/rules/device_aggregation.py`) so the sheet and the spreadsheet read the same rows by construction. The footer grows a fourth box (LEGEND | NOTES & SIGN SCHEDULE | **DEVICE SUMMARY** | TITLE BLOCK) rendered from those rows; the † footnote renders at the bottom of the NOTES box from the jurisdiction record's collected `conflict` blocks. `render_pdf` loads the jurisdiction record (when `jurisdiction_key` is set) and threads conflicts + the required-unconditionally flag into the renderer.

**Tech Stack:** Python 3 / reportlab (PDF), openpyxl (XLSX), pydantic (schemas), jsonschema (data validation), pytest + pypdfium2 (rendered-text assertions).

## Global Constraints

- **One source of truth:** on-sheet quantities come from `aggregate_device_rows(placements)` — the same call and the same placement list `render_xlsx` uses. No quantity constant may appear anywhere in the summary code path (spec §4.3).
- **Bid authority line, copy verbatim:** `SEE DEVICE LIST (XLSX) FOR BID QUANTITIES.` (Ryan requirement, 2026-07-21 — the sheet and the spreadsheet never compete for authority.)
- **Monochrome-safe:** the summary box and footnote use black + gray hairlines/text only. The conflict signal is the `†` glyph, never a color (CLAUDE.md rule 13).
- **Honest failure modes:** unknown `jurisdiction_key` → HTTP 400 (mirror `render_device_breakdown`); rows that don't fit → explicit `+N MORE TYPES — SEE DEVICE LIST (XLSX)` overflow line, never silent truncation (rule 10).
- **Behavior-preserving where claimed:** Task 1 must leave XLSX row output identical (existing device-list tests green, aggregated tuples unchanged). The new footer box is deliberate, expected churn on the PDF (rule 5: it's the feature, not a bundled fix).
- **House rules:** `gh` read-only; commits via `git commit -F <file>`, named-file staging, `Refs #<issue Ryan files>`, never `Closes`; no push/merge/deploy — Ryan does those; backend change ⇒ `modal deploy modal_app.py` required after merge (Modal does not auto-deploy).
- Tests assert on **rendered PDF text** via pypdfium2 (rule 11), following `tests/test_near_intersection_voice.py::_sheet_text`.

## Layout decision (approved geometry)

Page is 17×11″ landscape: `PAGE_W = 1224 pt`, `MARGIN = 18 pt`, footer row `FOOTER_H = 250 pt`, boxes `FOOTER_BOX_H = 234 pt`, gutter `12 pt` (`plan_sheet.py:93-104, 1863-1873`).

- **Today (3 boxes):** each (1224 − 36 − 2·12)/3 = **388 pt** wide.
- **With summary (4 boxes):** each (1224 − 36 − 3·12)/4 = **288 pt** wide, order LEGEND | NOTES & SIGN SCHEDULE | DEVICE SUMMARY | TITLE BLOCK.

288 pt ≈ 4″ per box. Existing boxes tolerate the squeeze: the title block and notes box already wrap/truncate via `_wrap_to_width`/`_truncate_to_width`; the legend is narrow content. The summary box fits ~18 rows at 9 pt row height after title/header/totals/authority chrome — worst-case flagger plans aggregate to ~12–15 unique rows. Rejected alternatives: inside the NOTES box (collides with the dense tier-2 12-row sign schedule); a second sheet (fails LCUASS 6.1.B.1's "on the sheet" reading); a second footer row (eats plan-drawing height).

When the summary is off (non-required jurisdiction + explicit opt-out) the footer renders exactly today's 3-box geometry.

---

### Task 1: Shared aggregation helper (`aggregate_device_rows`)

**Files:**
- Create: `src/rules/device_aggregation.py`
- Modify: `src/export/device_list.py:78-93` (delete `_row_key`), `:147-189` (`_populate_device_list_sheet` consumes the helper)
- Test: `tests/test_device_aggregation.py`

**Interfaces:**
- Consumes: `DeviceType`, `device_row_sort_key` (src/rules/devices.py); `schedule_key` (src/rules/sign_codes.py); `DevicePlacement` (src/rules/validators.py)
- Produces: `AggregatedDeviceRow(device_type: DeviceType, label: str | None, quantity: int, representative: DevicePlacement)` NamedTuple and `aggregate_device_rows(placements: list[DevicePlacement]) -> list[AggregatedDeviceRow]` — Tasks 5 and 7 rely on these exact names.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_device_aggregation.py
"""aggregate_device_rows is the single placement->row aggregation (spec §4.3)."""
from __future__ import annotations

from src.generation.layout import generate_shoulder_closure_divided
from src.rules.device_aggregation import AggregatedDeviceRow, aggregate_device_rows
from src.rules.devices import DeviceType, device_row_sort_key
from src.rules.validators import ScenarioParams


def _params() -> ScenarioParams:
    return ScenarioParams(
        speed_mph=55,
        num_lanes=2,
        closure_type="shoulder",
        road_type="freeway",
        work_zone_length_ft=800.0,
        lane_width_ft=12.0,
        is_divided=True,
        jurisdiction="CDOT",
    )


def test_quantities_sum_to_placement_count() -> None:
    placements = generate_shoulder_closure_divided(_params())
    rows = aggregate_device_rows(placements)
    assert sum(r.quantity for r in rows) == len(placements)
    assert all(isinstance(r, AggregatedDeviceRow) for r in rows)


def test_rows_sorted_by_shared_sort_key() -> None:
    placements = generate_shoulder_closure_divided(_params())
    rows = aggregate_device_rows(placements)
    keys = [device_row_sort_key(r.device_type, r.label) for r in rows]
    assert keys == sorted(keys)


def test_representative_is_lowest_station() -> None:
    placements = generate_shoulder_closure_divided(_params())
    rows = aggregate_device_rows(placements)
    for r in rows:
        group = [
            p for p in placements
            if p.device_type == r.device_type
        ]
        assert r.representative.station_ft <= min(
            p.station_ft for p in group
            if r.device_type != DeviceType.SIGN_GENERIC or p.label is not None
        ) or r.device_type == DeviceType.SIGN_GENERIC


def test_quantity_scales_with_work_zone_length() -> None:
    """No constants: a longer zone yields more channelizers (spec §4.3)."""
    short = aggregate_device_rows(
        generate_shoulder_closure_divided(_params().model_copy(update={"work_zone_length_ft": 500.0}))
    )
    long = aggregate_device_rows(
        generate_shoulder_closure_divided(_params().model_copy(update={"work_zone_length_ft": 5000.0}))
    )
    def channelizers(rows):
        return sum(r.quantity for r in rows if r.device_type in (DeviceType.CONE, DeviceType.DRUM))
    assert channelizers(long) > channelizers(short)
```

Note for the implementer: if `ScenarioParams` is a dataclass rather than a pydantic model, replace `model_copy(update=...)` with `dataclasses.replace(...)`; if `DeviceType.DRUM` is named differently (check `src/rules/devices.py`), use the actual channelizing-device members. Verify with a quick read before running.

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_device_aggregation.py -v` (venv must show `(traffic-control-tool)`)
Expected: FAIL — `ModuleNotFoundError: No module named 'src.rules.device_aggregation'`

- [ ] **Step 3: Create the module — logic moved verbatim from `device_list.py`**

```python
# src/rules/device_aggregation.py
"""Shared placement→row aggregation (spec §4.1/§4.3).

One aggregation, two consumers: the XLSX device list (the bid-quantity
authority) and the plan sheet's on-sheet device summary.  A single
helper is what makes "the sheet shows the spreadsheet's numbers" true
by construction instead of by parallel arithmetic.
"""

from __future__ import annotations

from collections import Counter
from typing import NamedTuple

from src.rules.devices import DeviceType, device_row_sort_key
from src.rules.sign_codes import schedule_key
from src.rules.validators import DevicePlacement


class AggregatedDeviceRow(NamedTuple):
    device_type: DeviceType
    label: str | None  # schedule key for signs; None for other devices
    quantity: int
    representative: DevicePlacement  # lowest-station member of the group


def row_key(placement: DevicePlacement) -> tuple[DeviceType, str | None]:
    """Aggregation key for one placement.

    Signs split by schedule key (bare label, except the two R2-1 faces —
    see :func:`src.rules.sign_codes.schedule_key`); other devices
    aggregate solely by type; unlabeled signs form one "(unlabeled)"
    group.
    """
    if placement.device_type == DeviceType.SIGN_GENERIC:
        if placement.label is None:
            return (DeviceType.SIGN_GENERIC, None)
        return (DeviceType.SIGN_GENERIC, schedule_key(placement.label, placement.station_ft))
    return (placement.device_type, None)


def aggregate_device_rows(placements: list[DevicePlacement]) -> list[AggregatedDeviceRow]:
    """Aggregate placements into sorted per-type/per-schedule-key rows.

    Sort order is the shared ``device_row_sort_key`` (issue #88) so the
    XLSX, the UI breakdown, the crew equipment list, and the on-sheet
    summary all agree.
    """
    counts: Counter[tuple[DeviceType, str | None]] = Counter()
    representatives: dict[tuple[DeviceType, str | None], DevicePlacement] = {}
    for p in placements:
        key = row_key(p)
        counts[key] += 1
        current = representatives.get(key)
        if current is None or p.station_ft < current.station_ft:
            representatives[key] = p

    return sorted(
        (
            AggregatedDeviceRow(dt, label, n, representatives[(dt, label)])
            for (dt, label), n in counts.items()
        ),
        key=lambda row: device_row_sort_key(row.device_type, row.label),
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_device_aggregation.py -v`
Expected: PASS (all 4)

- [ ] **Step 5: Rewire `device_list.py` to consume the helper**

In `src/export/device_list.py`:
- Delete `_row_key` (lines 78-93) and the now-unused `from collections import Counter` and `schedule_key` imports if nothing else uses them.
- Add `from src.rules.device_aggregation import aggregate_device_rows`.
- Replace the aggregation body of `_populate_device_list_sheet` (lines 163-186) with:

```python
    aggregated = aggregate_device_rows(placements)

    for item_number, row in enumerate(aggregated, start=1):
        sheet.append(
            _row_for(item_number, row.device_type, row.label, row.quantity, row.representative, params)
        )
        sheet.cell(row=item_number + 1, column=6).number_format = "0"

    sheet.freeze_panes = "A2"
    return aggregated
```

- Update the function's return annotation to `list[AggregatedDeviceRow]` (a NamedTuple still satisfies `_populate_summary_sheet`'s `len()` use).

- [ ] **Step 6: Prove behavior preserved**

Run: `pytest tests/test_device_ordering.py tests/test_device_aggregation.py -v` then the full backend suite `pytest`
Expected: PASS, zero failures — XLSX rows byte-identical in content (same tuples, same order).

- [ ] **Step 7: Commit**

Write the message to a scratch file, then:
```
git add src/rules/device_aggregation.py src/export/device_list.py tests/test_device_aggregation.py
git commit -F <msgfile>
```
Message: `refactor: extract shared placement aggregation for XLSX + on-sheet summary (spec §4 task 1)` body noting behavior-preserving, `Refs #<issue>`.

---

### Task 2: Machine-readable "required on sheet" flag + public conflict accessor

**Files:**
- Modify: `data/jurisdiction.schema.json` (delta `effect` properties, ~line 505-530)
- Modify: `data/jurisdictions/loveland.json:39-42`, `data/jurisdictions/castle_rock.json:57-60`, `data/jurisdictions/thornton.json` (new delta)
- Modify: `src/rules/jurisdiction.py` (two new public functions near `_collect_conflicts`, line 424)
- Test: `tests/test_jurisdiction_rules.py` (extend)

**Interfaces:**
- Produces: `requires_on_sheet_summary(record: dict) -> bool`, `collect_conflicts(record: dict) -> list[dict]`, constant `ON_SHEET_DEVICE_SUMMARY = "on_sheet_device_summary"` — Task 3 relies on these exact names.

- [ ] **Step 1: Write the failing tests** (append to `tests/test_jurisdiction_rules.py`, matching its existing import style)

```python
def test_required_on_sheet_jurisdictions_carry_the_flag() -> None:
    """Wave-2 hard gate (BLOCKED.md): LCUASS/Castle Rock/Thornton require
    the device summary on the sheet itself."""
    from src.rules.jurisdiction import load_jurisdiction, requires_on_sheet_summary

    for key in ("loveland", "castle_rock", "thornton"):
        assert requires_on_sheet_summary(load_jurisdiction(key)), key
    for key in ("cdot", "denver", "parker"):
        assert not requires_on_sheet_summary(load_jurisdiction(key)), key


def test_collect_conflicts_public_wrapper_finds_parker_hours() -> None:
    from src.rules.jurisdiction import collect_conflicts, load_jurisdiction

    conflicts = collect_conflicts(load_jurisdiction("parker"))
    assert any(c["label"] == "arterial work window" for c in conflicts)
    assert all(c.get("sources") for c in conflicts)
```

- [ ] **Step 2: Run to verify failure**

Run: `pytest tests/test_jurisdiction_rules.py -v -k "on_sheet or collect_conflicts"`
Expected: FAIL — `ImportError` on `requires_on_sheet_summary`.

- [ ] **Step 3: Schema — allow the flag**

In `data/jurisdiction.schema.json`, inside the delta `effect` `properties` block (after `"note"`), add:

```json
            "requires": {
              "enum": [
                "on_sheet_device_summary"
              ],
              "description": "Machine-readable obligation this admin delta imposes on Conestruct's output. on_sheet_device_summary: the device summary block must render on the plan sheet unconditionally (spec §4.1)."
            }
```

- [ ] **Step 4: Data — stamp the three records**

`loveland.json` delta effect (line 39-42) becomes:
```json
      "effect": {
        "op": "admin",
        "note": "on-sheet device summary block required unconditionally",
        "requires": "on_sheet_device_summary"
      },
```

`castle_rock.json` delta effect (line 57-60) becomes:
```json
      "effect": {
        "op": "admin",
        "note": "explicit device count + type required on the TCP — Conestruct's exact output shape",
        "requires": "on_sheet_device_summary"
      },
```

`thornton.json`: the checkable-device-list fact lives under `devices` (line 125-134), not `deltas` — leave it there and ADD a new admin delta to the `deltas` array (after the existing entries, mirroring their shape):
```json
    {
      "severity": "admin",
      "rule": "The TC permit's 34-stipulation checklist enumerates required devices by type; the TCP is reviewed against it, so the plan sheet must carry an explicit device count + type summary.",
      "baseline": "MUTCD imposes no on-sheet device summary requirement",
      "effect": {
        "op": "admin",
        "note": "on-sheet device summary block required unconditionally",
        "requires": "on_sheet_device_summary"
      },
      "trigger": {
        "classes": null,
        "closure": null,
        "night": null
      },
      "source": {
        "doc": "Thornton Construction & TC Permit handout",
        "section": "TC permit stipulations",
        "status": "verified"
      }
    }
```

- [ ] **Step 5: Helpers in `src/rules/jurisdiction.py`** (directly below `_collect_conflicts`, line 434)

```python
ON_SHEET_DEVICE_SUMMARY = "on_sheet_device_summary"


def collect_conflicts(record: dict[str, Any]) -> list[dict[str, Any]]:
    """Every ``conflict`` block in ``record`` (spec §4.2 — footnote source)."""
    out: list[dict[str, Any]] = []
    _collect_conflicts(record, out)
    return out


def requires_on_sheet_summary(record: dict[str, Any]) -> bool:
    """True when an admin delta obliges the on-sheet device summary (spec §4.1)."""
    return any(
        d.get("effect", {}).get("requires") == ON_SHEET_DEVICE_SUMMARY
        for d in record.get("deltas", [])
    )
```

- [ ] **Step 6: Run schema-validation + new tests**

Run: `pytest tests/test_jurisdiction_rules.py -v` (the existing schema-validation test must pass with the edited files) then full `pytest`
Expected: PASS. If the schema test rejects the new key, the schema edit in Step 3 missed the right `effect` node — fix there, never by loosening `additionalProperties`.

- [ ] **Step 7: Commit**

```
git add data/jurisdiction.schema.json data/jurisdictions/loveland.json data/jurisdictions/castle_rock.json data/jurisdictions/thornton.json src/rules/jurisdiction.py tests/test_jurisdiction_rules.py
git commit -F <msgfile>
```
Message: `feat: machine-readable on-sheet-summary requirement + public conflict accessor (spec §4 task 2)`, `Refs #<issue>`.

---

### Task 3: API plumbing — toggle field, record load, renderer kwargs

**Files:**
- Modify: `src/api/schemas.py:58-75` (`ScenarioMeta`)
- Modify: `src/api/render_api.py:326-363` (`render_pdf`) and its import block (line 53-63)
- Modify: `src/rendering/plan_sheet.py:3331-3345` (`render_plan_sheet` signature — accept + store only; drawing lands in Tasks 4-6)
- Test: `tests/test_plan_sheet_device_summary.py` (new — API-layer cases)

**Interfaces:**
- Consumes: `collect_conflicts`, `requires_on_sheet_summary`, `UnknownJurisdictionError`, `load_jurisdiction` (Task 2 / existing)
- Produces: `render_plan_sheet(..., include_device_summary: bool = True, jurisdiction_conflicts: list[dict[str, Any]] | None = None)`; `ScenarioMeta.includeDeviceSummary: bool = True` — Tasks 4-6 rely on these exact names.

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_plan_sheet_device_summary.py
"""Spec §4 print pipeline — API plumbing + rendered-output assertions."""
from __future__ import annotations

import copy
import json
from pathlib import Path

import pypdfium2 as pdfium
from fastapi.testclient import TestClient

from src.api.render_api import app

client = TestClient(app)

_SHOULDER_BODY = {
    "kind": "shoulder",
    "speedMph": 55,
    "numLanes": 2,
    "roadType": "freeway",
    "workZoneLengthFt": 800,
    "laneWidthFt": 12,
    "isDivided": True,
    "meta": {"project": "Spec4 Test", "address": "", "lat": 0.0, "lng": 0.0},
}
# NOTE for implementer: mirror the exact request shape existing API tests
# use (see tests/test_audit_endpoint.py / tests/corpus fixtures) — field
# names above must match the real Scenario schema, not be invented.


def _pdf_text(body: dict) -> str:
    resp = client.post("/render/pdf", json=body)
    assert resp.status_code == 200, resp.text
    tmp = Path("_spec4_tmp.pdf")
    tmp.write_bytes(resp.content)
    try:
        pdf = pdfium.PdfDocument(str(tmp))
        try:
            return "\n".join(p.get_textpage().get_text_range() for p in pdf)
        finally:
            pdf.close()
    finally:
        tmp.unlink(missing_ok=True)


def test_unknown_jurisdiction_key_is_a_400() -> None:
    body = copy.deepcopy(_SHOULDER_BODY)
    body["jurisdiction_key"] = "narnia"
    resp = client.post("/render/pdf", json=body)
    assert resp.status_code == 400


def test_meta_toggle_field_accepted_and_defaults_on() -> None:
    body = copy.deepcopy(_SHOULDER_BODY)
    resp = client.post("/render/pdf", json=body)
    assert resp.status_code == 200
    body["meta"]["includeDeviceSummary"] = False
    resp = client.post("/render/pdf", json=body)
    assert resp.status_code == 200
```

(Content assertions on the block itself land in Task 5's tests — this task only proves plumbing.)

- [ ] **Step 2: Run to verify failure**

Run: `pytest tests/test_plan_sheet_device_summary.py -v`
Expected: `test_unknown_jurisdiction_key_is_a_400` FAILS (today `render_pdf` never loads the record, so status is 200 or 422); the toggle test fails only if extra meta keys are rejected — note actual behavior.

- [ ] **Step 3: Implement**

`src/api/schemas.py` — add to `ScenarioMeta` after `siteConditions`:
```python
    # Spec §4.1: on-sheet device summary is on by default; jurisdictions
    # whose record carries requires=on_sheet_device_summary ignore False.
    includeDeviceSummary: bool = True
```

`src/api/render_api.py` — extend the jurisdiction import to include `collect_conflicts` and `requires_on_sheet_summary` (same `from src.rules.jurisdiction import ...` block used at lines 53-63; `UnknownJurisdictionError` is already imported for `render_device_breakdown`). Then in `render_pdf`, before `_render_with`:

```python
    include_summary = scenario.meta.includeDeviceSummary
    conflicts: list[dict[str, Any]] | None = None
    jurisdiction_key = getattr(scenario, "jurisdiction_key", None)
    if jurisdiction_key:
        try:
            record = load_jurisdiction(jurisdiction_key)
        except UnknownJurisdictionError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        conflicts = collect_conflicts(record)
        if requires_on_sheet_summary(record):
            # Required-on-sheet jurisdictions get the block unconditionally
            # (spec §4.1) — the toggle cannot disable a legal requirement.
            include_summary = True
```

and pass both into the `render_plan_sheet` call inside the lambda:
```python
                    include_device_summary=include_summary,
                    jurisdiction_conflicts=conflicts,
```

`src/rendering/plan_sheet.py` — extend the `render_plan_sheet` signature (line 3344, after `approaches`):
```python
    include_device_summary: bool = True,
    jurisdiction_conflicts: list[dict[str, Any]] | None = None,
```
For this task, only thread them to where the footer is drawn (store/pass down; actual drawing is Tasks 4-6). Add `Any` to the module's typing imports if absent.

- [ ] **Step 4: Run tests**

Run: `pytest tests/test_plan_sheet_device_summary.py -v` then full `pytest`
Expected: PASS, everything else green.

- [ ] **Step 5: Commit**

```
git add src/api/schemas.py src/api/render_api.py src/rendering/plan_sheet.py tests/test_plan_sheet_device_summary.py
git commit -F <msgfile>
```
Message: `feat: render_pdf threads jurisdiction conflicts + device-summary toggle (spec §4 task 3)`, `Refs #<issue>`.

---

### Task 4: Footer geometry — 3-box ⇄ 4-box

**Files:**
- Modify: `src/rendering/plan_sheet.py:1863-1878` (constants → geometry helper) and every consumer of `LEGEND_BOX_X` / `NOTES_BOX_X` / `TITLE_BLOCK_X` / `FOOTER_BOX_W` (grep them; they cluster in `_draw_legend` ~2207, the notes/sign-schedule drawer ~2560-2810, `_draw_structured_title_block` ~1935)
- Test: extend `tests/test_plan_sheet_device_summary.py`

**Interfaces:**
- Produces: `_FooterGeometry(box_w, legend_x, notes_x, device_x, title_x)` frozen dataclass and `_footer_geometry(include_device_summary: bool) -> _FooterGeometry` — Tasks 5-6 rely on these exact names.

- [ ] **Step 1: Write the failing test**

```python
def test_footer_geometry_three_and_four_box() -> None:
    from src.rendering.plan_sheet import MARGIN, PAGE_W, _footer_geometry

    g3 = _footer_geometry(include_device_summary=False)
    assert g3.device_x is None
    assert abs(g3.box_w - (PAGE_W - 2 * MARGIN - 2 * 12.0) / 3) < 0.01

    g4 = _footer_geometry(include_device_summary=True)
    assert g4.device_x is not None
    assert abs(g4.box_w - (PAGE_W - 2 * MARGIN - 3 * 12.0) / 4) < 0.01
    assert g4.legend_x < g4.notes_x < g4.device_x < g4.title_x
    # Right edge of the last box lands on the right margin.
    assert abs((g4.title_x + g4.box_w) - (PAGE_W - MARGIN)) < 0.01
```

- [ ] **Step 2: Run to verify failure**

Run: `pytest tests/test_plan_sheet_device_summary.py -v -k footer_geometry`
Expected: FAIL — `_footer_geometry` not defined.

- [ ] **Step 3: Implement**

Replace the constant block at lines 1867-1872 (keep `FOOTER_GUTTER`, `FOOTER_BOX_H`, `FOOTER_BOX_Y`; the three `_X` constants and `FOOTER_BOX_W` become the 3-box geometry's fields) with:

```python
FOOTER_GUTTER: float = 12.0
FOOTER_BOX_H: float = FOOTER_H - 16.0
FOOTER_BOX_Y: float = MARGIN


@dataclass(frozen=True)
class _FooterGeometry:
    """Footer-row box geometry.  ``device_x`` is None in the 3-box layout
    (device summary toggled off for a non-required jurisdiction)."""

    box_w: float
    legend_x: float
    notes_x: float
    device_x: float | None
    title_x: float


def _footer_geometry(include_device_summary: bool) -> _FooterGeometry:
    n = 4 if include_device_summary else 3
    w = (PAGE_W - 2 * MARGIN - (n - 1) * FOOTER_GUTTER) / n
    xs = [MARGIN + i * (w + FOOTER_GUTTER) for i in range(n)]
    if include_device_summary:
        return _FooterGeometry(w, xs[0], xs[1], xs[2], xs[3])
    return _FooterGeometry(w, xs[0], xs[1], None, xs[2])
```

(`from dataclasses import dataclass` — add to imports if absent.)

Thread it: `render_plan_sheet` computes `geom = _footer_geometry(include_device_summary)` once and passes `box_x`/`box_w` into the three existing drawers. Mechanical rule: each drawer gains `box_x: float` and `box_w: float` parameters; every internal reference to `LEGEND_BOX_X`/`NOTES_BOX_X`/`TITLE_BLOCK_X` becomes `box_x` and every `FOOTER_BOX_W` becomes `box_w`. Grep for stragglers afterward: `grep -n "LEGEND_BOX_X\|NOTES_BOX_X\|TITLE_BLOCK_X\|FOOTER_BOX_W" src/rendering/plan_sheet.py` must return zero hits outside `_footer_geometry`'s docstring/history comments.

- [ ] **Step 4: Run the full suite — this is the churn gate**

Run: `pytest`
Expected: PASS. Existing plan-sheet text tests (`tests/test_near_intersection_voice.py`, `tests/s630/test_ta10_flagger.py`, `tests/test_lanes_geometry.py`, `tests/test_rules.py`) must stay green — they assert text presence, which the narrower boxes must not truncate away. If any existing assertion string gets ellipsis-truncated by the 288 pt width, widen wrap allowances (e.g., `max_lines` 2→3 on the affected drawer), never shorten the asserted copy.

- [ ] **Step 5: Commit**

```
git add src/rendering/plan_sheet.py tests/test_plan_sheet_device_summary.py
git commit -F <msgfile>
```
Message: `refactor: footer geometry becomes 3/4-box parametric (spec §4 task 4)`, `Refs #<issue>`.

---

### Task 5: Draw the device summary box

**Files:**
- Modify: `src/rendering/plan_sheet.py` (new `_draw_device_summary` + call from `render_plan_sheet`; new import of `aggregate_device_rows`)
- Test: extend `tests/test_plan_sheet_device_summary.py`

**Interfaces:**
- Consumes: `aggregate_device_rows`, `AggregatedDeviceRow` (Task 1); `_FooterGeometry` (Task 4); existing `substitute_sign_description`, `cone_display_name`, `DEVICE_CATALOG`, `_wrap_to_width`, `_truncate_to_width`
- Produces: the rendered block; copy constants `_DEVICE_SUMMARY_TITLE`, `_BID_AUTHORITY_LINE` (Task 7's parity test greps these).

- [ ] **Step 1: Write the failing tests**

```python
def test_device_summary_block_renders_with_real_quantities() -> None:
    text = _pdf_text(copy.deepcopy(_SHOULDER_BODY))
    assert "TRAFFIC CONTROL DEVICE SUMMARY" in text
    assert "SEE DEVICE LIST (XLSX) FOR BID QUANTITIES." in text
    assert "TOTAL DEVICES" in text


def test_quantities_match_the_aggregation_not_constants() -> None:
    """Two zone lengths must show two different channelizer counts (spec §4.3)."""
    short_body = copy.deepcopy(_SHOULDER_BODY)
    short_body["workZoneLengthFt"] = 500
    long_body = copy.deepcopy(_SHOULDER_BODY)
    long_body["workZoneLengthFt"] = 5000
    assert _pdf_text(short_body) != _pdf_text(long_body)
    # Row-level check via the shared aggregator — implementer: validate each
    # body into a Scenario (reuse the exact idiom from tests/test_audit_endpoint.py),
    # run src.api.render_api._placements_for on it, then:
    #   for row in aggregate_device_rows(placements):
    #       assert str(row.quantity) in its sheet's extracted text


def test_flagger_station_quantity_comes_from_placements() -> None:
    """The §4.3 headline: flagger-station count is engine output, never 2-by-fiat.
    Uses the TA-10 fixture body (tests/fixtures/ta10_flagger/ta10_basic_flagger.json)."""
    body = json.loads(
        Path("tests/fixtures/ta10_flagger/ta10_basic_flagger.json").read_text()
    )
    # implementer: extract the scenario request from the fixture's shape (see
    # tests/s630/test_ta10_flagger.py for how the fixture maps to a request),
    # POST /render/pdf, and assert:
    #   n = number of FLAGGER_STATION placements from the generator
    #   f"FLAGGER STATION" in text and str(n) appears on that row
```

The two sketched tests MUST be completed into real assertions (the fixture-to-request mapping is documented in `tests/s630/test_ta10_flagger.py`); a plan placeholder is not a shipped placeholder.

- [ ] **Step 2: Run to verify failure**

Run: `pytest tests/test_plan_sheet_device_summary.py -v -k "device_summary_block or match_the_aggregation or flagger_station"`
Expected: FAIL — the title string isn't on the sheet yet.

- [ ] **Step 3: Implement `_draw_device_summary`**

Add near `_draw_legend` (~line 2207):

```python
_DEVICE_SUMMARY_TITLE: str = "TRAFFIC CONTROL DEVICE SUMMARY"
_BID_AUTHORITY_LINE: str = "SEE DEVICE LIST (XLSX) FOR BID QUANTITIES."


def _device_summary_cells(
    row: AggregatedDeviceRow, params: ScenarioParams
) -> tuple[str, str]:
    """(code, name) for one summary row — the same helpers that write the
    XLSX descriptions, so the two surfaces can never disagree on wording."""
    dt = row.device_type
    if dt == DeviceType.SIGN_GENERIC:
        if row.label is None:
            return ("—", "Construction sign (unlabeled)")
        code, human = substitute_sign_description(
            row.label, row.representative.station_ft, params
        )
        return (code, human if human != code else "")
    if dt == DeviceType.CONE:
        return ("—", cone_display_name(params.speed_mph))
    return ("—", DEVICE_CATALOG[dt].description)


def _draw_device_summary(
    c: canvas.Canvas,
    box_x: float,
    box_w: float,
    placements: list[DevicePlacement],
    params: ScenarioParams,
) -> None:
    """Spec §4.1: the on-sheet device summary — monochrome, hairline rules,
    quantities from aggregate_device_rows (the XLSX's aggregation), a bold
    totals row, and the bid-authority line so the sheet never competes with
    the spreadsheet."""
    rows = aggregate_device_rows(placements)

    # Frame — mirrors the other footer boxes.
    c.setLineWidth(1.0)
    c.setStrokeColor(colors.black)
    c.rect(box_x, FOOTER_BOX_Y, box_w, FOOTER_BOX_H)

    x = box_x + 8
    x_right = box_x + box_w - 8
    y = FOOTER_BOX_Y + FOOTER_BOX_H - 16

    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(colors.black)
    c.drawString(x, y, _DEVICE_SUMMARY_TITLE)
    y -= 12

    # Column header with a hairline underneath (no fills — mono-plotter safe).
    c.setFont("Helvetica-Bold", 6)
    c.drawString(x, y, "MUTCD")
    c.drawString(x + 44, y, "DEVICE")
    c.drawRightString(x_right, y, "QTY")
    y -= 3
    c.setLineWidth(0.5)
    c.line(x, y, x_right, y)
    y -= 9

    row_h = 9.0
    # Reserve room for totals + authority line (+ hairline pads).
    floor = FOOTER_BOX_Y + 34
    name_w = (x_right - 30) - (x + 44)

    c.setFont("Helvetica", 6.5)
    drawn = 0
    for row in rows:
        remaining = len(rows) - drawn
        # Honest overflow: if this row would leave no room for the rows
        # after it, print an explicit pointer instead of silently clipping.
        if y < floor + row_h and remaining > 1:
            c.setFont("Helvetica-Oblique", 6.5)
            c.drawString(x, y, f"+{remaining} MORE TYPES — SEE DEVICE LIST (XLSX)")
            y -= row_h
            break
        code, name = _device_summary_cells(row, params)
        c.setFont("Helvetica", 6.5)
        c.drawString(x, y, code)
        c.drawString(
            x + 44, y, _truncate_to_width(c, name, "Helvetica", 6.5, name_w)
        )
        c.drawRightString(x_right, y, str(row.quantity))
        y -= row_h
        drawn += 1

    y -= 2
    c.setLineWidth(1.0)
    c.line(x, y, x_right, y)
    y -= 10
    c.setFont("Helvetica-Bold", 7)
    c.drawString(x, y, "TOTAL DEVICES")
    c.drawRightString(x_right, y, str(len(placements)))
    y -= 11
    c.setFont("Helvetica-Oblique", 6)
    c.setFillColor(colors.HexColor("#333333"))
    c.drawString(x, y, _BID_AUTHORITY_LINE)
    c.setFillColor(colors.black)
```

Imports to add at the top of `plan_sheet.py`: `from src.rules.device_aggregation import AggregatedDeviceRow, aggregate_device_rows` (plus `cone_display_name`, `DEVICE_CATALOG`, `substitute_sign_description` if not already imported — grep first; the legend and off-page table likely import some already).

Call site in `render_plan_sheet`, alongside the other footer drawers:
```python
    if geom.device_x is not None:
        _draw_device_summary(c, geom.device_x, geom.box_w, placements, params)
```

- [ ] **Step 4: Run tests**

Run: `pytest tests/test_plan_sheet_device_summary.py -v` then full `pytest`
Expected: PASS.

- [ ] **Step 5: Visual QA (house rule 11 — rendered artifacts)**

Generate one shoulder and one flagger PDF locally (reuse the `__main__` block pattern in `src/export/device_list.py`), open them, and confirm: four boxes aligned, no text collision at 288 pt, `#333333` gray ≥ WCAG AA against white (it is — 12.6:1), totals row bold, table readable in grayscale print preview.

- [ ] **Step 6: Commit**

```
git add src/rendering/plan_sheet.py tests/test_plan_sheet_device_summary.py
git commit -F <msgfile>
```
Message: `feat: on-sheet device summary driven by shared aggregation (spec §4.1/4.3, task 5)`, `Refs #<issue>`.

---

### Task 6: † conflict footnote in the NOTES box

**Files:**
- Modify: `src/rendering/plan_sheet.py` (the notes/sign-schedule drawer, after the Reference line at ~2780)
- Test: extend `tests/test_plan_sheet_device_summary.py`

**Interfaces:**
- Consumes: `jurisdiction_conflicts` (Task 3 threading), `_wrap_to_width`

- [ ] **Step 1: Write the failing tests**

```python
def test_conflict_footnote_renders_from_parker_record() -> None:
    body = copy.deepcopy(_SHOULDER_BODY)
    body["jurisdiction_key"] = "parker"
    text = _pdf_text(body)
    assert "†" in text
    assert "9:00–3:30" in text          # rendered (conservative) value
    assert "8:30–3:00" in text          # the disagreeing source's value
    assert "adopted manual" in text     # verdict text (spec §4.2)


def test_no_jurisdiction_means_no_dagger() -> None:
    text = _pdf_text(copy.deepcopy(_SHOULDER_BODY))
    assert "†" not in text
```

(Implementer: confirm pypdfium2 extracts `†` and `–` from Helvetica; if the glyphs come back as different codepoints, assert on the escaped form actually extracted — adjust the assertion, not the rendered copy.)

- [ ] **Step 2: Run to verify failure**

Run: `pytest tests/test_plan_sheet_device_summary.py -v -k conflict`
Expected: first test FAILS (no † on sheet).

- [ ] **Step 3: Implement**

Thread `jurisdiction_conflicts` into the notes drawer (new parameter, default `None`). After the Reference line block (~line 2786), add:

```python
    if jurisdiction_conflicts:
        note_w = width - 16.0
        floor_y = FOOTER_BOX_Y + 8
        c.setFont("Helvetica-Oblique", 6)
        c.setFillColor(colors.black)
        for i, cf in enumerate(jurisdiction_conflicts):
            srcs = "; ".join(
                f"{s['doc']}: {s['value']}" for s in cf.get("sources", [])
            )
            note = f"† {cf['label'].upper()} — {cf['verdict']} ({srcs})"
            lines = _wrap_to_width(c, note, "Helvetica-Oblique", 6, note_w, max_lines=2)
            needed = len(lines) * layout.footer_pads[1]
            if y[0] - needed < floor_y and i < len(jurisdiction_conflicts) - 1:
                # Honest aggregate when the box is out of room — never a
                # silent drop (rule 10).
                y[0] -= layout.footer_pads[1]
                c.drawString(
                    x,
                    y[0],
                    f"† {len(jurisdiction_conflicts) - i} ADOPTED-SOURCE CONFLICTS — "
                    "CONSERVATIVE VALUES RENDERED; SEE JURISDICTION PANEL.",
                )
                break
            for line in lines:
                y[0] -= layout.footer_pads[1]
                c.drawString(x, y[0], line)
```

(`x`, `y`, `width`, `layout` are the drawer's existing locals — match the Reference-line code's idiom at 2780-2807 exactly.)

- [ ] **Step 4: Run tests**

Run: `pytest tests/test_plan_sheet_device_summary.py -v` then full `pytest`
Expected: PASS.

- [ ] **Step 5: Commit**

```
git add src/rendering/plan_sheet.py tests/test_plan_sheet_device_summary.py
git commit -F <msgfile>
```
Message: `feat: † source-conflict footnote on the printed sheet (spec §4.2, task 6)`, `Refs #<issue>`.

---

### Task 7: Cross-surface parity + required-jurisdiction override tests

**Files:**
- Create: `tests/s630/test_cross_surface_device_summary.py`
- Test-only task (follows `tests/s630/test_cross_surface_near_intersection.py` conventions).

- [ ] **Step 1: Write the tests**

```python
# tests/s630/test_cross_surface_device_summary.py
"""Spec §4 cross-surface proof: the sheet's summary IS the XLSX's rows,
and required-on-sheet jurisdictions cannot toggle it off.

Parity here is against CURRENT-XLSX behavior by design (Ryan ruling,
2026-07-21, issue #151): jurisdiction count-deltas are not yet applied to
the shared aggregation, so the on-screen breakdown may differ when one
fires.  #151 moves the deltas into the shared helper for all three
surfaces; it removes this caveat."""
from __future__ import annotations

import copy

from tests.test_plan_sheet_device_summary import _SHOULDER_BODY, _pdf_text, client


def _aggregated_rows_for(body):
    """Build placements exactly as the render endpoints do and aggregate."""
    from src.api.render_api import _placements_for
    from src.api.schemas import Scenario
    from src.rules.device_aggregation import aggregate_device_rows
    from pydantic import TypeAdapter

    scenario = TypeAdapter(Scenario).validate_python(body)
    placements, params, _s, _n = _placements_for(scenario)
    return aggregate_device_rows(placements), params, placements


def test_every_xlsx_row_quantity_appears_on_sheet() -> None:
    body = copy.deepcopy(_SHOULDER_BODY)
    rows, params, placements = _aggregated_rows_for(body)
    text = _pdf_text(body)
    for row in rows:
        assert str(row.quantity) in text, (row.device_type, row.label)
    assert str(len(placements)) in text  # totals row


def test_required_jurisdiction_ignores_toggle_off() -> None:
    body = copy.deepcopy(_SHOULDER_BODY)
    body["jurisdiction_key"] = "loveland"
    body["meta"]["includeDeviceSummary"] = False
    assert "TRAFFIC CONTROL DEVICE SUMMARY" in _pdf_text(body)


def test_optional_jurisdiction_honors_toggle_off() -> None:
    body = copy.deepcopy(_SHOULDER_BODY)
    body["jurisdiction_key"] = "cdot"
    body["meta"]["includeDeviceSummary"] = False
    assert "TRAFFIC CONTROL DEVICE SUMMARY" not in _pdf_text(body)


def test_wave2_gate_trio_all_render_the_block() -> None:
    """The BLOCKED.md hard gate, as an executable statement."""
    for key in ("castle_rock", "loveland", "thornton"):
        body = copy.deepcopy(_SHOULDER_BODY)
        body["jurisdiction_key"] = key
        body["meta"]["includeDeviceSummary"] = False  # even opted out
        assert "TRAFFIC CONTROL DEVICE SUMMARY" in _pdf_text(body), key
```

(`Scenario` may be a discriminated-union `TypeAdapter` already exported somewhere — reuse the exact validation idiom from `tests/test_audit_endpoint.py` instead of inventing one. If quantity-substring matching proves too loose — a "2" appears everywhere — tighten to per-row regex `rf"{code}\s.*{qty}"` on the extracted text.)

- [ ] **Step 2: Run**

Run: `pytest tests/s630/test_cross_surface_device_summary.py -v` then the FULL suite `pytest` and the frontend suite (`cd conestruct/site && npx vitest run`) — the frontend is untouched but must stay green.
Expected: PASS everywhere; backend count 1535 + new tests.

- [ ] **Step 3: Commit**

```
git add tests/s630/test_cross_surface_device_summary.py
git commit -F <msgfile>
```
Message: `test: cross-surface parity + wave-2 gate executable proof (spec §4 task 7)`, `Refs #<issue>`.

---

## After the tasks (report, don't do)

- **Ryan merges `--ff-only`, pushes, then `modal deploy modal_app.py`** (backend change — Vercel alone does NOT ship this). Verify `/healthz` sha == HEAD, then browser smoke on conestruct.com: generate a plan with and without `jurisdiction_key=parker`, download the PDF, eyeball the four-box footer, the quantities against the XLSX, and the † line.
- **BLOCKED.md hard-gate section** gets its "satisfied" note only after the live smoke passes (rule 6) — separate commit.
- **Known seam to flag in the report (out of scope here):** `render_device_breakdown` applies jurisdiction `apply_count_deltas` to its rows; the XLSX — and therefore this on-sheet summary, per the one-source-of-truth requirement — does not. When a count delta fires (e.g., an arrow-board add), the on-screen breakdown can disagree with both printed surfaces. Pre-existing, now more visible; needs its own issue + ruling (apply deltas to the shared aggregation for all three surfaces, as a value-changing fix in its own PR per rule 5).
