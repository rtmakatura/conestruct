"""Jurisdiction layer: load, validate, and evaluate per-jurisdiction rules.

Generalizes the jurisdiction-aware lookup pattern established by
``tables.py``'s CDOT buffer handling (a keyed override table consulted by
the engine, falling back to the MUTCD baseline) into a data-driven layer:
one JSON record per jurisdiction under ``data/jurisdictions/``, validated
against ``data/jurisdiction.schema.json``, evaluated against the plan.

Design rules (phase1-backend-spec §1–§3):

* The JSON records are the single source of truth for jurisdiction facts;
  this module never invents a value.  A silent axis is an absent key and
  evaluates to the empty state, never a default.
* Triggers are evaluated against the plan's street class, closure kinds,
  and night flag.  A trigger constraint whose input is missing (e.g. the
  scenario carries no ``street_class`` but the trigger is class-scoped)
  ABSTAINS as ``"unknown"`` — it neither fires nor disappears.  A trigger
  carrying a free-form ``condition`` the engine cannot evaluate is
  ``"conditional"``: surfaced as a chip, never applied to device counts.
* Count-affecting effects modify the shared aggregated device rows through
  one pipeline (``aggregate_device_rows_with_deltas`` /
  ``apply_count_deltas_structured``), so the screen breakdown, the XLSX bid
  document, and the on-sheet summary shift together — no post-hoc frontend
  math (spec §3.2, issue #151).
* Every emitted record carries its ``source`` object through verbatim so
  the UI's provenance popovers read the same citation the corpus holds.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass, field
from datetime import date
from functools import lru_cache
from pathlib import Path
from typing import Any

import jsonschema

from src.rules.device_aggregation import AggregatedDeviceRow, aggregate_device_rows
from src.rules.devices import DeviceType

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
SCHEMA_PATH = REPO_ROOT / "data" / "jurisdiction.schema.json"
DATA_DIR = REPO_ROOT / "data" / "jurisdictions"

# The urban low/high-speed breakpoint fallback (Ryan ruling 2026-07-20,
# BLOCKED.md): a jurisdiction without a documented determination uses the
# CDOT determination via the governing chain, and outputs must label it
# "per CDOT baseline" — never as the city's own rule.
CDOT_BASELINE_BREAKPOINT_MPH = 45
CDOT_BASELINE_LABEL = "per CDOT baseline"


class UnknownJurisdictionError(KeyError):
    """Raised for a jurisdiction_key with no data file — a clear 4xx, not a fallback."""


@lru_cache(maxsize=1)
def _schema() -> dict[str, Any]:
    with open(SCHEMA_PATH, encoding="utf-8") as f:
        return json.load(f)


def available_jurisdictions() -> list[str]:
    """Keys with a data file on disk, sorted."""
    if not DATA_DIR.is_dir():
        return []
    return sorted(p.stem for p in DATA_DIR.glob("*.json"))


@lru_cache(maxsize=64)
def load_jurisdiction(key: str) -> dict[str, Any]:
    """Load and schema-validate one jurisdiction record.

    Raises:
        UnknownJurisdictionError: no ``data/jurisdictions/{key}.json``.
        jsonschema.ValidationError: the file does not match the schema
            (CI validates every file, so this firing in production means
            a deploy shipped an invalid record — fail loudly).
    """
    path = DATA_DIR / f"{key}.json"
    if not path.is_file():
        raise UnknownJurisdictionError(
            f"unknown jurisdiction {key!r} — no data file; "
            f"available: {', '.join(available_jurisdictions())}"
        )
    with open(path, encoding="utf-8") as f:
        record = json.load(f)
    jsonschema.validate(record, _schema())
    return record


def urban_high_speed_breakpoint(record: dict[str, Any]) -> tuple[int, str]:
    """The jurisdiction's urban low/high-speed breakpoint and its provenance label.

    Returns ``(breakpoint_mph, label)``.  ``label`` is the jurisdiction
    name when the determination is documented, or the "per CDOT baseline"
    marker when the engine falls back — outputs must show that label.
    """
    bp = record.get("geometry", {}).get("urban_high_speed_breakpoint_mph")
    if bp is not None:
        return int(bp), record["name"]
    return CDOT_BASELINE_BREAKPOINT_MPH, CDOT_BASELINE_LABEL


# ---------------------------------------------------------------------------
# Evaluation context
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class WorkSchedule:
    """Mirror of the Scenario ``schedule`` extension (spec §3.1)."""

    date_mode: str = "tbd"  # single | range | tbd
    work_date: date | None = None
    work_date_end: date | None = None
    start_time: float | None = None  # decimal hours, 0..24
    end_time: float | None = None


@dataclass(frozen=True)
class PlanContext:
    """What the engine knows about the plan, for trigger/hours evaluation.

    ``closures`` uses the schema's closureKind vocabulary.  ``None`` on
    any field means "not provided" — class-scoped rules abstain rather
    than guess (rule 10).
    """

    street_class: str | None = None  # local | collector | arterial
    closures: frozenset[str] = field(default_factory=frozenset)
    night: bool | None = None
    duration_days: float | None = None
    schedule: WorkSchedule | None = None


def context_for_closure_type(
    closure_type: str,
    *,
    street_class: str | None,
    night: bool | None,
    schedule: WorkSchedule | None = None,
    duration_days: float | None = None,
) -> PlanContext:
    """Build a PlanContext from the engine's ``ScenarioParams.closure_type``."""
    closures = {"shoulder"} if closure_type == "shoulder" else {"lane"}
    return PlanContext(
        street_class=street_class,
        closures=frozenset(closures),
        night=night,
        duration_days=duration_days,
        schedule=schedule,
    )


