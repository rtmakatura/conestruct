"""FastAPI service that renders MHT plan packages from a Scenario JSON.

Three endpoints, one body shape, three file types out:

  POST /render/pdf       -> application/pdf
  POST /render/xlsx      -> application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
  POST /render/markdown  -> text/markdown

Each endpoint runs the same pipeline:
    scenario_to_call -> generator -> renderer -> bytes.

Auth: ``Authorization: Bearer ${RENDER_API_SECRET}`` header.  The secret
is shared between this service (deployed on Modal) and the Next.js API
routes that proxy to it.
"""

from __future__ import annotations

import math
import os
import tempfile
from collections import Counter
from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import Any

import sentry_sdk
from fastapi import FastAPI, HTTPException, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration

from src.api.audit import _compute_step_count, audit_projection, build_audit_trail
from src.api.replication_snapshot import build_snapshot_markdown
from src.api.schemas import (
    Scenario,
    _map_road_type,
    scenario_to_call,
)
from src.export.device_list import export_device_list
from src.export.quote_generator import generate_quote
from src.narrative.crew_narrative import (
    generate_crew_narrative,
    generate_crew_narrative_pdf,
)
from src.rendering.audit_blocks import render_audit_pdf
from src.rendering.plan_sheet import render_plan_sheet
from src.rules.corridor import build_corridor
from src.rules.devices import DeviceType, cone_display_name, device_row_sort_key
from src.rules.jurisdiction import (
    UnknownJurisdictionError,
    apply_count_deltas,
    context_for_closure_type,
    load_jurisdiction,
)
from src.rules.jurisdiction import (
    WorkSchedule as JurisdictionWorkSchedule,
)
from src.rules.jurisdiction import (
    evaluate as evaluate_jurisdiction,
)
from src.rules.night_adjustments import apply_night_adjustments
from src.rules.sign_codes import schedule_key, substitute_sign_description
from src.rules.site_adjustments import apply_site_adjustments
from src.rules.site_detection import detect_along_corridor, detect_site_conditions
from src.rules.spacing import (
    advance_warning_spacing,
    buffer_space,
    device_spacing_in_taper,
    downstream_taper_length,
    one_lane_two_way_device_spacing,
    one_lane_two_way_taper_length,
    shoulder_taper_length,
    taper_length,
)
from src.rules.validators import DevicePlacement, ScenarioParams, validate_corridor_geometry

ENV_SECRET_VAR = "RENDER_API_SECRET"

# Mirror of conestruct/site/lib/scenarios/index.ts ENABLED_SCENARIO_KINDS.
# Kinds enable as their generators pass validation against the CDOT
# S-630 typical sheets.  Adding a kind here re-enables it on the
# server; the TS constant must match.
#   * shoulder — S-630-1 Cases 11/11b/26/27 (Phase 5 harness, tests/s630/)
#   * flagger_lane_closure — MUTCD TA-10 + S-630-1 Cases 17/42
#     (PR 3 gate flip; harness at tests/s630/test_ta10_flagger.py)
ENABLED_SCENARIOS: frozenset[str] = frozenset({"shoulder", "flagger_lane_closure"})


def _drop_expected_http_errors(
    event: dict[str, Any], hint: dict[str, Any]
) -> dict[str, Any] | None:
    """Drop intentional 4xx HTTPExceptions before they reach Sentry.

    Validator 400s (geometry_validation_failed, gated scenario kinds)
    and any other ``HTTPException`` with ``status_code < 500`` are
    expected user-facing errors, not alertable backend failures.  Only
    5xx and unhandled exceptions should generate Sentry events.
    """
    exc_info = hint.get("exc_info")
    if exc_info:
        exc = exc_info[1]
        if isinstance(exc, HTTPException) and exc.status_code < 500:
            return None
    return event


_SENTRY_DSN = os.environ.get("SENTRY_DSN")
if _SENTRY_DSN:
    sentry_sdk.init(
        dsn=_SENTRY_DSN,
        integrations=[StarletteIntegration(), FastApiIntegration()],
        traces_sample_rate=0.0,
        send_default_pii=False,
        before_send=_drop_expected_http_errors,
    )

app = FastAPI(title="Conestruct render service", version="0.1.0")


def _sanitize_non_finite(obj: Any) -> Any:
    """Replace non-finite floats (inf/-inf/nan) with their string form."""
    if isinstance(obj, float) and not math.isfinite(obj):
        return str(obj)
    if isinstance(obj, dict):
        return {k: _sanitize_non_finite(v) for k, v in obj.items()}
    if isinstance(obj, list | tuple):
        return [_sanitize_non_finite(v) for v in obj]
    return obj


