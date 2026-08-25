"use client";

// The progress rail (issue #221) — Zone 1's pre-generate steering line.
// Pure navigation over deriveRail's output: every entry is a jump link
// to its FieldGroup header; the entry that owns the current blocker
// renders the CTA's disabled-reason VERBATIM (same string, same source
// — lib/scenarios/rail.ts); every other unresolved blocker shows its
// own ⚠ so nothing queues invisibly (rule 10).  The rail POINTS at the
// sections and at the refusal notice — it never re-states a refusal in
// different words (#180: the strings are the affordance pointer or the
// short decline line, both existing strings).
//
// Rule 13: no state is glyph-only — ✓/⚠/◌ ride next to the label and a
// visible state word (⚠ carries its text; ◌ says "not set"/"pending");
// the ◌ states render chromeless gray (--none), never a verdict color.
//
// Focus policy (#193/arc 7): a rail click is a USER-INITIATED armed
// action — it may scroll and move focus.  It lands on the section's
// header (id + tabIndex -1 via FieldGroup's anchorId), announced as
// "<label> — STEP n"; background re-renders never move focus.

import type { Rail, RailEntry } from "@/lib/scenarios/rail";
import { jumpToAnchor } from "./GeneratorFormPrimitives";

const GLYPH: Record<RailEntry["state"], string> = {
  done: "✓",
  attention: "⚠",
  pending: "◌",
  notset: "◌",
};

function entryAria(e: RailEntry, ownsBlocker: boolean): string {
  const state =
    e.state === "done"
      ? "done"
      : e.state === "notset"
        ? "not set"
        : e.state === "pending"
          ? "pending — set a location first"
          : `needs attention: ${e.issues.map((i) => i.text).join(" Also: ")}`;
  return `${e.label} — ${state}${ownsBlocker ? " (current blocker)" : ""}`;
}

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
            aria-label={entryAria(e, ownsBlocker)}
            onClick={() => jumpToAnchor(e.anchorId)}
          >
            {/* One ⚠ per unresolved blocker on this entry — distinct
                glyphs, never a rollup that hides a queued hold. */}
            {e.state === "attention" ? (
              e.issues.map((iss, i) => (
                <span key={i} className="rail-glyph" aria-hidden>
                  {GLYPH.attention}
                </span>
              ))
            ) : (
              <span className="rail-glyph" aria-hidden>
                {GLYPH[e.state]}
              </span>
            )}
            <span className="rail-label">{e.label}</span>
            {e.state === "notset" && (
              <span className="rail-note">not set</span>
            )}
            {e.state === "pending" && (
              <span className="rail-note">pending</span>
            )}
            {ownsBlocker && (
              <span className="rail-blocker">{blocker.message}</span>
            )}
            {/* Non-blocker ⚠ entries still say so in text (rule 13) —
                the full issue texts live in their sections and in the
                accessible name above. */}
            {e.state === "attention" && !ownsBlocker && (
              <span className="rail-note">needs attention</span>
            )}
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
