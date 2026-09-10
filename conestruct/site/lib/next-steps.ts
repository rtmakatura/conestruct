// #253 — the post-generate next-steps strip, DERIVED here and rendered
// verbatim by <ResultsHead> (the deriveRail idiom, #228: one derivation,
// one voice).  Replaces the #249 count lockup (GO ruling: conflict 1 —
// one field, one surface).
//
// The strip renders iff a plan LANDED: generated, an answer for the
// generated scenario has settled since the Generate click, and the pair
// was not declined (spec 31 — the refusal container owns a declined
// page; the c2 declined pair included).  Under the working band the
// derivation reads the last confirmed answer (``lastReady``) so the
// counts hold for the whole flight — they never tick, never grey to a
// placeholder, never predict (spec 22, P16).  An audit error (no verdict
// on the wire) is null: nothing to count.
//
// Every figure names its wire field (rule 12; never a literal five):
//   chip 1  sections.site_scan — open = detected keyed buckets with no
//           server correction of any status (deriveCorrectionsStanding,
//           the SAME derivation the block's Apply row reads — P2), total
//           = keyed buckets present on the wire; the staged set is
//           APPENDED ("· k STAGED"), never subtracted (#254 owns the
//           wording); "◌ NOT SCANNED" only when the wire says not_run /
//           unavailable (or carries no scan section: nothing was scanned)
//           — a declared change from the lockup's null for those states.
//   chip 2  pending_verification.count (audit.py, after the #177 confirm
//           markers) — server-confirmed, never a client-side tick.
//   chip 3  BUNDLE_PART_KINDS.length — the zip's parts, produced in the
//           plan's own request; a broken breakdown is "◌ NOT PRODUCED"
//           (inert).  No wire state backs "not yet evaluated" (conflict
//           3), so that state never renders.
//
// Vocabulary (P9, spec 20): ▲ work the operator owes · ✓ a server-
// confirmed zero or a server-produced artifact · ◌ nothing evaluated.
// Never "done", never a filled chip (spec 9).

import { BUNDLE_PART_KINDS, type AuditResponse, type AuditState, type SiteScanProvenance } from "./render-types";
import { SITE_CORRECTIONS_ANCHOR, deriveCorrectionsStanding } from "./scenarios/site-corrections";
import type { StagedCorrection } from "./scenarios/types";

/** Chip 2's target: the Reference zone (section 03; C may add a finer
 *  `#pending-items` inside it). */
export const REFERENCE_ANCHOR = "reference";
/** Chip 3's target: the shell-level wrapper around the download cards. */
export const DOWNLOADS_ANCHOR = "downloads";

export type NextStepsSite =
  | { kind: "counted"; open: number; total: number; staged: number }
  | { kind: "not_scanned"; status: "not_run" | "unavailable" };
export type NextStepsFiles = { kind: "ready"; n: number } | { kind: "not_produced" };

export interface NextSteps {
  site: NextStepsSite;
  pending: number;
  files: NextStepsFiles;
}

export function deriveNextSteps(args: {
  generated: boolean;
  /** An answer for the generated scenario has settled since the click. */
  landed: boolean;
  planDeclined: boolean;
  stripAudit: AuditState;
  /** The breakdown (the plan's own request) failed — no documents. */
  breakdownError: boolean;
  staged: readonly StagedCorrection[];
}): NextSteps | null {
  const { generated, landed, planDeclined, stripAudit, breakdownError, staged } = args;
  if (!generated || !landed || planDeclined) return null;
  const audit: AuditResponse | null =
    stripAudit.state === "ready"
      ? stripAudit.data
      : stripAudit.state === "loading"
        ? (stripAudit.lastReady ?? null)
        : null;
  if (!audit) return null;
  const pending = audit.pending_verification?.count;
  if (typeof pending !== "number") return null;
  const scan = audit.sections?.site_scan as SiteScanProvenance | undefined;
  let site: NextStepsSite;
  if (scan && scan.status === "ok") {
    const standing = deriveCorrectionsStanding(scan, staged);
    site = { kind: "counted", open: standing.open, total: standing.total, staged: standing.staged };
  } else {
    site = { kind: "not_scanned", status: scan?.status === "unavailable" ? "unavailable" : "not_run" };
  }
  const files: NextStepsFiles = breakdownError
    ? { kind: "not_produced" }
    : { kind: "ready", n: BUNDLE_PART_KINDS.length };
  return { site, pending, files };
}

export type ChipGlyph = "▲" | "✓" | "◌";
/** open: work owed (▲) · clear: a confirmed zero (✓) · ready: a produced
 *  artifact (✓) · none: nothing evaluated (◌). */
export type ChipState = "open" | "clear" | "ready" | "none";

export interface ChipView {
  index: "01" | "02" | "03";
  name: string;
  glyph: ChipGlyph;
  state: ChipState;
  /** The generated number, printed in the count register's numeral ink;
   *  null when the count carries no orange (0, or nothing evaluated). */
  numeral: string | null;
  /** The words after the numeral (or the whole count when numeral is null). */
  rest: string;
  anchor: string;
  /** aria-disabled — the one inert state (files not produced). */
  inert: boolean;
}

export function nextStepChips(s: NextSteps): [ChipView, ChipView, ChipView] {
  let site: ChipView;
  if (s.site.kind === "counted") {
    const suffix = s.site.staged > 0 ? ` · ${s.site.staged} STAGED` : "";
    site =
      s.site.open > 0
        ? { index: "01", name: "Site conditions", glyph: "▲", state: "open", numeral: String(s.site.open), rest: `OPEN/${s.site.total}${suffix}`, anchor: SITE_CORRECTIONS_ANCHOR, inert: false }
        : { index: "01", name: "Site conditions", glyph: "✓", state: "clear", numeral: null, rest: `0 OPEN/${s.site.total}${suffix}`, anchor: SITE_CORRECTIONS_ANCHOR, inert: false };
  } else {
    site = { index: "01", name: "Site conditions", glyph: "◌", state: "none", numeral: null, rest: "NOT SCANNED", anchor: SITE_CORRECTIONS_ANCHOR, inert: false };
  }
  const pending: ChipView =
    s.pending > 0
      ? { index: "02", name: "Pending items", glyph: "▲", state: "open", numeral: String(s.pending), rest: "OPEN", anchor: REFERENCE_ANCHOR, inert: false }
      : { index: "02", name: "Pending items", glyph: "✓", state: "clear", numeral: null, rest: "0 OPEN", anchor: REFERENCE_ANCHOR, inert: false };
  const files: ChipView =
    s.files.kind === "ready"
      ? { index: "03", name: "Download", glyph: "✓", state: "ready", numeral: String(s.files.n), rest: "FILES READY", anchor: DOWNLOADS_ANCHOR, inert: false }
      : { index: "03", name: "Download", glyph: "◌", state: "none", numeral: null, rest: "NOT PRODUCED", anchor: DOWNLOADS_ANCHOR, inert: true };
  return [site, pending, files];
}