@app.exception_handler(RequestValidationError)
async def _validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Serve pydantic 422s even when the rejected input is inf/nan.

    Starlette's ``JSONResponse`` renders with ``allow_nan=False``, so
    echoing a non-finite float back in the error body (the ``input`` /
    ``ctx`` keys of ``exc.errors()``) raised during serialization and
    the client saw a bare 500 instead of the validation error — e.g.
    ``workLen=Infinity`` before its ``le=`` cap, or ``laneWidth=NaN``
    today.  Finite inputs serialize byte-identically to FastAPI's
    default handler (same ``{"detail": [...]}`` shape).
    """
    return JSONResponse(
        status_code=422,
        content={"detail": _sanitize_non_finite(jsonable_encoder(exc.errors()))},
    )


def _ensure_scenario_enabled(scenario: Scenario) -> None:
    """Reject scenario kinds we have temporarily gated off in v1.

    Raised as 400 so the Next.js proxy can surface a clean message rather
    than the bare 422 a Pydantic narrowing would produce if we removed
    the kinds from the discriminated union outright.
    """
    if scenario.kind not in ENABLED_SCENARIOS:
        enabled = ", ".join(sorted(ENABLED_SCENARIOS))
        raise HTTPException(
            status_code=400,
            detail=(
                f"This scenario type is not yet available. Currently supported: {enabled} closure."
            ),
        )


@app.middleware("http")
async def require_bearer_secret(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    """Reject any request without a matching Bearer token.

    The /healthz path is exempt so Modal can probe the container.
    """
    if request.url.path == "/healthz":
        return await call_next(request)

    expected = os.environ.get(ENV_SECRET_VAR)
    if not expected:
        # Fail closed: never run an unauthenticated render service.
        return Response(
            content="render service is not configured",
            status_code=503,
        )
    header = request.headers.get("authorization", "")
    if not header.startswith("Bearer ") or header[len("Bearer ") :] != expected:
        return Response(content="unauthorized", status_code=401)
    return await call_next(request)


@app.get("/healthz")
def healthz() -> dict[str, str]:
    # GIT_SHA is baked into the Modal image at deploy time (modal_app.py
    # ._git_sha); surfacing it here makes backend drift behind main
    # detectable.  "unknown" when unstamped (local dev, or a failed
    # stamp) — an honest sentinel, never a fabricated SHA.
    return {"status": "ok", "sha": os.environ.get("GIT_SHA", "unknown")}


def _safe_filename(scenario: Scenario, ext: str) -> str:
    base = (scenario.meta.project or "plan").strip()
    cleaned = "".join(c if c.isalnum() or c in (" ", "-", "_") else "_" for c in base)
    cleaned = cleaned.strip().replace(" ", "_") or "plan"
    return f"{cleaned}.{ext}"


def _placements_for(scenario: Scenario) -> tuple[list, object, list[dict], list[dict]]:
    """Run the generator and apply site- and night-condition adjustments.

    Returns ``(placements, params, site_records, night_records)``.  The
    record lists describe each flag that fired and the MUTCD section
    behind it; the markdown narrative consumes both, the other render
    paths discard them but still benefit from the modified placements.

    Night adjustments fire after site adjustments so warning lights
    decorate every taper drum — including any drums added by an earlier
    site-adjustment step.

    Before invoking the generator, run :func:`validate_corridor_geometry`
    against the scenario params.  A hard violation (e.g., a work zone
    shorter than the merging taper at the posted speed) means no valid
    layout exists; raise HTTP 400 so the user gets a clear error rather
    than a nonsensical PDF.  Soft warnings pass through silently — the
    audit trail surfaces them on the verification side.
    """
    params, generator, kwargs = scenario_to_call(scenario)
    geo_violations = validate_corridor_geometry(params)
    geo_errors = [v for v in geo_violations if v.severity == "error"]
    if geo_errors:
        # Surface every error message so the user sees the full picture
        # if more than one geometry rule fires.  ``detail`` is structured
        # so the Next.js proxy can render the rule_id + message cleanly.
        raise HTTPException(
            status_code=400,
            detail={
                "error": "geometry_validation_failed",
                "message": " ".join(v.message for v in geo_errors),
                "violations": [
                    {
                        "rule_id": v.rule_id,
                        "severity": v.severity,
                        "message": v.message,
                        "mutcd_section": v.mutcd_section,
                    }
                    for v in geo_violations
                ],
            },
        )
    placements = generator(params, **kwargs)
    if not placements:
        # The generator produced zero devices — no valid layout exists to
        # render (a blank schematic would be a degraded, dishonest plan).
        # Unreachable from today's generators (each emits >=1 device); this
        # guards a future gated stub so the failure surfaces as a clear 400
        # at the API boundary rather than a min()-over-empty crash deep in
        # the renderer, which render_pdf would otherwise mask into a 500.
        # Mirrors the geometry-rejection detail shape above.
        message = "No devices were generated for this scenario; a plan cannot be rendered."
        raise HTTPException(
            status_code=400,
            detail={
                "error": "no_devices_generated",
                "message": message,
                "violations": [
                    {
                        "rule_id": "NO_DEVICES_GENERATED",
                        "severity": "error",
                        "message": message,
                        "mutcd_section": None,
                    }
                ],
            },
        )
    placements, site_records = apply_site_adjustments(
        placements, params, scenario.meta.siteConditions or {}
    )
    placements, night_records = apply_night_adjustments(placements, params)
    return placements, params, site_records, night_records


def _plan_sheet_site_flags(scenario: Scenario) -> dict[str, bool]:
    """Structured site flags for the plan-sheet renderer (Refs #121).

    The renderer's site context used to be inferred by scanning device
    labels; it is now driven by the same flags ``apply_site_adjustments``
    consumed.  Two structured sources produce drawable context devices:
    ``meta.siteConditions`` and — for the flagger scenario — the
    top-level ``pedestrianAccess`` field, whose R9-9 signs come from the
    generator itself rather than a site adjustment.  Folding the latter
    into ``pedestrian_facility`` keeps the drawn sheet identical to the
    pre-#121 inference (like-for-like, rule #5).
    """
    flags = dict(scenario.meta.siteConditions or {})
    if getattr(scenario, "pedestrianAccess", False):
        flags["pedestrian_facility"] = True
    return flags


def _render_with(
    scenario: Scenario,
    suffix: str,
    write: Callable[[Path, list, object, list[dict], list[dict]], Path],
) -> bytes:
    """Run scenario_to_call, invoke ``write``, return the file bytes.

    ``write(path, placements, params, site_adj, night_adj)`` writes the
    artifact at ``path`` and returns the same path.  Cleanup happens
    regardless of outcome.
    """
    placements, params, site_adj, night_adj = _placements_for(scenario)

    fd, raw_path = tempfile.mkstemp(suffix=suffix)
    os.close(fd)
    path = Path(raw_path)
    try:
        write(path, placements, params, site_adj, night_adj)
        return path.read_bytes()
    finally:
        path.unlink(missing_ok=True)


@app.post("/render/pdf")
def render_pdf(scenario: Scenario) -> Response:
    """Render the MHT plan-sheet PDF for a scenario."""
    _ensure_scenario_enabled(scenario)
    try:
        # Shoulder width is read from params.shoulder_width_ft inside the
        # renderer (single source of truth — set once at the schemas bridge).
        body = _render_with(
            scenario,
            ".pdf",
            lambda path, placements, params, _site, _night: Path(
                render_plan_sheet(
                    placements,
                    params,
                    output_path=str(path),
                    project_name=scenario.meta.project,
                    site_lat=scenario.meta.lat or None,
                    site_lng=scenario.meta.lng or None,
                    site_address=scenario.meta.address,
                    site_flags=_plan_sheet_site_flags(scenario),
                )
            ),
        )
    except HTTPException:
        # validate_corridor_geometry and other upstream code paths raise
        # HTTPException with meaningful status codes + structured detail.
        # Let those pass through unchanged so the proxy sees the real 400.
        raise
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"render failed: {exc}") from exc

    return Response(
        content=body,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{_safe_filename(scenario, "pdf")}"'
        },
    )


@app.post("/render/xlsx")
def render_xlsx(scenario: Scenario) -> Response:
    _ensure_scenario_enabled(scenario)
    try:
        body = _render_with(
            scenario,
            ".xlsx",
            lambda path, placements, params, _site, _night: Path(
                export_device_list(placements, params, output_path=str(path))
            ),
        )
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"render failed: {exc}") from exc

    return Response(
        content=body,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{_safe_filename(scenario, "xlsx")}"'
        },
    )


@app.post("/render/markdown")
def render_markdown(scenario: Scenario) -> Response:
    _ensure_scenario_enabled(scenario)
    try:
        body = _render_with(
            scenario,
            ".md",
            lambda path, placements, params, site_adj, night_adj: Path(
                generate_crew_narrative(
                    placements,
                    params,
                    output_path=str(path),
                    site_adjustments=site_adj,
                    night_adjustments=night_adj,
                    # Pilot car is field equipment with no placement
                    # trace (G20-4 is vehicle-mounted per S-630-1
                    # Sheet 26) — threaded from the scenario (PR 3).
                    pilot_car=getattr(scenario, "pilotCar", False),
                )
            ),
        )
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"render failed: {exc}") from exc

    return Response(
        content=body,
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{_safe_filename(scenario, "md")}"'},
    )


@app.post("/render/crew-pdf")
def render_crew_pdf(scenario: Scenario) -> Response:
    """Render the crew narrative as a phone-readable PDF.

    Same content as ``/render/markdown`` — the narrative Markdown string —
    rendered through the shared document renderer instead of served raw.
    """
    _ensure_scenario_enabled(scenario)
    try:
        body = _render_with(
            scenario,
            ".pdf",
            lambda path, placements, params, site_adj, night_adj: Path(
                generate_crew_narrative_pdf(
                    placements,
                    params,
                    output_path=str(path),
                    site_adjustments=site_adj,
                    night_adjustments=night_adj,
                    pilot_car=getattr(scenario, "pilotCar", False),
                )
            ),
        )
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"render failed: {exc}") from exc

    return Response(
        content=body,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{_safe_filename(scenario, "crew.pdf")}"'
        },
    )


class JurisdictionSuggestRequest(BaseModel):
    lat: float = Field(ge=-90.0, le=90.0)
    lng: float = Field(ge=-180.0, le=180.0)


@app.post("/jurisdiction/suggest")
def jurisdiction_suggest(req: JurisdictionSuggestRequest) -> JSONResponse:
    """Advisory pin-based jurisdiction suggestion (Endeavor B §2).

    Point-in-polygon against the bundled boundary layer.  The response
    is advice only — it never touches a scenario; the frontend's Confirm
    button is the single writer of ``jurisdiction_key``.
    """
    from src.rules.boundaries import suggest

    return JSONResponse(suggest(req.lat, req.lng))


class DetectSiteRequest(BaseModel):
    lat: float = Field(ge=-90.0, le=90.0)
    lng: float = Field(ge=-180.0, le=180.0)
    radius_m: float = Field(default=500.0, ge=50.0, le=2000.0)
    # Corridor parameters.  When all five are present the handler builds a
    # ``WorkCorridor`` and runs corridor-aware detection (which filters out
    # features off the corridor and applies per-bucket relevance overrides);
    # otherwise it falls back to the legacy point-and-radius detector.
    bearing_deg: float | None = Field(default=None, ge=0.0, le=360.0)
    speed_mph: int | None = Field(default=None, ge=10, le=85)
    work_zone_ft: float | None = Field(default=None, ge=10.0, le=20000.0)
    closure_type: str | None = None
    road_type: str | None = None
    lane_width_ft: float = Field(default=12.0, ge=8.0, le=20.0)


@app.post("/render/detect-site")
def render_detect_site(req: DetectSiteRequest) -> JSONResponse:
    """Query OpenStreetMap for site conditions near (lat, lng).

    Returns the bucketed dict from ``detect_site_conditions`` /
    ``detect_along_corridor`` plus a ``mode`` key (``'corridor'`` or
    ``'point'``) so the UI can surface which detector ran.  Corridor mode
    requires bearing + speed + work zone length + closure type + road type;
    if any are missing or the corridor build fails (unknown closure/road
    type), the handler falls back to legacy point-and-radius detection.
    On any upstream failure the returned dict carries an ``error`` key and
    all buckets are empty — the UI must still work without auto-detection.
    """
    bearing_deg = req.bearing_deg
    speed_mph = req.speed_mph
    work_zone_ft = req.work_zone_ft
    closure_type = req.closure_type
    road_type = req.road_type

    corridor_ready = (
        bearing_deg is not None
        and speed_mph is not None
        and work_zone_ft is not None
        and closure_type is not None
        and road_type is not None
    )

    if corridor_ready:
        # mypy/pyright narrowing — the five locals above are guaranteed
        # non-None by ``corridor_ready``.
        assert bearing_deg is not None
        assert speed_mph is not None
        assert work_zone_ft is not None
        assert closure_type is not None
        assert road_type is not None
        try:
            corridor = build_corridor(
                lat=req.lat,
                lng=req.lng,
                bearing_deg=bearing_deg,
                speed_mph=speed_mph,
                work_zone_ft=work_zone_ft,
                closure_type=closure_type,
                road_type=_map_road_type(road_type, speed_mph),
                lane_width_ft=req.lane_width_ft,
            )
        except ValueError as exc:
            # Unknown closure_type / road_type → log the reason as a soft
            # diagnostic and fall back to legacy point-and-radius scan so
            # the UI still gets a useful result.
            result = detect_site_conditions(req.lat, req.lng, radius_m=req.radius_m)
            result["mode"] = "point"
            result["corridor_unavailable_reason"] = str(exc)
            return JSONResponse(result)
        result = detect_along_corridor(corridor)
        result["mode"] = "corridor"
        return JSONResponse(result)

    result = detect_site_conditions(req.lat, req.lng, radius_m=req.radius_m)
    result["mode"] = "point"
    return JSONResponse(result)


class CorridorSpecRequest(BaseModel):
    """Inputs for the corridor-preview zone lengths (engine-removal PR B).

    Mirrors the frontend ``BuildCorridorInput`` minus the geometry
    (anchor/bearing stay client-side — they position the drawing, they
    are not MUTCD math).  ``kind`` takes the scenario-kind vocabulary;
    gated kinds are accepted deliberately: this computes preview
    lengths, it does not generate a plan, so the enablement gate does
    not apply.
    """

    kind: str
    speed: int = Field(ge=20, le=75, multiple_of=5)
    laneWidth: float = Field(default=12.0, ge=8.0, le=20.0)
    shoulderWidth: float = Field(default=10.0, ge=0.0, le=20.0)
    numLanesClosed: int = Field(default=1, ge=1, le=4)
    roadType: str | None = None


# Scenario kind → taper family for the corridor preview.  Mirrors the
# frontend SCENARIO_TO_CLOSURE map this endpoint exists to retire
# (corridor-spacing.ts): shoulder-family kinds use the L/3 shoulder
# taper, the flagger kind uses the fixed one-lane two-way taper, and
# every lane-closure kind (including the gated mobile ops and
# near_intersection) uses the full merging L.
_CORRIDOR_TAPER_FAMILY: dict[str, str] = {
    "shoulder": "shoulder",
    "work_beyond_shoulder": "shoulder",
    "flagger_lane_closure": "one_lane_two_way",
    "lane_closure_divided": "lane",
    "mobile_op_2lane": "lane",
    "mobile_op_multilane": "lane",
    "near_intersection": "lane",
}


@app.post("/render/corridor-spec")
def render_corridor_spec(req: CorridorSpecRequest) -> JSONResponse:
    """Corridor-preview zone lengths, backend-computed (PR B, D-full).

    Serves the LocationPickerModal's live preview after PR D deletes
    the frontend spacing mirror; the sidebar preview reads the same
    block from the audit response instead (``sections.corridor_spec``).
    Unmapped or absent road types degrade explicitly: ``road_category``
    is null and the advance-warning sum falls back to
    ``advance_warning_spacing``'s speed inference — never a 4xx, the
    preview must not be more fragile than the plan itself.
    """
    family = _CORRIDOR_TAPER_FAMILY.get(req.kind)
    if family is None:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown scenario kind {req.kind!r} for corridor preview.",
        )
    if family == "shoulder":
        taper_ft = shoulder_taper_length(req.speed, req.shoulderWidth)
    elif family == "one_lane_two_way":
        taper_ft = one_lane_two_way_taper_length()
    else:
        taper_ft = taper_length(req.speed, req.laneWidth)

    try:
        category: str | None = _map_road_type(req.roadType, req.speed) if req.roadType else None
    except ValueError:
        category = None
    # advance_warning_spacing refuses to auto-infer at 55+ (rural vs
    # expressway/freeway differ by thousands of feet — unsafe for a
    # PLAN).  For the map PREVIEW we mirror the retiring frontend
    # heuristic exactly ("rural" at 45+) so PR D changes no drawn
    # extent; the plan itself always carries an explicit road type, so
    # this lenient branch can never leak into a deliverable.
    lookup = "rural" if category is None and req.speed >= 55 else category
    abc = advance_warning_spacing(req.speed, lookup)

    return JSONResponse(
        {
            "taper_ft": round(taper_ft),
            "buffer_ft": round(buffer_space(req.speed)),
            "advance_warning_ft": round(abc["A"] + abc["B"] + abc["C"]),
            "downstream_taper_ft": round(downstream_taper_length(req.numLanesClosed, use_max=True)),
            "road_category": category,
        }
    )


class QuoteSettings(BaseModel):
    project_duration_days: int = Field(default=1, ge=1, le=365)
    num_flaggers: int = Field(default=0, ge=0, le=20)
    delivery_distance_miles: float = Field(default=20.0, ge=0.0, le=500.0)
    # Markup and labor rates surfaced as editable so a contractor can price
    # the quote with their own numbers. Defaults mirror generate_quote's
    # kwargs exactly, so an unset field reproduces today's output. Percentages
    # are fractions (0.10 == 10%); the UI shows 0-100 and divides by 100.
    overhead_pct: float = Field(default=0.10, ge=0.0, le=1.0)
    profit_pct: float = Field(default=0.10, ge=0.0, le=1.0)
    flagger_hourly_rate: float = Field(default=55.0, ge=0.0, le=500.0)
    tcs_hourly_rate: float = Field(default=75.0, ge=0.0, le=500.0)
    crew_hourly_rate: float = Field(default=45.0, ge=0.0, le=500.0)


class QuoteRequest(BaseModel):
    scenario: Scenario
    settings: QuoteSettings = Field(default_factory=QuoteSettings)


def _run_quote(req: QuoteRequest):
    placements, params, _site_adj, _night_adj = _placements_for(req.scenario)

    fd, raw_path = tempfile.mkstemp(suffix=".xlsx")
    os.close(fd)
    path = Path(raw_path)
    try:
        _, breakdown = generate_quote(
            placements,
            params,
            output_path=str(path),
            project_name=req.scenario.meta.project or "Untitled Project",
            project_duration_days=req.settings.project_duration_days,
            num_flaggers=req.settings.num_flaggers,
            delivery_distance_miles=req.settings.delivery_distance_miles,
            overhead_pct=req.settings.overhead_pct,
            profit_pct=req.settings.profit_pct,
            flagger_hourly_rate=req.settings.flagger_hourly_rate,
            tcs_hourly_rate=req.settings.tcs_hourly_rate,
            crew_hourly_rate=req.settings.crew_hourly_rate,
        )
        return path.read_bytes(), breakdown
    finally:
        path.unlink(missing_ok=True)


@app.post("/render/quote")
def render_quote(req: QuoteRequest) -> Response:
    _ensure_scenario_enabled(req.scenario)
    try:
        body, _ = _run_quote(req)
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"render failed: {exc}") from exc

    return Response(
        content=body,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{_safe_filename(req.scenario, "xlsx")}"'
            )
        },
    )


# Display names + function categories for the /render/device-breakdown
# response. Mirrors the legend label set in plan_sheet._DEVICE_DISPLAY_NAMES;
# CONE is handled separately via cone_display_name() so the size adapts
# to the posted speed (MUTCD §6F.65).
_NON_SIGN_DISPLAY: dict[DeviceType, tuple[str, str]] = {
    DeviceType.DRUM: ("Channelizing Drum", "Channelizing"),
    DeviceType.TUBULAR_MARKER: ("Tubular Marker", "Channelizing"),
    DeviceType.CHANNELIZER_OPTIONAL: ("Optional Channelizer", "Channelizing"),
    DeviceType.LONGITUDINAL_CHANNELIZER: (
        "Longitudinal Channelizer",
        "Channelizing",
    ),
    DeviceType.BARRICADE_TYPE_II: ("Type II Barricade", "Closure"),
    DeviceType.BARRICADE_TYPE_III: ("Type III Barricade", "Closure"),
    DeviceType.TEMPORARY_BARRIER: ("Temporary Barrier", "Closure"),
    DeviceType.ARROW_BOARD: ("Arrow Board", "Lane closure indication"),
    DeviceType.PCMS: (
        "Portable Changeable Message Sign",
        "Lane closure indication",
    ),
    DeviceType.FLAGGER_STATION: ("Flagger Station", "Traffic control"),
    DeviceType.TEMPORARY_SIGNAL: ("Temporary Signal", "Traffic control"),
    DeviceType.TRUCK_MOUNTED_ATTENUATOR: (
        "Truck-Mounted Attenuator (TMA)",
        "Protection",
    ),
    DeviceType.WARNING_LIGHT_TYPE_C: (
        "Type C Warning Light (steady)",
        "Channelizing (night)",
    ),
    DeviceType.PORTABLE_LIGHT_PLANT: ("Portable Light Plant", "Illumination"),
    DeviceType.DETOUR_MARKER: ("Detour Marker", "Guide"),
}


def _sign_function_category(code: str) -> str:
    """Bucket a MUTCD sign code into a function label for the panel.

    G20-2 is the terminator; G20-4 (pilot car follow me) is operational
    information; everything else in W-/G-series is an advance warning.
    R-series are regulatory; M-/S-series are guide/route.
    """
    if code == "G20-2":
        return "Termination"
    if code == "G20-4":
        return "Information"
    if code.startswith(("W", "G")):
        return "Advance warning"
    if code.startswith("R"):
        return "Regulatory"
    if code.startswith(("M", "S")):
        return "Guide"
    return "Advance warning"


def _build_device_breakdown(
    placements: list[DevicePlacement], params: ScenarioParams
) -> list[dict[str, object]]:
    """Aggregate placements into panel-ready rows.

    Signs are split by schedule key (bare MUTCD code, except R2-1 which
    splits into entrance/restoration faces — same convention as the PDF
    schedule and XLSX device list) so each sign face gets its own row;
    non-sign devices are merged by type.  Parametric descriptions
    resolve via the shared :func:`substitute_sign_description` helper so
    the panel reads the same numbers as the PDF.  CONE picks up the
    speed-aware display name; everything else uses the static table above.
    """
    non_sign_counts: Counter[DeviceType] = Counter()
    sign_counts: Counter[str] = Counter()
    # Lowest-station member per sign group — deterministic representative
    # for station-dependent substitutions.
    sign_reps: dict[str, DevicePlacement] = {}
    for p in placements:
        if p.device_type == DeviceType.SIGN_GENERIC:
            key = schedule_key(p.label, p.station_ft) if p.label else "(unlabeled)"
            sign_counts[key] += 1
            current = sign_reps.get(key)
            if current is None or p.station_ft < current.station_ft:
                sign_reps[key] = p
        else:
            non_sign_counts[p.device_type] += 1

    rows: list[dict[str, object]] = []

    # Signs first (issue #88), keeping their existing schedule-key order.
    for key, n in sorted(sign_counts.items()):
        code, desc = substitute_sign_description(key, sign_reps[key].station_ft, params)
        rows.append(
            {
                "device": desc,
                "code": code,
                "function": _sign_function_category(code),
                "qty": n,
            }
        )

    # Then non-signs: channelizing devices, then equipment, each alphabetical
    # by display name — ordered via the shared device_row_sort_key helper so
    # this panel, the XLSX device list, and the crew equipment list agree.
    for dt, n in sorted(non_sign_counts.items(), key=lambda kv: device_row_sort_key(kv[0], None)):
        if dt == DeviceType.CONE:
            device_label = cone_display_name(params.speed_mph)
            function_label = "Channelizing"
        else:
            device_label, function_label = _NON_SIGN_DISPLAY.get(dt, (dt.value, "Other"))
        rows.append(
            {
                "device": device_label,
                "code": "—",
                "function": function_label,
                "qty": n,
            }
        )
    return rows


def _zone_geometry(params: ScenarioParams) -> dict[str, float]:
    """The §3.2 ``zone_geometry`` block, from the same rules the audit uses.

    Branch selection mirrors ``build_audit_trail`` (audit.py): flagger
    alternating flow → one-lane two-way taper at ~20 ft device spacing;
    other lane closures → full merging taper L; shoulder closures → L/3.
    """
    is_lane = params.closure_type == "lane"
    is_flagger = is_lane and not params.is_divided and not params.near_intersection
    offset_ft = params.lane_width_ft if is_lane else params.shoulder_width_ft
    if is_flagger:
        taper_l = one_lane_two_way_taper_length()
        spacing = one_lane_two_way_device_spacing()
    elif is_lane:
        taper_l = taper_length(params.speed_mph, offset_ft)
        spacing = device_spacing_in_taper(params.speed_mph)
    else:
        taper_l = shoulder_taper_length(params.speed_mph, offset_ft)
        spacing = device_spacing_in_taper(params.speed_mph)
    buffer_ft = buffer_space(
        params.speed_mph,
        jurisdiction=params.jurisdiction,
        work_zone_speed_mph=params.work_zone_speed_mph,
    )
    # Whole-foot display precision, same convention as audit.py's ``_ft``
    # (the single source of display precision) so this block, the audit
    # summary, and the PDF can never show two different numbers.
    return {
        "taper_l_ft": round(taper_l),
        "buffer_b_ft": round(buffer_ft),
        "device_spacing_ft": round(spacing),
        "work_len_ft": float(params.work_zone_length_ft),
    }


def _jurisdiction_schedule(scenario: Scenario) -> JurisdictionWorkSchedule | None:
    sched = getattr(scenario, "schedule", None)
    if sched is None:
        return None
    from datetime import date as _date

    def _parse(value: str | None) -> _date | None:
        return _date.fromisoformat(value) if value else None

    return JurisdictionWorkSchedule(
        date_mode=sched.date_mode,
        work_date=_parse(sched.work_date),
        work_date_end=_parse(sched.work_date_end),
        start_time=sched.start_time,
        end_time=sched.end_time,
    )


@app.post("/render/device-breakdown")
def render_device_breakdown(scenario: Scenario) -> JSONResponse:
    """Return the aggregated device list that drives the Plan Details panel.

    Same placement source as /render/pdf so the panel and the PDF cannot
    drift.  Response shape: a flat list of ``{device, code, function, qty}``
    rows plus running totals, the §3.2 ``zone_geometry`` block, and — only
    when the scenario names a ``jurisdiction_key`` — the evaluated
    ``jurisdiction`` block.  Without a jurisdiction the payload differs
    from the pre-extension shape only by the additive ``zone_geometry``
    key (spec §5.3 regression contract).
    """
    _ensure_scenario_enabled(scenario)
    try:
        placements, params, _site, _night = _placements_for(scenario)
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"render failed: {exc}") from exc

    rows = _build_device_breakdown(placements, params)
    payload: dict[str, Any] = {
        "devices": rows,
        "total_devices": len(placements),
        "unique_types": len(rows),
        "zone_geometry": _zone_geometry(params),
    }

    jurisdiction_key = getattr(scenario, "jurisdiction_key", None)
    if jurisdiction_key:
        try:
            record = load_jurisdiction(jurisdiction_key)
        except UnknownJurisdictionError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        ctx = context_for_closure_type(
            params.closure_type,
            street_class=getattr(scenario, "street_class", None),
            night=params.is_night,
            schedule=_jurisdiction_schedule(scenario),
        )
        jurisdiction = evaluate_jurisdiction(record, ctx)
        # Count-affecting deltas modify quantities through the same row
        # pipeline (spec §3.2) — never in the frontend.
        rows = apply_count_deltas(rows, jurisdiction["applied_deltas"])
        payload["devices"] = rows
        payload["total_devices"] = sum(int(r["qty"]) for r in rows)
        payload["unique_types"] = len(rows)
        payload["jurisdiction"] = jurisdiction

    return JSONResponse(payload)


def _audit_projection_for(scenario: Scenario) -> dict[str, Any]:
    """Build the audit projection for a scenario — the single source both
    ``/render/audit`` (JSON) and ``/render/audit-pdf`` (PDF) render from, so
    the two cannot be two different builds.

    Same placement source as ``/render/pdf`` so the audit cannot drift from
    the rendered plan.
    """
    placements, params, site_records, _night = _placements_for(scenario)
    # Shoulder width is read from params.shoulder_width_ft inside the
    # audit builder (single source of truth — set once at the schemas bridge).
    audit = build_audit_trail(
        placements,
        params,
        site_lat=scenario.meta.lat or None,
        site_lng=scenario.meta.lng or None,
    )
    step_count = _compute_step_count(scenario)
    return audit_projection(
        audit,
        scenario.kind,
        step_count,
        road_type=params.road_type,
        # #104 — the site-adjustment records were already computed for the
        # narrative path; pass them through so the projection carries the
        # per-flag citations the panel reads (no second computation).
        site_records=site_records,
    )


@app.post("/render/audit")
def render_audit(scenario: Scenario) -> JSONResponse:
    """Return the audit projection that drives the AuditTrail UI.

    Same placement source as ``/render/pdf`` so the audit shown in the
    UI cannot drift from the rendered plan.  Response shape:

      * ``summary`` — header fields: TA, CDOT sheet, case ID, taper
        length, buffer space, in-taper and on-tangent device spacings.
        Replaces what the TS ``compute()`` estimator used to return.
      * ``sections`` — the full ``build_audit_trail`` body (taper,
        buffer, spacing, advance, colorado, case, flagger,
        corridor_validation, geometry_validation) with placeholder
        ``(TODO: verify ...)`` case-# markers scrubbed.
      * ``pending_verification`` — rollup with a count of scrubbed
        references and the tracking-issue URL.  Keeps the existence of
        pending case-# work transparent without exposing partial data.
    """
    _ensure_scenario_enabled(scenario)
    try:
        projection = _audit_projection_for(scenario)
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"render failed: {exc}") from exc

    return JSONResponse(projection)


@app.post("/render/audit-pdf")
def render_audit_pdf_endpoint(scenario: Scenario) -> Response:
    """Render the audit trail as an exportable PDF.

    Builds from the exact same projection ``/render/audit`` serializes
    (via ``_audit_projection_for``) — the PDF is a re-presentation of that
    one object, not a second computation.
    """
    _ensure_scenario_enabled(scenario)
    try:
        projection = _audit_projection_for(scenario)
        fd, raw_path = tempfile.mkstemp(suffix=".pdf")
        os.close(fd)
        path = Path(raw_path)
        try:
            render_audit_pdf(projection, str(path))
            body = path.read_bytes()
        finally:
            path.unlink(missing_ok=True)
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"render failed: {exc}") from exc

    return Response(
        content=body,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{_safe_filename(scenario, "audit.pdf")}"'
        },
    )


@app.post("/render/quote-breakdown")
def render_quote_breakdown(req: QuoteRequest) -> JSONResponse:
    _ensure_scenario_enabled(req.scenario)
    try:
        _, breakdown = _run_quote(req)
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"render failed: {exc}") from exc

    return JSONResponse(
        {
            "equipment_lines": [
                {
                    "item_number": line.item_number,
                    "device_type": line.device_type,
                    "label": line.label,
                    "description": line.description,
                    "qty": line.qty,
                    "unit": line.unit,
                    "daily_rate": line.daily_rate,
                    "days": line.days,
                    "extended": line.extended,
                    "note": line.note,
                }
                for line in breakdown.equipment_lines
            ],
            "labor_lines": [
                {
                    "role": line.role,
                    "personnel": line.personnel,
                    "hours_per_day": line.hours_per_day,
                    "days": line.days,
                    "rate": line.rate,
                    "extended": line.extended,
                }
                for line in breakdown.labor_lines
            ],
            "delivery_lines": [
                {
                    "item": line.item,
                    "trips": line.trips,
                    "distance_miles": line.distance_miles,
                    "rate_per_mile": line.rate_per_mile,
                    "min_trip_charge": line.min_trip_charge,
                    "extended": line.extended,
                }
                for line in breakdown.delivery_lines
            ],
            "is_night": breakdown.is_night,
            "night_multiplier": breakdown.night_multiplier,
            "overhead_pct": breakdown.overhead_pct,
            "profit_pct": breakdown.profit_pct,
            "equipment_total": breakdown.equipment_total,
            "labor_total": breakdown.labor_total,
            "delivery_total": breakdown.delivery_total,
            "subtotal": breakdown.subtotal,
            "overhead": breakdown.overhead,
            "profit": breakdown.profit,
            "total": breakdown.total,
        }
    )


@app.post("/render/replication-snapshot")
def render_replication_snapshot(req: QuoteRequest) -> Response:
    """Dev-only replication snapshot (Refs #102): the backend sections of
    the diagnostic markdown dump. TEMPORARY scaffolding — delete together
    with src/api/replication_snapshot.py and the frontend
    DebugSnapshotButton."""
    _ensure_scenario_enabled(req.scenario)
    try:
        body = build_snapshot_markdown(req)
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"render failed: {exc}") from exc

    return Response(
        content=body,
        media_type="text/markdown; charset=utf-8",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{_safe_filename(req.scenario, "replication.md")}"'
            )
        },
    )


# Sentry verification endpoints. Gated behind SENTRY_TEST_ENABLED=1 so
# they 404 in normal operation. Enable inline only when re-verifying the
# Sentry integration; see MONITORING.md for the toggle procedure.
@app.get("/debug/sentry-test/500")
def _debug_sentry_500() -> Response:
    if os.environ.get("SENTRY_TEST_ENABLED") != "1":
        raise HTTPException(status_code=404, detail="not found")
    raise RuntimeError("Sentry backend verification: intentional 500 error")


@app.get("/debug/sentry-test/400")
def _debug_sentry_400() -> Response:
    if os.environ.get("SENTRY_TEST_ENABLED") != "1":
        raise HTTPException(status_code=404, detail="not found")
    raise HTTPException(
        status_code=400, detail="Sentry backend verification: intentional 400 (should be filtered)"
    )
