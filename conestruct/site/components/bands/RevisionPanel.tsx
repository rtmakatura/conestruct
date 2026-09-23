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
import { symClass } from "@/lib/design/symbols";

/** One row's two columns.  `now` is null for a deferred row, which
 *  reads rule 95.5's sentence instead of a number. */
interface PanelRow {
  key: string;
  label: string;
  /** Rule 95.15's 380 px label ("Spacing", "Devices"). */
  short: string;
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
      short: "Taper L",
      was: ft(w?.taper_l_ft),
      now: previewed ? ft(n?.taper_l_ft) : null,
    },
    {
      key: "buffer",
      label: "Buffer B",
      short: "Buffer B",
      was: ft(w?.buffer_b_ft),
      now: previewed ? ft(n?.buffer_b_ft) : null,
    },
    {
      key: "spacing",
      label: "Device spacing",
      short: "Spacing",
      was: ft(w?.device_spacing_ft),
      now: previewed ? ft(n?.device_spacing_ft) : null,
    },
    {
      key: "devices",
      label: "Total devices",
      short: "Devices",
      was: opts.settled ? String(opts.settled.total_devices) : "—",
      now: previewed ? String(opts.preview?.total_devices ?? "—") : null,
    },
    // Rule 95.6's two, in all four situations — including 7c, where a
    // number IS on hand for the rows above.  A verdict is the backend's
    // audit answer and NEEDS YOU counts its tiers; neither is in the
    // breakdown response, so neither is predicted (rulings 195, 204).
    { key: "verdict", label: "Verdict", short: "Verdict", was: opts.verdict, now: null },
    { key: "needs-you", label: "Needs you", short: "Needs you", was: String(opts.needsYou), now: null },
  ];
}

export function RevisionPanel({
  state,
  settled,
  stagedValue,
  verdict,
  needsYou,
  footer,
}: {
  state: PreviewState;
  settled: DeviceBreakdownData | null;
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
  const statusGlyph =
    state.kind === "ready" ? "✓" : state.kind === "error" ? "⚠" : "◌";

  return (
    <div className="a-panel" data-testid="revision-panel" data-preview={state.kind}>
      <div className="a-panel-head">
        {/* #289 fidelity F4 (X10): rule 91's section header is "WHAT THIS
            CHANGES" (the role uppercases).  It read "If you apply this". */}
        <span className="tr-section">What this changes</span>
        {/* Rule 91 + R3: which VALUE the figures are for, and which
            COMPUTATION produced them.  One string, true in all four
            situations. */}
        <span className="tr-prov a-panel-note" data-testid="panel-note">
          {previewHeaderNote(stagedValue)}
        </span>
      </div>

      <div className="a-panel-rows">
        {/* #289 fidelity F4 (X10): the column-header row ("<field> · was ·
            now") is gone — rules 92–93 specify the six data rows only; the
            header note (rule 91) already names which value the figures are
            for, and the band's own head names the field. */}
        {rows.map((r) => (
          <div
            key={r.key}
            className={`a-panel-row${r.now === null ? " is-deferred" : ""}`}
            data-testid={`panel-row-${r.key}`}
          >
            {/* #289 fidelity F7 — rule 92's four tracks: label · was · →
                · now.  Rule 95.15's short label is what 380 shows; the
                full one stays for assistive technology there. */}
            <span className="tr-field">
              <span className="lbl-long">{r.label}</span>
              <span className="lbl-short" aria-hidden>
                {r.short}
              </span>
            </span>
            <span className="a-val a-was">{r.was}</span>
            <span className="a-arrow" aria-hidden>
              →
            </span>
            <span className={r.now === null ? "tr-prov a-deferred" : "a-val a-now"}>
              {/* Rule 95.5's sentence for a row nobody can preview — the
                  same words in all four situations, so the row never
                  changes treatment for a reason the reader cannot see. */}
              {r.now ?? "recomputes on apply"}
            </span>
          </div>
        ))}
      </div>

      {/* Rule 95.4 / 95.14: mounted in every situation, holding its
          height, and the panel's only live region.  #289 fidelity F7:
          rule 90's order — six rows, THEN this row, then the footer (it
          sat above the rows) — and rule 95.4's symbol before the
          sentence, in rule 18's hue (◌ none, ✓ computed, ⚠ failed). */}
      <div
        className="a-panel-status"
        data-testid="panel-status"
        role="status"
        aria-live="polite"
      >
        <span className={`status-glyph ${symClass(statusGlyph)}`} aria-hidden>
          {statusGlyph}
        </span>
        <span data-testid="panel-status-line">{status}</span>
      </div>

      {footer}
    </div>
  );
}
