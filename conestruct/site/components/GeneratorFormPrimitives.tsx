"use client";

import type { ReactNode } from "react";

// One numbered scheme across the whole panel (replaces the prior
// 01 / A-C / OPT / DEFINE mix). A section is either a numbered step
// (``step``) or optional metadata (``optional``); the right-hand tag
// reads "STEP n" or "OPTIONAL" accordingly.
// ``anchorId`` (#221): the header row becomes the progress rail's jump
// target — id + tabIndex -1 so a rail click (a user-initiated armed
// action per the #193 focus policy) can land focus on the section
// heading; never in the Tab order.
//
// ``pending`` (#222): pre-pin, the steps after Location render present
// but not inviting — the header stays, a focusable summary names the
// gate ("set a location first", itself a jump to the Location step),
// and the field body dims to 0.35 AND goes ``inert`` (out of the Tab
// order and the accessibility tree — the summary IS the keyboard/AT
// path, no focus trap).  Opacity is never the only channel (rule 13):
// the ◌ + text row rides with it, the s2-arc5 extended-footage
// precedent.  ``inert`` is a plain DOM attribute here (React 18 passes
// it through the spread); every evergreen browser enforces it, and
// aria-hidden is the explicit twin for the tree.
export function FieldGroup({
  label,
  step,
  optional = false,
  anchorId,
  pending = false,
  children,
}: {
  label: string;
  step?: number;
  optional?: boolean;
  anchorId?: string;
  pending?: boolean;
  children: ReactNode;
}) {
  const tag = optional ? "OPTIONAL" : step !== undefined ? `STEP ${step}` : "";
  return (
    <div>
      <div
        id={anchorId}
        tabIndex={anchorId !== undefined ? -1 : undefined}
        // #226: type moves off the container onto the two role spans —
        // label = section role, tag = step-index role (tr-* classes,
        // lib/design/type-roles.ts).  The tag's --act → dim recolor also
        // repairs the act=interactive-only rule (globals.css role
        // colors): the tag is not interactive.  DOM shape (a div with
        // exactly these two spans) is pinned by the #222 prepin test.
        className="flex justify-between items-center px-6 py-2 border-t border-b border-[color:var(--rule)] bg-[color:var(--canvas)] outline-none"
      >
        <span className="tr-section">{label}</span>
        {tag && <span className="tr-step">{tag}</span>}
      </div>
      {pending && (
        <button
          type="button"
          className="step-pending-summary"
          onClick={() => jumpToAnchor("rail-step-location")}
        >
          <span aria-hidden>◌</span> Pending — set a location first
        </button>
      )}
      <div
        className={pending ? "px-6 py-4 step-pending-body" : "px-6 py-4"}
        aria-hidden={pending || undefined}
        {...(pending ? ({ inert: "" } as Record<string, string>) : {})}
      >
        {children}
      </div>
    </div>
  );
}

// The rail's jump behavior (#221/#222) — a USER-INITIATED armed action
// per the #193 focus policy: scroll (reduced-motion aware, the #152-E
// idiom) and move focus to the target header.  A missing anchor is a
// no-op, never a throw.
export function jumpToAnchor(anchorId: string) {
  const el = document.getElementById(anchorId);
  if (!el) return;
  const reduceMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({
    behavior: reduceMotion ? "auto" : "smooth",
    block: "start",
  });
  el.focus({ preventScroll: true });
}

export function Field({ children }: { children: ReactNode }) {
  return <div className="mb-3 last:mb-0">{children}</div>;
}

