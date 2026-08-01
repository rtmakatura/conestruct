// #197 — the input-identity stamp: one idiom for "this answer is for the
// input on screen".
//
// The defect class this closes (2026-07-29 UX audit, umbrella #197): a
// computed answer — a verdict, a dollar total, a document link, an error
// message — surviving an input change and rendering as if current.  Rule
// 10: a stale answer presented as current is a silent substitution.
//
// The contract, established by the verdict strip's ``forScenario`` field
// (render-types.ts, frontend-engine-removal Decision 2) and verified to
// hold on every writer path:
//
//   1. Every answer is STAMPED, at the moment it is produced, with the
//      identity of every input it was computed from.
//   2. Every presenter CHECKS the stamp against the inputs on screen
//      before presenting the answer as current.  On mismatch the honest
//      render states are "computing" or "stale — redo", never the old
//      answer undecorated.  "No answer yet" and "answer refused" stay
//      distinct — a refused input is never masked by a computing state.
//
// Comparison is strict identity (Object.is), never structural equality:
// every input object in this codebase is spread-replaced on edit
// (``setScenario({ ...scenario, ... })``, ``setSettings({ ...settings,
// ... })``), so identity change is exactly "the user changed this
// input".  A value-equal clone is a different input on purpose — where
// that errs, it errs toward re-checking, never toward staleness.
//
// Two sanctioned variants, for surfaces where the current input is not a
// live state object:
//   * baseline-ref (downloads, #183): the stamp is the last-persisted
//     object, retained in a ref; mismatch means "unsaved edits", which
//     may over-trigger (edit-then-undo) but never under-triggers.
//   * clear-on-invalidate (detection relays, #189-3): when the answer
//     itself rides the wire, a stale answer is REMOVED, not decorated —
//     absence renders as absence (Rule 10).

/** The input identities an answer was computed from, in a fixed order
 *  chosen by the surface (document it at the writer). Opaque values —
 *  identity comparison only, never read fields off a stamp. */
export type AnswerStamp = readonly unknown[];

/** True iff every stamped input is (Object.is) the corresponding current
 *  input.  An absent or arity-mismatched stamp is never current: an
 *  answer that can't prove which inputs produced it doesn't get
 *  presented as the answer for these. */
export function stampMatches(
  stamp: AnswerStamp | undefined,
  current: AnswerStamp,
): boolean {
  if (!stamp || stamp.length !== current.length) return false;
  return stamp.every((input, i) => Object.is(input, current[i]));
}
