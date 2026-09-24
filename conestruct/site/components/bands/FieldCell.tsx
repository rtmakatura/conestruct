"use client";

// #289 WHAT density — Ryan: "WAY too busy" (P19).  The ruling:
//
//   "Each field shows exactly: the control, ONE provenance line (source ·
//   value · method), and any suggestion needing action as one line +
//   Confirm/Dismiss.  Everything else attached to that field … moves
//   behind an ⓘ toggle on that field that expands inline on click/tap.
//   Never hover-only (rules 141, 142).  #214's disclosure stays standing
//   and inspectable behind the toggle, text byte-identical (#198)."
//
// So a cell is: label (and, when the field has more to say, its toggle
// on the same row), the control, rule 137's one provenance line, the
// suggestion's one actionable line, and the details panel.
//
// THE TOGGLE.  Rule 17's info symbol is "i" (mono 12.5, rule 18's
// #34a9e8), and rule 18 puts every symbol beside a word, so it reads
// "i details".  It is a button: click, tap, Enter and Space all open it,
// `aria-expanded` says which state it is in, and nothing opens on hover
// (rule 141).  Its hit box is rule 15's (32 px, 44 at ≤480, in CSS).
//
// THE PANEL stays MOUNTED, `hidden` while closed, rather than rendered
// on open: the sentences in it are the same text nodes they were before
// the move (#198 byte-identity; #214's caveat "never drops"), still in
// the document, and one press away.

import { useId, useState, type ReactNode } from "react";
import { symClass } from "@/lib/design/symbols";

export function FieldCell({
  label,
  htmlFor,
  provenance,
  action = null,
  info = null,
  children,
  testid,
}: {
  label: string;
  htmlFor?: string;
  /** Rule 137's line — required, never empty.  The caller renders it so
   *  its own amber / error treatment and test ids stay where they were. */
  provenance: ReactNode;
  /** The suggestion needing action: one line + Confirm / Dismiss (or its
   *  standing record + Undo, #227).  Null when nothing asks for action. */
  action?: ReactNode;
  /** Everything else about this field.  Null means the field has nothing
   *  more to say, and then it has no toggle. */
  info?: ReactNode;
  children: ReactNode;
  testid: string;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const hasInfo = info !== null && info !== undefined && info !== false;
  return (
    <div className="a-cell" data-testid={`cell-${testid}`}>
      <div className="a-cell-head">
        {htmlFor ? (
          <label className="tr-field" htmlFor={htmlFor}>
            {label}
          </label>
        ) : (
          <span className="tr-field">{label}</span>
        )}
        {hasInfo && (
          <button
            type="button"
            // `.a-lk` is rule 134's fact link: mono 9.5, act ink, 32 px and
            // 44 at ≤480 (rule 163) — the band's one quiet text control,
            // read again rather than a new register.
            className="a-lk a-info-toggle"
            aria-expanded={open}
            aria-controls={panelId}
            // The visible word leads (WCAG 2.5.3, label in name), and the
            // field's own label stays the field's: "Road type" names the
            // select, "Details for Road type" names this.
            aria-label={`Details for ${label}`}
            onClick={() => setOpen((o) => !o)}
            data-testid={`info-toggle-${testid}`}
          >
            <span className={`a-sym ${symClass("i")}`} aria-hidden>
              i
            </span>
            <span aria-hidden>details</span>
          </button>
        )}
      </div>
      {children}
      {provenance}
      {action}
      {hasInfo && (
        <div
          id={panelId}
          className="a-info"
          hidden={!open}
          data-testid={`info-${testid}`}
        >
          {info}
        </div>
      )}
    </div>
  );
}
