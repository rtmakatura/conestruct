"""s2-arc31 investigate — #256: where the 20 s goes, and what each lever costs.

    python s2a31_overpass.py <outDir> [wireJson] [repeats]

This probe times the SAME queries the product builds — it imports the
product's own builders (``build_corridor``, ``_build_bbox_query``,
``_build_road_at_query``) rather than retyping them, so a drift in the
query is a drift in this measurement too.

!!  READ THIS BEFORE BELIEVING A NUMBER BELOW  !!
!!
!!  This runs from the DEVELOPER'S machine and egress IP.  Production
!!  runs from Modal's.  Overpass rate-limits and queues PER IP
!!  (see the /api/status block this probe prints first: it names the
!!  rate limit and how many slots this IP has free RIGHT NOW).
!!  Therefore:
!!    * The TRANSFER and PARSE terms here are the query's intrinsic
!!      cost and DO carry over to prod.
!!    * The QUEUE/TTFB term does NOT.  A fast TTFB here is not evidence
!!      prod will see a fast TTFB; it is evidence this IP was not
!!      queued at this minute.  Only s2a31-prod.js measures what Modal
!!      experiences.
!!  Any conclusion drawn from this file that depends on TTFB must be
!!  stated as a hypothesis, never as a prod measurement.
!!
!!  Second caveat: Overpass load is a property of the hour.  Every
!!  table below is stamped with the UTC time it was taken and is
!!  comparable only to another table taken the same way.
"""

from __future__ import annotations

import json
import socket
import ssl
import sys
import time
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urlparse

REPO = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(REPO))

import httpx  # noqa: E402

from src.rules.corridor import build_corridor  # noqa: E402
from src.rules.site_detection import (  # noqa: E402
    _CORRIDOR_LATERAL_BUFFER_M,
    _CORRIDOR_LONGITUDINAL_BUFFER_M,
    _VALIDATION_SEARCH_RADIUS_M,
    HTTP_TIMEOUT_S,
    OVERPASS_MIRRORS,
    USER_AGENT,
    _build_bbox_query,
    _build_road_at_query,
    _categorize,
)

OUT = Path(sys.argv[1] if len(sys.argv) > 1 else "out-overpass")
WIRE = Path(sys.argv[2]) if len(sys.argv) > 2 else None
REPEATS = int(sys.argv[3]) if len(sys.argv) > 3 else 3
OUT.mkdir(parents=True, exist_ok=True)
LOG = OUT / "log.txt"


def log(s: str = "") -> None:
    print(s, flush=True)
    with LOG.open("a", encoding="utf-8") as fh:
        fh.write(s + "\n")


def banner() -> None:
    for line in __doc__.splitlines():
        if line.startswith("!!"):
            log(line)


# ---------------------------------------------------------------------------
# Phase timing: DNS -> TCP -> TLS are measured with a bare socket against the
# same host, then the HTTP request is timed separately for TTFB and transfer.
# ---------------------------------------------------------------------------


def dial_phases(url: str) -> dict[str, float | str | None]:
    host = urlparse(url).hostname or ""
    out: dict[str, float | str | None] = {"host": host}
    t0 = time.perf_counter()
    try:
        infos = socket.getaddrinfo(host, 443, proto=socket.IPPROTO_TCP)
    except OSError as exc:
        out["dns_ms"] = None
        out["error"] = f"dns: {exc}"
        return out
    out["dns_ms"] = round((time.perf_counter() - t0) * 1000, 1)
    addr = infos[0][4]
    t1 = time.perf_counter()
    try:
        sock = socket.create_connection(addr, timeout=10)
    except OSError as exc:
        out["connect_ms"] = None
        out["error"] = f"connect: {exc}"
        return out
    out["connect_ms"] = round((time.perf_counter() - t1) * 1000, 1)
    t2 = time.perf_counter()
    try:
        ctx = ssl.create_default_context()
        with ctx.wrap_socket(sock, server_hostname=host):
            out["tls_ms"] = round((time.perf_counter() - t2) * 1000, 1)
    except OSError as exc:
        out["tls_ms"] = None
        out["error"] = f"tls: {exc}"
    finally:
        try:
            sock.close()
        except OSError:
            pass
    return out


