// #252 (s2-arc23) — the working band's one derivation.
//
// While a request for the GENERATED scenario is open, the band names
// what is happening from the two wire bodies alone: ``prev`` is the
// scenario the last SETTLED audit answered (the #197 stamp carried
// forward as ``lastSettledFor``), ``next`` is the scenario on the wire
// now.  No click bookkeeping: the verb and object are true statements
// about the difference between the two objects, and when that
// difference is not one the band can name it says "the plan" (rule 10:
// an honest generic beats a guessed specific).
//
//   GENERATING     the settled answer carried no ``site_scan`` (or there
//                  is none): this flight is the first Generate.  Object:
//                  "new plan · {address}" from ``meta.address``; when the
//                  user typed none, the pin — never a placeholder name.
//   RE-GENERATING  a scanned plan is being re-made.  Object, in order:
//                  a correction added → "after a correction to {name}";
//                  a correction removed → "after undoing the correction
//                  to {name}"; the proceed acknowledgement → "without the
//                  site check"; one of the strip's inline fields →
//                  "after an edit to {field}"; the same object again
//                  (Retry) → "retrying the site scan"; else "the plan".
//
// Rule 3: lookups and comparisons only.  ``toFixed(4)`` on the pin is
// display formatting of a wire number.  RENDERING (file renders) joins
// in a later commit.

import type { Scenario, SiteConditionOverride } from "./scenarios/types";
import { SCANNED_FLAG_LABELS } from "./scenarios/site-corrections";
import { carriesSiteScan } from "./scenarios/site-scan";

export type WorkingVerb = "GENERATING" | "RE-GENERATING";

export interface WorkingBandState {
  verb: WorkingVerb;
  /** The mono part of the object sentence. */
  lead: string;
  /** The part the user named (address, pin, condition name), set in
   *  sans (spec 18); null when the whole object is the system's words. */
  named: string | null;
}

/** The strip's inline editors (SetupStrip), scenario key → the words. */
const EDIT_LABELS: ReadonlyArray<readonly [string, string]> = [
  ["speed", "speed"],
  ["laneWidth", "lane width"],
  ["workLen", "work zone length"],
  ["jurisdiction_key", "jurisdiction"],
  ["street_class", "street class"],
];
const SCHEDULE_LABELS: ReadonlyArray<readonly [string, string]> = [
  ["work_date", "work date"],
  ["work_date_end", "end date"],
  ["start_time", "start time"],
  ["end_time", "end time"],
];

const sameMarker = (a: SiteConditionOverride, b: SiteConditionOverride): boolean =>
  a.flag === b.flag && a.action === b.action && a.reason === b.reason && a.note === b.note;

function conditionName(flag: string): string {
  return (SCANNED_FLAG_LABELS as Record<string, string>)[flag] ?? flag;
}

export function deriveWorkingBand(args: {
  inFlight: boolean;
  prev: Scenario | null;
  next: Scenario;
}): WorkingBandState | null {
  const { inFlight, prev, next } = args;
  if (!inFlight) return null;

  if (prev === null || !carriesSiteScan(prev)) {
    const address = (next.meta.address ?? "").trim();
    if (address.length > 0) return { verb: "GENERATING", lead: "new plan · ", named: address };
    const { lat, lng } = next.meta;
    return {
      verb: "GENERATING",
      lead: "new plan · pin ",
      named: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    };
  }

  const verb: WorkingVerb = "RE-GENERATING";
  const prevMarkers = prev.meta.siteConditionOverrides ?? [];
  const nextMarkers = next.meta.siteConditionOverrides ?? [];
  const added = nextMarkers.find((m) => !prevMarkers.some((p) => sameMarker(p, m)));
  if (added) return { verb, lead: "after a correction to ", named: conditionName(added.flag) };
  const removed = prevMarkers.find((m) => !nextMarkers.some((n) => sameMarker(n, m)));
  if (removed) {
    return { verb, lead: "after undoing the correction to ", named: conditionName(removed.flag) };
  }

  if (
    next.site_scan?.proceed_if_unavailable === true &&
    prev.site_scan?.proceed_if_unavailable !== true
  ) {
    return { verb, lead: "without the site check", named: null };
  }

  const p = prev as unknown as Record<string, unknown>;
  const n = next as unknown as Record<string, unknown>;
  for (const [key, label] of EDIT_LABELS) {
    if (p[key] !== n[key]) return { verb, lead: `after an edit to ${label}`, named: null };
  }
  const ps = (prev.schedule ?? {}) as Record<string, unknown>;
  const ns = (next.schedule ?? {}) as Record<string, unknown>;
  for (const [key, label] of SCHEDULE_LABELS) {
    if (ps[key] !== ns[key]) return { verb, lead: `after an edit to ${label}`, named: null };
  }

  // The same wire object again: only Retry re-sends an answered input.
  if (prev === next) return { verb, lead: "retrying the site scan", named: null };
  return { verb, lead: "the plan", named: null };
}
