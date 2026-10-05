/**
 * #308 — MIRROR of `src/rules/carriageway.py` (the backend is
 * authoritative, Rule 3).  This copy only decides what the picker
 * auto-applies (`divided`, the lane-width fit), the provenance line, and
 * when the WHAT band's confirm row arms.  Every plan is built from the
 * backend's own verdict on the relayed facts.
 *
 * Ruling R83: "One-way is its own fact. Divided = a same-name twin runs
 * the opposite direction within the radius. If the test can't decide, the
 * operator confirms; the plan doesn't guess."
 */

/** Mirror of `TWIN_RADIUS_M` (CHOSEN on the backend, R86; its measured
 *  rationale lives there). */
export const TWIN_RADIUS_M = 100;

const ONE_WAY_TAGS = new Set(["yes", "-1"]);
const STREET_CLASSES = new Set(["primary", "secondary", "tertiary", "unclassified", "residential"]);

export type CarriagewayVerdict = "one_way_street" | "divided" | "undecided" | "not_applicable";

export interface TwinEvidence {
  distanceM: number | null;
  searched: boolean;
}

/** The raw facts the shoulder scenario relays (`ShoulderScenario.carriageway`). */
export interface CarriagewayFacts {
  oneway: string | null;
  highwayClass: string;
  twinDistanceM: number | null;
  twinSearched: boolean;
  confirmed?: "one_way_street" | "divided";
}

/** Whether the twin rule speaks for this road at all. */
export function carriagewayApplies(onewayTag: string | null, highwayClass: string): boolean {
  return ONE_WAY_TAGS.has(onewayTag ?? "") && STREET_CLASSES.has(highwayClass);
}

export function carriagewayVerdict(facts: CarriagewayFacts | undefined): CarriagewayVerdict {
  if (!facts) return "not_applicable";
  if (facts.confirmed) return facts.confirmed;
  if (!carriagewayApplies(facts.oneway, facts.highwayClass)) return "not_applicable";
  if (facts.twinDistanceM !== null && facts.twinDistanceM <= TWIN_RADIUS_M) return "divided";
  if (!facts.twinSearched) return "undecided";
  return "one_way_street";
}
