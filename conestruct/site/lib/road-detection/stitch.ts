// Centerline chain stitching (#140, rebuilt by #210).
//
// The pre-#210 stitcher joined same-name ways by shared endpoint node
// only, with no direction sense.  Two measured failure modes (E Bayaud
// Ave at S Colorado Blvd, recorded pool in
// tests/fixtures/centerline/bayaud_colorado_pool.json):
//   1. Divided crossings: the road's continuation across a divided
//      arterial starts at a different node (~29-50 m away), so the
//      chain stopped at the near curb and the station frame drew the
//      remaining corridor as a straight tangent ray (20 ft of 3,110 ft
//      covered at the reproduction pin).
//   2. Oneway couplets: both halves join by endpoints, so the walk
//      consumed the return half and the chain doubled back on itself
//      (a hairpin — adjacent segment headings reversing 179°),
//      corrupting every arc-length station behind it.
// The rebuilt stitcher: progress-constrained joins (a joined way must
// continue roughly the chain's end heading — couplet returns ~180° and
// perpendicular branches ~90° are refused), bounded-gap bridging across
// divided crossings, a oneway tie-break so the chain prefers one
// consistent travel thread, and a post-stitch reversal invariant that
// truncates rather than relays a corrupt chain.  Failure mode is always
// refusal — honest short coverage, disclosed by the drawing surfaces
// (#211) — never a wrong link.
//
// This module relays raw OSM facts only — no MUTCD math (Rule 3).

export interface StitchNode {
  lat: number;
  lon: number;
}

export interface StitchWay {
  id: number;
  geometry?: StitchNode[];
  tags?: Record<string, string>;
}

// Centerline capture (#140).  The corridor's advance-warning end can sit
// most of a mile upstream of the pin, so candidate geometry is extended
// by a second Overpass fetch of same-name/ref ways within this radius
// and stitched into one chain.  1,700 m ≈ 1.06 mi — chosen to cover the
// longest corridor (freeway advance warning) with margin.  The node cap
// bounds the relayed payload and the encoded Static-URL path (chosen —
// see meta.centerline / WorkCorridor.centerline consumers).
export const GEOMETRY_RADIUS_M = 1700;
export const GEOMETRY_MAX_NODES = 300;

// CHOSEN (#210, 2026-08-19): maximum endpoint gap a bridge may span
// when no shared endpoint exists.  Measured basis: the E Bayaud
// continuation across divided S Colorado Blvd sits 29 m from the chain
// end (the defect this bound exists to fix); typical divided-arterial
// crossings run 30-60 m.  60 m stays below Denver block spacing, so a
// bridge can never skip a whole block, and refuses the measured 197 m
// genuine discontinuity on E Cedar Ave (which must stay an honest gap).
// No MUTCD source assigns this distance — it is a data-repair bound,
// not a traffic-control value.
export const STITCH_GAP_MAX_M = 60;

// CHOSEN (#210, 2026-08-19): a joined way's initial heading (and a
// bridge connector's heading) must lie within this many degrees of the
// chain's end heading.  Accepts urban curvature and skewed crossings;
// refuses couplet return halves (~180°) and perpendicular same-name
// branches (~90°).  Known recorded cost: a true switchback AT A WAY
// BOUNDARY truncates the chain there — honest disclosed coverage
// (#211) instead of a followed switchback.  Lookout Mountain Road's
// sharpest measured join is 27°, unaffected.
export const STITCH_HEADING_TOL_DEG = 60;

// CHOSEN (#210, 2026-08-19): adjacent-segment heading reversal that the
// post-stitch invariant treats as a hairpin.  Real stitched chains
// measured max 44° adjacent delta post-fix (six-site table in the arc
// evidence); the recorded defect chain reverses 179°.  Roads do not
// reverse direction between adjacent polyline segments; couplet
// double-backs do.
export const STITCH_REVERSAL_DEG = 150;

// Same haversine the route has always used for chain arc length.  Kept
// private with its original radius constant (6371008.8, vs geodesy.ts's
// 6371000) so extraction and rebuild change no trim boundary rounding.
function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371008.8;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function bearingDeg(a: StitchNode, b: StitchNode): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const phi1 = toRad(a.lat);
  const phi2 = toRad(b.lat);
  const dLambda = toRad(b.lon - a.lon);
  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function headingDiff(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180);
}

function endpointKey(n: StitchNode): string {
  return `${n.lat.toFixed(7)},${n.lon.toFixed(7)}`;
}

