// #289 Phase 2, S7 — the revision preview, which is a READ.
//
// Authority: validation-artifacts/committed/issue-289-band-stack/rulings.md
// (ruling e, and 195 / 201 / 202 / 203 / 204) · #281 Part 2 rules 90–95.15
// · #282, which put `preview: bool = False` on the wire with a sender
// count of deliberately zero.  This is the first sender.
//
// WHAT A PREVIEW IS, in #281's words: "A preview is a read.  No band, no
// lock, never memoised, never written; commit-on-blur/Enter, never per
// keystroke; the fast request only (breakdown), never the audit, scan or
// PDFs."  Every clause of that is a line in this file or in the shell
// that calls it.
//
// WHAT THE BACKEND DOES WITH THE FLAG, recorded where the field is
// defined (src/api/schemas.py:196-223): `preview: true` computes the
// cheap numbers from the scenario as given and does NOT run the site
// scan — so nothing is fetched, nothing is memoised, and the scan's
// honest 400 cannot fire.  The consequence the ruling accepts, and which
// rule 91's header note states on the surface: a preview computes
// taper / buffer / spacing WITHOUT the site adjustments an APPLY would
// add.  Preview is not applied (#198's family), and the response's own
// `preview: true` echo is the mechanism that stops a consumer
// presenting one as the other.

import type { DeviceBreakdownData } from "@/components/DeviceBreakdown";

/**
 * The panel's four situations (rules 95.3–95.5), which map onto request
 * state directly — checkpoint §E.2:
 *
 *   7a  no request has been fired for the value in the field
 *   7b  in flight
 *   7c  landed
 *   7d  failed
 *
 * They are a state, not a guess: nothing here infers a situation from a
 * timer or from how long an answer took (ruling 201 cut the "0.9 s").
 */
export type PreviewState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; data: DeviceBreakdownData; forValue: string }
  | { kind: "error" };

/** Rule 201's status row, verbatim: "computed for 35 mph · taper,
 *  buffer, spacing and counts only".  The value is the STAGED one,
 *  because that is the question the preview asked. */
export function previewStatusLine(value: string): string {
  return `computed for ${value} · taper, buffer, spacing and counts only`;
}

/** Rule 91's header note, with R3's clause (ruled 2026-09-22): the panel
 *  states which value the figures are for AND which computation produced
 *  them.  True in all four situations, which is why it is one string and
 *  not a predicate. */
export function previewHeaderNote(value: string): string {
  return `for ${value} · before site conditions`;
}

/**
 * Ruling 202's two blind-apply sentences, verbatim.  APPLY stays enabled
 * in 7b and 7d — "the button works; the sentence says you are applying
 * blind."
 */
export function blindApplySentence(
  state: PreviewState,
  enumeration: string,
): string | null {
  if (state.kind === "loading") {
    return `${enumeration} staged · preview still computing — Apply re-generates the full plan either way`;
  }
  if (state.kind === "error") {
    return `${enumeration} staged · preview failed — Apply re-generates the full plan without a preview`;
  }
  return null;
}
