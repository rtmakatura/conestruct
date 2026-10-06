"""
Auto-detect site conditions near a work zone using OpenStreetMap Overpass API.

Pre-fills the manual site-condition checkboxes in the generator UI. Detection is
approximate (OSM coverage varies); a field inspection still owns the final answer.

Two detection modes are supported:

* :func:`detect_site_conditions` — legacy point-and-radius query.  Used
  when only a single lat/lng is available and no corridor extent has
  been computed yet.
* :func:`detect_along_corridor` — corridor-aware query.  Uses a
  :class:`~src.rules.corridor.WorkCorridor` bounding box so that
  features detected belong to the road segment the work zone actually
  occupies, and tags each feature with the corridor zone it falls in
  (advance warning, taper, buffer, work zone, downstream, lateral).
"""

from __future__ import annotations

import asyncio
import functools
import math
import os
import ssl
import time
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from typing import TYPE_CHECKING, Any

import certifi
import httpx

if TYPE_CHECKING:
    from src.rules.corridor import WorkCorridor

# Point-mode scan radius.  CHOSEN (#16): legacy point-and-radius reach —
# a few city blocks in every direction; no MUTCD distance governs a
# generic "nearby features" scan.  Corridor mode ignores this and scans
# the corridor bbox instead.
DEFAULT_RADIUS_M = 500.0
HTTP_TIMEOUT_S = 25.0
# The per-mirror READ cap (#256 ruling a: 7 s, so one stalled mirror could
# not eat a SEQUENTIAL chain) is RETIRED by #292 (R69/R71): the mirrors are
# asked at once, each gets the whole remaining deadline, and the race -- not
# a cap -- keeps a slow mirror from costing the scan its answer.
#
# CONNECT 3 s — CHOSEN, not traced (#256): a mirror that can't even accept
# the connection in 3 s is not going to win the race.
PER_MIRROR_CONNECT_S = 3.0
# #241 (s2-arc16 rider): wall-clock budget for the corridor-validation
# trip (``validate_corridor_against_osm`` → ``detect_road_bearing``).
# CHOSEN, not traced: the audit's worst case is this check plus the
# #224 phase-1 site scan (SCAN_BUDGET_S = 20 s) plus layout — 20 + 20 +
# layout stays under the Vercel proxy's 60 s ``maxDuration``, where the
# unbudgeted 25 s × 3-mirror chain measured three 504s on prod
# (2026-09-03, s2-arc15 after-table).  Past the budget the check reports
# its existing honest ``check_unavailable`` reason (#213 V4).
#
# RETIRED by #256 ruling c (2026-09-16), Rule 5 declaration.  The corridor
# check no longer has a round trip of its own to budget: it derives from
# the elements the site scan already fetched (``bearing_anchor`` on
# detect_along_corridor), so there is one trip, one budget —
# SCAN_BUDGET_S — and one thing that can fail.  Kept as a named constant
# ONLY so a caller still passing it is not a TypeError; it no longer
# governs any transport and nothing in the folded path reads it.  The
# behaviour it used to produce — a second 20 s wait that could report
# check_unavailable while the scan itself succeeded — is GONE, which is
# the change: arc-31 measured that second trip reporting
# check_unavailable on 43 % (denver) and 65 % (lakewood) of otherwise-ok
# audits.  Delete the constant when the last caller stops naming it.
CORRIDOR_CHECK_BUDGET_S = 20.0
# Overpass returns 406 to clients without an identifying User-Agent.
USER_AGENT = "conestruct-traffic-control-tool/0.2 (+https://conestruct.com; hello@conestruct.com)"

# Public Overpass mirrors, asked AT ONCE (#292, rulings R69/R74): the first
# valid answer with content wins and the other request is cancelled, so no mirror's
# place in a list costs the scan time.  Measured 2026-10-01, morning,
# midday and evening (validation-artifacts/committed/
# issue-292-mirror-strategy/): overpass.openstreetmap.fr answered 27 of 27
# (median 3.0 s), overpass-api.de 16 of 27 (median 6.5 s).
# overpass.kumi.systems is DROPPED (R70): it answered 1 of 27, in 20.7 s.
OVERPASS_MIRRORS: tuple[str, ...] = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.openstreetmap.fr/api/interpreter",
)

# R73: a mirror that answered 429 is left alone until its cool-down ends --
# its own Retry-After when it sends one, else RATE_LIMIT_COOLDOWN_S.
# CHOSEN (Rule 12): 60 s.  Neither mirror documents a value; a minute is the
# shortest pause that is plainly not a retry loop from one container.
RATE_LIMIT_COOLDOWN_S = 60.0
_RATE_LIMITED_UNTIL: dict[str, float] = {}

# R102 (#292): Overspan (https://overspan.dev), a hosted, keyed Overpass,
# as an OPTIONAL first-choice mirror.  Earmarked, not live (Linear CON-39):
# it is asked only when the ``OVERSPAN_API_KEY`` Modal secret exists.  With
# no key every scan runs ``_race`` exactly as before -- the same mirrors,
# requests and headers.  The key rides an ``Authorization: Bearer`` header
# (Overspan's docs accept it there and recommend headers over a key in the
# URL); the URL holds no key, so refusal text and the audit's ``mirror``
# never print it.
OVERSPAN_URL = "https://api.overspan.dev/api/interpreter"
OVERSPAN_KEY_ENV = "OVERSPAN_API_KEY"
# CHOSEN (Rule 12): 4 s.  How long Overspan is asked alone before the free
# mirrors join the race.  #292's windows put a healthy free answer at a
# 2.2-11.6 s median scan, so 4 s lets a working Overspan answer first
# without spending much of SCAN_BUDGET_S (20 s) when it is slow; an
# Overspan FAILURE ends the head start at once.
OVERSPAN_HEAD_START_S = 4.0


def _overspan_key() -> str | None:
    key = os.environ.get(OVERSPAN_KEY_ENV, "").strip()
    return key or None


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two lat/lon points in meters."""
    earth_radius_m = 6_371_000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return earth_radius_m * c


def _build_query(lat: float, lng: float, radius_m: float) -> str:
    r = f"{radius_m:.0f}"
    around = f"around:{r},{lat},{lng}"
    return f"""[out:json][timeout:10];
