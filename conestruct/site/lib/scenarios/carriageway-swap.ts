// #507 ruling 2 (R145-3): choosing the side that lays out on a grouped
// street's other carriageway swaps the confirmed road to that carriageway.
//
// The backend chose the carriageway (its side option carries
// `carriageway: "twin"`, render_api._twin_side_options); this only moves
// the records.  The twin's classification is the same one the picker's
// Save computes for a picked candidate (`classifyFromCandidate`, with the
// pin's own place context), so the plan that follows is the one a
// carriageway pick in the old picker produced: the same facts, the same
// device counts.

import { classifyFromCandidate } from "@/lib/road-detection/classify";
import type { ScenarioMeta, WorkPlacement } from "./types";

/** The meta with the twin carriageway confirmed and `work` written
 *  verbatim, or null when the confirmed road has no twin. */
export function swapToTwin(meta: ScenarioMeta, work: WorkPlacement): ScenarioMeta | null {
  const confirmed = meta.confirmedRoad;
  const twin = confirmed?.candidate.twin;
  if (!confirmed || !twin) return null;
  const { twin: _drop, ...lead } = confirmed.candidate;
  void _drop;
  return {
    ...meta,
    work: { ...work },
    confirmedRoad: {
      ...confirmed,
      candidate: { ...twin, twin: lead },
      classification: classifyFromCandidate(twin, confirmed.isUrban, confirmed.placeName),
    },
  };
}
