"use client";

// The progress rail (issue #221; vocabulary #228) — Zone 1's
// pre-generate steering line.  Pure navigation over deriveRail's
// output: every entry is a jump link to its FieldGroup header; the
// entry that owns the current blocker renders the CTA's
// disabled-reason VERBATIM (same string, same source —
// lib/scenarios/rail.ts); every other unresolved blocker shows its
// own ⚠ so nothing queues invisibly (rule 10).  The rail POINTS at
// the sections and at the refusal notice — it never re-states a
// refusal in different words (#180).
//
// #228: this component RENDERS the vocabulary, it never derives it —
// state, glyph, word, info, and aria are fields on deriveRail's
// entries (single voice, asserted by the sentinel test in
// ProgressRail.single-voice.test.tsx).  The only strings born here
// are the Generate slot's — a join of ``blocker``'s own fields, not a
// re-derivation (ruling 8); the step index renders zero-padded
// (ruling 4: format CHOSEN — display formatting of the derived
// number, like the blocker join).
//
// Rule 13: no state is glyph-only — every glyph rides next to the
// label and its derived state word (or the blocker string), and the
// whole announcement is the derived ``aria``.
//
// Focus policy (#193/arc 7): a rail click is a USER-INITIATED armed
// action — it may scroll and move focus.  It lands on the section's
// header (id + tabIndex -1 via FieldGroup's anchorId), announced as
// "<label> — STEP n"; background re-renders never move focus.

import type { Rail } from "@/lib/scenarios/rail";
import { jumpToAnchor } from "./GeneratorFormPrimitives";

export function ProgressRail({
  rail,
  generateAnchorId,
}: {
  rail: Rail;
  /** DOM id of the Generate footer the trailing entry jumps to. */
  generateAnchorId: string;
}) {
  const blocker = rail.blocker;
  return (
    <nav aria-label="Plan progress" className="progress-rail">
      {rail.entries.map((e) => {
        const ownsBlocker = blocker !== null && blocker.entryId === e.id;
        return (
          <button
            key={e.id}
            type="button"
            className={`rail-entry st-${e.state}${ownsBlocker ? " current" : ""}`}
            aria-label={e.aria}
            onClick={() => jumpToAnchor(e.anchorId)}
          >
            {/* One ⚠ per unresolved blocker on this entry — the
                derived glyph repeats per issue, never a rollup that
                hides a queued hold. */}
            {e.state === "attention" ? (
              e.issues.map((_iss, i) => (
                <span key={i} className="rail-glyph" aria-hidden>
                  {e.glyph}
                </span>
              ))
            ) : (
              <span className="rail-glyph" aria-hidden>
                {e.glyph}
              </span>
            )}
            <span className="rail-step" aria-hidden>
              {String(e.step).padStart(2, "0")}
            </span>
            <span className="rail-label">{e.label}</span>
            {ownsBlocker ? (
              <span className="rail-blocker">{blocker.message}</span>
            ) : (
              e.word !== null && (
                <span className="rail-note">{e.word}</span>
              )
            )}
            {e.info !== null && <span className="rail-info">{e.info}</span>}
          </button>
        );
      })}
      <button
        type="button"
        className={`rail-entry st-generate${
          blocker !== null && blocker.entryId === null ? " current" : ""
        }`}
        aria-label={
          blocker === null
            ? "Generate — ready"
            : blocker.entryId === null
              ? `Generate — blocked: ${blocker.message}`
              : "Generate — blocked, see the marked step"
        }
        onClick={() => jumpToAnchor(generateAnchorId)}
      >
        <span className="rail-glyph" aria-hidden>
          {blocker === null ? "✓" : "→"}
        </span>
        <span className="rail-label">Generate</span>
        {/* A refusal with no section affordance has no home entry — its
            pointer line renders here so the blocker is never invisible. */}
        {blocker !== null && blocker.entryId === null && (
          <span className="rail-blocker">{blocker.message}</span>
        )}
      </button>
    </nav>
  );
}