(
  node({around})["highway"="traffic_signals"];
  node({around})["highway"="crossing"];
  way({around})["highway"="footway"];
  way({around})["footway"="sidewalk"];
  way({around})["highway"="cycleway"];
  way({around})["cycleway"];
  node({around})["amenity"="school"];
  way({around})["amenity"="school"];
  node({around})["railway"="level_crossing"];
  node({around})["amenity"="hospital"];
  way({around})["amenity"="hospital"];
  node({around})["highway"="motorway_junction"];
  way({around})["highway"="motorway_link"];
  way({around})["highway"="trunk_link"];
  way({around})["bridge"="yes"];
);
out center tags;
"""


def _element_coord(el: dict[str, Any]) -> tuple[float, float] | None:
    # #304 (c): a key that is present but null (or not a number) is no
    # coordinate -- the same predicate the road geometry uses.
    if _has_coords(el):
        return float(el["lat"]), float(el["lon"])
    center = el.get("center")
    if _has_coords(center):
        return float(center["lat"]), float(center["lon"])
    return None


def _label_for(el: dict[str, Any]) -> str:
    tags = el.get("tags") or {}
    name = tags.get("name")
    # Motorway-junction nodes carry the exit number on a ``ref`` tag and
    # the cross-street name on ``name``; surface both so the audit trail
    # shows e.g. "Garden of the Gods Rd interchange (Exit 146)".
    if tags.get("highway") == "motorway_junction":
        ref = tags.get("ref")
        if name and ref:
            return f"{name} interchange (Exit {ref})"
        if ref:
            return f"Exit {ref}"
        if name:
            return f"{name} interchange"
    if name:
        return str(name)
    coord = _element_coord(el)
    if coord is not None:
        return f"unnamed at {coord[0]:.4f}, {coord[1]:.4f}"
    return "unnamed feature"


def _junction_ref(el: dict[str, Any]) -> str | None:
    """Exit number from a ``motorway_junction`` node, if present."""
    tags = el.get("tags") or {}
    if tags.get("highway") != "motorway_junction":
        return None
    ref = tags.get("ref")
    return str(ref) if ref else None


async def _mirror_post(
    client: httpx.AsyncClient, url: str, query: str, timeout: httpx.Timeout
) -> httpx.Response:
    """One mirror request -- the seam tests stub and the corpus network
    guard blocks.  Above it is the race; below it is the wire."""
    headers = {"User-Agent": USER_AGENT}
    if url == OVERSPAN_URL:
        # R102: only Overspan sees the key; the free mirrors never do.
        key = _overspan_key()
        if key is not None:
            headers["Authorization"] = f"Bearer {key}"
    return await client.post(url, data={"data": query}, headers=headers, timeout=timeout)


def _retry_after_s(resp: Any) -> float:
    headers = getattr(resp, "headers", None) or {}
    raw = headers.get("Retry-After")
    try:
        return max(0.0, float(raw)) if raw is not None else RATE_LIMIT_COOLDOWN_S
    except (TypeError, ValueError):
        return RATE_LIMIT_COOLDOWN_S


async def _ask_mirror(
    client: httpx.AsyncClient,
    url: str,
    query: str,
    deadline: float,
    validate: Callable[[dict[str, Any]], str | None] | None,
) -> tuple[str, dict[str, Any] | None, str | None, int | None, str | None]:
    """``(url, payload or None, error or None, response bytes, remark)``."""
    remaining = max(0.001, deadline - time.monotonic())
    timeout = httpx.Timeout(remaining, connect=min(PER_MIRROR_CONNECT_S, remaining))
    try:
        resp = await _mirror_post(client, url, query, timeout)
    except httpx.HTTPError as exc:
        return url, None, f"{url}: {type(exc).__name__}: {exc}", None, None
    size = len(resp.content)
    if resp.status_code == 429:
        # R73: honour the rate limit.  This mirror is left alone until its
        # cool-down ends (later scans skip it) and is never retried.
        pause = _retry_after_s(resp)
        _RATE_LIMITED_UNTIL[url] = time.monotonic() + pause
        return url, None, f"{url}: 429 rate-limited (left alone {pause:g} s)", size, None
    if resp.status_code >= 400:
        return url, None, f"{url}: {resp.status_code} {resp.reason_phrase}", size, None
    try:
        payload = resp.json()
    except ValueError as exc:
        return url, None, f"{url}: invalid JSON: {exc}", size, None
    remark = _overpass_remark(payload)
    if remark is not None:
        # #251: a 200 whose body carries ``remark`` did NOT complete -- a
        # mirror failure, never a payload (Rule 10).
        return url, None, f"{url}: overpass remark: {remark}", size, remark
    problem = validate(payload) if validate is not None else None
    if problem is not None:
        # R74: an answer #304's cleaning empties is this mirror's failure,
        # and the other mirror's answer stays in play.
        return url, None, f"{url}: {problem}", size, None
    return url, payload, None, size, None


@functools.cache
def _tls_context() -> ssl.SSLContext:
    """Built once per container.  Loading the CA bundle took 0.25 s per
    client on the dev PC (httpx 0.28.1), and a fresh one per scan would
    spend that out of the scan's own deadline (R71)."""
    return ssl.create_default_context(cafile=certifi.where())


async def _race(
    query: str,
    total_s: float,
    meta: dict[str, Any] | None,
    validate: Callable[[dict[str, Any]], str | None] | None,
) -> tuple[dict[str, Any] | None, str | None]:
    if (
        _overspan_key() is not None
        and _RATE_LIMITED_UNTIL.get(OVERSPAN_URL, 0.0) <= time.monotonic()
    ):
        return await _race_overspan_first(query, total_s, meta, validate)
    deadline = time.monotonic() + total_s
    now = time.monotonic()
    live = [u for u in OVERPASS_MIRRORS if _RATE_LIMITED_UNTIL.get(u, 0.0) <= now]
    errors = [
        f"{u}: rate-limited, left alone {(_RATE_LIMITED_UNTIL[u] - now):.0f} s more"
        for u in OVERPASS_MIRRORS
        if u not in live
    ]
    if not live:
        return None, "; ".join(errors) or "no mirrors configured"
    async with httpx.AsyncClient(verify=_tls_context()) as client:
        tasks = [
            asyncio.ensure_future(_ask_mirror(client, u, query, deadline, validate)) for u in live
        ]
        pending: set[asyncio.Future[Any]] = set(tasks)
        try:
            while pending:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    break
                done, pending = await asyncio.wait(
                    pending, timeout=remaining, return_when=asyncio.FIRST_COMPLETED
                )
                # Answers that land together are read in mirror order, so the
                # winner and the refusal text never depend on set order.
                for task in sorted(done, key=tasks.index):
                    url, payload, error, size, remark = task.result()
                    if meta is not None:
                        meta.update(mirror=url, response_bytes=size, remark=remark)
                    if payload is not None:
                        return payload, None
                    errors.append(error or f"{url}: no answer")
        finally:
            # R69: cancel the other request as soon as one wins.  R71: and
            # every request still open when the deadline passes.
            for task in tasks:
                task.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)
    if pending:
        return None, "; ".join([f"scan budget exceeded ({total_s:g} s)", *errors])
    return None, "; ".join(errors)


async def _race_overspan_first(
    query: str,
    total_s: float,
    meta: dict[str, Any] | None,
    validate: Callable[[dict[str, Any]], str | None] | None,
) -> tuple[dict[str, Any] | None, str | None]:
    """R102: Overspan first, the free mirrors as the fallback, one deadline.

    Overspan is asked alone for ``OVERSPAN_HEAD_START_S``.  Its valid answer
    wins outright.  If it fails (any status, remark, invalid or emptied
    answer -- ``_ask_mirror``'s rules, a 429 included) the free mirrors are
    asked at once; if it is still out when the head start ends they join
    the race beside it, and the first valid answer from any of them wins.
    Everything else -- the hard deadline, cancellation, the refusal text --
    is ``_race``'s.
    """
    deadline = time.monotonic() + total_s
    errors: list[str] = []
    async with httpx.AsyncClient(verify=_tls_context()) as client:
        tasks = [
            asyncio.ensure_future(_ask_mirror(client, OVERSPAN_URL, query, deadline, validate))
        ]
        pending: set[asyncio.Future[Any]] = set(tasks)
        try:
            head = min(OVERSPAN_HEAD_START_S, max(0.0, deadline - time.monotonic()))
            done, pending = await asyncio.wait(pending, timeout=head)
            for task in done:
                url, payload, error, size, remark = task.result()
                if meta is not None:
                    meta.update(mirror=url, response_bytes=size, remark=remark)
                if payload is not None:
                    return payload, None
                errors.append(error or f"{url}: no answer")
            now = time.monotonic()
            for u in OVERPASS_MIRRORS:
                if _RATE_LIMITED_UNTIL.get(u, 0.0) > now:
                    errors.append(
                        f"{u}: rate-limited, left alone {(_RATE_LIMITED_UNTIL[u] - now):.0f} s more"
                    )
                else:
                    task = asyncio.ensure_future(_ask_mirror(client, u, query, deadline, validate))
                    tasks.append(task)
                    pending.add(task)
            while pending:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    break
                done, pending = await asyncio.wait(
                    pending, timeout=remaining, return_when=asyncio.FIRST_COMPLETED
                )
                for task in sorted(done, key=tasks.index):
                    url, payload, error, size, remark = task.result()
                    if meta is not None:
                        meta.update(mirror=url, response_bytes=size, remark=remark)
                    if payload is not None:
                        return payload, None
                    errors.append(error or f"{url}: no answer")
        finally:
            for task in tasks:
                task.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)
    if pending:
        return None, "; ".join([f"scan budget exceeded ({total_s:g} s)", *errors])
    return None, "; ".join(errors) or "no mirrors configured"