# ---------------------------------------------------------------------------
# Trigger evaluation (spec §2.5)
# ---------------------------------------------------------------------------

FIRES = "fires"
ABSTAINS = "abstains"  # a constraint positively does not match
UNKNOWN = "unknown"  # a constraint needs an input the plan didn't provide
CONDITIONAL = "conditional"  # free-form condition the engine cannot evaluate


def evaluate_trigger(trigger: dict[str, Any] | None, ctx: PlanContext) -> str:
    """Evaluate one trigger object against the plan context.

    Order matters: a positive mismatch (ABSTAINS) beats missing input
    (UNKNOWN) beats an unevaluable free-form condition (CONDITIONAL).
    A record with no trigger applies unconditionally (FIRES).
    """
    if not trigger:
        return FIRES

    unknown = False

    classes = trigger.get("classes")
    if classes:
        if ctx.street_class is None:
            unknown = True
        elif ctx.street_class not in classes:
            return ABSTAINS

    closure = trigger.get("closure")
    if closure and not (ctx.closures & set(closure)):
        return ABSTAINS

    night = trigger.get("night")
    if night is not None:
        if ctx.night is None:
            unknown = True
        elif ctx.night != night:
            return ABSTAINS

    min_days = trigger.get("min_duration_days")
    if min_days is not None:
        if ctx.duration_days is None:
            unknown = True
        elif ctx.duration_days < min_days:
            return ABSTAINS

    if unknown:
        return UNKNOWN
    if trigger.get("condition"):
        return CONDITIONAL
    return FIRES


# ---------------------------------------------------------------------------
# Hours evaluation (spec §2.3, §3.2)
# ---------------------------------------------------------------------------


def _window_applies(window: dict[str, Any], ctx: PlanContext, day_kind: str) -> str:
    """FIRES / ABSTAINS / UNKNOWN for one hours window vs. the context."""
    if window["days"] != "all" and window["days"] != day_kind:
        return ABSTAINS
    classes = window.get("classes")
    if classes:
        if ctx.street_class is None:
            return UNKNOWN
        if ctx.street_class not in classes:
            return ABSTAINS
    return FIRES


def _overlap_hours(a0: float, a1: float, b0: float, b1: float) -> float:
    return max(0.0, min(a1, b1) - max(a0, b0))


