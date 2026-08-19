// Centerline chain stitching (#140), extracted verbatim from
// app/api/road-bearing/route.ts so the stitcher is unit-testable against
// recorded Overpass pools (the Lookout fixture pattern) — the route was
// the only untested link in the geometry chain (#210).
//
// This module owns: joining connected same-road ways into one node
// chain, and trimming that chain to the relayed-geometry window.  It
// relays raw OSM facts only — no MUTCD math lives here (Rule 3).

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

// Same haversine the route has always used for chain arc length.  Kept
// private with its original radius constant (6371008.8, vs geodesy.ts's
// 6371000) so the extraction changes no emitted coordinate or trim
// boundary by even a rounding step.
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

function endpointKey(n: StitchNode): string {
  return `${n.lat.toFixed(7)},${n.lon.toFixed(7)}`;
}

// Walk connected same-road ways into one node chain, starting from the
// candidate's own way.  Joins on shared endpoint nodes only.  A wrong
// branch at a fork is bounded by the ±GEOMETRY_RADIUS_M trim below and,
// downstream, by the station frame projecting the anchor — worst case
// is reduced coverage (disclosed), never a wrong drawing at the anchor.
export function stitchChain(startWay: StitchWay, pool: StitchWay[]): StitchNode[] {
  let chain = [...(startWay.geometry ?? [])];
  const used = new Set<number>([startWay.id]);
  let grew = true;
  while (grew) {
    grew = false;
    const head = endpointKey(chain[0]);
    const tail = endpointKey(chain[chain.length - 1]);
    for (const w of pool) {
      if (used.has(w.id)) continue;
      const g = w.geometry ?? [];
      if (g.length < 2) continue;
      const s = endpointKey(g[0]);
      const e = endpointKey(g[g.length - 1]);
      if (s === tail) {
        chain = chain.concat(g.slice(1));
      } else if (e === tail) {
        chain = chain.concat([...g].reverse().slice(1));
      } else if (e === head) {
        chain = g.slice(0, -1).concat(chain);
      } else if (s === head) {
        chain = [...g].reverse().slice(0, -1).concat(chain);
      } else {
        continue;
      }
      used.add(w.id);
      grew = true;
    }
  }
  return chain;
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