export function CheckRow({
  on,
  label,
  desc,
  evidence,
  onToggle,
}: {
  on: boolean;
  label: string;
  desc?: string;
  // #16 — backend-relayed detection evidence ("2 found, nearest ~122 m"
  // + detail lines).  Rendered inside the row (as extra check-desc
  // spans) rather than as a sibling element so the #200 junction rule
  // (.check-row + :not(.check-row)) never fires mid-list, and the
  // margin is part of the checkbox's announced content rather than
  // hidden from AT.  Absent ⇒ nothing renders (#186).
  evidence?: string[];
  onToggle: () => void;
}) {
  return (
    // fix-spec-02 P1·05·02: the toggle exposes checkbox semantics —
    // without them a screen reader hears an unnamed state-free button
    // and the on/off state exists only as a fill color (hue-alone).
    // The native <button> keeps Space/Enter activation and tab focus.
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      className={`check-row ${on ? "on" : ""}`}
      onClick={onToggle}
    >
      <span className="check-box" />
      <span className="check-lbl">{label}</span>
      {desc && <span className="check-desc">{desc}</span>}
      {evidence?.map((line, i) => (
        <span key={i} className="check-desc">
          {line}
        </span>
      ))}
    </button>
  );
}

export function ChipRow<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: Array<{ v: T; l: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="chip-row">
      {options.map((o) => (
        // fix-spec-02 P1·05·02: aria-pressed carries the selection state
        // the cyan fill shows visually.
        <button
          key={String(o.v)}
          type="button"
          aria-pressed={value === o.v}
          className={`chip ${value === o.v ? "on" : ""}`}
          onClick={() => onChange(o.v)}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

// Inline field-level validation error (UX audit finding UX-21).  Same
// visual family as the flagger pilot-car hint, but red — these mirror
// backend gates the render API enforces with HTTP 400, not advisories.
export function FieldErrorLine({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--fail)] mt-1.5"
    >
      ⚠ {children}
    </div>
  );
}

// Primary CTA — the only button that runs generation. Labeled with the
// generate verb, not a download verb (UX audit finding UX-17): per-file
// download buttons live on the output cards, and in workbench mode this
// button downloads nothing at all (sandbox additionally auto-downloads
// the zip as a side effect). Extracted here (Mapbox-free module) so the
// label is unit-testable via renderToStaticMarkup — same pattern as
// AuditTrail.test.tsx / lib/scenarios/overrides.ts.
//
// ``disabled`` + ``disabledReason`` gate generation on invalid inputs
// (UX-21): the reason renders adjacent below the button (hover-only
// via ``title`` would fail on touch) so a disabled CTA is never
// unexplained.
export function GenerateButton({
  generating,
  onGenerate,
  disabled = false,
  disabledReason,
}: {
  generating: boolean;
  onGenerate: () => void;
  disabled?: boolean;
  disabledReason?: string;
}) {
  return (
    <>
      <button
        type="button"
        className="generate-btn"
        onClick={onGenerate}
        disabled={generating || disabled}
        title={!generating && disabled ? disabledReason : undefined}
      >
        {generating ? (
          <>
            <span className="inline-block w-3 h-3 rounded-full border-[1.5px] border-[#06222F]/40 border-t-[#06222F] animate-spin" />
            Generating plan…
          </>
        ) : (
          <>Generate plan</>
        )}
      </button>
      {!generating && disabled && disabledReason && (
        <div
          role="alert"
          className="mt-2 font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--fail)] text-center"
        >
          {disabledReason}
        </div>
      )}
    </>
  );
}

// fix-spec-02 P1·05·03: pass ``htmlFor`` (with a matching ``id`` on the
// control) to render a real <label> — the row was a bare <div>, so
// every workbench select/slider/input had no programmatic name and no
// click-to-focus.  Rows that caption a button group (ChipRow) stay
// <div>s: a <label> may only name one form control.
export function LabelRow({
  children,
  value,
  htmlFor,
}: {
  children: ReactNode;
  value?: ReactNode;
  htmlFor?: string;
}) {
  const body = (
    <>
      <span>{children}</span>
      {value !== undefined && (
        <span className="field-val text-[color:var(--act)]">{value}</span>
      )}
    </>
  );
  return htmlFor ? (
    <label className="field-label-row" htmlFor={htmlFor}>
      {body}
    </label>
  ) : (
    <div className="field-label-row">{body}</div>
  );
}