def evaluate_hours(record: dict[str, Any], ctx: PlanContext) -> dict[str, Any]:
    """Evaluate the plan's schedule against the jurisdiction's hours block.

    Returns the ``hours_eval`` shape from spec §3.2:
    ``{status, violations, exposure_estimate_cents?}``.  ``status`` is
    ``unknown`` when the jurisdiction publishes no windows, the plan has
    no schedule, or a class-scoped window can't be resolved.
    """
    hours = record.get("hours", {})
    windows = hours.get("windows", [])
    if hours.get("shape") == "none" or not windows:
        return {
            "status": "unknown",
            "violations": [],
            "note": "jurisdiction publishes no work-hour windows",
        }
    sched = ctx.schedule
    if sched is None or sched.start_time is None or sched.end_time is None:
        return {
            "status": "unknown",
            "violations": [],
            "note": "no work schedule provided",
        }

    day_note = None
    if sched.work_date is not None:
        day_kind = "weekday" if sched.work_date.weekday() < 5 else "weekend"
    else:
        day_kind = "weekday"
        day_note = "work date TBD — weekday windows assumed (conservative)"

    s0, s1 = sched.start_time, sched.end_time
    violations: list[dict[str, Any]] = []
    indeterminate = False
    applicable_work_windows: list[dict[str, Any]] = []

    for w in windows:
        applies = _window_applies(w, ctx, day_kind)
        if applies == UNKNOWN:
            indeterminate = True
            continue
        if applies == ABSTAINS:
            continue
        if w["kind"] == "ban":
            ov = _overlap_hours(s0, s1, w["start"], w["end"])
            if ov > 0:
                violations.append(
                    {
                        "kind": "ban_window_overlap",
                        "window": {"start": w["start"], "end": w["end"], "days": w["days"]},
                        "overlap_hours": round(ov, 2),
                        "note": w.get("note"),
                        "source": w["source"],
                    }
                )
        else:
            applicable_work_windows.append(w)

    # Work-window shapes: the schedule must sit inside every applicable
    # work window (nested envelopes are cumulative constraints).
    for w in applicable_work_windows:
        outside = round(max(0.0, w["start"] - s0) + max(0.0, s1 - w["end"]), 2)
        if outside > 0:
            violations.append(
                {
                    "kind": "outside_work_window",
                    "window": {"start": w["start"], "end": w["end"], "days": w["days"]},
                    "outside_hours": outside,
                    "note": w.get("note"),
                    "source": w["source"],
                }
            )

    if violations:
        status = "outside"
    elif indeterminate:
        status = "unknown"
    else:
        status = "inside"

    result: dict[str, Any] = {"status": status, "violations": violations}
    if day_note:
        result["note"] = day_note

    exposure = _exposure_estimate_cents(record, ctx, violations, sched)
    if exposure is not None:
        result["exposure_estimate_cents"] = exposure
    return result


def _schedule_day_count(sched: WorkSchedule) -> int:
    if (
        sched.date_mode == "range"
        and sched.work_date is not None
        and sched.work_date_end is not None
        and sched.work_date_end >= sched.work_date
    ):
        return (sched.work_date_end - sched.work_date).days + 1
    return 1


def _exposure_estimate_cents(
    record: dict[str, Any],
    ctx: PlanContext,
    violations: list[dict[str, Any]],
    sched: WorkSchedule,
) -> int | None:
    """Multiply hours violations by the jurisdiction's hours_violation meters.

    Uses real engine durations (spec §1.1 #10/log #12–13): overlap hours
    from the violation records x the meter's unit x the scheduled day
    count.  Returns None when there is nothing to price (no violations,
    or no matching meter).
    """
    meters = [m for m in record.get("meters", []) if m["kind"] == "hours_violation"]
    if not meters or not violations:
        return None

    def meter_for_class(street_class: str | None) -> dict[str, Any] | None:
        for m in meters:
            classes = m.get("classes")
            if not classes:
                return m
            if street_class is not None and street_class in classes:
                return m
        return None

    meter = meter_for_class(ctx.street_class)
    if meter is None or "amount_cents" not in meter:
        return None

    hours_in_violation = sum(
        v.get("overlap_hours", 0.0) + v.get("outside_hours", 0.0) for v in violations
    )
    if hours_in_violation <= 0:
        return None
    if meter["unit"] == "half_hour":
        units = math.ceil(hours_in_violation * 2)
    elif meter["unit"] == "hour":
        units = math.ceil(hours_in_violation)
    else:  # day / occurrence meters price whole days or events
        units = 1
    return units * meter["amount_cents"] * _schedule_day_count(sched)