// Heading of the chain leaving its end (outward: toward where a new way
// would attach).
function endHeading(chain: StitchNode[], atTail: boolean): number {
  return atTail
    ? bearingDeg(chain[chain.length - 2], chain[chain.length - 1])
    : bearingDeg(chain[1], chain[0]);
}

// A way's travel direction relative to its vertex order: true = along
// vertex order (oneway=yes), false = against it (oneway=-1), null = both.
function travelForward(w: StitchWay): boolean | null {
  const ow = w.tags?.oneway;
  if (ow === "yes") return true;
  if (ow === "-1") return false;
  return null;
}

interface JoinOption {
  way: StitchWay;
  // Geometry to append at the chain end, oriented outward; includes the
  // joining endpoint when it bridges a gap (the synthetic connector is
  // the straight segment chain-end → oriented[0], real distance the
  // frame's arc length must count), excludes it on an exact join.
  append: StitchNode[];
  gapM: number; // 0 on an exact endpoint join
  exact: boolean;
  onewayAgrees: boolean;
}

function joinOption(
  chain: StitchNode[],
  w: StitchWay,
  atTail: boolean,
): JoinOption | null {
  const g = w.geometry ?? [];
  if (g.length < 2) return null;
  const end = atTail ? chain[chain.length - 1] : chain[0];
  const ch = endHeading(chain, atTail);
  let best: JoinOption | null = null;
  for (const reversed of [false, true]) {
    const oriented = reversed ? [...g].reverse() : g;
    const exact = endpointKey(oriented[0]) === endpointKey(end);
    const gapM = exact ? 0 : haversineM(end.lat, end.lon, oriented[0].lat, oriented[0].lon);
    if (!exact && gapM > STITCH_GAP_MAX_M) continue;
    // The way must continue the chain's outward heading…
    const wayHeading = bearingDeg(oriented[0], oriented[1]);
    if (headingDiff(wayHeading, ch) > STITCH_HEADING_TOL_DEG) continue;
    // …and so must the bridge connector itself, so a bridge can only
    // reach forward across a crossing, never sideways to a parallel
    // carriageway or backward.
    if (!exact) {
      const gapHeading = bearingDeg(end, oriented[0]);
      if (headingDiff(gapHeading, ch) > STITCH_HEADING_TOL_DEG) continue;
    }
    // Oneway tie-break: does this way's travel direction run along the
    // chain's tail-ward thread?  (Tail-ward = the own way's vertex
    // order; head growth walks the thread backward.)  Two-way ways are
    // always agreeable.
    const tf = travelForward(w);
    const alongTailward = atTail ? !reversed : reversed;
    const onewayAgrees = tf === null ? true : tf === alongTailward;
    const opt: JoinOption = {
      way: w,
      append: exact ? oriented.slice(1) : oriented,
      gapM,
      exact,
      onewayAgrees,
    };
    if (best === null || compareOptions(opt, best) < 0) best = opt;
  }
  return best;
}

// Preference order: exact endpoint join > bridge; oneway thread
// agreement; smaller gap; smaller way id (determinism regardless of
// Overpass element order).
function compareOptions(a: JoinOption, b: JoinOption): number {
  if (a.exact !== b.exact) return a.exact ? -1 : 1;
  if (a.onewayAgrees !== b.onewayAgrees) return a.onewayAgrees ? -1 : 1;
  if (a.gapM !== b.gapM) return a.gapM - b.gapM;
  return a.way.id - b.way.id;
}

export interface StitchResult {
  chain: StitchNode[];
  usedWayIds: number[];
  // Bridged gaps, [wayId, meters] — recorded so callers/tests can see
  // every synthetic connector the chain carries.
  bridges: Array<[number, number]>;
}

/**
 * Walk same-road ways into one node chain, starting from the
 * candidate's own way.  Joins prefer exact shared endpoints, then
 * bounded-gap bridges (≤ STITCH_GAP_MAX_M); every join must continue
 * the chain's end heading within STITCH_HEADING_TOL_DEG, which refuses
 * couplet return halves and perpendicular branches.  Ties prefer the
 * way whose oneway travel direction runs along the chain's thread, then
 * the smaller gap, then the smaller way id (determinism).  Failure mode
 * is refusal: the chain simply stops growing — reduced coverage the
 * drawing surfaces disclose (#211), never a wrong link.
 */
