// #512 (Ryan, 2026-11-11): the road list's travel words come from the
// Python backend's one-way reading, the one that decides the sides
// (`/render/road-travel`), never from a rule here.  This module only
// relays each entry's raw facts and attaches the backend's answer.
import type { RoadCandidate, RoadTravel } from "./types";

// CHOSEN (non-safety, #512): how long the road lookup waits for the
// backend's words before listing the roads without them.  The lookup
// itself already waited on Overpass; a cold backend must not hold the
// list.  On a miss each row shows only its distance (Rule 10).
export const ROAD_TRAVEL_TIMEOUT_MS = 2500;

const TRAVELS = new Set(["one_way", "both_ways", "changes_by_time", "unknown"]);
const VERDICTS = new Set(["one_way_street", "divided", "undivided", "undecided", "not_applicable"]);

function facts(c: RoadCandidate) {
  return {
    oneway: c.tags.oneway,
    highway_class: c.highway_class,
    twin_oneway: c.twin ? c.twin.tags.oneway : null,
    twin_distance_m: c.twin_distance_m ?? null,
    twin_searched: c.twin_searched ?? false,
  };
}

function valid(r: unknown): r is RoadTravel {
  const o = r as Partial<RoadTravel> | null;
  return !!o && TRAVELS.has(o.travel as string) && VERDICTS.has(o.carriageway as string);
}

/** Attaches the backend's `travel` to each candidate, or leaves them all
 *  without it when the backend isn't configured, fails, times out or
 *  answers out of shape.  Never throws. */
export async function attachRoadTravel(candidates: RoadCandidate[]): Promise<void> {
  const url = process.env.MODAL_RENDER_URL;
  const secret = process.env.MODAL_RENDER_SECRET;
  if (!url || !secret || candidates.length === 0) return;
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/render/road-travel`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${secret}` },
      body: JSON.stringify({ roads: candidates.map(facts) }),
      signal: AbortSignal.timeout(ROAD_TRAVEL_TIMEOUT_MS),
    });
    if (!res.ok) return;
    const body = (await res.json()) as { roads?: unknown[] };
    const roads = body?.roads;
    if (!Array.isArray(roads) || roads.length !== candidates.length || !roads.every(valid)) return;
    candidates.forEach((c, i) => {
      c.travel = roads[i] as RoadTravel;
    });
  } catch {
    // Unreachable or timed out: no words (Rule 10).
  }
}