def _run_coroutine(coro: Any) -> Any:
    """Run the race from synchronous code (every caller today is sync)."""
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(coro)
    with ThreadPoolExecutor(1) as ex:  # inside a running loop: a private one
        return ex.submit(asyncio.run, coro).result()


def _overpass_request_with_fallback(
    query: str,
    budget_s: float | None = None,
    meta: dict[str, Any] | None = None,
    validate: Callable[[dict[str, Any]], str | None] | None = None,
) -> tuple[dict[str, Any] | None, str | None]:
    """Ask every live mirror AT ONCE; the first valid answer wins (#292).

    R69 as corrected by R74: the live mirrors get the query at the same
    moment.  The first answer that is valid -- HTTP 200, JSON, without a
    ``remark`` (#251) -- and that ``validate`` passes wins, and the other
    request is cancelled.  ``validate`` is the caller's "still has content
    after #304's cleaning" (``_emptied_by_cleaning``); the cleaning itself
    stays downstream.  A 4xx, 429, 5xx, remark or emptied answer from one
    mirror is that mirror's failure; the other's answer stays in play.

    R71: ``budget_s`` is a HARD deadline for the whole ask.  Every request
    still open when it passes is cancelled, so a slow read can't run past
    it, and the caller gets ``(None, "scan budget exceeded (N s); ...")``,
    an honest ``unavailable``.  ``None`` (unbudgeted callers) uses
    ``HTTP_TIMEOUT_S`` the same way.

    R73: a 429 puts that mirror in a cool-down (its Retry-After, else
    ``RATE_LIMIT_COOLDOWN_S``); while it lasts the mirror isn't asked.
    Nothing is retried.

    ``meta`` (#251) is filled with ``mirror`` (the URL that answered: the
    winner, or the last mirror heard from), ``response_bytes`` and
    ``remark``.  Returns ``(payload, None)``, or ``(None, every mirror's
    reason, joined)``.
    """
    if meta is not None:
        meta.update(mirror=None, response_bytes=None, remark=None)
    total = budget_s if budget_s is not None else HTTP_TIMEOUT_S
    return _run_coroutine(_race(query, total, meta, validate))


def _overpass_remark(payload: Any) -> str | None:
    """The first line of a body's ``remark``, or ``None`` when the body
    carries none (a complete answer).  A remark is never truncated to
    nothing: an empty or non-string value counts as absent."""
    if not isinstance(payload, dict):
        return None
    remark = payload.get("remark")
    if not isinstance(remark, str) or not remark.strip():
        return None
    return remark.strip().splitlines()[0]


def _empty(detail_msg: str = "") -> dict[str, Any]:
    out: dict[str, Any] = {"detected": False, "count": 0, "details": []}
    if detail_msg:
        out["details"] = [detail_msg]
    return out


# Highway tag values that indicate an interchange / ramp facility.  Used by
# :func:`_categorize` to split the legacy ``intersections`` bucket into
# ``intersections`` (at-grade signal/stop/uncontrolled crossings) and
# ``interchanges`` (highway on/off-ramps where cross-traffic merges rather
# than crosses at a stop bar).  See BUG FIX 3 for the cross-street vs.
# ramp-signing rationale.
_INTERCHANGE_HIGHWAY_TAGS: frozenset[str] = frozenset(
    {"motorway", "trunk", "motorway_link", "trunk_link"}
)


def _categorize(el: dict[str, Any]) -> str | None:
    """Map an OSM element to one of our site-condition buckets.

    Splits the historical "any crossing/junction" bucket into two:

    * ``intersections`` — at-grade signals, stop-controlled crossings,
      uncontrolled crossings.  Cross-traffic enters via a stop bar.
    * ``interchanges`` — highway on/off-ramps, motorway junction nodes
      (exit numbers), and bridges (typically a structure carrying the
      highway over a cross street, or vice versa).  Cross-traffic
      enters via merging ramps and needs ramp-specific signing.
    """
    tags = el.get("tags") or {}
    highway = tags.get("highway")
    if highway == "motorway_junction":
        return "interchanges"
    if highway in _INTERCHANGE_HIGHWAY_TAGS:
        return "interchanges"
    if tags.get("bridge") == "yes":
        return "interchanges"
    if highway in {"traffic_signals", "crossing"}:
        return "intersections"
    if highway == "footway" or tags.get("footway") == "sidewalk":
        return "sidewalks"
    if highway == "cycleway" or "cycleway" in tags:
        return "bike_facilities"
    if tags.get("amenity") == "school":
        return "schools"
    if tags.get("railway") == "level_crossing":
        return "railroad_crossings"
    if tags.get("amenity") == "hospital":
        return "hospitals"
    return None


def detect_site_conditions(
    lat: float,
    lng: float,
    radius_m: float = DEFAULT_RADIUS_M,
) -> dict[str, Any]:
    """Query Overpass for features near (lat, lng) and bucket them.

    Returns a dict keyed by condition name. Each value has ``detected`` (bool),
    ``count`` (int), ``details`` (list[str]), and where applicable
    ``nearest_distance_m`` (float).

    On any network/parse failure, returns all-buckets-empty plus an ``error``
    key carrying the exception string. The generator must still work offline.
    """
    buckets: dict[str, Any] = {
        "intersections": _empty(),
        "interchanges": _empty(),
        "sidewalks": _empty(),
        "bike_facilities": _empty(),
        "schools": _empty(),
        "railroad_crossings": _empty(),
        "hospitals": _empty(),
        # Placeholder until curvature analysis exists — carries the standard
        # bucket shape so generic iteration over buckets is safe (#34).
        "road_curvature": _empty("Road curvature analysis not implemented; assume straight."),
    }
    # Interchange exit numbers, deduplicated, populated only when a
    # motorway_junction node carries a ``ref`` tag.  Surfaced to the UI
    # so the audit trail can call out specific exits.
    buckets["interchanges"]["junction_refs"] = []

    query = _build_query(lat, lng, radius_m)
    payload, error = _overpass_request_with_fallback(query)
    if payload is None:
        buckets["error"] = error or "Overpass request failed"
        return buckets

    elements = payload.get("elements", []) or []

    for el in elements:
        bucket_name = _categorize(el)
        if bucket_name is None:
            continue
        bucket = buckets[bucket_name]
        bucket["count"] += 1
        bucket["detected"] = True
        label = _label_for(el)
        coord = _element_coord(el)
        if coord is not None:
            distance = _haversine(lat, lng, coord[0], coord[1])
            existing = bucket.get("nearest_distance_m")
            if existing is None or distance < existing:
                bucket["nearest_distance_m"] = round(distance, 1)
            label = f"{label} (~{distance:.0f} m)"
        if len(bucket["details"]) < 5:
            bucket["details"].append(label)
        if bucket_name == "interchanges":
            ref = _junction_ref(el)
            if ref and ref not in bucket["junction_refs"]:
                bucket["junction_refs"].append(ref)

    return buckets


# ---------------------------------------------------------------------------
# Corridor-aware detection
# ---------------------------------------------------------------------------

# Zones that always count as "relevant" — feature is on the corridor
# centerline within one of the longitudinal segments.  Features tagged
# ``lateral`` or ``outside`` are not relevant *by default*; per-bucket
# overrides below relax this where the underlying signing rule has a
# different geometric expectation.
_RELEVANT_ZONES: frozenset[str] = frozenset(
    {"advance_warning", "transition", "buffer", "work_zone", "downstream"}
)