export function stitchChainDetailed(startWay: StitchWay, pool: StitchWay[]): StitchResult {
  let chain = [...(startWay.geometry ?? [])];
  const used = new Set<number>([startWay.id]);
  const bridges: Array<[number, number]> = [];
  for (const atTail of [true, false]) {
    let grew = true;
    while (grew) {
      grew = false;
      let best: JoinOption | null = null;
      for (const w of pool) {
        if (used.has(w.id)) continue;
        const opt = joinOption(chain, w, atTail);
        if (opt === null) continue;
        if (best === null || compareOptions(opt, best) < 0) best = opt;
      }
      if (best !== null) {
        chain = atTail ? chain.concat(best.append) : [...best.append].reverse().concat(chain);
        used.add(best.way.id);
        if (!best.exact) bridges.push([best.way.id, best.gapM]);
        grew = true;
      }
    }
  }
  return { chain, usedWayIds: [...used].sort((a, b) => a - b), bridges };
}

/** Chain-only wrapper — the route's call site. */
export function stitchChain(startWay: StitchWay, pool: StitchWay[]): StitchNode[] {
  return stitchChainDetailed(startWay, pool).chain;
}

/**
 * Post-stitch invariant: no chain may double back.  Scans outward from
 * the vertex nearest (refLat, refLng) and truncates at the first
 * adjacent-segment heading reversal ≥ STITCH_REVERSAL_DEG on each side
 * — the side away from the reference point is cut, the side holding it
 * is kept, so a bad stitch degrades to honest short coverage instead of
 * a corrupt frame.  With the join constraints above this should never
 * fire; it is the belt to their suspenders (red-tested against the
 * recorded pre-fix hairpin chain).
 */
export function truncateAtReversal(
  chain: StitchNode[],
  refLat: number,
  refLng: number,
): StitchNode[] {
  if (chain.length < 3) return chain;
  let refIdx = 0;
  let refDist = Infinity;
  for (let i = 0; i < chain.length; i++) {
    const d = haversineM(refLat, refLng, chain[i].lat, chain[i].lon);
    if (d < refDist) {
      refDist = d;
      refIdx = i;
    }
  }
  let hi = chain.length - 1;
  for (let i = Math.max(refIdx, 1); i < chain.length - 1; i++) {
    const h1 = bearingDeg(chain[i - 1], chain[i]);
    const h2 = bearingDeg(chain[i], chain[i + 1]);
    if (headingDiff(h1, h2) >= STITCH_REVERSAL_DEG) {
      hi = i;
      break;
    }
  }
  let lo = 0;
  for (let i = Math.min(refIdx, chain.length - 2); i > 0; i--) {
    const h1 = bearingDeg(chain[i - 1], chain[i]);
    const h2 = bearingDeg(chain[i], chain[i + 1]);
    if (headingDiff(h1, h2) >= STITCH_REVERSAL_DEG) {
      lo = i;
      break;
    }
  }
  return chain.slice(lo, hi + 1);
}

// Trim the chain to ±GEOMETRY_RADIUS_M of along-arc distance from the
// point nearest (refLat, refLng), then cap the node count by uniform
// interior decimation (ends always kept).
export function trimChain(
  chain: StitchNode[],
  refLat: number,
  refLng: number,
): Array<[number, number]> {
  const cum: number[] = [0];
  for (let i = 0; i < chain.length - 1; i++) {
    cum.push(
      cum[i] + haversineM(chain[i].lat, chain[i].lon, chain[i + 1].lat, chain[i + 1].lon),
    );
  }
  let refIdx = 0;
  let refDist = Infinity;
  for (let i = 0; i < chain.length; i++) {
    const d = haversineM(refLat, refLng, chain[i].lat, chain[i].lon);
    if (d < refDist) {
      refDist = d;
      refIdx = i;
    }
  }
  const refArc = cum[refIdx];
  let kept = chain.filter((_, i) => Math.abs(cum[i] - refArc) <= GEOMETRY_RADIUS_M);
  if (kept.length > GEOMETRY_MAX_NODES) {
    const interior = kept.slice(1, -1);
    const stride = interior.length / (GEOMETRY_MAX_NODES - 2);
    kept = [
      kept[0],
      ...Array.from(
        { length: GEOMETRY_MAX_NODES - 2 },
        (_, i) => interior[Math.floor(i * stride)],
      ),
      kept[kept.length - 1],
    ];
  }
  return kept.map((n): [number, number] => [n.lat, n.lon]);
}
