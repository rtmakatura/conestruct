"use client";

// R96 A (declutter-three-surfaces) — a WHAT cell: label, control, ONE
// quiet marker, and a popover holding the full provenance line and every
// detail about the field.
//
// Authority: validation-artifacts/committed/declutter-three-surfaces/
// rulings.md.  R98 amends rule 137: "A field's provenance line may be a
// symbol-and-word marker with the full line one click away; that counts as
// the provenance line."  R100: "An answered suggestion may collapse into
// its field."  R101: "The Step 2 details popover closes on click-away and
// Esc."  It supersedes #289 WHAT density's inline-expanding panel and its
// separate "i details" toggle: the marker IS the toggle.
//
// THE MARKER (lib/scenarios/provenance-marker.ts) is symbol + word (P9) in
// the cell's third row, so every cell keeps one shape: label / field /
// marker (P6).  A line that needs the operator now — an error, "⚠ needs
// you" — has no marker and stays a full line in that row (P3).
//
// THE RECORD (R100): an answered suggestion's decision line and its Undo
// (#227, #198's same nodes) take the third row instead; the field's
// details then open from a toggle in the label row.
//
// THE POPOVER stays MOUNTED, `hidden` while closed (#198: the sentences in
// it are the same text nodes they were, still in the document).  It
// overlays the page — nothing below it moves (P1).  It opens on click,
// tap, Enter or Space, never on hover (rules 141, 142), and closes on
// click-away or Esc, Esc returning focus to its trigger (R101).  The
// trigger keeps the `info-toggle-<field>` test id and "Details for
// <label>" name it had as the details toggle.

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { symClass } from "@/lib/design/symbols";
import type { ProvenanceMarker } from "@/lib/scenarios/provenance-marker";

export function FieldCell({
  label,
  htmlFor,
  provenance,
  marker,
  record = null,
  info = null,
  children,
  testid,
}: {
  label: string;
  htmlFor?: string;
  /** Rule 137's line — required, never empty.  The caller renders it so
   *  its own amber / error treatment and test ids stay where they were. */
  provenance: ReactNode;
  /** R98: the line as symbol + word.  `null` keeps the line itself in
   *  the cell's third row (it needs the operator now). */
  marker: ProvenanceMarker | null;
  /** R100: an answered suggestion's record, shown in the third row. */
  record?: ReactNode;
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
  const hasRecord = record !== null && record !== undefined && record !== false;
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

  const triggerProps = {
    ref: triggerRef,
    type: "button" as const,
    "aria-expanded": open,
    "aria-controls": panelId,
    // The visible word leads (WCAG 2.5.3); the field's label stays the
    // field's: "Road type" names the select, "Details for Road type" this.
    "aria-label": `Details for ${label}`,
    onClick: () => setOpen((o) => !o),
    "data-testid": `info-toggle-${testid}`,
  };
  // The marker sits in the third row; with a record or an inline line
  // there, the trigger is the label row's quiet "i details" link.
  const markerInFoot = !inlineLine && !hasRecord;

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
        {hasPopover && !markerInFoot && (
          <button {...triggerProps} className="a-lk a-info-toggle">
            <span className={`a-sym ${symClass("i")}`} aria-hidden>
              i
            </span>
            <span aria-hidden>details</span>
          </button>
        )}
      </div>
      {children}
      <div className="a-cell-foot">
        {hasRecord ? (
          <>
            {record}
            {/* A line that needs the operator stays on show beside the
                record (Rule 10, P3): the two checks are independent. */}
            {inlineLine && provenance}
          </>
        ) : inlineLine ? (
          provenance
        ) : (
          <button {...triggerProps} className={`a-mark tr-prov is-${marker.tone}`}>
            <span aria-hidden>{`${marker.glyph} ${marker.word}`}</span>
          </button>
        )}
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

/** A suggestion still WAITING for an answer — one line + Confirm /
 *  Dismiss — as a full-width row of the grid, directly under the grid row
 *  that holds its field (rulings.md, "The suggestion row spans the band":
 *  inside a cell its parts need ~374 px of a 236 px track).  Once
 *  answered, the record collapses into the field itself (R100) and this
 *  row is `:empty` and takes no track (CSS).
 *
 *  The caller renders it LAST in its field's grid row (in the DOM as on
 *  screen, so focus order is reading order) and passes the slot's
 *  "action" section. */
export function CellAction({
  label,
  testid,
  children,
}: {
  label: string;
  testid: string;
  children: ReactNode;
}) {
  return (
    <div
      className="a-cell-action"
      role="group"
      aria-label={`Suggestion for ${label}`}
      data-testid={`action-${testid}`}
    >
      {children}
    </div>
  );
}