# Per-bucket relaxations of the default "relevant ⇔ zone ∈ _RELEVANT_ZONES"
# rule.  Tuned so the auto-apply layer flips a flag iff the OSM feature is
# in the geometric scope the corresponding MUTCD treatment cares about:
#
# * ``accept_lateral_within_ft`` — a feature classified ``lateral`` (offset
#   from centerline beyond corridor's default 50 ft lateral_threshold) still
#   counts as relevant if its lateral offset is within this distance.  Used
#   for sidewalks/bike facilities, which run parallel to the work zone by
#   construction — a curbside sidewalk at ~70–80 ft lateral is the *target*
#   of the pedestrian-closure rule, not a parallel-street false positive.
#
# * ``outside_tolerance_ft`` — a feature classified ``outside`` (just past
#   the corridor's upstream or downstream end, past classify_distance's
#   25 ft hard tolerance) still counts as relevant if it sits within this
#   distance of either end.  Used for at-grade intersections and highway
#   interchanges, where cross-street ROAD WORK AHEAD or upstream-ramp
#   signing must face the cross-traffic — a T-junction 30 ft past the most
#   upstream sign is still a real intersection that needs treatment.
#
# Threshold sourcing (#16 closure, s2-arc4, 2026-08-18): all three values
# are CHOSEN.  Neither MUTCD §6N.12 (Work within the Traveled Way at an
# Intersection, 11th Ed. p. 848) nor §6N.16 (Interchanges, p. 851) assigns
# any proximity distance — both sections are distance-free, and the prior
# attribution of these numbers to them was wrong (negative scan on record:
# validation-artifacts/committed/s2-arc4-16-thresholds/).  Rationales,
# expressly tunable, all distances measured in the road frame post-#207:
#
# * 150.0 ft (sidewalks / bike_facilities lateral acceptance) — spans a
#   typical 4-lane arterial half-section (lanes + shoulders + furnishing
#   zone) with margin, so a curbside path past the corridor's 50 ft
#   lateral band still counts.
# * 250.0 ft (intersections outside tolerance) — about one advance-sign
#   interval at urban scale; Table 6B-1's urban A dimensions are
#   100–350 ft (11th Ed. p. 773, cited as scale context only, NOT as a
#   source — the table has no 250 ft row).
# * 500.0 ft (interchanges outside tolerance) — Table 6B-1's rural A
#   dimension (p. 773, again context, not source), double the
#   intersection tolerance because ramp geometry strings junctions
#   farther from the mainline.
_BUCKET_RELEVANCE_OVERRIDES: dict[str, dict[str, float]] = {
    "intersections": {"outside_tolerance_ft": 250.0},
    "interchanges": {"outside_tolerance_ft": 500.0},
    "sidewalks": {"accept_lateral_within_ft": 150.0},
    "bike_facilities": {"accept_lateral_within_ft": 150.0},
}

# Longitudinal Overpass-bbox pad used when fetching corridor features, in
# meters.  Must be ≥ the widest ``outside_tolerance_ft`` above so that
# features eligible to count via the tolerance override are inside the
# query bbox in the first place.  500 ft ≈ 152.4 m.
_CORRIDOR_LONGITUDINAL_BUFFER_M: float = 152.4

# Lateral Overpass-bbox pad, in meters.  CHOSEN (#16): the value is
# tunable, but it carries the invariant twin of the longitudinal pad
# above — it must be ≥ the widest ``accept_lateral_within_ft`` (150 ft ≈
# 45.7 m) or features eligible to count via the lateral override never
# enter the query bbox at all.  100 m ≈ 328 ft holds that bound with
# room.  The code has obeyed this invariant since corridor mode shipped
# but never stated it; written down at #16's threshold pass.
_CORRIDOR_LATERAL_BUFFER_M: float = 100.0


def _is_feature_relevant(
    bucket_name: str,
    zone: str,
    along_ft: float | None,
    lateral_ft: float | None,
    total_length_ft: float,
) -> bool:
    """Decide whether a feature is relevant enough to flip the bucket flag.

    Default rule: ``zone ∈ _RELEVANT_ZONES`` (on-centerline, within the
    corridor's longitudinal extent).  Per-bucket overrides in
    ``_BUCKET_RELEVANCE_OVERRIDES`` relax this for sidewalks/bike facilities
    (accept ``lateral`` features within a sub-threshold) and for
    intersections/interchanges (accept ``outside`` features within a wider
    end-of-corridor tolerance).  See the override-table docstring for
    motivation.
    """
    if zone in _RELEVANT_ZONES:
        return True

    overrides = _BUCKET_RELEVANCE_OVERRIDES.get(bucket_name, {})

    if zone == "lateral":
        max_lateral_ft = overrides.get("accept_lateral_within_ft")
        if max_lateral_ft is None or lateral_ft is None:
            return False
        return lateral_ft <= max_lateral_ft

    if zone == "outside":
        tol_ft = overrides.get("outside_tolerance_ft")
        if tol_ft is None or along_ft is None:
            return False
        return -tol_ft <= along_ft <= total_length_ft + tol_ft

    return False


# The scan set's selectors, one box at a time (#290) — the same fifteen,
# in the same order, as the templates below spell out inline.
_SCAN_SELECTORS: tuple[str, ...] = (
    'node({box})["highway"="traffic_signals"];',
    'node({box})["highway"="crossing"];',
    'way({box})["highway"="footway"];',
    'way({box})["footway"="sidewalk"];',
    'way({box})["highway"="cycleway"];',
    'way({box})["cycleway"];',
    'node({box})["amenity"="school"];',
    'way({box})["amenity"="school"];',
    'node({box})["railway"="level_crossing"];',
    'node({box})["amenity"="hospital"];',
    'way({box})["amenity"="hospital"];',
    'node({box})["highway"="motorway_junction"];',
    'way({box})["highway"="motorway_link"];',
    'way({box})["highway"="trunk_link"];',
    'way({box})["bridge"="yes"];',
)


def _extra_box_selectors(boxes: list[tuple[float, float, float, float]]) -> str:
    """The scan set's selectors again, once per additional box (#290).

    The open-points ruling 4: the flagger's second approach is scanned by
    combining one box per approach, in today's (north-up, #299) shape.  The extra boxes join
    the SAME union, so it is still one round trip (the 2-per-IP rate limit
    is untouched) and Overpass de-duplicates an element two boxes share.
    Empty for a single corridor, so that query stays byte-identical.
    """
    lines: list[str] = []
    for south, west, north, east in boxes:
        box = f"{south:.6f},{west:.6f},{north:.6f},{east:.6f}"
        lines.extend(f"  {sel.format(box=box)}\n" for sel in _SCAN_SELECTORS)
    return "".join(lines)


def _build_bbox_query(bbox: tuple[float, float, float, float]) -> str:
    """Same feature buckets as :func:`_build_query` but scoped to a bbox."""
    south, west, north, east = bbox
    box = f"{south:.6f},{west:.6f},{north:.6f},{east:.6f}"
    return f"""[out:json][timeout:10];
(
  node({box})["highway"="traffic_signals"];
  node({box})["highway"="crossing"];
  way({box})["highway"="footway"];
  way({box})["footway"="sidewalk"];
  way({box})["highway"="cycleway"];
  way({box})["cycleway"];
  node({box})["amenity"="school"];
  way({box})["amenity"="school"];
  node({box})["railway"="level_crossing"];
  node({box})["amenity"="hospital"];
  way({box})["amenity"="hospital"];
  node({box})["highway"="motorway_junction"];
  way({box})["highway"="motorway_link"];
  way({box})["highway"="trunk_link"];
  way({box})["bridge"="yes"];
);
out center tags;
"""