# ---------------------------------------------------------------------------
# Permit block (spec §3.2)
# ---------------------------------------------------------------------------


def _suggest_tier(record: dict[str, Any], ctx: PlanContext) -> tuple[str | None, str]:
    """Suggest a permit tier where the jurisdiction's tier split is machine-decidable.

    Only the Minor/Major pair keyed to the TC footprint (Loveland's
    structure) is decidable: Major when the plan closes a lane (or runs a
    detour/full closure) on an arterial, Minor otherwise.  Jurisdictions
    whose tier is assigned by a reviewer (e.g. Westminster's Traffic
    Engineer classification) return None with the reason.
    """
    tiers = record.get("permits", {}).get("tiers", [])
    labels = {t["label"].lower(): t for t in tiers}
    minor = next((t for k, t in labels.items() if k.startswith("minor")), None)
    major = next((t for k, t in labels.items() if k.startswith("major")), None)
    if not (minor and major):
        if tiers:
            return None, "tier assignment is not machine-decidable for this jurisdiction"
        return None, "jurisdiction publishes no permit tiers"
    if ctx.street_class is None:
        return None, "street class not provided — cannot resolve the Minor/Major split"
    if ctx.street_class == "arterial" and (ctx.closures & {"lane", "full", "detour"}):
        return major["label"], f"{major['label']}: {major.get('definition', '')}".strip()
    return minor["label"], f"{minor['label']}: {minor.get('definition', '')}".strip()


def _tier_fee_estimate_cents(record: dict[str, Any], tier_label: str | None) -> int | None:
    if tier_label is None:
        return None
    for item in record.get("fees", {}).get("items", []):
        if item["label"].lower().startswith(tier_label.lower()):
            return item["amount_cents"]
    return None


# ---------------------------------------------------------------------------
# Deltas, chips, and the full evaluation (spec §3.2)
# ---------------------------------------------------------------------------


def _chip(rec: dict[str, Any], status: str) -> dict[str, Any]:
    chip = dict(rec)
    chip["status"] = status
    return chip


def _collect_conflicts(node: Any, out: list[dict[str, Any]]) -> None:
    if isinstance(node, dict):
        c = node.get("conflict")
        if isinstance(c, dict) and c.get("sources") and c not in out:
            out.append(c)
        for v in node.values():
            _collect_conflicts(v, out)
    elif isinstance(node, list):
        for v in node:
            _collect_conflicts(v, out)


ON_SHEET_DEVICE_SUMMARY = "on_sheet_device_summary"


def collect_conflicts(record: dict[str, Any]) -> list[dict[str, Any]]:
    """Every ``conflict`` block in ``record`` (spec §4.2 — the printed
    sheet's † footnote source)."""
    out: list[dict[str, Any]] = []
    _collect_conflicts(record, out)
    return out


def requires_on_sheet_summary(record: dict[str, Any]) -> bool:
    """True when an admin delta obliges the on-sheet device summary (spec
    §4.1) — the toggle cannot disable the block for these jurisdictions."""
    return any(
        d.get("effect", {}).get("requires") == ON_SHEET_DEVICE_SUMMARY
        for d in record.get("deltas", [])
    )


def _any_provisional(node: Any) -> bool:
    if isinstance(node, dict):
        if node.get("status") == "provisional" and "doc" in node:
            return True
        return any(_any_provisional(v) for v in node.values())
    if isinstance(node, list):
        return any(_any_provisional(v) for v in node)
    return False