def post_query(url: str, query: str, timeout_s: float = HTTP_TIMEOUT_S) -> dict:
    """POST one query and split the wall into TTFB / transfer / parse."""
    row: dict = {"url": url, "chars": len(query)}
    t0 = time.perf_counter()
    try:
        with httpx.Client(timeout=timeout_s, headers={"User-Agent": USER_AGENT}) as client:
            with client.stream("POST", url, data={"data": query}) as resp:
                row["status"] = resp.status_code
                row["ttfb_ms"] = round((time.perf_counter() - t0) * 1000, 1)
                t1 = time.perf_counter()
                body = resp.read()
                row["transfer_ms"] = round((time.perf_counter() - t1) * 1000, 1)
    except httpx.HTTPError as exc:
        row["status"] = None
        row["error"] = f"{type(exc).__name__}: {exc}"
        row["total_ms"] = round((time.perf_counter() - t0) * 1000, 1)
        return row
    row["bytes"] = len(body)
    t2 = time.perf_counter()
    try:
        payload = json.loads(body)
    except ValueError as exc:
        row["parse_ms"] = None
        row["error"] = f"invalid JSON: {exc}"
        row["total_ms"] = round((time.perf_counter() - t0) * 1000, 1)
        return row
    row["parse_ms"] = round((time.perf_counter() - t2) * 1000, 1)
    els = payload.get("elements", []) or []
    row["elements"] = len(els)
    remark = payload.get("remark")
    row["remark"] = (remark.strip().splitlines()[0] if isinstance(remark, str) and remark.strip() else None)
    row["total_ms"] = round((time.perf_counter() - t0) * 1000, 1)
    row["_payload"] = payload
    return row


def brief(row: dict) -> str:
    return (
        f"status={row.get('status')} total={row.get('total_ms')}ms "
        f"ttfb={row.get('ttfb_ms')} transfer={row.get('transfer_ms')} parse={row.get('parse_ms')} "
        f"bytes={row.get('bytes')} elements={row.get('elements')} remark={row.get('remark')}"
        + (f" error={row['error']}" if row.get("error") else "")
    )


def mirror_status(url: str) -> str:
    """Overpass /api/status names the per-IP rate limit and free slots.

    This is the instrument for the queue hypothesis: a request that waits
    for a slot spends that wait inside TTFB, and [timeout:N] does not
    bound it — [timeout:N] bounds EXECUTION once a slot is granted.
    """
    status_url = url.replace("/api/interpreter", "/api/status")
    try:
        r = httpx.get(status_url, timeout=15, headers={"User-Agent": USER_AGENT})
        return r.text.strip().replace("\n", " | ")[:400]
    except httpx.HTTPError as exc:
        return f"unavailable: {type(exc).__name__}: {exc}"


def buckets_of(payload: dict) -> dict[str, int]:
    counts: dict[str, int] = {}
    for el in payload.get("elements", []) or []:
        name = _categorize(el)
        if name:
            counts[name] = counts.get(name, 0) + 1
    return dict(sorted(counts.items()))


def split_queries(query: str) -> list[str]:
    """One union query -> one query per clause, same header and footer."""
    head, _, rest = query.partition("(\n")
    body, _, _tail = rest.partition(");")
    clauses = [c.strip() for c in body.splitlines() if c.strip()]
    return [f"{head}(\n  {c}\n);\nout center tags;\n" for c in clauses]