def _build_folded_query(
    bbox: tuple[float, float, float, float],
    anchor_lat: float,
    anchor_lng: float,
    road_radius_m: float,
) -> str:
    """The site scan and the corridor bearing check in ONE round trip (#256 ruling c).

    Two named sets with two ``out`` statements, which is what makes the
    fold possible: the scan set keeps ``out center tags`` (no geometry —
    it only needs positions and tags) and the road set takes
    ``out geom tags`` (geometry is the bearing).  **Separable on the
    wire by exactly that**: a road element carries ``geometry``, a scan
    element does not.

    The scan set's selectors, bbox and output mode are BYTE-IDENTICAL to
    :func:`_build_bbox_query` — deliberately, so folding cannot move a
    bucket.  The road set is ``around:road_radius_m`` of the anchor, the
    same clause :func:`_build_road_at_query` already sends, so the
    bearing's candidate pool does not change either.  Measured by
    s2-arc31 (``out-levers2-60098ae``, L5-folded-1trip): 408 elements —
    396 scan, 12 road — for +14.8 % bytes and +9 ms over the tight scan
    alone, in one request instead of two budgets.
    """
    south, west, north, east = bbox
    box = f"{south:.6f},{west:.6f},{north:.6f},{east:.6f}"
    road = f"around:{road_radius_m:.0f},{anchor_lat},{anchor_lng}"
    return f"""[out:json][timeout:10];
(
  node({box})["highway"="traffic_signals"];
  node({box})["highway"="crossing"];
  way({box})["highway"="footway"];
  way({box})["footway"="sidewalk"];
  way({box})["highway"="cycleway"];
  way({box})["cycleway"];
  node({box})["amenity"="school"];
  way({box})["amenity"="school"];
  node({box})["railway"="level_crossing"];
  node({box})["amenity"="hospital"];
  way({box})["amenity"="hospital"];
  node({box})["highway"="motorway_junction"];
  way({box})["highway"="motorway_link"];
  way({box})["highway"="trunk_link"];
  way({box})["bridge"="yes"];
)->.scan;
.scan out center tags;
(
  way({road})["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link)$"];
)->.road;
.road out geom tags;
"""


