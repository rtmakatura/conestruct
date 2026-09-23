"use client";

// #289 Phase 2, S7 — the before/after panel.
//
// Authority: #281 Part 2 rules 90–95.15, rulings 195 / 201 / 202 / 203 /
// 204, and the checkpoint's §E.3.  Ruling e in
// validation-artifacts/committed/issue-289-band-stack/rulings.md.
//
// SIX ROWS, ALWAYS, IN ALL FOUR SITUATIONS (rule 90).  Four are
// previewed — taper L, buffer B, device spacing, total devices — from
// `zone_geometry` and `total_devices`, which the breakdown response
// already carries and the counts hero already renders.  Two are
// DEFERRED — Verdict and Needs you — which "always show their current
// value in `was` and always read `recomputes on apply` in `now`, in all
// four situations, including 7c" (rule 95.6).  They are never predicted:
// that is rulings 195 and 204 discharged at the row level, and it is why
// the deferred treatment is a property of the ROW and not of the state.
//
// THE RESERVED STATUS ROW (rule 95.4) is what makes 7a → 7b → 7c move
// nothing below it, and it is the panel's ONLY live region (rule 95.14).
// The row is mounted in every situation and holds its height; what
// changes is the sentence inside it.
//
// WHAT THE PANEL NEVER DOES: compute.  Every previewed number comes off
// the response; every deferred row says so instead of guessing (rule 3,
// and rule 10 — an answer nobody has is not shown as one).

import type { ReactNode } from "react";
import type { DeviceBreakdownData } from "../DeviceBreakdown";
import {
  previewHeaderNote,
  previewStatusLine,
  type PreviewState,
} from "@/lib/scenarios/preview";

/** One row's two columns.  `now` is null for a deferred row, which
 *  reads rule 95.5's sentence instead of a number. */
interface PanelRow {
  key: string;
  label: string;
  was: string;
  now: string | null;
}

const ft = (n: number | undefined): string =>
  n == null ? "—" : `${Math.round(n).toLocaleString("en-US")} ft`;

/**
 * The six rows, from the settled answer on screen and (when there is
 * one) the preview's.  Exported for the suite: the row set is rule 90's
 * claim, and it must be provable without a DOM.
 */
export function panelRows(opts: {
  settled: DeviceBreakdownData | null;
  preview: DeviceBreakdownData | null;
  verdict: string;
  needsYou: number;
}): PanelRow[] {
  const w = opts.settled?.zone_geometry;
  const n = opts.preview?.zone_geometry;
  const previewed = opts.preview !== null;
  return [
    {
      key: "taper",
      label: "Taper L",
      was: ft(w?.taper_l_ft),
      now: previewed ? ft(n?.taper_l_ft) : null,
    },
    {
      key: "buffer",
      label: "Buffer B",
      was: ft(w?.buffer_b_ft),
      now: previewed ? ft(n?.buffer_b_ft) : null,
    },
    {
      key: "spacing",
      label: "Device spacing",
      was: ft(w?.device_spacing_ft),
      now: previewed ? ft(n?.device_spacing_ft) : null,
    },
    {
      key: "devices",
      label: "Total devices",
      was: opts.settled ? String(opts.settled.total_devices) : "—",
      now: previewed ? String(opts.preview?.total_devices ?? "—") : null,
    },
    // Rule 95.6's two, in all four situations — including 7c, where a
    // number IS on hand for the rows above.  A verdict is the backend's
    // audit answer and NEEDS YOU counts its tiers; neither is in the
    // breakdown response, so neither is predicted (rulings 195, 204).
    { key: "verdict", label: "Verdict", was: opts.verdict, now: null },
    { key: "needs-you", label: "Needs you", was: String(opts.needsYou), now: null },
  ];
}

export function RevisionPanel({
  state,
  settled,
  fieldLabel,
  stagedValue,
  verdict,
  needsYou,
  footer,
}: {
  state: PreviewState;
  settled: DeviceBreakdownData | null;
  fieldLabel: string;
  /** The staged value, as the field says it — "35 mph", "3 lanes". */
  stagedValue: string;
  verdict: string;
  needsYou: number;
  /** APPLY / DISCARD and their sentence — the shell's, because the
   *  staged set and the write live there (ruling e: one staging
   *  mechanism, never per editor). */
  footer?: ReactNode;
}): ReactNode {
  const preview = state.kind === "ready" ? state.data : null;
  const rows = panelRows({ settled, preview, verdict, needsYou });

  // Rule 95.4's reserved row, in its four situations.  7a is quiet on
  // purpose (ruling 203: "Nothing is wrong in 7a").
  const status =
    state.kind === "loading"
      ? "computing…"
      : state.kind === "error"
        ? "preview unavailable — the plan on screen is unchanged"
        : state.kind === "ready"
          ? previewStatusLine(stagedValue)
          : "change the value to see what it does";

  return (
    <div className="a-panel" data-testid="revision-panel" data-preview={state.kind}>
      <div className="a-panel-head">
        <span className="tr-section">If you apply this</span>
        {/* Rule 91 + R3: which VALUE the figures are for, and which
            COMPUTATION produced them.  One string, true in all four
            situations. */}
        <span className="tr-prov" data-testid="panel-note">
          {previewHeaderNote(stagedValue)}
        </span>
      </div>

      {/* Rule 95.4 / 95.14: mounted in every situation, holding its
          height, and the panel's only live region. */}
      <div
        className="a-panel-status"
        data-testid="panel-status"
        role="status"
        aria-live="polite"
      >
        {status}
      </div>

      <div className="a-panel-rows">
        <div className="a-panel-row a-panel-head-row" aria-hidden>
          <span className="tr-field">{fieldLabel}</span>
          <span className="tr-field">was</span>
          <span className="tr-field">now</span>
        </div>
        {rows.map((r) => (
          <div
            key={r.key}
            className={`a-panel-row${r.now === null ? " is-deferred" : ""}`}
            data-testid={`panel-row-${r.key}`}
          >
            <span className="tr-field">{r.label}</span>
            <span className="a-val">{r.was}</span>
            <span className={r.now === null ? "tr-prov" : "a-val"}>
              {/* Rule 95.5's sentence for a row nobody can preview — the
                  same words in all four situations, so the row never
                  changes treatment for a reason the reader cannot see. */}
              {r.now ?? "recomputes on apply"}
            </span>
          </div>
        ))}
      </div>

      {footer}
    </div>
  );
}