def evaluate(record: dict[str, Any], ctx: PlanContext) -> dict[str, Any]:
    """Full jurisdiction evaluation — the ``jurisdiction`` results block (spec §3.2)."""
    applied_deltas: list[dict[str, Any]] = []
    for delta in record.get("deltas", []):
        verdict = evaluate_trigger(delta.get("trigger"), ctx)
        if verdict in (FIRES, CONDITIONAL, UNKNOWN):
            applied_deltas.append(_chip(delta, verdict))

    chips: dict[str, list[dict[str, Any]]] = {"personnel": [], "device": [], "hazard": []}
    for rec in record.get("personnel", []):
        verdict = evaluate_trigger(rec.get("trigger"), ctx)
        if verdict != ABSTAINS:
            chips["personnel"].append(_chip(rec, verdict))
    for rec in record.get("devices", []):
        verdict = evaluate_trigger(rec.get("trigger"), ctx)
        if verdict != ABSTAINS:
            chips["device"].append(_chip(rec, verdict))
    meters_by_kind: dict[str, dict[str, Any]] = {}
    for m in record.get("meters", []):
        meters_by_kind.setdefault(m["kind"], m)
    for rec in record.get("hazards", []):
        verdict = evaluate_trigger(rec.get("trigger"), ctx)
        if verdict == ABSTAINS:
            continue
        chip = _chip(rec, verdict)
        meter = meters_by_kind.get(rec.get("meter_kind", ""))
        if meter:
            # The chip's dollar figure comes from the meter list — the
            # single generalized pricing source (spec §2.4).
            chip["meter"] = meter
        chips["hazard"].append(chip)

    tier, tier_reason = _suggest_tier(record, ctx)
    permit: dict[str, Any] = {
        "tier_suggested": tier,
        "tier_reason": tier_reason,
        "tiers": record.get("permits", {}).get("tiers", []),
        "notes": record.get("permits", {}).get("notes", []),
        "multi_agency": record.get("permits", {}).get("multi_agency", []),
        "leads": record.get("leads", []),
        "notices": record.get("notices", []),
        "onsite": record.get("onsite", {"items": [], "digital_ok": None}),
    }
    fee = _tier_fee_estimate_cents(record, tier)
    if fee is not None:
        permit["fee_estimate_cents"] = fee

    conflicts: list[dict[str, Any]] = []
    _collect_conflicts(record, conflicts)

    return {
        "key": record["key"],
        "name": record["name"],
        "tcp_term": record["tcp_term"],
        "row_term": record["row_term"],
        # Display sections passed through verbatim so the frontend renders
        # (never recomputes) the record: chain/authority for the context
        # bar, hours windows for the band display (the frontend derives
        # segments from these semantic windows — spec §1.1 #3), fees for
        # the FYI panel, meters for the metered badge.
        "authority": record["authority"],
        "chain": record["chain"],
        "class_required": record["class_required"],
        "classification_map_url": record["classification_map_url"],
        "hours": record["hours"],
        "fees": record["fees"],
        "meters": record.get("meters", []),
        "applied_deltas": applied_deltas,
        "chips": chips,
        "hours_eval": evaluate_hours(record, ctx),
        "permit": permit,
        "conflicts": conflicts,
        "provisional": _any_provisional(record),
    }


# ---------------------------------------------------------------------------
# Count-effect application (spec §3.2 — same pipeline, no frontend math)
# ---------------------------------------------------------------------------

# Display names for jurisdiction-required devices that may not exist in
# the baseline layout.  Keys are the data files' effect.device ids.
_JURISDICTION_DEVICE_DISPLAY: dict[str, str] = {
    "arrow_board": "Arrow Board",
    "arrow_board_type_c": "Arrow Board (Type C)",
    "arrow_panel": "Arrow Panel",
    "drum": "Plastic Drum",
    "vertical_panel": "Vertical Panel",
    "no_parking_sign": "No Parking Sign (R7-series)",
    "flashing_barricade": "Flashing Barricade",
    "lighted_barricade": "Lighted Barricade",
    "type_1_barrier": "Type 1 Barrier",
    "advance_warning_signs": "Advance Warning Signs",
}


def _display_name(device_id: str) -> str:
    return _JURISDICTION_DEVICE_DISPLAY.get(device_id, device_id.replace("_", " ").title())