def split_folded_elements(
    elements: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Split a folded payload into ``(scan_elements, road_elements)``.

    The road set is emitted with ``out geom tags`` and the scan set with
    ``out center tags``, so carrying ``geometry`` is the discriminator —
    the one s2-arc31 measured as clean ("12 carry geometry, 396 do not.
    Separable on the wire: yes").  A scan element never carries it,
    because nothing in the scan set asks for it.
    """
    road = [el for el in elements if el.get("geometry")]
    scan = [el for el in elements if not el.get("geometry")]
    return scan, road


def _empty_corridor_bucket(detail_msg: str = "") -> dict[str, Any]:
    out: dict[str, Any] = {"detected": False, "count": 0, "details": [], "features": []}
    if detail_msg:
        out["details"] = [detail_msg]
    return out


def _classified(
    bucket_name: str, corridor: WorkCorridor, coord: tuple[float, float]
) -> dict[str, Any]:
    """One feature's zone, stations and relevance against one corridor."""
    zone = corridor.classify_distance(coord[0], coord[1])
    along_ft = corridor.along_station_ft(coord[0], coord[1])
    lateral_ft = corridor.lateral_offset_ft(coord[0], coord[1])
    return {
        "zone": zone,
        "relevant": _is_feature_relevant(
            bucket_name, zone, along_ft, lateral_ft, corridor.total_length_ft
        ),
        "along_station_ft": round(along_ft, 1),
        "lateral_offset_ft": round(lateral_ft, 1),
    }


def detect_along_corridor(
    corridor: WorkCorridor,
    lateral_buffer_m: float = _CORRIDOR_LATERAL_BUFFER_M,
    budget_s: float | None = None,
    bearing_anchor: tuple[float, float, float] | None = None,
    approaches: list[tuple[str, WorkCorridor]] | None = None,
    distance_origin: tuple[float, float] | None = None,
) -> dict[str, Any]:
    """Query Overpass over the corridor's bounding box and bucket detections.

    Each detected feature is augmented with corridor-aware metadata
    (``zone``, ``relevant``, ``along_station_ft``) so that downstream
    layers can prefer features along the project corridor over features
    that merely happen to be inside its bbox.

    Returns a dict shaped like :func:`detect_site_conditions` but with
    each bucket additionally carrying:

    * ``features``: list of dicts with ``label``, ``zone``,
      ``relevant``, ``along_station_ft``, ``lateral_offset_ft``, and
      ``distance_to_anchor_m`` for the first ~5 detected features.
    * Bucket-level ``detected``/``count`` reflect only *relevant*
      features (zone in advance_warning/transition/buffer/work_zone/
      downstream) so existing callers see the same shape.

    On any network/parse failure, returns all-buckets-empty plus an
    ``error`` key carrying the failure message.  ``budget_s`` bounds the
    Overpass mirror race (see ``_overpass_request_with_fallback``); the
    in-generate scan passes its CHOSEN budget, the manual endpoint none.

    #251 (s2-arc22): the budgeted call also returns an ``overpass`` key —
    NOT a bucket — with ``mirror``, ``response_bytes``, ``remark`` and
    ``element_count`` (``None`` each when the transport was stubbed), so
    two scans of one corridor can be told apart on the wire.

    #256 ruling c: pass ``bearing_anchor`` as ``(lat, lng, radius_m)`` to
    fold the corridor bearing check into this same round trip.  The result
    arrives as a ``road_bearing`` key — NOT a bucket — carrying exactly
    what :func:`detect_road_bearing` returns plus its ``element_count``,
    so :func:`validate_corridor_against_osm` can derive the check without
    a second trip and without a second budget.  Omit it and this function
    behaves exactly as before: same query, same buckets, one set.

    #290: ``approaches`` names further approach corridors reaching the same
    work — the flagger's opposing traffic — as ``(id, corridor)``.  Each
    adds its own box to the same union (the open-points ruling 4), and a
    feature the first corridor does not count is classified against each
    in turn; the first that counts it tags the feature with its ``approach``
    id and the detail line names it.  ``distance_origin`` measures
    ``distance_to_anchor_m`` from the pin the operator marked instead of
    the corridor anchor (under the work-start model the anchor is a point
    the math moved to).  Both omitted: byte-identical to before.
    """
    buckets: dict[str, Any] = {
        "intersections": _empty_corridor_bucket(),
        "interchanges": _empty_corridor_bucket(),
        "sidewalks": _empty_corridor_bucket(),
        "bike_facilities": _empty_corridor_bucket(),
        "schools": _empty_corridor_bucket(),
        "railroad_crossings": _empty_corridor_bucket(),
        "hospitals": _empty_corridor_bucket(),
        # Placeholder until curvature analysis exists — carries the standard
        # corridor bucket shape so generic iteration over buckets is safe (#34).
        "road_curvature": _empty_corridor_bucket(
            "Road curvature analysis not implemented; assume straight."
        ),
    }
    buckets["interchanges"]["junction_refs"] = []

    bbox = corridor.corridor_bbox(
        lateral_buffer_m=lateral_buffer_m,
        longitudinal_buffer_m=_CORRIDOR_LONGITUDINAL_BUFFER_M,
    )
    # #256 ruling c: when the caller names a bearing anchor, ONE round trip
    # serves the scan and the corridor bearing check.  The scan set inside
    # the folded query is byte-identical to _build_bbox_query's, so folding
    # cannot move a bucket; what changes is that the payload also carries
    # the road set, which MUST be split off before categorising (a
    # motorway_link or trunk_link way in the road set would otherwise land
    # in `interchanges` and invent a detection — the one way this fold
    # could corrupt the scan).
    folded = bearing_anchor is not None
    if folded:
        assert bearing_anchor is not None  # narrowed for mypy
        anchor_lat, anchor_lng, road_radius_m = bearing_anchor
        query = _build_folded_query(bbox, anchor_lat, anchor_lng, road_radius_m)
    else:
        query = _build_bbox_query(bbox)
    extra = [
        c.corridor_bbox(
            lateral_buffer_m=lateral_buffer_m,
            longitudinal_buffer_m=_CORRIDOR_LONGITUDINAL_BUFFER_M,
        )
        for _id, c in (approaches or [])
    ]
    if extra:
        # Insert before the scan set's closing paren — the first line that
        # begins with ")", in both query shapes.
        head, sep, tail = query.partition("\n)")
        query = head + "\n" + _extra_box_selectors(extra).rstrip("\n") + sep + tail
    # Positional call when unbudgeted so the pre-phase-1 stubs
    # (``lambda q: ...``) keep working unchanged.
    if budget_s is None:
        payload, error = _overpass_request_with_fallback(query)
    else:
        fetch: dict[str, Any] = {}
        # #292 (R74): an answer #304's cleaning would empty loses the race.
        boxes = [bbox, *extra]
        circle = (anchor_lat, anchor_lng, road_radius_m) if folded else None
        payload, error = _overpass_request_with_fallback(
            query,
            budget_s=budget_s,
            meta=fetch,
            validate=lambda p: _emptied_by_cleaning(p, boxes, circle),
        )
        buckets["overpass"] = {
            "mirror": fetch.get("mirror"),
            "response_bytes": fetch.get("response_bytes"),
            "remark": fetch.get("remark"),
            "element_count": None,
        }
    if payload is None:
        buckets["error"] = error or "Overpass request failed"
        return buckets

    elements = payload.get("elements", []) or []
    if folded:
        # Split BEFORE anything reads the list (#256 ruling c).  The road
        # set is the geometry-carrying half; the scan half is what the
        # buckets are built from, exactly as before the fold.
        elements, road_elements = split_folded_elements(elements)
        buckets["road_bearing"] = _bearing_from_elements(
            road_elements, anchor_lat, anchor_lng, radius_m=road_radius_m
        )
        buckets["road_bearing"]["element_count"] = len(road_elements)
    # #304 (R60, R61): scan elements outside the scan's own boxes are
    # dropped before anything is built from them; the count is internal.
    elements, scan_dropped = _within_scan_boxes(elements, [bbox, *extra])
    buckets["dropped"] = {"scan_elements": scan_dropped}
    if "overpass" in buckets:
        # The scan half's count, so this figure keeps meaning what it meant
        # before the fold — the number of elements the BUCKETS were built
        # from, not the round trip's total.
        buckets["overpass"]["element_count"] = len(elements)

    for el in elements:
        bucket_name = _categorize(el)
        if bucket_name is None:
            continue
        bucket = buckets[bucket_name]

        coord = _element_coord(el)
        label = _label_for(el)

        feature: dict[str, Any]
        if coord is None:
            # No geometry → can't classify zone; still record but mark
            # irrelevant so it doesn't move checkbox state.
            feature = {
                "label": label,
                "zone": "outside",
                "relevant": False,
                "along_station_ft": None,
                "lateral_offset_ft": None,
                "distance_to_anchor_m": None,
            }
        else:
            origin = distance_origin or (corridor.anchor_lat, corridor.anchor_lng)
            anchor_dist_m = _haversine(origin[0], origin[1], coord[0], coord[1])
            classified = _classified(bucket_name, corridor, coord)
            if approaches:
                classified["approach"] = "primary"
                if not classified["relevant"]:
                    for approach_id, other in approaches:
                        candidate = _classified(bucket_name, other, coord)
                        if candidate["relevant"]:
                            classified = {**candidate, "approach": approach_id}
                            break
            feature = {
                "label": label,
                **classified,
                "distance_to_anchor_m": round(anchor_dist_m, 1),
            }

        if len(bucket["features"]) < 5:
            bucket["features"].append(feature)

        if feature["relevant"]:
            bucket["count"] += 1
            bucket["detected"] = True
            # A lateral-zone feature is relevant *because of* its lateral
            # offset (the per-bucket override) — state that margin, not
            # the station that hides it (#16: a path 140 ft out and one
            # 10 ft out must not read alike).
            if feature["zone"] == "lateral":
                display = f"{label} [lateral {feature['lateral_offset_ft']:.0f} ft off centerline]"
            else:
                display = f"{label} [{feature['zone']} @ {feature['along_station_ft']:.0f} ft]"
            if feature.get("approach") not in (None, "primary"):
                # #290: say which approach counted it — its station is in
                # that approach's own frame, not the first one's.
                display = display[:-1] + f", {feature['approach']} approach]"
            if len(bucket["details"]) < 5:
                bucket["details"].append(display)
            anchor_dist_m = feature["distance_to_anchor_m"]
            if anchor_dist_m is not None:
                existing = bucket.get("nearest_distance_m")
                if existing is None or anchor_dist_m < existing:
                    bucket["nearest_distance_m"] = anchor_dist_m
            if bucket_name == "interchanges":
                ref = _junction_ref(el)
                if ref and ref not in bucket["junction_refs"]:
                    bucket["junction_refs"].append(ref)

    return buckets


# ---------------------------------------------------------------------------
# OSM way bearing auto-detect
# ---------------------------------------------------------------------------


def _bearing_between(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Initial compass bearing from (lat1, lng1) to (lat2, lng2), in degrees [0, 360)."""
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dlambda = math.radians(lng2 - lng1)
    y = math.sin(dlambda) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(dlambda)
    bearing = math.degrees(math.atan2(y, x))
    return (bearing + 360.0) % 360.0


def _build_road_at_query(lat: float, lng: float, radius_m: float) -> str:
    r = f"{radius_m:.0f}"
    around = f"around:{r},{lat},{lng}"
    # Pull highway ways near the anchor along with their geometry so we
    # can compute a bearing; restrict to the typical motorized facility
    # tags to avoid grabbing footways or service roads.
    return f"""[out:json][timeout:10];
(
  way({around})["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link)$"];
);
out geom tags;
"""


def detect_road_bearing(
    lat: float,
    lng: float,
    radius_m: float = 30.0,
    budget_s: float | None = None,
) -> dict[str, Any]:
    """Best-effort estimate of the road bearing at (lat, lng).

    Queries Overpass for the nearest motorized highway way, finds the
    two nodes on its geometry that bracket the anchor point, and
    returns the bearing of that segment.

    Returns a dict with:

    * ``bearing_deg``: ``float | None`` — the estimated bearing, or
      ``None`` if no road could be matched.
    * ``oneway``: ``bool | None`` — ``True``/``False`` from the OSM
      ``oneway`` tag, or ``None`` if absent.  When ``oneway`` is
      ``False`` the returned bearing represents the way's digitization
      direction; the road serves traffic in *both* this bearing and
      its reciprocal.
    * ``way_id``: the matched OSM way id (or ``None``).
    * ``highway``: the matched ``highway`` tag value (or ``None``).
    * ``error``: error string when the query failed; otherwise absent.
    """
    out: dict[str, Any] = {
        "bearing_deg": None,
        "oneway": None,
        "way_id": None,
        "highway": None,
    }

    query = _build_road_at_query(lat, lng, radius_m)
    # #241: positional when unbudgeted so single-arg stubs keep working
    # (the phase-1 idiom in detect_along_corridor).
    payload, error = (
        _overpass_request_with_fallback(query)
        if budget_s is None
        else _overpass_request_with_fallback(
            query,
            budget_s=budget_s,
            # #292 (R74): cleaned against the road query's own circle.
            validate=lambda p: _emptied_by_cleaning(p, None, (lat, lng, radius_m)),
        )
    )
    if payload is None:
        out["error"] = error or "Overpass request failed"
        return out

    return _bearing_from_elements(payload.get("elements", []), lat, lng, out, radius_m=radius_m)


def _has_coords(point: Any) -> bool:
    """A geometry point with a numeric ``lat`` and ``lon`` (#304)."""
    return (
        isinstance(point, dict)
        and isinstance(point.get("lat"), (int, float))
        and isinstance(point.get("lon"), (int, float))
    )


# #304 (R60): an element must fall inside the box its own half of the query
# asked for -- a Denver scan never uses a road in Kazakhstan.
#
# Road ways come back with ``out geom`` and carry ``bounds``, so the test is
# exact: the way's bounds must meet the around-circle's bounding box.
#
# Scan elements come back with ``out center``: a node's point, or a way's
# centre, and a way that meets the box can have its centre outside it by up
# to its own half-extent.  CHOSEN (Rule 12): 5 km.  Measured on the real
# answers (validation-artifacts/committed/issue-304-scan-null-geometry/
# probes/query-boxes.txt): the largest legitimate gap is 227 m (Federal)
# and 34 m (the Lakewood fixture); the stray way that crashed the scan sat
# 14,137 km away.
_SCAN_ELEMENT_MARGIN_M: float = 5000.0
_M_PER_DEG_LAT: float = 111_320.0


def _gap_to_box_m(lat: float, lon: float, box: tuple[float, float, float, float]) -> float:
    """Metres from a point to ``box`` = (south, west, north, east); 0 inside."""
    s, w, n, e = box
    clat, clon = min(max(lat, s), n), min(max(lon, w), e)
    dlat = (lat - clat) * _M_PER_DEG_LAT
    dlon = (lon - clon) * _M_PER_DEG_LAT * math.cos(math.radians(clat))
    return math.hypot(dlat, dlon)


def _within_scan_boxes(
    elements: list[dict[str, Any]], boxes: list[tuple[float, float, float, float]]
) -> tuple[list[dict[str, Any]], int]:
    """(kept, dropped): scan elements whose point or centre is more than
    ``_SCAN_ELEMENT_MARGIN_M`` outside every scan box are dropped.  An element
    with no coordinate is kept -- it is already recorded as unclassifiable."""
    kept: list[dict[str, Any]] = []
    for el in elements:
        coord = _element_coord(el)
        if coord is None or min(_gap_to_box_m(*coord, b) for b in boxes) <= _SCAN_ELEMENT_MARGIN_M:
            kept.append(el)
    return kept, len(elements) - len(kept)


def _way_meets_circle(way: dict[str, Any], lat: float, lng: float, radius_m: float) -> bool:
    """A road way's bounds (else its resolvable points' box) meet the box of
    the ``around:radius_m`` circle at (lat, lng).  No resolvable extent: no."""
    b = way.get("bounds")
    if isinstance(b, dict) and all(
        isinstance(b.get(k), (int, float)) for k in ("minlat", "minlon", "maxlat", "maxlon")
    ):
        s, w, n, e = b["minlat"], b["minlon"], b["maxlat"], b["maxlon"]
    else:
        pts = [p for p in way.get("geometry") or [] if _has_coords(p)]
        if not pts:
            return False
        s, n = min(p["lat"] for p in pts), max(p["lat"] for p in pts)
        w, e = min(p["lon"] for p in pts), max(p["lon"] for p in pts)
    dlat = radius_m / _M_PER_DEG_LAT
    dlng = radius_m / (_M_PER_DEG_LAT * math.cos(math.radians(lat)))
    return not (n < lat - dlat or s > lat + dlat or e < lng - dlng or w > lng + dlng)


def _survives_cleaning(
    el: dict[str, Any],
    scan_boxes: list[tuple[float, float, float, float]] | None,
    road_circle: tuple[float, float, float] | None,
) -> bool:
    """Whether #304's downstream cleaning keeps anything of ``el``.

    The same predicates the cleaning applies, read here only to judge the
    whole answer (#292, R74), never to change it: a geometry element keeps
    its points with coordinates (``_bearing_from_elements`` skips the rest)
    and a road way must meet the query's ``around:`` circle; a scan element
    must sit within ``_SCAN_ELEMENT_MARGIN_M`` of a scan box
    (``_within_scan_boxes``, which also keeps an element with no
    coordinate).
    """
    geometry = el.get("geometry")
    if geometry is not None:
        if not any(_has_coords(pt) for pt in geometry):
            return False
        return not (
            road_circle is not None
            and el.get("type") == "way"
            and not _way_meets_circle(el, *road_circle)
        )
    if scan_boxes:
        coord = _element_coord(el)
        return coord is None or (
            min(_gap_to_box_m(*coord, b) for b in scan_boxes) <= _SCAN_ELEMENT_MARGIN_M
        )
    return True


def _emptied_by_cleaning(
    payload: dict[str, Any],
    scan_boxes: list[tuple[float, float, float, float]] | None,
    road_circle: tuple[float, float, float] | None,
) -> str | None:
    """Why an answer has no content left after #304's cleaning, or ``None``.

    #292, R74 (correcting R69): #304's checks CLEAN an answer -- null points
    skipped, anything outside the query box or search circle dropped --
    they don't disqualify it.  The first valid answer that still has
    content after cleaning wins.  A genuinely empty answer counts (an empty
    corridor is a measurement, Rule 10); only an answer that had elements
    and is cleaned down to nothing loses.
    """
    elements = payload.get("elements") or []
    if not elements:
        return None
    if any(_survives_cleaning(el, scan_boxes, road_circle) for el in elements):
        return None
    return f"cleaned to nothing: all {len(elements)} elements dropped by #304's checks"


def _bearing_from_elements(
    elements: list[dict[str, Any]],
    lat: float,
    lng: float,
    out: dict[str, Any] | None = None,
    radius_m: float | None = None,
) -> dict[str, Any]:
    """The bearing derivation, with no transport of its own (#256 ruling c).

    Split out of :func:`detect_road_bearing` so the folded round trip and
    the legacy separate trip share ONE predicate rather than growing a
    second copy (Rule 3).  ``elements`` is whatever carries way geometry —
    from the folded query's ``.road`` set or from the standalone query;
    the derivation cannot tell the difference and must not need to.
    """
    if out is None:
        out = {"bearing_deg": None, "oneway": None, "way_id": None, "highway": None}
    # #304 (R60, R61): internal only, never on the wire -- how many geometry
    # points carried no coordinates and were skipped.
    out["points_skipped"] = 0
    out["elements_dropped"] = 0
    ways = [el for el in elements if el.get("type") == "way"]
    if radius_m is not None:
        # #304 (R60): the query asked for ways around (lat, lng); a way whose
        # extent doesn't meet that circle's box is not an answer to it.
        inside = [w for w in ways if _way_meets_circle(w, lat, lng, radius_m)]
        out["elements_dropped"] = len(ways) - len(inside)
        ways = inside
    if not ways:
        return out

    # Pick the way whose geometry passes closest to the anchor.
    best_way: dict[str, Any] | None = None
    best_segment: tuple[dict[str, float], dict[str, float]] | None = None
    best_distance = math.inf

    for way in ways:
        geometry = way.get("geometry") or []
        # #304: a mirror can list a node it can't resolve as ``null`` (seen:
        # overpass.openstreetmap.fr, way 42125193).  A point without both
        # coordinates is not a point, so a segment touching one is not a
        # segment: skip it, never read it.
        out["points_skipped"] += sum(1 for p in geometry if not _has_coords(p))
        if len(geometry) < 2:
            continue
        for a, b in zip(geometry, geometry[1:], strict=False):
            if not (_has_coords(a) and _has_coords(b)):
                continue
            mid_lat = (a["lat"] + b["lat"]) / 2.0
            mid_lng = (a["lon"] + b["lon"]) / 2.0
            d = _haversine(lat, lng, mid_lat, mid_lng)
            if d < best_distance:
                best_distance = d
                best_way = way
                best_segment = (a, b)

    if best_way is None or best_segment is None:
        return out

    a, b = best_segment
    bearing = _bearing_between(a["lat"], a["lon"], b["lat"], b["lon"])
    tags = best_way.get("tags") or {}
    oneway_tag = tags.get("oneway")
    oneway = None
    if oneway_tag in {"yes", "true", "1"}:
        oneway = True
    elif oneway_tag in {"no", "false", "0"}:
        oneway = False

    out["bearing_deg"] = round(bearing, 2)
    out["oneway"] = oneway
    out["way_id"] = best_way.get("id")
    out["highway"] = tags.get("highway")
    return out


# ---------------------------------------------------------------------------
# Corridor-against-OSM validator
# ---------------------------------------------------------------------------

# Highway classes considered "major" for the no-road check.  These are the
# road types where work-zone plans are typically deployed; a closure on
# anything below tertiary is unusual enough that the planner should
# double-check the anchor coordinates.
_MAJOR_ROAD_CLASSES: frozenset[str] = frozenset(
    {
        "motorway",
        "trunk",
        "primary",
        "secondary",
        "motorway_link",
        "trunk_link",
        "primary_link",
        "secondary_link",
    }
)

# Search radius (m) when looking for the road at the anchor.  Anything
# closer than this is "on the road"; anything farther means the anchor
# is in a parking lot, off-ramp, or unrelated nearby terrain.
_VALIDATION_SEARCH_RADIUS_M: float = 50.0

# Minimum allowed angular agreement between the corridor's declared
# bearing and the OSM road's bearing (or its reciprocal — divided
# carriageways are tagged one-way and the closer-segment heuristic may
# pick the opposing direction).
_BEARING_CONFLICT_THRESHOLD_DEG: float = 15.0


def _shortest_bearing_delta_deg(a: float, b: float) -> float:
    """Smallest unsigned angle between two compass bearings, in [0, 180]."""
    diff = (a - b) % 360.0
    return min(diff, 360.0 - diff)


def validate_corridor_against_osm(
    anchor_lat: float,
    anchor_lng: float,
    corridor_bearing_deg: float | None,
    search_radius_m: float = _VALIDATION_SEARCH_RADIUS_M,
    bearing_threshold_deg: float = _BEARING_CONFLICT_THRESHOLD_DEG,
    budget_s: float | None = None,
    road_result: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Best-effort sanity check: corridor inputs vs. OSM ground truth.

    Two checks fire when Overpass is reachable:

      1. **No major road at anchor.**  If no motorway / trunk / primary /
         secondary way (or any of their ``_link`` variants) lies within
         ``search_radius_m`` of the anchor, the corridor's anchor is
         probably wrong — emit a ``no_road_at_anchor`` warning.
      2. **Bearing conflict.**  If a major road is found, compare its
         bearing (and its reciprocal — divided-highway carriageways are
         one-way and the closer-segment heuristic may report the opposing
         travel direction) against ``corridor_bearing_deg``.  If neither
         agrees within ``bearing_threshold_deg``, emit a
         ``bearing_conflict`` warning.

    Returns ``{"checked": bool, "warnings": list[dict]}``; when
    ``checked`` is False a ``reason`` key names the cause (#213 V4 —
    the single flag used to conflate three causes, and the audit PDF
    asserted "no site coordinates supplied" for all of them):

    * ``"not_run_no_coords"`` — inputs insufficient, nothing to check.
    * ``"check_unavailable"`` — Overpass never answered; an ``error``
      key carries the detail when the transport layer supplied one.

    Each warning is a dict with ``flag`` / ``level`` / ``message`` plus
    context fields.  Network or Overpass failures never raise — this is
    a soft check, never a render blocker — but they are no longer
    silent: the reason crosses the wire so every surface can say
    "not checked" honestly.
    """
    out: dict[str, Any] = {"checked": False, "warnings": []}

    if corridor_bearing_deg is None:
        # Without a declared bearing we can't compute the conflict
        # check, and the no-road check is itself less actionable —
        # skip entirely so a future bearing-less render path doesn't
        # noisily warn for every plan.  Same reason family as the
        # caller-side no-coords skip: the inputs weren't there.
        out["reason"] = "not_run_no_coords"
        return out

    if road_result is not None:
        # #256 ruling c: the folded round trip already fetched the road set
        # and derived the bearing.  No transport here, no second budget —
        # the check is a pure function of what the scan brought back.  A
        # scan that failed altogether never reaches this call, which is why
        # ``check_unavailable`` now means "the whole scan failed" and not
        # "the second trip failed".
        result = road_result
    else:
        try:
            result = detect_road_bearing(
                anchor_lat, anchor_lng, radius_m=search_radius_m, budget_s=budget_s
            )
        except Exception as exc:  # noqa: BLE001
            # Best-effort: any Overpass / network failure leaves
            # ``checked = False`` — but named, never mistaken for not-run.
            out["reason"] = "check_unavailable"
            out["error"] = f"{type(exc).__name__}: {exc}"
            return out

    if "error" in result and result.get("bearing_deg") is None:
        out["reason"] = "check_unavailable"
        out["error"] = str(result["error"])
        return out

    out["checked"] = True

    detected_highway = result.get("highway")
    if detected_highway is None or detected_highway not in _MAJOR_ROAD_CLASSES:
        # No major road within the radius — either nothing at all or a
        # residential / service / tertiary road.  Either way the
        # planner should re-verify coordinates.
        nearby_class = (
            f" (closest road within {search_radius_m:.0f} m: '{detected_highway}')"
            if detected_highway
            else ""
        )
        out["warnings"].append(
            {
                "flag": "no_road_at_anchor",
                "level": "warning",
                "message": (
                    "No motorway/trunk/primary/secondary road detected at anchor "
                    f"({anchor_lat:.5f}, {anchor_lng:.5f}) within {search_radius_m:.0f} m"
                    f"{nearby_class}.  "
                    "Verify coordinates correspond to the actual work zone."
                ),
                "anchor_lat": anchor_lat,
                "anchor_lng": anchor_lng,
                "detected_highway": detected_highway,
                "search_radius_m": search_radius_m,
            }
        )
        return out

    detected_bearing = result.get("bearing_deg")
    if detected_bearing is None:
        return out

    direct_delta = _shortest_bearing_delta_deg(corridor_bearing_deg, detected_bearing)
    reciprocal_delta = _shortest_bearing_delta_deg(
        corridor_bearing_deg, (detected_bearing + 180.0) % 360.0
    )
    delta = min(direct_delta, reciprocal_delta)
    if delta > bearing_threshold_deg:
        out["warnings"].append(
            {
                "flag": "bearing_conflict",
                "level": "warning",
                "message": (
                    f"Corridor bearing {corridor_bearing_deg:.1f}° conflicts with "
                    f"detected road bearing {detected_bearing:.1f}° at anchor "
                    f"({anchor_lat:.5f}, {anchor_lng:.5f}).  Smallest angle "
                    f"(incl. reciprocal): {delta:.1f}° > {bearing_threshold_deg:.0f}° "
                    "threshold.  Aerial overlay may not follow road geometry."
                ),
                "anchor_lat": anchor_lat,
                "anchor_lng": anchor_lng,
                "corridor_bearing_deg": corridor_bearing_deg,
                "detected_bearing_deg": detected_bearing,
                "delta_deg": delta,
                "detected_highway": detected_highway,
                "detected_way_id": result.get("way_id"),
            }
        )

    return out
