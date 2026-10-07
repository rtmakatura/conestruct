"use client";

// R107 (setup-what-redesign) — a WHAT row: the label with its marker under
// it, beside the control; a popover holding the full provenance line and
// every detail about the field.
//
// Authority: validation-artifacts/committed/setup-what-redesign/rulings.md.
// R107: "the label (with its marker under it) beside each control.  Every
// control is 44 px tall."  R110 Q7: "Two markers in the Lanes row (lanes
// measured; lane width its own source)" — so a row can carry a second
// marker for a second control.  It keeps everything R96 A built that R107
// does not replace (declutter-three-surfaces/rulings.md):
//   R98  — a field's provenance line may be a symbol-and-word marker with
//          the full line one click away; that counts as the line.
//   R101 — the details popover closes on click-away and Esc.
// R108 retired R100's record slot: there is no confirm step left to
// record, so a row has no third state between its marker and its line.
//
// THE MARKER (lib/scenarios/provenance-marker.ts) is symbol + word (P9)
// under the label, and it is the popover's trigger.  A line that needs the
// operator now — an error, "⚠ needs you" — has no marker: it stays a full
// line under the control (P3), and the label row offers "i details" when
// there is more to say.  An `alert` (a boundary warning) is on show under
// the control whatever the marker says (P3).
//
// THE POPOVER stays MOUNTED, `hidden` while closed (#198: the sentences in
// it are the same text nodes they were, still in the document).  It
// overlays the page — nothing below it moves (P1).  It opens on click,
// tap, Enter or Space, never on hover (rules 141, 142), and closes on
// click-away or Esc, Esc returning focus to its trigger (R101).  The
// trigger keeps the `info-toggle-<field>` test id and "Details for
// <label>" name.

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { symClass } from "@/lib/design/symbols";
import type { ProvenanceMarker } from "@/lib/scenarios/provenance-marker";

/** A second marker in the same row (R110 Q7): its own field's word, the
 *  same popover. */
export interface ExtraMarker {
  marker: ProvenanceMarker;
  /** The field it speaks for, as its trigger's accessible name says. */
  label: string;
  testid: string;
}

export function FieldCell({
  label,
  htmlFor,
  provenance,
  marker,
  extraMarkers = [],
  alert = null,
  info = null,
  children,
  testid,
}: {
  label: string;
  htmlFor?: string;
  /** Rule 137's line — required, never empty.  The caller renders it so
   *  its own amber / error treatment and test ids stay where they were. */
  provenance: ReactNode;
  /** R98: the line as symbol + word.  `null` keeps the line itself under
   *  the control (it needs the operator now). */
  marker: ProvenanceMarker | null;
  extraMarkers?: ExtraMarker[];
  /** On show under the control, whatever the marker says (P3). */
  alert?: ReactNode;
  /** Everything else about this field, in the popover under the line. */
  info?: ReactNode;
  children: ReactNode;
  testid: string;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const cellRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const hasInfo = info !== null && info !== undefined && info !== false;
  const inlineLine = marker === null;
  // What the popover holds: the line (unless it is already on show) and
  // the field's details.  Nothing to hold, no popover and no trigger.
  const hasPopover = !inlineLine || hasInfo;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (cellRef.current && !cellRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const trigger = (
    m: ProvenanceMarker,
    forLabel: string,
    id: string,
    first: boolean,
  ) => (
    <button
      key={id}
      ref={first ? triggerRef : undefined}
      type="button"
      aria-expanded={open}
      aria-controls={panelId}
      // The visible word leads (WCAG 2.5.3); the field's label stays the
      // field's: "Road type" names the select, "Details for Road type" this.
      aria-label={`Details for ${forLabel}`}
      onClick={() => setOpen((o) => !o)}
      data-testid={`info-toggle-${id}`}
      className={`a-mark tr-prov is-${m.tone}`}
    >
      <span aria-hidden>{`${m.glyph} ${m.word}`}</span>
    </button>
  );

  return (
    <div className="a-cell" data-testid={`cell-${testid}`} ref={cellRef}>
      <div className="a-cell-head">
        {htmlFor ? (
          <label className="tr-field" htmlFor={htmlFor}>
            {label}
          </label>
        ) : (
          <span className="tr-field">{label}</span>
        )}
        {marker !== null && (
          <span className="a-marks">
            {trigger(marker, label, testid, true)}
            {extraMarkers.map((x) => trigger(x.marker, x.label, x.testid, false))}
          </span>
        )}
        {inlineLine && hasInfo && (
          <button
            ref={triggerRef}
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={`Details for ${label}`}
            onClick={() => setOpen((o) => !o)}
            data-testid={`info-toggle-${testid}`}
            className="a-lk a-info-toggle"
          >
            <span className={`a-sym ${symClass("i")}`} aria-hidden>
              i
            </span>
            <span aria-hidden>details</span>
          </button>
        )}
      </div>
      <div className="a-cell-ctl">
        {children}
        {inlineLine && <div className="a-cell-foot">{provenance}</div>}
        {alert}
      </div>
      {hasPopover && (
        <div
          id={panelId}
          className="a-info a-pop"
          role="group"
          aria-label={`Details for ${label}`}
          hidden={!open}
          data-testid={`info-${testid}`}
        >
          {!inlineLine && provenance}
          {info}
        </div>
      )}
    </div>
  );
}

/** R107's segmented control: one 44 px track per option, split evenly
 *  ("this fixes the empty gap after 'Arterial'"), each option a button
 *  that declares its pressed state.  `value` null presses none (#308's
 *  undecided carriageway). */
export function Segmented<V extends string | boolean>({
  name,
  options,
  value,
  onChange,
  locked,
}: {
  /** The group's accessible name. */
  name: string;
  options: ReadonlyArray<{ v: V; l: string }>;
  value: V | null;
  onChange: (next: V) => void;
  locked: boolean;
}) {
  return (
    <div
      className="a-seg"
      role="group"
      aria-label={name}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          data-write=""
          aria-pressed={value === o.v}
          aria-disabled={locked || undefined}
          onClick={() => {
            if (!locked && value !== o.v) onChange(o.v);
          }}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}
