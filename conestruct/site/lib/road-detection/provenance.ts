// #273 — the provenance vocabulary, in one place.
//
// Two surfaces speak this vocabulary: the picker's field rows
// (LocationPickerModal.tsx) and the detected-vs-applied ledger
// (DetectedVsApplied.tsx).  Until this file they each minted the same
// strings independently — the picker composed `OSM · ${field.method}`
// at :2547 and the ledger composed the identical template at :156, then
// STRING-COMPARED its own output ("OSM · inferred") to pick the amber
// tone.  Two mints of one vocabulary, one of them load-bearing for
// color: a rename in either place would have drifted the other silently.
//
// So the words live here, the grammar lives here, and both surfaces
// compose from here.  provenance.test.ts freezes the token table, so a
// rename is a deliberate edit to a declared list rather than a typo that
// happens to compile.
//
// #198 does NOT bind these strings, and that is worth stating rather
// than assuming the stricter rule: `meta.confirmedRoad` — which carries
// every value below — is explicitly not backend-consumed (lib/scenarios/
// types.ts:290-297, "the Python backend ignores it"), `grep confirmedRoad
// src/` is empty, and no expectation fixture or deliverable contains
// `OSM · ` or `operator-set`.  The backend's own `operator-set`
// (src/rendering/audit_blocks.py:475) is unrelated prose about site-scan
// flags.  These are render-only words; the discipline that governs them
// is this file's frozen table, not byte-identity with a deliverable.

/**
 * How detection came by the value it reports.
 *
 * `measured` / `inferred` are the classifier's own enum (types.ts:32),
 * set once at classify time.  `overridden` is #275's third state: the
 * operator disputed the count and the marker rides the wire, so the
 * detection is a fact that was overruled rather than one that was never
 * made.
 */
export const DETECTED_TOKENS = ["measured", "inferred", "overridden"] as const;
export type DetectedToken = (typeof DETECTED_TOKENS)[number];

/**
 * Where the APPLIED value came from, when it is not the detected one.
 *
 * `operator-set` is the picker's existing third token (LocationPicker-
 * Modal.tsx:2547).  `changed in plan` covers the case the block used to
 * blame on the operator: auto-apply runs the detected value through
 * `snapSpeedToDomain` (auto-apply.ts:381) and `clampLanesToDomain`
 * (validation.ts:32), so a plan can differ from detection with nobody
 * having touched anything.  Saying `operator-set` there is a Rule 10
 * defect — it reports an operator action that did not happen.
 */
export const APPLIED_TOKENS = ["operator-set", "changed in plan"] as const;
export type AppliedToken = (typeof APPLIED_TOKENS)[number];

/** The source every clause opens with.  One word, not a sentence. */
export const SOURCE = "OSM";

/** The clause separator — a middot with hair space either side. */
export const SEP = " · ";

/**
 * What the detected-token position says when detection reported a value
 * but characterised it with nothing.  Rule 10: the absence is stated,
 * never left as a gap the reader has to interpret.
 */
export const NO_DETECTED_TOKEN = "no source tag";

/**
 * What the detected-VALUE position says when the detection was withdrawn
 * — the relay is cleared, nothing was recorded anywhere, and there is no
 * number to report (#275).  Ruled 2026-09-11: the word takes the value's
 * position, never the token's, because a clause reading
 * `OSM · 2 · withdrawn` prints the cleared relay's number as though it
 * still stood — exactly what #275 refused.
 */
export const WITHDRAWN = "withdrawn";

export interface ClauseInput {
  /**
   * The detected value as it would be displayed, or `null` when the
   * detection was withdrawn (see WITHDRAWN).
   */
  detectedValue: string | null;
  /** Absent when detection characterised the value with nothing. */
  detectedToken?: DetectedToken;
  /**
   * Absent when the applied value IS the detected value: a matching row
   * needs no applied fragment, because the clause already says the plan
   * used what was detected.
   */
  appliedToken?: AppliedToken;
}

/**
 * The picker's field-row label: `OSM · measured` / `OSM · inferred`.
 * The ledger's clause opens with the same two fragments, so the two
 * surfaces cannot drift apart.
 */
export function sourceToken(token: DetectedToken): string {
  return `${SOURCE}${SEP}${token}`;
}

/**
 * The ledger's line-2 clause (#273 spec 4.4 / 4.5, as amended).
 *
 *   MATCH   `OSM · <detected value> · <detected token>`
 *   DIFFER  `OSM · <detected value> · <detected token> · <applied token>`
 *
 * The detected value appears on EVERY row, matching or not: ruled
 * 2026-09-11 against the design's "same as detected", because on the
 * dominant flow (shoulder, fresh confirm, no edits) every row matches,
 * so that phrasing would render one sentence five times beside five
 * values.
 *
 * Measured at the `tr-prov` role on prod b2a325a: the worst MATCH is
 * 236.8 px and the worst DIFFER 332.8 px, which is what sets the row's
 * reserved clause height (one line at/above 520 px, two below).
 */
export function provenanceClause(input: ClauseInput): string {
  const { detectedValue, detectedToken, appliedToken } = input;
  const parts: string[] = [SOURCE];
  if (detectedValue === null) {
    // Withdrawn: there is no value, and therefore nothing for a detected
    // token to characterise.  The position is not filled with
    // `no source tag` — that would describe a detection that exists.
    parts.push(WITHDRAWN);
  } else {
    parts.push(detectedValue, detectedToken ?? NO_DETECTED_TOKEN);
  }
  if (appliedToken) parts.push(appliedToken);
  return parts.join(SEP);
}

/**
 * Does the plan's value agree with detection's?
 *
 * Compared as MODEL values, never as the strings on screen (#273
 * conflict 7 / spec 9.6).  Both sides are raw on every row — bearing and
 * speed and lanes are numbers, roadType is an enum, divided is a boolean
 * — so `"30"` vs `"30 mph"` cannot arise here the way it would from a
 * display comparison.
 *
 * Numbers are rounded before comparison because the display rounds them:
 * a difference the reader cannot see must not be reported as a
 * difference, or the glyph contradicts the row it sits beside.
 */
export function valuesAgree(
  detected: number | string | boolean | undefined,
  applied: number | string | boolean | undefined,
): boolean {
  if (detected === undefined || applied === undefined) return false;
  if (typeof detected === "number" && typeof applied === "number") {
    return Math.round(detected) === Math.round(applied);
  }
  return detected === applied;
}

/**
 * Which applied token a differing row carries.
 *
 * The caller decides whether the difference is exactly the domain snap,
 * because that question needs the scenario's kind and the existing snap
 * helpers; this file stays free of scenario imports so the vocabulary
 * has no dependency on the plan model.
 */
export function appliedTokenFor(opts: {
  differs: boolean;
  isDomainSnap: boolean;
}): AppliedToken | undefined {
  if (!opts.differs) return undefined;
  return opts.isDomainSnap ? "changed in plan" : "operator-set";
}
