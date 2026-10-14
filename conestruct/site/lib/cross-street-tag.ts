// #285: the work start's nearest named cross street, in the backend's own
// words ("210 ft N of West 38th Avenue").
//
// A read, asked once per confirmed pin (GeneratorSidebar, R131's
// one-answer pattern) and handed down; the frontend composes nothing
// (Rule 3).  Only a `found` answer carries words.  Every other answer
// (none within reach, a refused query, no road to ask about) leaves the
// tag on the ruled interim, the road name (Rule 10), and so does a
// request still in flight or one that failed.

import { useEffect, useRef, useState } from "react";
import type { Scenario } from "@/lib/scenarios/types";
import { hasLocation } from "@/lib/scenarios";
import { roadIsStale } from "@/lib/scenarios/band-facts";

/** The backend's answer (src/rules/nearest_intersection.py `Answer`). */
export interface NearestIntersection {
  status: "found" | "none" | "unavailable" | "not_applicable";
  text: string | null;
  cross_street: string | null;
  offset_ft: number | null;
  direction: string | null;
  source: "osm_shared_node" | "marked_cross_pin" | null;
  provenance_text: string | null;
  osm_node_id: number | null;
  reason: string | null;
  radius_m: number;
}

/** What the WHERE band prints: the tag and its provenance clause. */
export interface CrossStreetTag {
  text: string;
  provenance: string | null;
}

/** The scenario to ask about: a located work-start pin whose road was
 *  confirmed at this pin; null otherwise (nothing to ask). */
export function crossStreetRequestFor(scenario: Scenario): Scenario | null {
  const meta = scenario.meta;
  if (!hasLocation(meta) || meta.pinModel !== "work_start") return null;
  if (!meta.confirmedRoad?.candidate || roadIsStale(scenario)) return null;
  return scenario;
}

/** The answer depends on the pin, the road and (near_intersection) the
 *  marked cross pin and nothing else, so an edit to the speed or the work
 *  length asks nothing again. */
export function crossStreetKey(scenario: Scenario): string {
  const m = scenario.meta;
  const c = m.confirmedRoad?.candidate;
  const cross = scenario.kind === "near_intersection" ? (m.intersection ?? null) : null;
  return JSON.stringify([
    m.lat,
    m.lng,
    c?.way_id ?? null,
    c?.name ?? null,
    c?.ref ?? null,
    c?.geometry?.length ?? 0,
    cross ? [cross.lat, cross.lng, cross.name ?? null] : null,
  ]);
}

/** The tag a `found` answer carries; null for every other answer. */
export function crossStreetTag(answer: NearestIntersection | null): CrossStreetTag | null {
  if (!answer || answer.status !== "found" || !answer.text) return null;
  return { text: answer.text, provenance: answer.provenance_text };
}

export function useCrossStreetTag(scenario: Scenario | null): CrossStreetTag | null {
  const [answer, setAnswer] = useState<NearestIntersection | null>(null);
  const key = scenario ? crossStreetKey(scenario) : null;
  const latest = useRef(scenario);
  latest.current = scenario;
  useEffect(() => {
    // A new pin or road clears the old answer at once: a cross street
    // measured from another pin is never shown as this one's.
    setAnswer(null);
    if (key === null || latest.current === null) return;
    const controller = new AbortController();
    (async () => {
      try {
        const r = await fetch("/api/render/nearest-intersection", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ scenario: latest.current }),
          signal: controller.signal,
        });
        if (!r.ok) return;
        const a = (await r.json()) as NearestIntersection;
        if (!controller.signal.aborted) setAnswer(a);
      } catch {
        // Aborted or unreachable: the tag keeps the road name.
      }
    })();
    return () => controller.abort();
  }, [key]);
  return crossStreetTag(answer);
}