def main() -> None:
    log(f"=== s2-arc31 Overpass decomposition — started {datetime.now(UTC).isoformat(timespec='seconds')} ===")
    banner()
    log("")

    # ---- the corridor, built by the product's own builder -----------------
    if WIRE and WIRE.exists():
        # Translate the wire's roadType with the PRODUCT's own mapper, not a
        # retyped table: the wire carries the TS token (rural_divided) and
        # only ``_map_road_type`` knows how it becomes the backend's MUTCD
        # Table 6B-1 category (schemas.py:822-850).  ``scenario_to_call``
        # would be the fuller path but it loads the jurisdiction record,
        # which needs jsonschema/shapely — deps the render image has and this
        # machine does not.  The corridor kwargs below are the ones
        # run_site_scan passes (site_scan.py:620-645), read from the wire.
        from src.api.schemas import _map_road_type

        raw = json.loads(WIRE.read_text(encoding="utf-8"))["scenario"]
        params = dict(
            lat=float(raw["meta"]["lat"]), lng=float(raw["meta"]["lng"]),
            bearing_deg=float(raw["meta"]["bearingDeg"]),
            speed_mph=int(raw["speed"]),
            work_zone_ft=float(raw["workLen"]),
            closure_type=str(raw["kind"]),
            road_type=_map_road_type(str(raw["roadType"]), int(raw["speed"])),
            lane_width_ft=float(raw.get("laneWidth") or 12.0),
        )
        log(f"corridor params from the CAPTURED WIRE {WIRE.name}:")
        log(f"  wire roadType={raw.get('roadType')!r} divided={raw.get('divided')!r} speed={raw.get('speed')!r}"
            f"  -> backend road_type={params['road_type']!r} (via _map_road_type)")
        log(f"  {params}")
    else:
        params = dict(lat=39.7269, lng=-104.9873, bearing_deg=180.0, speed_mph=65,
                      work_zone_ft=1000.0, closure_type="shoulder",
                      road_type="rural_divided", lane_width_ft=12.0)
        log(f"!! no wire file given — params are CHOSEN to match the sandbox defaults: {params}")
        log("!! if the live wire differs, every bbox number below is for a different corridor.")

    wide = build_corridor(**params, downstream_taper_use_max=True)
    tight = build_corridor(**params, downstream_taper_use_max=False)
    bb_wide = wide.corridor_bbox(lateral_buffer_m=_CORRIDOR_LATERAL_BUFFER_M,
                                 longitudinal_buffer_m=_CORRIDOR_LONGITUDINAL_BUFFER_M)
    bb_tight = tight.corridor_bbox(lateral_buffer_m=_CORRIDOR_LATERAL_BUFFER_M,
                                   longitudinal_buffer_m=_CORRIDOR_LONGITUDINAL_BUFFER_M)

    def span(bb):
        s_, w_, n_, e_ = bb
        # metres, good enough at this latitude for a size comparison
        return (round((n_ - s_) * 111_320, 1), round((e_ - w_) * 111_320 * 0.77, 1))

    log("")
    log("-- bbox geometry (the scan's search frame) --")
    log(f"downstream_taper_use_max=True  (what the scan sends, site_scan.py:641): {bb_wide} "
        f"~{span(bb_wide)[0]} m N-S x {span(bb_wide)[1]} m E-W  corridor_len={wide.total_length_ft:.0f} ft")
    log(f"downstream_taper_use_max=False (the plan's own corridor):              {bb_tight} "
        f"~{span(bb_tight)[0]} m N-S x {span(bb_tight)[1]} m E-W  corridor_len={tight.total_length_ft:.0f} ft")

    q_wide = _build_bbox_query(bb_wide)
    q_tight = _build_bbox_query(bb_tight)
    q_bearing = _build_road_at_query(params["lat"], params["lng"], _VALIDATION_SEARCH_RADIUS_M)
    (OUT / "query-wide.overpassql").write_text(q_wide, encoding="utf-8")
    (OUT / "query-tight.overpassql").write_text(q_tight, encoding="utf-8")
    (OUT / "query-bearing.overpassql").write_text(q_bearing, encoding="utf-8")

    rows: list[dict] = []

    # ---- mirror health and the dial phases --------------------------------
    log("")
    log("-- mirror /api/status (per-IP rate limit and free slots) and dial phases --")
    for url in OVERPASS_MIRRORS:
        log(f"  {url}")
        log(f"    status: {mirror_status(url)}")
        log(f"    dial:   {dial_phases(url)}")

    # ---- L1: the scan query as shipped, on each mirror, repeated ----------
    log("")
    log(f"-- L1: the shipped union query [timeout:10] on the use_max bbox, x{REPEATS} per mirror --")
    for url in OVERPASS_MIRRORS:
        for i in range(REPEATS):
            r = post_query(url, q_wide)
            payload = r.pop("_payload", None)
            r.update(lever="L1-shipped", mirror=url, run=i + 1)
            rows.append(r)
            log(f"  [{url.split('//')[1].split('/')[0]} #{i+1}] {brief(r)}")
            if payload is not None and i == 0 and url == OVERPASS_MIRRORS[0]:
                (OUT / "payload-wide.json").write_text(json.dumps(payload)[:2_000_000], encoding="utf-8")
                log(f"    buckets: {buckets_of(payload)}")

    m0 = OVERPASS_MIRRORS[0]

    # ---- L2: the query's own [timeout:N] ----------------------------------
    log("")
    log("-- L2: [timeout:10] (shipped) vs [timeout:20] vs [timeout:25] on mirror 1 --")
    log("   [timeout:N] bounds Overpass EXECUTION, not the wait for a slot.")
    for n in (10, 20, 25):
        q = q_wide.replace("[timeout:10]", f"[timeout:{n}]")
        r = post_query(m0, q)
        r.pop("_payload", None)
        r.update(lever=f"L2-timeout{n}", mirror=m0, run=1)
        rows.append(r)
        log(f"  [timeout:{n}] {brief(r)}")

    # ---- L3: the bbox (use_max ceiling vs the plan's corridor) ------------
    log("")
    log("-- L3: the use_max bbox vs the tight bbox — cost AND recall --")
    r_wide = post_query(m0, q_wide)
    p_wide = r_wide.pop("_payload", None)
    r_wide.update(lever="L3-bbox-wide", mirror=m0, run=1)
    rows.append(r_wide)
    log(f"  wide  {brief(r_wide)}")
    r_tight = post_query(m0, q_tight)
    p_tight = r_tight.pop("_payload", None)
    r_tight.update(lever="L3-bbox-tight", mirror=m0, run=1)
    rows.append(r_tight)
    log(f"  tight {brief(r_tight)}")
    if p_wide and p_tight:
        bw, bt = buckets_of(p_wide), buckets_of(p_tight)
        log(f"  buckets wide : {bw}")
        log(f"  buckets tight: {bt}")
        lost = {k: bw.get(k, 0) - bt.get(k, 0) for k in bw if bw.get(k, 0) != bt.get(k, 0)}
        log(f"  RECALL COST of the tight bbox (elements no longer fetched, per bucket): {lost or 'none'}")
        log("  NOTE: a fetched element is not a RELEVANT one — relevance is decided by")
        log("  _is_feature_relevant() against the corridor frame, which this probe does not run.")
        log("  These are fetch counts; the flag-level cost is <= this and needs the detector.")

    # ---- L4: split the union into per-clause queries -----------------------
    log("")
    log("-- L4: one union query vs one query per clause (15 trips) --")
    parts = split_queries(q_wide)
    t0 = time.perf_counter()
    tot_bytes = tot_els = 0
    worst = 0.0
    for j, q in enumerate(parts, 1):
        r = post_query(m0, q)
        r.pop("_payload", None)
        r.update(lever="L4-split", mirror=m0, run=j)
        rows.append(r)
        tot_bytes += r.get("bytes") or 0
        tot_els += r.get("elements") or 0
        worst = max(worst, r.get("total_ms") or 0)
        log(f"  clause {j:2d}/{len(parts)} {brief(r)}")
    log(f"  SPLIT TOTAL: {round((time.perf_counter()-t0)*1000,1)}ms serial over {len(parts)} trips, "
        f"{tot_bytes} B, {tot_els} elements, slowest single clause {worst}ms")
    log("  (serial is the fair comparison: the product's mirror chain is serial and the")
    log("   budget is wall-clock.  A parallel split would need a different budget shape.)")

    # ---- L5: the corridor bearing check, and the two trips back to back ----
    log("")
    log("-- L5: the corridor bearing check's own query, and the two-trip sequence --")
    r_b = post_query(m0, q_bearing)
    r_b.pop("_payload", None)
    r_b.update(lever="L5-bearing-alone", mirror=m0, run=1)
    rows.append(r_b)
    log(f"  bearing alone (radius {_VALIDATION_SEARCH_RADIUS_M:.0f} m, out geom tags) {brief(r_b)}")
    log("  now the product's real sequence: site scan, then bearing check immediately after,")
    log("  from one client to one mirror — the second trip is where a per-IP slot limit bites.")
    t0 = time.perf_counter()
    r_s1 = post_query(m0, q_wide)
    r_s1.pop("_payload", None)
    r_s1.update(lever="L5-seq-scan", mirror=m0, run=1)
    rows.append(r_s1)
    r_s2 = post_query(m0, q_bearing)
    r_s2.pop("_payload", None)
    r_s2.update(lever="L5-seq-bearing", mirror=m0, run=1)
    rows.append(r_s2)
    log(f"  trip 1 (scan)    {brief(r_s1)}")
    log(f"  trip 2 (bearing) {brief(r_s2)}")
    log(f"  SEQUENCE TOTAL {round((time.perf_counter()-t0)*1000,1)}ms  "
        f"(prod budgets these separately: 20 s + 20 s, site_scan.py:69 + site_detection.py:44)")

    (OUT / "rows.json").write_text(json.dumps(rows, indent=1), encoding="utf-8")
    log("")
    log(f"wrote {len(rows)} rows  finished {datetime.now(UTC).isoformat(timespec='seconds')}")


if __name__ == "__main__":
    main()