# Jurisdiction ``effect.device`` id -> catalog DeviceType, so a fired
# ``add_device`` delta tops up (or adds) the right aggregated row and the
# XLSX bid line can source a real CDOT pay item + unit.  Corpus-backed and
# deliberately conservative: only device ids that map to ONE catalog device
# with ONE pay item are listed.  Ids like ``advance_warning_signs`` (a set
# of W-series signs billed per SF, no single pay item) are intentionally
# absent — they render as an honest, pay-item-less jurisdiction-required
# row rather than being force-fit to a wrong pay item (rule 10, and the
# 2026-07-22 ruling on issue #151).
_DELTA_DEVICE_TYPE: dict[str, DeviceType] = {
    "arrow_board": DeviceType.ARROW_BOARD,
    "arrow_board_type_c": DeviceType.ARROW_BOARD,
    "arrow_panel": DeviceType.ARROW_BOARD,
    "drum": DeviceType.DRUM,
}


def _iter_fired_count_adds(applied_deltas: list[dict[str, Any]]):
    """Yield ``(device_id, qty, source)`` for every fired count add-device delta.

    The single gate for count-effect application (issue #151): only
    ``fires``-status ``count``-severity deltas whose effect is a concrete
    ``add_device`` / ``add_accessory`` change quantities.  Conditional and
    unknown deltas surface elsewhere in the jurisdiction block but never
    touch device counts (rule 10 — no silently-guessed counts).
    """
    for delta in applied_deltas:
        if delta.get("severity") != "count" or delta.get("status") != FIRES:
            continue
        effect = delta.get("effect", {})
        if effect.get("op") not in ("add_device", "add_accessory"):
            continue
        device_id = effect.get("device")
        if not device_id:
            continue
        yield device_id, effect.get("qty", 1), delta["source"]


def apply_count_deltas_structured(
    rows: list[AggregatedDeviceRow], applied_deltas: list[dict[str, Any]]
) -> list[AggregatedDeviceRow]:
    """Apply fired count deltas to the shared aggregated rows (issue #151).

    The single count-delta application, shared by the on-screen breakdown,
    the XLSX bid document, and the on-sheet device summary (spec §4 target
    state: one aggregation path, deltas applied once).

    Semantics (unchanged from the retired dict path): an ``add_device``
    delta REQUIRES the device — the row set must end with at least ``qty``
    (default 1) of it.  A matching row is topped up only if it carries
    fewer; a real topped-up row keeps its catalog identity (``device_type``
    / naming) and just gains the jurisdiction provenance.  A device with no
    matching baseline row is appended as a delta-only row: mapped ids carry
    their ``DeviceType`` (so the bid line gets a real pay item), unmapped
    ids carry ``device_type=None`` and only their jurisdiction display name.

    Matching is by ``DeviceType`` (not display string), so a delta and its
    baseline row can never miss each other on a naming mismatch.
    """
    out = list(rows)
    for device_id, qty, source in _iter_fired_count_adds(applied_deltas):
        dt = _DELTA_DEVICE_TYPE.get(device_id)
        match_idx = None
        if dt is not None:
            match_idx = next(
                (i for i, r in enumerate(out) if r.device_type == dt and r.label is None),
                None,
            )
        if match_idx is not None:
            r = out[match_idx]
            out[match_idx] = r._replace(
                quantity=max(r.quantity, qty),
                jurisdiction_required=True,
                jurisdiction_source=source,
            )
        else:
            out.append(
                AggregatedDeviceRow(
                    device_type=dt,
                    label=None,
                    quantity=qty,
                    representative=None,
                    jurisdiction_required=True,
                    jurisdiction_source=source,
                    display_override=_display_name(device_id),
                )
            )
    return out


def aggregate_device_rows_with_deltas(
    placements: list, applied_deltas: list[dict[str, Any]] | None
) -> list[AggregatedDeviceRow]:
    """Aggregate placements, then apply any fired jurisdiction count deltas.

    The one entry point all three device surfaces call so they can never
    disagree.  With ``applied_deltas`` empty or ``None`` this is exactly
    ``aggregate_device_rows`` — zero change for a scenario with no firing
    delta, which is the behavior-preservation contract (rule 5).
    """
    rows = aggregate_device_rows(placements)
    if not applied_deltas:
        return rows
    return apply_count_deltas_structured(rows, applied_deltas)
